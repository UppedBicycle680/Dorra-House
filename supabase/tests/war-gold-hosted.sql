-- Trusted SQL runner only, after the Gold migration and full production catalogue.
-- Setup creates three isolated Auth/profile/session identities in this transaction.
-- Every financial change uses the actual service-role RPC; no wallet is seeded.
-- ALWAYS execute the entire file, including the final ROLLBACK. Nothing persists.
begin;
set local statement_timeout='20s';
set local lock_timeout='2s';
create temporary table war_gold_hosted_actors(kind text primary key,user_id uuid,session_id uuid,lease_id uuid) on commit drop;
create temporary table war_gold_hosted_checks(label text primary key,details jsonb not null default '{}') on commit drop;
create temporary table war_gold_hosted_state(key text primary key,data jsonb not null) on commit drop;
grant select,insert,update on war_gold_hosted_actors,war_gold_hosted_checks,war_gold_hosted_state to service_role;

do $setup$
declare kind text;actor uuid;sid uuid;lease uuid;tag text:=substr(replace(gen_random_uuid()::text,'-',''),1,8);username text;
begin
 if (select count(*) from dorra_private.war_catalog_platforms)<95 or (select count(*) from dorra_private.war_catalog_provinces)<4000 then raise exception 'GOLD_HOSTED_REQUIRES_PRODUCTION_CATALOGUE';end if;
 if not exists(select 1 from dorra_private.war_catalog_nations where id='NZ') or not exists(select 1 from dorra_private.war_catalog_nations where id='FJ') then raise exception 'GOLD_HOSTED_REQUIRES_NZ_FJ';end if;
 if (select count(*) from dorra_private.war_matches where status='running')>=4 then raise exception 'GOLD_HOSTED_REQUIRES_ONE_FREE_WORLD_SLOT';end if;
 insert into war_gold_hosted_state values('started',jsonb_build_object('at',clock_timestamp()));
 foreach kind in array array['admin','host','other'] loop
  actor:=gen_random_uuid();sid:=gen_random_uuid();lease:=gen_random_uuid();username:='wg_'||tag||'_'||kind;
  insert into auth.users(id,raw_user_meta_data) values(actor,jsonb_build_object('username',username,'role','admin'));
  -- Real Supabase creates profiles through its existing trigger. This fallback
  -- permits the identical fixture to run against local Supabase service stubs.
  if not exists(select 1 from dorra_private.profiles where user_id=actor) then
   insert into dorra_private.profiles(user_id,username) values(actor,username);
  end if;
  update dorra_private.profiles set role=case when kind='admin' then 'admin' else 'player' end where user_id=actor;
  insert into auth.sessions(id,user_id) values(sid,actor);
  if kind<>'admin' then
   insert into dorra_private.player_state(user_id,auth_session_id,lease_id,snapshot) values(actor,sid,lease,'{"balance":1000,"progress":{}}');
  end if;
  insert into war_gold_hosted_actors values(kind,actor,sid,lease);
  if kind='admin' then
   -- The current server code version is copied internally; no code/secret value
   -- is returned or replaced, and no existing staff grant is changed.
   insert into dorra_private.admin_grants(user_id,session_id,expires_at,code_version)
    values(actor,sid,now()+interval '10 minutes',dorra_private.code_version());
  end if;
 end loop;
end $setup$;

-- Actual service privileges are used, rather than relying on the SQL owner's
-- bypass privileges for any gameplay, staff, wallet, quote or spend operation.
set local role service_role;
do $check$
declare staff record;host record;other record;response jsonb;wallet jsonb;quote jsonb;replay jsonb;paid_resources jsonb;
 mid uuid;rid uuid;grant_id uuid:=gen_random_uuid();spend_id uuid:=gen_random_uuid();receipt uuid;queue_id bigint;
 research_id bigint;produce_id bigint;build_id bigint;capital text;platform text;balance bigint;spent bigint:=0;baseline integer;n integer;award integer;
begin
 assert current_user='service_role','hosted Gold check must exercise the real service role';
 select * into staff from war_gold_hosted_actors where kind='admin';
 select * into host from war_gold_hosted_actors where kind='host';
 select * into other from war_gold_hosted_actors where kind='other';
 assert not has_function_privilege('authenticated','public.dorra_admin_gold_grant(uuid,uuid,uuid,integer,text,uuid)','execute'),'browser role cannot grant Gold';
 assert not has_function_privilege('anon','public.dorra_war_command(uuid,uuid,uuid,text,uuid,jsonb,uuid)','execute'),'anonymous role cannot execute gameplay RPC';
 assert not has_table_privilege('authenticated','dorra_private.war_gold_accounts','select'),'browser role cannot read wallets';
 assert not has_function_privilege('authenticated','dorra_private.war_gold_history_view(uuid)','execute'),'browser role cannot read another account history';
 assert not has_table_privilege('service_role','dorra_private.war_gold_ledger','update') and not has_table_privilege('service_role','dorra_private.war_gold_intents','delete'),'financial receipts remain append-only for service role';
 insert into war_gold_hosted_checks values('service-role-and-browser-privileges','{}');

 wallet:=public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'gold-wallet',null,'{}',null)->'gold';
 assert wallet->>'balance'='0' and wallet->>'purchasesAvailable'='false' and wallet->'history'='[]','account starts with no Gold or purchases';
 assert not exists(select 1 from dorra_private.war_gold_accounts where user_id=host.user_id),'wallet reads never invent an account credit';
 response:=public.dorra_admin_gold_grant(staff.user_id,staff.session_id,host.user_id,500,'Rollback hosted tournament award',grant_id);
 receipt:=(response->>'recordId')::uuid;
 replay:=public.dorra_admin_gold_grant(staff.user_id,staff.session_id,host.user_id,500,'Rollback hosted tournament award',grant_id);
 assert replay->>'replayed'='true' and (replay->>'recordId')::uuid=receipt and replay->>'goldBalance'='500','admin receipt is permanent and exactly idempotent';
 assert (select count(*) from dorra_private.admin_audit where actor=staff.user_id and request_id=grant_id)=1,'one immutable staff audit';
 assert not exists(select 1 from dorra_private.player_state where user_id=staff.user_id),'staff awards work without a House save';
 begin
  perform public.dorra_admin_gold_grant(staff.user_id,staff.session_id,other.user_id,500,'Rollback hosted tournament award',grant_id);
  raise exception 'TEST_EXPECTED_REQUEST_REUSED';
 exception when others then if sqlerrm<>'REQUEST_REUSED' then raise;end if;end;
 begin
  perform public.dorra_admin_gold_grant(other.user_id,other.session_id,host.user_id,1,'Forged user metadata',gen_random_uuid());
  raise exception 'TEST_EXPECTED_STAFF_REQUIRED';
 exception when others then if sqlerrm<>'STAFF_REQUIRED' then raise;end if;end;
 perform public.dorra_admin_gold_grant(staff.user_id,staff.session_id,other.user_id,77,'Other private fixture award',gen_random_uuid());
 insert into war_gold_hosted_checks values('admin-award-auth-audit-replay',jsonb_build_object('goldAwarded',500,'auditRows',1));

 response:=public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'create',null,
  '{"nationId":"NZ","opponentNationId":"FJ","template":"duel","opponent":"human","pace":"persistent","visibility":"invite","name":"Rollback Gold authority"}',gen_random_uuid());
 mid:=(response#>>'{view,match,id}')::uuid;
 perform public.dorra_war_command(other.user_id,other.session_id,other.lease_id,'join',mid,jsonb_build_object('nationId','FJ','inviteCode',response#>>'{view,match,inviteCode}'),gen_random_uuid());
 perform public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'start',mid,'{}',gen_random_uuid());
 -- Freeze only this disposable scenario's game clock. Completion and pricing
 -- still use the ordinary authoritative scheduler and paid queue commands.
 update dorra_private.war_matches set real_anchor=clock_timestamp()+interval '1 hour',last_dispatch=clock_timestamp(),next_due=clock_timestamp()+interval '1 hour' where id=mid;
 select data->>'capitalProvinceId' into capital from dorra_private.war_catalog_nations where id='NZ';
 select p.id into platform from dorra_private.war_catalog_platforms p join dorra_private.war_sides s on s.match_id=mid and s.nation_id='NZ'
  where s.research ? p.id and p.data->>'domain'='land' order by (p.data#>>'{cost,cash}')::numeric,p.id limit 1;
 assert platform is not null,'NZ has a real legal starter production programme';
 perform public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'research',mid,'{"platformId":"combined-arms-doctrine"}',gen_random_uuid());
 select id into research_id from dorra_private.war_events where match_id=mid and kind='research' and payload->>'nationId'='NZ';
 quote:=public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'boost-quote',mid,jsonb_build_object('queueId',research_id::text),gen_random_uuid())->'quote';
 assert quote->>'kind'='research' and jsonb_typeof(quote->'queueId')='string','quote binds the exact lossless event identifier';
 begin
  perform public.dorra_war_command(other.user_id,other.session_id,other.lease_id,'boost',mid,jsonb_build_object('quoteId',quote->>'quoteId','confirmed',true),gen_random_uuid());
  raise exception 'TEST_EXPECTED_FOREIGN_QUOTE_DENIED';
 exception when others then if sqlerrm<>'BOOST_QUOTE_UNAVAILABLE' then raise;end if;end;
 select s.resources into paid_resources from dorra_private.war_sides s where match_id=mid and nation_id='NZ';
 response:=public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'boost',mid,jsonb_build_object('quoteId',quote->>'quoteId','confirmed',true),spend_id);
 spent:=(response#>>'{result,goldSpent}')::bigint;
 assert not(response->'gold' ? 'history') and octet_length((response->'gold')::text)<200,'mutation returns the compact Gold summary';
 assert not exists(select 1 from dorra_private.war_events where id=research_id),'research completion consumes exactly its own event';
 assert (select research ? 'combined-arms-doctrine' from dorra_private.war_sides where match_id=mid and nation_id='NZ'),'research completes through the shared handler';
 assert (select s.resources=paid_resources from dorra_private.war_sides s where match_id=mid and nation_id='NZ'),'Gold cannot refund the normal research cost';
 replay:=public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'boost',mid,jsonb_build_object('quoteId',quote->>'quoteId','confirmed',true),spend_id);
 assert replay->>'replayed'='true' and replay#>>'{result,receiptId}'=response#>>'{result,receiptId}','spend replay returns the original receipt';

 perform public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'produce',mid,jsonb_build_object('platformId',platform,'provinceId',capital),gen_random_uuid());
 select id into produce_id from dorra_private.war_events where match_id=mid and kind='produce' and payload->>'nationId'='NZ';
 select count(*) into baseline from dorra_private.war_units where match_id=mid and nation_id='NZ';
 quote:=public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'boost-quote',mid,jsonb_build_object('queueId',produce_id::text),gen_random_uuid())->'quote';
 response:=public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'boost',mid,jsonb_build_object('quoteId',quote->>'quoteId','confirmed',true),gen_random_uuid());
 spent:=spent+(response#>>'{result,goldSpent}')::bigint;
 assert (select count(*) from dorra_private.war_units where match_id=mid and nation_id='NZ')=baseline+1,'production creates one paid formation';
 perform public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'build',mid,jsonb_build_object('provinceId',capital,'facility','fortification'),gen_random_uuid());
 select id into build_id from dorra_private.war_events where match_id=mid and kind='build' and payload->>'nationId'='NZ';
 quote:=public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'boost-quote',mid,jsonb_build_object('queueId',build_id::text),gen_random_uuid())->'quote';
 response:=public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'boost',mid,jsonb_build_object('quoteId',quote->>'quoteId','confirmed',true),gen_random_uuid());
 spent:=spent+(response#>>'{result,goldSpent}')::bigint;
 assert (select facilities->>'fortification' from dorra_private.war_provinces where match_id=mid and province_id=capital)='1','construction upgrades exactly once';
 assert not dorra_private.war_complete_queue(mid,research_id,0) and not dorra_private.war_complete_queue(mid,produce_id,0) and not dorra_private.war_complete_queue(mid,build_id,0),'normal completion cannot repeat boosted events';
 insert into war_gold_hosted_checks values('three-owned-queue-kinds-exactly-once',jsonb_build_object('goldSpent',spent,'productionPlatform',platform));

 -- Leave one paid queue unaccelerated and let the ordinary engine finish it.
 perform public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'produce',mid,jsonb_build_object('platformId',platform,'provinceId',capital),gen_random_uuid());
 select id into queue_id from dorra_private.war_events where match_id=mid and kind='produce' and payload->>'nationId'='NZ';
 select count(*) into baseline from dorra_private.war_units where match_id=mid and nation_id='NZ';
 update dorra_private.war_matches set game_anchor=(select due+1 from dorra_private.war_events where id=queue_id),real_anchor=clock_timestamp()+interval '1 hour' where id=mid;
 perform dorra_private.war_advance(mid,160);
 assert not exists(select 1 from dorra_private.war_events where id=queue_id),'ordinary scheduled queue completes';
 assert (select count(*) from dorra_private.war_units where match_id=mid and nation_id='NZ')=baseline+1,'ordinary scheduler creates exactly one formation';
 assert (select count(*) from dorra_private.war_reports where match_id=mid and nation_id='NZ' and body->>'type'='research-complete')=1,'cron never duplicates accelerated research';
 insert into war_gold_hosted_checks values('ordinary-scheduler-after-boost','{}');

 wallet:=public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'gold-wallet',null,'{}',null)->'gold';
 assert (wallet->>'balance')::bigint=500-spent and jsonb_array_length(wallet->'history')=4,'owner history includes only actual award/spend receipts';
 assert position('Other private fixture award' in wallet::text)=0 and position(other.user_id::text in wallet::text)=0,'history excludes another account';
 response:=public.dorra_war_command(other.user_id,other.session_id,other.lease_id,'gold-wallet',null,'{}',null);
 assert response#>>'{gold,balance}'='77' and jsonb_array_length(response#>'{gold,history}')=1,'foreign account sees only its own wallet';
 response:=public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'view',mid,'{}',null);
 assert not(response->'gold' ? 'history') and octet_length((response->'gold')::text)<200,'ordinary view keeps the small summary';
 insert into war_gold_hosted_checks values('owner-only-wallet-and-compact-polling','{}');

 -- Eligible result setup is isolated to these fixture worlds. Claims themselves
 -- use the unmodified House+Gold settlement transaction and independent caps.
 for n in 1..3 loop
  if n=1 then rid:=mid;else
   response:=public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'create',null,
    '{"nationId":"NZ","opponentNationId":"FJ","template":"duel","opponent":"ai","pace":"persistent","visibility":"invite","name":"Rollback Gold victory"}',gen_random_uuid());
   rid:=(response#>>'{view,match,id}')::uuid;
  end if;
  update dorra_private.war_matches set status='finished',winner='NZ',game_anchor=86400,real_anchor=null,next_due=null,finished_at=clock_timestamp() where id=rid;
  grant_id:=gen_random_uuid();
  response:=public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'reward',rid,'{}',grant_id);
  award:=(response#>>'{result,goldAward}')::integer;
  assert award=case when n<3 then 5 else 0 end,'five Gold per victory, ten per Brisbane day';
  assert (response#>>'{result,amount}')::integer=case when n=1 then 1000 else 0 end,'House cap is independent of the Gold cap';
  delete from dorra_private.war_requests where user_id=host.user_id and request_id=grant_id;
  replay:=public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'reward',rid,'{}',grant_id);
  assert replay->>'replayed'='true' and replay->'result'=response->'result','reward survives request-cache pruning';
 end loop;
 response:=public.dorra_war_command(other.user_id,other.session_id,other.lease_id,'reward',mid,'{}',gen_random_uuid());
 assert response#>>'{result,goldAward}'='0','loss never gives victory Gold';
 wallet:=public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'gold-wallet',null,'{}',null)->'gold';
 assert (wallet->>'balance')::bigint=510-spent and (wallet->>'version')::integer=7,'all new receipts, including the capped zero award, advance wallet version';
 assert (select sum(delta) from dorra_private.war_gold_ledger where user_id=host.user_id and kind='victory-reward')=10,'daily Gold cap cannot over-credit';
 insert into war_gold_hosted_checks values('victory-cap-independent-cash-cap-permanent-replay',jsonb_build_object('victoryGold',10,'houseCash',1000,'walletVersion',7));

 -- The existing global retention function runs in a nested rollback so neither
 -- unrelated expired-cache rows nor archived worlds can retain any test change.
 begin
  -- These disposable cache rows are oldest so a pre-existing backlog cannot
  -- push them outside the maintenance function's one-thousand-row batch.
  update dorra_private.war_gold_quotes set expires_at='-infinity'::timestamptz where user_id=host.user_id;
  select count(*) into baseline from dorra_private.war_gold_intents where actor_id in(host.user_id,staff.user_id,other.user_id);
  perform dorra_private.war_maintenance();
  assert not exists(select 1 from dorra_private.war_gold_quotes where user_id=host.user_id),'expired quote cache is pruned';
  assert (select count(*) from dorra_private.war_gold_intents where actor_id in(host.user_id,staff.user_id,other.user_id))=baseline,'permanent financial replay receipts survive retention';
  replay:=public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'boost',mid,
   jsonb_build_object('quoteId',(select quote_id from dorra_private.war_gold_ledger where user_id=host.user_id and request_id=spend_id),'confirmed',true),spend_id);
  assert replay->>'replayed'='true','spend replay survives quote retention and a finished match';
  raise sqlstate 'ZGL01' using message='rollback retention probe';
 exception when sqlstate 'ZGL01' then null;end;
 insert into war_gold_hosted_checks values('retention-keeps-permanent-financial-receipts','{}');
 insert into war_gold_hosted_state values('result',jsonb_build_object('balance',510-spent,'spent',spent,'fixtureOnly',true));
end $check$;
reset role;

select jsonb_build_object('passed',true,'environment','hosted PostgreSQL; actual service-role RPC; entire fixture rolls back',
 'durationMs',round(extract(epoch from clock_timestamp()-(select (data->>'at')::timestamptz from war_gold_hosted_state where key='started'))*1000,2),
 'checks',(select jsonb_agg(jsonb_build_object('label',label,'details',details) order by label) from war_gold_hosted_checks),
 'catalogue',jsonb_build_object('platforms',(select count(*) from dorra_private.war_catalog_platforms),'provinces',(select count(*) from dorra_private.war_catalog_provinces)),
 'fixtureAccounts',(select count(*) from war_gold_hosted_actors),'result',(select data from war_gold_hosted_state where key='result')) as war_gold_hosted_report;
rollback;
