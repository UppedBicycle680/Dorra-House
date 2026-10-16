-- Keep lightweight summaries, but advance past already-cleaned worlds so later
-- retention batches are not starved by the first twenty old summaries.
alter table dorra_private.war_matches add column archived_at timestamptz;
create index war_matches_retention on dorra_private.war_matches(finished_at) where status='finished' and archived_at is null;
do $patch$
declare definition text;needle text;replacement text;
begin
 definition:=pg_get_functiondef('dorra_private.war_maintenance()'::regprocedure);
 needle:=$old$where status='finished' and finished_at<now()-interval '7 days'$old$;
 replacement:=$new$where status='finished' and archived_at is null and finished_at<now()-interval '7 days'$new$;
 if strpos(definition,needle)=0 then raise exception 'war retention batch selection did not match';end if;
 definition:=replace(definition,needle,replacement);
 needle:=$old$ delete from dorra_private.war_relations where match_id=old_world.id;$old$;
 replacement:=$new$ delete from dorra_private.war_relations where match_id=old_world.id;
 update dorra_private.war_matches set archived_at=now(),notify_dirty=false where id=old_world.id;$new$;
 if strpos(definition,needle)=0 then raise exception 'war retention completion marker did not match';end if;
 execute replace(definition,needle,replacement);
end $patch$;
