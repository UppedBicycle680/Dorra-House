import { BRANCHES, FACILITIES, PLATFORMS, getResearchCost } from './catalog.mjs';

const byId = new Map(PLATFORMS.map(platform => [platform.id, platform]));
const facilityNames = new Map(FACILITIES.map(facility => [facility.id, facility.name]));
const title = value => String(value || '').replaceAll('-', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const ids = values => new Set((values || []).map(value => typeof value === 'string' ? value : value.platformId || value.id));
const has = (platform, capability) => (platform.capabilities || []).includes(capability);
const any = (platform, capabilities) => capabilities.some(capability => has(platform, capability));
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export const PRESENTATION_NOTICE = 'All ratings, ranges, speeds, prices and timers are Dorra game values, not real vehicle specifications. Tiers show existing facility requirements; links show actual prerequisite programmes.';
export const RESEARCH_STATES = Object.freeze({ complete: 'Research complete', researching: 'Researching', available: 'Ready to research', locked: 'Requirements not met' });

const ROLES = {
  infantry: ['Infantry', 'infantry', 'Captures and holds territory.'],
  mechanized: ['Mechanized infantry', 'mechanized', 'Mobile ground forces for capturing and holding territory.'],
  'protected-mobility': ['Protected mobility', 'mechanized', 'Protected ground movement and territorial control.'],
  armour: ['Armour', 'tank', 'Heavy ground combat and territorial control.'],
  artillery: ['Tube artillery', 'artillery', 'Ranged fire support against compatible ground targets.'],
  'rocket-artillery': ['Rocket artillery', 'rocket-artillery', 'Longer range ground fire support.'],
  'air-defence': ['Air defence', 'air-defence', 'Protects forces from aircraft with its air-defence rating.'],
  interceptor: ['Missile interceptor', 'interceptor', 'A defensive, single-use missile for protecting friendly airspace.'],
  fighter: ['Air superiority', 'fighter', 'Air combat and defensive interception.'],
  multirole: ['Multirole aviation', 'fighter', 'Air combat and compatible surface strikes.'],
  strike: ['Strike aviation', 'strike-aircraft', 'Air strikes against compatible surface targets.'],
  bomber: ['Strategic aviation', 'bomber', 'Longer range conventional strikes.'],
  'attack-helicopter': ['Attack helicopter', 'helicopter', 'Close air support against compatible ground formations.'],
  'maritime-aircraft': ['Maritime patrol & ASW', 'maritime-aircraft', 'Maritime surveillance and submarine warfare.'],
  'asw-helicopter': ['Maritime helicopter', 'helicopter', 'Submarine warfare and maritime surveillance.'],
  'transport-aircraft': ['Air transport & support', 'transport-aircraft', 'Support aviation with no general strike weapon.'],
  'armed-drone': ['Armed reconnaissance', 'drone', 'Persistent observation with a strike capability.'],
  'isr-drone': ['Reconnaissance drone', 'drone', 'Observation and detection rather than general strike damage.'],
  carrier: ['Aircraft carrier', 'carrier', 'A mobile base for compatible national naval aircraft.'],
  submarine: ['Submarine', 'submarine', 'Stealthy naval warfare; detection and weapons depend on the opposing sensors.'],
  destroyer: ['Destroyer', 'destroyer', 'Naval combat with the sensors and weapons listed below.'],
  frigate: ['Frigate', 'frigate', 'Naval escort and maritime combat.'],
  corvette: ['Corvette', 'corvette', 'Surface combat and coastal sea control.'],
  naval: ['Surface fleet', 'frigate', 'Naval combat with its listed weapons and sensors.'],
  'anti-ship-missile': ['Anti-ship missile', 'anti-ship-missile', 'A single-use strike against a detected hostile surface vessel or embarked formation.'],
  'cruise-missile': ['Land-attack missile', 'cruise-missile', 'A single-use conventional strike against eligible hostile targets.'],
  nuclear: ['Strategic nuclear capability', 'strategic-missile', 'A strategic area strike with fallout and collateral damage.'],
  engineers: ['Combat engineering', 'engineers', 'Field repair, entrenchment and territorial support.'],
  logistics: ['Logistics & repair', 'logistics', 'Sustains and repairs friendly forces using normal supplies.'],
  reconnaissance: ['Ground reconnaissance', 'reconnaissance', 'Observation and scouting support.'],
  radar: ['Radar & surveillance', 'radar', 'Sensor coverage and warning.'],
  aew: ['Airborne early warning', 'radar-aircraft', 'Airborne radar and observation.'],
  'electronic-warfare': ['Electronic warfare', 'electronic-warfare', 'Electronic protection or sensor suppression as listed.'],
  command: ['Command programme', 'command', 'A research programme that unlocks dependent equipment.'],
};

function roleFor(platform) {
  if (platform.nuclear || has(platform, 'strategic-nuclear')) return 'nuclear';
  if (has(platform, 'interceptor')) return 'interceptor';
  if (platform.buildable === false) return 'command';
  if (platform.domain === 'missile') return has(platform, 'anti-ship') ? 'anti-ship-missile' : 'cruise-missile';
  if (platform.domain === 'sea') return ['carrier', 'submarine', 'destroyer', 'frigate', 'corvette'].find(role => has(platform, role)) || 'naval';
  if (platform.domain === 'air') {
    if (has(platform, 'anti-submarine')) return platform.role === 'rotary' ? 'asw-helicopter' : 'maritime-aircraft';
    if (has(platform, 'airborne-radar')) return 'aew';
    if (any(platform, ['electronic-attack', 'radar-suppression'])) return 'electronic-warfare';
    if (platform.role === 'drones') return number(platform.stats?.attack) > 0 && any(platform, ['strike', 'precision-strike']) ? 'armed-drone' : 'isr-drone';
    if (!(number(platform.stats?.attack) > 0)) return 'transport-aircraft';
    if (platform.role === 'rotary') return 'attack-helicopter';
    if (has(platform, 'strategic-strike')) return 'bomber';
    if (has(platform, 'multirole')) return 'multirole';
    if (has(platform, 'air-superiority')) return 'fighter';
    return 'strike';
  }
  if (any(platform, ['electronic-attack', 'radar-suppression', 'electronic-protection'])) return 'electronic-warfare';
  if (any(platform, ['ground-radar', 'air-picture']) || platform.role === 'sensors' && number(platform.stats?.radar) > 0) return 'radar';
  if (platform.role === 'air-defense' || has(platform, 'air-defense')) return 'air-defence';
  if (has(platform, 'rocket-artillery')) return 'rocket-artillery';
  if (has(platform, 'indirect-fire')) return 'artillery';
  if (has(platform, 'armor')) return 'armour';
  if (has(platform, 'entrench')) return 'engineers';
  if (any(platform, ['resupply', 'repair'])) return 'logistics';
  if (platform.domain === 'support' || platform.role === 'sensors') return 'reconnaissance';
  if (has(platform, 'mechanized')) return 'mechanized';
  if (has(platform, 'protected-mobility')) return 'protected-mobility';
  return 'infantry';
}

const CAPABILITY_DETAILS = {
  capture: ['Territory control', 'Can capture and hold eligible provinces.'],
  garrison: ['Garrison', 'A ground formation for holding territory.'],
  repair: ['Field repair', 'Helps damaged friendly formations recover when normal supply and safety conditions permit.'],
  resupply: ['Logistical support', 'Supports friendly forces under the server supply rules.'],
  entrench: ['Entrenchment support', 'Can support friendly entrenchment in safe positions.'],
  doctrine: ['Combined operations', 'Unlocks the equipment programmes linked to this research.'],
  command: ['Networked command', 'Unlocks the equipment programmes linked to this research.'],
  'indirect-fire': ['Indirect fire', 'Ranged bombardment uses the listed game range and target eligibility.'],
  'rocket-artillery': ['Rocket artillery', 'A ranged fire-support role; these ratings are game balance.'],
  'anti-armor': ['Anti-armour', 'Has a combat advantage against armoured targets.'],
  'anti-submarine': ['Anti-submarine warfare', 'Can engage submarines when they are detected and within range.'],
  sonar: ['Sonar', 'Helps detect submarine contacts; detection still depends on stealth and range.'],
  radar: ['Radar', 'Contributes radar detection where its radar rating applies.'],
  'missile-defense': ['Missile defence', 'Can contribute to interception of incoming missiles when ready.'],
  'point-defense': ['Point defence', 'Can contribute local missile defence when ready.'],
  interceptor: ['Defensive interceptor', 'Defends an own or allied province. It is expended when it engages an incoming missile.'],
  submarine: ['Submerged operations', 'Submarine stealth requires appropriate opposing detection and anti-submarine weapons.'],
  carrier: ['Carrier basing', 'Hosts only documented compatible national naval aircraft, within deck capacity.'],
  'air-base-at-sea': ['Air base at sea', 'Provides carrier basing for compatible aircraft.'],
  'anti-ship': ['Anti-ship weapons', 'Engages eligible surface naval targets; this flag alone does not provide anti-submarine weapons.'],
  'air-superiority': ['Air superiority', 'Specializes in air combat using its air-defence rating.'],
  'strategic-nuclear': ['Nuclear area effect', 'Fallout and collateral damage can affect friendly and neutral formations.'],
  'radar-suppression': ['Radar suppression', 'Can reduce hostile sensor effectiveness under the server electronic-warfare rules.'],
  'electronic-protection': ['Electronic protection', 'Provides the electronic support authored for this platform.'],
  'single-use': ['Single use', 'The formation is expended when its missile operation resolves.'],
};

export function getPlatformPresentation(platformOrId, { nationId } = {}) {
  const platform = typeof platformOrId === 'string' ? byId.get(platformOrId) : platformOrId;
  if (!platform?.id) return null;
  const roleId = roleFor(platform), [roleLabel, iconKey, summary] = ROLES[roleId];
  const strengths = [], cautions = [];
  if (has(platform, 'capture')) strengths.push('Can secure territory');
  if (number(platform.stats?.airDefense) > 0) strengths.push('Can engage aircraft');
  if (has(platform, 'anti-submarine') || platform.domain === 'sea' && has(platform, 'sonar') && number(platform.stats?.attack) > 0) strengths.push('Can engage detected submarines');
  if (has(platform, 'indirect-fire')) strengths.push('Ranged ground fire support');
  if (has(platform, 'anti-armor')) strengths.push('Advantage against armour');
  if (any(platform, ['repair', 'resupply', 'entrench'])) strengths.push('Supports friendly formations');
  if (number(platform.stats?.radar) > 0) strengths.push('Radar detection');
  if (number(platform.stats?.stealth) > 0) strengths.push('Reduced detectability');
  if (platform.buildable === false) cautions.push('Research programme only. It does not produce a formation or automatically upgrade existing vehicles.');
  else if (number(platform.stats?.attack) <= 0) cautions.push('No general strike damage. Its value comes from the listed support and sensor capabilities.');
  if (platform.buildable !== false && number(platform.stats?.airDefense) <= 0 && platform.domain !== 'missile') cautions.push('Cannot engage airborne aircraft. Protect it with fighters or air defence.');
  if (['air', 'sea'].includes(platform.domain) && !has(platform, 'anti-submarine') && !(platform.domain === 'sea' && has(platform, 'sonar'))) cautions.push('No anti-submarine weapon capability.');
  if (platform.domain === 'air') {
    cautions.push('Sorties require a valid base and fuel, then return automatically.');
    if (!any(platform, ['strike', 'multirole', 'precision-strike', 'strategic-strike', 'close-support', 'anti-armor'])) cautions.push('No land-strike capability against formations ashore.');
  }
  if (has(platform, 'interceptor')) cautions.push('Defensive use only; cannot attack or bombard. Single use when an incoming missile is engaged.');
  if (platform.domain === 'missile' && has(platform, 'anti-ship')) cautions.push('Requires a visible hostile surface vessel or embarked target. Submarines are excluded.');
  if (platform.nuclear || has(platform, 'strategic-nuclear')) cautions.push('Nuclear strike: fallout and collateral damage can affect friendly and neutral forces.');
  if (has(platform, 'submarine')) cautions.push('Vulnerable to detected anti-submarine attacks. Ground strikes require a listed cruise-missile capability.');
  const carrierVariant = nationId ? platform.carrierVariants?.[nationId] || null : null;
  if (nationId && platform.carrierVariants && !carrierVariant) cautions.push('This national fleet is not documented as a carrier-compatible variant.');
  const statDefinitions = [
    ['attack', 'Attack rating', 'game rating'], ['defense', 'Defence rating', 'game rating'],
    ['airDefense', 'Air defence', 'game rating'], ['range', 'Weapon range', 'game km'],
    ['speed', 'Movement speed', 'game km/h'], ['vision', 'Visual detection', 'game km'],
    ['radar', 'Radar detection', 'game km'], ['sonar', 'Sonar detection', 'game km'], ['stealth', 'Stealth', 'game rating'],
  ];
  return {
    id: platform.id, name: platform.name, roleId, roleLabel, iconKey, artKey: platform.branch, summary,
    domainLabel: { land: 'Land', air: 'Air', sea: 'Naval', missile: 'Missile', support: 'Support' }[platform.domain] || title(platform.domain),
    strengths: [...new Set(strengths)], cautions: [...new Set(cautions)],
    stats: statDefinitions.filter(([id]) => Number.isFinite(Number(platform.stats?.[id]))).map(([id, label, unit]) => ({ id, label, value: Number(platform.stats[id]), unit })),
    capabilities: (platform.capabilities || []).map(id => ({ id, label: CAPABILITY_DETAILS[id]?.[0] || title(id), detail: CAPABILITY_DETAILS[id]?.[1] || 'A catalogue role flag; operational effects depend on the server rules and listed ratings.' })),
    buildable: platform.buildable !== false, abstractCapability: platform.abstractCapability === true, operators: [...(platform.operators || [])],
    carrierVariant, sourceUrl: platform.sourceUrl || null, balanceNotice: PRESENTATION_NOTICE,
  };
}

function eligibilityFor(platform, view, serverIds) {
  const nationId = view.player.nationId, operators = platform.operators || [];
  const universal = operators.includes('*'), national = operators.includes(nationId);
  const donorNationIds = operators.filter(id => id !== '*' && id !== nationId);
  const licensed = donorNationIds.some(id => (view.player.importLicenses || []).includes(id));
  const strategic = platform.nuclear || has(platform, 'strategic-nuclear');
  const exportable = !strategic && platform.exportable !== false;
  const eligible = serverIds ? serverIds.has(platform.id) : universal || national || exportable && licensed;
  const kind = eligible ? universal ? 'universal' : national ? 'national' : 'licensed' : !national && !universal && exportable ? 'import-required' : 'unavailable';
  const detail = eligible ? kind === 'universal' ? 'Shared scenario capability; no national hardware inventory is claimed.' : kind === 'national' ? 'Included in your national operator catalogue.' : 'Available in your server-approved imported equipment catalogue.' : national || universal ? 'Not present in the current server-approved research catalogue.' : kind === 'import-required' ? 'Requires an approved diplomatic import licence from an operating nation; research, facilities and costs still apply.' : strategic ? 'Strategic and nuclear programmes cannot be imported.' : platform.exportable === false ? 'This programme is not available for diplomatic export.' : 'Not present in the server-approved research catalogue.';
  return { kind, eligible, exportable, donorNationIds, detail };
}

export function buildResearchTree(view, { branchId, includeUnavailable = false } = {}) {
  if (!view?.player) return { branches: [], nodes: [], links: [], slots: { used: 0, total: 2, free: 2 }, notice: PRESENTATION_NOTICE };
  const serverCatalogue = Array.isArray(view.catalog?.platforms) ? view.catalog.platforms : null;
  const serverIds = serverCatalogue ? new Set(serverCatalogue.map(platform => platform.id)) : null;
  const all = new Map(PLATFORMS.map(platform => [platform.id, platform]));
  for (const platform of serverCatalogue || []) all.set(platform.id, platform);
  const researched = ids(view.player.research), queue = view.player.researchQueue || [];
  const slots = { used: queue.length, total: 2, free: Math.max(0, 2 - queue.length) };
  const owned = (view.provinces || []).filter(province => province.ownerId === view.player.nationId);
  const labs = owned.filter(province => number(province.facilities?.['intelligence-center']) >= 1).map(province => province.id);
  const running = ['running', 'active'].includes(view.match?.status);
  const nodes = [...all.values()].filter(platform => includeUnavailable || eligibilityFor(platform, view, serverIds).eligible).map(platform => {
    const eligibility = eligibilityFor(platform, view, serverIds);
    const level = Math.max(1, number(platform.level) || 1), facilityId = platform.facility || 'army-base';
    const facilityProvinces = owned.filter(province => number(province.facilities?.[facilityId]) >= level).map(province => province.id);
    const facility = { id: facilityId, name: facilityNames.get(facilityId) || title(facilityId), level, ready: facilityProvinces.length > 0, provinceIds: facilityProvinces };
    const cost = getResearchCost(platform), durationSeconds = Math.max(1, number(platform.researchHours)) * 3600;
    const currentQueue = queue.find(item => item.platformId === platform.id) || null;
    const complete = researched.has(platform.id);
    const requirements = [
      { kind: 'eligibility', id: 'national-access', label: 'National or licensed access', met: eligibility.eligible, detail: eligibility.detail },
      ...(platform.prerequisites || []).map(id => ({ kind: 'prerequisite', id, label: all.get(id)?.name || title(id), met: researched.has(id), detail: `Complete ${all.get(id)?.name || title(id)} research first.` })),
      { kind: 'laboratory', id: 'intelligence-center', label: 'Intelligence centre · L1', met: labs.length > 0, detail: 'Own at least one intelligence centre at level 1 or above.' },
      { kind: 'facility', id: facilityId, label: `${facility.name} · L${level}`, met: facility.ready, detail: `Own at least one ${facility.name.toLowerCase()} at level ${level} or above.` },
      ...Object.entries(cost).map(([id, required]) => ({ kind: 'resource', id, label: `${title(id)} · ${required}`, met: number(view.player.resources?.[id]) >= required, required, current: number(view.player.resources?.[id]), detail: `Requires ${required} ${id} from your war economy.` })),
      { kind: 'slots', id: 'research-slot', label: 'Research slot', met: slots.free > 0, detail: 'At most two research projects can run simultaneously.' },
      { kind: 'world', id: 'running', label: 'Running operation', met: running, detail: 'Launch or resume the operation to begin research.' },
    ];
    const blockingReasons = complete || currentQueue ? [] : requirements.filter(requirement => !requirement.met).map(requirement => requirement.detail);
    const state = complete ? 'complete' : currentQueue ? 'researching' : blockingReasons.length ? 'locked' : 'available';
    const queuePresentation = currentQueue ? { ...currentQueue, remainingSeconds: Number.isFinite(Number(currentQueue.due)) ? Math.max(0, Number(currentQueue.due) - number(view.match?.gameTime)) : null, progress: Number.isFinite(currentQueue.progress) ? Math.max(0, Math.min(1, currentQueue.progress > 1 ? currentQueue.progress / 100 : currentQueue.progress)) : null } : null;
    return {
      id: platform.id, name: platform.name, branchId: platform.branch, level, platform,
      state, stateLabel: RESEARCH_STATES[state], complete, canResearch: state === 'available',
      accessibleLabel: `${platform.name}. Tier ${level}. ${RESEARCH_STATES[state]}.${blockingReasons.length ? ' ' + blockingReasons.join(' ') : ''}`,
      eligibility, facility, requirements, blockingReasons, cost, durationSeconds, queue: queuePresentation,
      presentation: getPlatformPresentation(platform, { nationId: view.player.nationId }),
      production: { buildable: platform.buildable !== false, researched: complete, facilityReady: facility.ready, cost: { ...platform.cost }, durationSeconds: Math.max(.5, number(platform.buildHours)) * 3600 },
    };
  }).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  const nodeIds = new Set(nodes.map(node => node.id));
  const links = nodes.flatMap(node => (node.platform.prerequisites || []).map(from => ({ from, to: node.id, met: researched.has(from), external: !nodeIds.has(from), fromBranchId: all.get(from)?.branch || null, toBranchId: node.branchId })));
  const branches = BRANCHES.filter(branch => !branchId || branch.id === branchId).map(branch => {
    const members = nodes.filter(node => node.branchId === branch.id);
    return { ...branch, counts: Object.fromEntries(Object.keys(RESEARCH_STATES).map(state => [state, members.filter(node => node.state === state).length])), tiers: [...new Set(members.map(node => node.level))].sort((a, b) => a - b).map(level => ({ level, label: `Tier ${level}`, nodes: members.filter(node => node.level === level) })) };
  });
  return { branches, nodes, links, slots, notice: PRESENTATION_NOTICE };
}
