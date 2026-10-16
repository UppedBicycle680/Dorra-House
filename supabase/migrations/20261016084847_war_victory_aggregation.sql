-- Aggregate each world's territory and surviving forces once. A low initial
-- row estimate must not turn an hourly score update into repeated world scans.
create or replace function dorra_private.war_finish(mid uuid,gt numeric,forced boolean default false) returns void
language plpgsql set search_path='' as $$
declare m dorra_private.war_matches;total numeric;best text;best_score numeric;alive integer;capital_holder text;duel_won boolean:=false;
begin
 select * into m from dorra_private.war_matches where id=mid;
 if not found or m.status<>'running' then return;end if;
 with province_scores as materialized(
  select p.nation_id,sum(case when coalesce((c.data->>'capital')::boolean,false) then 10 when coalesce((c.data->>'city')::boolean,false) then 3 else 1 end) score
  from dorra_private.war_provinces p join dorra_private.war_catalog_provinces c on c.id=p.province_id
  where p.match_id=mid group by p.nation_id
 ),scores as materialized(
  select s.nation_id,coalesce(p.score,0) score from dorra_private.war_sides s left join province_scores p on p.nation_id=s.nation_id where s.match_id=mid
 )
 update dorra_private.war_sides s set score=q.score from scores q
 where s.match_id=mid and s.nation_id=q.nation_id and s.score is distinct from q.score;
 with forces as materialized(
  select distinct nation_id from dorra_private.war_units where match_id=mid and health>0
 )
 select sum(s.score),count(*) filter(where not s.retired and (s.score>0 or f.nation_id is not null)) into total,alive
 from dorra_private.war_sides s left join forces f on f.nation_id=s.nation_id where s.match_id=mid;
 select nation_id,score into best,best_score from dorra_private.war_sides where match_id=mid and not retired order by score desc,nation_id limit 1;
 if m.template='duel' then
  select cp.nation_id into capital_holder from dorra_private.war_sides opponent
  join dorra_private.war_catalog_nations n on n.id=opponent.nation_id
  join dorra_private.war_provinces cp on cp.match_id=mid and cp.province_id=n.data->>'capitalProvinceId'
  where opponent.match_id=mid group by cp.nation_id having count(*)=2;
  if capital_holder is null then update dorra_private.war_matches set capital_hold_nation=null,capital_hold_started=null where id=mid;
  elsif capital_holder is distinct from m.capital_hold_nation then update dorra_private.war_matches set capital_hold_nation=capital_holder,capital_hold_started=gt where id=mid;
  elsif gt-m.capital_hold_started>=21600 then duel_won:=true;best:=capital_holder;end if;
 end if;
 if forced or alive<=1 or duel_won or (gt>=86400 and m.template='world' and best_score>=greatest(1,total)*.60) or gt>=m.limit_seconds then
  update dorra_private.war_matches set status='finished',winner=best,finished_at=now(),game_anchor=gt,real_anchor=null,next_due=null,notify_dirty=true,revision=revision+1 where id=mid;
  perform dorra_private.war_report(mid,null,gt,jsonb_build_object('type','match-finished','winner',best));
 end if;
end $$;
