import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
import {validateBody,commandDigest,UUID,fail} from './protocol.mjs';
import {initializeHouse} from './house-progression.mjs';
import {reduceHouse} from './house.mjs';
import {reduceAirport} from './airport.mjs';
import {reduceFootball} from './football.mjs';
import {reduceCampaign} from './campaign.mjs';
import {encodeResult,decodeResult} from './response-codec.mjs';

const origins=new Set(['https://uppedbicycle680.github.io','http://localhost:4173','http://127.0.0.1:4173']);
const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const reducers={house:reduceHouse,airport:reduceAirport,football:reduceFootball,campaign:reduceCampaign};
function fresh(now:number,username:string){const snapshot={balance:1000,history:[],stats:{sessions:0,wins:0,games:{}},progress:{level:1,xp:0,owned:[],equipped:{},configurations:{},vehicles:{},profile:{name:username}}};initializeHouse(snapshot,now);return snapshot;}
function storageError(error:any){const code=['SESSION_REPLACED','AUTH_SESSION_ENDED','ACCOUNT_DISABLED','STALE_REVISION','REQUEST_REUSED','RATE_LIMIT','SAVE_REQUIRED'].find(c=>error.message?.includes(c));if(code){const copy={SESSION_REPLACED:'Another device or tab started a gameplay session. Continue here to take over.',AUTH_SESSION_ENDED:'Your sign-in session ended. Sign in again to continue.',ACCOUNT_DISABLED:'This account is unavailable. Contact the House owner.',STALE_REVISION:'Your save changed. Refresh the latest state and retry your decision.',REQUEST_REUSED:'That request identifier was already used for another action.',RATE_LIMIT:'Too many actions. Wait a minute before continuing.',SAVE_REQUIRED:'Open a gameplay session before making a decision.'};fail(copy[code],code,code==='RATE_LIMIT'?429:code==='AUTH_SESSION_ENDED'?401:code==='ACCOUNT_DISABLED'?403:409);}throw Object.assign(new Error('The cloud save could not be updated. Please retry.'),{code:'STORAGE_ERROR',status:503});}
async function rpc(name:string,args:Record<string,unknown>){const {data,error}=await admin.rpc(name,args);if(error)storageError(error);return data;}
Deno.serve(async req=>{
  const origin=req.headers.get('Origin');
  const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
  if(origin&&origins.has(origin))headers['Access-Control-Allow-Origin']=origin;
  headers['Access-Control-Allow-Headers']='authorization, apikey, content-type, x-client-info';headers['Access-Control-Allow-Methods']='POST, OPTIONS';
  const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
  if(origin&&!origins.has(origin))return reply({error:'This website origin is not allowed.',code:'ORIGIN_DENIED'},403);
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply({error:'Use POST for gameplay commands.',code:'METHOD_NOT_ALLOWED'},405);
  try{
    if(!req.headers.get('Content-Type')?.startsWith('application/json'))fail('Use an application/json gameplay command.','CONTENT_TYPE',415);
    if(Number(req.headers.get('Content-Length')||0)>420000)fail('The action payload is too large.','PAYLOAD_TOO_LARGE',413);
    const text=await req.text();const inputBytes=new TextEncoder().encode(text).byteLength;if(inputBytes>420000)fail('The action payload is too large.','PAYLOAD_TOO_LARGE',413);
    let body;try{body=validateBody(JSON.parse(text));}catch(error){if(error instanceof SyntaxError)fail('Invalid JSON gameplay command.');throw error;}
    if(inputBytes>32768&&!(body.scope==='house'&&body.action==='profile-save'))fail('The action payload is too large.','PAYLOAD_TOO_LARGE',413);
    const authorization=req.headers.get('Authorization')||'';if(!authorization.startsWith('Bearer '))fail('Sign in to play.','UNAUTHORIZED',401);
    const token=authorization.slice(7);const {data:{user},error}=await admin.auth.getUser(token);
    if(error||!user)fail('Your sign-in expired. Sign in to continue.','UNAUTHORIZED',401);
    let claims;try{claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{fail('Your sign-in token is invalid.','UNAUTHORIZED',401);}
    if(!UUID.test(claims.session_id||''))fail('Use an email/password account to play.','AUTH_SESSION_ENDED',401);
    const identity={p_user_id:user.id,p_auth_session_id:claims.session_id,p_lease_id:body.leaseId};const now=Date.now();
    if(body.scope==='session'&&body.action==='acquire'){
      const saved=await rpc('dorra_acquire_session',{...identity,p_initial:fresh(now,'Member')});
      return reply({snapshot:saved.snapshot,revision:saved.revision,username:saved.username,serverNow:now});
    }
    const saved=await rpc('dorra_read_state',identity),digest=await commandDigest(body);
    const cached=saved.recentRequests.find((r:any)=>r.id===body.requestId.toLowerCase());
    if(cached){if(cached.digest!==digest)fail('Request identifier already used.','REQUEST_REUSED',409);return reply({snapshot:saved.snapshot,revision:saved.revision,result:await decodeResult(cached.result),replayed:true,serverNow:now});}
    if(saved.revision!==body.expectedRevision)fail('Your save changed. Reload its latest state and retry.','STALE_REVISION',409);
    if(body.scope==='session'&&body.action==='refresh')return reply({snapshot:saved.snapshot,revision:saved.revision,result:{},serverNow:now});
    const reducer=reducers[body.scope];if(!reducer)fail('Unknown gameplay command.');
    const output=await reducer(structuredClone(saved.snapshot),structuredClone(saved.privateState),body.action,body.args,now);
    if(!Number.isSafeInteger(output.snapshot.balance)||output.snapshot.balance<0||output.snapshot.balance>9_000_000_000_000_000)fail('The action would exceed the wallet limit.');
    if(new TextEncoder().encode(JSON.stringify(output.snapshot)+JSON.stringify(output.privateState)).byteLength>9_000_000)fail('Your save reached its size limit. Contact the House owner.','SAVE_SIZE_LIMIT',409);
    const encodedResult=await encodeResult(output.result||{});
    const committed=await rpc('dorra_commit_action',{...identity,p_expected_revision:body.expectedRevision,p_request_id:body.requestId,p_digest:digest,p_snapshot:output.snapshot,p_private_state:output.privateState,p_result:encodedResult});
    return reply({...committed,result:await decodeResult(committed.result),serverNow:now});
  }catch(error){return reply({error:error.message||'This action could not be completed.',code:error.code||'ACTION_REJECTED'},error.status||400);}
});
