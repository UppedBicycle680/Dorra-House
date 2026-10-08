import assert from 'node:assert/strict';
import {randomBytes, randomUUID} from 'node:crypto';
import {mkdir, writeFile, appendFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, API_URL} from '../online-config.js';

const ORIGIN = 'https://uppedbicycle680.github.io';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// This uses only the website's public configuration. Secrets remain in memory;
// the report contains check names and the disposable account's cleanup identity.
export async function checkOnline(fetchImpl = fetch) {
  const report = {ok: false, startedAt: new Date().toISOString(), account: null, checks: [], cleanup: []};
  const sessions = new Set();
  let stage = 'Auth configuration', password, email, current;
  async function http(label, url, {method = 'GET', body, token} = {}) {
    let response;
    try {
      response = await fetchImpl(url, {
        method, headers: {apikey: SUPABASE_PUBLISHABLE_KEY, Origin: ORIGIN,
          ...(body ? {'Content-Type': 'application/json'} : {}),
          ...(token ? {Authorization: `Bearer ${token}`} : {})},
        ...(body ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(30000)
      });
    } catch { throw new Error(`${label}: could not reach the live service.`); }
    let value = {};
    if (response.status !== 204) {
      try { value = await response.json(); }
      catch { throw new Error(`${label}: the live service returned an unreadable response (HTTP ${response.status}).`); }
    }
    return {status: response.status, ok: response.ok, value};
  }
  function requireSuccess(response, label) {
    if (!response.ok) {
      const code = typeof response.value?.code === 'string' && /^[A-Z0-9_-]{1,64}$/i.test(response.value.code)
        ? `, ${response.value.code}` : '';
      throw new Error(`${label} failed (HTTP ${response.status}${code}).`);
    }
    return response.value;
  }
  function session(value, label) {
    assert(value && typeof value.access_token === 'string' && typeof value.refresh_token === 'string', `${label}: no authenticated session returned.`);
    sessions.add(value.access_token);
    return {token: value.access_token, refresh: value.refresh_token};
  }
  function saved(value, label) {
    assert(value?.snapshot && Number.isSafeInteger(value.revision) && value.revision >= 1, `${label}: no durable cloud save returned.`);
    assert(!Object.hasOwn(value, 'privateState'), `${label}: the API exposed private gameplay state.`);
    return value;
  }
  const passed = label => report.checks.push(label);
  async function api(body, token = current.token) {
    return http('Gameplay API', API_URL, {method: 'POST', body, token});
  }
  function command(scope, action, args = {}, device = current) {
    return {scope, action, args, leaseId: device.lease, requestId: randomUUID(), expectedRevision: device.revision};
  }
  async function run(scope, action, args = {}) {
    const body = command(scope, action, args);
    const value = saved(requireSuccess(await api(body), `${scope}/${action}`), `${scope}/${action}`);
    assert.equal(value.revision, current.revision + 1, `${scope}/${action}: save revision did not advance once.`);
    current.revision = value.revision; current.snapshot = value.snapshot;
    return {body, value};
  }
  async function reject(body, label, device = current, codes = null) {
    const response = await api(body, device.token);
    assert([400, 401, 403, 409].includes(response.status), `${label}: the unauthorized action was accepted or failed unexpectedly.`);
    if (codes) assert(codes.includes(response.value?.code), `${label}: unexpected rejection reason.`);
  }
  try {
    const settings = requireSuccess(await http('Auth settings', `${SUPABASE_URL}/auth/v1/settings`), 'Auth settings');
    stage = 'Browser API access';
    const preflight = await fetchImpl(API_URL, {method:'OPTIONS',headers:{Origin:ORIGIN,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization, apikey, content-type'},signal:AbortSignal.timeout(30000)});
    assert([200,204].includes(preflight.status), 'Browser preflight was rejected.');
    assert.equal(preflight.headers.get('access-control-allow-origin'),ORIGIN,'Browser API access does not allow the published site.');
    const allowedHeaders=(preflight.headers.get('access-control-allow-headers')||'').toLowerCase();
    assert(['authorization','apikey','content-type'].every(header=>allowedHeaders.includes(header)),'Browser API access does not allow the save-client headers.');
    passed('Unauthenticated browser preflight permits the hosted save client');
    stage = 'Auth configuration';
    if (settings.mailer_autoconfirm !== true) {
      throw new Error('Email confirmation is enabled or could not be verified. In the Supabase dashboard, open Authentication > Providers > Email and turn Confirm email off for this Alpha smoke test. No signup or email was attempted.');
    }
    passed('Email auto-confirm verified before signup');
    stage = 'Account creation';
    const suffix = randomBytes(6).toString('hex'), username = `AlphaQA_${suffix}`;
    email = `alpha.qa.${suffix}@example.com`; password = `Aa1!${randomBytes(30).toString('base64url')}`;
    const signup = requireSuccess(await http('Signup', `${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST', body: {email, password, data: {username}}
    }), 'Signup');
    assert(UUID.test(signup.user?.id || ''), 'Signup: no account UUID returned.');
    report.account = {id: signup.user.id, username};
    if (typeof signup.access_token === 'string') sessions.add(signup.access_token);
    passed('Email/password/username signup');
    stage = 'Password login and token refresh';
    let loggedIn = requireSuccess(await http('Password login', `${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST', body: {email, password}
    }), 'Password login');
    assert.equal(loggedIn.user?.id, report.account.id, 'Password login returned another account.');
    let auth = session(loggedIn, 'Password login'); loggedIn = null;
    const refreshed = requireSuccess(await http('Auth refresh', `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST', body: {refresh_token: auth.refresh}
    }), 'Auth refresh');
    auth = session(refreshed, 'Auth refresh');
    current = {...auth, lease: randomUUID(), revision: 0};
    const acquired = saved(requireSuccess(await api({scope: 'session', action: 'acquire', leaseId: current.lease}), 'Session acquire'), 'Session acquire');
    assert.equal(acquired.username, username, 'Cloud account username does not match signup.');
    current.revision = acquired.revision; current.snapshot = acquired.snapshot;
    passed('Password login, refresh and cloud session acquire');

    stage = 'House save and request replay';
    await run('house', 'view');
    const beforeDaily = current.snapshot.balance;
    const daily = await run('house', 'daily-reward');
    assert(current.snapshot.balance > beforeDaily, 'Daily reward did not reach the protected wallet.');
    const replay = saved(requireSuccess(await api(daily.body), 'Request replay'), 'Request replay');
    assert.equal(replay.replayed, true, 'Identical request was not recognized as a replay.');
    assert.equal(replay.revision, daily.value.revision, 'Request replay mutated the save revision.');
    assert(JSON.stringify(replay.result) === JSON.stringify(daily.value.result), 'Request replay did not restore its original result.');
    assert(JSON.stringify(replay.snapshot) === JSON.stringify(daily.value.snapshot), 'Request replay mutated the saved state.');
    passed('House view, daily autosave and identical-request replay');

    stage = 'Airport save';
    const airport = await run('airport', 'load');
    assert(airport.value.result?.view?.selectedAirport, 'Airport load did not return a usable dashboard view.');
    const airportId = airport.value.result.view.selectedAirportId;
    passed('Airport career load and dashboard projection');
    stage = 'Football save';
    await run('football', 'startClub', {args: [{name: 'Alpha QA Club', shortName: 'Alpha QA', siteId: 'caboolture', ownerInvestmentAud: 0,
      startupLoanAud: 2_000_000, academyFeeAud: 1750, weeklyFirstTeamBudget: 5000, playingStyle: 'balanced'}]});
    await run('football', 'advanceWeek', {args: []});
    assert.equal(current.snapshot.progress?.footballManager?.week, 2, 'Football week did not save.');
    passed('Football creation and server-authoritative week autosave');
    stage = 'Campaign save';
    await run('campaign', 'create', {homeCountryId: 'AU', scenarioId: 'open-world'});
    const turn = current.snapshot.progress?.campaign?.turn;
    await run('campaign', 'end-turn');
    assert.equal(current.snapshot.progress?.campaign?.turn, turn + 1, 'Campaign turn did not save.');
    passed('Campaign creation and server-authoritative turn autosave');

    stage = 'Tampering rejection';
    const beforeForgery = JSON.stringify(current.snapshot), revisionBeforeForgery = current.revision;
    await reject({...command('house', 'view'), snapshot: {balance: 9e12}}, 'Forged save upload');
    await reject(command('campaign', 'end-turn', {score: 999999, outcome: 'victory'}), 'Forged campaign score');
    await reject(command('football', 'simulateMatch', {args: [{squad: 'first', firstHalf: {homeGoals: 99, awayGoals: 0}}]}), 'Forged football score');
    const unchanged = saved(requireSuccess(await api(command('session', 'refresh')), 'Save refresh after rejected tampering'), 'Save refresh');
    assert.equal(unchanged.revision, revisionBeforeForgery, 'Rejected tampering advanced the save revision.');
    assert(JSON.stringify(unchanged.snapshot) === beforeForgery, 'Rejected tampering changed the save.');
    passed('Forged save and score uploads rejected without mutation');

    stage = 'Second-device restoration and session replacement';
    const oldDevice = current, savedSnapshot = JSON.stringify(current.snapshot);
    const second = requireSuccess(await http('Username password login', `${SUPABASE_URL}/functions/v1/dorra-login`, {
      method: 'POST', body: {username: username.toLowerCase(), password}
    }), 'Username password login');
    current = {...session(second, 'Username password login'), lease: randomUUID(), revision: 0};
    const signedInUser = requireSuccess(await http('Username login identity', `${SUPABASE_URL}/auth/v1/user`, {token: current.token}), 'Username login identity');
    assert.equal(signedInUser.id, report.account.id, 'Username sign-in returned another account.');
    passed('Case-insensitive username/password login returns a valid Supabase session');
    const restored = saved(requireSuccess(await api({scope: 'session', action: 'acquire', leaseId: current.lease}), 'Second-device acquire'), 'Second-device acquire');
    assert.equal(restored.revision, oldDevice.revision + 1, 'Second-device acquire did not invalidate the prior revision.');
    assert(JSON.stringify(restored.snapshot) === savedSnapshot, 'Second-device restore changed the cloud save.');
    current.revision = restored.revision; current.snapshot = restored.snapshot;
    await reject(command('session', 'refresh', {}, oldDevice), 'Replaced device', oldDevice, ['SESSION_REPLACED', 'AUTH_SESSION_ENDED', 'UNAUTHORIZED']);
    const resumedAirport = await run('airport', 'load');
    assert.equal(resumedAirport.value.result?.view?.selectedAirportId, airportId, 'Airport career did not restore on the second device.');
    assert.equal(current.snapshot.progress?.footballManager?.week, 2, 'Football career did not restore on the second device.');
    assert.equal(current.snapshot.progress?.campaign?.turn, turn + 1, 'Campaign did not restore on the second device.');
    assert.equal(current.snapshot.progress?.rewardDate, oldDevice.snapshot.progress?.rewardDate, 'House daily progress did not restore.');
    passed('All modes restored on a second auth session; old device rejected');
    if (process.env.DORRA_SITE_URL) {
      stage = 'Published GitHub Pages files';
      const site = new URL(process.env.DORRA_SITE_URL);
      assert.equal(site.origin, ORIGIN, 'The published smoke-test URL must use the authorized GitHub Pages origin.');
      const files = ['index.html', 'login.html', 'football-manager.html', 'idle-airport.html', 'war-simulation.html',
        'auth-client.js', 'vault-client.js', 'online-config.js', 'online-shell.js', 'login.js',
        'football/football-ui.js', 'airport/ui.mjs', 'campaign-controller.js', 'vendor/supabase/supabase.js'];
      const delays = [0, 2000, 5000, 10000, 15000];
      await Promise.all(files.map(async file => {
        for (const delay of delays) {
          if (delay) await new Promise(resolve => setTimeout(resolve, delay));
          try {
            const response = await fetchImpl(new URL(file, site), {cache: 'no-store', signal: AbortSignal.timeout(15000)});
            const mime = response.headers.get('content-type') || '', text = response.ok ? await response.text() : '';
            const valid = file.endsWith('.html') ? /text\/html/i.test(mime) && /<(?:!doctype|html)/i.test(text)
              : /(?:text|application)\/(?:java|ecma)script/i.test(mime) && text.length > 50;
            if (response.ok && valid && (file === 'index.html' ? text.includes('online-shell.js') : true)
              && (file === 'vault-client.js' ? text.includes('Browser save uploads are disabled') : true)) return;
          } catch { /* Pages publication can take a few seconds to propagate. */ }
        }
        throw new Error(`Published ${file} was unavailable or had an invalid content type after bounded retries.`);
      }));
      passed('Published login, house and game pages and browser modules available');
    }
    report.ok = true;
  } catch (error) {
    // Assertion messages above are fixed text. Never emit server response bodies,
    // request payloads, stack traces, passwords, emails, refresh tokens or JWTs.
    report.failure = {stage, message: error instanceof assert.AssertionError ? error.message.split('\n')[0] : error.message};
  } finally {
    stage = 'Sign-out cleanup';
    for (const token of sessions) {
      try {
        const result = await http('Local sign-out', `${SUPABASE_URL}/auth/v1/logout?scope=local`, {method: 'POST', token});
        report.cleanup.push({scope: 'local', ok: result.ok || result.status === 401 || result.status === 403});
      } catch { report.cleanup.push({scope: 'local', ok: false}); }
    }
    if (current?.token) {
      try {
        const result = await http('Global sign-out', `${SUPABASE_URL}/auth/v1/logout?scope=global`, {method: 'POST', token: current.token});
        report.cleanup.push({scope: 'global', ok: result.ok || result.status === 401 || result.status === 403});
      } catch { report.cleanup.push({scope: 'global', ok: false}); }
    }
    password = email = current = null; sessions.clear();
    report.finishedAt = new Date().toISOString();
  }
  return report;
}

async function main() {
  const report = await checkOnline();
  await mkdir(path.join(ROOT, 'work'), {recursive: true});
  await writeFile(path.join(ROOT, 'work/live-check.json'), JSON.stringify(report, null, 2) + '\n');
  if (report.account) console.log(JSON.stringify(report.account));
  const summary = [`## Live Alpha smoke test: ${report.ok ? 'passed' : 'failed'}`, '',
    ...report.checks.map(name => `- Passed: ${name}`), '',
    ...(report.failure ? [`**${report.failure.stage}:** ${report.failure.message}`, ''] : []),
    ...(report.account ? [`QA account for cleanup: \`${report.account.id}\` / \`${report.account.username}\``, ''] : []),
    'Credentials and session tokens were kept in memory and were not written to this report.', ''].join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  if (!report.ok) { console.error(`${report.failure.stage}: ${report.failure.message}`); process.exitCode = 1; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
