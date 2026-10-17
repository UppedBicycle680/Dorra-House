-- Profile/report history is complete; only dashboard activity uses a rolling
-- window. Shared office IPs do not consume the five-attempt per-user allowance.
do $$ declare definition text; begin
  definition:=pg_get_functiondef('public.dorra_admin_read(uuid,uuid,text,jsonb)'::regprocedure);
  definition:=replace(definition,'when ''30d'' then interval ''30 days'' else interval ''24 hours'' end;',
    'when ''30d'' then interval ''30 days'' else interval ''24 hours'' end;'||E'\n  if p_args->>''period''=''all'' then cutoff:=''-infinity''::timestamptz; end if;');
  definition:=replace(definition,'''period'',''30d''','''period'',''all''');
  execute definition;
  definition:=pg_get_functiondef('public.dorra_admin_attempt(uuid,uuid,text)'::regprocedure);
  definition:=replace(definition,'case when bucket_name=''global'' then 100 else 5 end',
    'case when bucket_name=''global'' then 100 when bucket_name like ''ip:%'' then 50 else 5 end');
  execute definition;
  -- Count accepted command commits even if a command makes no state change.
  -- Acquisition, lease refreshes, reads, duplicate retries and admin edits are
  -- excluded. The flag can only be set by the restricted server RPC.
  definition:=pg_get_functiondef('public.dorra_commit_action(uuid,uuid,uuid,bigint,uuid,text,jsonb,jsonb,jsonb)'::regprocedure);
  definition:=replace(definition,'update dorra_private.player_state set snapshot=p_snapshot',
    'perform set_config(''dorra.gameplay_command'',''true'',true);'||E'\n  update dorra_private.player_state set snapshot=p_snapshot');
  execute definition;
  -- Audit the exact server-time expiry used by the committed suspension.
  definition:=pg_get_functiondef('public.dorra_admin_commit(uuid,uuid,uuid,uuid)'::regprocedure);
  definition:=replace(definition,'update dorra_private.profiles set suspended_until=now()+make_interval(hours=>(preview.args->>''duration'')::int) where user_id=preview.target;',
    'preview.changes:=jsonb_set(preview.changes,''{0,after}'',to_jsonb(now()+make_interval(hours=>(preview.args->>''duration'')::int)));'||E'\n    update dorra_private.profiles set suspended_until=now()+make_interval(hours=>(preview.args->>''duration'')::int) where user_id=preview.target;');
  execute definition;
end $$;

create or replace function dorra_private.record_gameplay_day() returns trigger
language plpgsql security invoker set search_path='' as $$ begin
  if current_setting('dorra.gameplay_command',true)='true' then
    insert into dorra_private.gameplay_days values(new.user_id,(now() at time zone 'UTC')::date,now())
      on conflict(user_id,day) do update set last_action_at=excluded.last_action_at;
  end if;
  return new;
end $$;
