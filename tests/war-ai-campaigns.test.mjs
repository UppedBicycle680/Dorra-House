import test from 'node:test';
import assert from 'node:assert/strict';
import { checkWarAiCampaigns } from '../scripts/check-war-ai-campaigns.mjs';

test('real land and island solo campaigns finish through legal player commands and award one bounded reward', { timeout: 180000 }, async t => {
  // Four fixed policies on actual national budgets, equipment and geography.
  // This is a complete-flow regression, not a sample of human win rates.
  // Singapore previously stalled for the entire 240-hour observation budget
  // because its mapped port had no legal connection to Malaysia.
  const result = await checkWarAiCampaigns({ pairs: [['BE', 'NL'], ['BH', 'QA'], ['NZ', 'FJ'], ['SG', 'MY']], maxHours: 240 });
  assert.equal(result.ok, true, JSON.stringify(result.failure));
  assert.equal(result.reports.length, 4);
  assert.deepEqual(result.cleanup, { matches: 0, rewards: 0, actors: 0 }, 'Every scenario rolls back its users, world and wallet receipt');
  assert.equal(result.engineHashes.length, 5, 'Reports identify the actual compiled AI/combat/victory functions');

  for (const campaign of result.reports) await t.test(`${campaign.nation}/${campaign.rival} naturally completes with normal budgets and queues`, () => {
    assert.equal(campaign.status, 'finished', JSON.stringify(campaign.timeline.at(-1)));
    assert.equal(campaign.termination, 'capital-hold', 'The scenario must capture and hold capitals before its observation budget; it cannot force a private finish');
    assert.ok(campaign.hours >= 24 && campaign.hours < 240);
    assert.ok([campaign.nation, campaign.rival].includes(campaign.victory.winner));
    assert.equal(campaign.schedulerErrors, 0);
    assert.deepEqual(campaign.rejections, { REWARD_ALREADY_CLAIMED: 1 }, 'Every operational intention passes the normal public validator');
    for (const intention of ['create', 'start', 'order', 'research', 'build', 'produce', 'reward']) assert.ok(campaign.commands[intention] > 0, intention);
    assert.equal(campaign.reward.amount, campaign.victory.won ? 1000 : 250);
    assert.equal(campaign.walletDelta, campaign.reward.amount);
    assert.equal(campaign.rewardRecords, 1);
    assert.equal(campaign.repeatRewardRejected, true);

    assert.notEqual(campaign.initialSides[0].resources.cash, campaign.initialSides[1].resources.cash, 'Authored national asymmetry is retained');
    for (const minimum of Object.values(campaign.budget.minimumResources)) for (const amount of Object.values(minimum)) assert.ok(Number.isFinite(amount) && amount >= 0, 'Neither side receives an overdraft or free resources');
    for (const count of Object.values(campaign.budget.maximumFormations)) assert.ok(count <= 80, 'Both sides retain the hard formation cap');
    for (const count of Object.values(campaign.budget.maximumResearchQueue)) assert.ok(count <= 2, 'Both sides retain ordinary research concurrency');
    for (const side of campaign.finalSides) for (const amount of Object.values(side.resources)) assert.ok(Number.isFinite(amount) && amount >= 0);
    for (const unit of campaign.finalForces) {
      assert.match(String(unit.health), /^\d+(?:\.\d{1,6})?$/, 'Long campaigns retain bounded health precision');
      assert.ok(Number(unit.health) > 0 && Number(unit.health) <= 100);
    }
    const aiActivity = campaign.activity.filter(row => row.nation_id === campaign.rival);
    for (const type of ['research-complete', 'produce-complete', 'arrival']) assert.ok(aiActivity.some(row => row.type === type && row.count > 0), `The real AI must exercise ${type}`);
    assert.ok(campaign.activity.some(row => row.type === 'capture' && row.count > 0), 'Completion follows actual territory capture');
    assert.ok(campaign.movementCounts.attack > 0);
    if (campaign.nation !== 'BE') assert.ok(campaign.movementCounts.embark > 0, 'Island completion traverses real port/water routes through the public embark command');
  });
});
