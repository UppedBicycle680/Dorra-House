-- Broadcast only revision hints. Private gameplay state stays behind dorra-api.
create policy dorra_receive_own_save_notifications
on realtime.messages for select to authenticated
using (
  extension = 'broadcast'
  and topic = 'dorra-save:' || (select auth.uid())::text
  and (select realtime.topic()) = 'dorra-save:' || (select auth.uid())::text
);

create function dorra_private.notify_save_revision()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform realtime.send(
    jsonb_build_object('revision',new.revision),
    'save-changed',
    'dorra-save:' || new.user_id::text,
    true
  );
  return null;
end;
$$;
revoke all on function dorra_private.notify_save_revision() from public,anon,authenticated;
grant execute on function dorra_private.notify_save_revision() to service_role;

create trigger dorra_notify_save_revision
after update of revision on dorra_private.player_state
for each row when (old.revision is distinct from new.revision)
execute function dorra_private.notify_save_revision();
