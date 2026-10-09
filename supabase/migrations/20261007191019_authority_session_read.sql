-- The security-invoker save RPCs inspect only these Auth session fields.
grant select (id, user_id, not_after) on auth.sessions to service_role;
