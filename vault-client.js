// Shared page-side client for Dorra Vault v4. The worker remains the only
// component with signing authority; pages only receive authenticated snapshots.
const NativeWorker = Worker;
const nativeStorageGet = Storage.prototype.getItem;
const nativeStorageSet = Storage.prototype.setItem;
const nativeStorageRemove = Storage.prototype.removeItem;
const nativeRandomValues = crypto.getRandomValues.bind(crypto);

export const localGet = (key) => nativeStorageGet.call(localStorage, key);
export const localSet = (key, value) => nativeStorageSet.call(localStorage, key, value);
export const localRemove = (key) => nativeStorageRemove.call(localStorage, key);

function sessionToken() {
  return [...nativeRandomValues(new Uint8Array(32))]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export async function createVaultClient(options = {}) {
  const workerUrl = options.workerUrl || './save-worker.js?v=20260906-airports1';
  const token = sessionToken();
  const worker = new NativeWorker(workerUrl, { type: 'module' });
  const pending = new Map();
  let requestId = 0;
  let revision = 1;
  let closed = false;
  let writeQueue = Promise.resolve();
  let currentSnapshot = null, payoutSequence = 0, lastWriteError = null;

  const adopt = (result) => {
    if (!result?.mirror) return;
    const envelope = JSON.parse(result.mirror);
    currentSnapshot = JSON.parse(envelope.p);
    revision = result.revision || envelope.r;
    payoutSequence = currentSnapshot.airportBridge?.consumedSequence || 0;
    localSet('dorra-vault-mirror', result.mirror);
  };

  const notify = (status, error = null) => {
    document.documentElement.dataset.saveState = status;
    options.onStatus?.(status, error);
  };

  const rejectPending = (error) => {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };

  worker.onmessage = (event) => {
    const request = pending.get(event.data?.id);
    if (!request) return;
    pending.delete(event.data.id);
    adopt(event.data.ok ? event.data.result : event.data);
    if (event.data.ok) request.resolve(event.data.result);
    else { const error = new Error(event.data.error || 'Offline vault request failed'); error.code = event.data.code; request.reject(error); }
  };
  worker.onerror = (event) => rejectPending(new Error(event.message || 'Offline vault failed'));

  const request = (type, payload = {}) => new Promise((resolve, reject) => {
    if (closed) {
      reject(new Error('Offline vault client is closed'));
      return;
    }
    const id = ++requestId;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, type, token, payload });
  });

  let load;
  try {
    await request('initialize');
    load = await request('load', { mirror: localGet('dorra-vault-mirror') });
    revision = load.revision || 1;
    if (load.mirror) localSet('dorra-vault-mirror', load.mirror);
    for (const key of ['dorra-balance', 'dorra-history', 'dorra-stats', 'dorra-progress', 'dorra-reward-date']) {
      localRemove(key);
    }
    indexedDB.deleteDatabase('dorra-local-vault');
    notify('saved');
  } catch (error) {
    closed = true;
    worker.terminate();
    notify('error', error);
    throw error;
  }

  const commit = (snapshot, reason = 'game') => {
    const payload = structuredClone(snapshot);
    const expectedPayoutSequence = payoutSequence;
    notify('saving');
    const operation = writeQueue.then(async () => {
      const result = await request('commit', {
        snapshot: payload,
        reason: String(reason || 'game').slice(0, 32),
        expectedRevision: revision,
        expectedPayoutSequence
      });
      revision = result.revision;
      localSet('dorra-vault-mirror', result.mirror);
      notify('saved');
      lastWriteError = null;
      return result;
    });
    writeQueue = operation.catch((error) => {
      lastWriteError = error;
      notify('error', error);
    });
    return operation;
  };

  const airportOperation = (type, payload = {}) => {
    const input = structuredClone(payload);
    const operation = writeQueue.then(async () => {
      notify('saving');
      const result = await request(type, input);
      lastWriteError = null;
      notify('saved');
      return result;
    });
    writeQueue = operation.catch(error => { lastWriteError = error; notify('error', error); });
    return operation;
  };

  return Object.freeze({
    get snapshot() { return structuredClone(currentSnapshot || load.snapshot); },
    integrityIssue: Boolean(load.integrityIssue),
    airportWarning: load.airportWarning || null,
    commit,
    airportLoad: () => airportOperation('airport-load'),
    airportCommand: payload => airportOperation('airport-command', payload),
    withdrawAirportCash: payload => airportOperation('airport-withdraw', payload),
    flush: async () => { await writeQueue; if (lastWriteError) throw lastWriteError; },
    getRevision: () => revision,
    close() {
      if (closed) return;
      closed = true;
      worker.terminate();
      rejectPending(new Error('Offline vault client closed'));
    }
  });
}

export default createVaultClient;
