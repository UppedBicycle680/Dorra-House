import test from 'node:test';
import assert from 'node:assert/strict';
import {createEstateCloud} from './estate-cloud.js';
import {initializeHouse,reduceHouseProgression} from './supabase/functions/dorra-api/house-progression.mjs';
import {MAX_BALANCE} from './game-limits.js';

const NOW=1_800_000_000_000;
const fixture=(balance=5000)=>initializeHouse({balance,history:[],stats:{sessions:0,wins:0,games:{}},progress:{level:1,xp:0,owned:[],equipped:{},configurations:{},vehicles:{},campaign:{retained:true},sentinel:{retained:true}}},NOW);
async function reduce(state,action,args={},now=NOW) {
  return reduceHouseProgression(structuredClone(state),{},action,args,now);
}
const storage=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key),values}};
function harness({balance=5000,loseResponse=false,expiry=4_000_000_000}={}) {
  const store=storage(), calls=[], cached=new Map();let state=fixture(balance),revision=1,now=NOW,lost=false,sequence=0;
  const fetchImpl=async (url,request) => {
    const body=JSON.parse(request.body);calls.push({url,body});
    if(url.includes('dorra-login'))return Response.json({access_token:'fixture-access-token',refresh_token:'fixture-refresh-token',expires_at:expiry});
    if(url.includes('/auth/v1/token'))return Response.json({access_token:'fixture-refreshed-token',refresh_token:'fixture-new-refresh-token',expires_at:4_000_000_000});
    if(body.action==='acquire')return Response.json({snapshot:state,revision,username:'fixture_user',serverNow:now});
    if(cached.has(body.requestId))return Response.json({...cached.get(body.requestId),replayed:true});
    if(body.expectedRevision!==revision)return Response.json({error:'Save changed.',code:'STALE_REVISION'},{status:409});
    try {
      const output=await reduce(state,body.action,body.args,now);
      state=output.snapshot;revision++;
      const response={snapshot:state,revision,result:output.result,serverNow:now};cached.set(body.requestId,response);
      if(loseResponse&&!lost){lost=true;throw new TypeError('Simulated lost response after commit')}
      return Response.json(response);
    } catch(error) {
      if(error instanceof TypeError)throw error;
      return Response.json({error:error.message,code:error.code||'ACTION_REJECTED'},{status:error.status||400});
    }
  };
  const cloud=createEstateCloud({fetchImpl,storage:store,clock:()=>now,randomId:()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`});
  return {cloud,store,calls,get state(){return state},get revision(){return revision},tick(ms){now+=ms},bumpRevision(){revision++}};
}

test('authoritative route opens, serves, rewards milestones and preserves other progress',async()=>{
  let state=fixture(5000);
  const opening=await reduce(state,'estate-clicker-open',{venueId:'terrace'});state=opening.snapshot;
  assert.equal(state.balance,4750);assert.equal(state.progress.empire.venues.terrace.level,1);
  const served=await reduce(state,'estate-clicker-serve',{venueId:'terrace'});state=served.snapshot;
  assert.equal(served.result.amount,12);assert.equal(state.balance,4762);
  const goal=await reduce(state,'estate-clicker-goal',{goalId:'first-service'});state=goal.snapshot;
  assert.equal(goal.result.amount,75);assert.equal(state.balance,4837);
  assert.deepEqual(state.progress.sentinel,{retained:true});
  assert.deepEqual(state.progress.campaign,{retained:true});
  await assert.rejects(reduce(state,'estate-clicker-goal',{goalId:'first-service'}),/already been claimed/);
});

test('server refuses forged prices, balances, outcomes, clocks and unknown venues',async()=>{
  const state=fixture();
  for(const field of ['balance','amount','now','cost','vip']) {
    await assert.rejects(reduce(state,'estate-clicker-open',{venueId:'terrace',[field]:999999}),/calculated by the House/);
  }
  await assert.rejects(reduce(state,'estate-clicker-open',{venueId:'unknown'}),/unavailable/);
  await assert.rejects(reduce(state,'estate-clicker-goal',{goalId:'first-service'}),/Complete/);
  assert.equal(await reduceHouseProgression(structuredClone(state),{},'estate-clicker-unknown',{},NOW),null);
});

test('legacy estate commands cannot bypass clicker prices or grant a simulated week of income',async()=>{
  const state=fixture();
  for (const action of ['estate-week','estate-upgrade','estate-manager','estate-claim','estate-loan','estate-objective']) {
    await assert.rejects(reduce(state,action,{venueId:'terrace'}),/Estate has changed/);
  }
  assert.equal(state.balance,5000);
});

test('server cooldown rejects duplicate taps without awarding money',async()=>{
  let state=(await reduce(fixture(),'estate-clicker-open',{venueId:'terrace'})).snapshot;
  state=(await reduce(state,'estate-clicker-serve',{venueId:'terrace'},NOW)).snapshot;
  await assert.rejects(reduce(state,'estate-clicker-serve',{venueId:'terrace'},NOW+299),/arriving/);
  assert.equal(state.balance,4762);
  assert.equal((await reduce(state,'estate-clicker-serve',{venueId:'terrace'},NOW+300)).result.amount,12);
});

test('server upgrades before hiring and pays capped offline automation once',async()=>{
  let state=(await reduce(fixture(),'estate-clicker-open',{venueId:'terrace'})).snapshot;
  await assert.rejects(reduce(state,'estate-clicker-manager',{venueId:'terrace'}),/Level 2/);
  state=(await reduce(state,'estate-clicker-upgrade',{venueId:'terrace'})).snapshot;
  state=(await reduce(state,'estate-clicker-manager',{venueId:'terrace'})).snapshot;
  assert.equal(state.balance,2650);
  const claim=await reduce(state,'estate-clicker-claim',{},NOW+24*3600000);
  assert.equal(claim.result.amount,103680); // 8 hours, $18 every five seconds.
  state=claim.snapshot;
  await assert.rejects(reduce(state,'estate-clicker-claim',{},NOW+24*3600000),/still earning/);
  assert.equal(state.progress.empire.clicker.bankMs,0);
});

test('new progress survives JSON serialization and normalizer while staying small',async()=>{
  let state=(await reduce(fixture(),'estate-clicker-open',{venueId:'terrace'})).snapshot;
  state=(await reduce(state,'estate-clicker-serve',{venueId:'terrace'})).snapshot;
  const before=structuredClone(state.progress.empire.clicker);
  const loaded=initializeHouse(JSON.parse(JSON.stringify(state)),NOW+1000);
  assert.deepEqual(loaded.progress.empire.clicker,before);
  assert.ok(new TextEncoder().encode(JSON.stringify(loaded.progress)).byteLength<2_000_000);
  assert.equal(loaded.progress.empire.venues.terrace.level,1);
});

test('server wallet overflow cannot produce unsafe integers',async()=>{
  let state=(await reduce(fixture(),'estate-clicker-open',{venueId:'terrace'})).snapshot;
  state.balance=MAX_BALANCE;
  await assert.rejects(reduce(state,'estate-clicker-serve',{venueId:'terrace'}),/reached its limit/);
  assert.equal(state.progress.empire.clicker.served,0);
});

test('client signs in then sends only player intentions and adopts authoritative snapshot',async()=>{
  const h=harness();
  await h.cloud.login('Fixture_User','fixture-password');
  assert.equal(h.cloud.connected,true);assert.equal(h.cloud.username,'fixture_user');
  const output=await h.cloud.command('estate-clicker-open',{venueId:'terrace'});
  assert.equal(output.snapshot.balance,4750);assert.equal(h.cloud.snapshot.balance,4750);
  const call=h.calls.find(c=>c.body.action==='estate-clicker-open');
  assert.deepEqual(Object.keys(call.body).sort(),['scope','action','args','leaseId','requestId','expectedRevision'].sort());
  assert.deepEqual(call.body.args,{venueId:'terrace'});
  assert.ok([...h.store.values.values()].every(value=>!value.includes('fixture-password')));
  const copy=h.cloud.snapshot;copy.balance=0;
  assert.equal(h.cloud.snapshot.balance,4750);
});

test('uncertain delivery retries identical request id and cannot charge twice',async()=>{
  const h=harness({loseResponse:true});
  await h.cloud.login('fixture_user','fixture-password');
  await h.cloud.command('estate-clicker-open',{venueId:'terrace'});
  assert.equal(h.cloud.snapshot.balance,4750);assert.equal(h.revision,2);
  const commands=h.calls.filter(c=>c.body.action==='estate-clicker-open');
  assert.equal(commands.length,2);assert.deepEqual(commands[0].body,commands[1].body);
});

test('stale revision refreshes snapshot and rejects the stale action without local fallback',async()=>{
  const h=harness();await h.cloud.login('fixture_user','fixture-password');h.bumpRevision();
  await assert.rejects(h.cloud.command('estate-clicker-open',{venueId:'terrace'}),error=>error.code==='STALE_REVISION');
  assert.equal(h.cloud.connected,true);assert.equal(h.cloud.status,'error');assert.equal(h.cloud.snapshot.balance,5000);
  await h.cloud.command('estate-clicker-open',{venueId:'terrace'});
  assert.equal(h.cloud.snapshot.balance,4750);
});

test('expired access tokens refresh before acquiring the account',async()=>{
  const h=harness({expiry:NOW/1000-1});await h.cloud.login('fixture_user','fixture-password');
  assert.equal(h.calls.filter(c=>c.url.includes('/auth/v1/token')).length,1);
  assert.equal(h.cloud.connected,true);
});

test('disconnect returns to local mode and clears Estate auth without touching local save',async()=>{
  const h=harness();h.store.setItem('dorra-vault-mirror','guest-sentinel');
  await h.cloud.login('fixture_user','fixture-password');await h.cloud.disconnect();
  assert.equal(h.cloud.connected,false);assert.equal(h.cloud.snapshot,null);assert.equal(h.cloud.remembered,false);
  assert.equal(h.store.getItem('dorra-vault-mirror'),'guest-sentinel');
  await assert.rejects(h.cloud.command('estate-clicker-open',{venueId:'terrace'}),error=>error.code==='UNAUTHORIZED');
});

test('isolated guest fixture never enters cloud requests',async()=>{
  const h=harness();await h.cloud.login('fixture_user','fixture-password');
  await h.cloud.command('estate-clicker-open',{venueId:'terrace'});
  assert.ok(h.calls.every(call=>!('snapshot' in call.body)));
});
