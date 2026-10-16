-- Dependencies may retain their regional capital flag after ownership is
-- assigned to a sovereign nation. The authored national capital takes priority
-- for scenario forces and AI planning; regional capitals remain ordinary cities.
do $patch$
declare definition text;needle text;replacement text;
begin
 definition:=pg_get_functiondef('public.dorra_war_command(uuid,uuid,uuid,text,uuid,jsonb,uuid)'::regprocedure);
 needle:=$old$order by coalesce((cp.data->>'capital')::boolean,false) desc,wp.province_id limit 1;$old$;
 replacement:=$new$order by coalesce(wp.province_id=(q.data->>'capitalProvinceId'),false) desc,coalesce((cp.data->>'capital')::boolean,false) desc,wp.province_id limit 1;$new$;
 if strpos(definition,needle)=0 then raise exception 'war national scenario capital patch did not match';end if;
 execute replace(definition,needle,replacement);
 definition:=pg_get_functiondef('dorra_private.war_ai(uuid,text,numeric)'::regprocedure);
 needle:=$old$order by coalesce((c.data->>'capital')::boolean,false) desc,p.province_id limit 1;$old$;
 replacement:=$new$order by coalesce(p.province_id=(select data->>'capitalProvinceId' from dorra_private.war_catalog_nations where id=nid),false) desc,coalesce((c.data->>'capital')::boolean,false) desc,p.province_id limit 1;$new$;
 if strpos(definition,needle)=0 then raise exception 'war AI home capital patch did not match';end if;
 definition:=replace(definition,needle,replacement);
 needle:=$old$order by coalesce((c.data->>'capital')::boolean,false) desc,dorra_private.war_distance(u.province_id,p.province_id) limit 1;$old$;
 replacement:=$new$order by coalesce(p.province_id=(select data->>'capitalProvinceId' from dorra_private.war_catalog_nations where id=enemy),false) desc,coalesce((c.data->>'capital')::boolean,false) desc,dorra_private.war_distance(u.province_id,p.province_id) limit 1;$new$;
 if strpos(definition,needle)=0 then raise exception 'war AI target capital patch did not match';end if;
 execute replace(definition,needle,replacement);
end $patch$;
