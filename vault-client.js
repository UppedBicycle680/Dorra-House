import { supabase, requireAccount, signOut } from './auth-client.js';
import { API_URL, SUPABASE_PUBLISHABLE_KEY } from './online-config.js';
import {startPlayerPulse} from './player-notices.js';

// Local storage holds preferences and Auth tokens, never gameplay authority.
export const localGet = key => localStorage.getItem(key);
export const localSet = (key, value) => localStorage.setItem(key, value);
export const localRemove = key => localStorage.removeItem(key);

export async function createVaultClient(options = {}) {
  await requireAccount();
  const leaseId = crypto.randomUUID();
  let snapshot, revision = 0, closed = false, blocked = false, lastError = null, serverOffset = 0;
  let queue = Promise.resolve();
  const listeners = new Set();
  let refreshPending = null, refreshTimer;
  const notify = (status, error = null) => {
    document.documentElement.dataset.saveState = status;
    options.onStatus?.(status, error);
    window.dispatchEvent(new CustomEvent('dorra-save-status', {detail:{status,error}}));
  };
  function adopt(value) {
    if (!value?.snapshot || !Number.isSafeInteger(value.revision)) throw new Error('The cloud returned an incomplete save.');
    snapshot = structuredClone(value.snapshot); revision = value.revision;
    if (Number.isFinite(value.serverNow)) serverOffset = value.serverNow - Date.now();
    return value;
  }
  async function request(body, retry = true) {
    if (closed || blocked) throw new Error(blocked ? 'This gameplay session ended. Reload to continue on this device.' : 'Cloud save client closed.');
    const {data:{session}} = await supabase.auth.getSession();
    if (!session) { blocked = true; await requireAccount(); }
    let response;
    try {
      response = await fetch(API_URL, {method:'POST', headers:{'Content-Type':'application/json',apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`}, body:JSON.stringify(body), signal:AbortSignal.timeout(25000)});
    } catch (cause) {
      if (retry) return request(body, false);
      throw new Error('Could not reach your cloud save. Check your connection and try again.', {cause});
    }
    let value;
    try { value = await response.json(); } catch { throw new Error('The cloud service returned an unreadable response.'); }
    if (response.status === 401 && retry) {
      const {error} = await supabase.auth.refreshSession();
      if (!error) return request(body, false);
    }
    if (!response.ok) {
      const error = new Error(value.error || 'Your action could not be saved.'); error.code = value.code;
      if (['SESSION_REPLACED','AUTH_SESSION_ENDED','ACCOUNT_DISABLED'].includes(error.code)) {
        blocked = true; document.documentElement.dataset.sessionState = 'ended';
        window.dispatchEvent(new CustomEvent('dorra-session-ended', {detail:{error}}));
      }
      throw error;
    }
    return value;
  }
  notify('loading');
  try { adopt(await request({scope:'session',action:'acquire',leaseId})); notify('saved'); }
  catch (error) { notify('error', error); throw error; }
  const stopPulse=startPlayerPulse({leaseId,onEnded:error=>{blocked=true;notify('error',error);window.dispatchEvent(new CustomEvent('dorra-session-ended',{detail:{error}}));}});
  async function readLatest() {
    const previousRevision = revision;
    const value = await request({scope:'session',action:'refresh',args:{ifChanged:true},leaseId,requestId:crypto.randomUUID(),expectedRevision:revision});
    if (closed || blocked) return value;
    if (value.unchanged === true && value.revision === revision) {
      if (Number.isFinite(value.serverNow)) serverOffset = value.serverNow - Date.now();
      return value;
    }
    adopt(value);
    if (revision !== previousRevision) {
      for (const listener of listeners) {
        try { listener(structuredClone(snapshot)); } catch (error) { console.error('Cloud view refresh failed', error); }
      }
    }
    return value;
  }
  function refresh() {
    if (closed || blocked) return Promise.resolve();
    if (refreshPending) return refreshPending;
    const operation = queue.then(async () => {
      if (closed || blocked) return;
      try { const value = await readLatest(); if (!lastError) notify('saved'); return value; }
      catch (error) { notify('error',error); throw error; }
    });
    queue = operation.catch(() => {});
    refreshPending = operation.finally(() => { refreshPending = null; });
    return refreshPending;
  }
  const wake = () => { if (!document.hidden && navigator.onLine !== false) void refresh().catch(() => {}); };
  document.addEventListener('visibilitychange',wake);
  window.addEventListener('focus',wake);
  window.addEventListener('online',wake);
  refreshTimer = setInterval(wake,15000);
  function dispatch(scope, action, args = {}) {
    const input = structuredClone(args), requestId = input.requestId || crypto.randomUUID();
    notify('saving');
    const operation = queue.then(async () => {
      try {
        const body = () => ({scope,action,args:input,leaseId,requestId,expectedRevision:revision});
        let response;
        try { response = await request(body()); }
        catch (error) {
          if (error.code !== 'STALE_REVISION') throw error;
          await readLatest();
          // Re-display a view safely, but leave spending/game decisions to the
          // player after they have seen the updated balance and state.
          if ((scope === 'house' && action === 'view') || (scope === 'airport' && action === 'load')) response = await request(body());
          else throw Object.assign(new Error('Your save was updated. Your balance is now current; review your choice and try again.'),{code:'SAVE_UPDATED'});
        }
        const value = adopt(response);
        lastError = null; notify('saved'); return value;
      } catch (error) { lastError = error; notify('error', error); throw error; }
    });
    queue = operation.catch(() => {}); return operation;
  }
  const airport = (action, args = {}) => dispatch('airport', action, args).then(value => ({...value.result,snapshot:value.snapshot,revision:value.revision,payoutSequence:0}));
  const controls = document.querySelector('[data-online-account]');
  if (controls) {
    controls.hidden = false;
    controls.querySelector('[data-online-username]').textContent = snapshot.progress?.profile?.name || 'Your account';
    controls.querySelector('[data-online-signout]').onclick = async () => { try { await queue; await signOut(); } catch(error) { notify('error',error); } };
  }
  return Object.freeze({
    get snapshot() { return structuredClone(snapshot); },
    get serverNow() { return Date.now() + serverOffset; },
    integrityIssue:false,airportWarning:null,dispatch,refresh,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    commit:async () => { throw new Error('Browser save uploads are disabled. Use a server-approved gameplay action.'); },
    airportLoad:payload => airport('load',payload),airportCommand:payload => airport('command',payload),withdrawAirportCash:payload => airport('withdraw',payload),
    flush:async () => { await queue; if(lastError)throw lastError; },getRevision:() => revision,
    close() { closed = true; stopPulse(); clearInterval(refreshTimer); document.removeEventListener('visibilitychange',wake); window.removeEventListener('focus',wake); window.removeEventListener('online',wake); listeners.clear(); }
  });
}
export default createVaultClient;
