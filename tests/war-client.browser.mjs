import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { launchBrowser, baseURL, supabaseHost, responseHeaders, serveSource } from './browser-helpers.mjs';

const actor = 'e8100000-0000-4000-8000-000000000001';
const sessionId = 'e8100000-0000-4000-8000-000000000002';
const matchId = 'e8100000-0000-4000-8000-000000000003';
const auth = {
  access_token: 'local-only-client-token', refresh_token: 'local-only-client-refresh', token_type: 'bearer',
  expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: actor, aud: 'authenticated', role: 'authenticated', email: 'client-fixture@example.test', user_metadata: {}, app_metadata: { provider: 'email', providers: ['email'] }, created_at: new Date().toISOString() }
};
const harnessHTML = `<!doctype html><title>War client retry regression</title>
<button id="submit">Produce formation</button><button id="close">Close connection</button><button id="end">Replace session</button>
<output id="status">Ready</output><output id="result"></output>
<script type="module">
import { createWarClient } from './war/client.mjs';
window.statuses = [];
const client = createWarClient({ vault: { getLeaseId: () => 'e8100000-0000-4000-8000-000000000004' }, onStatus(status, error) { statuses.push({ status, code: error?.code }); document.querySelector('#status').textContent = status; } });
const button = document.querySelector('#submit');
button.onclick = async () => {
  button.disabled = true; document.querySelector('#result').textContent = '';
  try { const response = await client.command('produce', { platformId: 'infantry-company', provinceId: 'fixture-port' }, '${matchId}'); document.querySelector('#result').textContent = JSON.stringify({ ok: true, result: response.result }); }
  catch(error) { document.querySelector('#result').textContent = JSON.stringify({ ok: false, code: error.code, message: error.message }); }
  finally { button.disabled = client.blocked; }
};
document.querySelector('#close').onclick = () => client.close();
document.querySelector('#end').onclick = () => window.dispatchEvent(new CustomEvent('dorra-session-ended', { detail: { error: Object.assign(new Error('Replaced fixture session'), { code: 'SESSION_REPLACED' }) } }));
window.clientReady = true;
</script>`;

async function harness(browser, decide) {
  const context = await browser.newContext({ viewport: { width: 390, height: 744 } });
  await context.addInitScript(value => localStorage.setItem('dorra-online-auth', JSON.stringify(value)), auth);
  const calls = [], receipts = new Map(), errors = [];
  let commits = 0;
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.hostname !== supabaseHost) return serveSource(route, harnessHTML);
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: responseHeaders, body: '' });
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ status: 200, headers: responseHeaders, body: JSON.stringify(url.pathname.endsWith('/user') ? auth.user : auth) });
    assert.equal(url.pathname, '/functions/v1/dorra-war', 'Local fixtures cannot send their Auth token to unrelated endpoints');
    const body = request.postDataJSON(); calls.push({ body, at: performance.now() });
    const action = decide(calls.length, body);
    if (action === 'catchup') return route.fulfill({ status: 409, headers: responseHeaders, body: JSON.stringify({ error: 'The match is catching up. Retry this command shortly.', code: 'MATCH_CATCHING_UP' }) });
    if (action === 'network') return route.abort('failed');
    if (action === 'ended') return route.fulfill({ status: 401, headers: responseHeaders, body: JSON.stringify({ error: 'Session replaced', code: 'SESSION_REPLACED' }) });
    if (!receipts.has(body.requestId)) {
      commits++;
      receipts.set(body.requestId, { result: { type: 'produce', committed: commits }, serverNow: Date.now() });
    }
    if (action === 'lost-commit') return route.abort('failed');
    return route.fulfill({ status: 200, headers: responseHeaders, body: JSON.stringify(receipts.get(body.requestId)) });
  });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseURL + '__vault-harness.html'); await page.waitForFunction(() => window.clientReady);
  const result = async () => { await page.waitForFunction(() => document.querySelector('#result').textContent !== ''); return JSON.parse(await page.locator('#result').textContent()); };
  return { context, page, calls, errors, result, commits: () => commits };
}

test('the browser war client bounds catch-up retries and preserves one idempotent intention', { timeout: 90000 }, async t => {
  const browser = await launchBrowser();
  try {
    await t.test('two transient rejections recover after two-second and four-second backoffs with one commit', async () => {
      const h = await harness(browser, attempt => attempt <= 2 ? 'catchup' : 'success');
      try {
        await h.page.locator('#submit').click();
        assert.equal((await h.result()).ok, true);
        assert.equal(h.calls.length, 3); assert.equal(h.commits(), 1);
        assert.deepEqual(h.calls[1].body, h.calls[0].body); assert.deepEqual(h.calls[2].body, h.calls[0].body);
        assert.ok(h.calls[1].at - h.calls[0].at >= 1800);
        assert.ok(h.calls[2].at - h.calls[1].at >= 3600);
        assert.deepEqual(await h.page.evaluate(() => statuses.map(row => row.status)), ['catching-up', 'catching-up', 'connected']);
        assert.equal(await h.page.locator('#submit').isEnabled(), true);
        assert.deepEqual(h.errors, []);
      } finally { await h.context.close(); }
    });

    await t.test('an ambiguous committed response still replays the same receipt after catch-up', async () => {
      const h = await harness(browser, attempt => attempt === 1 ? 'catchup' : attempt === 2 ? 'lost-commit' : 'success');
      try {
        await h.page.locator('#submit').click(); assert.equal((await h.result()).ok, true);
        assert.equal(h.calls.length, 3); assert.equal(h.commits(), 1);
        assert.ok(h.calls.every(call => JSON.stringify(call.body) === JSON.stringify(h.calls[0].body)), 'A network retry cannot mint another paid intention');
        assert.deepEqual(h.errors, []);
      } finally { await h.context.close(); }
    });

    await t.test('exhaustion stops at three attempts and a later deliberate command can recover', async () => {
      const h = await harness(browser, attempt => attempt <= 3 ? 'catchup' : 'success');
      try {
        await h.page.locator('#submit').click();
        assert.equal((await h.result()).code, 'MATCH_CATCHING_UP');
        assert.equal(h.calls.length, 3); assert.equal(h.commits(), 0);
        assert.equal(await h.page.locator('#submit').isEnabled(), true);
        assert.equal(await h.page.locator('#status').textContent(), 'catching-up');
        await h.page.locator('#submit').click(); assert.equal((await h.result()).ok, true);
        assert.equal(h.calls.length, 4); assert.equal(h.commits(), 1);
        assert.notEqual(h.calls[3].body.requestId, h.calls[0].body.requestId, 'Only the new deliberate action receives a fresh receipt');
        assert.deepEqual(h.errors, []);
      } finally { await h.context.close(); }
    });

    for (const control of ['close', 'end']) await t.test(`${control} cancels a pending retry before another mutation is sent`, async () => {
      const h = await harness(browser, () => 'catchup');
      try {
        await h.page.locator('#submit').click(); await h.page.waitForFunction(() => statuses.some(row => row.status === 'catching-up'));
        const stopped = performance.now(); await h.page.locator('#' + control).click();
        const result = await h.result(); assert.equal(result.ok, false);
        assert.ok(performance.now() - stopped < 900, 'Cancellation need not wait for the backoff timer');
        await h.page.waitForTimeout(2200);
        assert.equal(h.calls.length, 1); assert.equal(h.commits(), 0);
        if (control === 'end') assert.equal(await h.page.locator('#submit').isDisabled(), true);
        else { await h.page.locator('#submit').click(); assert.match((await h.result()).message, /closed/); assert.equal(h.calls.length, 1); }
        assert.deepEqual(h.errors, []);
      } finally { await h.context.close(); }
    });

    await t.test('ordinary network failure retains its existing single retry limit', async () => {
      const h = await harness(browser, () => 'network');
      try {
        await h.page.locator('#submit').click(); assert.match((await h.result()).message, /uplink interrupted/);
        assert.equal(h.calls.length, 2); assert.deepEqual(h.calls[1].body, h.calls[0].body);
        assert.equal(h.commits(), 0); assert.equal(await h.page.locator('#submit').isEnabled(), true);
        assert.deepEqual(h.errors, []);
      } finally { await h.context.close(); }
    });
  } finally { await browser.close(); }
});
