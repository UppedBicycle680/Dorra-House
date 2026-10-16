-- Follow-up migration regression tests; all fixtures and rewards roll back.
begin;
insert into auth.users(id,raw_user_meta_data) values
 ('f4000000-0000-4000-8000-000000000001','{"username":"war_runtime_a_20261016"}'),
 ('f4000000-0000-4000-8000-000000000002','{"username":"war_runtime_b_20261016"}');
do $$begin
 if not exists(select 1 from dorra_private.profiles where user_id='f4000000-0000-4000-8000-000000000001') then insert into dorra_private.profiles(user_id) values('f4000000-0000-4000-8000-000000000001');end if;
end $$;
insert into auth.sessions(id,user_id) values('f5000000-0000-4000-8000-000000000001','f4000000-0000-4000-8000-000000000001');
insert into dorra_private.player_state(user_id,auth_session_id,lease_id,snapshot) values('f4000000-0000-4000-8000-000000000001','f5000000-0000-4000-8000-000000000001','f6000000-0000-4000-8000-000000000001','{"balance":1000,"progress":{}}');
insert into dorra_private.war_catalog_nations values
 ('WRT','Runtime test nation','{"capitalProvinceId":"WRT-1","economy":100,"military":80,"nuclear":false,"playable":true}'),
 ('WRU','Runtime opponent','{"capitalProvinceId":"WRU-1","economy":80,"military":30,"nuclear":false,"playable":true}'),
 ('WRD','Dependent region','{"capitalProvinceId":"WRD-1","economy":10,"military":1,"nuclear":false,"playable":false,"sovereignId":"WRT"}');
insert into dorra_private.war_catalog_provinces values
 ('WRT-1','WRT','Runtime capital','{"lat":0,"lng":0,"capital":true,"city":true,"port":false,"terrain":"urban","neighbors":[]}'),
 ('AAA-DEPENDENCY','WRT','Dependency regional capital','{"lat":60,"lng":80,"capital":true,"city":true,"port":true,"terrain":"urban","neighbors":[]}'),
 ('WRU-1','WRU','Runtime opponent capital','{"lat":0,"lng":20,"capital":true,"city":true,"port":false,"terrain":"urban","neighbors":[]}');
insert into dorra_private.war_catalog_platforms values
 ('__runtime-personnel','Runtime personnel','{"domain":"land","branch":"infantry","role":"infantry","operators":["WRT","WRU"],"abstractCapability":true,"level":1,"facility":"army-base","stats":{"attack":10,"defense":10,"speed":20,"vision":20}}'),
 ('__runtime-armor','Runtime authored armor','{"domain":"land","branch":"armor","role":"armor","operators":["WRT"],"level":3,"facility":"army-base","stats":{"attack":35,"defense":35,"speed":40,"vision":30}}');
do $$
declare actor uuid:='f4000000-0000-4000-8000-000000000001';sid uuid:='f5000000-0000-4000-8000-000000000001';lease uuid:='f6000000-0000-4000-8000-000000000001';old_id uuid;paused_id uuid;mid uuid;r jsonb;invite text;rev bigint;
begin
 begin perform public.dorra_war_command(actor,sid,lease,'create',null,'{"nationId":"WRD","opponentNationId":"WRU","template":"duel","opponent":"ai","pace":"fast","visibility":"public"}',gen_random_uuid());raise exception 'Expected CATALOG_NOT_READY';exception when others then assert sqlerrm='CATALOG_NOT_READY','dependencies cannot be commanded independently';end;
 r:=public.dorra_war_command(actor,sid,lease,'create',null,'{"nationId":"WRT","opponentNationId":"WRU","template":"world","opponent":"human","pace":"fast","visibility":"invite"}',gen_random_uuid());mid:=(r#>>'{view,match,id}')::uuid;invite:=r#>>'{view,match,inviteCode}';
 assert not exists(select 1 from dorra_private.war_sides where match_id=mid and nation_id='WRD'),'world uses sovereign playable nations';
 assert exists(select 1 from dorra_private.war_units where match_id=mid and nation_id='WRT' and platform_id='__runtime-armor'),'authored nationally operated armor joins the scenario starters';
 assert not exists(select 1 from dorra_private.war_units where match_id=mid and nation_id='WRT' and province_id<>'WRT-1'),'starters use the national capital rather than a dependency regional capital';
 assert (select research ? '__runtime-armor' from dorra_private.war_sides where match_id=mid and nation_id='WRT'),'starting models are preunlocked';
 r:=public.dorra_war_command(actor,sid,lease,'list',null,jsonb_build_object('inviteCode',invite));
 assert exists(select 1 from jsonb_array_elements(r->'matches') x where x->>'id'=mid::text and (x->>'inviteMatched')::boolean),'code-only invite discovery identifies the matching lobby';
 perform dorra_private.war_notify(mid);select revision into rev from dorra_private.war_observers where match_id=mid and user_id=actor;
 perform public.dorra_war_command(actor,sid,lease,'view',mid);perform public.dorra_war_command(actor,sid,lease,'view',mid);
 assert (select revision from dorra_private.war_observers where match_id=mid and user_id=actor)=rev,'view polling never wakes every observer';
 insert into dorra_private.war_matches(name,host_id,status,template,opponent,pace,visibility,speed,limit_seconds,finished_at) values('Old finished summary',actor,'finished','duel','ai','fast','public',360,2592000,now()-interval '8 days') returning id into old_id;
 insert into dorra_private.war_matches(name,host_id,status,template,opponent,pace,visibility,speed,limit_seconds,created_at) values('Preserved paused progress','f4000000-0000-4000-8000-000000000002','paused','duel','ai','persistent','invite',4,5184000,now()-interval '90 days') returning id into paused_id;
 insert into dorra_private.war_sides(match_id,nation_id,user_id) values(old_id,'WRT',actor),(paused_id,'WRT','f4000000-0000-4000-8000-000000000002');
 insert into dorra_private.war_provinces(match_id,province_id,nation_id) values(old_id,'WRT-1','WRT'),(paused_id,'WRT-1','WRT');
 insert into dorra_private.war_units(match_id,nation_id,province_id,platform_id,name,domain) values(old_id,'WRT','WRT-1','__runtime-personnel','Old unit','land'),(paused_id,'WRT','WRT-1','__runtime-personnel','Paused unit','land');
 insert into dorra_private.war_reports(match_id,nation_id,game_time,body) values(old_id,'WRT',0,'{}'),(paused_id,'WRT',0,'{}');
 insert into dorra_private.war_rewards(user_id,match_id,amount,reward_day) values(actor,old_id,250,current_date-8);
 insert into dorra_private.war_requests(user_id,request_id,digest,match_id,result) values(actor,gen_random_uuid(),'test',old_id,'{}');
 insert into dorra_private.war_projection_cache(user_id,match_id,view) values(actor,old_id,'{}');
 perform dorra_private.war_maintenance();
 assert exists(select 1 from dorra_private.war_matches where id=old_id),'finished match summary remains';
 assert (select archived_at is not null from dorra_private.war_matches where id=old_id),'retention marks the cleaned summary so later batches advance';
 assert exists(select 1 from dorra_private.war_rewards where match_id=old_id and amount=250),'permanent reward receipt remains';
 assert not exists(select 1 from dorra_private.war_units where match_id=old_id),'old finished units are pruned';
 assert not exists(select 1 from dorra_private.war_provinces where match_id=old_id),'old finished province state is pruned';
 assert not exists(select 1 from dorra_private.war_requests where match_id=old_id),'old finished requests are pruned';
 assert not exists(select 1 from dorra_private.war_projection_cache where match_id=old_id),'old finished projection caches are pruned';
 assert exists(select 1 from dorra_private.war_units where match_id=paused_id),'paused units survive regardless of age';
 assert exists(select 1 from dorra_private.war_provinces where match_id=paused_id),'paused province progress survives';
 assert exists(select 1 from dorra_private.war_reports where match_id=paused_id),'paused reports survive';
 assert position('419430400' in pg_get_functiondef('public.dorra_war_command(uuid,uuid,uuid,text,uuid,jsonb,uuid)'::regprocedure))>0,'new-world storage guard reserves Free capacity';
 raise notice 'War runtime and retention regression tests passed';
end $$;
rollback;
