-- HOSTED CAPACITY CHECK: trusted SQL role only, after all war migrations
-- and the final catalogue seed. Do not run alongside the browser QA worlds.
-- This transaction creates only disposable users/worlds and always rolls back.
-- No real player's state or existing world is modified.
begin;
set local statement_timeout='90s';
set local lock_timeout='2s';
create temporary table war_load_metrics(label text,ms numeric,details jsonb default '{}') on commit drop;
create temporary table war_load_actors(world_no integer,seat integer,user_id uuid,session_id uuid,lease_id uuid,nation_id text,primary key(world_no,seat)) on commit drop;
create temporary table war_load_worlds(world_no integer,match_id uuid,primary key(world_no)) on commit drop;
do $load$
declare
 nations text[]:=array['AU','NZ','US','GB','FR','DE','RU','CN','IN','JP','CA','BR'];
 actor record;host record;world record;w_index integer;s_index integer;started timestamptz;total_started timestamptz:=clock_timestamp();
 response jsonb;initial_projection jsonb;next_projection jsonb;view_data jsonb;m_id uuid;new_user uuid;new_session uuid;new_lease uuid;
 fixture_tag text:=substr(replace(gen_random_uuid()::text,'-',''),1,8);target text;movement_unit uuid;dispatch_ms numeric;remaining integer;pass integer;
begin
 if exists(select 1 from dorra_private.war_matches where status='running') then raise exception 'WAR_LOAD_TEST_REQUIRES_IDLE_CAPACITY: finish or pause QA worlds first';end if;
 if (select count(*) from dorra_private.war_catalog_provinces)<4000 then raise exception 'WAR_LOAD_TEST_REQUIRES_FULL_CATALOGUE';end if;
 if exists(select 1 from unnest(nations) n(id) where not exists(select 1 from dorra_private.war_catalog_nations c where c.id=n.id and coalesce((c.data->>'playable')::boolean,true))) then raise exception 'WAR_LOAD_TEST_NATION_UNAVAILABLE';end if;
 insert into war_load_metrics values('database-before',0,jsonb_build_object('bytes',pg_database_size(current_database())));
 for w_index in 1..4 loop
 for s_index in 1..12 loop
 new_user:=gen_random_uuid();new_session:=gen_random_uuid();new_lease:=gen_random_uuid();
 insert into auth.users(id,raw_user_meta_data) values(new_user,jsonb_build_object('username','wl_'||fixture_tag||'_'||w_index||'_'||s_index));
 -- Supabase's real profile trigger already creates the profile. The fallback
 -- supports the local service stubs without changing hosted auth behaviour.
 if not exists(select 1 from dorra_private.profiles where user_id=new_user) then insert into dorra_private.profiles(user_id) values(new_user);end if;
 insert into auth.sessions(id,user_id) values(new_session,new_user);
 insert into dorra_private.player_state(user_id,auth_session_id,lease_id,snapshot) values(new_user,new_session,new_lease,'{"balance":1000,"progress":{}}');
 insert into war_load_actors values(w_index,s_index,new_user,new_session,new_lease,nations[s_index]);
 end loop;
 select * into host from war_load_actors a where a.world_no=w_index and a.seat=1;
 started:=clock_timestamp();
 response:=public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'create',null,jsonb_build_object('nationId','AU','opponentNationId','NZ','template','world','opponent','human','pace',case when w_index%2=1 then 'fast' else 'persistent' end,'visibility','invite','name','Rollback capacity '||fixture_tag||' '||w_index),gen_random_uuid());
 m_id:=(response#>>'{view,match,id}')::uuid;
 if exists(select 1 from dorra_private.war_units u join dorra_private.war_catalog_nations n on n.id=u.nation_id where u.match_id=m_id and u.nation_id in('AU','NZ') and u.province_id<>n.data->>'capitalProvinceId') then raise exception 'WAR_LOAD_TEST_WRONG_NATIONAL_CAPITAL';end if;
 insert into war_load_worlds values(w_index,m_id);
 insert into war_load_metrics values('world-'||w_index||'-create',extract(epoch from clock_timestamp()-started)*1000,jsonb_build_object('snapshotBytes',octet_length(response::text)));
 started:=clock_timestamp();
 for actor in select * from war_load_actors a where a.world_no=w_index and a.seat>1 order by a.seat loop
 perform public.dorra_war_command(actor.user_id,actor.session_id,actor.lease_id,'join',m_id,jsonb_build_object('nationId',actor.nation_id,'inviteCode',response#>>'{view,match,inviteCode}'),gen_random_uuid());
 end loop;
 insert into war_load_metrics values('world-'||w_index||'-join-11',extract(epoch from clock_timestamp()-started)*1000,'{}');
 started:=clock_timestamp();perform public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'start',m_id,'{}',gen_random_uuid());
 insert into war_load_metrics values('world-'||w_index||'-start',extract(epoch from clock_timestamp()-started)*1000,'{}');
 -- Seed one real hostile engagement per world, using actual scenario platforms.
 -- Co-location is deliberate test setup, not a public movement API bypass.
 perform public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'diplomacy',m_id,'{"nationId":"NZ","type":"war"}',gen_random_uuid());
 select c.data->>'capitalProvinceId' into target from dorra_private.war_catalog_nations c where id='NZ';
 select u.id into movement_unit from dorra_private.war_units u where u.match_id=m_id and u.nation_id='AU' and u.domain='land' order by strength desc,u.id limit 1;
 update dorra_private.war_units set province_id=target,orders='{}' where id=movement_unit;
 end loop;
end $load$;
do $profile$
declare world record;started timestamptz;pass integer;remaining integer;
begin
 update dorra_private.war_matches m set real_anchor=clock_timestamp()-make_interval(secs=>7200.0/m.speed),last_dispatch=clock_timestamp(),next_due=clock_timestamp() where id in(select match_id from war_load_worlds);
 for pass in 1..2 loop
 for world in select * from war_load_worlds order by world_no loop
 started:=clock_timestamp();perform dorra_private.war_advance(world.match_id,160);
 insert into war_load_metrics values('advance-'||pass||'-world-'||world.world_no,extract(epoch from clock_timestamp()-started)*1000,'{}');
 started:=clock_timestamp();perform dorra_private.war_notify(world.match_id);
 insert into war_load_metrics values('notify-'||pass||'-world-'||world.world_no,extract(epoch from clock_timestamp()-started)*1000,'{}');
 end loop;end loop;
 select count(*) into remaining from dorra_private.war_events where match_id in(select match_id from war_load_worlds) and due<=7200;
 insert into war_load_metrics values('remaining-due',0,jsonb_build_object('count',remaining));
 select * into world from war_load_worlds where world_no=1;
 started:=clock_timestamp();perform dorra_private.war_finish(world.match_id,7200);
 insert into war_load_metrics values('isolated-finish',extract(epoch from clock_timestamp()-started)*1000,'{}');
 started:=clock_timestamp();perform dorra_private.war_field_support(world.match_id);
 insert into war_load_metrics values('isolated-field-support',extract(epoch from clock_timestamp()-started)*1000,'{}');
 started:=clock_timestamp();perform dorra_private.war_combat(world.match_id,7200);
 insert into war_load_metrics values('isolated-combat',extract(epoch from clock_timestamp()-started)*1000,'{}');
end $profile$;
select jsonb_agg(jsonb_build_object('label',label,'ms',round(ms,2),'details',details)) as war_dispatch_profile from war_load_metrics;
rollback;
