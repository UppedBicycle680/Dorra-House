import test from 'node:test';
import assert from 'node:assert/strict';
import { warDatabase } from './war-database-helpers.mjs';

async function fixture() {
  const db = await warDatabase(), uid = crypto.randomUUID(), mid = crypto.randomUUID();
  await db.query('insert into auth.users(id) values($1)', [uid]);
  await db.query("insert into dorra_private.war_matches(id,name,host_id,template,opponent,pace,visibility,status,speed,limit_seconds,real_anchor,last_dispatch) values($1,'Capability fixture',$2,'duel','ai','fast','public','running',360,2592000,clock_timestamp(),clock_timestamp())", [mid, uid]);
  await db.query("insert into dorra_private.war_sides(match_id,nation_id,user_id,resources) values($1,'A',$2,'{\"cash\":100000,\"supplies\":100000,\"fuel\":100000,\"electronics\":100000,\"manpower\":100000}'),($1,'B',null,'{\"cash\":100000,\"supplies\":100000,\"fuel\":100000,\"electronics\":100000,\"manpower\":100000}')", [mid, uid]);
  await db.query("insert into dorra_private.war_relations(match_id,a,b,relation) values($1,'A','B','war')", [mid]);
  for (const [id, lng, owner, facilities] of [['A', 0, 'A', { 'air-base': 1 }], ['B', .5, 'B', {}], ['C', 1, 'B', {}], ['D', 1.2, 'A', {}], ['E', 1.4, 'A', {}]]) {
    const data = { id, lat: 0, lng, port: true, terrain: 'plains', neighbors: ['A', 'B', 'C', 'D', 'E'].filter(other => other !== id), seaNeighbors: ['A', 'B', 'C', 'D', 'E'].filter(other => other !== id) };
    await db.query('insert into dorra_private.war_catalog_provinces(id,country_id,name,data) values($1,$2,$1,$3)', [id, owner, JSON.stringify(data)]);
    await db.query('insert into dorra_private.war_provinces(match_id,province_id,nation_id,facilities) values($1,$2,$3,$4)', [mid, id, owner, JSON.stringify(facilities)]);
  }
  for (const [id, domain, capabilities, stats] of [
    ['infantry', 'land', ['capture'], { attack: 10, defense: 8, vision: 10, radar: 0, speed: 35, range: 5 }],
    ['radar-ship', 'sea', [], { attack: 0, defense: 8, vision: 300, radar: 300, speed: 40 }],
    ['sonar-ship', 'sea', ['sonar'], { attack: 0, defense: 8, vision: 300, radar: 0, speed: 40 }],
    ['submarine', 'sea', ['submarine'], { attack: 10, defense: 8, vision: 100, stealth: 85, radar: 0, speed: 30 }],
    ['fighter', 'air', ['air-superiority'], { attack: 20, defense: 8, vision: 10, radar: 0, speed: 600, range: 2000 }],
    ['stealth-aircraft', 'air', [], { attack: 10, defense: 8, vision: 10, stealth: 85, speed: 600, range: 2000 }],
    ['jammer', 'air', ['electronic-attack'], { attack: 0, defense: 8, vision: 10, range: 250, speed: 600 }],
    ['carrier', 'sea', ['carrier', 'air-base-at-sea'], { attack: 10, defense: 8, vision: 10, radar: 0, speed: 40 }],
    ['engineers', 'land', ['repair', 'entrench'], { attack: 1, defense: 8, vision: 10, radar: 0, speed: 20 }]
  ]) await db.query('insert into dorra_private.war_catalog_platforms(id,name,data) values($1,$1,$2)', [id, JSON.stringify({ domain, operators: ['*'], carrierOperators: id === 'fighter' ? ['A'] : [], capabilities, stats })]);
  const unit = async (platform, province = 'A', nation = 'A', extra = {}) => {
    const id = crypto.randomUUID();
    const { rows } = await db.query('select data from dorra_private.war_catalog_platforms where id=$1', [platform]);
    await db.query('insert into dorra_private.war_units(id,match_id,nation_id,province_id,platform_id,name,domain,health,entrenchment) values($1,$2,$3,$4,$5,$5,$6,$7,$8)', [id, mid, nation, province, platform, rows[0].data.domain, extra.health ?? 100, extra.entrenchment ?? 0]);
    return id;
  };
  const get = async id => (await db.query('select * from dorra_private.war_units where id=$1', [id])).rows[0];
  const visible = async id => (await db.query("select exists(select 1 from dorra_private.war_visible_units($1,'A') where id=$2) visible", [mid, id])).rows[0].visible;
  const vision = async id => (await db.query("select dorra_private.war_vision($1,'A',u) visible from dorra_private.war_units u where id=$2", [mid, id])).rows[0].visible;
  const move = (id, destination, type = 'move', time = 0) => db.query("select dorra_private.war_schedule_move($1,$2,$3,$4,$5,'[]')", [mid, id, destination, type, time]);
  const advance = async time => { await db.query('update dorra_private.war_matches set game_anchor=$2,real_anchor=clock_timestamp(),last_dispatch=clock_timestamp() where id=$1', [mid, time]); await db.query('select dorra_private.war_advance($1,100)', [mid]); };
  return { db, mid, uid, unit, get, visible, vision, move, advance };
}

test('radar facilities reveal contacts while submarines require sonar rather than radar', { timeout: 120000 }, async () => {
  const { db, mid, unit, visible, vision } = await fixture();
  try {
    const target = await unit('infantry', 'B', 'B');
    assert.equal(await visible(target), false); assert.equal(await vision(target), false);
    await db.query("update dorra_private.war_provinces set facilities=facilities||'{\"radar\":1}' where match_id=$1 and province_id='A'", [mid]);
    assert.equal(await visible(target), true); assert.equal(await vision(target), true);
    const submarine = await unit('submarine', 'C', 'B'); await unit('radar-ship');
    await db.query("update dorra_private.war_provinces set facilities=facilities||'{\"radar\":5}' where match_id=$1 and province_id='A'", [mid]);
    assert.equal(await visible(submarine), false, 'Air/surface radar never substitutes for sonar'); assert.equal(await vision(submarine), false);
    await unit('sonar-ship'); assert.equal(await visible(submarine), true); assert.equal(await vision(submarine), true);
    await db.query("delete from dorra_private.war_units where match_id=$1 and nation_id='A'", [mid]);
    await db.query("update dorra_private.war_provinces set facilities=facilities||'{\"radar\":3}' where match_id=$1 and province_id='A'", [mid]);
    const stealth = await unit('stealth-aircraft', 'B', 'B'); assert.equal(await visible(stealth), true); assert.equal(await vision(stealth), true);
    await unit('jammer', 'C', 'B'); assert.equal(await visible(stealth), false, 'Electronic attack suppresses facility radar too'); assert.equal(await vision(stealth), false);
    const { rows: helpers } = await db.query("select p.oid::regprocedure::text name,has_function_privilege('authenticated',p.oid,'execute') permitted from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dorra_private' and p.proname in('war_signature_detected','war_air_basing','war_schedule_move','war_schedule_move_core','war_air_arrival','war_air_return','war_field_support')");
    assert.equal(helpers.length, 7); assert.ok(helpers.every(helper => !helper.permitted), 'Neither wrappers nor core helpers grant player execution');
    await db.exec('set role authenticated');
    await assert.rejects(db.query("select dorra_private.war_air_basing($1,'A','A')", [mid]), /permission denied/);
  } finally { await db.close(); }
});

test('aircraft require basing and fly an outbound, on-station and automatic return cycle', { timeout: 120000 }, async () => {
  const { db, mid, unit, get, move, advance } = await fixture();
  try {
    const aircraft = await unit('fighter');
    await assert.rejects(move(aircraft, 'D'), /AIR_BASE_REQUIRED/);
    await move(aircraft, 'B', 'attack'); const outward = await get(aircraft);
    assert.equal(outward.orders.airMission, true);
    await advance(Number(outward.orders.arrival) + 1);
    const station = await get(aircraft); assert.equal(station.province_id, 'B'); assert.equal(station.orders.sortie, true); assert.equal(station.orders.type, 'bombard');
    await advance(Number(station.orders.returnDue) + 1);
    const returning = await get(aircraft); assert.equal(returning.orders.type, 'retreat'); assert.equal(returning.orders.targetProvinceId, 'A');
    await advance(Number(returning.orders.arrival) + 1); const landed = await get(aircraft);
    assert.equal(landed.province_id, 'A'); assert.deepEqual(landed.orders, {});
    assert.equal((await db.query("select count(*)::integer n from dorra_private.war_events where match_id=$1 and kind='air-return'", [mid])).rows[0].n, 0);
  } finally { await db.close(); }
});

test('carrier basing follows the ship and rejects a full eight-formation deck', { timeout: 120000 }, async () => {
  const { db, mid, unit, get, move, advance } = await fixture();
  try {
    const carrier = await unit('carrier', 'D'), aircraft = await unit('fighter');
    const incompatible = await unit('stealth-aircraft'); await assert.rejects(move(incompatible, 'D'), /AIR_BASE_REQUIRED/, 'Land-only airframes cannot use carrier decks');
    await move(aircraft, 'D'); await advance(Number((await get(aircraft)).orders.arrival) + 1);
    assert.equal((await get(aircraft)).base_carrier_id, carrier);
    const gameTime = (await db.query('select dorra_private.war_now(m) gt from dorra_private.war_matches m where id=$1', [mid])).rows[0].gt;
    await move(carrier, 'E', 'move', Number(gameTime)); await advance(Number((await get(carrier)).orders.arrival) + 1);
    assert.equal((await get(aircraft)).province_id, 'E', 'Parked aircraft travel with their carrier');
    for (let i = 0; i < 6; i++) { const parked = await unit('fighter', 'E'); await db.query('update dorra_private.war_units set base_carrier_id=$2 where id=$1', [parked, carrier]); }
    const inbound = await unit('fighter'); await move(inbound, 'E');
    const extra = await unit('fighter'); await assert.rejects(move(extra, 'E'), /AIR_BASE_REQUIRED/);
  } finally { await db.close(); }
});

test('engineers repair a bounded number of idle formations and entrenchment lowers damage', { timeout: 120000 }, async () => {
  const { db, mid, unit, get, move } = await fixture();
  try {
    await unit('engineers'); const infantry = await unit('infantry', 'A', 'A', { health: 50 });
    await db.query('select dorra_private.war_field_support($1)', [mid]); assert.equal(Number((await get(infantry)).health), 52); assert.equal(Number((await get(infantry)).entrenchment), 2);
    await move(infantry, 'D'); assert.equal(Number((await get(infantry)).entrenchment), 0);
    for (let i = 0; i < 40; i++) await unit('infantry', 'A', 'A', { health: 50 });
    await db.query('select dorra_private.war_field_support($1)', [mid]);
    assert.equal((await db.query("select count(*)::integer n from dorra_private.war_units where match_id=$1 and province_id='A' and health=52 and orders='{}'", [mid])).rows[0].n, 32);
    const exposed = await unit('infantry', 'B', 'B'), entrenched = await unit('infantry', 'B', 'B', { entrenchment: 20 }); await unit('infantry', 'B', 'A');
    await db.query('select dorra_private.war_combat($1,1000)', [mid]);
    const { rows: economies } = await db.query('select nation_id,economy_at from dorra_private.war_sides where match_id=$1', [mid]);
    assert.ok(economies.every(side => Number(side.economy_at) === 1000), 'Both engaged economies settle before combat supply modifiers');
    assert.ok(Number((await get(entrenched)).health) > Number((await get(exposed)).health), 'Entrenchment applies a real defence modifier');
  } finally { await db.close(); }
});

test('carrier destruction loses parked aircraft and airborne sorties divert or report their loss', { timeout: 120000 }, async () => {
  const { db, mid, unit, get, move, advance } = await fixture();
  try {
    const carrier = await unit('carrier', 'D'), parkedA = await unit('fighter', 'D'), parkedB = await unit('fighter', 'D'), flight = await unit('fighter', 'D');
    await db.query('update dorra_private.war_units set base_carrier_id=$2 where id=any($1::uuid[])', [[parkedA, parkedB, flight], carrier]);
    await move(flight, 'B', 'attack'); const outward = await get(flight);
    await db.query('delete from dorra_private.war_units where id=$1', [carrier]);
    assert.equal(await get(parkedA), undefined); assert.equal(await get(parkedB), undefined); assert.ok(await get(flight), 'Airborne aircraft survive the carrier destruction');
    const { rows: reports } = await db.query("select body from dorra_private.war_reports where match_id=$1 and body->>'type'='carrier-aircraft-lost'", [mid]);
    assert.equal(reports.length, 1); assert.equal(Number(reports[0].body.aircraftCount), 2);
    await advance(Number(outward.orders.arrival) + 1); await advance(Number((await get(flight)).orders.returnDue) + 1);
    const diversion = await get(flight); assert.equal(diversion.orders.targetProvinceId, 'A', 'The sortie diverts to a reachable friendly airfield');
    await advance(Number(diversion.orders.arrival) + 1); assert.equal((await get(flight)).province_id, 'A');
    const time = Number((await db.query('select dorra_private.war_now(m) gt from dorra_private.war_matches m where id=$1', [mid])).rows[0].gt);
    await move(flight, 'B', 'attack', time); const lastOutbound = await get(flight);
    await db.query("update dorra_private.war_provinces set facilities='{}' where match_id=$1 and province_id='A'", [mid]);
    await advance(Number(lastOutbound.orders.arrival) + 1); await advance(Number((await get(flight)).orders.returnDue) + 1);
    assert.equal(await get(flight), undefined, 'A sortie without any reachable base is resolved as a loss');
    assert.equal((await db.query("select count(*)::integer n from dorra_private.war_reports where match_id=$1 and body->>'type'='aircraft-lost'", [mid])).rows[0].n, 1);
    // Retention and deletion of finished worlds must not manufacture new reports.
    const secondCarrier = await unit('carrier', 'D'), aircraft = await unit('fighter', 'D');
    await db.query('update dorra_private.war_units set base_carrier_id=$2,health=0 where id=$1', [aircraft, secondCarrier]);
    await db.query('update dorra_private.war_units set health=0 where id=$1', [secondCarrier]);
    await db.query('delete from dorra_private.war_units where match_id=$1 and health<=0', [mid]);
    assert.equal(await get(aircraft), undefined, 'Simultaneous combat casualties safely resolve once');
    const cleanupCarrier = await unit('carrier', 'D'), cleanupAircraft = await unit('fighter', 'D');
    await db.query('update dorra_private.war_units set base_carrier_id=$2 where id=$1', [cleanupAircraft, cleanupCarrier]);
    await db.query('delete from dorra_private.war_matches where id=$1', [mid]);
    assert.equal(await get(cleanupAircraft), undefined, 'Deleting the parent world cascades safely without creating an orphan report');
  } finally { await db.close(); }
});

test('field support leaves peaceful world garrisons untouched and bounds active entrenchment', { timeout: 120000 }, async () => {
  const { db, mid, unit } = await fixture();
  try {
    await db.query("insert into dorra_private.war_units(match_id,nation_id,province_id,platform_id,name,domain) select $1,'neutral-'||g,'neutral-province-'||g,p,p,'land' from generate_series(1,204) g cross join unnest(array['infantry','engineers']) p", [mid]);
    await unit('engineers');
    for (let i = 0; i < 40; i++) await unit('infantry');
    await db.query('select dorra_private.war_field_support($1)', [mid]);
    const { rows } = await db.query("select count(*) filter(where nation_id like 'neutral-%' and entrenchment>0)::integer neutral_changes,count(*) filter(where nation_id='A' and entrenchment>0)::integer active_changes from dorra_private.war_units where match_id=$1", [mid]);
    assert.equal(rows[0].neutral_changes, 0, 'Peaceful neutral garrisons must not generate hourly writes');
    assert.equal(rows[0].active_changes, 32, 'Active entrenchment is bounded alongside the repair budget');
  } finally { await db.close(); }
});
