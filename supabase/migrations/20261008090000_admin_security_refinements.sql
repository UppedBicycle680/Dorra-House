-- Refine authorization at preview time and remove a PL/pgSQL name ambiguity.
do $$ declare definition text; begin
  select pg_get_functiondef(p.oid) into definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='dorra_admin_read';
  definition:=replace(definition,'target uuid; record jsonb;','selected_target uuid; record jsonb;');
  definition:=replace(definition,'target:=(p_args','selected_target:=(p_args');
  definition:=replace(definition,'profile_view(target,','profile_view(selected_target,');
  definition:=replace(definition,'''targetId'',target,','''targetId'',selected_target,');
  definition:=replace(definition,'activity_flags.target=target','activity_flags.target=selected_target');
  execute definition;
  select pg_get_functiondef(p.oid) into definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='dorra_admin_preview';
  definition:=replace(definition,'context:=dorra_private.staff_context(p_actor,p_session);', $code$
  context:=dorra_private.staff_context(p_actor,p_session);
  if p_args->>'action' in ('money','xp','stats','football-tokens','airport-cash','airport-research','airport-diamonds','level','unlock','ban','lift') and context->>'role'<>'admin' then raise exception 'PERMISSION_DENIED'; end if;
  if p_args->>'action' in ('staff-role','revoke-access') and not(context->>'owner')::boolean then raise exception 'PERMISSION_DENIED'; end if;
  $code$);
  execute definition;
end $$;
