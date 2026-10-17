-- Auth is an external service. Claim its side effect before updating it, then
-- finalize session revocation and a redacted audit in one database transaction.
-- No plaintext password is persisted. The retry binding is a keyed HMAC whose
-- key exists only in the Edge runtime, never an offline password verifier.
create table dorra_private.owner_password_jobs(id uuid primary key default gen_random_uuid(),
 actor uuid not null references dorra_private.profiles(user_id),session_id uuid not null,target uuid not null references dorra_private.profiles(user_id),
 preview_id uuid not null,request_id uuid not null,password_binding text not null check(password_binding ~ '^[0-9a-f]{64}$'),
 preview_digest text not null,reason text not null,changes jsonb not null,status text not null check(status in ('applying','failed','succeeded')),
 claim uuid not null default gen_random_uuid(),claimed_at timestamptz not null default now(),result jsonb,unique(actor,request_id));
create index owner_password_jobs_target on dorra_private.owner_password_jobs(target);
alter table dorra_private.owner_password_jobs enable row level security;
revoke all on dorra_private.owner_password_jobs from public,anon,authenticated;
grant select,insert,update,delete on dorra_private.owner_password_jobs to service_role;
grant delete on auth.sessions,auth.refresh_tokens to service_role;

create function public.dorra_owner_password_begin(p_actor uuid,p_session uuid,p_preview uuid,p_request uuid,p_binding text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare context jsonb; preview dorra_private.admin_previews; job dorra_private.owner_password_jobs; profile dorra_private.profiles; revision bigint;
begin
 context:=dorra_private.staff_context(p_actor,p_session);
 if not(context->>'owner')::boolean then raise exception 'PERMISSION_DENIED'; end if;
 if p_binding !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_INPUT'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,0));
 select * into job from dorra_private.owner_password_jobs where actor=p_actor and request_id=p_request for update;
 if job.id is not null then
  if job.password_binding<>p_binding or job.preview_id<>p_preview or job.session_id<>p_session then raise exception 'REQUEST_REUSED'; end if;
  if job.status='succeeded' then return jsonb_build_object('replayed',true,'result',job.result); end if;
  if job.status='applying' and job.claimed_at>now()-interval '30 seconds' then raise exception 'PASSWORD_PENDING'; end if;
 elsif exists(select 1 from dorra_private.admin_audit where actor=p_actor and request_id=p_request) then raise exception 'REQUEST_REUSED'; end if;
 select * into preview from dorra_private.admin_previews where id=p_preview and actor=p_actor and session_id=p_session;
 if preview.id is null or preview.expires_at<=now() then raise exception 'PREVIEW_EXPIRED'; end if;
 if preview.args->>'action'<>'password-set' then raise exception 'INVALID_INPUT'; end if;
 select * into profile from dorra_private.profiles where user_id=preview.target for update;
 select state.revision into revision from dorra_private.player_state state where state.user_id=preview.target;
 if profile.admin_version<>preview.profile_version or revision is distinct from preview.revision then raise exception 'STALE_REVISION'; end if;
 if preview.args->>'confirmation'<>profile.username then raise exception 'INVALID_INPUT'; end if;
 if exists(select 1 from dorra_private.owner_password_jobs where target=preview.target and status='applying' and claimed_at>now()-interval '60 seconds' and id is distinct from job.id) then raise exception 'PASSWORD_PENDING'; end if;
 if job.id is null then
  insert into dorra_private.owner_password_jobs(actor,session_id,target,preview_id,request_id,password_binding,preview_digest,reason,changes,status)
  values(p_actor,p_session,preview.target,p_preview,p_request,p_binding,preview.digest,preview.args->>'reason',preview.changes,'applying') returning * into job;
 else
  update dorra_private.owner_password_jobs set status='applying',claim=gen_random_uuid(),claimed_at=now() where id=job.id returning * into job;
 end if;
 return jsonb_build_object('jobId',job.id,'claim',job.claim,'targetId',job.target);
end $$;
create function public.dorra_owner_password_finish(p_actor uuid,p_session uuid,p_job uuid,p_claim uuid,p_success boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job dorra_private.owner_password_jobs; saved_result jsonb;
begin
 select * into job from dorra_private.owner_password_jobs where id=p_job and actor=p_actor and session_id=p_session for update;
 if job.id is null or job.claim<>p_claim or job.status<>'applying' or job.claimed_at<now()-interval '60 seconds' then raise exception 'PASSWORD_PENDING'; end if;
 if not exists(select 1 from dorra_private.profiles where user_id=p_actor and owner and role='admin' and not disabled and not banned) then raise exception 'PERMISSION_DENIED'; end if;
 if not p_success then
  update dorra_private.owner_password_jobs set status='failed' where id=job.id;
  return jsonb_build_object('ok',false);
 end if;
 perform 1 from dorra_private.profiles where user_id=job.target for update;
 delete from auth.refresh_tokens where user_id=job.target::text;
 delete from auth.sessions where user_id=job.target;
 delete from dorra_private.admin_grants where user_id=job.target;
 update dorra_private.admin_previews set expires_at=now() where actor=job.target and id<>job.preview_id;
 update dorra_private.profiles set admin_version=admin_version+1 where user_id=job.target;
 saved_result:=jsonb_build_object('ok',true,'action','password-set','targetId',job.target,'changes',job.changes,'serverNow',now());
 insert into dorra_private.admin_audit(actor,target,session_id,action,reason,changes,request_id,preview_digest,result)
 values(job.actor,job.target,job.session_id,'password-set',job.reason,job.changes,job.request_id,job.preview_digest,saved_result);
 update dorra_private.owner_password_jobs set status='succeeded',result=saved_result where id=job.id;
 return saved_result;
end $$;
revoke all on function public.dorra_owner_password_begin(uuid,uuid,uuid,uuid,text),public.dorra_owner_password_finish(uuid,uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.dorra_owner_password_begin(uuid,uuid,uuid,uuid,text),public.dorra_owner_password_finish(uuid,uuid,uuid,uuid,boolean) to service_role;
