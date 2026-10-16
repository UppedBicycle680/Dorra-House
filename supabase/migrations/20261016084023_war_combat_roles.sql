-- Role-aware weapons and defensive missile engagements. These coefficients
-- are original scenario balance, not real technical performance claims.
alter table dorra_private.war_units add column intercept_ready_at numeric not null default 0;

create function dorra_private.war_weapon_power(weapon jsonb,target jsonb,target_orders jsonb default '{}') returns numeric
language plpgsql immutable set search_path='' as $$
declare power numeric:=coalesce((weapon#>>'{stats,attack}')::numeric,0);
 caps jsonb:=coalesce(weapon->'capabilities','[]');target_caps jsonb:=coalesce(target->'capabilities','[]');
 weapon_domain text:=weapon->>'domain';target_domain text:=target->>'domain';
begin
 if target_domain='missile' then return 0;end if;
 -- Air defence is a separate weapon value: a radar vehicle's small ground
 -- self-defence attack must not multiply a SAM's actual anti-air capability.
 if target_domain='air' then
  power:=coalesce((weapon#>>'{stats,airDefense}')::numeric,0);
  if caps ? 'air-superiority' then power:=power*1.15;end if;
  if caps ? 'anti-drone' and target_caps ?| array['isr','persistent-isr','high-altitude-isr'] then power:=power*1.2;end if;
  return greatest(0,power);
 end if;
 if power<=0 or weapon_domain='missile' then return 0;end if;
 -- Reconnaissance, command and transport entries retain their sensors and
 -- logistics effects, without acquiring a generic strike weapon.
 if weapon_domain='support' then return 0;end if;
 if target_caps ? 'submarine' then
  if caps ? 'anti-submarine' then return power*1.25;end if;
  if weapon_domain='sea' and caps ? 'sonar' then return power;end if;
  return 0;
 end if;
 if target_domain='sea' or coalesce((target_orders->>'embarked')::boolean,false) then
  if weapon_domain='sea' or caps ? 'anti-ship' or
   (weapon_domain='air' and caps ?| array['strike','multirole','precision-strike','strategic-strike']) then return power;end if;
  return 0;
 end if;
 if weapon_domain='air' and not(caps ?| array['strike','multirole','precision-strike','strategic-strike','close-support','anti-armor']) then return 0;end if;
 if weapon_domain='sea' and caps ? 'submarine' and not(caps ? 'cruise-missiles') then return 0;end if;
 if weapon_domain='sea' and caps ? 'carrier' and not(caps ? 'cruise-missiles') then return 0;end if;
 if target_caps ? 'armor' and caps ? 'anti-armor' then power:=power*1.35;end if;
 return greatest(0,power);
end $$;

create function dorra_private.war_strike_target(weapon jsonb,target jsonb,target_orders jsonb default '{}') returns boolean
language sql immutable set search_path='' as $$
 select case
 when coalesce((weapon->>'nuclear')::boolean,false) then true
 when coalesce(weapon->'capabilities','[]') ? 'interceptor' then false
 when coalesce(weapon->'capabilities','[]') ? 'anti-ship' then
  (target->>'domain'='sea' and not(coalesce(target->'capabilities','[]') ? 'submarine')) or coalesce((target_orders->>'embarked')::boolean,false)
 else target->>'domain' in('land','support')
  or (target->>'domain'='air' and target_orders='{}')
  or (target->>'domain'='missile' and coalesce(target_orders->>'type','')<>'strike') end
$$;

create function dorra_private.war_missile_targets(mid uuid,nid text,pid text,weapon jsonb,require_visible boolean default false) returns setof dorra_private.war_units
language sql stable set search_path='' as $$
 select u.* from dorra_private.war_units u join dorra_private.war_catalog_platforms p on p.id=u.platform_id
 where u.match_id=mid and u.province_id=pid and u.health>0
 and (coalesce((weapon->>'nuclear')::boolean,false) or dorra_private.war_relation(mid,nid,u.nation_id)='war')
 and dorra_private.war_strike_target(weapon,p.data,u.orders)
 and (not require_visible or dorra_private.war_vision(mid,nid,u))
$$;

create function dorra_private.war_resolve_strike(mid uuid,uid uuid,expected_generation integer,pid text,gt numeric) returns void
language plpgsql set search_path='' as $$
declare projectile dorra_private.war_units;weapon jsonb;victim_owner text;defender record;victim record;surface_target uuid;
 power numeric;defence numeric:=0;is_nuclear boolean;is_anti_ship boolean;
begin
 select * into projectile from dorra_private.war_units where id=uid and match_id=mid for update;
 if not found or projectile.generation<>expected_generation or projectile.orders->>'type' is distinct from 'strike' then return;end if;
 select data into weapon from dorra_private.war_catalog_platforms where id=projectile.platform_id;
 select nation_id into victim_owner from dorra_private.war_provinces where match_id=mid and province_id=pid;
 if weapon is null or victim_owner is null then return;end if;
 if coalesce(weapon->'capabilities','[]') ? 'interceptor' then
  update dorra_private.war_units set orders='{}' where id=uid;
  perform dorra_private.war_report(mid,projectile.nation_id,gt,jsonb_build_object('type','strike-cancelled','provinceId',pid,'reason','Defensive interceptor'));
  return;
 end if;
 is_nuclear:=coalesce((weapon->>'nuclear')::boolean,false);
 is_anti_ship:=coalesce(weapon->'capabilities','[]') ? 'anti-ship' and not is_nuclear;
 power:=coalesce((weapon#>>'{stats,attack}')::numeric,60)*projectile.strength;
 if is_anti_ship then
  select t.id into surface_target from dorra_private.war_missile_targets(mid,projectile.nation_id,pid,weapon) t
  where projectile.orders->>'targetUnitId' is null or t.id::text=projectile.orders->>'targetUnitId'
  order by t.health desc,t.id limit 1;
 end if;
 -- The war must still exist at impact. A negotiated peace stops an old queued
 -- land strike; an anti-ship missile needs a surviving hostile surface target.
 if (not is_anti_ship and dorra_private.war_relation(mid,projectile.nation_id,victim_owner)<>'war') or
  (is_anti_ship and surface_target is null) then
  perform dorra_private.war_report(mid,projectile.nation_id,gt,jsonb_build_object('type','strike-missed','provinceId',pid,'reason','No remaining hostile target'));
  delete from dorra_private.war_units where id=uid;return;
 end if;
 -- Only the threatened nation, its allies, or an actually threatened formation
 -- can supply countermeasures. Unrelated neutral radars cannot intercept.
 for defender in
 select d.*,p.data platform_data from dorra_private.war_units d join dorra_private.war_catalog_platforms p on p.id=d.platform_id
 where d.match_id=mid and d.nation_id<>projectile.nation_id and d.health>0 and d.intercept_ready_at<=gt
 and (d.orders='{}' or d.orders->>'type'='intercept')
 and (d.nation_id=victim_owner or dorra_private.war_relation(mid,d.nation_id,victim_owner)='alliance'
  or exists(select 1 from dorra_private.war_missile_targets(mid,projectile.nation_id,pid,weapon) threatened where threatened.nation_id=d.nation_id and (not is_anti_ship or threatened.id=surface_target)))
 and (coalesce(p.data->'capabilities','[]') ? 'missile-defense' or (not is_nuclear and coalesce(p.data->'capabilities','[]') ? 'point-defense'))
 and coalesce((p.data#>>'{stats,airDefense}')::numeric,0)>0
 and dorra_private.war_distance(d.province_id,pid)<=coalesce((p.data#>>'{stats,range}')::numeric,0)
 and (not(coalesce(p.data->'capabilities','[]') ? 'interceptor') or (d.orders->>'type'='intercept' and d.orders->>'targetProvinceId'=pid))
 order by dorra_private.war_distance(d.province_id,pid),d.id limit 32
 loop
  defence:=defence+coalesce((defender.platform_data#>>'{stats,airDefense}')::numeric,0)*defender.strength*(defender.health/defender.max_health);
  if coalesce(defender.platform_data->'capabilities','[]') ? 'interceptor' then delete from dorra_private.war_units where id=defender.id;
  else update dorra_private.war_units set intercept_ready_at=gt+3600 where id=defender.id;end if;
  perform dorra_private.war_report(mid,defender.nation_id,gt,jsonb_build_object('type','missile-defense','provinceId',pid,'singleUse',coalesce(defender.platform_data->'capabilities','[]') ? 'interceptor'));
  exit when defence>=power;
 end loop;
 if defence>=power then
  perform dorra_private.war_report(mid,projectile.nation_id,gt,jsonb_build_object('type','strike-intercepted','provinceId',pid));
 else
  for victim in
  select u.* from dorra_private.war_units u join dorra_private.war_catalog_platforms p on p.id=u.platform_id
  where u.match_id=mid and u.province_id=pid and u.id<>uid and u.health>0
   and (is_nuclear or (dorra_private.war_relation(mid,projectile.nation_id,u.nation_id)='war' and dorra_private.war_strike_target(weapon,p.data,u.orders) and (not is_anti_ship or u.id=surface_target)))
  loop
   update dorra_private.war_units set health=greatest(0,health-power) where id=victim.id;
   perform dorra_private.war_report(mid,victim.nation_id,gt,jsonb_build_object('type','strategic-strike','provinceId',pid,'damage',least(victim.health,power),'nuclear',is_nuclear,'collateral',is_nuclear and dorra_private.war_relation(mid,projectile.nation_id,victim.nation_id)<>'war'));
  end loop;
  if not is_anti_ship then
   update dorra_private.war_provinces set morale=greatest(0,morale-case when is_nuclear then 60 else 20 end),radiation_until=case when is_nuclear then gt+259200 else radiation_until end where match_id=mid and province_id=pid;
  end if;
  perform dorra_private.war_report(mid,projectile.nation_id,gt,jsonb_build_object('type','strike-resolved','provinceId',pid,'nuclear',is_nuclear));
 end if;
 delete from dorra_private.war_units where id=uid or (match_id=mid and health<=0);
end $$;

do $patch$
declare definition text;needle text;replacement text;start_at integer;end_at integer;
begin
 definition:=pg_get_functiondef('dorra_private.war_combat(uuid,numeric)'::regprocedure);
 needle:=$old$sum(greatest(1,coalesce((ap.data#>>'{stats,attack}')::numeric,8)*attacker.strength*$old$;
 replacement:=$new$sum(greatest(0,dorra_private.war_weapon_power(ap.data,dp.data,defender.orders)*attacker.strength*$new$;
 if strpos(definition,needle)=0 then raise exception 'combat role power patch did not match';end if;definition:=replace(definition,needle,replacement);
 needle:=$old$case when defender.domain='air' then greatest(.05,coalesce((ap.data#>>'{stats,airDefense}')::numeric,0)*dorra_private.war_ecm(mid,attacker.nation_id,attacker.province_id)/20) else 1 end$old$;
 replacement:=$new$case when defender.domain='air' then dorra_private.war_ecm(mid,attacker.nation_id,attacker.province_id) else 1 end$new$;
 if strpos(definition,needle)=0 then raise exception 'combat anti-air power patch did not match';end if;definition:=replace(definition,needle,replacement);
 needle:=$old$ and dorra_private.war_vision(mid,attacker.nation_id,defender)$old$;
 replacement:=$new$ and (attacker.orders->>'type' is distinct from 'intercept' or (defender.domain='air' and attacker.orders->>'targetProvinceId'=defender.province_id))
 and dorra_private.war_weapon_power(ap.data,dp.data,defender.orders)>0
 and dorra_private.war_vision(mid,attacker.nation_id,defender)$new$;
 if strpos(definition,needle)=0 then raise exception 'combat role eligibility patch did not match';end if;execute replace(definition,needle,replacement);

 definition:=pg_get_functiondef('dorra_private.war_advance(uuid,integer)'::regprocedure);
 start_at:=strpos(definition,$needle$ elsif e.kind='strike' then$needle$);
 end_at:=strpos(definition,$needle$ elsif e.kind='combat' then$needle$);
 if start_at=0 or end_at<=start_at then raise exception 'missile resolution hook did not match';end if;
 definition:=substr(definition,1,start_at-1)||$new$ elsif e.kind='strike' then
 perform dorra_private.war_resolve_strike(mid,(e.payload->>'unitId')::uuid,(e.payload->>'generation')::integer,e.payload->>'targetProvinceId',e.due);
$new$||substr(definition,end_at);execute definition;

 definition:=pg_get_functiondef('public.dorra_war_command(uuid,uuid,uuid,text,uuid,jsonb,uuid)'::regprocedure);
 needle:=$old$ if u.domain='missile' then
 select nation_id$old$;
 replacement:=$new$ if friend='intercept' and u.domain<>'air' then
 if not(coalesce(cost->'capabilities','[]') ? 'interceptor') and coalesce((cost#>>'{stats,airDefense}')::numeric,0)<=0 then raise exception 'INVALID_TARGET_CLASS';end if;
 select nation_id into other from dorra_private.war_provinces where match_id=mid and province_id=target;
 if other is null then raise exception 'INVALID_DESTINATION';end if;
 if other<>nid and dorra_private.war_relation(mid,nid,other)<>'alliance' then raise exception 'DEFEND_FRIENDLY';end if;
 if u.orders<>'{}' and u.orders->>'type'<>'intercept' then raise exception 'UNIT_BUSY';end if;
 if dorra_private.war_distance(u.province_id,target)>coalesce((cost#>>'{stats,range}')::numeric,0) then raise exception 'OUT_OF_RANGE';end if;
 update dorra_private.war_units set orders=jsonb_build_object('type','intercept','targetProvinceId',target),generation=generation+1 where id=uid;
 elsif u.domain='missile' then
 if coalesce(cost->'capabilities','[]') ? 'interceptor' then raise exception 'INTERCEPTOR_DEFENSIVE_ONLY';end if;
 select nation_id$new$;
 if strpos(definition,needle)=0 then raise exception 'defensive intercept order hook did not match';end if;definition:=replace(definition,needle,replacement);
 needle:=$old$ if friend not in('attack','bombard') or dorra_private.war_relation(mid,nid,other)<>'war' then raise exception 'DECLARE_WAR_FIRST';end if;$old$;
 replacement:=$new$ if friend not in('attack','bombard') then raise exception 'INVALID_ORDER';end if;
 if coalesce(cost->'capabilities','[]') ? 'anti-ship' and not coalesce((cost->>'nuclear')::boolean,false) then
 if not exists(select 1 from dorra_private.war_missile_targets(mid,nid,target,cost,true) t where p_args->>'targetUnitId' is null or t.id::text=p_args->>'targetUnitId') then raise exception 'NO_VALID_TARGET';end if;
 elsif dorra_private.war_relation(mid,nid,other)<>'war' then raise exception 'DECLARE_WAR_FIRST';end if;$new$;
 if strpos(definition,needle)=0 then raise exception 'anti-ship launch target hook did not match';end if;execute replace(definition,needle,replacement);
 definition:=pg_get_functiondef('public.dorra_war_command(uuid,uuid,uuid,text,uuid,jsonb,uuid)'::regprocedure);
 needle:=$old$ orders=jsonb_build_object('type','strike','targetProvinceId',target),generation=generation+1$old$;
 replacement:=$new$ orders=jsonb_build_object('type','strike','targetProvinceId',target,'targetUnitId',case when coalesce(cost->'capabilities','[]') ? 'anti-ship' and not coalesce((cost->>'nuclear')::boolean,false) then
 (select t.id from dorra_private.war_missile_targets(mid,nid,target,cost,true) t where p_args->>'targetUnitId' is null or t.id::text=p_args->>'targetUnitId' order by t.health desc,t.id limit 1) else null end),generation=generation+1$new$;
 if strpos(definition,needle)=0 then raise exception 'anti-ship formation lock hook did not match';end if;execute replace(definition,needle,replacement);

 -- Combat missions use the catalogue's operational radius. Base transfers can
 -- use the separate two-radius ferry allowance; a sortie cannot spend it twice.
 definition:=pg_get_functiondef('dorra_private.war_schedule_move_core(uuid,uuid,text,text,numeric,jsonb)'::regprocedure);
 needle:=$old$ if u.orders<>'{}'::jsonb and kind<>'retreat' then raise exception 'UNIT_BUSY';end if;$old$;
 replacement:=$new$ if u.orders<>'{}'::jsonb and kind<>'retreat' and not(u.domain<>'air' and u.orders->>'type'='intercept') then raise exception 'UNIT_BUSY';end if;$new$;
 if strpos(definition,needle)=0 then raise exception 'defensive stance movement patch did not match';end if;definition:=replace(definition,needle,replacement);
 needle:=$old$ if u.domain='air' and dist>coalesce((p#>>'{stats,range}')::numeric,1500)*2 then raise exception 'OUT_OF_RANGE';end if;$old$;
 replacement:=$new$ if u.domain='air' and dist>coalesce((p#>>'{stats,range}')::numeric,1500)*(case when kind in('move','retreat') then 2 else 1 end) then raise exception 'OUT_OF_RANGE';end if;$new$;
 if strpos(definition,needle)=0 then raise exception 'sortie radius patch did not match';end if;definition:=replace(definition,needle,replacement);
 needle:=$old$ if kind in('attack','bombard','intercept') and dorra_private.war_relation(mid,u.nation_id,dest_owner)<>'war' then raise exception 'DECLARE_WAR_FIRST';end if;$old$;
 replacement:=$new$ if kind in('attack','bombard') and dorra_private.war_relation(mid,u.nation_id,dest_owner)<>'war' then raise exception 'DECLARE_WAR_FIRST';end if;
 if kind='intercept' and dest_owner<>u.nation_id and dorra_private.war_relation(mid,u.nation_id,dest_owner) not in('war','alliance') then raise exception 'BORDER_CLOSED';end if;$new$;
 if strpos(definition,needle)=0 then raise exception 'friendly air intercept route patch did not match';end if;execute replace(definition,needle,replacement);

 definition:=pg_get_functiondef('dorra_private.war_schedule_move(uuid,uuid,text,text,numeric,jsonb)'::regprocedure);
 needle:=$old$ if kind='embark' then raise exception 'INVALID_ORDER';end if;$old$;
 replacement:=$new$ if kind='embark' then raise exception 'INVALID_ORDER';end if;
 if kind='intercept' and not exists(select 1 from dorra_private.war_catalog_platforms p where p.id=u.platform_id and coalesce((p.data#>>'{stats,airDefense}')::numeric,0)>0) then raise exception 'INVALID_TARGET_CLASS';end if;
 if kind='intercept' and target=u.province_id then
 if u.orders<>'{}' then raise exception 'UNIT_BUSY';end if;
 perform dorra_private.war_pay(mid,u.nation_id,jsonb_build_object('fuel',20*u.strength));
 update dorra_private.war_units set generation=generation+1,base_carrier_id=null,entrenchment=0,
 orders=jsonb_build_object('type','intercept','targetProvinceId',target,'airMission',true,'sortie',true,'homeProvinceId',province_id,'homeCarrierId',coalesce(base_carrier_id,(home->>'carrierId')::uuid),'returnDue',gt+3600)
 where id=uid returning * into u;
 insert into dorra_private.war_events(match_id,kind,due,payload) values(mid,'air-return',gt+3600,jsonb_build_object('unitId',uid,'generation',u.generation));
 return;
 end if;$new$;
 if strpos(definition,needle)=0 then raise exception 'local air intercept launch patch did not match';end if;execute replace(definition,needle,replacement);
end $patch$;

do $$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dorra_private' and p.proname in('war_weapon_power','war_strike_target','war_missile_targets','war_resolve_strike') loop
 execute 'revoke all on function '||f.signature||' from public,anon,authenticated';
 execute 'grant execute on function '||f.signature||' to service_role';
 end loop;
end $$;
