-- Elimination requires loss of territory and surviving forces. Occupying both
-- capitals while defenders remain uses the six-game-hour hold condition.
-- Electronic/air operations and combat-time economy accrual are installed by
-- the preceding capability-operations migration.
do $patch$
declare definition text;needle text;replacement text;
begin
 definition:=pg_get_functiondef('dorra_private.war_finish(uuid,numeric,boolean)'::regprocedure);
 needle:=$old$ select sum(score),count(*) filter(where score>0 and not retired) into total,alive from dorra_private.war_sides where match_id=mid;$old$;
 replacement:=$new$ select sum(survival.score),count(*) filter(where not survival.retired and (survival.score>0 or exists(select 1 from dorra_private.war_units remaining_force where remaining_force.match_id=mid and remaining_force.nation_id=survival.nation_id and remaining_force.health>0))) into total,alive from dorra_private.war_sides survival where survival.match_id=mid;$new$;
 if strpos(definition,needle)=0 then raise exception 'war force survival patch did not match';end if;
 execute replace(definition,needle,replacement);
 definition:=pg_get_functiondef('dorra_private.war_schedule_move_core(uuid,uuid,text,text,numeric,jsonb)'::regprocedure);
 needle:=$old$ if kind='embark' and not exists(select 1 from dorra_private.war_catalog_provinces where id=u.province_id and coalesce((data->>'port')::boolean,false)) then raise exception 'PORT_REQUIRED';end if;$old$;
 replacement:=$new$ if kind='embark' and (not exists(select 1 from dorra_private.war_catalog_provinces where id=u.province_id and coalesce((data->>'port')::boolean,false)) or not exists(select 1 from dorra_private.war_catalog_provinces where id=target and coalesce((data->>'port')::boolean,false))) then raise exception 'PORT_REQUIRED';end if;$new$;
 if strpos(definition,needle)=0 then raise exception 'war embark landing port patch did not match';end if;
 execute replace(definition,needle,replacement);
end $patch$;
