import {validate,fail,sha256,constantEqual,prepareChange,unlockCatalog,UUID} from './model.mjs';
const origins=new Set(['https://uppedbicycle680.github.io','http://localhost:4173','http://127.0.0.1:4173','http://localhost:4180','http://127.0.0.1:4180']);
const messages={AUTH_SESSION_ENDED:'Your sign-in session ended. Sign in again.',STAFF_REQUIRED:'This account is not approved for staff access.',ACCESS_EXPIRED:'Panel access expired. Enter the code again.',PERMISSION_DENIED:'Your role cannot perform this action.',ACCOUNT_DISABLED:'This account is unavailable.',STALE_REVISION:'This record changed. Refresh it and preview the change again.',PREVIEW_EXPIRED:'The preview expired. Preview the change again.',REQUEST_REUSED:'This request identifier belongs to another change.',RATE_LIMIT:'Too many attempts. Wait before trying again.',OWNER_PROTECTED:'Owner status requires trusted Supabase setup.',NOT_FOUND:'That record no longer exists.'};
export function createAdminHandler({getUser,rpc,ipHash}) {
  return async request=>{
    const origin=request.headers.get('Origin'),headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
    if(origin&&origins.has(origin))headers['Access-Control-Allow-Origin']=origin;
    const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
    if(origin&&!origins.has(origin))return reply({error:'This origin is not allowed.',code:'ORIGIN_DENIED'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return reply({error:'Use POST.',code:'METHOD_NOT_ALLOWED'},405);
    try {
      const bearer=request.headers.get('Authorization')||'';
      if(!bearer.startsWith('Bearer '))fail('Sign in to continue.','UNAUTHORIZED',401);
      const token=bearer.slice(7),user=await getUser(token);
      if(!user||user.is_anonymous)fail('Sign in with a registered account.','UNAUTHORIZED',401);
      let claims;try{claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{fail('Invalid sign-in.','UNAUTHORIZED',401);}
      if(!UUID.test(claims.session_id||''))fail('Your session ended.','AUTH_SESSION_ENDED',401);
      if(!request.headers.get('Content-Type')?.startsWith('application/json'))fail('Use JSON.');
      const reader=request.body?.getReader();let raw='',bytes=0;const decoder=new TextDecoder();
      if(reader){try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>16384){await reader.cancel();fail('Request too large.','PAYLOAD_TOO_LARGE',413);}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}finally{reader.releaseLock();}}
      let input;try{input=validate(JSON.parse(raw));}catch(error){if(error instanceof SyntaxError)fail('Invalid JSON.');throw error;}
      const identity={p_actor:user.id,p_session:claims.session_id};
      const call=async(name,args={})=>{const response=await rpc(name,{...identity,...args});if(response.error){const key=Object.keys(messages).find(key=>response.error.message?.includes(key));if(key)fail(messages[key],key,key==='AUTH_SESSION_ENDED'?401:key==='RATE_LIMIT'?429:['STALE_REVISION','PREVIEW_EXPIRED','REQUEST_REUSED'].includes(key)?409:403);fail('The operation could not be saved. Please retry.','SAVE_FAILED',503);}return response.data;};
      if(input.operation==='status')return reply(await call('dorra_admin_status'));
      if(input.operation==='lock'){await call('dorra_admin_lock');return reply({locked:true});}
      if(input.operation==='unlock'){
        const attempt=await call('dorra_admin_attempt',{p_ip:await ipHash(request)});
        if(attempt.limited)fail(messages.RATE_LIMIT,'RATE_LIMIT',429);
        const valid=constantEqual(await sha256(input.args.code),attempt.digest);
        if(!valid)fail('The access code is invalid.','INVALID_CODE',403);
        return reply(await call('dorra_admin_grant',{p_version:attempt.version}));
      }
      if(input.operation==='preview'){
        const actor=await call('dorra_admin_status');
        const saved=await call('dorra_admin_target',{p_target:input.args.targetId});
        const prepared=prepareChange(saved,input.args,actor);
        const digest=await sha256(JSON.stringify(input.args));
        const preview=await call('dorra_admin_preview',{p_target:input.args.targetId,p_revision:saved.revision,p_profile_version:saved.profile.version,p_args:input.args,p_changes:prepared.changes,p_digest:digest,p_snapshot:prepared.resource?prepared.snapshot:null,p_private:prepared.resource?prepared.privateState:null});
        return reply(preview);
      }
      if(input.operation==='commit')return reply(await call('dorra_admin_commit',{p_preview:input.previewId,p_request:input.requestId}));
      const data=await call('dorra_admin_read',{p_operation:input.operation,p_args:input.args});
      if(input.operation==='player')data.unlockCatalog=unlockCatalog();
      return reply(data);
    }catch(error){return reply({error:error.code?error.message:'The panel is temporarily unavailable. Retry shortly.',code:error.code||'SERVICE_UNAVAILABLE'},error.status||503);}
  };
}
