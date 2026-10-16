-- Older world starts left the selected rival's opening war to its first AI
-- decision. The fair AI respects absent relations as peace, so repair only that
-- missing saved-world state. Any explicit treaty or pending proposal wins.
do $saved_world_rivals$
declare saved_match record;inserted integer;
begin
 for saved_match in
  select m.id from dorra_private.war_matches m
  where m.template='world' and m.opponent='ai' and m.status in('running','paused')
   and exists(
    select 1 from dorra_private.war_sides rival
    join dorra_private.war_sides commander on commander.match_id=rival.match_id
     and commander.nation_id=rival.enemy_nation_id and commander.user_id=m.host_id
     and not commander.is_ai and not commander.retired
    where rival.match_id=m.id and rival.is_ai and rival.active_ai and not rival.retired
     and rival.nation_id<>commander.nation_id
     and not exists(select 1 from dorra_private.war_relations relation
      where relation.match_id=m.id and relation.a=least(rival.nation_id,commander.nation_id)
       and relation.b=greatest(rival.nation_id,commander.nation_id)))
  order by m.id for update of m
 loop
  insert into dorra_private.war_relations(match_id,a,b,relation)
  select saved_match.id,least(rival.nation_id,commander.nation_id),greatest(rival.nation_id,commander.nation_id),'war'
  from dorra_private.war_sides rival
  join dorra_private.war_sides commander on commander.match_id=rival.match_id
   and commander.nation_id=rival.enemy_nation_id and not commander.is_ai and not commander.retired
  join dorra_private.war_matches m on m.id=rival.match_id and m.host_id=commander.user_id
  where rival.match_id=saved_match.id and rival.is_ai and rival.active_ai and not rival.retired
   and rival.nation_id<>commander.nation_id
  on conflict(match_id,a,b) do nothing;
  get diagnostics inserted=row_count;
  if inserted>0 then
   update dorra_private.war_matches set revision=revision+1,notify_dirty=true where id=saved_match.id;
   -- Paused worlds do not dispatch; emit their ordinary member-filtered hint now.
   perform dorra_private.war_notify(saved_match.id);
  end if;
 end loop;
end $saved_world_rivals$;

-- Retreat can outlast a difficulty's decision interval. Keep its paid movement
-- and arrival event rather than resetting departure from the stored province on
-- each decision. Changed ownership, basing, radiation or observed danger still
-- permits the ordinary legal retreat planner to choose a different destination.
do $preserve_retreat$
declare definition text;needle text;replacement text;
begin
 definition:=pg_get_functiondef('dorra_private.war_ai_tactics(uuid,text,numeric,integer,uuid[])'::regprocedure);
 needle:=$old$  exit when actions>=maneuver_budget;ordered:=false;$old$;
 replacement:=needle||$new$
  if u.orders->>'type'='retreat' and u.orders->>'legTarget' is not null
   and (u.orders->>'arrival')::numeric>gt
   and exists(select 1 from dorra_private.war_events arrival where arrival.match_id=mid and arrival.kind='arrival'
    and arrival.due=(u.orders->>'arrival')::numeric and arrival.payload->>'unitId'=u.id::text
    and (arrival.payload->>'generation')::integer=u.generation)
   and exists(select 1 from dorra_private.war_provinces destination join dorra_private.war_catalog_provinces geography on geography.id=destination.province_id
    where destination.match_id=mid and destination.province_id=u.orders->>'targetProvinceId' and destination.nation_id=nid and destination.radiation_until<=gt
     and (u.domain<>'sea' or coalesce((geography.data->>'port')::boolean,false))
     and (u.domain<>'air' or dorra_private.war_air_basing(mid,nid,destination.province_id,u.id) is not null))
   and not exists(select 1 from dorra_private.war_units hostile where hostile.id=any(visible_ids) and hostile.nation_id=any(enemies) and hostile.health>0
    and hostile.province_id in(u.orders->>'targetProvinceId',u.orders->>'legTarget')) then continue;end if;$new$;
 if strpos(definition,needle)=0 then raise exception 'AI ongoing retreat preservation patch did not match';end if;
 -- Reapplication is harmless, including in the compatibility regression fixture.
 if strpos(definition,'arrival.payload->>''unitId''=u.id::text')=0 then execute replace(definition,needle,replacement);end if;
end $preserve_retreat$;
