import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { warDatabase } from './war-database-helpers.mjs';
import { createAdminHandler } from '../supabase/functions/dorra-admin/handler.mjs';
import { baseURL, supabaseHost, responseHeaders, launchBrowser, serveSource } from './browser-helpers.mjs';

// Auth/staff directory reads are test services. Gold grants execute the actual
// gateway and PostgreSQL wallet, permanent ledger, audit and idempotency code.
async function setup(browser, { role = 'admin', width = 1440, dropResponse = false } = {}) {
  const db = await warDatabase(), actorId = randomUUID(), targetId = randomUUID(), sessionId = randomUUID();
  await db.exec(`create table dorra_private.test_gold_staff(user_id uuid primary key,role text,unlocked boolean);
    create table dorra_private.admin_audit(id uuid default gen_random_uuid(),actor uuid,target uuid,session_id uuid,action text,reason text,changes jsonb,request_id uuid,preview_digest text,result jsonb);
    create function dorra_private.staff_context(actor uuid,session uuid,require_grant boolean) returns jsonb language plpgsql as $$
    declare staff dorra_private.test_gold_staff;begin
      if not exists(select 1 from auth.sessions where id=session and user_id=actor) then raise exception 'AUTH_SESSION_ENDED';end if;
      select * into staff from dorra_private.test_gold_staff where user_id=actor;
      if not found then raise exception 'STAFF_REQUIRED';end if;
      if require_grant and not staff.unlocked then raise exception 'ACCESS_EXPIRED';end if;
      return jsonb_build_object('role',staff.role,'owner',false);end $$;`);
  await db.query('insert into auth.users(id) values($1),($2)', [actorId, targetId]);
  await db.query('insert into auth.sessions(id,user_id) values($1,$2)', [sessionId, actorId]);
  await db.query('insert into dorra_private.profiles(user_id) values($1),($2)', [actorId, targetId]);
  await db.query('insert into dorra_private.test_gold_staff values($1,$2,true)', [actorId, role]);
  const user = { id: actorId, email: 'local-staff@example.test', aud: 'authenticated', role: 'authenticated', user_metadata: { username: 'LocalStaff', role: 'admin' } };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'fixture' })}.${encode({ sub: actorId, session_id: sessionId, exp: Math.floor(Date.now() / 1000) + 3600 })}.local-only`;
  const auth = { access_token: token, refresh_token: 'local-only-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user };
  const state = { calls: [], results: [], dropResponse };
  const balance = async () => Number((await db.query('select coalesce((select balance from dorra_private.war_gold_accounts where user_id=$1),0) balance', [targetId])).rows[0].balance);
  const grant = async (amount, requestId = randomUUID(), reason = 'Local tournament award') => (await db.query('select public.dorra_admin_gold_grant($1,$2,$3,$4,$5,$6) result', [actorId, sessionId, targetId, amount, reason, requestId])).rows[0].result;
  const handler = createAdminHandler({
    getUser: async candidate => candidate === token ? user : null,
    ipHash: async () => 'local-test',
    rpc: async (name, args) => {
      try {
        if (name === 'dorra_admin_status') {
          const staff = (await db.query('select role,unlocked from dorra_private.test_gold_staff where user_id=$1', [actorId])).rows[0];
          return { data: { userId: actorId, username: 'LocalStaff', ...staff, owner: false, expiresAt: new Date(Date.now() + 1800000).toISOString() } };
        }
        if (name === 'dorra_admin_read' && args.p_operation === 'player') return { data: { player: { userId: targetId, username: 'TournamentPlayer', role: 'player', owner: false, status: 'active', hasSave: false, goldBalance: await balance(), level: 1, xp: 0, rounds: 0, wins: 0, resources: { money: 0 }, createdAt: new Date().toISOString(), lastPlayedAt: null }, history: [], flags: [] } };
        if (name === 'dorra_admin_gold_grant') { assert.equal(args.p_actor, actorId); assert.equal(args.p_session, sessionId); assert.equal(args.p_target, targetId); return { data: await grant(args.p_amount, args.p_request, args.p_reason) }; }
        throw new Error('Unexpected RPC ' + name);
      } catch (error) { return { error: { message: error.message, code: error.code } }; }
    },
  });
  const context = await browser.newContext({ viewport: { width, height: width <= 700 ? 740 : 1000 }, hasTouch: width <= 700 });
  await context.addInitScript(value => localStorage.setItem('dorra-online-auth', JSON.stringify(value)), auth);
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname !== supabaseHost) return serveSource(route);
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: responseHeaders, body: '' });
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ headers: responseHeaders, body: JSON.stringify(url.pathname.endsWith('/user') ? user : auth) });
    assert.equal(url.pathname, '/functions/v1/dorra-admin');
    const input = request.postDataJSON(); state.calls.push(input);
    const response = await handler(new Request(request.url(), { method: 'POST', headers: request.headers(), body: request.postData() }));
    const raw = await response.text(); state.results.push({ input, status: response.status, body: JSON.parse(raw) });
    if (input.operation === 'gold-grant' && state.dropResponse) { state.dropResponse = false; return route.abort('failed'); }
    return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: raw });
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${baseURL}admin.html#player/${targetId}/resources`);
  await page.getByRole('heading', { name: role === 'admin' ? 'TournamentPlayer' : 'Permission denied', exact: true }).waitFor();
  return { db, context, page, state, errors, balance, grant, actorId, targetId, close: async () => { await context.close(); await db.close(); } };
}

async function prepareGrant(h, amount = '25') {
  await h.page.getByRole('button', { name: 'Grant Gold', exact: true }).click();
  await h.page.getByRole('spinbutton', { name: 'Gold amount', exact: true }).fill(amount);
  await h.page.getByRole('textbox', { name: 'Reason', exact: true }).fill('Tournament winner award');
  await h.page.getByRole('button', { name: 'Preview Gold grant', exact: true }).click();
  await h.page.getByRole('heading', { name: 'Confirm Gold grant', exact: true }).waitFor();
}

test('admin Gold review, bounded validation and explicit grant work without a House save on desktop and320px touch', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    for (const width of [1440, 320]) {
      const h = await setup(browser, { width });
      try {
        assert.equal(await h.page.locator('[data-gold-balance]').textContent(), '0');
        assert.equal(await h.page.getByRole('button', { name: 'Grant Gold', exact: true }).isEnabled(), true);
        assert.equal(await h.page.getByRole('button', { name: 'Adjust play money', exact: true }).count(), 0);
        await h.page.getByRole('button', { name: 'Grant Gold', exact: true }).click();
        for (const amount of ['0', '0.5', '100001']) {
          await h.page.getByRole('spinbutton', { name: 'Gold amount', exact: true }).fill(amount);
          await h.page.getByRole('textbox', { name: 'Reason', exact: true }).fill('Valid reason');
          await h.page.getByRole('button', { name: 'Preview Gold grant', exact: true }).click();
          assert.equal(await h.page.locator('#goldGrantForm').count(), 1);
        }
        await h.page.getByRole('spinbutton', { name: 'Gold amount', exact: true }).fill('25');
        await h.page.getByRole('textbox', { name: 'Reason', exact: true }).fill('   ');
        await h.page.getByRole('button', { name: 'Preview Gold grant', exact: true }).click();
        assert.match(await h.page.locator('#dialogError').textContent(), /Enter a reason/);
        await h.page.getByRole('button', { name: 'Cancel', exact: true }).click();
        await prepareGrant(h);
        assert.equal(h.state.calls.some(call => call.operation === 'gold-grant'), false, 'The preview cannot issue a grant');
        assert.equal(await h.balance(), 0);
        await h.page.getByRole('button', { name: 'Confirm Gold grant', exact: true }).click();
        await h.page.getByRole('heading', { name: 'Gold grant recorded', exact: true }).waitFor();
        const request = h.state.calls.find(call => call.operation === 'gold-grant');
        assert.deepEqual(request.args, { targetId: h.targetId, amount: 25, reason: 'Tournament winner award' });
        assert.match(request.requestId, /^[0-9a-f-]{36}$/);
        assert.equal(request.previewId, undefined);
        assert.equal(await h.balance(), 25);
        const ledger = (await h.db.query('select id,delta,balance_after,reason from dorra_private.war_gold_ledger where user_id=$1', [h.targetId])).rows;
        assert.equal(ledger.length, 1); assert.equal(Number(ledger[0].delta), 25);
        assert.equal(await h.page.locator('[data-gold-receipt]').textContent(), ledger[0].id);
        assert.equal((await h.db.query('select count(*)::int n from dorra_private.admin_audit')).rows[0].n, 1);
        assert.equal((await h.db.query('select count(*)::int n from dorra_private.player_state where user_id=$1', [h.targetId])).rows[0].n, 0, 'A Gold award must not manufacture a House save');
        await h.page.waitForFunction(() => document.querySelector('[data-gold-balance]')?.textContent === '25');
        assert.equal(await h.page.locator('#actionDialog').evaluate(element => element.scrollTop), 0, 'The receipt opens at its heading even after a long mobile form');
        assert.equal(await h.page.locator('body').evaluate(element => element.scrollWidth <= innerWidth), true);
        await h.page.screenshot({ path: path.join(os.tmpdir(), `dorra-admin-gold-${width}.png`) });
        assert.deepEqual(h.errors, []);
      } finally { await h.close(); }
    }
  } finally { await browser.close(); }
});

test('a lost committed Gold response reopens the same intent and returns its original receipt without duplicating the award', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    const h = await setup(browser, { dropResponse: true });
    try {
      await prepareGrant(h); await h.page.getByRole('button', { name: 'Confirm Gold grant', exact: true }).click();
      await h.page.getByRole('button', { name: 'Retry same Gold grant', exact: true }).waitFor();
      assert.equal(h.state.calls.filter(call => call.operation === 'gold-grant').length, 1, 'A network failure cannot automatically issue another grant');
      assert.equal(await h.balance(), 25);
      const firstReceipt = h.state.results.find(result => result.input.operation === 'gold-grant').body.recordId;
      await h.page.getByRole('button', { name: 'Cancel', exact: true }).click();
      // Another legitimate staff award occurs before retrying the first receipt.
      await h.grant(7, randomUUID(), 'Another tournament award');
      await h.page.getByRole('button', { name: 'Grant Gold', exact: true }).click();
      await h.page.getByRole('button', { name: 'Retry same Gold grant', exact: true }).click();
      await h.page.getByRole('heading', { name: 'Gold grant recorded', exact: true }).waitFor();
      const requests = h.state.calls.filter(call => call.operation === 'gold-grant');
      assert.equal(requests.length, 2); assert.deepEqual(requests[0], requests[1]);
      assert.equal(await h.page.locator('[data-gold-receipt]').textContent(), firstReceipt);
      assert.match(await h.page.locator('#dialogContent').textContent(), /No second grant was created/);
      assert.equal(await h.balance(), 32);
      await h.page.waitForFunction(() => document.querySelector('[data-gold-balance]')?.textContent === '32');
      assert.equal((await h.db.query("select count(*)::int n from dorra_private.war_gold_ledger where user_id=$1 and delta=25", [h.targetId])).rows[0].n, 1);
      assert.deepEqual(h.errors, []);
    } finally { await h.close(); }
  } finally { await browser.close(); }
});

test('moderator visibility and a demotion between review and confirmation cannot grant Gold', { timeout: 120000 }, async () => {
  const browser = await launchBrowser();
  try {
    const moderator = await setup(browser, { role: 'moderator' });
    try {
      assert.equal(await moderator.page.getByRole('button', { name: 'Grant Gold', exact: true }).count(), 0);
      assert.equal(moderator.state.calls.some(call => call.operation === 'gold-grant'), false);
      assert.equal(await moderator.balance(), 0);
    } finally { await moderator.close(); }
    const h = await setup(browser);
    try {
      await prepareGrant(h);
      await h.db.query("update dorra_private.test_gold_staff set role='moderator' where user_id=$1", [h.actorId]);
      await h.page.getByRole('button', { name: 'Confirm Gold grant', exact: true }).click();
      await h.page.getByRole('heading', { name: 'Permission denied', exact: true }).waitFor();
      assert.equal(await h.balance(), 0);
      assert.equal((await h.db.query('select count(*)::int n from dorra_private.war_gold_ledger')).rows[0].n, 0);
      assert.equal(await h.page.locator('#actionDialog[open]').count(), 0);
      assert.equal(await h.page.locator('#dialogContent').textContent(), '');
      assert.deepEqual(h.errors, []);
    } finally { await h.close(); }
  } finally { await browser.close(); }
});
