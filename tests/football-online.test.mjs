import assert from 'node:assert/strict';
import test from 'node:test';
import { reduceFootball } from '../supabase/functions/dorra-api/football.mjs';
import * as Engine from '../football/football-engine.js';

const NOW = Date.UTC(2026, 9, 7);
const CLUB = { name: 'Cloud Club', siteId: 'caboolture', ownerInvestmentAud: 0, startupLoanAud: 2_000_000, academyFeeAud: 1750, weeklyFirstTeamBudget: 5000, playingStyle: 'balanced' };

function career(balance = 100_000) {
  let snapshot = { balance, progress: { level: 1, xp: 0, owned: [], equipped: {}, anotherMode: { preserved: true } }, history: [] }, privateState = {};
  return {
    get snapshot() { return snapshot; }, get privateState() { return privateState; },
    async call(action, args = []) {
      const response = await reduceFootball(snapshot, privateState, action, { args }, NOW);
      snapshot = JSON.parse(JSON.stringify(response.snapshot));
      privateState = JSON.parse(JSON.stringify(response.privateState));
      return response.result;
    },
    async reject(action, args, pattern) {
      const before = JSON.stringify({ snapshot, privateState });
      await assert.rejects(reduceFootball(snapshot, privateState, action, { args }, NOW), pattern);
      assert.equal(JSON.stringify({ snapshot, privateState }), before, 'rejected decisions must not alter durable state');
    }
  };
}

test('football cloud career keeps protected finances and survives serialized save round trips', async () => {
  const game = career();
  const created = await game.call('startClub', [CLUB]);
  assert.equal(created.ok, true);
  assert.equal(game.snapshot.balance, 100_000);
  assert.equal(game.snapshot.progress.footballManager.seed, undefined);
  const seed = game.privateState.football.seed;
  assert.equal(typeof seed, 'string');
  assert.equal(JSON.stringify(game.snapshot).includes(seed), false);
  assert.equal(JSON.stringify(created).includes(seed), false);
  const cash = game.snapshot.progress.footballManager.finance.cash;
  await game.call('investOwnerFunds', [1000]);
  assert.equal(game.snapshot.balance, 99_000);
  assert.equal(game.snapshot.progress.footballManager.finance.cash, cash + 1000);
  await game.reject('investOwnerFunds', [100_000], /cannot complete/);
  await game.call('setAcademyFee', [2000]);
  await game.call('setManagerSettings', [{ reducedMotion: true, confirmWeek: false }]);
  assert.equal(game.snapshot.progress.footballManager.academy.feeAud, 2000);
  assert.equal(game.snapshot.progress.footballManager.settings.reducedMotion, true);
  await game.call('advanceWeek');
  assert.equal(game.snapshot.progress.footballManager.week, 2);
  assert.notEqual(game.privateState.football.seed, seed, 'each new command must have a fresh execution seed');
  assert.equal(JSON.stringify(game.snapshot).includes(game.privateState.football.seed), false);
  const balance = game.snapshot.balance;
  await game.call('resetFootballProgress');
  assert.equal(game.snapshot.progress.footballManager, undefined);
  assert.equal(game.snapshot.balance, balance);
  assert.deepEqual(game.snapshot.progress.anotherMode, { preserved: true });
});

test('football rejects score, clock, forced season, market and matchday revenue tampering', async () => {
  const game = career();
  await game.call('startClub', [CLUB]);
  await game.reject('startClub', [{ ...CLUB, name: 'Overwrite' }], /Reset the existing/);
  await game.reject('applyWeeklyFinance', [], /not available/);
  await game.reject('constructor', [], /not available/);
  await game.reject('__proto__', [], /not available/);
  await game.reject('recordFriendlyResult', ['forged', { goalsFor: 8, goalsAgainst: 0 }], /not available/);
  await game.reject('recordCupResult', [{ advanced: true, prizeMoney: 1_000_000 }], /not available/);
  await game.reject('settleSeason', [{ force: true }], /Invalid football/);
  await game.reject('startConstruction', ['fields', { nowMs: NOW + 1_000_000_000 }], /Invalid football/);
  await game.reject('reconcileConstruction', [NOW + 1_000_000_000], /Invalid football/);
  await game.reject('simulateMatch', [{ squad: 'first', firstHalf: { homeGoals: 8, awayGoals: 0 } }], /Unsupported football/);
  await game.reject('createScoutingAssignment', [{ type: 'region', region: 'Queensland', candidate: { rating: 100, potential: 100 } }], /Unsupported football/);
  await game.reject('setMatchdayPlan', [{ ticketPrice: 9_000_000_000_000_000 }], /ticketPrice must be between/);
  await game.reject('setCommercialPlan', [{ tickets: { basePriceAud: 9_000_000_000_000_000 } }], /Unsupported football/);
  await game.call('setMatchdayPlan', [{ ticketPrice: 30, hospitalityPrice: 100, concessionSpend: 20, staffing: 3, security: 3, pitchPrep: 3, transportSubsidy: 0, promotionSpend: 250 }]);
  assert.equal(game.snapshot.progress.footballManager.careerWorld.matchday.plan.ticketPrice, 30);
  const market = JSON.stringify(game.snapshot.progress.footballManager.recruitment);
  await game.call('refreshRecruitmentMarket');
  assert.equal(JSON.stringify(game.snapshot.progress.footballManager.recruitment), market);
});

test('visual football matches use the server first half and reject replay or changed state', async () => {
  const game = career();
  await game.call('startClub', [CLUB]);
  for (let index = 0; index < 8; index++) {
    if (Engine.previewMatchHalf(game.snapshot.progress.footballManager, { squad: 'first', half: 1 }).ok) break;
    await game.call('advanceWeek');
  }
  const first = await game.call('previewMatchHalf', [{ squad: 'first', half: 1 }]);
  assert.equal(first.ok, true);
  const trustedHalf = structuredClone(game.privateState.football.visualMatch.firstHalf);
  const matchSeed = game.privateState.football.seed;
  const repeated = await game.call('previewMatchHalf', [{ squad: 'first', half: 1 }]);
  assert.deepEqual(repeated.result, trustedHalf, 'reopening a visual match cannot reroll its first half');
  assert.equal(game.privateState.football.seed, matchSeed);
  await game.reject('setAcademyFee', [2500], /Finish the current visual match/);
  await game.reject('simulateMatch', [{ squad: 'first', visual: true, firstHalf: { homeGoals: 8, awayGoals: 0 } }], /Unsupported football/);
  const second = await game.call('previewMatchHalf', [{ squad: 'first', half: 2, halftime: {} }]);
  assert.equal(second.ok, true);
  assert.notEqual(game.privateState.football.seed, matchSeed, 'the second half must not reuse exposed first-half entropy');
  await game.reject('previewMatchHalf', [{ squad: 'first', half: 2, halftime: { styleId: 'balanced' } }], /already committed/);
  const played = await game.call('simulateMatch', [{ squad: 'first', visual: true, halftime: {} }]);
  assert.equal(played.ok, true);
  assert.deepEqual(played.result.halves.first, trustedHalf);
  assert.equal(game.privateState.football.visualMatch, undefined);
  await game.reject('simulateMatch', [{ squad: 'first', visual: true, halftime: {} }], /visual match changed/);
  assert.equal(JSON.stringify(game.snapshot).includes(game.privateState.football.seed), false);
});

test('player commitments require new server-recorded progress before granting morale', async () => {
  const game = career();
  await game.call('startClub', [CLUB]);
  const player = game.snapshot.progress.footballManager.careerWorld.players.find(item => item.status === 'active');
  const promise = await game.call('createPlayerPromise', [player.id, { type: 'new-contract', detail: 'Agree a new contract', targetWeeks: 12 }]);
  await game.reject('resolvePlayerPromise', [promise.promise.id, 'fulfilled'], /not recorded the promised target/);
  await game.reject('createPlayerPromise', [player.id, { type: 'new-contract', detail: 'Repeat promise', targetWeeks: 12 }], /already has that commitment/);
  await game.call('advanceWeek');
  let stored = game.snapshot.progress.footballManager.careerWorld.squadDynamics.promises.find(item => item.id === promise.promise.id);
  assert.equal(stored.status, 'active', 'an existing contract must not satisfy a newly made promise');
  assert.equal(stored.type, 'new-contract');
  const rootPlayer = game.snapshot.progress.footballManager.squads.first.players.find(item => item.id === player.id);
  await game.call('renewPlayerContract', [player.id, { weeklyWage: rootPlayer.weeklyWage, seasons: 3, squadRole: 'rotation' }]);
  const fulfilled = await game.call('resolvePlayerPromise', [promise.promise.id, 'fulfilled']);
  assert.equal(fulfilled.ok, true);
  stored = game.snapshot.progress.footballManager.careerWorld.squadDynamics.promises.find(item => item.id === promise.promise.id);
  assert.equal(stored.status, 'fulfilled');
  await game.reject('resolvePlayerPromise', [promise.promise.id, 'fulfilled'], /active commitment/);
});

test('a full football season advances and settles without uploading a replacement save', async () => {
  const game = career(50_000_000);
  await game.call('startClub', [{ ...CLUB, ownerInvestmentAud: 20_000_000, startupLoanAud: 0 }]);
  for (let week = 1; week <= 40; week++) await game.call('advanceWeek');
  assert.equal(game.snapshot.progress.footballManager.week, 41);
  const settled = await game.call('settleSeason');
  assert.equal(settled.ok, true);
  assert.equal(game.snapshot.progress.footballManager.season, 2027);
  assert.equal(game.snapshot.progress.footballManager.week, 1);
  assert.equal(game.snapshot.progress.footballManager.metrics.seasons, 1);
  assert.equal(game.snapshot.balance, 30_000_000);
  assert.deepEqual(game.snapshot.progress.anotherMode, { preserved: true });
});
