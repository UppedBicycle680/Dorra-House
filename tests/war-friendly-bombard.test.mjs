import test from 'node:test';
import assert from 'node:assert/strict';
import { warDatabase } from './war-database-helpers.mjs';
import { isolatedAiScenario } from './war-ai-fixtures.mjs';

test('public and AI stationary bombardment can defend friendly territory using a real visible hostile contact', { timeout: 120000 }, async t => {
  const db = await warDatabase();
  const scenario = run => isolatedAiScenario(db, {}, async f => {
    const sid = 'f7400000-0000-4000-8000-000000000001', lease = 'f7400000-0000-4000-8000-000000000002';
    await db.query('insert into auth.sessions(id,user_id) values($1,$2)', [sid, f.host]);
    await db.query('insert into dorra_private.profiles(user_id) values($1)', [f.host]);
    await db.query("insert into dorra_private.player_state(user_id,auth_session_id,lease_id,snapshot) values($1,$2,$3,'{\"balance\":1000,\"progress\":{}}')", [f.host, sid, lease]);
    await db.query('update dorra_private.war_sides set user_id=$2,is_ai=false,active_ai=false where match_id=$1 and nation_id=$3', [f.mid, f.host, f.a]);
    await db.query("insert into dorra_private.war_catalog_nations(id,name,data) values('C','Friendly ally','{\"capitalProvinceId\":\"__ai-AP\"}')");
    await db.query("insert into dorra_private.war_sides(match_id,nation_id,is_ai) values($1,'C',false)", [f.mid]);
    await db.query("insert into dorra_private.war_relations(match_id,a,b,relation) values($1,'A','C','alliance')", [f.mid]);
    const fire = async (id, province, targetUnitId = undefined) => {
      await db.exec('savepoint public_bombard');
      try {
        const value = await db.query('select public.dorra_war_command($1,$2,$3,$4,$5,$6,$7) result', [f.host, sid, lease, 'order', f.mid, JSON.stringify({ type: 'bombard', unitIds: [id], targetProvinceId: f.pid(province), ...(targetUnitId ? { targetUnitId } : {}) }), crypto.randomUUID()]);
        await db.exec('release savepoint public_bombard'); return value;
      } catch (error) { await db.exec('rollback to savepoint public_bombard'); await db.exec('release savepoint public_bombard'); throw error; }
    };
    const privateFire = async (id, province, target) => (await db.query("select dorra_private.war_ai_try_order($1,$2,$3,'bombard',$4,0,$5) accepted", [f.mid, f.a, id, f.pid(province), target])).rows[0].accepted;
    return run({ ...f, fire, privateFire });
  });
  try {
    await t.test('player artillery damages a hostile in its own province while friendly formations are unharmed', () => scenario(async f => {
      const guns = await f.unit('__ai-artillery', 'AF'), enemy = await f.unit('__ai-armor', 'AH', f.b), friendly = await f.unit('__ai-infantry', 'AH');
      const balance = Number((await db.query("select snapshot->>'balance' balance from dorra_private.player_state where user_id=$1", [f.host])).rows[0].balance);
      await db.exec('savepoint without_defensive_fire');
      await db.query('select dorra_private.war_combat($1,3600)', [f.mid]);
      const controlEnemy = Number((await f.getUnit(enemy)).health), controlFriendly = Number((await f.getUnit(friendly)).health);
      await db.exec('rollback to savepoint without_defensive_fire'); await db.exec('release savepoint without_defensive_fire');
      await f.fire(guns, 'AH', enemy); assert.equal((await f.getUnit(guns)).orders.type, 'bombard');
      await db.query('select dorra_private.war_combat($1,3600)', [f.mid]);
      assert.ok(Number((await f.getUnit(enemy)).health) < controlEnemy, 'The accepted order must add a real defensive combat effect');
      assert.equal(Number((await f.getUnit(friendly)).health), controlFriendly, 'Defensive bombardment adds no friendly damage beyond the hostile formation’s ordinary retaliation');
      assert.equal(Number((await db.query("select snapshot->>'balance' balance from dorra_private.player_state where user_id=$1", [f.host])).rows[0].balance), balance, 'Defensive orders do not alter the House wallet');
    }));

    await t.test('AI uses the same validated artillery and naval defensive orders', () => scenario(async f => {
      const guns = await f.unit('__ai-artillery', 'AF'), enemy = await f.unit('__ai-armor', 'AH', f.b);
      await db.query('update dorra_private.war_sides set user_id=null,is_ai=true,active_ai=true where match_id=$1 and nation_id=$2', [f.mid, f.a]);
      assert.equal(await f.privateFire(guns, 'AH', enemy), true);
      const ship = await f.unit('__ai-frigate', 'AP'), invader = await f.unit('__ai-infantry', 'AP', f.b);
      assert.equal(await f.privateFire(ship, 'AP', invader), true);
      assert.equal((await f.getUnit(ship)).orders.targetProvinceId, f.pid('AP'));
    }));

    await t.test('visible hostile contacts in allied provinces can be engaged without changing the alliance', () => scenario(async f => {
      const guns = await f.unit('__ai-artillery'), enemy = await f.unit('__ai-armor', 'AP', f.b);
      await db.query("update dorra_private.war_provinces set nation_id='C' where match_id=$1 and province_id=$2", [f.mid, f.pid('AP')]);
      await f.fire(guns, 'AP', enemy);
      assert.equal((await f.getUnit(guns)).orders.targetProvinceId, f.pid('AP'));
      assert.equal((await db.query("select dorra_private.war_relation($1,'A','C') relation", [f.mid])).rows[0].relation, 'alliance');
    }));

    await t.test('explicit neutral, friendly, incompatible and dead targets are rejected', () => scenario(async f => {
      const guns = await f.unit('__ai-artillery', 'AF');
      for (const [platform, nation, health, relation] of [['__ai-infantry', f.a, 100], ['__ai-infantry', 'C', 100, 'peace'], ['__ai-infantry', 'C', 100, 'alliance'], ['__ai-fighter', f.b, 100], ['__ai-infantry', f.b, 0]]) {
        if (relation) await db.query('update dorra_private.war_relations set relation=$2 where match_id=$1 and a=\'A\' and b=\'C\'', [f.mid, relation]);
        const target = await f.unit(platform, 'AH', nation, { health });
        await assert.rejects(f.fire(guns, 'AH', target), /NO_VALID_TARGET/);
        assert.deepEqual((await f.getUnit(guns)).orders, {});
        assert.equal(await f.privateFire(guns, 'AH', target), false);
      }
    }));

    await t.test('a province name alone or an absent contact cannot authorize friendly-territory fire', () => scenario(async f => {
      const guns = await f.unit('__ai-artillery', 'AF');
      await assert.rejects(f.fire(guns, 'AH'), /DECLARE_WAR_FIRST/);
      await f.unit('__ai-infantry', 'AH', f.b);
      await assert.rejects(f.fire(guns, 'AH'), /DECLARE_WAR_FIRST/, 'The visible hostile must be explicitly selected');
      await assert.rejects(f.fire(guns, 'AH', crypto.randomUUID()), /TARGET_NOT_VISIBLE/);
      assert.deepEqual((await f.getUnit(guns)).orders, {});
    }));

    await t.test('hidden contacts in allied territory and contacts outside weapon range remain unavailable', () => scenario(async f => {
      const guns = await f.unit('__ai-artillery'), hidden = await f.unit('__ai-infantry', 'BX', f.b);
      await db.query("update dorra_private.war_provinces set nation_id='C' where match_id=$1 and province_id=$2", [f.mid, f.pid('BX')]);
      await assert.rejects(f.fire(guns, 'BX', hidden), /TARGET_NOT_VISIBLE/);
      const far = await f.unit('__ai-infantry', 'AP', f.b);
      await db.query("update dorra_private.war_provinces set nation_id='C' where match_id=$1 and province_id=$2", [f.mid, f.pid('AP')]);
      await db.query("update dorra_private.war_catalog_platforms set data=jsonb_set(data,'{stats,range}','10') where id='__ai-artillery'");
      await assert.rejects(f.fire(guns, 'AP', far), /OUT_OF_RANGE/);
    }));

    await t.test('an explicit hostile is required to remain at war and neutral territory remains closed', () => scenario(async f => {
      const guns = await f.unit('__ai-artillery', 'AF'), target = await f.unit('__ai-infantry', 'AH', f.b);
      await db.query("update dorra_private.war_relations set relation='ceasefire' where match_id=$1 and a='A' and b='B'", [f.mid]);
      await assert.rejects(f.fire(guns, 'AH', target), /NO_VALID_TARGET/);
      await db.query("update dorra_private.war_relations set relation='war' where match_id=$1 and a='A' and b='B'", [f.mid]);
      await db.query("update dorra_private.war_relations set relation='peace' where match_id=$1 and a='A' and b='C'", [f.mid]);
      await db.query("update dorra_private.war_provinces set nation_id='C' where match_id=$1 and province_id=$2", [f.mid, f.pid('AH')]);
      await assert.rejects(f.fire(guns, 'AH', target), /DECLARE_WAR_FIRST/);
    }));

    await t.test('ordinary hostile-province bombardment and private helper permissions retain their contract', () => scenario(async f => {
      const guns = await f.unit('__ai-artillery'); await f.fire(guns, 'BF');
      assert.equal((await f.getUnit(guns)).orders.type, 'bombard');
      const { rows } = await db.query("select has_function_privilege('authenticated','dorra_private.war_order_command(uuid,text,jsonb,numeric)','execute') player,has_function_privilege('service_role','dorra_private.war_order_command(uuid,text,jsonb,numeric)','execute') service");
      assert.equal(rows[0].player, false); assert.equal(rows[0].service, true);
    }));
  } finally { await db.close(); }
});
