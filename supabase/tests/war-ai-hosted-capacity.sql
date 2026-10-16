-- Trusted SQL role only, after every war migration and the production catalogue.
-- Run while no real or browser-QA worlds are running. All fixture data rolls back.
-- This measures four full worlds with one human host and one active veteran AI
-- each. It is a scheduler/decision envelope, not evidence of player win rates.
begin;
set local statement_timeout='90s';
set local lock_timeout='2s';
create temporary table war_ai_load_metrics(label text,ms numeric,details jsonb default '{}') on commit drop;
create temporary table war_ai_load_worlds(world_no integer primary key,match_id uuid,host_id uuid,session_id uuid,lease_id uuid,host_nation text,rival_nation text) on commit drop;
do $load$
declare hosts text[]:=array['AU','DE','CA','BR'];rivals text[]:=array['NZ','FR','US','ZA'];
 w integer;phase integer;pass integer;used_passes integer;world record;actor uuid;sid uuid;lease uuid;mid uuid;response jsonb;view_data jsonb;visible_ids jsonb;
 started timestamptz;total_started timestamptz:=clock_timestamp();elapsed numeric;first_decision numeric;cadence numeric;target numeric;remaining integer;bad integer;contact uuid;capital text;
 tag text:=substr(replace(gen_random_uuid()::text,'-',''),1,8);
begin
 if exists(select 1 from dorra_private.war_matches where status='running') then raise exception 'WAR_AI_LOAD_REQUIRES_IDLE_CAPACITY';end if;
 if (select count(*) from dorra_private.war_catalog_provinces)<4000 or (select count(*) from dorra_private.war_catalog_platforms)<95 then raise exception 'WAR_AI_LOAD_REQUIRES_FULL_CATALOGUE';end if;
 cadence:=(dorra_private.war_ai_profile('veteran')->>'cadenceSeconds')::numeric;
 for w in 1..4 loop
  actor:=gen_random_uuid();sid:=gen_random_uuid();lease:=gen_random_uuid();
  insert into auth.users(id,raw_user_meta_data) values(actor,jsonb_build_object('username','wai_'||tag||'_'||w));
  if not exists(select 1 from dorra_private.profiles where user_id=actor) then insert into dorra_private.profiles(user_id) values(actor);end if;
  insert into auth.sessions(id,user_id) values(sid,actor);
  insert into dorra_private.player_state(user_id,auth_session_id,lease_id,snapshot) values(actor,sid,lease,'{"balance":1000,"progress":{}}');
  started:=clock_timestamp();
  response:=public.dorra_war_command(actor,sid,lease,'create',null,jsonb_build_object('nationId',hosts[w],'opponentNationId',rivals[w],'template','world','opponent','ai','aiDifficulty','veteran','pace',case when w%2=1 then 'fast' else 'persistent' end,'visibility','invite','name','Rollback solo capacity '||tag||' '||w),gen_random_uuid());
  mid:=(response#>>'{view,match,id}')::uuid;
  assert response#>>'{view,match,aiDifficulty}'='veteran','requested difficulty is authoritative';
  insert into war_ai_load_worlds values(w,mid,actor,sid,lease,hosts[w],rivals[w]);
  insert into war_ai_load_metrics values('world-'||w||'-create',extract(epoch from clock_timestamp()-started)*1000,jsonb_build_object('host',hosts[w],'rival',rivals[w],'snapshotBytes',octet_length(response::text)));
  perform public.dorra_war_command(actor,sid,lease,'start',mid,'{}',gen_random_uuid());
  assert (select count(*) from dorra_private.war_sides where match_id=mid and is_ai and active_ai)=1,'only named rival runs strategic AI';
  -- A future wall-clock anchor freezes only these disposable scenario clocks.
  -- CPU speed cannot cause extra game hours while this SQL check is running.
  update dorra_private.war_matches set game_anchor=0,real_anchor=clock_timestamp()+interval '1 hour',last_dispatch=clock_timestamp(),next_due=clock_timestamp()+interval '1 hour' where id=mid;
 end loop;
 select max(e.due) into first_decision from dorra_private.war_events e join war_ai_load_worlds w on w.match_id=e.match_id where e.kind='ai';
 assert first_decision between 3600 and 3900,'AI opening gives a real game-hour preparation window';
 -- Time one ordinary first decision per full world. The deliberate private
 -- exception rolls back its orders/payments, leaving cron to execute it once.
 for world in select * from war_ai_load_worlds order by world_no loop
  started:=clock_timestamp();
  begin
   perform dorra_private.war_ai(world.match_id,world.rival_nation,first_decision);
   elapsed:=extract(epoch from clock_timestamp()-started)*1000;
   raise sqlstate 'ZAI01' using message='rollback isolated AI timing';
  exception when sqlstate 'ZAI01' then null;end;
  insert into war_ai_load_metrics values('world-'||world.world_no||'-isolated-decision',elapsed,jsonb_build_object('gameTime',first_decision,'rival',world.rival_nation,'changesRolledBack',true));
 end loop;
 for phase in 0..2 loop
  target:=first_decision+cadence*phase+1;
  update dorra_private.war_matches m set game_anchor=target,real_anchor=clock_timestamp()+interval '1 hour',last_dispatch=clock_timestamp(),next_due=clock_timestamp()
   where id in(select match_id from war_ai_load_worlds) and status='running';
  for pass in 1..6 loop
   used_passes:=pass;
   started:=clock_timestamp();perform dorra_private.war_dispatch();elapsed:=extract(epoch from clock_timestamp()-started)*1000;
   select count(*) into remaining from dorra_private.war_events e join war_ai_load_worlds w on w.match_id=e.match_id join dorra_private.war_matches m on m.id=e.match_id where m.status='running' and e.due<=target;
   insert into war_ai_load_metrics values('phase-'||phase||'-dispatch-'||pass,elapsed,jsonb_build_object('gameTime',target,'remainingDueEvents',remaining,'budgetMs',3000,'withinBudget',elapsed<3000));
   exit when remaining=0;
   update dorra_private.war_matches m set next_due=clock_timestamp(),last_dispatch=clock_timestamp() where id in(select match_id from war_ai_load_worlds) and status='running' and exists(select 1 from dorra_private.war_events e where e.match_id=m.id and e.due<=target);
  end loop;
  insert into war_ai_load_metrics values('phase-'||phase||'-recovery',0,jsonb_build_object('caughtUp',remaining=0,'passes',used_passes,'remainingDueEvents',remaining,'cadenceCorrect',not exists(
   select 1 from war_ai_load_worlds w where (select count(*) from dorra_private.war_events e where e.match_id=w.match_id and e.kind='ai' and e.payload->>'nationId'=w.rival_nation)<>1
   or (select min(e.due) from dorra_private.war_events e where e.match_id=w.match_id and e.kind='ai' and e.payload->>'nationId'=w.rival_nation)<>first_decision+cadence*(phase+1))));
  insert into war_ai_load_metrics
   select 'phase-'||phase||'-world-'||w.world_no||'-decisions',0,jsonb_build_object('rival',w.rival_nation,'gameTime',target,
    'queuedResearch',(select count(*) from dorra_private.war_events e where e.match_id=w.match_id and e.kind='research' and e.payload->>'nationId'=w.rival_nation),
    'queuedBuilds',(select count(*) from dorra_private.war_events e where e.match_id=w.match_id and e.kind='build' and e.payload->>'nationId'=w.rival_nation),
    'queuedProduction',(select count(*) from dorra_private.war_events e where e.match_id=w.match_id and e.kind='produce' and e.payload->>'nationId'=w.rival_nation),
    'formations',(select count(*) from dorra_private.war_units u where u.match_id=w.match_id and u.nation_id=w.rival_nation),
    'movingFormations',(select count(*) from dorra_private.war_units u where u.match_id=w.match_id and u.nation_id=w.rival_nation and u.orders<>'{}'),
    'resources',(select resources from dorra_private.war_sides s where s.match_id=w.match_id and s.nation_id=w.rival_nation),
    'research',(select research from dorra_private.war_sides s where s.match_id=w.match_id and s.nation_id=w.rival_nation)) from war_ai_load_worlds w;
 end loop;
 for world in select * from war_ai_load_worlds order by world_no loop
  -- Make the foreign-field privacy assertion meaningful even for distant
  -- capitals. This deliberate post-simulation contact setup affects no timing
  -- phase, performs no public movement bypass and rolls back with the fixture.
  select u.id into contact from dorra_private.war_units u where u.match_id=world.match_id and u.nation_id=world.rival_nation and u.domain='land' and u.health>0 order by u.id limit 1;
  select data->>'capitalProvinceId' into capital from dorra_private.war_catalog_nations where id=world.host_nation;
  assert contact is not null and capital is not null,'privacy fixture requires a surviving visible contact';
  update dorra_private.war_units set province_id=capital,entrenchment=7,intercept_ready_at=777 where id=contact;
  started:=clock_timestamp();view_data:=dorra_private.war_view(world.match_id,world.host_id);
  select coalesce(jsonb_agg(u.id::text order by u.id),'[]') into visible_ids from dorra_private.war_visible_units(world.match_id,world.host_nation) u;
  select count(*) into bad from (
   (select jsonb_array_elements_text(visible_ids) id except select u->>'id' from jsonb_array_elements(view_data->'units') u)
   union all (select u->>'id' from jsonb_array_elements(view_data->'units') u except select jsonb_array_elements_text(visible_ids) id)
  ) differences;
  assert bad=0,'host projection contains exactly the ordinary visible formations';
  assert exists(select 1 from jsonb_array_elements(view_data->'units') u where u->>'id'=contact::text),'foreign privacy checks include a genuinely visible rival formation';
  assert not exists(select 1 from jsonb_array_elements(view_data->'units') u where u->>'nationId'<>world.host_nation and (coalesce(u->'order','{}'::jsonb)<>'null'::jsonb or u ?| array['supply','entrenchment','baseCarrierId','interceptReadyAt'])),'AI order and readiness details stay private';
  assert not exists(select 1 from jsonb_array_elements(view_data->'provinces') p where p->>'ownerId'<>world.host_nation and coalesce(p->'facilities','{}'::jsonb)<>'null'::jsonb),'AI facilities stay private';
  insert into war_ai_load_metrics values('world-'||world.world_no||'-filtered-view',extract(epoch from clock_timestamp()-started)*1000,jsonb_build_object('visibilityDifferences',bad,'visibleUnits',jsonb_array_length(view_data->'units'),'totalUnits',(select count(*) from dorra_private.war_units where match_id=world.match_id)));
 end loop;
 insert into war_ai_load_metrics values('diagnostics',0,jsonb_build_object('targetGameTime',target,'remainingDueEvents',remaining,'schedulerErrors',(select coalesce(sum(error_count),0) from dorra_private.war_matches m join war_ai_load_worlds w on w.match_id=m.id),'worlds',(
  select jsonb_agg(jsonb_build_object('world',w.world_no,'status',m.status,'errorCount',m.error_count,'lastError',m.last_error,'nextAIEvent',(select min(e.due) from dorra_private.war_events e where e.match_id=m.id and e.kind='ai')) order by w.world_no) from war_ai_load_worlds w join dorra_private.war_matches m on m.id=w.match_id)));
 insert into war_ai_load_metrics values('total-check',extract(epoch from clock_timestamp()-total_started)*1000,'{}');
end $load$;
select jsonb_build_object(
 'environment','PostgreSQL transaction; all four solo worlds and users roll back',
 'scope','veteran first decision plus two cadences; fixed game clocks, not player win-rate evidence',
 'passed',not exists(select 1 from war_ai_load_metrics where label like 'phase-%-dispatch-%' and ms>=3000)
  and not exists(select 1 from war_ai_load_metrics where label like 'phase-%-recovery' and (not coalesce((details->>'caughtUp')::boolean,false) or not coalesce((details->>'cadenceCorrect')::boolean,false)))
  and not exists(select 1 from dorra_private.war_matches m join war_ai_load_worlds w on w.match_id=m.id where m.error_count>0)
  and not exists(select 1 from dorra_private.war_events e join war_ai_load_worlds w on w.match_id=e.match_id join dorra_private.war_matches m on m.id=e.match_id where m.status='running' and e.due<=dorra_private.war_now(m)),
 'catalogue',jsonb_build_object('nations',(select count(*) from dorra_private.war_catalog_nations),'provinces',(select count(*) from dorra_private.war_catalog_provinces),'platforms',(select count(*) from dorra_private.war_catalog_platforms)),
 'measurements',(select jsonb_agg(jsonb_build_object('label',label,'ms',round(ms,2),'details',details)) from war_ai_load_metrics)
) as war_ai_hosted_capacity_report;
rollback;
