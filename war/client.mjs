import { supabase, requireAccount } from '../auth-client.js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../online-config.js';
import { applyWarDelta } from './projection.mjs';

const ENDPOINT = `${SUPABASE_URL}/functions/v1/dorra-war`;
const ENDED = new Set(['SESSION_REPLACED', 'AUTH_SESSION_ENDED', 'ACCOUNT_DISABLED', 'LEASE_EXPIRED', 'UNAUTHORIZED']);

// Only authenticated server responses install resources, visibility or outcomes.
export function createWarClient({ vault, onStatus = () => {}, onHint = () => {} }) {
  let closed = false, blocked = false, channel = null, queue = Promise.resolve(), offset = 0, realtimeReady = false, lastSync = 0;
  const controllers = new Set();
  const projections = new Map();
  const ended = event => { blocked = true; onStatus('ended', event.detail?.error || new Error('Your gameplay session ended. Reload to sign in again.')); };
  window.addEventListener('dorra-session-ended', ended);
  async function request(body, attempt = 0) {
    if (closed || blocked) throw new Error(blocked ? 'Your gameplay session ended. Reload to continue.' : 'Command connection closed.');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { await requireAccount(); throw new Error('Sign in to continue.'); }
    const controller = new AbortController(); controllers.add(controller);
    const timeout = setTimeout(() => controller.abort(), 20000);
    let response, value;
    try {
      response = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({protocolVersion:1,...body}), signal: controller.signal });
      value = await response.json();
    } catch (cause) {
      if (closed) throw cause;
      // Reuse the ID after a lost response, including purchases and orders.
      if (attempt === 0 && navigator.onLine !== false) return request(body, 1);
      const error = new Error('Command uplink interrupted. Your world continues on the server. Reconnect to receive its latest state.', { cause });
      onStatus('offline', error); throw error;
    } finally { clearTimeout(timeout); controllers.delete(controller); }
    if (response.status === 401 && attempt === 0) {
      const { error } = await supabase.auth.refreshSession();
      if (!error) return request(body, 1);
    }
    if (!response.ok || value.error) {
      const error = Object.assign(new Error(value.error || 'Command could not be accepted.'), { code: value.code, status: response.status });
      if (ENDED.has(error.code)) { blocked = true; window.dispatchEvent(new CustomEvent('dorra-session-ended', { detail: { error } })); }
      else if (response.status >= 500) onStatus('offline', error);
      throw error;
    }
    const serverNow = typeof value.serverNow === 'number' ? value.serverNow : Date.parse(value.serverNow);
    if (Number.isFinite(serverNow)) offset = serverNow - Date.now();
    if (value.delta) {
      const previous = projections.get(value.delta.matchId);
      try { value.view = applyWarDelta(previous, value.delta); }
      catch {
        // The original command already committed. Recover with a fresh read.
        const recovered = await request({action:'view',args:{},leaseId:body.leaseId,matchId:body.matchId,requestId:crypto.randomUUID()},1);
        value.view = recovered.view;
      }
      delete value.delta;
    }
    if (value.view?.match?.id) {
      const previous = projections.get(value.view.match.id);
      if (previous && previous.match.revision > value.view.match.revision) value.view = structuredClone(previous);
      else projections.set(value.view.match.id,structuredClone(value.view));
    }
    lastSync = Date.now(); onStatus('connected'); return value;
  }
  function command(action, args = {}, matchId = null) {
    const leaseId = vault.getLeaseId?.();
    if (!leaseId) return Promise.reject(new Error('The protected gameplay session is unavailable. Reload to reconnect.'));
    const input=structuredClone(args);if(action==='view')delete input.revision;
    const body = { action, args: input, leaseId, requestId: crypto.randomUUID(), ...(matchId ? { matchId,baseRevision:projections.get(matchId)?.match.revision ?? null } : {}) };
    if (action === 'list' || action === 'view') return request(body);
    const operation = queue.then(() => request(body)); queue = operation.catch(() => {}); return operation;
  }
  async function connect() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || closed) return;
    await supabase.realtime.setAuth(session.access_token);
    channel = supabase.channel(`dorra-war:${session.user.id}`, { config: { private: true } })
      .on('broadcast', { event: 'war-changed' }, message => {
        const hint = message.payload;
        if (typeof hint?.matchId === 'string' && Number.isSafeInteger(hint.revision)) onHint(hint);
      }).subscribe(status => { realtimeReady = status === 'SUBSCRIBED'; if (realtimeReady) onHint({ reconnect: true }); });
  }
  return { command, connect, get serverNow() { return Date.now() + offset; }, get blocked() { return blocked; }, get realtimeConnected() { return realtimeReady; }, get lastSync() { return lastSync; }, close() { closed = true; realtimeReady = false; for (const controller of controllers) controller.abort(); if (channel) void supabase.removeChannel(channel); window.removeEventListener('dorra-session-ended', ended); } };
}
