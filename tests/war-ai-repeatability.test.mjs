import test from 'node:test';
import assert from 'node:assert/strict';
import { warDatabase } from './war-database-helpers.mjs';
import { mirrorScenario } from '../scripts/check-war-ai-balance.mjs';

test('the controlled AI balance harness repeats its decisions and outcomes with stable fixture identifiers', { timeout: 120000 }, async () => {
  const db = await warDatabase();
  try {
    const first = await mirrorScenario(db, { difficulty: 'standard', firstMover: 'A', hours: 18 });
    const second = await mirrorScenario(db, { difficulty: 'standard', firstMover: 'A', hours: 18 });
    const comparable = ({ decisionMs, ...scenario }) => scenario;
    assert.deepEqual(comparable(second), comparable(first), 'Changing wall-clock speed or UUID draws cannot masquerade as a balance change in the controlled harness');
    assert.equal(first.startingConditions.provincesPerSide, 3);
    assert.equal(first.startingConditions.formationsPerSide, 4);
    assert.equal(first.sides.reduce((n, side) => n + side.provinces, 0), 6);
    assert.ok(first.decisions >= 4, 'The sample exercises several real AI decisions, not just world construction');
    assert.ok(first.actionCounts.produce > 0 && first.actionCounts.arrival > 0, 'Repeatability covers mobilization and movement');
  } finally { await db.close(); }
});
