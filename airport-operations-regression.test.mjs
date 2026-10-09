import test from 'node:test';
import assert from 'node:assert/strict';
import {createCareer,settleCareer,renewPresence,applyCommand,projectCareer,OFFLINE_CAP_MS} from './airport/engine.mjs';
import {AIRPORTS,AIRCRAFT} from './airport/catalog.mjs';
import {ensureOperations,processOperationsAt,nextOperationsBoundary} from './airport/operations.mjs';

const START=1_000_000;
const selected=career=>career.airports[career.selectedAirportId];
function visible(career,at){return renewPresence(settleCareer(career,at).career,career.selectedAirportId,at);}
function view(career){return projectCareer(career,career.lastSettledAt).selectedAirport;}
function moreGates(career,count=4){
  const airport=selected(career),template=airport.gates[0];
  for(let i=2;i<=count;i++)airport.gates.push({...structuredClone(template),id:`gate-${i}`,plotId:`plot-${i}`,rngState:i});
  return career;
}
function completeOne(career,{prioritise=false}={}){
  let at=career.lastSettledAt;
  career=visible(career,at);
  let flight=view(career).operations.flights.find(item=>item.phase==='awaiting-landing');
  assert.ok(flight);
  const id=flight.id;
  career=applyCommand(career,{type:'land-flight',flightId:id},at);
  at=selected(career).operations.flights.find(item=>item.id===id).phaseEndsAt;
  career=visible(career,at);
  if(prioritise)career=applyCommand(career,{type:'prioritise-flight',flightId:id},at);
  for(let i=0;i<3;i++){
    flight=selected(career).operations.flights.find(item=>item.id===id);
    if(flight.phase==='awaiting-takeoff')break;
    assert.ok(flight.phaseEndsAt>at);
    at=flight.phaseEndsAt;career=visible(career,at);
  }
  assert.equal(selected(career).operations.flights.find(item=>item.id===id).phase,'awaiting-takeoff');
  career=applyCommand(career,{type:'takeoff-flight',flightId:id},at);
  at=selected(career).operations.flights.find(item=>item.id===id).phaseEndsAt;
  return visible(career,at);
}

test('zero-elapsed legacy migration and projection preserve balances, progress and input',()=>{
  const legacy=createCareer(START,41);
  delete legacy.presence;delete selected(legacy).operations;
  for(const gate of selected(legacy).gates)for(const key of ['serviceId','serviceStrategy','currentServiceId','currentServiceStrategy','cashRemainder'])delete gate[key];
  selected(legacy).gates[0].progressMs=12345;
  const original=structuredClone(legacy),projection=projectCareer(legacy,START);
  assert.deepEqual(legacy,original);assert.equal(projection.selectedAirport.operations.flights.length,0);
  const migrated=settleCareer(legacy,START).career;
  assert.equal(selected(migrated).cash,selected(legacy).cash);
  assert.equal(selected(migrated).gates[0].progressMs,12345);
  assert.equal(migrated.version,1);assert.equal(selected(migrated).operations.atcOwned,false);
});

test('cash-only unattended factor keeps research, departure and diamond accounting intact',()=>{
  const absent=settleCareer(createCareer(START,7),START+900_000).career;
  let staffed=createCareer(START,7);selected(staffed).cash=1000;
  staffed=applyCommand(staffed,{type:'hire-atc'},START);
  const grantAfterPurchase=selected(staffed).cash;
  staffed=settleCareer(staffed,START+900_000).career;
  assert.equal(selected(absent).cash-500,(selected(staffed).cash-grantAfterPurchase)*.75);
  assert.equal(selected(absent).research,selected(staffed).research);
  assert.deepEqual(selected(absent).stats.aircraftDepartures,selected(staffed).stats.aircraftDepartures);
  assert.equal(absent.diamonds,staffed.diamonds);
  assert.equal(view(staffed).rates.unattendedCashPerHour,view(staffed).rates.fullCashPerHour);
});

test('per-gate integer remainders and ledgers are identical under split catch-up',()=>{
  const initial=moreGates(createCareer(START,17));
  selected(initial).buildings.runwayLength=2;
  let split=structuredClone(initial);
  for(const delta of [43000,77000,162000,201000,379000,530000])split=settleCareer(split,START+delta).career;
  const whole=settleCareer(initial,START+530000).career;
  assert.deepEqual(split,whole);
});

test('at most three independent spotlights, manual clearance and bonuses do not duplicate normal stats',()=>{
  let career=renewPresence(moreGates(createCareer(START,9)), 'redcliffe',START);
  assert.equal(view(career).operations.flights.length,3);
  const first=view(career).operations.flights[0];
  career=applyCommand(career,{type:'land-flight',flightId:first.id},START);
  const next=view(career).operations.flights.find(flight=>flight.id!==first.id);
  assert.equal(next.canLand,false);
  assert.throws(()=>applyCommand(career,{type:'land-flight',flightId:next.id},START),{code:'RUNWAY_BUSY'});
  let single=createCareer(START,8);single=completeOne(single);
  const bonus=selected(single).operations.stats.bonusCash;
  assert.equal(bonus,2);assert.equal(selected(single).operations.stats.completedFlights,1);
  const baseline=settleCareer(createCareer(START,8),single.lastSettledAt).career;
  assert.equal(selected(single).stats.departures,selected(baseline).stats.departures);
  assert.equal(single.diamonds,baseline.diamonds);
  const completeId='redcliffe:flight-1';
  assert.throws(()=>applyCommand(single,{type:'takeoff-flight',flightId:completeId},single.lastSettledAt),{code:'UNKNOWN_FLIGHT'});
});

test('service strategy changes next baseline flight and snapshots spotlight quotes',()=>{
  let career=visible(createCareer(START,22),START);
  const original=view(career).operations.flights[0];
  career=applyCommand(career,{type:'set-service',gateId:'gate-1',serviceId:'training',strategy:'premium'},START);
  let gate=view(career).gates[0];
  assert.equal(gate.currentServiceId,'generic');assert.equal(gate.serviceId,'training');
  assert.equal(gate.serviceDurationMs,90_000);
  assert.equal(view(career).operations.flights[0].normalIncome,original.normalIncome);
  career=settleCareer(career,START+90_000).career;
  gate=view(career).gates[0];assert.equal(gate.currentServiceId,'training');assert.equal(gate.currentServiceStrategy,'premium');
  assert.equal(gate.serviceDurationMs,121_500);
  assert.throws(()=>applyCommand(career,{type:'set-service',gateId:'gate-1',serviceId:'emirates'},career.lastSettledAt),{code:'SERVICE_UNAVAILABLE'});
  assert.throws(()=>applyCommand(career,{type:'set-service',gateId:'gate-1',serviceId:'training',strategy:'forged'},career.lastSettledAt),{code:'UNKNOWN_STRATEGY'});
});

test('projection eligibility and quotes refresh after stand or infrastructure changes',()=>{
  const career=createCareer(START,23),airport=selected(career);
  airport.id='brisbane';career.airports={brisbane:airport};career.selectedAirportId='brisbane';
  const original=structuredClone(career),first=view(career);
  assert.deepEqual(career,original);
  const training=projection=>projection.operations.services.find(service=>service.id==='training');
  assert.deepEqual(training(first).eligibleGateIds,['gate-1']);
  assert.equal(training(first).incomeRange.min,8);

  airport.gates[0].active=false;
  const closed=view(career);
  assert.deepEqual(training(closed).eligibleGateIds,[]);
  assert.equal(closed.gates[0].active,false);
  assert.equal(closed.rates.fullCashPerHour,0);

  airport.gates[0].active=true;airport.buildings.terminal=2;
  const upgraded=view(career);
  assert.deepEqual(training(upgraded).eligibleGateIds,['gate-1']);
  assert.equal(training(upgraded).incomeRange.min,9);
  assert.ok(upgraded.rates.fullCashPerHour>first.rates.fullCashPerHour);
  assert.equal(training(first).incomeRange.min,8,'the previous projection keeps its original quote');
});

test('crowded Brisbane route searches stay bounded and resume after persistence',()=>{
  let career=moreGates(createCareer(START,24),10),airport=selected(career);
  airport.id='brisbane';career.airports={brisbane:airport};career.selectedAirportId='brisbane';
  career.presence={airportId:'brisbane',expiresAt:START+120_000};
  // Lexical order would inspect gate-10 before gate-2.
  airport.gates.sort((a,b)=>a.id.localeCompare(b.id));
  const checked=[],possible=AIRCRAFT.slice(0,4),tools={
    eligible:()=>possible,
    routePlan:(_airport,gate,aircraft)=>{checked.push(`${gate.id}:${aircraft.id}`);return null;},
    plan:(_airport,gate)=>({aircraft:AIRCRAFT.find(item=>item.id===gate.currentAircraftId),income:8,intervalMs:15_000})
  };
  processOperationsAt(career,airport,START,tools);
  assert.equal(checked.length,4);
  assert.equal(airport.operations.spawnCursor,1);
  assert.equal(airport.operations.flights.length,0);
  assert.equal(nextOperationsBoundary(career,airport,START,START+30_000,tools),START+5_000);
  processOperationsAt(career,airport,START+1,tools);
  assert.equal(checked.length,4,'extra polls do not consume the next authoritative probe window');
  assert.equal(view(career).operations.routeSearchPending,true);

  career=ensureOperations(structuredClone(career));airport=selected(career);
  const before=checked.length;
  processOperationsAt(career,airport,START+5_000,tools);
  assert.equal(checked.length-before,4);
  assert.equal(checked[before].split(':')[0],'gate-2');
  for(let window=2;window<10;window++){
    const start=checked.length;
    processOperationsAt(career,airport,START+window*5_000,tools);
    assert.equal(checked.length-start,4);
  }
  assert.equal(new Set(checked.slice(0,40)).size,40,'all candidates are visited before the scan wraps');

  tools.routePlan=(_airport,gate,aircraft)=>{checked.push(`${gate.id}:${aircraft.id}`);
    return {stand:{referenceStand:gate.plotId},routeAvailable:false,supported:true};};
  const blockedAt=checked.length;
  processOperationsAt(career,airport,START+50_000,tools);
  assert.ok(checked.length-blockedAt<=4);
  assert.equal(airport.operations.flights.length,0,'blocked geometry never creates an interactive flight');

  tools.routePlan=(_airport,gate,aircraft)=>{checked.push(`${gate.id}:${aircraft.id}`);
    return {stand:{referenceStand:gate.plotId},routeAvailable:true,supported:true};};
  processOperationsAt(career,airport,START+55_000,tools);
  assert.equal(airport.operations.flights.length,3);
  assert.equal(new Set(airport.operations.flights.map(flight=>flight.physicalStandId)).size,3);
  assert.equal(view(career).operations.routeSearchPending,false);

  airport.operations.flights=[];airport.operations.spawnCursor=0;airport.operations.spawnCandidateOffset=0;
  checked.length=0;tools.eligible=()=>AIRCRAFT;
  tools.routePlan=(_airport,gate,aircraft)=>{checked.push(`${gate.id}:${aircraft.id}`);return null;};
  processOperationsAt(career,airport,START+60_000,tools);
  assert.equal(checked.length,4);
  assert.equal(airport.operations.spawnCursor,0);
  assert.equal(airport.operations.spawnCandidateOffset,4);
  career=ensureOperations(structuredClone(career));airport=selected(career);
  processOperationsAt(career,airport,START+65_000,tools);
  assert.equal(checked.length,8);
  assert.equal(new Set(checked).size,8,
    'a partial candidate scan resumes without rechecking its first aircraft');
});

test('one priority crew accelerates remaining service only once',()=>{
  let career=renewPresence(moreGates(createCareer(START,3),2),'redcliffe',START);
  let first=view(career).operations.flights[0];
  career=applyCommand(career,{type:'land-flight',flightId:first.id},START);
  career=visible(career,first.phaseStartedAt+32_000);
  const end=selected(career).operations.flights.find(flight=>flight.id===first.id).phaseEndsAt;
  career=applyCommand(career,{type:'prioritise-flight',flightId:first.id},career.lastSettledAt);
  assert.equal(selected(career).operations.flights.find(flight=>flight.id===first.id).phaseEndsAt-career.lastSettledAt,(end-career.lastSettledAt)*.8);
  assert.throws(()=>applyCommand(career,{type:'prioritise-flight',flightId:first.id},career.lastSettledAt),{code:'PRIORITY_UNAVAILABLE'});
});

test('three contract offers, timed clock pauses away, qualifying priority progress and exactly-once claim',()=>{
  let career=visible(createCareer(START,19),START);
  assert.equal(view(career).operations.contractOffers.length,3);
  career=applyCommand(career,{type:'accept-contract',offerId:'priority-round',timed:true},START);
  career=settleCareer(career,START+60_000).career;
  assert.equal(selected(career).operations.contract.remainingMs,900_000-15_000);
  for(let i=0;i<3;i++)career=completeOne(career,{prioritise:true});
  const contract=view(career).operations.contract;
  assert.equal(contract.status,'completed');assert.equal(contract.progress,3);
  const before={cash:selected(career).cash,research:selected(career).research};
  career=applyCommand(career,{type:'claim-contract'},career.lastSettledAt);
  assert.equal(selected(career).cash,before.cash+contract.reward.cash);
  assert.equal(selected(career).research,before.research+20);
  assert.throws(()=>applyCommand(career,{type:'claim-contract'},career.lastSettledAt),{code:'CONTRACT_INCOMPLETE'});
});

test('fire pauses only its gate and service, dispatch resumes saved progress, fallback clears',()=>{
  let career=renewPresence(moreGates(createCareer(START,6),2),'redcliffe',START);
  const first=view(career).operations.flights[0];
  career=applyCommand(career,{type:'land-flight',flightId:first.id},START);
  career=visible(career,START+32_000);
  const airport=selected(career),trigger=career.lastSettledAt;
  airport.operations.incident={id:'test-fire',type:'fire',title:'Fire',gateId:first.gateId,plotId:first.plotId,
    startedAt:trigger,resolvesAt:trigger+300_000,responding:false,responseStartedAt:null,responseMs:60_000};
  career=renewPresence(career,'redcliffe',trigger);
  const progress=selected(career).gates.find(gate=>gate.id===first.gateId).progressMs;
  const flight=selected(career).operations.flights.find(flight=>flight.id===first.id),remaining=flight.pausedRemainingMs;
  career=applyCommand(career,{type:'respond-incident',incidentId:'test-fire'},trigger);
  career=settleCareer(career,trigger+60_000).career;
  assert.equal(selected(career).operations.incident,null);
  assert.equal(selected(career).gates.find(gate=>gate.id===first.gateId).progressMs,progress);
  assert.equal(selected(career).operations.flights.find(flight=>flight.id===first.id).phaseEndsAt,trigger+60_000+remaining);
  assert.ok(selected(career).gates.find(gate=>gate.id!==first.gateId).departures>0);
  selected(career).operations.incident={id:'fallback',type:'fire',gateId:first.gateId,plotId:first.plotId,startedAt:career.lastSettledAt,
    resolvesAt:career.lastSettledAt+300_000,responding:false,responseMs:60_000};
  career=settleCareer(career,career.lastSettledAt+OFFLINE_CAP_MS+1000).career;
  assert.equal(selected(career).operations.incident,null);
});

test('active event scheduling, ATC lifecycle and fire recovery are invariant under settlement partitioning',()=>{
  let initial=moreGates(createCareer(START,64),3);
  selected(initial).cash=10_000;
  initial=applyCommand(initial,{type:'hire-atc'},START);
  initial=renewPresence(initial,'redcliffe',START);
  // A fixed long lease isolates settlement partitioning from heartbeat renewal.
  initial.presence.expiresAt=START+1_500_000;
  let split=structuredClone(initial);
  for(let delta=7000;delta<1_100_000;delta+=7000)split=settleCareer(split,START+delta).career;
  split=settleCareer(split,START+1_100_000).career;
  const whole=settleCareer(initial,START+1_100_000).career;
  assert.deepEqual(split,whole);
  assert.ok(selected(whole).operations.incidentCounter>=1);
  assert.ok(selected(whole).operations.stats.completedFlights>0);
});

test('all airport layouts expose valid compatible spotlight plans and unavailable airline choices',()=>{
  for(const meta of AIRPORTS){
    let career=createCareer(START,11);
    const source=structuredClone(selected(career));source.id=meta.id;source.seed=meta.order+11;source.cash=1_000_000;
    career.airports={[meta.id]:source};career.selectedAirportId=meta.id;
    career=renewPresence(career,meta.id,START);
    const airport=view(career);
    assert.equal(airport.operations.contractOffers.length,3);
    assert.ok(airport.operations.flights.length>0,`${meta.id} has a compatible opening flight`);
    assert.ok(airport.operations.services.some(service=>service.id==='training'));
    for(const flight of airport.operations.flights){assert.ok(flight.routePlan);assert.notEqual(flight.routePlan.supported,false);assert.notEqual(flight.routePlan.routeAvailable,false);}
  }
});

test('malformed saved flights cannot duplicate completions or credit negative rewards',()=>{
  const initial=renewPresence(createCareer(START,5),'redcliffe',START);
  const invalidCases=[
    career=>{selected(career).operations.flights[0].bonus=-1000;},
    career=>{const flight=selected(career).operations.flights[0];selected(career).operations.flights.push(structuredClone(flight));},
    career=>{selected(career).operations.flights[0].normalIncome=-1;},
    career=>{selected(career).operations.flights[0].timings.arrivalMs=0;},
    career=>{selected(career).operations.flights[0].gateId='not-owned';},
    career=>{selected(career).operations.stats.bonusCash=-1;}
  ];
  for(const corrupt of invalidCases){
    const career=structuredClone(initial),flight=selected(career).operations.flights[0];
    flight.phase='departing';flight.phaseEndsAt=START+flight.timings.departureMs;
    corrupt(career);const original=structuredClone(career);
    assert.throws(()=>settleCareer(career,START+20_000),{code:'INVALID_CAREER'});
    assert.deepEqual(career,original,'a rejected save is never modified');
  }
});

test('ATC finishes existing spotlights away without spawning an offline queue',()=>{
  let career=renewPresence(moreGates(createCareer(START,2),3),'redcliffe',START);
  career=applyCommand(career,{type:'hire-atc'},START);
  career=applyCommand(career,{type:'accept-contract',offerId:'service-round',timed:true},START);
  career=settleCareer(career,START+600_000).career;
  assert.equal(selected(career).operations.stats.completedFlights,3);
  assert.equal(selected(career).operations.flights.length,0);
  assert.equal(selected(career).operations.incidentCounter,0);
  assert.equal(selected(career).operations.contract.status,'completed','away ATC completions still count');
});

test('timed contracts expire after selected active time and charge no penalty',()=>{
  let career=renewPresence(createCareer(START,38),'redcliffe',START);
  career=applyCommand(career,{type:'accept-contract',offerId:'flight-round',timed:true},START);
  career.presence.expiresAt=START+1_000_000;
  career=settleCareer(career,START+900_000).career;
  assert.equal(selected(career).operations.contract.status,'expired');
  const cash=selected(career).cash,research=selected(career).research;
  career=applyCommand(career,{type:'abandon-contract'},career.lastSettledAt);
  assert.equal(selected(career).cash,cash);assert.equal(selected(career).research,research);
});
