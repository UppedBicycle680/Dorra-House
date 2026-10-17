-- Player state is never exposed to browser table writes. Only the authenticated
-- Edge Function's service role can run these transactional storage operations.
create schema if not exists dorra_private;
revoke all on schema dorra_private from public, anon, authenticated;
grant usage on schema dorra_private to service_role;

create table dorra_private.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  role text not null default 'player' check (role in ('player','admin')),
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index profiles_username_unique on dorra_private.profiles (lower(username));
alter table dorra_private.profiles enable row level security;

create table dorra_private.player_state (
  user_id uuid primary key references dorra_private.profiles(user_id) on delete cascade,
  snapshot jsonb not null,
  private_state jsonb not null default '{}'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  auth_session_id uuid not null,
  lease_id uuid not null,
  recent_requests jsonb not null default '[]'::jsonb,
  rate_window timestamptz not null default now(),
  rate_count integer not null default 0,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(snapshot) = 'object'),
  check (jsonb_typeof(private_state) = 'object'),
  check (octet_length(snapshot::text) + octet_length(private_state::text) < 10000000)
);
alter table dorra_private.player_state enable row level security;
grant select, insert, update, delete on all tables in schema dorra_private to service_role;
revoke all on all tables in schema dorra_private from public, anon, authenticated;

create function dorra_private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare chosen text;
begin
  chosen := new.raw_user_meta_data->>'username';
  if chosen is null or chosen !~ '^[A-Za-z0-9_]{3,24}$' then
    raise exception 'A username of 3-24 letters, numbers or underscores is required';
  end if;
  insert into dorra_private.profiles(user_id,username) values (new.id,chosen);
  return new;
end;
$$;
revoke all on function dorra_private.create_profile() from public, anon, authenticated;
create trigger dorra_create_profile after insert on auth.users
for each row execute function dorra_private.create_profile();

create function public.dorra_acquire_session(p_user_id uuid, p_auth_session_id uuid, p_lease_id uuid, p_initial jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare player dorra_private.player_state; profile dorra_private.profiles;
begin
  if not exists(select 1 from auth.sessions where id=p_auth_session_id and user_id=p_user_id and (not_after is null or not_after>now())) then
    raise exception 'AUTH_SESSION_ENDED';
  end if;
  select * into profile from dorra_private.profiles where user_id=p_user_id;
  if profile.user_id is null or profile.disabled then raise exception 'ACCOUNT_DISABLED'; end if;
  insert into dorra_private.player_state(user_id,snapshot,auth_session_id,lease_id)
    values(p_user_id,p_initial,p_auth_session_id,p_lease_id) on conflict(user_id) do nothing;
  select * into player from dorra_private.player_state where user_id=p_user_id for update;
  if player.rate_window>now()-interval '1 minute' and player.rate_count>=180 then raise exception 'RATE_LIMIT'; end if;
  update dorra_private.player_state set auth_session_id=p_auth_session_id,lease_id=p_lease_id,
    revision=revision+1,updated_at=now(),
    rate_count=case when rate_window>now()-interval '1 minute' then rate_count+1 else 1 end,
    rate_window=case when rate_window>now()-interval '1 minute' then rate_window else now() end
    where user_id=p_user_id returning * into player;
  return jsonb_build_object('snapshot',player.snapshot,'privateState',player.private_state,'revision',player.revision,'username',profile.username,'recentRequests',player.recent_requests);
end;
$$;

create function public.dorra_read_state(p_user_id uuid,p_auth_session_id uuid,p_lease_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare player dorra_private.player_state;
begin
  if not exists(select 1 from auth.sessions where id=p_auth_session_id and user_id=p_user_id and (not_after is null or not_after>now())) then raise exception 'AUTH_SESSION_ENDED'; end if;
  if not exists(select 1 from dorra_private.profiles where user_id=p_user_id and not disabled) then raise exception 'ACCOUNT_DISABLED'; end if;
  select * into player from dorra_private.player_state where user_id=p_user_id;
  if player.user_id is null then raise exception 'SAVE_REQUIRED'; end if;
  if player.lease_id<>p_lease_id or player.auth_session_id<>p_auth_session_id then raise exception 'SESSION_REPLACED'; end if;
  if player.rate_window>now()-interval '1 minute' and player.rate_count>=180 then raise exception 'RATE_LIMIT'; end if;
  return jsonb_build_object('snapshot',player.snapshot,'privateState',player.private_state,'revision',player.revision,'recentRequests',player.recent_requests);
end;
$$;

create function public.dorra_commit_action(p_user_id uuid,p_auth_session_id uuid,p_lease_id uuid,
  p_expected_revision bigint,p_request_id uuid,p_digest text,p_snapshot jsonb,p_private_state jsonb,p_result jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare player dorra_private.player_state; cached jsonb; recent jsonb;
begin
  if not exists(select 1 from auth.sessions where id=p_auth_session_id and user_id=p_user_id and (not_after is null or not_after>now())) then raise exception 'AUTH_SESSION_ENDED'; end if;
  if not exists(select 1 from dorra_private.profiles where user_id=p_user_id and not disabled) then raise exception 'ACCOUNT_DISABLED'; end if;
  select * into player from dorra_private.player_state where user_id=p_user_id for update;
  if player.user_id is null then raise exception 'SAVE_REQUIRED'; end if;
  if player.lease_id<>p_lease_id or player.auth_session_id<>p_auth_session_id then raise exception 'SESSION_REPLACED'; end if;
  select value into cached from jsonb_array_elements(player.recent_requests) where value->>'id'=p_request_id::text;
  if cached is not null then
    if cached->>'digest'<>p_digest then raise exception 'REQUEST_REUSED'; end if;
    return jsonb_build_object('snapshot',player.snapshot,'revision',player.revision,'result',cached->'result','replayed',true);
  end if;
  if player.revision<>p_expected_revision then raise exception 'STALE_REVISION'; end if;
  if player.rate_window>now()-interval '1 minute' and player.rate_count>=180 then raise exception 'RATE_LIMIT'; end if;
  select coalesce(jsonb_agg(value order by ordinal),'[]'::jsonb) into recent
    from jsonb_array_elements(player.recent_requests) with ordinality as entries(value,ordinal)
    where ordinal>greatest(0,jsonb_array_length(player.recent_requests)-7);
  recent := recent || jsonb_build_array(jsonb_build_object('id',p_request_id,'digest',p_digest,
    'result',case when octet_length(p_result::text)<32768 then p_result else jsonb_build_object('replayed',true,'refreshRequired',true) end));
  update dorra_private.player_state set snapshot=p_snapshot,private_state=p_private_state,
    revision=revision+1,recent_requests=recent,updated_at=now(),
    rate_count=case when rate_window>now()-interval '1 minute' then rate_count+1 else 1 end,
    rate_window=case when rate_window>now()-interval '1 minute' then rate_window else now() end
    where user_id=p_user_id returning * into player;
  return jsonb_build_object('snapshot',player.snapshot,'revision',player.revision,'result',p_result,'replayed',false);
end;
$$;

revoke all on function public.dorra_acquire_session(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.dorra_read_state(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.dorra_commit_action(uuid,uuid,uuid,bigint,uuid,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.dorra_acquire_session(uuid,uuid,uuid,jsonb) to service_role;
grant execute on function public.dorra_read_state(uuid,uuid,uuid) to service_role;
grant execute on function public.dorra_commit_action(uuid,uuid,uuid,bigint,uuid,text,jsonb,jsonb,jsonb) to service_role;
