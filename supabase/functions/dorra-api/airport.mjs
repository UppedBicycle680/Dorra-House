import {createCareer, settleCareer, applyCommand, projectCareer, MAX_CURRENCY} from './shared/airport/engine.mjs';
import {MAX_BALANCE} from './shared/game-limits.js';

const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const integer = (value, min, max = Number.MAX_SAFE_INTEGER) => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;

function fail(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  throw error;
}

function checkArgs(args, fields) {
  if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).some(key => !fields.includes(key))) {
    fail('INVALID_ARGUMENTS', 'Airport actions cannot supply saved state, balances, outcomes or timestamps.');
  }
  if (has(args, 'requestId') && (typeof args.requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(args.requestId))) {
    fail('INVALID_REQUEST', 'Choose a valid request identifier.');
  }
}

function checkRevision(value, career) {
  if (!integer(value, 1) || value !== career.revision) {
    fail('STALE_REVISION', 'Your airport changed. Refresh its latest state and try again.', 409);
  }
}

function response(career, report, now, receipt = undefined) {
  return {
    view: {...projectCareer(career, now, {compact: true}), serverNow: now},
    earnings: report.earnings,
    elapsedMs: report.elapsedMs,
    creditedMs: report.creditedMs,
    capped: report.capped,
    recovered: false,
    replayed: false,
    ...(receipt ? {receipt} : {})
  };
}

/** Runs only in the authenticated API. The database commits both returned objects
 * together under its account revision lock; the browser receives only the view.
 * Request replay protection is owned by that same transaction layer. */
export async function reduceAirport(snapshot, privateState, action, args = {}, now) {
  if (!integer(now, 0)) fail('INVALID_TIME', 'A valid server timestamp is required.');
  if (!['load', 'command', 'withdraw'].includes(action)) {
    fail('UNKNOWN_ACTION', 'That airport action is not available.', 403);
  }
  checkArgs(args, action === 'load' ? [] : action === 'command'
    ? ['requestId', 'expectedRevision', 'command']
    : ['requestId', 'expectedAirportRevision', 'airportId', 'amountCash']);

  let existing = privateState.airport;
  if (!existing) {
    if (action !== 'load') fail('CAREER_REQUIRED', 'Open your airport career first.', 409);
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    existing = createCareer(now, seed);
  } else if (action !== 'load') {
    checkRevision(action === 'command' ? args.expectedRevision : args.expectedAirportRevision, existing);
  }

  const report = settleCareer(existing, now);
  let career = report.career;
  let nextSnapshot = snapshot;
  let receipt;
  if (action === 'command') {
    // The pure engine independently rejects every command field outside its
    // whitelist and calculates costs, eligibility, timers and rewards itself.
    career = applyCommand(career, args.command, now);
  } else if (action === 'withdraw') {
    if (!integer(args.amountCash, 10, MAX_CURRENCY) || args.amountCash % 10) {
      fail('INVALID_AMOUNT', 'Withdraw airport cash in whole multiples of 10.');
    }
    if (typeof args.airportId !== 'string' || !has(career.airports, args.airportId)) {
      fail('AIRPORT_NOT_OWNED', 'Choose an airport you own.');
    }
    const airport = career.airports[args.airportId];
    if (airport.cash < args.amountCash) fail('INSUFFICIENT_CASH', 'This airport does not have enough cash.', 409);
    const amountDorra = args.amountCash / 10;
    if (typeof snapshot.balance !== 'number' || !Number.isFinite(snapshot.balance) || snapshot.balance < 0 || amountDorra > MAX_BALANCE - snapshot.balance) {
      fail('WALLET_FULL', 'Your Dorra wallet does not have enough capacity for this withdrawal.', 409);
    }
    airport.cash -= args.amountCash;
    receipt = {airportId: args.airportId, amountCash: args.amountCash, amountDorra, at: now};
    nextSnapshot = {...snapshot, balance: snapshot.balance + amountDorra};
  }
  career.revision = existing.revision + ((action !== 'load' || report.elapsedMs > 0) ? 1 : 0);
  const nextPrivateState = {...privateState, airport: career};
  return {snapshot: nextSnapshot, privateState: nextPrivateState, result: response(career, report, now, receipt)};
}
