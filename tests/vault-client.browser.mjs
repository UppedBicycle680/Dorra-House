import test from 'node:test';
import assert from 'node:assert/strict';
import {SUPABASE_PUBLISHABLE_KEY} from '../online-config.js';
import {validateBody, commandDigest} from '../supabase/functions/dorra-api/protocol.mjs';
import {reduceCampaign} from '../supabase/functions/dorra-api/campaign.mjs';
import {encodeResult, decodeResult} from '../supabase/functions/dorra-api/response-codec.mjs';
import {baseURL, supabaseHost, responseHeaders, launchBrowser, serveSource} from './browser-helpers.mjs';

// Real browser, Supabase Auth SDK, vault client, protocol and game reducer.
// Only transport and the database transaction are simulated: no credentials or
// external service are needed, and no network requests leave the route handler.
test('real cloud client queues intents, replays lost responses and revokes the older device', {timeout: 120000}, async () => {
  const browser = await launchBrowser();
  const userId = crypto.randomUUID();
  const user = {id: userId, aud: 'authenticated', role: 'authenticated', email: 'vault@example.test', user_metadata: {username: 'VaultTest'}, app_metadata: {provider: 'email', providers: ['email']}, created_at: new Date().toISOString()};
  const received = [], authRequests = [], responses = [];
  let saved = {snapshot: {balance: 1000, progress: {level: 1, xp: 0, profile: {name: 'VaultTest'}}, history: []}, privateState: {integrationSecret: 'never-return-this'}, revision: 1, leaseId: null, sessionId: null, recentRequests: []};
  let dropNextResponse = false;
  const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const harness = '<!doctype html><html><body><script type="module">import "./online-shell.js"; import {createVaultClient} from "./vault-client.js"; window.vault=await createVaultClient(); window.ready=true;</script></body></html>';

  async function makeDevice() {
    const sessionId = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const token = `${encoded({alg: 'HS256', typ: 'JWT'})}.${encoded({sub: userId, session_id: sessionId, role: 'authenticated', aud: 'authenticated', exp: expiresAt})}.${encoded('test-signature')}`;
    const auth = {access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, refresh_token: 'mock-refresh-token', user};
    const context = await browser.newContext();
    await context.addInitScript(session => localStorage.setItem('dorra-online-auth', JSON.stringify(session)), auth);
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.hostname !== supabaseHost) return serveSource(route, harness);
      const reply = async (body, status = 200) => {
        responses.push(body);
        assert.ok(!('privateState' in body));
        assert.ok(!JSON.stringify(body).includes('never-return-this'));
        await route.fulfill({status, headers: responseHeaders, body: JSON.stringify(body)});
      };
      if (request.method() === 'OPTIONS') {
        await route.fulfill({status: 204, headers: responseHeaders, body: ''});
        return;
      }
      if (url.pathname.startsWith('/auth/v1/')) {
        authRequests.push(url.pathname);
        if (url.pathname === '/auth/v1/user') return reply(user);
        if (url.pathname === '/auth/v1/token') return reply(auth);
        if (url.pathname === '/auth/v1/logout') return route.fulfill({status: 204, headers: responseHeaders, body: ''});
        throw new Error('Unexpected Auth transport ' + url.pathname);
      }
      if(url.pathname==='/functions/v1/dorra-admin'){const input=request.postDataJSON();assert.equal(input.operation,'pulse');assert.equal(input.args.leaseId,saved.leaseId);return reply({messages:[],serverNow:new Date().toISOString()});}
      assert.equal(url.pathname, '/functions/v1/dorra-api');
      assert.equal(request.method(), 'POST');
      assert.equal(request.headers().authorization, 'Bearer ' + token);
      assert.equal(request.headers().apikey, SUPABASE_PUBLISHABLE_KEY);
      const body = validateBody(request.postDataJSON());
      received.push({body, headers: request.headers()});
      if (body.scope === 'session' && body.action === 'acquire') {
        saved.leaseId = body.leaseId;
        saved.sessionId = sessionId;
        saved.revision++;
        return reply({snapshot: saved.snapshot, revision: saved.revision, username: 'VaultTest', serverNow: Date.now()});
      }
      if (saved.leaseId !== body.leaseId || saved.sessionId !== sessionId) {
        return reply({error: 'Another device started a gameplay session.', code: 'SESSION_REPLACED'}, 409);
      }
      const digest = await commandDigest(body);
      const cached = saved.recentRequests.find(item => item.id === body.requestId);
      if (cached) {
        assert.equal(cached.digest, digest);
        return reply({snapshot: saved.snapshot, revision: saved.revision, result: await decodeResult(cached.result), replayed: true});
      }
      assert.equal(body.expectedRevision, saved.revision, 'Queued commands must use the latest committed revision');
      const output = await reduceCampaign(structuredClone(saved.snapshot), structuredClone(saved.privateState), body.action, body.args, Date.now());
      const result = await encodeResult(output.result);
      saved = {...saved, snapshot: output.snapshot, privateState: output.privateState, revision: saved.revision + 1, recentRequests: [...saved.recentRequests, {id: body.requestId, digest, result}].slice(-8)};
      if (dropNextResponse) {
        dropNextResponse = false;
        await route.abort('failed');
        return;
      }
      return reply({snapshot: saved.snapshot, revision: saved.revision, result: await decodeResult(result)});
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL + '__vault-harness.html');
    await page.waitForFunction(() => window.ready === true);
    assert.deepEqual(errors, []);
    return {context, page, errors};
  }

  try {
    const first = await makeDevice();
    assert.equal(await first.page.locator('[data-online-username]').textContent(), 'VaultTest');
    assert.deepEqual(Object.keys(received.at(-1).body).sort(), ['action', 'leaseId', 'scope']);
    dropNextResponse = true;
    const created = await first.page.evaluate(() => window.vault.dispatch('campaign', 'create', {homeCountryId: 'AU', scenarioId: 'open-world'}));
    assert.equal(created.snapshot.progress.campaign.homeCountryId, 'AU');
    const creates = received.filter(item => item.body.action === 'create');
    assert.equal(creates.length, 2);
    assert.equal(creates[0].body.requestId, creates[1].body.requestId);
    assert.equal(created.replayed, true);
    assert.equal(created.result.event.type, 'campaign-created');
    assert.equal(saved.snapshot.progress.campaign.turn, 1);
    await first.page.evaluate(async () => {
      const local = window.vault.snapshot;
      local.balance = 9e15;
      local.progress.campaign.turn = 999;
      if (window.vault.snapshot.balance === 9e15) throw new Error('Snapshot reference leaked');
      try {
        await window.vault.commit(local);
        throw new Error('Snapshot upload was accepted');
      } catch (error) {
        if (!error.message.includes('Browser save uploads are disabled')) throw error;
      }
      await Promise.all([window.vault.dispatch('campaign', 'set-posture', {id: 'balanced'}), window.vault.dispatch('campaign', 'research', {id: 'force'})]);
    });
    assert.equal(saved.snapshot.balance, 1000);
    assert.equal(saved.snapshot.progress.campaign.turn, 1);
    const writes = received.filter(item => item.body.scope !== 'session' && item.body.action !== 'create');
    assert.equal(writes[1].body.expectedRevision, writes[0].body.expectedRevision + 1);
    for (const {body} of received) {
      assert.ok(!('snapshot' in body) && !('privateState' in body) && !('balance' in body));
      if (body.args) assert.ok(!('snapshot' in body.args));
    }
    const storageKeys = await first.page.evaluate(() => Object.keys(localStorage));
    assert.deepEqual(storageKeys, ['dorra-online-auth']);
    const second = await makeDevice();
    assert.equal(await second.page.evaluate(() => window.vault.snapshot.progress.campaign.research.force), 2);
    const oldSession = await first.page.evaluate(async () => {
      try { await window.vault.dispatch('campaign', 'end-turn'); return {ok: true}; }
      catch (error) { return {ok: false, code: error.code}; }
    });
    assert.equal(oldSession.code, 'SESSION_REPLACED');
    assert.equal(await first.page.evaluate(() => document.documentElement.dataset.sessionState), 'ended');
    assert.equal(await first.page.locator('dialog.online-session-notice').isVisible(), true);
    const requestsBefore = received.length;
    await first.page.evaluate(async () => { try { await window.vault.dispatch('campaign', 'end-turn'); } catch {} });
    assert.equal(received.length, requestsBefore, 'A replaced session cannot send further gameplay requests');
    await second.page.evaluate(() => window.vault.dispatch('campaign', 'end-turn'));
    assert.equal(saved.snapshot.progress.campaign.turn, 2);
    assert.deepEqual(first.errors, []);
    assert.deepEqual(second.errors, []);
    assert.ok(responses.length >= 7);
    assert.deepEqual(authRequests, []);
  } finally {
    await browser.close();
  }
});
