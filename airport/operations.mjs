import {AIRPORT_BY_ID,AIRCRAFT} from './catalog.mjs';
import {gatewayPlot} from './queensland-gateway-data.mjs';
import {
  SERVICE_PROFILES,SERVICE_BY_ID,ROUTE_STRATEGIES,STRATEGY_BY_ID,
  MAX_SPOTLIGHT_FLIGHTS,CONTRACT_ACTIVE_MS,INCIDENT_FALLBACK_MS,INCIDENT_TYPES,atcCost,flightTimings
} from './operations-catalog.mjs';

const clone=value=>structuredClone(value);
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const validInteger=(value)=>Number.isSafeInteger(value)&&value>=0;
function fail(code,message){const error=new Error(message);error.code=code;throw error;}
function hash(value){let n=2166136261;for(const c of String(value)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0||1;}
function step(value){let n=value>>>0;n^=n<<13;n^=n>>>17;n^=n<<5;return n>>>0||1;}
const nextIncidentDelay=value=>600_000+value%300_001;
const waitingPhases=new Set(['awaiting-landing','awaiting-takeoff']);
const movingPhases=new Set(['arriving','departing']);
const phaseNames=new Set([...waitingPhases,...movingPhases,'servicing','taxiing-out']);
const aircraftIds=new Set(AIRCRAFT.map(aircraft=>aircraft.id));
const MAX_SAVED_AMOUNT=9_000_000_000_000;
const MAX_BNE_ROUTE_PROBES=4;
const BNE_PROBE_INTERVAL_MS=5_000;
const savedId=value=>typeof value==='string'&&value.length>0&&value.length<=160;
const savedAmount=value=>validInteger(value)&&value<=MAX_SAVED_AMOUNT;
const savedDuration=value=>Number.isSafeInteger(value)&&value>0&&value<=86_400_000;
function invalidOperations(){fail('INVALID_CAREER','The saved airport operations could not be verified. Progress has not been reset.');}

function validateOperations(airport){
  const op=airport.operations;
  if(!validInteger(op.spawnCursor)||!validInteger(op.spawnCandidateOffset)||op.spawnCandidateOffset>AIRCRAFT.length||
    !validInteger(op.nextSpawnProbeAt)||
    !validInteger(op.contractCounter)||!validInteger(op.contractsClaimed)||
    !validInteger(op.incidentCounter)||!Number.isSafeInteger(op.eventRng)||op.eventRng<1||op.eventRng>0xffffffff||
    op.eventRemainingMs>900_000||op.atcEnabled&&!op.atcOwned||
    !['completedFlights','bonusCash','incidentResponses'].every(key=>validInteger(op.stats[key])))invalidOperations();
  const gates=new Map(),plots=new Set();
  for(const gate of airport.gates){
    if(!savedId(gate.id)||!savedId(gate.plotId)||gates.has(gate.id)||plots.has(gate.plotId))invalidOperations();
    gates.set(gate.id,gate);plots.add(gate.plotId);
  }
  const ids=new Set(),flightGates=new Set(),physicalStands=new Set();
  for(const flight of op.flights){
    const gate=gates.get(flight.gateId),waiting=waitingPhases.has(flight.phase);
    if(!savedId(flight.id)||ids.has(flight.id)||!gate||flight.plotId!==gate.plotId||flightGates.has(flight.gateId)||
      !aircraftIds.has(flight.aircraftId)||flight.aircraft?.id!==flight.aircraftId||
      !own(SERVICE_BY_ID,flight.serviceId)||!own(STRATEGY_BY_ID,flight.strategy)||
      !savedAmount(flight.normalIncome)||!savedAmount(flight.bonus)||flight.bonus!==Math.floor(flight.normalIncome/4)||
      !savedDuration(flight.serviceDurationMs)||!flight.timings||
      !['arrivalMs','taxiOutMs','departureMs'].every(key=>savedDuration(flight.timings[key]))||
      !validInteger(flight.createdAt)||flight.createdAt>flight.phaseStartedAt||typeof flight.prioritised!=='boolean'||
      flight.runwayId!==runwayFor(airport,gate)||waiting&&flight.phaseEndsAt!==null||
      !waiting&&(!validInteger(flight.phaseEndsAt)||flight.phaseEndsAt<=flight.phaseStartedAt))invalidOperations();
    if(own(flight,'pausedAt')){
      if(movingPhases.has(flight.phase)||!validInteger(flight.pausedAt)||flight.pausedAt<flight.phaseStartedAt||
        flight.phaseEndsAt===null&&flight.pausedRemainingMs!==null||flight.phaseEndsAt!==null&&
        (!validInteger(flight.pausedRemainingMs)||flight.pausedAt>flight.phaseEndsAt||flight.pausedRemainingMs!==flight.phaseEndsAt-flight.pausedAt))invalidOperations();
    }else if(own(flight,'pausedRemainingMs'))invalidOperations();
    if(flight.physicalStandId!==undefined){
      if(!savedId(flight.physicalStandId)||physicalStands.has(flight.physicalStandId))invalidOperations();physicalStands.add(flight.physicalStandId);
    }
    ids.add(flight.id);flightGates.add(flight.gateId);
  }
  if(op.priorityFlightId!==null&&!op.flights.some(flight=>flight.id===op.priorityFlightId&&flight.phase==='servicing'&&flight.prioritised))invalidOperations();
  if(op.contract!==null){
    const contract=op.contract;
    const definitions={'flight-round':{metric:'flights',target:5},'service-round':{metric:'service',target:3},'priority-round':{metric:'priority',target:3}};
    const definition=definitions[contract.offerId];
    if(!definition||!savedId(contract.id)||contract.metric!==definition.metric||contract.target!==definition.target||
      !validInteger(contract.progress)||contract.progress>contract.target||
      !['active','completed','expired'].includes(contract.status)||typeof contract.timed!=='boolean'||
      !validInteger(contract.acceptedAt)||!contract.reward||!savedAmount(contract.reward.cash)||!savedAmount(contract.reward.research)||
      contract.timed&&(!validInteger(contract.remainingMs)||contract.remainingMs>CONTRACT_ACTIVE_MS)||
      !contract.timed&&contract.remainingMs!==null||contract.metric==='service'&&!own(SERVICE_BY_ID,contract.serviceId)||
      contract.status==='completed'&&(contract.progress!==contract.target||!validInteger(contract.completedAt)||contract.completedAt<contract.acceptedAt)||
      contract.status==='expired'&&(!contract.timed||contract.remainingMs!==0))invalidOperations();
  }
  if(op.incident!==null){
    const incident=op.incident,gate=gates.get(incident.gateId);
    if(!savedId(incident.id)||!gate||incident.plotId!==gate.plotId||!INCIDENT_TYPES.some(type=>type.type===incident.type)||
      !validInteger(incident.startedAt)||!validInteger(incident.resolvesAt)||incident.resolvesAt<incident.startedAt||
      incident.resolvesAt-incident.startedAt>INCIDENT_FALLBACK_MS||!savedDuration(incident.responseMs)||
      typeof incident.responding!=='boolean'||incident.responding&&(!validInteger(incident.responseStartedAt)||
        incident.responseStartedAt<incident.startedAt||incident.responseStartedAt>incident.resolvesAt))invalidOperations();
  }
}

/** Additive migration. Call on a cloned career; existing financial state is untouched. */
export function ensureOperations(career){
  if(!own(career,'presence'))career.presence=null;
  if(career.presence&&(!own(career.airports,career.presence.airportId)||!validInteger(career.presence.expiresAt)))fail('INVALID_CAREER','The saved airport presence is invalid.');
  for(const airport of Object.values(career.airports)){
    if(!own(airport,'operations')){
      const eventRng=hash(`${airport.seed}:operations-events`);
      airport.operations={version:1,atcOwned:false,atcEnabled:false,flights:[],flightCounter:0,spawnCursor:0,spawnCandidateOffset:0,nextSpawnProbeAt:0,
        contract:null,contractCounter:0,contractsClaimed:0,incident:null,incidentCounter:0,eventRng,
        eventRemainingMs:nextIncidentDelay(eventRng),cashRemainder:0,priorityFlightId:null,
        stats:{completedFlights:0,bonusCash:0,incidentResponses:0}};
    }
    const op=airport.operations;
    if(op&&typeof op==='object'){
      if(!own(op,'spawnCandidateOffset'))op.spawnCandidateOffset=0;
      if(!own(op,'nextSpawnProbeAt'))op.nextSpawnProbeAt=0;
    }
    if(!op||op.version!==1||!Array.isArray(op.flights)||op.flights.length>MAX_SPOTLIGHT_FLIGHTS||
      typeof op.atcOwned!=='boolean'||typeof op.atcEnabled!=='boolean'||!validInteger(op.eventRemainingMs)||
      !validInteger(op.flightCounter)||!validInteger(op.cashRemainder)||op.cashRemainder>3||!op.stats)fail('INVALID_CAREER','The saved airport operations are invalid.');
    for(const flight of op.flights){
      if(!flight||typeof flight.id!=='string'||!phaseNames.has(flight.phase)||!validInteger(flight.phaseStartedAt)||
        flight.phaseEndsAt!==null&&!validInteger(flight.phaseEndsAt))fail('INVALID_CAREER','The saved interactive flight is invalid.');
    }
    for(const gate of airport.gates){
      if(!own(gate,'serviceId'))gate.serviceId='generic';
      if(!own(gate,'serviceStrategy'))gate.serviceStrategy='standard';
      if(!own(gate,'currentServiceId'))gate.currentServiceId='generic';
      if(!own(gate,'currentServiceStrategy'))gate.currentServiceStrategy='standard';
      if(!own(gate,'cashRemainder'))gate.cashRemainder=0;
      if(!validInteger(gate.cashRemainder)||gate.cashRemainder>3)fail('INVALID_CAREER','The saved airport cash remainder is invalid.');
      if(!own(SERVICE_BY_ID,gate.serviceId)||!own(SERVICE_BY_ID,gate.currentServiceId)||
        !own(STRATEGY_BY_ID,gate.serviceStrategy)||!own(STRATEGY_BY_ID,gate.currentServiceStrategy))fail('INVALID_CAREER','The saved airline service is invalid.');
    }
    validateOperations(airport);
  }
  return career;
}

export function isPresent(career,airport,at){return career.presence?.airportId===airport.id&&career.selectedAirportId===airport.id&&career.presence.expiresAt>at;}
export function automated(airport){return airport.operations.atcOwned&&airport.operations.atcEnabled;}
export function operatingFactor(career,airport,at){return airport.operations.atcOwned||isPresent(career,airport,at)?1:.75;}
export function serviceAircraft(aircraft,serviceId='generic'){
  const profile=SERVICE_BY_ID[serviceId];
  return profile?aircraft.filter(plane=>!profile.aircraftIds||profile.aircraftIds.includes(plane.id)):[];
}
export function serviceMetadata(serviceId){return SERVICE_BY_ID[serviceId]||SERVICE_BY_ID.generic;}
export function strategyMetadata(strategy='standard'){return STRATEGY_BY_ID[strategy]||STRATEGY_BY_ID.standard;}
export function gateBlocked(airport,gateId,at){return !!airport.operations.incident&&airport.operations.incident.gateId===gateId&&airport.operations.incident.startedAt<=at&&airport.operations.incident.resolvesAt>at;}
export function baselineCash(career,airport,amount,at,gate){
  if(operatingFactor(career,airport,at)===1)return amount;
  const units=amount*3+gate.cashRemainder;
  gate.cashRemainder=units%4;
  return Math.floor(units/4);
}

function runwayFor(airport,gate){return airport.id==='granite-plains'?gatewayPlot(gate.plotId)?.precinct.runway||'main':'main';}
function phase(flight,name,at,duration=null){flight.phase=name;flight.phaseStartedAt=at;flight.phaseEndsAt=duration===null?null:at+duration;delete flight.pausedAt;delete flight.pausedRemainingMs;}
function pauseFlight(flight,at){
  if(flight.pausedAt!==undefined||movingPhases.has(flight.phase))return;
  flight.pausedAt=at;flight.pausedRemainingMs=flight.phaseEndsAt===null?null:Math.max(0,flight.phaseEndsAt-at);
}
function resumeFlight(flight,at){
  if(flight.pausedAt===undefined)return;
  const shift=Math.max(0,at-flight.pausedAt);flight.phaseStartedAt+=shift;
  if(flight.phaseEndsAt!==null)flight.phaseEndsAt=at+flight.pausedRemainingMs;
  delete flight.pausedAt;delete flight.pausedRemainingMs;
}
function compatibleFlight(airport,flight,tools){const gate=airport.gates.find(item=>item.id===flight.gateId);return !!gate&&tools.eligible(airport,gate).some(plane=>plane.id===flight.aircraftId)&&(!tools.routeAllowed||tools.routeAllowed(airport,gate,flight.aircraft,flight));}
function blockedReason(airport,flight,at,tools){
  if(gateBlocked(airport,flight.gateId,at))return 'This stand is temporarily closed. Send the response crew.';
  const gate=airport.gates.find(item=>item.id===flight.gateId);
  if(!gate||!tools.eligible(airport,gate).some(plane=>plane.id===flight.aircraftId))return 'Reactivate this aircraft stand before continuing the flight.';
  if(tools.routeAllowed&&!tools.routeAllowed(airport,gate,flight.aircraft,flight))return 'The taxi route is blocked. Change the adjacent stand configuration before continuing.';
  return '';
}
function runwayFree(airport,flight){return !airport.operations.flights.some(other=>other.id!==flight.id&&other.runwayId===flight.runwayId&&movingPhases.has(other.phase));}
function clearFlight(airport,flight,at,tools){
  if(blockedReason(airport,flight,at,tools)||!runwayFree(airport,flight))return false;
  if(flight.phase==='awaiting-landing')phase(flight,'arriving',at,flight.timings.arrivalMs);
  else if(flight.phase==='awaiting-takeoff')phase(flight,'departing',at,flight.timings.departureMs);
  else return false;
  return true;
}

function spawnFlights(career,airport,at,tools){
  if(!isPresent(career,airport,at))return;
  if(airport.operations.flights.length>=MAX_SPOTLIGHT_FLIGHTS)return;
  if(airport.id==='brisbane'){
    if(airport.operations.nextSpawnProbeAt>at)return;
    airport.operations.nextSpawnProbeAt=at+BNE_PROBE_INTERVAL_MS;
  }
  const op=airport.operations,used=new Set(op.flights.map(flight=>flight.gateId));
  const physical=new Set(op.flights.map(flight=>flight.physicalStandId).filter(Boolean));
  const gates=[...airport.gates].sort((a,b)=>a.id.localeCompare(b.id,'en',{numeric:true}));
  if(!gates.length)return;
  const firstIndex=op.spawnCursor%gates.length;
  let probes=0;
  for(let offset=0;offset<gates.length&&op.flights.length<MAX_SPOTLIGHT_FLIGHTS;offset++){
    const index=(firstIndex+offset)%gates.length,gate=gates[index];
    const candidateOffset=offset===0?op.spawnCandidateOffset:0;
    // Even closed or unreachable stands advance the scan. A cold crowded BNE
    // airport continues this bounded search on later polls instead of blocking.
    op.spawnCursor=(index+1)%gates.length;op.spawnCandidateOffset=0;
    if(used.has(gate.id)||gateBlocked(airport,gate.id,at))continue;
    const possible=serviceAircraft(tools.eligible(airport,gate),gate.serviceId);
    if(!possible.length)continue;
    const start=(op.flightCounter+hash(`${airport.seed}:${gate.id}:spotlight`))%possible.length;
    let aircraft,plan,routePlan,physicalStandId;
    for(let attempt=Math.min(candidateOffset,possible.length);attempt<possible.length;attempt++){
      if(airport.id==='brisbane'&&probes>=MAX_BNE_ROUTE_PROBES){
        op.spawnCursor=index;op.spawnCandidateOffset=attempt;return;
      }
      probes++;
      const candidate=possible[(start+attempt)%possible.length];
      const route=tools.routePlan?.(airport,gate,candidate);
      // A supplied plan has already passed its authoritative geometry check.
      // Avoid running the same expensive clearance compilation a second time.
      if(tools.routePlan?(!route||route.routeAvailable===false||route.supported===false):
        tools.routeAllowed&&!tools.routeAllowed(airport,gate,candidate))continue;
      const standId=`${airport.id}:${route?.stand?.referenceStand??gate.plotId}`;
      if(physical.has(standId))continue;
      const quote=tools.plan(airport,{...gate,currentAircraftId:candidate.id,currentServiceId:gate.serviceId,currentServiceStrategy:gate.serviceStrategy});
      if(quote){aircraft=candidate;plan=quote;routePlan=route;physicalStandId=standId;break;}
    }
    if(!plan)continue;
    const service=serviceMetadata(gate.serviceId),id=`${airport.id}:flight-${++op.flightCounter}`;
    op.flights.push({id,gateId:gate.id,plotId:gate.plotId,aircraftId:aircraft.id,aircraft:clone(aircraft),
      airline:service.airline,destination:service.destination,serviceId:gate.serviceId,strategy:gate.serviceStrategy,
      normalIncome:plan.income,bonus:Math.floor(plan.income/4),serviceDurationMs:Math.max(15_000,plan.intervalMs),
      timings:flightTimings(airport.id),runwayId:runwayFor(airport,gate),phase:'awaiting-landing',
      routePlan:routePlan?clone(routePlan):null,physicalStandId,
      phaseStartedAt:at,phaseEndsAt:null,createdAt:at,prioritised:false});
    used.add(gate.id);physical.add(physicalStandId);
  }
}

function offersFor(airport,tools){
  const op=airport.operations,flights=op.flights;
  const eligible=airport.gates.flatMap(gate=>serviceAircraft(tools.eligible(airport,gate),gate.serviceId)
    .map(aircraft=>({gate,aircraft,income:tools.plan(airport,{...gate,currentAircraftId:aircraft.id,currentServiceId:gate.serviceId,currentServiceStrategy:gate.serviceStrategy})?.income||0})));
  const chosen=flights.find(flight=>flight.serviceId!=='generic')?.serviceId||eligible.find(item=>item.gate.serviceId!=='generic')?.gate.serviceId||'generic';
  const income=flights.length?Math.floor(flights.reduce((sum,flight)=>sum+flight.normalIncome,0)/flights.length):eligible.length?Math.floor(eligible.reduce((sum,item)=>sum+item.income,0)/eligible.length):8;
  const serviceIncome=flights.filter(flight=>flight.serviceId===chosen).map(flight=>flight.normalIncome);
  const routeIncome=serviceIncome.length?Math.floor(serviceIncome.reduce((a,b)=>a+b,0)/serviceIncome.length):income;
  return [
    {id:'flight-round',title:'Keep the airport moving',description:'Complete five interactive flights after accepting.',target:5,metric:'flights',reward:{cash:Math.floor(5*income*.5),research:20}},
    {id:'service-round',title:`${serviceMetadata(chosen).name} connections`,description:`Complete three interactive ${serviceMetadata(chosen).name.toLowerCase()} flights.`,target:3,metric:'service',serviceId:chosen,reward:{cash:Math.floor(3*routeIncome*.5),research:20}},
    {id:'priority-round',title:'Priority turnaround',description:'Complete three interactive flights after prioritising their service.',target:3,metric:'priority',reward:{cash:Math.floor(3*income*.5),research:20}}
  ];
}

function completeFlight(career,airport,flight,at,tools,earnings){
  const op=airport.operations,multiplier=airport.boost&&at<airport.boost.endsAt?airport.boost.multiplier:1;
  const cash=tools.addCash(airport,flight.bonus*multiplier);
  op.stats.completedFlights++;op.stats.bonusCash+=cash;airport.stats.lifetimeCash+=cash;
  if(earnings){earnings.cash+=cash;earnings.bonusCash=(earnings.bonusCash||0)+cash;}
  const contract=op.contract;
  if(contract?.status==='active'&&at>=contract.acceptedAt&&
    (contract.metric==='flights'||contract.metric==='service'&&flight.serviceId===contract.serviceId||contract.metric==='priority'&&flight.prioritised)){
    contract.progress=Math.min(contract.target,contract.progress+1);
    if(contract.progress>=contract.target){contract.status='completed';contract.completedAt=at;}
  }
  op.flights=op.flights.filter(item=>item.id!==flight.id);
  if(op.priorityFlightId===flight.id)op.priorityFlightId=null;
}

/** Resolve only authoritative timestamp boundaries, independent of poll frequency. */
export function processOperationsAt(career,airport,at,tools,earnings){
  const op=airport.operations;
  if(op.incident&&op.incident.resolvesAt<=at){
    const gateId=op.incident.gateId;op.incident=null;
    for(const flight of op.flights.filter(flight=>flight.gateId===gateId))resumeFlight(flight,at);
  }
  if(op.contract?.status==='active'&&op.contract.timed&&op.contract.remainingMs<=0){op.contract.status='expired';op.contract.expiredAt=at;}
  for(const flight of [...op.flights].sort((a,b)=>(a.phaseEndsAt??Infinity)-(b.phaseEndsAt??Infinity)||a.id.localeCompare(b.id))){
    if(flight.pausedAt!==undefined||flight.phaseEndsAt===null||flight.phaseEndsAt>at)continue;
    if(flight.phase==='arriving')phase(flight,'servicing',at,flight.serviceDurationMs);
    else if(flight.phase==='servicing'){
      if(op.priorityFlightId===flight.id)op.priorityFlightId=null;
      phase(flight,'taxiing-out',at,flight.timings.taxiOutMs);
    }else if(flight.phase==='taxiing-out')phase(flight,'awaiting-takeoff',at);
    else if(flight.phase==='departing'){completeFlight(career,airport,flight,at,tools,earnings);continue;}
    if(gateBlocked(airport,flight.gateId,at)||!compatibleFlight(airport,flight,tools))pauseFlight(flight,at);
  }
  if(isPresent(career,airport,at)&&!op.incident&&op.eventRemainingMs<=0){
    const available=airport.gates.filter(gate=>tools.eligible(airport,gate).length);
    if(available.length){
      op.eventRng=step(op.eventRng);const gate=available[op.eventRng%available.length];
      op.eventRng=step(op.eventRng);const definition=INCIDENT_TYPES[op.eventRng%INCIDENT_TYPES.length];
      op.incident={id:`${airport.id}:incident-${++op.incidentCounter}`,...clone(definition),gateId:gate.id,plotId:gate.plotId,
        startedAt:at,resolvesAt:at+INCIDENT_FALLBACK_MS,responding:false,responseStartedAt:null};
      op.eventRng=step(op.eventRng);op.eventRemainingMs=nextIncidentDelay(op.eventRng);
      for(const flight of op.flights.filter(flight=>flight.gateId===gate.id))pauseFlight(flight,at);
    }
  }
  for(const flight of op.flights){
    if(!movingPhases.has(flight.phase)&&blockedReason(airport,flight,at,tools))pauseFlight(flight,at);
    else if(flight.pausedAt!==undefined&&!blockedReason(airport,flight,at,tools))resumeFlight(flight,at);
  }
  spawnFlights(career,airport,at,tools);
  if(automated(airport)){
    const ready=op.flights.filter(flight=>waitingPhases.has(flight.phase)).sort((a,b)=>
      (a.phase==='awaiting-takeoff'?0:1)-(b.phase==='awaiting-takeoff'?0:1)||a.phaseStartedAt-b.phaseStartedAt||a.id.localeCompare(b.id));
    for(const flight of ready)clearFlight(airport,flight,at,tools);
  }
}

export function advanceOperations(career,airport,start,end){
  if(!isPresent(career,airport,start))return;
  const op=airport.operations,duration=end-start;
  if(!op.incident)op.eventRemainingMs=Math.max(0,op.eventRemainingMs-duration);
  if(op.contract?.status==='active'&&op.contract.timed)op.contract.remainingMs=Math.max(0,op.contract.remainingMs-duration);
}

export function nextOperationsBoundary(career,airport,cursor,limit,tools){
  const op=airport.operations,boundaries=[];
  if(career.presence?.airportId===airport.id&&career.presence.expiresAt>cursor)boundaries.push(career.presence.expiresAt);
  if(op.incident?.resolvesAt>cursor)boundaries.push(op.incident.resolvesAt);
  for(const flight of op.flights)if(flight.pausedAt===undefined&&flight.phaseEndsAt>cursor)boundaries.push(flight.phaseEndsAt);
  if(isPresent(career,airport,cursor)){
    if(airport.id==='brisbane'&&op.flights.length<MAX_SPOTLIGHT_FLIGHTS&&op.nextSpawnProbeAt>cursor)boundaries.push(op.nextSpawnProbeAt);
    if(!op.incident&&op.eventRemainingMs>0&&airport.gates.some(gate=>tools.eligible(airport,gate).length))boundaries.push(cursor+op.eventRemainingMs);
    if(op.contract?.status==='active'&&op.contract.timed&&op.contract.remainingMs>0)boundaries.push(cursor+op.contract.remainingMs);
  }
  return Math.min(limit,...boundaries);
}

export function applyOperationsCommand(career,airport,command,at,tools){
  const op=airport.operations;
  if(['land-flight','takeoff-flight','prioritise-flight'].includes(command.type)){
    const flight=op.flights.find(item=>item.id===command.flightId);
    if(!flight)fail('UNKNOWN_FLIGHT','That interactive flight has already finished or is unavailable.');
    if(!isPresent(career,airport,at))fail('AIRPORT_NOT_ACTIVE','Visit this airport to manage its interactive flights.');
    const reason=blockedReason(airport,flight,at,tools);if(reason)fail('FLIGHT_BLOCKED',reason);
    if(command.type==='prioritise-flight'){
      if(flight.phase!=='servicing'||flight.prioritised||op.priorityFlightId)fail('PRIORITY_UNAVAILABLE','Prioritise one servicing flight at a time. The crew remains assigned until its service ends.');
      const remaining=Math.max(0,flight.phaseEndsAt-at);
      flight.phaseEndsAt=at+Math.max(1,Math.ceil(remaining*.8));flight.prioritised=true;op.priorityFlightId=flight.id;
    }else{
      const expected=command.type==='land-flight'?'awaiting-landing':'awaiting-takeoff';
      if(flight.phase!==expected)fail('FLIGHT_NOT_READY','Wait until this flight is ready for that clearance.');
      if(!clearFlight(airport,flight,at,tools))fail('RUNWAY_BUSY','The runway is occupied. Wait for the current movement to finish.');
    }
    return true;
  }
  if(command.type==='hire-atc'){
    if(op.atcOwned)fail('ALREADY_OWNED','ATC staff are already hired at this airport.');
    const cost=atcCost(AIRPORT_BY_ID[airport.id].order);
    if(airport.cash<cost)fail('INSUFFICIENT_CASH','There is not enough airport cash to hire ATC.');
    airport.cash-=cost;op.atcOwned=true;op.atcEnabled=true;
  }else if(command.type==='set-atc'){
    if(!op.atcOwned||typeof command.enabled!=='boolean')fail('INVALID_ATC','Hire ATC, then choose whether automatic clearance is enabled.');
    op.atcEnabled=command.enabled;
  }else if(['set-service','apply-service'].includes(command.type)){
    if(typeof command.serviceId!=='string'||!own(SERVICE_BY_ID,command.serviceId))fail('UNKNOWN_SERVICE','Choose a listed airline service.');
    const strategy=command.strategy??'standard';
    if(typeof strategy!=='string'||!own(STRATEGY_BY_ID,strategy))fail('UNKNOWN_STRATEGY','Choose frequent, standard or premium service.');
    const eligible=airport.gates.filter(gate=>serviceAircraft(tools.eligible(airport,gate),command.serviceId).length);
    if(command.type==='set-service'){
      const gate=airport.gates.find(item=>item.id===command.gateId);
      if(!gate)fail('UNKNOWN_GATE','Choose an owned stand.');
      if(!eligible.includes(gate))fail('SERVICE_UNAVAILABLE','This stand does not meet this service’s aircraft requirements.');
      gate.serviceId=command.serviceId;gate.serviceStrategy=strategy;
    }else{
      if(!eligible.length)fail('SERVICE_UNAVAILABLE','Upgrade an active stand to meet this service’s aircraft requirements.');
      for(const gate of eligible){gate.serviceId=command.serviceId;gate.serviceStrategy=strategy;}
    }
  }else if(command.type==='accept-contract'){
    if(op.contract)fail('CONTRACT_ACTIVE','Claim or abandon the current contract before accepting another.');
    if(typeof command.timed!=='boolean')fail('INVALID_CONTRACT','Choose a timed or no-deadline contract.');
    const offer=offersFor(airport,tools).find(item=>item.id===command.offerId);
    if(!offer)fail('UNKNOWN_CONTRACT','Choose one of the offered contracts.');
    op.contract={...clone(offer),id:`${airport.id}:contract-${++op.contractCounter}`,offerId:offer.id,acceptedAt:at,
      timed:command.timed,remainingMs:command.timed?CONTRACT_ACTIVE_MS:null,progress:0,status:'active'};
  }else if(command.type==='claim-contract'){
    if(op.contract?.status!=='completed')fail('CONTRACT_INCOMPLETE','Complete this contract before collecting its reward.');
    tools.addCash(airport,op.contract.reward.cash);tools.addResearch(airport,op.contract.reward.research);op.contractsClaimed++;op.contract=null;
  }else if(command.type==='abandon-contract'){
    if(!op.contract)fail('UNKNOWN_CONTRACT','There is no contract to abandon.');op.contract=null;
  }else if(command.type==='respond-incident'){
    if(!op.incident||op.incident.id!==command.incidentId)fail('UNKNOWN_INCIDENT','That incident has already cleared.');
    if(op.incident.responding)fail('RESPONSE_UNDERWAY','The response crew is already on its way.');
    op.incident.responding=true;op.incident.responseStartedAt=at;
    op.incident.resolvesAt=Math.min(op.incident.resolvesAt,at+op.incident.responseMs);op.stats.incidentResponses++;
  }else return false;
  processOperationsAt(career,airport,at,tools);
  return true;
}

export function projectOperations(career,airport,at,tools){
  const op=airport.operations,present=isPresent(career,airport,at),cost=atcCost(AIRPORT_BY_ID[airport.id].order);
  const services=SERVICE_PROFILES.map(profile=>{
    const possible=airport.gates.flatMap(gate=>serviceAircraft(tools.eligible(airport,gate),profile.id).map(aircraft=>({gate,aircraft,
      plan:tools.plan(airport,{...gate,currentAircraftId:aircraft.id,currentServiceId:profile.id,currentServiceStrategy:'standard'})})));
    const incomes=possible.map(item=>item.plan?.income||0),intervals=possible.map(item=>item.plan?.intervalMs||0);
    return {...clone(profile),title:profile.name,eligibleGateIds:[...new Set(possible.map(item=>item.gate.id))],
      cost:0,cashCost:0,affordable:true,available:possible.length>0,
      unavailableReason:possible.length?'':'No active stand meets this service’s aircraft requirements.',
      incomeRange:{min:incomes.length?Math.min(...incomes):0,max:incomes.length?Math.max(...incomes):0},
      intervalRangeMs:{min:intervals.length?Math.min(...intervals):0,max:intervals.length?Math.max(...intervals):0}};
  });
  const flights=op.flights.map(flight=>{
    const reason=blockedReason(airport,flight,at,tools),free=runwayFree(airport,flight),time=flight.pausedAt??at;
    const progress=flight.phase==='servicing'?Math.max(0,Math.min(1,(time-flight.phaseStartedAt)/Math.max(1,(flight.phaseEndsAt??time)-flight.phaseStartedAt))):0;
    return {...clone(flight),serviceProgress:progress,blockedReason:reason||(!free&&waitingPhases.has(flight.phase)?'The runway is occupied.':''),
      canLand:present&&!reason&&free&&flight.phase==='awaiting-landing',
      canTakeoff:present&&!reason&&free&&flight.phase==='awaiting-takeoff',
      canPrioritise:present&&!reason&&flight.phase==='servicing'&&!flight.prioritised&&!op.priorityFlightId};
  });
  return {atc:{owned:op.atcOwned,enabled:op.atcEnabled,cost,cashCost:cost,affordable:airport.cash>=cost},flights,
    contractOffers:offersFor(airport,tools),contract:clone(op.contract),
    incident:op.incident?{...clone(op.incident),canRespond:!op.incident.responding}:null,
    services,strategies:clone(ROUTE_STRATEGIES),completedFlights:op.stats.completedFlights,bonusCash:op.stats.bonusCash,
    contractsClaimed:op.contractsClaimed,present,operatingFactor:operatingFactor(career,airport,at),
    routeSearchPending:airport.id==='brisbane'&&present&&op.nextSpawnProbeAt>at&&op.flights.length<MAX_SPOTLIGHT_FLIGHTS};
}
