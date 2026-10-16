import assert from 'node:assert/strict';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { warDatabase } from '../tests/war-database-helpers.mjs';
import { AI_RESOURCES, isolatedAiScenario } from '../tests/war-ai-fixtures.mjs';

const rounded = n => Math.round(Number(n) * 100) / 100;
const percentile = (values, fraction) => values.length ? rounded([...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)]) : 0;

// Both sides are AI-controlled on a seven-point authored graph (six owned
// provinces after removing the hidden-contact test point). The equal forces,
// resources and mirrored positions deliberately isolate planning/order bias.
// This is a fixed-timetable engine exercise, not a human match or win-rate study.
export async function mirrorScenario(db, { difficulty = 'standard', island = false, firstMover = 'A', hours = 48 } = {}) {
  return isolatedAiScenario(db, { difficulty, island }, async f => {
    // Production's random UUIDs also break equal-priority tactical ties. Give
    // this controlled experiment stable identifiers so repeated samples compare
    // strategy and chronology rather than a different UUID draw. Both the
    // sequence and default change roll back with this fixture transaction.
    await db.exec("create temporary sequence ai_unit_serial start with 1000;alter table dorra_private.war_units alter column id set default ('f6200000-0000-4000-8000-'||lpad(nextval('pg_temp.ai_unit_serial')::text,12,'0'))::uuid");
    await db.query('delete from dorra_private.war_provinces where match_id=$1 and province_id=$2', [f.mid, f.pid('BX')]);
    for (const [nation, h, front, port] of [[f.a, 'AH', 'AF', 'AP'], [f.b, 'BH', 'BF', 'BP']]) {
      for (const [platform, province] of [['__ai-infantry', h], ['__ai-armor', front], ['__ai-artillery', h], ['__ai-infantry', port]]) await f.unit(platform, province, nation);
    }
    const profile = (await db.query('select dorra_private.war_ai_profile($1) p', [difficulty])).rows[0].p;
    const cadence = Number(profile.cadenceSeconds), initial = Number(profile.initialDelaySeconds);
    await db.query("insert into dorra_private.war_events(match_id,kind,due) values($1,'combat',3600)", [f.mid]);
    const decisionMs = [], actionCounts = {}, mobilized = new Set(), researched = new Set(), facilities = new Set();
    let decisions = 0, completedHours = 0, pendingAtLimit = 0;
    const order = firstMover === 'A' ? [f.a, f.b] : [f.b, f.a];
    for (let hour = 1; hour <= hours; hour++) {
      const gt = hour * 3600;
      for (let pass = 0; pass < 8; pass++) {
        await f.advance(gt);
        const state = (await db.query('select status from dorra_private.war_matches where id=$1', [f.mid])).rows[0];
        pendingAtLimit = (await db.query('select count(*)::int n from dorra_private.war_events where match_id=$1 and due<=$2', [f.mid, gt])).rows[0].n;
        if (!pendingAtLimit || state.status !== 'running') break;
      }
      const state = (await db.query('select status from dorra_private.war_matches where id=$1', [f.mid])).rows[0];
      completedHours = hour;
      if (state.status !== 'running') break;
      assert.equal(pendingAtLimit, 0, 'The small graph must catch up within its bounded event passes');
      if (gt < initial || (gt - initial) % cadence !== 0) continue;
      for (const nation of order) {
        const mark = (await db.query('select coalesce(max(id),0) id from dorra_private.war_events')).rows[0].id;
        const start = performance.now(); await f.decide(nation, gt); decisionMs.push(performance.now() - start); decisions++;
        for (const event of (await db.query('select kind,payload from dorra_private.war_events where match_id=$1 and id>$2', [f.mid, mark])).rows) {
          actionCounts[event.kind] = (actionCounts[event.kind] || 0) + 1;
          if (event.kind === 'produce') mobilized.add(event.payload.platformId);
          if (event.kind === 'research') researched.add(event.payload.platformId);
          if (event.kind === 'build') facilities.add(event.payload.facility);
        }
      }
    }
    const final = (await db.query('select status,winner,error_count from dorra_private.war_matches where id=$1', [f.mid])).rows[0];
    assert.equal(final.error_count, 0);
    const sides = [];
    for (const nation of [f.a, f.b]) {
      await db.query('select dorra_private.war_accrue($1,$2,$3)', [f.mid, nation, completedHours * 3600]);
      const side = await f.side(nation), units = (await db.query('select platform_id,health,strength,domain from dorra_private.war_units where match_id=$1 and nation_id=$2', [f.mid, nation])).rows;
      assert.ok(Object.values(side.resources).every(n => Number(n) >= 0), 'All strategies stay inside real resource balances');
      assert.ok(units.length + (await f.events(nation)).filter(e => e.kind === 'produce').length <= 80);
      sides.push({ nation, provinces: (await db.query('select count(*)::int n from dorra_private.war_provinces where match_id=$1 and nation_id=$2', [f.mid, nation])).rows[0].n,
        formations: units.length, effectiveStrength: rounded(units.reduce((n, u) => n + Number(u.strength) * Number(u.health) / 100, 0)),
        domains: units.reduce((totals, u) => ({ ...totals, [u.domain]: (totals[u.domain] || 0) + 1 }), {}),
        resources: Object.fromEntries(Object.entries(side.resources).map(([k, v]) => [k, rounded(v)])), researchCount: side.research.length });
    }
    return { difficulty, geography: island ? 'island ports' : 'land border', firstMover, requestedHours: hours, completedHours,
      startingConditions: { provincesPerSide: 3, formationsPerSide: 4, strengthPerFormation: 1, resourcesPerSide: AI_RESOURCES, identicalArsenals: true, unitIds: 'Deterministic fixture sequence replaces random UUID tie-breaking; all simulation rules use production SQL.' },
      decisions, decisionMs: { max: rounded(Math.max(0, ...decisionMs)), p95: percentile(decisionMs, .95), total: rounded(decisionMs.reduce((n, ms) => n + ms, 0)) },
      actionCounts, mobilizedPlatforms: [...mobilized].sort(), researchedPlatforms: [...researched].sort(), builtFacilities: [...facilities].sort(),
      status: final.status, winner: final.winner, sides };
  });
}

async function nationalSharedStart(db, nationIds) {
  return isolatedAiScenario(db, { nationIds, realCatalog: true, researched: false }, async f => {
    await db.query('delete from dorra_private.war_provinces where match_id=$1 and province_id=$2', [f.mid, f.pid('BX')]);
    // An isolated planning comparison: equal land/port/air infrastructure and
    // budgets, two baseline formations plus one fielded national land model.
    // It deliberately does not substitute national roster size for a win rate.
    await db.query("update dorra_private.war_relations set relation='ceasefire' where match_id=$1", [f.mid]);
    const sides = [];
    for (const [nation, capital, front] of [[f.a, 'AH', 'AF'], [f.b, 'BH', 'BF']]) {
      const profile = (await db.query('select name,data from dorra_private.war_catalog_nations where id=$1', [nation])).rows[0];
      const platforms = (await db.query("select id,name,data from dorra_private.war_catalog_platforms where (data->'operators' ? $1 or data->'operators' ? '*') and not coalesce((data->>'nuclear')::boolean,false)", [nation])).rows;
      const nationalLand = platforms.filter(p => p.data.operators.includes(nation) && p.data.domain === 'land' && Number(p.data.level || 1) === 1 && (p.data.prerequisites || []).length === 0).sort((a, b) => a.id.localeCompare(b.id))[0];
      await f.unit('infantry-company', capital, nation); await f.unit('infantry-company', front, nation);
      if (nationalLand) await f.unit(nationalLand.id, capital, nation);
      await db.query('update dorra_private.war_sides set research=$3 where match_id=$1 and nation_id=$2', [f.mid, nation, JSON.stringify(['infantry-company', ...(nationalLand ? [nationalLand.id] : [])])]);
      const before = await f.side(nation), started = performance.now(); await f.decide(nation, 0); const ms = performance.now() - started;
      const after = await f.side(nation), jobs = await f.events(nation);
      assert.ok(Object.values(after.resources).every(v => Number(v) >= 0));
      for (const event of jobs.filter(e => e.payload.platformId)) assert.ok(platforms.some(p => p.id === event.payload.platformId), 'Every national planning choice belongs to its actual eligible arsenal');
      sides.push({ nation, name: profile.name, productionProfile: { economy: profile.data.economy, military: profile.data.military },
        nonNuclearEligiblePlatforms: platforms.length,
        fieldedNationalPlatforms: platforms.filter(p => p.data.operators.includes(nation)).length,
        domains: platforms.reduce((counts, p) => ({ ...counts, [p.data.domain]: (counts[p.data.domain] || 0) + 1 }), {}),
        starterNationalLand: nationalLand?.id || null, startingFormationCount: nationalLand ? 3 : 2,
        firstDecisionMs: rounded(ms), jobs, spent: Object.fromEntries(Object.entries(before.resources).map(([k, v]) => [k, rounded(Number(v) - Number(after.resources[k]))])) });
    }
    return { nations: nationIds, scope: 'Equal-budget authored map; one actual legal decision per national arsenal, no simulated victory', sides };
  });
}

export async function checkWarAiBalance({ output = new URL('../work/war-ai-balance-report.json', import.meta.url) } = {}) {
  const db = await warDatabase(), started = performance.now();
  const report = { ok: false, startedAt: new Date().toISOString(), scope: 'Deterministic synthetic shared starts and national-arsenal planning samples. No human playtest or win-rate claim.', mirrorScenarios: [], nationalComparisons: [] };
  try {
    for (const difficulty of ['recruit', 'standard', 'veteran']) for (const firstMover of ['A', 'B']) report.mirrorScenarios.push(await mirrorScenario(db, { difficulty, firstMover }));
    for (const firstMover of ['A', 'B']) report.mirrorScenarios.push(await mirrorScenario(db, { difficulty: 'standard', island: true, firstMover }));
    report.mirrorPairDifferences = [];
    for (let i = 0; i < report.mirrorScenarios.length; i += 2) {
      const [aFirst, bFirst] = report.mirrorScenarios.slice(i, i + 2);
      report.mirrorPairDifferences.push({ difficulty: aFirst.difficulty, geography: aFirst.geography,
        AFirst: aFirst.sides.map(s => ({ nation: s.nation, provinces: s.provinces, effectiveStrength: s.effectiveStrength })),
        BFirst: bFirst.sides.map(s => ({ nation: s.nation, provinces: s.provinces, effectiveStrength: s.effectiveStrength })),
        note: 'Deterministic ordering comparison; any asymmetry requires inspection, not a statistical balance conclusion.' });
    }
    const directory = new URL('./war-seed/', import.meta.url);
    for (const file of (await readdir(directory)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, directory), 'utf8'));
    report.catalogue = (await db.query('select (select count(*) from dorra_private.war_catalog_nations)::int nations,(select count(*) from dorra_private.war_catalog_provinces)::int provinces,(select count(*) from dorra_private.war_catalog_platforms)::int platforms')).rows[0];
    for (const pair of [['NZ', 'AU'], ['CA', 'US'], ['BR', 'ZA'], ['ID', 'JP']]) report.nationalComparisons.push(await nationalSharedStart(db, pair));
    report.ok = true;
  } catch (error) { report.failure = { message: error.message, where: error.where }; }
  finally {
    report.elapsedMs = rounded(performance.now() - started); await db.close();
    if (output) { await mkdir(new URL('.', output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2)); }
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await checkWarAiBalance();
  console.log(JSON.stringify({ ok: report.ok, elapsedMs: report.elapsedMs, mirrorScenarios: report.mirrorScenarios.length, nationalComparisons: report.nationalComparisons.length, failure: report.failure }, null, 2));
  if (!report.ok) process.exitCode = 1;
}
