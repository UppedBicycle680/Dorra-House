import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {AIRPORT_BY_ID,AIRCRAFT,RUNWAY_LENGTHS} from './airport/catalog.mjs';
import {OPERATIONS_ROUTES,OPERATIONS_ROUTE_VERSION} from './airport/operations-route-manifest.mjs';
import {operationRoute,operationRouteAllowed,operationRouteReference} from './airport/operations-routing.mjs';
import {getAirportLayout} from './airport/layouts.mjs';
import {resolveInteractiveFlightPlan,sampleInteractiveFlight,roundedPath} from './airport/traffic.mjs';
import {AIRCRAFT_MODELS} from './airport/aircraft-models.mjs';
import {AIRCRAFT_DIMENSIONS} from './airport/aircraft-dimensions.mjs';
import {clearBrisbaneRoute} from './airport/brisbane-route-clearance.mjs';
import {OPERATIONS_ROUTE_SOURCES} from './airport/operations-route-manifest.mjs';
import {operationsRouteSourceHashes} from './scripts/operations-route-inputs.mjs';

const aircraftById=Object.fromEntries(AIRCRAFT.map(a=>[a.id,a]));
const fixture=(key)=>{
  const [airportId,plotId,aircraftId,length]=key.split(':'),meta=AIRPORT_BY_ID[airportId],gate={id:'gate-1',plotId,active:true};
  const runwayLength=length==='fixed'?meta.maxRunwayLength:Number(length);
  return {airport:{...meta,buildings:{runwayLength:RUNWAY_LENGTHS.indexOf(runwayLength)+1},gates:[gate]},gate,aircraft:aircraftById[aircraftId]};
};

test('every compiled route validates only its exact trusted snapshot',()=>{
  assert.match(OPERATIONS_ROUTE_VERSION,/^[a-f0-9]{16}$/);
  assert.ok(Object.keys(OPERATIONS_ROUTES).length>5000,'all layouts must be compiled before delivery');
  for(const key of Object.keys(OPERATIONS_ROUTES)){
    const {airport,gate,aircraft}=fixture(key),route=operationRoute(airport,gate,aircraft);
    assert.ok(route,key);assert.ok(operationRouteAllowed(airport,gate,aircraft,{routePlan:route}),key);
    assert.ok(operationRouteReference(route),key);
    assert.equal(operationRouteAllowed(airport,gate,aircraft,{routePlan:{...route,ref:route.ref+'forged'}}),false,key);
    assert.equal(operationRouteAllowed(airport,gate,aircraft,{routePlan:{...route,runwayId:'other'}}),false,key);
    assert.equal(operationRouteReference({...route,runwayLength:Infinity}),null,key);
  }
  assert.equal(operationRoute(null,null,null),null);
});

test('Brisbane blocker sets recheck live operating gates without changing flight geometry',()=>{
  const key=Object.keys(OPERATIONS_ROUTES).find(k=>k.startsWith('brisbane:')&&OPERATIONS_ROUTES[k][2].length);
  assert.ok(key,'compiled Brisbane routes include neighbour clearance requirements');
  const {airport,gate,aircraft}=fixture(key),route=operationRoute(airport,gate,aircraft),blocker=OPERATIONS_ROUTES[key][2][0];
  airport.gates.push({id:'blocked-neighbour',plotId:blocker,active:true});
  const live={plan:()=>({aircraft})};
  assert.equal(operationRoute(airport,gate,aircraft,live),null);
  assert.equal(operationRouteAllowed(airport,gate,aircraft,{routePlan:route},live),false);
  airport.gates[1].active=false;
  assert.equal(operationRouteAllowed(airport,gate,aircraft,{routePlan:route},live),true);
  airport.gates[1].active=true;
  assert.equal(operationRouteAllowed(airport,gate,aircraft,{routePlan:route},{plan:()=>null}),true);
});

test('compact snapshots reconstruct authored routes for all seven airports and survive upgrades',()=>{
  for(const meta of Object.values(AIRPORT_BY_ID)){
    const key=Object.keys(OPERATIONS_ROUTES).find(k=>k.startsWith(meta.id+':'));
    assert.ok(key,meta.id);
    const {airport,gate,aircraft}=fixture(key),route=operationRoute(airport,gate,aircraft),layout=getAirportLayout(meta.id),stand=layout.stands.find(s=>s.plotId===gate.plotId);
    airport.buildings.runwayLength=RUNWAY_LENGTHS.indexOf(meta.maxRunwayLength)+1;
    const view={...meta,runwayLength:meta.maxRunwayLength,gates:[gate]},model={id:aircraft.id,...AIRCRAFT_DIMENSIONS[aircraft.id]},plan=resolveInteractiveFlightPlan(layout,view,stand,model,route);
    assert.ok(plan,meta.id);assert.equal(plan.runway.id,route.runwayId);assert.equal(plan.stand.referenceStand??gate.plotId,route.stand.referenceStand);
    assert.equal(operationRouteAllowed(airport,gate,aircraft,{routePlan:route}),true);
    for(const phase of ['awaiting-landing','arriving','servicing','taxiing-out','awaiting-takeoff','departing']){
      const pose=sampleInteractiveFlight(plan,{phase,phaseStartedAt:1000,phaseEndsAt:11000},6000,false);
      for(const value of [pose.x,pose.y,pose.heading,pose.altitude])assert.ok(Number.isFinite(value),`${meta.id} ${phase}`);
    }
    if(meta.id==='brisbane')assert.equal(clearBrisbaneRoute(layout,{...view,gates:[]},plan.stand,AIRCRAFT_MODELS[aircraft.id],plan,roundedPath),true);
  }
});

test('legacy full paths and malformed tokens cannot bypass generated route authority',()=>{
  const key=Object.keys(OPERATIONS_ROUTES)[0],{airport,gate,aircraft}=fixture(key),route=operationRoute(airport,gate,aircraft);
  for(const plan of [{supported:true}, {...route,version:2},{...route,plotId:'plot-9999'},{...route,aircraftId:'unknown'},{...route,stand:{referenceStand:'unknown'}}])
    assert.equal(operationRouteAllowed(airport,gate,aircraft,{routePlan:plan}),false);
});

test('authoritative routing imports contain no layout, traffic or mesh modules',async()=>{
  const source=await readFile(new URL('./airport/operations-routing.mjs',import.meta.url),'utf8');
  const imports=[...source.matchAll(/from '([^']+)'/g)].map(m=>m[1]);
  assert.deepEqual(imports,['./catalog.mjs','./operations-route-manifest.mjs']);
});

test('trusted manifest fingerprints all current transitive geometry inputs',async()=>{
  assert.deepEqual(OPERATIONS_ROUTE_SOURCES,await operationsRouteSourceHashes());
  for(const name of ['brisbane-bays','brisbane-parking-source','brisbane-logistics-source','gold-coast-bays','queensland-gateway-data'])
    assert.ok(OPERATIONS_ROUTE_SOURCES[`airport/${name}.mjs`],name);
});
