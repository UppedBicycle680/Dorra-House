import * as engine from './shared/campaign-engine.js';
import {MAX_BALANCE} from './shared/game-limits.js';
import {WORLD_COUNTRIES} from './campaign-countries.mjs';

const clone = value => structuredClone(value);
const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const targets = new Map(WORLD_COUNTRIES.map(country => [country.id, country]));
for (const country of engine.PLAYABLE_COUNTRIES) {
  targets.set(country.id, country);
  for (const target of engine.getRecommendedTargets(country.id)) targets.set(target.id, target);
}

function fail(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  throw error;
}
function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}
function checkArgs(args, fields) {
  if (!object(args) || Object.keys(args).some(key => !fields.includes(key))) {
    fail('INVALID_ARGUMENTS', 'Campaign commands cannot supply saved state, balances, clocks, random seeds or outcomes.');
  }
  for (const key of fields) if (!has(args, key)) fail('INVALID_ARGUMENTS', `The campaign command requires ${key}.`);
}
function id(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(value)) fail('INVALID_ID', 'Choose a valid campaign item.');
  return value;
}
function name(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 32 || /[\u0000-\u001f\u007f]/.test(value)) fail('INVALID_NAME', 'Use a name of 1 to 32 characters.');
  return value.trim();
}
function target(value) {
  const selected = targets.get(id(value));
  if (!selected) fail('INVALID_TARGET', 'Choose a country on the campaign map.');
  // Only the identity is supplied by the browser. Names, coordinates, difficulty,
  // market value and all other target rules come from the authored catalogue.
  return engine.getTargetProfile(selected);
}
function region(value, state) {
  if (typeof value !== 'string' || !engine.getCampaignRegions(state.homeCountryId).includes(value)) fail('INVALID_REGION', 'Choose a region in your home nation.');
  return value;
}
function units(value, state) {
  if (!object(value) || !Object.keys(value).length || Object.keys(value).length > 100) fail('INVALID_FORCE', 'Select ready formations for this operation.');
  const result = {};
  for (const [key, count] of Object.entries(value)) {
    id(key);
    if (!Number.isSafeInteger(count) || count < 1 || count > 99 || !has(state.inventory, key) || count > state.inventory[key]) fail('INVALID_FORCE', 'That formation count exceeds your ready inventory.');
    result[key] = count;
  }
  return result;
}
function recordTransaction(snapshot, type, amount, label, now) {
  snapshot.progress.office = object(snapshot.progress.office) ? snapshot.progress.office : {};
  const existing = Array.isArray(snapshot.progress.office.transactions) ? snapshot.progress.office.transactions : [];
  snapshot.progress.office.transactions = [{type, label, amount, at: now}, ...existing].slice(0, 40);
}
function awardXp(progress, amount) {
  progress.level = Math.max(1, Math.min(99, Math.floor(Number(progress.level) || 1)));
  progress.xp = Math.max(0, Math.floor(Number(progress.xp) || 0)) + amount;
  while (progress.level < 99) {
    const needed = 200 + progress.level * 100;
    if (progress.xp < needed) break;
    progress.xp -= needed;
    progress.level++;
  }
}
const formatMoney = value => `$${Math.round(Math.abs(value)).toLocaleString('en-US')}`;

/** The authenticated transaction layer loads these objects from the database.
 * Browsers send only allowlisted commands, and receive the resulting public
 * snapshot. Actual outcome rolls are freshly generated in this process. */
export async function reduceCampaign(snapshot, privateState, action, args = {}, now) {
  if (!Number.isSafeInteger(now) || now < 0) fail('INVALID_TIME', 'The campaign requires a server timestamp.');
  if (!Number.isSafeInteger(snapshot.balance) || snapshot.balance < 0 || snapshot.balance > MAX_BALANCE) fail('INVALID_WALLET', 'The server wallet is outside its supported range.', 409);
  const saved = snapshot.progress?.campaign;
  let state = saved ? engine.normalizeCampaign({...saved, capitalUsd: snapshot.balance, finance: {sharedBankLinked: true}}) : null;
  let response;
  if (action === 'create') {
    checkArgs(args, ['homeCountryId', 'scenarioId']);
    if (state) fail('CAMPAIGN_EXISTS', 'Your existing command is already saved.', 409);
    if (!engine.getCountry(id(args.homeCountryId))) fail('INVALID_HOME', 'Choose an available command nation.');
    if (!engine.CAMPAIGN_SCENARIOS.some(item => item.id === id(args.scenarioId))) fail('INVALID_SCENARIO', 'Choose an available campaign scenario.');
    // This seed describes the public world. It never determines online rewards,
    // battles, diplomatic rolls, rival actions or future world event outcomes.
    response = engine.createCampaign({homeCountryId: args.homeCountryId, scenarioId: args.scenarioId, seed: crypto.randomUUID(), capitalUsd: snapshot.balance});
  } else {
    if (!state) fail('CAMPAIGN_REQUIRED', 'Establish your command before issuing orders.', 409);
    if (state.status === 'victory') fail('CAMPAIGN_COMPLETE', 'Your campaign is complete.', 409);
    switch (action) {
      case 'set-objective': checkArgs(args, ['id']); response = engine.setOperationObjective(state, id(args.id)); break;
      case 'set-victory-path': checkArgs(args, ['id']); response = engine.selectVictoryPath(state, id(args.id)); break;
      case 'set-posture': checkArgs(args, ['id']); response = engine.setTheatrePosture(state, id(args.id)); break;
      case 'set-strategy': checkArgs(args, ['id']); response = engine.selectCampaignStrategy(state, id(args.id)); break;
      case 'set-phase': checkArgs(args, ['phaseId', 'optionId']); response = engine.setOperationPhaseOption(state, id(args.phaseId), id(args.optionId)); break;
      case 'build-factory': checkArgs(args, ['typeId', 'region']); response = engine.buildCampaignFactory(state, id(args.typeId), region(args.region, state)); break;
      case 'upgrade-factory': checkArgs(args, ['id']); response = engine.upgradeCampaignFactory(state, id(args.id)); break;
      case 'expand-factories': checkArgs(args, []); response = engine.expandCampaignFactories(state); break;
      case 'build-base': checkArgs(args, ['typeId', 'region']); response = engine.buildCampaignBase(state, id(args.typeId), region(args.region, state)); break;
      case 'upgrade-base': checkArgs(args, ['id']); response = engine.upgradeCampaignBase(state, id(args.id)); break;
      case 'recruit': checkArgs(args, []); response = engine.recruitCampaignManpower(state, 1); break;
      case 'expand-manpower': checkArgs(args, []); response = engine.expandManpowerCapacity(state); break;
      case 'train-manpower': checkArgs(args, []); response = engine.improveManpowerTraining(state); break;
      case 'custom-program': {
        checkArgs(args, ['domain', 'investmentUsd', 'priorityId', 'manufacturerId']);
        if (!['land', 'air', 'sea'].includes(args.domain) || !Number.isSafeInteger(args.investmentUsd) || args.investmentUsd < engine.CUSTOM_PROGRAM_BUDGET_MIN || args.investmentUsd > engine.CUSTOM_PROGRAM_BUDGET_MAX) fail('INVALID_PROGRAM', 'Choose a valid domain and development budget.');
        response = engine.startCustomVehicleProgram(state, {domain: args.domain, investmentUsd: args.investmentUsd, priorityId: id(args.priorityId), manufacturerId: id(args.manufacturerId)});
        break;
      }
      case 'build-business': checkArgs(args, ['targetId', 'typeId']); response = engine.buildMarketBusiness(state, target(args.targetId).id, id(args.typeId)); break;
      case 'upgrade-business': checkArgs(args, ['targetId']); response = engine.upgradeMarketBusiness(state, target(args.targetId).id); break;
      case 'unlock-development': checkArgs(args, ['id']); response = engine.unlockDevelopmentNode(state, id(args.id)); break;
      case 'company-partnership': checkArgs(args, ['id']); response = engine.signCompanyPartnership(state, id(args.id)); break;
      case 'negotiate': checkArgs(args, ['targetId', 'typeId']); response = engine.negotiateCampaignAgreement(state, target(args.targetId), id(args.typeId), random); break;
      case 'build-overseas-base': checkArgs(args, ['targetId', 'typeId']); response = engine.buildOverseasBase(state, target(args.targetId), id(args.typeId)); break;
      case 'upgrade-overseas-base': checkArgs(args, ['id']); response = engine.upgradeOverseasBase(state, id(args.id)); break;
      case 'reinforce-route': checkArgs(args, ['id']); response = engine.reinforceSupplyRoute(state, id(args.id)); break;
      case 'assign-route-asset': checkArgs(args, ['id']); response = engine.assignStrategicAssetToRoute(state, id(args.id)); break;
      case 'acquire-asset': checkArgs(args, ['id']); response = engine.acquireStrategicAsset(state, id(args.id)); break;
      case 'world-choice': checkArgs(args, ['id', 'choiceId']); response = engine.resolveWorldEvent(state, id(args.id), id(args.choiceId)); break;
      case 'decision': checkArgs(args, ['id', 'choiceId']); response = engine.resolveCampaignDecision(state, id(args.id), id(args.choiceId)); break;
      case 'scout': checkArgs(args, ['targetId']); response = engine.scoutTarget(state, target(args.targetId)); break;
      case 'deploy': checkArgs(args, ['targetId', 'units']); response = engine.resolveDeployment(state, {targetProfile: target(args.targetId), units: units(args.units, state)}, random); break;
      case 'procure': checkArgs(args, ['equipmentId']); response = engine.queueProcurement(state, id(args.equipmentId), 1); break;
      case 'research': checkArgs(args, ['id']); response = engine.researchTechnology(state, id(args.id)); break;
      case 'end-turn': checkArgs(args, []); response = engine.endTurn(state, random); break;
      case 'create-task-force': {
        checkArgs(args, ['name', 'unitIds']);
        if (!Array.isArray(args.unitIds) || !args.unitIds.length || args.unitIds.length > 16 || new Set(args.unitIds).size !== args.unitIds.length) fail('INVALID_UNITS', 'Assign 1 to 16 distinct formations.');
        response = engine.createTaskForce(state, {name: name(args.name), unitIds: args.unitIds.map(id)});
        break;
      }
      case 'rename-task-force': checkArgs(args, ['id', 'name']); response = engine.renameTaskForce(state, id(args.id), name(args.name)); break;
      case 'maintain-task-force': checkArgs(args, ['id']); response = engine.maintainTaskForce(state, id(args.id), 'standard'); break;
      case 'map-order': {
        checkArgs(args, ['unitId', 'targetId', 'enemyId']);
        const unitId = id(args.unitId), destination = target(args.targetId), unit = engine.getMapForces(state).find(item => item.id === unitId && item.side === 'player');
        if (!unit) fail('INVALID_UNIT', 'Choose one of your formations.');
        if (typeof args.enemyId !== 'string') fail('INVALID_ENEMY', 'Choose a valid opposing formation.');
        if (unit.countryId !== destination.id) {
          response = engine.moveCampaignUnit(state, unitId, destination);
          if (!response.event.ok) break;
          state = response.state;
        }
        if (args.enemyId) {
          const enemyId = id(args.enemyId), enemy = engine.getMapForces(state).find(item => item.id === enemyId && item.side === 'opposition' && item.countryId === destination.id);
          if (!enemy) fail('INVALID_ENEMY', 'Choose an opposing formation in the destination country.');
          response = engine.attackCampaignUnit(state, unitId, enemyId, random);
        }
        if (!response) fail('EMPTY_ORDER', 'Choose a destination or opposing formation.');
        break;
      }
      default: fail('UNKNOWN_ACTION', 'That campaign command is not available.', 403);
    }
  }
  if (!response?.event?.ok) fail(response?.event?.code || 'ACTION_REJECTED', response?.event?.message || 'The campaign command was rejected.', 409);
  const next = clone(snapshot);
  next.progress = object(next.progress) ? next.progress : {};
  const campaign = {...response.state, finance: {sharedBankLinked: true}};
  const balance = Math.round(campaign.capitalUsd);
  if (!Number.isSafeInteger(balance) || balance < 0 || balance > MAX_BALANCE) fail('INVALID_WALLET', 'This command exceeds the supported wallet range.', 409);
  next.balance = balance;
  next.progress.campaign = campaign;
  const delta = balance - snapshot.balance, event = response.event;
  let ledger = '';
  if (delta) {
    const positive = delta > 0;
    const label = event.type === 'turn-ended' && positive ? 'Overseas business income' : positive ? 'Campaign account credit' : 'Strategic Command investment';
    recordTransaction(next, positive ? 'income' : 'campaign', delta, label, now);
    ledger = `Strategic Command: ${formatMoney(delta)} ${positive ? label.toLowerCase() : 'campaign investment'}.`;
  }
  if (event.type === 'campaign-created') ledger = 'Strategic Command: National command established.';
  if (event.type === 'deployment-resolved' && event.secured) {
    const market = event.preview?.target?.name || event.engagement?.targetName || 'New market';
    awardXp(next.progress, 180);
    recordTransaction(next, 'rights', 0, `Commercial rights unlocked · ${market}`, now);
    ledger ||= `Strategic Command: Operating rights secured in ${market}.`;
  }
  if (ledger) next.history = [{text: ledger}, ...(Array.isArray(next.history) ? next.history : [])].slice(0, 8);
  return {snapshot: next, privateState, result: {event}};
}
