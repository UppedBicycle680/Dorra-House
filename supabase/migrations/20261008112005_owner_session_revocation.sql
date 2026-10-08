-- Hosted Auth protects its session tables from broad service-role mutations.
-- Only this private, server-callable routine can revoke a specific account.
create function dorra_private.terminate_auth_sessions(p_target uuid) returns void
language plpgsql security definer set search_path='' as $$ begin
 delete from auth.refresh_tokens where user_id=p_target::text;
 delete from auth.sessions where user_id=p_target;
end $$;
revoke all on function dorra_private.terminate_auth_sessions(uuid) from public,anon,authenticated;
grant execute on function dorra_private.terminate_auth_sessions(uuid) to service_role;
revoke delete on auth.sessions,auth.refresh_tokens from service_role;
revoke select(user_id) on auth.refresh_tokens from service_role;
do $$ declare definition text; begin
 select pg_get_functiondef('public.dorra_owner_password_finish(uuid,uuid,uuid,uuid,boolean)'::regprocedure) into definition;
 definition:=replace(definition,'delete from auth.refresh_tokens where user_id=job.target::text;','perform dorra_private.terminate_auth_sessions(job.target);');
 definition:=replace(definition,'delete from auth.sessions where user_id=job.target;','');
 if strpos(definition,'perform dorra_private.terminate_auth_sessions(job.target)')=0 then raise exception 'Session revocation extension did not match';end if;
 execute definition;
end $$;
