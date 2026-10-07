// Runs inside the vault worker. Page code never transports trusted payout amounts.
const nativeFetch = globalThis.fetch.bind(globalThis);
const randomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
const profilePattern = /^[a-f0-9]{64}$/;

export function createAirportBridge({getSnapshot, getRevision, install, appendLedger, maxBalance}) {
  const envelopeResult = envelope => ({snapshot:getSnapshot(), mirror:JSON.stringify(envelope), revision:getRevision()});
  async function ensureIdentity() {
    const snapshot = getSnapshot(), bridge = snapshot.airportBridge;
    if (bridge && profilePattern.test(bridge.profileId) && Number.isSafeInteger(bridge.consumedSequence) && bridge.consumedSequence >= 0) return;
    const profileId = [...randomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join('');
    await install({...snapshot, airportBridge:{profileId, installationId:null, consumedSequence:0}}, getRevision() + 1);
  }
  async function api(route, payload = {}) {
    const bridge = getSnapshot().airportBridge;
    let response;
    try {
      response = await nativeFetch(`/api/airport/${route}`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...payload, profileId:bridge.profileId, installationId:bridge.installationId}), signal:AbortSignal.timeout(20000)});
    } catch { throw new Error('The local airport server is unavailable. Reopen START DORRA GAME, then retry. An interrupted withdrawal will be recovered automatically.'); }
    let result;
    try { result = await response.json(); }
    catch { throw new Error('Restart START DORRA GAME to load the updated airport server.'); }
    if (!response.ok) { const error = new Error(result.error || 'Airport operation failed.'); error.code = result.code; throw error; }
    return result;
  }
  async function bind(installationId) {
    if (typeof installationId !== 'string' || installationId.length > 80) throw new Error('Invalid airport installation identity.');
    const snapshot = getSnapshot(), bridge = snapshot.airportBridge;
    if (bridge.installationId && bridge.installationId !== installationId) throw new Error('This Dorra wallet is linked to another airport installation.');
    if (!bridge.installationId) await install({...snapshot, airportBridge:{...bridge, installationId}}, getRevision() + 1);
  }
  async function reconcile() {
    await ensureIdentity();
    if (!getSnapshot().airportBridge.installationId) return;
    const status = await api('bridge/status');
    if (!status.active) throw new Error('The linked airport save is missing. Restore the original server save before withdrawing again.');
    const bridge = getSnapshot().airportBridge;
    if (status.installationId !== bridge.installationId || !Number.isSafeInteger(status.ackSequence) || !Array.isArray(status.receipts)) throw new Error('Airport receipt validation failed.');
    if (bridge.consumedSequence < status.ackSequence) throw new Error('This browser wallet is older than its airport payout record. Restore the original browser save; previous withdrawals have not been replayed.');
    for (const receipt of status.receipts) {
      const current = getSnapshot(), cursor = current.airportBridge.consumedSequence;
      if (!Number.isSafeInteger(receipt.sequence) || receipt.profileId !== bridge.profileId || receipt.installationId !== bridge.installationId || !Number.isSafeInteger(receipt.amountCash) || receipt.amountCash < 10 || receipt.amountCash % 10 || receipt.amountDorra !== receipt.amountCash / 10 || !Number.isSafeInteger(receipt.amountDorra)) throw new Error('Airport receipt validation failed.');
      if (receipt.sequence <= cursor) continue;
      if (receipt.sequence !== cursor + 1) throw new Error('An airport payout receipt is missing. Keep the original server save.');
      if (receipt.amountDorra > maxBalance - current.balance) throw new Error('An airport withdrawal is waiting for space in your Dorra wallet. Spend some Dorra, then reopen Airports to receive it.');
      const updated = appendLedger(current, {...current, balance:current.balance + receipt.amountDorra, airportBridge:{...current.airportBridge, consumedSequence:receipt.sequence}}, 'airport-withdrawal');
      await install(updated, getRevision() + 1);
    }
    const consumedSequence = getSnapshot().airportBridge.consumedSequence;
    if (consumedSequence > status.ackSequence) await api('bridge/ack', {sequence:consumedSequence});
  }
  function result(extra = {}) {
    return {...extra, snapshot:getSnapshot(), revision:getRevision(), payoutSequence:getSnapshot().airportBridge.consumedSequence};
  }
  async function load() {
    await ensureIdentity();
    await reconcile();
    const response = await api('load');
    await bind(response.installationId);
    return result(response);
  }
  async function command(payload) {
    await ensureIdentity();
    const response = await api('command', {requestId:payload.requestId, expectedRevision:payload.expectedRevision, command:payload.command});
    return result(response);
  }
  async function withdraw(payload) {
    await ensureIdentity();
    await reconcile();
    const response = await api('withdraw', {requestId:payload.requestId, airportId:payload.airportId, amountCash:payload.amountCash, expectedRevision:payload.expectedAirportRevision, walletHeadroom:maxBalance - getSnapshot().balance});
    await bind(response.installationId);
    await reconcile();
    return result(response);
  }
  async function developer(payload) {
    await ensureIdentity();
    const response = await api('developer', payload);
    await bind(response.installationId);
    return result(response);
  }
  return {ensureIdentity, reconcile, load, command, withdraw, developer, envelopeResult};
}
