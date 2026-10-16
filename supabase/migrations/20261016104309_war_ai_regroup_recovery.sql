-- Recovery uses ordinary owned territory, observed threats and the existing
-- paid field-repair rule. No decision consults an unseen opposing formation.
create function dorra_private.war_ai_recovery_safe(mid uuid,nid text,pid text,gt numeric,visible_ids uuid[]) returns boolean
language sql stable set search_path='' as $$
 select exists(
  select 1 from dorra_private.war_provinces home join dorra_private.war_catalog_provinces geography on geography.id=home.province_id
  where home.match_id=mid and home.nation_id=nid and home.province_id=pid and home.radiation_until<=gt
   and not exists(select 1 from jsonb_array_elements_text(coalesce(geography.data->'neighbors','[]')) edge(id)
    join dorra_private.war_provinces frontier on frontier.match_id=mid and frontier.province_id=edge.id
    where dorra_private.war_relation(mid,nid,frontier.nation_id)='war')
   and not exists(select 1 from dorra_private.war_units hostile join dorra_private.war_catalog_platforms platform on platform.id=hostile.platform_id
    where hostile.id=any(visible_ids) and hostile.health>0 and dorra_private.war_relation(mid,nid,hostile.nation_id)='war'
     and (hostile.province_id=pid or dorra_private.war_distance(hostile.province_id,pid)<=coalesce((platform.data#>>'{stats,range}')::numeric,0))))
$$;
revoke all on function dorra_private.war_ai_recovery_safe(uuid,text,text,numeric,uuid[]) from public,anon,authenticated;
grant execute on function dorra_private.war_ai_recovery_safe(uuid,text,text,numeric,uuid[]) to service_role;

do $regroup_tactics$
declare definition text;needle text;replacement text;
begin
 definition:=pg_get_functiondef('dorra_private.war_ai_tactics(uuid,text,numeric,integer,uuid[])'::regprocedure);
 needle:=$old$  if u.health>35 and u.domain<>'land' and ground_opportunity and not ground_attempted and actions>=greatest(0,maneuver_budget-1) then continue;end if;$old$;
 replacement:=$new$  if u.health<u.max_health*.75 and u.orders='{}'
   and dorra_private.war_ai_recovery_safe(mid,nid,u.province_id,gt,visible_ids) then
   -- A critical formation already behind friendly lines waits for its repair
   -- team rather than buying a fresh retreat every decision. Once repair is
   -- available, remain on site until usable at75%health.
   if exists(select 1 from dorra_private.war_units repair join dorra_private.war_catalog_platforms platform on platform.id=repair.platform_id
    where repair.match_id=mid and repair.nation_id=nid and repair.health>0 and coalesce(platform.data->'capabilities','[]') ? 'repair'
     and ((repair.province_id=u.province_id and repair.orders='{}') or (repair.orders->>'targetProvinceId'=u.province_id and repair.orders->>'type' in('move','retreat')))) then continue;end if;
   if u.health<=35 then
    for candidate in select destination.province_id from dorra_private.war_provinces destination join dorra_private.war_catalog_provinces geography on geography.id=destination.province_id
    where destination.match_id=mid and destination.nation_id=nid and destination.province_id<>u.province_id
     and dorra_private.war_ai_recovery_safe(mid,nid,destination.province_id,gt,visible_ids)
     and (u.domain<>'sea' or coalesce((geography.data->>'port')::boolean,false))
     and (u.domain<>'air' or dorra_private.war_air_basing(mid,nid,destination.province_id,u.id) is not null)
     and exists(select 1 from dorra_private.war_units repair join dorra_private.war_catalog_platforms platform on platform.id=repair.platform_id
      where repair.match_id=mid and repair.nation_id=nid and repair.health>0 and coalesce(platform.data->'capabilities','[]') ? 'repair'
       and ((repair.province_id=destination.province_id and repair.orders='{}') or (repair.orders->>'targetProvinceId'=destination.province_id and repair.orders->>'type' in('move','retreat'))))
    order by dorra_private.war_distance(u.province_id,destination.province_id),destination.province_id limit 3 loop
     ordered:=dorra_private.war_ai_try_order(mid,nid,u.id,'retreat',candidate.province_id,gt);exit when ordered;
    end loop;
    if ordered then actions:=actions+1;end if;
    continue;
   end if;
  end if;
$new$||needle;
 if strpos(definition,needle)=0 then raise exception 'AI safe regroup patch did not match';end if;definition:=replace(definition,needle,replacement);
 needle:=$old$  elsif u.domain='support' or (dorra_private.war_ai_role(u.platform_data)='support' and home is not null) then
   for candidate in$old$;
 replacement:=$new$  elsif u.domain='support' or (dorra_private.war_ai_role(u.platform_data)='support' and home is not null) then
   if coalesce(u.platform_data->'capabilities','[]') ? 'repair' then
    target:=null;
    -- Cover the greatest own casualty concentration first. Other teams already
    -- parked or travelling there count as coverage, so teams can spread out.
    for candidate in select destination.province_id,sum((wounded.max_health*.75-wounded.health)*wounded.strength) deficit
    from dorra_private.war_provinces destination
    join dorra_private.war_units wounded on wounded.match_id=mid and wounded.nation_id=nid and wounded.health>0 and wounded.health<wounded.max_health*.75
     and ((wounded.province_id=destination.province_id and wounded.orders='{}') or (wounded.orders->>'type'='retreat' and wounded.orders->>'targetProvinceId'=destination.province_id))
    where destination.match_id=mid and destination.nation_id=nid and dorra_private.war_ai_recovery_safe(mid,nid,destination.province_id,gt,visible_ids)
     and not exists(select 1 from dorra_private.war_units other_team join dorra_private.war_catalog_platforms platform on platform.id=other_team.platform_id
      where other_team.match_id=mid and other_team.nation_id=nid and other_team.id<>u.id and other_team.health>0 and coalesce(platform.data->'capabilities','[]') ? 'repair'
       and ((other_team.province_id=destination.province_id and other_team.orders='{}') or (other_team.orders->>'targetProvinceId'=destination.province_id and other_team.orders->>'type' in('move','retreat'))))
    group by destination.province_id
    order by deficit desc,dorra_private.war_distance(u.province_id,destination.province_id),destination.province_id limit 3 loop
     target:=candidate.province_id;
     if target=u.province_id then exit;end if;
     ordered:=dorra_private.war_ai_try_order(mid,nid,u.id,'move',target,gt);exit when ordered;
     target:=null;
    end loop;
    if target is not null then
     if ordered then actions:=actions+1;end if;
     continue;
    end if;
   end if;
   for candidate in$new$;
 if strpos(definition,needle)=0 then raise exception 'AI repair-team coordination patch did not match';end if;definition:=replace(definition,needle,replacement);
 needle:=$old$  if cardinality(enemies)=0 or (u.id=any(reserved) and dorra_private.war_ai_role(u.platform_data)<>'air-defense') then continue;end if;$old$;
 replacement:=$new$  if (cardinality(enemies)=0 and not(coalesce(u.platform_data->'capabilities','[]') ? 'repair'))
   or (u.id=any(reserved) and dorra_private.war_ai_role(u.platform_data)<>'air-defense') then continue;end if;$new$;
 if strpos(definition,needle)=0 then raise exception 'AI peaceful recovery logistics patch did not match';end if;
 execute replace(definition,needle,replacement);
end $regroup_tactics$;

do $recovery_production$
declare definition text;needle text;replacement text;
begin
 definition:=pg_get_functiondef('dorra_private.war_ai_economy(uuid,text,numeric,boolean,uuid[])'::regprocedure);
 needle:=$old$research_slots integer;retaliation boolean;$old$;
 replacement:=$new$research_slots integer;retaliation boolean;urgent_repair boolean;capacity_blocked boolean;$new$;
 if strpos(definition,needle)=0 then raise exception 'AI recovery economy declaration patch did not match';end if;definition:=replace(definition,needle,replacement);
 needle:=$old$ soft_target:=least(24,greatest(8,6+ceil(owned/4.0)::integer));$old$;
 replacement:=needle||$new$
 capacity_blocked:=force_count+queued>=soft_target;
 urgent_repair:=exists(select 1 from dorra_private.war_units wounded where wounded.match_id=mid and wounded.nation_id=nid and wounded.health>0 and wounded.health<=35)
  and not exists(select 1 from dorra_private.war_units repair join dorra_private.war_catalog_platforms platform on platform.id=repair.platform_id
   where repair.match_id=mid and repair.nation_id=nid and repair.health>0 and coalesce(platform.data->'capabilities','[]') ? 'repair')
  and not exists(select 1 from dorra_private.war_events job join dorra_private.war_catalog_platforms platform on platform.id=job.payload->>'platformId'
   where job.match_id=mid and job.kind='produce' and job.payload->>'nationId'=nid and coalesce(platform.data->'capabilities','[]') ? 'repair');$new$;
 if strpos(definition,needle)=0 then raise exception 'AI recovery need patch did not match';end if;definition:=replace(definition,needle,replacement);
 needle:=$old$dorra_private.war_ai_priority(p.data,counts,threats,maritime) priority$old$;
 replacement:=$new$dorra_private.war_ai_priority(p.data,counts,threats,maritime)+case when urgent_repair and coalesce(p.data->'capabilities','[]') ? 'repair' then 200 else 0 end priority$new$;
 if strpos(definition,needle)=0 then raise exception 'AI repair priority patch did not match';end if;definition:=replace(definition,needle,replacement);
 needle:=$old$ if force_count+queued>=least(80,soft_target) then return;end if;$old$;
 replacement:=$new$ -- At most one missing recovery team can exceed the planning soft target.
 -- The human80-formation hard cap, real costs, queues and national rules apply.
 if force_count+queued>=80 or (capacity_blocked and not urgent_repair) then return;end if;$new$;
 if strpos(definition,needle)=0 then raise exception 'AI recovery capacity patch did not match';end if;definition:=replace(definition,needle,replacement);
 needle:=$old$ where s.research ? p.id and dorra_private.war_platform_allowed(mid,nid,p.data) and coalesce((p.data->>'buildable')::boolean,true)$old$;
 replacement:=needle||$new$
 and (not capacity_blocked or (urgent_repair and coalesce(p.data->'capabilities','[]') ? 'repair'))$new$;
 if strpos(definition,needle)=0 then raise exception 'AI recovery-only cap exception patch did not match';end if;
 execute replace(definition,needle,replacement);
end $recovery_production$;
