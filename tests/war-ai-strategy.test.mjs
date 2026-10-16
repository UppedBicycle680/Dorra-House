import test from 'node:test';
import assert from 'node:assert/strict';
import { warDatabase } from './war-database-helpers.mjs';
import { AI_PLATFORMS, AI_RESOURCES, isolatedAiScenario } from './war-ai-fixtures.mjs';

const resources = value => Object.fromEntries(Object.entries(value).map(([k, v]) => [k, Number(v)]));
const queueKinds = new Set(['research', 'build', 'produce']);

test('solo AI makes bounded, legal and information-fair strategy decisions', { timeout: 120000 }, async t => {
  const db = await warDatabase();
  try {
    await t.test('difficulty changes decision cadence and commitment without free combat or economic modifiers', async () => {
      const profiles = [];
      for (const difficulty of ['recruit', 'standard', 'veteran']) profiles.push((await db.query('select dorra_private.war_ai_profile($1) profile', [difficulty])).rows[0].profile);
      assert.deepEqual(profiles.map(p => Number(p.cadenceSeconds)), [43200, 21600, 10800]);
      assert.deepEqual(profiles.map(p => Number(p.maneuvers)), [2, 4, 6]);
      assert.ok(profiles.every(p => Number(p.initialDelaySeconds) === 3600), 'Every difficulty retains the opening preparation window');
      assert.ok(profiles.every(p => Object.keys(p).every(k => ['cadenceSeconds', 'maneuvers', 'initialDelaySeconds'].includes(k))), 'Difficulty must not introduce hidden damage, income or resource multipliers');
    });

    await t.test('a capital retains a usable garrison while surplus troops react to a visible frontier', () => isolatedAiScenario(db, {}, async f => {
      const garrison = [await f.unit(), await f.unit('__ai-armor')];
      await f.unit('__ai-infantry', 'AF'); await f.unit('__ai-armor', 'BF', f.b);
      await f.decide();
      const stationed = await Promise.all(garrison.map(f.getUnit));
      assert.ok(stationed.some(u => u.province_id === f.pid('AH') && (!u.orders.type || u.orders.targetProvinceId === f.pid('AH'))), 'Sending every fit formation away exposes the national capital');
      const orders = (await f.decisions()).units.filter(u => u.orders.type);
      assert.ok(orders.length > 0, 'The reserve rule must not leave all surplus troops idle');
      assert.ok(orders.length <= 4, 'Standard AI has a bounded maneuver budget');
    }));

    await t.test('an outmatched damaged formation retreats through a legal route to friendly territory', () => isolatedAiScenario(db, {}, async f => {
      await f.unit(); const damaged = await f.unit('__ai-infantry', 'AF', f.a, { health: 20 });
      await f.unit('__ai-armor', 'BF', f.b, { strength: 4 });
      await f.decide(); const u = await f.getUnit(damaged);
      assert.equal(u.orders.type, 'retreat');
      assert.equal(u.orders.targetProvinceId, f.pid('AH'));
      assert.deepEqual(u.orders.path, [f.pid('AF'), f.pid('AH')]);
      assert.ok(Number((await f.side()).resources.fuel) < AI_RESOURCES.fuel, 'A retreat pays the same movement fuel cost as a player');
    }));

    await t.test('adding a hidden hostile army cannot alter tactical orders, spending or queue choices', () => isolatedAiScenario(db, {}, async f => {
      await f.unit(); await f.unit('__ai-armor', 'AF'); await f.unit('__ai-infantry', 'BF', f.b);
      await db.exec('savepoint before_ai'); await f.decide(); const baseline = await f.decisions();
      await db.exec('rollback to savepoint before_ai');
      const hidden = await f.unit('__ai-armor', 'BX', f.b, { strength: 100 });
      assert.equal((await db.query('select exists(select 1 from dorra_private.war_visible_units($1,$2) where id=$3) visible', [f.mid, f.a, hidden])).rows[0].visible, false);
      await f.decide(); assert.deepEqual(await f.decisions(), baseline, 'AI may use public borders and capitals, never hidden enemy unit totals or positions');
    }));

    await t.test('visible enemy contact does not reveal private orders to AI planning', () => isolatedAiScenario(db, {}, async f => {
      const missile = { id: '__ai-anti-ship-missile', domain: 'missile', branch: 'missiles', operators: ['A', 'B'], capabilities: ['anti-ship'], facility: 'missile-site', level: 1, cost: { cash: 1000, electronics: 100 }, stats: { attack: 40, defense: 1, range: 300, speed: 1500, vision: 40 } };
      await db.query('insert into dorra_private.war_catalog_platforms(id,name,data) values($1,$1,$2)', [missile.id, JSON.stringify(missile)]);
      await f.unit(); await f.unit('__ai-armor', 'AF'); await f.unit(missile.id);
      const contact = await f.unit('__ai-infantry', 'BF', f.b);
      assert.equal((await db.query('select exists(select 1 from dorra_private.war_visible_units($1,$2) where id=$3) visible', [f.mid, f.a, contact])).rows[0].visible, true);
      await db.exec('savepoint visible_contact'); await f.decide(); const baseline = await f.decisions();
      await db.exec('rollback to savepoint visible_contact');
      await db.query('update dorra_private.war_units set orders=$2 where id=$1', [contact, JSON.stringify({ type: 'embark', embarked: true, targetProvinceId: f.pid('AH'), arrival: 99999 })]);
      await f.decide(); assert.deepEqual(await f.decisions(), baseline, 'A hidden embark order cannot turn a visible land contact into a planning target for an anti-ship missile');
    }));

    await t.test('surviving forces can retake a capital after all territory is lost', () => isolatedAiScenario(db, {}, async f => {
      const survivor = await f.unit('__ai-infantry', 'AF', f.a, { health: 25 });
      await db.query('update dorra_private.war_provinces set nation_id=$2 where match_id=$1', [f.mid, f.b]);
      const before = resources((await f.side()).resources);
      await f.decide(); const u = await f.getUnit(survivor);
      assert.equal(u.orders.type, 'attack'); assert.equal(u.orders.targetProvinceId, f.pid('AH'));
      assert.equal((await f.events()).filter(e => queueKinds.has(e.kind)).length, 0, 'Without an owned site the AI cannot invent research or production infrastructure');
      const after = resources((await f.side()).resources);
      assert.ok(Object.entries(after).every(([k, v]) => v <= before[k]), 'A homeless surviving army receives no decision-only resource grant');
      await f.advance(Number(u.orders.arrival) + 1);
      assert.equal((await db.query('select nation_id from dorra_private.war_provinces where match_id=$1 and province_id=$2', [f.mid, f.pid('AH')])).rows[0].nation_id, f.a);
    }));

    await t.test('research and construction obey the same laboratory, prerequisites, arsenals, queue slots and prices as players', () => isolatedAiScenario(db, { facilities: { 'army-base': 1 }, researched: false }, async f => {
      await db.query("update dorra_private.war_relations set relation='ceasefire' where match_id=$1", [f.mid]);
      const before = resources((await f.side()).resources);
      for (let i = 0; i < 6; i++) await f.decide();
      const events = (await f.events()).filter(e => queueKinds.has(e.kind));
      assert.ok(events.some(e => e.kind === 'build'), 'An undeveloped AI nation should invest in usable facilities');
      assert.equal(events.filter(e => e.kind === 'research').length, 0, 'Research cannot bypass the intelligence-center requirement');
      assert.equal(events.filter(e => e.kind === 'produce').length, 0, 'Unresearched formations cannot be mobilized');
      const construction = new Set(); const expected = { ...before };
      for (const event of events) {
        assert.equal(event.kind, 'build');
        assert.ok(!construction.has(event.payload.provinceId), 'Only one construction job per province'); construction.add(event.payload.provinceId);
        const p = (await db.query('select facilities from dorra_private.war_provinces where match_id=$1 and province_id=$2', [f.mid, event.payload.provinceId])).rows[0];
        const next = Number(p.facilities[event.payload.facility] || 0) + 1;
        assert.equal(Number(event.due), 6 * next * 3600);
        for (const [key, value] of Object.entries({ cash: 1500 * next, supplies: 500 * next, electronics: 200 * next, manpower: 100 })) expected[key] -= value;
      }
      assert.deepEqual(resources((await f.side()).resources), expected, 'Each queued construction job must be paid exactly once');
      assert.ok(Object.values(expected).every(n => n >= 0));
    }));

    await t.test('research and production pay exact catalogue costs and never queue forbidden or duplicate jobs', () => isolatedAiScenario(db, { researched: false }, async f => {
      await db.query("update dorra_private.war_relations set relation='ceasefire' where match_id=$1", [f.mid]);
      await db.query('update dorra_private.war_sides set research=$3 where match_id=$1 and nation_id=$2', [f.mid, f.a, JSON.stringify(['__ai-infantry', '__ai-armor'])]);
      const expected = resources((await f.side()).resources);
      for (let i = 0; i < 8; i++) await f.decide();
      const jobs = (await f.events()).filter(e => queueKinds.has(e.kind)), research = jobs.filter(e => e.kind === 'research'), production = jobs.filter(e => e.kind === 'produce');
      assert.ok(research.length > 0 && research.length <= 2); assert.ok(production.length > 0);
      assert.equal(new Set(research.map(e => e.payload.platformId)).size, research.length, 'A programme is researched once');
      assert.equal(new Set(production.map(e => e.payload.provinceId)).size, production.length, 'One formation queue per province');
      for (const job of jobs) {
        const p = AI_PLATFORMS.find(p => p.id === job.payload.platformId);
        if (job.kind === 'build') {
          const facilities = (await db.query('select facilities from dorra_private.war_provinces where match_id=$1 and province_id=$2', [f.mid, job.payload.provinceId])).rows[0].facilities;
          const next = Number(facilities[job.payload.facility] || 0) + 1;
          for (const [key, value] of Object.entries({ cash: 1500 * next, supplies: 500 * next, electronics: 200 * next, manpower: 100 })) expected[key] -= value;
          continue;
        }
        assert.ok(p && !['__ai-foreign', '__ai-nuclear', '__ai-locked'].includes(p.id), 'National eligibility and prerequisites apply to every queued platform');
        const facilities = (await db.query('select facilities from dorra_private.war_provinces where match_id=$1 and province_id=$2', [f.mid, job.payload.provinceId || f.pid('AH')])).rows[0].facilities;
        assert.ok(Number(facilities[p.facility] || 0) >= p.level, 'Queued programmes and formations require their facility level');
        const charge = job.kind === 'research' ? { cash: Math.max(200, p.cost.cash * .25), electronics: Math.max(100, p.cost.electronics * .5) } : p.cost;
        for (const [key, value] of Object.entries(charge)) expected[key] -= value;
        assert.equal(Number(job.due), (job.kind === 'research' ? p.researchHours : p.buildHours) * 3600);
      }
      assert.deepEqual(resources((await f.side()).resources), expected);
      assert.ok(Object.values(expected).every(n => n >= 0));
    }));

    await t.test('resource exhaustion, occupied queues and inactive neutrals cannot create free formations', () => isolatedAiScenario(db, { resources: { cash: 0, supplies: 0, fuel: 0, electronics: 0, manpower: 0 } }, async f => {
      const stationary = await f.unit(); await f.unit('__ai-armor', 'AF');
      await f.decide(); assert.deepEqual((await f.getUnit(stationary)).orders, {});
      assert.equal((await f.events()).filter(e => queueKinds.has(e.kind)).length, 0);
      assert.deepEqual(resources((await f.side()).resources), { cash: 0, supplies: 0, fuel: 0, electronics: 0, manpower: 0 });
      await db.query('update dorra_private.war_sides set active_ai=false where match_id=$1 and nation_id=$2', [f.mid, f.a]);
      const before = await f.decisions(); await f.decide(f.a, 86400);
      assert.deepEqual(await f.decisions(), before, 'Inactive neutral nations must not run strategic AI or gain decision-only income');
    }));

    await t.test('a ceasefire is honored and war awareness does not depend on a hard-coded rival', () => isolatedAiScenario(db, {}, async f => {
      await f.unit(); await f.unit('__ai-armor', 'AF'); await f.unit('__ai-infantry', 'BF', f.b);
      await db.query("update dorra_private.war_relations set relation='ceasefire' where match_id=$1", [f.mid]);
      await f.decide();
      assert.equal((await db.query('select relation from dorra_private.war_relations where match_id=$1', [f.mid])).rows[0].relation, 'ceasefire');
      assert.ok((await f.decisions()).units.every(u => !['attack', 'embark', 'bombard'].includes(u.orders.type)), 'An accepted truce cannot be immediately undone');
      await db.query("update dorra_private.war_relations set relation='war' where match_id=$1", [f.mid]);
      await db.query('update dorra_private.war_sides set enemy_nation_id=null where match_id=$1 and nation_id=$2', [f.mid, f.a]);
      await f.decide();
      assert.ok((await f.decisions()).units.some(u => ['attack', 'bombard', 'embark'].includes(u.orders.type)), 'AI should recognize an actual hostile relation even when no original rival is set');
    }));

    await t.test('active opponents assess diplomatic offers instead of granting an automatic opening truce', () => isolatedAiScenario(db, {}, async f => {
      await f.unit(); await f.unit('__ai-armor', 'AF'); await f.unit('__ai-infantry', 'AP');
      await db.query("update dorra_private.war_relations set proposal='peace',proposed_by=$2 where match_id=$1", [f.mid, f.b]);
      await f.decide();
      let relation = (await db.query('select relation,proposal from dorra_private.war_relations where match_id=$1', [f.mid])).rows[0];
      assert.equal(relation.relation, 'war', 'A healthy rival should not abandon the match simply because the player requests peace'); assert.equal(relation.proposal, null);
      await db.query("update dorra_private.war_sides set resources=jsonb_set(resources,'{fuel}','0') where match_id=$1 and nation_id=$2", [f.mid, f.a]);
      await db.query("update dorra_private.war_relations set proposal='ceasefire',proposed_by=$2 where match_id=$1", [f.mid, f.b]);
      await f.decide(); relation = (await db.query('select relation,proposal from dorra_private.war_relations where match_id=$1', [f.mid])).rows[0];
      assert.equal(relation.relation, 'ceasefire', 'An opponent with exhausted operational fuel can accept a credible ceasefire'); assert.equal(relation.proposal, null);
    }));

    await t.test('mobilization fills missing combat roles rather than repeating only the largest attack value', () => isolatedAiScenario(db, {}, async f => {
      for (const [p, province] of [['__ai-infantry', 'AH'], ['__ai-infantry', 'AH'], ['__ai-infantry', 'AP'], ['__ai-armor', 'AF'], ['__ai-armor', 'AF']]) await f.unit(p, province);
      await db.query("update dorra_private.war_relations set relation='ceasefire' where match_id=$1", [f.mid]);
      const mobilized = [];
      for (let turn = 0; turn < 4; turn++) {
        await f.decide(f.a, turn * 21600);
        mobilized.push(...(await f.events()).filter(e => e.kind === 'produce').map(e => e.payload.platformId));
        await f.advance((turn + 1) * 21600 + 1);
      }
      const roles = new Set(mobilized.map(id => AI_PLATFORMS.find(p => p.id === id)?.branch));
      assert.ok(roles.size >= 2, 'An established infantry/armor force should invest in more than one missing role');
      assert.ok(mobilized.every(id => !['__ai-foreign', '__ai-nuclear', '__ai-locked', '__ai-doctrine'].includes(id)));
    }));

    await t.test('island assaults use real port edges while air and naval forces receive valid role orders', () => isolatedAiScenario(db, { island: true }, async f => {
      await f.unit(); const landing = await f.unit('__ai-armor', 'AP');
      const ship = await f.unit('__ai-frigate', 'AP'); const aircraft = await f.unit('__ai-strike', 'AH');
      await f.unit('__ai-infantry', 'BF', f.b);
      await f.decide();
      const transport = await f.getUnit(landing);
      assert.equal(transport.orders.type, 'embark'); assert.equal(transport.orders.targetProvinceId, f.pid('BP'));
      assert.deepEqual(transport.orders.path, [f.pid('AP'), f.pid('BP')], 'An island assault cannot invent a land edge across the ocean');
      const navy = await f.getUnit(ship), air = await f.getUnit(aircraft);
      assert.ok(navy.orders.type, 'A usable warship should not be ignored by land-only strategy');
      assert.ok(air.orders.type, 'A based strike aircraft should support a detected battle');
      assert.equal(air.orders.airMission, true, 'Air orders must pass through ordinary basing and sortie rules');
    }));

    await t.test('artillery uses visible ranged targets and air defense retains an interception stance', () => isolatedAiScenario(db, {}, async f => {
      await f.unit(); const guns = await f.unit('__ai-artillery', 'AF'), sam = await f.unit('__ai-sam');
      await f.unit('__ai-armor', 'BF', f.b); await f.unit('__ai-fighter', 'BF', f.b);
      await f.decide();
      assert.equal((await f.getUnit(guns)).orders.type, 'bombard');
      assert.equal((await f.getUnit(guns)).orders.targetProvinceId, f.pid('BF'));
      assert.equal((await f.getUnit(sam)).orders.type, 'intercept');
      await f.decide(); assert.equal((await f.getUnit(sam)).orders.type, 'intercept', 'The next decision preserves a valid defensive stance');
    }));

    await t.test('many air or naval opportunities cannot consume every ground maneuver slot', async () => {
      for (const domain of ['air', 'sea']) await isolatedAiScenario(db, { island: domain === 'sea' }, async f => {
        await f.unit(); const ground = await f.unit('__ai-armor', domain === 'sea' ? 'AP' : 'AF');
        for (let i = 0; i < 6; i++) await f.unit(domain === 'air' ? '__ai-strike' : '__ai-frigate', domain === 'air' ? 'AH' : 'AP');
        await f.unit('__ai-infantry', 'BF', f.b);
        await f.decide(); const u = await f.getUnit(ground);
        assert.equal(u.orders.type, domain === 'sea' ? 'embark' : 'attack', 'The ground campaign must receive a bounded share of the coordinated order budget');
        const ordered = (await f.decisions()).units.filter(u => u.orders.type);
        assert.ok(ordered.length <= 4, 'Coordination must fit inside Standard’s existing budget');
        assert.ok(ordered.filter(u => u.platform_id === (domain === 'air' ? '__ai-strike' : '__ai-frigate')).length <= 3);
      });
    });

    await t.test('stale artillery and ship bombardments redeploy legally when targets leave or a truce begins', async () => {
      for (const relation of ['war', 'ceasefire']) await isolatedAiScenario(db, {}, async f => {
        await f.unit();
        // A second genuine owned port lets the ordinary sea-route validator
        // accept retreat. Without a reachable port holding would be legitimate.
        await db.query("update dorra_private.war_catalog_provinces set data=data||jsonb_build_object('port',true,'seaNeighbors',jsonb_build_array($2::text)) where id=$1", [f.pid('AF'), f.pid('AP')]);
        await db.query("update dorra_private.war_catalog_provinces set data=jsonb_set(data,'{seaNeighbors}',(data->'seaNeighbors')||jsonb_build_array($2::text)) where id=$1", [f.pid('AP'), f.pid('AF')]);
        const guns = await f.unit('__ai-artillery', 'AF', f.a, { orders: { type: 'bombard', targetProvinceId: f.pid('BF') } });
        const ship = await f.unit('__ai-frigate', 'AP', f.a, { orders: { type: 'bombard', targetProvinceId: f.pid('BP') } });
        await db.query('update dorra_private.war_relations set relation=$2 where match_id=$1', [f.mid, relation]);
        await f.decide();
        for (const id of [guns, ship]) {
          const u = await f.getUnit(id); assert.equal(u.orders.type, 'retreat', 'An empty stationary bombard order must not freeze a formation forever');
          const owner = (await db.query('select nation_id from dorra_private.war_provinces where match_id=$1 and province_id=$2', [f.mid, u.orders.targetProvinceId])).rows[0].nation_id;
          assert.equal(owner, f.a, 'Redeployment uses the ordinary friendly-territory retreat rule');
          assert.ok(u.orders.path.length >= 2);
        }
        assert.equal((await db.query('select relation from dorra_private.war_relations where match_id=$1', [f.mid])).rows[0].relation, relation, 'Redeployment cannot reopen a ceasefire');
      });
    });

    await t.test('AI and shared command helpers remain private to the trusted service', async () => {
      const { rows } = await db.query("select p.proname,has_function_privilege('authenticated',p.oid,'execute') player,has_function_privilege('anon',p.oid,'execute') anon,has_function_privilege('service_role',p.oid,'execute') service from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dorra_private' and (p.proname like 'war_ai%' or p.proname in('war_economy_command','war_order_command'))");
      assert.ok(rows.length >= 8); assert.ok(rows.every(r => !r.player && !r.anon && r.service));
    });
  } finally { await db.close(); }
});
