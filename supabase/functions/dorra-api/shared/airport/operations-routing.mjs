import {AIRPORT_BY_ID,RUNWAY_LENGTHS} from './catalog.mjs';
import {OPERATIONS_ROUTES,OPERATIONS_ROUTE_VERSION} from './operations-route-manifest.mjs';

const fixedAirports=new Set(['archerfield','granite-plains','hamilton-island','sunshine-coast','gold-coast']);
const keyFor=(airportId,plotId,aircraftId,length)=>[airportId,plotId,aircraftId,fixedAirports.has(airportId)?'fixed':length].join(':');
const token=key=>`${OPERATIONS_ROUTE_VERSION}:${key}`;
function runwayLength(airport){
  return Array.isArray(airport?.buildings)?airport.runwayLength:RUNWAY_LENGTHS[airport?.buildings?.runwayLength-1];
}
function occupied(airport,gate,blockers,tools){
  if(!blockers.length)return false;
  const blocked=new Set(blockers);
  return (airport.gates||[]).some(other=>other.plotId!==gate.plotId&&other.active!==false&&blocked.has(other.plotId)&&
    (tools?.plan?!!tools.plan(airport,other):other.status!=='waiting'));
}
function snapshot(airport,gate,aircraft,length,entry,key){
  return {version:1,ref:token(key),airportId:airport.id,plotId:gate.plotId,aircraftId:aircraft.id,
    runwayLength:length,runwayId:entry[0],stand:{referenceStand:entry[1]},supported:true};
}

/** Only trusted, generated route keys can start server-controlled movement.
 * The catalog/hardware eligibility check remains the engine's responsibility.
 * No authored paths, client geometry, layout modules or meshes enter this API. */
export function operationRoute(airport,gate,aircraft,tools=null){
  const meta=AIRPORT_BY_ID[airport?.id],length=runwayLength(airport);
  if(!meta||!gate||!aircraft||!RUNWAY_LENGTHS.includes(length)||length>meta.maxRunwayLength||length<aircraft.runwayLength)return null;
  const key=keyFor(airport.id,gate.plotId,aircraft.id,length),entry=OPERATIONS_ROUTES[key];
  if(!entry||occupied(airport,gate,entry[2],tools))return null;
  return snapshot(airport,gate,aircraft,length,entry,key);
}

export function operationRouteAllowed(airport,gate,aircraft,flight=null,tools=null){
  if(!flight?.routePlan)return !!operationRoute(airport,gate,aircraft,tools);
  const plan=flight.routePlan,meta=AIRPORT_BY_ID[airport?.id];
  // Full legacy plans fail closed at future clearances. Moving phases retain
  // their original snapshot and finish; they are never stopped in the air.
  if(!meta||!gate||!aircraft||plan.version!==1||!RUNWAY_LENGTHS.includes(plan.runwayLength)||plan.runwayLength>meta.maxRunwayLength||plan.runwayLength<aircraft.runwayLength)return false;
  const key=keyFor(airport.id,gate.plotId,aircraft.id,plan.runwayLength),entry=OPERATIONS_ROUTES[key];
  return !!entry&&plan.ref===token(key)&&plan.airportId===airport.id&&plan.plotId===gate.plotId&&plan.aircraftId===aircraft.id&&
    plan.runwayId===entry[0]&&plan.stand?.referenceStand===entry[1]&&!occupied(airport,gate,entry[2],tools);
}

/** Presentation may resolve this verified ref into its authored local geometry.
 * Server callers use only operationRoute/operationRouteAllowed above. */
export function operationRouteReference(plan){
  if(plan?.version!==1||typeof plan.ref!=='string'||!plan.ref.startsWith(`${OPERATIONS_ROUTE_VERSION}:`))return null;
  const meta=AIRPORT_BY_ID[plan.airportId];if(!meta||!RUNWAY_LENGTHS.includes(plan.runwayLength)||plan.runwayLength>meta.maxRunwayLength)return null;
  const key=keyFor(plan.airportId,plan.plotId,plan.aircraftId,plan.runwayLength),entry=OPERATIONS_ROUTES[key];
  if(!entry||plan.ref!==token(key)||plan.runwayId!==entry[0]||plan.stand?.referenceStand!==entry[1])return null;
  return {airportId:plan.airportId,plotId:plan.plotId,aircraftId:plan.aircraftId,runwayLength:plan.runwayLength};
}
