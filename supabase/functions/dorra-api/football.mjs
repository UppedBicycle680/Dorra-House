import * as Engine from './shared/football/football-engine.js';
import { MAX_BALANCE, MAX_PROTECTED_PROGRESS_BYTES } from './shared/game-limits.js';

// Only manager decisions are accepted. Results, balances, clocks, replacement
// saves and engine maintenance/debug methods never cross this boundary.
const ACTIONS = Object.freeze({
  setCaptaincy: [1, 2], createMentoringGroup: [1, 1], removeMentoringGroup: [1, 1],
  createPlayerPromise: [2, 2], resolvePlayerPromise: [1, 3], setPlayerRehabilitation: [1, 2],
  startContractNegotiation: [1, 1], submitContractOffer: [2, 2], withdrawContractNegotiation: [1, 1],
  hireNamedStaff: [1, 2], dismissNamedStaff: [1, 2], renewNamedStaff: [1, 2],
  setDelegation: [1, 2], respondToSponsorOffer: [1, 2], setCommercialPlan: [1, 1],
  markInboxRead: [1, 2], resolveInboxDecision: [2, 2], createScoutingAssignment: [1, 1],
  cancelScoutingAssignment: [1, 1], createOpponentReport: [1, 1], renewPlayerContract: [2, 2],
  setPlayerDevelopmentFocus: [1, 2], promoteAcademyPlayer: [1, 2], releasePlayer: [1, 2],
  setPlayerTransferStatus: [1, 2], recallPlayerLoan: [1, 1], respondToTransferOffer: [1, 2],
  shortlistScoutedPlayer: [1, 2], approachScoutedPlayer: [1, 1], setBoardExpectations: [1, 1],
  setClubIdentity: [1, 1], registerRivalry: [1, 1], setMatchdayPlan: [1, 1],
  registerPlayerForCompetition: [1, 1], unregisterPlayerFromCompetition: [1, 1],
  enterCup: [0, 1], simulateCupMatch: [0, 0], scheduleFriendly: [1, 1],
  cancelFriendly: [1, 1], simulateFriendlyMatch: [1, 1],
  setLineup: [2, 2], setPlayingStyle: [2, 2], makeSubstitution: [3, 3],
  assessAcademy: [0, 0], fundFemaleProgramme: [0, 0], purchaseDualRating: [0, 0],
  requestBTeam: [0, 0], submitALeagueBid: [0, 0], settleSeason: [0, 0],
  setTrainingSchedule: [2, 2], setWeeklyFirstTeamBudget: [1, 1], setAcademyFee: [1, 1],
  setManagerSettings: [1, 1], startConstruction: [1, 1], skipConstruction: [1, 1],
  cancelConstruction: [1, 1], claimFootballObjective: [1, 1], hireStaff: [1, 1],
  setManagerRole: [1, 1], refreshRecruitmentMarket: [0, 0], signTrialist: [1, 1],
  signSeniorPlayer: [1, 1], repayStartupLoan: [1, 1], investOwnerFunds: [1, 1],
  withdrawOwnerFunds: [1, 1], reconcileConstruction: [0, 0], advanceWeek: [0, 0],
  simulateMatch: [1, 1], previewMatchHalf: [1, 1], startClub: [1, 1],
  resetFootballProgress: [0, 0], declareBankruptcy: [0, 0]
});

function fail(message, code = 'INVALID_FOOTBALL_ACTION', status = 400) {
  const error = new Error(message); error.code = code; error.status = status; throw error;
}
function object(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))) fail('Unsupported football decision fields.');
  return structuredClone(value);
}
function wholeMoney(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_BALANCE) fail('Enter a whole-dollar amount within the supported limit.');
  return value;
}
function range(value, min, max, label) {
  if (!Number.isFinite(value) || value < min || value > max) fail(`${label} must be between ${min} and ${max}.`);
  return value;
}
function matchOptions(value, fields) {
  const options = object(value, fields);
  if (options.squad !== undefined && !['first', 'u23', 'academy', 'b'].includes(options.squad)) fail('Choose an available football squad.');
  if (options.half !== undefined && ![1, 2].includes(options.half)) fail('Choose the first or second half.');
  if (options.visual !== undefined && typeof options.visual !== 'boolean') fail('Choose a valid match playback mode.');
  if (options.halftime) options.halftime = object(options.halftime, ['styleId', 'formation', 'outId', 'inId']);
  return options;
}
function checked(result) {
  if (!result || result.ok === false || result.event?.ok === false) fail(result?.message || result?.event?.message || 'The club rejected that decision.', result?.code || result?.event?.code || 'FOOTBALL_ACTION_REJECTED', 409);
  return result;
}

// String seeds are server secrets. Numeric tournament seeds are rankings and
// remain part of the public match history.
function publicValue(value, seeds = null, path = []) {
  if (Array.isArray(value)) return value.map((item, index) => publicValue(item, seeds, [...path, index]));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === 'seed' && typeof item === 'string') {
      if (seeds) seeds[JSON.stringify([...path, key])] = item;
    } else out[key] = publicValue(item, seeds, [...path, key]);
  }
  return out;
}
function trustedState(saved, secret) {
  const state = structuredClone(saved);
  for (const [encodedPath, seed] of Object.entries(secret.seeds || {})) {
    const path = JSON.parse(encodedPath); let target = state;
    for (const key of path.slice(0, -1)) {
      if (!target?.[key] || typeof target[key] !== 'object') { target = null; break; }
      target = target[key];
    }
    if (target) target[path.at(-1)] = seed;
  }
  state.seed = secret.seed;
  return Engine.normalizeFootballState(state);
}
async function fingerprint(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function requireOpponent(state, opponentId) {
  const opponent = state.careerWorld.aiClubs.find(club => club.id === String(opponentId));
  if (!opponent) fail('Choose a club from the current football world.');
  return opponent;
}
function promiseEvidence(state, secret, freeze = false) {
  for (const promise of state.careerWorld.squadDynamics.promises) {
    const goal = secret.promiseGoals?.[promise.id];
    if (!goal) continue;
    if (promise.status !== 'active') { promise.type = goal.type; continue; }
    const player = state.careerWorld.players.find(item => item.id === promise.playerId);
    let met = false;
    if (player) {
      if (goal.type === 'playing-time') met = player.seasonStats.appearances >= promise.target;
      if (goal.type === 'development') met = player.development >= promise.target;
      if (goal.type === 'captaincy') met = state.careerWorld.squadDynamics.captainId === player.id;
      if (goal.type === 'new-contract') met = goal.verified === true;
      if (goal.type === 'squad-role') {
        met = player.contract.squadRole !== goal.role;
        if (met) promise.targetRole = player.contract.squadRole;
      }
      if (goal.type === 'transfer') met = player.transferStatus !== 'not-listed' && player.transferStatus !== goal.transferStatus;
      if (goal.type === 'silverware') met = state.metrics.trophies > goal.trophies;
    }
    promise.progress = met ? promise.target : 0;
    // The offline engine counts an existing current-season contract or captain
    // as a kept promise. Online commitments must be achieved after creation.
    promise.type = freeze && !met ? 'other' : goal.type;
  }
}
function recordPromiseGoal(state, secret, result) {
  const promise = result.promise, goal = secret.pendingPromise;
  if (!promise || !goal) return;
  secret.promiseGoals ||= {};
  secret.promiseGoals[promise.id] = goal;
  delete secret.pendingPromise;
  const current = new Set(state.careerWorld.squadDynamics.promises.filter(item => item.status === 'active').map(item => item.id));
  for (const key of Object.keys(secret.promiseGoals)) if (!current.has(key)) delete secret.promiseGoals[key];
}
function secureArgs(action, args, state, secret, now) {
  if (action === 'startConstruction') return [args[0], { nowMs: now }];
  if (action === 'skipConstruction') return [args[0], now];
  if (action === 'reconcileConstruction') return [now];
  if (action === 'advanceWeek' || action === 'settleSeason') return [{ nowMs: now }];
  if (action === 'enterCup') { if (args[0]) object(args[0], []); return [{}]; }
  if (action === 'setMatchdayPlan') {
    const ranges = { ticketPrice: [5, 80], hospitalityPrice: [25, 350], concessionSpend: [0, 50], staffing: [1, 5], security: [1, 5], pitchPrep: [1, 5], transportSubsidy: [0, 5000], promotionSpend: [0, 10000] };
    const plan = object(args[0], Object.keys(ranges));
    for (const [key, bounds] of Object.entries(ranges)) if (plan[key] !== undefined) range(plan[key], ...bounds, key);
    return [plan];
  }
  if (action === 'setCommercialPlan') {
    const plan = object(args[0], ['merchandise', 'community', 'digital', 'tickets']);
    for (const key of ['merchandise', 'community', 'digital']) {
      if (plan[key]) {
        plan[key] = object(plan[key], ['strategy', 'weeklyBudgetAud']);
        if (plan[key].weeklyBudgetAud !== undefined) wholeMoney(plan[key].weeklyBudgetAud);
      }
    }
    if (plan.tickets) plan.tickets = object(plan.tickets, ['strategy', 'familyDiscountPercent']);
    return [plan];
  }
  if (action === 'submitContractOffer') return [args[0], object(args[1], ['weeklyWage', 'seasons', 'squadRole', 'signingBonus', 'releaseClause', 'appearanceBonus'])];
  if (action === 'hireNamedStaff' || action === 'renewNamedStaff') {
    if (args[1]) object(args[1], ['weeklyWageAud', 'durationWeeks']);
    const people = state.footballOperations.people;
    const person = (action === 'hireNamedStaff' ? people.candidates : people.staff).find(item => item.id === String(args[0]));
    if (!person) fail('That staff appointment is no longer available.');
    const weeklyWageAud = action === 'hireNamedStaff' ? person.weeklyWageAud : Math.ceil(person.weeklyWageAud * 1.15 / 25) * 25;
    return [person.id, { weeklyWageAud, durationWeeks: 80 }];
  }
  if (action === 'dismissNamedStaff') { if (args[1]) object(args[1], ['reason']); return [args[0], { reason: 'Club restructuring' }]; }
  if (action === 'createScoutingAssignment') {
    const details = object(args[0], ['type', 'targetName', 'region', 'focus', 'durationWeeks']);
    if (details.type !== 'region') fail('Choose a regional scouting assignment.');
    return [details];
  }
  if (action === 'createMentoringGroup') return [object(args[0], ['mentorId', 'menteeIds', 'focus'])];
  if (action === 'createPlayerPromise') {
    const details = object(args[1], ['type', 'detail', 'targetWeeks', 'source']);
    const player = state.careerWorld.players.find(item => item.id === String(args[0]));
    if (!player) fail('Choose a contracted first-team player.');
    const type = details.type || 'other', key = `${state.season}:${state.week}:${player.id}:${type}`;
    if (!['playing-time', 'squad-role', 'development', 'new-contract', 'transfer', 'captaincy', 'silverware', 'other'].includes(type)) fail('Choose a supported player commitment.');
    if (secret.promiseWeeks?.includes(key) || state.careerWorld.squadDynamics.promises.some(item => item.playerId === player.id && (secret.promiseGoals?.[item.id]?.type || item.type) === type && item.status === 'active')) fail('This player already has that commitment for this week.', 'PROMISE_ALREADY_CREATED', 409);
    if (type === 'captaincy' && state.careerWorld.squadDynamics.captainId === player.id) fail('That player already leads the club. Choose a new commitment.');
    if (type === 'transfer' && player.transferStatus !== 'not-listed') fail('That player is already available for transfer. Choose a new commitment.');
    secret.promiseWeeks = [...(secret.promiseWeeks || []).filter(entry => entry.startsWith(`${state.season}:${state.week}:`)), key];
    secret.pendingPromise = { type, role: player.contract.squadRole, transferStatus: player.transferStatus, trophies: state.metrics.trophies };
    const target = type === 'playing-time' ? player.seasonStats.appearances + 1 : type === 'development' ? player.development + 1 : 1;
    return [player.id, { ...details, source: 'manager', target }];
  }
  if (action === 'resolvePlayerPromise') {
    const promise = state.careerWorld.squadDynamics.promises.find(item => item.id === String(args[0]) && item.status === 'active'), outcome = args[1] || 'fulfilled';
    if (!promise || !['fulfilled', 'broken', 'cancelled'].includes(outcome)) fail('Choose an active commitment and a valid outcome.');
    if (outcome === 'fulfilled' && (promise.progress < promise.target || !secret.promiseGoals?.[promise.id])) fail('The server has not recorded the promised target yet. Complete the commitment before marking it kept.', 'PROMISE_TARGET_UNMET', 409);
    return [promise.id, outcome, 'Verified manager decision'];
  }
  if (action === 'setClubIdentity') return [object(args[0], ['nickname', 'motto', 'values'])];
  if (action === 'setBoardExpectations') {
    if (!Array.isArray(args[0]) || args[0].length !== state.careerWorld.board.expectations.length) fail('The board plan changed. Reload before changing its targets.');
    return [state.careerWorld.board.expectations.map((expectation, index) => ({ ...expectation, target: Number(args[0][index]?.target) }))];
  }
  if (action === 'createOpponentReport') {
    const details = object(args[0], ['id', 'clubId']);
    const opponent = requireOpponent(state, details.clubId || details.id);
    return [{ ...opponent, clubId: opponent.id, scoutQuality: Math.min(100, 45 + (state.staff.recruitment || 0) * 10) }];
  }
  if (action === 'scheduleFriendly') {
    const details = object(args[0], ['opponentId', 'opponentName', 'season', 'week', 'venue']);
    const opponent = requireOpponent(state, details.opponentId);
    return [{ opponentId: opponent.id, opponentName: opponent.name, season: state.season, week: details.week, venue: details.venue }];
  }
  if (action === 'registerRivalry') {
    const details = object(args[0], ['clubId', 'clubName', 'type', 'intensity', 'story']);
    const opponent = requireOpponent(state, details.clubId), type = details.type === 'local-derby' ? 'local-derby' : 'rivalry';
    return [{ clubId: opponent.id, clubName: opponent.name, type, intensity: type === 'local-derby' ? 65 : 50, story: `${state.club.shortName || state.club.name} and ${opponent.name} are building a rivalry through Queensland football.` }];
  }
  if (action === 'renewPlayerContract') {
    const terms = object(args[1], ['weeklyWage', 'seasons', 'squadRole']);
    const player = state.squads.first.players.find(player => player.id === String(args[0]));
    if (!player || !Number.isSafeInteger(terms.weeklyWage) || terms.weeklyWage < player.weeklyWage) fail('A direct renewal must retain at least the player’s current weekly wage. Use contract talks to negotiate terms.');
    const key = `${state.season}:${state.week}:${player.id}`;
    if (secret.renewals?.includes(key)) fail('This player already renewed their contract this week.', 'CONTRACT_ALREADY_RENEWED', 409);
    secret.renewals = [...(secret.renewals || []).filter(entry => entry.startsWith(`${state.season}:${state.week}:`)), key];
    return [player.id, terms];
  }
  if (action === 'signTrialist' || action === 'signSeniorPlayer') {
    if (Object.values(state.squads).some(squad => squad?.players.some(player => player.id === String(args[0])))) fail('That player already belongs to the club.');
  }
  return args;
}

export async function reduceFootball(inputSnapshot, inputPrivateState, action, envelope = {}, now = Date.now()) {
  const bounds = Object.hasOwn(ACTIONS, action) ? ACTIONS[action] : null;
  if (!bounds) fail('That football command is not available online.', 'UNKNOWN_FOOTBALL_ACTION');
  const request = object(envelope, ['args']), args = request.args || [];
  if (!Array.isArray(args) || args.length < bounds[0] || args.length > bounds[1]) fail('Invalid football decision arguments.');
  if (!Number.isSafeInteger(now) || now < 1) fail('The server clock is unavailable.');
  const snapshot = structuredClone(inputSnapshot), privateState = structuredClone(inputPrivateState || {});
  snapshot.progress ||= {};
  const saved = snapshot.progress.footballManager;
  let secret = privateState.football;
  if (!secret) secret = privateState.football = { seed: crypto.randomUUID(), seeds: {} };
  if (!secret.seed) secret.seed = crypto.randomUUID();
  if (saved && secret.visualMatch && !['previewMatchHalf', 'simulateMatch'].includes(action)) fail('Finish the current visual match before changing the club. Open its fixture to resume.', 'VISUAL_MATCH_PENDING', 409);
  if (saved && !secret.visualMatch) {
    // Public player IDs expose the old engine's 32-bit hash state. A new
    // cryptographic execution seed keeps the next command unpredictable.
    secret.seed = crypto.randomUUID(); secret.seeds = {};
  }
  let state = saved ? trustedState(saved, secret) : null;
  if (state) promiseEvidence(state, secret, true);
  let result;

  if (action === 'startClub') {
    if (saved) fail('Reset the existing football club before creating another.', 'CLUB_ALREADY_EXISTS', 409);
    const details = object(args[0], ['name', 'shortName', 'colours', 'crest', 'siteId', 'ownerInvestmentAud', 'startupLoanAud', 'academyFeeAud', 'weeklyFirstTeamBudget', 'playingStyle']);
    const investment = wholeMoney(details.ownerInvestmentAud);
    if (investment > snapshot.balance) fail('Your Dorra wallet cannot fund that investment.', 'INSUFFICIENT_BALANCE', 409);
    secret = privateState.football = { seed: crypto.randomUUID(), seeds: {} };
    result = checked(Engine.startClub({ ...details, seed: secret.seed, nowMs: Date.UTC(2026, 1, 2, 2) }));
    state = result.state;
    snapshot.balance -= investment;
  } else {
    if (!state) fail('Create a football club first.', 'CLUB_REQUIRED', 409);
    if (action === 'resetFootballProgress' || action === 'declareBankruptcy') {
      if (action === 'declareBankruptcy') checked(Engine.declareBankruptcy(state));
      delete snapshot.progress.footballManager; delete privateState.football;
      return { snapshot, privateState, result: { ok: true, state: null, message: action === 'declareBankruptcy' ? 'The bankrupt club was closed.' : 'Football progress reset.' } };
    }
    if (action === 'previewMatchHalf') {
      const options = matchOptions(args[0], ['squad', 'half', 'halftime']);
      const squad = options.squad || 'first', half = Number(options.half) === 2 ? 2 : 1;
      const sourceHash = await fingerprint(saved);
      if (half === 1 && secret.visualMatch) {
        if (secret.visualMatch.squad !== squad || secret.visualMatch.sourceHash !== sourceHash) fail('Finish the current visual match before starting another fixture.', 'VISUAL_MATCH_PENDING', 409);
        return { snapshot, privateState, result: { ok: true, fixture: Engine.getCurrentFixture(state, squad), result: structuredClone(secret.visualMatch.firstHalf), halftime: secret.visualMatch.halftime || null } };
      }
      if (half === 2 && (!secret.visualMatch || secret.visualMatch.squad !== squad || secret.visualMatch.sourceHash !== sourceHash)) fail('The club changed during the visual match. Restart the match.', 'MATCH_CHANGED', 409);
      if (half === 2 && secret.visualMatch.secondHalf) {
        if (JSON.stringify(options.halftime || {}) !== JSON.stringify(secret.visualMatch.halftime)) fail('Halftime decisions are already committed for this match.', 'HALFTIME_ALREADY_COMMITTED', 409);
        return { snapshot, privateState, result: { ok: true, fixture: Engine.getCurrentFixture(state, squad), result: structuredClone(secret.visualMatch.secondHalf) } };
      }
      if (half === 2) {
        secret.seed = crypto.randomUUID(); secret.seeds = {};
        state = trustedState(saved, secret);
        promiseEvidence(state, secret, true);
      }
      result = checked(Engine.previewMatchHalf(state, { squad, half, halftime: options.halftime }));
      if (half === 1) secret.visualMatch = { squad, fixtureId: result.fixture.id, sourceHash, firstHalf: structuredClone(result.result) };
      if (half === 2) { secret.visualMatch.secondHalf = structuredClone(result.result); secret.visualMatch.halftime = options.halftime || {}; }
      return { snapshot, privateState, result: publicValue(result) };
    }
    let validated = secureArgs(action, args, state, secret, now);
    if (action === 'simulateMatch') {
      const options = matchOptions(args[0], ['squad', 'visual', 'halftime']);
      const squad = options.squad || 'first';
      if (options.visual || secret.visualMatch) {
        const match = secret.visualMatch;
        if (!match || match.squad !== squad || match.sourceHash !== await fingerprint(saved)) fail('The visual match changed. Restart it before finishing.', 'MATCH_CHANGED', 409);
        if (match.secondHalf && JSON.stringify(options.halftime || {}) !== JSON.stringify(match.halftime)) fail('Use the halftime decisions already committed for this match.', 'HALFTIME_ALREADY_COMMITTED', 409);
        if (!match.secondHalf) {
          secret.seed = crypto.randomUUID(); secret.seeds = {};
          state = trustedState(saved, secret);
          promiseEvidence(state, secret, true);
        }
        validated = [{ squad, firstHalf: match.firstHalf, halftime: match.halftime || options.halftime || {} }];
      } else {
        if (options.halftime) fail('Halftime decisions require a server-started visual match.');
        validated = [{ squad }];
      }
    }
    if (action === 'refreshRecruitmentMarket') {
      // Markets refresh when advanceWeek runs. Recreating a current market
      // would restore prospects the player has already signed this week.
      result = { ok: true, state, message: 'The weekly recruitment market and academy trial list are ready.', recruitment: state.recruitment };
    } else result = checked(Engine[action](state, ...validated));
    if (action === 'investOwnerFunds' || action === 'withdrawOwnerFunds') {
      const amount = wholeMoney(args[0]), delta = action === 'investOwnerFunds' ? -amount : amount;
      if (result.walletDeltaAud !== delta || !Number.isSafeInteger(snapshot.balance + delta) || snapshot.balance + delta < 0 || snapshot.balance + delta > MAX_BALANCE) fail('Your Dorra wallet cannot complete that transfer.', 'INVALID_WALLET_TRANSFER', 409);
      snapshot.balance += delta;
    }
    state = result.state;
    if (action === 'createPlayerPromise') recordPromiseGoal(state, secret, result);
    if (action === 'renewPlayerContract' || (action === 'submitContractOffer' && result.code === 'contract-offer-agreed')) {
      const playerId = action === 'renewPlayerContract' ? String(args[0]) : result.player?.id;
      for (const promise of state.careerWorld.squadDynamics.promises) if (promise.playerId === playerId && secret.promiseGoals?.[promise.id]?.type === 'new-contract') secret.promiseGoals[promise.id].verified = true;
    }
    delete secret.visualMatch;
  }
  promiseEvidence(state, secret);
  const seeds = {};
  snapshot.progress.footballManager = publicValue(state, seeds);
  secret.seeds = seeds;
  if (new TextEncoder().encode(JSON.stringify(snapshot.progress)).byteLength > MAX_PROTECTED_PROGRESS_BYTES) fail('The cloud save exceeds the progress limit. Remove a custom crest or reduce archive data before continuing.', 'SAVE_TOO_LARGE', 409);
  return { snapshot, privateState, result: publicValue(result) };
}
