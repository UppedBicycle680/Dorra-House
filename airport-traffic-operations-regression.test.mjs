import test from 'node:test';
import assert from 'node:assert/strict';
import {AIRPORTS, RUNWAY_LENGTHS} from './airport/catalog.mjs';
import {createCareer, renewPresence, settleCareer, projectCareer} from './airport/engine.mjs';
import {getAirportLayout} from './airport/layouts.mjs';
import {createFlightPlan, sampleInteractiveFlight} from './airport/traffic.mjs';
import {AIRCRAFT_MODELS} from './airport/aircraft-models.mjs';

const START = 1_800_000_000_000;
const close = (actual, expected) => assert.ok(Math.abs(actual-expected) < 1e-6, `${actual} differs from ${expected}`);

function airportView(meta) {
  let career = createCareer(START, 8);
  const airport = structuredClone(career.airports.redcliffe);
  airport.id = meta.id;
  airport.buildings = {runwaySurface:5,runwayLength:RUNWAY_LENGTHS.indexOf(meta.maxRunwayLength)+1,
    taxiway:5,handling:5,terminal:5,tower:5,researchLab:5,cargo:5};
  career.airports[meta.id] = airport;
  career.selectedAirportId = meta.id;
  career = renewPresence(career, meta.id, START);
  career = settleCareer(career, START+1).career;
  return projectCareer(career, START+1).selectedAirport;
}

for (const meta of AIRPORTS) {
  test(`${meta.name}: server phase interpolation is finite, bounded and continuous`, () => {
    const airport = airportView(meta), layout = getAirportLayout(meta.id);
    const flight = airport.operations.flights[0];
    assert.ok(flight, 'The initial compatible stand must support an interactive flight');
    const stand = layout.stands.find(s => s.plotId === flight.plotId);
    const plan = flight.routePlan || createFlightPlan(layout, airport, stand, AIRCRAFT_MODELS[flight.aircraftId]);
    const phases = ['awaiting-landing','arriving','servicing','taxiing-out','awaiting-takeoff','departing'];
    for (const phase of phases) {
      const state = {...flight,phase,phaseStartedAt:START,phaseEndsAt:START+40_000};
      for (const now of [START-1000,START,START+20_000,START+40_000,START+100_000]) {
        const pose = sampleInteractiveFlight(plan,state,now);
        for (const key of ['x','y','heading','altitude','opacity','phaseProgress']) assert.ok(Number.isFinite(pose[key]), `${phase}: ${key}`);
        assert.ok(pose.phaseProgress >= 0 && pose.phaseProgress <= 1);
        const reduced = sampleInteractiveFlight(plan,state,now,true);
        assert.ok(Number.isFinite(reduced.x) && Number.isFinite(reduced.y));
      }
      assert.deepEqual(sampleInteractiveFlight(plan,state,START+40_000),sampleInteractiveFlight(plan,state,START+100_000), 'Late polling must hold the confirmed endpoint');
      const frozen = {...state,pausedAt:START+10_000};
      assert.deepEqual(sampleInteractiveFlight(plan,frozen,START+15_000),sampleInteractiveFlight(plan,frozen,START+100_000), 'Incident service must remain frozen');
    }
    const endArrival = sampleInteractiveFlight(plan,{...flight,phase:'arriving',phaseStartedAt:START,phaseEndsAt:START+40_000},START+40_000);
    const service = sampleInteractiveFlight(plan,{...flight,phase:'servicing',phaseStartedAt:START+40_000,phaseEndsAt:START+80_000},START+40_000);
    close(endArrival.x,service.x); close(endArrival.y,service.y); close(endArrival.heading,service.heading);
    const endTaxi = sampleInteractiveFlight(plan,{...flight,phase:'taxiing-out',phaseStartedAt:START,phaseEndsAt:START+40_000},START+40_000);
    const hold = sampleInteractiveFlight(plan,{...flight,phase:'awaiting-takeoff',phaseStartedAt:START+40_000,phaseEndsAt:null},START+40_000);
    close(endTaxi.x,hold.x); close(endTaxi.y,hold.y);
  });
}
