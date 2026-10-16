-- Fair solo opponents: difficulty changes planning tempo and coordination,
-- never resources, damage, eligibility, queue times or fog of war.
alter table dorra_private.war_matches add column ai_difficulty text not null default 'standard' check(ai_difficulty in('recruit','standard','veteran'));

create function dorra_private.war_ai_profile(difficulty text) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('cadenceSeconds',case difficulty when 'recruit' then 43200 when 'veteran' then 10800 else 21600 end,
 'maneuvers',case difficulty when 'recruit' then 2 when 'veteran' then 6 else 4 end,'initialDelaySeconds',3600)
$$;

-- Extract the existing human command rules into shared private functions.
-- Both callers then execute one implementation of costs, eligibility, research
-- prerequisites, facilities, queues, radiation, basing and movement validation.
do $share$
declare definition text;fragment text;start_at integer;end_at integer;needle text;
begin
 definition:=pg_get_functiondef('public.dorra_war_command(uuid,uuid,uuid,text,uuid,jsonb,uuid)'::regprocedure);
 start_at:=strpos(definition,$needle$ if p_action in('research','produce') then$needle$);
 end_at:=strpos(definition,$needle$ elsif p_action='diplomacy' then$needle$);
 if start_at=0 or end_at<=start_at then raise exception 'AI shared economy extraction did not match';end if;
 fragment:=substr(definition,start_at,end_at-start_at);
 execute $function$create function dorra_private.war_economy_command(mid uuid,nid text,p_action text,p_args jsonb,gt numeric) returns void language plpgsql set search_path='' as $body$
 declare p record;q record;s dorra_private.war_sides;target text;facility text;cost jsonb;hours numeric;level integer;
 begin
 if p_action not in('research','produce','build') then raise exception 'INVALID_ACTION';end if;
 $function$||fragment||$function$ end if;end $body$$function$;
 definition:=substr(definition,1,start_at-1)||$replace$ if p_action in('research','produce','build') then
 perform dorra_private.war_economy_command(mid,nid,p_action,p_args,gt);
$replace$||substr(definition,end_at);
 start_at:=strpos(definition,$needle$ elsif p_action='order' then$needle$);
 end_at:=strpos(definition,$needle$ update dorra_private.war_sides set last_command_at$needle$);
 if start_at=0 or end_at<=start_at then raise exception 'AI shared order extraction did not match';end if;
 fragment:=substr(definition,start_at+length($needle$ elsif p_action='order' then$needle$),end_at-start_at-length($needle$ elsif p_action='order' then$needle$));
 execute $function$create function dorra_private.war_order_command(mid uuid,nid text,p_args jsonb,gt numeric) returns void language plpgsql set search_path='' as $body$
 declare friend text;units uuid[];uid uuid;u dorra_private.war_units;cost jsonb;target text;other text;distance numeric;hours numeric;
 begin if true then
 $function$||fragment||$function$end $body$$function$;
 definition:=substr(definition,1,start_at-1)||$replace$ elsif p_action='order' then
 perform dorra_private.war_order_command(mid,nid,p_args,gt);
 end if;
$replace$||substr(definition,end_at);
 execute definition;
end $share$;

create function dorra_private.war_ai_can_pay(mid uuid,nid text,cost jsonb) returns boolean
language sql stable set search_path='' as $$
 select not exists(select 1 from jsonb_each(cost) c where coalesce((s.resources->>c.key)::numeric,0)<(c.value#>>'{}')::numeric+
 case c.key when 'cash' then 1000 when 'supplies' then 300 when 'fuel' then 200 when 'electronics' then 100 when 'manpower' then 200 else 0 end)
 from dorra_private.war_sides s where s.match_id=mid and s.nation_id=nid
$$;
create function dorra_private.war_ai_try_order(mid uuid,nid text,uid uuid,kind text,target text,gt numeric,target_unit uuid default null) returns boolean
language plpgsql set search_path='' as $$
begin
 perform dorra_private.war_order_command(mid,nid,jsonb_strip_nulls(jsonb_build_object('unitIds',jsonb_build_array(uid),'type',kind,'targetProvinceId',target,'targetUnitId',target_unit)),gt);
 return true;
exception when sqlstate 'P0001' then return false;
end $$;

do $interface$
declare definition text;needle text;replacement text;
begin
 definition:=pg_get_functiondef('public.dorra_war_command(uuid,uuid,uuid,text,uuid,jsonb,uuid)'::regprocedure);
 needle:=$old$ if p_action='create' then$old$;
 replacement:=$new$ if p_action='create' then
 if p_args ? 'aiDifficulty' and (jsonb_typeof(p_args->'aiDifficulty')<>'string' or p_args->>'aiDifficulty' not in('recruit','standard','veteran')) then raise exception 'INVALID_MATCH_OPTIONS';end if;$new$;
 if strpos(definition,needle)=0 then raise exception 'AI difficulty validation patch did not match';end if;definition:=replace(definition,needle,replacement);
 needle:=$old$ returning * into m;mid:=m.id;$old$;
 replacement:=$new$ returning * into m;mid:=m.id;
 update dorra_private.war_matches set ai_difficulty=case when m.opponent='ai' then coalesce(p_args->>'aiDifficulty','standard') else 'standard' end where id=mid;
 m.ai_difficulty:=case when m.opponent='ai' then coalesce(p_args->>'aiDifficulty','standard') else 'standard' end;$new$;
 if strpos(definition,needle)=0 then raise exception 'AI difficulty create patch did not match';end if;definition:=replace(definition,needle,replacement);
 needle:=$old$'opponent',wm.opponent,$old$;
 replacement:=$new$'opponent',wm.opponent,'aiDifficulty',wm.ai_difficulty,'opponentNationId',(select nation_id from dorra_private.war_sides rival where rival.match_id=wm.id and rival.active_ai order by nation_id limit 1),$new$;
 if strpos(definition,needle)=0 then raise exception 'AI difficulty list patch did not match';end if;definition:=replace(definition,needle,replacement);
 needle:=$old$3600+(row_number() over(order by nation_id))*75$old$;
 replacement:=$new$3600+(row_number() over(order by nation_id)-1)*75$new$;
 if strpos(definition,needle)=0 then raise exception 'AI initial grace patch did not match';end if;definition:=replace(definition,needle,replacement);
 needle:=$old$ if m.template='duel' then insert into dorra_private.war_relations(match_id,a,b,relation) select mid,min(nation_id),max(nation_id),'war' from dorra_private.war_sides where match_id=mid;end if;$old$;
 replacement:=needle||$new$
 if m.template='world' and m.opponent='ai' then
 insert into dorra_private.war_relations(match_id,a,b,relation) select mid,least(nation_id,enemy_nation_id),greatest(nation_id,enemy_nation_id),'war' from dorra_private.war_sides where match_id=mid and active_ai and enemy_nation_id is not null on conflict do nothing;
 end if;$new$;
 if strpos(definition,needle)=0 then raise exception 'AI opening war patch did not match';end if;definition:=replace(definition,needle,replacement);
 needle:=$old$if exists(select 1 from dorra_private.war_sides where match_id=mid and nation_id=other and is_ai) and (friend not in('alliance','import-license') or q.relation<>'war') then$old$;
 replacement:=$new$if exists(select 1 from dorra_private.war_sides where match_id=mid and nation_id=other and is_ai)
 and (friend='import-license' or not exists(select 1 from dorra_private.war_sides where match_id=mid and nation_id=other and active_ai))
 and (friend not in('alliance','import-license') or q.relation<>'war') then$new$;
 if strpos(definition,needle)=0 then raise exception 'AI bounded diplomacy patch did not match';end if;execute replace(definition,needle,replacement);
 definition:=pg_get_functiondef('dorra_private.war_view(uuid,uuid)'::regprocedure);
 needle:=$old$'opponent',m.opponent,$old$;
 replacement:=$new$'opponent',m.opponent,'aiDifficulty',m.ai_difficulty,'opponentNationId',(select nation_id from dorra_private.war_sides rival where rival.match_id=mid and rival.active_ai order by nation_id limit 1),$new$;
 if strpos(definition,needle)=0 then raise exception 'AI difficulty view patch did not match';end if;execute replace(definition,needle,replacement);
 definition:=pg_get_functiondef('dorra_private.war_advance(uuid,integer)'::regprocedure);
 needle:=$old$insert into dorra_private.war_events(match_id,kind,due,payload) values(mid,'ai',e.due+21600,e.payload);$old$;
 replacement:=$new$insert into dorra_private.war_events(match_id,kind,due,payload)
 select mid,'ai',e.due+(dorra_private.war_ai_profile(m.ai_difficulty)->>'cadenceSeconds')::numeric,e.payload
 where exists(select 1 from dorra_private.war_sides where match_id=mid and nation_id=nid and is_ai and active_ai);$new$;
 if strpos(definition,needle)=0 then raise exception 'AI decision cadence patch did not match';end if;execute replace(definition,needle,replacement);
end $interface$;

create function dorra_private.war_ai_tactics(mid uuid,nid text,gt numeric,maneuver_budget integer,visible_ids uuid[]) returns void
language plpgsql set search_path='' as $$
declare capital text;home text;enemies text[];reserved uuid[];land_count integer;reserve_count integer;actions integer:=0;u record;candidate record;
 target text;kind text;maritime boolean;ordered boolean;fuel numeric;distance numeric;retaliation boolean;ground_opportunity boolean;ground_attempted boolean:=false;
begin
 select data->>'capitalProvinceId' into capital from dorra_private.war_catalog_nations where id=nid;
 select p.province_id into home from dorra_private.war_provinces p where p.match_id=mid and p.nation_id=nid order by (p.province_id=capital) desc,p.province_id limit 1;
 select coalesce(array_agg(case when a=nid then b else a end),array[]::text[]) into enemies from dorra_private.war_relations where match_id=mid and relation='war' and nid in(a,b);
 select count(*) into land_count from dorra_private.war_units where match_id=mid and nation_id=nid and domain='land' and health>0;
 reserve_count:=case when land_count>=8 then 2 else 1 end;
 select coalesce(array_agg(id),array[]::uuid[]) into reserved from(
  select guard_unit.id from dorra_private.war_units guard_unit join dorra_private.war_catalog_platforms p on p.id=guard_unit.platform_id
  where guard_unit.match_id=mid and guard_unit.nation_id=nid and guard_unit.domain='land' and guard_unit.province_id=capital and guard_unit.health>35 and guard_unit.orders='{}'
  and exists(select 1 from dorra_private.war_provinces where match_id=mid and province_id=capital and nation_id=nid)
  order by (coalesce(p.data->'capabilities','[]') ? 'garrison') desc,coalesce((p.data#>>'{stats,defense}')::numeric,0)*guard_unit.strength*guard_unit.health/guard_unit.max_health desc,guard_unit.id limit reserve_count
 ) guard;
 ground_opportunity:=exists(select 1 from dorra_private.war_units ground where ground.match_id=mid and ground.nation_id=nid and ground.domain='land' and ground.health>35
  and not(ground.id=any(reserved)) and (ground.orders='{}' or ground.orders->>'type'='intercept'));
 maritime:=cardinality(enemies)>0 and not exists(
  select 1 from dorra_private.war_provinces hostile join dorra_private.war_catalog_provinces c on c.id=hostile.province_id
  join dorra_private.war_provinces friendly on friendly.match_id=mid and friendly.nation_id=nid and c.data->'neighbors' ? friendly.province_id
  where hostile.match_id=mid and hostile.nation_id=any(enemies))
 and not(home is null and exists(select 1 from dorra_private.war_units survivor where survivor.match_id=mid and survivor.nation_id=nid and survivor.domain='land' and survivor.health>0
  and exists(select 1 from dorra_private.war_provinces hostile join dorra_private.war_catalog_provinces c on c.id=hostile.province_id where hostile.match_id=mid and hostile.nation_id=any(enemies) and (hostile.province_id=survivor.province_id or c.data->'neighbors' ? survivor.province_id))));
 retaliation:=exists(select 1 from dorra_private.war_reports where match_id=mid and nation_id=nid and body->>'type'='strategic-strike' and body->>'nuclear'='true');
 for u in select own.*,p.data platform_data,(g.data->>'lat')::double precision lat,(g.data->>'lng')::double precision lng
 from dorra_private.war_units own join dorra_private.war_catalog_platforms p on p.id=own.platform_id join dorra_private.war_catalog_provinces g on g.id=own.province_id
 where own.match_id=mid and own.nation_id=nid and own.health>0 and (own.orders='{}' or (own.domain<>'air' and (own.orders->>'type'='intercept' or (own.orders->>'type' in('bombard','patrol') and own.orders->>'legTarget' is null))) or own.health<=35)
 order by (own.health<=35) desc,case own.domain when 'air' then 0 when 'sea' then 1 when 'land' then 2 else 3 end,own.health desc,own.id limit 80 loop
  exit when actions>=maneuver_budget;ordered:=false;
  if u.health>35 and u.domain<>'land' and ground_opportunity and not ground_attempted and actions>=greatest(0,maneuver_budget-1) then continue;end if;
  if u.health>35 and u.domain<>'air' and u.orders->>'type' in('bombard','patrol') and u.orders->>'legTarget' is null then
   -- Persistent fire is reassessed using observed contacts, never an opponent's
   -- private orders. Leaving it costs a real legal retreat, just as for players.
   if exists(select 1 from dorra_private.war_units hostile join dorra_private.war_catalog_platforms cp on cp.id=hostile.platform_id
    where hostile.id=any(visible_ids) and hostile.nation_id=any(enemies) and hostile.health>0
    and (u.orders->>'type'<>'bombard' or hostile.province_id=u.orders->>'targetProvinceId')
    and dorra_private.war_weapon_power(u.platform_data,cp.data,'{}')>0
    and dorra_private.war_distance(u.province_id,hostile.province_id)<=coalesce((u.platform_data#>>'{stats,range}')::numeric,0)) then continue;end if;
   for candidate in select p.province_id from dorra_private.war_provinces p join dorra_private.war_catalog_provinces c on c.id=p.province_id
   where p.match_id=mid and p.nation_id=nid and p.province_id<>u.province_id and p.radiation_until<=gt
   and (u.domain<>'sea' or coalesce((c.data->>'port')::boolean,false))
   and not exists(select 1 from dorra_private.war_units hostile where hostile.id=any(visible_ids) and hostile.province_id=p.province_id and hostile.nation_id=any(enemies))
   order by dorra_private.war_geometry_distance(u.lat,u.lng,(c.data->>'lat')::double precision,(c.data->>'lng')::double precision),p.province_id limit 3 loop
    ordered:=dorra_private.war_ai_try_order(mid,nid,u.id,'retreat',candidate.province_id,gt);exit when ordered;
   end loop;
   if ordered then actions:=actions+1;end if;continue;
  end if;
  if u.health<=35 then
   for candidate in select p.province_id,coalesce((c.data->>'port')::boolean,false) port from dorra_private.war_provinces p join dorra_private.war_catalog_provinces c on c.id=p.province_id
   where p.match_id=mid and p.nation_id=nid and p.province_id<>u.province_id and p.radiation_until<=gt
   and (u.domain<>'air' or coalesce((p.facilities->>'air-base')::integer,0)>0) and (u.domain<>'sea' or coalesce((c.data->>'port')::boolean,false))
   and not exists(select 1 from dorra_private.war_units hostile where hostile.id=any(visible_ids) and hostile.province_id=p.province_id and hostile.nation_id=any(enemies))
   order by dorra_private.war_geometry_distance(u.lat,u.lng,(c.data->>'lat')::double precision,(c.data->>'lng')::double precision),p.province_id limit 3 loop
    ordered:=dorra_private.war_ai_try_order(mid,nid,u.id,'retreat',candidate.province_id,gt);
    if not ordered and u.domain='land' and u.orders='{}' and candidate.port then ordered:=dorra_private.war_ai_try_order(mid,nid,u.id,'embark',candidate.province_id,gt);end if;
    exit when ordered;
   end loop;
   if ordered then actions:=actions+1;end if;
   if ordered or home is not null then continue;end if;
  end if;
  if cardinality(enemies)=0 or (u.id=any(reserved) and dorra_private.war_ai_role(u.platform_data)<>'air-defense') then continue;end if;
  -- Leave a maneuver opportunity for an available land formation. Aircraft
  -- patrols and ship orders cannot consume the whole standard/recruit turn.
  if u.domain<>'land' and ground_opportunity and not ground_attempted and actions>=greatest(0,maneuver_budget-1) then continue;end if;
  if u.domain='land' then ground_attempted:=true;end if;
  if u.domain='air' then
   -- Use only observed hostile formations to select a strike/counter role.
   for candidate in select hostile.id,hostile.province_id,hostile.domain,p.nation_id owner_id,
   dorra_private.war_geometry_distance(u.lat,u.lng,(g.data->>'lat')::double precision,(g.data->>'lng')::double precision) distance
   from dorra_private.war_units hostile join dorra_private.war_catalog_platforms cp on cp.id=hostile.platform_id
   join dorra_private.war_catalog_provinces g on g.id=hostile.province_id join dorra_private.war_provinces p on p.match_id=mid and p.province_id=hostile.province_id
   where hostile.id=any(visible_ids) and hostile.nation_id=any(enemies) and hostile.health>0 and dorra_private.war_weapon_power(u.platform_data,cp.data,'{}')>0
   and dorra_private.war_geometry_distance(u.lat,u.lng,(g.data->>'lat')::double precision,(g.data->>'lng')::double precision)<=coalesce((u.platform_data#>>'{stats,range}')::numeric,1500)
   order by (hostile.province_id=capital) desc,(hostile.domain='air' and coalesce((u.platform_data#>>'{stats,airDefense}')::numeric,0)>15) desc,distance,hostile.id limit 3 loop
    select (resources->>'fuel')::numeric into fuel from dorra_private.war_sides where match_id=mid and nation_id=nid;
    if fuel<200+ceil(greatest(5,candidate.distance)*u.strength/20)*2 then continue;end if;
    kind:=case when candidate.domain='air' then 'intercept' when candidate.owner_id=nid or dorra_private.war_relation(mid,nid,candidate.owner_id)='alliance' then 'patrol' else 'bombard' end;
    ordered:=dorra_private.war_ai_try_order(mid,nid,u.id,kind,candidate.province_id,gt,candidate.id);exit when ordered;
   end loop;
   if not ordered then
    -- ISR and idle fighters can patrol a legal nearby front rather than seeing
    -- through fog. Their next decision uses the resulting normal sensor view.
    for candidate in select p.province_id from dorra_private.war_provinces p join dorra_private.war_catalog_provinces c on c.id=p.province_id
    where p.match_id=mid and p.nation_id=nid and exists(select 1 from jsonb_array_elements_text(coalesce(c.data->'neighbors','[]')) edge(id) join dorra_private.war_provinces front on front.match_id=mid and front.province_id=edge.id and front.nation_id=any(enemies))
    and dorra_private.war_geometry_distance(u.lat,u.lng,(c.data->>'lat')::double precision,(c.data->>'lng')::double precision)<=coalesce((u.platform_data#>>'{stats,range}')::numeric,1500)
    order by (p.province_id=capital) desc,dorra_private.war_geometry_distance(u.lat,u.lng,(c.data->>'lat')::double precision,(c.data->>'lng')::double precision),p.province_id limit 2 loop
     kind:=case when candidate.province_id=u.province_id and coalesce((u.platform_data#>>'{stats,airDefense}')::numeric,0)>0 then 'intercept' else 'patrol' end;
     ordered:=dorra_private.war_ai_try_order(mid,nid,u.id,kind,candidate.province_id,gt);exit when ordered;
    end loop;
   end if;
  elsif u.domain='missile' then
   if coalesce(u.platform_data->'capabilities','[]') ? 'interceptor' then
    if u.orders->>'type' is distinct from 'intercept' or u.orders->>'targetProvinceId' is distinct from coalesce(home,u.province_id) then
     ordered:=dorra_private.war_ai_try_order(mid,nid,u.id,'intercept',coalesce(home,u.province_id),gt);
    end if;
   elsif not coalesce((u.platform_data->>'nuclear')::boolean,false) or retaliation then
    for candidate in select hostile.id,hostile.province_id from dorra_private.war_units hostile join dorra_private.war_catalog_platforms cp on cp.id=hostile.platform_id
    where hostile.id=any(visible_ids) and hostile.nation_id=any(enemies) and dorra_private.war_strike_target(u.platform_data,cp.data,'{}')
    and dorra_private.war_distance(u.province_id,hostile.province_id)<=coalesce((u.platform_data#>>'{stats,range}')::numeric,0)
    and (not coalesce((u.platform_data->>'nuclear')::boolean,false) or not exists(select 1 from dorra_private.war_units friendly where friendly.id=any(visible_ids) and friendly.province_id=hostile.province_id and (friendly.nation_id=nid or dorra_private.war_relation(mid,nid,friendly.nation_id)='alliance')))
    order by hostile.health desc,hostile.id limit 2 loop
     ordered:=dorra_private.war_ai_try_order(mid,nid,u.id,'attack',candidate.province_id,gt,candidate.id);exit when ordered;
    end loop;
   end if;
  elsif u.domain='sea' then
   for candidate in select hostile.id,hostile.province_id from dorra_private.war_units hostile join dorra_private.war_catalog_platforms cp on cp.id=hostile.platform_id
   where hostile.id=any(visible_ids) and hostile.nation_id=any(enemies) and dorra_private.war_weapon_power(u.platform_data,cp.data,'{}')>0
   and dorra_private.war_distance(u.province_id,hostile.province_id)<=coalesce((u.platform_data#>>'{stats,range}')::numeric,0)
   order by (hostile.domain='sea') desc,hostile.health desc,hostile.id limit 2 loop
    ordered:=dorra_private.war_ai_try_order(mid,nid,u.id,'bombard',candidate.province_id,gt,candidate.id);exit when ordered;
   end loop;
   if not ordered then
    for candidate in select p.province_id from dorra_private.war_provinces p join dorra_private.war_catalog_provinces c on c.id=p.province_id
    where p.match_id=mid and p.nation_id=any(enemies) and coalesce((c.data->>'port')::boolean,false)
    order by dorra_private.war_geometry_distance(u.lat,u.lng,(c.data->>'lat')::double precision,(c.data->>'lng')::double precision),p.province_id limit 2 loop
     ordered:=dorra_private.war_ai_try_order(mid,nid,u.id,'attack',candidate.province_id,gt);exit when ordered;
    end loop;
   end if;
  elsif u.domain='support' or (dorra_private.war_ai_role(u.platform_data)='support' and home is not null) then
   for candidate in select p.province_id from dorra_private.war_provinces p join dorra_private.war_catalog_provinces c on c.id=p.province_id
   where p.match_id=mid and p.nation_id=nid and p.province_id<>u.province_id
   and exists(select 1 from jsonb_array_elements_text(coalesce(c.data->'neighbors','[]')) edge(id) join dorra_private.war_provinces hostile on hostile.match_id=mid and hostile.province_id=edge.id and hostile.nation_id=any(enemies))
   order by dorra_private.war_geometry_distance(u.lat,u.lng,(c.data->>'lat')::double precision,(c.data->>'lng')::double precision),p.province_id limit 2 loop
    ordered:=dorra_private.war_ai_try_order(mid,nid,u.id,'move',candidate.province_id,gt);exit when ordered;
   end loop;
  elsif u.domain='land' and dorra_private.war_ai_role(u.platform_data)='air-defense' then
   for candidate in select p.province_id from dorra_private.war_provinces p join dorra_private.war_catalog_provinces c on c.id=p.province_id
   where p.match_id=mid and p.nation_id=nid and dorra_private.war_geometry_distance(u.lat,u.lng,(c.data->>'lat')::double precision,(c.data->>'lng')::double precision)<=coalesce((u.platform_data#>>'{stats,range}')::numeric,0)
   order by exists(select 1 from dorra_private.war_units hostile where hostile.id=any(visible_ids) and hostile.domain='air' and hostile.province_id=p.province_id and hostile.nation_id=any(enemies)) desc,(p.province_id=capital) desc,p.province_id limit 3 loop
    if u.orders->>'type'='intercept' and u.orders->>'targetProvinceId'=candidate.province_id then exit;end if;
    ordered:=dorra_private.war_ai_try_order(mid,nid,u.id,'intercept',candidate.province_id,gt);exit when ordered;
   end loop;
  elsif u.domain='land' then
   if dorra_private.war_ai_role(u.platform_data)='artillery' then
    for candidate in select hostile.id,hostile.province_id from dorra_private.war_units hostile join dorra_private.war_catalog_platforms cp on cp.id=hostile.platform_id
    where hostile.id=any(visible_ids) and hostile.nation_id=any(enemies) and dorra_private.war_weapon_power(u.platform_data,cp.data,'{}')>0
    and dorra_private.war_distance(u.province_id,hostile.province_id)<=coalesce((u.platform_data#>>'{stats,range}')::numeric,0)
    order by hostile.health desc,hostile.id limit 2 loop
     ordered:=dorra_private.war_ai_try_order(mid,nid,u.id,'bombard',candidate.province_id,gt,candidate.id);exit when ordered;
    end loop;
   end if;
   if ordered then actions:=actions+1;continue;end if;
   -- Reinforce observed attacks on owned territory before taking more ground.
   for candidate in select p.province_id from dorra_private.war_provinces p join dorra_private.war_catalog_provinces c on c.id=p.province_id
   where p.match_id=mid and p.nation_id=nid and p.province_id<>u.province_id
   and exists(select 1 from dorra_private.war_units hostile where hostile.id=any(visible_ids) and hostile.province_id=p.province_id and hostile.nation_id=any(enemies))
   order by (p.province_id=capital) desc,dorra_private.war_geometry_distance(u.lat,u.lng,(c.data->>'lat')::double precision,(c.data->>'lng')::double precision),p.province_id limit 2 loop
    ordered:=dorra_private.war_ai_try_order(mid,nid,u.id,'move',candidate.province_id,gt);exit when ordered;
   end loop;
   if not ordered and not maritime then
    for candidate in select p.province_id from dorra_private.war_provinces p join dorra_private.war_catalog_provinces c on c.id=p.province_id
    where p.match_id=mid and p.nation_id=any(enemies) and p.province_id<>u.province_id
    and (p.province_id=capital or (home is null and c.data->'neighbors' ? u.province_id) or exists(select 1 from jsonb_array_elements_text(coalesce(c.data->'neighbors','[]')) edge(id) join dorra_private.war_provinces friendly on friendly.match_id=mid and friendly.province_id=edge.id and friendly.nation_id=nid))
    order by (p.province_id=capital) desc,
    (select coalesce(sum(hostile.strength*hostile.health/hostile.max_health),0) from dorra_private.war_units hostile where hostile.id=any(visible_ids) and hostile.province_id=p.province_id and hostile.nation_id=any(enemies)),
    dorra_private.war_geometry_distance(u.lat,u.lng,(c.data->>'lat')::double precision,(c.data->>'lng')::double precision),p.province_id limit 3 loop
     ordered:=dorra_private.war_ai_try_order(mid,nid,u.id,'attack',candidate.province_id,gt);exit when ordered;
    end loop;
   end if;
   if not ordered and maritime then
    if exists(select 1 from dorra_private.war_catalog_provinces where id=u.province_id and coalesce((data->>'port')::boolean,false)) then
     for candidate in select p.province_id from dorra_private.war_provinces p join dorra_private.war_catalog_provinces c on c.id=p.province_id where p.match_id=mid and p.nation_id=any(enemies) and coalesce((c.data->>'port')::boolean,false)
     order by (p.province_id=capital) desc,dorra_private.war_geometry_distance(u.lat,u.lng,(c.data->>'lat')::double precision,(c.data->>'lng')::double precision),p.province_id limit 3 loop
      ordered:=dorra_private.war_ai_try_order(mid,nid,u.id,'embark',candidate.province_id,gt);exit when ordered;
     end loop;
    else
     for candidate in select p.province_id from dorra_private.war_provinces p join dorra_private.war_catalog_provinces c on c.id=p.province_id where p.match_id=mid and p.nation_id=nid and coalesce((c.data->>'port')::boolean,false)
     order by dorra_private.war_geometry_distance(u.lat,u.lng,(c.data->>'lat')::double precision,(c.data->>'lng')::double precision),p.province_id limit 3 loop
      ordered:=dorra_private.war_ai_try_order(mid,nid,u.id,'move',candidate.province_id,gt);exit when ordered;
     end loop;
    end if;
   end if;
  end if;
  if ordered then actions:=actions+1;end if;
 end loop;
end $$;

create or replace function dorra_private.war_ai(mid uuid,nid text,gt numeric) returns void
language plpgsql set search_path='' as $$
declare s dorra_private.war_sides;m dorra_private.war_matches;visible_ids uuid[];enemies text[];maritime boolean;
begin
 select * into s from dorra_private.war_sides where match_id=mid and nation_id=nid;
 if not found or not s.is_ai or not s.active_ai then return;end if;
 select * into m from dorra_private.war_matches where id=mid;
 if m.status<>'running' then return;end if;
 perform dorra_private.war_accrue(mid,nid,gt);
 select coalesce(array_agg(id),array[]::uuid[]) into visible_ids from dorra_private.war_visible_units(mid,nid);
 perform dorra_private.war_ai_diplomacy(mid,nid,gt,visible_ids);
 select coalesce(array_agg(case when a=nid then b else a end),array[]::text[]) into enemies from dorra_private.war_relations where match_id=mid and relation='war' and nid in(a,b);
 maritime:=not exists(select 1 from dorra_private.war_provinces hostile join dorra_private.war_catalog_provinces c on c.id=hostile.province_id
 join dorra_private.war_provinces friendly on friendly.match_id=mid and friendly.nation_id=nid and c.data->'neighbors' ? friendly.province_id
 where hostile.match_id=mid and hostile.nation_id=any(enemies));
 perform dorra_private.war_ai_tactics(mid,nid,gt,(dorra_private.war_ai_profile(m.ai_difficulty)->>'maneuvers')::integer,visible_ids);
 perform dorra_private.war_ai_economy(mid,nid,gt,maritime,visible_ids);
end $$;
create function dorra_private.war_ai_try_economy(mid uuid,nid text,kind text,args jsonb,gt numeric) returns boolean
language plpgsql set search_path='' as $$
begin perform dorra_private.war_economy_command(mid,nid,kind,args,gt);return true;
exception when sqlstate 'P0001' then return false;
end $$;

create function dorra_private.war_ai_role(platform jsonb) returns text
language sql immutable set search_path='' as $$
 select case when coalesce((platform->>'buildable')::boolean,true)=false then 'programme'
 when platform->>'domain'='sea' then 'naval'
 when platform->>'domain'='air' then 'aviation'
 when coalesce((platform#>>'{stats,airDefense}')::numeric,0)>15 or coalesce(platform->'capabilities','[]') ? 'interceptor' then 'air-defense'
 when platform->>'domain'='missile' then 'missiles'
 when coalesce(platform->'capabilities','[]') ? 'armor' or coalesce(platform->>'role',platform->>'branch')='armor' then 'armor'
 when coalesce(platform->'capabilities','[]') ?| array['indirect-fire','rocket-artillery'] then 'artillery'
 when coalesce(platform->'capabilities','[]') ?| array['repair','resupply','entrench','recon'] and not(coalesce(platform->'capabilities','[]') ? 'garrison') then 'support'
 when platform->>'domain'='land' then 'infantry' else 'support' end
$$;

create function dorra_private.war_ai_priority(platform jsonb,counts jsonb,threats jsonb,maritime boolean) returns numeric
language plpgsql immutable set search_path='' as $$
declare role text:=dorra_private.war_ai_role(platform);desired numeric;present numeric;score numeric;
begin
 if role='programme' then
  return case when coalesce(platform->'capabilities','[]') ? 'doctrine' then 115 when coalesce(platform->'capabilities','[]') ? 'command' then 65 else 50 end;
 end if;
 desired:=case role when 'infantry' then 4 when 'armor' then 2 when 'artillery' then 2
 when 'air-defense' then case when coalesce((threats->>'air')::integer,0)>0 then 3 else 1 end
 when 'aviation' then case when coalesce((threats->>'land')::integer,0)>0 then 3 else 2 end
 when 'naval' then case when maritime or coalesce((threats->>'sea')::integer,0)>0 then 3 else 0 end
 when 'support' then 2 when 'missiles' then 1 else 0 end;
 if desired=0 then return -1000;end if;
 present:=coalesce((counts->>role)::numeric,0);
 score:=100*(desired-present)/desired+least(12,coalesce((platform#>>'{stats,attack}')::numeric,0)/5)-greatest(0,coalesce((platform->>'level')::numeric,1)-1)*3;
 if coalesce((threats->>'armor')::integer,0)>0 and coalesce(platform->'capabilities','[]') ? 'anti-armor' then score:=score+25;end if;
 if coalesce((threats->>'submarine')::integer,0)>0 and coalesce(platform->'capabilities','[]') ? 'anti-submarine' then score:=score+35;end if;
 return score;
end $$;

create function dorra_private.war_ai_diplomacy(mid uuid,nid text,gt numeric,visible_ids uuid[]) returns void
language plpgsql set search_path='' as $$
declare offer record;other text;pressure boolean;own_count integer;enemy_count integer;owned integer;initial_count integer;accepted boolean;mode text;
begin
 select template into mode from dorra_private.war_matches where id=mid;
 select count(*) into own_count from dorra_private.war_units where match_id=mid and nation_id=nid and health>0;
 select count(*) into enemy_count from dorra_private.war_units where id=any(visible_ids) and nation_id<>nid and dorra_private.war_relation(mid,nid,nation_id)='war' and health>0;
 select count(*) into owned from dorra_private.war_provinces where match_id=mid and nation_id=nid;
 select count(*) into initial_count from dorra_private.war_catalog_provinces where country_id=nid;
 pressure:=enemy_count>greatest(own_count,1) or owned<greatest(1,initial_count*.6)
 or not exists(select 1 from dorra_private.war_provinces p join dorra_private.war_catalog_nations n on n.id=nid and p.province_id=n.data->>'capitalProvinceId' where p.match_id=mid and p.nation_id=nid)
 or exists(select 1 from dorra_private.war_sides where match_id=mid and nation_id=nid and ((resources->>'supplies')::numeric<500 or (resources->>'fuel')::numeric<250));
 for offer in select * from dorra_private.war_relations where match_id=mid and nid in(a,b) and proposed_by is not null and proposed_by<>nid and proposal in('peace','ceasefire','alliance') order by a,b limit 2 loop
  other:=case when offer.a=nid then offer.b else offer.a end;
  accepted:=case when offer.proposal in('peace','ceasefire') then pressure else mode='world' and offer.relation<>'war' and enemy_count>0 end;
  update dorra_private.war_relations set relation=case when accepted then offer.proposal else relation end,proposal=null,proposed_by=null where match_id=mid and a=offer.a and b=offer.b;
  perform dorra_private.war_report(mid,other,gt,jsonb_build_object('type','diplomatic-response','nationId',nid,'proposal',offer.proposal,'accepted',accepted));
 end loop;
end $$;

create function dorra_private.war_ai_economy(mid uuid,nid text,gt numeric,maritime boolean,visible_ids uuid[]) returns void
language plpgsql set search_path='' as $$
declare home text;counts jsonb;threats jsonb;s dorra_private.war_sides;candidate record;site record;cost jsonb;required integer;actual integer;facility text;
 queued integer;force_count integer;owned integer;soft_target integer;made boolean:=false;research_slots integer;retaliation boolean;
begin
 select * into s from dorra_private.war_sides where match_id=mid and nation_id=nid;
 select p.province_id into home from dorra_private.war_provinces p join dorra_private.war_catalog_nations n on n.id=nid where p.match_id=mid and p.nation_id=nid and p.radiation_until<=gt order by (p.province_id=n.data->>'capitalProvinceId') desc,p.province_id limit 1;
 if home is null then return;end if;
 select coalesce(jsonb_object_agg(role,n),'{}') into counts from(
  select dorra_private.war_ai_role(p.data) role,count(*) n from(
   select platform_id from dorra_private.war_units where match_id=mid and nation_id=nid and health>0
   union all select payload->>'platformId' from dorra_private.war_events where match_id=mid and kind='produce' and payload->>'nationId'=nid
  ) own join dorra_private.war_catalog_platforms p on p.id=own.platform_id group by 1
 ) c;
 select jsonb_build_object('air',count(*) filter(where u.domain='air'),'land',count(*) filter(where u.domain='land'),'sea',count(*) filter(where u.domain='sea'),'armor',count(*) filter(where coalesce(p.data->'capabilities','[]') ? 'armor'),'submarine',count(*) filter(where coalesce(p.data->'capabilities','[]') ? 'submarine')) into threats
 from dorra_private.war_units u join dorra_private.war_catalog_platforms p on p.id=u.platform_id where u.id=any(visible_ids) and dorra_private.war_relation(mid,nid,u.nation_id)='war';
 select count(*) into force_count from dorra_private.war_units where match_id=mid and nation_id=nid and health>0;
 select count(*) into queued from dorra_private.war_events where match_id=mid and kind='produce' and payload->>'nationId'=nid;
 select count(*) into owned from dorra_private.war_provinces where match_id=mid and nation_id=nid;
 soft_target:=least(24,greatest(8,6+ceil(owned/4.0)::integer));
 retaliation:=exists(select 1 from dorra_private.war_reports where match_id=mid and nation_id=nid and body->>'type'='strategic-strike' and body->>'nuclear'='true');
 -- Research and infrastructure share one decision slot. An unaffordable or
 -- unavailable programme never blocks cheaper legal alternatives.
 select count(*) into research_slots from dorra_private.war_events where match_id=mid and kind='research' and payload->>'nationId'=nid;
 if research_slots<2 then
 for candidate in select p.*,dorra_private.war_ai_priority(p.data,counts,threats,maritime) priority from dorra_private.war_catalog_platforms p
 where dorra_private.war_platform_allowed(mid,nid,p.data) and not(s.research ? p.id)
 and (not coalesce((p.data->>'nuclear')::boolean,false) or retaliation)
 and not exists(select 1 from jsonb_array_elements_text(coalesce(p.data->'prerequisites','[]')) prereq(id) where not(s.research ? prereq.id))
 and not exists(select 1 from dorra_private.war_events e where e.match_id=mid and e.kind='research' and e.payload->>'nationId'=nid and e.payload->>'platformId'=p.id)
 order by priority desc,coalesce((p.data->>'level')::integer,1),p.id limit 16 loop
  if candidate.priority<=0 then continue;end if;
  facility:=coalesce(candidate.data->>'facility','army-base');required:=greatest(1,coalesce((candidate.data->>'level')::integer,1));
  if not exists(select 1 from dorra_private.war_provinces where match_id=mid and nation_id=nid and coalesce((facilities->>'intelligence-center')::integer,0)>=1) then facility:='intelligence-center';required:=1;end if;
  select p.* into site from dorra_private.war_provinces p join dorra_private.war_catalog_provinces c on c.id=p.province_id where p.match_id=mid and p.nation_id=nid and p.radiation_until<=gt
  and (facility<>'naval-base' or coalesce((c.data->>'port')::boolean,false))
  order by coalesce((p.facilities->>facility)::integer,0) desc,(p.province_id=home) desc,p.province_id limit 1;
  if not found then continue;end if;
  actual:=coalesce((site.facilities->>facility)::integer,0);
  if actual<required then
   if actual>=5 then continue;end if;
   cost:=jsonb_build_object('cash',1500*(actual+1),'supplies',500*(actual+1),'electronics',200*(actual+1),'manpower',100);
   if dorra_private.war_ai_can_pay(mid,nid,cost) and dorra_private.war_ai_try_economy(mid,nid,'build',jsonb_build_object('provinceId',site.province_id,'facility',facility),gt) then made:=true;exit;end if;
  elsif facility=coalesce(candidate.data->>'facility','army-base') then
   cost:=jsonb_build_object('cash',greatest(200,coalesce((candidate.data#>>'{cost,cash}')::numeric,1000)*.25),'electronics',greatest(100,coalesce((candidate.data#>>'{cost,electronics}')::numeric,200)*.5));
   if dorra_private.war_ai_can_pay(mid,nid,cost) and dorra_private.war_ai_try_economy(mid,nid,'research',jsonb_build_object('platformId',candidate.id),gt) then made:=true;exit;end if;
  end if;
 end loop;end if;
 if force_count+queued>=least(80,soft_target) then return;end if;
 select * into s from dorra_private.war_sides where match_id=mid and nation_id=nid;
 for candidate in select p.*,dorra_private.war_ai_priority(p.data,counts,threats,maritime) priority from dorra_private.war_catalog_platforms p
 where s.research ? p.id and dorra_private.war_platform_allowed(mid,nid,p.data) and coalesce((p.data->>'buildable')::boolean,true)
 and (not coalesce((p.data->>'nuclear')::boolean,false) or retaliation)
 order by priority desc,p.id limit 16 loop
  if candidate.priority<=0 or not dorra_private.war_ai_can_pay(mid,nid,candidate.data->'cost') then continue;end if;
  facility:=coalesce(candidate.data->>'facility','army-base');required:=greatest(1,coalesce((candidate.data->>'level')::integer,1));
  for site in select p.province_id from dorra_private.war_provinces p join dorra_private.war_catalog_provinces c on c.id=p.province_id where p.match_id=mid and p.nation_id=nid and p.radiation_until<=gt
   and coalesce((p.facilities->>facility)::integer,0)>=required and (candidate.data->>'domain'<>'sea' or coalesce((c.data->>'port')::boolean,false))
   and not exists(select 1 from dorra_private.war_events e where e.match_id=mid and e.kind='produce' and e.payload->>'provinceId'=p.province_id)
   order by (p.province_id=home) desc,p.province_id limit 3 loop
   if dorra_private.war_ai_try_economy(mid,nid,'produce',jsonb_build_object('provinceId',site.province_id,'platformId',candidate.id),gt) then return;end if;
  end loop;
 end loop;
end $$;

do $$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='dorra_private' and (p.proname like 'war_ai%' or p.proname in('war_economy_command','war_order_command')) loop
 execute 'revoke all on function '||f.signature||' from public,anon,authenticated';
 execute 'grant execute on function '||f.signature||' to service_role';
 end loop;
end $$;
