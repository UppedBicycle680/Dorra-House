-- Owner access remains account/session/code-bound, without a panel countdown.
alter table dorra_private.admin_grants alter column expires_at drop not null;
create or replace function dorra_private.staff_context(p_actor uuid,p_session uuid,p_grant boolean default true) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare profile dorra_private.profiles; expiry timestamptz; unlocked boolean;
begin
 perform dorra_private.player_allowed(p_actor,p_session);
 select * into profile from dorra_private.profiles where user_id=p_actor for share;
 if profile.role not in ('admin','moderator') then raise exception 'STAFF_REQUIRED'; end if;
 select expires_at into expiry from dorra_private.admin_grants where user_id=p_actor and session_id=p_session
  and (expires_at>now() or (expires_at is null and profile.owner)) and code_version=dorra_private.code_version();
 unlocked:=found;
 if p_grant and not unlocked then raise exception 'ACCESS_EXPIRED'; end if;
 return jsonb_build_object('userId',p_actor,'username',profile.username,'role',profile.role,'owner',profile.owner,
  'expiresAt',expiry,'unlimited',unlocked and expiry is null and profile.owner,'unlocked',unlocked);
end $$;
create or replace function public.dorra_admin_grant(p_actor uuid,p_session uuid,p_version text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare context jsonb;
begin
 context:=dorra_private.staff_context(p_actor,p_session,false);
 if p_version is distinct from dorra_private.code_version() or p_version is null then raise exception 'ACCESS_EXPIRED'; end if;
 insert into dorra_private.admin_grants(user_id,session_id,expires_at,code_version)
 values(p_actor,p_session,case when (context->>'owner')::boolean then null else now()+interval '30 minutes' end,p_version)
 on conflict(user_id,session_id) do update set expires_at=excluded.expires_at,code_version=excluded.code_version;
 delete from dorra_private.admin_previews where expires_at<now();
 delete from dorra_private.admin_attempts where started_at<now()-interval '1 day';
 return dorra_private.staff_context(p_actor,p_session);
end $$;

create table dorra_private.player_presence(user_id uuid primary key references dorra_private.profiles(user_id) on delete cascade,
 session_id uuid not null,lease_id uuid not null,last_seen timestamptz not null default now(),visible boolean not null);
create index player_presence_seen on dorra_private.player_presence(last_seen);
create table dorra_private.announcements(id uuid primary key default gen_random_uuid(),actor uuid not null references dorra_private.profiles(user_id),
 target uuid references dorra_private.profiles(user_id),title text not null check(length(title) between 1 and 100),
 message text not null check(length(message) between 1 and 1000),reason text not null,created_at timestamptz not null default now(),
 expires_at timestamptz not null,check(expires_at>created_at));
create index announcements_actor on dorra_private.announcements(actor);
create index announcements_target on dorra_private.announcements(target);
create index announcements_expiry on dorra_private.announcements(expires_at);
create table dorra_private.announcement_recipients(announcement_id uuid not null references dorra_private.announcements(id) on delete cascade,
 user_id uuid not null references dorra_private.profiles(user_id) on delete cascade,dismissed_at timestamptz,
 primary key(announcement_id,user_id));
create index announcement_recipients_user on dorra_private.announcement_recipients(user_id);

create function dorra_private.online_players() returns table(user_id uuid,last_seen timestamptz)
language sql security invoker set search_path='' as $$
 select p.user_id,p.last_seen from dorra_private.player_presence p
 join dorra_private.profiles profile on profile.user_id=p.user_id
 join dorra_private.player_state state on state.user_id=p.user_id and state.lease_id=p.lease_id and state.auth_session_id=p.session_id
 join auth.sessions session on session.id=p.session_id and session.user_id=p.user_id
 where p.visible and p.last_seen>now()-interval '90 seconds' and (session.not_after is null or session.not_after>now())
 and not profile.disabled and not profile.banned and (profile.suspended_until is null or profile.suspended_until<=now())
$$;
create function public.dorra_player_pulse(p_actor uuid,p_session uuid,p_lease uuid,p_visible boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare rows jsonb;
begin
 perform dorra_private.player_allowed(p_actor,p_session);
 if not exists(select 1 from dorra_private.player_state where user_id=p_actor and auth_session_id=p_session and lease_id=p_lease) then raise exception 'SESSION_REPLACED'; end if;
 insert into dorra_private.player_presence values(p_actor,p_session,p_lease,now(),p_visible)
 on conflict(user_id) do update set session_id=excluded.session_id,lease_id=excluded.lease_id,last_seen=excluded.last_seen,visible=excluded.visible;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'message',a.message,'expiresAt',a.expires_at) order by a.created_at),'[]'::jsonb)
 into rows from dorra_private.announcements a join dorra_private.announcement_recipients r on r.announcement_id=a.id
 where r.user_id=p_actor and r.dismissed_at is null and a.expires_at>now() and p_visible;
 return jsonb_build_object('messages',rows,'serverNow',now());
end $$;
create function public.dorra_player_dismiss(p_actor uuid,p_session uuid,p_message uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$ begin
 perform dorra_private.player_allowed(p_actor,p_session);
 update dorra_private.announcement_recipients set dismissed_at=coalesce(dismissed_at,now()) where announcement_id=p_message and user_id=p_actor;
 if not found then raise exception 'NOT_FOUND'; end if;
 return jsonb_build_object('ok',true);
end $$;

alter function public.dorra_admin_read(uuid,uuid,text,jsonb) rename to dorra_admin_read_before_owner_controls;
create function public.dorra_admin_read(p_actor uuid,p_session uuid,p_operation text,p_args jsonb default '{}'::jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare context jsonb; rows jsonb; total int; data jsonb; skip int:=coalesce((p_args->>'offset')::int,0); search text:=coalesce(p_args->>'search','');
begin
 context:=dorra_private.staff_context(p_actor,p_session);
 if p_operation in ('online','announcements') then
  if not(context->>'owner')::boolean then raise exception 'PERMISSION_DENIED'; end if;
  if p_operation='online' then
   select count(*) into total from dorra_private.online_players() o join dorra_private.profiles p on p.user_id=o.user_id where strpos(lower(p.username),lower(search))>0;
   select coalesce(jsonb_agg(item),'[]'::jsonb) into rows from (
    select dorra_private.profile_view(o.user_id,true)||jsonb_build_object('lastSeen',o.last_seen) item from dorra_private.online_players() o
    join dorra_private.profiles p on p.user_id=o.user_id where strpos(lower(p.username),lower(search))>0 order by p.username limit 40 offset skip) page;
  else
   select count(*) into total from dorra_private.announcements;
   select coalesce(jsonb_agg(item),'[]'::jsonb) into rows from (
    select jsonb_build_object('id',a.id,'title',a.title,'message',a.message,'target',coalesce(p.username,'Online players at publication'),
     'expiresAt',a.expires_at,'createdAt',a.created_at,'recipients',(select count(*) from dorra_private.announcement_recipients where announcement_id=a.id),
     'dismissed',(select count(*) from dorra_private.announcement_recipients where announcement_id=a.id and dismissed_at is not null)) item
    from dorra_private.announcements a left join dorra_private.profiles p on p.user_id=a.target order by a.created_at desc,a.id limit 40 offset skip) page;
  end if;
  return jsonb_build_object('rows',rows,'total',total,'offset',skip,'serverNow',now());
 end if;
 data:=public.dorra_admin_read_before_owner_controls(p_actor,p_session,p_operation,p_args);
 if p_operation='dashboard' then
  data:=data||jsonb_build_object('gameChanges',(select count(*) from dorra_private.admin_audit where created_at>=now()-case coalesce(p_args->>'period','24h') when '7d' then interval '7 days' when '30d' then interval '30 days' else interval '24 hours' end and action in ('money','xp','stats','football-tokens','airport-cash','airport-research','airport-diamonds','level','unlock','save-field')));
 end if;
 if (context->>'owner')::boolean and p_operation='dashboard' then
  data:=data||jsonb_build_object('onlinePlayers',(select count(*) from dorra_private.online_players()));
 end if;
 return data;
end $$;

-- Extend existing atomic preview/commit operations; retain all prior revisions,
-- row locking, idempotency and same-transaction append-only audits.
do $$ declare definition text; begin
 select pg_get_functiondef('public.dorra_admin_preview(uuid,uuid,uuid,bigint,bigint,jsonb,jsonb,text,jsonb,jsonb)'::regprocedure) into definition;
 definition:=replace(definition, 'if coalesce(length(trim(p_args->>''reason'')),0)', $code$
 if p_args->>'action' in ('save-field','announcement','password-set') and not(context->>'owner')::boolean then raise exception 'PERMISSION_DENIED'; end if;
 if coalesce(length(trim(p_args->>'reason')),0)$code$);
 execute definition;
 select pg_get_functiondef('public.dorra_admin_commit(uuid,uuid,uuid,uuid)'::regprocedure) into definition;
 definition:=replace(definition,'''level'',''unlock'');','''level'',''unlock'',''save-field'');');
 definition:=replace(definition, 'select * into profile from dorra_private.profiles where user_id=preview.target for update;', $code$
 if action in ('save-field','announcement','password-set') and not(context->>'owner')::boolean then raise exception 'PERMISSION_DENIED'; end if;
 if action='password-set' then raise exception 'INVALID_INPUT'; end if;
 select * into profile from dorra_private.profiles where user_id=preview.target for update;$code$);
 definition:=replace(definition, 'elsif action=''warn'' then null;', $code$
 elsif action='announcement' then
  if length(trim(preview.args->>'title')) not between 1 and 100 or length(trim(preview.args->>'message')) not between 1 and 1000
   or (preview.args->>'duration')::int not between 10 and 3600 or preview.args->>'audience' not in ('player','online') then raise exception 'INVALID_INPUT'; end if;
  insert into dorra_private.announcements(actor,target,title,message,reason,expires_at)
   values(p_actor,case when preview.args->>'audience'='player' then preview.target else null end,preview.args->>'title',preview.args->>'message',
    preview.args->>'reason',now()+make_interval(secs=>(preview.args->>'duration')::int)) returning id into created;
  if preview.args->>'audience'='player' then insert into dorra_private.announcement_recipients values(created,preview.target,null);
  else insert into dorra_private.announcement_recipients select created,user_id,null from dorra_private.online_players(); end if;
 elsif action='warn' then null;$code$);
 if strpos(definition,'''unlock'',''save-field'');')=0 or strpos(definition,'insert into dorra_private.announcements')=0 then raise exception 'Owner commit extension did not match'; end if;
 execute definition;
end $$;

do $$ declare t text; begin
 foreach t in array array['player_presence','announcements','announcement_recipients'] loop
  execute format('alter table dorra_private.%I enable row level security',t);
  execute format('revoke all on dorra_private.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update,delete on dorra_private.%I to service_role',t);
 end loop;
end $$;
revoke all on function dorra_private.online_players(),public.dorra_player_pulse(uuid,uuid,uuid,boolean),public.dorra_player_dismiss(uuid,uuid,uuid),public.dorra_admin_read(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function dorra_private.online_players(),public.dorra_player_pulse(uuid,uuid,uuid,boolean),public.dorra_player_dismiss(uuid,uuid,uuid),public.dorra_admin_read(uuid,uuid,text,jsonb) to service_role;
