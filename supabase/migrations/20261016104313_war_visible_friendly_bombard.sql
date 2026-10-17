-- A detected hostile formation can occupy friendly territory. Stationary land
-- and naval bombardment must validate the selected hostile, rather than asking
-- its defender to declare war on the province owner. Aircraft, missiles and
-- nuclear collateral rules retain their existing order paths.
do $friendly_bombard$
declare definition text;needle text;replacement text;
begin
 definition:=pg_get_functiondef('dorra_private.war_order_command(uuid,text,jsonb,numeric)'::regprocedure);
 needle:=$old$ elsif friend='bombard' then
 select nation_id into other from dorra_private.war_provinces where match_id=mid and province_id=target;
 if dorra_private.war_relation(mid,nid,other)<>'war' then raise exception 'DECLARE_WAR_FIRST';end if;
 if u.orders<>'{}' then raise exception 'UNIT_BUSY';end if;$old$;
 replacement:=$new$ elsif friend='bombard' then
 select nation_id into other from dorra_private.war_provinces where match_id=mid and province_id=target;
 -- An explicit contact is never a licence to fire at a friend, neutral or
 -- incompatible target, even when that contact stands in hostile territory.
 if p_args->>'targetUnitId' is not null and not exists(
  select 1 from dorra_private.war_units hostile join dorra_private.war_catalog_platforms target_platform on target_platform.id=hostile.platform_id
  where hostile.match_id=mid and hostile.id=(p_args->>'targetUnitId')::uuid and hostile.province_id=target and hostile.health>0
   and dorra_private.war_relation(mid,nid,hostile.nation_id)='war'
   and dorra_private.war_vision(mid,nid,hostile)
   and dorra_private.war_weapon_power(cost,target_platform.data,hostile.orders)>0
 ) then raise exception 'NO_VALID_TARGET';end if;
 if dorra_private.war_relation(mid,nid,other)<>'war' then
  if p_args->>'targetUnitId' is null or (other<>nid and dorra_private.war_relation(mid,nid,other)<>'alliance') then raise exception 'DECLARE_WAR_FIRST';end if;
 end if;
 if u.orders<>'{}' then raise exception 'UNIT_BUSY';end if;$new$;
 if strpos(definition,needle)=0 then raise exception 'Visible friendly-territory bombardment patch did not match';end if;
 execute replace(definition,needle,replacement);
end $friendly_bombard$;
