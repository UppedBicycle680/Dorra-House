// Dorra Estate's account mode sends player intentions to the authoritative API.
// Cloud progress and its wallet remain separate from the protected guest vault.
export const ESTATE_CLOUD_URL = 'https://fbebytnhlanqdbbvxzwz.supabase.co';
const PUBLIC_KEY = 'sb_publishable_vbiN1vArbVXlBtxgN3NzwQ_H836pZyp';
const AUTH_KEY = 'dorra-estate-account-v1';
const ACTIONS = new Set(['estate-clicker-open','estate-clicker-serve','estate-clicker-upgrade','estate-clicker-manager','estate-clicker-claim','estate-clicker-goal']);
const cloudError = (message, code = 'CLOUD_ERROR') => Object.assign(new Error(message), {code});

export function createEstateCloud(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch.bind(globalThis);
  const storage = options.storage || globalThis.sessionStorage;
  const randomId = options.randomId || (() => crypto.randomUUID());
  const clock = options.clock || (() => Date.now());
  let auth = null, snapshot = null, revision = 0, username = '', status = 'local';
  let leaseId = randomId(), connected = false, queue = Promise.resolve(), lastError = null, serverOffset = 0;
  try {
    const saved = JSON.parse(storage.getItem(AUTH_KEY) || 'null');
    if (saved && typeof saved.access_token === 'string' && typeof saved.refresh_token === 'string') auth = saved;
  } catch {}
  const emit = () => { options.onStatus?.(status, lastError); options.onChange?.(); };
  const setStatus = value => { status = value; emit(); };
  const remember = session => {
    if (typeof session?.access_token !== 'string' || typeof session?.refresh_token !== 'string') throw cloudError('The sign-in response was incomplete. Try again.', 'AUTH_RESPONSE');
    auth = {access_token:session.access_token,refresh_token:session.refresh_token,expires_at:session.expires_at || 0};
    try { storage.setItem(AUTH_KEY, JSON.stringify(auth)); } catch {}
  };
  const clearAuth = () => { auth = null; try { storage.removeItem(AUTH_KEY); } catch {} };
  async function post(path, body, token = null) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 20000);
    try {
      const response = await fetchImpl(ESTATE_CLOUD_URL + path, {
        method:'POST', headers:{'Content-Type':'application/json',apikey:PUBLIC_KEY,...(token?{Authorization:'Bearer ' + token}:{})},
        body:JSON.stringify(body), signal:controller.signal
      });
      let data; try { data = await response.json(); } catch { throw cloudError('The cloud returned an unreadable response.', 'CLOUD_RESPONSE'); }
      if (!response.ok) throw cloudError(data.error || data.msg || data.message || 'The cloud action could not be completed.', data.code || 'HTTP_' + response.status);
      return data;
    } catch(error) {
      if (typeof error.code === 'string') throw error;
      throw cloudError(error.name === 'AbortError' ? 'The cloud took too long to respond. Your local estate is still safe.' : 'Cannot reach the cloud. Check your connection and retry.', 'NETWORK');
    } finally { clearTimeout(timeout); }
  }
  async function accessToken() {
    if (!auth) throw cloudError('Sign in to connect your Dorra account.', 'UNAUTHORIZED');
    // The server verifies every token. This expiry is only a refresh hint.
    let expiry = auth.expires_at;
    if (!expiry) { try { expiry = JSON.parse(atob(auth.access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).exp; } catch {} }
    if (expiry && expiry * 1000 <= clock() + 60000) {
      try { remember(await post('/auth/v1/token?grant_type=refresh_token',{refresh_token:auth.refresh_token})); }
      catch(error) { if (error.code !== 'NETWORK') clearAuth(); throw error; }
    }
    return auth.access_token;
  }
  const adopt = response => {
    if (!response || !response.snapshot || !Number.isSafeInteger(response.snapshot.balance) || !response.snapshot.progress || !Number.isSafeInteger(response.revision)) throw cloudError('The cloud save is incomplete. Reconnect to retry.', 'CLOUD_RESPONSE');
    snapshot = structuredClone(response.snapshot); revision = response.revision;
    username = response.username || username;
    if (Number.isFinite(response.serverNow)) serverOffset = response.serverNow - clock();
    connected = true; lastError = null; status = 'saved'; emit();
    return response;
  };
  async function acquire() {
    const token = await accessToken();
    return adopt(await post('/functions/v1/dorra-api',{scope:'session',action:'acquire',leaseId},token));
  }
  async function withStatus(operation) {
    lastError = null; setStatus('saving');
    try { return await operation(); }
    catch(error) { lastError = error; setStatus('error'); throw error; }
  }
  const enqueue = operation => {
    const work = queue.then(() => withStatus(operation));
    queue = work.catch(() => {});
    return work;
  };
  return Object.freeze({
    get connected() { return connected; },
    get snapshot() { return snapshot ? structuredClone(snapshot) : null; },
    get status() { return status; },
    get username() { return username; },
    get remembered() { return Boolean(auth); },
    get serverNow() { return clock() + serverOffset; },
    get error() { return lastError; },
    login(user, password) {
      return enqueue(async () => {
        if (connected) throw cloudError('Disconnect before signing into another account.');
        const name = String(user || '').trim().toLowerCase();
        if (!/^[a-z0-9_]{3,24}$/.test(name) || typeof password !== 'string' || password.length < 8 || password.length > 128) throw cloudError('Enter your Dorra username and password.', 'INVALID_CREDENTIALS');
        remember(await post('/functions/v1/dorra-login',{username:name,password}));
        username = name; leaseId = randomId();
        return acquire();
      });
    },
    resume() { return enqueue(() => acquire()); },
    refresh() {
      return enqueue(async () => {
        if (!connected) throw cloudError('Connect your Dorra account first.', 'UNAUTHORIZED');
        return acquire();
      });
    },
    command(action, args = {}) {
      if (!connected) return Promise.reject(cloudError('Connect your Dorra account first.', 'UNAUTHORIZED'));
      if (!ACTIONS.has(action)) return Promise.reject(cloudError('Unknown estate action.', 'INVALID_ACTION'));
      const input = structuredClone(args);
      return enqueue(async () => {
        const token = await accessToken();
        const body = {scope:'house',action,args:input,leaseId,requestId:randomId(),expectedRevision:revision};
        let response;
        try { response = await post('/functions/v1/dorra-api',body,token); }
        catch(error) {
          // Retry uncertain delivery using the identical request ID. The server
          // replays a committed result instead of charging or rewarding twice.
          if (error.code === 'NETWORK') response = await post('/functions/v1/dorra-api',body,token);
          else {
            if (error.code === 'STALE_REVISION') { try { await acquire(); } catch {} }
            throw error;
          }
        }
        return adopt(response);
      });
    },
    async flush() { await queue; if (lastError) throw lastError; },
    disconnect() {
      return enqueue(async () => {
        // This disconnects Estate only; it does not revoke other Dorra sessions.
        clearAuth(); connected = false; snapshot = null; revision = 0; username = ''; lastError = null; status = 'local'; leaseId = randomId(); emit();
      });
    }
  });
}
