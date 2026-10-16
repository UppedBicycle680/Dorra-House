import test from 'node:test';
import assert from 'node:assert/strict';
import {createWarHandler,validateWarBody} from './handler.mjs';
const id='11111111-1111-4111-8111-111111111111';
const token=`x.${Buffer.from(JSON.stringify({session_id:id})).toString('base64url')}.x`;
const body={action:'view',matchId:id,leaseId:id,args:{}};
const request=(b=body,headers={})=>new Request('https://example.test/functions/v1/dorra-war',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...headers},body:JSON.stringify(b)});
test('gateway forwards only a verified identity and intentions',async()=>{
 let call;const h=createWarHandler({getUser:async()=>({id}),rpc:async(...args)=>{call=args;return {data:{view:{match:{id}},serverNow:1}};}});
 const r=await h(request());assert.equal(r.status,200);assert.equal(call[0],'dorra_war_command');assert.equal(call[1].p_user_id,id);assert.equal(call[1].p_auth_session_id,id);assert.deepEqual(call[1].p_args,{});
});
test('gateway rejects unverified JWTs and anonymous users without RPC',async()=>{
 for(const user of [null,{id,is_anonymous:true}]){let calls=0;const h=createWarHandler({getUser:async()=>user,rpc:async()=>{calls++;}});assert.equal((await h(request())).status,401);assert.equal(calls,0);}
});
test('mutations require permanent request IDs; reads do not',()=>{
 assert.doesNotThrow(()=>validateWarBody(body));assert.doesNotThrow(()=>validateWarBody({...body,protocolVersion:1}));assert.throws(()=>validateWarBody({...body,protocolVersion:2}),error=>error.code==='PROTOCOL_VERSION');assert.throws(()=>validateWarBody({...body,action:'start'}));assert.doesNotThrow(()=>validateWarBody({...body,action:'start',requestId:id}));
 assert.throws(()=>validateWarBody({...body,seed:'attacker'}));assert.throws(()=>validateWarBody({...body,action:'order',requestId:id,args:{unitIds:[id],type:'teleport'}}));
});
test('SQL errors never leak hidden identifiers or implementation details',async()=>{
 const h=createWarHandler({getUser:async()=>({id}),rpc:async()=>({error:{message:'constraint secret enemy-id violated',code:'23514'}})});
 const r=await h(request());assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/secret|enemy-id|constraint/);
});
test('session replacement and capacity errors remain actionable',async()=>{
 for(const code of ['SESSION_REPLACED','WORLD_CAPACITY','INTERCEPTOR_DEFENSIVE_ONLY','DEFEND_FRIENDLY','NO_VALID_TARGET','INVALID_TARGET_CLASS']){const h=createWarHandler({getUser:async()=>({id}),rpc:async()=>({error:{message:code,code:'P0001'}})});const r=await h(request());assert.equal(r.status,409);assert.equal((await r.json()).code,code);}
});
test('origin policy and streaming input limits are enforced',async()=>{
 const h=createWarHandler({getUser:async()=>({id}),rpc:async()=>({data:{}})});assert.equal((await h(request(body,{Origin:'https://evil.test'}))).status,403);
 assert.equal((await h(request({...body,args:{text:'x'.repeat(21000)}}))).status,413);
});
