-- Owner readiness stays private through views, deltas and notification hints.
begin;
insert into auth.users(id,raw_user_meta_data) values
 ('f8100000-0000-4000-8000-000000000001','{"username":"war_readiness_a_20261016"}'),
 ('f8100000-0000-4000-8000-000000000002','{"username":"war_readiness_b_20261016"}');
insert into dorra_private.war_catalog_nations values
 ('WRP','Readiness Alpha','{"capitalProvinceId":"WRP-1"}'),('WRQ','Readiness Bravo','{"capitalProvinceId":"WRQ-1"}');
insert into dorra_private.war_catalog_provinces values
 ('WRP-1','WRP','Readiness capital','{"lat":0,"lng":0,"capital":true}'),
 ('WRQ-1','WRQ','Readiness rival capital','{"lat":0,"lng":1,"capital":true}');
insert into dorra_private.war_catalog_platforms values('__readiness-platform','Readiness infantry','{"domain":"land","operators":["WRP","WRQ"],"capabilities":["capture"],"stats":{"attack":10,"defense":10,"vision":20,"radar":0}}');
do $$
declare mid uuid;own_unit uuid;enemy_unit uuid;v jsonb;first_view jsonb;patch jsonb;own_revision bigint;enemy_revision bigint;
begin
 insert into dorra_private.war_matches(name,host_id,status,template,opponent,pace,visibility,speed,limit_seconds)
 values('Readiness rollback fixture','f8100000-0000-4000-8000-000000000001','paused','duel','human','fast','invite',360,2592000) returning id into mid;
 insert into dorra_private.war_sides(match_id,nation_id,user_id) values(mid,'WRP','f8100000-0000-4000-8000-000000000001'),(mid,'WRQ','f8100000-0000-4000-8000-000000000002');
 insert into dorra_private.war_provinces(match_id,province_id,nation_id) values(mid,'WRP-1','WRP'),(mid,'WRQ-1','WRQ');
 insert into dorra_private.war_units(match_id,nation_id,province_id,platform_id,name,domain,entrenchment) values(mid,'WRP','WRP-1','__readiness-platform','Own readiness formation','land',12) returning id into own_unit;
 insert into dorra_private.war_units(match_id,nation_id,province_id,platform_id,name,domain,entrenchment) values(mid,'WRQ','WRP-1','__readiness-platform','Visible rival formation','land',18) returning id into enemy_unit;
 v:=dorra_private.war_view(mid,'f8100000-0000-4000-8000-000000000001');
 assert exists(select 1 from jsonb_array_elements(v->'units') u where u->>'id'=own_unit::text and (u->>'supply')::numeric=1 and (u->>'entrenchment')::numeric=12 and u->'baseCarrierId'='null'::jsonb and (u->>'interceptReadyAt')::numeric=0),'own readiness uses authoritative fields';
 assert exists(select 1 from jsonb_array_elements(v->'units') u where u->>'id'=enemy_unit::text and not(u ? 'supply') and not(u ? 'entrenchment') and not(u ? 'baseCarrierId') and not(u ? 'interceptReadyAt')),'visible enemy readiness remains hidden';
 first_view:=public.dorra_war_projection('f8100000-0000-4000-8000-000000000001',mid,null,v);
 update dorra_private.war_sides set resources=jsonb_set(resources,'{fuel}','0') where match_id=mid and nation_id='WRP';
 v:=dorra_private.war_view(mid,'f8100000-0000-4000-8000-000000000001');
 assert exists(select 1 from jsonb_array_elements(v->'units') u where u->>'id'=own_unit::text and (u->>'supply')::numeric=.8),'fuel exhaustion changes the projected combat supply factor';
 patch:=public.dorra_war_projection('f8100000-0000-4000-8000-000000000001',mid,(first_view#>>'{view,match,revision}')::bigint,v);
 assert exists(select 1 from jsonb_array_elements(patch#>'{delta,units,upsert}') u where u->>'id'=own_unit::text and (u->>'supply')::numeric=.8),'readiness changes travel in filtered unit deltas';
 update dorra_private.war_provinces set nation_id='WRQ' where match_id=mid and province_id='WRP-1';
 v:=dorra_private.war_view(mid,'f8100000-0000-4000-8000-000000000001');
 assert exists(select 1 from jsonb_array_elements(v->'units') u where u->>'id'=own_unit::text and (u->>'supply')::numeric=.45),'capital loss and exhausted fuel show the actual supply floor';
 insert into dorra_private.war_observers(match_id,user_id) values(mid,'f8100000-0000-4000-8000-000000000001'),(mid,'f8100000-0000-4000-8000-000000000002');
 perform dorra_private.war_notify(mid);
 select revision into own_revision from dorra_private.war_observers where match_id=mid and user_id='f8100000-0000-4000-8000-000000000001';
 select revision into enemy_revision from dorra_private.war_observers where match_id=mid and user_id='f8100000-0000-4000-8000-000000000002';
 update dorra_private.war_observers set last_hint=now()-interval '10 seconds' where match_id=mid;
 update dorra_private.war_units set entrenchment=14 where id=own_unit;
 perform dorra_private.war_notify(mid);
 assert (select revision=own_revision+1 from dorra_private.war_observers where match_id=mid and user_id='f8100000-0000-4000-8000-000000000001'),'owner receives an entrenchment-change hint';
 assert (select revision=enemy_revision from dorra_private.war_observers where match_id=mid and user_id='f8100000-0000-4000-8000-000000000002'),'hidden entrenchment generates no enemy hint';
 update dorra_private.war_observers set last_hint=now()-interval '10 seconds' where match_id=mid;
 update dorra_private.war_units set intercept_ready_at=3600 where id=own_unit;
 perform dorra_private.war_notify(mid);
 assert (select revision=own_revision+2 from dorra_private.war_observers where match_id=mid and user_id='f8100000-0000-4000-8000-000000000001'),'owner receives a defensive reload hint';
 assert (select revision=enemy_revision from dorra_private.war_observers where match_id=mid and user_id='f8100000-0000-4000-8000-000000000002'),'defensive reload timing generates no enemy hint';
end $$;
rollback;
