// Pure map presentation. Inputs are public geography or the filtered PlayerView;
// this module neither fetches match state nor derives hidden formations/orders.
export const MAP_MODES = Object.freeze(['political', 'relations', 'terrain', 'morale']);
export const MAP_DEFAULT_LAYERS = Object.freeze({ mode: 'political', cities: true, units: true, ranges: true, routes: true });
export const TERRAIN_COLORS = Object.freeze({ plains: '#65735b', urban: '#827766', forest: '#3e6554', mountains: '#827d71', mountain: '#827d71', hills: '#777c61', desert: '#a38d65', tundra: '#85928c', wetland: '#557f79' });
export const RELATION_COLORS = Object.freeze({ friendly: '#62bea2', hostile: '#ed8b83', allied: '#88b5e3', neutral: '#a8b6bb' });
const RELATION_FILLS = Object.freeze({ friendly: '#35665b', hostile: '#774d50', allied: '#42627d', neutral: '#526167' });

export function normalizeMapLayers(current = MAP_DEFAULT_LAYERS, patch = {}) {
  const result = { ...MAP_DEFAULT_LAYERS };
  for (const values of [current, patch]) {
    if (MAP_MODES.includes(values?.mode)) result.mode = values.mode;
    for (const key of ['cities', 'units', 'ranges', 'routes']) if (typeof values?.[key] === 'boolean') result[key] = values[key];
  }
  return result;
}

export function nationColor(id = '') {
  let hash = 2166136261;
  for (const char of String(id)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return `hsl(${hash % 360} ${28 + hash % 13}% ${32 + hash % 9}%)`;
}

export function moraleColor(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '#394b54';
  const morale = Math.max(0, Math.min(100, value));
  return `hsl(${Math.round(9 + morale * 1.1)} 35% ${Math.round(36 + morale * .05)}%)`;
}

export function provinceColor({ mode, ownerId, relation = 'neutral', terrain, morale }) {
  if (mode === 'terrain') return TERRAIN_COLORS[terrain] || '#61716b';
  if (mode === 'morale') return moraleColor(morale);
  if (mode === 'relations') return RELATION_FILLS[relation] || RELATION_FILLS.neutral;
  return nationColor(ownerId);
}

export function getMapLegend(mode = 'political') {
  if (mode === 'morale') return { title: 'Reported morale', entries: [{ label: 'Low', color: moraleColor(0) }, { label: '50%', color: moraleColor(50) }, { label: '100%', color: moraleColor(100) }, { label: 'Unreported', color: moraleColor(null) }], note: 'Unreported morale is shown in grey.' };
  if (mode === 'terrain') return { title: 'Terrain', entries: ['plains', 'urban', 'forest', 'mountains', 'hills', 'desert', 'tundra', 'wetland'].map(label => ({ label: label[0].toUpperCase() + label.slice(1), color: TERRAIN_COLORS[label] })), note: 'Terrain categories used by the simulation.' };
  const names = { friendly: 'Your nation', hostile: 'At war', allied: 'Allied', neutral: 'Other nations' };
  return { title: mode === 'relations' ? 'Diplomatic relations' : 'Political ownership', entries: Object.entries(mode === 'relations' ? RELATION_FILLS : RELATION_COLORS).map(([id, color]) => ({ label: mode === 'political' ? names[id] + ' border' : names[id], color })), note: mode === 'political' ? 'National colours follow current ownership. Gold marks your selection.' : 'Gold marks your selection.' };
}

export function markerRole(platform = {}, domain = platform.domain) {
  const has = (...flags) => flags.some(flag => platform.capabilities?.includes(flag));
  if (domain === 'missile') return has('interceptor') ? 'air-defense' : 'missile';
  if (domain === 'sea' || domain === 'naval') return has('submarine') ? 'submarine' : has('carrier', 'air-base-at-sea') ? 'carrier' : 'ship';
  if (domain === 'air') return platform.role === 'rotary' ? 'helicopter' : platform.role === 'drones' ? 'drone' : has('airborne-radar') ? 'radar' : 'aircraft';
  if (has('armor')) return 'armor';
  if (has('rocket-artillery', 'indirect-fire')) return 'artillery';
  if (platform.role === 'air-defense' || has('air-defense', 'missile-defense', 'point-defense')) return 'air-defense';
  if (has('ground-radar', 'air-picture', 'electronic-attack') || platform.role === 'sensors') return 'radar';
  if (has('entrench')) return 'engineers';
  if (has('repair', 'resupply') || domain === 'support') return 'support';
  return 'infantry';
}

export const ROLE_PATHS = Object.freeze({
  infantry: 'M-7-5H7V5H-7ZM-7-5 7 5M7-5-7 5',
  armor: 'M-8 1Q-8-3-4-3H4Q8-3 8 1Q8 5 4 5H-4Q-8 5-8 1ZM-4-3V-6H3V-3M1-6 9-8',
  artillery: 'M-5 4A3 3 0 1 0 1 4A3 3 0 1 0-5 4M-2 1 6-7 9-6 1 4M-5 6-9 8M1 6 6 8',
  'air-defense': 'M-8 5H8M-6 0 0-6 6 0M0-6V6M-9-5Q0-14 9-5',
  aircraft: 'M0-9 2-2 9 2V4L2 2V7L5 9 0 8-5 9-2 7V2L-9 4V2L-2-2Z',
  helicopter: 'M-9-7H9M0-7V-3M-6 0Q-6-3-2-3H3Q6-3 6 0V3H-6ZM6 0 10-3M-4 6H6',
  drone: 'M-7-7-2-2H2L7-7M-7 7-2 2H2L7 7M-9-7H-5M5-7H9M-9 7H-5M5 7H9M-2-2H2V2H-2Z',
  ship: 'M-9 2H9L5 7H-5ZM-5 2V-3H5V2M0-3V-8H5M-9 9-5 8-1 9 3 8 8 9',
  submarine: 'M-9 2Q-9-2-4-2H5Q9-2 9 2Q9 6 5 6H-4Q-9 6-9 2ZM0-2V-7H4',
  carrier: 'M-8-7H5L8-3V7H-8ZM-3-6V6M4-2H8M4 2H8',
  missile: 'M-5 4 3-7 8-9 8-4-2 7ZM-4 4-9 8-3 7M-2 6 0 10 3 4',
  radar: 'M-7-6A10 10 0 0 0 7 8ZM0 1 7-6M-4 9 0 1 5 9M-7 10H8',
  engineers: 'M-8-6 7 8M-5-8-9-3M-6 7 7-6M3-9 9-3',
  support: 'M-8-6H8V6H-8ZM0-4V4M-4 0H4',
});

export function selectedOwnUnits(view, selected) {
  if (!view?.player?.nationId) return [];
  const ids = selected instanceof Set ? selected : new Set(selected || []);
  return (view?.units || []).filter(unit => ids.has(unit.id) && unit.nationId === view?.player?.nationId);
}

// Keep every selectable formation at its real marker position. A stack is the
// first choice; subsequent choices expose its members and overlapping contacts.
export function denseMarkerChoices(hits, x, y) {
  return hits.filter(hit => Math.abs(hit.x - x) < hit.halfWidth && Math.abs(hit.y - y) < hit.halfHeight)
    .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))
    .flatMap(hit => [hit.units, ...(hit.units.length > 1 ? hit.units.map(unit => [unit]) : [])])
    .map(units => ({ unitIds: units.map(unit => unit.id), countryId: units[0].nationId, provinceId: units[0].provinceId }));
}

export function cityLabelVisible(city, scale, selectedProvince) {
  return Boolean(city.capital || city.province === selectedProvince || scale >= (city.port ? 12 : 24));
}

// A game-kilometre circle uses spherical geography, rather than stretching an
// arbitrary screen ellipse at high latitudes. Longitudes remain canonical.
export function rangeRing(lng, lat, radiusKm, segments = 72) {
  if (![lng, lat, radiusKm].every(Number.isFinite) || radiusKm <= 0) return [];
  const radians = Math.PI / 180, latitude = lat * radians, longitude = lng * radians, arc = Math.min(Math.PI, radiusKm / 6371);
  return Array.from({ length: segments + 1 }, (_, index) => {
    const bearing = index / segments * Math.PI * 2;
    const phi = Math.asin(Math.sin(latitude) * Math.cos(arc) + Math.cos(latitude) * Math.sin(arc) * Math.cos(bearing));
    const lambda = longitude + Math.atan2(Math.sin(bearing) * Math.sin(arc) * Math.cos(latitude), Math.cos(arc) - Math.sin(latitude) * Math.sin(phi));
    return { lng: ((lambda / radians + 540) % 360) - 180, lat: phi / radians };
  });
}
