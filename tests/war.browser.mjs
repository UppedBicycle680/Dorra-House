import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { PLATFORMS } from '../war/catalog.mjs';
import { baseURL, supabaseHost, responseHeaders, launchBrowser, serveSource } from './browser-helpers.mjs';

const userId = '18c692ba-0b72-4205-9728-a70c5cf42f52';
const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'commander@example.test', user_metadata: { username: 'Commander' }, app_metadata: { provider: 'email', providers: ['email'] }, created_at: '2026-01-01T00:00:00Z' };
const auth = { access_token: 'test-only-auth-token', refresh_token: 'test-only-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user };
const polygon = (id, countryId, name, west, east, south, north, lng, lat) => ({ type: 'Feature', id, properties: { id, countryId, name, lng, lat, capital: true, city: true, port: true, terrain: 'urban' }, geometry: { type: 'Polygon', coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] } });
const nationData = [{ id: 'AU', name: 'Australia', lng: 150, lat: -30, military: 55, economy: 1700, capitalProvinceId: 'AU-1', arsenal: ['infantry-company', 'boxer-crv', 'bushmaster'] }, { id: 'NZ', name: 'New Zealand', lng: 170, lat: -40, military: 18, economy: 250, capitalProvinceId: 'NZ-1', arsenal: ['infantry-company'] }];
const features = [polygon('AU', 'AU', 'Australia', 120, 165, -45, -5, 150, -30), polygon('NZ', 'NZ', 'New Zealand', 166, 179, -48, -34, 170, -40)];
function initialView() { return { match: { id: 'match-test', name: 'Operation Meridian', status: 'lobby', pace: 'fast', template: 'duel', opponent: 'ai', revision: 1, gameTime: 0, speed: 360, hostId: userId, maxPlayers: 2 }, player: { nationId: 'AU', userId, resources: { cash: 10000, supplies: 5000, fuel: 3000, electronics: 1500, manpower: 4000 }, research: ['infantry-company'], researchQueue: [], productionQueue: [], buildQueue: [], importLicenses: [] }, nations: [{ id: 'AU', name: 'Australia', relation: 'self', score: 100 }, { id: 'NZ', name: 'New Zealand', relation: 'peace', score: 70 }], provinces: [{ id: 'AU-1', ownerId: 'AU', morale: 100, facilities: { 'army-base': 1 } }, { id: 'AU-2', ownerId: 'AU', morale: 100, facilities: {} }, { id: 'NZ-1', ownerId: 'NZ', morale: 100, facilities: {} }], units: [{ id: 'unit-1', name: '1st Infantry Company', nationId: 'AU', provinceId: 'AU-1', platformId: 'infantry-company', domain: 'land', health: 100, maxHealth: 100, strength: 10 }], reports: [], diplomacy: [], catalog: { platforms: PLATFORMS.filter(p => p.operators.includes('*') || p.operators.includes('AU')) } }; }

async function harness(browser, viewport, { realGeography = false, worlds = [], search = '', allied = false, configureView = null } = {}) {
  const context = await browser.newContext({ viewport, hasTouch: viewport.width < 700 });
  await context.addInitScript(value => localStorage.setItem('dorra-online-auth', JSON.stringify(value)), auth);
  const state = { view: null, leaseId: null, calls: [], dropResearch: false, ended: false };
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const reply = (body, status = 200) => route.fulfill({ status, headers: responseHeaders, body: JSON.stringify(body) });
    if (url.hostname === supabaseHost) {
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: responseHeaders, body: '' });
      if (url.pathname.startsWith('/auth/v1/')) return reply(url.pathname.endsWith('/user') ? user : auth);
      const body = request.postDataJSON();
      if (url.pathname.endsWith('/dorra-admin')) return reply({ messages: [], serverNow: Date.now() });
      if (url.pathname.endsWith('/dorra-api')) {
        if (body.action === 'acquire') state.leaseId = body.leaseId;
        return reply({ snapshot: { balance: 1000, progress: { profile: { name: 'Commander' }, campaign: { homeCountryId: 'AU', turn: 8 } }, history: [] }, revision: 1, userId, serverNow: Date.now() });
      }
      assert.equal(url.pathname, '/functions/v1/dorra-war');
      assert.equal(request.headers().authorization, `Bearer ${auth.access_token}`);
      assert.equal(body.leaseId, state.leaseId, 'War commands use the existing protected House session lease');
      state.calls.push(body);
      if (state.ended) return reply({ error: 'Another device started a gameplay session.', code: 'SESSION_REPLACED' }, 409);
      if (body.action === 'list') return reply({ matches: state.view ? [{ ...state.view.match, joined: true, players: 1 }] : worlds, serverNow: Date.now() });
      if (body.action === 'create') { state.view = initialView(); configureView?.(state.view); if(allied){state.view.diplomacy=[{nationId:'NZ',relation:'alliance'}];state.view.nations.find(n=>n.id==='NZ').relation='alliance';} return reply({ view: state.view, serverNow: Date.now() }); }
      if (body.action === 'join') { state.view = initialView(); state.view.match.id = body.matchId; state.view.match.opponent = 'human'; state.view.match.hostId = 'another-player'; state.view.player.nationId = body.args.nationId; return reply({ view: state.view, serverNow: Date.now() }); }
      if (!state.view) return reply({ error: 'Not a participant', code: 'NOT_MEMBER' }, 403);
      if (body.action === 'start') state.view.match.status = 'running';
      if (body.action === 'pause') state.view.match.status = 'paused';
      if (body.action === 'resume') state.view.match.status = 'running';
      if (body.action === 'research') {
        if (!state.view.player.researchQueue.length) state.view.player.researchQueue.push({ id: 'research-1', platformId: body.args.platformId, due: 7200 });
        if (state.dropResearch) { state.dropResearch = false; return route.abort('failed'); }
      }
      if (body.action === 'order') state.view.units[0].order = body.args;
      if (body.action === 'build') state.view.player.buildQueue.push({ id: 'build-1', facility: body.args.facility, provinceId: body.args.provinceId, due: 43200 });
      if(body.action==='diplomacy'&&body.args.type==='transfer'){
        assert.equal(state.view.diplomacy.find(row=>row.nationId===body.args.nationId)?.relation,'alliance');
        for(const [key,amount]of Object.entries(body.args.resources)){assert.ok(Number.isSafeInteger(amount)&&amount>0&&amount<=state.view.player.resources[key]);state.view.player.resources[key]-=amount;}
      }
      state.view.match.revision++;
      return reply({ view: state.view, serverNow: Date.now() });
    }
    if (!realGeography && url.pathname.endsWith('/assets/war/nations.json')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ nations: nationData }) });
    if (!realGeography && url.pathname.endsWith('/assets/war/world.json')) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ type: 'FeatureCollection', features }) });
    if (!realGeography && url.pathname.includes('/assets/war/provinces/')) {
      const country = url.pathname.endsWith('AU.json') ? 'AU' : 'NZ';
      const provinces = country === 'AU' ? [polygon('AU-1', 'AU', 'Capital province', 120, 155, -45, -20, 150, -30), polygon('AU-2', 'AU', 'Northern province', 120, 165, -20, -5, 160, -10)] : [polygon('NZ-1', 'NZ', 'Auckland', 166, 179, -48, -34, 170, -40)];
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ type: 'FeatureCollection', features: provinces }) });
    }
    return serveSource(route);
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseURL + 'war-simulation.html' + search);
  await page.waitForSelector('#lobbyPanel:not([hidden])');
  return { context, page, state, errors };
}

test('desktop command creates an authenticated world, researches idempotently and pauses solo time', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    const { context, page, state, errors } = await harness(browser, { width: 1440, height: 1000 });
    assert.match(await page.title(), /Strategic Command/);
    assert.equal(await page.locator('.lobby-heading h1').textContent(), 'Take command.');
    assert.equal(await page.locator('body').evaluate(element => element.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(os.tmpdir(), 'dorra-war-desktop.png') });
    await page.locator('#matchName').fill('Operation Meridian');
    await page.locator('[data-action="create"]').click();
    await page.waitForSelector('[data-action="start"]');
    const created = state.calls.find(call => call.action === 'create');
    assert.deepEqual(created.args, { nationId: 'AU', opponentNationId: 'NZ', template: 'duel', opponent: 'ai', pace: 'fast', visibility: 'public', name: 'Operation Meridian' });
    await page.locator('[data-action="start"]').click();
    await page.waitForSelector('[data-action="pause"]');
    await page.locator('[data-action="tab"][data-id="research"]').click();
    state.dropResearch = true;
    await page.locator('[data-action="research"][data-id="bushmaster"]').click();
    await page.waitForFunction(() => document.querySelectorAll('.queue-card').length > 0);
    assert.equal(state.calls.filter(call => call.action === 'research').length, 2);
    const research = state.calls.filter(call => call.action === 'research');
    assert.equal(research[0].requestId, research[1].requestId, 'A lost response retries the original intent');
    assert.equal(state.view.player.researchQueue.length, 1);
    assert.equal(await page.locator('[data-action="research"][data-id="bushmaster"]').isDisabled(), true);
    await page.locator('[data-action="tab"][data-id="operation"]').click();
    await page.locator('[data-action="pause"]').click();
    await page.waitForSelector('[data-action="resume"]');
    assert.match(await page.locator('#matchClock').textContent(), /PAUSED/);
    await page.screenshot({ path: path.join(os.tmpdir(), 'dorra-war-command-desktop.png') });
    assert.deepEqual(errors, []);
    await context.close();
  } finally { await browser.close(); }
});

test('facility upgrades show the next level price and research prerequisites', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    const { context, page, state, errors } = await harness(browser, { width: 1440, height: 1000 });
    await page.locator('[data-action="create"]').click(); await page.waitForSelector('[data-action="start"]');
    await page.locator('[data-action="start"]').click(); await page.waitForSelector('[data-action="pause"]');
    await page.locator('[data-action="tab"][data-id="research"]').click();
    assert.equal(await page.locator('[data-action="research"][data-id="boxer-crv"]').isDisabled(), true);
    assert.match(await page.locator('.equipment-card').filter({ has: page.locator('[data-id="boxer-crv"]') }).textContent(), /Army Base level 2/);
    await page.locator('[data-action="tab"][data-id="industry"]').click();
    await page.locator('[data-action="province"][data-id="AU-1"]').click();
    const upgrade = page.locator('[data-action="build"][data-id="army-base"]');
    assert.match(await upgrade.textContent(), /Upgrade → L2/);
    assert.equal(await upgrade.isDisabled(), false);
    const row = page.locator('.facility-row').filter({ has: upgrade });
    assert.match(await row.textContent(), /3,000/);
    assert.match(await row.textContent(), /12h/);
    await upgrade.click();
    await page.waitForFunction(() => document.querySelector('[data-action="build"][data-id="army-base"]').textContent.includes('Constructing'));
    assert.deepEqual(state.calls.find(call => call.action === 'build').args, { provinceId: 'AU-1', facility: 'army-base' });
    assert.deepEqual(errors, []); await context.close();
  } finally { await browser.close(); }
});

test('coalition resource transfers validate bounded amounts before desktop and mobile confirmation', { timeout: 120000 }, async()=>{
  const browser=await launchBrowser();
  try{
    for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
      const {context,page,state,errors}=await harness(browser,viewport,{allied:true});
      await page.locator('[data-action="create"]').click();await page.waitForSelector('[data-action="start"]');
      await page.locator('[data-action="start"]').click();await page.waitForSelector('[data-action="pause"]');
      await page.locator('[data-action="tab"][data-id="diplomacy"]').click();
      assert.match(await page.locator('#commandDrawer').textContent(),/Coalition access/);
      await page.locator('[data-action="transfer-resources"][data-nation="NZ"]').click();
      await page.waitForSelector('#transfer-cash');
      await page.locator('#dialogConfirm').click();
      assert.equal(state.calls.filter(c=>c.action==='diplomacy').length,0,'A zero transfer must not reach the service');
      assert.equal(await page.locator('#commandDialog').isVisible(),true);
      await page.locator('#transfer-cash').fill('10001');await page.locator('#dialogConfirm').click();
      assert.equal(state.calls.filter(c=>c.action==='diplomacy').length,0,'A transfer cannot exceed the current wallet');
      await page.locator('#transfer-cash').fill('100');await page.locator('#transfer-supplies').fill('0.5');await page.locator('#dialogConfirm').click();
      assert.equal(state.calls.filter(c=>c.action==='diplomacy').length,0,'Transfer quantities must be whole numbers');
      await page.locator('#transfer-supplies').fill('200');await page.locator('#dialogConfirm').click();
      await page.locator('#commandDialog').waitFor({state:'hidden'});
      assert.deepEqual(state.calls.find(c=>c.action==='diplomacy').args,{nationId:'NZ',type:'transfer',resources:{cash:100,supplies:200}});
      assert.equal(state.view.player.resources.cash,9900);assert.equal(state.view.player.resources.supplies,4800);
      assert.equal(await page.locator('body').evaluate(element=>element.scrollWidth<=innerWidth),true);
      assert.deepEqual(errors,[]);await context.close();
    }
  }finally{await browser.close();}
});

test('public and private numeric-player lobbies restrict joining to available duel nations', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  const matchId = '09645e02-106e-4213-82f1-dddf782d149c', inviteCode = '389f6d69-959b-47b3-b44d-c6190fd41983';
  const world = { id: matchId, name: 'Pacific duel', status: 'lobby', opponent: 'human', pace: 'fast', template: 'duel', players: 1, maxPlayers: 2, joined: false, availableNations: ['NZ'], occupiedNations: ['AU'], hostId: 'another-player' };
  try {
    for (const entry of ['public', 'link', 'code']) {
      const privateInvite = entry !== 'public';
      const fullWorld = { ...world, id: 'full-world', name: 'Full global campaign', template: 'world', players: 12, maxPlayers: 12, availableNations: ['NZ'] };
      const { context, page, state, errors } = await harness(browser, { width: 390, height: 844 }, { worlds: [fullWorld, { ...world, inviteMatched: true }], search: entry === 'link' ? `?match=${matchId}&invite=${inviteCode}` : '' });
      if (entry !== 'link') {
        await page.locator('[data-action="lobby-tab"][data-id="worlds"]').click();
        assert.equal(await page.locator('[data-action="join-match"][data-id="full-world"]').isDisabled(), true);
        assert.match(await page.locator('.world-card').filter({ hasText: 'Full global campaign' }).textContent(), /12 \/ 12 humans/);
        if (entry === 'code') { await page.locator('[data-action="join-invitation"]').click(); await page.locator('#invitationInput').fill(inviteCode); await page.locator('#dialogConfirm').click(); }
        else await page.locator(`[data-action="join-match"][data-id="${matchId}"]`).click();
      }
      await page.waitForSelector('#joinNation');
      assert.equal(await page.locator('#joinNation option').count(), 1);
      assert.equal(await page.locator('#joinNation').inputValue(), 'NZ');
      await page.locator('#dialogConfirm').click();
      await page.waitForSelector('#commandNav:not([hidden])');
      const join = state.calls.find(call => call.action === 'join');
      assert.deepEqual(join.args, { nationId: 'NZ', ...(privateInvite ? { inviteCode } : {}) });
      if (privateInvite) assert.equal(state.calls.find(call => call.action === 'list' && call.args.inviteCode)?.args.inviteCode, inviteCode);
      assert.deepEqual(errors, []); await context.close();
    }
  } finally { await browser.close(); }
});

test('desktop keyboard and drag selection plan a waypoint route before dispatch', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    const { context, page, state, errors } = await harness(browser, { width: 1440, height: 1000 });
    await page.locator('[data-action="create"]').click(); await page.waitForSelector('[data-action="start"]');
    await page.locator('[data-action="start"]').click(); await page.waitForSelector('[data-action="pause"]');
    await page.keyboard.press('r'); await page.waitForSelector('[data-action="research"]');
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#commandDrawer').isVisible(), false);
    const canvas = page.locator('#worldCanvas'), bounds = await canvas.boundingBox();
    await page.keyboard.down('Shift'); await page.mouse.move(bounds.x + bounds.width / 2 - 30, bounds.y + bounds.height / 2 - 30); await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2 + 30, bounds.y + bounds.height / 2 + 30, { steps: 4 }); await page.mouse.up(); await page.keyboard.up('Shift');
    await page.waitForSelector('#selectionPanel:not([hidden])');
    await page.locator('[data-action="route-mode"]').click();
    const scale = Math.min(bounds.width / 360, bounds.height / 165) * 3.6;
    await canvas.click({ position: { x: bounds.width / 2 + 10 * scale, y: bounds.height / 2 - 20 * scale } });
    await canvas.click({ position: { x: bounds.width / 2 - 10 * scale, y: bounds.height / 2 + 5 * scale } });
    assert.match(await page.locator('.pending-order').textContent(), /via 1 waypoint/);
    assert.equal(state.calls.filter(call => call.action === 'order').length, 0);
    await page.locator('[data-action="confirm-order"]').click();
    await page.waitForFunction(() => !document.querySelector('[data-action="confirm-order"]'));
    assert.deepEqual(state.calls.find(call => call.action === 'order').args, { unitIds: ['unit-1'], type: 'move', targetProvinceId: 'AU-1', waypoints: ['AU-2'] });
    assert.deepEqual(errors, []); await context.close();
  } finally { await browser.close(); }
});

test('mobile requires confirmation before movement and blocks commands when the lease ends', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    const { context, page, state, errors } = await harness(browser, { width: 390, height: 844 });
    page.setDefaultTimeout(10000);
    await page.locator('[data-action="create"]').click();
    await page.waitForSelector('[data-action="start"]');
    await page.locator('[data-action="start"]').click();
    await page.waitForSelector('[data-action="pause"]');
    await page.getByRole('button', { name: 'Theatre', exact: true }).click();
    const canvas = page.locator('#worldCanvas'), bounds = await canvas.boundingBox();
    const gesture = await context.newCDPSession(page), centreY = bounds.y + bounds.height / 2;
    const beforePinch = await canvas.screenshot();
    const touchPoints = distance => [{ x: bounds.x + bounds.width / 2 - distance, y: centreY, id: 1 }, { x: bounds.x + bounds.width / 2 + distance, y: centreY, id: 2 }];
    await gesture.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touchPoints(45) });
    await gesture.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touchPoints(75) });
    await page.evaluate(() => new Promise(requestAnimationFrame));
    assert.notDeepEqual(await canvas.screenshot(), beforePinch, 'A native touch pinch changes the rendered map scale');
    await gesture.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touchPoints(45) });
    await gesture.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await gesture.detach();
    await canvas.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
    await page.waitForSelector('#selectionPanel:not([hidden])', { timeout: 5000 }).catch(async error => { await page.screenshot({ path: path.join(os.tmpdir(), 'dorra-war-mobile-debug.png') }); throw error; });
    await page.locator('[data-action="order-type"][data-id="move"]').click();
    const scale = Math.min(bounds.width / 360, bounds.height / 165) * 3.6;
    await canvas.click({ position: { x: bounds.width / 2 + 10 * scale, y: bounds.height / 2 - 20 * scale } });
    await page.waitForSelector('[data-action="confirm-order"]');
    assert.equal(state.calls.filter(call => call.action === 'order').length, 0, 'Choosing a destination must not dispatch a mobile order');
    await page.screenshot({ path: path.join(os.tmpdir(), 'dorra-war-mobile.png') });
    await page.locator('[data-action="confirm-order"]').click();
    await page.waitForFunction(() => !document.querySelector('[data-action="confirm-order"]'));
    const order = state.calls.find(call => call.action === 'order');
    assert.deepEqual(order.args, { unitIds: ['unit-1'], type: 'move', targetProvinceId: 'AU-2' });
    assert.equal(await page.locator('body').evaluate(element => element.scrollWidth <= innerWidth), true);
    state.ended = true;
    await page.locator('[data-action="tab"][data-id="operation"]').click();
    await page.locator('[data-action="pause"]').click();
    await page.waitForSelector('#connectionBanner:not([hidden])');
    assert.match(await page.locator('#connectionBanner').textContent(), /Reload & sign in/);
    assert.equal(await page.locator('[data-action="pause"]').isDisabled(), true);
    assert.deepEqual(errors, []);
    await context.close();
  } finally { await browser.close(); }
});

test('production geography renders and nation search remains usable on desktop and mobile', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const { context, page, errors } = await harness(browser, viewport, { realGeography: true });
      await page.locator('#nationSearch').fill('Australia');
      assert.equal(await page.locator('.nation-row').count(), 1);
      await page.locator('[data-action="nation"][data-id="AU"]').click();
      const australiaHardware = await page.locator('.nation-arsenal').textContent();
      await page.locator('#nationSearch').fill('United States'); await page.locator('[data-action="nation"][data-id="US"]').click();
      assert.notEqual(await page.locator('.nation-arsenal').textContent(), australiaHardware, 'National hardware previews must preserve asymmetric operator rosters');
      await page.locator('#nationSearch').fill('Australia'); await page.locator('[data-action="nation"][data-id="AU"]').click();
      await page.waitForFunction(() => document.querySelector('#mapLoading').hidden);
      assert.equal(await page.locator('body').evaluate(element => element.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: path.join(os.tmpdir(), viewport.width > 700 ? 'dorra-war-world-desktop.png' : 'dorra-war-world-mobile.png') });
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally { await browser.close(); }
});

test('formation readiness and exact objectives remain readable on desktop and 320px mobile', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 740 }]) {
      const { context, page, errors } = await harness(browser, viewport, { configureView(view) { Object.assign(view.units[0], { health: 85, strength: 2, supply: .75, entrenchment: 10, order: {} }); } });
      await page.locator('[data-action="create"]').click(); await page.waitForSelector('[data-action="start"]');
      assert.match(await page.locator('.objective-note').textContent(), /six consecutive game hours/);
      assert.match(await page.locator('.objective-note').textContent(), /Capital 10 VP/);
      await page.locator('[data-action="start"]').click(); await page.waitForSelector('[data-action="pause"]');
      await page.locator('[data-action="tab"][data-id="intelligence"]').click();
      await page.locator('[data-action="select-unit"][data-id="unit-1"]').focus(); await page.keyboard.press('Enter');
      await page.waitForSelector('#selectionPanel:not([hidden])');
      assert.match(await page.locator('.formation-status').textContent(), /Ready for orders/);
      assert.doesNotMatch(await page.locator('#selectionPanel').textContent(), /\[object Object\]/);
      assert.match(await page.locator('.selection-facts').textContent(), /85 \/ 100 HP/);
      assert.match(await page.locator('.selection-facts').textContent(), /2 combat groups/);
      await page.locator('#formationDetails summary').click();
      assert.match(await page.locator('.formation-support').textContent(), /Supply support ×0.75/);
      assert.match(await page.locator('.formation-support').textContent(), /Entrenchment 10%/);
      assert.equal(await page.locator('.formation-stat-grid dt').count(), 6);
      assert.equal(await page.locator('body').evaluate(element => element.scrollWidth <= innerWidth), true);
      const clipped = await page.locator('#selectionPanel').evaluate(element => { const box = element.getBoundingClientRect(); return box.left < 0 || box.right > innerWidth || box.top < 60 || box.bottom > innerHeight; });
      assert.equal(clipped, false);
      await page.screenshot({ path: path.join(os.tmpdir(), viewport.width > 700 ? 'dorra-war-readiness-desktop.png' : 'dorra-war-readiness-320.png') });
      assert.deepEqual(errors, []); await context.close();
    }
  } finally { await browser.close(); }
});

test('defensive interceptors expose relevant controls and invalid offensive targets stay uncommitted', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    const { context, page, state, errors } = await harness(browser, { width: 320, height: 740 }, { configureView(view) {
      view.catalog.platforms.push(PLATFORMS.find(platform => platform.id === 'aster30'));
      view.units.push({ id: 'interceptor-1', name: 'Defensive missile battery', platformId: 'aster30', nationId: 'AU', provinceId: 'AU-1', domain: 'missile', strength: 1, health: 100, maxHealth: 100, order: {} });
    } });
    await page.locator('[data-action="create"]').click(); await page.waitForSelector('[data-action="start"]');
    await page.locator('[data-action="start"]').click(); await page.waitForSelector('[data-action="pause"]');
    await page.locator('[data-action="tab"][data-id="intelligence"]').click(); await page.locator('[data-action="select-unit"][data-id="interceptor-1"]').click();
    assert.equal(await page.locator('[data-action="order-type"]').count(), 1);
    assert.equal(await page.locator('[data-action="order-type"][data-id="intercept"]').isVisible(), true);
    assert.match(await page.locator('.command-guidance').textContent(), /Defensive interceptor/);
    await page.locator('[data-action="order-type"][data-id="intercept"]').click();
    await page.locator('#worldCanvas').focus(); await page.keyboard.press('h');
    for (let zoom = 0; zoom < 6; zoom++) await page.keyboard.press('+');
    const canvas = page.locator('#worldCanvas'), bounds = await canvas.boundingBox(), scale = Math.min(bounds.width / 360, bounds.height / 165) * 1.3 ** 6;
    await page.mouse.move(bounds.x + 100, bounds.y + 220); await page.mouse.down(); await page.mouse.move(bounds.x - 800, bounds.y - 400, { steps: 5 }); await page.mouse.up();
    await canvas.click({ position: { x: bounds.width / 2 - 10 * scale, y: bounds.height / 2 - 45 * scale } });
    await page.waitForSelector('[data-action="confirm-order"]');
    assert.equal(await page.locator('[data-action="confirm-order"]').isDisabled(), true);
    assert.match(await page.locator('.order-feedback.blocked').textContent(), /your own or an allied province/);
    assert.equal(state.calls.filter(call => call.action === 'order').length, 0);
    await page.screenshot({ path: path.join(os.tmpdir(), 'dorra-war-interceptor-320.png') });
    assert.deepEqual(errors, []); await context.close();
  } finally { await browser.close(); }
});

test('stationary air defence can retarget a friendly province and shows its actual reload time', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    const { context, page, state, errors } = await harness(browser, { width: 1440, height: 900 }, { configureView(view) {
      Object.assign(view.units[0], { name: 'NASAMS defence battery', platformId: 'nasams', interceptReadyAt: 3600, order: { type: 'intercept', targetProvinceId: 'AU-1' } });
      view.reports = [{ type: 'strike-missed', provinceId: 'AU-1' }, { type: 'strike-cancelled', provinceId: 'AU-1', reason: 'Defensive interceptor' }, { type: 'missile-defense', provinceId: 'AU-1', singleUse: true }, { type: 'strategic-strike', provinceId: 'AU-1', nuclear: true, collateral: true, damage: 20 }];
    } });
    await page.locator('[data-action="create"]').click(); await page.waitForSelector('[data-action="start"]');
    await page.locator('[data-action="start"]').click(); await page.waitForSelector('[data-action="pause"]');
    await page.locator('[data-action="tab"][data-id="intelligence"]').click();
    const reports = await page.locator('.report-row').allTextContents();
    assert.match(reports.join(' '), /found no remaining eligible hostile target/);
    assert.match(reports.join(' '), /was cancelled: Defensive interceptor/);
    assert.match(reports.join(' '), /single-use interceptor was expended/);
    assert.match(reports.join(' '), /Friendly or neutral forces were caught in this blast/);
    await page.locator('[data-action="select-unit"][data-id="unit-1"]').click();
    const intercept = page.locator('[data-action="order-type"][data-id="intercept"]');
    assert.equal(await intercept.isDisabled(), false, 'Persistent defence must be retargetable without abandoning the formation');
    assert.equal(await page.locator('[data-action="order-type"][data-id="move"]').isDisabled(), false, 'A stationary battery can leave its defensive stance by moving');
    assert.equal(await page.locator('[data-action="order-type"][data-id="attack"]').isDisabled(), false, 'A defensive stance can be replaced with a movement order into hostile territory');
    assert.equal(await page.locator('[data-action="order-type"][data-id="bombard"]').isDisabled(), true, 'Bombardment still requires an idle battery');
    assert.match(await page.locator('.command-guidance').textContent(), /Air defence active/);
    await page.locator('#formationDetails summary').click();
    assert.match(await page.locator('.formation-support').textContent(), /Missile defence ready Day 1 · 01:00/);
    await intercept.click();
    const canvas = page.locator('#worldCanvas'), bounds = await canvas.boundingBox(), scale = Math.min(bounds.width / 360, bounds.height / 165) * 4;
    await canvas.click({ position: { x: bounds.width / 2 + 10 * scale, y: bounds.height / 2 - 20 * scale } });
    const confirm = page.locator('[data-action="confirm-order"]');
    assert.equal(await confirm.isDisabled(), false, 'Friendly territory is a valid defensive target');
    await confirm.click(); await page.waitForFunction(() => !document.querySelector('[data-action="confirm-order"]'));
    assert.deepEqual(state.calls.find(call => call.action === 'order').args, { unitIds: ['unit-1'], type: 'intercept', targetProvinceId: 'AU-2' });
    assert.deepEqual(errors, []); await context.close();
  } finally { await browser.close(); }
});

test('maritime aircraft warn before an ineffective sortie against a detected land formation', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    for (const platformId of ['p8a-poseidon', 'ch148-cyclone']) {
      const { context, page, state, errors } = await harness(browser, { width: 1440, height: 900 }, { configureView(view) {
        const platform = PLATFORMS.find(platform => platform.id === platformId);
        if (!view.catalog.platforms.some(row => row.id === platformId)) view.catalog.platforms.push(platform);
        Object.assign(view.units[0], { name: platform.name, platformId, domain: 'air', order: {} });
        view.units.push({ id: 'hostile-land', name: 'Detected infantry', platformId: 'infantry-company', nationId: 'NZ', provinceId: 'NZ-1', domain: 'land', health: 100, maxHealth: 100, strength: 1 });
        view.nations.find(nation => nation.id === 'NZ').relation = 'war'; view.diplomacy = [{ nationId: 'NZ', relation: 'war' }];
      } });
      await page.locator('[data-action="create"]').click(); await page.waitForSelector('[data-action="start"]');
      await page.locator('[data-action="start"]').click(); await page.waitForSelector('[data-action="pause"]');
      await page.locator('[data-action="tab"][data-id="intelligence"]').click(); await page.locator('[data-action="select-unit"][data-id="unit-1"]').click();
      await page.locator('[data-action="order-type"][data-id="attack"]').click();
      const canvas = page.locator('#worldCanvas'), bounds = await canvas.boundingBox(), scale = Math.min(bounds.width / 360, bounds.height / 165) * 4;
      await canvas.click({ position: { x: bounds.width / 2 + 20 * scale, y: bounds.height / 2 + 10 * scale } });
      await page.waitForSelector('[data-action="confirm-order"]');
      assert.match(await page.locator('.order-feedback').textContent(), /has no land-strike capability/);
      assert.match(await page.locator('.order-feedback').textContent(), /against land formations will do no damage/);
      assert.equal(state.calls.filter(call => call.action === 'order').length, 0, 'The warning appears before any sortie is sent');
      assert.deepEqual(errors, []); await context.close();
    }
  } finally { await browser.close(); }
});

test('production Wellington formation stays visible above the expanded 320px command panel', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    const { context, page, errors } = await harness(browser, { width: 320, height: 740 }, { realGeography: true, configureView(view) {
      view.player.nationId = 'NZ';
      view.nations.find(nation => nation.id === 'NZ').relation = 'self';
      view.nations.find(nation => nation.id === 'AU').relation = 'peace';
      view.provinces = [{ id: 'NZL-5469', ownerId: 'NZ', morale: 100, facilities: { 'army-base': 1 } }];
      Object.assign(view.units[0], { name: 'Combat engineers', nationId: 'NZ', provinceId: 'NZL-5469', platformId: 'combat-engineers', supply: 1, entrenchment: 0, order: {} });
    } });
    await page.locator('#nationSearch').fill('New Zealand'); await page.locator('[data-action="nation"][data-id="NZ"]').click();
    await page.locator('[data-action="create"]').click(); await page.waitForSelector('[data-action="start"]');
    await page.locator('[data-action="start"]').click(); await page.waitForSelector('[data-action="pause"]');
    await page.locator('[data-action="tab"][data-id="intelligence"]').click(); await page.locator('[data-action="select-unit"][data-id="unit-1"]').click();
    await page.locator('#formationDetails summary').click();
    await page.waitForFunction(() => document.querySelector('#formationDetails').open);
    const canvas = page.locator('#worldCanvas');
    const markerVisible = async () => {
      const bounds = await canvas.boundingBox(), panel = await page.locator('#selectionPanel').boundingBox();
      const { data, info } = await sharp(await canvas.screenshot()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let pixels = 0;
      const maxY = Math.max(0, Math.floor((panel.y - bounds.y - 12) * info.height / bounds.height));
      for (let y = 0; y < maxY; y++) for (let x = 0; x < info.width; x++) { const offset = (y * info.width + x) * 4; if (Math.abs(data[offset] - 205) <= 1 && Math.abs(data[offset + 1] - 181) <= 1 && Math.abs(data[offset + 2] - 121) <= 1) pixels++; }
      return pixels > 250;
    };
    for (let attempt = 0; attempt < 10 && !await markerVisible(); attempt++) await page.evaluate(() => new Promise(requestAnimationFrame));
    await page.screenshot({ path: path.join(os.tmpdir(), 'dorra-war-wellington-320.png') });
    assert.equal(await markerVisible(), true, 'The selected Wellington marker must be drawn in the unobscured map above the panel');
    assert.match(await page.locator('.formation-details-body').textContent(), /Wellington/);
    assert.deepEqual(errors, []); await context.close();
  } finally { await browser.close(); }
});
