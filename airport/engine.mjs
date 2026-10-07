import {bayFor, aircraftFitsBay, activeBayPlots} from './brisbane-bays.mjs';
import {GATEWAY_ID, gatewayPlot} from './queensland-gateway-data.mjs';
import {
  AIRPORTS, AIRPORT_BY_ID, AIRCRAFT, AIRCRAFT_CLASSES, SURFACES, RUNWAY_LENGTHS,
  BUILDINGS, RESEARCH_PROJECTS, GATE_COSTS, GATE_DURATIONS, BOOST_OPTIONS, MILESTONES
} from './catalog.mjs';

export { AIRPORTS, AIRCRAFT_CLASSES, AIRCRAFT, SURFACES } from './catalog.mjs';
export const OFFLINE_CAP_MS = 24 * 60 * 60 * 1_000;
export const MAX_CURRENCY = 9_000_000_000_000;
export const MAX_DIAMONDS = 99_999_999;
const copy = value => structuredClone(value);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const researchById = Object.fromEntries(RESEARCH_PROJECTS.map(item => [item.id, item]));
const buildingByKey = Object.fromEntries(BUILDINGS.map(item => [item.key, item]));
const COMMAND_FIELDS = Object.freeze({
  'select-airport': ['type', 'airportId'],
  'unlock-airport': ['type', 'airportId', 'useDiamonds'],
  upgrade: ['type', 'airportId', 'building', 'useDiamonds'],
  'build-gate': ['type', 'airportId', 'plotId', 'size', 'useDiamonds'],
  'upgrade-gate': ['type', 'airportId', 'gateId', 'useDiamonds'],
  'set-gate-active': ['type', 'airportId', 'gateId', 'active'],
  research: ['type', 'airportId', 'researchId', 'useDiamonds'],
  'skip-task': ['type', 'airportId', 'taskId'],
  boost: ['type', 'airportId', 'multiplier', 'durationMinutes'],
  'claim-milestone': ['type', 'airportId', 'milestoneId']
});
const integer = (value, min = 0, max = MAX_CURRENCY) => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function validTime(now) { if (!integer(now, 0, Number.MAX_SAFE_INTEGER)) fail('INVALID_TIME', 'The simulation needs a valid server timestamp.'); return now; }
function hash(value) { let result = 2166136261; for (const character of String(value)) { result ^= character.charCodeAt(0); result = Math.imul(result, 16777619); } return result >>> 0 || 1; }
function randomStep(state) { let next = state >>> 0; next ^= next << 13; next ^= next >>> 17; next ^= next << 5; return next >>> 0 || 1; }
function numberLabel(value) { return value.toLocaleString('en-AU'); }
function requireAirport(career, id) {
  if (typeof id !== 'string' || !own(AIRPORT_BY_ID, id) || !own(career.airports, id)) fail('AIRPORT_NOT_OWNED', 'Open this airport before changing its facilities.');
  return career.airports[id];
}
function assertCareer(career) {
  if (!career || career.version !== 1 || !integer(career.diamonds, 0, MAX_DIAMONDS) || !career.airports || !own(AIRPORT_BY_ID, career.selectedAirportId) || !own(career.airports, career.selectedAirportId)) fail('INVALID_CAREER', 'The airport career is invalid.');
  validTime(career.lastSettledAt);
  for (const [id, airport] of Object.entries(career.airports)) {
    if (!own(AIRPORT_BY_ID, id) || airport.id !== id || !integer(airport.cash) || !integer(airport.research) || !Array.isArray(airport.gates) || !Array.isArray(airport.constructions) || !airport.buildings || !airport.stats) fail('INVALID_CAREER', 'The saved airport data is invalid.');
  }
}

function createAirport(meta, now, seed) {
  return {
    id: meta.id, cash: meta.grant, research: 0, researchUnits: 0, openedAt: now,
    buildings: { runwaySurface: 1, runwayLength: 1, taxiway: 1, handling: 1, terminal: 1, tower: 1, researchLab: 0, cargo: 0 },
    gates: [{ id: 'gate-1', plotId: 'plot-1', size: 0, progressMs: 0, intervalMs: 90_000, departures: 0, rngState: hash(`${seed}:${meta.id}:gate-1`), currentAircraftId: 'c172', lastAircraftId: null }],
    constructions: [], researchCompleted: [], boost: null, claimedMilestones: [], taskCounter: 0,
    stats: { departures: 0, passengers: 0, cargoFlights: 0, lifetimeCash: 0, lifetimeResearch: 0, diamondsFound: 0, operatingMs: 0, highestClassServed: 0, aircraftDepartures: {} },
    recentDepartures: [], seed: hash(`${seed}:${meta.id}`)
  };
}

export function createCareer(now = Date.now(), seed = 1) {
  validTime(now);
  const careerSeed = hash(seed);
  return { version: 1, revision: 1, seed: careerSeed, diamonds: 20, selectedAirportId: AIRPORTS[0].id,
    airports: { [AIRPORTS[0].id]: createAirport(AIRPORTS[0], now, careerSeed) }, createdAt: now, lastSettledAt: now };
}

export function aircraftMissingRequirements(airport, aircraft, gateSize = null) {
  const meta = AIRPORT_BY_ID[airport.id], b = airport.buildings, missing = [];
  if (aircraft.size > meta.maxSize) missing.push(`${meta.name} is limited to ${AIRCRAFT_CLASSES[meta.maxSize].name} aircraft`);
  const availableSize = gateSize === null ? Math.max(-1, ...airport.gates.map(gate => gate.size)) : gateSize;
  if (availableSize < aircraft.size) missing.push(`${AIRCRAFT_CLASSES[aircraft.size].name} gate`);
  if (['brisbane','gold-coast'].includes(airport.id) && gateSize === null && !airport.gates.some(g=>activeBayPlots(airport).has(g.plotId)&&g.size>=aircraft.size&&aircraftFitsBay(airport.id,g.plotId,aircraft.id))) missing.push('An active bay with sufficient parking space');
  const length = RUNWAY_LENGTHS[b.runwayLength - 1] || 0;
  if (length < aircraft.runwayLength) missing.push(`${numberLabel(aircraft.runwayLength)} m runway`);
  if (b.runwaySurface < aircraft.surface) missing.push(`Runway surface L${aircraft.surface} · ${SURFACES[aircraft.surface - 1].shortName}`);
  if (b.taxiway < aircraft.taxiway) missing.push(`Taxiway L${aircraft.taxiway}`);
  if (b.handling < aircraft.handling) missing.push(`Ground equipment L${aircraft.handling}`);
  if (b.terminal < aircraft.terminal) missing.push(`Terminal L${aircraft.terminal}`);
  if (b.tower < aircraft.tower) missing.push(`Control tower L${aircraft.tower}`);
  if (b.cargo < aircraft.cargo) missing.push(`Cargo terminal L${aircraft.cargo}`);
  if (aircraft.certification && !airport.researchCompleted.includes(aircraft.certification)) missing.push(researchById[aircraft.certification].name);
  return missing;
}

function eligibleForGate(airport, gate) {
  if (['brisbane','gold-coast'].includes(airport.id) && !activeBayPlots(airport).has(gate.plotId)) return [];
  const b = airport.buildings, maximum = Math.min(gate.size, bayFor(airport.id, gate.plotId)?.maxSize ?? AIRPORT_BY_ID[airport.id].maxSize), length = RUNWAY_LENGTHS[b.runwayLength - 1];
  return AIRCRAFT.filter(aircraft => aircraftFitsBay(airport.id, gate.plotId, aircraft.id) && aircraft.size <= maximum && aircraft.runwayLength <= length && aircraft.surface <= b.runwaySurface &&
    aircraft.taxiway <= b.taxiway && aircraft.handling <= b.handling && aircraft.terminal <= b.terminal && aircraft.tower <= b.tower && aircraft.cargo <= b.cargo &&
    (!aircraft.certification || airport.researchCompleted.includes(aircraft.certification)));
}
function trafficSchedule(airport, gate) {
  const possible = eligibleForGate(airport, gate), largest = Math.max(0, ...possible.filter(item => !item.cargo).map(item => item.size));
  const weighted = possible.map(aircraft => ({ aircraft, weight: aircraft.cargo ? 1 : aircraft.size === largest ? 5 : aircraft.size === largest - 1 ? 2 : 1 }));
  return Array.from({ length: 5 }, (_, round) => weighted.filter(item => item.weight > round).map(item => item.aircraft)).flat();
}
function chooseNextAircraft(airport, gate) {
  const schedule = trafficSchedule(airport, gate);
  return schedule.length ? schedule[(gate.departures + hash(`${airport.seed}:${gate.id}:traffic`)) % schedule.length].id : null;
}
function gatePlan(airport, gate) {
  const possible = eligibleForGate(airport, gate);
  if (!possible.length) return null;
  const aircraft = possible.find(item => item.id === gate.currentAircraftId) || possible[0];
  const b = airport.buildings, efficiency = 100 + (b.tower - 1) * 8 + (b.handling - 1) * 4 + (airport.researchCompleted.includes('turnaround') ? 18 : 0);
  const intervalMs = Math.max(20_000, Math.round(aircraft.serviceSeconds * 100_000 / (AIRPORT_BY_ID[airport.id].demand * efficiency)));
  const income = Math.round(aircraft.income * (100 + (b.terminal - 1) * 8 + b.cargo * 2 + (airport.researchCompleted.includes('passenger-service') ? 20 : 0)) / 100);
  const researchUnits = aircraft.research * (b.researchLab + 1) * (airport.researchCompleted.includes('research-network') ? 2 : 1);
  return { aircraft, intervalMs, income, researchUnits };
}

function addCash(airport, amount) { const credited = Math.min(amount, MAX_CURRENCY - airport.cash); airport.cash += credited; return credited; }
function addResearch(airport, amount) { const credited = Math.min(amount, MAX_CURRENCY - airport.research); airport.research += credited; return credited; }
function addDiamonds(career, amount) { const credited = Math.min(amount, MAX_DIAMONDS - career.diamonds); career.diamonds += credited; return credited; }

function finishEvents(airport, now) {
  const done = airport.constructions.filter(task => task.endsAt <= now).sort((a, b) => a.endsAt - b.endsAt || a.id.localeCompare(b.id));
  for (const task of done) {
    if (task.kind === 'building') airport.buildings[task.building] = task.level;
    else if (task.kind === 'gate') {
      const existing = airport.gates.find(gate => gate.id === task.gateId);
      if (existing) existing.size = task.size;
      else airport.gates.push({ id: task.gateId, plotId: task.plotId, size: task.size, progressMs: 0, intervalMs: 90_000, departures: 0, rngState: hash(`${airport.seed}:${task.gateId}`), currentAircraftId: 'c172', lastAircraftId: null });
    } else if (task.kind === 'research' && !airport.researchCompleted.includes(task.researchId)) airport.researchCompleted.push(task.researchId);
  }
  if (done.length) airport.constructions = airport.constructions.filter(task => task.endsAt > now);
  if (airport.boost && airport.boost.endsAt <= now) airport.boost = null;
}

function simulateSegment(career, airport, start, end, earnings) {
  const duration = end - start;
  if (duration <= 0) return;
  airport.stats.operatingMs += duration;
  for (const gate of airport.gates) {
    let cursor = start;
    while (cursor < end) {
      const plan = gatePlan(airport, gate);
      if (!plan) { gate.progressMs = 0; break; }
      gate.currentAircraftId = plan.aircraft.id;
      if (gate.intervalMs !== plan.intervalMs) {
        gate.progressMs = Math.floor(gate.progressMs * plan.intervalMs / Math.max(1, gate.intervalMs));
        gate.intervalMs = plan.intervalMs;
      }
      const remaining = plan.intervalMs - gate.progressMs;
      if (cursor + remaining > end) { gate.progressMs += end - cursor; break; }
      const at = cursor + remaining;
      cursor = at; gate.progressMs = 0;
      const multiplier = airport.boost && at < airport.boost.endsAt ? airport.boost.multiplier : 1;
      const cash = addCash(airport, plan.income * multiplier);
      airport.researchUnits += plan.researchUnits;
      const research = addResearch(airport, Math.floor(airport.researchUnits / 10));
      airport.researchUnits %= 10;
      airport.stats.departures++; gate.departures++;
      const cargo = plan.aircraft.cargo > 0;
      if (cargo) airport.stats.cargoFlights = (airport.stats.cargoFlights || 0) + 1;
      else airport.stats.passengers += [4, 45, 100, 175, 320, 510][plan.aircraft.size];
      airport.stats.lifetimeCash += cash; airport.stats.lifetimeResearch += research;
      airport.stats.highestClassServed = Math.max(airport.stats.highestClassServed, plan.aircraft.size);
      airport.stats.aircraftDepartures[plan.aircraft.id] = (airport.stats.aircraftDepartures[plan.aircraft.id] || 0) + 1;
      gate.lastAircraftId = plan.aircraft.id;
      gate.rngState = randomStep(gate.rngState);
      let diamonds = 0;
      if (gate.rngState % 100 === 0) {
        gate.rngState = randomStep(gate.rngState);
        diamonds = addDiamonds(career, 1 + gate.rngState % 3);
        airport.stats.diamondsFound += diamonds;
      }
      earnings.cash += cash; earnings.research += research; earnings.diamonds += diamonds; earnings.departures++;
      airport.recentDepartures.push({ id: `${gate.id}:${gate.departures}`, gateId: gate.id, aircraftId: plan.aircraft.id,
        operationType: cargo ? 'cargo' : 'passenger', cargo, special: plan.aircraft.special || null, at, cash, diamonds });
      gate.currentAircraftId = chooseNextAircraft(airport, gate);
    }
  }
  airport.recentDepartures.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
  airport.recentDepartures = airport.recentDepartures.slice(0, 12);
}

/** Simulates event boundaries, not wall-clock polling. Each gate owns its RNG,
 * so save frequency cannot change rewards or the next diamond result. */
export function settleCareer(input, now = Date.now()) {
  assertCareer(input); validTime(now);
  const career = copy(input), elapsedMs = Math.max(0, now - career.lastSettledAt), creditedMs = Math.min(elapsedMs, OFFLINE_CAP_MS);
  const earnings = { cash: 0, research: 0, diamonds: 0, departures: 0, byAirport: {} };
  if (!elapsedMs) return { career, earnings, elapsedMs: 0, creditedMs: 0, capped: false };
  const end = career.lastSettledAt + creditedMs;
  for (const airport of Object.values(career.airports)) {
    const local = { cash: 0, research: 0, diamonds: 0, departures: 0 };
    let cursor = Math.max(career.lastSettledAt, airport.openedAt);
    finishEvents(airport, cursor);
    while (cursor < end) {
      const events = airport.constructions.map(task => task.endsAt).filter(at => at > cursor);
      if (airport.boost && airport.boost.endsAt > cursor) events.push(airport.boost.endsAt);
      const next = Math.min(end, ...events);
      simulateSegment(career, airport, cursor, next, local);
      cursor = next;
      finishEvents(airport, cursor);
    }
    // Timers finish while away even after the 24-hour earnings allowance ends.
    finishEvents(airport, now);
    earnings.byAirport[airport.id] = local;
    for (const key of ['cash', 'research', 'diamonds', 'departures']) earnings[key] += local[key];
  }
  career.lastSettledAt = Math.max(career.lastSettledAt, now);
  return { career, earnings, elapsedMs, creditedMs, capped: elapsedMs > OFFLINE_CAP_MS };
}

function quote(cashCost, researchCost, durationMs, airport, options = {}) {
  const diamondCost = options.diamondCost ?? Math.max(1, Math.ceil(cashCost / 2_000) + Math.ceil(researchCost / 50) + Math.ceil(durationMs / 300_000));
  return { cashCost, researchCost, diamondCost, cash: cashCost, research: researchCost, diamonds: diamondCost,
    durationMs, durationSeconds: durationMs / 1_000, affordable: airport.cash >= cashCost && airport.research >= researchCost,
    available: true, reason: '', ...options };
}
function maximumBuildingLevel(airport, building) {
  if (building.key === 'runwayLength') return RUNWAY_LENGTHS.filter(length => length <= AIRPORT_BY_ID[airport.id].maxRunwayLength).length;
  return building.maxLevel;
}
function buildingLabel(key, level) {
  if (key === 'runwayLength') return `${numberLabel(RUNWAY_LENGTHS[level - 1] || 0)} m`;
  if (key === 'runwaySurface' || key === 'taxiway') return SURFACES[level - 1]?.name || 'Unbuilt';
  if (key === 'handling') return ['Unbuilt', 'Chocks & fuel bowser', 'Propeller aircraft tugs', 'Jet ground power & tugs', 'Widebody service fleet', 'Super-heavy equipment'][level];
  return level ? `Level ${level}` : 'Not built';
}
function constructionBusy(airport) { return airport.constructions.some(task => task.kind !== 'research'); }

export function getBuildingQuote(airport, key) {
  if (!own(buildingByKey, key)) fail('UNKNOWN_BUILDING', 'Choose a known airport facility.');
  const building = buildingByKey[key], level = airport.buildings[key], next = level + 1;
  const step = key === 'runwayLength' ? Math.max(0, next - 2) : Math.max(0, next - 2);
  const cost = Math.round(building.baseCost * (key === 'runwayLength' ? 1.38 : 3.6) ** step * (1 + AIRPORT_BY_ID[airport.id].order * 0.1));
  const research = key === 'runwayLength' ? Math.max(0, next - 5) * 15 : Math.round(building.researchBase * Math.max(0, next - 1) ** 2);
  const duration = Math.round(building.durationSeconds * 1_000 * (key === 'runwayLength' ? 1.35 : 2.2) ** step);
  const maxed = level >= maximumBuildingLevel(airport, building), busy = constructionBusy(airport);
  return quote(cost, research, duration, airport, { nextLevel: next, nextLabel: buildingLabel(key, next), maxed,
    available: !maxed && !busy, reason: maxed ? 'This facility has reached its location limit.' : busy ? 'Finish the current construction project first.' : '' });
}
function parsePlot(meta, plotId) {
  if (typeof plotId !== 'string' || !/^plot-[1-9]\d*$/.test(plotId)) return null;
  const index = Number(plotId.slice(5));
  return integer(index, 1, meta.gatePlots) ? index : null;
}
function getGateQuote(airport, plotId, size, existing = null) {
  const meta = AIRPORT_BY_ID[airport.id], bay = bayFor(airport.id, plotId), maximum = bay?.maxSize ?? meta.maxSize, plot = parsePlot(meta, plotId), valid = plot && integer(size, 0, maximum);
  const occupied = airport.gates.some(gate => gate.plotId === plotId && gate !== existing) || airport.constructions.some(task => task.plotId === plotId && task.gateId !== existing?.id);
  const busy = constructionBusy(airport), cost = valid ? Math.round(GATE_COSTS[size] * (1 + (plot - 1) * 0.15)) : 0;
  const maxed = existing && existing.size >= maximum;
  return quote(cost, valid ? size * size * 20 : 0, valid ? GATE_DURATIONS[size] : 0, airport, { nextLevel: size, nextLabel: AIRCRAFT_CLASSES[size]?.name || 'Location limit',
    available: Boolean(valid && !occupied && !busy && !maxed), maxed: Boolean(maxed),
    reason: !valid || maxed ? 'This location cannot fit a larger gate.' : occupied ? 'This plot is already occupied.' : busy ? 'Finish the current construction project first.' : '' });
}
function getResearchQuote(airport, project) {
  const completed = airport.researchCompleted.includes(project.id), active = airport.constructions.some(task => task.researchId === project.id), busy = airport.constructions.some(task => task.kind === 'research');
  const fits = AIRPORT_BY_ID[airport.id].maxSize >= project.minClass;
  const prerequisites = project.requires.every(id => airport.researchCompleted.includes(id));
  return quote(project.cashCost, project.researchCost, project.durationMs, airport, { completed, active,
    available: !completed && !busy && fits && prerequisites,
    reason: completed ? 'Research complete.' : !fits ? 'This airport cannot accommodate that aircraft class.' : !prerequisites ? 'Complete the earlier research first.' : busy ? 'The research team is already working on a project.' : '' });
}
function charge(career, airport, price, useDiamonds) {
  if (!price.available) fail('UNAVAILABLE', price.reason || 'This project is not available.');
  if (useDiamonds !== undefined && typeof useDiamonds !== 'boolean') fail('INVALID_PAYMENT', 'Choose cash and research or diamonds.');
  if (useDiamonds) {
    if (career.diamonds < price.diamondCost) fail('INSUFFICIENT_DIAMONDS', 'There are not enough diamonds for this project.');
    career.diamonds -= price.diamondCost;
  } else {
    if (airport.cash < price.cashCost) fail('INSUFFICIENT_CASH', 'This airport needs more cash.');
    if (airport.research < price.researchCost) fail('INSUFFICIENT_RESEARCH', 'This airport needs more research points.');
    airport.cash -= price.cashCost; airport.research -= price.researchCost;
  }
}
function addTask(airport, now, price, properties) {
  const id = `${airport.id}:task-${++airport.taskCounter}`;
  airport.constructions.push({ id, startedAt: now, endsAt: now + price.durationMs, ...properties });
}
function milestoneProgress(airport, milestone) {
  return milestone.metric === 'departures' ? airport.stats.departures : milestone.metric === 'gates' ? airport.gates.length : airport.buildings.runwaySurface;
}
function unlockView(career, meta) {
  const owned = own(career.airports, meta.id);
  if (!meta.unlock) return { canUnlock: false, available: false, owned, requirements: [], cashCost: 0, researchCost: 0, diamondCost: 0, sourceAirportId: null, affordable: owned };
  const source = career.airports[meta.unlock.predecessor], previous = AIRPORT_BY_ID[meta.unlock.predecessor];
  const servedClass = meta.unlock.servedClass ?? previous.maxSize;
  const requirements = [
    { label: `Own ${previous.name}`, current: source ? 1 : 0, target: 1 },
    { label: 'Operating experience (hours)', current: source ? Math.floor(source.stats.operatingMs / 3_600_000 * 10) / 10 : 0, target: meta.unlock.operatingHours },
    { label: 'Departures', current: source?.stats.departures || 0, target: meta.unlock.departures },
    { label: 'Runway surface level', current: source?.buildings.runwaySurface || 0, target: meta.unlock.surface },
    { label: 'Terminal level', current: source?.buildings.terminal || 0, target: meta.unlock.terminal },
    { label: 'Completed gates', current: source?.gates.length || 0, target: meta.unlock.gates },
    { label: `${AIRCRAFT_CLASSES[servedClass].name} aircraft served`, current: source && source.stats.highestClassServed >= servedClass ? 1 : 0, target: 1 }
  ].map(item => ({ ...item, met: item.current >= item.target }));
  const met = requirements.every(item => item.met), affordable = Boolean(source && source.cash >= meta.unlockCash);
  return { canUnlock: !owned && met && affordable, available: !owned && met, owned, requirements,
    cashCost: meta.unlockCash, researchCost: 0, diamondCost: meta.unlockDiamonds,
    cash: meta.unlockCash, research: 0, diamonds: meta.unlockDiamonds, sourceAirportId: previous.id,
    affordable, canUnlockWithDiamonds: !owned && Boolean(source) && career.diamonds >= meta.unlockDiamonds,
    reason: !source ? `Open ${previous.name} first.` : !met ? 'Develop the previous airport to meet its operating milestones.' : !affordable ? `Save ${numberLabel(meta.unlockCash)} cash at ${previous.name}.` : '' };
}

/** Server calls this only with validated command envelopes; this function still
 * validates every gameplay input and never accepts replacement state or money. */
export function applyCommand(input, command, now = Date.now()) {
  if (!command || typeof command !== 'object' || Array.isArray(command) || typeof command.type !== 'string') fail('INVALID_COMMAND', 'Choose an airport action.');
  if (!own(COMMAND_FIELDS, command.type)) fail('UNKNOWN_COMMAND', 'That airport command is not supported.');
  if (Object.keys(command).some(key => !COMMAND_FIELDS[command.type].includes(key))) fail('INVALID_COMMAND_FIELD', 'Airport commands cannot supply balances, costs, timestamps or replacement state.');
  if (own(command, 'airportId') && (typeof command.airportId !== 'string' || !own(AIRPORT_BY_ID, command.airportId))) fail('UNKNOWN_AIRPORT', 'Choose a known airport.');
  validTime(now);
  const career = settleCareer(input, now).career, at = career.lastSettledAt;
  if (command.type === 'select-airport') {
    requireAirport(career, command.airportId); career.selectedAirportId = command.airportId; return career;
  }
  if (command.type === 'unlock-airport') {
    if (typeof command.airportId !== 'string' || !own(AIRPORT_BY_ID, command.airportId)) fail('UNKNOWN_AIRPORT', 'Choose a known airport.');
    const meta = AIRPORT_BY_ID[command.airportId], price = unlockView(career, meta);
    if (price.owned) fail('ALREADY_OWNED', 'You already operate this airport.');
    if (command.useDiamonds !== undefined && typeof command.useDiamonds !== 'boolean') fail('INVALID_PAYMENT', 'Choose a valid payment method.');
    if (!price.sourceAirportId || !own(career.airports, price.sourceAirportId)) fail('AIRPORT_LOCKED', price.reason);
    if (command.useDiamonds) {
      if (career.diamonds < price.diamondCost) fail('INSUFFICIENT_DIAMONDS', 'There are not enough diamonds to open this airport.');
      career.diamonds -= price.diamondCost;
    } else {
      if (!price.available) fail('AIRPORT_LOCKED', price.reason);
      const source = career.airports[price.sourceAirportId];
      if (source.cash < price.cashCost) fail('INSUFFICIENT_CASH', price.reason);
      source.cash -= price.cashCost;
    }
    career.airports[meta.id] = createAirport(meta, at, career.seed); career.selectedAirportId = meta.id;
    return career;
  }
  const airport = requireAirport(career, command.airportId || career.selectedAirportId), meta = AIRPORT_BY_ID[airport.id];
  if (command.type === 'upgrade') {
    const price = getBuildingQuote(airport, command.building);
    charge(career, airport, price, command.useDiamonds);
    addTask(airport, at, price, { kind: 'building', building: command.building, level: price.nextLevel, label: `${buildingByKey[command.building].name} · ${price.nextLabel}` });
  } else if (command.type === 'build-gate') {
    const size = command.size === undefined ? 0 : command.size;
    if (!integer(size, 0, meta.maxSize)) fail('LOCATION_CAP', 'This airport cannot fit that gate size.');
    if (!parsePlot(meta, command.plotId)) fail('INVALID_PLOT', 'Choose an available gate plot.');
    const price = getGateQuote(airport, command.plotId, size);
    charge(career, airport, price, command.useDiamonds);
    addTask(airport, at, price, { kind: 'gate', gateId: `gate-${command.plotId.slice(5)}`, plotId: command.plotId, size, label: bayFor(airport.id,command.plotId)?`${bayFor(airport.id,command.plotId).label} · ${AIRCRAFT_CLASSES[size].name} operating equipment`:`${AIRCRAFT_CLASSES[size].name} gate · ${command.plotId.replace('plot-', 'plot ')}` });
  } else if (command.type === 'set-gate-active') {
    const gate = airport.gates.find(g => g.id === command.gateId), bay = gate && bayFor(airport.id, gate.plotId);
    if (!bay || typeof command.active !== 'boolean') fail('INVALID_BAY', 'Choose an owned aircraft bay and its operating state.');
    gate.active = command.active;
    if (command.active) for (const other of airport.gates) if (bay.conflicts.includes(other.plotId)) other.active = false;
    if(command.active&&airport.id==='gold-coast'&&bay.precinct==='Terminal'){
      // Give the requested configuration priority while respecting the
      // operator's seven-widebody plus one-narrowbody terminal limit.
      const others=airport.gates.filter(g=>g!==gate&&g.active!==false&&bayFor(airport.id,g.plotId)?.precinct==='Terminal');
      const wide=others.filter(g=>bayFor(airport.id,g.plotId).code==='E');
      if(bay.code==='E')for(const g of wide.slice(6))g.active=false;
      if(wide.length+(bay.code==='E'?1:0)>=7){
        const narrow=others.filter(g=>bayFor(airport.id,g.plotId).code==='C');
        for(const g of narrow.slice(bay.code==='E'?1:0))g.active=false;
      }
    }
  } else if (command.type === 'upgrade-gate') {
    const gate = airport.gates.find(item => item.id === command.gateId);
    if (!gate) fail('UNKNOWN_GATE', 'Choose an existing gate.');
    const price = getGateQuote(airport, gate.plotId, gate.size + 1, gate);
    charge(career, airport, price, command.useDiamonds);
    addTask(airport, at, price, { kind: 'gate', gateId: gate.id, plotId: gate.plotId, size: gate.size + 1, label: `${AIRCRAFT_CLASSES[gate.size + 1]?.name || 'Larger'} gate · ${gate.id}` });
  } else if (command.type === 'research') {
    if (typeof command.researchId !== 'string' || !own(researchById, command.researchId)) fail('UNKNOWN_RESEARCH', 'Choose a research project.');
    const project = researchById[command.researchId], price = getResearchQuote(airport, project);
    charge(career, airport, price, command.useDiamonds);
    addTask(airport, at, price, { kind: 'research', researchId: project.id, label: project.name });
  } else if (command.type === 'skip-task') {
    const task = airport.constructions.find(item => item.id === command.taskId);
    if (!task) fail('UNKNOWN_TASK', 'That project has already finished or is unavailable.');
    const cost = Math.max(1, Math.ceil((task.endsAt - at) / 300_000));
    if (career.diamonds < cost) fail('INSUFFICIENT_DIAMONDS', 'There are not enough diamonds to finish this timer.');
    career.diamonds -= cost; task.endsAt = at; finishEvents(airport, at);
  } else if (command.type === 'boost') {
    const boost = BOOST_OPTIONS.find(item => item.multiplier === command.multiplier && item.durationMinutes === command.durationMinutes);
    if (!boost) fail('INVALID_BOOST', 'Choose a listed multiplier and duration.');
    if (airport.boost && airport.boost.endsAt > at) fail('BOOST_ACTIVE', 'This airport already has an active boost.');
    if (career.diamonds < boost.diamondCost) fail('INSUFFICIENT_DIAMONDS', 'There are not enough diamonds for this boost.');
    career.diamonds -= boost.diamondCost;
    airport.boost = { multiplier: boost.multiplier, startedAt: at, endsAt: at + boost.durationMs, durationMinutes: boost.durationMinutes };
  } else if (command.type === 'claim-milestone') {
    const milestone = MILESTONES.find(item => item.id === command.milestoneId);
    if (!milestone) fail('UNKNOWN_MILESTONE', 'Choose a known milestone.');
    if (airport.claimedMilestones.includes(milestone.id)) fail('ALREADY_CLAIMED', 'This milestone reward has already been collected.');
    if (milestoneProgress(airport, milestone) < milestone.target) fail('MILESTONE_INCOMPLETE', 'Complete this milestone before collecting its reward.');
    airport.claimedMilestones.push(milestone.id);
    addCash(airport, milestone.reward.cash); addResearch(airport, milestone.reward.research); addDiamonds(career, milestone.reward.diamonds);
  } else fail('UNKNOWN_COMMAND', 'That airport command is not supported.');
  return career;
}

function projectedRates(airport, now) {
  const boost = airport.boost && airport.boost.endsAt > now ? airport.boost.multiplier : 1;
  return airport.gates.reduce((rates, gate) => {
    const plan = gatePlan(airport, gate); if (!plan) return rates;
    const departures = 3_600_000 / plan.intervalMs;
    rates.departuresPerHour += departures; rates.cashPerHour += departures * plan.income * boost;
    rates.researchPerHour += departures * plan.researchUnits / 10;
    return rates;
  }, { cashPerHour: 0, researchPerHour: 0, departuresPerHour: 0 });
}

/** Public projection is read-only: server settles/persists before projecting.
 * Calling this never generates rewards or advances an RNG. */
export function projectCareer(career, now = career.lastSettledAt) {
  assertCareer(career); validTime(now);
  const airports = AIRPORTS.map(meta => {
    const state = career.airports[meta.id], unlock = unlockView(career, meta);
    const base = { ...copy(meta), className: AIRCRAFT_CLASSES[meta.maxSize].name, maxClassName: AIRCRAFT_CLASSES[meta.maxSize].name,
      owned: Boolean(state), unlocked: Boolean(state), available: unlock.available, unlock };
    if (!state) return base;
    const buildings = BUILDINGS.map(building => {
      const task = state.constructions.find(item => item.building === building.key);
      if(meta.id===GATEWAY_ID&&building.key==='runwayLength')building={...building,name:'Runway operating length',description:'Certify more of the six 4,500 m runways for larger aircraft.'};
      return { ...building, label: building.name, level: state.buildings[building.key], maxLevel: maximumBuildingLevel(state, building),
        currentLabel: buildingLabel(building.key, state.buildings[building.key]), quote: getBuildingQuote(state, building.key), upgrading: Boolean(task), taskId: task?.id || null };
    });
    const gates = state.gates.map(gate => {
      const plan = gatePlan(state, gate), task = state.constructions.find(item => item.gateId === gate.id);
      return { id: gate.id, plotId: gate.plotId, size: gate.size, label: bayFor(meta.id, gate.plotId)?.label || (meta.id===GATEWAY_ID?`Stand ${gatewayPlot(gate.plotId).label}`:`Gate ${gate.id.slice(5)}`),
        bay: bayFor(meta.id, gate.plotId), active: !['brisbane','gold-coast'].includes(meta.id) || activeBayPlots(state).has(gate.plotId), className: AIRCRAFT_CLASSES[gate.size].name,
        maxSize: bayFor(meta.id, gate.plotId)?.maxSize ?? meta.maxSize, quote: getGateQuote(state, gate.plotId, gate.size + 1, gate), aircraft: plan ? copy(plan.aircraft) : null,
        currentAircraft: plan ? copy(plan.aircraft) : null, currentAircraftId: plan?.aircraft.id || null,
        operationType: plan?.aircraft.cargo > 0 ? 'cargo' : 'passenger', special: plan?.aircraft.special || null,
        departures: gate.departures, progress: plan ? gate.progressMs / plan.intervalMs : 0, serviceDurationMs: plan?.intervalMs || 0,
        upgrading: Boolean(task), status: plan ? 'operating' : 'waiting', taskId: task?.id || null };
    });
    const gatePlots = Array.from({ length: meta.gatePlots }, (_, index) => {
      const id = `plot-${index + 1}`, gate = state.gates.find(item => item.plotId === id), task = state.constructions.find(item => item.plotId === id);
      const bay = bayFor(meta.id, id), maximum = bay?.maxSize ?? meta.maxSize;
      return { id, label: bay?.label || (meta.id===GATEWAY_ID?`Stand ${gatewayPlot(id).label}`:`Plot ${index + 1}`), bay, maxSize: maximum, occupied: Boolean(gate || task), gateId: gate?.id || task?.gateId || null,
        quote: getGateQuote(state, id, 0), sizeQuotes: AIRCRAFT_CLASSES.filter(item => item.size <= maximum).map(item => ({ size: item.size, name: item.name, quote: getGateQuote(state, id, item.size) })) };
    });
    const constructions = state.constructions.map(task => ({ ...copy(task), remainingMs: Math.max(0, task.endsAt - now),
      progress: Math.min(1, Math.max(0, (now - task.startedAt) / Math.max(1, task.endsAt - task.startedAt))), skipDiamonds: Math.max(1, Math.ceil((task.endsAt - now) / 300_000)) }));
    const aircraftRequirements = AIRCRAFT.map(aircraft => {
      const missing = aircraftMissingRequirements(state, aircraft);
      return { ...copy(aircraft), className: AIRCRAFT_CLASSES[aircraft.size].name, eligible: missing.length === 0, missing, locationCompatible: aircraft.size <= meta.maxSize };
    });
    const researchProjects = RESEARCH_PROJECTS.map(project => ({ ...copy(project), completed: state.researchCompleted.includes(project.id),
      active: state.constructions.some(task => task.researchId === project.id), quote: getResearchQuote(state, project) }));
    const milestones = MILESTONES.map(milestone => {
      const current = milestoneProgress(state, milestone), complete = current >= milestone.target, claimed = state.claimedMilestones.includes(milestone.id);
      return { ...copy(milestone), current, complete, claimed, canClaim: complete && !claimed };
    });
    const rates = projectedRates(state, now);
    const nextUpgrade = buildings.filter(item => item.quote.available && item.quote.affordable).sort((a, b) => a.quote.cashCost - b.quote.cashCost)[0] || null;
    return { ...base, cash: state.cash, research: state.research, openedAt: state.openedAt, buildings, gates, gatePlots, constructions,
      researchProjects, researchCompleted: [...state.researchCompleted], milestones, aircraftRequirements, aircraft: aircraftRequirements,
      eligibleAircraft: aircraftRequirements.filter(item => item.eligible), rates, hourlyRates: rates, stats: copy(state.stats),
      boost: state.boost ? { ...state.boost, remainingMs: Math.max(0, state.boost.endsAt - now) } : null,
      nextUpgrade: nextUpgrade ? { building: nextUpgrade.key, label: nextUpgrade.name, quote: nextUpgrade.quote } : null,
      recentDepartures: copy(state.recentDepartures), runwayLength: RUNWAY_LENGTHS[state.buildings.runwayLength - 1],
      runwaySurface: state.buildings.runwaySurface, taxiwayLevel: state.buildings.taxiway,
      nextUnlock: AIRPORTS.find(item => item.unlock?.predecessor === meta.id)?.id || null };
  });
  const selectedAirport = airports.find(item => item.id === career.selectedAirportId);
  return { version: career.version, revision: career.revision, diamonds: career.diamonds, selectedAirportId: career.selectedAirportId,
    selectedAirport, airports, locations: airports, lastSettledAt: career.lastSettledAt, createdAt: career.createdAt,
    offlineCapHours: 24, boostOptions: copy(BOOST_OPTIONS), aircraftClasses: copy(AIRCRAFT_CLASSES), surfaces: copy(SURFACES),
    rules: { exchangeRate: 10, depositsAllowed: false, boostDescription: 'Cash only; research, departure speed and diamond odds remain unchanged.',
      simulationNotice: 'Airport footprints and aircraft requirements are simplified game rules. The An-225 is a fictional heritage contract.' } };
}
