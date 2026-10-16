-- Repeated percentage-based combat otherwise grows unrestricted NUMERIC scale
-- on every pulse. Persist one shared precision for all producers, including
-- combat, missiles, field repair, splitting and weighted merges.
alter table dorra_private.war_units
 alter column health type numeric(20,6) using round(health,6);

-- Report the same quantized result that is persisted: values below half a
-- micro-HP become zero, so their combat report and subsequent deletion agree.
-- No attack, defence, healing, income, queue or cost formula changes.
do $combat_health_type$
declare definition text;needle text;
begin
 definition:=pg_get_functiondef('dorra_private.war_combat(uuid,numeric)'::regprocedure);
 needle:='new_health numeric;';
 if strpos(definition,needle)=0 then raise exception 'Combat persisted-health precision patch did not match';end if;
 execute replace(definition,needle,'new_health numeric(20,6);');
end $combat_health_type$;
