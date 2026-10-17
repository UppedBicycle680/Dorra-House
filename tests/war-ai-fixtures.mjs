// Small, deterministic geography for testing the actual PostgreSQL AI. These
// platforms and coordinates are authored test data, never production geography.
export const AI_RESOURCES = { cash: 20000, supplies: 5000, fuel: 3500, electronics: 2000, manpower: 6000 };
export const AI_FACILITIES = { 'army-base': 3, 'air-base': 2, 'naval-base': 2, 'intelligence-center': 1 };
const cost = (cash, supplies = 200, fuel = 60, electronics = 80, manpower = 100) => ({ cash, supplies, fuel, electronics, manpower });
const platform = (id, domain, branch, capabilities, stats, extra = {}) => ({
  id: '__ai-' + id, name: 'Fixture ' + id, domain, branch, capabilities, operators: ['A', 'B'],
  cost: cost(1000), researchHours: 6, buildHours: 6, prerequisites: [], level: 1,
  facility: domain === 'sea' ? 'naval-base' : domain === 'air' ? 'air-base' : 'army-base',
  stats: { attack: 12, defense: 12, range: 5, speed: 35, vision: 40, radar: 0, airDefense: 0, ...stats }, ...extra
});
export const AI_PLATFORMS = [
  platform('infantry', 'land', 'infantry', ['capture'], {}, { cost: cost(600, 200, 20, 20, 200) }),
  platform('armor', 'land', 'armor', ['armor', 'mechanized', 'capture'], { attack: 28, defense: 24 }, { cost: cost(1600, 500, 200, 100, 80) }),
  platform('artillery', 'land', 'artillery-air-defense', ['indirect-fire'], { attack: 24, defense: 7, range: 150 }, { cost: cost(1100, 300, 60, 120, 60) }),
  platform('sam', 'land', 'artillery-air-defense', ['point-defense', 'missile-defense'], { attack: 2, defense: 10, range: 100, airDefense: 35, radar: 120 }, { cost: cost(1200, 250, 80, 250, 50) }),
  platform('strike', 'air', 'aviation', ['multirole', 'strike'], { attack: 34, defense: 12, airDefense: 20, speed: 650, range: 850, vision: 120 }, { cost: cost(1800, 200, 300, 300, 50) }),
  platform('fighter', 'air', 'aviation', ['air-superiority'], { attack: 20, defense: 15, airDefense: 40, speed: 700, range: 900, vision: 150 }, { cost: cost(2000, 200, 300, 350, 50) }),
  platform('frigate', 'sea', 'naval', ['anti-ship', 'anti-submarine', 'sonar'], { attack: 30, defense: 22, range: 180, speed: 45, vision: 160, sonar: 100, airDefense: 15 }, { cost: cost(2000, 400, 250, 200, 100) }),
  platform('submarine', 'sea', 'naval', ['submarine', 'anti-ship'], { attack: 32, defense: 18, range: 140, speed: 32, vision: 100, stealth: 80 }, { cost: cost(2400, 400, 250, 300, 100) }),
  platform('engineers', 'support', 'intelligence-support', ['repair', 'resupply', 'entrench'], { attack: 0, defense: 8, vision: 60 }, { cost: cost(800, 300, 100, 100, 100) }),
  platform('doctrine', 'support', 'industry', ['command'], { attack: 0 }, { buildable: false, facility: 'intelligence-center', cost: cost(800) }),
  platform('locked', 'land', 'armor', ['armor'], { attack: 1000 }, { level: 3, prerequisites: ['__ai-missing-prerequisite'] }),
  platform('foreign', 'land', 'armor', ['armor'], { attack: 2000 }, { operators: ['ZZ'], exportable: false }),
  platform('nuclear', 'missile', 'missiles', ['strategic-strike'], { attack: 5000 }, { nuclear: true, facility: 'missile-site' })
];

export async function seedAiFixtureCatalog(db) {
  for (const p of AI_PLATFORMS) await db.query('insert into dorra_private.war_catalog_platforms(id,name,data) values($1,$2,$3) on conflict(id) do update set data=excluded.data', [p.id, p.name, JSON.stringify(p)]);
}

export async function aiFixture(db, { island = false, difficulty = 'standard', resources = AI_RESOURCES, facilities = AI_FACILITIES, researched = true, nationIds = ['A', 'B'], realCatalog = false } = {}) {
  const mid = 'f6100000-0000-4000-8000-000000000001', host = 'f6100000-0000-4000-8000-000000000002';
  const [a, b] = nationIds;
  await db.query('insert into auth.users(id) values($1)', [host]);
  await db.query("insert into dorra_private.war_matches(id,name,host_id,status,template,opponent,pace,visibility,speed,limit_seconds,real_anchor,last_dispatch,ai_difficulty) values($1,'AI strategy fixture',$2,'running','duel','ai','persistent','invite',4,2592000,clock_timestamp(),clock_timestamp(),$3)", [mid, host, difficulty]);
  if (!realCatalog) await seedAiFixtureCatalog(db);
  const owned = ['AH', 'AF', 'AP', 'BH', 'BF', 'BP', 'BX'];
  const geography = {
    AH: { lat: 0, lng: 0, neighbors: ['AF', 'AP'], capital: true, city: true },
    AF: { lat: 0, lng: .25, neighbors: island ? ['AH'] : ['AH', 'BF'] },
    AP: { lat: -.25, lng: 0, neighbors: ['AH'], port: true, seaNeighbors: ['BP'] },
    BH: { lat: 0, lng: .75, neighbors: ['BF', 'BP'], capital: true, city: true },
    BF: { lat: 0, lng: .5, neighbors: island ? ['BH'] : ['BH', 'AF'] },
    BP: { lat: -.25, lng: .75, neighbors: ['BH'], port: true, seaNeighbors: ['AP'] },
    BX: { lat: 0, lng: 20, neighbors: [] }
  };
  const pid = label => '__ai-' + label;
  for (const label of owned) {
    const data = { terrain: 'plains', port: false, capital: false, city: false, ...geography[label] };
    data.neighbors = data.neighbors.map(pid); data.seaNeighbors = (data.seaNeighbors || []).map(pid);
    const owner = label.startsWith('A') ? a : b;
    await db.query('insert into dorra_private.war_catalog_provinces(id,country_id,name,data) values($1,$2,$3,$4)', [pid(label), owner, label, JSON.stringify(data)]);
    await db.query('insert into dorra_private.war_provinces(match_id,province_id,nation_id,facilities) values($1,$2,$3,$4)', [mid, pid(label), owner, JSON.stringify(label.endsWith('H') || label.endsWith('P') ? facilities : {})]);
  }
  for (const [nation, other, capital] of [[a, b, 'AH'], [b, a, 'BH']]) {
    let profile = realCatalog ? (await db.query('select data from dorra_private.war_catalog_nations where id=$1', [nation])).rows[0]?.data : null;
    if (realCatalog && !profile) throw new Error('Missing production nation ' + nation);
    profile = { economy: 1, military: 1, nuclear: false, playable: true, arsenal: AI_PLATFORMS.filter(p => !p.nuclear && p.operators.includes('A')).map(p => p.id), ...profile, capitalProvinceId: pid(capital) };
    await db.query('insert into dorra_private.war_catalog_nations(id,name,data) values($1,$1,$2) on conflict(id) do update set data=excluded.data', [nation, JSON.stringify(profile)]);
    const research = researched ? (realCatalog ? (await db.query("select id from dorra_private.war_catalog_platforms where (data->'operators' ? $1 or data->'operators' ? '*') and not coalesce((data->>'nuclear')::boolean,false)", [nation])).rows.map(p => p.id) : AI_PLATFORMS.filter(p => !['__ai-locked', '__ai-foreign', '__ai-nuclear'].includes(p.id)).map(p => p.id)) : [];
    await db.query('insert into dorra_private.war_sides(match_id,nation_id,is_ai,active_ai,enemy_nation_id,resources,research) values($1,$2,true,true,$3,$4,$5)', [mid, nation, other, JSON.stringify(resources), JSON.stringify(research)]);
  }
  await db.query("insert into dorra_private.war_relations(match_id,a,b,relation) values($1,least($2,$3),greatest($2,$3),'war')", [mid, a, b]);
  let serial = 10;
  const unit = async (platformId = '__ai-infantry', province = 'AH', nation = a, { health = 100, orders = {}, strength = 1 } = {}) => {
    const id = 'f6100000-0000-4000-8000-' + String(serial++).padStart(12, '0');
    const p = (await db.query('select name,data from dorra_private.war_catalog_platforms where id=$1', [platformId])).rows[0];
    if (!p) throw new Error('Unknown fixture platform ' + platformId);
    await db.query('insert into dorra_private.war_units(id,match_id,nation_id,province_id,platform_id,name,domain,health,strength,orders) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [id, mid, nation, pid(province), platformId, p.name, p.data.domain, health, strength, JSON.stringify(orders)]);
    return id;
  };
  const decide = async (nation = a, gt = 0) => db.query('select dorra_private.war_ai($1,$2,$3)', [mid, nation, gt]);
  const getUnit = async id => (await db.query('select * from dorra_private.war_units where id=$1', [id])).rows[0];
  const side = async (nation = a) => (await db.query('select * from dorra_private.war_sides where match_id=$1 and nation_id=$2', [mid, nation])).rows[0];
  const events = async (nation = a) => (await db.query("select kind,due,payload from dorra_private.war_events where match_id=$1 and payload->>'nationId'=$2 order by kind,payload::text", [mid, nation])).rows;
  const advance = async gt => {
    await db.query("update dorra_private.war_matches set game_anchor=$2,real_anchor=clock_timestamp()+interval '1 hour',last_dispatch=clock_timestamp() where id=$1", [mid, gt]);
    await db.query('select dorra_private.war_advance($1,400)', [mid]);
  };
  const decisions = async (nation = a) => ({
    units: (await db.query('select platform_id,province_id,health,orders from dorra_private.war_units where match_id=$1 and nation_id=$2 order by id', [mid, nation])).rows,
    events: await events(nation), resources: (await side(nation)).resources
  });
  return { db, mid, host, a, b, pid, unit, decide, getUnit, side, events, advance, decisions };
}

export async function isolatedAiScenario(db, options, run) {
  await db.exec('begin');
  try { return await run(await aiFixture(db, options)); }
  finally { await db.exec('rollback'); }
}
