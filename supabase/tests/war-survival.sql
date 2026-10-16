begin;
insert into auth.users(id,raw_user_meta_data) values('f7000000-0000-4000-8000-000000000001','{"username":"war_survival_20261016"}');
insert into dorra_private.war_catalog_nations values('WSA','Survival Alpha','{"capitalProvinceId":"WSA-1"}'),('WSB','Survival Bravo','{"capitalProvinceId":"WSB-1"}');
insert into dorra_private.war_catalog_provinces values
 ('WSA-1','WSA','Alpha port','{"capital":true,"port":true,"lat":0,"lng":0,"neighbors":["WSB-1","WSB-2"]}'),
 ('WSB-1','WSB','Bravo port','{"capital":true,"port":true,"lat":0,"lng":1,"neighbors":["WSA-1","WSB-2"]}'),
 ('WSB-2','WSB','Bravo inland','{"capital":false,"port":false,"lat":0,"lng":2,"neighbors":["WSA-1","WSB-1"]}');
insert into dorra_private.war_catalog_platforms values('__survival-personnel','Survival infantry','{"domain":"land","operators":["WSA","WSB"],"stats":{"speed":30,"attack":10,"defense":10,"range":1,"vision":20}}');
do $$
declare mid uuid;uid uuid;enemy uuid;
begin
 insert into dorra_private.war_matches(name,host_id,status,template,opponent,pace,visibility,speed,limit_seconds,real_anchor,last_dispatch) values('Survival rollback fixture','f7000000-0000-4000-8000-000000000001','running','duel','ai','fast','invite',360,2592000,clock_timestamp(),clock_timestamp()) returning id into mid;
 insert into dorra_private.war_sides(match_id,nation_id) values(mid,'WSA'),(mid,'WSB');
 insert into dorra_private.war_provinces(match_id,province_id,nation_id) values(mid,'WSA-1','WSA'),(mid,'WSB-1','WSA'),(mid,'WSB-2','WSA');
 insert into dorra_private.war_units(match_id,nation_id,province_id,platform_id,name,domain) values(mid,'WSA','WSA-1','__survival-personnel','Alpha force','land') returning id into uid;
 insert into dorra_private.war_units(match_id,nation_id,province_id,platform_id,name,domain) values(mid,'WSB','WSB-2','__survival-personnel','Surviving defender','land') returning id into enemy;
 perform dorra_private.war_finish(mid,3600);
 assert (select status='running' from dorra_private.war_matches where id=mid),'losing the final province does not eliminate surviving defenders';
 perform dorra_private.war_finish(mid,3600+21599);
 assert (select status='running' from dorra_private.war_matches where id=mid),'surviving defenders retain the six-hour capital hold window';
 perform dorra_private.war_finish(mid,3600+21600);
 assert (select status='finished' and winner='WSA' from dorra_private.war_matches where id=mid),'six-hour occupation still ends the duel';
 update dorra_private.war_matches set status='running',winner=null,finished_at=null,capital_hold_nation=null,capital_hold_started=null where id=mid;
 delete from dorra_private.war_units where id=enemy;
 perform dorra_private.war_finish(mid,1000);
 assert (select status='finished' and winner='WSA' from dorra_private.war_matches where id=mid),'no territory and no surviving force is immediate elimination';
 begin perform dorra_private.war_schedule_move(mid,uid,'WSB-2','embark',0);raise exception 'Expected PORT_REQUIRED';exception when others then assert sqlerrm='PORT_REQUIRED','transport orders cannot land at an inland province';end;
 raise notice 'War survival and landing-port regression tests passed';
end $$;
rollback;
