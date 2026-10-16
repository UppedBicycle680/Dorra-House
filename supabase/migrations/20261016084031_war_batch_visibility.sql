-- Share the world catalogue/coordinate scan across connected observers. The
-- resulting IDs follow the same fog rules as war_visible_units; they never
-- leave the private notifier. Per-player views retain their existing filter.
create function dorra_private.war_geometry_distance(a_lat double precision,a_lng double precision,b_lat double precision,b_lng double precision) returns numeric
language sql immutable parallel safe set search_path='' as $$
 select (6371*2*asin(least(1,sqrt(power(sin(radians((b_lat-a_lat)/2)),2)+cos(radians(a_lat))*cos(radians(b_lat))*power(sin(radians((b_lng-a_lng)/2)),2)))))::numeric
$$;

create function dorra_private.war_observer_visibility(mid uuid) returns table(user_id uuid,unit_id uuid)
language sql stable set search_path='' as $$
 with observers as materialized(
  select o.user_id,s.nation_id,s.research ? 'networked-command' networked
  from dorra_private.war_observers o join dorra_private.war_sides s on s.match_id=o.match_id and s.user_id=o.user_id where o.match_id=mid
 ),units as materialized(
  select u.*,p.data platform_data,(g.data->>'lat')::double precision lat,(g.data->>'lng')::double precision lng
  from dorra_private.war_units u join dorra_private.war_catalog_platforms p on p.id=u.platform_id
  join dorra_private.war_catalog_provinces g on g.id=u.province_id where u.match_id=mid
 ),locations as materialized(
  select distinct o.user_id,o.nation_id,u.province_id from observers o join units u on u.nation_id=o.nation_id and u.health>0
 ),fields as materialized(
  select l.*,dorra_private.war_ecm(mid,l.nation_id,l.province_id) ecm from locations l
 ),sensors as materialized(
  select o.user_id,o.nation_id,u.province_id,u.platform_data,u.lat,u.lng,f.ecm,
  coalesce((u.platform_data#>>'{stats,vision}')::numeric,100) vision,
  coalesce((u.platform_data#>>'{stats,vision}')::numeric,100)*(case when o.networked then 1.15 else 1 end) radius
  from observers o join units u on u.nation_id=o.nation_id and u.health>0
  join fields f on f.user_id=o.user_id and f.province_id=u.province_id
 ),radars as materialized(
  select o.user_id,o.nation_id,p.province_id,(g.data->>'lat')::double precision lat,(g.data->>'lng')::double precision lng,
  (p.facilities->>'radar')::numeric level,dorra_private.war_ecm(mid,o.nation_id,p.province_id) ecm
  from observers o join dorra_private.war_provinces p on p.match_id=mid and p.nation_id=o.nation_id
  join dorra_private.war_catalog_provinces g on g.id=p.province_id where coalesce((p.facilities->>'radar')::numeric,0)>0
 )
 select o.user_id,u.id from observers o join units u on u.nation_id=o.nation_id and u.health>0
 union select o.user_id,u.id from observers o join dorra_private.war_provinces p on p.match_id=mid and p.nation_id=o.nation_id join units u on u.province_id=p.province_id
 union select o.user_id,u.id from observers o join dorra_private.war_relations r on r.match_id=mid and r.relation='alliance' and o.nation_id in(r.a,r.b)
 join units u on u.nation_id=(case when r.a=o.nation_id then r.b else r.a end)
 union select sensor.user_id,target.id from sensors sensor join units target on target.nation_id<>sensor.nation_id and target.health>0
 where abs(sensor.lat-target.lat)<=sensor.vision*1.15/110
 and dorra_private.war_geometry_distance(sensor.lat,sensor.lng,target.lat,target.lng)<=sensor.radius
 and dorra_private.war_signature_detected(sensor.platform_data,target.platform_data,sensor.ecm)
 union select radar.user_id,target.id from radars radar join units target on target.nation_id<>radar.nation_id and target.health>0
 where abs(radar.lat-target.lat)<=radar.level*100/110
 and not(coalesce(target.platform_data->'capabilities','[]') ? 'submarine')
 and coalesce((target.platform_data#>>'{stats,stealth}')::numeric,0)<=radar.level*35*radar.ecm
 and dorra_private.war_geometry_distance(radar.lat,radar.lng,target.lat,target.lng)<=radar.level*100
$$;

create or replace function dorra_private.war_notify(mid uuid) returns void
language plpgsql set search_path='' as $$
declare observer record;fingerprint text;rev bigint;public_fingerprint text;sid text;visible_sets jsonb;roster jsonb;match_status text;
begin
 select status into match_status from dorra_private.war_matches where id=mid and notify_dirty;
 if not found then return;end if;
 select md5(coalesce(string_agg(province_id||':'||nation_id||':'||radiation_until::text,',' order by province_id),'')) into public_fingerprint from dorra_private.war_provinces where match_id=mid;
 select coalesce(jsonb_agg(jsonb_build_array(nation_id,user_id,retired) order by nation_id),'[]') into roster from dorra_private.war_sides where match_id=mid;
 select coalesce(jsonb_object_agg(v.user_id::text,v.ids),'{}') into visible_sets from(
  select user_id,jsonb_agg(unit_id) ids from dorra_private.war_observer_visibility(mid) group by user_id
 ) v;
 for observer in select * from dorra_private.war_observers where match_id=mid loop
 select nation_id into sid from dorra_private.war_sides where match_id=mid and user_id=observer.user_id;
 fingerprint:=md5(jsonb_build_object('public',public_fingerprint,'roster',roster,'status',match_status,
 'units',(select coalesce(jsonb_agg(jsonb_build_array(u.id,u.nation_id,u.province_id,u.platform_id,u.strength,u.health,case when u.nation_id=sid then u.orders else null end,case when u.nation_id=sid then jsonb_build_array(u.entrenchment,u.base_carrier_id,u.intercept_ready_at) else null end) order by u.id),'[]') from dorra_private.war_units u where u.match_id=mid and u.id in(select id::uuid from jsonb_array_elements_text(coalesce(visible_sets->observer.user_id::text,'[]')) x(id))),
 'owned',(select coalesce(jsonb_agg(jsonb_build_array(province_id,morale,facilities) order by province_id),'[]') from dorra_private.war_provinces where match_id=mid and nation_id=sid),
 'reports',(select max(id) from dorra_private.war_reports where match_id=mid and (nation_id is null or nation_id=sid)),
 'diplomacy',(select coalesce(jsonb_agg(jsonb_build_array(a,b,relation,proposal,proposed_by) order by a,b),'[]') from dorra_private.war_relations where match_id=mid and sid in(a,b)),
 'research',(select jsonb_build_array(research,import_licenses) from dorra_private.war_sides where match_id=mid and nation_id=sid),
 'queues',(select coalesce(jsonb_agg(jsonb_build_array(id,kind,due,payload) order by id),'[]') from dorra_private.war_events where match_id=mid and kind in('research','produce','build') and payload->>'nationId'=sid))::text);
 if fingerprint is distinct from observer.visible_digest then
  rev:=observer.revision+1;update dorra_private.war_observers set visible_digest=fingerprint,revision=rev,last_hint=now() where match_id=mid and user_id=observer.user_id;
  begin perform realtime.send(jsonb_build_object('matchId',mid,'revision',rev),'war-changed','dorra-war:'||observer.user_id::text,true);exception when others then null;end;
 end if;
 end loop;
 update dorra_private.war_matches set notify_dirty=false where id=mid;
end $$;

revoke all on function dorra_private.war_geometry_distance(double precision,double precision,double precision,double precision) from public,anon,authenticated;
revoke all on function dorra_private.war_observer_visibility(uuid) from public,anon,authenticated;
grant execute on function dorra_private.war_geometry_distance(double precision,double precision,double precision,double precision) to service_role;
grant execute on function dorra_private.war_observer_visibility(uuid) to service_role;
