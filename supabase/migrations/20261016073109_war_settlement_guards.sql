-- Finished results are immutable. Every accepted membership/settlement mutation
-- advances its authoritative source revision even when the game clock is frozen.
do $patch$
declare definition text;needle text;replacement text;
begin
 definition:=pg_get_functiondef('public.dorra_war_command(uuid,uuid,uuid,text,uuid,jsonb,uuid)'::regprocedure);
 needle:=$old$ elsif p_action='retire' then
 update dorra_private.war_sides$old$;
 replacement:=$new$ elsif p_action='retire' then
 if m.status='finished' then raise exception 'MATCH_STATUS';end if;
 update dorra_private.war_sides$new$;
 if strpos(definition,needle)=0 then raise exception 'war immutable settlement patch did not match';end if;
 definition:=replace(definition,needle,replacement);
 needle:=$old$ if p_action in('join','start','pause','resume','retire') then perform dorra_private.war_roster_notify(mid);end if;$old$;
 replacement:=$new$ if p_action in('join','reward','retire') then update dorra_private.war_matches set revision=revision+1 where id=mid;end if;
 if p_action in('join','start','pause','resume','retire') then perform dorra_private.war_roster_notify(mid);end if;$new$;
 if strpos(definition,needle)=0 then raise exception 'war settlement revision patch did not match';end if;
 execute replace(definition,needle,replacement);
end $patch$;
