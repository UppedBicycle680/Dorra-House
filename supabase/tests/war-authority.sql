-- Transactional integration tests for the actual authoritative SQL engine.
-- Run as a trusted migration/test role after the war migration. No fixture,
-- clock, queue, account, wallet or match survives this transaction.
begin;
insert into auth.users(id,raw_user_meta_data) values
 ('f1000000-0000-4000-8000-000000000001','{"username":"war_fixture_a_20261016"}'),
 ('f1000000-0000-4000-8000-000000000002','{"username":"war_fixture_b_20261016"}');
do $$begin
 if not exists(select 1 from dorra_private.profiles where user_id='f1000000-0000-4000-8000-000000000001') then insert into dorra_private.profiles(user_id) values('f1000000-0000-4000-8000-000000000001'),('f1000000-0000-4000-8000-000000000002');end if;
end $$;
insert into auth.sessions(id,user_id) values
 ('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001'),
 ('f2000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002');
insert into dorra_private.player_state(user_id,auth_session_id,lease_id,snapshot) values
 ('f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','f3000000-0000-4000-8000-000000000001','{"balance":1000,"progress":{}}'),
 ('f1000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000002','f3000000-0000-4000-8000-000000000002','{"balance":1000,"progress":{}}');
insert into dorra_private.war_catalog_nations values
 ('WQA','War test Alpha','{"capitalProvinceId":"WQA-1","economy":100,"military":50,"nuclear":false,"arsenal":["__war_infantry"]}'),
 ('WQB','War test Bravo','{"capitalProvinceId":"WQB-1","economy":60,"military":25,"nuclear":true,"arsenal":["__war_infantry","__war_foreign"]}'),
 ('WQC','War test neutral','{"capitalProvinceId":"WQC-1","economy":20,"military":10,"nuclear":false,"arsenal":["__war_infantry"]}');
insert into dorra_private.war_catalog_provinces values
 ('WQA-1','WQA','Alpha capital','{"lat":0,"lng":0,"capital":true,"city":true,"port":true,"terrain":"urban","neighbors":["WQA-2"]}'),
 ('WQA-2','WQA','Alpha frontier','{"lat":0,"lng":1,"capital":false,"city":false,"port":false,"terrain":"plains","neighbors":["WQA-1","WQB-1"]}'),
 ('WQB-1','WQB','Bravo capital','{"lat":0,"lng":2,"capital":true,"city":true,"port":true,"terrain":"mountain","neighbors":["WQA-2","WQB-2"]}'),
 ('WQB-2','WQB','Bravo rear','{"lat":0,"lng":60,"capital":false,"city":false,"port":false,"terrain":"plains","neighbors":["WQB-1"]}'),
 ('WQC-1','WQC','Neutral capital','{"lat":30,"lng":60,"capital":true,"city":true,"port":false,"terrain":"plains","neighbors":[]}');
insert into dorra_private.war_catalog_platforms values
 ('__war_infantry','War test infantry','{"domain":"land","branch":"infantry","operators":["WQA","WQB"],"level":1,"facility":"army-base","cost":{"cash":100,"supplies":20,"fuel":0,"electronics":0,"manpower":10},"researchHours":1,"buildHours":1,"prerequisites":[],"stats":{"attack":10,"defense":10,"range":5,"speed":100,"vision":30,"stealth":0,"radar":0,"airDefense":0}}'),
 ('__war_doctrine','War test doctrine','{"domain":"support","branch":"industry","operators":["*"],"capabilities":["doctrine"],"buildable":false,"level":1,"facility":"arms-industry","cost":{"cash":100},"researchHours":1,"buildHours":1,"prerequisites":[],"stats":{"attack":0,"defense":0,"speed":0}}'),
 ('__war_foreign','War test imported vehicle','{"domain":"land","branch":"armor","operators":["WQB"],"level":2,"facility":"army-base","cost":{"cash":100},"researchHours":1,"buildHours":1,"prerequisites":["__war_doctrine"],"stats":{"attack":15,"defense":15,"range":5,"speed":100,"vision":30,"stealth":0,"radar":0,"airDefense":0}}'),
 ('__war_nuclear','War test nuclear delivery','{"domain":"missile","branch":"missiles","nuclear":true,"operators":["WQB"],"level":2,"facility":"missile-site","cost":{"cash":100},"researchHours":1,"buildHours":1,"prerequisites":[],"stats":{"attack":150,"defense":5,"range":10000,"speed":2000,"vision":0}}');

do $$
declare
 actor uuid:='f1000000-0000-4000-8000-000000000001';session_id uuid:='f2000000-0000-4000-8000-000000000001';lease uuid:='f3000000-0000-4000-8000-000000000001';
 rival uuid:='f1000000-0000-4000-8000-000000000002';rival_session uuid:='f2000000-0000-4000-8000-000000000002';rival_lease uuid:='f3000000-0000-4000-8000-000000000002';
 mid uuid;world_id uuid;outcome jsonb;view_before jsonb;own_unit uuid;spy uuid;stealth_unit uuid;request_id uuid;resources_before jsonb;count_before integer;rewards_before numeric;rev_before bigint;
begin
 outcome:=public.dorra_war_command(actor,session_id,lease,'create',null,'{"nationId":"WQA","opponentNationId":"WQB","template":"duel","opponent":"ai","pace":"fast","visibility":"public","name":"SQL rollback fixture"}',gen_random_uuid());
 mid:=(outcome#>>'{view,match,id}')::uuid;
 assert outcome#>>'{view,match,status}'='lobby','create returns a lobby';
 assert jsonb_array_length(outcome#>'{view,nations}')=2,'duel includes exactly two nations';
 assert outcome#>>'{view,match,speed}'='360','fast clock uses server speed';
 assert jsonb_array_length(outcome#>'{view,units}')>=1,'national baseline is mobilised';
 begin perform public.dorra_war_command(actor,session_id,'f3000000-0000-4000-8000-000000000099','view',mid);raise exception 'Expected SESSION_REPLACED';exception when others then assert sqlerrm='SESSION_REPLACED','a stale lease is rejected';end;
 update dorra_private.profiles set banned=true where user_id=actor;
 begin perform public.dorra_war_command(actor,session_id,lease,'view',mid);raise exception 'Expected ACCOUNT_DISABLED';exception when others then assert sqlerrm='ACCOUNT_DISABLED','banned users are rejected';end;
 update dorra_private.profiles set banned=false,suspended_until=now()+interval '1 hour' where user_id=actor;
 begin perform public.dorra_war_command(actor,session_id,lease,'view',mid);raise exception 'Expected ACCOUNT_DISABLED';exception when others then assert sqlerrm='ACCOUNT_DISABLED','suspended users are rejected';end;
 update dorra_private.profiles set suspended_until=null where user_id=actor;
 begin perform public.dorra_war_command(rival,rival_session,rival_lease,'view',mid);raise exception 'Expected MATCH_FORBIDDEN';exception when others then assert sqlerrm='MATCH_FORBIDDEN','nonmembers cannot read a private player view';end;
 perform public.dorra_war_command(actor,session_id,lease,'start',mid,'{}',gen_random_uuid());
 select id into own_unit from dorra_private.war_units where match_id=mid and nation_id='WQA' and platform_id='__war_infantry' limit 1;
 insert into dorra_private.war_units(match_id,nation_id,province_id,platform_id,name,domain) values(mid,'WQB','WQB-2','__war_infantry','Hidden fixture','land') returning id into spy;
 outcome:=public.dorra_war_command(actor,session_id,lease,'view',mid);
 assert not exists(select 1 from jsonb_array_elements(outcome#>'{view,units}') u where u->>'id'=spy::text),'hidden enemy unit is omitted';
 assert not exists(select 1 from jsonb_array_elements(outcome#>'{view,catalog,platforms}') p where p->>'id'='__war_foreign'),'foreign platforms require a licence';
 perform dorra_private.war_notify(mid);select revision into rev_before from dorra_private.war_observers where match_id=mid and user_id=actor;
 update dorra_private.war_units set health=90 where id=spy;perform dorra_private.war_notify(mid);
 assert (select revision from dorra_private.war_observers where match_id=mid and user_id=actor)=rev_before,'hidden changes emit no observer revision hints';
 begin perform public.dorra_war_command(actor,session_id,lease,'order',mid,jsonb_build_object('unitIds',jsonb_build_array(spy),'type','move','targetProvinceId','WQA-1'),gen_random_uuid());raise exception 'Expected UNIT_NOT_OWNED';exception when others then assert sqlerrm='UNIT_NOT_OWNED','foreign unit orders are rejected';end;
 begin perform public.dorra_war_command(actor,session_id,lease,'order',mid,jsonb_build_object('unitIds',jsonb_build_array(own_unit),'type','attack','targetUnitId',spy),gen_random_uuid());raise exception 'Expected TARGET_NOT_VISIBLE';exception when others then assert sqlerrm='TARGET_NOT_VISIBLE','target IDs cannot bypass fog of war';end;

 request_id:=gen_random_uuid();
 perform public.dorra_war_command(actor,session_id,lease,'produce',mid,'{"provinceId":"WQA-1","platformId":"__war_infantry"}',request_id);
 select resources into resources_before from dorra_private.war_sides where match_id=mid and nation_id='WQA';
 outcome:=public.dorra_war_command(actor,session_id,lease,'produce',mid,'{"provinceId":"WQA-1","platformId":"__war_infantry"}',request_id);
 assert (outcome->>'replayed')::boolean,'duplicate command replays';
 assert (select count(*) from dorra_private.war_events where match_id=mid and kind='produce')=1,'duplicate produce creates one queue entry';
 assert (select (resources->>'cash')::numeric from dorra_private.war_sides where match_id=mid and nation_id='WQA')>=(resources_before->>'cash')::numeric,'duplicate does not charge resources twice';
 begin perform public.dorra_war_command(actor,session_id,lease,'build',mid,'{"provinceId":"WQA-1","facility":"army-base"}',request_id);raise exception 'Expected REQUEST_REUSED';exception when others then assert sqlerrm='REQUEST_REUSED','reused request IDs cannot execute another intention';end;
 perform public.dorra_war_command(actor,session_id,lease,'research',mid,'{"platformId":"__war_doctrine"}',gen_random_uuid());
 -- Advance the server clock while keeping scheduler health intact.
 update dorra_private.war_matches set real_anchor=clock_timestamp()-interval '11 seconds',last_dispatch=clock_timestamp() where id=mid;
 perform dorra_private.war_advance(mid,400);
 assert (select research ? '__war_doctrine' from dorra_private.war_sides where match_id=mid and nation_id='WQA'),'timed research completes once';
 assert not exists(select 1 from dorra_private.war_events where match_id=mid and kind='produce' and payload->>'nationId'='WQA'),'timed mobilization completes';
 begin perform public.dorra_war_command(actor,session_id,lease,'produce',mid,'{"provinceId":"WQA-1","platformId":"__war_doctrine"}',gen_random_uuid());raise exception 'Expected RESEARCH_ONLY';exception when others then assert sqlerrm='RESEARCH_ONLY','doctrines cannot be produced as units';end;

 -- An active opponent evaluates a truce on its bounded turn. Supply pressure
 -- makes this fixture's offer acceptable; a fresh opponent no longer grants an
 -- immediate free truce merely because the player clicked the button.
 update dorra_private.war_sides set resources=resources||'{"supplies":0,"fuel":0}' where match_id=mid and nation_id='WQB';
 perform public.dorra_war_command(actor,session_id,lease,'diplomacy',mid,'{"nationId":"WQB","type":"peace"}',gen_random_uuid());
 perform dorra_private.war_ai(mid,'WQB',4000);
 assert dorra_private.war_relation(mid,'WQA','WQB')='peace','AI accepts a truce under genuine supply pressure';
 perform public.dorra_war_command(actor,session_id,lease,'diplomacy',mid,'{"nationId":"WQB","type":"import-license"}',gen_random_uuid());
 outcome:=public.dorra_war_command(actor,session_id,lease,'view',mid);
 assert outcome#>'{view,player,importLicenses}' ? 'WQB','peaceful AI can grant an import licence';
 assert exists(select 1 from jsonb_array_elements(outcome#>'{view,catalog,platforms}') p where p->>'id'='__war_foreign'),'licensed donor platforms become available';
 assert not exists(select 1 from jsonb_array_elements(outcome#>'{view,catalog,platforms}') p where p->>'id'='__war_nuclear'),'nuclear platforms never transfer with a licence';
 begin perform public.dorra_war_command(actor,session_id,lease,'research',mid,'{"platformId":"__war_foreign"}',gen_random_uuid());raise exception 'Expected FACILITY_REQUIRED';exception when others then assert sqlerrm='FACILITY_REQUIRED','research requires the matching facility level';end;

 perform public.dorra_war_command(actor,session_id,lease,'pause',mid,'{}',gen_random_uuid());
 outcome:=public.dorra_war_command(actor,session_id,lease,'view',mid);
 assert outcome#>>'{view,match,status}'='paused','solo pause releases its running slot';
 perform public.dorra_war_command(actor,session_id,lease,'resume',mid,'{}',gen_random_uuid());
 -- Consecutive capital ownership must last six game hours. Owning a large
 -- initial nation never wins a duel automatically.
 update dorra_private.war_provinces set nation_id='WQA' where match_id=mid and province_id='WQB-1';
 perform dorra_private.war_finish(mid,86400);
 assert (select status='running' from dorra_private.war_matches where id=mid),'capital capture starts a hold';
 perform dorra_private.war_finish(mid,86400+21599);
 assert (select status='running' from dorra_private.war_matches where id=mid),'capital hold cannot complete early';
 perform dorra_private.war_finish(mid,86400+21600);
 assert (select status='finished' and winner='WQA' from dorra_private.war_matches where id=mid),'six-hour capital hold wins the duel';
 select (snapshot->>'balance')::numeric into rewards_before from dorra_private.player_state where user_id=actor;
 select revision into rev_before from dorra_private.war_matches where id=mid;
 request_id:=gen_random_uuid();outcome:=public.dorra_war_command(actor,session_id,lease,'reward',mid,'{}',request_id);
 assert (outcome#>>'{result,amount}')::integer=1000,'winner receives a capped completion reward';
 assert (select revision>rev_before from dorra_private.war_matches where id=mid),'reward advances the source revision at a frozen game clock';
 assert (select (snapshot->>'balance')::numeric from dorra_private.player_state where user_id=actor)=rewards_before+1000,'wallet changes in the reward transaction';
 perform public.dorra_war_command(actor,session_id,lease,'reward',mid,'{}',request_id);
 assert (select count(*) from dorra_private.war_rewards where user_id=actor and match_id=mid)=1,'permanent reward receipt prevents duplicate payout';
 assert (select reward_day=(now() at time zone 'Australia/Brisbane')::date from dorra_private.war_rewards where user_id=actor and match_id=mid),'daily caps use the Brisbane date';
 begin perform public.dorra_war_command(actor,session_id,lease,'retire',mid,'{}',gen_random_uuid());raise exception 'Expected MATCH_STATUS';exception when others then assert sqlerrm='MATCH_STATUS','finished results cannot be rewritten by retiring';end;
 assert (select winner='WQA' from dorra_private.war_matches where id=mid),'winner remains immutable after payout';
 outcome:=public.dorra_war_command(actor,session_id,lease,'create',null,'{"nationId":"WQA","opponentNationId":"WQB","template":"duel","opponent":"human","pace":"fast","visibility":"public","name":"Membership revision fixture"}',gen_random_uuid());
 world_id:=(outcome#>>'{view,match,id}')::uuid;select revision into rev_before from dorra_private.war_matches where id=world_id;
 perform public.dorra_war_command(rival,rival_session,rival_lease,'join',world_id,'{"nationId":"WQB"}',gen_random_uuid());
 assert (select revision>rev_before from dorra_private.war_matches where id=world_id),'joining advances the source revision while lobby time is zero';
 select revision into rev_before from dorra_private.war_matches where id=world_id;
 perform public.dorra_war_command(rival,rival_session,rival_lease,'retire',world_id,'{}',gen_random_uuid());
 assert (select revision>rev_before and status='finished' and winner='WQA' from dorra_private.war_matches where id=world_id),'surrender advances the revision and settles its opponent as winner';
 -- World AI: exactly the named opponent expands, researches and builds. Other
 -- countries retain standing defenders without global active-AI fanout.
 update dorra_private.war_catalog_provinces set data=jsonb_set(data,'{neighbors}','["WQA-1"]') where id='WQA-2';
 update dorra_private.war_catalog_provinces set data=jsonb_set(data,'{neighbors}','["WQB-2"]') where id='WQB-1';
 update dorra_private.war_catalog_provinces set data=data||'{"seaNeighbors":["WQB-1"]}' where id='WQA-1';
 update dorra_private.war_catalog_provinces set data=data||'{"seaNeighbors":["WQA-1"]}' where id='WQB-1';
 outcome:=public.dorra_war_command(actor,session_id,lease,'create',null,'{"nationId":"WQA","opponentNationId":"WQB","template":"world","opponent":"ai","pace":"fast","visibility":"public","name":"AI rollback fixture"}',gen_random_uuid());world_id:=(outcome#>>'{view,match,id}')::uuid;
 begin perform public.dorra_war_command(actor,session_id,lease,'create',null,'{"nationId":"WQA","opponentNationId":"WQB","template":"duel","opponent":"ai","pace":"fast","visibility":"public"}',gen_random_uuid());raise exception 'Expected SOLO_MATCH_LIMIT';exception when others then assert sqlerrm='SOLO_MATCH_LIMIT','only one saved solo is allowed per account';end;
 outcome:=public.dorra_war_command(actor,session_id,lease,'list');
 assert exists(select 1 from jsonb_array_elements(outcome->'matches') m where m->>'id'=world_id::text and m->'availableNations' ? 'WQB' and m->'occupiedNations' ? 'WQA'),'lobby discovery returns joinable and occupied nations';
 perform public.dorra_war_command(actor,session_id,lease,'start',world_id,'{}',gen_random_uuid());
 assert (select count(*) from dorra_private.war_events where match_id=world_id and kind='ai')=1,'only the named rival gets active AI events';
 select count(*) into count_before from dorra_private.war_events where match_id=world_id;
 perform dorra_private.war_ai(world_id,'WQC',0);
 assert (select count(*) from dorra_private.war_events where match_id=world_id)=count_before,'neutral AI does not expand or queue orders';
 -- Exercise a prepared research programme deterministically even when this
 -- fixture runs beside the complete production catalogue. Universal level-one
 -- programmes otherwise correctly precede the level-two infrastructure choice.
 update dorra_private.war_sides s set research=(
  select coalesce(jsonb_agg(distinct researched.id),'[]') from (
   select jsonb_array_elements_text(s.research) as id
   union select p.id from dorra_private.war_catalog_platforms p
    where p.id<>'__war_doctrine' and coalesce((p.data->>'level')::integer,1)<=1
     and dorra_private.war_platform_allowed(world_id,'WQB',p.data)
  ) researched
 ) where s.match_id=world_id and s.nation_id='WQB';
 perform dorra_private.war_ai(world_id,'WQB',0);
 assert exists(select 1 from dorra_private.war_units where match_id=world_id and nation_id='WQB' and orders->>'type'='embark' and orders->>'targetProvinceId'='WQA-1'),'island rival follows a mapped maritime invasion route';
 assert exists(select 1 from dorra_private.war_events where match_id=world_id and kind='research' and payload->>'nationId'='WQB'),'named rival researches';
 assert exists(select 1 from dorra_private.war_events where match_id=world_id and kind='research' and payload->>'platformId'='__war_doctrine'),'prepared rival chooses its remaining initial doctrine';
 update dorra_private.war_matches set real_anchor=clock_timestamp()-interval '11 seconds',last_dispatch=clock_timestamp() where id=world_id;
 perform dorra_private.war_advance(world_id,400);
 assert exists(select 1 from dorra_private.war_events where match_id=world_id and kind='build' and payload->>'nationId'='WQB'),'named rival upgrades infrastructure for researched arsenal tiers';
 -- Electronic attack reduces radar from 100 to 65 in the test area, preventing
 -- the same sensor from resolving an 80-stealth target.
 insert into dorra_private.war_catalog_platforms values
 ('__war_radar','War test radar','{"domain":"support","operators":["WQA"],"stats":{"vision":10000,"radar":100,"stealth":0}}'),
 ('__war_stealth','War test stealth','{"domain":"air","operators":["WQB"],"stats":{"stealth":80,"vision":10}}'),
 ('__war_jammer','War test jammer','{"domain":"air","operators":["WQB"],"capabilities":["electronic-attack"],"stats":{"range":10000,"vision":10}}');
 insert into dorra_private.war_units(match_id,nation_id,province_id,platform_id,name,domain) values(world_id,'WQA','WQA-1','__war_radar','Radar fixture','support');
 insert into dorra_private.war_units(match_id,nation_id,province_id,platform_id,name,domain) values(world_id,'WQB','WQB-2','__war_stealth','Stealth fixture','air') returning id into stealth_unit;
 assert (select dorra_private.war_vision(world_id,'WQA',u) from dorra_private.war_units u where id=stealth_unit),'radar sees the target before jamming';
 insert into dorra_private.war_units(match_id,nation_id,province_id,platform_id,name,domain) values(world_id,'WQB','WQB-2','__war_jammer','Jammer fixture','air');
 assert not (select dorra_private.war_vision(world_id,'WQA',u) from dorra_private.war_units u where id=stealth_unit),'electronic attack suppresses radar detection';
 raise notice 'War SQL authority integration tests passed';
end $$;
rollback;
