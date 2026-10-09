-- A reset career can contain JSON null, which is distinct from SQL NULL.
-- Treat only existing objects as available careers in the permitted projection.
do $$ declare definition text; begin
  definition:=pg_get_functiondef('dorra_private.profile_view(uuid,boolean)'::regprocedure);
  definition:=replace(definition,'state.snapshot->''progress''->''footballManager''->''club'' is not null',
    'coalesce(jsonb_typeof(state.snapshot->''progress''->''footballManager''->''club'')=''object'',false)');
  definition:=replace(definition,'state.private_state->''airport'' is not null',
    'coalesce(jsonb_typeof(state.private_state->''airport'')=''object'',false)');
  execute definition;
end $$;
