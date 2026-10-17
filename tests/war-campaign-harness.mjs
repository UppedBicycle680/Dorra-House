import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { warDatabase } from './war-database-helpers.mjs';
import { createWarHandler } from '../supabase/functions/dorra-war/handler.mjs';
import { baseURL, supabaseHost, responseHeaders, serveSource } from './browser-helpers.mjs';

// Only Auth and the House session envelope are substitutes. Every war command,
// projection, cost, queue, AI turn, combat result and reward uses production SQL.
export async function campaignDatabase() {
  const db = await warDatabase();
  const directory = new URL('../scripts/war-seed/', import.meta.url);
  for (const file of (await readdir(directory)).filter(file => file.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, directory), 'utf8'));
  return db;
}

export async function campaignHarness(browser, db, viewport) {
  const userId = randomUUID(), sessionId = randomUUID();
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'campaign-browser@example.test', user_metadata: { username: 'LocalCommander' }, app_metadata: { provider: 'email', providers: ['email'] }, created_at: new Date().toISOString() };
  const token = Buffer.from(JSON.stringify({ alg: 'fixture' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: userId, session_id: sessionId })).toString('base64url') + '.local-only';
  const auth = { access_token: token, refresh_token: 'local-only-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user };
  await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [userId, JSON.stringify(user.user_metadata)]);
  await db.query('insert into auth.sessions(id,user_id) values($1,$2)', [sessionId, userId]);
  await db.query('insert into dorra_private.profiles(user_id) values($1)', [userId]);
  await db.query('insert into dorra_private.player_state(user_id,auth_session_id,lease_id,snapshot) values($1,$2,$3,$4)', [userId, sessionId, randomUUID(), JSON.stringify({ balance: 1000, progress: { profile: { name: 'LocalCommander' } }, history: [] })]);
  const state = { userId, sessionId, view: null, calls: [], errors: [], projections: 0, clockAdvances: [] };
  const handler = createWarHandler({
    getUser: async candidate => candidate === token ? user : null,
    async rpc(name, args) {
      assert.equal(name, 'dorra_war_command');
      try {
        const { rows } = await db.query('select public.dorra_war_command($1::uuid,$2::uuid,$3::uuid,$4::text,$5::uuid,$6::jsonb,$7::uuid) result', [args.p_user_id, args.p_auth_session_id, args.p_lease_id, args.p_action, args.p_match_id, JSON.stringify(args.p_args), args.p_request_id]);
        const data = rows[0].result;
        // Freeze wall-clock progress between explicit local advances. Otherwise
        // slow automation at360x invents a cron backlog absent on the server.
        if (args.p_action === 'start' && data.view?.match.id) await db.query("update dorra_private.war_matches set game_anchor=0,real_anchor=clock_timestamp()+interval '1 day' where id=$1", [data.view.match.id]);
        if (data.view) state.view = structuredClone(data.view);
        return { data };
      } catch (error) { state.errors.push({ action: args.p_action, code: error.message }); return { error: { code: error.code, message: error.message } }; }
    },
    async project(user, match, base, view) {
      state.projections++;
      return (await db.query('select public.dorra_war_projection($1::uuid,$2::uuid,$3::bigint,$4::jsonb) result', [user, match, base, JSON.stringify(view)])).rows[0].result;
    }
  });
  const context = await browser.newContext({ viewport, hasTouch: viewport.width <= 700 });
  await context.addInitScript(value => localStorage.setItem('dorra-online-auth', JSON.stringify(value)), auth);
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const reply = value => route.fulfill({ status: 200, headers: responseHeaders, body: JSON.stringify(value) });
    if (url.hostname === supabaseHost) {
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: responseHeaders, body: '' });
      if (url.pathname.startsWith('/auth/v1/')) return reply(url.pathname.endsWith('/user') ? user : auth);
      const body = request.postDataJSON();
      if (url.pathname.endsWith('/dorra-admin')) return reply({ messages: [], serverNow: Date.now() });
      if (url.pathname.endsWith('/dorra-api')) {
        assert.equal(body.scope, 'session', 'The campaign never buys or modifies House state through a mocked endpoint');
        if (body.action === 'acquire') await db.query('update dorra_private.player_state set lease_id=$2,auth_session_id=$3 where user_id=$1', [userId, body.leaseId, sessionId]);
        const { rows: [save] } = await db.query('select snapshot,revision from dorra_private.player_state where user_id=$1', [userId]);
        return reply({ snapshot: save.snapshot, revision: Number(save.revision), userId, serverNow: Date.now() });
      }
      assert.equal(url.pathname, '/functions/v1/dorra-war', 'No local fixture can send credentials to another Supabase endpoint');
      state.calls.push(body);
      const response = await handler(new Request(request.url(), { method: request.method(), headers: request.headers(), body: request.postData() }));
      return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
    }
    return serveSource(route);
  });
  const page = await context.newPage(), pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(baseURL + 'war-simulation.html'); await page.waitForSelector('#lobbyPanel:not([hidden])');
  const press = async selector => { if (viewport.width <= 700) await page.locator(selector).tap(); else await page.locator(selector).click(); await page.waitForFunction(() => document.querySelector('#warApp').getAttribute('aria-busy') === 'false'); };
  const refresh = async () => {
    const response = page.waitForResponse(response => response.url().endsWith('/dorra-war') && response.request().postDataJSON()?.action === 'view');
    await page.evaluate(() => dispatchEvent(new Event('online'))); await response;
    await page.evaluate(() => new Promise(requestAnimationFrame));
  };
  async function advance(gameSeconds) {
    const matchId = state.view?.match.id; assert.ok(matchId);
    const { rows: [match] } = await db.query('select status,dorra_private.war_now(m) game_time from dorra_private.war_matches m where id=$1', [matchId]);
    if (match.status !== 'running') return;
    const target = Number(match.game_time) + gameSeconds;
    // Explicit local test clock only. Never changes forces, wallets, diplomacy,
    // events, damage or winners; ordinary events resolve at their original due.
    await db.query("update dorra_private.war_matches set game_anchor=$2,real_anchor=clock_timestamp()+interval '1 day',last_dispatch=clock_timestamp() where id=$1", [matchId, target]);
    let remaining = 0, status = 'running';
    for (let pass = 0; pass < 100; pass++) {
      await db.query('select dorra_private.war_advance($1,400)', [matchId]);
      const { rows: [current] } = await db.query('select status,(select count(*) from dorra_private.war_events where match_id=m.id and due<=dorra_private.war_now(m)) pending from dorra_private.war_matches m where id=$1', [matchId]);
      remaining = Number(current.pending);
      status = current.status;
      if (current.status !== 'running' || !remaining) break;
    }
    assert.ok(status !== 'running' || remaining === 0, 'The bounded local scheduler must catch up without discarding events');
    state.clockAdvances.push({ seconds: gameSeconds, target }); await refresh();
  }
  return { context, page, state, pageErrors, press, refresh, advance, db };
}
