import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../campaign-engine.js';
import {reduceCampaign} from '../supabase/functions/dorra-api/campaign.mjs';

const now = 1_800_000_000_000;
const initial = () => ({balance: 5_000_000_000_000, progress: {level: 1, xp: 0}, history: []});
const run = (snapshot, action, args = {}) => reduceCampaign(snapshot, {}, action, args, now);
async function command() { return (await run(initial(), 'create', {homeCountryId: 'AU', scenarioId: 'open-world'})).snapshot; }

// The reducer receives snapshots from the trusted database transaction, never
// request bodies. These tests target the browser-intent boundary around it.
test('campaign resumes from a serialized cloud snapshot with identical world and finance', async () => {
  const created = await command();
  const serialized = JSON.parse(JSON.stringify(created));
  const resumed = await run(serialized, 'research', {id: 'force'});
  assert.equal(resumed.result.event.type, 'research-completed');
  assert.equal(resumed.snapshot.progress.campaign.research.force, 2);
  assert.equal(resumed.snapshot.balance, created.balance);
  assert.deepEqual(engine.normalizeCampaign(resumed.snapshot.progress.campaign).rivals, resumed.snapshot.progress.campaign.rivals);
  assert.deepEqual(created, serialized);
  await assert.rejects(run(created, 'create', {homeCountryId: 'AU', scenarioId: 'open-world'}), {code: 'CAMPAIGN_EXISTS'});
});

test('campaign intent validation rejects forged values, targets, clocks, outcomes and force counts', async () => {
  const snapshot = await command();
  const targetId = engine.getRecommendedTargets('AU')[0].id;
  const key = Object.keys(snapshot.progress.campaign.inventory)[0];
  for (const field of ['snapshot', 'state', 'seed', 'balance', 'capitalUsd', 'score', 'now', 'outcome', 'xp', 'event']) {
    await assert.rejects(run(snapshot, 'end-turn', {[field]: 1}), {code: 'INVALID_ARGUMENTS'});
  }
  await assert.rejects(run(snapshot, 'deploy', {targetId, units: {[key]: 100}}), {code: 'INVALID_FORCE'});
  await assert.rejects(run(snapshot, 'deploy', {targetId, units: {[key]: '1'}}), {code: 'INVALID_FORCE'});
  await assert.rejects(run(snapshot, 'deploy', {targetId, units: {[key]: 1.5}}), {code: 'INVALID_FORCE'});
  await assert.rejects(run(snapshot, 'deploy', {targetId, units: {'fake-formation': 1}}), {code: 'INVALID_FORCE'});
  await assert.rejects(run(snapshot, 'scout', {targetId: 'FAKE'}), {code: 'INVALID_TARGET'});
  await assert.rejects(run(snapshot, 'scout', {targetId: {id: targetId, lat: 0, lng: 0, defenseRating: 1}}), {code: 'INVALID_ID'});
  await assert.rejects(run(snapshot, 'grant-money', {}), {code: 'UNKNOWN_ACTION'});
  await assert.rejects(run(snapshot, 'create-task-force', {name: 'Injected', unitIds: ['unit', 'unit']}), {code: 'INVALID_UNITS'});
  await assert.rejects(run(snapshot, 'custom-program', {domain: 'land', investmentUsd: -1, priorityId: 'balanced', manufacturerId: 'x'}), {code: 'INVALID_PROGRAM'});
  await assert.rejects(run(snapshot, 'build-factory', {typeId: 'general-assembly', region: 'Injected'}), {code: 'INVALID_REGION'});
});

test('scouting and operations persist canonical targets and enforce turn and inventory rules', async () => {
  let snapshot = await command();
  const target = engine.getRecommendedTargets('AU')[0];
  const scout = await run(snapshot, 'scout', {targetId: target.id});
  snapshot = scout.snapshot;
  assert.equal(snapshot.progress.campaign.scouting[target.id].level, 1);
  assert.equal(snapshot.progress.campaign.knownTargets[target.id].name, target.name);
  const before = snapshot.balance;
  const operation = await run(snapshot, 'deploy', {targetId: target.id, units: snapshot.progress.campaign.inventory});
  assert.equal(operation.result.event.type, 'deployment-resolved');
  assert.equal(operation.snapshot.balance, before - operation.result.event.preview.operationCostUsd);
  assert.equal(operation.snapshot.progress.campaign.phase, 'resolution');
  if (operation.result.event.preview.operationCostUsd) assert.equal(operation.snapshot.progress.office.transactions[0].at, now);
  assert.equal(operation.snapshot.progress.campaign.totals.deployments, 1);
  assert.equal(operation.result.event.preview.target.name, target.name);
  assert.ok(operation.result.event.engagement.roll >= 0 && operation.result.event.engagement.roll <= 1);
  await assert.rejects(run(operation.snapshot, 'deploy', {targetId: target.id, units: operation.snapshot.progress.campaign.inventory}), {code: 'turn-resolved'});
});

test('industry, task-force names and procurement use server costs and survive cloud resumption', async () => {
  let snapshot = await command();
  const before = snapshot.balance;
  const built = await run(snapshot, 'build-factory', {typeId: 'general-assembly', region: engine.getCampaignRegions('AU')[1]});
  snapshot = built.snapshot;
  assert.equal(snapshot.balance, before - built.result.event.costUsd);
  const upgraded = await run(snapshot, 'upgrade-factory', {id: built.result.event.factoryId});
  assert.equal(upgraded.snapshot.balance, snapshot.balance - upgraded.result.event.costUsd);
  snapshot = upgraded.snapshot;
  const item = engine.getCampaignEquipmentForCountry(snapshot.progress.campaign, 'AU').find(item => item.tier === 1);
  const ordered = await run(snapshot, 'procure', {equipmentId: item.id});
  assert.ok(ordered.snapshot.balance < snapshot.balance);
  assert.equal(ordered.snapshot.progress.campaign.procurement.length, 1);
  snapshot = ordered.snapshot;
  const taskForce = snapshot.progress.campaign.taskForces[0];
  assert.ok(taskForce, 'The original starter task forces are preserved');
  const renamed = await run(snapshot, 'rename-task-force', {id: taskForce.id, name: 'Cloud command'});
  assert.equal(renamed.snapshot.progress.campaign.taskForces.find(item => item.id === taskForce.id).name, 'Cloud command');
  assert.equal(JSON.parse(JSON.stringify(renamed.snapshot)).progress.campaign.taskForces.find(item => item.id === taskForce.id).name, 'Cloud command');
  assert.equal(renamed.snapshot.balance, snapshot.balance);
});

test('secure entropy changes battles and turn events without changing public preview layout', async () => {
  const snapshot = await command();
  const state = snapshot.progress.campaign;
  const plan = {targetProfile: engine.getRecommendedTargets('AU')[0], units: state.inventory};
  const before = structuredClone(engine.previewDeployment(state, plan));
  let calls = 0;
  const success = engine.resolveDeployment(state, plan, () => { calls++; return 0; });
  const repelled = engine.resolveDeployment(state, plan, () => 0.9999);
  assert.equal(success.event.engagement.outcome, 'decisive');
  assert.equal(repelled.event.engagement.outcome, 'repelled');
  assert.ok(calls >= 4, 'Battle, formations, opponent adaptation and regions consume authority entropy');
  assert.deepEqual(engine.previewDeployment(state, plan), before);
  const first = engine.endTurn(state, () => 0), last = engine.endTurn(state, () => 0.9999);
  assert.notEqual(first.event.newWorldEvent.eventId, last.event.newWorldEvent.eventId);
  assert.notDeepEqual(first.event.rivalActions, last.event.rivalActions);
  assert.equal(first.state.seed, state.seed);
  assert.deepEqual(first.state.commanders, last.state.commanders);
});

test('business income and newly secured rights credit finance and experience only on authority', async () => {
  const snapshot = await command();
  const state = snapshot.progress.campaign;
  const target = engine.getRecommendedTargets('AU')[0];
  state.rights[target.id] = {targetId: target.id, name: target.name, status: 'secured', control: 100, securedTurn: 1, revenue: 0};
  const built = await run(snapshot, 'build-business', {targetId: target.id, typeId: 'boutique-hotel'});
  assert.equal(built.snapshot.balance, snapshot.balance - built.result.event.costUsd);
  const advanced = await run(built.snapshot, 'end-turn');
  assert.equal(advanced.snapshot.balance, built.snapshot.balance + advanced.result.event.businessEconomy.incomeUsd);
  assert.equal(advanced.snapshot.progress.campaign.capitalUsd, advanced.snapshot.balance);
  assert.equal(advanced.snapshot.progress.office.transactions[0].type, 'income');
  assert.equal(advanced.snapshot.progress.office.transactions[0].at, now);
});
