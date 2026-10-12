import {randomBytes, randomUUID, createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {AirportStore} from './store.mjs';
import {createCareer, settleCareer, applyCommand, projectCareer, renewPresence, MAX_CURRENCY, MAX_DIAMONDS} from './engine.mjs';

const DORRA_CAP = 9_000_000_000_000_000;
const UUID = /^[a-zA-Z0-9_-]{8,80}$/;
const PROFILE = /^[a-f0-9]{64}$/;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = (message, code = 'INVALID_COMMAND', status = 400) => { const error = new Error(message); error.code = code; error.status = status; throw error; };
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;

export async function createAirportService({directory, clock} = {}) {
  const store = new AirportStore(directory);
  try { await store.open(); } catch (error) { await store.close(); throw error; }
  let document;
  try { document = await store.read(); } catch (error) { await store.close(); throw error; }
  if (document && (document.version !== 1 || !PROFILE.test(document.ownerId) || !document.career || !Array.isArray(document.payouts))) {
    await store.close(); throw new Error('Unsupported airport career. Restore the matching save version; progress has not been reset.');
  }
  const startedAt = Math.max(Date.now(), document?.career.lastSettledAt || 0), monotonicStart = performance.now();
  const now = clock || (() => Math.floor(startedAt + performance.now() - monotonicStart));
  let queue = Promise.resolve();
  const serialized = fn => { const operation = queue.then(fn); queue = operation.catch(() => {}); return operation; };

  function checkBody(body, keys) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !keys.includes(key))) fail('Unsupported request fields.');
    if (!PROFILE.test(body.profileId || '')) fail('The local Dorra profile is unavailable.', 'PROFILE_REQUIRED', 401);
  }

  function owned(body) {
    if (!document) fail('Open your airport career first.', 'CAREER_REQUIRED', 409);
    if (document.ownerId !== body.profileId) fail('This airport belongs to another local Dorra profile. Reopen the original browser profile; airport progress has been preserved.', 'PROFILE_MISMATCH', 409);
    if (body.installationId && body.installationId !== document.installationId) fail('This Dorra profile is linked to a different airport installation.', 'INSTALLATION_MISMATCH', 409);
  }

  async function persist(next) {
    next.storageRevision = (document?.storageRevision || 0) + 1;
    await store.write(next);
    document = next;
  }

  function response(at, report = {}, replayed = false) {
    return {
      installationId: document.installationId,
      view: {...projectCareer(document.career, at), revision: document.career.revision, serverNow: at},
      earnings: report.earnings || [], elapsedMs: report.elapsedMs || 0, capped: !!report.capped,
      recovered: store.recovered, replayed
    };
  }

  function requestEntry(body, payload) {
    if (!UUID.test(body.requestId || '')) fail('A unique request identifier is required.');
    const digest = hash(payload), previous = document.requests[body.requestId];
    if (previous && previous.digest !== digest) fail('This request identifier was already used for a different action.', 'REQUEST_REUSED', 409);
    return {digest, previous};
  }

  function expectedRevision(value) {
    if (!integer(value, 0, Number.MAX_SAFE_INTEGER) || value !== document.career.revision) fail('Your airport changed. Refresh its latest state and try again.', 'STALE_REVISION', 409);
  }

  function settle(at) {
    const report = settleCareer(document.career, at);
    const next = structuredClone(document);
    next.career = report.career;
    next.career.revision = document.career.revision + 1;
    return {next, report};
  }

  const handle = (route, body) => serialized(async () => {
    // One queued request has one simulation time, including its earnings report
    // and any command, presence lease, or withdrawal receipt it creates.
    const at = now();
    const respond = (report = {}, replayed = false) => response(at, report, replayed);
    if (route === 'developer') {
      checkBody(body, ['profileId', 'installationId', 'accessCode', 'requestId', 'airportId', 'currency', 'amount']);
      const fingerprint = createHash('sha256').update(String(body.accessCode || '')).digest('hex');
      if (fingerprint !== '6478b528fdca7473baeae8136c9ae854936669dad4e476cacdf2e46e8a84fd34') fail('Unlock a developer session to change airport resources.', 'FORBIDDEN', 403);
      owned(body);
      if (body.currency === undefined) return respond();
      if (!['cash', 'diamonds', 'research'].includes(body.currency)) fail('Choose a supported airport resource.');
      const cap = body.currency === 'diamonds' ? MAX_DIAMONDS : MAX_CURRENCY;
      if (!integer(body.amount, 1, cap)) fail('Enter a positive whole amount within the resource limit.');
      if (!Object.hasOwn(document.career.airports, body.airportId || '')) fail('Choose an owned airport.');
      const {digest, previous} = requestEntry(body, {kind: route, airportId: body.airportId, currency: body.currency, amount: body.amount});
      if (previous) return respond({}, true);
      const {next, report} = settle(at);
      const target = body.currency === 'diamonds' ? next.career : next.career.airports[body.airportId];
      if (body.amount > cap - target[body.currency]) fail('That amount would exceed the resource balance limit.');
      target[body.currency] += body.amount;
      next.requests[body.requestId] = {digest, revision: next.career.revision};
      await persist(next);
      return respond(report);
    }
    if (route === 'bridge/status') {
      checkBody(body, ['profileId', 'installationId']);
      if (!document) return {active: false};
      owned(body);
      return {active: true, installationId: document.installationId, ackSequence: document.ackSequence, receipts: document.payouts.filter(receipt => receipt.sequence > document.ackSequence)};
    }
    if (route === 'load') {
      checkBody(body, ['profileId', 'installationId', 'presenceAirportId']);
      if (!document) {
        if (body.installationId) fail('The airport save is missing. Restore the original server save before continuing.', 'SAVE_MISSING', 409);
        const career = renewPresence(createCareer(at, randomBytes(4).readUInt32LE()), body.presenceAirportId ?? null, at);
        career.revision = 1;
        await persist({version: 1, installationId: randomUUID(), ownerId: body.profileId, career, payouts: [], ackSequence: 0, requests: {}});
        return respond();
      }
      owned(body);
      const {next, report} = settle(at);
      // Account for the old lease before extending it. Browser clocks never
      // determine how long an airport receives active-play income.
      next.career = renewPresence(next.career, body.presenceAirportId ?? null, at);
      await persist(next);
      return respond(report);
    }
    if (route === 'command') {
      checkBody(body, ['profileId', 'installationId', 'requestId', 'expectedRevision', 'command']);
      owned(body);
      const {digest, previous} = requestEntry(body, {kind: route, command: body.command});
      if (previous) return respond({}, true);
      expectedRevision(body.expectedRevision);
      const {next, report} = settle(at);
      next.career = applyCommand(next.career, body.command, at);
      next.career.revision = document.career.revision + 1;
      next.requests[body.requestId] = {digest, revision: next.career.revision};
      await persist(next);
      return respond(report);
    }
    if (route === 'withdraw') {
      checkBody(body, ['profileId', 'installationId', 'requestId', 'expectedRevision', 'airportId', 'amountCash', 'walletHeadroom']);
      owned(body);
      const {digest, previous} = requestEntry(body, {kind: route, airportId: body.airportId, amountCash: body.amountCash});
      if (previous) return {...respond({}, true), receipt: document.payouts.find(item => item.sequence === previous.sequence)};
      expectedRevision(body.expectedRevision);
      if (!integer(body.amountCash, 10, Number.MAX_SAFE_INTEGER) || body.amountCash % 10 !== 0) fail('Withdraw airport cash in whole multiples of 10.');
      const amountDorra = body.amountCash / 10;
      if (!integer(body.walletHeadroom, 0, DORRA_CAP) || amountDorra > body.walletHeadroom) fail('Your Dorra wallet does not have enough capacity for this withdrawal.', 'WALLET_FULL', 409);
      const {next, report} = settle(at), airport = next.career.airports[body.airportId];
      if (!airport || !Object.hasOwn(next.career.airports, body.airportId)) fail('This airport is not owned.');
      if (airport.cash < body.amountCash) fail('This airport does not have enough cash.', 'INSUFFICIENT_CASH', 409);
      airport.cash -= body.amountCash;
      const receipt = {sequence: next.payouts.length + 1, requestId: body.requestId, profileId: document.ownerId, installationId: document.installationId, airportId: body.airportId, amountCash: body.amountCash, amountDorra, at};
      next.payouts.push(receipt);
      next.requests[body.requestId] = {digest, revision: next.career.revision, sequence: receipt.sequence};
      await persist(next);
      return {...respond(report), receipt};
    }
    if (route === 'bridge/ack') {
      checkBody(body, ['profileId', 'installationId', 'sequence']);
      owned(body);
      if (!integer(body.sequence, document.ackSequence, document.payouts.length)) fail('Invalid payout acknowledgement.', 'INVALID_RECEIPT', 409);
      if (body.sequence > document.ackSequence) {
        const next = structuredClone(document); next.ackSequence = body.sequence; await persist(next);
      }
      return {ackSequence: document.ackSequence};
    }
    fail('Unknown airport operation.', 'NOT_FOUND', 404);
  });

  return {handle, close: async () => { await queue; await store.close(); }};
}
