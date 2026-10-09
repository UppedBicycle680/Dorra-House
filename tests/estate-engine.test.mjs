import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ESTATE_VENUES,ESTATE_TAP_INTERVAL_MS,ESTATE_RUSH_MS,normalizeEstate,estateSnapshot,estateGoals,
  accrueEstate,serveEstateCustomer,purchaseEstateVenue,upgradeEstateVenue,hireEstateManager,claimEstateIncome,claimEstateGoal
} from '../estate-engine.js';
import {estateAutoPerMinute} from '../estate-engine.js';
import {normalizeProgression,empireRate} from '../progression-engine.js';

const NOW=1_800_000_000_000;
const fresh=()=>normalizeEstate({},NOW);
const managed=(level=2)=>normalizeEstate({empire:{venues:{terrace:{level,manager:true}}}},NOW);
const near=(actual,expected,tolerance=1e-7)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} differs from ${expected}`);

test('a new $1,000 wallet can open the Terrace, serve, upgrade, hire, and unlock the valet',()=>{
  const progress=fresh();
  let balance=1_000,now=NOW;
  const opening=purchaseEstateVenue(progress,'terrace',balance,now);
  assert.equal(opening.ok,true);
  balance-=opening.cost;
  assert.equal(balance,750);
  assert.equal(estateSnapshot(progress,now).venues[0].status,'manual');
  assert.equal(estateSnapshot(progress,now).venues[1].unlocked,false);
  const first=serveEstateCustomer(progress,'terrace',now);
  balance+=first.amount;
  balance+=claimEstateGoal(progress,'first-service',now).amount;
  let upgraded=false,hired=false;
  for (let index=1;index<=140;index++) {
    now+=1_000;
    balance+=serveEstateCustomer(progress,'terrace',now).amount;
    for (const goal of estateGoals(progress).filter(goal=>goal.complete&&!goal.claimed)) balance+=claimEstateGoal(progress,goal.id,now).amount;
    if (!upgraded&&balance>=900) {
      const result=upgradeEstateVenue(progress,'terrace',balance,now);
      balance-=result.cost;
      upgraded=result.ok;
    }
    if (upgraded&&balance>=1_200) {
      const result=hireEstateManager(progress,'terrace',balance,now);
      balance-=result.cost;
      hired=result.ok;
      break;
    }
  }
  assert.equal(upgraded,true);
  assert.equal(hired,true);
  assert.ok(now-NOW<150_000,'the first automation should be reachable in a short active session');
  assert.equal(estateSnapshot(progress,now).venues[1].unlocked,true);
  assert.equal(estateSnapshot(progress,now).venues[0].autoPerMinute,216);
  assert.ok(balance>=0);
});

test('closed and unmanaged venues cannot generate idle money',()=>{
  const progress=fresh();
  assert.equal(serveEstateCustomer(progress,'terrace',NOW).ok,false);
  purchaseEstateVenue(progress,'terrace',1_000,NOW);
  assert.equal(accrueEstate(progress,NOW+86_400_000),0);
  assert.equal(progress.empire.clicker.bankMs,0);
  assert.equal(progress.empire.clicker.venues.terrace.customers,0);
  assert.equal(serveEstateCustomer(progress,'terrace',NOW+86_400_000).amount,12);
});

test('global tap cooldown survives saves and prevents alternating venue bypass',()=>{
  const progress=fresh();
  progress.empire.venues.terrace.level=2;
  purchaseEstateVenue(progress,'valet',10_000,NOW);
  assert.equal(serveEstateCustomer(progress,'terrace',NOW).ok,true);
  const restored=JSON.parse(JSON.stringify(progress));
  const denied=serveEstateCustomer(restored,'valet',NOW+ESTATE_TAP_INTERVAL_MS-1);
  assert.equal(denied.ok,false);
  assert.equal(denied.retryAfterMs,1);
  assert.equal(restored.empire.clicker.venues.valet.served,0);
  assert.equal(serveEstateCustomer(restored,'valet',NOW+ESTATE_TAP_INTERVAL_MS).ok,true);
});

test('rushes and VIP bonuses repeat deterministically without repeated-claim exploits',()=>{
  const progress=fresh();
  purchaseEstateVenue(progress,'terrace',1_000,NOW);
  let tenth,eleventh,twentyFifth;
  for (let count=1;count<=25;count++) {
    const response=serveEstateCustomer(progress,'terrace',NOW+(count-1)*500);
    assert.equal(response.ok,true);
    if (count===10) tenth=response;
    if (count===11) eleventh=response;
    if (count===25) twentyFifth=response;
  }
  assert.equal(tenth.rush,true);
  assert.equal(tenth.rushUntil,NOW+4_500+ESTATE_RUSH_MS);
  assert.equal(eleventh.amount,18);
  assert.equal(twentyFifth.vip,true);
  assert.equal(twentyFifth.amount,54);
  assert.equal(twentyFifth.vipIn,25);
  assert.equal(serveEstateCustomer(progress,'terrace',NOW+12_000).ok,false);
  assert.equal(estateSnapshot(progress,NOW+30_000).venues[0].tapValue,12);
});

test('automation earns on fractional cycles and repeated rendering never doubles income',()=>{
  const progress=managed();
  const first=estateSnapshot(progress,NOW+2_500);
  assert.equal(first.claimable,9);
  assert.equal(first.venues[0].cycleProgress,.5);
  assert.equal(first.venues[0].customers,0);
  for (let index=0;index<10;index++) assert.equal(estateSnapshot(progress,NOW+2_500).claimable,9);
  const restored=JSON.parse(JSON.stringify(progress));
  assert.equal(accrueEstate(restored,NOW+5_000),18);
  assert.equal(restored.empire.clicker.venues.terrace.customers,1);
  assert.equal(restored.empire.clicker.venues.terrace.cycleElapsedMs,0);
  assert.equal(claimEstateIncome(restored,NOW+5_000).amount,18);
  assert.equal(claimEstateIncome(restored,NOW+5_000).ok,false);
});

test('fractional dollars survive claiming, save reload, and subsequent accrual',()=>{
  const progress=managed();
  assert.equal(accrueEstate(progress,NOW+333),1);
  near(progress.empire.pending,1.1988);
  assert.equal(claimEstateIncome(progress,NOW+333).amount,1);
  near(progress.empire.pending,.1988);
  const restored=JSON.parse(JSON.stringify(progress));
  accrueEstate(restored,NOW+1_000);
  near(restored.empire.pending,2.6);
  assert.equal(claimEstateIncome(restored,NOW+1_000).amount,2);
  near(restored.empire.pending,.6);
  near(restored.empire.clicker.venues.terrace.cycleElapsedMs,1_000);
});

test('one accrual and many chunks converge across different venue cycle lengths',()=>{
  const whole=managed();
  whole.empire.venues.valet={level:3,manager:true};
  whole.empire.venues.boutique={level:2,manager:true};
  normalizeEstate(whole,NOW);
  const chunks=JSON.parse(JSON.stringify(whole));
  const elapsed=123_456;
  accrueEstate(whole,NOW+elapsed);
  for (let offset=137;offset<elapsed;offset+=137) accrueEstate(chunks,NOW+offset);
  accrueEstate(chunks,NOW+elapsed);
  near(chunks.empire.pending,whole.empire.pending);
  for (const venue of ['terrace','valet','boutique']) {
    assert.equal(chunks.empire.clicker.venues[venue].customers,whole.empire.clicker.venues[venue].customers);
    assert.equal(chunks.empire.clicker.venues[venue].cycleElapsedMs,whole.empire.clicker.venues[venue].cycleElapsedMs);
  }
});

test('the income bank stops at eight hours and claiming frees capacity once',()=>{
  const progress=managed();
  accrueEstate(progress,NOW+20*3_600_000);
  near(progress.empire.pending,18/5_000*8*3_600_000);
  assert.equal(estateSnapshot(progress,NOW+24*3_600_000).bankPercent,100);
  const amount=claimEstateIncome(progress,NOW+24*3_600_000).amount;
  assert.equal(amount,103_680);
  assert.equal(accrueEstate(progress,NOW+24*3_600_000),0);
  assert.equal(accrueEstate(progress,NOW+24*3_600_000+5_000),18);
});

test('the Level 3 hotel signature perk extends the bank to ten hours',()=>{
  const progress=managed();
  progress.empire.venues.hotel={level:3,manager:false};
  const snapshot=estateSnapshot(progress,NOW+24*3_600_000);
  assert.equal(snapshot.capHours,10);
  assert.equal(snapshot.bankHours,10);
  assert.equal(snapshot.claimable,129_600);
  assert.equal(snapshot.venues[5].autoPerMinute,0);
});

test('an upgrade settles its old income before applying its new payout',()=>{
  const progress=managed();
  const result=upgradeEstateVenue(progress,'terrace',2_200,NOW+2_500);
  assert.equal(result.ok,true);
  assert.equal(result.cost,2_200);
  near(progress.empire.pending,9);
  accrueEstate(progress,NOW+5_000);
  near(progress.empire.pending,24);
  assert.equal(progress.empire.clicker.venues.terrace.customers,1);
});

test('hiring a manager cannot retroactively pay for an unmanaged period',()=>{
  const progress=fresh();
  progress.empire.venues.terrace.level=2;
  assert.equal(hireEstateManager(progress,'terrace',1_200,NOW+3_600_000).ok,true);
  assert.equal(progress.empire.pending,0);
  assert.equal(accrueEstate(progress,NOW+3_600_000+5_000),18);
});

test('future and backwards clocks cannot create duplicate passive or manual payments',()=>{
  const progress=managed();
  accrueEstate(progress,NOW+5_000);
  assert.equal(accrueEstate(progress,NOW+2_500),18);
  assert.equal(serveEstateCustomer(progress,'terrace',NOW+2_500).ok,false);
  assert.equal(accrueEstate(progress,NOW+5_000),18);
  assert.equal(accrueEstate(progress,NOW+10_000),36);
  assert.equal(serveEstateCustomer(progress,'terrace',NOW+10_000).ok,true);
  assert.equal(serveEstateCustomer(progress,'terrace',NOW+9_000).ok,false);
});

test('legacy cash, manager purchases, venue investment, and unrelated fields survive migration',()=>{
  const entry={level:1,manager:true,focus:'yield',purchasedAt:123,staff:{service:4},improvements:{capacity:3},specialization:'artisan',custom:'kept'};
  const progress={empire:{venues:{terrace:entry},pending:1_234.75,lifetimeEarned:8_888,headquarters:{academy:2},loans:[{id:'bridge',weeks:4}],unclaimedMs:1_000},story:{index:3}};
  normalizeEstate(progress,NOW);
  assert.equal(progress.empire.venues.terrace,entry);
  assert.equal(entry.manager,true,'a purchased legacy Level 1 manager remains employed');
  assert.deepEqual(entry.staff,{service:4});
  assert.deepEqual(entry.improvements,{capacity:3});
  assert.equal(entry.specialization,'artisan');
  assert.equal(entry.custom,'kept');
  assert.deepEqual(progress.empire.loans,[{id:'bridge',weeks:4}]);
  assert.equal(progress.story.index,3);
  assert.equal(estateSnapshot(progress,NOW).totalEarned,8_888);
  assert.equal(claimEstateIncome(progress,NOW).amount,1_234);
  near(progress.empire.pending,.75);
  assert.equal(estateSnapshot(progress,NOW).venues[0].baseTapValue,16);
});

test('malformed nested data cannot produce invalid money and normalization is stable',()=>{
  const progress={empire:{pending:Infinity,venues:{terrace:{level:99,manager:true,improvements:{unknown:99}}},clicker:{lastAccruedAt:NOW,venues:{terrace:{served:-3,customers:NaN,cycleElapsedMs:Infinity}},claimedGoals:['missing','regulars','regulars']}}};
  normalizeEstate(progress,NOW);
  assert.equal(progress.empire.pending,0);
  assert.equal(progress.empire.venues.terrace.level,5);
  assert.deepEqual(progress.empire.clicker.claimedGoals,['regulars']);
  assert.equal(estateSnapshot(progress,NOW).venues[0].baseTapValue,85);
  const saved=JSON.stringify(progress);
  normalizeEstate(progress,NOW);
  assert.equal(JSON.stringify(progress),saved);
});

test('purchase commands validate wallet, unlocks, limits, and duplicate managers',()=>{
  const progress=fresh();
  assert.equal(purchaseEstateVenue(progress,'unknown',1_000,NOW).ok,false);
  assert.equal(purchaseEstateVenue(progress,'valet',10_000,NOW).ok,false);
  assert.equal(purchaseEstateVenue(progress,'terrace',249,NOW).shortfall,1);
  for (const balance of [NaN,Infinity,-1,'1000',1000.5]) assert.equal(purchaseEstateVenue(progress,'terrace',balance,NOW).ok,false);
  assert.equal(purchaseEstateVenue(progress,'terrace',1_000,NOW).ok,true);
  assert.equal(purchaseEstateVenue(progress,'terrace',1_000,NOW).ok,false);
  assert.equal(hireEstateManager(progress,'terrace',10_000,NOW).ok,false);
  upgradeEstateVenue(progress,'terrace',10_000,NOW);
  assert.equal(hireEstateManager(progress,'terrace',1_200,NOW).ok,true);
  assert.equal(hireEstateManager(progress,'terrace',10_000,NOW).ok,false);
  for (let level=2;level<5;level++) assert.equal(upgradeEstateVenue(progress,'terrace',1_000_000,NOW).ok,true);
  assert.equal(upgradeEstateVenue(progress,'terrace',1_000_000,NOW).ok,false);
});

test('milestones are claimable once, survive JSON saves, and do not change the wallet themselves',()=>{
  const progress=fresh();
  progress.wallet=1_000;
  assert.equal(claimEstateGoal(progress,'first-service',NOW).ok,false);
  purchaseEstateVenue(progress,'terrace',1_000,NOW);
  serveEstateCustomer(progress,'terrace',NOW);
  assert.equal(claimEstateGoal(progress,'first-service',NOW).amount,75);
  assert.equal(progress.wallet,1_000);
  assert.equal(claimEstateGoal(JSON.parse(JSON.stringify(progress)),'first-service',NOW).ok,false);
  assert.equal(claimEstateGoal(progress,'untrusted',NOW).ok,false);
  const goal=estateGoals(progress).find(item=>item.id==='first-service');
  assert.equal(goal.complete,true);
  assert.equal(goal.claimed,true);
});

test('all six venues expose finite action metrics and require no external casino purchase',()=>{
  const progress=fresh();
  for (const venue of ESTATE_VENUES) progress.empire.venues[venue.id]={level:5,manager:true};
  const snapshot=estateSnapshot(progress,NOW);
  assert.equal(snapshot.stars,30);
  assert.equal(snapshot.ownedCount,6);
  assert.equal(snapshot.managedCount,6);
  assert.ok(snapshot.autoPerMinute>0&&Number.isFinite(snapshot.autoPerMinute));
  for (const venue of snapshot.venues) {
    assert.equal(venue.status,'automated');
    assert.equal(venue.upgradeCost,0);
    assert.ok(venue.tapValue>0&&Number.isSafeInteger(venue.tapValue));
  }
  assert.equal(estateGoals(progress).find(goal=>goal.id==='thirty-stars').complete,true);
});

test('rate lookups and historical progression normalization cannot accrue ambient wall time',()=>{
  const at=Date.parse('2026-10-07T12:00:00Z');
  const progress={};
  normalizeProgression(progress,at);
  normalizeEstate(progress,at);
  progress.empire.venues.terrace.level=2;
  progress.empire.venues.terrace.manager=true;
  const before=structuredClone(progress);
  assert.equal(estateAutoPerMinute(progress),216);
  assert.equal(empireRate(progress),12_960);
  assert.deepEqual(progress,before,'rate displays must not settle money or alter timestamps');
  normalizeProgression(progress,at+1_000);
  assert.equal(progress.empire.pending,0,'normalization is not an income claim');
  assert.equal(progress.empire.clicker.lastAccruedAt,at);
  assert.equal(progress.empire.clicker.bankMs,0);
  assert.equal(accrueEstate(progress,at+1_000),3);
  near(progress.empire.pending,3.6);
  assert.equal(progress.empire.clicker.lastAccruedAt,at+1_000);
});
