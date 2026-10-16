import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { PLATFORMS } from '../war/catalog.mjs';
import { baseURL, supabaseHost, responseHeaders, launchBrowser, serveSource } from './browser-helpers.mjs';

const userId = '18c692ba-0b72-4205-9728-a70c5cf42f52';
const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'ai-commander@example.test', user_metadata: { username: 'Commander' }, app_metadata: { provider: 'email', providers: ['email'] }, created_at: '2026-01-01T00:00:00Z' };
const auth = { access_token: 'test-only-ai-auth', refresh_token: 'test-only-ai-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user };
const nations = [
  { id: 'AU', name: 'Australia', lng: 150, lat: -30, military: 55, economy: 1700, capitalProvinceId: 'AU-1', arsenal: ['infantry-company', 'boxer-crv', 'bushmaster'] },
  { id: 'NZ', name: 'New Zealand', lng: 175, lat: -41, military: 19, economy: 207, capitalProvinceId: 'NZ-1', arsenal: ['infantry-company', 'nzlav', 'p8a-poseidon'] },
  { id: 'US', name: 'United States', lng: -100, lat: 40, military: 100, economy: 21900, capitalProvinceId: 'US-1', nuclear: true, arsenal: ['infantry-company', 'm1a2-abrams', 'f35', 'patriot'] }
];
const polygon = nation => ({ type: 'Feature', id: nation.id, properties: { id: nation.id, countryId: nation.id, name: nation.name, lng: nation.lng, lat: nation.lat }, geometry: { type: 'Polygon', coordinates: [[[nation.lng - 4, nation.lat - 4], [nation.lng + 4, nation.lat - 4], [nation.lng + 4, nation.lat + 4], [nation.lng - 4, nation.lat + 4], [nation.lng - 4, nation.lat - 4]]] } });
function viewFor(match) {
  return { match: { id: 'ai-match', name: 'Solo exercise', hostId: userId, status: 'lobby', pace: 'fast', template: 'duel', opponent: 'ai', revision: 1, gameTime: 0, speed: 360, maxPlayers: 2, ...match }, player: { nationId: 'AU', userId, resources: { cash: 10000, supplies: 5000, fuel: 3000, electronics: 1500, manpower: 4000 }, research: [], researchQueue: [], productionQueue: [], buildQueue: [] }, nations: nations.map(nation => ({ id: nation.id, name: nation.name, relation: nation.id === 'AU' ? 'self' : 'peace', score: 10 })), provinces: [{ id: 'AU-1', ownerId: 'AU', morale: 100, facilities: {} }], units: [], reports: [], diplomacy: [], catalog: { platforms: PLATFORMS.filter(platform => platform.operators.includes('*') || platform.operators.includes('AU')) } };
}
async function harness(browser, viewport, worlds = [], configureView = () => {}) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width <= 700 });
  await context.addInitScript(value => localStorage.setItem('dorra-online-auth', JSON.stringify(value)), auth);
  const state = { calls: [], leaseId: null, view: null };
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const reply = value => route.fulfill({ status: 200, headers: responseHeaders, body: JSON.stringify(value) });
    if (url.hostname === supabaseHost) {
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: responseHeaders, body: '' });
      if (url.pathname.startsWith('/auth/v1/')) return reply(url.pathname.endsWith('/user') ? user : auth);
      const body = request.postDataJSON();
      if (url.pathname.endsWith('/dorra-admin')) return reply({ messages: [], serverNow: Date.now() });
      if (url.pathname.endsWith('/dorra-api')) { if (body.action === 'acquire') state.leaseId = body.leaseId; return reply({ snapshot: { balance: 1000, progress: { profile: { name: 'Commander' } }, history: [] }, revision: 1, userId, serverNow: Date.now() }); }
      assert.equal(url.pathname, '/functions/v1/dorra-war'); assert.equal(body.leaseId, state.leaseId); state.calls.push(body);
      if (body.action === 'list') return reply({ matches: worlds, serverNow: Date.now() });
      if (body.action === 'create') state.view = viewFor({ ...body.args, ...(body.args.opponent === 'ai' ? { aiDifficulty: body.args.aiDifficulty ?? 'standard' } : {}) });
      if (body.action === 'view') { const match = worlds.find(match => match.id === body.matchId); state.view = viewFor(match); }
      if (state.view && ['create', 'view'].includes(body.action)) configureView(state.view);
      if (body.action === 'start') state.view.match.status = 'running';
      return reply({ view: state.view, serverNow: Date.now() });
    }
    if (url.pathname.endsWith('/assets/war/nations.json')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ nations }) });
    if (url.pathname.endsWith('/assets/war/world.json')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ type: 'FeatureCollection', features: nations.map(polygon) }) });
    if (url.pathname.includes('/assets/war/provinces/')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ type: 'FeatureCollection', features: [] }) });
    return serveSource(route);
  });
  const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseURL + 'war-simulation.html'); await page.waitForSelector('#lobbyPanel:not([hidden])');
  return { context, page, state, errors };
}

test('solo AI defaults to Standard and persists explicit choices across desktop and 320px lobby changes', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 740 }]) {
      const { context, page, state, errors } = await harness(browser, viewport);
      assert.equal(await page.locator('#aiDifficulty').inputValue(), 'standard');
      assert.deepEqual(await page.locator('#aiDifficulty option').evaluateAll(options => options.map(option => option.value)), ['recruit', 'standard', 'veteran']);
      await page.locator('#aiDifficulty').selectOption('veteran');
      assert.equal(await page.locator('#aiDifficulty').evaluate(element => element === document.activeElement), true, 'Keyboard focus stays on the difficulty control after its description updates');
      assert.match(await page.locator('#aiDifficultyHelp').textContent(), /every 3 game hours/);
      assert.match(await page.locator('#aiRules').textContent(), /same resource costs, income, combat rules and fog of war/);
      await page.locator('#matchName').fill('Veteran training');
      await page.locator('[data-action="pace"][data-id="persistent"]').click();
      assert.equal(await page.locator('#aiDifficulty').inputValue(), 'veteran');
      assert.equal(await page.locator('#matchName').inputValue(), 'Veteran training');
      await page.locator('[data-action="create"]').click(); await page.waitForSelector('.ai-operation');
      assert.equal(state.calls.find(call => call.action === 'create').args.aiDifficulty, 'veteran');
      assert.match(await page.locator('.ai-operation').textContent(), /Veteran AI.*New Zealand/);
      assert.match(await page.locator('.ai-operation').textContent(), /every 3 game hours/);
      assert.equal(await page.locator('body').evaluate(element => element.scrollWidth <= innerWidth), true);
      assert.deepEqual(errors, []); await context.close();
    }
  } finally { await browser.close(); }
});

test('matchup guidance preserves national asymmetry and explains the single active world AI rival', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 740 }]) {
      const { context, page, errors } = await harness(browser, viewport);
      await page.locator('#opponentNation').selectOption('US');
      assert.match(await page.locator('.lobby-footer .matchup-brief').textContent(), /Rival starting advantage.*not a win prediction/);
      assert.equal(await page.locator('.matchup-brief').evaluate(element => { const box = element.getBoundingClientRect(); return box.top >= 60 && box.bottom <= innerHeight; }), true, 'Starting advantage remains visible beside Create without scrolling');
      assert.match(await page.locator('.matchup-summary').textContent(), /Rival starting advantage/);
      assert.match(await page.locator('.matchup-summary').textContent(), /asymmetric challenge/);
      assert.match(await page.locator('.matchup-summary').textContent(), /55 \/ 100.*100 \/ 100/);
      assert.match(await page.locator('.matchup-summary').textContent(), /Historical economy/);
      assert.match(await page.locator('.matchup-summary').textContent(), /national starting forces/);
      assert.match(await page.locator('.matchup-summary .nation-arsenal').textContent(), /F-35|Abrams|Patriot/);
      await page.locator('#template').selectOption('world');
      assert.equal(await page.locator('#opponentNation').inputValue(), 'US');
      assert.match(await page.locator('.world-ai-note').textContent(), /selected AI rival campaigns actively.*Other unclaimed nations defend/);
      await page.locator('#aiDifficulty').selectOption('recruit');
      assert.match(await page.locator('#aiDifficultyHelp').textContent(), /every 12 game hours/);
      await page.locator('#aiDifficulty').scrollIntoViewIfNeeded();
      assert.equal(await page.locator('body').evaluate(element => element.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(os.tmpdir(), viewport.width > 700 ? 'dorra-war-ai-desktop.png' : 'dorra-war-ai-320.png') });
      await page.locator('.matchup-summary').evaluate(element => element.scrollIntoView({ block: 'start' }));
      await page.screenshot({ path: path.join(os.tmpdir(), viewport.width > 700 ? 'dorra-war-ai-matchup-desktop.png' : 'dorra-war-ai-matchup-320.png') });
      assert.deepEqual(errors, []); await context.close();
    }
  } finally { await browser.close(); }
});

test('multiplayer hides AI settings and never sends a stale solo difficulty', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    const { context, page, state, errors } = await harness(browser, { width: 320, height: 740 });
    await page.locator('#aiDifficulty').selectOption('veteran');
    await page.locator('[data-action="opponent"][data-id="human"]').click();
    assert.equal(await page.locator('#aiDifficulty').count(), 0);
    await page.locator('#template').selectOption('world');
    assert.equal(await page.locator('#opponentNation').count(), 0);
    assert.equal(await page.locator('.matchup-summary').count(), 0);
    await page.locator('[data-action="create"]').click(); await page.waitForSelector('[data-action="start"]');
    assert.equal(Object.hasOwn(state.calls.find(call => call.action === 'create').args, 'aiDifficulty'), false);
    assert.equal(await page.locator('.ai-operation').count(), 0);
    assert.deepEqual(errors, []); await context.close();
  } finally { await browser.close(); }
});

test('resuming existing solo worlds uses their stored difficulty and defaults older worlds to Standard', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    for (const stored of [undefined, 'recruit']) {
      const match = { id: 'existing-ai', name: 'Existing solo campaign', status: 'running', opponent: 'ai', opponentNationId: 'NZ', template: 'duel', pace: 'fast', players: 1, joined: true, ...(stored ? { aiDifficulty: stored } : {}) };
      const { context, page, state, errors } = await harness(browser, { width: 320, height: 740 }, [match]);
      await page.locator('#aiDifficulty').selectOption('veteran');
      await page.locator('[data-action="lobby-tab"][data-id="worlds"]').click();
      assert.match(await page.locator('.world-card-meta').textContent(), stored ? /Recruit AI/ : /Standard AI/);
      await page.locator('[data-action="open-match"]').click(); await page.waitForSelector('#commandNav:not([hidden])');
      await page.locator('[data-action="tab"][data-id="operation"]').click();
      assert.match(await page.locator('.ai-operation').textContent(), stored ? /Recruit AI/ : /Standard AI/);
      assert.doesNotMatch(await page.locator('.ai-operation').textContent(), /Veteran/);
      assert.equal(state.calls.filter(call => call.action === 'create').length, 0);
      assert.deepEqual(errors, []); await context.close();
    }
  } finally { await browser.close(); }
});

test('queued peace proposals stay visible while the actual diplomatic relation remains at war', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    const { context, page, errors } = await harness(browser, { width: 320, height: 740 }, [], view => { view.diplomacy = [{ nationId: 'NZ', relation: 'war', proposal: 'peace', proposedBy: 'AU' }]; });
    await page.locator('[data-action="create"]').click(); await page.waitForSelector('[data-action="start"]');
    await page.locator('[data-action="tab"][data-id="diplomacy"]').click();
    assert.match(await page.locator('.pending-diplomacy').textContent(), /Pending Peace proposal.*Awaiting a response/);
    const nation = page.locator('.diplomacy-row').filter({ has: page.getByRole('heading', { name: 'New Zealand', exact: true }) });
    assert.equal(await nation.locator('.profile-heading .tag').textContent(), 'War');
    assert.match(await page.locator('.drawer-body>p').first().textContent(), /review diplomatic proposals on their next decision cycle/);
    assert.deepEqual(errors, []); await context.close();
  } finally { await browser.close(); }
});

test('diplomatic response reports show the accepted or declined outcome without private AI reasoning', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    const { context, page, errors } = await harness(browser, { width: 320, height: 740 }, [], view => {
      view.reports = [{ type: 'diplomatic-response', nationId: 'NZ', proposal: 'peace', accepted: true }, { type: 'diplomatic-response', nationId: 'US', proposal: 'alliance', accepted: false }];
    });
    await page.locator('[data-action="create"]').click(); await page.waitForSelector('[data-action="start"]');
    await page.locator('[data-action="tab"][data-id="intelligence"]').click();
    const reports = await page.locator('.report-row p').allTextContents();
    assert.deepEqual(reports, ['New Zealand accepted your Peace proposal.', 'United States declined your Alliance proposal.']);
    assert.deepEqual(errors, []); await context.close();
  } finally { await browser.close(); }
});
