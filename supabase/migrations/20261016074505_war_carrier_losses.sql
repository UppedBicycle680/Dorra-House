-- Deck aircraft are lost with a destroyed carrier. Airborne sorties are not
-- attached; their existing return helper diverts to a reachable friendly base.
alter table dorra_private.war_units drop constraint war_units_base_carrier_id_fkey;
alter table dorra_private.war_units add constraint war_units_base_carrier_id_fkey foreign key(base_carrier_id) references dorra_private.war_units(id) on delete cascade;
create function dorra_private.war_carrier_loss() returns trigger
language plpgsql set search_path='' as $$
declare m dorra_private.war_matches;loss record;
begin
 if old.domain<>'sea' then return old;end if;
 select * into m from dorra_private.war_matches where id=old.match_id;
 if not found or m.status<>'running' then return old;end if;
 for loss in
 select nation_id,count(*) aircraft_count from dorra_private.war_units where match_id=old.match_id and base_carrier_id=old.id group by nation_id
 loop
 perform dorra_private.war_report(old.match_id,loss.nation_id,dorra_private.war_now(m),jsonb_build_object('type','carrier-aircraft-lost','carrierName',old.name,'provinceId',old.province_id,'aircraftCount',loss.aircraft_count));
 end loop;
 return old;
end $$;
revoke all on function dorra_private.war_carrier_loss() from public,anon,authenticated;
grant execute on function dorra_private.war_carrier_loss() to service_role;
create trigger war_carrier_losses before delete on dorra_private.war_units for each row execute function dorra_private.war_carrier_loss();
