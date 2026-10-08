-- Cover profile context/FK lookups and grant-revocation queries as history grows.
create index admin_previews_actor_session on dorra_private.admin_previews(actor,session_id);
create index admin_previews_target on dorra_private.admin_previews(target);
create index reports_target on dorra_private.reports(target,created_at desc);
create index reports_actor on dorra_private.reports(actor);
create index reports_resolved_by on dorra_private.reports(resolved_by);
create index activity_flags_target on dorra_private.activity_flags(target,created_at desc);
create index activity_flags_actor on dorra_private.activity_flags(actor);
create index activity_flags_resolved_by on dorra_private.activity_flags(resolved_by);
