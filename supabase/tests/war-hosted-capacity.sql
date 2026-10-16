-- HOSTED CAPACITY CHECK: trusted SQL role only, after all four war migrations
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
 -- Every pace advances to the same two game hours. Both combat events are due
 -- in chronological order, not just fast-mode worlds. Keep scheduler healthy.
 update dorra_private.war_matches m set real_anchor=clock_timestamp()-make_interval(secs=>7200.0/m.speed),last_dispatch=clock_timestamp(),next_due=clock_timestamp() where id in(select w.match_id from war_load_worlds w);
 started:=clock_timestamp();perform dorra_private.war_dispatch();dispatch_ms:=extract(epoch from clock_timestamp()-started)*1000;
 select count(*) into remaining from dorra_private.war_events e join war_load_worlds w on w.match_id=e.match_id where e.due<=7200;
 insert into war_load_metrics values('four-world-dispatch',dispatch_ms,jsonb_build_object('remainingDueEvents',remaining,'budgetMs',3000,'withinBudget',dispatch_ms<3000,'allWorldsAdvanced',remaining=0));
 -- A combat pulse schedules the next pulse. The bounded processor intentionally
 -- handles that newly inserted event in the following heartbeat, rather than
 -- recursively draining an arbitrarily large outage backlog in one transaction.
 for pass in 2..4 loop
 exit when remaining=0;
 update dorra_private.war_matches m set next_due=clock_timestamp() where id in(select w.match_id from war_load_worlds w) and status='running';
 started:=clock_timestamp();perform dorra_private.war_dispatch();dispatch_ms:=extract(epoch from clock_timestamp()-started)*1000;
 select count(*) into remaining from dorra_private.war_events e join war_load_worlds w on w.match_id=e.match_id where e.due<=7200;
 insert into war_load_metrics values('four-world-catchup-'||pass,dispatch_ms,jsonb_build_object('remainingDueEvents',remaining,'budgetMs',3000,'withinBudget',dispatch_ms<3000,'allWorldsAdvanced',remaining=0));
 end loop;
 -- Preserve diagnostics even when the capacity target fails. Raising here
 -- would discard the measurements explaining hosted-only lag or SQL errors.
 insert into war_load_metrics values('scheduler-diagnostics',0,jsonb_build_object('caughtUp',remaining=0,'worlds',(
 select jsonb_agg(jsonb_build_object('world',w.world_no,'status',m.status,'gameTime',dorra_private.war_now(m),'errorCount',m.error_count,'lastError',m.last_error,'nextDue',m.next_due,'lastDispatch',m.last_dispatch,'pendingEvents',(select count(*) from dorra_private.war_events e where e.match_id=m.id and e.due<=7200),'firstPendingGameTime',(select min(due) from dorra_private.war_events e where e.match_id=m.id)) order by w.world_no)
 from war_load_worlds w join dorra_private.war_matches m on m.id=w.match_id)));
 for world in select * from war_load_worlds order by world_no loop
 select * into host from war_load_actors a where a.world_no=world.world_no and a.seat=1;
 started:=clock_timestamp();response:=public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'view',world.match_id);
 insert into war_load_metrics values('world-'||world.world_no||'-view',extract(epoch from clock_timestamp()-started)*1000,jsonb_build_object('visibleUnits',jsonb_array_length(response#>'{view,units}'),'totalUnits',(select count(*) from dorra_private.war_units u where u.match_id=world.match_id)));
 initial_projection:=public.dorra_war_projection(host.user_id,world.match_id,null,response->'view');
 response:=public.dorra_war_command(host.user_id,host.session_id,host.lease_id,'view',world.match_id);
 next_projection:=public.dorra_war_projection(host.user_id,world.match_id,(initial_projection#>>'{view,match,revision}')::bigint,response->'view');
 insert into war_load_metrics values('world-'||world.world_no||'-bandwidth',0,jsonb_build_object('snapshotBytes',octet_length(initial_projection::text),'deltaBytes',octet_length(next_projection::text),'deltaWithin10KiB',octet_length(next_projection::text)<10240));
 end loop;
 begin
 -- Supabase realtime.send adds its own UUID 'id' to the stored transport
 -- payload. After removing that envelope field, only matchId/revision are valid.
 insert into war_load_metrics
 select 'realtime-hints',0,jsonb_build_object('telemetryAvailable',true,'scope','Database fixture broadcast rows, not 48 browser connections','messages',count(*),
 'totalPayloadBytes',coalesce(sum(octet_length(h.payload::text)),0),'maxPayloadBytes',coalesce(max(octet_length(h.payload::text)),0),
 'allPrivate',coalesce(bool_and(h.private),true),'transportMayAddId',true,
 'invalidHintCount',count(*) filter(where not h.private or jsonb_typeof(h.payload)<>'object' or not(h.payload ? 'matchId' and h.payload ? 'revision') or (h.payload-'id'-'matchId'-'revision')<>'{}'),
 'error',case when count(*) filter(where not h.private or jsonb_typeof(h.payload)<>'object' or not(h.payload ? 'matchId' and h.payload ? 'revision') or (h.payload-'id'-'matchId'-'revision')<>'{}')>0 then 'Realtime hint exposed unexpected application fields or a public payload' else null end)
 from realtime.messages h join war_load_actors a on h.topic='dorra-war:'||a.user_id::text where h.event='war-changed' and h.extension='broadcast';
 exception when undefined_column or undefined_table or insufficient_privilege then
 insert into war_load_metrics values('realtime-hints',0,jsonb_build_object('telemetryAvailable',false,'scope','Database fixture telemetry unavailable; separate two-browser test remains required','reason',sqlstate));
 end;
 insert into war_load_metrics values('database-during',0,jsonb_build_object('bytes',pg_database_size(current_database()),'fixtureWorlds',(select count(*) from war_load_worlds),'humanMemberships',(select count(*) from war_load_actors),'schedulerErrors',(select coalesce(sum(error_count),0) from dorra_private.war_matches where id in(select w.match_id from war_load_worlds w))));
 insert into war_load_metrics values('total-check',extract(epoch from clock_timestamp()-total_started)*1000,'{}');
end $load$;
select jsonb_build_object(
 'environment','hosted PostgreSQL transaction; rolls back after this result',
 'passed',not exists(select 1 from war_load_metrics where label like 'four-world%' and ms>=3000) and not exists(select 1 from dorra_private.war_matches m join war_load_worlds w on w.match_id=m.id where m.error_count>0) and not exists(select 1 from dorra_private.war_events e join war_load_worlds w on w.match_id=e.match_id where e.due<=7200) and not exists(select 1 from war_load_metrics where label='realtime-hints' and coalesce((details->>'invalidHintCount')::integer,0)>0),
 'catalogue',jsonb_build_object('playableNations',(select count(*) from dorra_private.war_catalog_nations where coalesce((data->>'playable')::boolean,true)),'provinces',(select count(*) from dorra_private.war_catalog_provinces),'platforms',(select count(*) from dorra_private.war_catalog_platforms)),
 'measurements',(select jsonb_agg(jsonb_build_object('label',label,'ms',round(ms,2),'details',details)) from war_load_metrics),
 'cron',(select coalesce(jsonb_agg(jsonb_build_object('jobname',jobname,'active',active)),'[]') from cron.job where jobname in('dorra-war-dispatch','dorra-war-maintenance'))
) as war_hosted_capacity_report;
rollback;
