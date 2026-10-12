import test from 'node:test';
import assert from 'node:assert/strict';
import {reduceAirport} from '../supabase/functions/dorra-api/airport.mjs';
import {createCareer,applyCommand,AIRPORTS} from '../airport/engine.mjs';

const START=1_800_000_000_000;
const wallet=()=>({balance:1000,progress:{owned:[]}});
const airport=state=>state.privateState.airport.airports[state.privateState.airport.selectedAirportId];
const view=state=>state.result.view.selectedAirport;
const load=(state,at,presenceAirportId=null)=>reduceAirport(state?.snapshot||wallet(),state?.privateState||{},'load',{presenceAirportId},at);
const command=(state,input,at)=>reduceAirport(state.snapshot,state.privateState,'command',{
  expectedRevision:state.result.view.revision,command:input
},at);

async function completeFlight(state,at,{priority=false}={}){
  state=await load(state,at,'redcliffe');
  const flight=view(state).operations.flights.find(f=>f.canLand);
  assert.ok(flight);
  state=await command(state,{type:'land-flight',flightId:flight.id},at);
  at=airport(state).operations.flights.find(f=>f.id===flight.id).phaseEndsAt;
  state=await load(state,at,'redcliffe');
  if(priority)state=await command(state,{type:'prioritise-flight',flightId:flight.id},at);
  while(airport(state).operations.flights.find(f=>f.id===flight.id).phase!=='awaiting-takeoff'){
    at=airport(state).operations.flights.find(f=>f.id===flight.id).phaseEndsAt;
    state=await load(state,at,'redcliffe');
  }
  state=await command(state,{type:'takeoff-flight',flightId:flight.id},at);
  at=airport(state).operations.flights.find(f=>f.id===flight.id).phaseEndsAt;
  state=await load(state,at,'redcliffe');
  return {state,at,id:flight.id};
}

test('cloud presence is owned, selected, server timed and never accepts a supplied expiry',async()=>{
  const state=await load(null,START,'redcliffe');
  assert.deepEqual(state.privateState.airport.presence,{airportId:'redcliffe',expiresAt:START+15000});
  assert.equal(view(state).operations.flights.length,1);
  for(const id of ['brisbane','__proto__',123,{}])await assert.rejects(load(state,START,id));
  for(const payload of [{presenceAirportId:'redcliffe',expiresAt:START+864e5},{presence:{airportId:'redcliffe'}},{presenceAirportId:'redcliffe',now:START+864e5}]){
    await assert.rejects(reduceAirport(state.snapshot,state.privateState,'load',payload,START),{code:'INVALID_ARGUMENTS'});
  }
  const stopped=await load(state,START,null);
  assert.equal(stopped.privateState.airport.presence,null);
  assert.equal(stopped.result.view.revision,state.result.view.revision+1);
  assert.deepEqual(state.privateState.airport.presence,{airportId:'redcliffe',expiresAt:START+15000});
});

test('cloud same-time presence loads invalidate old airport decisions',async()=>{
  const state=await load(null,START);
  const present=await load(state,START,'redcliffe');
  await assert.rejects(command({...present,result:state.result},{type:'hire-atc'},START),{code:'STALE_REVISION'});
  const staffed=await command(present,{type:'hire-atc'},START);
  assert.equal(airport(staffed).cash,250);
  await assert.rejects(command(staffed,{type:'hire-atc'},START),{code:'ALREADY_OWNED'});
});

test('cloud selected-airport switching clears presence and does not extend the old lease',async()=>{
  let career=createCareer(START,37);career.diamonds=100000;
  career=applyCommand(career,{type:'unlock-airport',airportId:AIRPORTS[1].id,useDiamonds:true},START);
  let state=await reduceAirport(wallet(),{airport:career},'load',{presenceAirportId:career.selectedAirportId},START);
  state=await command(state,{type:'select-airport',airportId:'redcliffe'},START+5000);
  assert.equal(state.privateState.airport.presence,null);
  await assert.rejects(load(state,START+5000,AIRPORTS[1].id),{code:'AIRPORT_NOT_SELECTED'});
  state=await load(state,START+5000,'redcliffe');
  assert.equal(state.privateState.airport.presence.airportId,'redcliffe');
});

test('cloud polling and resume retain cash discount, ordinary research and diamond accounting',async()=>{
  const initial=await load(null,START,'redcliffe');
  const absent=await load(initial,START+90000);
  let present=initial;
  for(let at=START+5000;at<=START+90000;at+=5000)present=await load(present,at,'redcliffe');
  assert.equal(airport(absent).cash-500,6);
  assert.equal(airport(present).cash-500,8);
  assert.equal(airport(absent).research,airport(present).research);
  assert.equal(airport(absent).stats.departures,airport(present).stats.departures);
  assert.equal(absent.privateState.airport.diamonds,present.privateState.airport.diamonds);
  const resumed=await load({...absent,privateState:JSON.parse(JSON.stringify(absent.privateState))},START+180000);
  assert.equal(airport(resumed).cash,512);
});

test('online interactive completion earns only a separate bonus and cannot be repeated',async()=>{
  let state=await load(null,START,'redcliffe');
  const completed=await completeFlight(state,START,{priority:true});state=completed.state;
  assert.equal(airport(state).operations.stats.completedFlights,1);
  assert.equal(airport(state).operations.stats.bonusCash,2);
  assert.equal(airport(state).operations.priorityFlightId,null);
  await assert.rejects(command(state,{type:'takeoff-flight',flightId:completed.id},completed.at),{code:'UNKNOWN_FLIGHT'});
  const same=await load(state,completed.at,'redcliffe');
  assert.equal(airport(same).cash,airport(state).cash);
  assert.equal(airport(same).operations.stats.completedFlights,1);
});

test('cloud contracts preserve acceptance, active deadlines and exactly-once rewards',async()=>{
  let state=await load(null,START,'redcliffe');
  state=await command(state,{type:'accept-contract',offerId:'priority-round',timed:true},START);
  state=await load(state,START+5000);
  const remaining=airport(state).operations.contract.remainingMs;
  state=await load(state,START+3600000);
  assert.equal(airport(state).operations.contract.remainingMs,remaining);
  let at=START+3600000;
  for(let i=0;i<3;i++)({state,at}=await completeFlight(state,at,{priority:true}));
  assert.equal(airport(state).operations.contract.status,'completed');
  const beforeCash=airport(state).cash,beforeResearch=airport(state).research,reward=airport(state).operations.contract.reward;
  state=await command(state,{type:'claim-contract'},at);
  assert.equal(airport(state).cash,beforeCash+reward.cash);
  assert.equal(airport(state).research,beforeResearch+20);
  await assert.rejects(command(state,{type:'claim-contract'},at),{code:'CONTRACT_INCOMPLETE'});
});

test('cloud projection hides event RNG, gate RNG, seeds and lease-storage state',async()=>{
  const state=await load(null,START,'redcliffe');
  assert.doesNotMatch(JSON.stringify(state.result),/"(?:seed|rngState|eventRng|privateState|presence)"/);
  assert.ok(airport(state).operations.eventRng>0);
});

test('online reducer migration preserves old balances and unrelated mode state',async()=>{
  const legacy=createCareer(START,29);
  delete legacy.presence;delete legacy.airports.redcliffe.operations;
  for(const gate of legacy.airports.redcliffe.gates)for(const key of ['serviceId','serviceStrategy','currentServiceId','currentServiceStrategy','cashRemainder'])delete gate[key];
  const original=structuredClone(legacy);
  const state=await reduceAirport(wallet(),{airport:legacy,other:{keep:true}},'load',{},START);
  assert.equal(airport(state).cash,500);assert.equal(state.privateState.airport.diamonds,20);
  assert.equal(airport(state).operations.atcOwned,false);assert.deepEqual(state.privateState.other,{keep:true});
  assert.deepEqual(legacy,original);
});
