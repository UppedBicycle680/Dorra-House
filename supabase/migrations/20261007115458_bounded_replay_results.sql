-- Canonical account names and complete, bounded compressed retry outcomes.
create or replace function public.dorra_acquire_session(p_user_id uuid, p_auth_session_id uuid, p_lease_id uuid, p_initial jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare player dorra_private.player_state; profile dorra_private.profiles;
begin
  if not exists(select 1 from auth.sessions where id=p_auth_session_id and user_id=p_user_id and (not_after is null or not_after>now())) then
    raise exception 'AUTH_SESSION_ENDED';
  end if;
  select * into profile from dorra_private.profiles where user_id=p_user_id;
  if profile.user_id is null or profile.disabled then raise exception 'ACCOUNT_DISABLED'; end if;
  insert into dorra_private.player_state(user_id,snapshot,auth_session_id,lease_id)
    values(p_user_id,jsonb_set(p_initial,'{progress,profile,name}',to_jsonb(profile.username)),p_auth_session_id,p_lease_id) on conflict(user_id) do nothing;
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

create or replace function public.dorra_commit_action(p_user_id uuid,p_auth_session_id uuid,p_lease_id uuid,
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
  if octet_length(p_result::text)>=262144 then raise exception 'RESULT_SIZE_LIMIT'; end if;
  recent := recent || jsonb_build_array(jsonb_build_object('id',p_request_id,'digest',p_digest,
    'result',p_result));
  update dorra_private.player_state set snapshot=p_snapshot,private_state=p_private_state,
    revision=revision+1,recent_requests=recent,updated_at=now(),
    rate_count=case when rate_window>now()-interval '1 minute' then rate_count+1 else 1 end,
    rate_window=case when rate_window>now()-interval '1 minute' then rate_window else now() end
    where user_id=p_user_id returning * into player;
  return jsonb_build_object('snapshot',player.snapshot,'revision',player.revision,'result',p_result,'replayed',false);
end;
$$;
