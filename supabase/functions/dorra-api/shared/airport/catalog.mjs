import {GOLD_COAST_BAYS} from './gold-coast-bays.mjs';
import {GATEWAY_GATE_COUNT} from './queensland-gateway-data.mjs';
import {BRISBANE_BAYS} from './brisbane-bays.mjs';
/** Airport infrastructure requirements are deliberately simplified game rules,
 * not operational aviation guidance. Distances are expressed in metres. */
export const AIRCRAFT_CLASSES = Object.freeze([
  { id: 'light', name: 'Light', label: 'Small regional', size: 0, examples: 'C172 · Cessna Caravan', colour: '#78b867' },
  { id: 'regional', name: 'Regional', label: 'Regional turboprops', size: 1, examples: 'ATR 72 · Dash 8 Q400', colour: '#5db8ac' },
  { id: 'small', name: 'Small', label: 'Small jets', size: 2, examples: 'A220 · Embraer · B717', colour: '#5cace0' },
  { id: 'medium', name: 'Medium', label: 'Medium jets', size: 3, examples: 'B737 · A320 · B757', colour: '#897ddd' },
  { id: 'heavy', name: 'Heavy', label: 'Heavy widebodies', size: 4, examples: 'B767 · B777 · A350', colour: '#d780bb' },
  { id: 'super', name: 'Super', label: 'Super heavy', size: 5, examples: 'A380 · B747 · C-5 · An-225', colour: '#e4aa4c' }
]);

export const SURFACES = Object.freeze([
  { level: 1, id: 'dirt', name: 'Compacted dirt', shortName: 'Dirt', colour: '#b7976f' },
  { level: 2, id: 'gravel', name: 'Stabilised gravel', shortName: 'Gravel', colour: '#a6a195' },
  { level: 3, id: 'asphalt', name: 'Sealed asphalt', shortName: 'Asphalt', colour: '#657581' },
  { level: 4, id: 'reinforced', name: 'Reinforced asphalt', shortName: 'Reinforced', colour: '#4a5966' },
  { level: 5, id: 'concrete', name: 'Heavy-duty concrete', shortName: 'Concrete', colour: '#b5c5cc' }
]);

export const RUNWAY_LENGTHS = Object.freeze([600, 800, 1_000, 1_200, 1_400, 1_500, 1_600, 1_750, 1_800, 2_000, 2_400, 2_800, 3_200, 3_600, 4_000, 4_500]);

export const AIRPORTS = Object.freeze([
  { id: 'redcliffe', code: 'YRED', name: 'Redcliffe Airport', region: 'Moreton Bay', location: 'Redcliffe, Queensland', order: 0, maxClass: 'light', maxSize: 0, maxRunwayLength: 800, gatePlots: 4, demand: 1, colour: '#72bba4', coordinates: [-27.207, 153.067], fictional: false, grant: 500, unlockCash: 0, unlockDiamonds: 0, description: 'A coastal flying club and your first working airstrip.', unlock: null },
  { id: 'archerfield', code: 'YBAF', name: 'Archerfield Airport', region: 'Brisbane South', location: 'Archerfield, Queensland', order: 1, maxClass: 'regional', maxSize: 1, maxRunwayLength: 1_400, gatePlots: 5, demand: 1.15, colour: '#6dac69', coordinates: [-27.571, 153.008], fictional: false, grant: 1_500, unlockCash: 2_500, unlockDiamonds: 80, description: 'Develop a busy suburban base for regional propeller aircraft.', unlock: { predecessor: 'redcliffe', operatingHours: 18, departures: 180, surface: 2, terminal: 2, gates: 2 } },
  { id: 'granite-plains', code: 'YQGI', name: 'Queensland Gateway International', region: 'Queensland mega hub', location: 'Gateway City, Queensland', order: 2, maxClass: 'super', maxSize: 5, maxRunwayLength: 4_500, gatePlots: GATEWAY_GATE_COUNT, runwayCount: 6, demand: 2.8, colour: '#509eaa', coordinates: [-27.65, 151.1], fictional: true, grant: 6_000, unlockCash: 12_000, unlockDiamonds: 140, description: 'Queensland’s fictional mega hub: six 4,500 m runways, 192 stands, five passenger terminals, global freight, airport rail and super-heavy aircraft.', unlock: { predecessor: 'archerfield', operatingHours: 24, departures: 400, surface: 3, terminal: 2, gates: 2 } },
  { id: 'hamilton-island', code: 'YBHM', name: 'Hamilton Island Airport', region: 'Whitsundays', location: 'Hamilton Island, Queensland', order: 3, maxClass: 'medium', maxSize: 3, maxRunwayLength: 2_400, gatePlots: 7, demand: 1.5, colour: '#43bdb7', coordinates: [-20.358, 148.951], fictional: false, grant: 20_000, unlockCash: 55_000, unlockDiamonds: 240, description: 'An island holiday gateway, with a fixed footprint and strong leisure demand.', unlock: { predecessor: 'granite-plains', servedClass: 2, operatingHours: 36, departures: 550, surface: 3, terminal: 3, gates: 3 } },
  { id: 'sunshine-coast', code: 'YBSU', name: 'Sunshine Coast Airport', region: 'Sunshine Coast', location: 'Marcoola, Queensland', order: 4, maxClass: 'heavy', maxSize: 4, maxRunwayLength: 3_200, gatePlots: 8, demand: 1.7, colour: '#e4bc6f', coordinates: [-26.603, 153.091], fictional: false, grant: 60_000, unlockCash: 220_000, unlockDiamonds: 400, description: 'Grow a beachside gateway into a destination for heavy international aircraft.', unlock: { predecessor: 'hamilton-island', operatingHours: 36, departures: 700, surface: 4, terminal: 3, gates: 3 } },
  { id: 'gold-coast', code: 'YBCG', name: 'Gold Coast Airport', region: 'Gold Coast', location: 'Coolangatta, Queensland', order: 5, maxClass: 'heavy', maxSize: 4, maxRunwayLength: 3_200, gatePlots: GOLD_COAST_BAYS.length, demand: 1.95, colour: '#db9b73', coordinates: [-28.164, 153.505], fictional: false, grant: 150_000, unlockCash: 750_000, unlockDiamonds: 650, description: 'A high-demand tourism hub built for a busy fleet of heavy widebodies.', unlock: { predecessor: 'sunshine-coast', operatingHours: 48, departures: 900, surface: 4, terminal: 4, gates: 4 } },
  { id: 'brisbane', code: 'YBBN', name: 'Brisbane Airport', region: 'River City', location: 'Brisbane, Queensland', order: 6, maxClass: 'super', maxSize: 5, maxRunwayLength: 4_000, gatePlots: BRISBANE_BAYS.length, demand: 2.25, colour: '#87aedc', coordinates: [-27.384, 153.117], fictional: false, grant: 400_000, unlockCash: 2_500_000, unlockDiamonds: 1_000, description: 'Your flagship international and cargo hub, with space for the largest aircraft.', unlock: { predecessor: 'gold-coast', operatingHours: 48, departures: 1_100, surface: 5, terminal: 4, gates: 4 } }
]);

const plane = (id, name, classId, runwayLength, surface, handling, terminal, tower, income, serviceSeconds, research, extra = {}) => ({
  id, name, classId, size: AIRCRAFT_CLASSES.find(item => item.id === classId).size,
  runwayLength, surface, taxiway: surface, handling, terminal, tower,
  income, serviceSeconds, research, cargo: 0, certification: null, ...extra
});
export const AIRCRAFT = Object.freeze([
  plane('c172', 'Cessna 172', 'light', 600, 1, 1, 1, 1, 8, 90, 1),
  plane('caravan', 'Cessna 208 Caravan', 'light', 800, 1, 1, 1, 1, 14, 105, 2),
  plane('king-air', 'Beechcraft King Air 350', 'regional', 1_200, 3, 2, 1, 1, 30, 125, 3),
  plane('atr42', 'ATR 42', 'regional', 1_200, 3, 2, 1, 2, 50, 145, 3),
  plane('atr72', 'ATR 72', 'regional', 1_400, 3, 2, 2, 2, 72, 155, 4),
  plane('q400', 'De Havilland Dash 8 Q400', 'regional', 1_400, 3, 2, 2, 2, 85, 165, 4),
  plane('e175', 'Embraer E175', 'small', 1_500, 3, 3, 2, 2, 145, 175, 5, { certification: 'jet-operations' }),
  plane('b717', 'Boeing 717', 'small', 1_800, 3, 3, 2, 2, 175, 185, 6, { certification: 'jet-operations' }),
  plane('a220', 'Airbus A220', 'small', 1_800, 3, 3, 2, 2, 210, 195, 6, { certification: 'jet-operations' }),
  plane('e195', 'Embraer E195-E2', 'small', 2_000, 3, 3, 2, 2, 235, 205, 7, { certification: 'jet-operations' }),
  plane('b737', 'Boeing 737-800', 'medium', 1_750, 4, 3, 3, 3, 390, 210, 8, { certification: 'jet-operations' }),
  plane('a320', 'Airbus A320neo', 'medium', 2_000, 4, 3, 3, 3, 420, 215, 8, { certification: 'jet-operations' }),
  plane('a321', 'Airbus A321neo', 'medium', 2_400, 4, 3, 3, 3, 530, 230, 9, { certification: 'jet-operations' }),
  plane('b757', 'Boeing 757-200', 'medium', 2_400, 4, 3, 3, 3, 610, 245, 10, { certification: 'jet-operations' }),
  plane('b767', 'Boeing 767-300', 'heavy', 2_400, 4, 4, 4, 4, 1_000, 265, 12, { certification: 'widebody-operations' }),
  plane('a330', 'Airbus A330-300', 'heavy', 2_800, 4, 4, 4, 4, 1_200, 275, 13, { certification: 'widebody-operations' }),
  plane('b777', 'Boeing 777-300ER', 'heavy', 3_200, 4, 4, 4, 4, 1_700, 295, 15, { certification: 'widebody-operations' }),
  plane('a350', 'Airbus A350-1000', 'heavy', 3_200, 4, 4, 4, 4, 1_850, 305, 16, { certification: 'widebody-operations' }),
  plane('b747', 'Boeing 747-8', 'super', 3_200, 5, 5, 5, 5, 3_400, 335, 22, { certification: 'super-operations' }),
  plane('a380', 'Airbus A380-800', 'super', 3_600, 5, 5, 5, 5, 4_100, 360, 25, { certification: 'super-operations' }),
  plane('c5', 'Lockheed C-5 Galaxy', 'super', 3_600, 5, 5, 4, 5, 4_600, 385, 27, { cargo: 4, certification: 'super-operations', special: 'Special cargo contract' }),
  plane('an225', 'Antonov An-225 Mriya', 'super', 4_000, 5, 5, 4, 5, 6_500, 420, 32, { cargo: 5, certification: 'super-operations', special: 'Heritage aircraft · fictional special cargo operation' })
]);

export const BUILDINGS = Object.freeze([
  { key: 'runwaySurface', name: 'Runway surface', maxLevel: 5, baseCost: 150, researchBase: 0, durationSeconds: 30, description: 'Stronger pavement permits larger, heavier aircraft.' },
  { key: 'runwayLength', name: 'Runway length', maxLevel: RUNWAY_LENGTHS.length, baseCost: 175, researchBase: 0, durationSeconds: 40, description: 'Extend the runway within this location’s physical limit.' },
  { key: 'taxiway', name: 'Taxiway surface', maxLevel: 5, baseCost: 125, researchBase: 0, durationSeconds: 20, description: 'Connect stronger stands and runway pavement.' },
  { key: 'handling', name: 'Ground equipment', maxLevel: 5, baseCost: 250, researchBase: 10, durationSeconds: 45, description: 'Fuel bowsers, ground power, tugs and heavy aircraft equipment.' },
  { key: 'terminal', name: 'Passenger terminal', maxLevel: 5, baseCost: 150, researchBase: 5, durationSeconds: 40, description: 'Process larger aircraft and earn more from every passenger.' },
  { key: 'tower', name: 'Control tower', maxLevel: 5, baseCost: 200, researchBase: 10, durationSeconds: 40, description: 'Unlock bigger traffic and reduce stand turnaround time.' },
  { key: 'researchLab', name: 'Research centre', maxLevel: 5, baseCost: 125, researchBase: 0, durationSeconds: 25, description: 'Earn more research points from each departure.' },
  { key: 'cargo', name: 'Cargo terminal', maxLevel: 5, baseCost: 450, researchBase: 20, durationSeconds: 60, description: 'Add freight revenue and unlock special super-heavy cargo flights.' }
]);

export const RESEARCH_PROJECTS = Object.freeze([
  { id: 'turnaround', name: 'Quick turnaround', description: 'Ground crews service every departure 15% faster.', cashCost: 400, researchCost: 80, durationMs: 120_000, minClass: 0, requires: [], multiplier: 1 },
  { id: 'passenger-service', name: 'Passenger experience', description: 'Improve revenue from every departure by 20%.', cashCost: 700, researchCost: 140, durationMs: 180_000, minClass: 0, requires: [], multiplier: 1 },
  { id: 'jet-operations', name: 'Jet operations', description: 'Certify this location for small and medium passenger jets.', cashCost: 1_800, researchCost: 200, durationMs: 240_000, minClass: 2, requires: [], multiplier: 1 },
  { id: 'widebody-operations', name: 'Widebody operations', description: 'Certify this location for heavy international aircraft.', cashCost: 14_000, researchCost: 850, durationMs: 600_000, minClass: 4, requires: ['jet-operations'], multiplier: 1 },
  { id: 'super-operations', name: 'Super-heavy operations', description: 'Certify this airport for the largest passenger and cargo aircraft.', cashCost: 85_000, researchCost: 2_200, durationMs: 1_200_000, minClass: 5, requires: ['widebody-operations'], multiplier: 1 },
  { id: 'research-network', name: 'Research network', description: 'Double research points generated at this airport.', cashCost: 4_000, researchCost: 400, durationMs: 300_000, minClass: 0, requires: ['turnaround'], multiplier: 1 }
]);

export const GATE_COSTS = Object.freeze([250, 1_400, 7_000, 28_000, 150_000, 650_000]);
export const GATE_DURATIONS = Object.freeze([45_000, 90_000, 180_000, 360_000, 720_000, 1_200_000]);
export const BOOST_OPTIONS = Object.freeze([2, 5, 10].flatMap(multiplier => [5, 15, 30, 60].map((durationMinutes, index) => ({
  multiplier, durationMinutes, durationMs: durationMinutes * 60_000,
  diamondCost: [5, 12, 20, 35][index] * ({ 2: 1, 5: 3, 10: 6 }[multiplier])
}))));
export const MILESTONES = Object.freeze([
  { id: 'first-flights', title: 'First departures', description: 'Complete ten departures at this airport.', metric: 'departures', target: 10, reward: { cash: 150, research: 20, diamonds: 10 } },
  { id: 'busy-apron', title: 'A busy apron', description: 'Complete one hundred departures.', metric: 'departures', target: 100, reward: { cash: 600, research: 80, diamonds: 20 } },
  { id: 'regional-landmark', title: 'Local landmark', description: 'Complete five hundred departures.', metric: 'departures', target: 500, reward: { cash: 2_000, research: 200, diamonds: 20 } },
  { id: 'airport-network', title: 'A thousand connections', description: 'Complete one thousand departures.', metric: 'departures', target: 1_000, reward: { cash: 5_000, research: 400, diamonds: 30 } },
  { id: 'full-apron', title: 'Room to grow', description: 'Operate at least three gates.', metric: 'gates', target: 3, reward: { cash: 500, research: 60, diamonds: 10 } },
  { id: 'paved-future', title: 'A paved future', description: 'Complete a level three runway surface.', metric: 'surface', target: 3, reward: { cash: 1_000, research: 100, diamonds: 10 } }
]);

export const AIRPORT_BY_ID = Object.freeze(Object.fromEntries(AIRPORTS.map(item => [item.id, item])));
export const AIRCRAFT_BY_ID = Object.freeze(Object.fromEntries(AIRCRAFT.map(item => [item.id, item])));
