-- Owner-only operational detail. Read supply once for each occupied province,
-- even when several formations share a location; enemy readiness stays hidden.
do $patch$
declare definition text;needle text;replacement text;
begin
 definition:=pg_get_functiondef('dorra_private.war_view(uuid,uuid)'::regprocedure);
 needle:=$old$ select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'nationId',u.nation_id,'provinceId',u.province_id,'platformId',u.platform_id,'name',u.name,'domain',u.domain,'strength',u.strength,'health',u.health,'maxHealth',u.max_health,'order',case when u.nation_id=s.nation_id then u.orders else null end) order by u.id),'[]') into units from dorra_private.war_units u where u.match_id=mid and u.id in(select id from dorra_private.war_visible_units(mid,s.nation_id));$old$;
 replacement:=$new$ with own_locations as materialized(
 select distinct province_id from dorra_private.war_units where match_id=mid and nation_id=s.nation_id and health>0
 ),readiness as materialized(
 select province_id,dorra_private.war_supply(mid,s.nation_id,province_id) supply from own_locations
 ) select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'nationId',u.nation_id,'provinceId',u.province_id,'platformId',u.platform_id,'name',u.name,'domain',u.domain,'strength',u.strength,'health',u.health,'maxHealth',u.max_health,'order',case when u.nation_id=s.nation_id then u.orders else null end)
 ||case when u.nation_id=s.nation_id then jsonb_build_object('supply',r.supply,'entrenchment',u.entrenchment,'baseCarrierId',u.base_carrier_id,'interceptReadyAt',u.intercept_ready_at) else '{}'::jsonb end order by u.id),'[]') into units
 from dorra_private.war_units u left join readiness r on r.province_id=u.province_id and u.nation_id=s.nation_id
 where u.match_id=mid and u.id in(select id from dorra_private.war_visible_units(mid,s.nation_id));$new$;
 if strpos(definition,needle)=0 then raise exception 'war readiness view patch did not match';end if;
 execute replace(definition,needle,replacement);

 -- Readiness changes may generate a hint only for the owning observer.
 definition:=pg_get_functiondef('dorra_private.war_notify(uuid)'::regprocedure);
 needle:=$old$jsonb_build_array(u.id,u.nation_id,u.province_id,u.platform_id,u.strength,u.health,case when u.nation_id=sid then u.orders else null end)$old$;
 replacement:=$new$jsonb_build_array(u.id,u.nation_id,u.province_id,u.platform_id,u.strength,u.health,case when u.nation_id=sid then u.orders else null end,case when u.nation_id=sid then jsonb_build_array(u.entrenchment,u.base_carrier_id,u.intercept_ready_at) else null end)$new$;
 if strpos(definition,needle)=0 then raise exception 'war readiness hint patch did not match';end if;
 execute replace(definition,needle,replacement);
end $patch$;
