-- Username mappings and attempt counters remain private. Passwords are checked
-- only by Supabase Auth; no browser can call this lookup or read its tables.
create table dorra_private.login_attempts (
  bucket text primary key,
  window_started timestamptz not null default now(),
  attempts integer not null default 1 check (attempts between 1 and 101)
);
create index login_attempts_window on dorra_private.login_attempts(window_started);
alter table dorra_private.login_attempts enable row level security;
revoke all on dorra_private.login_attempts from public, anon, authenticated;
grant select, insert, update, delete on dorra_private.login_attempts to service_role;

create function public.dorra_username_login_attempt(p_username text, p_ip_hash text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  bucket_key text;
  bucket_limit integer;
  attempt_count integer;
  limited boolean := false;
  profile_id uuid;
begin
  if p_username is null or p_username !~ '^[A-Za-z0-9_]{3,24}$'
    or p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid login lookup';
  end if;
  -- Lock the shared bucket first: concurrent requests cannot overshoot limits,
  -- and all requests acquire the remaining locks in the same order.
  foreach bucket_key in array array['global', 'ip:' || p_ip_hash, 'username:' || lower(p_username)] loop
    bucket_limit := case when bucket_key = 'global' then 100 when bucket_key like 'ip:%' then 30 else 10 end;
    insert into dorra_private.login_attempts as rate(bucket,window_started,attempts)
      values(bucket_key,now(),1)
      on conflict(bucket) do update set
        attempts = case when rate.window_started <= now()-interval '1 minute' then 1 else least(rate.attempts+1,101) end,
        window_started = case when rate.window_started <= now()-interval '1 minute' then now() else rate.window_started end
      returning attempts into attempt_count;
    limited := limited or attempt_count > bucket_limit;
  end loop;
  -- Counters contain no raw IPs, and expire without a separate scheduled job.
  delete from dorra_private.login_attempts where window_started < now()-interval '10 minutes';
  if limited then return jsonb_build_object('limited',true,'user_id',null); end if;
  select user_id into profile_id from dorra_private.profiles
    where lower(username)=lower(p_username) and not disabled;
  return jsonb_build_object('limited',false,'user_id',profile_id);
end;
$$;
revoke all on function public.dorra_username_login_attempt(text,text) from public, anon, authenticated;
grant execute on function public.dorra_username_login_attempt(text,text) to service_role;
