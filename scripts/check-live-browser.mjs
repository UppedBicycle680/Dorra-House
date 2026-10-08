import {randomBytes} from 'node:crypto';
import {access, appendFile, mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {chromium} from 'playwright';
import {SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, API_URL} from '../online-config.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ORIGIN = 'https://uppedbicycle680.github.io';
const DEFAULT_SITE = `${ORIGIN}/Dorra-House/`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIMEOUT = 90000;
const ensure = condition => { if (!condition) throw new Error('Live browser verification failed.'); };
const ASSET_PATHS = new Map(['login.html', 'login.js', 'login.css', 'auth-client.js', 'online-config.js', 'vendor/supabase/supabase.js',
  'index.html', 'app.js', 'vault-client.js', 'online-shell.js', 'online-shell.css', 'styles.css', 'progression-engine.js', 'campaign-engine.js',
  'idle-airport.html', 'airport/ui.mjs', 'football-manager.html', 'football/football-ui.js', 'war-simulation.html', 'war-simulation.js', 'campaign-controller.js']
  .map(asset => [`/Dorra-House/${asset}`, asset]));
const AUTH_ACTIONS = new Set(['signup', 'token', 'user', 'logout', 'recover', 'resend']);
const SCOPES = new Set(['session', 'house', 'airport', 'football', 'campaign']);
const ACTIONS = new Set(['acquire', 'refresh', 'view', 'arrival', 'daily-reward', 'settings', 'load', 'command', 'withdraw', 'startClub', 'advanceWeek', 'create', 'end-turn']);
const CODES = new Set(['email_not_confirmed', 'invalid_credentials', 'bad_jwt', 'refresh_token_not_found', 'refresh_token_already_used',
  'signup_disabled', 'user_already_exists', 'email_address_invalid', 'email_address_not_authorized', 'over_email_send_rate_limit',
  'over_request_rate_limit', 'unexpected_failure', 'SESSION_REPLACED', 'AUTH_SESSION_ENDED', 'UNAUTHORIZED', 'ACCOUNT_DISABLED',
  'STALE_REVISION', 'REQUEST_REUSED', 'RATE_LIMIT', 'SAVE_REQUIRED', 'STORAGE_ERROR', 'ACTION_REJECTED', 'INVALID_ARGUMENTS', 'ORIGIN_DENIED']);

async function launchBrowser() {
  let executablePath = process.env.DORRA_CHROMIUM_PATH;
  if (!executablePath) {
    for (const candidate of ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
      if (await access(candidate).then(() => true, () => false)) { executablePath = candidate; break; }
    }
  }
  return chromium.launch({headless: true, executablePath, args: [
    '--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--use-gl=angle',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader'
  ]});
}

// This runs against the published website and real Auth/gameplay endpoints.
// Exported injection points are for local harness verification only; CI calls
// the defaults. Credentials, request bodies and browser logs stay in memory.
export async function checkLiveBrowser({fetchImpl = fetch, launchImpl = launchBrowser} = {}) {
  const report = {ok: false, checks: [], account: null, startedAt: new Date().toISOString()};
  const tokens = new Set(), pages = [], javascriptErrors = [], responseTasks = new Set();
  const debug = {lastAuthStatus: null, currentPathname: null, javascriptErrorCount: 0, authResponseShape: null, sdkSessionShape: null, loginState: null, observations: []};
  let stage = 'Published site URL', browser = null, email = null, password = null, expectedUsername = null, activePage = null;
  const passed = name => { report.checks.push(name); console.log(`Passed: ${name}`); };
  const observe = value => { debug.observations.push(value); if (debug.observations.length > 45) debug.observations.shift(); };
  const knownCode = value => typeof value === 'string' ? (CODES.has(value) ? value : 'other') : null;
  const visible = (page, selector) => page.locator(selector).waitFor({state: 'visible', timeout: TIMEOUT});
  const hidden = (page, selector) => page.locator(selector).waitFor({state: 'hidden', timeout: TIMEOUT});
  const exactText = (page, selector, text) => page.waitForFunction(({selector, text}) => document.querySelector(selector)?.textContent.trim() === text, {selector, text}, {timeout: TIMEOUT});
  const saved = page => page.waitForFunction(() => document.documentElement.dataset.saveState === 'saved', null, {timeout: TIMEOUT});
  function waitAPI(page, scope, action, predicate = null) {
    const pending = page.waitForResponse(response => {
      if (response.url().split('?')[0] !== API_URL || response.request().method() !== 'POST') return false;
      try { const body = response.request().postDataJSON(); return body.scope === scope && body.action === action && (!predicate || predicate(body)); }
      catch { return false; }
    }, {timeout: TIMEOUT});
    pending.catch(() => {});
    return pending;
  }
  async function outcome(pending, expectedStatus = 200) {
    const response = await pending;
    ensure(response.status() === expectedStatus);
    const value = await response.json();
    ensure(!Object.hasOwn(value, 'privateState'));
    if (expectedStatus === 200) ensure(value.snapshot && Number.isSafeInteger(value.revision));
    return value;
  }
  async function perform(page, scope, action, trigger, expectedStatus = 200, predicate = null) {
    activePage = page;
    const pending = waitAPI(page, scope, action, predicate);
    await trigger();
    return outcome(pending, expectedStatus);
  }
  function waitAuth(page, endpoint) {
    const pending = page.waitForResponse(response => response.url().split('?')[0] === `${SUPABASE_URL}/auth/v1/${endpoint}` && response.request().method() === 'POST', {timeout: TIMEOUT});
    pending.catch(() => {});
    return pending;
  }
  async function accountSession(page) {
    const session = await page.evaluate(async () => {
      const {supabase} = await import(new URL('auth-client.js', location.href).href);
      const {data, error} = await supabase.auth.getSession();
      if (error || !data.session) return null;
      return {id: data.session.user?.id, username: data.session.user?.user_metadata?.username, accessToken: data.session.access_token};
    });
    debug.sdkSessionShape = {hasSession: !!session, hasValidId: UUID.test(session?.id || ''), usernameMatches: session?.username === expectedUsername,
      hasAccessToken: typeof session?.accessToken === 'string'};
    return session;
  }
  async function newPage(context) {
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);
    page.setDefaultNavigationTimeout(TIMEOUT);
    page.on('pageerror', error => {
      const text = error.message || '';
      javascriptErrors.push(/crypto\.randomUUID/.test(text) ? 'RANDOM_UUID_UNAVAILABLE'
        : /before initialization/.test(text) ? 'TEMPORAL_DEAD_ZONE'
        : /not defined/.test(text) ? 'UNDEFINED_IDENTIFIER'
        : /dynamically imported module/.test(text) ? 'MODULE_FETCH_FAILED'
        : /lock|NavigatorLockAcquireTimeout/i.test(text) ? 'AUTH_LOCK_ERROR' : 'OTHER');
    });
    page.on('request', request => {
      if (!request.url().startsWith(SUPABASE_URL + '/')) return;
      const authorization = request.headers().authorization || '';
      if (authorization.startsWith('Bearer ey')) tokens.add(authorization.slice(7));
    });
    page.on('response', response => {
      const task = (async () => {
        const url = new URL(response.url()), status = response.status();
        if (url.origin === ORIGIN && ASSET_PATHS.has(url.pathname)) {
          observe({kind: 'asset', asset: ASSET_PATHS.get(url.pathname), status});
          return;
        }
        if (url.origin !== SUPABASE_URL) return;
        const authAction = url.pathname.startsWith('/auth/v1/') ? url.pathname.slice('/auth/v1/'.length) : null;
        if (AUTH_ACTIONS.has(authAction) && response.request().method() !== 'OPTIONS') {
          debug.lastAuthStatus = status;
          const entry = {kind: 'auth', action: authAction, status, code: null};
          observe(entry);
          // Begin reading immediately at the response event, before a successful
          // signup redirects. Copy only the cleanup identity and tokens in memory.
          try {
            const value = await response.json();
            entry.code = knownCode(value?.error_code || value?.code);
            if (authAction === 'signup' || authAction === 'token') {
              const authUser = value?.user || (UUID.test(value?.id || '') ? value : null);
              debug.authResponseShape = {readable: true, hasUser: !!authUser, hasValidId: UUID.test(authUser?.id || ''),
                hasAccessToken: typeof value?.access_token === 'string', hasRefreshToken: typeof value?.refresh_token === 'string', hasSession: !!value?.session};
              if (typeof value?.access_token === 'string') tokens.add(value.access_token);
              if (authAction === 'signup' && UUID.test(authUser?.id || '') && authUser?.user_metadata?.username === expectedUsername) {
                report.account = {id: authUser.id, username: expectedUsername};
              }
            }
          } catch {
            if (authAction === 'signup' || authAction === 'token') debug.authResponseShape = {readable: false};
          }
          return;
        }
        if (url.href.split('?')[0] === API_URL && response.request().method() === 'POST') {
          let body;
          try { body = response.request().postDataJSON(); } catch { return; }
          if (!SCOPES.has(body?.scope) || !ACTIONS.has(body?.action)) return;
          const entry = {kind: 'gameplay', scope: body.scope, action: body.action, status, code: null};
          observe(entry);
          if (status >= 400) { try { entry.code = knownCode((await response.json())?.code); } catch {} }
        }
      })().catch(() => {});
      responseTasks.add(task);
      void task.finally(() => responseTasks.delete(task));
    });
    page.on('requestfailed', request => {
      try {
        const url = new URL(request.url());
        if (url.origin === ORIGIN && ASSET_PATHS.has(url.pathname)) observe({kind: 'asset-request-failed', asset: ASSET_PATHS.get(url.pathname)});
        else if (url.origin === SUPABASE_URL && AUTH_ACTIONS.has(url.pathname.slice('/auth/v1/'.length))) {
          observe({kind: 'auth-request-failed', action: url.pathname.slice('/auth/v1/'.length)});
        } else if (url.href.split('?')[0] === API_URL) observe({kind: 'gameplay-request-failed'});
      } catch {}
    });
    pages.push(page);
    activePage = page;
    return page;
  }
  async function screenshot(page, filename) {
    if (process.env.DORRA_BROWSER_SCREENSHOTS !== '1') return;
    await mkdir(path.join(ROOT, 'work'), {recursive: true});
    await page.screenshot({path: path.join(ROOT, 'work', filename), fullPage: false});
  }
  async function failureDiagnostics() {
    debug.javascriptErrorCount = javascriptErrors.length;
    debug.javascriptErrorKinds = [...new Set(javascriptErrors)];
    if (!activePage) return;
    try {
      const currentURL = new URL(activePage.url()), pathname = currentURL.pathname;
      debug.browserRouting = {protocol: currentURL.protocol === 'https:' ? 'https' : currentURL.protocol === 'http:' ? 'http' : 'other',
        expectedOrigin: currentURL.origin === ORIGIN, hasSearch: !!currentURL.search, hasHash: !!currentURL.hash};
      debug.currentPathname = ASSET_PATHS.has(pathname) || ['/', '/Dorra-House/'].includes(pathname) ? pathname : 'other';
      debug.loginState = await activePage.evaluate(() => {
        const form = document.querySelector('#accountForm'), message = document.querySelector('#accountMessage')?.textContent || '';
        let messageKind = 'empty';
        if (message) messageKind = /lock|acquir.*tim|NavigatorLockAcquireTimeout/i.test(message) ? 'auth-lock-error'
          : /confirm|confirmation/i.test(message) ? 'email-confirmation'
          : /api.?key|publishable|anon.?key/i.test(message) ? 'key-error'
          : /token|JWT/i.test(message) ? 'token-error'
          : /fetch|network/i.test(message) ? 'network-error'
          : /username|database.*user/i.test(message) ? 'username-error'
          : /password|credentials/i.test(message) ? 'credentials-error' : 'other';
        let stored = null;
        try { stored = JSON.parse(localStorage.getItem('dorra-online-auth') || 'null'); } catch {}
        return {secureContext: window.isSecureContext, randomUUIDAvailable: typeof crypto.randomUUID === 'function',
          formPresent: !!form, formValid: form ? form.checkValidity() : null,
          submitDisabled: document.querySelector('#submitAccount')?.disabled ?? null, messageKind,
          storedAuthPresent: !!stored, storedAccessTokenPresent: typeof stored?.access_token === 'string', storedUserPresent: !!stored?.user};
      });
    } catch {}
    // Remove fields and arbitrary account messages before capturing a failure.
    // If sanitization cannot complete, omit the screenshot rather than risk data.
    try {
      await activePage.evaluate(() => {
        for (const field of document.querySelectorAll('input,textarea,[contenteditable]')) {
          if ('value' in field) field.value = '';
          field.removeAttribute('value');
          if (field.hasAttribute('contenteditable')) field.textContent = '';
          field.style.setProperty('visibility', 'hidden', 'important');
        }
        for (const selector of ['#usernameField', '#emailField', '#passwordField', '#repeatField', '#accountMessage']) {
          const element = document.querySelector(selector);
          if (element) { element.textContent = ''; element.style.setProperty('visibility', 'hidden', 'important'); }
        }
      });
      await mkdir(path.join(ROOT, 'work'), {recursive: true});
      await activePage.screenshot({path: path.join(ROOT, 'work', 'live-browser-failure.png'), fullPage: false, timeout: 10000});
    } catch {}
  }
  try {
    const site = new URL(process.env.DORRA_SITE_URL || DEFAULT_SITE);
    ensure(site.origin === ORIGIN && site.pathname === '/Dorra-House/' && !site.username && !site.password && !site.search && !site.hash);
    stage = 'Email confirmation guard';
    const settingsResponse = await fetchImpl(`${SUPABASE_URL}/auth/v1/settings`, {headers: {apikey: SUPABASE_PUBLISHABLE_KEY, Origin: ORIGIN}, signal: AbortSignal.timeout(30000)});
    ensure(settingsResponse.ok && (await settingsResponse.json()).mailer_autoconfirm === true);
    passed('Email auto-confirm verified before any browser signup');

    stage = 'Published HTTPS routing';
    const routingResponse = await fetchImpl(new URL('login.html', site), {method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(30000)});
    const routed = new URL(routingResponse.url);
    debug.publishedRouting = {status: routingResponse.status, protocol: routed.protocol === 'https:' ? 'https' : routed.protocol === 'http:' ? 'http' : 'other',
      expectedOrigin: routed.origin === ORIGIN, pathname: ASSET_PATHS.has(routed.pathname) ? routed.pathname : 'other'};
    try { await routingResponse.body?.cancel(); } catch {}
    ensure(routingResponse.ok && routed.protocol === 'https:' && routed.origin === ORIGIN);
    passed('Published signup routing remains on the authorized HTTPS origin');

    stage = 'Browser startup';
    browser = await launchImpl();
    const desktopContext = await browser.newContext({viewport: {width: 1440, height: 1000}, locale: 'en-US', timezoneId: 'UTC', reducedMotion: 'reduce'});
    const desktop = await newPage(desktopContext);
    const suffix = randomBytes(6).toString('hex'), username = `AlphaQA_${suffix}`;
    expectedUsername = username;
    email = `alpha.qa.${suffix}@example.com`;
    password = `Aa1!${randomBytes(30).toString('base64url')}`;
    stage = 'Signup page navigation';
    await desktop.goto(new URL('login.html', site).href, {waitUntil: 'domcontentloaded'});
    stage = 'Signup page identity';
    ensure((await desktop.title()).includes('Dorra House'));
    stage = 'Signup handler readiness';
    await desktop.waitForFunction(() => typeof document.querySelector('#signUpTab')?.onclick === 'function', null, {timeout: TIMEOUT});
    stage = 'Signup mode selection';
    await desktop.locator('#signUpTab').click();
    stage = 'Signup fields filling';
    await desktop.locator('#username').fill(username);
    await desktop.locator('#email').fill(email);
    await desktop.locator('#password').fill(password);
    await desktop.locator('#repeatPassword').fill(password);
    const signupPending = waitAuth(desktop, 'signup'), firstHousePending = waitAPI(desktop, 'house', 'view');
    stage = 'Signup submission';
    await desktop.locator('#submitAccount').click();
    stage = 'Signup Auth response';
    const signupResponse = await signupPending;
    stage = 'Signup Auth status';
    ensure(signupResponse.ok());
    stage = 'Signup redirect to House';
    await desktop.waitForURL(new URL('index.html', site).href, {waitUntil: 'domcontentloaded', timeout: TIMEOUT});
    stage = 'Signup SDK session';
    const signup = await accountSession(desktop);
    if (typeof signup?.accessToken === 'string') tokens.add(signup.accessToken);
    if (UUID.test(signup?.id || '')) report.account = {id: signup.id, username};
    ensure(report.account && signup.username === username);
    stage = 'First House view response';
    const initialHouse = await outcome(firstHousePending);
    stage = 'First House wallet';
    ensure(initialHouse.snapshot.balance === 1000);
    stage = 'First House arrival rendering';
    await visible(desktop, '#arrivalScreen');
    stage = 'First House account rendering';
    await exactText(desktop, '[data-online-username]', username);
    stage = 'First House JavaScript health';
    ensure(javascriptErrors.length === 0);
    passed('Real published email/password/username signup opens the desktop House');

    stage = 'Arrival autosave';
    const arrival = await perform(desktop, 'house', 'arrival', () => desktop.locator('#arrivalSkipBtn').click());
    ensure(arrival.snapshot.progress?.arrival?.complete === true && arrival.snapshot.balance === 1000);
    await hidden(desktop, '#arrivalScreen');
    await visible(desktop, '#lobby');
    await saved(desktop);
    await exactText(desktop, '#balance', '$1,000');
    passed('Arrival choice saves through the real UI without a founder advance');

    stage = 'Daily reward autosave';
    ensure(await desktop.locator('#dailyRewardBtn').isEnabled());
    const daily = await perform(desktop, 'house', 'daily-reward', () => desktop.locator('#dailyRewardBtn').click());
    const savedBalance = daily.snapshot.balance, rewardDate = daily.snapshot.progress?.rewardDate;
    ensure(savedBalance === 1250 && typeof rewardDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rewardDate));
    await exactText(desktop, '#balance', '$1,250');
    await exactText(desktop, '#dashboardBalance', '$1,250');
    await exactText(desktop, '#dailyRewardBtn', 'Claimed today');
    ensure(await desktop.locator('#dailyRewardBtn').isDisabled());
    await saved(desktop);
    await exactText(desktop, '#saveIndicator', 'Saved online');
    await screenshot(desktop, 'live-browser-house-desktop.png');
    passed('Daily reward updates the protected wallet and renders Saved online');

    stage = 'Mobile username login and cloud restoration';
    const mobileContext = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, locale: 'en-US', timezoneId: 'Australia/Sydney', reducedMotion: 'reduce'});
    const mobile = await newPage(mobileContext);
    stage = 'Mobile login page navigation';
    await mobile.goto(new URL('login.html', site).href, {waitUntil: 'domcontentloaded'});
    stage = 'Mobile login handler readiness';
    await mobile.waitForFunction(() => typeof document.querySelector('#accountForm')?.onsubmit === 'function', null, {timeout: TIMEOUT});
    await mobile.locator('#email').fill(username.toLowerCase());
    await mobile.locator('#password').fill(password);
    const loginPending = mobile.waitForResponse(response => response.url().split('?')[0] === `${SUPABASE_URL}/functions/v1/dorra-login` && response.request().method() === 'POST', {timeout: TIMEOUT});
    loginPending.catch(() => {});
    const secondHousePending = waitAPI(mobile, 'house', 'view');
    stage = 'Mobile login submission';
    await mobile.locator('#submitAccount').click();
    stage = 'Mobile login Auth response';
    const loginResponse = await loginPending;
    stage = 'Mobile login Auth status';
    ensure(loginResponse.ok());
    stage = 'Mobile login redirect';
    await mobile.waitForURL(new URL('index.html', site).href, {waitUntil: 'domcontentloaded', timeout: TIMEOUT});
    stage = 'Mobile login SDK session';
    const login = await accountSession(mobile);
    if (typeof login?.accessToken === 'string') tokens.add(login.accessToken);
    ensure(login?.id === report.account.id && login.username === username);
    stage = 'Mobile House view response';
    const restoredHouse = await outcome(secondHousePending);
    ensure(restoredHouse.snapshot.balance === savedBalance && restoredHouse.snapshot.progress?.rewardDate === rewardDate && restoredHouse.snapshot.progress?.arrival?.complete === true);
    await exactText(mobile, '#balance', '$1,250');
    await exactText(mobile, '#dailyRewardBtn', 'Claimed today');
    ensure(await mobile.locator('#dailyRewardBtn').isDisabled());
    await hidden(mobile, '#arrivalScreen');
    await visible(mobile, '#lobby');
    await exactText(mobile, '[data-online-username]', username);
    await saved(mobile);
    await screenshot(mobile, 'live-browser-house-mobile.png');
    passed('A fresh mobile browser in another timezone restores the wallet, reward and arrival progress');

    stage = 'Old-device rejection';
    ensure(await desktop.locator('#soundBtn').isEnabled());
    const replaced = await perform(desktop, 'house', 'settings', () => desktop.locator('#soundBtn').click(), 409);
    ensure(replaced.code === 'SESSION_REPLACED');
    await desktop.waitForFunction(() => document.documentElement.dataset.sessionState === 'ended', null, {timeout: TIMEOUT});
    await visible(desktop, 'dialog.online-session-notice');
    await exactText(desktop, 'dialog.online-session-notice h2', 'Your session has ended');
    await exactText(desktop, '#balance', '$1,250');
    passed('The replaced desktop is rejected and displays the blocking session notice');

    stage = 'House reload persistence';
    const reloadedHouse = await perform(mobile, 'house', 'view', () => mobile.reload({waitUntil: 'domcontentloaded'}));
    ensure(reloadedHouse.snapshot.balance === savedBalance && reloadedHouse.snapshot.progress?.rewardDate === rewardDate && reloadedHouse.snapshot.progress?.arrival?.complete === true);
    await exactText(mobile, '#balance', '$1,250');
    await exactText(mobile, '#dailyRewardBtn', 'Claimed today');
    await hidden(mobile, '#arrivalScreen');
    await saved(mobile);
    passed('Reloading the published House preserves the saved wallet and reward');

    stage = 'Airport dashboard and construction autosave';
    const airport = await perform(mobile, 'airport', 'load', () => mobile.goto(new URL('idle-airport.html', site).href, {waitUntil: 'domcontentloaded'}));
    ensure(airport.result?.view?.selectedAirport);
    await visible(mobile, '#airportDashboard');
    await hidden(mobile, '#airportLoading');
    await hidden(mobile, '#airportFatal');
    await mobile.locator('button[data-action="visit-airport"][data-airport-id="redcliffe"]').click();
    await visible(mobile, '#airportHud');
    await visible(mobile, '#airportCanvas');
    await exactText(mobile, '#airportName', 'Redcliffe Airport');
    await mobile.locator('#airportHud [data-action="buildings"]').click();
    const upgrade = await perform(mobile, 'airport', 'command', () => mobile.locator('#dialogBody button[data-action="upgrade"][data-building="runwaySurface"]:not([data-use-diamonds])').click(), 200,
      body => body.args?.command?.type === 'upgrade' && body.args?.command?.building === 'runwaySurface');
    ensure(upgrade.snapshot.balance === savedBalance && upgrade.result?.view?.selectedAirport?.constructions?.some(task => task.building === 'runwaySurface'));
    await mobile.waitForFunction(() => document.querySelector('#dialogBody')?.textContent.includes('Construction underway'), null, {timeout: TIMEOUT});
    await mobile.waitForFunction(() => document.querySelector('#airportSaveStatus')?.textContent.includes('Saved to cloud'), null, {timeout: TIMEOUT});
    await saved(mobile);
    passed('Published airport dashboard opens and runway construction saves through its controls');

    stage = 'Football club creation';
    await mobile.goto(new URL('football-manager.html', site).href, {waitUntil: 'domcontentloaded'});
    await visible(mobile, '#clubOnboarding');
    await mobile.locator('#clubNameInput').fill('Alpha QA Club');
    await mobile.locator('#clubShortNameInput').fill('Alpha QA');
    await mobile.locator('#clubInitialsInput').fill('AQ');
    await mobile.locator('#setupNextBtn').click();
    await mobile.locator('#regionSelect').selectOption('Moreton Bay');
    await mobile.locator('[data-location-id="caboolture"]').click();
    await mobile.locator('#setupNextBtn').click();
    await mobile.locator('#dorraInvestmentInput').fill('0');
    await mobile.locator('#startupLoanInput').fill('2000000');
    const club = await perform(mobile, 'football', 'startClub', () => mobile.locator('#createClubBtn').click());
    ensure(club.snapshot.progress?.footballManager?.week === 1);
    await visible(mobile, '#clubWorkspace');
    await exactText(mobile, '#sidebarClubName', 'Alpha QA');
    await exactText(mobile, '#topbarWeek', 'Week 1');
    passed('Published football onboarding creates a club using its real form');

    stage = 'Football week autosave and reload';
    await mobile.locator('#simulateWeekBtn').click();
    const advanced = await perform(mobile, 'football', 'advanceWeek', () => mobile.locator('[data-confirm-simulate-week]').click());
    ensure(advanced.snapshot.progress?.footballManager?.week === 2);
    await exactText(mobile, '#topbarWeek', 'Week 2');
    await saved(mobile);
    await mobile.reload({waitUntil: 'domcontentloaded'});
    await visible(mobile, '#clubWorkspace');
    await exactText(mobile, '#topbarWeek', 'Week 2');
    await exactText(mobile, '#sidebarClubName', 'Alpha QA');
    await hidden(mobile, '#clubOnboarding');
    await saved(mobile);
    passed('A football week saves and remains restored after a published-page reload');

    stage = 'Campaign creation';
    await mobile.goto(new URL('war-simulation.html', site).href, {waitUntil: 'domcontentloaded'});
    await visible(mobile, '#campaignPanel');
    await hidden(mobile, '#strategicLoading');
    await hidden(mobile, '#strategicFatal');
    const created = await perform(mobile, 'campaign', 'create', () => mobile.locator('[data-campaign-start]').click());
    ensure(created.snapshot.progress?.campaign?.homeCountryId === 'AU' && created.snapshot.progress?.campaign?.turn === 1);
    await mobile.waitForFunction(() => document.querySelector('#strategicTurnStatus')?.textContent.includes('Turn 1'), null, {timeout: TIMEOUT});
    passed('Published Strategic Command establishes its first campaign through the UI');

    stage = 'Campaign turn autosave and reload';
    await mobile.locator('[data-campaign-end-turn-open]').click();
    const ended = await perform(mobile, 'campaign', 'end-turn', () => mobile.locator('[data-campaign-end-turn-confirm]').click());
    ensure(ended.snapshot.progress?.campaign?.turn === 2);
    await mobile.waitForFunction(() => document.querySelector('#strategicTurnStatus')?.textContent.includes('Turn 2'), null, {timeout: TIMEOUT});
    await saved(mobile);
    await mobile.reload({waitUntil: 'domcontentloaded'});
    await visible(mobile, '#campaignPanel');
    await mobile.waitForFunction(() => document.querySelector('#strategicTurnStatus')?.textContent.includes('Turn 2'), null, {timeout: TIMEOUT});
    await hidden(mobile, '#strategicFatal');
    await saved(mobile);
    passed('A campaign turn saves and remains restored after a published-page reload');

    stage = 'Browser JavaScript health';
    ensure(javascriptErrors.length === 0);
    passed('Desktop and mobile flows complete without uncaught browser JavaScript errors');
    report.ok = true;
  } catch {
    // Playwright errors can contain filled values, URLs and call logs. Emit only
    // fixed stage names; never an exception, stack, response body or credential.
    report.failure = {stage, message: stage === 'Email confirmation guard'
      ? 'Email auto-confirm could not be verified. No signup or email was attempted.'
      : 'The published browser check did not complete this stage.'};
    await failureDiagnostics();
    report.debug = debug;
  } finally {
    let signedOut = true;
    for (const [index, token] of [...tokens].reverse().entries()) {
      try {
        const response = await fetchImpl(`${SUPABASE_URL}/auth/v1/logout?scope=${index === 0 ? 'global' : 'local'}`, {
          method: 'POST', headers: {apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, Origin: ORIGIN}, signal: AbortSignal.timeout(15000)
        });
        if (![200, 204, 401, 403].includes(response.status)) signedOut = false;
      } catch { signedOut = false; }
    }
    if (tokens.size && signedOut) passed('Disposable QA authentication sessions signed out');
    if (!signedOut && report.ok) {
      report.ok = false;
      report.failure = {stage: 'Session cleanup', message: 'Disposable QA session sign-out could not be verified.'};
    }
    email = password = null;
    tokens.clear();
    for (const page of pages) {
      try { await page.evaluate(() => localStorage.removeItem('dorra-online-auth')); } catch {}
    }
    try { await browser?.close(); } catch {}
    report.finishedAt = new Date().toISOString();
  }
  return report;
}

async function main() {
  const report = await checkLiveBrowser();
  await mkdir(path.join(ROOT, 'work'), {recursive: true});
  await writeFile(path.join(ROOT, 'work', 'live-browser-report.json'), JSON.stringify(report, null, 2) + '\n');
  const lines = [`## Published browser verification: ${report.ok ? 'passed' : 'failed'}`, '', ...report.checks.map(check => `- Passed: ${check}`), '',
    ...(report.failure ? [`**${report.failure.stage}:** ${report.failure.message}`, ''] : []),
    ...(report.account ? [`QA account for cleanup: \`${report.account.id}\` / \`${report.account.username}\``, ''] : []),
    'Passwords, email addresses, session tokens, request bodies and browser logs were not written to the report.', ''];
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join('\n'));
  if (report.account) console.log(JSON.stringify(report.account));
  if (!report.ok) { console.error(`${report.failure.stage}: ${report.failure.message}`); process.exitCode = 1; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
