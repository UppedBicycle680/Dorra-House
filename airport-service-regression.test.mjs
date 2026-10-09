import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {createAirportService} from './airport/server.mjs';
import {AirportStore} from './airport/store.mjs';
import {createCareer} from './airport/engine.mjs';

const START = 1_800_000_000_000;
const profileId = 'a'.repeat(64);

async function fixture(t, initialCareer, {clockStep = 0} = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dorra-airport-service-test-'));
  let clock = START, service;
  const readClock = () => { const at = clock; clock += clockStep; return at; };
  if (initialCareer) {
    const store = await new AirportStore(directory).open();
    await store.write({version:1, storageRevision:1, ownerId:profileId, installationId:randomUUID(),
      career:initialCareer, payouts:[], requests:{}, ackSequence:0});
    await store.close();
  }
  service = await createAirportService({directory, clock:readClock});
  let latest;
  t.after(async () => {
    await service.close();
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('dorra-airport-service-test-'));
    await fs.rm(directory, {recursive:true, force:true});
  });
  const load = async (presenceAirportId = null) => {
    latest = await service.handle('load', {profileId, presenceAirportId});
    return latest;
  };
  const command = async (command, requestId = randomUUID(), revision = latest.view.revision) => {
    const result = await service.handle('command', {profileId, requestId, expectedRevision:revision, command});
    latest = result;
    return result;
  };
  return {
    directory, load, command,
    get latest() { return latest; },
    get service() { return service; },
    get now() { return clock; },
    at(value) { assert.ok(value >= clock); clock = value; },
    advance(ms) { clock += ms; },
    async restart() { await service.close(); service = await createAirportService({directory, clock:readClock}); },
  };
}

async function readyFlight(f) {
  await f.load('redcliffe');
  if (!f.latest.view.selectedAirport.operations.flights.length) {
    f.advance(1);
    await f.load('redcliffe');
  }
  const flight = f.latest.view.selectedAirport.operations.flights.find(item => item.canLand);
  assert.ok(flight, 'A visible airport should offer a controllable arrival');
  return flight;
}

async function completeFlight(f, {prioritise = false} = {}) {
  const flight = await readyFlight(f);
  await f.command({type:'land-flight', airportId:'redcliffe', flightId:flight.id});
  for (let step = 0; step < 8; step++) {
    const current = f.latest.view.selectedAirport.operations.flights.find(item => item.id === flight.id);
    if (!current) return flight;
    if (prioritise && current.canPrioritise) {
      await f.command({type:'prioritise-flight', airportId:'redcliffe', flightId:flight.id});
      continue;
    }
    if (current.canTakeoff) {
      await f.command({type:'takeoff-flight', airportId:'redcliffe', flightId:flight.id});
      continue;
    }
    assert.ok(current.phaseEndsAt > f.now, `Expected a scheduled transition in ${current.phase}`);
    f.at(current.phaseEndsAt);
    await f.load('redcliffe');
  }
  assert.fail('Interactive flight failed to complete');
}

test('new careers expose ATC pricing and server-owned presence leases', async t => {
  const f = await fixture(t);
  const idle = (await f.load()).view.selectedAirport;
  assert.equal(idle.operations.atc.owned, false);
  assert.equal(idle.operations.atc.cost, 250);
  assert.equal(idle.rates.operatingFactor, .75);
  const active = (await f.load('redcliffe')).view.selectedAirport;
  assert.equal(active.rates.operatingFactor, 1);
  f.advance(15_001);
  assert.equal((await f.load()).view.selectedAirport.rates.operatingFactor, .75);
  await assert.rejects(f.service.handle('load', {profileId, presenceAirportId:'brisbane'}));
  await assert.rejects(f.service.handle('load', {profileId, presenceAirportId:'redcliffe', expiresAt:f.now + 1e9}), /Unsupported/);
});

test('legacy careers migrate at zero elapsed time without losing work or receipts', async t => {
  const career = createCareer(START, 19), original = structuredClone(career.airports.redcliffe);
  delete career.presence;
  delete career.airports.redcliffe.operations;
  career.airports.redcliffe.gates[0].progressMs = 12_345;
  career.airports.redcliffe.gates[0].cashRemainder = 0;
  career.airports.redcliffe.constructions.push({id:'task-1',kind:'building',building:'terminal',level:2,startedAt:START,endsAt:START+40_000});
  const f = await fixture(t, career);
  const result = await f.load();
  assert.equal(result.view.selectedAirport.cash, original.cash);
  assert.equal(result.view.diamonds, career.diamonds);
  assert.equal(result.view.selectedAirport.operations.atc.owned, false);
  await f.restart();
  const store = new AirportStore(f.directory);
  // Read a fresh committed document without opening another writer/lock.
  store.key = await fs.readFile(path.join(f.directory, 'installation.key'));
  const document = store.decode(await fs.readFile(store.file, 'utf8'));
  assert.equal(document.career.airports.redcliffe.gates[0].progressMs, 12_345);
  assert.deepEqual(document.career.airports.redcliffe.constructions, career.airports.redcliffe.constructions);
  assert.deepEqual(document.payouts, []);
  assert.equal(document.ownerId, profileId);
});

test('unattended cash discount preserves scheduled departures and research', async t => {
  const f = await fixture(t);
  await f.load();
  f.advance(360_000);
  const result = await f.load();
  assert.equal(result.view.selectedAirport.stats.departures, 4);
  assert.equal(result.view.selectedAirport.cash, 500 + 4 * 6);
  assert.equal(result.view.selectedAirport.stats.lifetimeResearch, 0);
  assert.equal(result.earnings.departures, 4);
});

test('ATC purchase is durable and replayed requests cannot charge twice', async t => {
  const f = await fixture(t);
  await f.load('redcliffe');
  const requestId = randomUUID(), command = {type:'hire-atc',airportId:'redcliffe'};
  const revision = f.latest.view.revision;
  await f.command(command, requestId, revision);
  assert.equal(f.latest.view.selectedAirport.cash, 250);
  assert.equal(f.latest.view.selectedAirport.operations.atc.owned, true);
  const replay = await f.command(command, requestId, revision);
  assert.equal(replay.replayed, true);
  assert.equal(replay.view.selectedAirport.cash, 250);
  await assert.rejects(f.command({type:'set-atc',airportId:'redcliffe',enabled:false}, requestId), /already used/);
  await assert.rejects(f.command({type:'set-atc',airportId:'redcliffe',enabled:false}, randomUUID(), revision), /changed/);
  await f.restart();
  assert.equal((await f.load()).view.selectedAirport.operations.atc.owned, true);
  f.advance(90_000);
  const earned = await f.load();
  assert.equal(earned.view.selectedAirport.rates.operatingFactor, 1);
  assert.ok(earned.view.selectedAirport.cash >= 258);
});

test('requests use one timestamp so boundary earnings match credited cash', async t => {
  const career = createCareer(START, 1);
  career.airports.redcliffe.gates[0].progressMs = 89_999;
  const f = await fixture(t, career, {clockStep:1});
  const purchased = await f.command({type:'hire-atc',airportId:'redcliffe'}, randomUUID(), 1);
  assert.equal(purchased.view.selectedAirport.cash - 500 + 250, purchased.earnings.cash);
  assert.equal(purchased.view.selectedAirport.stats.departures, purchased.earnings.departures);
  assert.equal(purchased.view.serverNow, START);
  assert.equal(purchased.view.lastSettledAt, purchased.view.serverNow);

  const earned = await f.load('redcliffe');
  assert.equal(earned.view.serverNow, START + 1);
  assert.equal(earned.view.lastSettledAt, earned.view.serverNow);
  assert.equal(earned.view.selectedAirport.cash - purchased.view.selectedAirport.cash, earned.earnings.cash);
  assert.equal(earned.earnings.cash, 8);
  assert.equal(earned.earnings.departures, 1);

  const paid = await f.service.handle('withdraw', {profileId,requestId:randomUUID(),
    expectedRevision:earned.view.revision,airportId:'redcliffe',amountCash:10,walletHeadroom:10000});
  assert.equal(paid.view.serverNow, START + 2);
  assert.equal(paid.view.lastSettledAt, paid.view.serverNow);
  assert.equal(paid.receipt.at, paid.view.serverNow);
  assert.equal(paid.view.selectedAirport.cash - earned.view.selectedAirport.cash + 10, paid.earnings.cash);
});

test('manual flight, priority and completion remain independent of baseline timers', async t => {
  const f = await fixture(t);
  await f.load();
  const flight = await completeFlight(f, {prioritise:true});
  const airport = f.latest.view.selectedAirport;
  assert.equal(airport.operations.completedFlights, 1);
  assert.equal(airport.operations.bonusCash, 2);
  assert.ok(airport.stats.departures >= 1);
  await assert.rejects(f.command({type:'takeoff-flight',airportId:'redcliffe',flightId:flight.id}));
  assert.equal((await f.load()).view.selectedAirport.operations.completedFlights, 1);
});

test('flight clearances validate fields, phases, replay and restart', async t => {
  const f = await fixture(t);
  const flight = await readyFlight(f);
  await assert.rejects(f.command({type:'takeoff-flight',airportId:'redcliffe',flightId:flight.id}));
  await assert.rejects(f.command({type:'land-flight',airportId:'redcliffe',flightId:flight.id,bonus:999999}));
  const requestId = randomUUID(), command = {type:'land-flight',airportId:'redcliffe',flightId:flight.id};
  const revision = f.latest.view.revision;
  await f.command(command, requestId, revision);
  assert.equal(f.latest.view.selectedAirport.operations.flights[0].phase, 'arriving');
  assert.equal((await f.command(command, requestId, revision)).replayed, true);
  const endsAt = f.latest.view.selectedAirport.operations.flights[0].phaseEndsAt;
  await f.restart();
  assert.equal((await f.load()).view.selectedAirport.operations.flights[0].id, flight.id);
  f.at(endsAt);
  const resumed = (await f.load()).view.selectedAirport.operations.flights[0];
  assert.equal(resumed.phase, 'servicing');
  assert.equal(resumed.aircraftId, flight.aircraftId);
});

test('contract progress counts only accepted interactive flights and rewards claim once', async t => {
  const f = await fixture(t);
  await f.load('redcliffe');
  const offer = f.latest.view.selectedAirport.operations.contractOffers.find(item => item.target === 5);
  assert.ok(offer);
  await f.command({type:'accept-contract',airportId:'redcliffe',offerId:offer.id,timed:false});
  f.advance(90_000);
  await f.load();
  assert.equal(f.latest.view.selectedAirport.operations.contract.progress, 0);
  for (let n = 0; n < 5; n++) await completeFlight(f);
  assert.equal(f.latest.view.selectedAirport.operations.contract.status, 'completed');
  const before = f.latest.view.selectedAirport.cash, requestId = randomUUID();
  await f.command({type:'claim-contract',airportId:'redcliffe'}, requestId);
  assert.equal(f.latest.view.selectedAirport.cash, before + offer.reward.cash);
  assert.ok(f.latest.view.selectedAirport.research >= 20);
  await f.command({type:'claim-contract',airportId:'redcliffe'}, requestId);
  assert.equal(f.latest.view.selectedAirport.cash, before + offer.reward.cash);
  await assert.rejects(f.command({type:'claim-contract',airportId:'redcliffe'}));
});

test('timed contract deadlines pause while unattended and abandonment is free', async t => {
  const f = await fixture(t);
  await f.load('redcliffe');
  const offer = f.latest.view.selectedAirport.operations.contractOffers[0];
  await f.command({type:'accept-contract',airportId:'redcliffe',offerId:offer.id,timed:true});
  await f.load();
  const remaining = f.latest.view.selectedAirport.operations.contract.remainingMs;
  f.advance(20 * 60_000);
  await f.load();
  assert.equal(f.latest.view.selectedAirport.operations.contract.remainingMs, remaining);
  assert.equal(f.latest.view.selectedAirport.operations.contract.status, 'active');
  const cash = f.latest.view.selectedAirport.cash;
  await f.command({type:'abandon-contract',airportId:'redcliffe'});
  assert.equal(f.latest.view.selectedAirport.cash, cash);
});

test('withdrawals keep the existing receipt and acknowledgement protocol', async t => {
  const f = await fixture(t);
  await f.load();
  const body = {profileId,requestId:randomUUID(),expectedRevision:f.latest.view.revision,
    airportId:'redcliffe',amountCash:100,walletHeadroom:10000};
  const paid = await f.service.handle('withdraw', body);
  assert.equal(paid.receipt.amountDorra, 10);
  assert.equal(paid.view.selectedAirport.cash, 400);
  assert.equal((await f.service.handle('withdraw', body)).replayed, true);
  const status = await f.service.handle('bridge/status', {profileId});
  assert.equal(status.receipts.length, 1);
  await f.service.handle('bridge/ack', {profileId,sequence:1});
  await f.restart();
  assert.equal((await f.service.handle('bridge/status', {profileId})).receipts.length, 0);
  assert.equal((await f.load()).view.selectedAirport.cash, 400);
});

test('failed persistence does not acknowledge or keep an ATC purchase in memory', async t => {
  const f = await fixture(t);
  await f.load('redcliffe');
  const write = AirportStore.prototype.write;
  AirportStore.prototype.write = async function () { throw new Error('simulated disk failure'); };
  try {
    await assert.rejects(f.command({type:'hire-atc',airportId:'redcliffe'}), /simulated disk failure/);
  } finally { AirportStore.prototype.write = write; }
  const reloaded = await f.load();
  assert.equal(reloaded.view.selectedAirport.operations.atc.owned, false);
  assert.equal(reloaded.view.selectedAirport.cash, 500);
});

test('offline HTTP server transports presence and rejects cross-origin or forged requests', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dorra-airport-http-test-'));
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0,'127.0.0.1',resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath,[fileURLToPath(new URL('./offline-server.js',import.meta.url))],{
    env:{...process.env,DORRA_PORT:String(port),DORRA_AIRPORT_DATA_DIR:directory,DORRA_NO_OPEN:'1'},
    windowsHide:true,stdio:['ignore','pipe','pipe'],
  });
  let logs = '';
  child.stdout.on('data',data => {logs += data;});
  child.stderr.on('data',data => {logs += data;});
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const stopped = new Promise(resolve => child.once('exit',resolve));
      child.kill('SIGTERM');
      await stopped;
    }
    assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('dorra-airport-http-test-'));
    await fs.rm(directory,{recursive:true,force:true});
  });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { ready = (await fetch(`${origin}/api/airport/health`).then(r => r.json())).ready; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve,50));
  }
  assert.ok(ready,logs);
  const post = (payload,headers = {}) => fetch(`${origin}/api/airport/load`,{
    method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...headers},body:JSON.stringify(payload),
  });
  const active = await post({profileId,presenceAirportId:'redcliffe'});
  assert.equal(active.status,200);
  const result = await active.json();
  assert.equal(result.view.selectedAirport.rates.operatingFactor,1);
  assert.ok(result.view.selectedAirport.operations.flights.length > 0);
  assert.equal((await post({profileId,presenceAirportId:null},{Origin:'https://example.com'})).status,403);
  assert.equal((await post({profileId,presenceAirportId:'redcliffe',expiresAt:START+999999})).status,400);
  assert.equal((await fetch(`${origin}/airport/server.mjs`)).status,404);
  assert.equal((await fetch(`${origin}/airport-service-regression.test.mjs`)).status,404);
});
