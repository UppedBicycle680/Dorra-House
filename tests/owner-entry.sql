-- Isolated subtransaction: every temporary identity, session and grant is removed.
do $$ declare owner_id uuid; owner_session uuid:=gen_random_uuid();
 staff_id uuid:=gen_random_uuid(); staff_session uuid:=gen_random_uuid();
 ordinary_id uuid:=gen_random_uuid(); ordinary_session uuid:=gen_random_uuid();
 result jsonb;
begin
 begin
  select user_id into owner_id from dorra_private.profiles where owner;
  if owner_id is null then raise exception 'Owner required for this fixture';end if;
  insert into auth.users(id,email,raw_user_meta_data) values
   (staff_id,staff_id||'@dorra-qa.invalid',jsonb_build_object('username','qa_'||substr(staff_id::text,1,8))),
   (ordinary_id,ordinary_id||'@dorra-qa.invalid',jsonb_build_object('username','qa_'||substr(ordinary_id::text,1,8),'owner',true,'role','admin'));
  update dorra_private.profiles set role='admin' where user_id=staff_id;
  insert into auth.sessions(id,user_id) values(owner_session,owner_id),(staff_session,staff_id),(ordinary_session,ordinary_id);
  if (public.dorra_admin_status(owner_id,owner_session)->>'unlocked')::boolean then raise exception 'Unexpected initial grant';end if;
  result:=public.dorra_owner_open(owner_id,owner_session);
  if not (result->>'unlocked')::boolean or not (result->>'unlimited')::boolean or result->>'expiresAt' is not null then raise exception 'Owner entry failed';end if;
  begin perform public.dorra_owner_open(staff_id,staff_session);raise exception 'Admin bypass';exception when others then if sqlerrm<>'PERMISSION_DENIED' then raise;end if;end;
  update dorra_private.profiles set role='moderator' where user_id=staff_id;
  begin perform public.dorra_owner_open(staff_id,staff_session);raise exception 'Moderator bypass';exception when others then if sqlerrm<>'PERMISSION_DENIED' then raise;end if;end;
  begin perform public.dorra_owner_open(ordinary_id,ordinary_session);raise exception 'Forged owner bypass';exception when others then if sqlerrm<>'STAFF_REQUIRED' then raise;end if;end;
  begin perform public.dorra_owner_open(owner_id,ordinary_session);raise exception 'Foreign session bypass';exception when others then if sqlerrm<>'AUTH_SESSION_ENDED' then raise;end if;end;
  delete from auth.sessions where id=owner_session;
  begin perform public.dorra_owner_open(owner_id,owner_session);raise exception 'Deleted session bypass';exception when others then if sqlerrm<>'AUTH_SESSION_ENDED' then raise;end if;end;
  if has_function_privilege('authenticated','public.dorra_owner_open(uuid,uuid)','execute') or has_function_privilege('anon','public.dorra_owner_open(uuid,uuid)','execute') then raise exception 'Browser RPC exposed';end if;
  raise exception 'QA_ROLLBACK';
 exception when others then if sqlerrm<>'QA_ROLLBACK' then raise;end if;
 end;
end $$;
