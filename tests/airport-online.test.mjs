import test from 'node:test';
import assert from 'node:assert/strict';
import {reduceAirport} from '../supabase/functions/dorra-api/airport.mjs';
import {createCareer, applyCommand, settleCareer, AIRPORTS} from '../airport/engine.mjs';

const START = 1_780_000_000_000;
const wallet = () => ({balance: 1_000, progress: {owned: []}});
const open = () => reduceAirport(wallet(), {anotherMode: {retained: true}}, 'load', {}, START);
const command = (state, input, now = START) => reduceAirport(state.snapshot, state.privateState, 'command', {
  requestId: crypto.randomUUID(), expectedRevision: state.result.view.revision, command: input
}, now);
const withdraw = (state, input = {}, now = START) => reduceAirport(state.snapshot, state.privateState, 'withdraw', {
  requestId: crypto.randomUUID(), expectedAirportRevision: state.result.view.revision,
  airportId: 'redcliffe', amountCash: 100, ...input
}, now);

test('a cloud account starts once and resumes the same persisted career on another device', async () => {
  const first = await open();
  assert.equal(first.result.view.selectedAirportId, 'redcliffe');
  assert.equal(first.result.view.selectedAirport.cash, 500);
  assert.equal(first.result.view.diamonds, 20);
  assert.deepEqual(first.privateState.anotherMode, {retained: true});
  const second = await reduceAirport(first.snapshot, structuredClone(first.privateState), 'load', {}, START + 90_000);
  assert.equal(second.privateState.airport.seed, first.privateState.airport.seed);
  assert.equal(second.result.view.selectedAirport.cash, 508);
  assert.equal(second.result.earnings.departures, 1);
  assert.equal(second.result.view.serverNow, START + 90_000);
  assert.equal(second.snapshot.balance, 1_000);
  assert.equal(first.privateState.airport.airports.redcliffe.cash, 500);
});

test('withdrawal debits airport cash and credits the cloud wallet atomically', async () => {
  const state = await open();
  const result = await withdraw(state);
  assert.equal(result.snapshot.balance, 1_010);
  assert.equal(result.result.view.selectedAirport.cash, 400);
  assert.deepEqual(result.result.receipt, {airportId: 'redcliffe', amountCash: 100, amountDorra: 10, at: START});
  assert.equal(state.snapshot.balance, 1_000);
  assert.equal(state.privateState.airport.airports.redcliffe.cash, 500);
  assert.equal(result.result.view.revision, state.result.view.revision + 1);
});

test('failed withdrawals cannot partially debit airport cash or credit the wallet', async () => {
  const state = await open();
  for (const input of [{amountCash: 510}, {amountCash: 11}, {amountCash: -100}, {amountCash: '100'}, {airportId: 'brisbane'}, {airportId: '__proto__'}]) {
    await assert.rejects(withdraw(state, input));
  }
  await assert.rejects(reduceAirport({...state.snapshot, balance: 9_000_000_000_000_000}, state.privateState, 'withdraw', {
    expectedAirportRevision: state.result.view.revision, airportId: 'redcliffe', amountCash: 100
  }, START), {code: 'WALLET_FULL'});
  assert.equal(state.snapshot.balance, 1_000);
  assert.equal(state.privateState.airport.airports.redcliffe.cash, 500);
});

test('airport purchases and construction timers use server costs and server time', async () => {
  const state = await open();
  const purchased = await command(state, {type: 'upgrade', building: 'runwaySurface'});
  assert.equal(purchased.result.view.selectedAirport.cash, 350);
  assert.equal(purchased.result.view.selectedAirport.buildings.find(b => b.key === 'runwaySurface').level, 1);
  assert.equal(purchased.result.view.selectedAirport.constructions[0].endsAt, START + 30_000);
  const resumed = await reduceAirport(purchased.snapshot, purchased.privateState, 'load', {}, START + 30_000);
  assert.equal(resumed.result.view.selectedAirport.buildings.find(b => b.key === 'runwaySurface').level, 2);
  assert.equal(resumed.result.view.selectedAirport.constructions.length, 0);
});

test('milestones award only server-earned progress and cannot be claimed twice', async () => {
  const state = await open();
  await assert.rejects(command(state, {type: 'claim-milestone', milestoneId: 'first-flights'}), {code: 'MILESTONE_INCOMPLETE'});
  const progressed = await reduceAirport(state.snapshot, state.privateState, 'load', {}, START + 900_000);
  const claimed = await command(progressed, {type: 'claim-milestone', milestoneId: 'first-flights'}, START + 900_000);
  assert.equal(claimed.result.view.selectedAirport.cash, progressed.result.view.selectedAirport.cash + 150);
  assert.equal(claimed.result.view.diamonds, progressed.result.view.diamonds + 10);
  await assert.rejects(command(claimed, {type: 'claim-milestone', milestoneId: 'first-flights'}, START + 900_000), {code: 'ALREADY_CLAIMED'});
});

test('stale revisions cannot repeat a purchase or withdrawal', async () => {
  const state = await open();
  const changed = await withdraw(state);
  await assert.rejects(reduceAirport(changed.snapshot, changed.privateState, 'withdraw', {
    expectedAirportRevision: state.result.view.revision, airportId: 'redcliffe', amountCash: 100
  }, START), {code: 'STALE_REVISION'});
  await assert.rejects(reduceAirport(changed.snapshot, changed.privateState, 'command', {
    expectedRevision: state.result.view.revision, command: {type: 'upgrade', building: 'runwaySurface'}
  }, START), {code: 'STALE_REVISION'});
});

test('save, timestamp, outcome and client-wallet-headroom injections are rejected', async () => {
  const state = await open();
  for (const injection of [{snapshot: {balance: 9e12}}, {now: START + 864e5}, {earnings: {cash: 1e12}}, {privateState: {}}, {profileId: 'another-user'}]) {
    await assert.rejects(reduceAirport(state.snapshot, state.privateState, 'load', injection, START), {code: 'INVALID_ARGUMENTS'});
  }
  await assert.rejects(withdraw(state, {walletHeadroom: 9e15}), {code: 'INVALID_ARGUMENTS'});
  for (const injection of [{cash: 9e12}, {diamondCost: 0}, {endsAt: START}, {state: {}}, {research: 9e12}]) {
    await assert.rejects(command(state, {type: 'upgrade', building: 'runwaySurface', ...injection}), {code: 'INVALID_COMMAND_FIELD'});
  }
});

test('developer grants and local payout-bridge operations are unavailable online', async () => {
  const state = await open();
  for (const action of ['developer', 'bridge/ack', 'bridge/status', 'save', 'reset']) {
    await assert.rejects(reduceAirport(state.snapshot, state.privateState, action, {}, START), {code: 'UNKNOWN_ACTION'});
  }
  await assert.rejects(command(state, {type: 'developer', amount: 9e12}), {code: 'UNKNOWN_COMMAND'});
});

test('public projection never exposes the private career seed or RNG states', async () => {
  const state = await open();
  const serialized = JSON.stringify(state.result);
  assert.doesNotMatch(serialized, /"(?:rngState|seed)"/);
  assert.ok(state.privateState.airport.seed > 0);
  assert.ok(state.privateState.airport.airports.redcliffe.gates[0].rngState > 0);
});

test('away earnings retain the original 24-hour cap without creating duplicate rewards', async () => {
  const state = await open();
  const resumed = await reduceAirport(state.snapshot, state.privateState, 'load', {}, START + 48 * 3_600_000);
  assert.equal(resumed.result.capped, true);
  assert.equal(resumed.result.creditedMs, 24 * 3_600_000);
  assert.equal(resumed.result.earnings.departures, 960);
  const repeated = await reduceAirport(resumed.snapshot, resumed.privateState, 'load', {}, START + 48 * 3_600_000);
  assert.equal(repeated.result.earnings.cash, 0);
  assert.equal(repeated.result.view.selectedAirport.cash, resumed.result.view.selectedAirport.cash);
});

test('a large airport network earns identical rewards regardless of refresh frequency', () => {
  let career = createCareer(START, 123);
  career.diamonds = 100_000;
  for (const airportId of AIRPORTS.slice(1).map(a => a.id)) {
    career = applyCommand(career, {type: 'unlock-airport', airportId, useDiamonds: true}, START);
  }
  for (const a of Object.values(career.airports)) {
    a.buildings = {runwaySurface: 5, runwayLength: 16, taxiway: 5, handling: 5, terminal: 5, tower: 5, researchLab: 5, cargo: 5};
    a.researchCompleted = ['turnaround', 'passenger-service', 'jet-operations', 'widebody-operations', 'super-operations', 'research-network'];
    const meta = AIRPORTS.find(m => m.id === a.id);
    a.gates[0].size = meta.maxSize;
    for (let i = 2; i <= meta.gatePlots; i++) {
      a.gates.push({...structuredClone(a.gates[0]), id: `gate-${i}`, plotId: `plot-${i}`, rngState: 123 + i});
    }
    a.boost = {multiplier: 10, startedAt: START, endsAt: START + 1_000_000};
    a.constructions = [{id: `${a.id}:construction`, kind: 'building', building: 'terminal', level: 4, startedAt: START, endsAt: START + 500_000}];
  }
  const single = settleCareer(career, START + 86_400_000);
  let refreshed = career;
  let cash = 0, research = 0, diamonds = 0, departures = 0;
  for (let hour = 1; hour <= 24; hour++) {
    const report = settleCareer(refreshed, START + hour * 3_600_000);
    refreshed = report.career;
    cash += report.earnings.cash;
    research += report.earnings.research;
    diamonds += report.earnings.diamonds;
    departures += report.earnings.departures;
  }
  assert.deepEqual(refreshed, single.career);
  assert.equal(single.earnings.cash, cash);
  assert.equal(single.earnings.research, research);
  assert.equal(single.earnings.diamonds, diamonds);
  assert.equal(single.earnings.departures, departures);
  assert.ok(departures > 500_000);
});

test('compact online views retain all selected-airport controls and network balances', async () => {
  const state = await open();
  const view = state.result.view;
  assert.equal(view.selectedAirport.id, 'redcliffe');
  assert.ok(view.selectedAirport.buildings.every(b => b.quote && typeof b.quote.cashCost === 'number'));
  assert.ok(view.selectedAirport.gates.every(g => g.aircraft && g.quote));
  assert.ok(view.selectedAirport.gatePlots.filter(p => !p.occupied).every(p => p.sizeQuotes.length > 0));
  assert.equal(view.airports.find(a => a.id === 'redcliffe').cash, view.selectedAirport.cash);
  assert.equal(view.airports.find(a => a.id === 'redcliffe').rates.cashPerHour, view.selectedAirport.rates.cashPerHour);
  assert.equal(view.locations, undefined);
});
