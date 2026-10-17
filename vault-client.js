import { supabase, requireAccount, signOut } from './auth-client.js';
import { API_URL, SUPABASE_PUBLISHABLE_KEY } from './online-config.js';
import {startPlayerPulse} from './player-notices.js';
import {applySnapshotChanges,snapshotChanges} from './snapshot-delta.mjs';

// Local storage holds preferences and Auth tokens, never gameplay authority.
export const localGet = key => localStorage.getItem(key);
export const localSet = (key, value) => localStorage.setItem(key, value);
export const localRemove = key => localStorage.removeItem(key);

export async function createVaultClient(options = {}) {
  const authSession = await requireAccount(), account = authSession.user;
  const leaseId = crypto.randomUUID();
  let snapshot, revision = 0, closed = false, blocked = false, lastError = null, serverOffset = 0;
  let queue = Promise.resolve();
  const listeners = new Set();
  let refreshPending = null, refreshTimer, refreshController, deferredRefresh = null;
  let pendingActions = 0, hintedRevision = 0, channel = null;
  const notify = (status, error = null) => {
    document.documentElement.dataset.saveState = status;
    options.onStatus?.(status, error);
    window.dispatchEvent(new CustomEvent('dorra-save-status', {detail:{status,error}}));
  };
  function adopt(value) {
    if (!Number.isSafeInteger(value?.revision)) throw new Error('The cloud returned an incomplete save.');
    if (value.revision < revision) return {...value,snapshot:structuredClone(snapshot),changedPaths:[]};
    let next = value.snapshot;
    if (value.delta) {
      if (value.delta.baseRevision !== revision || value.revision !== revision + 1) throw Object.assign(new Error('Cloud update needs a fresh snapshot.'),{code:'DELTA_BASE_MISMATCH'});
      next = applySnapshotChanges(snapshot,value.delta.changes);
    }
    if (!next) throw new Error('The cloud returned an incomplete save.');
    const changedPaths = value.delta ? value.delta.changes.map(change=>change.path) : snapshotChanges(snapshot,next).map(change=>change.path);
    snapshot = next; revision = value.revision;
    if (Number.isFinite(value.serverNow)) serverOffset = value.serverNow - Date.now();
    return {...value,snapshot:structuredClone(snapshot),changedPaths};
  }
  async function request(body, retry = true, signal = null) {
    if (closed || blocked) throw new Error(blocked ? 'This gameplay session ended. Reload to continue on this device.' : 'Cloud save client closed.');
    const {data:{session}} = await supabase.auth.getSession();
    if (!session) { blocked = true; await requireAccount(); }
    let response,value;
    try {
      const started = performance.now();
      response = await fetch(API_URL, {method:'POST', headers:{'Content-Type':'application/json',apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${session.access_token}`}, body:JSON.stringify(body), signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(10000)]) : AbortSignal.timeout(25000)});
      const raw = await response.text();
      window.dispatchEvent(new CustomEvent('dorra-performance',{detail:{scope:body.scope,action:body.action,networkMs:performance.now()-started,responseBytes:new TextEncoder().encode(raw).length,serverTiming:response.headers.get('server-timing')}}));
      try { value = JSON.parse(raw); } catch { throw new Error('The cloud service returned an unreadable response.'); }
    } catch (cause) {
      if (signal?.aborted) throw cause;
      if (retry) return request(body, false);
      throw new Error('Could not reach your cloud save. Check your connection and try again.', {cause});
    }
    if (response.status === 401 && retry) {
      const {error} = await supabase.auth.refreshSession();
      if (!error) return request(body, false,signal);
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
  let playerId = account?.id;
  try { const initial=await request({scope:'session',action:'acquire',leaseId});adopt(initial);playerId=initial.userId||playerId; notify('saved'); }
  catch (error) { notify('error', error); throw error; }
  const stopPulse=startPlayerPulse({leaseId,onEnded:error=>{blocked=true;notify('error',error);window.dispatchEvent(new CustomEvent('dorra-session-ended',{detail:{error}}));}});
  async function readLatest(signal = null) {
    const previousRevision = revision;
    const value = await request({scope:'session',action:'refresh',args:{ifChanged:true},leaseId,requestId:crypto.randomUUID(),expectedRevision:revision},!signal,signal);
    if (closed || blocked || signal?.aborted || (signal && pendingActions)) return value;
    if (value.unchanged === true && value.revision === revision) {
      if (Number.isFinite(value.serverNow)) serverOffset = value.serverNow - Date.now();
      return value;
    }
    const adopted = adopt(value);
    if (revision !== previousRevision) {
      for (const listener of listeners) {
        try { listener(structuredClone(snapshot),adopted.changedPaths); } catch (error) { console.error('Cloud view refresh failed', error); }
      }
    }
    return adopted;
  }
  function refresh() {
    if (closed || blocked) return Promise.resolve();
    if (pendingActions) {
      if (!deferredRefresh) deferredRefresh = (async()=>{while(pendingActions&&!closed&&!blocked)await queue;return refresh();})().finally(()=>{deferredRefresh=null;});
      return deferredRefresh;
    }
    if (refreshPending) return refreshPending;
    const controller = new AbortController();refreshController = controller;
    const operation = readLatest(controller.signal).then(value=>{if(!closed&&!blocked&&!controller.signal.aborted&&!pendingActions&&!lastError)notify('saved');return value;}).catch(error=>{if(controller.signal.aborted)return;if(!closed&&!pendingActions)notify('error',error);throw error;});
    refreshPending = operation.finally(() => { refreshPending = null; if(refreshController===controller)refreshController=null; });
    return refreshPending;
  }
  const wake = () => { if (!document.hidden && navigator.onLine !== false) void refresh().catch(() => {}); };
  document.addEventListener('visibilitychange',wake);
  window.addEventListener('focus',wake);
  window.addEventListener('online',wake);
  refreshTimer = setInterval(wake,15000);
  // Notifications are revision hints only. Even a forged hint can only request
  // an authenticated read; it can never install a balance or a game outcome.
  window.dispatchEvent(new CustomEvent('dorra-performance',{detail:{realtimeAvailable:Boolean(playerId)}}));
  if (options.realtime !== false && playerId) {
    await supabase.realtime.setAuth(authSession.access_token);
    channel = supabase.channel(`dorra-save:${playerId}`,{config:{private:true}})
      .on('broadcast',{event:'save-changed'},message=>{
        const next = message.payload?.revision;
        if (!Number.isSafeInteger(next) || next <= revision || next <= hintedRevision) return;
        window.dispatchEvent(new CustomEvent('dorra-performance',{detail:{realtimeHint:true}}));
        hintedRevision = next; wake();
      }).subscribe((status,error)=>{const reason=error?.message?.includes('permissions')?'permission-denied':error?.message?.includes('expired')?'token-expired':error?'connection-error':null;window.dispatchEvent(new CustomEvent('dorra-performance',{detail:{realtimeStatus:status,realtimeReason:reason}}));if(status==='SUBSCRIBED')wake();});
  }
  function dispatch(scope, action, args = {}) {
    const input = structuredClone(args), requestId = input.requestId || crypto.randomUUID();
    const queuedAt = performance.now();pendingActions++;refreshController?.abort();
    notify('saving');
    const operation = queue.then(async () => {
      try {
        window.dispatchEvent(new CustomEvent('dorra-performance',{detail:{scope,action,queueMs:performance.now()-queuedAt}}));
        const body = () => ({scope,action,args:input,leaseId,requestId,expectedRevision:revision,responseMode:'delta-v1'});
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
        let value;
        try { value = adopt(response); }
        catch(error) {
          if(error.code!=='DELTA_BASE_MISMATCH')throw error;
          // The action already committed: recover a full view, never resend it.
          await readLatest();value={...response,snapshot:structuredClone(snapshot),changedPaths:[[]]};
        }
        lastError = null; notify('saved'); return value;
      } catch (error) { lastError = error; notify('error', error); throw error; }
    }).finally(()=>{pendingActions--;if(!pendingActions&&hintedRevision>revision)wake();});
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
    getLeaseId:() => leaseId,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    commit:async () => { throw new Error('Browser save uploads are disabled. Use a server-approved gameplay action.'); },
    airportLoad:payload => airport('load',payload),airportCommand:payload => airport('command',payload),withdrawAirportCash:payload => airport('withdraw',payload),
    flush:async () => { await queue; if(lastError)throw lastError; },getRevision:() => revision,
    close() { closed = true; stopPulse(); refreshController?.abort(); if(channel)void supabase.removeChannel(channel); clearInterval(refreshTimer); document.removeEventListener('visibilitychange',wake); window.removeEventListener('focus',wake); window.removeEventListener('online',wake); listeners.clear(); }
  });
}
export default createVaultClient;
