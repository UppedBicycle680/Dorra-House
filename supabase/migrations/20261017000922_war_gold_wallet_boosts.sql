-- Account Gold is separate from House cash and every match economy. No purchase,
-- client credit, starting grant or combat acceleration endpoint exists.
create table dorra_private.war_gold_accounts(
 user_id uuid primary key references auth.users(id) on delete cascade,
 balance bigint not null default 0 check(balance between 0 and 9000000000000000),
 version bigint not null default 0,updated_at timestamptz not null default now());
create table dorra_private.war_gold_ledger(
 id uuid primary key default gen_random_uuid(),user_id uuid not null,
 kind text not null check(kind in('admin-award','victory-reward','boost')),
 delta bigint not null,balance_after bigint not null check(balance_after between 0 and 9000000000000000),
 actor_id uuid,request_id uuid,match_id uuid,queue_id bigint,quote_id uuid,
 award_day date,reason text not null,metadata jsonb not null default '{}',created_at timestamptz not null default now(),
 check((kind='admin-award' and delta between 1 and 100000) or (kind='victory-reward' and delta in(0,5)) or (kind='boost' and delta<0)));
create unique index war_gold_reward_once on dorra_private.war_gold_ledger(user_id,match_id) where kind='victory-reward';
create unique index war_gold_boost_once on dorra_private.war_gold_ledger(quote_id) where kind='boost';
create index war_gold_history on dorra_private.war_gold_ledger(user_id,created_at desc,id);
create index war_gold_reward_day on dorra_private.war_gold_ledger(user_id,award_day) where kind='victory-reward';
create table dorra_private.war_gold_intents(
 actor_id uuid not null,request_id uuid not null,digest text not null,result jsonb not null,
 created_at timestamptz not null default now(),primary key(actor_id,request_id));
create table dorra_private.war_gold_quotes(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,digest text not null,unique(user_id,request_id),
 match_id uuid not null,queue_id bigint not null,kind text not null check(kind in('research','produce','build')),
 nation_id text not null,event_due numeric not null,event_payload jsonb not null,gold_cost bigint not null check(gold_cost>0),
 label text not null,remaining_seconds numeric not null,pricing_version text not null default 'queue-v1',
 expires_at timestamptz not null default clock_timestamp()+interval '60 seconds',created_at timestamptz not null default now());
create index war_gold_quotes_expiry on dorra_private.war_gold_quotes(expires_at);
create table dorra_private.war_gold_policy(id boolean primary key default true check(id),rewards_started_at timestamptz not null default clock_timestamp());
insert into dorra_private.war_gold_policy(id) values(true);
do $gold_tables$ declare table_name text;begin
 foreach table_name in array array['war_gold_accounts','war_gold_ledger','war_gold_intents','war_gold_quotes','war_gold_policy'] loop
  execute format('alter table dorra_private.%I enable row level security',table_name);
  execute format('revoke all on dorra_private.%I from public,anon,authenticated',table_name);
  execute format('grant select,insert,update,delete on dorra_private.%I to service_role',table_name);
 end loop;
end $gold_tables$;
revoke update,delete on dorra_private.war_gold_ledger,dorra_private.war_gold_intents from service_role;
revoke insert,update,delete on dorra_private.war_gold_policy from service_role;

create function dorra_private.war_gold_view(actor uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('balance',coalesce((select balance from dorra_private.war_gold_accounts where user_id=actor),0),
  'version',coalesce((select version from dorra_private.war_gold_accounts where user_id=actor),0),'purchasesAvailable',false,
  'pricingVersion','queue-v1','goldPerGameHour',10)
$$;

-- Polling and mutation responses include the small summary above. The owner
-- explicitly requests this history so private reasons never inflate map deltas.
create function dorra_private.war_gold_history_view(actor uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select dorra_private.war_gold_view(actor)||jsonb_build_object(
  'history',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'amount',delta,'delta',delta,'balanceAfter',balance_after,
   'reason',reason,'matchId',match_id,'createdAt',created_at) order by created_at desc,id),'[]')
   from(select * from dorra_private.war_gold_ledger where user_id=actor order by created_at desc,id limit 30) history))
$$;

-- Existing hourly maintenance retires only a bounded batch of expired quotes.
-- Permanent spend/reward/admin receipts and live quotes are never pruned here.
do $gold_quote_retention$ declare definition text;needle text;begin
 definition:=pg_get_functiondef('dorra_private.war_maintenance()'::regprocedure);
 needle:=' -- Only this feature''s cron history is pruned.';
 if strpos(definition,needle)=0 then raise exception 'Gold quote retention patch did not match';end if;
 execute replace(definition,needle,
  ' with expired as (select id from dorra_private.war_gold_quotes where expires_at<clock_timestamp()-interval ''5 minutes'' order by expires_at,id limit 1000 for update skip locked)'||chr(10)||
  ' delete from dorra_private.war_gold_quotes q using expired where q.id=expired.id;'||chr(10)||needle);
end $gold_quote_retention$;

-- Both the ordinary scheduler and Gold completion invoke this exact handler.
-- It consumes one locked event, never a queue prefix, combat pulse or AI turn.
create function dorra_private.war_complete_queue(mid uuid,event_id bigint,gt numeric) returns boolean
language plpgsql security invoker set search_path='' as $$
declare e dorra_private.war_events;owner text;nid text;p record;
begin
 delete from dorra_private.war_events where id=event_id and match_id=mid and kind in('research','produce','build') returning * into e;
 if not found then return false;end if;nid:=e.payload->>'nationId';
 if e.kind='research' then
  update dorra_private.war_sides set research=case when research ? (e.payload->>'platformId') then research else research||jsonb_build_array(e.payload->>'platformId') end where match_id=mid and nation_id=nid;
  perform dorra_private.war_report(mid,nid,gt,jsonb_build_object('type','research-complete','platformId',e.payload->>'platformId'));
 else
  select nation_id into owner from dorra_private.war_provinces where match_id=mid and province_id=e.payload->>'provinceId';
  if owner is distinct from nid then
   perform dorra_private.war_report(mid,nid,gt,jsonb_build_object('type','queue-lost','provinceId',e.payload->>'provinceId'));return false;
  end if;
  if e.kind='build' then
   update dorra_private.war_provinces set facilities=jsonb_set(facilities,array[e.payload->>'facility'],to_jsonb(coalesce((facilities->>(e.payload->>'facility'))::integer,0)+1)) where match_id=mid and province_id=e.payload->>'provinceId';
  else
   select * into p from dorra_private.war_catalog_platforms where id=e.payload->>'platformId';
   insert into dorra_private.war_units(match_id,nation_id,province_id,platform_id,name,domain) values(mid,nid,e.payload->>'provinceId',p.id,p.name,p.data->>'domain');
  end if;
  perform dorra_private.war_report(mid,nid,gt,jsonb_build_object('type',e.kind||'-complete')||e.payload);
 end if;
 return true;
end $$;
do $gold_completion$ declare definition text;needle text;start_pos integer;end_pos integer;begin
 definition:=pg_get_functiondef('dorra_private.war_advance(uuid,integer)'::regprocedure);
 needle:='delete from dorra_private.war_events where id=e.id;steps:=steps+1;';
 if strpos(definition,needle)=0 then raise exception 'Queue consumption patch did not match';end if;
 definition:=replace(definition,needle,'if e.kind not in(''research'',''produce'',''build'') then delete from dorra_private.war_events where id=e.id;end if;steps:=steps+1;');
 start_pos:=strpos(definition,' elsif e.kind=''research'' then');end_pos:=strpos(definition,' elsif e.kind=''strike'' then');
 if start_pos=0 or end_pos<=start_pos then raise exception 'Queue completion patch did not match';end if;
 execute substr(definition,1,start_pos-1)||' elsif e.kind in(''research'',''produce'',''build'') then'||chr(10)||' perform dorra_private.war_complete_queue(mid,e.id,e.due);'||chr(10)||substr(definition,end_pos);
 -- Avoid precision loss before JSON reaches JavaScript, including future IDs.
 definition:=pg_get_functiondef('dorra_private.war_view(uuid,uuid)'::regprocedure);
 needle:='jsonb_build_object(''id'',id,''platformId''';
 if strpos(definition,needle)=0 then raise exception 'Queue string identifier patch did not match';end if;
 definition:=replace(definition,needle,'jsonb_build_object(''id'',id::text,''platformId''');
 definition:=replace(definition,'jsonb_build_object(''id'',id,''facility''','jsonb_build_object(''id'',id::text,''facility''');execute definition;
end $gold_completion$;

create function dorra_private.war_gold_session(actor uuid,sid uuid,lease uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare player dorra_private.player_state;
begin
 if not exists(select 1 from auth.sessions where id=sid and user_id=actor and (not_after is null or not_after>now())) then raise exception 'AUTH_SESSION_ENDED';end if;
 perform 1 from dorra_private.profiles where user_id=actor and not disabled and not banned and (suspended_until is null or suspended_until<=now()) for share;
 if not found then raise exception 'ACCOUNT_DISABLED';end if;
 select * into player from dorra_private.player_state where user_id=actor for update;
 if not found then raise exception 'SAVE_REQUIRED';end if;
 if player.auth_session_id is distinct from sid or player.lease_id is distinct from lease then raise exception 'SESSION_REPLACED';end if;
 if player.rate_window>now()-interval '1 minute' and player.rate_count>=180 then raise exception 'RATE_LIMIT';end if;
 update dorra_private.player_state set rate_count=case when rate_window>now()-interval '1 minute' then rate_count+1 else 1 end,rate_window=case when rate_window>now()-interval '1 minute' then rate_window else now() end where user_id=actor;
end $$;

create function dorra_private.war_gold_command(actor uuid,sid uuid,lease uuid,action text,mid uuid,args jsonb,request_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare m dorra_private.war_matches;s dorra_private.war_sides;e dorra_private.war_events;q dorra_private.war_gold_quotes;
 cached dorra_private.war_gold_intents;wallet dorra_private.war_gold_accounts;digest text;gt numeric;remaining numeric;cost bigint;label text;receipt uuid;result jsonb;quote_json jsonb;
begin
 perform dorra_private.war_gold_session(actor,sid,lease);
 if args is null or jsonb_typeof(args)<>'object' or octet_length(args::text)>16000 then raise exception 'INVALID_ARGUMENTS';end if;
 if action='gold-wallet' then
  if args<>'{}' or mid is not null then raise exception 'INVALID_ARGUMENTS';end if;
  return jsonb_build_object('gold',dorra_private.war_gold_history_view(actor),'serverNow',extract(epoch from clock_timestamp())*1000);
 end if;
 if request_id is null then raise exception 'REQUEST_ID_REQUIRED';end if;
 digest:=md5(jsonb_build_object('action',action,'match',mid,'args',args)::text);
 select * into cached from dorra_private.war_gold_intents where actor_id=actor and war_gold_intents.request_id=war_gold_command.request_id;
 if found then
  if cached.digest<>digest then raise exception 'REQUEST_REUSED';end if;
  return cached.result||jsonb_build_object('replayed',true,'gold',dorra_private.war_gold_view(actor),'view',case when exists(select 1 from dorra_private.war_sides where match_id=mid and user_id=actor) then dorra_private.war_view(mid,actor) else null end,'serverNow',extract(epoch from clock_timestamp())*1000);
 end if;
 if exists(select 1 from dorra_private.war_requests where user_id=actor and war_requests.request_id=war_gold_command.request_id) then raise exception 'REQUEST_REUSED';end if;
 select * into q from dorra_private.war_gold_quotes where user_id=actor and war_gold_quotes.request_id=war_gold_command.request_id;
 if found then
  if q.digest<>digest then raise exception 'REQUEST_REUSED';end if;
  if q.expires_at<=clock_timestamp() then raise exception 'BOOST_QUOTE_EXPIRED';end if;
  quote_json:=jsonb_build_object('quoteId',q.id,'queueId',q.queue_id::text,'kind',q.kind,'label',q.label,'goldCost',q.gold_cost,'remainingGameSeconds',q.remaining_seconds,'expiresAt',q.expires_at,'pricingVersion',q.pricing_version);
  return jsonb_build_object('quote',quote_json,'result',jsonb_build_object('type','boost-quote','quote',quote_json),'replayed',true,'gold',dorra_private.war_gold_view(actor),'view',case when exists(select 1 from dorra_private.war_sides where match_id=mid and user_id=actor) then dorra_private.war_view(mid,actor) else null end,'serverNow',extract(epoch from clock_timestamp())*1000);
 end if;
 select * into m from dorra_private.war_matches where id=mid for update;
 if not found then raise exception 'MATCH_NOT_FOUND';end if;
 select * into s from dorra_private.war_sides where match_id=mid and user_id=actor;
 if not found then raise exception 'MATCH_FORBIDDEN';end if;
 if m.status<>'running' or s.retired then raise exception 'MATCH_NOT_RUNNING';end if;
 perform dorra_private.war_advance(mid);select * into m from dorra_private.war_matches where id=mid;
 if m.status<>'running' then raise exception 'MATCH_NOT_RUNNING';end if;gt:=dorra_private.war_now(m);
 if (select min(due) from dorra_private.war_events where match_id=mid)<=gt then raise exception 'MATCH_CATCHING_UP';end if;
 if action='boost-quote' then
  if (args-array['queueId'])<>'{}' or jsonb_typeof(args->'queueId')<>'string' or coalesce(args->>'queueId','')!~'^[1-9][0-9]{0,18}$' or (args->>'queueId')::numeric>9223372036854775807 then raise exception 'INVALID_ARGUMENTS';end if;
  select * into e from dorra_private.war_events where id=(args->>'queueId')::bigint and match_id=mid for update;
 else
  if action<>'boost' or (args-array['quoteId','confirmed'])<>'{}' or args->'confirmed' is distinct from 'true'::jsonb or coalesce(args->>'quoteId','')!~'^[0-9a-fA-F-]{36}$' then raise exception 'BOOST_CONFIRM_REQUIRED';end if;
  select * into q from dorra_private.war_gold_quotes where id=(args->>'quoteId')::uuid and user_id=actor and match_id=mid for update;
  if not found then raise exception 'BOOST_QUOTE_UNAVAILABLE';end if;
  if q.expires_at<=clock_timestamp() then raise exception 'BOOST_QUOTE_EXPIRED';end if;
  if exists(select 1 from dorra_private.war_gold_ledger where quote_id=q.id) then raise exception 'BOOST_ALREADY_COMPLETED';end if;
  select * into e from dorra_private.war_events where id=q.queue_id and match_id=mid for update;
 end if;
 if e.id is null or e.kind not in('research','produce','build') or e.payload->>'nationId' is distinct from s.nation_id or e.due<=gt then raise exception 'BOOST_QUEUE_UNAVAILABLE';end if;
 if action='boost' and (e.kind<>q.kind or e.due<>q.event_due or e.payload<>q.event_payload or q.nation_id<>s.nation_id) then raise exception 'BOOST_QUEUE_UNAVAILABLE';end if;
 if e.kind in('build','produce') and not exists(select 1 from dorra_private.war_provinces where match_id=mid and province_id=e.payload->>'provinceId' and nation_id=s.nation_id) then raise exception 'BOOST_QUEUE_UNAVAILABLE';end if;
 if e.kind='research' and s.research ? (e.payload->>'platformId') then raise exception 'BOOST_QUEUE_UNAVAILABLE';end if;
 if e.kind='produce' and (select count(*) from dorra_private.war_units where match_id=mid and nation_id=s.nation_id)>=80 then raise exception 'FORMATION_CAP';end if;
 remaining:=greatest(0,e.due-gt);cost:=greatest(1,ceil(remaining/3600*10))::bigint;
 if action='boost-quote' then
  if e.kind='build' then label:=initcap(replace(e.payload->>'facility','-',' '));else select name into label from dorra_private.war_catalog_platforms where id=e.payload->>'platformId';end if;
  -- Quote request caching is temporary, unlike every accepted financial receipt.
  -- Bound one account's cache independently of its gameplay request rate.
  delete from dorra_private.war_gold_quotes where user_id=actor and expires_at<clock_timestamp()-interval '5 minutes';
  if (select count(*) from dorra_private.war_gold_quotes where user_id=actor)>=100 then raise exception 'RATE_LIMIT';end if;
  insert into dorra_private.war_gold_quotes(user_id,request_id,digest,match_id,queue_id,kind,nation_id,event_due,event_payload,gold_cost,label,remaining_seconds)
  values(actor,request_id,digest,mid,e.id,e.kind,s.nation_id,e.due,e.payload,cost,coalesce(label,'Queue completion'),remaining) returning * into q;
  quote_json:=jsonb_build_object('quoteId',q.id,'queueId',q.queue_id::text,'kind',q.kind,'label',q.label,'goldCost',q.gold_cost,'remainingGameSeconds',q.remaining_seconds,'expiresAt',q.expires_at,'pricingVersion',q.pricing_version);
  result:=jsonb_build_object('quote',quote_json,'result',jsonb_build_object('type','boost-quote','quote',quote_json));
 else
  cost:=least(cost,q.gold_cost);
  insert into dorra_private.war_gold_accounts(user_id) values(actor) on conflict do nothing;
  select * into wallet from dorra_private.war_gold_accounts where user_id=actor for update;
  if wallet.balance<cost then raise exception 'INSUFFICIENT_GOLD';end if;
  update dorra_private.war_gold_accounts set balance=balance-cost,version=version+1,updated_at=now() where user_id=actor returning * into wallet;
  if not dorra_private.war_complete_queue(mid,e.id,gt) then raise exception 'BOOST_QUEUE_UNAVAILABLE';end if;
  insert into dorra_private.war_gold_ledger(user_id,kind,delta,balance_after,actor_id,request_id,match_id,queue_id,quote_id,reason,metadata)
  values(actor,'boost',-cost,wallet.balance,actor,request_id,mid,e.id,q.id,'Instant '||q.kind||': '||q.label,jsonb_build_object('pricingVersion',q.pricing_version,'quotedCost',q.gold_cost)) returning id into receipt;
  update dorra_private.war_matches set revision=revision+1 where id=mid;
  perform dorra_private.war_notify(mid);
  result:=jsonb_build_object('result',jsonb_build_object('type','boost','receiptId',receipt,'quoteId',q.id,'queueId',e.id::text,'kind',e.kind,'goldSpent',cost));
 end if;
 if action='boost' then insert into dorra_private.war_gold_intents(actor_id,request_id,digest,result) values(actor,request_id,digest,result);end if;
 return result||jsonb_build_object('gold',dorra_private.war_gold_view(actor),'view',dorra_private.war_view(mid,actor),'serverNow',extract(epoch from clock_timestamp())*1000);
end $$;

-- A reward receipt is permanent even when the match request cache is pruned.
-- House cash and Gold settle in the same outer command transaction.
create function dorra_private.war_gold_reward(actor uuid,mid uuid,request_id uuid) returns integer
language plpgsql security invoker set search_path='' as $$
declare m dorra_private.war_matches;s dorra_private.war_sides;wallet dorra_private.war_gold_accounts;existing dorra_private.war_gold_ledger;reward_date date;earned bigint;award integer:=0;eligible boolean;
begin
 select * into existing from dorra_private.war_gold_ledger where user_id=actor and match_id=mid and kind='victory-reward';
 if found then return existing.delta::integer;end if;
 select * into m from dorra_private.war_matches where id=mid;select * into s from dorra_private.war_sides where match_id=mid and user_id=actor;
 eligible:=m.status='finished' and m.winner=s.nation_id and not s.retired and m.game_anchor>=86400
  and exists(select 1 from dorra_private.war_rewards where user_id=actor and match_id=mid and created_at>=(select rewards_started_at from dorra_private.war_gold_policy where id));
 reward_date:=(clock_timestamp() at time zone 'Australia/Brisbane')::date;
 insert into dorra_private.war_gold_accounts(user_id) values(actor) on conflict do nothing;
 select * into wallet from dorra_private.war_gold_accounts where user_id=actor for update;
 select coalesce(sum(delta),0) into earned from dorra_private.war_gold_ledger where user_id=actor and kind='victory-reward' and award_day=reward_date;
 if eligible and earned<=5 and wallet.balance<=9000000000000000-5 then award:=5;end if;
 -- Even a capped/lost settlement adds visible wallet history. Version tracks
 -- every ledger append so a compact response invalidates cached history.
 update dorra_private.war_gold_accounts set balance=balance+award,version=version+1,updated_at=now() where user_id=actor returning * into wallet;
 insert into dorra_private.war_gold_ledger(user_id,kind,delta,balance_after,actor_id,request_id,match_id,award_day,reason,metadata)
 values(actor,'victory-reward',award,wallet.balance,actor,request_id,mid,reward_date,'Match completion',jsonb_build_object('eligibleVictory',coalesce(eligible,false),'dailyCap',10));
 return award;
end $$;

-- Preserve the existing authority implementation, adding only account-scoped
-- Gold responses and permanent reward receipts at the public facade.
do $gold_core$ declare definition text;begin
 definition:=pg_get_functiondef('public.dorra_war_command(uuid,uuid,uuid,text,uuid,jsonb,uuid)'::regprocedure);
 execute replace(definition,'FUNCTION public.dorra_war_command(','FUNCTION dorra_private.war_command_without_gold(');
end $gold_core$;
create or replace function public.dorra_war_command(p_user_id uuid,p_auth_session_id uuid,p_lease_id uuid,p_action text,p_match_id uuid default null,p_args jsonb default '{}',p_request_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;cached dorra_private.war_gold_intents;digest text;award integer;
begin
 if p_action in('gold-wallet','boost-quote','boost') then return dorra_private.war_gold_command(p_user_id,p_auth_session_id,p_lease_id,p_action,p_match_id,p_args,p_request_id);end if;
 if p_request_id is not null and exists(select 1 from dorra_private.war_gold_quotes where user_id=p_user_id and request_id=p_request_id) then
  perform dorra_private.war_gold_session(p_user_id,p_auth_session_id,p_lease_id);raise exception 'REQUEST_REUSED';
 end if;
 -- New Gold receipts reserve their request identifiers across every action.
 if p_request_id is not null and exists(select 1 from dorra_private.war_gold_intents where actor_id=p_user_id and request_id=p_request_id) then
  perform dorra_private.war_gold_session(p_user_id,p_auth_session_id,p_lease_id);
  select * into cached from dorra_private.war_gold_intents where actor_id=p_user_id and request_id=p_request_id;
  digest:=md5(jsonb_build_object('action',p_action,'match',p_match_id,'args',p_args)::text);
  if cached.digest<>digest then raise exception 'REQUEST_REUSED';end if;
  return cached.result||jsonb_build_object('replayed',true,'gold',dorra_private.war_gold_view(p_user_id),'view',case when exists(select 1 from dorra_private.war_sides where match_id=p_match_id and user_id=p_user_id) then dorra_private.war_view(p_match_id,p_user_id) else null end,'serverNow',extract(epoch from clock_timestamp())*1000);
 end if;
 result:=dorra_private.war_command_without_gold(p_user_id,p_auth_session_id,p_lease_id,p_action,p_match_id,p_args,p_request_id);
 if p_action='reward' then
  award:=dorra_private.war_gold_reward(p_user_id,p_match_id,p_request_id);
  result:=jsonb_set(result,'{result,goldAward}',to_jsonb(award));
  digest:=md5(jsonb_build_object('action',p_action,'match',p_match_id,'args',p_args)::text);
  -- A simultaneous identical claim can miss the initial cache before waiting
  -- for the delegated player lock. Its now-visible receipt is a replay, not a
  -- duplicate-key error; a different intent must still roll back atomically.
  insert into dorra_private.war_gold_intents(actor_id,request_id,digest,result) values(p_user_id,p_request_id,digest,result-'view'-'gold'-'serverNow') on conflict(actor_id,request_id) do nothing;
  if not found then
   select * into cached from dorra_private.war_gold_intents where actor_id=p_user_id and request_id=p_request_id;
   if cached.digest is distinct from digest then raise exception 'REQUEST_REUSED';end if;
   result:=result||jsonb_build_object('replayed',true);
  end if;
 end if;
 return result||jsonb_build_object('gold',dorra_private.war_gold_view(p_user_id));
end $$;

create function public.dorra_admin_gold_grant(p_actor uuid,p_session uuid,p_target uuid,p_amount integer,p_reason text,p_request uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare context jsonb;wallet dorra_private.war_gold_accounts;cached dorra_private.war_gold_intents;digest text;receipt uuid;result jsonb;
begin
 context:=dorra_private.staff_context(p_actor,p_session,true);
 if context->>'role'<>'admin' then raise exception 'PERMISSION_DENIED';end if;
 if p_request is null or p_amount is null or p_amount<1 or p_amount>100000 or p_reason is null or length(trim(p_reason)) not between 1 and 1000 or p_reason~'[\x00-\x08\x0B\x0C\x0E-\x1F]' then raise exception 'INVALID_ARGUMENTS';end if;
 -- Serialize administrator request IDs even when their target changes.
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text||':'||p_request::text,16113124));
 digest:=md5(jsonb_build_object('action','admin-gold','target',p_target,'amount',p_amount,'reason',trim(p_reason))::text);
 select * into cached from dorra_private.war_gold_intents where actor_id=p_actor and request_id=p_request;
 if found then if cached.digest<>digest then raise exception 'REQUEST_REUSED';end if;return cached.result||jsonb_build_object('replayed',true);end if;
 if exists(select 1 from dorra_private.admin_audit where actor=p_actor and request_id=p_request) then raise exception 'REQUEST_REUSED';end if;
 if exists(select 1 from dorra_private.war_gold_quotes where user_id=p_actor and request_id=p_request) then raise exception 'REQUEST_REUSED';end if;
 perform 1 from dorra_private.profiles where user_id=p_target and not disabled and not banned and (suspended_until is null or suspended_until<=now()) for share;
 if not found then raise exception 'ACCOUNT_DISABLED';end if;
 insert into dorra_private.war_gold_accounts(user_id) values(p_target) on conflict do nothing;
 select * into wallet from dorra_private.war_gold_accounts where user_id=p_target for update;
 if wallet.balance>9000000000000000-p_amount then raise exception 'GOLD_BALANCE_LIMIT';end if;
 update dorra_private.war_gold_accounts set balance=balance+p_amount,version=version+1,updated_at=now() where user_id=p_target returning * into wallet;
 insert into dorra_private.war_gold_ledger(user_id,kind,delta,balance_after,actor_id,request_id,reason)
 values(p_target,'admin-award',p_amount,wallet.balance,p_actor,p_request,trim(p_reason)) returning id into receipt;
 result:=jsonb_build_object('ok',true,'action','gold-grant','targetId',p_target,'recordId',receipt,'goldBalance',wallet.balance,'amount',p_amount,'changes',jsonb_build_array(jsonb_build_object('label','War Gold','before',wallet.balance-p_amount,'after',wallet.balance)),'serverNow',now());
 insert into dorra_private.admin_audit(actor,target,session_id,action,reason,changes,request_id,preview_digest,result)
 values(p_actor,p_target,p_session,'gold-grant',trim(p_reason),result->'changes',p_request,digest,result);
 insert into dorra_private.war_gold_intents(actor_id,request_id,digest,result) values(p_actor,p_request,digest,result);
 return result;
end $$;

-- Staff list/detail projections only; public House snapshots are untouched.
do $gold_admin_projection$ declare definition text;needle text;begin
 if to_regprocedure('dorra_private.profile_view(uuid,boolean)') is not null then
  definition:=pg_get_functiondef('dorra_private.profile_view(uuid,boolean)'::regprocedure);
  needle:='''userId'',profile.user_id,''username'',profile.username';
  if strpos(definition,needle)=0 then raise exception 'Admin Gold projection patch did not match';end if;
  execute replace(definition,needle,needle||',''goldBalance'',case when p_resources then coalesce((select balance from dorra_private.war_gold_accounts where user_id=p_target),0) else null end');
 end if;
 if to_regprocedure('public.dorra_admin_read(uuid,uuid,text,jsonb)') is not null then
  definition:=pg_get_functiondef('public.dorra_admin_read(uuid,uuid,text,jsonb)'::regprocedure);
  execute replace(definition,'FUNCTION public.dorra_admin_read(','FUNCTION dorra_private.war_admin_read_without_gold(');
  execute $ddl$create or replace function public.dorra_admin_read(p_actor uuid,p_session uuid,p_operation text,p_args jsonb default '{}'::jsonb) returns jsonb
  language plpgsql security invoker set search_path='' as $body$
  declare context jsonb;result jsonb;rows jsonb;
  begin
   context:=dorra_private.staff_context(p_actor,p_session);
   result:=dorra_private.war_admin_read_without_gold(p_actor,p_session,p_operation,p_args);
   if context->>'role'='admin' and p_operation in('players','staff','online') and jsonb_typeof(result->'rows')='array' then
    select coalesce(jsonb_agg(item||jsonb_build_object('goldBalance',coalesce(account.balance,0)) order by ordinal),'[]') into rows
    from jsonb_array_elements(result->'rows') with ordinality as entry(item,ordinal)
    left join dorra_private.war_gold_accounts account on account.user_id=(item->>'userId')::uuid;
    result:=jsonb_set(result,'{rows}',rows);
   end if;
   return result;
  end $body$;$ddl$;
 end if;
end $gold_admin_projection$;
do $gold_permissions$ declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='dorra_private' and p.proname in('war_gold_view','war_gold_history_view','war_complete_queue','war_gold_session','war_gold_command','war_gold_reward','war_command_without_gold','war_admin_read_without_gold')) or (n.nspname='public' and p.proname in('dorra_war_command','dorra_admin_gold_grant','dorra_admin_read')) loop
  execute 'revoke all on function '||f.signature||' from public,anon,authenticated';
  execute 'grant execute on function '||f.signature||' to service_role';
 end loop;
end $gold_permissions$;
