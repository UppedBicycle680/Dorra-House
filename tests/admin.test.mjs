import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareChange,validate,sha256,constantEqual} from '../supabase/functions/dorra-admin/model.mjs';
import {createAdminHandler} from '../supabase/functions/dorra-admin/handler.mjs';
import {createCareer} from '../airport/engine.mjs';
import {MAX_BALANCE} from '../game-limits.js';
const actor={role:'admin',owner:false}, moderator={role:'moderator',owner:false};
const userId='11111111-1111-4111-8111-111111111111',sessionId='22222222-2222-4222-8222-222222222222';
const fixture=()=>({snapshot:{balance:1000,stats:{sessions:10,wins:4},progress:{level:1,xp:0,owned:[],equipped:{},anotherMode:{keep:true}}},privateState:{house:{deck:['private']}},profile:{username:'target',role:'player',owner:false}});
test('resource edits enforce limits and preserve unrelated private state',()=>{
  const saved=fixture();const result=prepareChange(saved,{action:'money',amount:2000,direction:'remove'},actor);
  assert.equal(result.snapshot.balance,0);assert.equal(saved.snapshot.balance,1000);assert.deepEqual(result.privateState,saved.privateState);
  saved.snapshot.balance=MAX_BALANCE;assert.throws(()=>prepareChange(saved,{action:'money',amount:1,direction:'add'},actor),/exceed/i);
  assert.throws(()=>prepareChange(saved,{action:'money',amount:1.5,direction:'add'},actor),/whole/);
});
test('moderators cannot perform resource, progression, permanent-ban or lift operations',()=>{
  for(const action of ['money','xp','stats','football-tokens','airport-cash','airport-research','airport-diamonds','level','unlock','ban','lift'])assert.throws(()=>prepareChange(fixture(),{action},moderator),error=>error.code==='PERMISSION_DENIED');
  assert.equal(prepareChange(fixture(),{action:'warn',reason:'Observed behavior'},moderator).resource,false);
  assert.equal(prepareChange(fixture(),{action:'suspend',duration:24},moderator).changes.length,1);
});
test('XP and levels use existing rules and statistics reject inconsistent wins',()=>{
  const result=prepareChange(fixture(),{action:'xp',amount:500},actor);assert.equal(result.snapshot.progress.level,2);assert.equal(result.snapshot.progress.xp,200);
  assert.throws(()=>prepareChange(fixture(),{action:'stats',sessions:1,wins:2},actor),/Wins/);
  assert.throws(()=>prepareChange(fixture(),{action:'level',level:100},actor),/Level/);
});
test('unavailable careers and airports cannot be invented by admin inputs',()=>{
  assert.throws(()=>prepareChange(fixture(),{action:'football-tokens',amount:1},actor),/club first/);
  assert.throws(()=>prepareChange(fixture(),{action:'airport-cash',amount:1,airportId:'brisbane'},actor),/career first/);
  const saved=fixture();saved.privateState.airport=createCareer(1000,37);
  assert.throws(()=>prepareChange(saved,{action:'airport-cash',amount:1,airportId:'unowned'},actor),/owned/);
  const id=Object.keys(saved.privateState.airport.airports)[0],before=saved.privateState.airport.airports[id].cash;
  const result=prepareChange(saved,{action:'airport-cash',amount:50,airportId:id},actor);
  assert.equal(result.privateState.airport.airports[id].cash,before+50);assert.equal(result.privateState.airport.seed,saved.privateState.airport.seed);
});
test('owner, role assignment, ban confirmation and suspension duration are protected',()=>{
  const saved=fixture();saved.profile.owner=true;
  assert.throws(()=>prepareChange(saved,{action:'suspend',duration:24},actor),error=>error.code==='OWNER_PROTECTED');
  assert.throws(()=>prepareChange(fixture(),{action:'staff-role',role:'admin'},actor),error=>error.code==='PERMISSION_DENIED');
  assert.throws(()=>prepareChange(fixture(),{action:'ban',confirmation:'different'},actor),/exact username/);
  assert.throws(()=>prepareChange(fixture(),{action:'suspend',duration:48},moderator),/24 hours/);
});
test('unknown fields, injected actor IDs, missing reasons and malformed IDs are denied',()=>{
  assert.throws(()=>validate({operation:'dashboard',actor:userId}),/Unsupported/);
  assert.throws(()=>validate({operation:'preview',args:{targetId:userId,action:'warn',reason:''}}),/Reason/);
  assert.throws(()=>validate({operation:'player',args:{targetId:'other'}}),/valid record/);
  assert.throws(()=>validate({operation:'commit',previewId:'other',requestId:userId}),/Preview/);
});
test('code digests compare equal only for identical fixed-length digests',async()=>{
  const a=await sha256('code');assert.equal(constantEqual(a,a),true);assert.equal(constantEqual(a,await sha256('other')),false);assert.equal(constantEqual(a,a+'0'),false);
});
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const token=()=>`${encode({alg:'HS256'})}.${encode({sub:userId,session_id:sessionId,exp:Math.floor(Date.now()/1000)+3600})}.verified-by-getUser`;
function handler({user={id:userId},responses={},calls=[]}={}){return createAdminHandler({getUser:async()=>user,rpc:async(name,args)=>{calls.push({name,args});return responses[name]||{data:{},error:null};},ipHash:async()=> 'a'.repeat(64)});}
const request=(input,authorization=`Bearer ${token()}`)=>new Request('https://example.test',{method:'POST',headers:{Origin:'https://uppedbicycle680.github.io','Content-Type':'application/json',...(authorization?{Authorization:authorization}:{})},body:JSON.stringify(input)});
test('endpoint rejects unauthenticated, invalid and anonymous Auth users before storage',async()=>{
  const calls=[];assert.equal((await handler({calls})(request({operation:'dashboard'},null))).status,401);assert.equal(calls.length,0);
  assert.equal((await handler({user:null})(request({operation:'dashboard'}))).status,401);
  assert.equal((await handler({user:{id:userId,is_anonymous:true}})(request({operation:'dashboard'}))).status,401);
});
test('endpoint derives actor/session from verified identity and does not trust metadata',async()=>{
  const calls=[];const response=await handler({user:{id:userId,user_metadata:{role:'admin'}},calls,responses:{dorra_admin_read:{error:{message:'STAFF_REQUIRED'}}}})(request({operation:'dashboard'}));
  assert.equal(response.status,403);assert.equal(calls[0].args.p_actor,userId);assert.equal(calls[0].args.p_session,sessionId);assert.equal(calls[0].args.p_operation,'dashboard');
});
test('a correct code grants only after the database approves staff and attempts',async()=>{
  const code='DH-'+'a'.repeat(43),digest=await sha256(code),calls=[];
  let response=await handler({calls,responses:{dorra_admin_attempt:{data:{digest,version:'v1'}},dorra_admin_grant:{data:{unlocked:true}}}})(request({operation:'unlock',args:{code}}));
  assert.equal(response.status,200);assert.equal(calls[1].name,'dorra_admin_grant');assert.equal((await response.json()).digest,undefined);
  response=await handler({responses:{dorra_admin_attempt:{error:{message:'STAFF_REQUIRED'}}}})(request({operation:'unlock',args:{code}}));assert.equal(response.status,403);
});
test('wrong code and rate-limited requests never create a grant',async()=>{
  const calls=[];const code='DH-'+'a'.repeat(43);
  let response=await handler({calls,responses:{dorra_admin_attempt:{data:{digest:'b'.repeat(64),version:'v1'}}}})(request({operation:'unlock',args:{code}}));assert.equal(response.status,403);assert.equal(calls.length,1);
  response=await handler({responses:{dorra_admin_attempt:{data:{limited:true}}}})(request({operation:'unlock',args:{code}}));assert.equal(response.status,429);
});
test('expired grant, revoked session and stale revision map to actionable statuses',async()=>{
  for(const [code,status] of [['ACCESS_EXPIRED',403],['AUTH_SESSION_ENDED',401],['STALE_REVISION',409]]){
    const response=await handler({responses:{dorra_admin_read:{error:{message:code}}}})(request({operation:'dashboard'}));assert.equal(response.status,status);assert.equal((await response.json()).code,code);
  }
});
