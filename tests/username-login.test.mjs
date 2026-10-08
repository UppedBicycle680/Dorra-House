import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoginHandler} from '../supabase/functions/dorra-login/handler.mjs';

const userId = '11111111-1111-4111-8111-111111111111';
const origin = 'https://uppedbicycle680.github.io';
const request = (body, extra = {}) => new Request('https://example.test/dorra-login', {
  method: 'POST', headers: {'Content-Type': 'application/json', Origin: origin}, body: JSON.stringify(body), ...extra
});
function fixture(overrides = {}) {
  const calls = [];
  const handler = createLoginHandler({
    lookup: async (name, ip) => {calls.push({name, ip}); return {user_id: userId, limited: false};},
    getEmail: async id => {assert.equal(id, userId); return 'private@example.test';},
    authenticate: async (email, password) => {calls.push({email, password}); return {data: {session: {user: {id: userId}, access_token: 'access', refresh_token: 'refresh'}}};},
    ipHash: async () => 'a'.repeat(64),
    ...overrides
  });
  return {handler, calls};
}

test('username login normalizes case, verifies the password, and returns only session tokens', async () => {
  const {handler,calls} = fixture();
  const response = await handler(request({username:'  Dorra_Player  ',password:'password123'}));
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{access_token:'access',refresh_token:'refresh'});
  assert.deepEqual(calls,[{name:'dorra_player',ip:'a'.repeat(64)},{email:'private@example.test',password:'password123'}]);
  assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
});

test('unknown usernames and incorrect passwords have the same public error and still verify with Auth', async () => {
  const failure = async () => ({error:{status:400,code:'invalid_credentials',message:'Internal email details'}});
  const known = fixture({authenticate:failure});
  const missing = fixture({lookup:async()=>({limited:false,user_id:null}),getEmail:async()=>{throw new Error('Do not look up missing users');},authenticate:async(email,password)=>{
    assert.match(email,/@dorra-login\.invalid$/);
    assert.equal(password,'password123');
    return failure();
  }});
  const responses = await Promise.all([known,missing].map(({handler})=>handler(request({username:'member',password:'password123'}))));
  assert.equal(responses[0].status,401);
  assert.equal(responses[1].status,401);
  assert.deepEqual(await responses[0].json(),await responses[1].json());
});

test('a token for a different user is never returned', async () => {
  const {handler}=fixture({authenticate:async()=>({data:{session:{user:{id:'different'},access_token:'secret',refresh_token:'secret'}}})});
  const response=await handler(request({username:'member',password:'password123'}));
  assert.equal(response.status,401);
  assert.doesNotMatch(await response.text(),/secret/);
});

test('rate limits block Auth attempts, include retry guidance, and never reveal lookup results', async () => {
  const {handler}=fixture({lookup:async()=>({limited:true,user_id:null}),authenticate:async()=>{throw new Error('Rate-limited requests must not authenticate');}});
  const response=await handler(request({username:'member',password:'password123'}));
  assert.equal(response.status,429);
  assert.equal(response.headers.get('Retry-After'),'60');
  assert.equal((await response.json()).code,'RATE_LIMIT');
});

test('invalid input, oversized streams, and disallowed origins never reach the username lookup', async () => {
  const {handler,calls}=fixture();
  for (const body of [null,{username:'bad username',password:'password123'},{username:'member',password:'short'},{username:'member',password:'x'.repeat(1025)}]) {
    assert.equal((await handler(request(body))).status,400);
  }
  const denied=await handler(request({username:'member',password:'password123'},{headers:{Origin:'https://other.test','Content-Type':'application/json'}}));
  assert.equal(denied.status,403);
  assert.equal(denied.headers.get('Access-Control-Allow-Origin'),null);
  assert.deepEqual(calls,[]);
});

test('browser preflight is allowed, non-POST methods are rejected, and backend failures stay generic', async () => {
  const {handler}=fixture({lookup:async()=>{throw new Error('Private database details');}});
  assert.equal((await handler(new Request('https://example.test',{method:'OPTIONS',headers:{Origin:origin}}))).status,204);
  assert.equal((await handler(new Request('https://example.test'))).status,405);
  const response=await handler(request({username:'member',password:'password123'}));
  assert.equal(response.status,503);
  assert.doesNotMatch(await response.text(),/Private database/);
});
