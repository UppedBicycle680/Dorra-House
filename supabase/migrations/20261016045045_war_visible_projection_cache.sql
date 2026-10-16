-- Cache only each member's already-filtered projection. Client versions never
-- expose the global world revision, which can reveal hidden enemy activity.
create table dorra_private.war_projection_cache (
 user_id uuid not null references auth.users(id) on delete cascade,
 match_id uuid not null references dorra_private.war_matches(id) on delete cascade,
 revision bigint not null default 0,source_revision bigint not null default 0,
 view jsonb not null default '{}',updated_at timestamptz not null default now(),
 primary key(user_id,match_id)
);
alter table dorra_private.war_projection_cache enable row level security;
revoke all on dorra_private.war_projection_cache from public,anon,authenticated;
grant select,insert,update,delete on dorra_private.war_projection_cache to service_role;

create function dorra_private.war_entity_delta(previous jsonb,current_view jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object(
  'upsert',coalesce(jsonb_agg(n.value order by n.value->>'id') filter(where n.value is not null and n.value is distinct from o.value),'[]'::jsonb),
  'remove',coalesce(jsonb_agg(o.value->>'id') filter(where n.value is null),'[]'::jsonb))
 from jsonb_array_elements(coalesce(current_view,'[]')) n
 full join jsonb_array_elements(coalesce(previous,'[]')) o on n.value->>'id'=o.value->>'id'
$$;
revoke all on function dorra_private.war_entity_delta(jsonb,jsonb) from public,anon,authenticated;
grant execute on function dorra_private.war_entity_delta(jsonb,jsonb) to service_role;

-- The service role supplies p_view from dorra_war_command, never from the browser.
-- Member authorization is checked again before either a snapshot or delta returns.
create function public.dorra_war_projection(p_user_id uuid,p_match_id uuid,p_base_revision bigint,p_view jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cache dorra_private.war_projection_cache;fresh jsonb;ver bigint;source_ver bigint;fields jsonb;pd jsonb;ud jsonb;
begin
 if not exists(select 1 from dorra_private.war_sides where match_id=p_match_id and user_id=p_user_id) then raise exception 'MATCH_FORBIDDEN';end if;
 if p_view#>>'{player,userId}' is distinct from p_user_id::text or p_view#>>'{match,id}' is distinct from p_match_id::text or jsonb_typeof(p_view) is distinct from 'object' then raise exception 'INVALID_PROJECTION';end if;
 insert into dorra_private.war_projection_cache(user_id,match_id) values(p_user_id,p_match_id) on conflict do nothing;
 select * into cache from dorra_private.war_projection_cache where user_id=p_user_id and match_id=p_match_id for update;
 source_ver:=(p_view#>>'{match,revision}')::bigint;
 fresh:=p_view#-'{match,revision}';
 if source_ver<cache.source_revision or (source_ver=cache.source_revision and coalesce((fresh#>>'{match,gameTime}')::numeric,0)<coalesce((cache.view#>>'{match,gameTime}')::numeric,0)) then
  return jsonb_build_object('view',cache.view);
 end if;
 if fresh=(cache.view#-'{match,revision}') then ver:=cache.revision;else ver:=cache.revision+1;end if;
 fresh:=jsonb_set(fresh,'{match,revision}',to_jsonb(ver));
 update dorra_private.war_projection_cache set view=fresh,revision=ver,source_revision=source_ver,updated_at=now() where user_id=p_user_id and match_id=p_match_id;
 if p_base_revision is null or p_base_revision<>cache.revision or cache.revision=0 then return jsonb_build_object('view',fresh);end if;
 select coalesce(jsonb_object_agg(key,value),'{}') into fields from jsonb_each(fresh) where key not in('provinces','units') and value is distinct from cache.view->key;
 pd:=dorra_private.war_entity_delta(cache.view->'provinces',fresh->'provinces');
 ud:=dorra_private.war_entity_delta(cache.view->'units',fresh->'units');
 return jsonb_build_object('delta',jsonb_build_object('matchId',p_match_id,'baseRevision',cache.revision,'revision',ver,'fields',fields,'provinces',pd,'units',ud));
end $$;
revoke all on function public.dorra_war_projection(uuid,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.dorra_war_projection(uuid,uuid,bigint,jsonb) to service_role;
