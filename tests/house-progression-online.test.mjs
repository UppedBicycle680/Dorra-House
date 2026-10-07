import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeHouse, reduceHouseProgression, recordRoundResult,
} from '../supabase/functions/dorra-api/house-progression.mjs';
import {
  STORY_CHOICES, EMPIRE_EVENTS, EMPIRE_HEADQUARTERS_UPGRADES,
  EMPIRE_VENUE_IMPROVEMENTS, EMPIRE_SPECIALIZATIONS,
  EMPIRE_MARKETING_CAMPAIGNS, EMPIRE_LOANS, empireRate,
} from '../supabase/functions/dorra-api/shared/progression-engine.js';

const NOW = Date.parse('2026-10-07T12:00:00Z');
function fixture({balance = 1000, progress = {}, privateState = {}} = {}) {
  return {snapshot: initializeHouse({balance, progress}, NOW), privateState, now: NOW};
}
async function act(f, action, args = {}) {
  const output = await reduceHouseProgression(
    structuredClone(f.snapshot), structuredClone(f.privateState), action, args, f.now,
  );
  assert(output, `Expected a progression command: ${action}`);
  f.snapshot = output.snapshot;
  f.privateState = output.privateState;
  return output.result;
}
function round(f, game = 'Blackjack', won = false, bet = 25) {
  recordRoundResult(f.snapshot, {game, won, bet, message: `${game}: fixture settlement`}, f.now);
}
async function completeCallingCard(f) {
  await act(f, 'contract-accept', {contractId: 'calling-card'});
  for (let index = 0; index < 3; index++) round(f);
  round(f, 'Blackjack', true);
  return act(f, 'contract-claim');
}

test('new players receive a complete server-created progression and UTC daily state', () => {
  const f = fixture();
  assert.equal(f.snapshot.balance, 1000);
  assert.deepEqual(f.snapshot.stats, {sessions: 0, wins: 0, games: {}});
  assert.equal(f.snapshot.progress.level, 1);
  assert.equal(f.snapshot.progress.daily.date, '2026-10-07');
  assert.equal(f.snapshot.progress.story.index, 0);
  assert.equal(f.snapshot.progress.contracts.status, 'idle');
  assert.equal(f.snapshot.progress.empire.lastAccruedAt, NOW);
  assert.deepEqual(f.snapshot.progress.profile.settings, {sound: true, motion: true, textSize: 'standard'});
});

test('daily rewards ignore client amounts and dates, pay once, and track server-day streaks', async () => {
  const f = fixture();
  const result = await act(f, 'daily-reward', {amount: 9e15, date: '2099-01-01'});
  assert.equal(result.amount, 250);
  assert.equal(f.snapshot.balance, 1250);
  assert.equal(f.snapshot.progress.rewardDate, '2026-10-07');
  await assert.rejects(() => act(f, 'daily-reward'), /already/);
  f.now += 86400000;
  await act(f, 'daily-reward');
  assert.equal(f.snapshot.progress.rewardStreak.count, 2);
  f.now += 86400000 * 3;
  await act(f, 'daily-reward');
  assert.equal(f.snapshot.progress.rewardStreak.count, 1);
  assert.equal(f.snapshot.progress.rewardDate, '2026-10-11');
});

test('emergency refill and Skyline credit derive eligibility and amount from saved state', async () => {
  const f = fixture({balance: 0});
  const refill = await act(f, 'daily-reward', {refill: false});
  assert.equal(refill.refill, true);
  assert.equal(f.snapshot.balance, 250);
  assert.equal(f.snapshot.progress.rewardDate, '');
  assert.equal(f.snapshot.progress.rewardStreak.count, 0);
  const regular = await act(f, 'daily-reward');
  assert.equal(regular.refill, false);
  assert.equal(f.snapshot.balance, 500);
  await assert.rejects(() => act(f, 'daily-reward'), /already/);
  const skyline = fixture({progress: {empire: {venues: {skyline: {level: 3}}}}});
  assert.equal((await act(skyline, 'daily-reward')).amount, 350);
});

test('founder advance can only be earned once despite changing arrival focus', async () => {
  const f = fixture();
  await assert.rejects(() => act(f, 'arrival', {path: 'administrator'}), /Invalid/);
  const first = await act(f, 'arrival', {path: 'owner', advance: 1e9});
  assert.equal(first.advance, 4000);
  assert.equal(f.snapshot.balance, 5000);
  await act(f, 'estate-upgrade', {venueId: 'terrace'});
  assert.equal(f.snapshot.balance, 0);
  await act(f, 'arrival', {path: 'player'});
  await act(f, 'arrival', {path: 'owner'});
  assert.equal(f.snapshot.balance, 0);
  assert.equal(f.snapshot.progress.arrival.ownerOpeningUnlocked, true);
  await act(f, 'arrival', {skip: true});
  assert.equal(f.snapshot.progress.arrival.path, '');
  assert.equal(f.snapshot.progress.arrival.complete, true);
});

test('estate openings enforce affordability, star unlocks, vehicle requirements, and server prices', async () => {
  const f = fixture();
  await assert.rejects(() => act(f, 'estate-upgrade', {venueId: 'terrace', cost: 0}), /Not enough/);
  await act(f, 'arrival', {path: 'owner'});
  const opened = await act(f, 'estate-upgrade', {venueId: 'terrace', cost: 0, level: 5});
  assert.equal(opened.cost, 5000);
  assert.equal(f.snapshot.progress.empire.venues.terrace.level, 1);
  assert.equal(f.snapshot.progress.empire.pending, 100);
  f.snapshot.balance = 10000000; // Authoritative test fixture, not an accepted player input.
  await assert.rejects(() => act(f, 'estate-upgrade', {venueId: 'hotel'}), /locked/);
  await assert.rejects(() => act(f, 'estate-upgrade', {venueId: 'not-a-venue'}), /Unknown/);
  for (let level = 2; level <= 5; level++) await act(f, 'estate-upgrade', {venueId: 'terrace'});
  await assert.rejects(() => act(f, 'estate-upgrade', {venueId: 'terrace'}), /fully/);
  // Reach the racing venue's star gate without granting a car.
  Object.assign(f.snapshot.progress.empire.venues, {valet: {level: 5}, boutique: {level: 3}});
  await assert.rejects(() => act(f, 'estate-upgrade', {venueId: 'grandprix'}), /locked/);
});

test('estate collection uses server elapsed time, preserves the cap, and cannot pay twice', async () => {
  const f = fixture();
  await act(f, 'arrival', {path: 'owner'});
  await act(f, 'estate-upgrade', {venueId: 'terrace'});
  const rate = empireRate(f.snapshot.progress);
  f.now += 3600000;
  const collection = await act(f, 'estate-claim', {amount: 1e9, now: NOW + 864000000});
  assert.equal(collection.amount, 100 + rate);
  assert.equal(f.snapshot.balance, 100 + rate);
  await assert.rejects(() => act(f, 'estate-claim'), /No estate/);
  f.now += 3600000 * 24;
  assert.equal((await act(f, 'estate-claim')).amount, rate * 8);
  assert.equal(f.snapshot.progress.empire.lifetimeEarned, 100 + rate * 9);
});

test('directors require Level 2 and cannot change contract reward directives during a brief', async () => {
  const f = fixture({balance: 1000000, progress: {story: {index: 2}}});
  await act(f, 'estate-upgrade', {venueId: 'terrace'});
  await assert.rejects(() => act(f, 'estate-manager', {venueId: 'terrace'}), /Level 2/);
  await act(f, 'estate-upgrade', {venueId: 'terrace'});
  const before = f.snapshot.balance;
  await act(f, 'estate-manager', {venueId: 'terrace', cost: 0});
  assert.equal(f.snapshot.balance, before - 2000);
  await assert.rejects(() => act(f, 'estate-manager', {venueId: 'terrace'}), /unmanaged/);
  await act(f, 'estate-focus', {venueId: 'terrace', focusId: 'service'});
  await act(f, 'contract-accept', {contractId: 'calling-card'});
  await assert.rejects(() => act(f, 'estate-focus', {venueId: 'terrace', focusId: 'yield'}), /locked/);
  assert.equal(f.snapshot.progress.empire.venues.terrace.focus, 'service');
});

test('staff and permanent specializations enforce operating venues, counts, levels, and one choice', async () => {
  const f = fixture({balance: 1000000});
  await assert.rejects(() => act(f, 'estate-staff-hire', {venueId: 'terrace', roleId: 'service'}), /cannot/);
  await act(f, 'estate-upgrade', {venueId: 'terrace'});
  const before = f.snapshot.balance;
  await act(f, 'estate-staff-hire', {venueId: 'terrace', roleId: 'service', count: 25, cost: 0});
  assert.equal(f.snapshot.balance, before - 1200);
  assert.equal(f.snapshot.progress.empire.venues.terrace.staff.service, 1);
  await act(f, 'estate-staff-release', {venueId: 'terrace', roleId: 'service'});
  await assert.rejects(() => act(f, 'estate-staff-release', {venueId: 'terrace', roleId: 'service'}), /No staff/);
  const specializationId = EMPIRE_SPECIALIZATIONS.terrace[0].id;
  await assert.rejects(() => act(f, 'estate-specialization', {venueId: 'terrace', specializationId}), /unavailable/);
  for (let level = 2; level <= 3; level++) await act(f, 'estate-upgrade', {venueId: 'terrace'});
  await act(f, 'estate-specialization', {venueId: 'terrace', specializationId});
  await assert.rejects(() => act(f, 'estate-specialization', {venueId: 'terrace', specializationId}), /unavailable/);
});

test('headquarters and venue capital projects charge catalog costs and stop at their maximum level', async () => {
  const f = fixture({balance: 1000000});
  const upgrade = EMPIRE_HEADQUARTERS_UPGRADES[0], improvement = EMPIRE_VENUE_IMPROVEMENTS[0];
  await assert.rejects(() => act(f, 'estate-venue-improvement', {venueId: 'terrace', improvementId: improvement.id}), /unavailable/);
  for (const cost of upgrade.costs) {
    const before = f.snapshot.balance;
    const result = await act(f, 'estate-headquarters-upgrade', {upgradeId: upgrade.id, cost: 0});
    assert.equal(result.cost, cost);
    assert.equal(f.snapshot.balance, before - cost);
  }
  await assert.rejects(() => act(f, 'estate-headquarters-upgrade', {upgradeId: upgrade.id}), /unavailable/);
  await act(f, 'estate-upgrade', {venueId: 'terrace'});
  for (let level = 1; level <= 3; level++) {
    const before = f.snapshot.balance;
    const result = await act(f, 'estate-venue-improvement', {venueId: 'terrace', improvementId: improvement.id, cost: 0});
    assert.equal(result.level, level);
    assert(result.cost > 0);
    assert.equal(f.snapshot.balance, before - result.cost);
  }
  await assert.rejects(() => act(f, 'estate-venue-improvement', {venueId: 'terrace', improvementId: improvement.id}), /unavailable/);
});

test('marketing, financing, objectives, business weeks, and event choices remain playable with fixed economics', async () => {
  const f = fixture({balance: 1000000});
  await act(f, 'estate-upgrade', {venueId: 'terrace'});
  const campaign = EMPIRE_MARKETING_CAMPAIGNS[0], loan = EMPIRE_LOANS[0];
  let before = f.snapshot.balance;
  await act(f, 'estate-marketing', {campaignId: campaign.id, cost: 0});
  assert.equal(f.snapshot.balance, before - campaign.cost);
  assert.equal(f.snapshot.progress.empire.marketing[0].weeks, campaign.duration);
  before = f.snapshot.balance;
  await act(f, 'estate-loan', {loanId: loan.id, credit: 1e9});
  assert.equal(f.snapshot.balance, before + loan.principal);
  await assert.rejects(() => act(f, 'estate-loan', {loanId: loan.id}), /already/);
  const objective = await act(f, 'estate-objective', {objectiveId: 'first-profit', reward: 1e9});
  assert(objective.amount > 0 && objective.amount < 1e9);
  await assert.rejects(() => act(f, 'estate-objective', {objectiveId: 'first-profit'}), /claimed/);
  await act(f, 'estate-week', {cashflow: 1e9});
  await act(f, 'estate-week');
  assert.equal(f.snapshot.progress.empire.week, 3);
  await assert.rejects(() => act(f, 'estate-week'), /Resolve/);
  const event = EMPIRE_EVENTS.find(item => item.id === f.snapshot.progress.empire.event.id), choice = event.choices[0];
  before = f.snapshot.balance;
  await act(f, 'estate-event', {choiceId: choice.id, cost: 0});
  assert.equal(f.snapshot.balance, before - (choice.cost || 0));
  assert.equal(f.snapshot.progress.empire.event, null);
  assert.equal(f.snapshot.progress.empire.eventHistory[0].choice, choice.label);
});

test('server settlements award XP, daily objectives, achievements, story counters, and bounded history', () => {
  const f = fixture();
  round(f, 'Blackjack', true);
  round(f, 'Roulette');
  round(f, 'Lucky Dice', true);
  assert.equal(f.snapshot.balance, 1300);
  assert.equal(f.snapshot.stats.sessions, 3);
  assert.equal(f.snapshot.stats.wins, 2);
  assert.equal(f.snapshot.progress.xp, 116);
  assert.equal(f.snapshot.progress.daily.bonusClaimed, true);
  assert.equal(f.snapshot.progress.story.metrics.rounds, 3);
  assert.equal(f.snapshot.progress.story.metrics.wins, 2);
  assert(f.snapshot.progress.achievements.arrival);
  assert(f.snapshot.progress.achievements.firstwin);
  assert(f.snapshot.progress.achievements.tour);
  for (let index = 0; index < 8; index++) round(f);
  assert.equal(f.snapshot.balance, 1300);
  assert.equal(f.snapshot.history.length, 8);
  f.now += 86400000;
  round(f);
  assert.equal(f.snapshot.progress.daily.sessions, 1);
  assert.equal(f.snapshot.progress.daily.date, '2026-10-08');
});

test('story choices and chapters require authoritative objectives and pay each chapter once', async () => {
  const f = fixture();
  await assert.rejects(() => act(f, 'story-complete', {rounds: 100, wins: 100}), /objectives/);
  const choice = STORY_CHOICES.s1.options[0];
  await act(f, 'story-choice', {choiceId: choice.id, bonus: [1e9, 1e9]});
  assert.equal(f.snapshot.progress.story.relationships[choice.relation], 1);
  await assert.rejects(() => act(f, 'story-choice', {choiceId: choice.id}), /recorded/);
  round(f, 'Blackjack', true);
  round(f);
  round(f);
  const before = f.snapshot.balance, result = await act(f, 'story-complete', {reward: 1e9});
  assert.equal(result.missionId, 's1');
  assert.equal(f.snapshot.balance, before + Math.max(4000, 5000 - before));
  assert.equal(f.snapshot.progress.story.index, 1);
  assert.deepEqual(f.snapshot.progress.story.metrics, {rounds: 0, wins: 0, games: [], gameCounts: {}});
  await assert.rejects(() => act(f, 'story-complete'), /objectives/);
  await assert.rejects(() => act(f, 'story-dialogue', {missionId: 's8', phase: 'completion'}), /locked/);
  await act(f, 'story-dialogue', {missionId: 's1', phase: 'completion'});
  await act(f, 'story-dialogue', {missionId: 's1', phase: 'completion'});
  assert.deepEqual(f.snapshot.progress.story.dialogueSeen, ['s1:completion']);
});

test('contracts enforce unlocks and sequential steps, prevent double rewards, and allow unpaid replays', async () => {
  const locked = fixture();
  await assert.rejects(() => act(locked, 'contract-accept', {contractId: 'calling-card'}), /locked/);
  const f = fixture({progress: {story: {index: 2}}});
  await act(f, 'contract-accept', {contractId: 'calling-card', rewardCash: 1e9});
  await assert.rejects(() => act(f, 'contract-accept', {contractId: 'four-rooms'}), /active/);
  await assert.rejects(() => act(f, 'contract-claim', {completed: true}), /Complete/);
  round(f, 'Roulette', true);
  assert.equal(f.snapshot.progress.contracts.stepProgress, 0);
  for (let index = 0; index < 3; index++) round(f);
  assert.equal(f.snapshot.progress.contracts.stepIndex, 1);
  await assert.rejects(() => act(f, 'contract-claim'), /Complete/);
  round(f, 'Blackjack', true);
  const before = f.snapshot.balance, reward = await act(f, 'contract-claim');
  assert.equal(reward.amount, 750);
  assert.equal(f.snapshot.balance, before + 750);
  assert.equal(f.snapshot.progress.contracts.totalCash, 750);
  await assert.rejects(() => act(f, 'contract-claim'), /active/);
  const replay = await completeCallingCard(f);
  assert.equal(replay.replay, true);
  assert.equal(replay.amount, 0);
  assert.equal(f.snapshot.progress.contracts.replays, 1);
  assert.equal(f.snapshot.progress.contracts.totalCash, 750);
  assert.deepEqual(f.snapshot.progress.contracts.claimedIds, ['calling-card']);
});

test('expired contracts record one failure and can be retried or abandoned without a fee', async () => {
  const f = fixture({progress: {story: {index: 3}}});
  await act(f, 'contract-accept', {contractId: 'steady-hand'});
  await assert.rejects(() => act(f, 'contract-retry'), /expired/);
  for (let index = 0; index < 14; index++) round(f, 'Roulette');
  assert.equal(f.snapshot.progress.contracts.status, 'failed');
  assert.equal(f.snapshot.progress.contracts.failures, 1);
  round(f, 'Roulette');
  assert.equal(f.snapshot.progress.contracts.failures, 1);
  const before = f.snapshot.balance;
  await act(f, 'contract-retry');
  assert.equal(f.snapshot.balance, before);
  assert.equal(f.snapshot.progress.contracts.status, 'active');
  assert.equal(f.snapshot.progress.contracts.attemptRounds, 0);
  assert.equal(f.snapshot.progress.contracts.attempts, 2);
  await act(f, 'contract-abandon');
  assert.equal(f.snapshot.balance, before);
  assert.equal(f.snapshot.progress.contracts.activeId, '');
  assert.equal(f.snapshot.progress.contracts.abandons, 1);
});

test('profile and settings accept cosmetic inputs while rejecting injected markup and invalid image URLs', async () => {
  const f = fixture();
  for (const args of [{name: '<script>'}, {name: 'x'.repeat(25)}, {picture: 'javascript:alert(1)'}, {picture: 'data:image/svg+xml;base64,AAAA'}, {style: 'admin'}, {tone: 'invalid'}]) {
    await assert.rejects(() => act(f, 'profile-save', args));
  }
  await act(f, 'profile-save', {profile: {name: 'Pilot', initial: 'p', style: 'motor', tone: 'gold', picture: '', level: 99, balance: 1e9}});
  assert.equal(f.snapshot.progress.profile.name, 'Pilot');
  assert.equal(f.snapshot.progress.profile.initial, 'P');
  assert.equal(f.snapshot.progress.level, 1);
  assert.equal(f.snapshot.balance, 1000);
  await assert.rejects(() => act(f, 'settings', {sound: 'false'}), /Invalid/);
  await assert.rejects(() => act(f, 'settings', {textSize: 'giant'}), /Invalid/);
  await act(f, 'settings', {sound: false, motion: false, textSize: 'large'});
  assert.deepEqual(f.snapshot.progress.profile.settings, {sound: false, motion: false, textSize: 'large'});
  await act(f, 'profile-save', {name: 'Captain'});
  assert.equal(f.snapshot.progress.profile.settings.sound, false);
});

test('reset requires explicit confirmation and clears all games while retaining profile and lifetime gift claims', async () => {
  const f = fixture({balance: 1000000});
  await act(f, 'profile-save', {name: 'Pilot'});
  await act(f, 'settings', {sound: false});
  await act(f, 'estate-upgrade', {venueId: 'terrace'});
  round(f, 'Blackjack', true);
  f.snapshot.progress.redeemedCodes = ['claimed-one'];
  f.privateState = {house: {redeemedCodeHashes: ['claimed-two'], rounds: {bj: {bet: 25}}}, football: {hidden: 'match'}, airport: {hidden: 'career'}};
  await assert.rejects(() => act(f, 'reset'), /Confirm/);
  await act(f, 'reset', {confirmation: 'Delete Progress'});
  assert.equal(f.snapshot.balance, 1000);
  assert.equal(f.snapshot.progress.profile.name, 'Pilot');
  assert.equal(f.snapshot.progress.profile.settings.sound, false);
  assert.equal(f.snapshot.stats.sessions, 0);
  assert.deepEqual(f.snapshot.history, []);
  assert.deepEqual(f.snapshot.progress.empire.venues, {});
  assert.equal(f.snapshot.progress.campaign, null);
  assert.equal(f.snapshot.progress.arrival.complete, false);
  assert.deepEqual(f.privateState, {house: {redeemedCodeHashes: ['claimed-two', 'claimed-one'], resetAt: NOW}});
});
