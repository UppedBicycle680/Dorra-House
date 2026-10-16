import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, API_URL } from '../online-config.js';
import { applyWarDelta } from '../war/projection.mjs';
import { targetMapPoint } from '../tests/war-map-input.mjs';

// Opt-in, real-time campaigns against the configured Supabase project. All
// gameplay mutations use the rendered UI. No clocks, armies, resources or
// outcomes are installed by the runner. Reward claims are covered by isolated
// database/browser tests; live QA leaves permanent House receipts untouched.
const origin = 'https://uppedbicycle680.github.io';
const site = process.env.DORRA_SITE_URL || origin + '/Dorra-House/';
const endpoint = SUPABASE_URL + '/functions/v1/dorra-war';
const nations = JSON.parse(await readFile(new URL('../assets/war/nations.json', import.meta.url), 'utf8')).nations;
const source = process.env.DORRA_SOLO_SOURCE === '1';
const reportPath = process.env.DORRA_SOLO_REPORT || 'work/war-solo-live-report.json';
const report = { ok: false, source, startedAt: new Date().toISOString(), clock: 'Unmodified hosted 360x fast time', accounts: [], campaigns: [] };
const cases = [
  { label: 'desktop', nation: 'FR', rival: 'LU', difficulty: 'standard', strategy: 'advance', viewport: { width: 1440, height: 900 } },
  { label: 'mobile', nation: 'FR', rival: 'LU', difficulty: 'veteran', strategy: 'advance', viewport: { width: 320, height: 740 } }
].filter(row => !process.env.DORRA_SOLO_CASES || process.env.DORRA_SOLO_CASES.split(',').includes(row.label));
const browser = await chromium.launch({ headless: true, ...(process.env.DORRA_CHROMIUM_PATH ? { executablePath: process.env.DORRA_CHROMIUM_PATH } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function save() { await mkdir('work', { recursive: true }); await writeFile(reportPath, JSON.stringify(report, null, 2)); }
async function http(url, body, session) {
  const response = await fetch(url, { method: 'POST', headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Origin: origin, 'Content-Type': 'application/json', ...(session ? { Authorization: 'Bearer ' + session.access_token } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  const value = await response.json();
  if (!response.ok) throw Object.assign(new Error(value.code || value.error_code || 'HTTP_' + response.status), { code: value.code });
  return value;
}
async function geography(nationId, provinceId) {
  const nation = nations.find(row => row.id === nationId);
  for (const region of nation.regionIds) {
    const data = JSON.parse(await readFile(new URL('../assets/war/provinces/' + region + '.json', import.meta.url), 'utf8'));
    const feature = data.features.find(row => row.properties.id === provinceId);
    if (feature) return feature.properties;
  }
  throw new Error('MISSING_PUBLIC_GEOGRAPHY');
}
async function campaign(config) {
  const result = { ...config, ok: false, startedAt: new Date().toISOString(), commands: [], progress: [], checks: [], errors: [] };
  report.campaigns.push(result);
  const suffix = randomBytes(6).toString('hex'), username = 'WarQA_' + suffix;
  let session, context, page, view, leaseId, awaitingProjection = false, stage = 'signup';
  const install = value => {
    if (value.delta && (!view || value.delta.revision > view.match.revision)) {
      if (!view || value.delta.baseRevision !== view.match.revision) { awaitingProjection = true; result.observerRecoveries = (result.observerRecoveries || 0) + 1; }
      else view = applyWarDelta(view, value.delta);
    }
    if (value.view && (!view || value.view.match.revision >= view.match.revision)) { view = value.view; awaitingProjection = false; }
    if (view) result.matchId = view.match.id;
  };
  try {
    session = await http(SUPABASE_URL + '/auth/v1/signup', { email: 'war.qa.' + suffix + '@example.com', password: 'Aa1!' + randomBytes(30).toString('base64url'), data: { username } });
    if (session.user?.id) { report.accounts.push({ id: session.user.id, username }); await save(); }
    assert.ok(session.access_token && session.user?.id);
    context = await browser.newContext({ viewport: config.viewport, hasTouch: config.label === 'mobile', isMobile: config.label === 'mobile' });
    await context.addInitScript(value => localStorage.setItem('dorra-online-auth', JSON.stringify(value)), session);
    if (source) { const { serveSource } = await import('../tests/browser-helpers.mjs'); await context.route(origin + '/Dorra-House/**', serveSource); }
    page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => result.errors.push(error.message));
    const responses = new Map();
    page.on('request', request => {
      if ([endpoint, API_URL].includes(request.url()) && request.method() === 'POST') {
        const body = request.postDataJSON(); if (body.leaseId) leaseId = body.leaseId;
        if (request.url() === endpoint && !['view', 'list'].includes(body.action)) result.commands.push({ action: body.action, args: body.args, requestId: body.requestId });
      }
    });
    let observed = Promise.resolve();
    page.on('response', response => {
      if (response.url() === endpoint && response.request().method() === 'POST') observed = observed.then(async () => {
        const value = await response.json();
        responses.set(response.request().postDataJSON().requestId, { ok: response.ok(), value });
        if (response.ok()) install(value);
        else if (value.code === 'MATCH_NOT_RUNNING') result.terminalRaces = (result.terminalRaces || 0) + 1;
        else if (value.code === 'MATCH_CATCHING_UP') result.catchupRetries = (result.catchupRetries || 0) + 1;
        else result.errors.push(value.code || 'WAR_REQUEST_REJECTED');
      }).catch(error => result.errors.push(error.message));
    });
    async function settle() { await observed; await page.waitForFunction(() => document.querySelector('#warApp')?.getAttribute('aria-busy') !== 'true', null, { timeout: 20000 }); await observed; }
    async function click(selector, action = null) {
      await settle();
      const pending = action ? page.waitForResponse(response => response.url() === endpoint && response.request().method() === 'POST' && response.request().postDataJSON().action === action) : null;
      await page.locator(selector).click();
      if (pending) {
        const response = await pending;
        let value = await response.json(), accepted = response.ok();
        if (value.code === 'MATCH_CATCHING_UP') {
          await settle();
          const retried = responses.get(response.request().postDataJSON().requestId);
          if (retried) { value = retried.value; accepted = retried.ok; }
        }
        if (!accepted) {
          if (value.code === 'MATCH_NOT_RUNNING') {
            // A natural conclusion can commit between the last visible frame
            // and a production/order click. Recover through an ordinary reload.
            await settle(); await page.reload(); await page.locator('#commandNav:not([hidden])').waitFor(); await settle();
            assert.equal(view.match.status, 'finished', 'A rejected late action is acceptable only after a verified natural conclusion');
            return false;
          }
          assert.fail(value.code || 'Rejected gameplay action');
        }
      }
      await settle();
    }
    const tab = name => click('#commandNav [data-action="tab"][data-id="' + name + '"]');
    const ownCapital = nations.find(row => row.id === config.nation).capitalProvinceId;
    const rivalCapital = nations.find(row => row.id === config.rival).capitalProvinceId;
    const ownPoint = await geography(config.nation, ownCapital), rivalPoint = await geography(config.rival, rivalCapital);
    async function industry() {
      if (await page.locator('[data-action="clear-selection"]').isVisible()) await click('[data-action="clear-selection"]');
      await tab('industry');
      const picker = page.locator('#provinceSearch');
      if (await picker.count()) await picker.fill(ownCapital);
      const option = page.locator('[data-action="province"][data-id="' + ownCapital + '"]');
      if (await option.count()) await click('[data-action="province"][data-id="' + ownCapital + '"]');
      else if (!await page.locator('[data-action="produce"]').count()) { await tab('map'); await targetMapPoint(page, ownPoint); }
    }
    stage = 'create'; await page.goto(site + 'war-simulation.html'); await page.locator('#lobbyPanel:not([hidden])').waitFor({ timeout: 60000 });
    await page.locator('#nationSearch').fill(config.nation); await click('[data-action="nation"][data-id="' + config.nation + '"]');
    await page.locator('#opponentNation').selectOption(config.rival); await page.locator('#aiDifficulty').selectOption(config.difficulty);
    await page.locator('#visibility').selectOption('invite'); await page.locator('#matchName').fill('Solo playtest ' + config.label);
    await click('[data-action="create"]', 'create'); assert.equal(view.match.aiDifficulty, config.difficulty);
    result.initialForces = view.units.filter(unit => unit.nationId === config.nation).map(unit => ({ platform: unit.platformId, strength: unit.strength }));
    stage = 'start'; await click('[data-action="start"]', 'start'); result.checks.push('Created and started through the UI with saved AI difficulty');
    await tab('operation'); await click('[data-action="pause"]', 'pause'); const pausedAt = view.match.gameTime;
    await sleep(1000); await click('[data-action="resume"]', 'resume'); assert.equal(view.match.status, 'running');
    result.checks.push('Solo pause and resume use the actual server');
    stage = 'research'; await tab('research'); await click('[data-action="branch"][data-id="industry"]');
    const doctrine = page.locator('[data-action="research"][data-id="combined-arms-doctrine"]');
    if (await doctrine.isEnabled()) await click('[data-action="research"][data-id="combined-arms-doctrine"]', 'research');
    await industry();
    const build = page.locator('[data-action="build"][data-id="army-base"]');
    if (await build.isEnabled()) await click('[data-action="build"][data-id="army-base"]', 'build');
    result.checks.push('Normal research and facility construction accepted through the UI');
    const deadline = Date.now() + Math.max(1, Number(process.env.DORRA_SOLO_MAX_MINUTES || 30)) * 60000;
    let lastProgress = 0, reloaded = false;
    while (view.match.status !== 'finished' && Date.now() < deadline) {
      stage = 'campaign'; await settle();
      if (view.match.status === 'finished') break;
      const own = view.units.filter(unit => unit.nationId === config.nation);
      if (Date.now() - lastProgress > 20000) {
        lastProgress = Date.now(); result.progress.push({ gameHours: Math.round(view.match.gameTime / 360) / 10, ownFormations: own.length, ownedProvinces: view.provinces.filter(row => row.ownerId === config.nation).length, visibleHostiles: view.units.filter(unit => unit.nationId !== config.nation).length });
        console.log(config.label + ' ' + JSON.stringify(result.progress.at(-1))); await save();
      }
      if (!reloaded && view.match.gameTime > 12 * 3600) {
        await page.reload(); await page.locator('#commandNav:not([hidden])').waitFor(); reloaded = true;
        result.checks.push('Reload recovered the same running campaign'); await settle();
      }
      if (view.provinces.some(row => row.id === ownCapital && row.ownerId === config.nation)) {
        await industry();
        if (view.match.status === 'finished') break;
        const facility = view.provinces.find(row => row.id === ownCapital)?.facilities?.['army-base'] || 0;
        if (facility < 3 && !view.player.buildQueue.some(job => job.provinceId === ownCapital)) {
          const upgrade = page.locator('[data-action="build"][data-id="army-base"]');
          if (await upgrade.isEnabled()) await click('[data-action="build"][data-id="army-base"]', 'build');
        }
        if (view.match.status !== 'finished' && own.length < 14 && !view.player.productionQueue.some(job => job.provinceId === ownCapital)) {
          const repair = own.some(unit => unit.platformId === 'combat-engineers');
          const choice = !repair ? 'combat-engineers' : config.nation === 'FR' && facility >= 3 ? 'leclerc' : 'infantry-company';
          const produce = page.locator('[data-action="produce"][data-id="' + choice + '"]');
          const cost = view.catalog.platforms.find(platform => platform.id === choice)?.cost;
          const affordable = cost && Object.entries(cost).every(([resource, amount]) => Number(view.player.resources[resource] || 0) >= amount);
          if (affordable && await produce.count() && await produce.isEnabled()) await click('[data-action="produce"][data-id="' + choice + '"]', 'produce');
        }
      }
      if (view.match.status !== 'finished' && config.strategy === 'advance') {
        const guards = new Set(own.filter(unit => unit.platformId === 'infantry-company' && unit.provinceId === ownCapital && !unit.order?.type).slice(0, 1).map(unit => unit.id));
        for (const unit of own.filter(unit => unit.domain === 'land' && unit.platformId !== 'combat-engineers' && !unit.order?.type && !guards.has(unit.id) && unit.health > 35 && unit.provinceId !== rivalCapital).slice(0, 4)) {
          if (view.match.status === 'finished') break;
          await tab('intelligence'); const selector = '[data-action="select-unit"][data-id="' + unit.id + '"]';
          if (!await page.locator(selector).count()) continue;
          const orderType = view.provinces.find(province => province.id === rivalCapital)?.ownerId === config.nation ? 'move' : 'attack';
          await click(selector); await click('[data-action="order-type"][data-id="' + orderType + '"]');
          await targetMapPoint(page, rivalPoint); await settle();
          if (view.match.status === 'finished') break;
          // Another formation may capture the destination while this human
          // commander is selecting it. Reinforce the newly friendly province.
          if (orderType === 'attack' && view.provinces.find(province => province.id === rivalCapital)?.ownerId === config.nation) {
            await click('[data-action="order-type"][data-id="move"]'); await targetMapPoint(page, rivalPoint); await settle();
          }
          await page.locator('[data-action="confirm-order"]').waitFor();
          assert.equal(await page.locator('[data-action="confirm-order"]').isEnabled(), true, await page.locator('#selectionPanel').textContent());
          await click('[data-action="confirm-order"]', 'order');
        }
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'The viewport must remain usable');
      await sleep(6000);
    }
    assert.equal(view.match.status, 'finished', 'A complete campaign must reach a server-owned natural conclusion within the playtest window');
    assert.ok(view.victory && view.match.gameTime > pausedAt);
    await tab('operation'); await page.locator('[data-action="retire"]').waitFor({ state: 'hidden' });
    assert.ok(await page.locator('[data-action="reward"]').count());
    result.outcome = { victory: view.victory, gameHours: view.match.gameTime / 3600, status: view.match.status };
    await page.screenshot({ path: 'work/war-solo-' + config.label + '-finished.png' });
    await page.reload(); await page.locator('#commandNav:not([hidden])').waitFor(); await tab('operation');
    assert.equal(view.match.status, 'finished'); assert.equal(awaitingProjection, false, 'The final reload must recover a complete authoritative projection'); result.checks.push('Natural game over and finished save survive reload');
    assert.deepEqual(result.errors, []); result.ok = true;
  } catch (error) {
    result.failure = { stage, message: error.message }; console.error(config.label + ' failed at ' + stage + ': ' + error.message);
    if (page) await page.screenshot({ path: 'work/war-solo-' + config.label + '-failure.png' }).catch(() => {});
  } finally {
    if (view && view.match.status !== 'finished' && leaseId) await http(endpoint, { protocolVersion: 1, action: 'retire', args: {}, leaseId, matchId: view.match.id, requestId: randomUUID() }, session).catch(error => { result.cleanupFailure = error.message; });
    await context?.close();
    if (session) await http(SUPABASE_URL + '/auth/v1/logout?scope=global', {}, session).catch(() => {});
    result.finishedAt = new Date().toISOString(); await save();
  }
}
try { assert.ok(cases.length); await Promise.all(cases.map(campaign)); report.ok = report.campaigns.every(row => row.ok); }
finally { await browser.close(); report.finishedAt = new Date().toISOString(); await save(); }
console.log(JSON.stringify({ ok: report.ok, accounts: report.accounts, campaigns: report.campaigns.map(({ label, ok, matchId, outcome, failure }) => ({ label, ok, matchId, outcome, failure })) }));
if (!report.ok) process.exitCode = 1;
