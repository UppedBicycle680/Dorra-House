-- Rollback-only fixtures. Run with a trusted SQL connection; no live users,
-- roles, sessions, grants, reports, audit records or saves remain afterwards.
begin;
do $$ declare
  admin_id uuid:=gen_random_uuid(); mod_id uuid:=gen_random_uuid(); player_id uuid:=gen_random_uuid();
  admin_session uuid:=gen_random_uuid(); mod_session uuid:=gen_random_uuid(); player_session uuid:=gen_random_uuid();
  lease uuid:=gen_random_uuid(); snapshot jsonb:='{"balance":1000,"stats":{"sessions":10,"wins":4},"progress":{"level":2,"xp":10,"owned":[],"equipped":{},"profile":{"name":"Database Fixture"}}}'::jsonb;
  context jsonb; preview jsonb; output jsonb; req uuid:=gen_random_uuid(); rev bigint; count_before bigint;
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (admin_id,admin_id||'@dorra-qa.invalid',jsonb_build_object('username','qa_'||substr(admin_id::text,1,8))),
    (mod_id,mod_id||'@dorra-qa.invalid',jsonb_build_object('username','qa_'||substr(mod_id::text,1,8))),
    (player_id,player_id||'@dorra-qa.invalid',jsonb_build_object('username','qa_'||substr(player_id::text,1,8),'role','admin','owner',true));
  insert into auth.sessions(id,user_id) values(admin_session,admin_id),(mod_session,mod_id),(player_session,player_id);
  update dorra_private.profiles set role='admin' where user_id=admin_id;
  update dorra_private.profiles set role='moderator' where user_id=mod_id;
  if (select role<>'player' or owner from dorra_private.profiles where user_id=player_id) then raise exception 'FAIL_METADATA_ROLE'; end if;
  begin perform public.dorra_admin_status(player_id,player_session);raise exception 'FAIL_PLAYER_ACCESS';exception when others then if sqlerrm not like '%STAFF_REQUIRED%' then raise; end if;end;
  begin perform public.dorra_admin_grant(player_id,player_session,dorra_private.code_version());raise exception 'FAIL_PLAYER_CODE';exception when others then if sqlerrm not like '%STAFF_REQUIRED%' then raise; end if;end;
  begin perform public.dorra_admin_read(admin_id,admin_session,'dashboard','{}');raise exception 'FAIL_LOCKED';exception when others then if sqlerrm not like '%ACCESS_EXPIRED%' then raise; end if;end;
  perform public.dorra_admin_grant(admin_id,admin_session,dorra_private.code_version());
  perform public.dorra_admin_grant(mod_id,mod_session,dorra_private.code_version());
  output:=public.dorra_acquire_session(player_id,player_session,lease,snapshot);rev:=(output->>'revision')::bigint;
  output:=public.dorra_admin_read(admin_id,admin_session,'player',jsonb_build_object('targetId',player_id));
  if output::text like '%privateState%' or output::text like '%random%' then raise exception 'FAIL_PRIVATE_LEAK';end if;
  begin perform public.dorra_admin_preview(mod_id,mod_session,player_id,rev,1,'{"action":"money","reason":"Test"}','[]','digest',snapshot,'{}');raise exception 'FAIL_MOD_PREVIEW';exception when others then if sqlerrm not like '%PERMISSION_DENIED%' then raise; end if;end;
  update dorra_private.player_state s set snapshot=jsonb_set(s.snapshot,'{progress,footballManager}','{"club":null}'),private_state='{"airport":null}' where user_id=player_id;
  output:=public.dorra_admin_read(admin_id,admin_session,'player',jsonb_build_object('targetId',player_id));
  if (output->'player'->'resources'->>'footballClub')::boolean or (output->'player'->'resources'->>'airportCareer')::boolean then raise exception 'FAIL_NULL_CAREER_AVAILABLE'; end if;
  select count(*) into count_before from dorra_private.gameplay_days where user_id=player_id;
  preview:=public.dorra_admin_preview(admin_id,admin_session,player_id,rev,1,'{"action":"money","reason":"Fixture adjustment"}','[{"label":"Play money","before":1000,"after":1050}]','digest',jsonb_set(snapshot,'{balance}','1050'),'{}');
  begin perform public.dorra_admin_commit(mod_id,mod_session,(preview->>'id')::uuid,gen_random_uuid());raise exception 'FAIL_ANOTHER_ACTOR_PREVIEW';exception when others then if sqlerrm not like '%PREVIEW_EXPIRED%' then raise;end if;end;
  output:=public.dorra_admin_commit(admin_id,admin_session,(preview->>'id')::uuid,req);
  if (select (s.snapshot->>'balance')::int from dorra_private.player_state s where user_id=player_id)<>1050 then raise exception 'FAIL_RESOURCE_COMMIT';end if;
  if (select count(*) from dorra_private.gameplay_days where user_id=player_id)<>count_before then raise exception 'FAIL_ADMIN_COUNTED_AS_GAME';end if;
  output:=public.dorra_admin_commit(admin_id,admin_session,(preview->>'id')::uuid,req);
  if not(output->>'replayed')::boolean or (select count(*) from dorra_private.admin_audit where actor=admin_id)<>1 then raise exception 'FAIL_REPLAY';end if;
  -- A committed gameplay command racing an admin preview forces a new preview.
  select revision into rev from dorra_private.player_state where user_id=player_id;
  preview:=public.dorra_admin_preview(admin_id,admin_session,player_id,rev,2,'{"action":"warn","reason":"Fixture warning"}','[]','warn-digest',null,null);
  perform set_config('dorra.admin_change','false',true);
  select s.snapshot into snapshot from dorra_private.player_state s where user_id=player_id;
  perform public.dorra_commit_action(player_id,player_session,lease,rev,gen_random_uuid(),'accepted-no-op',snapshot,'{}','{}');
  if (select count(*) from dorra_private.gameplay_days where user_id=player_id)<>count_before+1 then raise exception 'FAIL_NO_OP_COMMAND_NOT_COUNTED'; end if;
  begin perform public.dorra_admin_commit(admin_id,admin_session,(preview->>'id')::uuid,gen_random_uuid());raise exception 'FAIL_STALE';exception when others then if sqlerrm not like '%STALE_REVISION%' then raise;end if;end;
  select revision into rev from dorra_private.player_state where user_id=player_id;
  preview:=public.dorra_admin_preview(mod_id,mod_session,player_id,rev,2,'{"action":"suspend","duration":24,"reason":"Fixture suspension"}','[]','suspend-digest',null,null);
  perform public.dorra_admin_commit(mod_id,mod_session,(preview->>'id')::uuid,gen_random_uuid());
  begin perform public.dorra_read_state(player_id,player_session,lease);raise exception 'FAIL_SUSPEND_READ';exception when others then if sqlerrm not like '%ACCOUNT_DISABLED%' then raise;end if;end;
  begin perform public.dorra_acquire_session(player_id,player_session,lease,snapshot);raise exception 'FAIL_SUSPEND_ACQUIRE';exception when others then if sqlerrm not like '%ACCOUNT_DISABLED%' then raise;end if;end;
  begin perform public.dorra_commit_action(player_id,player_session,lease,rev,gen_random_uuid(),'game-digest',snapshot,'{}','{}');raise exception 'FAIL_SUSPEND_COMMIT';exception when others then if sqlerrm not like '%ACCOUNT_DISABLED%' then raise;end if;end;
  update dorra_private.profiles set suspended_until=now()-interval '1 second' where user_id=player_id;
  perform public.dorra_read_state(player_id,player_session,lease);
  update dorra_private.admin_grants set expires_at=now()-interval '1 second' where user_id=mod_id;
  begin perform public.dorra_admin_read(mod_id,mod_session,'dashboard','{}');raise exception 'FAIL_EXPIRED';exception when others then if sqlerrm not like '%ACCESS_EXPIRED%' then raise;end if;end;
  delete from auth.sessions where id=admin_session;
  begin perform public.dorra_admin_status(admin_id,admin_session);raise exception 'FAIL_REVOKED';exception when others then if sqlerrm not like '%AUTH_SESSION_ENDED%' then raise;end if;end;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'dorra_admin_%' and
    (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'))) then raise exception 'FAIL_BROWSER_RPC';end if;
  if has_table_privilege('service_role','dorra_private.admin_audit','update') or has_table_privilege('service_role','dorra_private.admin_audit','delete') then raise exception 'FAIL_AUDIT_MUTATION';end if;
end $$;
select 'passed: roles, sessions, code eligibility, private projection, atomic resources, replay, stale saves, suspension gates, expiry, revocation, browser grants and append-only audit' as admin_database_validation;
rollback;
