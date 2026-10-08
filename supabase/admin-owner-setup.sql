-- Run only in the trusted Dorra House SQL editor after registering your account.
-- Replace the placeholder with the exact username you personally control.
begin;
do $$ declare selected_owner uuid; selected_username text := 'YOUR_EXACT_USERNAME'; begin
  lock table dorra_private.profiles in share row exclusive mode;
  if selected_username='YOUR_EXACT_USERNAME' then raise exception 'Replace YOUR_EXACT_USERNAME before running.'; end if;
  if exists(select 1 from dorra_private.profiles where owner) then raise exception 'An owner already exists. This setup cannot replace one.'; end if;
  select user_id into selected_owner from dorra_private.profiles where username=selected_username and not disabled and not banned;
  if selected_owner is null then raise exception 'No active account with that exact username. Register first.'; end if;
  update dorra_private.profiles set role='admin',owner=true,admin_version=admin_version+1 where user_id=selected_owner;
  delete from dorra_private.admin_grants where user_id=selected_owner;
end $$;
commit;
