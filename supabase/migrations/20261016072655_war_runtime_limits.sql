-- Follow-up to the deployed war engine: preserve unfinished campaigns, bound
-- Free-tier growth, and avoid repeating every observer's fog query on reads.
create index war_events_nation_kind on dorra_private.war_events(match_id,kind,(payload->>'nationId'));
create index war_events_province_kind on dorra_private.war_events(match_id,kind,(payload->>'provinceId'));
alter table dorra_private.war_matches add column notify_dirty boolean not null default true;

-- Build a candidate set using indexed ownership/relations and small sensor
-- bounding boxes. Do not call a correlated visibility function for every one
-- of the world's units for every connected observer.
create function dorra_private.war_visible_units(mid uuid,nid text) returns setof dorra_private.war_units
language sql stable set search_path='' as $$
 with own as materialized(select * from dorra_private.war_units where match_id=mid and nation_id=nid and health>0),
 visible_ids as(
 select id from own
 union select u.id from dorra_private.war_units u join dorra_private.war_provinces p on p.match_id=mid and p.province_id=u.province_id and p.nation_id=nid where u.match_id=mid
 union select u.id from dorra_private.war_relations r join dorra_private.war_units u on u.match_id=mid and u.nation_id=(case when r.a=nid then r.b else r.a end) where r.match_id=mid and r.relation='alliance' and nid in(r.a,r.b)
 union select enemy.id from own scout join dorra_private.war_catalog_platforms sensor on sensor.id=scout.platform_id
 join dorra_private.war_catalog_provinces scout_geo on scout_geo.id=scout.province_id
 join dorra_private.war_units enemy on enemy.match_id=mid and enemy.nation_id<>nid and enemy.health>0
 join dorra_private.war_catalog_provinces enemy_geo on enemy_geo.id=enemy.province_id
 join dorra_private.war_catalog_platforms enemy_platform on enemy_platform.id=enemy.platform_id
 where abs((scout_geo.data->>'lat')::numeric-(enemy_geo.data->>'lat')::numeric)<=coalesce((sensor.data#>>'{stats,vision}')::numeric,100)*1.15/110
 and dorra_private.war_distance(scout.province_id,enemy.province_id)<=coalesce((sensor.data#>>'{stats,vision}')::numeric,100)*(case when exists(select 1 from dorra_private.war_sides s where s.match_id=mid and s.nation_id=nid and s.research ? 'networked-command') then 1.15 else 1 end)
 and (coalesce((enemy_platform.data#>>'{stats,stealth}')::numeric,0)<=coalesce((sensor.data#>>'{stats,radar}')::numeric,0)*dorra_private.war_ecm(mid,nid,scout.province_id) or scout.province_id=enemy.province_id)
 ) select u.* from dorra_private.war_units u join visible_ids v on v.id=u.id
$$;
revoke all on function dorra_private.war_visible_units(uuid,text) from public,anon,authenticated;
grant execute on function dorra_private.war_visible_units(uuid,text) to service_role;

create function dorra_private.war_mark_dirty() returns trigger language plpgsql set search_path='' as $$
declare mid uuid;
begin
 if tg_table_name='war_sides' and tg_op='UPDATE' then
 if jsonb_build_array(new.user_id,new.is_ai,new.retired,new.research,new.import_licenses) is not distinct from jsonb_build_array(old.user_id,old.is_ai,old.retired,old.research,old.import_licenses) then return null;end if;
 elsif tg_table_name='war_events' then
 if coalesce(new.kind,old.kind) not in('research','produce','build') then return null;end if;
 end if;
 mid:=coalesce(new.match_id,old.match_id);
 update dorra_private.war_matches set notify_dirty=true where id=mid and not notify_dirty;
 return null;
end $$;
revoke all on function dorra_private.war_mark_dirty() from public,anon,authenticated;
grant execute on function dorra_private.war_mark_dirty() to service_role;
create trigger war_units_dirty after insert or update or delete on dorra_private.war_units for each row execute function dorra_private.war_mark_dirty();
create trigger war_provinces_dirty after insert or update or delete on dorra_private.war_provinces for each row execute function dorra_private.war_mark_dirty();
create trigger war_sides_dirty after insert or update or delete on dorra_private.war_sides for each row execute function dorra_private.war_mark_dirty();
create trigger war_relations_dirty after insert or update or delete on dorra_private.war_relations for each row execute function dorra_private.war_mark_dirty();
create trigger war_queues_dirty after insert or delete on dorra_private.war_events for each row execute function dorra_private.war_mark_dirty();

create function dorra_private.war_roster_notify(mid uuid) returns void
language plpgsql set search_path='' as $$
declare observer record;
begin
 for observer in update dorra_private.war_observers set revision=revision+1,last_hint=now() where match_id=mid returning user_id,revision loop
 begin perform realtime.send(jsonb_build_object('matchId',mid,'revision',observer.revision),'war-changed','dorra-war:'||observer.user_id::text,true);exception when others then null;end;
 end loop;
end $$;
revoke all on function dorra_private.war_roster_notify(uuid) from public,anon,authenticated;
grant execute on function dorra_private.war_roster_notify(uuid) to service_role;

-- Change only exact, reviewed fragments of the already-deployed functions. A
-- missing fragment aborts migration instead of silently leaving old behaviour.
do $patch$
declare definition text;needle text;replacement text;
begin
 definition:=pg_get_functiondef('public.dorra_war_command(uuid,uuid,uuid,text,uuid,jsonb,uuid)'::regprocedure);
 needle:=$old$ if p_action='create' then
 perform pg_advisory_xact_lock(81240616);$old$;
 replacement:=$new$ if p_action='create' then
 perform pg_advisory_xact_lock(81240616);
 if pg_database_size(current_database())>=419430400 then raise exception 'STORAGE_CAPACITY';end if;$new$;
 if strpos(definition,needle)=0 then raise exception 'war storage guard patch did not match';end if;
 definition:=replace(definition,needle,replacement);
 needle:=$old$'hostId',wm.host_id,'maxPlayers'$old$;
 replacement:=$new$'hostId',wm.host_id,'inviteMatched',wm.visibility='invite' and wm.invite_code::text=p_args->>'inviteCode','maxPlayers'$new$;
 if strpos(definition,needle)=0 then raise exception 'war invite match marker patch did not match';end if;
 definition:=replace(definition,needle,replacement);
 needle:=$old$status='lobby' and w.id::text=p_args->>'matchId' and invite_code::text=p_args->>'inviteCode'$old$;
 replacement:=$new$status='lobby' and (p_args->>'matchId' is null or w.id::text=p_args->>'matchId') and invite_code::text=p_args->>'inviteCode'$new$;
 if strpos(definition,needle)=0 then raise exception 'war code-only invite patch did not match';end if;
 definition:=replace(definition,needle,replacement);
 needle:=$old$if not exists(select 1 from dorra_private.war_catalog_nations where id=nid) then raise exception 'CATALOG_NOT_READY';end if;$old$;
 replacement:=$new$if not exists(select 1 from dorra_private.war_catalog_nations where id=nid and coalesce((data->>'playable')::boolean,true)) then raise exception 'CATALOG_NOT_READY';end if;$new$;
 if strpos(definition,needle)=0 then raise exception 'war nation eligibility patch did not match';end if;
 definition:=replace(definition,needle,replacement);
 needle:=$old$not exists(select 1 from dorra_private.war_catalog_nations where id=other)$old$;
 replacement:=$new$not exists(select 1 from dorra_private.war_catalog_nations where id=other and coalesce((data->>'playable')::boolean,true))$new$;
 if strpos(definition,needle)=0 then raise exception 'war opponent eligibility patch did not match';end if;
 definition:=replace(definition,needle,replacement);
 needle:=$old$from dorra_private.war_catalog_nations n where m.template='world' or n.id in(nid,other);$old$;
 replacement:=$new$from dorra_private.war_catalog_nations n where coalesce((n.data->>'playable')::boolean,true) and (m.template='world' or n.id in(nid,other));$new$;
 if strpos(definition,needle)=0 then raise exception 'war sovereign world patch did not match';end if;
 definition:=replace(definition,needle,replacement);
 -- A direct response already updates its caller. Read-only polls must not scan
 -- every other observer or broadcast merely because somebody looked at a map.
 needle:=$old$ perform dorra_private.war_notify(mid);
 res:=res||jsonb_build_object$old$;
 replacement:=$new$ if p_action in('join','start','pause','resume','retire') then perform dorra_private.war_roster_notify(mid);end if;
 res:=res||jsonb_build_object$new$;
 if strpos(definition,needle)=0 then raise exception 'war command notification patch did not match';end if;
 definition:=replace(definition,needle,replacement);
 needle:=$old$ end loop;end loop;
 insert into dorra_private.war_observers(match_id,user_id) values(mid,p_user_id);$old$;
 replacement:=$new$ end loop;
 -- Authored national hardware is an original scenario starting force, never a
 -- claim about an actual country's inventory. No operator is invented.
 for p in select cp.* from dorra_private.war_catalog_platforms cp where cp.data->'operators' ? q.nation_id
 and cp.data->>'domain'='land' and not coalesce((cp.data->>'abstractCapability')::boolean,false)
 and coalesce(cp.data->>'role',cp.data->>'branch') in('armor','infantry')
 order by coalesce((cp.data->>'level')::integer,1) desc,cp.id limit 1 loop
 insert into dorra_private.war_units(match_id,nation_id,province_id,platform_id,name,domain,strength) values(mid,q.nation_id,target,p.id,p.name,'land',greatest(1,least(2,ceil(coalesce((q.data->>'military')::numeric,10)/45))));
 update dorra_private.war_sides set research=case when research ? p.id then research else research||jsonb_build_array(p.id) end where match_id=mid and nation_id=q.nation_id;
 end loop;
 if coalesce((q.data->>'military')::numeric,10)>=70 then
 for p in select cp.* from dorra_private.war_catalog_platforms cp where cp.data->'operators' ? q.nation_id and cp.data->>'domain'='air'
 and not coalesce((cp.data->>'abstractCapability')::boolean,false) and coalesce((cp.data->>'level')::integer,1)<=3 order by coalesce((cp.data->>'level')::integer,1) desc,cp.id limit 1 loop
 insert into dorra_private.war_units(match_id,nation_id,province_id,platform_id,name,domain) values(mid,q.nation_id,target,p.id,p.name,'air');
 update dorra_private.war_sides set research=case when research ? p.id then research else research||jsonb_build_array(p.id) end where match_id=mid and nation_id=q.nation_id;
 end loop;end if;
 end loop;
 insert into dorra_private.war_observers(match_id,user_id) values(mid,p_user_id);$new$;
 if strpos(definition,needle)=0 then raise exception 'war authentic starter patch did not match';end if;
 definition:=replace(definition,needle,replacement);
 execute definition;

 -- Restrict pair generation to declared hostile nations before evaluating
 -- per-platform range/visibility. Peaceful neutral forces never form N² pairs.
 definition:=pg_get_functiondef('dorra_private.war_combat(uuid,numeric)'::regprocedure);
 needle:=$old$ join dorra_private.war_units attacker on attacker.match_id=defender.match_id and attacker.nation_id<>defender.nation_id and attacker.health>0$old$;
 replacement:=$new$ join dorra_private.war_relations hostility on hostility.match_id=defender.match_id and hostility.relation='war' and defender.nation_id in(hostility.a,hostility.b)
 join dorra_private.war_units attacker on attacker.match_id=defender.match_id and attacker.nation_id=(case when defender.nation_id=hostility.a then hostility.b else hostility.a end) and attacker.health>0$new$;
 if strpos(definition,needle)=0 then raise exception 'war hostile pair patch did not match';end if;
 definition:=replace(definition,needle,replacement);
 needle:=$old$ for damage in
 select defender.id$old$;
 replacement:=$new$ for damage in
 with hostile_nations as materialized(select a,b from dorra_private.war_relations where match_id=mid and relation='war'),
 pair_ids as materialized(
 select d.id defender_id,a.id attacker_id from hostile_nations r
 join dorra_private.war_units d on d.match_id=mid and d.nation_id in(r.a,r.b) and d.health>0
 join dorra_private.war_units a on a.match_id=mid and a.nation_id=(case when d.nation_id=r.a then r.b else r.a end) and a.health>0 and a.domain<>'missile'
 where (a.province_id=d.province_id or (a.orders->>'type' in('bombard','patrol','intercept') and (a.orders->>'type'<>'bombard' or a.orders->>'targetProvinceId'=d.province_id)))
 and (a.orders='{}' or a.orders->>'type' in('bombard','patrol','intercept')))
 select defender.id$new$;
 if strpos(definition,needle)=0 then raise exception 'war materialized combat candidates patch did not match';end if;
 definition:=replace(definition,needle,replacement);
 needle:=$old$ from dorra_private.war_units defender$old$;
 replacement:=$new$ from pair_ids pair join dorra_private.war_units defender on defender.id=pair.defender_id$new$;
 if strpos(definition,needle)=0 then raise exception 'war combat defender lookup patch did not match';end if;
 definition:=replace(definition,needle,replacement);
 needle:=$old$ join dorra_private.war_relations hostility on hostility.match_id=defender.match_id and hostility.relation='war' and defender.nation_id in(hostility.a,hostility.b)
 join dorra_private.war_units attacker on attacker.match_id=defender.match_id and attacker.nation_id=(case when defender.nation_id=hostility.a then hostility.b else hostility.a end) and attacker.health>0$old$;
 replacement:=$new$ join dorra_private.war_units attacker on attacker.id=pair.attacker_id$new$;
 if strpos(definition,needle)=0 then raise exception 'war combat attacker lookup patch did not match';end if;
 definition:=replace(definition,needle,replacement);
 needle:=$old$ for front in select distinct province_id,nation_id from dorra_private.war_units where match_id=mid and domain='land' and health>0 loop$old$;
 replacement:=$new$ for front in select distinct capture_unit.province_id,capture_unit.nation_id from dorra_private.war_units capture_unit join dorra_private.war_provinces p on p.match_id=mid and p.province_id=capture_unit.province_id and p.nation_id<>capture_unit.nation_id where capture_unit.match_id=mid and capture_unit.domain='land' and capture_unit.health>0 and dorra_private.war_relation(mid,capture_unit.nation_id,p.nation_id)='war' loop$new$;
 if strpos(definition,needle)=0 then raise exception 'war capture candidate patch did not match';end if;
 execute replace(definition,needle,replacement);

 -- Cheap latitude culling avoids great-circle queries for sensors on another
 -- continent. The exact range, radar, stealth and ECM tests still decide sight.
 definition:=pg_get_functiondef('dorra_private.war_vision(uuid,text,dorra_private.war_units)'::regprocedure);
 needle:=$old$ join dorra_private.war_catalog_platforms ep on ep.id=u.platform_id
 where scout.match_id=mid and scout.nation_id=observer and scout.health>0 and$old$;
 replacement:=$new$ join dorra_private.war_catalog_platforms ep on ep.id=u.platform_id
 join dorra_private.war_catalog_provinces scout_geo on scout_geo.id=scout.province_id
 join dorra_private.war_catalog_provinces target_geo on target_geo.id=u.province_id
 where scout.match_id=mid and scout.nation_id=observer and scout.health>0
 and abs((scout_geo.data->>'lat')::numeric-(target_geo.data->>'lat')::numeric)<=coalesce((sp.data#>>'{stats,vision}')::numeric,100)*1.15/110 and$new$;
 if strpos(definition,needle)=0 then raise exception 'war sensor culling patch did not match';end if;
 execute replace(definition,needle,replacement);

 definition:=pg_get_functiondef('dorra_private.war_notify(uuid)'::regprocedure);
 needle:=$old$begin
 select md5$old$;
 replacement:=$new$begin
 if not coalesce((select notify_dirty from dorra_private.war_matches where id=mid),false) then return;end if;
 select md5$new$;
 if strpos(definition,needle)=0 then raise exception 'war quiet match notifier patch did not match';end if;
 definition:=replace(definition,needle,replacement);
 needle:=$old$'public',public_fingerprint,'status'$old$;
 replacement:=$new$'public',public_fingerprint,'roster',(select coalesce(jsonb_agg(jsonb_build_array(nation_id,user_id,retired) order by nation_id),'[]') from dorra_private.war_sides where match_id=mid),'status'$new$;
 if strpos(definition,needle)=0 then raise exception 'war roster fingerprint patch did not match';end if;
 definition:=replace(definition,needle,replacement);
 needle:=$old$u.match_id=mid and dorra_private.war_vision(mid,sid,u)$old$;
 replacement:=$new$u.match_id=mid and u.id in(select id from dorra_private.war_visible_units(mid,sid))$new$;
 if strpos(definition,needle)=0 then raise exception 'war visible-set notifier patch did not match';end if;
 definition:=replace(definition,needle,replacement);
 needle:=$old$ end loop;
end $old$;
 replacement:=$new$ end loop;
 update dorra_private.war_matches set notify_dirty=false where id=mid;
end $new$;
 if strpos(definition,needle)=0 then raise exception 'war notifier clean marker patch did not match';end if;
 execute replace(definition,needle,replacement);

 definition:=pg_get_functiondef('dorra_private.war_view(uuid,uuid)'::regprocedure);
 needle:=$old$u.match_id=mid and dorra_private.war_vision(mid,s.nation_id,u)$old$;
 replacement:=$new$u.match_id=mid and u.id in(select id from dorra_private.war_visible_units(mid,s.nation_id))$new$;
 if strpos(definition,needle)=0 then raise exception 'war visible-set view patch did not match';end if;
 execute replace(definition,needle,replacement);
end $patch$;

create function dorra_private.war_maintenance() returns void
language plpgsql security definer set search_path='' as $$
declare old_world record;
begin
 -- Only this feature's cron history is pruned. Other House cron jobs retain
 -- their diagnostics and no unfinished world is touched.
 if to_regclass('cron.job_run_details') is not null then
 execute $prune$delete from cron.job_run_details d using cron.job j where d.jobid=j.jobid and j.jobname in('dorra-war-dispatch','dorra-war-maintenance') and d.end_time<now()-interval '2 days'$prune$;
 end if;
 for old_world in select id from dorra_private.war_matches where status='finished' and finished_at<now()-interval '7 days' order by finished_at limit 20 for update skip locked loop
 delete from dorra_private.war_projection_cache where match_id=old_world.id;
 delete from dorra_private.war_requests where match_id=old_world.id;
 delete from dorra_private.war_reports where match_id=old_world.id;
 delete from dorra_private.war_events where match_id=old_world.id;
 delete from dorra_private.war_units where match_id=old_world.id;
 delete from dorra_private.war_provinces where match_id=old_world.id;
 delete from dorra_private.war_observers where match_id=old_world.id;
 delete from dorra_private.war_relations where match_id=old_world.id;
 end loop;
 -- Match summary, membership and permanent reward receipts deliberately remain.
end $$;
revoke all on function dorra_private.war_maintenance() from public,anon,authenticated;
grant execute on function dorra_private.war_maintenance() to service_role;
select cron.schedule('dorra-war-maintenance','17 * * * *',$$select dorra_private.war_maintenance();$$);
