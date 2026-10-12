import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEstate,startEstateCycle,accrueEstate,estateSnapshot,upgradeEstateVenue,hireEstateManager,estateGoals} from '../estate-engine.js';
import {normalizeProgression,businessSnapshot} from '../progression-engine.js';
import {initializeHouse,reduceHouseProgression} from '../supabase/functions/dorra-api/house-progression.mjs';
const NOW=1800000000000;
const fresh=()=>normalizeEstate({empire:{venues:{terrace:{level:1}}}},NOW);
test('manual cycles pay only after completion and cannot be restarted or paid twice',()=>{
 const p=fresh(),start=startEstateCycle(p,'terrace',NOW);assert.equal(start.amount,0);assert.equal(start.payout,12);
 assert.equal(startEstateCycle(p,'terrace',NOW+100).ok,false);
 assert.equal(accrueEstate(p,NOW+2500),0);assert.equal(estateSnapshot(p,NOW+2500).venues[0].cycleProgress,.5);
 assert.equal(accrueEstate(p,NOW+5000),12);assert.equal(accrueEstate(p,NOW+10000),12);
 assert.equal(p.empire.clicker.served,1);assert.equal(estateGoals(p).find(g=>g.id==='first-service').complete,true);
});
test('a saved manual timer finishes once on a different device',()=>{
 const p=fresh();startEstateCycle(p,'terrace',NOW);const loaded=JSON.parse(JSON.stringify(p));normalizeProgression(loaded,NOW+3000);
 assert.equal(accrueEstate(loaded,NOW+5000),12);assert.equal(accrueEstate(loaded,NOW+5000),12);
});
test('upgrading an active manual run cannot reprice its promised payout or finish early',()=>{
 const p=fresh();startEstateCycle(p,'terrace',NOW);upgradeEstateVenue(p,'terrace',10000,NOW+2000);
 assert.equal(accrueEstate(p,NOW+4999),0);assert.equal(accrueEstate(p,NOW+5000),12);
 assert.equal(startEstateCycle(p,'terrace',NOW+5000).payout,18);
});
test('manager hiring settles an in-flight manual run once alongside automatic production',()=>{
 const p=fresh();p.empire.venues.terrace.level=2;startEstateCycle(p,'terrace',NOW);hireEstateManager(p,'terrace',1200,NOW+2000);
 assert.equal(accrueEstate(p,NOW+7000),36);assert.equal(p.empire.clicker.served,1);
});
test('upgrades beyond five survive normalization and remain available at very high levels',()=>{
 for(const level of [5,25,100,1000,100000]){
  const p=fresh();p.empire.venues.terrace.level=level;p.empire.venues.terrace.manager=true;normalizeProgression(p,NOW);normalizeEstate(p,NOW);
  assert.equal(p.empire.venues.terrace.level,level);const before=estateSnapshot(p,NOW).venues[0];
  assert.ok(Number.isFinite(before.autoPerMinute)&&before.upgradeCost>0);
  assert.equal(upgradeEstateVenue(p,'terrace',9000000000000000,NOW).ok,true);assert.equal(p.empire.venues.terrace.level,level+1);
  assert.ok(Number.isFinite(businessSnapshot(p).net));
 }
});
test('level 25 boosts payout and speed, and fast managers expose a solid continuous bar',()=>{
 const p=fresh();p.empire.venues.terrace={level:24,manager:true};const before=estateSnapshot(p,NOW).venues[0];
 upgradeEstateVenue(p,'terrace',100000000,NOW);const after=estateSnapshot(p,NOW).venues[0];
 assert.ok(after.cycleMs<before.cycleMs/2);assert.ok(after.baseTapValue>before.baseTapValue*2);
 p.empire.venues.terrace.level=100;const fast=estateSnapshot(p,NOW).venues[0];assert.equal(fast.continuous,true);
 const whole=structuredClone(p),chunks=structuredClone(p);accrueEstate(whole,NOW+10000);
 for(let n=1;n<=100;n++)accrueEstate(chunks,NOW+n*100);
 assert.ok(Math.abs(whole.empire.pending-chunks.empire.pending)<.001);
});
test('bulk upgrades use authoritative total prices and reject unsupported quantities atomically',async()=>{
 const state=initializeHouse({balance:1000000,progress:{empire:{venues:{terrace:{level:5}}}}},NOW);
 const bulk=await reduceHouseProgression(structuredClone(state),{},'estate-clicker-upgrade',{venueId:'terrace',quantity:10},NOW);
 let single=structuredClone(state);for(let i=0;i<10;i++)single=(await reduceHouseProgression(single,{},'estate-clicker-upgrade',{venueId:'terrace'},NOW)).snapshot;
 assert.equal(bulk.snapshot.balance,single.balance);assert.equal(bulk.snapshot.progress.empire.venues.terrace.level,15);
 await assert.rejects(reduceHouseProgression(structuredClone(state),{},'estate-clicker-upgrade',{venueId:'terrace',quantity:1000},NOW),/supported/);
 const poor=structuredClone(state);poor.balance=1;await assert.rejects(reduceHouseProgression(structuredClone(poor),{},'estate-clicker-upgrade',{venueId:'terrace',quantity:10},NOW),/capital/);assert.equal(poor.balance,1);
});
