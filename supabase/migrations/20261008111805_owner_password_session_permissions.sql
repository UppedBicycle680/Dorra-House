-- DELETE predicates need SELECT on the owner column, never token contents.
grant select(user_id) on auth.refresh_tokens to service_role;
