-- Discover support locations once, then bound both entrenchment and repairs to
-- 32 formations. Peaceful neutral garrisons incur no hourly entrenchment writes.
create or replace function dorra_private.war_field_support(mid uuid) returns void
language plpgsql set search_path='' as $$
declare entrench_ids uuid[];repair_ids uuid[];damaged record;available numeric;cost numeric;
begin
 with support_sites as materialized(
 select support.nation_id,support.province_id,
 bool_or(coalesce(platform.data->'capabilities','[]') ? 'entrench') entrench,
 bool_or(coalesce(platform.data->'capabilities','[]') ? 'repair') repair
 from dorra_private.war_units support join dorra_private.war_catalog_platforms platform on platform.id=support.platform_id
 where support.match_id=mid and support.health>0 and support.orders='{}'
 and (coalesce(platform.data->'capabilities','[]') ? 'entrench' or coalesce(platform.data->'capabilities','[]') ? 'repair')
 group by support.nation_id,support.province_id),
 hostile_sides as materialized(select a nation_id from dorra_private.war_relations where match_id=mid and relation='war' union select b from dorra_private.war_relations where match_id=mid and relation='war'),
 entrench_candidates as materialized(
 select u.id from support_sites site join hostile_sides hostile on hostile.nation_id=site.nation_id
 join dorra_private.war_units u on u.match_id=mid and u.nation_id=site.nation_id and u.province_id=site.province_id
 where site.entrench and u.health>0 and u.domain='land' and u.orders='{}' and u.entrenchment<20
 and not exists(select 1 from dorra_private.war_relations relation join dorra_private.war_units enemy on enemy.match_id=mid and enemy.nation_id=(case when relation.a=u.nation_id then relation.b else relation.a end) and enemy.province_id=u.province_id and enemy.health>0 where relation.match_id=mid and relation.relation='war' and u.nation_id in(relation.a,relation.b))
 order by u.entrenchment,u.id limit 32),
 damaged_units as materialized(select * from dorra_private.war_units where match_id=mid and health<max_health and orders='{}'),
 repair_candidates as materialized(
 select u.id from damaged_units u join support_sites site on site.nation_id=u.nation_id and site.province_id=u.province_id and site.repair
 where not exists(select 1 from dorra_private.war_relations relation join dorra_private.war_units enemy on enemy.match_id=mid and enemy.nation_id=(case when relation.a=u.nation_id then relation.b else relation.a end) and enemy.province_id=u.province_id and enemy.health>0 where relation.match_id=mid and relation.relation='war' and u.nation_id in(relation.a,relation.b))
 order by u.health/u.max_health,u.id limit 32)
 select (select array_agg(id) from entrench_candidates),(select array_agg(id) from repair_candidates) into entrench_ids,repair_ids;
 if cardinality(entrench_ids)>0 then update dorra_private.war_units set entrenchment=least(20,entrenchment+2) where id=any(entrench_ids);end if;
 for damaged in select * from dorra_private.war_units where id=any(repair_ids) for update loop
 cost:=ceil(least(2,damaged.max_health-damaged.health)*damaged.strength);
 select (resources->>'supplies')::numeric into available from dorra_private.war_sides where match_id=mid and nation_id=damaged.nation_id;
 if available>=cost then perform dorra_private.war_pay(mid,damaged.nation_id,jsonb_build_object('supplies',cost));update dorra_private.war_units set health=least(max_health,health+2) where id=damaged.id;end if;
 end loop;
end $$;
revoke all on function dorra_private.war_field_support(uuid) from public,anon,authenticated;
grant execute on function dorra_private.war_field_support(uuid) to service_role;
