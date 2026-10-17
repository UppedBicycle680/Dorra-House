import test from 'node:test';
import assert from 'node:assert/strict';
import {estateSnapshot,ESTATE_VENUES,estateUpgradePrice} from '../estate-engine.js';
import {initializeHouse,reduceHouseProgression} from '../supabase/functions/dorra-api/house-progression.mjs';
import {simulateEstateEconomy} from '../scripts/simulate-estate-economy.mjs';

const NOW=1_800_000_000_000;
const fixture=(level=2,balance=1_000_000)=>initializeHouse({balance,progress:{empire:{clicker:{lastAccruedAt:NOW},venues:{terrace:{level,manager:true}}}}},NOW);
const act=async(state,action,args={},now=NOW)=>(await reduceHouseProgression(structuredClone(state),{},'estate-clicker-'+action,args,now));
const venue=(state,now=NOW)=>estateSnapshot(structuredClone(state.progress),now).venues[0];
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('a $1,000 newcomer hires a director after one timed customer without other House gifts',async()=>{
 let state=initializeHouse({balance:1000},NOW);
 state=(await act(state,'open',{venueId:'terrace'})).snapshot;
 state=(await act(state,'serve',{venueId:'terrace'})).snapshot;
 assert.equal(state.balance,750);
 state=(await act(state,'tick',{},NOW+5000)).snapshot;
 state=(await act(state,'goal',{goalId:'first-service'},NOW+5000)).snapshot;
 state=(await act(state,'upgrade',{venueId:'terrace'},NOW+5000)).snapshot;
 state=(await act(state,'manager',{venueId:'terrace'},NOW+5000)).snapshot;
 assert.equal(state.balance,137);
 assert.equal(venue(state,NOW+5000).autoPerMinute,216);
 assert.equal(state.progress.empire.clicker.served,1);
 state=(await act(state,'goal',{goalId:'first-manager'},NOW+5000)).snapshot;
 state=(await act(state,'train',{venueId:'terrace'},NOW+5000)).snapshot;
 assert.equal(state.balance,404);
 assert.equal(venue(state,NOW+5000).managerRank,2);
});

test('training settles previous earnings, preserves cycle phase and improves future output',async()=>{
 const original=fixture(),before=venue(original,NOW+2500);
 const trained=await act(original,'train',{venueId:'terrace'},NOW+2500);
 assert.equal(trained.result.cost,83);
 const after=venue(trained.snapshot,NOW+2500);
 near(after.cycleProgress,before.cycleProgress);
 near(trained.snapshot.progress.empire.pending,9);
 assert.equal(after.managerRank,2);assert.equal(after.cyclePayout,21);assert.equal(after.cycleMs,4900);
 const tick=await act(trained.snapshot,'tick',{},NOW+3500);
 assert.equal(tick.result.amount,13);
 near(tick.snapshot.progress.empire.pending,9+21/4.9-13);
 assert.equal(original.progress.empire.clicker.venues.terrace.managerRank,1);
});

test('both specialists persist through House normalization and retain old output before hiring',async()=>{
 let state=fixture(25);
 const before=venue(state,NOW+1000);
 const revenue=await act(state,'specialist',{venueId:'terrace',role:'revenue'},NOW+1000);state=revenue.snapshot;
 const boosted=venue(state,NOW+1000);
 assert.equal(boosted.cyclePayout,Math.round(before.cyclePayout*1.25));
 near(state.progress.empire.pending,before.autoPerMinute/60);
 near(boosted.cycleProgress,before.cycleProgress);
 const operations=await act(state,'specialist',{venueId:'terrace',role:'operations'},NOW+1000);state=operations.snapshot;
 const faster=venue(state,NOW+1000);near(faster.cycleMs,boosted.cycleMs*.8);near(faster.cycleProgress,boosted.cycleProgress);
 const loaded=initializeHouse(JSON.parse(JSON.stringify(state)),NOW+1000);
 assert.deepEqual(loaded.progress.empire.clicker.venues.terrace.specialists,['revenue','operations']);
 assert.equal(venue(loaded,NOW+1000).autoPerMinute,faster.autoPerMinute);
 await assert.rejects(act(loaded,'specialist',{venueId:'terrace',role:'revenue'},NOW+1000),/already/);
});

test('locked, forged, unknown and unaffordable team investments leave the wallet alone',async()=>{
 for(const [state,action,args,pattern] of [
  [fixture(2),'specialist',{venueId:'terrace',role:'revenue'},/Level 10/],
  [fixture(10),'specialist',{venueId:'terrace',role:'operations'},/Level 25/],
  [fixture(),'train',{venueId:'terrace',amount:0},/calculated/],
  [fixture(),'specialist',{venueId:'terrace',role:'admin'},/valid specialist/],
  [fixture(2,1),'train',{venueId:'terrace'},/capital/],
  [initializeHouse({balance:1000,progress:{empire:{clicker:{lastAccruedAt:NOW},venues:{terrace:{level:2}}}}},NOW),'train',{venueId:'terrace'},/director first/]
 ]){
  const original=JSON.stringify(state);await assert.rejects(act(state,action,args),pattern);assert.equal(JSON.stringify(state),original);
 }
});

test('team progression milestones pay once and unchanged manual runs keep their original payout',async()=>{
 let state=initializeHouse({balance:1_000_000,progress:{empire:{clicker:{lastAccruedAt:NOW},venues:{terrace:{level:25}}}}},NOW);
 const start=await act(state,'serve',{venueId:'terrace'});state=start.snapshot;
 state=(await act(state,'manager',{venueId:'terrace'},NOW+100)).snapshot;
 state=(await act(state,'train',{venueId:'terrace'},NOW+100)).snapshot;
 state=(await act(state,'specialist',{venueId:'terrace',role:'revenue'},NOW+100)).snapshot;
 assert.equal(state.progress.empire.clicker.venues.terrace.manualPayout,start.result.payout);
 for(const [id,amount] of [['first-training',150],['first-specialist',1000],['growth-25',2000]]){
  const claimed=await act(state,'goal',{goalId:id},NOW+100);assert.equal(claimed.result.amount,amount);state=claimed.snapshot;
  await assert.rejects(act(state,'goal',{goalId:id},NOW+100),/already/);
 }
});

test('later upgrades remain affordable within five minutes of their own income and work beyond old caps',()=>{
 for(const def of ESTATE_VENUES)for(const level of [5,6,10,25,50,100,200,400,1000,10000]){
  const state=initializeHouse({balance:1e14,progress:{empire:{clicker:{lastAccruedAt:NOW},venues:{[def.id]:{level,manager:true}}}}},NOW);
  const stats=estateSnapshot(state.progress,NOW).venues.find(v=>v.id===def.id),price=estateUpgradePrice(def,level);
  assert.ok(Number.isSafeInteger(price)&&price>0);
  assert.ok(price/(stats.autoPerMinute/60)<=301,`${def.id} Level ${level} has an excessive wait`);
  assert.ok(stats.nextIncomePerSecond>=stats.autoPerMinute/60);
 }
});

test('mature estate earnings survive unrelated House actions and old directors migrate at Rank 1',async()=>{
 const state=fixture(100);state.progress.empire.lifetimeEarned=2_000_000_000;
 const output=await reduceHouseProgression(state,{},'daily-reward',{},NOW);
 assert.equal(output.snapshot.progress.empire.lifetimeEarned,2_000_000_000);
 assert.equal(venue(output.snapshot).managerRank,1);
 assert.equal(output.snapshot.balance,1_000_250);
});

test('training never charges for zero additional production at numerical earning limits',async()=>{
 const state=fixture(10000);state.progress.empire.clicker.venues.terrace.managerRank=1001;
 assert.equal(venue(state).training.useful,false);
 await assert.rejects(act(state,'train',{venueId:'terrace'}),/full earning capacity/);
});

test('automatic reinvestment reaches every director without manual grinding or long stalled waits',()=>{
 const result=simulateEstateEconomy();
 assert.equal(result.manualCustomers,1);
 assert.ok(result.hires[0].seconds<=10);
 assert.ok(result.openings[1].seconds<=600);
 assert.equal(result.hires.length,6);
 assert.ok(result.seconds<=3600);
 assert.ok(result.longestWait<=120);
});
