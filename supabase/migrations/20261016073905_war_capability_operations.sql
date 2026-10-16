-- Operational effects for the capabilities presented by the national catalogue.
-- All distances, capacities and rates here are original game balance.
alter table dorra_private.war_units add column base_carrier_id uuid references dorra_private.war_units(id) on delete set null;
alter table dorra_private.war_units add column entrenchment numeric not null default 0 check(entrenchment between 0 and 20);
create index war_units_carrier on dorra_private.war_units(base_carrier_id) where base_carrier_id is not null;

create function dorra_private.war_signature_detected(sensor jsonb,target jsonb,ecm numeric default 1) returns boolean
language sql immutable set search_path='' as $$
 select case when coalesce(target->'capabilities','[]') ? 'submarine'
 then (coalesce(sensor->'capabilities','[]') ? 'sonar' or coalesce(sensor->'capabilities','[]') ? 'anti-submarine')
 and coalesce((sensor#>>'{stats,sonar}')::numeric,100)>=coalesce((target#>>'{stats,stealth}')::numeric,0)
 else coalesce((target#>>'{stats,stealth}')::numeric,0)<=coalesce((sensor#>>'{stats,radar}')::numeric,0)*ecm end
$$;

create or replace function dorra_private.war_vision(mid uuid,observer text,u dorra_private.war_units) returns boolean
language sql stable set search_path='' as $$
 select u.nation_id=observer or dorra_private.war_relation(mid,observer,u.nation_id)='alliance'
 or exists(select 1 from dorra_private.war_provinces p where p.match_id=mid and p.province_id=u.province_id and p.nation_id=observer)
 or exists(
 select 1 from dorra_private.war_units scout join dorra_private.war_catalog_platforms sensor on sensor.id=scout.platform_id
 join dorra_private.war_catalog_platforms target on target.id=u.platform_id
 join dorra_private.war_catalog_provinces a on a.id=scout.province_id join dorra_private.war_catalog_provinces b on b.id=u.province_id
 where scout.match_id=mid and scout.nation_id=observer and scout.health>0
 and abs((a.data->>'lat')::numeric-(b.data->>'lat')::numeric)<=coalesce((sensor.data#>>'{stats,vision}')::numeric,100)*1.15/110
 and dorra_private.war_distance(scout.province_id,u.province_id)<=coalesce((sensor.data#>>'{stats,vision}')::numeric,100)*(case when exists(select 1 from dorra_private.war_sides s where s.match_id=mid and s.nation_id=observer and s.research ? 'networked-command') then 1.15 else 1 end)
 and dorra_private.war_signature_detected(sensor.data,target.data,dorra_private.war_ecm(mid,observer,scout.province_id)))
 or exists(
 select 1 from dorra_private.war_provinces radar join dorra_private.war_catalog_platforms target on target.id=u.platform_id
 where radar.match_id=mid and radar.nation_id=observer and coalesce((radar.facilities->>'radar')::integer,0)>0
 and not(coalesce(target.data->'capabilities','[]') ? 'submarine')
 and coalesce((target.data#>>'{stats,stealth}')::numeric,0)<=coalesce((radar.facilities->>'radar')::integer,0)*35*dorra_private.war_ecm(mid,observer,radar.province_id)
 and dorra_private.war_distance(radar.province_id,u.province_id)<=coalesce((radar.facilities->>'radar')::integer,0)*100)
$$;

create or replace function dorra_private.war_visible_units(mid uuid,nid text) returns setof dorra_private.war_units
language sql stable set search_path='' as $$
 with own as materialized(select * from dorra_private.war_units where match_id=mid and nation_id=nid and health>0),
 visible_ids as(
 select id from own
 union select u.id from dorra_private.war_units u join dorra_private.war_provinces p on p.match_id=mid and p.province_id=u.province_id and p.nation_id=nid where u.match_id=mid
 union select u.id from dorra_private.war_relations r join dorra_private.war_units u on u.match_id=mid and u.nation_id=(case when r.a=nid then r.b else r.a end) where r.match_id=mid and r.relation='alliance' and nid in(r.a,r.b)
 union select enemy.id from own scout join dorra_private.war_catalog_platforms sensor on sensor.id=scout.platform_id
 join dorra_private.war_catalog_provinces a on a.id=scout.province_id
 join dorra_private.war_units enemy on enemy.match_id=mid and enemy.nation_id<>nid and enemy.health>0
 join dorra_private.war_catalog_provinces b on b.id=enemy.province_id join dorra_private.war_catalog_platforms target on target.id=enemy.platform_id
 where abs((a.data->>'lat')::numeric-(b.data->>'lat')::numeric)<=coalesce((sensor.data#>>'{stats,vision}')::numeric,100)*1.15/110
 and dorra_private.war_distance(scout.province_id,enemy.province_id)<=coalesce((sensor.data#>>'{stats,vision}')::numeric,100)*(case when exists(select 1 from dorra_private.war_sides s where s.match_id=mid and s.nation_id=nid and s.research ? 'networked-command') then 1.15 else 1 end)
 and dorra_private.war_signature_detected(sensor.data,target.data,dorra_private.war_ecm(mid,nid,scout.province_id))
 union select enemy.id from dorra_private.war_provinces radar join dorra_private.war_catalog_provinces a on a.id=radar.province_id
 join dorra_private.war_units enemy on enemy.match_id=mid and enemy.nation_id<>nid and enemy.health>0
 join dorra_private.war_catalog_provinces b on b.id=enemy.province_id join dorra_private.war_catalog_platforms target on target.id=enemy.platform_id
 where radar.match_id=mid and radar.nation_id=nid and coalesce((radar.facilities->>'radar')::integer,0)>0
 and abs((a.data->>'lat')::numeric-(b.data->>'lat')::numeric)<=coalesce((radar.facilities->>'radar')::integer,0)*100/110
 and not(coalesce(target.data->'capabilities','[]') ? 'submarine')
 and coalesce((target.data#>>'{stats,stealth}')::numeric,0)<=coalesce((radar.facilities->>'radar')::integer,0)*35*dorra_private.war_ecm(mid,nid,radar.province_id)
 and dorra_private.war_distance(radar.province_id,enemy.province_id)<=coalesce((radar.facilities->>'radar')::integer,0)*100
 ) select u.* from dorra_private.war_units u join visible_ids v on v.id=u.id
$$;

-- A friendly airfield or a carrier with fewer than eight parked air formations.
create function dorra_private.war_air_basing(mid uuid,nid text,pid text,except_unit uuid default null) returns jsonb
language plpgsql stable set search_path='' as $$
declare carrier uuid;
begin
 if exists(select 1 from dorra_private.war_provinces p where p.match_id=mid and p.province_id=pid and (p.nation_id=nid or dorra_private.war_relation(mid,nid,p.nation_id)='alliance') and coalesce((p.facilities->>'air-base')::integer,0)>0) then return jsonb_build_object('provinceId',pid);end if;
 select u.id into carrier from dorra_private.war_units u join dorra_private.war_catalog_platforms p on p.id=u.platform_id
 where u.match_id=mid and u.province_id=pid and u.health>0 and u.domain='sea' and (u.nation_id=nid or dorra_private.war_relation(mid,nid,u.nation_id)='alliance')
 and (coalesce(p.data->'capabilities','[]') ? 'air-base-at-sea' or coalesce(p.data->'capabilities','[]') ? 'carrier')
 and (except_unit is null or exists(select 1 from dorra_private.war_units aircraft join dorra_private.war_catalog_platforms airframe on airframe.id=aircraft.platform_id where aircraft.id=except_unit and aircraft.match_id=mid and coalesce(airframe.data->'carrierOperators','[]') ? aircraft.nation_id))
 and (select count(*) from dorra_private.war_units parked where parked.match_id=mid and parked.domain='air' and (parked.base_carrier_id=u.id or parked.orders->>'landingCarrierId'=u.id::text) and parked.id is distinct from except_unit)<8
 order by u.id limit 1;
 if carrier is not null then return jsonb_build_object('provinceId',pid,'carrierId',carrier);end if;
 return null;
end $$;

-- Keep the reviewed land/sea routing implementation behind an air-operations
-- wrapper while preserving the public function's OID for existing call sites.
do $$declare definition text;begin
 definition:=pg_get_functiondef('dorra_private.war_schedule_move(uuid,uuid,text,text,numeric,jsonb)'::regprocedure);
 if strpos(definition,'FUNCTION dorra_private.war_schedule_move(')=0 then raise exception 'air routing core patch did not match';end if;
 execute replace(definition,'FUNCTION dorra_private.war_schedule_move(','FUNCTION dorra_private.war_schedule_move_core(');
end $$;

create or replace function dorra_private.war_schedule_move(mid uuid,uid uuid,target text,kind text,gt numeric,waypoints jsonb default '[]') returns void
language plpgsql set search_path='' as $$
declare u dorra_private.war_units;home jsonb;destination jsonb;old_carrier uuid;
begin
 select * into u from dorra_private.war_units where id=uid and match_id=mid for update;
 if not found then raise exception 'UNIT_UNAVAILABLE';end if;
 if u.domain='air' then
 home:=dorra_private.war_air_basing(mid,u.nation_id,u.province_id,u.id);
 if kind<>'retreat' and home is null then raise exception 'AIR_BASE_REQUIRED';end if;
 if kind='embark' then raise exception 'INVALID_ORDER';end if;
 if kind in('move','retreat') then
 destination:=dorra_private.war_air_basing(mid,u.nation_id,target,u.id);
 if destination is null then raise exception 'AIR_BASE_REQUIRED';end if;
 end if;
 old_carrier:=u.base_carrier_id;
 end if;
 perform dorra_private.war_schedule_move_core(mid,uid,target,kind,gt,waypoints);
 update dorra_private.war_units set entrenchment=0,base_carrier_id=null where id=uid;
 if u.domain='air' then
 update dorra_private.war_units set orders=orders||jsonb_build_object('airMission',kind in('attack','patrol','intercept','bombard'),'homeProvinceId',u.province_id,'homeCarrierId',coalesce(old_carrier,(home->>'carrierId')::uuid),'landingCarrierId',(destination->>'carrierId')::uuid) where id=uid;
 end if;
end $$;

-- Called at arrival after the final route edge. Sorties stay on station for one
-- combat pulse, then return to their airfield or the carrier's current position.
create function dorra_private.war_air_arrival(mid uuid,uid uuid,gt numeric,previous_orders jsonb) returns void
language plpgsql set search_path='' as $$
declare u dorra_private.war_units;carrier uuid;basing jsonb;
begin
 select * into u from dorra_private.war_units where id=uid and match_id=mid;
 if not found or u.domain<>'air' then return;end if;
 if u.orders->>'legTarget' is not null then return;end if;
 if coalesce((previous_orders->>'airMission')::boolean,false) then
 update dorra_private.war_units set orders=previous_orders||jsonb_build_object('type',case when previous_orders->>'type' in('attack','bombard') then 'bombard' else previous_orders->>'type' end,'targetProvinceId',u.province_id,'sortie',true,'returnDue',gt+3600)-'legTarget'-'arrival'-'path' where id=uid;
 insert into dorra_private.war_events(match_id,kind,due,payload) values(mid,'air-return',gt+3600,jsonb_build_object('unitId',uid,'generation',u.generation));
 else
 carrier:=(previous_orders->>'landingCarrierId')::uuid;
 basing:=dorra_private.war_air_basing(mid,u.nation_id,u.province_id,u.id);
 if basing is null or (carrier is not null and not exists(select 1 from dorra_private.war_units where id=carrier and match_id=mid and province_id=u.province_id and health>0)) then
 update dorra_private.war_units set orders=previous_orders||jsonb_build_object('sortie',true,'homeCarrierId',coalesce(carrier,(previous_orders->>'homeCarrierId')::uuid)) where id=uid;
 perform dorra_private.war_air_return(mid,uid,u.generation,gt);
 else update dorra_private.war_units set base_carrier_id=(basing->>'carrierId')::uuid,orders='{}' where id=uid;end if;
 end if;
end $$;

create function dorra_private.war_air_return(mid uuid,uid uuid,expected_generation integer,gt numeric) returns void
language plpgsql set search_path='' as $$
declare u dorra_private.war_units;destination text;candidate record;home_carrier uuid;started boolean:=false;
begin
 select * into u from dorra_private.war_units where id=uid and match_id=mid for update;
 if not found or u.generation<>expected_generation or not coalesce((u.orders->>'sortie')::boolean,false) then return;end if;
 home_carrier:=(u.orders->>'homeCarrierId')::uuid;
 if home_carrier is not null then select province_id into destination from dorra_private.war_units where id=home_carrier and match_id=mid and health>0;else destination:=u.orders->>'homeProvinceId';end if;
 for candidate in select pid from (
 select destination pid,0 priority where destination is not null
 union all select p.province_id,1 from dorra_private.war_provinces p where p.match_id=mid and (p.nation_id=u.nation_id or dorra_private.war_relation(mid,u.nation_id,p.nation_id)='alliance') and coalesce((p.facilities->>'air-base')::integer,0)>0
 union all select carrier.province_id,2 from dorra_private.war_units carrier join dorra_private.war_catalog_platforms p on p.id=carrier.platform_id where carrier.match_id=mid and carrier.health>0 and carrier.domain='sea' and (carrier.nation_id=u.nation_id or dorra_private.war_relation(mid,u.nation_id,carrier.nation_id)='alliance') and coalesce(p.data->'capabilities','[]') ? 'air-base-at-sea'
 ) bases where pid is not null order by priority,dorra_private.war_distance(u.province_id,pid) limit 8 loop
 if dorra_private.war_air_basing(mid,u.nation_id,candidate.pid,u.id) is null then continue;end if;
 if candidate.pid=u.province_id then update dorra_private.war_units set orders='{}',base_carrier_id=(dorra_private.war_air_basing(mid,u.nation_id,candidate.pid,u.id)->>'carrierId')::uuid where id=uid;started:=true;exit;end if;
 begin perform dorra_private.war_schedule_move(mid,uid,candidate.pid,'retreat',gt);started:=true;exit;
 exception when sqlstate 'P0001' then if sqlerrm not in('OUT_OF_RANGE','AIR_BASE_REQUIRED','INSUFFICIENT_RESOURCES','BORDER_CLOSED') then raise;end if;end;
 end loop;
 if not started then delete from dorra_private.war_units where id=uid;perform dorra_private.war_report(mid,u.nation_id,gt,jsonb_build_object('type','aircraft-lost','provinceId',u.province_id,'reason','No reachable operational base or return fuel'));end if;
end $$;

-- Bound field repair work to 32 damaged formations per hourly combat pulse.
-- Engineers entrench same-province idle defenders; moving removes the bonus.
create function dorra_private.war_field_support(mid uuid) returns void
language plpgsql set search_path='' as $$
declare damaged record;available numeric;cost numeric;
begin
 update dorra_private.war_units u set entrenchment=least(20,u.entrenchment+2)
 where u.match_id=mid and u.domain='land' and u.orders='{}' and u.entrenchment<20
 and exists(select 1 from dorra_private.war_units engineer join dorra_private.war_catalog_platforms p on p.id=engineer.platform_id where engineer.match_id=mid and engineer.nation_id=u.nation_id and engineer.province_id=u.province_id and engineer.health>0 and coalesce(p.data->'capabilities','[]') ? 'entrench')
 and not exists(select 1 from dorra_private.war_units enemy where enemy.match_id=mid and enemy.province_id=u.province_id and enemy.health>0 and dorra_private.war_relation(mid,u.nation_id,enemy.nation_id)='war');
 for damaged in select u.* from dorra_private.war_units u where u.match_id=mid and u.health<u.max_health and u.orders='{}'
 and exists(select 1 from dorra_private.war_units repair join dorra_private.war_catalog_platforms p on p.id=repair.platform_id where repair.match_id=mid and repair.nation_id=u.nation_id and repair.province_id=u.province_id and repair.health>0 and coalesce(p.data->'capabilities','[]') ? 'repair')
 and not exists(select 1 from dorra_private.war_units enemy where enemy.match_id=mid and enemy.province_id=u.province_id and enemy.health>0 and dorra_private.war_relation(mid,u.nation_id,enemy.nation_id)='war') order by u.health/u.max_health,u.id limit 32 loop
 cost:=ceil(least(2,damaged.max_health-damaged.health)*damaged.strength);
 select (resources->>'supplies')::numeric into available from dorra_private.war_sides where match_id=mid and nation_id=damaged.nation_id;
 if available>=cost then perform dorra_private.war_pay(mid,damaged.nation_id,jsonb_build_object('supplies',cost));update dorra_private.war_units set health=least(max_health,health+2) where id=damaged.id;end if;
 end loop;
end $$;

do $patch$
declare definition text;needle text;replacement text;
begin
 definition:=pg_get_functiondef('dorra_private.war_advance(uuid,integer)'::regprocedure);
 needle:=$old$ perform dorra_private.war_capture(mid,u.nation_id,owner,e.due);$old$;
 replacement:=$new$ if u.domain='air' then perform dorra_private.war_air_arrival(mid,u.id,e.due,u.orders);end if;
 if u.domain='sea' then update dorra_private.war_units set province_id=owner where match_id=mid and base_carrier_id=u.id and orders='{}';end if;
 perform dorra_private.war_capture(mid,u.nation_id,owner,e.due);$new$;
 if strpos(definition,needle)=0 then raise exception 'air arrival hook did not match';end if;definition:=replace(definition,needle,replacement);
 needle:=$old$ elsif e.kind='research' then$old$;
 replacement:=$new$ elsif e.kind='air-return' then
 perform dorra_private.war_air_return(mid,(e.payload->>'unitId')::uuid,(e.payload->>'generation')::integer,e.due);
 elsif e.kind='research' then$new$;
 if strpos(definition,needle)=0 then raise exception 'air return event hook did not match';end if;execute replace(definition,needle,replacement);

 definition:=pg_get_functiondef('dorra_private.war_combat(uuid,numeric)'::regprocedure);
 needle:=$old$ -- All damage is calculated before any unit is changed.$old$;
 replacement:=$new$ -- Settle actual combat participants before supply modifiers read balances.
 for front in
 with pairs as materialized(
 select a.nation_id attacker,b.nation_id defender from dorra_private.war_relations r
 join dorra_private.war_units a on a.match_id=mid and a.nation_id=r.a and a.health>0
 join dorra_private.war_units b on b.match_id=mid and b.nation_id=r.b and b.health>0
 join dorra_private.war_catalog_platforms ap on ap.id=a.platform_id
 join dorra_private.war_catalog_platforms bp on bp.id=b.platform_id
 where r.match_id=mid and r.relation='war'
 and (a.province_id=b.province_id
 or (a.orders->>'type' in('bombard','patrol','intercept') and coalesce((ap.data#>>'{stats,range}')::numeric,0)>=dorra_private.war_distance(a.province_id,b.province_id))
 or (b.orders->>'type' in('bombard','patrol','intercept') and coalesce((bp.data#>>'{stats,range}')::numeric,0)>=dorra_private.war_distance(a.province_id,b.province_id))))
 select attacker nation_id from pairs union select defender from pairs
 loop perform dorra_private.war_accrue(mid,front.nation_id,gt);end loop;
 -- All damage is calculated before any unit is changed.$new$;
 if strpos(definition,needle)=0 then raise exception 'engaged economy accrual hook did not match';end if;definition:=replace(definition,needle,replacement);
 needle:=$old$(1.1-least(100,territory.morale)/500)/(1+coalesce((territory.facilities->>'fortification')::numeric,0)*.12)*$old$;
 replacement:=$new$(1.1-least(100,territory.morale)/500)/(1+coalesce((territory.facilities->>'fortification')::numeric,0)*.12)*(1-least(20,defender.entrenchment)/100)*$new$;
 if strpos(definition,needle)=0 then raise exception 'entrenchment defence hook did not match';end if;definition:=replace(definition,needle,replacement);
 needle:=$old$ delete from dorra_private.war_units where match_id=mid and health<=0;$old$;
 replacement:=$new$ delete from dorra_private.war_units where match_id=mid and health<=0;
 perform dorra_private.war_field_support(mid);$new$;
 if strpos(definition,needle)=0 then raise exception 'field repair hook did not match';end if;execute replace(definition,needle,replacement);

 definition:=pg_get_functiondef('public.dorra_war_command(uuid,uuid,uuid,text,uuid,jsonb,uuid)'::regprocedure);
 needle:=$old$ elsif friend='bombard' then
 select nation_id$old$;
 replacement:=$new$ elsif friend='bombard' and u.domain='air' then
 perform dorra_private.war_schedule_move(mid,uid,target,'bombard',gt,coalesce(p_args->'waypoints','[]'));
 elsif friend='bombard' then
 select nation_id$new$;
 if strpos(definition,needle)=0 then raise exception 'air bombard hook did not match';end if;execute replace(definition,needle,replacement);
end $patch$;

do $$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dorra_private' and p.proname in('war_signature_detected','war_air_basing','war_schedule_move_core','war_air_arrival','war_air_return','war_field_support') loop
 execute 'revoke all on function '||f.signature||' from public,anon,authenticated';execute 'grant execute on function '||f.signature||' to service_role';end loop;
end $$;
