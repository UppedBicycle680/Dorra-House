-- Closed-schema staff administration. There are deliberately no browser grants
-- or permissive RLS policies. Every RPC below is service-role-only and repeats
-- current account/session/role/grant authorization in the transaction.
alter table dorra_private.profiles drop constraint profiles_role_check;
alter table dorra_private.profiles add constraint profiles_role_check check(role in ('player','moderator','admin'));
alter table dorra_private.profiles add column owner boolean not null default false,
  add column banned boolean not null default false,
  add column suspended_until timestamptz,
  add column admin_version bigint not null default 1;
alter table dorra_private.profiles add constraint owner_is_admin check(not owner or role='admin');
create unique index one_house_owner on dorra_private.profiles(owner) where owner;

create table dorra_private.admin_grants(user_id uuid not null references dorra_private.profiles(user_id) on delete cascade,
  session_id uuid not null, expires_at timestamptz not null, code_version text not null,
  primary key(user_id,session_id));
create table dorra_private.admin_attempts(bucket text primary key, started_at timestamptz not null default now(), attempts int not null default 1);
create table dorra_private.admin_previews(id uuid primary key default gen_random_uuid(), actor uuid not null references dorra_private.profiles(user_id) on delete cascade,
  session_id uuid not null,target uuid not null references dorra_private.profiles(user_id) on delete cascade,
  revision bigint,profile_version bigint not null,args jsonb not null,changes jsonb not null,digest text not null,
  snapshot jsonb,private_state jsonb,expires_at timestamptz not null default now()+interval '5 minutes',
  check(octet_length(coalesce(snapshot::text,''))+octet_length(coalesce(private_state::text,''))<10000000));
create table dorra_private.reports(id uuid primary key default gen_random_uuid(),target uuid not null references dorra_private.profiles(user_id) on delete cascade,
  actor uuid not null references dorra_private.profiles(user_id),title text not null check(length(title) between 1 and 120),
  evidence text not null check(length(evidence) between 1 and 4000),reason text not null,
  status text not null default 'open' check(status in ('open','resolved','dismissed')),resolution_reason text,
  resolved_by uuid references dorra_private.profiles(user_id),created_at timestamptz not null default now(),resolved_at timestamptz);
create index reports_created on dorra_private.reports(created_at desc);
create table dorra_private.activity_flags(id uuid primary key default gen_random_uuid(),target uuid not null references dorra_private.profiles(user_id) on delete cascade,
  actor uuid not null references dorra_private.profiles(user_id),reason text not null,created_at timestamptz not null default now(),
  resolved_at timestamptz,resolved_by uuid references dorra_private.profiles(user_id),resolution_reason text);
create table dorra_private.admin_audit(id uuid primary key default gen_random_uuid(),actor uuid not null references dorra_private.profiles(user_id),
  target uuid not null references dorra_private.profiles(user_id),session_id uuid not null,action text not null,reason text not null,
  changes jsonb not null,request_id uuid not null,preview_digest text not null,result jsonb not null,
  outcome text not null default 'success',created_at timestamptz not null default now(),unique(actor,request_id));
create index admin_audit_created on dorra_private.admin_audit(created_at desc);
create index admin_audit_target on dorra_private.admin_audit(target,created_at desc);
-- Daily distinct accepted-command membership, avoiding a record for every click.
create table dorra_private.gameplay_days(user_id uuid not null references dorra_private.profiles(user_id) on delete cascade,
  day date not null,last_action_at timestamptz not null,primary key(user_id,day));
create index gameplay_days_time on dorra_private.gameplay_days(last_action_at);

do $$ declare t text; begin
  foreach t in array array['admin_grants','admin_attempts','admin_previews','reports','activity_flags','admin_audit','gameplay_days'] loop
    execute format('alter table dorra_private.%I enable row level security',t);
    execute format('revoke all on dorra_private.%I from public,anon,authenticated',t);
    execute format('grant select,insert,update,delete on dorra_private.%I to service_role',t);
  end loop;
end $$;
revoke update,delete on dorra_private.admin_audit from service_role;

create function dorra_private.player_allowed(p_user uuid,p_session uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare profile dorra_private.profiles;
begin
  if not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>now())) then raise exception 'AUTH_SESSION_ENDED'; end if;
  select * into profile from dorra_private.profiles where user_id=p_user for share;
  if profile.user_id is null or profile.disabled or profile.banned or profile.suspended_until>now() then raise exception 'ACCOUNT_DISABLED'; end if;
end $$;

-- No code or digest is accepted from a browser as authority. This function is
-- available only to server operations, and Vault itself stays unexposed.
create function dorra_private.code_version() returns text language sql security invoker set search_path='' as $$
  select updated_at::text from vault.decrypted_secrets where name='dorra_admin_code_sha256'
$$;
create function dorra_private.staff_context(p_actor uuid,p_session uuid,p_grant boolean default true) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare profile dorra_private.profiles; expiry timestamptz;
begin
  perform dorra_private.player_allowed(p_actor,p_session);
  select * into profile from dorra_private.profiles where user_id=p_actor for share;
  if profile.role not in ('admin','moderator') then raise exception 'STAFF_REQUIRED'; end if;
  select expires_at into expiry from dorra_private.admin_grants where user_id=p_actor and session_id=p_session
    and expires_at>now() and code_version=dorra_private.code_version();
  if p_grant and expiry is null then raise exception 'ACCESS_EXPIRED'; end if;
  return jsonb_build_object('userId',p_actor,'username',profile.username,'role',profile.role,'owner',profile.owner,'expiresAt',expiry,'unlocked',expiry is not null);
end $$;
create function public.dorra_admin_status(p_actor uuid,p_session uuid) returns jsonb
language sql security invoker set search_path='' as $$ select dorra_private.staff_context(p_actor,p_session,false) $$;
create function public.dorra_admin_lock(p_actor uuid,p_session uuid) returns void
language plpgsql security invoker set search_path='' as $$ begin
  delete from dorra_private.admin_grants where user_id=p_actor and session_id=p_session;
  delete from dorra_private.admin_previews where actor=p_actor and session_id=p_session;
end $$;
create function public.dorra_admin_attempt(p_actor uuid,p_session uuid,p_ip text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare bucket_name text; amount int; limited boolean:=false; digest text; version text;
begin
  perform dorra_private.staff_context(p_actor,p_session,false);
  if p_ip !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_INPUT'; end if;
  foreach bucket_name in array array['user:'||p_actor::text,'ip:'||p_ip,'global'] loop
    insert into dorra_private.admin_attempts(bucket) values(bucket_name) on conflict(bucket) do update set
      attempts=case when admin_attempts.started_at>now()-interval '15 minutes' then admin_attempts.attempts+1 else 1 end,
      started_at=case when admin_attempts.started_at>now()-interval '15 minutes' then admin_attempts.started_at else now() end returning attempts into amount;
    if amount>(case when bucket_name='global' then 100 else 5 end) then limited:=true; end if;
  end loop;
  if limited then return jsonb_build_object('limited',true); end if;
  select decrypted_secret,updated_at::text into digest,version from vault.decrypted_secrets where name='dorra_admin_code_sha256';
  if digest is null or digest !~ '^[0-9a-f]{64}$' then raise exception 'ACCESS_EXPIRED'; end if;
  return jsonb_build_object('digest',digest,'version',version,'limited',false);
end $$;
create function public.dorra_admin_grant(p_actor uuid,p_session uuid,p_version text) returns jsonb
language plpgsql security invoker set search_path='' as $$ begin
  perform dorra_private.staff_context(p_actor,p_session,false);
  if p_version is distinct from dorra_private.code_version() or p_version is null then raise exception 'ACCESS_EXPIRED'; end if;
  insert into dorra_private.admin_grants values(p_actor,p_session,now()+interval '30 minutes',p_version)
    on conflict(user_id,session_id) do update set expires_at=excluded.expires_at,code_version=excluded.code_version;
  delete from dorra_private.admin_previews where expires_at<now();
  delete from dorra_private.admin_attempts where started_at<now()-interval '1 day';
  return dorra_private.staff_context(p_actor,p_session);
end $$;

create function dorra_private.profile_view(p_target uuid,p_resources boolean default false) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare profile dorra_private.profiles; state dorra_private.player_state; airports jsonb;
begin
  select * into profile from dorra_private.profiles where user_id=p_target;
  if profile.user_id is null then raise exception 'NOT_FOUND'; end if;
  select * into state from dorra_private.player_state where user_id=p_target;
  if p_resources then select coalesce(jsonb_agg(jsonb_build_object('id',key,'cash',value->'cash','research',value->'research')),'[]'::jsonb)
    into airports from jsonb_each(coalesce(state.private_state->'airport'->'airports','{}'::jsonb)); end if;
  return jsonb_build_object('userId',profile.user_id,'username',profile.username,'role',profile.role,'owner',profile.owner,
    'disabled',profile.disabled,'banned',profile.banned,'suspendedUntil',profile.suspended_until,'version',profile.admin_version,
    'status',case when profile.banned then 'banned' when profile.disabled then 'disabled' when profile.suspended_until>now() then 'suspended' else 'active' end,
    'createdAt',profile.created_at,'lastPlayedAt',(select max(last_action_at) from dorra_private.gameplay_days where user_id=p_target),
    'displayName',state.snapshot->'progress'->'profile'->>'name','level',state.snapshot->'progress'->'level','xp',state.snapshot->'progress'->'xp',
    'rounds',state.snapshot->'stats'->'sessions','wins',state.snapshot->'stats'->'wins','hasSave',state.user_id is not null,'revision',state.revision,
    'resources',case when p_resources then jsonb_build_object('money',state.snapshot->'balance','footballClub',state.snapshot->'progress'->'footballManager'->'club' is not null,
      'footballTokens',state.snapshot->'progress'->'footballManager'->'footballTokens','airportCareer',state.private_state->'airport' is not null,
      'diamonds',state.private_state->'airport'->'diamonds','airports',airports,'owned',state.snapshot->'progress'->'owned') else null end);
end $$;
create function public.dorra_admin_target(p_actor uuid,p_session uuid,p_target uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare context jsonb; state dorra_private.player_state;
begin
  context:=dorra_private.staff_context(p_actor,p_session);
  select * into state from dorra_private.player_state where user_id=p_target;
  return jsonb_build_object('profile',dorra_private.profile_view(p_target),'revision',state.revision,'snapshot',state.snapshot,'privateState',coalesce(state.private_state,'{}'::jsonb));
end $$;

create function public.dorra_admin_read(p_actor uuid,p_session uuid,p_operation text,p_args jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare context jsonb; rows jsonb; total bigint; cutoff timestamptz; search text:=coalesce(p_args->>'search',''); filter text:=coalesce(p_args->>'status','all');
  skip int:=coalesce((p_args->>'offset')::int,0); target uuid; record jsonb;
begin
  context:=dorra_private.staff_context(p_actor,p_session);
  if length(search)>80 or skip<0 or skip>10000 then raise exception 'INVALID_INPUT'; end if;
  cutoff:=now()-case coalesce(p_args->>'period','24h') when '7d' then interval '7 days' when '30d' then interval '30 days' else interval '24 hours' end;
  if p_operation='dashboard' then
    return jsonb_build_object('activePlayers',(select count(distinct user_id) from dorra_private.gameplay_days where last_action_at>=cutoff),
      'openReports',(select count(*) from dorra_private.reports where status='open'),
      'flaggedActivity',(select count(*) from dorra_private.activity_flags where resolved_at is null),
      'gameChanges',(select count(*) from dorra_private.admin_audit where created_at>=cutoff and action in ('money','xp','stats','football-tokens','airport-cash','airport-research','airport-diamonds','level','unlock')),
      'activity',public.dorra_admin_read(p_actor,p_session,'activity',jsonb_build_object('period',coalesce(p_args->>'period','24h')))->'rows','serverNow',now());
  elsif p_operation in ('players','staff') then
    if p_operation='staff' and not (context->>'owner')::boolean then raise exception 'PERMISSION_DENIED'; end if;
    select count(*) into total from dorra_private.profiles p where strpos(lower(p.username),lower(search))>0
      and (p_operation<>'staff' or p.role in ('moderator','admin')) and (filter='all' or
        case when p.banned then 'banned' when p.disabled then 'disabled' when p.suspended_until>now() then 'suspended' else 'active' end=filter);
    select coalesce(jsonb_agg(item),'[]'::jsonb) into rows from (select dorra_private.profile_view(p.user_id) item from dorra_private.profiles p
      where strpos(lower(p.username),lower(search))>0 and (p_operation<>'staff' or p.role in ('moderator','admin')) and (filter='all' or
        case when p.banned then 'banned' when p.disabled then 'disabled' when p.suspended_until>now() then 'suspended' else 'active' end=filter)
      order by p.created_at desc,p.user_id limit 40 offset skip) page;
  elsif p_operation='player' then
    target:=(p_args->>'targetId')::uuid;
    return jsonb_build_object('player',dorra_private.profile_view(target,context->>'role'='admin'),
      'history',public.dorra_admin_read(p_actor,p_session,'activity',jsonb_build_object('targetId',target,'period','30d'))->'rows',
      'flags',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'reason',reason,'createdAt',created_at)),'[]'::jsonb) from dorra_private.activity_flags where activity_flags.target=target and resolved_at is null));
  elsif p_operation in ('reports','report') then
    if p_operation='report' then
      select to_jsonb(r)||jsonb_build_object('username',p.username,'actorName',a.username) into record from dorra_private.reports r
        join dorra_private.profiles p on p.user_id=r.target join dorra_private.profiles a on a.user_id=r.actor where r.id=(p_args->>'reportId')::uuid;
      if record is null then raise exception 'NOT_FOUND'; end if;
      return jsonb_build_object('report',record,'player',dorra_private.profile_view((record->>'target')::uuid),'history',
        public.dorra_admin_read(p_actor,p_session,'activity',jsonb_build_object('targetId',record->>'target','period','30d'))->'rows');
    end if;
    select count(*) into total from dorra_private.reports r join dorra_private.profiles p on p.user_id=r.target
      where (filter='all' or r.status=filter) and strpos(lower(r.title||' '||p.username),lower(search))>0;
    select coalesce(jsonb_agg(item),'[]'::jsonb) into rows from (select to_jsonb(r)||jsonb_build_object('username',p.username) item from dorra_private.reports r
      join dorra_private.profiles p on p.user_id=r.target where (filter='all' or r.status=filter) and strpos(lower(r.title||' '||p.username),lower(search))>0
      order by r.created_at desc,r.id limit 40 offset skip) page;
  elsif p_operation='activity' then
    select count(*) into total from dorra_private.admin_audit a join dorra_private.profiles p on p.user_id=a.target
      where a.created_at>=cutoff and (not(p_args ? 'targetId') or a.target=(p_args->>'targetId')::uuid)
      and (coalesce(p_args->>'kind','all')='all' or a.action=p_args->>'kind')
      and strpos(lower(a.action||' '||a.reason||' '||p.username),lower(search))>0;
    select coalesce(jsonb_agg(item),'[]'::jsonb) into rows from (select jsonb_build_object('id',a.id,'actor',u.username,'targetId',p.user_id,'target',p.username,
      'action',a.action,'reason',a.reason,'changes',a.changes,'outcome',a.outcome,'createdAt',a.created_at) item
      from dorra_private.admin_audit a join dorra_private.profiles p on p.user_id=a.target join dorra_private.profiles u on u.user_id=a.actor
      where a.created_at>=cutoff and (not(p_args ? 'targetId') or a.target=(p_args->>'targetId')::uuid)
      and (coalesce(p_args->>'kind','all')='all' or a.action=p_args->>'kind') and strpos(lower(a.action||' '||a.reason||' '||p.username),lower(search))>0
      order by a.created_at desc,a.id limit 40 offset skip) page;
  else raise exception 'INVALID_INPUT'; end if;
  return jsonb_build_object('rows',rows,'total',total,'offset',skip);
end $$;

create function public.dorra_admin_preview(p_actor uuid,p_session uuid,p_target uuid,p_revision bigint,p_profile_version bigint,p_args jsonb,p_changes jsonb,p_digest text,p_snapshot jsonb,p_private jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare context jsonb; profile dorra_private.profiles; state dorra_private.player_state; preview dorra_private.admin_previews;
begin
  context:=dorra_private.staff_context(p_actor,p_session);
  select * into profile from dorra_private.profiles where user_id=p_target for share;
  select * into state from dorra_private.player_state where user_id=p_target for share;
  if profile.user_id is null then raise exception 'NOT_FOUND'; end if;
  if profile.admin_version<>p_profile_version or state.revision is distinct from p_revision then raise exception 'STALE_REVISION'; end if;
  if coalesce(length(trim(p_args->>'reason')),0) not between 1 and 1000 then raise exception 'INVALID_INPUT'; end if;
  insert into dorra_private.admin_previews(actor,session_id,target,revision,profile_version,args,changes,digest,snapshot,private_state)
    values(p_actor,p_session,p_target,p_revision,p_profile_version,p_args,p_changes,p_digest,p_snapshot,p_private) returning * into preview;
  return jsonb_build_object('id',preview.id,'target',profile.username,'changes',p_changes,'reason',p_args->>'reason','expiresAt',preview.expires_at);
end $$;

create function public.dorra_admin_commit(p_actor uuid,p_session uuid,p_preview uuid,p_request uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare context jsonb; preview dorra_private.admin_previews; profile dorra_private.profiles; state dorra_private.player_state;
  action text; result jsonb; cached dorra_private.admin_audit; resource boolean; created uuid;
begin
  context:=dorra_private.staff_context(p_actor,p_session);
  -- Actor-wide serialization prevents two different previews reusing one ID.
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text,0));
  select * into preview from dorra_private.admin_previews where id=p_preview and actor=p_actor and session_id=p_session;
  if preview.id is null then raise exception 'PREVIEW_EXPIRED'; end if;
  select * into cached from dorra_private.admin_audit where actor=p_actor and request_id=p_request;
  if cached.id is not null then
    if cached.preview_digest<>preview.digest then raise exception 'REQUEST_REUSED'; end if;
    return cached.result||jsonb_build_object('replayed',true);
  end if;
  if preview.expires_at<=now() then raise exception 'PREVIEW_EXPIRED'; end if;
  action:=preview.args->>'action';
  resource:=action in ('money','xp','stats','football-tokens','airport-cash','airport-research','airport-diamonds','level','unlock');
  if (resource or action in ('ban','lift')) and context->>'role'<>'admin' then raise exception 'PERMISSION_DENIED'; end if;
  if action in ('staff-role','revoke-access') and not(context->>'owner')::boolean then raise exception 'PERMISSION_DENIED'; end if;
  select * into profile from dorra_private.profiles where user_id=preview.target for update;
  select * into state from dorra_private.player_state where user_id=preview.target for update;
  if profile.admin_version<>preview.profile_version or state.revision is distinct from preview.revision then raise exception 'STALE_REVISION'; end if;
  if profile.owner and action in ('ban','suspend','staff-role') then raise exception 'OWNER_PROTECTED'; end if;
  if resource then
    if state.user_id is null or preview.snapshot is null or preview.private_state is null then raise exception 'SAVE_REQUIRED'; end if;
    perform set_config('dorra.admin_change','true',true);
    update dorra_private.player_state set snapshot=preview.snapshot,private_state=preview.private_state,revision=revision+1,updated_at=now(),recent_requests='[]'::jsonb where user_id=preview.target;
  elsif action='warn' then null;
  elsif action='suspend' then
    if (preview.args->>'duration')::int not in (24,168,720) then raise exception 'INVALID_INPUT'; end if;
    update dorra_private.profiles set suspended_until=now()+make_interval(hours=>(preview.args->>'duration')::int) where user_id=preview.target;
  elsif action='lift' then update dorra_private.profiles set suspended_until=null where user_id=preview.target;
  elsif action='ban' then
    if preview.args->>'confirmation'<>profile.username then raise exception 'INVALID_INPUT'; end if;
    update dorra_private.profiles set banned=true where user_id=preview.target;
  elsif action='staff-role' then
    if preview.args->>'role' not in ('player','moderator','admin') then raise exception 'INVALID_INPUT'; end if;
    update dorra_private.profiles set role=preview.args->>'role' where user_id=preview.target;
  elsif action='revoke-access' then null;
  elsif action='report-create' then
    insert into dorra_private.reports(target,actor,title,evidence,reason) values(preview.target,p_actor,preview.args->>'title',preview.args->>'evidence',preview.args->>'reason') returning id into created;
  elsif action='report-resolve' then
    update dorra_private.reports set status=preview.args->>'resolution',resolution_reason=preview.args->>'reason',resolved_at=now(),resolved_by=p_actor
      where id=(preview.args->>'reportId')::uuid and target=preview.target and status='open' returning id into created;
    if created is null then raise exception 'STALE_REVISION'; end if;
  elsif action='flag' then
    insert into dorra_private.activity_flags(target,actor,reason) values(preview.target,p_actor,preview.args->>'reason') returning id into created;
  elsif action='flag-resolve' then
    update dorra_private.activity_flags set resolved_at=now(),resolved_by=p_actor,resolution_reason=preview.args->>'reason'
      where id=(preview.args->>'flagId')::uuid and target=preview.target and resolved_at is null returning id into created;
    if created is null then raise exception 'STALE_REVISION'; end if;
  else raise exception 'INVALID_INPUT'; end if;
  update dorra_private.profiles set admin_version=admin_version+1 where user_id=preview.target;
  if action in ('staff-role','revoke-access','ban','suspend') then
    delete from dorra_private.admin_grants where user_id=preview.target;
    -- Invalidate queued preview grants, while retaining the current preview for replay.
    update dorra_private.admin_previews set expires_at=now() where actor=preview.target and id<>preview.id;
  end if;
  result:=jsonb_build_object('ok',true,'action',action,'targetId',preview.target,'recordId',created,'changes',preview.changes,'serverNow',now());
  insert into dorra_private.admin_audit(actor,target,session_id,action,reason,changes,request_id,preview_digest,result)
    values(p_actor,preview.target,p_session,action,preview.args->>'reason',preview.changes,p_request,preview.digest,result);
  return result;
end $$;

-- The same account gate protects every existing gameplay transaction. Profiles
-- are share-locked before state, so suspension/ban cannot race a game commit.
do $$ declare item record; definition text; begin
  for item in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('dorra_acquire_session','dorra_read_state','dorra_commit_action') loop
    definition:=pg_get_functiondef(item.oid);
    definition:=regexp_replace(definition,'begin','begin'||E'\n  perform dorra_private.player_allowed(p_user_id,p_auth_session_id);','i');
    execute definition;
  end loop;
end $$;
create function dorra_private.record_gameplay_day() returns trigger language plpgsql security invoker set search_path='' as $$ begin
  if new.snapshot is distinct from old.snapshot or new.private_state is distinct from old.private_state then
    insert into dorra_private.gameplay_days values(new.user_id,(now() at time zone 'UTC')::date,now())
      on conflict(user_id,day) do update set last_action_at=excluded.last_action_at;
  end if;
  return new;
end $$;
-- Admin changes must not count as gameplay. RPC sets a local transaction flag.
create trigger dorra_gameplay_day after update on dorra_private.player_state for each row
when (current_setting('dorra.admin_change',true) is distinct from 'true') execute function dorra_private.record_gameplay_day();

-- Explicit allowlist, never default PUBLIC EXECUTE.
do $$ declare item record; begin
  for item in select p.oid,n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='public' and p.proname like 'dorra_admin_%') or (n.nspname='dorra_private' and p.proname in ('player_allowed','code_version','staff_context','profile_view','record_gameplay_day')) loop
    execute format('revoke all on function %I.%I(%s) from public,anon,authenticated',item.nspname,item.proname,item.args);
    execute format('grant execute on function %I.%I(%s) to service_role',item.nspname,item.proname,item.args);
  end loop;
end $$;
