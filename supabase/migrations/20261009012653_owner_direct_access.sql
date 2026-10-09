-- Owner entry requires a verified active Auth session and current protected role.
-- All panel operations retain their existing session/grant/role checks.
create function public.dorra_owner_open(p_actor uuid,p_session uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare context jsonb;
begin
 context:=dorra_private.staff_context(p_actor,p_session,false);
 if not (context->>'owner')::boolean or context->>'role'<>'admin' then
  raise exception 'PERMISSION_DENIED';
 end if;
 return public.dorra_admin_grant(p_actor,p_session,dorra_private.code_version());
end $$;
revoke all on function public.dorra_owner_open(uuid,uuid) from public,anon,authenticated;
grant execute on function public.dorra_owner_open(uuid,uuid) to service_role;
