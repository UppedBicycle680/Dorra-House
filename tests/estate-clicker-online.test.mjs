import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeHouse,reduceHouseProgression} from '../supabase/functions/dorra-api/house-progression.mjs';
import {MAX_BALANCE} from '../game-limits.js';

const NOW=1_800_000_000_000;
const fixture=(balance=5000)=>initializeHouse({balance,history:[],stats:{sessions:0,wins:0,games:{}},progress:{level:1,xp:0,owned:[],equipped:{},configurations:{},vehicles:{},campaign:{retained:true},sentinel:{retained:true}}},NOW);
async function reduce(state,action,args={},now=NOW) {
  return reduceHouseProgression(structuredClone(state),{},action,args,now);
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

test('legacy Level 1 manager ownership survives authoritative migration and subsequent commands',async()=>{
  const state=initializeHouse({balance:1000,progress:{empire:{pending:17.75,venues:{terrace:{level:1,manager:true}}}}},NOW);
  assert.equal(state.progress.empire.venues.terrace.manager,true);
  const served=await reduce(state,'estate-clicker-serve',{venueId:'terrace'});
  assert.equal(served.snapshot.progress.empire.venues.terrace.manager,true);
  assert.equal(served.snapshot.progress.empire.pending,17.75);
});

test('normalizing a historical server timestamp cannot accrue the machine wall clock',async()=>{
  const now=Date.parse('2026-10-01T12:00:00Z');
  const state=initializeHouse({balance:1000,progress:{empire:{venues:{terrace:{level:2,manager:true}}}}},now);
  const loaded=initializeHouse(JSON.parse(JSON.stringify(state)),now+1000);
  assert.equal(loaded.progress.empire.pending,0);
  assert.equal(loaded.progress.empire.clicker.lastAccruedAt,now);
  const claimed=await reduce(loaded,'estate-clicker-claim',{},now+1000);
  assert.equal(claimed.result.amount,3);
  assert.ok(Math.abs(claimed.snapshot.progress.empire.pending-.6)<1e-8);
});
