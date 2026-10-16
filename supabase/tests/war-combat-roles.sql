-- Real catalogue + transactional weapon-role and countermeasure regressions.
-- All formations, fixture accounts and commands roll back.
begin;
insert into auth.users(id,raw_user_meta_data) values
 ('f4100000-0000-4000-8000-000000000001','{"username":"war_roles_us_fixture"}'),
 ('f4100000-0000-4000-8000-000000000002','{"username":"war_roles_fr_fixture"}');
do $$begin
 if not exists(select 1 from dorra_private.profiles where user_id='f4100000-0000-4000-8000-000000000001') then
 insert into dorra_private.profiles(user_id) values('f4100000-0000-4000-8000-000000000001'),('f4100000-0000-4000-8000-000000000002');end if;
end $$;
insert into auth.sessions(id,user_id) values
 ('f4200000-0000-4000-8000-000000000001','f4100000-0000-4000-8000-000000000001'),
 ('f4200000-0000-4000-8000-000000000002','f4100000-0000-4000-8000-000000000002');
insert into dorra_private.player_state(user_id,auth_session_id,lease_id,snapshot) values
 ('f4100000-0000-4000-8000-000000000001','f4200000-0000-4000-8000-000000000001','f4300000-0000-4000-8000-000000000001','{"balance":1000,"progress":{}}'),
 ('f4100000-0000-4000-8000-000000000002','f4200000-0000-4000-8000-000000000002','f4300000-0000-4000-8000-000000000002','{"balance":1000,"progress":{}}');
insert into dorra_private.war_catalog_provinces(id,country_id,name,data) values
 ('__roles-us','US','Role fixture US','{"lat":0,"lng":0,"city":true,"capital":false,"port":true,"terrain":"plains","neighbors":["__roles-fr"]}'),
 ('__roles-fr','FR','Role fixture France','{"lat":0,"lng":0.1,"city":true,"capital":false,"port":true,"terrain":"plains","neighbors":["__roles-us"]}'),
 ('__roles-far-us','US','Role fixture US distant airfield','{"lat":0,"lng":4,"port":false,"terrain":"plains","neighbors":[]}'),
 ('__roles-far-fr','FR','Role fixture France distant target','{"lat":0,"lng":4.1,"port":false,"terrain":"plains","neighbors":[]}');

create function pg_temp.role_formation(mid uuid,nid text,pid text,platform text,unit_orders jsonb default '{}') returns uuid
language plpgsql as $$declare uid uuid;begin
 insert into dorra_private.war_units(match_id,nation_id,province_id,platform_id,name,domain,orders,generation)
 select mid,nid,pid,p.id,p.name,p.data->>'domain',unit_orders,1 from dorra_private.war_catalog_platforms p where p.id=platform returning id into uid;
 assert uid is not null,'regression uses a real catalogue platform';return uid;
end $$;

do $test$
declare actor uuid:='f4100000-0000-4000-8000-000000000001';sid uuid:='f4200000-0000-4000-8000-000000000001';lease uuid:='f4300000-0000-4000-8000-000000000001';
 rival uuid:='f4100000-0000-4000-8000-000000000002';rival_sid uuid:='f4200000-0000-4000-8000-000000000002';rival_lease uuid:='f4300000-0000-4000-8000-000000000002';
 mid uuid:=gen_random_uuid();infantry uuid;submarine uuid;ship uuid;other_ship uuid;neutral uuid;friendly uuid;land_target uuid;projectile uuid;interceptor uuid;aircraft uuid;
 weapon jsonb;target jsonb;armour jsonb;soft_target jsonb;old_morale numeric;
begin
 insert into dorra_private.war_matches(id,name,host_id,status,template,opponent,pace,visibility,speed,limit_seconds,real_anchor,last_dispatch)
 values(mid,'Weapon role regression',actor,'running','world','human','persistent','invite',4,2592000,clock_timestamp(),clock_timestamp());
 insert into dorra_private.war_sides(match_id,nation_id,user_id,resources) values
  (mid,'US',actor,'{"cash":100000,"supplies":100000,"fuel":100000,"electronics":100000,"manpower":100000}'),
  (mid,'FR',rival,'{"cash":100000,"supplies":100000,"fuel":100000,"electronics":100000,"manpower":100000}'),
  (mid,'RU',null,'{"cash":100000,"supplies":100000,"fuel":100000,"electronics":100000,"manpower":100000}');
 insert into dorra_private.war_provinces(match_id,province_id,nation_id,morale,facilities) values
  (mid,'__roles-us','US',80,'{"air-base":1,"army-base":3}'),(mid,'__roles-fr','FR',80,'{"air-base":1,"army-base":3}'),
  (mid,'__roles-far-us','US',80,'{"air-base":1}'),(mid,'__roles-far-fr','FR',80,'{}');
 insert into dorra_private.war_relations(match_id,a,b,relation) values(mid,'FR','US','war');
 insert into dorra_private.war_observers(match_id,user_id) values(mid,actor),(mid,rival);

 select data into weapon from dorra_private.war_catalog_platforms where id='infantry-company';
 select data into target from dorra_private.war_catalog_platforms where id='scorpene';
 assert dorra_private.war_weapon_power(weapon,target)=0,'infantry cannot fire generic attack at a submarine';
 select data into weapon from dorra_private.war_catalog_platforms where id='arleigh-burke';
 assert dorra_private.war_weapon_power(weapon,target)>0,'an ASW destroyer can engage a detected submarine';
 select data into target from dorra_private.war_catalog_platforms where id='f16';
 select data into weapon from dorra_private.war_catalog_platforms where id='patriot';
 assert dorra_private.war_weapon_power(weapon,target)=60,'SAM uses its actual anti-air stat, not its small ground self-defence stat';
 select data into target from dorra_private.war_catalog_platforms where id='infantry-company';
 select data into weapon from dorra_private.war_catalog_platforms where id='rq4-global-hawk';
 assert dorra_private.war_weapon_power(weapon,target)=0,'unarmed reconnaissance causes no minimum chip damage';
 select data into weapon from dorra_private.war_catalog_platforms where id='e7-wedgetail';
 assert dorra_private.war_weapon_power(weapon,target)=0,'airborne command radar is not a strike aircraft';
 select data into weapon from dorra_private.war_catalog_platforms where id='f22';
 assert dorra_private.war_weapon_power(weapon,target)=0,'an air-superiority-only programme cannot bomb ground formations';
 select data into weapon from dorra_private.war_catalog_platforms where id='ah64-apache';
 select data into armour from dorra_private.war_catalog_platforms where id='m1a2-abrams';
 select data into soft_target from dorra_private.war_catalog_platforms where id='bushmaster';
 assert dorra_private.war_weapon_power(weapon,armour)>dorra_private.war_weapon_power(weapon,soft_target),'anti-armour capability produces a real target-specific bonus';

 aircraft:=pg_temp.role_formation(mid,'US','__roles-us','f16');
 perform public.dorra_war_command(actor,sid,lease,'order',mid,jsonb_build_object('unitIds',jsonb_build_array(aircraft),'type','intercept','targetProvinceId','__roles-us'),gen_random_uuid());
 assert (select orders->>'type'='intercept' and (orders->>'sortie')::boolean from dorra_private.war_units where id=aircraft),'fighters can launch a defensive sortie over their own airfield';
 assert exists(select 1 from dorra_private.war_events where match_id=mid and kind='air-return' and payload->>'unitId'=aircraft::text),'same-base defensive sortie retains the automatic return cycle';
 aircraft:=pg_temp.role_formation(mid,'US','__roles-us','f16');
 perform dorra_private.war_schedule_move(mid,aircraft,'__roles-far-us','intercept',0);
 assert (select orders->>'targetProvinceId'='__roles-far-us' from dorra_private.war_units where id=aircraft),'fighters can intercept over friendly territory without declaring war on themselves';
 aircraft:=pg_temp.role_formation(mid,'US','__roles-us','ah64-apache');
 begin
 perform dorra_private.war_schedule_move(mid,aircraft,'__roles-far-fr','attack',0);
 raise exception 'Expected OUT_OF_RANGE';exception when others then assert sqlerrm='OUT_OF_RANGE','combat sorties cannot spend the two-radius ferry allowance';end;
 perform dorra_private.war_schedule_move(mid,aircraft,'__roles-far-us','move',0);
 assert (select orders->>'targetProvinceId'='__roles-far-us' from dorra_private.war_units where id=aircraft),'one-way airbase transfer retains its separate ferry allowance';
 aircraft:=pg_temp.role_formation(mid,'US','__roles-us','e7-wedgetail');
 begin
 perform dorra_private.war_schedule_move(mid,aircraft,'__roles-us','intercept',0);
 raise exception 'Expected INVALID_TARGET_CLASS';exception when others then assert sqlerrm='INVALID_TARGET_CLASS','unarmed airborne radar cannot perform an armed intercept';end;
 interceptor:=pg_temp.role_formation(mid,'US','__roles-us','patriot');
 perform public.dorra_war_command(actor,sid,lease,'order',mid,jsonb_build_object('unitIds',jsonb_build_array(interceptor),'type','intercept','targetProvinceId','__roles-us'),gen_random_uuid());
 perform dorra_private.war_schedule_move(mid,interceptor,'__roles-fr','move',0);
 assert (select orders->>'type'='move' from dorra_private.war_units where id=interceptor),'stationary air defence can leave its stance to reposition';
 delete from dorra_private.war_units where match_id=mid;delete from dorra_private.war_events where match_id=mid;

 infantry:=pg_temp.role_formation(mid,'US','__roles-us','infantry-company');
 submarine:=pg_temp.role_formation(mid,'FR','__roles-us','scorpene');
 perform dorra_private.war_combat(mid,0);
 assert (select health=100 from dorra_private.war_units where id=submarine),'combat integration preserves submarine immunity to infantry';
 ship:=pg_temp.role_formation(mid,'US','__roles-us','arleigh-burke');
 perform dorra_private.war_combat(mid,3600);
 assert (select health<100 from dorra_private.war_units where id=submarine),'combat integration applies ASW damage';
 delete from dorra_private.war_units where match_id=mid;

 infantry:=pg_temp.role_formation(mid,'US','__roles-us','infantry-company');
 begin
 perform public.dorra_war_command(actor,sid,lease,'order',mid,jsonb_build_object('unitIds',jsonb_build_array(infantry),'type','intercept','targetProvinceId','__roles-us'),gen_random_uuid());
 raise exception 'Expected INVALID_TARGET_CLASS';exception when others then assert sqlerrm='INVALID_TARGET_CLASS','unarmed ground formations cannot adopt an anti-air intercept stance';end;
 projectile:=pg_temp.role_formation(mid,'US','__roles-us','naval-strike-missile');
 land_target:=pg_temp.role_formation(mid,'FR','__roles-fr','leclerc');
 begin
 perform public.dorra_war_command(actor,sid,lease,'order',mid,jsonb_build_object('unitIds',jsonb_build_array(projectile),'type','attack','targetProvinceId','__roles-fr'),gen_random_uuid());
 raise exception 'Expected NO_VALID_TARGET';exception when others then assert sqlerrm='NO_VALID_TARGET','anti-ship weapons reject ground-only targets';end;
 interceptor:=pg_temp.role_formation(mid,'FR','__roles-fr','aster30');
 begin
 perform public.dorra_war_command(rival,rival_sid,rival_lease,'order',mid,jsonb_build_object('unitIds',jsonb_build_array(interceptor),'type','bombard','targetProvinceId','__roles-us'),gen_random_uuid());
 raise exception 'Expected INTERCEPTOR_DEFENSIVE_ONLY';exception when others then assert sqlerrm='INTERCEPTOR_DEFENSIVE_ONLY','interceptors cannot bombard ground';end;
 begin
 perform public.dorra_war_command(rival,rival_sid,rival_lease,'order',mid,jsonb_build_object('unitIds',jsonb_build_array(interceptor),'type','intercept','targetProvinceId','__roles-us'),gen_random_uuid());
 raise exception 'Expected DEFEND_FRIENDLY';exception when others then assert sqlerrm='DEFEND_FRIENDLY','a defensive stance cannot protect a hostile province';end;
 perform public.dorra_war_command(rival,rival_sid,rival_lease,'order',mid,jsonb_build_object('unitIds',jsonb_build_array(interceptor),'type','intercept','targetProvinceId','__roles-fr'),gen_random_uuid());
 assert (select orders->>'type'='intercept' from dorra_private.war_units where id=interceptor),'interceptor deploys as a defensive stance';
 ship:=pg_temp.role_formation(mid,'FR','__roles-fr','fremm');
 friendly:=pg_temp.role_formation(mid,'US','__roles-fr','infantry-company');
 perform public.dorra_war_command(actor,sid,lease,'order',mid,jsonb_build_object('unitIds',jsonb_build_array(projectile),'type','attack','targetProvinceId','__roles-fr'),gen_random_uuid());
 assert (select orders->>'targetUnitId'=ship::text from dorra_private.war_units where id=projectile),'anti-ship launch locks one visible hostile formation';
 perform dorra_private.war_resolve_strike(mid,projectile,2,'__roles-fr',3601);
 assert not exists(select 1 from dorra_private.war_units where id in(projectile,interceptor)),'a successful single-use interception consumes both missiles';
 assert (select health=100 from dorra_private.war_units where id=ship),'successful intercept protects its threatened ship';

 neutral:=pg_temp.role_formation(mid,'RU','__roles-fr','s400');
 submarine:=pg_temp.role_formation(mid,'FR','__roles-fr','scorpene');
 other_ship:=pg_temp.role_formation(mid,'FR','__roles-fr','fremm');
 projectile:=pg_temp.role_formation(mid,'US','__roles-us','naval-strike-missile',jsonb_build_object('type','strike','targetUnitId',ship));
 select morale into old_morale from dorra_private.war_provinces where match_id=mid and province_id='__roles-fr';
 perform dorra_private.war_resolve_strike(mid,projectile,1,'__roles-fr',7201);
 assert (select health=45 from dorra_private.war_units where id=ship),'unrelated neutral missile defence does not protect another nation';
 assert (select health=100 from dorra_private.war_units where id=other_ship),'one anti-ship missile does not damage every formation at the same port';
 assert (select health=100 from dorra_private.war_units where id=land_target),'anti-ship missile spares enemy land formations';
 assert (select health=100 from dorra_private.war_units where id=submarine),'surface-target missile cannot attack a submerged target';
 assert (select health=100 from dorra_private.war_units where id=friendly),'conventional strike spares friendly formations';
 assert (select health=100 from dorra_private.war_units where id=neutral),'conventional strike spares neutral formations';
 assert (select morale=old_morale from dorra_private.war_provinces where match_id=mid and province_id='__roles-fr'),'anti-ship impact does not bombard provincial morale';

 projectile:=pg_temp.role_formation(mid,'US','__roles-us','naval-strike-missile');
 perform public.dorra_war_command(actor,sid,lease,'order',mid,jsonb_build_object('unitIds',jsonb_build_array(projectile),'type','attack','targetUnitId',ship),gen_random_uuid());
 update dorra_private.war_units set province_id='__roles-far-fr' where id=ship;
 perform dorra_private.war_resolve_strike(mid,projectile,2,'__roles-fr',9001);
 assert (select health=100 from dorra_private.war_units where id=other_ship),'a target leaving its province does not redirect the missile to another ship';
 assert (select health=45 from dorra_private.war_units where id=ship),'a surface target can evade a queued strike by leaving the impact province';

 update dorra_private.war_units set health=100,province_id='__roles-fr' where id=ship;
 projectile:=pg_temp.role_formation(mid,'US','__roles-us','tomahawk','{"type":"strike"}');
 perform dorra_private.war_resolve_strike(mid,projectile,1,'__roles-fr',10801);
 assert (select health=25 from dorra_private.war_units where id=land_target),'land-attack cruise missile hits hostile ground formations';
 assert (select health=100 from dorra_private.war_units where id=ship),'land-attack cruise missile does not gain an unlisted anti-ship mode';
 assert (select health=100 from dorra_private.war_units where id=friendly),'cruise missile preserves friendly formations in the same province';

 projectile:=pg_temp.role_formation(mid,'US','__roles-us','minuteman-iii');
 begin
 perform public.dorra_war_command(actor,sid,lease,'order',mid,jsonb_build_object('unitIds',jsonb_build_array(projectile),'type','attack','targetProvinceId','__roles-us'),gen_random_uuid());
 raise exception 'Expected DECLARE_WAR_FIRST';exception when others then assert sqlerrm='DECLARE_WAR_FIRST','nuclear launch requires a hostile province owner';end;
 update dorra_private.war_units set orders='{"type":"strike"}' where id=projectile;
 update dorra_private.war_relations set relation='peace' where match_id=mid;
 perform dorra_private.war_resolve_strike(mid,projectile,1,'__roles-fr',14401);
 assert (select health=25 from dorra_private.war_units where id=land_target),'negotiated peace cancels an old queued land strike';
 update dorra_private.war_relations set relation='war' where match_id=mid;
 projectile:=pg_temp.role_formation(mid,'US','__roles-us','minuteman-iii','{"type":"strike"}');
 perform dorra_private.war_resolve_strike(mid,projectile,1,'__roles-fr',18001);
 assert not exists(select 1 from dorra_private.war_units where id in(ship,other_ship,submarine,land_target,friendly,neutral)),'nuclear area effect explicitly includes friendly and neutral collateral';
 assert exists(select 1 from dorra_private.war_reports where match_id=mid and nation_id='RU' and body->>'collateral'='true'),'a neutral nation receives its own collateral report';
 assert exists(select 1 from dorra_private.war_reports where match_id=mid and nation_id='RU' and body->>'type'='missile-defense'),'actually threatened neutrals can attempt defence against nuclear collateral';
 assert (select radiation_until=18001+259200 from dorra_private.war_provinces where match_id=mid and province_id='__roles-fr'),'nuclear impact retains fallout';

 -- Persistent batteries have a bounded engagement budget instead of stopping
 -- an unlimited number of simultaneous salvos with one formation.
 interceptor:=pg_temp.role_formation(mid,'US','__roles-us','patriot');
 update dorra_private.war_units set strength=4 where id=interceptor;
 infantry:=pg_temp.role_formation(mid,'US','__roles-us','infantry-company');
 projectile:=pg_temp.role_formation(mid,'FR','__roles-fr','m51','{"type":"strike"}');
 perform dorra_private.war_resolve_strike(mid,projectile,1,'__roles-us',22000);
 assert (select intercept_ready_at=25600 from dorra_private.war_units where id=interceptor),'persistent battery spends its one-hour interception budget';
 assert (select health=100 from dorra_private.war_units where id=infantry),'ready missile-defence battery can intercept a strategic strike';
 projectile:=pg_temp.role_formation(mid,'FR','__roles-fr','m51','{"type":"strike"}');
 delete from dorra_private.war_events where match_id=mid;
 insert into dorra_private.war_events(match_id,kind,due,payload) values(mid,'strike',22001,jsonb_build_object('unitId',projectile,'generation',1,'targetProvinceId','__roles-us'));
 update dorra_private.war_matches set game_anchor=22002,real_anchor=clock_timestamp(),last_dispatch=clock_timestamp() where id=mid;
 perform dorra_private.war_advance(mid,10);
 assert not exists(select 1 from dorra_private.war_units where id in(interceptor,infantry,projectile)),'chronological strike event bypasses a battery still reloading and consumes the missile';
 raise notice 'War combat role tests passed';
end $test$;
rollback;
