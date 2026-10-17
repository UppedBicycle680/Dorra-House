-- Dorra War: all match rules execute here. The browser and Edge gateway submit
-- intentions, never snapshots, clocks, damage, rewards, or wallet balances.
create table dorra_private.war_catalog_nations(id text primary key,name text not null,data jsonb not null);
create table dorra_private.war_catalog_provinces(id text primary key,country_id text not null,name text not null,data jsonb not null);
create index war_catalog_provinces_country on dorra_private.war_catalog_provinces(country_id);
create table dorra_private.war_catalog_platforms(id text primary key,name text not null,data jsonb not null);

create table dorra_private.war_matches(
 id uuid primary key default gen_random_uuid(),name text not null,host_id uuid not null references auth.users(id),
 status text not null default 'lobby' check(status in('lobby','running','paused','finished')),
 template text not null check(template in('duel','world')),opponent text not null check(opponent in('ai','human')),
 pace text not null check(pace in('fast','persistent')),visibility text not null check(visibility in('public','invite')),
 invite_code uuid not null default gen_random_uuid(),catalog_version text not null default 'ne-5.1.2-war-1',
 revision bigint not null default 1,game_anchor numeric not null default 0,real_anchor timestamptz,
 last_dispatch timestamptz,speed integer not null check(speed in(4,360)),limit_seconds integer not null,
 next_due timestamptz,seed uuid not null default gen_random_uuid(),winner text,finished_at timestamptz,
 created_at timestamptz not null default now(),error_count integer not null default 0,last_error text,
 capital_hold_nation text,capital_hold_started numeric
);
create index war_matches_due on dorra_private.war_matches(next_due) where status='running';
create index war_matches_host on dorra_private.war_matches(host_id,status);
create table dorra_private.war_sides(
 match_id uuid not null references dorra_private.war_matches on delete cascade,nation_id text not null,
 user_id uuid references auth.users(id),is_ai boolean not null default true,active_ai boolean not null default false,enemy_nation_id text,retired boolean not null default false,
 resources jsonb not null default '{"cash":20000,"supplies":5000,"fuel":3500,"electronics":2000,"manpower":6000}',
 research jsonb not null default '[]',import_licenses jsonb not null default '[]',economy_at numeric not null default 0,score numeric not null default 0,
 joined_at timestamptz not null default now(),last_command_at timestamptz,
 primary key(match_id,nation_id),unique(match_id,user_id)
);
create index war_sides_user on dorra_private.war_sides(user_id,match_id) where user_id is not null;
create table dorra_private.war_provinces(
 match_id uuid not null references dorra_private.war_matches on delete cascade,province_id text not null,
 nation_id text not null,morale numeric not null default 80,facilities jsonb not null default '{}',
 radiation_until numeric not null default 0,primary key(match_id,province_id)
);
create index war_provinces_owner on dorra_private.war_provinces(match_id,nation_id);
create table dorra_private.war_units(
 id uuid primary key default gen_random_uuid(),match_id uuid not null references dorra_private.war_matches on delete cascade,
 nation_id text not null,province_id text not null,platform_id text not null,name text not null,
 domain text not null,strength numeric not null default 1,health numeric not null default 100,max_health numeric not null default 100,
 orders jsonb not null default '{}',generation integer not null default 0,
 check(strength>0 and health>=0 and max_health>0)
);
create index war_units_location on dorra_private.war_units(match_id,province_id,nation_id);
create index war_units_nation on dorra_private.war_units(match_id,nation_id);
create table dorra_private.war_events(
 id bigint generated always as identity primary key,match_id uuid not null references dorra_private.war_matches on delete cascade,
 kind text not null,due numeric not null,payload jsonb not null default '{}'
);
create index war_events_due on dorra_private.war_events(match_id,due,id);
create table dorra_private.war_relations(
 match_id uuid not null references dorra_private.war_matches on delete cascade,a text not null,b text not null,
 relation text not null default 'peace' check(relation in('peace','war','alliance','ceasefire')),
 proposed_by text,proposal text,primary key(match_id,a,b),check(a<b)
);
create table dorra_private.war_reports(
 id bigint generated always as identity primary key,match_id uuid not null references dorra_private.war_matches on delete cascade,
 nation_id text,game_time numeric not null,body jsonb not null
);
create index war_reports_reader on dorra_private.war_reports(match_id,nation_id,id desc);
create table dorra_private.war_requests(
 user_id uuid not null,request_id uuid not null,digest text not null,match_id uuid,result jsonb not null,
 created_at timestamptz not null default now(),primary key(user_id,request_id)
);
create table dorra_private.war_rewards(
 user_id uuid not null references auth.users(id),match_id uuid not null references dorra_private.war_matches,
 amount integer not null check(amount between 0 and 1000),reward_day date not null,created_at timestamptz not null default now(),
 primary key(user_id,match_id)
);
create index war_rewards_day on dorra_private.war_rewards(user_id,reward_day);
create table dorra_private.war_observers(
 match_id uuid not null references dorra_private.war_matches on delete cascade,user_id uuid not null references auth.users(id),
 visible_digest text,revision bigint not null default 0,last_hint timestamptz,primary key(match_id,user_id)
);

create function dorra_private.war_now(m dorra_private.war_matches) returns numeric
language sql stable set search_path='' as $$
 select least(m.limit_seconds,m.game_anchor+case when m.status='running' then greatest(0,extract(epoch from (clock_timestamp()-m.real_anchor)))*m.speed else 0 end)
$$;
create function dorra_private.war_relation(mid uuid,na text,nb text) returns text
language sql stable set search_path='' as $$
 select case when na=nb then 'self' else coalesce((select relation from dorra_private.war_relations where match_id=mid and a=least(na,nb) and b=greatest(na,nb)),'peace') end
$$;
create function dorra_private.war_distance(pa text,pb text) returns numeric
language sql stable set search_path='' as $$
 select 6371*2*asin(least(1,sqrt(power(sin(radians(((b.data->>'lat')::double precision-(a.data->>'lat')::double precision)/2)),2)+cos(radians((a.data->>'lat')::double precision))*cos(radians((b.data->>'lat')::double precision))*power(sin(radians(((b.data->>'lng')::double precision-(a.data->>'lng')::double precision)/2)),2))))
 from dorra_private.war_catalog_provinces a,dorra_private.war_catalog_provinces b where a.id=pa and b.id=pb
$$;
create function dorra_private.war_ecm(mid uuid,nid text,pid text) returns numeric
language sql stable set search_path='' as $$
 select case when exists(select 1 from dorra_private.war_units jammer join dorra_private.war_catalog_platforms platform on platform.id=jammer.platform_id
 where jammer.match_id=mid and jammer.health>0 and dorra_private.war_relation(mid,nid,jammer.nation_id)='war'
 and platform.data->'capabilities' ? 'electronic-attack'
 and dorra_private.war_distance(pid,jammer.province_id)<=coalesce((platform.data#>>'{stats,range}')::numeric,250)) then .65 else 1 end
$$;
create function dorra_private.war_vision(mid uuid,observer text,u dorra_private.war_units) returns boolean
language sql stable set search_path='' as $$
 select u.nation_id=observer or dorra_private.war_relation(mid,observer,u.nation_id)='alliance' or exists(
 select 1 from dorra_private.war_provinces p where p.match_id=mid and p.province_id=u.province_id and p.nation_id=observer
 ) or exists(
 select 1 from dorra_private.war_units scout join dorra_private.war_catalog_platforms sp on sp.id=scout.platform_id
 join dorra_private.war_catalog_platforms ep on ep.id=u.platform_id
 where scout.match_id=mid and scout.nation_id=observer and scout.health>0 and
 dorra_private.war_distance(scout.province_id,u.province_id)<=coalesce((sp.data#>>'{stats,vision}')::numeric,100)*(case when exists(select 1 from dorra_private.war_sides cmd where cmd.match_id=mid and cmd.nation_id=observer and cmd.research ? 'networked-command') then 1.15 else 1 end)
 and (coalesce((ep.data#>>'{stats,stealth}')::numeric,0)<=coalesce((sp.data#>>'{stats,radar}')::numeric,0)*dorra_private.war_ecm(mid,observer,scout.province_id) or scout.province_id=u.province_id))
$$;
create function dorra_private.war_report(mid uuid,nid text,gt numeric,content jsonb) returns void
language sql set search_path='' as $$ insert into dorra_private.war_reports(match_id,nation_id,game_time,body) values(mid,nid,gt,content) $$;

create function dorra_private.war_platform_allowed(mid uuid,nid text,platform jsonb) returns boolean
language sql stable set search_path='' as $$
 select ((platform->'operators' ? nid or platform->'operators' ? '*') or
 (not coalesce((platform->>'nuclear')::boolean,false) and coalesce((platform->>'exportable')::boolean,true)
 and exists(select 1 from dorra_private.war_sides s cross join lateral jsonb_array_elements_text(s.import_licenses) license(nation)
 where s.match_id=mid and s.nation_id=nid and platform->'operators' ? license.nation)))
 and (not coalesce((platform->>'nuclear')::boolean,false) or exists(select 1 from dorra_private.war_catalog_nations where id=nid and coalesce((data->>'nuclear')::boolean,false)))
$$;
create function dorra_private.war_supply(mid uuid,nid text,pid text) returns numeric
language sql stable set search_path='' as $$
 select greatest(.45,least(1.15,
 case when exists(select 1 from dorra_private.war_catalog_nations n join dorra_private.war_provinces cp on cp.match_id=mid and cp.province_id=n.data->>'capitalProvinceId' and cp.nation_id=nid where n.id=nid) then .9 else .6 end
 +case when exists(select 1 from dorra_private.war_provinces p where p.match_id=mid and p.province_id=pid and p.nation_id=nid) then .1 else 0 end
 +case when exists(select 1 from dorra_private.war_units u join dorra_private.war_catalog_platforms p on p.id=u.platform_id where u.match_id=mid and u.nation_id=nid and p.data->'capabilities' ? 'resupply' and dorra_private.war_distance(pid,u.province_id)<250) then .1 else 0 end
 +case when exists(select 1 from dorra_private.war_sides cmd where cmd.match_id=mid and cmd.nation_id=nid and cmd.research ? 'networked-command') then .05 else 0 end
 -case when exists(select 1 from dorra_private.war_sides s where s.match_id=mid and s.nation_id=nid and ((s.resources->>'fuel')::numeric<=0 or (s.resources->>'supplies')::numeric<=0)) then .2 else 0 end))
$$;

create function dorra_private.war_accrue(mid uuid,nid text,gt numeric) returns void
language plpgsql set search_path='' as $$
declare s dorra_private.war_sides; elapsed numeric; cities integer; regions integer; unit_count numeric; cash_rate numeric; supply_rate numeric; fuel_rate numeric; e_rate numeric; manpower_rate numeric; key text; value numeric; res jsonb;
begin
 select * into s from dorra_private.war_sides where match_id=mid and nation_id=nid for update;
 if not found then return; end if;elapsed:=greatest(0,gt-s.economy_at)/86400;if elapsed=0 then return;end if;
 select count(*),count(*) filter(where coalesce((c.data->>'city')::boolean,false)) into regions,cities
 from dorra_private.war_provinces p join dorra_private.war_catalog_provinces c on c.id=p.province_id where p.match_id=mid and p.nation_id=nid;
 select coalesce(sum(strength),0) into unit_count from dorra_private.war_units where match_id=mid and nation_id=nid;
 cash_rate:=greatest(-5000,1000+regions*55+cities*180-unit_count*45);supply_rate:=greatest(-1000,350+regions*20-unit_count*8);
 fuel_rate:=greatest(-1000,200+regions*12-unit_count*5);e_rate:=100+cities*45;manpower_rate:=350+regions*20;
 res:=s.resources;
 for key,value in select * from (values('cash',cash_rate),('supplies',supply_rate),('fuel',fuel_rate),('electronics',e_rate),('manpower',manpower_rate)) rates(k,v) loop
 res:=jsonb_set(res,array[key],to_jsonb(greatest(0,least(100000000,coalesce((res->>key)::numeric,0)+elapsed*value))));
 end loop;
 update dorra_private.war_sides set resources=res,economy_at=gt where match_id=mid and nation_id=nid;
end $$;
create function dorra_private.war_pay(mid uuid,nid text,cost jsonb) returns void
language plpgsql set search_path='' as $$
declare res jsonb; k text; v numeric;
begin
 select resources into res from dorra_private.war_sides where match_id=mid and nation_id=nid for update;
 for k,v in select key,(value#>>'{}')::numeric from jsonb_each(cost) loop
 if k not in('cash','supplies','fuel','electronics','manpower') or v<0 or v>100000000 then raise exception 'INVALID_COST';end if;
 if coalesce((res->>k)::numeric,0)<v then raise exception 'INSUFFICIENT_RESOURCES';end if;
 res:=jsonb_set(res,array[k],to_jsonb((res->>k)::numeric-v));
 end loop;
 update dorra_private.war_sides set resources=res where match_id=mid and nation_id=nid;
end $$;

-- Shortest routes use immutable catalogue adjacency. No client-supplied path
-- distance or cross-ocean centroid teleport is accepted.
create function dorra_private.war_route(mid uuid,nid text,src text,dst text,domain text,embark boolean default false) returns text[]
language plpgsql set search_path='' as $$
declare route text[]; visited text[]:=array[src]; frontier text[]:=array[src]; next_front text[]; parents jsonb:='{}'; node text; edge text; pred text; i integer;
begin
 if src=dst then return array[src];end if;
 if not exists(select 1 from dorra_private.war_provinces where match_id=mid and province_id=dst) then raise exception 'INVALID_DESTINATION';end if;
 if domain in('air','missile') then return array[src,dst];end if;
 for i in 1..256 loop
 next_front:=array[]::text[];
 foreach node in array frontier loop
 for edge in select jsonb_array_elements_text(coalesce(c.data->'neighbors','[]')||case when domain='sea' or embark then coalesce(c.data->'seaNeighbors','[]') else '[]'::jsonb end) from dorra_private.war_catalog_provinces c where id=node loop
 if edge=any(visited) then continue;end if;
 if not exists(select 1 from dorra_private.war_provinces where match_id=mid and province_id=edge) then continue;end if;
 if domain='sea' and not exists(select 1 from dorra_private.war_catalog_provinces where id=edge and coalesce((data->>'port')::boolean,false)) then continue;end if;
 -- Movement through a foreign province requires alliance or war; peace borders close.
 if edge<>dst and exists(select 1 from dorra_private.war_provinces p where p.match_id=mid and p.province_id=edge and dorra_private.war_relation(mid,nid,p.nation_id)='peace') then continue;end if;
 parents:=jsonb_set(parents,array[edge],to_jsonb(node));visited:=array_append(visited,edge);next_front:=array_append(next_front,edge);
 if edge=dst then route:=array[dst];pred:=dst;while pred<>src loop pred:=parents->>pred;route:=array_prepend(pred,route);end loop;return route;end if;
 end loop;end loop;
 frontier:=next_front;if cardinality(frontier)=0 or cardinality(visited)>8000 then exit;end if;
 end loop;
 raise exception 'NO_ROUTE';
end $$;

create function dorra_private.war_schedule_move(mid uuid,uid uuid,target text,kind text,gt numeric,waypoints jsonb default '[]') returns void
language plpgsql set search_path='' as $$
declare u dorra_private.war_units;p jsonb;path text[];part text[];cursor_province text;via text;dist numeric:=0;speed numeric;duration numeric;i integer;dest_owner text;
begin
 select * into u from dorra_private.war_units where id=uid and match_id=mid for update;
 if not found or u.health<=0 then raise exception 'UNIT_UNAVAILABLE';end if;
 if u.orders<>'{}'::jsonb and kind<>'retreat' then raise exception 'UNIT_BUSY';end if;
 select data into p from dorra_private.war_catalog_platforms where id=u.platform_id;
 if kind='embark' and not exists(select 1 from dorra_private.war_catalog_provinces where id=u.province_id and coalesce((data->>'port')::boolean,false)) then raise exception 'PORT_REQUIRED';end if;
 if jsonb_typeof(waypoints)<>'array' or jsonb_array_length(waypoints)>8 then raise exception 'INVALID_WAYPOINTS';end if;
 path:=array[u.province_id];cursor_province:=u.province_id;
 for via in select jsonb_array_elements_text(waypoints||jsonb_build_array(target)) loop
 part:=dorra_private.war_route(mid,u.nation_id,cursor_province,via,u.domain,kind='embark');
 if cardinality(part)>1 then path:=path||part[2:cardinality(part)];end if;cursor_province:=via;
 end loop;
 for i in 2..cardinality(path) loop dist:=dist+greatest(5,dorra_private.war_distance(path[i-1],path[i]));end loop;
 if dist=0 then raise exception 'ALREADY_THERE';end if;
 speed:=greatest(1,coalesce((p#>>'{stats,speed}')::numeric,35));if kind='embark' then speed:=25;end if;
 if u.domain='air' and dist>coalesce((p#>>'{stats,range}')::numeric,1500)*2 then raise exception 'OUT_OF_RANGE';end if;
 select nation_id into dest_owner from dorra_private.war_provinces where match_id=mid and province_id=target;
 if kind in('attack','bombard','intercept') and dorra_private.war_relation(mid,u.nation_id,dest_owner)<>'war' then raise exception 'DECLARE_WAR_FIRST';end if;
 if kind in('move','retreat','patrol','embark') and dest_owner<>u.nation_id and dorra_private.war_relation(mid,u.nation_id,dest_owner) not in('war','alliance') then raise exception 'BORDER_CLOSED';end if;
 if kind='retreat' and dest_owner<>u.nation_id then raise exception 'RETREAT_TO_FRIENDLY';end if;
 perform dorra_private.war_pay(mid,u.nation_id,jsonb_build_object('fuel',ceil(dist*u.strength/20)));
 duration:=greatest(120,dorra_private.war_distance(path[1],path[2])/speed*3600);
 update dorra_private.war_units set generation=generation+1,orders=jsonb_build_object('type',kind,'fromProvinceId',province_id,'targetProvinceId',target,'path',to_jsonb(path),'legIndex',1,'legTarget',path[2],'legSpeed',speed,'departure',gt,'arrival',gt+duration,'embarked',kind='embark') where id=uid returning * into u;
 insert into dorra_private.war_events(match_id,kind,due,payload) values(mid,'arrival',gt+duration,jsonb_build_object('unitId',uid,'generation',u.generation));
end $$;

create function dorra_private.war_capture(mid uuid,nid text,pid text,gt numeric) returns void
language plpgsql set search_path='' as $$
declare old_owner text;
begin
 select nation_id into old_owner from dorra_private.war_provinces where match_id=mid and province_id=pid for update;
 if old_owner=nid or dorra_private.war_relation(mid,nid,old_owner)<>'war' then return;end if;
 if exists(select 1 from dorra_private.war_units where match_id=mid and province_id=pid and nation_id<>nid and health>0 and dorra_private.war_relation(mid,nid,nation_id)='war') then return;end if;
 if not exists(select 1 from dorra_private.war_units where match_id=mid and province_id=pid and nation_id=nid and domain='land' and health>0 and not coalesce((orders->>'embarked')::boolean,false)) then return;end if;
 perform dorra_private.war_accrue(mid,old_owner,gt);perform dorra_private.war_accrue(mid,nid,gt);
 update dorra_private.war_provinces set nation_id=nid,morale=35 where match_id=mid and province_id=pid;
 perform dorra_private.war_report(mid,nid,gt,jsonb_build_object('type','capture','provinceId',pid,'previousOwner',old_owner));
 perform dorra_private.war_report(mid,old_owner,gt,jsonb_build_object('type','province-lost','provinceId',pid,'ownerId',nid));
end $$;

create function dorra_private.war_combat(mid uuid,gt numeric) returns void
language plpgsql set search_path='' as $$
declare damage record;front record;u dorra_private.war_units;new_health numeric;factor numeric;
begin
 -- All damage is calculated before any unit is changed. Newly destroyed units
 -- therefore still apply their same-pulse retaliation.
 for damage in
 select defender.id,defender.nation_id,defender.province_id,defender.health,
 sum(greatest(1,coalesce((ap.data#>>'{stats,attack}')::numeric,8)*attacker.strength*(attacker.health/attacker.max_health)*dorra_private.war_supply(mid,attacker.nation_id,attacker.province_id)*
 (case when exists(select 1 from dorra_private.war_sides command_side where command_side.match_id=mid and command_side.nation_id=attacker.nation_id and command_side.research ? 'combined-arms-doctrine') then 1.08 else 1 end)*
 case when defender.domain='air' then greatest(.05,coalesce((ap.data#>>'{stats,airDefense}')::numeric,0)*dorra_private.war_ecm(mid,attacker.nation_id,attacker.province_id)/20) else 1 end /
 greatest(1,coalesce((dp.data#>>'{stats,defense}')::numeric,8)/8)*
 case when defender.domain='land' then case terrain.data->>'terrain' when 'mountain' then .7 when 'urban' then .8 when 'forest' then .85 when 'wetland' then .8 when 'desert' then .95 else 1 end else 1 end*
 (1.1-least(100,territory.morale)/500)/(1+coalesce((territory.facilities->>'fortification')::numeric,0)*.12)*
 case when coalesce((defender.orders->>'embarked')::boolean,false) then 1.7 else 1 end)) hit
 from dorra_private.war_units defender
 join dorra_private.war_catalog_platforms dp on dp.id=defender.platform_id
 join dorra_private.war_catalog_provinces terrain on terrain.id=defender.province_id
 join dorra_private.war_provinces territory on territory.match_id=mid and territory.province_id=defender.province_id
 join dorra_private.war_units attacker on attacker.match_id=defender.match_id and attacker.nation_id<>defender.nation_id and attacker.health>0
 join dorra_private.war_catalog_platforms ap on ap.id=attacker.platform_id
 where defender.match_id=mid and defender.health>0 and attacker.domain<>'missile'
 and dorra_private.war_relation(mid,attacker.nation_id,defender.nation_id)='war'
 and (attacker.province_id=defender.province_id or (attacker.orders->>'type' in('bombard','patrol','intercept')
 and (attacker.orders->>'type'<>'bombard' or attacker.orders->>'targetProvinceId'=defender.province_id)
 and coalesce((ap.data#>>'{stats,range}')::numeric,0)>=dorra_private.war_distance(attacker.province_id,defender.province_id)))
 and (attacker.orders='{}' or attacker.orders->>'type' in('bombard','patrol','intercept'))
 and dorra_private.war_vision(mid,attacker.nation_id,defender)
 group by defender.id,defender.nation_id,defender.province_id,defender.health
 loop
 new_health:=greatest(0,damage.health-least(80,damage.hit));
 update dorra_private.war_units set health=new_health where id=damage.id;
 perform dorra_private.war_report(mid,damage.nation_id,gt,jsonb_build_object('type','combat','unitId',damage.id,'provinceId',damage.province_id,'damage',round(damage.health-new_health,1),'destroyed',new_health=0));
 end loop;
 delete from dorra_private.war_units where match_id=mid and health<=0;
 for front in select distinct province_id,nation_id from dorra_private.war_units where match_id=mid and domain='land' and health>0 loop
 perform dorra_private.war_capture(mid,front.nation_id,front.province_id,gt);end loop;
end $$;

create function dorra_private.war_finish(mid uuid,gt numeric,forced boolean default false) returns void
language plpgsql set search_path='' as $$
declare m dorra_private.war_matches;total numeric;best text;best_score numeric;alive integer;capital_holder text;duel_won boolean:=false;
begin
 select * into m from dorra_private.war_matches where id=mid;
 update dorra_private.war_sides s set score=q.score from(select p.nation_id,sum(case when coalesce((c.data->>'capital')::boolean,false) then 10 when coalesce((c.data->>'city')::boolean,false) then 3 else 1 end) score from dorra_private.war_provinces p join dorra_private.war_catalog_provinces c on c.id=p.province_id where p.match_id=mid group by p.nation_id) q where s.match_id=mid and s.nation_id=q.nation_id;
 update dorra_private.war_sides s set score=0 where s.match_id=mid and not exists(select 1 from dorra_private.war_provinces p where p.match_id=mid and p.nation_id=s.nation_id);
 select sum(score),count(*) filter(where score>0 and not retired) into total,alive from dorra_private.war_sides where match_id=mid;
 select nation_id,score into best,best_score from dorra_private.war_sides where match_id=mid and not retired order by score desc,nation_id limit 1;
 if m.template='duel' then
 select cp.nation_id into capital_holder from dorra_private.war_sides opponent join dorra_private.war_catalog_nations n on n.id=opponent.nation_id
 join dorra_private.war_provinces cp on cp.match_id=mid and cp.province_id=n.data->>'capitalProvinceId'
 group by cp.nation_id having count(*)=2;
 if capital_holder is null then update dorra_private.war_matches set capital_hold_nation=null,capital_hold_started=null where id=mid;
 elsif capital_holder is distinct from m.capital_hold_nation then update dorra_private.war_matches set capital_hold_nation=capital_holder,capital_hold_started=gt where id=mid;
 elsif gt-m.capital_hold_started>=21600 then duel_won:=true;best:=capital_holder;end if;
 end if;
 if forced or alive<=1 or duel_won or (gt>=86400 and m.template='world' and best_score>=greatest(1,total)*.60) or gt>=m.limit_seconds then
 update dorra_private.war_matches set status='finished',winner=best,finished_at=now(),game_anchor=gt,real_anchor=null,next_due=null where id=mid;
 perform dorra_private.war_report(mid,null,gt,jsonb_build_object('type','match-finished','winner',best));
 end if;
end $$;

create function dorra_private.war_ai(mid uuid,nid text,gt numeric) returns void
language plpgsql set search_path='' as $$
declare u dorra_private.war_units;candidate record;s dorra_private.war_sides;platform record;home text;enemy text;destination text;port text;facility text;build_province text;required integer;actual integer;path text[];moved boolean:=false;cost jsonb;
begin
 select * into s from dorra_private.war_sides where match_id=mid and nation_id=nid;
 if not found or not s.is_ai or not s.active_ai then return;end if;
 perform dorra_private.war_accrue(mid,nid,gt);
 select p.province_id into home from dorra_private.war_provinces p join dorra_private.war_catalog_provinces c on c.id=p.province_id where p.match_id=mid and p.nation_id=nid order by coalesce((c.data->>'capital')::boolean,false) desc,p.province_id limit 1;
 if home is null then return;end if;
 enemy:=s.enemy_nation_id;
 if enemy is not null and dorra_private.war_relation(mid,nid,enemy)<>'alliance' then
 insert into dorra_private.war_relations(match_id,a,b,relation) values(mid,least(nid,enemy),greatest(nid,enemy),'war') on conflict(match_id,a,b) do update set relation='war',proposal=null,proposed_by=null;
 select * into u from dorra_private.war_units where match_id=mid and nation_id=nid and domain='land' and orders='{}' order by health desc,id limit 1;
 if found then
 select p.province_id into destination from dorra_private.war_provinces p join dorra_private.war_catalog_provinces c on c.id=p.province_id where p.match_id=mid and p.nation_id=enemy order by coalesce((c.data->>'capital')::boolean,false) desc,dorra_private.war_distance(u.province_id,p.province_id) limit 1;
 if destination is not null then
 begin perform dorra_private.war_schedule_move(mid,u.id,destination,'attack',gt);moved:=true;
 exception when sqlstate 'P0001' then if sqlerrm not in('NO_ROUTE','INSUFFICIENT_RESOURCES','ALREADY_THERE','BORDER_CLOSED') then raise;end if;end;
 if not moved then
 -- Island nations march to a genuine owned port, then use only precomputed
 -- maritime edges to an opposing port. No direct ocean teleport is introduced.
 if exists(select 1 from dorra_private.war_catalog_provinces where id=u.province_id and coalesce((data->>'port')::boolean,false)) then
 for candidate in select p.province_id from dorra_private.war_provinces p join dorra_private.war_catalog_provinces c on c.id=p.province_id where p.match_id=mid and p.nation_id=enemy and coalesce((c.data->>'port')::boolean,false) order by dorra_private.war_distance(u.province_id,p.province_id) limit 6 loop
 begin perform dorra_private.war_schedule_move(mid,u.id,candidate.province_id,'embark',gt);moved:=true;exception when sqlstate 'P0001' then if sqlerrm not in('NO_ROUTE','INSUFFICIENT_RESOURCES','ALREADY_THERE','BORDER_CLOSED') then raise;end if;end;
 exit when moved;end loop;
 else
 for candidate in select p.province_id from dorra_private.war_provinces p join dorra_private.war_catalog_provinces c on c.id=p.province_id where p.match_id=mid and p.nation_id=nid and coalesce((c.data->>'port')::boolean,false) order by dorra_private.war_distance(u.province_id,p.province_id) limit 4 loop
 begin perform dorra_private.war_schedule_move(mid,u.id,candidate.province_id,'move',gt);moved:=true;exception when sqlstate 'P0001' then if sqlerrm not in('NO_ROUTE','INSUFFICIENT_RESOURCES','ALREADY_THERE','BORDER_CLOSED') then raise;end if;end;
 exit when moved;end loop;
 end if;
 end if;end if;end if;
 end if;
 -- One research/build choice and one mobilization choice per six game hours.
 -- Neutral unclaimed nations never enter this function's active branch.
 select * into s from dorra_private.war_sides where match_id=mid and nation_id=nid;
 if (select count(*) from dorra_private.war_events where match_id=mid and kind='research' and payload->>'nationId'=nid)<2 then
 select p.* into platform from dorra_private.war_catalog_platforms p where dorra_private.war_platform_allowed(mid,nid,p.data)
 and not(s.research ? p.id) and not exists(select 1 from dorra_private.war_events e where e.match_id=mid and e.kind='research' and e.payload->>'nationId'=nid and e.payload->>'platformId'=p.id)
 and not exists(select 1 from jsonb_array_elements_text(coalesce(p.data->'prerequisites','[]')) prereq(id) where not(s.research ? prereq.id))
 order by coalesce((p.data->>'level')::integer,1),coalesce((p.data->>'buildable')::boolean,true),coalesce((p.data#>>'{stats,attack}')::numeric,0) desc,p.id limit 1;
 if found then
 facility:=coalesce(platform.data->>'facility','army-base');required:=greatest(1,coalesce((platform.data->>'level')::integer,1));build_province:=home;
 if facility='naval-base' then select p.province_id into build_province from dorra_private.war_provinces p join dorra_private.war_catalog_provinces c on c.id=p.province_id where p.match_id=mid and p.nation_id=nid and coalesce((c.data->>'port')::boolean,false) order by p.province_id limit 1;end if;
 select coalesce((facilities->>facility)::integer,0) into actual from dorra_private.war_provinces where match_id=mid and province_id=build_province;
 begin
 if build_province is not null and actual<required and not exists(select 1 from dorra_private.war_events where match_id=mid and kind='build' and payload->>'provinceId'=build_province) then
 perform dorra_private.war_pay(mid,nid,jsonb_build_object('cash',1500*(actual+1),'supplies',500*(actual+1),'electronics',200*(actual+1),'manpower',100));
 insert into dorra_private.war_events(match_id,kind,due,payload) values(mid,'build',gt+(6+actual*6)*3600,jsonb_build_object('nationId',nid,'provinceId',build_province,'facility',facility));
 elsif actual>=required then
 cost:=jsonb_build_object('cash',greatest(200,coalesce((platform.data#>>'{cost,cash}')::numeric,1000)*.25),'electronics',greatest(100,coalesce((platform.data#>>'{cost,electronics}')::numeric,200)*.5));perform dorra_private.war_pay(mid,nid,cost);
 insert into dorra_private.war_events(match_id,kind,due,payload) values(mid,'research',gt+greatest(1,coalesce((platform.data->>'researchHours')::numeric,12))*3600,jsonb_build_object('nationId',nid,'platformId',platform.id));
 end if;
 exception when sqlstate 'P0001' then if sqlerrm<>'INSUFFICIENT_RESOURCES' then raise;end if;end;
 end if;end if;
 if (select count(*) from dorra_private.war_units where match_id=mid and nation_id=nid)+(select count(*) from dorra_private.war_events where match_id=mid and kind='produce' and payload->>'nationId'=nid)<12 then
 select p.* into platform from dorra_private.war_catalog_platforms p join dorra_private.war_provinces b on b.match_id=mid and b.province_id=home where dorra_private.war_platform_allowed(mid,nid,p.data)
 and s.research ? p.id and coalesce((p.data->>'buildable')::boolean,true) and p.data->>'domain' in('land','air','support')
 and coalesce((b.facilities->>(p.data->>'facility'))::integer,0)>=greatest(1,coalesce((p.data->>'level')::integer,1))
 order by coalesce((p.data#>>'{stats,attack}')::numeric,0) desc,p.id limit 1;
 if found and not exists(select 1 from dorra_private.war_events where match_id=mid and kind='produce' and payload->>'provinceId'=home) then begin
 perform dorra_private.war_pay(mid,nid,platform.data->'cost');
 insert into dorra_private.war_events(match_id,kind,due,payload) values(mid,'produce',gt+greatest(1,coalesce((platform.data->>'buildHours')::numeric,12))*3600,jsonb_build_object('nationId',nid,'provinceId',home,'platformId',platform.id));
 exception when sqlstate 'P0001' then if sqlerrm<>'INSUFFICIENT_RESOURCES' then raise;end if;end;end if;
 end if;
end $$;

create function dorra_private.war_advance(mid uuid,max_events integer default 160) returns void
language plpgsql set search_path='' as $$
declare m dorra_private.war_matches;e dorra_private.war_events;gt numeric;u dorra_private.war_units;p record;owner text;nid text;steps integer:=0;d numeric;loss record;missile jsonb;idx integer;leg integer;next_leg text;travel_path jsonb;
begin
 select * into m from dorra_private.war_matches where id=mid for update;
 if not found or m.status<>'running' then return;end if;
 -- Preserve competition during a scheduler outage, rather than suddenly replaying
 -- hours of attacks. Ordinary player disconnections never enter this branch.
 if m.last_dispatch is not null and m.last_dispatch<clock_timestamp()-(case when m.pace='fast' then interval '30 seconds' else interval '120 seconds' end) then
 update dorra_private.war_matches set real_anchor=real_anchor+(clock_timestamp()-last_dispatch),last_dispatch=clock_timestamp() where id=mid returning * into m;
 end if;
 gt:=dorra_private.war_now(m);
 for e in select * from dorra_private.war_events where match_id=mid and due<=gt order by due,id limit least(400,greatest(1,max_events)) for update loop
 delete from dorra_private.war_events where id=e.id;steps:=steps+1;nid:=e.payload->>'nationId';
 if e.kind='arrival' then
 select * into u from dorra_private.war_units where id=(e.payload->>'unitId')::uuid and match_id=mid for update;
 if found and u.generation=(e.payload->>'generation')::integer and u.orders->>'targetProvinceId' is not null then
 owner:=coalesce(u.orders->>'legTarget',u.orders->>'targetProvinceId');
 -- Traverse route edges individually so capture and interception happen along
 -- the path. Each leg is scheduled with a new generation.
 travel_path:=u.orders->'path';leg:=coalesce((u.orders->>'legIndex')::integer,1);next_leg:=travel_path->>(leg+1);
 if next_leg is not null and not exists(select 1 from dorra_private.war_units enemy where enemy.match_id=mid and enemy.province_id=owner and dorra_private.war_relation(mid,u.nation_id,enemy.nation_id)='war') then
 d:=greatest(120,dorra_private.war_distance(owner,next_leg)/greatest(1,(u.orders->>'legSpeed')::numeric)*3600);
 update dorra_private.war_units set province_id=owner,orders=orders||jsonb_build_object('legIndex',leg+1,'legTarget',next_leg,'fromProvinceId',owner,'departure',e.due,'arrival',e.due+d) where id=u.id;
 insert into dorra_private.war_events(match_id,kind,due,payload) values(mid,'arrival',e.due+d,e.payload);
 else update dorra_private.war_units set province_id=owner,orders=case when orders->>'type' in('patrol','intercept') then jsonb_build_object('type',orders->>'type','targetProvinceId',owner) else '{}' end where id=u.id;end if;
 perform dorra_private.war_capture(mid,u.nation_id,owner,e.due);
 perform dorra_private.war_report(mid,u.nation_id,e.due,jsonb_build_object('type','arrival','unitId',u.id,'provinceId',owner));
 end if;
 elsif e.kind='research' then
 update dorra_private.war_sides set research=case when research ? (e.payload->>'platformId') then research else research||jsonb_build_array(e.payload->>'platformId') end where match_id=mid and nation_id=nid;
 perform dorra_private.war_report(mid,nid,e.due,jsonb_build_object('type','research-complete','platformId',e.payload->>'platformId'));
 elsif e.kind in('produce','build') then
 select nation_id into owner from dorra_private.war_provinces where match_id=mid and province_id=e.payload->>'provinceId';
 if owner=nid then
 if e.kind='build' then
 update dorra_private.war_provinces set facilities=jsonb_set(facilities,array[e.payload->>'facility'],to_jsonb(coalesce((facilities->>(e.payload->>'facility'))::integer,0)+1)) where match_id=mid and province_id=e.payload->>'provinceId';
 else
 select * into p from dorra_private.war_catalog_platforms where id=e.payload->>'platformId';
 insert into dorra_private.war_units(match_id,nation_id,province_id,platform_id,name,domain) values(mid,nid,e.payload->>'provinceId',p.id,p.name,p.data->>'domain');
 end if;
 perform dorra_private.war_report(mid,nid,e.due,jsonb_build_object('type',e.kind||'-complete')||e.payload);
 else perform dorra_private.war_report(mid,nid,e.due,jsonb_build_object('type','queue-lost','provinceId',e.payload->>'provinceId'));end if;
 elsif e.kind='strike' then
 select * into u from dorra_private.war_units where match_id=mid and id=(e.payload->>'unitId')::uuid and generation=(e.payload->>'generation')::integer;
 if found then
 owner:=e.payload->>'targetProvinceId';select data into missile from dorra_private.war_catalog_platforms where id=u.platform_id;
 d:=coalesce((missile#>>'{stats,attack}')::numeric,60)*u.strength;
 -- Radar/air-defense in the target province can intercept a strategic weapon.
 select coalesce(sum(coalesce((cp.data#>>'{stats,airDefense}')::numeric,0)*def.strength),0) into idx from dorra_private.war_units def join dorra_private.war_catalog_platforms cp on cp.id=def.platform_id where def.match_id=mid and def.province_id=owner and def.nation_id<>u.nation_id;
 if idx>=d then perform dorra_private.war_report(mid,u.nation_id,e.due,jsonb_build_object('type','strike-intercepted','provinceId',owner));
 else
 for loss in select id,nation_id,health from dorra_private.war_units where match_id=mid and province_id=owner loop
 update dorra_private.war_units set health=greatest(0,health-d) where id=loss.id;
 perform dorra_private.war_report(mid,loss.nation_id,e.due,jsonb_build_object('type','strategic-strike','provinceId',owner,'damage',least(loss.health,d)));end loop;
 update dorra_private.war_provinces set morale=greatest(0,morale-case when coalesce((missile->>'nuclear')::boolean,false) then 60 else 20 end),radiation_until=case when coalesce((missile->>'nuclear')::boolean,false) then e.due+259200 else radiation_until end where match_id=mid and province_id=owner;
 perform dorra_private.war_report(mid,u.nation_id,e.due,jsonb_build_object('type','strike-resolved','provinceId',owner));
 end if;
 delete from dorra_private.war_units where id=u.id or (match_id=mid and health<=0);
 end if;
 elsif e.kind='combat' then
 perform dorra_private.war_combat(mid,e.due);
 insert into dorra_private.war_events(match_id,kind,due) values(mid,'combat',e.due+3600);
 perform dorra_private.war_finish(mid,e.due);
 elsif e.kind='ai' then
 perform dorra_private.war_ai(mid,nid,e.due);
 insert into dorra_private.war_events(match_id,kind,due,payload) values(mid,'ai',e.due+21600,e.payload);
 end if;
 if (select status from dorra_private.war_matches where id=mid)<>'running' then exit;end if;
 end loop;
 if steps>0 then update dorra_private.war_matches set revision=revision+1 where id=mid;end if;
 update dorra_private.war_matches mm set last_dispatch=clock_timestamp(),next_due=clock_timestamp()+make_interval(secs=>greatest(.2,least(5,coalesce((select min(due) from dorra_private.war_events where match_id=mid)-gt,3600)/mm.speed))::double precision) where id=mid and status='running';
 if gt>=m.limit_seconds then perform dorra_private.war_finish(mid,gt,true);end if;
end $$;

create function dorra_private.war_view(mid uuid,actor uuid) returns jsonb
language plpgsql set search_path='' as $$
declare m dorra_private.war_matches;s dorra_private.war_sides;gt numeric;units jsonb;view_data jsonb;
begin
 select * into m from dorra_private.war_matches where id=mid;
 select * into s from dorra_private.war_sides where match_id=mid and user_id=actor;
 if not found then raise exception 'MATCH_FORBIDDEN';end if;
 gt:=dorra_private.war_now(m);perform dorra_private.war_accrue(mid,s.nation_id,gt);select * into s from dorra_private.war_sides where match_id=mid and user_id=actor;
 select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'nationId',u.nation_id,'provinceId',u.province_id,'platformId',u.platform_id,'name',u.name,'domain',u.domain,'strength',u.strength,'health',u.health,'maxHealth',u.max_health,'order',case when u.nation_id=s.nation_id then u.orders else null end) order by u.id),'[]') into units from dorra_private.war_units u where u.match_id=mid and dorra_private.war_vision(mid,s.nation_id,u);
 view_data:=jsonb_build_object('match',jsonb_build_object('id',m.id,'name',m.name,'status',m.status,'pace',m.pace,'template',m.template,'opponent',m.opponent,'maxPlayers',case when m.template='duel' then 2 else 12 end,'revision',m.revision,'gameTime',gt,'speed',m.speed,'deadline',case when m.status='running' then clock_timestamp()+make_interval(secs=>((m.limit_seconds-gt)/m.speed)::double precision) else null end,'hostId',m.host_id,'inviteCode',case when m.host_id=actor then m.invite_code else null end),
 'player',jsonb_build_object('nationId',s.nation_id,'userId',actor,'resources',s.resources,'research',s.research,'importLicenses',s.import_licenses,
 'researchQueue',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'platformId',payload->>'platformId','due',due)),'[]') from dorra_private.war_events where match_id=mid and kind='research' and payload->>'nationId'=s.nation_id),
 'productionQueue',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'platformId',payload->>'platformId','provinceId',payload->>'provinceId','due',due)),'[]') from dorra_private.war_events where match_id=mid and kind='produce' and payload->>'nationId'=s.nation_id),
 'buildQueue',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'facility',payload->>'facility','provinceId',payload->>'provinceId','due',due)),'[]') from dorra_private.war_events where match_id=mid and kind='build' and payload->>'nationId'=s.nation_id)),
 'nations',(select coalesce(jsonb_agg(jsonb_build_object('id',ns.nation_id,'name',n.name,'ownerId',ns.user_id,'relation',dorra_private.war_relation(mid,s.nation_id,ns.nation_id),'score',ns.score,'capitalProvinceId',n.data->>'capitalProvinceId') order by n.name),'[]') from dorra_private.war_sides ns join dorra_private.war_catalog_nations n on n.id=ns.nation_id where ns.match_id=mid),
 'provinces',(select coalesce(jsonb_agg(jsonb_build_object('id',p.province_id,'ownerId',p.nation_id,'morale',case when p.nation_id=s.nation_id then p.morale else null end,'facilities',case when p.nation_id=s.nation_id then p.facilities else null end,'radiationUntil',p.radiation_until) order by p.province_id),'[]') from dorra_private.war_provinces p where p.match_id=mid),
 'units',units,'reports',(select coalesce(jsonb_agg(body||jsonb_build_object('id',id,'gameTime',game_time) order by id desc),'[]') from (select * from dorra_private.war_reports where match_id=mid and (nation_id is null or nation_id=s.nation_id) order by id desc limit 60) r),
 'diplomacy',(select coalesce(jsonb_agg(jsonb_build_object('nationId',case when a=s.nation_id then b else a end,'relation',relation,'proposal',proposal,'proposedBy',proposed_by)),'[]') from dorra_private.war_relations where match_id=mid and s.nation_id in(a,b)),
 'catalog',jsonb_build_object('version',m.catalog_version,'platforms',(select coalesce(jsonb_agg(data||jsonb_build_object('id',id,'name',name) order by name),'[]') from dorra_private.war_catalog_platforms where dorra_private.war_platform_allowed(mid,s.nation_id,data))),
 'victory',case when m.status='finished' then jsonb_build_object('winner',m.winner,'won',m.winner=s.nation_id,'rewardClaimed',exists(select 1 from dorra_private.war_rewards where user_id=actor and match_id=mid)) else null end);
 return view_data;
end $$;

-- A fingerprint excludes continuously changing clocks/resources and the global
-- revision. Hidden enemy movement never generates a hint for an observer.
create function dorra_private.war_notify(mid uuid) returns void
language plpgsql set search_path='' as $$
declare o record;fingerprint text;rev bigint;public_fingerprint text;sid text;
begin
 select md5(coalesce(string_agg(province_id||':'||nation_id||':'||radiation_until::text,',' order by province_id),'')) into public_fingerprint from dorra_private.war_provinces where match_id=mid;
 for o in select * from dorra_private.war_observers where match_id=mid loop
 select nation_id into sid from dorra_private.war_sides where match_id=mid and user_id=o.user_id;
 fingerprint:=md5(jsonb_build_object('public',public_fingerprint,'status',(select status from dorra_private.war_matches where id=mid),
 'units',(select coalesce(jsonb_agg(jsonb_build_array(u.id,u.nation_id,u.province_id,u.platform_id,u.strength,u.health,case when u.nation_id=sid then u.orders else null end) order by u.id),'[]') from dorra_private.war_units u where u.match_id=mid and dorra_private.war_vision(mid,sid,u)),
 'owned',(select coalesce(jsonb_agg(jsonb_build_array(province_id,morale,facilities) order by province_id),'[]') from dorra_private.war_provinces where match_id=mid and nation_id=sid),
 'reports',(select max(id) from dorra_private.war_reports where match_id=mid and (nation_id is null or nation_id=sid)),
 'diplomacy',(select coalesce(jsonb_agg(jsonb_build_array(a,b,relation,proposal,proposed_by) order by a,b),'[]') from dorra_private.war_relations where match_id=mid and sid in(a,b)),
 'research',(select jsonb_build_array(research,import_licenses) from dorra_private.war_sides where match_id=mid and nation_id=sid),
 'queues',(select coalesce(jsonb_agg(jsonb_build_array(id,kind,due,payload) order by id),'[]') from dorra_private.war_events where match_id=mid and kind in('research','produce','build') and payload->>'nationId'=sid))::text);
 if fingerprint is distinct from o.visible_digest then
 rev:=o.revision+1;update dorra_private.war_observers set visible_digest=fingerprint,revision=rev,last_hint=now() where match_id=mid and user_id=o.user_id;
 begin perform realtime.send(jsonb_build_object('matchId',mid,'revision',rev),'war-changed','dorra-war:'||o.user_id::text,true);exception when others then null;end;
 end if;
 end loop;
end $$;

create function dorra_private.war_dispatch() returns void
language plpgsql security definer set search_path='' as $$
declare m record;started timestamptz:=clock_timestamp();
begin
 for m in select id from dorra_private.war_matches where status='running' and next_due<=clock_timestamp() order by next_due limit 4 for update skip locked loop
 begin perform dorra_private.war_advance(m.id,160);perform dorra_private.war_notify(m.id);
 exception when others then update dorra_private.war_matches set error_count=error_count+1,last_error=left(sqlerrm,240),next_due=clock_timestamp()+interval '5 seconds' where id=m.id;end;
 exit when clock_timestamp()-started>interval '3 seconds';
 end loop;
end $$;

create policy dorra_receive_own_war_notifications on realtime.messages for select to authenticated
using(extension='broadcast' and topic='dorra-war:'||(select auth.uid())::text and (select realtime.topic())='dorra-war:'||(select auth.uid())::text);

-- Only verified Edge gateway calls can enter this facade. Auth session, active
-- House lease, ownership, resources and command constraints are checked again in SQL.
create function public.dorra_war_command(p_user_id uuid,p_auth_session_id uuid,p_lease_id uuid,p_action text,p_match_id uuid default null,p_args jsonb default '{}',p_request_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare player dorra_private.player_state;m dorra_private.war_matches;s dorra_private.war_sides;cached dorra_private.war_requests;digest text;res jsonb:='{}';gt numeric;mid uuid:=p_match_id;nid text;other text;p record;q record;u dorra_private.war_units;target text;units uuid[];uid uuid;cnt integer;amount integer;earned integer;reward_date date;cost jsonb;facility text;hours numeric;level integer;distance numeric;winner text;receipt jsonb;friend text;human_count integer;
begin
 if not exists(select 1 from auth.sessions where id=p_auth_session_id and user_id=p_user_id and (not_after is null or not_after>now())) then raise exception 'AUTH_SESSION_ENDED';end if;
 if not exists(select 1 from dorra_private.profiles where user_id=p_user_id and not disabled and not banned and (suspended_until is null or suspended_until<=now())) then raise exception 'ACCOUNT_DISABLED';end if;
 select * into player from dorra_private.player_state where user_id=p_user_id for update;
 if not found then raise exception 'SAVE_REQUIRED';end if;
 if player.auth_session_id<>p_auth_session_id or player.lease_id<>p_lease_id then raise exception 'SESSION_REPLACED';end if;
 if jsonb_typeof(p_args)<>'object' or octet_length(p_args::text)>16000 then raise exception 'INVALID_ARGUMENTS';end if;
 if p_action not in('list','create','join','start','view','order','research','build','produce','diplomacy','pause','resume','retire','reward') then raise exception 'INVALID_ACTION';end if;
 if p_action not in('list','view') and p_request_id is null then raise exception 'REQUEST_ID_REQUIRED';end if;
 digest:=md5(jsonb_build_object('action',p_action,'match',p_match_id,'args',p_args)::text);
 if p_request_id is not null then select * into cached from dorra_private.war_requests where user_id=p_user_id and request_id=p_request_id;if found then
 if cached.digest<>digest then raise exception 'REQUEST_REUSED';end if;
 return cached.result||jsonb_build_object('view',case when cached.match_id is not null then dorra_private.war_view(cached.match_id,p_user_id) else null end,'replayed',true,'serverNow',extract(epoch from clock_timestamp())*1000);
 end if;end if;
 if player.rate_window>now()-interval '1 minute' and player.rate_count>=180 then raise exception 'RATE_LIMIT';end if;
 update dorra_private.player_state set rate_count=case when rate_window>now()-interval '1 minute' then rate_count+1 else 1 end,rate_window=case when rate_window>now()-interval '1 minute' then rate_window else now() end where user_id=p_user_id;
 if p_action='list' then
 return jsonb_build_object('matches',(select coalesce(jsonb_agg(jsonb_build_object('id',wm.id,'name',wm.name,'status',wm.status,'pace',wm.pace,'template',wm.template,'opponent',wm.opponent,'hostId',wm.host_id,'maxPlayers',case when wm.template='duel' then 2 else 12 end,'players',(select count(*) from dorra_private.war_sides where match_id=wm.id and user_id is not null),
 'availableNations',(select coalesce(jsonb_agg(nation_id order by nation_id),'[]') from dorra_private.war_sides where match_id=wm.id and user_id is null and not retired),
 'occupiedNations',(select coalesce(jsonb_agg(nation_id order by nation_id),'[]') from dorra_private.war_sides where match_id=wm.id and user_id is not null),
 'joined',exists(select 1 from dorra_private.war_sides where match_id=wm.id and user_id=p_user_id)) order by wm.created_at desc),'[]') from (select * from dorra_private.war_matches w where (visibility='public' and status='lobby' or exists(select 1 from dorra_private.war_sides where match_id=w.id and user_id=p_user_id) or (status='lobby' and w.id::text=p_args->>'matchId' and invite_code::text=p_args->>'inviteCode')) order by created_at desc limit 40) wm), 'serverNow',extract(epoch from clock_timestamp())*1000);
 end if;
 if p_action='create' then
 perform pg_advisory_xact_lock(81240616);
 if (select count(*) from dorra_private.war_matches where host_id=p_user_id and status in('lobby','running','paused'))>=2 then raise exception 'HOST_MATCH_LIMIT';end if;
 if p_args->>'opponent'='ai' and exists(select 1 from dorra_private.war_matches where host_id=p_user_id and opponent='ai' and status in('lobby','running','paused')) then raise exception 'SOLO_MATCH_LIMIT';end if;
 if p_args->>'template' not in('duel','world') or p_args->>'pace' not in('fast','persistent') or p_args->>'opponent' not in('ai','human') or p_args->>'visibility' not in('public','invite') then raise exception 'INVALID_MATCH_OPTIONS';end if;
 nid:=p_args->>'nationId';other:=p_args->>'opponentNationId';
 if not exists(select 1 from dorra_private.war_catalog_nations where id=nid) then raise exception 'CATALOG_NOT_READY';end if;
 if (p_args->>'template'='duel' or p_args->>'opponent'='ai') and (other is null or other=nid or not exists(select 1 from dorra_private.war_catalog_nations where id=other)) then raise exception 'INVALID_OPPONENT';end if;
 insert into dorra_private.war_matches(name,host_id,template,opponent,pace,visibility,speed,limit_seconds)
 values(left(coalesce(nullif(trim(p_args->>'name'),''),'Dorra World Command'),60),p_user_id,p_args->>'template',p_args->>'opponent',p_args->>'pace',p_args->>'visibility',case when p_args->>'pace'='fast' then 360 else 4 end,case when p_args->>'pace'='fast' then 2592000 else 5184000 end) returning * into m;mid:=m.id;
 insert into dorra_private.war_sides(match_id,nation_id,user_id,is_ai,active_ai,enemy_nation_id,resources)
 select mid,n.id,case when n.id=nid then p_user_id else null end,n.id<>nid,n.id=other and m.opponent='ai',case when n.id=other and m.opponent='ai' then nid else null end,
 jsonb_build_object('cash',20000+least(100000,coalesce((n.data->>'economy')::numeric,100)*10),'supplies',5000+coalesce((n.data->>'military')::numeric,10)*50,'fuel',3500+coalesce((n.data->>'military')::numeric,10)*30,'electronics',2000+coalesce((n.data->>'military')::numeric,10)*10,'manpower',6000+coalesce((n.data->>'military')::numeric,10)*80)
 from dorra_private.war_catalog_nations n where m.template='world' or n.id in(nid,other);
 insert into dorra_private.war_provinces(match_id,province_id,nation_id,facilities)
 select mid,c.id,c.country_id,case when coalesce((c.data->>'capital')::boolean,false) then '{"army-base":1,"arms-industry":1,"intelligence-center":1,"air-base":1}'::jsonb||case when coalesce((c.data->>'port')::boolean,false) then '{"naval-base":1}'::jsonb else '{}'::jsonb end else '{}'::jsonb end from dorra_private.war_catalog_provinces c join dorra_private.war_sides ws on ws.match_id=mid and ws.nation_id=c.country_id;
 if not exists(select 1 from dorra_private.war_provinces where match_id=mid and nation_id=nid) then raise exception 'NATION_HAS_NO_PROVINCES';end if;
 -- A nation's real arsenal controls starting equipment; larger authored strength
 -- receives more groups, rather than every country receiving an identical force.
 for q in select ws.nation_id,n.data from dorra_private.war_sides ws join dorra_private.war_catalog_nations n on n.id=ws.nation_id where ws.match_id=mid loop
 select province_id into target from dorra_private.war_provinces wp join dorra_private.war_catalog_provinces cp on cp.id=wp.province_id where wp.match_id=mid and wp.nation_id=q.nation_id order by coalesce((cp.data->>'capital')::boolean,false) desc,wp.province_id limit 1;
 if target is null then continue;end if;
 update dorra_private.war_provinces set facilities=facilities||'{"army-base":1,"arms-industry":1,"intelligence-center":1,"air-base":1}' where match_id=mid and province_id=target;
 for p in select cp.* from dorra_private.war_catalog_platforms cp where (cp.data->'operators' ? q.nation_id or cp.data->'operators' ? '*') and coalesce((cp.data->>'level')::integer,1)=1 and cp.data->>'domain'='land' order by cp.id limit 2 loop
 insert into dorra_private.war_units(match_id,nation_id,province_id,platform_id,name,domain,strength) values(mid,q.nation_id,target,p.id,p.name,p.data->>'domain',greatest(1,least(4,ceil(coalesce((q.data->>'military')::numeric,10)/25))));
 update dorra_private.war_sides set research=research||jsonb_build_array(p.id) where match_id=mid and nation_id=q.nation_id;
 end loop;end loop;
 insert into dorra_private.war_observers(match_id,user_id) values(mid,p_user_id);
 res:=jsonb_build_object('result',jsonb_build_object('type','created','matchId',mid));
 else
 select * into m from dorra_private.war_matches where id=mid for update;if not found then raise exception 'MATCH_NOT_FOUND';end if;
 if p_action='join' then
 if m.status<>'lobby' or m.opponent<>'human' then raise exception 'MATCH_NOT_JOINABLE';end if;
 if m.visibility='invite' and coalesce(p_args->>'inviteCode','')<>m.invite_code::text then raise exception 'INVITE_REQUIRED';end if;
 if exists(select 1 from dorra_private.war_sides where match_id=mid and user_id=p_user_id) then raise exception 'ALREADY_JOINED';end if;
 select count(*) into human_count from dorra_private.war_sides where match_id=mid and user_id is not null;
 if human_count>=(case when m.template='duel' then 2 else 12 end) then raise exception 'MATCH_FULL';end if;
 nid:=p_args->>'nationId';
 update dorra_private.war_sides set user_id=p_user_id,is_ai=false where match_id=mid and nation_id=nid and user_id is null and not retired;if not found then raise exception 'NATION_UNAVAILABLE';end if;
 insert into dorra_private.war_observers(match_id,user_id) values(mid,p_user_id);
 res:=jsonb_build_object('result',jsonb_build_object('type','joined'));
 else
 select * into s from dorra_private.war_sides where match_id=mid and user_id=p_user_id;if not found then raise exception 'MATCH_FORBIDDEN';end if;nid:=s.nation_id;
 if p_action in('start','resume') then
 if m.host_id<>p_user_id then raise exception 'HOST_REQUIRED';end if;
 if m.status<>(case when p_action='start' then 'lobby' else 'paused' end) then raise exception 'MATCH_STATUS';end if;
 perform pg_advisory_xact_lock(81240616);
 if (select count(*) from dorra_private.war_matches where status='running')>=4 then raise exception 'WORLD_CAPACITY';end if;
 if m.opponent='human' and (select count(*) from dorra_private.war_sides where match_id=mid and user_id is not null)<2 then raise exception 'OPPONENT_REQUIRED';end if;
 if p_action='start' then
 insert into dorra_private.war_events(match_id,kind,due) values(mid,'combat',3600);
 insert into dorra_private.war_events(match_id,kind,due,payload) select mid,'ai',3600+(row_number() over(order by nation_id))*75,jsonb_build_object('nationId',nation_id) from dorra_private.war_sides where match_id=mid and is_ai and active_ai;
 if m.template='duel' then insert into dorra_private.war_relations(match_id,a,b,relation) select mid,min(nation_id),max(nation_id),'war' from dorra_private.war_sides where match_id=mid;end if;
 end if;
 update dorra_private.war_matches set status='running',real_anchor=clock_timestamp(),last_dispatch=clock_timestamp(),next_due=clock_timestamp(),revision=revision+1 where id=mid;
 res:=jsonb_build_object('result',jsonb_build_object('type',p_action));
 elsif p_action='pause' then
 if m.host_id<>p_user_id or m.opponent<>'ai' or (select count(*) from dorra_private.war_sides where match_id=mid and user_id is not null)>1 then raise exception 'SOLO_PAUSE_ONLY';end if;
 if m.status<>'running' then raise exception 'MATCH_STATUS';end if;
 perform dorra_private.war_advance(mid);select * into m from dorra_private.war_matches where id=mid;
 update dorra_private.war_matches set game_anchor=dorra_private.war_now(m),real_anchor=null,status='paused',next_due=null,revision=revision+1 where id=mid;
 res:=jsonb_build_object('result',jsonb_build_object('type','paused'));
 elsif p_action='reward' then
 if m.status<>'finished' then raise exception 'MATCH_NOT_FINISHED';end if;
 if exists(select 1 from dorra_private.war_rewards where user_id=p_user_id and match_id=mid) then raise exception 'REWARD_ALREADY_CLAIMED';end if;
 if s.retired or m.game_anchor<86400 then raise exception 'REWARD_INELIGIBLE';end if;
 reward_date:=(clock_timestamp() at time zone 'Australia/Brisbane')::date;
 select coalesce(sum(r.amount),0) into earned from dorra_private.war_rewards r where r.user_id=p_user_id and reward_day=reward_date;
 amount:=least(greatest(0,1000-earned),250+case when m.winner=nid then 750 else 0 end);
 amount:=least(amount,greatest(0,9000000000000000-coalesce((player.snapshot->>'balance')::numeric,0)))::integer;
 insert into dorra_private.war_rewards(user_id,match_id,amount,reward_day) values(p_user_id,mid,amount,reward_date);
 update dorra_private.player_state set snapshot=jsonb_set(snapshot,'{balance}',to_jsonb((snapshot->>'balance')::numeric+amount)),revision=revision+1,updated_at=now() where user_id=p_user_id;
 res:=jsonb_build_object('result',jsonb_build_object('type','reward','amount',amount,'dailyRemaining',greatest(0,1000-earned-amount),'walletRefreshRequired',true));
 elsif p_action='retire' then
 update dorra_private.war_sides set retired=true,is_ai=true where match_id=mid and nation_id=nid;
 if m.opponent='ai' or m.template='duel' then update dorra_private.war_matches set status='finished',winner=(select nation_id from dorra_private.war_sides where match_id=mid and nation_id<>nid order by score desc,nation_id limit 1),game_anchor=dorra_private.war_now(m),real_anchor=null,next_due=null,finished_at=now(),revision=revision+1 where id=mid;
 else insert into dorra_private.war_events(match_id,kind,due,payload) values(mid,'ai',dorra_private.war_now(m)+3600,jsonb_build_object('nationId',nid));end if;
 res:=jsonb_build_object('result',jsonb_build_object('type','retired'));
 elsif p_action<>'view' then
 if m.status<>'running' or s.retired then raise exception 'MATCH_NOT_RUNNING';end if;
 perform dorra_private.war_advance(mid);select * into m from dorra_private.war_matches where id=mid;
 if m.status<>'running' then raise exception 'MATCH_NOT_RUNNING';end if;
 gt:=dorra_private.war_now(m);perform dorra_private.war_accrue(mid,nid,gt);
 if (select min(due) from dorra_private.war_events where match_id=mid)<=gt then raise exception 'MATCH_CATCHING_UP';end if;
 if p_action in('research','produce') then
 select * into p from dorra_private.war_catalog_platforms where id=p_args->>'platformId';if not found or not dorra_private.war_platform_allowed(mid,nid,p.data) then raise exception 'PLATFORM_UNAVAILABLE';end if;
 if coalesce((p.data->>'nuclear')::boolean,false) and not exists(select 1 from dorra_private.war_catalog_nations where id=nid and coalesce((data->>'nuclear')::boolean,false)) then raise exception 'NUCLEAR_UNAVAILABLE';end if;
 select * into s from dorra_private.war_sides where match_id=mid and nation_id=nid;
 if p_action='research' then
 if s.research ? p.id then raise exception 'ALREADY_RESEARCHED';end if;
 if exists(select 1 from dorra_private.war_events where match_id=mid and kind='research' and payload->>'nationId'=nid and payload->>'platformId'=p.id) then raise exception 'ALREADY_QUEUED';end if;
 if (select count(*) from dorra_private.war_events where match_id=mid and kind='research' and payload->>'nationId'=nid)>=2 then raise exception 'RESEARCH_SLOTS_FULL';end if;
 if exists(select 1 from jsonb_array_elements_text(coalesce(p.data->'prerequisites','[]')) prereq(id) where not(s.research ? prereq.id)) then raise exception 'RESEARCH_PREREQUISITE';end if;
 if not exists(select 1 from dorra_private.war_provinces where match_id=mid and nation_id=nid and coalesce((facilities->>'intelligence-center')::integer,0)>=1) then raise exception 'RESEARCH_LAB_REQUIRED';end if;
 if not exists(select 1 from dorra_private.war_provinces where match_id=mid and nation_id=nid and coalesce((facilities->>coalesce(p.data->>'facility','army-base'))::integer,0)>=greatest(1,coalesce((p.data->>'level')::integer,1))) then raise exception 'FACILITY_REQUIRED';end if;
 cost:=jsonb_build_object('cash',greatest(200,coalesce((p.data#>>'{cost,cash}')::numeric,1000)*.25),'electronics',greatest(100,coalesce((p.data#>>'{cost,electronics}')::numeric,200)*.5));
 hours:=greatest(1,coalesce((p.data->>'researchHours')::numeric,12));
 perform dorra_private.war_pay(mid,nid,cost);
 insert into dorra_private.war_events(match_id,kind,due,payload) values(mid,'research',gt+hours*3600,jsonb_build_object('nationId',nid,'platformId',p.id));
 else
 if coalesce((p.data->>'buildable')::boolean,true)=false then raise exception 'RESEARCH_ONLY';end if;
 if not(s.research ? p.id) then raise exception 'RESEARCH_REQUIRED';end if;
 target:=p_args->>'provinceId';facility:=coalesce(p.data->>'facility','army-base');
 select * into q from dorra_private.war_provinces where match_id=mid and province_id=target and nation_id=nid for update;
 if not found then raise exception 'PROVINCE_NOT_OWNED';end if;
 if coalesce((q.facilities->>facility)::integer,0)<greatest(1,coalesce((p.data->>'level')::integer,1)) then raise exception 'FACILITY_REQUIRED';end if;
 if q.radiation_until>gt then raise exception 'PROVINCE_CONTAMINATED';end if;
 if exists(select 1 from dorra_private.war_events where match_id=mid and kind='produce' and payload->>'provinceId'=target) then raise exception 'PRODUCTION_SLOT_FULL';end if;
 if (select count(*) from dorra_private.war_units where match_id=mid and nation_id=nid)+(select count(*) from dorra_private.war_events where match_id=mid and kind='produce' and payload->>'nationId'=nid)>=80 then raise exception 'FORMATION_CAP';end if;
 if p.data->>'domain'='sea' and not exists(select 1 from dorra_private.war_catalog_provinces where id=target and coalesce((data->>'port')::boolean,false)) then raise exception 'PORT_REQUIRED';end if;
 perform dorra_private.war_pay(mid,nid,p.data->'cost');
 insert into dorra_private.war_events(match_id,kind,due,payload) values(mid,'produce',gt+greatest(1,coalesce((p.data->>'buildHours')::numeric,12))*3600,jsonb_build_object('nationId',nid,'provinceId',target,'platformId',p.id));
 end if;
 elsif p_action='build' then
 target:=p_args->>'provinceId';facility:=p_args->>'facility';
 if facility not in('army-base','air-base','naval-base','arms-industry','intelligence-center','missile-site','radar','fortification') then raise exception 'INVALID_FACILITY';end if;
 select * into q from dorra_private.war_provinces where match_id=mid and province_id=target and nation_id=nid for update;if not found then raise exception 'PROVINCE_NOT_OWNED';end if;
 level:=coalesce((q.facilities->>facility)::integer,0);if level>=5 then raise exception 'FACILITY_MAX_LEVEL';end if;
 if q.radiation_until>gt then raise exception 'PROVINCE_CONTAMINATED';end if;
 if facility='naval-base' and not exists(select 1 from dorra_private.war_catalog_provinces where id=target and coalesce((data->>'port')::boolean,false)) then raise exception 'PORT_REQUIRED';end if;
 if exists(select 1 from dorra_private.war_events where match_id=mid and kind='build' and payload->>'provinceId'=target) then raise exception 'BUILD_SLOT_FULL';end if;
 perform dorra_private.war_pay(mid,nid,jsonb_build_object('cash',1500*(level+1),'supplies',500*(level+1),'electronics',200*(level+1),'manpower',100));
 insert into dorra_private.war_events(match_id,kind,due,payload) values(mid,'build',gt+(6+level*6)*3600,jsonb_build_object('nationId',nid,'provinceId',target,'facility',facility));
 elsif p_action='diplomacy' then
 other:=p_args->>'nationId';friend:=p_args->>'type';
 if other=nid or not exists(select 1 from dorra_private.war_sides where match_id=mid and nation_id=other) then raise exception 'INVALID_NATION';end if;
 if friend='license' then friend:='import-license';end if;
 if friend not in('war','peace','alliance','ceasefire','accept','reject','transfer','import-license') then raise exception 'INVALID_DIPLOMACY';end if;
 if friend='transfer' then
 if dorra_private.war_relation(mid,nid,other)<>'alliance' then raise exception 'ALLIANCE_REQUIRED';end if;
 cost:=p_args->'resources';if jsonb_typeof(cost)<>'object' then raise exception 'INVALID_RESOURCES';end if;
 perform dorra_private.war_pay(mid,nid,cost);perform dorra_private.war_accrue(mid,other,gt);
 for q in select key,(value#>>'{}')::numeric value from jsonb_each(cost) loop update dorra_private.war_sides set resources=jsonb_set(resources,array[q.key],to_jsonb(least(100000000,(resources->>q.key)::numeric+q.value))) where match_id=mid and nation_id=other;end loop;
 else
 insert into dorra_private.war_relations(match_id,a,b) values(mid,least(nid,other),greatest(nid,other)) on conflict do nothing;
 select * into q from dorra_private.war_relations where match_id=mid and a=least(nid,other) and b=greatest(nid,other) for update;
 if friend='war' then update dorra_private.war_relations set relation='war',proposal=null,proposed_by=null where match_id=mid and a=q.a and b=q.b;
 elsif friend in('accept','reject') then
 if q.proposed_by is null or q.proposed_by=nid then raise exception 'NO_DIPLOMATIC_OFFER';end if;
 if friend='accept' and q.proposal='import-license' then
 update dorra_private.war_sides set import_licenses=case when import_licenses ? nid then import_licenses else import_licenses||jsonb_build_array(nid) end where match_id=mid and nation_id=other;
 end if;
 update dorra_private.war_relations set relation=case when friend='accept' and q.proposal<>'import-license' then q.proposal else relation end,proposal=null,proposed_by=null where match_id=mid and a=q.a and b=q.b;
 else update dorra_private.war_relations set proposal=friend,proposed_by=nid where match_id=mid and a=q.a and b=q.b;
 -- AI accepts ceasefire/peace, but alliances need a peaceful relationship.
 if exists(select 1 from dorra_private.war_sides where match_id=mid and nation_id=other and is_ai) and (friend not in('alliance','import-license') or q.relation<>'war') then
 if friend='import-license' then update dorra_private.war_sides set import_licenses=case when import_licenses ? other then import_licenses else import_licenses||jsonb_build_array(other) end where match_id=mid and nation_id=nid;
 else update dorra_private.war_relations set relation=friend where match_id=mid and a=q.a and b=q.b;end if;
 update dorra_private.war_relations set proposal=null,proposed_by=null where match_id=mid and a=q.a and b=q.b;
 end if;
 end if;end if;
 perform dorra_private.war_report(mid,other,gt,jsonb_build_object('type','diplomacy','nationId',nid,'action',friend));
 elsif p_action='order' then
 friend:=p_args->>'type';
 if friend not in('move','attack','patrol','bombard','retreat','intercept','embark','split','merge') then raise exception 'INVALID_ORDER';end if;
 if jsonb_typeof(p_args->'unitIds')<>'array' or jsonb_array_length(p_args->'unitIds') not between 1 and 20 then raise exception 'INVALID_UNIT_SELECTION';end if;
 select array_agg(distinct value::uuid) into units from jsonb_array_elements_text(p_args->'unitIds');
 if (select count(*) from dorra_private.war_units where match_id=mid and nation_id=nid and id=any(units))<>cardinality(units) then raise exception 'UNIT_NOT_OWNED';end if;
 if friend='split' then
 if cardinality(units)<>1 then raise exception 'SELECT_ONE_FORMATION';end if;
 select * into u from dorra_private.war_units where id=units[1] for update;
 if u.strength<2 or u.orders<>'{}' then raise exception 'CANNOT_SPLIT';end if;
 update dorra_private.war_units set strength=ceil(strength/2) where id=u.id;
 insert into dorra_private.war_units(match_id,nation_id,province_id,platform_id,name,domain,strength,health,max_health) values(mid,nid,u.province_id,u.platform_id,u.name||' II',u.domain,floor(u.strength/2),u.health,u.max_health);
 elsif friend='merge' then
 if cardinality(units)<2 then raise exception 'SELECT_MULTIPLE_FORMATIONS';end if;
 select * into u from dorra_private.war_units where id=units[1] for update;
 if exists(select 1 from dorra_private.war_units where id=any(units) and (province_id<>u.province_id or platform_id<>u.platform_id or orders<>'{}')) then raise exception 'INCOMPATIBLE_FORMATIONS';end if;
 select sum(strength),sum(health*strength)/sum(strength) into distance,hours from dorra_private.war_units where id=any(units);
 if distance>20 then raise exception 'STACK_CAP';end if;
 update dorra_private.war_units set strength=distance,health=hours where id=u.id;delete from dorra_private.war_units where id=any(units) and id<>u.id;
 else
 target:=p_args->>'targetProvinceId';
 if p_args->>'targetUnitId' is not null then select * into u from dorra_private.war_units where id=(p_args->>'targetUnitId')::uuid and match_id=mid;if not found or not dorra_private.war_vision(mid,nid,u) then raise exception 'TARGET_NOT_VISIBLE';end if;target:=u.province_id;end if;
 if target is null then raise exception 'DESTINATION_REQUIRED';end if;
 foreach uid in array units loop
 select * into u from dorra_private.war_units where id=uid for update;select data into cost from dorra_private.war_catalog_platforms where id=u.platform_id;
 if u.domain='missile' then
 select nation_id into other from dorra_private.war_provinces where match_id=mid and province_id=target;
 if friend not in('attack','bombard') or dorra_private.war_relation(mid,nid,other)<>'war' then raise exception 'DECLARE_WAR_FIRST';end if;
 distance:=dorra_private.war_distance(u.province_id,target);if distance is null or distance>coalesce((cost#>>'{stats,range}')::numeric,500) then raise exception 'OUT_OF_RANGE';end if;
 if u.orders<>'{}' then raise exception 'UNIT_BUSY';end if;
 update dorra_private.war_units set orders=jsonb_build_object('type','strike','targetProvinceId',target),generation=generation+1 where id=uid returning * into u;
 insert into dorra_private.war_events(match_id,kind,due,payload) values(mid,'strike',gt+greatest(60,distance/greatest(1,coalesce((cost#>>'{stats,speed}')::numeric,1500))*3600),jsonb_build_object('unitId',uid,'targetProvinceId',target,'generation',u.generation));
 elsif friend='bombard' then
 select nation_id into other from dorra_private.war_provinces where match_id=mid and province_id=target;
 if dorra_private.war_relation(mid,nid,other)<>'war' then raise exception 'DECLARE_WAR_FIRST';end if;
 if u.orders<>'{}' then raise exception 'UNIT_BUSY';end if;
 if dorra_private.war_distance(u.province_id,target)>coalesce((cost#>>'{stats,range}')::numeric,0) then raise exception 'OUT_OF_RANGE';end if;
 update dorra_private.war_units set orders=jsonb_build_object('type','bombard','targetProvinceId',target) where id=uid;
 else perform dorra_private.war_schedule_move(mid,uid,target,friend,gt,coalesce(p_args->'waypoints','[]'));end if;
 end loop;end if;
 end if;
 update dorra_private.war_sides set last_command_at=now() where match_id=mid and nation_id=nid;
 update dorra_private.war_matches set revision=revision+1 where id=mid;
 res:=jsonb_build_object('result',jsonb_build_object('type',p_action,'accepted',true));
 end if;
 end if;
 end if;
 perform dorra_private.war_notify(mid);
 res:=res||jsonb_build_object('view',dorra_private.war_view(mid,p_user_id),'serverNow',extract(epoch from clock_timestamp())*1000);
 if p_request_id is not null then insert into dorra_private.war_requests(user_id,request_id,digest,match_id,result) values(p_user_id,p_request_id,digest,mid,jsonb_build_object('result',res->'result','matchId',mid));end if;
 return res;
end $$;

-- No exposed table mutation, no public execution, no anonymous subscriptions.
do $$ declare t text;begin
 foreach t in array array['war_catalog_nations','war_catalog_provinces','war_catalog_platforms','war_matches','war_sides','war_provinces','war_units','war_events','war_relations','war_reports','war_requests','war_rewards','war_observers'] loop
 execute format('alter table dorra_private.%I enable row level security',t);
 execute format('revoke all on dorra_private.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update,delete on dorra_private.%I to service_role',t);
 end loop;
end $$;
revoke all on function public.dorra_war_command(uuid,uuid,uuid,text,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.dorra_war_command(uuid,uuid,uuid,text,uuid,jsonb,uuid) to service_role;
grant usage,select on all sequences in schema dorra_private to service_role;
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dorra_private' and p.proname like 'war_%' loop
 execute 'revoke all on function '||f.signature||' from public,anon,authenticated';
 execute 'grant execute on function '||f.signature||' to service_role';
 end loop;
end $$;
create extension if not exists pg_cron;
select cron.schedule('dorra-war-dispatch','5 seconds',$$select dorra_private.war_dispatch();$$);
