import {
  EMPIRE_VENUES, EMPIRE_MANAGERS, EMPIRE_FOCUSES, EMPIRE_STAFF_ROLES,
  EMPIRE_MARKETING_CAMPAIGNS, EMPIRE_HEADQUARTERS_UPGRADES,
  EMPIRE_VENUE_IMPROVEMENTS, EMPIRE_EVENTS, VIP_CONTRACTS,
  STORY_MISSIONS, STORY_CHOICES, STORY_DIALOGUE, normalizeProgression,
  empireRate, empirePerks, managerCost, contractReward, accrueEmpire,
  venueUnlocked, contractUnlocked, recordRound, storyMissionReady, storyChoice,
  empireVenueImprovementCost, hireEmpireStaff, releaseEmpireStaff,
  purchaseEmpireHeadquartersUpgrade, purchaseEmpireVenueImprovement,
  startEmpireMarketing, specializeEmpireVenue, takeEmpireLoan,
  resolveEmpireEvent, claimEmpireObjective, advanceEmpireWeek,
} from './shared/progression-engine.js';
import {MAX_BALANCE} from './shared/game-limits.js';
import {ESTATE_CLOUD_ACTIONS,reduceEstateClicker} from './estate.mjs';
import {normalizeEstate} from './shared/estate-engine.js';

const ACTIONS = new Set([
  'daily-reward', 'arrival', 'profile-save', 'settings', 'reset', 'code-redeem',
  'estate-claim', 'estate-upgrade', 'estate-manager', 'estate-focus',
  'estate-staff-hire', 'estate-staff-release', 'estate-specialization',
  'estate-marketing', 'estate-loan', 'estate-event', 'estate-objective',
  'estate-week', 'estate-headquarters-upgrade', 'estate-venue-improvement',
  'contract-accept', 'contract-retry', 'contract-abandon', 'contract-claim',
  'story-choice', 'story-complete', 'story-dialogue',
]);
const integer = (value, fallback = 0, maximum = 1e9) =>
  Number.isFinite(Number(value)) ? Math.min(maximum, Math.max(0, Math.floor(Number(value)))) : fallback;
const defaultProfile = () => ({name: 'House Guest', initial: 'D', picture: '', style: 'classic', tone: 'emerald', settings: {sound: true, motion: true, textSize: 'standard'}});
const defaultDaily = date => ({date, sessions: 0, wins: 0, games: [], bonusClaimed: false});
const dateAt = now => new Date(now).toISOString().slice(0, 10);
const demand = (condition, message) => {if (!condition) throw new Error(message)};
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const identifier = (args, key, ...aliases) => {
  const value = [key, ...aliases].map(name => args[name]).find(item => item !== undefined);
  demand(typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(value), `Invalid ${key}.`);
  return value;
};
const venueFor = (args, progress) => {
  const id = identifier(args, 'venueId', 'venue', 'id');
  const venue = EMPIRE_VENUES.find(item => item.id === id);
  demand(venue, 'Unknown estate venue.');
  return {venue, entry: progress.empire.venues[id]};
};
const charge = (snapshot, amount) => {
  demand(Number.isSafeInteger(amount) && amount >= 0, 'Invalid server price.');
  demand(snapshot.balance >= amount, 'Not enough play money.');
  snapshot.balance -= amount;
};
const credit = (snapshot, amount) => {
  demand(Number.isFinite(amount) && amount >= 0, 'Invalid server reward.');
  snapshot.balance = Math.min(MAX_BALANCE, snapshot.balance + amount);
};

/** Defaults are constructed on the server, never copied from a client save. */
export function initializeHouse(snapshot, now = Date.now()) {
  snapshot.balance = Math.min(MAX_BALANCE, Math.max(0, Number(snapshot.balance ?? 1000) || 0));
  snapshot.history = Array.isArray(snapshot.history) ? snapshot.history.slice(0, 8) : [];
  snapshot.stats = object(snapshot.stats) ? snapshot.stats : {sessions: 0, wins: 0, games: {}};
  snapshot.stats.sessions = integer(snapshot.stats.sessions);
  snapshot.stats.wins = Math.min(snapshot.stats.sessions, integer(snapshot.stats.wins));
  snapshot.stats.games = object(snapshot.stats.games) ? snapshot.stats.games : {};
  const p = snapshot.progress = object(snapshot.progress) ? snapshot.progress : {};
  p.level = Math.max(1, integer(p.level, 1, 99));
  p.xp = integer(p.xp);
  p.owned = Array.isArray(p.owned) ? [...new Set(p.owned)].slice(0, 1000) : [];
  for (const key of ['equipped', 'configurations', 'vehicles', 'achievements']) p[key] = object(p[key]) ? p[key] : {};
  p.displayVehicle ??= '';
  p.rewardDate ??= '';
  p.rewardStreak = object(p.rewardStreak) ? p.rewardStreak : {count: 0, lastDate: ''};
  p.redeemedCodes = Array.isArray(p.redeemedCodes) ? p.redeemedCodes.slice(0, 100) : [];
  p.profile = object(p.profile) ? p.profile : defaultProfile();
  p.profile.settings = {...defaultProfile().settings, ...(object(p.profile.settings) ? p.profile.settings : {})};
  p.arrival = object(p.arrival) ? p.arrival : {complete: false, path: ''};
  if (!object(p.daily) || p.daily.date !== dateAt(now)) p.daily = defaultDaily(dateAt(now));
  p.daily.games = Array.isArray(p.daily.games) ? p.daily.games : [];
  normalizeProgression(p, now);
  normalizeEstate(p, now);
  return snapshot;
}

export function awardXP(snapshot, amount) {
  demand(Number.isSafeInteger(amount) && amount >= 0, 'Invalid server XP.');
  const p = snapshot.progress;
  p.xp = integer(p.xp) + amount;
  while (p.level < 99 && p.xp >= 200 + p.level * 100) {
    p.xp -= 200 + p.level * 100;
    p.level++;
  }
  if (p.level === 99) p.xp = Math.min(p.xp, 200 + p.level * 100 - 1);
}

export function recordOfficeTransaction(snapshot, type, amount, label, now = Date.now()) {
  const office = snapshot.progress.office;
  office.transactions.unshift({type, label, amount: Math.round(amount), at: now});
  office.transactions = office.transactions.slice(0, 40);
}

function contractHistory(progress, contract, status, now) {
  progress.contracts.history.unshift({id: contract.id, title: contract.title, status, at: now});
  progress.contracts.history = progress.contracts.history.slice(0, 30);
}

export function settleAchievements(snapshot, now = Date.now()) {
  const p = snapshot.progress, s = snapshot.stats, games = Object.keys(s.games || {}).length;
  const tests = {
    arrival: s.sessions >= 1, firstwin: s.wins >= 1, regular: s.sessions >= 10,
    veteran: s.sessions >= 50, sharp: s.wins >= 5, champion: s.wins >= 25,
    tour: games >= 3, connoisseur: games >= 10, collector: p.owned.length >= 3,
    motorist: Object.keys(p.vehicles).length >= 1, rooftop: p.level >= 3, royal: p.level >= 7,
  };
  for (const [id, unlocked] of Object.entries(tests)) {
    if (unlocked && !p.achievements[id]) p.achievements[id] = {unlockedAt: now};
  }
  return snapshot;
}

/** Called only by an authoritative game settlement, never exposed as an action. */
export function recordRoundResult(snapshot, {game, won = false, bet = 25, message, text}, now = Date.now()) {
  initializeHouse(snapshot, now);
  demand(typeof game === 'string' && game.length > 0 && game.length <= 64, 'Invalid server game.');
  demand(Number.isFinite(bet) && bet >= 0, 'Invalid server wager.');
  const p = snapshot.progress, s = snapshot.stats;
  snapshot.history.unshift({text: String(message ?? text ?? `${game}: ${won ? 'Won' : 'Round complete'}`).slice(0, 240), time: now});
  snapshot.history = snapshot.history.slice(0, 8);
  s.sessions++;
  if (won) s.wins++;
  s.games[game] ??= {sessions: 0, wins: 0};
  s.games[game].sessions++;
  if (won) s.games[game].wins++;
  p.daily.sessions++;
  if (won) p.daily.wins++;
  if (!p.daily.games.includes(game)) p.daily.games.push(game);
  if (!p.daily.bonusClaimed && p.daily.sessions >= 3 && p.daily.wins >= 2 && p.daily.games.length >= 3) {
    p.daily.bonusClaimed = true;
    credit(snapshot, 300);
  }
  const before = p.contracts.status, contract = VIP_CONTRACTS.find(item => item.id === p.contracts.activeId);
  recordRound(p, {game, won, bet});
  if (before === 'active' && p.contracts.status === 'failed') {
    p.contracts.failures++;
    if (contract) contractHistory(p, contract, 'failed', now);
  }
  awardXP(snapshot, 20 + (won ? 25 : 0) + Math.min(30, Math.floor(bet / 25) * 2));
  return settleAchievements(snapshot, now);
}

function startContract(progress, contract) {
  const reward = contractReward(progress, contract);
  Object.assign(progress.contracts, {activeId: contract.id, status: 'active', stepIndex: 0, stepProgress: 0, stepSeen: [], attemptRounds: 0, rewardCash: reward.cash, rewardXp: reward.xp});
  progress.contracts.attempts++;
}

function clearContract(progress) {
  Object.assign(progress.contracts, {activeId: '', status: 'idle', stepIndex: 0, stepProgress: 0, stepSeen: [], attemptRounds: 0, rewardCash: 0, rewardXp: 0});
}

function saveProfile(snapshot, args) {
  const input = object(args.profile) ? args.profile : args, p = snapshot.progress;
  const name = input.name === undefined ? p.profile.name : String(input.name).trim() || 'House Guest';
  demand(name.length <= 24 && !/[<>\u0000-\u001f]/.test(name), 'Use a display name of at most 24 characters.');
  const initial = input.initial === undefined ? p.profile.initial : String(input.initial || name[0] || 'D').slice(0, 1).toUpperCase();
  demand(!/[<>\u0000-\u001f]/.test(initial), 'Invalid profile initial.');
  const style = input.style ?? p.profile.style ?? 'classic', tone = input.tone ?? p.profile.tone ?? 'emerald';
  demand(['classic', 'crown', 'card', 'motor'].includes(style), 'Invalid avatar style.');
  demand(['emerald', 'oxblood', 'midnight', 'gold'].includes(tone), 'Invalid avatar colour.');
  const picture = input.picture ?? p.profile.picture ?? '';
  demand(typeof picture === 'string' && picture.length <= 350000 && (!picture || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(picture)), 'Choose a small JPG, PNG, or WebP profile image.');
  p.profile = {...p.profile, name, initial, style, tone, picture, settings: {...p.profile.settings}};
}

function saveSettings(snapshot, args) {
  const input = object(args.settings) ? args.settings : args, settings = snapshot.progress.profile.settings;
  for (const key of ['sound', 'motion']) {
    if (input[key] !== undefined) {demand(typeof input[key] === 'boolean', `Invalid ${key} setting.`); settings[key] = input[key]}
  }
  if (input.textSize !== undefined) {
    demand(['standard', 'large'].includes(input.textSize), 'Invalid text size.');
    settings.textSize = input.textSize;
  }
}

const GIFT_CODES = {
  '2b91c332bf9b73cb97d27c97da759180de2be994a286f8c5b7669f421223d24e': {kind: 'cash', label: '$1,000 play money'},
  '6f4a5d3632de6bb47358d64cd3a90526db5dd3741caa20a24883ad89ebb725ca': {kind: 'xp', label: '1,000 House XP'},
  'eebb3ccd0c8621e39fc866a0cb3be72cb5cbd501356a6d3a2b14b95ac7ae0120': {kind: 'phone', label: 'iPhone 17'},
  '79e9e81fc29d5c5f1b10ddd81fa7f6be1413a4f72265c0f56e60e2eaafc2f79f': {kind: 'car', label: 'Porsche 911 Carrera'},
};

/** Whitelisted player intents; all amounts, requirements, and rewards are server-derived. */
export async function reduceHouseProgression(snapshot, privateState, action, args = {}, now = Date.now()) {
  if (!ACTIONS.has(action) && !ESTATE_CLOUD_ACTIONS.has(action)) return null;
  demand(object(args), 'Invalid action arguments.');
  initializeHouse(snapshot, now);
  privateState = object(privateState) ? privateState : {};
  privateState.house = object(privateState.house) ? privateState.house : {};
  const estate = reduceEstateClicker(snapshot,privateState,action,args,now);
  if (estate) {settleAchievements(estate.snapshot,now);return estate;}
  demand(!action.startsWith('estate-'), 'The Estate has changed. Refresh and use the new venue controls.');
  const p = snapshot.progress, e = p.empire, c = p.contracts;
  let result = {message: 'Saved.'};

  if (action === 'daily-reward') {
    const today = dateAt(now), refill = snapshot.balance < 5;
    demand(refill || p.rewardDate !== today, 'The daily reward has already been claimed.');
    const amount = refill ? 250 : 250 + empirePerks(p).dailyBonus;
    credit(snapshot, amount);
    if (!refill) {
      const days = (Date.parse(today + 'T12:00:00Z') - Date.parse((p.rewardStreak.lastDate || '1900-01-01') + 'T12:00:00Z')) / 86400000;
      p.rewardStreak = {count: days === 1 ? integer(p.rewardStreak.count) + 1 : 1, lastDate: today};
      p.rewardDate = today;
    }
    recordOfficeTransaction(snapshot, 'reward', amount, refill ? 'Emergency house refill' : 'Daily member credit', now);
    result = {amount, refill, message: refill ? 'The house added $250 so you can keep playing.' : `$${amount} daily play-money reward claimed.`};
  } else if (action === 'arrival') {
    const path = args.skip ? '' : identifier(args, 'path', 'selection');
    demand(path === '' || ['player', 'owner', 'story'].includes(path), 'Invalid arrival path.');
    let advance = 0;
    if (path === 'owner' && !p.arrival.ownerAdvanceClaimed) {
      advance = Math.max(0, 1000 - snapshot.balance);
      credit(snapshot, advance);
      if (advance) recordOfficeTransaction(snapshot, 'founder', advance, 'Founder’s Advance', now);
      p.arrival.ownerAdvanceClaimed = true;
      p.arrival.ownerOpeningUnlocked = true;
    }
    Object.assign(p.arrival, {complete: true, path});
    result = {path, advance, message: 'House focus saved.'};
  } else if (action === 'profile-save') {
    saveProfile(snapshot, args);
    result.message = 'Profile saved.';
  } else if (action === 'settings') {
    saveSettings(snapshot, args);
    result.message = 'Website settings updated.';
  } else if (action === 'reset') {
    demand(args.confirmation === 'Delete Progress', 'Confirm Delete Progress before resetting.');
    const profile = structuredClone(p.profile);
    const redeemedCodeHashes = [...new Set([...(privateState.house.redeemedCodeHashes || []), ...p.redeemedCodes])];
    snapshot = initializeHouse({balance: 1000, history: [], stats: {sessions: 0, wins: 0, games: {}}, progress: {profile, campaign: null, arrival: {complete: false, path: ''}}}, now);
    privateState = {house: {redeemedCodeHashes, resetAt: now}};
    result.message = 'Progress deleted. Your profile was kept.';
  } else if (action === 'code-redeem') {
    demand(typeof args.code === 'string' && args.code.trim().length > 0 && args.code.trim().length <= 40, 'That code is not valid.');
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(args.code.trim().toUpperCase())));
    const hash = [...digest].map(byte => byte.toString(16).padStart(2, '0')).join(''), gift = GIFT_CODES[hash];
    demand(gift, 'That code is not valid.');
    const redeemed = privateState.house.redeemedCodeHashes ??= [...p.redeemedCodes];
    demand(!redeemed.includes(hash) && !p.redeemedCodes.includes(hash), 'This code has already been redeemed.');
    if (gift.kind === 'cash') credit(snapshot, 1000);
    if (gift.kind === 'xp') awardXP(snapshot, 1000);
    if (gift.kind === 'phone') {
      if (!p.owned.includes('iphone17')) p.owned.push('iphone17');
      p.equipped.tech = 'iphone17';
      p.configurations.iphone17 ??= {model: '17', finish: 'Black', storage: '256GB', case: 'None', engraving: 'Dorra House', wallpaper: 'Emerald', price: 1399};
    }
    if (gift.kind === 'car') {
      p.vehicles.porsche911 ??= {trim: 0, upgrades: [], paint: 'base', aero: 'standard', price: 280000};
      p.displayVehicle = 'porsche911';
    }
    redeemed.push(hash);
    p.redeemedCodes.push(hash);
    result.message = `Success — ${gift.label} added to your account.`;
  } else if (action.startsWith('estate-')) {
    // Accrue with the old operating configuration before every rate-changing decision.
    accrueEmpire(p, now);
    if (action === 'estate-claim') {
      const amount = Math.floor(e.pending);
      demand(amount >= 1, 'No estate income is ready to collect.');
      e.pending = Math.max(0, e.pending - amount);
      const rate = empireRate(p);
      e.unclaimedMs = rate > 0 ? Math.min(e.unclaimedMs || 0, e.pending / rate * 3600000) : 0;
      e.lifetimeEarned += amount;
      e.lastClaimAt = now;
      credit(snapshot, amount);
      recordOfficeTransaction(snapshot, 'income', amount, 'House Empire collection', now);
      result = {amount, message: `$${amount} Empire income collected.`};
    } else if (action === 'estate-upgrade') {
      const {venue, entry: existing} = venueFor(args, p), entry = existing || {level: 0, purchasedAt: 0, manager: false, focus: 'balanced'};
      demand(venueUnlocked(p, venue, Object.keys(p.vehicles).length), 'This venue is locked.');
      demand(entry.level < 5, 'The venue is already fully upgraded.');
      const cost = venue.costs[entry.level];
      charge(snapshot, cost);
      entry.level++;
      entry.purchasedAt ||= now;
      e.venues[venue.id] = entry;
      if (venue.id === 'terrace' && entry.level === 1 && !e.openingAdvance) {e.pending += 100; e.openingAdvance = true}
      recordOfficeTransaction(snapshot, 'upgrade', -cost, `${venue.name} · Level ${entry.level}`, now);
      result = {venueId: venue.id, level: entry.level, cost, message: `${venue.name} is now Level ${entry.level}.`};
    } else if (action === 'estate-manager') {
      const {venue, entry} = venueFor(args, p);
      demand(entry?.level >= 2 && !entry.manager, 'A director requires an unmanaged venue at Level 2.');
      const cost = managerCost(venue);
      charge(snapshot, cost);
      Object.assign(entry, {manager: true, focus: 'balanced'});
      recordOfficeTransaction(snapshot, 'manager', -cost, `${EMPIRE_MANAGERS[venue.id].name} appointed`, now);
      result = {cost, message: `${EMPIRE_MANAGERS[venue.id].name} now directs ${venue.name}.`};
    } else if (action === 'estate-focus') {
      const {venue, entry} = venueFor(args, p), focusId = identifier(args, 'focusId', 'focus');
      const focus = EMPIRE_FOCUSES.find(item => item.id === focusId);
      demand(entry?.manager && focus, 'Choose a valid directive for a managed venue.');
      demand(!c.activeId, 'Operating focus is locked while a VIP brief is active.');
      entry.focus = focus.id;
      recordOfficeTransaction(snapshot, 'directive', 0, `${venue.name} · ${focus.name}`, now);
      result.message = `${venue.name} now follows ${focus.name}.`;
    } else if (action === 'estate-staff-hire' || action === 'estate-staff-release') {
      const {venue} = venueFor(args, p), roleId = identifier(args, 'roleId', 'role'), role = EMPIRE_STAFF_ROLES.find(item => item.id === roleId);
      demand(role, 'Unknown staff role.');
      if (action === 'estate-staff-hire') {
        demand(snapshot.balance >= role.hireCost, 'Not enough play money.');
        const operation = hireEmpireStaff(p, venue.id, role.id);
        demand(operation.ok, 'Staff cannot be hired for this venue.');
        charge(snapshot, operation.cost);
        recordOfficeTransaction(snapshot, 'staff', -operation.cost, `${role.name} hire · ${venue.name}`, now);
        result = {cost: operation.cost, message: `${role.name} team expanded.`};
      } else {
        demand(releaseEmpireStaff(p, venue.id, role.id).ok, 'No staff assignment to release.');
        recordOfficeTransaction(snapshot, 'staff', 0, `${role.name} assignment reduced`, now);
        result.message = `${role.name} assignment reduced.`;
      }
    } else if (action === 'estate-specialization') {
      const {venue} = venueFor(args, p), specializationId = identifier(args, 'specializationId', 'specialization');
      const operation = specializeEmpireVenue(p, venue.id, specializationId);
      demand(operation.ok, 'This specialization is unavailable.');
      recordOfficeTransaction(snapshot, 'specialization', 0, `${venue.name} · ${operation.option.name}`, now);
      result.message = `${operation.option.name} selected permanently.`;
    } else if (action === 'estate-marketing') {
      const campaignId = identifier(args, 'campaignId', 'campaign', 'id'), campaign = EMPIRE_MARKETING_CAMPAIGNS.find(item => item.id === campaignId);
      demand(campaign, 'Unknown marketing campaign.');
      charge(snapshot, campaign.cost);
      demand(startEmpireMarketing(p, campaign.id).ok, 'Marketing campaign cannot be started.');
      recordOfficeTransaction(snapshot, 'marketing', -campaign.cost, campaign.name, now);
      result = {cost: campaign.cost, message: `${campaign.name} launched.`};
    } else if (action === 'estate-loan') {
      const operation = takeEmpireLoan(p, identifier(args, 'loanId', 'loan', 'id'));
      demand(operation.ok, 'This loan is unavailable or already active.');
      credit(snapshot, operation.credit);
      recordOfficeTransaction(snapshot, 'finance', operation.credit, operation.loan.name, now);
      result = {amount: operation.credit, message: `$${operation.credit} added to working capital.`};
    } else if (action === 'estate-event') {
      const event = EMPIRE_EVENTS.find(item => item.id === e.event?.id), choiceId = identifier(args, 'choiceId', 'choice', 'id'), choice = event?.choices.find(item => item.id === choiceId);
      demand(choice, 'There is no matching business decision.');
      charge(snapshot, choice.cost || 0);
      const operation = resolveEmpireEvent(p, choice.id);
      demand(operation.ok, 'Business decision could not be recorded.');
      recordOfficeTransaction(snapshot, 'event', -operation.cost, `${event.name} · ${choice.label}`, now);
      result = {cost: operation.cost, message: `${choice.label} recorded.`};
    } else if (action === 'estate-objective') {
      const operation = claimEmpireObjective(p, identifier(args, 'objectiveId', 'objective', 'id'));
      demand(operation.ok, 'The objective is incomplete or already claimed.');
      credit(snapshot, operation.reward);
      recordOfficeTransaction(snapshot, 'objective', operation.reward, operation.objective.name, now);
      result = {amount: operation.reward, message: `${operation.objective.name}: $${operation.reward} claimed.`};
    } else if (action === 'estate-week') {
      const operation = advanceEmpireWeek(p);
      demand(operation.ok, operation.reason || 'The business week cannot close.');
      snapshot.balance = Math.min(MAX_BALANCE, Math.max(0, snapshot.balance + operation.cashflow));
      recordOfficeTransaction(snapshot, 'trading', operation.cashflow, `House Empire · Week ${e.week === 1 ? 52 : e.week - 1}`, now);
      result = {cashflow: operation.cashflow, event: operation.event, message: `Week closed: $${operation.cashflow} net.${operation.event ? ' A business decision is waiting.' : ''}`};
    } else if (action === 'estate-headquarters-upgrade') {
      const upgradeId = identifier(args, 'upgradeId', 'upgrade', 'id'), upgrade = EMPIRE_HEADQUARTERS_UPGRADES.find(item => item.id === upgradeId), level = e.headquarters[upgradeId] || 0;
      demand(upgrade && level < 3, 'This headquarters upgrade is unavailable.');
      charge(snapshot, upgrade.costs[level]);
      const operation = purchaseEmpireHeadquartersUpgrade(p, upgrade.id);
      demand(operation.ok, 'Headquarters upgrade could not be applied.');
      recordOfficeTransaction(snapshot, 'headquarters', -operation.cost, `${upgrade.name} · Level ${operation.level}`, now);
      result = {cost: operation.cost, level: operation.level, message: `${upgrade.name} advanced to Level ${operation.level}.`};
    } else if (action === 'estate-venue-improvement') {
      const {venue, entry} = venueFor(args, p), improvementId = identifier(args, 'improvementId', 'improvement', 'upgradeId'), improvement = EMPIRE_VENUE_IMPROVEMENTS.find(item => item.id === improvementId), level = entry?.improvements?.[improvementId] || 0;
      demand(entry?.level && improvement && level < 3, 'This venue improvement is unavailable.');
      const cost = empireVenueImprovementCost(venue, improvement.id, level);
      charge(snapshot, cost);
      const operation = purchaseEmpireVenueImprovement(p, venue.id, improvement.id);
      demand(operation.ok, 'Venue improvement could not be applied.');
      recordOfficeTransaction(snapshot, 'capital-project', -cost, `${venue.name} · ${improvement.name} Level ${operation.level}`, now);
      result = {cost, level: operation.level, message: `${venue.name}: ${improvement.name} is now Level ${operation.level}.`};
    }
  } else if (action.startsWith('contract-')) {
    if (action === 'contract-accept') {
      demand(!c.activeId, 'Finish or abandon the active contract first.');
      const contract = VIP_CONTRACTS.find(item => item.id === identifier(args, 'contractId', 'contract', 'id'));
      demand(contract && contractUnlocked(p, contract), 'This contract is locked.');
      startContract(p, contract);
      contractHistory(p, contract, c.completedIds.includes(contract.id) ? 'replay started' : 'accepted', now);
      result.message = 'VIP brief accepted.';
    } else {
      const contract = VIP_CONTRACTS.find(item => item.id === c.activeId);
      demand(contract, 'There is no active VIP brief.');
      if (action === 'contract-retry') {
        demand(c.status === 'failed', 'Only an expired contract can be retried.');
        startContract(p, contract);
        contractHistory(p, contract, 'retried', now);
        result.message = 'VIP brief restarted.';
      } else if (action === 'contract-abandon') {
        c.abandons++;
        contractHistory(p, contract, 'abandoned', now);
        clearContract(p);
        result.message = 'VIP brief closed with no fee.';
      } else if (action === 'contract-claim') {
        demand(c.status === 'complete', 'Complete the brief before claiming its reward.');
        const replay = c.claimedIds.includes(contract.id), cash = c.rewardCash || contract.reward[0], xp = c.rewardXp || contract.reward[1];
        if (!replay) {
          credit(snapshot, cash);
          awardXP(snapshot, xp);
          if (!c.completedIds.includes(contract.id)) c.completedIds.push(contract.id);
          c.claimedIds.push(contract.id);
          c.totalCash += cash;
          c.totalXp += xp;
          recordOfficeTransaction(snapshot, 'contract', cash, `${contract.title} reward`, now);
        } else c.replays++;
        contractHistory(p, contract, replay ? 'replay complete' : 'completed', now);
        clearContract(p);
        result = {replay, amount: replay ? 0 : cash, xp: replay ? 0 : xp, message: replay ? `${contract.title} practice run recorded.` : `${contract.title} complete — $${cash}.`};
      }
    }
  } else if (action === 'story-choice') {
    const mission = STORY_MISSIONS[p.story.index];
    demand(mission && !p.story.choices[mission.id], 'The chapter decision is already recorded or unavailable.');
    const choiceId = identifier(args, 'choiceId', 'choice', 'id'), option = STORY_CHOICES[mission.id].options.find(item => item.id === choiceId);
    demand(option, 'Choose a valid decision for the current chapter.');
    p.story.choices[mission.id] = option.id;
    p.story.relationships[option.relation] = (p.story.relationships[option.relation] || 0) + 1;
    credit(snapshot, option.bonus[0]);
    awardXP(snapshot, option.bonus[1]);
    recordOfficeTransaction(snapshot, 'decision', option.bonus[0], `${mission.title} · ${option.label}`, now);
    result = {amount: option.bonus[0], xp: option.bonus[1], message: `${option.legacy} legacy recorded.`};
  } else if (action === 'story-complete') {
    const mission = STORY_MISSIONS[p.story.index], context = {vehicles: Object.keys(p.vehicles).length, collectibles: p.owned.length};
    demand(mission && storyMissionReady(p, context) && storyChoice(p, mission.id), 'Complete all chapter objectives and its decision first.');
    const cash = mission.id === 's1' ? Math.max(mission.reward[0], 5000 - snapshot.balance) : mission.reward[0];
    p.story.completedIds.push(mission.id);
    p.story.index++;
    p.story.metrics = {rounds: 0, wins: 0, games: [], gameCounts: {}};
    credit(snapshot, cash);
    awardXP(snapshot, mission.reward[1]);
    recordOfficeTransaction(snapshot, 'story', cash, `Chapter ${mission.chapter} · ${mission.title}`, now);
    result = {missionId: mission.id, amount: cash, xp: mission.reward[1], message: `Chapter complete — ${mission.unlock}.`};
  } else if (action === 'story-dialogue') {
    const missionId = identifier(args, 'missionId', 'mission', 'id'), index = STORY_MISSIONS.findIndex(item => item.id === missionId), phase = args.phase || 'briefing';
    demand(index >= 0 && ['briefing', 'completion'].includes(phase) && STORY_DIALOGUE[missionId]?.[phase]?.length, 'Unknown story scene.');
    demand(phase === 'briefing' ? index <= p.story.index : index < p.story.index, 'This story scene is locked.');
    const sceneId = `${missionId}:${phase}`;
    if (!p.story.dialogueSeen.includes(sceneId)) p.story.dialogueSeen.push(sceneId);
    result.message = 'Story scene recorded.';
  }
  settleAchievements(snapshot, now);
  return {snapshot, privateState, result};
}
