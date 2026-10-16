import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { warDatabase } from '../tests/war-database-helpers.mjs';
import { getResearchCost } from '../war/catalog.mjs';

// Repeatable integration campaigns. Every player intention enters the actual
// public command facade; no unit, resource, ownership, health or research state
// is edited after ordinary scenario creation. Only fixture clocks and UUID/rate
// bookkeeping are controlled to compress days of play into a repeatable run.
// These scripted outcomes measure legal complete flows, not human win rates.
export async function checkWarAiCampaigns({ pairs = [['BE', 'NL'], ['BH', 'QA'], ['NZ', 'FJ'], ['SG', 'MY']], maxHours = 240, output = null, verbose = false } = {}) {
if (!Number.isInteger(maxHours) || maxHours < 1 || maxHours > 720) throw new RangeError('Campaign duration must be 1 through 720 game hours.');
if (!Array.isArray(pairs) || !pairs.length || pairs.some(pair => !Array.isArray(pair) || pair.length !== 2 || pair[0] === pair[1] || pair.some(id => typeof id !== 'string'))) throw new TypeError('Each campaign requires two different nation IDs.');
const db = await warDatabase(), reports = [], started = performance.now();
const catalog = new Map(), geography = new Map(), profiles = new Map();
const fixtureActor = 'f7100000-0000-4000-8000-000000000001', fixtureSession = 'f7100000-0000-4000-8000-000000000002', fixtureLease = 'f7100000-0000-4000-8000-000000000003';
let engineHashes = [], failure = null, cleanup = null;
const role = p => p.domain === 'air' ? 'air' : p.domain === 'sea' ? 'sea' : p.capabilities?.some(c => ['repair', 'resupply', 'entrench'].includes(c)) ? 'support' : p.capabilities?.includes('indirect-fire') ? 'artillery' : Number(p.stats?.airDefense || 0) > 15 ? 'air-defense' : p.capabilities?.includes('armor') ? 'armor' : p.domain === 'land' ? 'infantry' : 'programme';
const haversine = (a, b) => {
  const r = d => d * Math.PI / 180, dl = r(b.lng - a.lng), dp = r(b.lat - a.lat);
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(Math.sin(dp / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dl / 2) ** 2)));
};
function route(view, src, dst, sea = false, embarked = false) {
  if (src === dst) return [src];
  const owned = new Set(view.provinces.map(p => p.id)), queue = [[src]], seen = new Set([src]);
  for (let i = 0; i < queue.length; i++) {
    const path = queue[i], p = geography.get(path.at(-1));
    for (const next of [...(p?.neighbors || []), ...(sea || embarked ? p?.seaNeighbors || [] : [])]) {
      if (seen.has(next) || !owned.has(next) || (sea && !geography.get(next)?.port)) continue;
      const found = [...path, next]; if (next === dst) return found;
      seen.add(next); queue.push(found);
    }
  }
  return null;
}
function affordable(resources, cost, reserve = 0) { return Object.entries(cost || {}).every(([key, value]) => Number(resources[key] || 0) >= Number(value) + (key === 'cash' ? reserve : 0)); }
function canEngage(p, target) {
  const caps = p.capabilities || [], enemy = catalog.get(target.platformId), targetCaps = enemy.capabilities || [];
  if (target.domain === 'air') return Number(p.stats?.airDefense || 0) > 0;
  if (Number(p.stats?.attack || 0) <= 0 || p.domain === 'support') return false;
  if (targetCaps.includes('submarine')) return caps.includes('anti-submarine') || (p.domain === 'sea' && caps.includes('sonar'));
  if (target.domain === 'sea') return p.domain === 'sea' || caps.includes('anti-ship') || (p.domain === 'air' && caps.some(c => ['strike', 'multirole', 'precision-strike', 'strategic-strike'].includes(c)));
  if (p.domain === 'sea' && caps.some(c => ['submarine', 'carrier'].includes(c)) && !caps.includes('cruise-missiles')) return false;
  return p.domain !== 'air' || caps.some(c => ['strike', 'multirole', 'precision-strike', 'strategic-strike', 'close-support', 'anti-armor'].includes(c));
}
function priority(p, counts) {
  const r = role(p), desired = { infantry: 5, armor: 3, artillery: 3, 'air-defense': 1, air: 2, sea: 2, support: 1 }[r] || 0;
  return desired ? (desired - (counts[r] || 0)) / desired * 100 + Math.min(10, Number(p.stats?.attack || 0) / 5) : -1000;
}
async function campaign(nation, rival, difficulty = 'standard') {
  await db.exec('begin');
  const summary = { nation, rival, difficulty, scope: 'Real catalogue, actual duel creation, normal costs/forces/timers/AI and public-command-only human autopilot', hours: 0, commands: {}, rejections: {}, humanMoves: [], movementCounts: {}, timeline: [], budget: { minimumResources: {}, maximumFormations: {}, maximumProductionQueue: {}, maximumResearchQueue: {} } };
  const start = performance.now(); let mid = null, requestSerial = 1, view;
  try {
    await db.exec("create temporary sequence campaign_unit_serial start with 1000;alter table dorra_private.war_units alter column id set default ('f7200000-0000-4000-8000-'||lpad(nextval('pg_temp.campaign_unit_serial')::text,12,'0'))::uuid");
    await db.query('insert into auth.users(id) values($1)', [fixtureActor]);
    await db.query('insert into auth.sessions(id,user_id) values($1,$2)', [fixtureSession, fixtureActor]);
    await db.query('insert into dorra_private.profiles(user_id) values($1)', [fixtureActor]);
    await db.query("insert into dorra_private.player_state(user_id,auth_session_id,lease_id,snapshot) values($1,$2,$3,'{\"balance\":1000,\"progress\":{}}')", [fixtureActor, fixtureSession, fixtureLease]);
    await db.exec(`create function pg_temp.campaign_command(actor uuid,sid uuid,lease uuid,intent text,mid uuid,args jsonb,request_id uuid) returns jsonb language plpgsql as $$begin
      return public.dorra_war_command(actor,sid,lease,intent,mid,args,request_id);
      exception when others then return jsonb_build_object('rejected',sqlerrm,'sqlstate',sqlstate);end$$;`);
    async function command(action, args = {}) {
      const requestId = 'f7300000-0000-4000-8000-' + String(requestSerial++).padStart(12, '0');
      const result = (await db.query('select pg_temp.campaign_command($1,$2,$3,$4,$5,$6,$7) r', [fixtureActor, fixtureSession, fixtureLease, action, mid, JSON.stringify(args), requestId])).rows[0].r;
      if (result.rejected) { summary.rejections[result.rejected] = (summary.rejections[result.rejected] || 0) + 1; return null; }
      summary.commands[action] = (summary.commands[action] || 0) + 1; if (result.view) view = result.view; return result;
    }
    await command('create', { nationId: nation, opponentNationId: rival, template: 'duel', opponent: 'ai', aiDifficulty: difficulty, pace: 'fast', visibility: 'invite', name: 'Local complete campaign regression' });
    if (!view) throw new Error('SCENARIO_CREATE_FAILED'); mid = view.match.id;
    summary.initial = { resources: view.player.resources, own: view.units.filter(u => u.nationId === nation).map(u => ({ platform: u.platformId, strength: u.strength })), provinces: view.provinces.filter(p => p.ownerId === nation).length, opposingProvinces: view.provinces.filter(p => p.ownerId === rival).length };
    summary.initialSides = (await db.query('select nation_id,resources,research,score from dorra_private.war_sides where match_id=$1 order by nation_id', [mid])).rows;
    summary.nationalProfiles = [nation, rival].map(id => ({ id, economy: profiles.get(id).economy, military: profiles.get(id).military, arsenal: profiles.get(id).arsenal }));
    await command('start');
    const freeze = async gt => db.query("update dorra_private.war_matches set game_anchor=$2,real_anchor=clock_timestamp()+interval '1 hour',last_dispatch=clock_timestamp() where id=$1 and status='running'", [mid, gt]);
    const tick = async gt => {
      await freeze(gt);
      for (let pass = 0; pass < 10; pass++) {
        await db.query('select dorra_private.war_advance($1,400)', [mid]);
        const s = (await db.query('select status from dorra_private.war_matches where id=$1', [mid])).rows[0].status;
        const due = (await db.query('select count(*)::int n from dorra_private.war_events where match_id=$1 and due<=$2', [mid, gt])).rows[0].n;
        if (!due || s !== 'running') return;
      }
      throw new Error('BOUNDED_CATCHUP_EXHAUSTED');
    };
    const humanTurn = async gt => {
      // Three game hours at 360× represent 30 real seconds. Reset only the
      // compressed transport rate window, never a gameplay budget or queue.
      await db.query("update dorra_private.player_state set rate_window=now()-interval '2 minutes',rate_count=0 where user_id=$1", [fixtureActor]);
      await command('view'); if (view.match.status !== 'running') return;
      const owner = id => view.provinces.find(p => p.id === id)?.ownerId;
      const capital = profiles.get(nation).capitalProvinceId, enemyCapital = profiles.get(rival).capitalProvinceId;
      let own = view.units.filter(u => u.nationId === nation), guard = own.filter(u => u.domain === 'land' && u.provinceId === capital && u.health > 35 && !u.order?.type).sort((a, b) => b.strength - a.strength)[0]?.id;
      for (const original of own) {
        const u = view.units.find(u => u.id === original.id); if (!u || u.order?.type || u.id === guard) continue;
        const p = catalog.get(u.platformId), r = role(p), g = geography.get(u.provinceId); let target, targetUnitId, kind = 'attack';
        if (u.health <= 35) {
          target = view.provinces.filter(p => p.ownerId === nation && p.id !== u.provinceId && (u.domain !== 'sea' || geography.get(p.id)?.port) && route(view, u.provinceId, p.id, u.domain === 'sea')).sort((a, b) => haversine(g, geography.get(a.id)) - haversine(g, geography.get(b.id)))[0]?.id; kind = 'retreat';
        } else if (u.domain === 'air' || r === 'artillery' || r === 'sea') {
          const contact = view.units.filter(e => e.nationId === rival && canEngage(p, e) && haversine(g, geography.get(e.provinceId)) <= Number(p.stats?.range || 0)).sort((a, b) => a.health - b.health)[0];
          target = contact?.provinceId; targetUnitId = contact?.id;
          kind = 'bombard';
        } else if (r === 'support' || r === 'air-defense') continue;
        else {
          const land = route(view, u.provinceId, enemyCapital);
          if (owner(enemyCapital) !== nation && land) target = enemyCapital;
          else target = view.provinces.filter(p => p.ownerId === rival && route(view, u.provinceId, p.id)).sort((a, b) => haversine(g, geography.get(a.id)) - haversine(g, geography.get(b.id)))[0]?.id;
          if (!target) {
            if (g.port) { target = view.provinces.filter(p => p.ownerId === rival && geography.get(p.id)?.port && route(view, u.provinceId, p.id, false, true)).sort((a, b) => Number(b.id === enemyCapital) - Number(a.id === enemyCapital) || haversine(g, geography.get(a.id)) - haversine(g, geography.get(b.id)))[0]?.id; kind = 'embark'; }
            else { target = view.provinces.filter(p => p.ownerId === nation && geography.get(p.id)?.port && route(view, u.provinceId, p.id)).sort((a, b) => haversine(g, geography.get(a.id)) - haversine(g, geography.get(b.id)))[0]?.id; kind = 'move'; }
          }
        }
        if (target === u.provinceId) continue;
        if (kind === 'bombard' && owner(target) === nation) {
          if (u.domain === 'air') kind = 'patrol';
          // Stationary land/naval fire uses the explicit hostile contact; the
          // reviewed shared validator now supports friendly-territory defence.
        }
        if (target) { const accepted = await command('order', { type: kind, targetProvinceId: target, ...(targetUnitId ? { targetUnitId } : {}), unitIds: [u.id] }); if (accepted) { summary.movementCounts[kind] = (summary.movementCounts[kind] || 0) + 1; if (summary.humanMoves.length < 100) summary.humanMoves.push({ hour: gt / 3600, platform: p.id, kind, from: u.provinceId, to: target }); } }
      }
      own = view.units.filter(u => u.nationId === nation);
      const counts = {}; for (const u of own) counts[role(catalog.get(u.platformId))] = (counts[role(catalog.get(u.platformId))] || 0) + 1;
      for (const q of view.player.productionQueue || []) { const r = role(catalog.get(q.platformId)); counts[r] = (counts[r] || 0) + 1; }
      const available = view.catalog.platforms.filter(p => !p.nuclear && (p.prerequisites || []).every(id => view.player.research.includes(id))).sort((a, b) => priority(b, counts) - priority(a, counts) || a.id.localeCompare(b.id));
      for (const p of available.filter(p => !view.player.research.includes(p.id))) {
        if ((view.player.researchQueue || []).length >= 2 || (view.player.researchQueue || []).some(q => q.platformId === p.id)) continue;
        const site = view.provinces.filter(site => site.ownerId === nation && (p.facility !== 'naval-base' || geography.get(site.id)?.port)).sort((a, b) => Number(b.facilities?.[p.facility] || 0) - Number(a.facilities?.[p.facility] || 0) || Number(b.id === capital) - Number(a.id === capital))[0]; if (!site) continue;
        const level = Number(site.facilities?.[p.facility] || 0);
        if (level < Number(p.level || 1)) { if (!(view.player.buildQueue || []).some(q => q.provinceId === site.id) && affordable(view.player.resources, { cash: 1500 * (level + 1), supplies: 500 * (level + 1), electronics: 200 * (level + 1), manpower: 100 }, 1000)) { await command('build', { provinceId: site.id, facility: p.facility }); break; } }
        else if (affordable(view.player.resources, getResearchCost(p), 1000)) { await command('research', { platformId: p.id }); break; }
      }
      for (const p of available.filter(p => view.player.research.includes(p.id) && p.buildable !== false && priority(p, counts) > 0)) {
        if (!affordable(view.player.resources, p.cost, 1000) || own.length + (view.player.productionQueue || []).length >= 20) continue;
        const site = view.provinces.filter(site => site.ownerId === nation && Number(site.facilities?.[p.facility] || 0) >= Number(p.level || 1) && !(view.player.productionQueue || []).some(q => q.provinceId === site.id) && (p.domain !== 'sea' || geography.get(site.id)?.port)).sort((a, b) => Number(b.id === capital) - Number(a.id === capital))[0];
        if (site && await command('produce', { platformId: p.id, provinceId: site.id })) break;
      }
    };
    await freeze(0); await humanTurn(0);
    for (let hour = 1; hour <= maxHours; hour++) {
      await tick(hour * 3600); summary.hours = hour;
      if (hour % 3 === 0) await humanTurn(hour * 3600);
      const state = (await db.query('select status,winner,error_count,capital_hold_nation,capital_hold_started from dorra_private.war_matches where id=$1', [mid])).rows[0];
      // Private inspection is report-only. The autopilot above receives only
      // ordinary filtered PlayerView data and public catalogue geography.
      for (const side of (await db.query("select s.nation_id,s.resources,(select count(*)::int from dorra_private.war_units u where u.match_id=s.match_id and u.nation_id=s.nation_id) formations,(select count(*)::int from dorra_private.war_events e where e.match_id=s.match_id and e.kind='produce' and e.payload->>'nationId'=s.nation_id) production_queue,(select count(*)::int from dorra_private.war_events e where e.match_id=s.match_id and e.kind='research' and e.payload->>'nationId'=s.nation_id) research_queue from dorra_private.war_sides s where s.match_id=$1", [mid])).rows) {
        const minimum = summary.budget.minimumResources[side.nation_id] ||= {};
        for (const [key, value] of Object.entries(side.resources)) minimum[key] = Math.min(minimum[key] ?? Infinity, Number(value));
        summary.budget.maximumFormations[side.nation_id] = Math.max(summary.budget.maximumFormations[side.nation_id] || 0, side.formations);
        summary.budget.maximumProductionQueue[side.nation_id] = Math.max(summary.budget.maximumProductionQueue[side.nation_id] || 0, side.production_queue);
        summary.budget.maximumResearchQueue[side.nation_id] = Math.max(summary.budget.maximumResearchQueue[side.nation_id] || 0, side.research_queue);
      }
      if (hour % 24 === 0 || state.status === 'finished') {
        const sides = (await db.query('select s.nation_id,s.score,(select count(*)::int from dorra_private.war_units u where u.match_id=s.match_id and u.nation_id=s.nation_id) formations,(select count(*)::int from dorra_private.war_units u where u.match_id=s.match_id and u.nation_id=s.nation_id and u.health<=35) damaged from dorra_private.war_sides s where s.match_id=$1 order by s.nation_id', [mid])).rows;
        summary.timeline.push({ hour, ...state, sides });
      }
      if (state.status === 'finished') break;
    }
    await command('view'); summary.status = view.match.status; summary.victory = view.victory;
    summary.termination = summary.status === 'finished' ? Number(summary.timeline.at(-1)?.capital_hold_started) > 0 ? 'capital-hold' : 'normal-victory-rules' : 'observation-budget';
    if (view.match.status === 'finished') {
      const before = Number((await db.query('select snapshot->>\'balance\' balance from dorra_private.player_state where user_id=$1', [fixtureActor])).rows[0].balance);
      const reward = await command('reward'); summary.reward = reward?.result || null;
      const after = Number((await db.query('select snapshot->>\'balance\' balance from dorra_private.player_state where user_id=$1', [fixtureActor])).rows[0].balance);
      summary.walletDelta = after - before;
      if (reward) { await command('reward'); summary.repeatRewardRejected = !!summary.rejections.REWARD_ALREADY_CLAIMED; }
    }
    summary.finalSides = (await db.query('select nation_id,resources,research,score from dorra_private.war_sides where match_id=$1 order by nation_id', [mid])).rows;
    summary.finalForces = (await db.query('select nation_id,platform_id,health,strength,province_id,orders from dorra_private.war_units where match_id=$1 order by nation_id,platform_id,id', [mid])).rows;
    summary.queue = (await db.query("select kind,payload,due from dorra_private.war_events where match_id=$1 and kind in('research','build','produce') order by due", [mid])).rows;
    summary.activity = (await db.query("select nation_id,body->>'type' type,count(*)::int count from dorra_private.war_reports where match_id=$1 group by nation_id,body->>'type' order by nation_id,body->>'type'", [mid])).rows;
    summary.schedulerErrors = Number((await db.query('select error_count from dorra_private.war_matches where id=$1', [mid])).rows[0].error_count);
    summary.rewardRecords = Number((await db.query('select count(*)::int n from dorra_private.war_rewards where match_id=$1', [mid])).rows[0].n);
    summary.elapsedMs = Math.round(performance.now() - start);
    return summary;
  } finally { await db.exec('rollback'); }
}
try {
  engineHashes = (await db.query("select p.proname,pg_get_functiondef(p.oid) source from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dorra_private' and p.proname in('war_ai','war_ai_tactics','war_ai_economy','war_combat','war_finish') order by p.proname")).rows.map(row => ({ function: row.proname, sha256: createHash('sha256').update(row.source).digest('hex') }));
  for (const file of (await readdir(new URL('../scripts/war-seed/', import.meta.url))).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL('../scripts/war-seed/' + file, import.meta.url), 'utf8'));
  for (const row of (await db.query('select id,data from dorra_private.war_catalog_platforms')).rows) catalog.set(row.id, { id: row.id, ...row.data });
  for (const row of (await db.query('select id,data from dorra_private.war_catalog_provinces')).rows) geography.set(row.id, { id: row.id, ...row.data });
  for (const row of (await db.query('select id,data from dorra_private.war_catalog_nations')).rows) profiles.set(row.id, row.data);
  for (const pair of pairs) {
    if (pair.some(id => !profiles.get(id)?.playable)) throw new Error(`Campaign requires selectable nations: ${pair.join('/')}`);
    const result = await campaign(...pair); reports.push(result);
    if (verbose) console.log(JSON.stringify({ nation: result.nation, rival: result.rival, status: result.status, hours: result.hours, victory: result.victory, reward: result.reward, rejections: result.rejections, elapsedMs: result.elapsedMs }));
    if (output) { await mkdir(new URL('.', output), { recursive: true }); await writeFile(output, JSON.stringify({ scope: 'Actual SQL, production catalogue and geography; compressed local clocks and public-command-only human autopilot. No human win-rate claim.', engineHashes, elapsedMs: Math.round(performance.now() - started), reports }, null, 2)); }
  }
  cleanup = (await db.query('select (select count(*)::int from dorra_private.war_matches) matches,(select count(*)::int from dorra_private.war_rewards) rewards,(select count(*)::int from auth.users) actors')).rows[0];
} catch (error) { failure = { message: error.message, where: error.where }; }
finally { await db.close(); }

return { ok: !failure, failure, engineHashes, reports, cleanup, elapsedMs: Math.round(performance.now() - started) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options = process.argv.slice(2);
  const pairOption = options.find(arg => arg.startsWith('--pair='))?.slice(7);
  const pairsOption = options.find(arg => arg.startsWith('--pairs='))?.slice(8);
  const pairs = pairsOption ? pairsOption.split(':').map(pair => pair.split(',')) : pairOption ? [pairOption.split(',')] : [['BE', 'NL'], ['BH', 'QA'], ['NZ', 'FJ'], ['SG', 'MY']];
  const maxHours = Number(options.find(arg => arg.startsWith('--hours='))?.slice(8) || 240);
  const report = await checkWarAiCampaigns({ pairs, maxHours, output: new URL('../work/war-ai-campaign-report.json', import.meta.url), verbose: true });
  console.log(JSON.stringify({ ok: report.ok, campaigns: report.reports.length, completed: report.reports.filter(r => r.status === 'finished').length, failure: report.failure, elapsedMs: report.elapsedMs }));
  if (!report.ok) process.exitCode = 1;
}
