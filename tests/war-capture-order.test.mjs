import test from 'node:test';
import assert from 'node:assert/strict';
import { warDatabase } from './war-database-helpers.mjs';
import { isolatedAiScenario } from './war-ai-fixtures.mjs';

test('a capture during incoming attack validation rolls back, then ordinary dispatch commits it before an explicit reinforcement move', { timeout: 120000 }, async () => {
  const db = await warDatabase();
  try {
    await isolatedAiScenario(db, {}, async f => {
      const sid = crypto.randomUUID(), lease = crypto.randomUUID();
      await db.query('insert into auth.sessions(id,user_id) values($1,$2)', [sid, f.host]);
      await db.query('insert into dorra_private.profiles(user_id) values($1)', [f.host]);
      await db.query(`insert into dorra_private.player_state(user_id,auth_session_id,lease_id,snapshot)
        values($1,$2,$3,'{"balance":1000,"progress":{}}')`, [f.host, sid, lease]);
      await db.query('update dorra_private.war_sides set is_ai=false,active_ai=false where match_id=$1', [f.mid]);
      await db.query('update dorra_private.war_sides set user_id=$2 where match_id=$1 and nation_id=$3', [f.mid, f.host, f.a]);
      // One existing attacker wins the next ordinary combat pulse while a
      // different formation's human order is in flight. No capture is installed.
      await f.unit('__ai-armor', 'BH', f.a, { strength: 2 });
      const defender = await f.unit('__ai-infantry', 'BH', f.b, { health: 0.1 });
      const reinforcement = await f.unit('__ai-infantry', 'AF');
      await db.query("insert into dorra_private.war_events(match_id,kind,due) values($1,'combat',3600)", [f.mid]);
      await db.query(`update dorra_private.war_matches set game_anchor=3601,real_anchor=clock_timestamp()+interval '1 hour',
        last_dispatch=clock_timestamp(),next_due=clock_timestamp() where id=$1`, [f.mid]);
      const command = async (action, args = {}, requestId = null) => {
        await db.exec('savepoint capture_order_command');
        try {
          const value = (await db.query('select public.dorra_war_command($1,$2,$3,$4,$5,$6,$7) r', [f.host, sid, lease, action, f.mid, JSON.stringify(args), requestId])).rows[0].r;
          await db.exec('release savepoint capture_order_command'); return value;
        } catch (error) {
          await db.exec('rollback to savepoint capture_order_command'); await db.exec('release savepoint capture_order_command'); throw error;
        }
      };
      const owner = async () => (await db.query('select nation_id owner from dorra_private.war_provinces where match_id=$1 and province_id=$2', [f.mid, f.pid('BH')])).rows[0].owner;
      const captureCount = async () => (await db.query("select count(*)::int n from dorra_private.war_reports where match_id=$1 and body->>'type'='capture' and body->>'provinceId'=$2", [f.mid, f.pid('BH')])).rows[0].n;
      const attackId = crypto.randomUUID();
      await assert.rejects(command('order', { type: 'attack', unitIds: [reinforcement], targetProvinceId: f.pid('BH') }, attackId), /DECLARE_WAR_FIRST/);
      assert.equal(await owner(), f.b, 'Rejected incoming attack rolls back the preceding authoritative capture');
      assert.equal(await captureCount(), 0, 'The rejected transaction also rolls back its capture report');
      assert.ok(await f.getUnit(defender), 'The same rollback restores the defeated defender');
      assert.equal((await db.query('select count(*)::int n from dorra_private.war_requests where user_id=$1 and request_id=$2', [f.host, attackId])).rows[0].n, 0);
      assert.deepEqual((await f.getUnit(reinforcement)).orders, {});

      await db.exec('select dorra_private.war_dispatch()');
      assert.equal(await owner(), f.a, 'The ordinary scheduler independently commits the real combat capture');
      assert.equal(await captureCount(), 1); assert.equal(await f.getUnit(defender), undefined);
      const refreshed = (await command('view')).view;
      assert.equal(refreshed.provinces.find(province => province.id === f.pid('BH')).ownerId, f.a, 'A fresh filtered view proves friendly ownership');
      assert.equal((await db.query('select dorra_private.war_relation($1,$2,$3) relation', [f.mid, f.a, f.b])).rows[0].relation, 'war', 'This race requires no peace or alliance change');

      const moveId = crypto.randomUUID(); assert.notEqual(moveId, attackId);
      const args = { type: 'move', unitIds: [reinforcement], targetProvinceId: f.pid('BH') };
      await command('order', args, moveId);
      const first = await f.getUnit(reinforcement), fuel = (await f.side()).resources.fuel;
      assert.equal(first.orders.type, 'move'); assert.equal(first.orders.targetProvinceId, f.pid('BH'));
      assert.equal((await command('order', args, moveId)).replayed, true);
      assert.equal((await f.getUnit(reinforcement)).generation, first.generation, 'A replay cannot restart the reviewed reinforcement move');
      assert.equal((await f.side()).resources.fuel, fuel, 'The reinforcement move pays its normal fuel cost once');
      assert.equal((await db.query("select count(*)::int n from dorra_private.war_events where match_id=$1 and kind='arrival' and payload->>'unitId'=$2", [f.mid, reinforcement])).rows[0].n, 1);
      assert.equal(await captureCount(), 1);
      assert.equal((await db.query('select count(*)::int n from dorra_private.war_gold_ledger')).rows[0].n, 0);
    });
  } finally { await db.close(); }
});
