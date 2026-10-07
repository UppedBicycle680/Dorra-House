const WORLD_DATA_URL = new URL('./assets/world/countries-110m.geojson', import.meta.url);

const DEFAULT_VIEW = Object.freeze({ lat: 18, lng: 12, altitude: 2.15 });
const PALETTE = Object.freeze({
  globe: '#070b12',
  atmosphere: '#5fc9ff',
  neutral: '#182432',
  unavailable: '#111a24',
  available: '#24415a',
  allied: '#315268',
  controlled: '#1f897d',
  contested: '#b7525f',
  selected: '#f2b84b',
  home: '#65e0d1',
  border: 'rgba(145, 181, 205, 0.35)',
  route: '#f4c566',
  routeSuccess: '#65e0d1',
  routeFailure: '#df6874',
  supply: '#43c9b8',
  supplyStretched: '#b58b4f',
  supplyDisrupted: '#d95f6d',
  friendlyUnit: '#72e6f1',
  oppositionUnit: '#ff6675',
  selectedUnit: '#ffffff'
});

const STATUS_LABELS = Object.freeze({
  home: 'Home command',
  selected: 'Selected market',
  contested: 'Contested rights',
  controlled: 'Dorra rights secured',
  allied: 'Aligned market',
  available: 'Campaign available',
  unavailable: 'Rights unavailable',
  neutral: 'Unassessed market'
});

const CODE_KEYS = Object.freeze([
  'ISO_A3', 'iso_a3', 'ADM0_A3', 'adm0_a3', 'SOV_A3', 'sov_a3',
  'BRK_A3', 'brk_a3', 'GU_A3', 'gu_a3', 'ISO_A2', 'iso_a2'
]);

const NAME_KEYS = Object.freeze([
  'NAME_LONG', 'name_long', 'ADMIN', 'admin', 'NAME_EN', 'name_en',
  'NAME', 'name', 'SOVEREIGNT', 'sovereignt'
]);

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

function firstDefined(source, keys) {
  for (const key of keys) {
    if (hasOwn(source, key)) return source[key];
  }
  return undefined;
}

function normalizeCode(value) {
  if (value && typeof value === 'object') {
    value = firstDefined(value, [
      'countryCode', 'countryId', 'iso3', 'iso2', 'code', 'id',
      'homeCountryCode', 'targetCountryCode'
    ]);
  }
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).trim().toUpperCase();
}

function normalizeCodeSet(value) {
  if (!Array.isArray(value) && !(value instanceof Set)) return new Set();
  const result = new Set();
  for (const item of value) {
    const code = normalizeCode(item);
    if (code) result.add(code);
  }
  return result;
}

function stableUnitInterval(value) {
  let hash = 2166136261;
  for (const character of String(value || 'campaign-route')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function featureProperties(feature) {
  return feature && typeof feature.properties === 'object' ? feature.properties : {};
}

function countryCodes(feature) {
  const properties = featureProperties(feature);
  const result = [];
  for (const key of CODE_KEYS) {
    const code = normalizeCode(properties[key]);
    if (code && code !== '-99' && !result.includes(code)) result.push(code);
  }
  return result;
}

function primaryCountryCode(feature) {
  const properties = featureProperties(feature);
  const iso2 = normalizeCode(properties.ISO_A2 || properties.iso_a2);
  if (iso2 && iso2 !== '-99') return iso2;
  return countryCodes(feature).find((code) => code.length === 3)
    || countryCodes(feature)[0]
    || '';
}

function countryName(feature) {
  const properties = featureProperties(feature);
  for (const key of NAME_KEYS) {
    const value = properties[key];
    if (typeof value === 'string' && value.trim() && value !== '-99') return value.trim();
  }
  return primaryCountryCode(feature) || 'Unknown country';
}

function safeText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function finiteProperty(properties, keys) {
  for (const key of keys) {
    const value = Number(properties[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function visitCoordinates(value, visitor) {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) {
    visitor(Number(value[0]), Number(value[1]));
    return;
  }
  for (const item of value) visitCoordinates(item, visitor);
}

function geometryCentroid(feature) {
  const properties = featureProperties(feature);
  const lng = finiteProperty(properties, [
    'LABEL_X', 'label_x', 'LONGITUDE', 'longitude', 'LON', 'lon', 'CENTROID_X', 'centroid_x'
  ]);
  const lat = finiteProperty(properties, [
    'LABEL_Y', 'label_y', 'LATITUDE', 'latitude', 'LAT', 'lat', 'CENTROID_Y', 'centroid_y'
  ]);
  if (lat !== null && lng !== null) return { lat: clamp(lat, -90, 90), lng: clamp(lng, -180, 180) };

  let minLat = 90;
  let maxLat = -90;
  let minLng = 180;
  let maxLng = -180;
  let count = 0;
  visitCoordinates(feature?.geometry?.coordinates, (pointLng, pointLat) => {
    minLat = Math.min(minLat, pointLat);
    maxLat = Math.max(maxLat, pointLat);
    minLng = Math.min(minLng, pointLng);
    maxLng = Math.max(maxLng, pointLng);
    count += 1;
  });
  if (!count) return null;
  return {
    lat: clamp((minLat + maxLat) / 2, -90, 90),
    lng: clamp((minLng + maxLng) / 2, -180, 180)
  };
}

function webGlAvailable() {
  if (typeof document === 'undefined' || typeof globalThis.WebGLRenderingContext === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function getGlobeFactory() {
  const candidate = globalThis.Globe;
  if (typeof candidate === 'function') return candidate;
  if (candidate && typeof candidate.default === 'function') return candidate.default;
  return null;
}

function resolveReducedMotion(option) {
  if (typeof option === 'boolean') return option;
  return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

async function loadCountries(signal) {
  const response = await fetch(WORLD_DATA_URL, {
    cache: 'force-cache',
    credentials: 'same-origin',
    signal
  });
  if (!response.ok) throw new Error(`Country map request failed (${response.status}).`);
  const data = await response.json();
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features) || !data.features.length) {
    throw new Error('Country map data is not a valid GeoJSON FeatureCollection.');
  }
  return data.features.filter((feature) => feature?.geometry && countryCodes(feature).length);
}

function createInitialVisualState() {
  return {
    homeCode: '',
    targetCode: '',
    routeFromCode: '',
    routeToCode: '',
    routeOutcome: 'planned',
    showRoute: true,
    controlledCodes: new Set(),
    contestedCodes: new Set(),
    alliedCodes: new Set(),
    availableCodes: null,
    unitMarkers: [],
    unitRoutes: [],
    supplyRoutes: []
  };
}

function updateVisualState(previous, input = {}) {
  const next = { ...previous };
  const homeValue = firstDefined(input, ['homeCountryCode', 'homeCountry', 'originCountryCode', 'origin']);
  const targetValue = firstDefined(input, ['targetCountryCode', 'targetCountry', 'selectedCountryCode', 'selectedCountry']);
  if (homeValue !== undefined) next.homeCode = normalizeCode(homeValue);
  if (targetValue !== undefined) next.targetCode = normalizeCode(targetValue);

  const controlled = firstDefined(input, ['controlledCountryCodes', 'controlledCountries', 'ownedCountryCodes', 'ownedCountries']);
  const contested = firstDefined(input, ['contestedCountryCodes', 'contestedCountries', 'hostileCountryCodes', 'hostileCountries']);
  const allied = firstDefined(input, ['alliedCountryCodes', 'alliedCountries']);
  const available = firstDefined(input, ['availableCountryCodes', 'availableCountries', 'eligibleCountryCodes', 'eligibleCountries']);
  if (controlled !== undefined) next.controlledCodes = normalizeCodeSet(controlled);
  if (contested !== undefined) next.contestedCodes = normalizeCodeSet(contested);
  if (allied !== undefined) next.alliedCodes = normalizeCodeSet(allied);
  if (available !== undefined) next.availableCodes = available === null ? null : normalizeCodeSet(available);

  const route = input.route && typeof input.route === 'object' ? input.route : {};
  const routeFrom = firstDefined(route, ['fromCountryCode', 'fromCountry', 'from', 'origin']);
  const routeTo = firstDefined(route, ['toCountryCode', 'toCountry', 'to', 'target']);
  if (routeFrom !== undefined) next.routeFromCode = normalizeCode(routeFrom);
  else if (homeValue !== undefined) next.routeFromCode = next.homeCode;
  if (routeTo !== undefined) next.routeToCode = normalizeCode(routeTo);
  else if (targetValue !== undefined) next.routeToCode = next.targetCode;

  const routeOutcome = firstDefined(route, ['outcome', 'status'])
    ?? firstDefined(input, ['routeOutcome', 'battleOutcome']);
  if (routeOutcome !== undefined) {
    const normalizedOutcome = String(routeOutcome).toLowerCase();
    next.routeOutcome = ['success', 'victory', 'won'].includes(normalizedOutcome)
      ? 'success'
      : ['failure', 'defeat', 'lost'].includes(normalizedOutcome)
        ? 'failure'
        : 'planned';
  }
  const routeVisible = firstDefined(route, ['visible', 'active']) ?? input.showRoute;
  if (routeVisible !== undefined) next.showRoute = Boolean(routeVisible);
  const units = firstDefined(input, ['unitMarkers', 'mapUnits', 'forces']);
  if (units !== undefined) next.unitMarkers = Array.isArray(units) ? units.filter(Boolean).slice(0, 100).map((unit) => ({ ...unit })) : [];
  const unitRoutes = firstDefined(input, ['unitRoutes', 'movementRoutes']);
  if (unitRoutes !== undefined) next.unitRoutes = Array.isArray(unitRoutes) ? unitRoutes.filter(Boolean).slice(0, 20).map((item) => ({ ...item })) : [];
  const supplyRoutes = firstDefined(input, ['supplyRoutes', 'logisticsRoutes']);
  if (supplyRoutes !== undefined) next.supplyRoutes = Array.isArray(supplyRoutes) ? supplyRoutes.filter(Boolean).slice(0, 40).map((item) => ({ ...item })) : [];
  return next;
}

function setContainsFeature(set, feature) {
  if (!(set instanceof Set) || !set.size) return false;
  return countryCodes(feature).some((code) => set.has(code));
}

function featureMatchesCode(feature, code) {
  return Boolean(code) && countryCodes(feature).includes(normalizeCode(code));
}

function statusForFeature(feature, state) {
  if (featureMatchesCode(feature, state.homeCode)) return 'home';
  if (featureMatchesCode(feature, state.targetCode)) return 'selected';
  if (setContainsFeature(state.contestedCodes, feature)) return 'contested';
  if (setContainsFeature(state.controlledCodes, feature)) return 'controlled';
  if (setContainsFeature(state.alliedCodes, feature)) return 'allied';
  if (state.availableCodes instanceof Set) {
    return setContainsFeature(state.availableCodes, feature) ? 'available' : 'unavailable';
  }
  return 'neutral';
}

function colorForStatus(status) {
  return PALETTE[status] || PALETTE.neutral;
}

function setInlineStyles(element, styles) {
  Object.assign(element.style, styles);
  return element;
}

function callGlobe(globe, method, ...args) {
  if (globe && typeof globe[method] === 'function') return globe[method](...args);
  return undefined;
}

export class CampaignGlobeController {
  constructor(container, options = {}) {
    if (!(container instanceof Element)) throw new TypeError('Campaign globe requires a DOM element container.');
    this.container = container;
    this.options = options && typeof options === 'object' ? options : {};
    this.visualState = createInitialVisualState();
    this.features = [];
    this.countryIndex = new Map();
    this.globe = null;
    this.root = null;
    this.stage = null;
    this.fallbackDetail = null;
    this.fallbackReason = '';
    this.mode = 'loading';
    this.active = true;
    this.disposed = false;
    this.resizeFrame = 0;
    this.lastSize = { width: 0, height: 0 };
    this.abortController = new AbortController();
    this.reducedMotion = resolveReducedMotion(this.options.reducedMotion);
    this.motionQuery = typeof this.options.reducedMotion === 'boolean'
      ? null
      : globalThis.matchMedia?.('(prefers-reduced-motion: reduce)') || null;
    this.boundMotionChange = (event) => {
      this.reducedMotion = Boolean(event.matches);
      this.configureMotion();
      this.applyVisualState();
    };
  }

  async mount() {
    this.createRoot();
    try {
      this.features = await loadCountries(this.abortController.signal);
      if (this.disposed) return this;
      this.buildCountryIndex();

      if (!webGlAvailable()) {
        this.renderFallback('3D graphics are unavailable on this device. Campaign controls remain active.');
        return this;
      }
      const factory = getGlobeFactory();
      if (!factory) {
        this.renderFallback('The local 3D globe library did not load. Campaign controls remain active.');
        return this;
      }
      this.mountGlobe(factory);
    } catch (error) {
      if (!this.disposed && error?.name !== 'AbortError') {
        this.renderFallback('The world map could not be loaded. Campaign controls remain active.');
        this.options.onError?.(error);
      }
    }
    return this;
  }

  createRoot() {
    for (const child of [...this.container.children]) {
      if (child instanceof HTMLElement && child.dataset.campaignGlobeRoot === 'true') child.remove();
    }
    const root = document.createElement('div');
    root.dataset.campaignGlobeRoot = 'true';
    root.className = 'campaign-globe-renderer';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Interactive world campaign map');
    setInlineStyles(root, {
      position: 'relative',
      width: '100%',
      height: '100%',
      minHeight: '320px',
      overflow: 'hidden',
      borderRadius: 'inherit',
      isolation: 'isolate',
      background: 'radial-gradient(circle at 52% 44%, #14253a 0%, #080d16 43%, #030508 100%)'
    });
    const stage = document.createElement('div');
    stage.className = 'campaign-globe-stage';
    setInlineStyles(stage, { position: 'absolute', inset: '0' });
    root.append(stage);
    this.container.append(root);
    this.root = root;
    this.stage = stage;
  }

  buildCountryIndex() {
    this.countryIndex.clear();
    for (const feature of this.features) {
      for (const code of countryCodes(feature)) this.countryIndex.set(code, feature);
      const nameKey = normalizeCode(countryName(feature));
      if (nameKey) this.countryIndex.set(nameKey, feature);
    }
  }

  mountGlobe(factory) {
    let globe;
    try {
      globe = factory({ waitForGlobeReady: true, animateIn: !this.reducedMotion })(this.stage);
    } catch {
      globe = factory()(this.stage);
    }
    this.globe = globe;
    this.mode = 'globe';

    callGlobe(globe, 'backgroundColor', 'rgba(0,0,0,0)');
    callGlobe(globe, 'showGlobe', true);
    callGlobe(globe, 'showAtmosphere', true);
    callGlobe(globe, 'atmosphereColor', PALETTE.atmosphere);
    callGlobe(globe, 'atmosphereAltitude', 0.17);
    callGlobe(globe, 'showGraticules', true);
    callGlobe(globe, 'polygonsData', this.features);
    callGlobe(globe, 'polygonCapCurvatureResolution', 4);
    callGlobe(globe, 'polygonLabel', (feature) => {
      const status = statusForFeature(feature, this.visualState);
      return `<b>${safeText(countryName(feature))}</b><br>${STATUS_LABELS[status]}`;
    });
    callGlobe(globe, 'polygonCapColor', (feature) => colorForStatus(statusForFeature(feature, this.visualState)));
    callGlobe(globe, 'polygonSideColor', (feature) => {
      const status = statusForFeature(feature, this.visualState);
      return status === 'selected' || status === 'home' ? 'rgba(101,224,209,0.5)' : 'rgba(8,14,21,0.82)';
    });
    callGlobe(globe, 'polygonStrokeColor', () => PALETTE.border);
    callGlobe(globe, 'polygonAltitude', (feature) => {
      const status = statusForFeature(feature, this.visualState);
      if (status === 'selected') return 0.025;
      if (status === 'home') return 0.018;
      if (status === 'controlled' || status === 'contested') return 0.012;
      return 0.006;
    });
    callGlobe(globe, 'onPolygonClick', (feature) => this.handleCountrySelect(feature));
    callGlobe(globe, 'onPolygonHover', (feature) => {
      if (this.stage) this.stage.style.cursor = feature ? 'pointer' : 'grab';
    });

    callGlobe(globe, 'pointLat', 'lat');
    callGlobe(globe, 'pointLng', 'lng');
    callGlobe(globe, 'pointAltitude', 'altitude');
    callGlobe(globe, 'pointRadius', 'radius');
    callGlobe(globe, 'pointColor', 'color');
    callGlobe(globe, 'pointLabel', (point) => `<b>${safeText(point.name)}</b><br>${safeText(point.detail || STATUS_LABELS[point.kind] || '')}`);
    callGlobe(globe, 'pointsMerge', false);
    callGlobe(globe, 'onPointClick', (point) => {
      if (point?.unitId) this.options.onUnitSelect?.(Object.freeze({ ...point }));
    });
    callGlobe(globe, 'onPointHover', (point) => {
      if (this.stage) this.stage.style.cursor = point?.unitId ? 'pointer' : point ? 'default' : 'grab';
    });

    callGlobe(globe, 'ringLat', 'lat');
    callGlobe(globe, 'ringLng', 'lng');
    callGlobe(globe, 'ringColor', 'color');
    callGlobe(globe, 'ringMaxRadius', (ring) => ring.maxRadius);
    callGlobe(globe, 'ringPropagationSpeed', (ring) => ring.speed);
    callGlobe(globe, 'ringRepeatPeriod', (ring) => ring.repeat);

    callGlobe(globe, 'arcStartLat', 'startLat');
    callGlobe(globe, 'arcStartLng', 'startLng');
    callGlobe(globe, 'arcEndLat', 'endLat');
    callGlobe(globe, 'arcEndLng', 'endLng');
    callGlobe(globe, 'arcColor', (arc) => [arc.startColor, arc.endColor]);
    callGlobe(globe, 'arcAltitudeAutoScale', 0.32);
    callGlobe(globe, 'arcStroke', (arc) => arc.kind === 'supply' ? arc.stroke || 0.55 : 0.55);

    const material = callGlobe(globe, 'globeMaterial');
    material?.color?.set?.(PALETTE.globe);
    material?.emissive?.set?.('#03070d');
    if (material && 'emissiveIntensity' in material) material.emissiveIntensity = 0.72;
    if (material && 'shininess' in material) material.shininess = 8;
    if (material && 'roughness' in material) material.roughness = 0.9;

    const controls = callGlobe(globe, 'controls');
    if (controls) {
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.minDistance = 115;
      controls.maxDistance = 520;
      controls.autoRotateSpeed = 0;
    }

    this.motionQuery?.addEventListener?.('change', this.boundMotionChange);
    this.configureMotion();
    this.observeSize();
    this.resize();
    callGlobe(globe, 'pointOfView', DEFAULT_VIEW, this.reducedMotion ? 0 : 850);
    this.applyVisualState();
    this.options.onReady?.({ mode: this.mode, countryCount: this.features.length });
  }

  handleCountrySelect(feature) {
    if (!feature || this.disposed) return;
    const centroid = geometryCentroid(feature) || { lat: 0, lng: 0 };
    const payload = Object.freeze({
      countryCode: primaryCountryCode(feature),
      name: countryName(feature),
      continent: String(featureProperties(feature).CONTINENT || featureProperties(feature).continent || ''),
      lat: clamp(centroid.lat, -90, 90),
      lng: clamp(centroid.lng, -180, 180),
      status: statusForFeature(feature, this.visualState)
    });
    this.options.onCountrySelect?.(payload);
  }

  findCountry(code) {
    return this.countryIndex.get(normalizeCode(code)) || null;
  }

  makePoint(feature, kind) {
    const centroid = geometryCentroid(feature);
    if (!centroid) return null;
    const prominent = kind === 'home' || kind === 'selected';
    return {
      ...centroid,
      countryCode: primaryCountryCode(feature),
      name: countryName(feature),
      kind,
      color: colorForStatus(kind),
      altitude: prominent ? 0.035 : 0.024,
      radius: prominent ? 0.34 : 0.2
    };
  }

  collectPoints() {
    const points = [];
    const seen = new Set();
    const add = (feature, kind) => {
      if (!feature) return;
      const key = primaryCountryCode(feature) || countryName(feature);
      if (seen.has(key)) return;
      const point = this.makePoint(feature, kind);
      if (point) {
        seen.add(key);
        points.push(point);
      }
    };
    add(this.findCountry(this.visualState.homeCode), 'home');
    add(this.findCountry(this.visualState.targetCode), 'selected');
    for (const feature of this.features) {
      if (setContainsFeature(this.visualState.contestedCodes, feature)) add(feature, 'contested');
      else if (setContainsFeature(this.visualState.controlledCodes, feature)) add(feature, 'controlled');
    }
    const unitCounts = new Map();
    for (const marker of this.visualState.unitMarkers || []) {
      const feature = this.findCountry(marker.countryId || marker.countryCode),centroid = feature && geometryCentroid(feature);if (!centroid) continue;
      const count = unitCounts.get(marker.countryId) || 0;unitCounts.set(marker.countryId, count + 1);const angle = stableUnitInterval(marker.id || count) * Math.PI * 2,offset = count ? .7 + Math.min(2, count) * .35 : .55,selected = marker.selected === true,opposition = marker.side === 'opposition';
      points.push({lat:clamp(centroid.lat + Math.sin(angle) * offset,-88,88),lng:clamp(centroid.lng + Math.cos(angle) * offset,-180,180),countryCode:primaryCountryCode(feature),unitId:String(marker.id || ''),name:String(marker.name || 'Formation'),detail:String(marker.detail || `${opposition ? 'Opposition' : 'Friendly'} ${marker.domain || ''} formation`),kind:selected?'unit-selected':opposition?'unit-opposition':'unit-friendly',color:selected?PALETTE.selectedUnit:opposition?PALETTE.oppositionUnit:PALETTE.friendlyUnit,altitude:selected ? .075 : .06,radius:selected ? .62 : opposition ? .48 : .44,side:opposition?'opposition':'player'});
    }
    return points;
  }

  collectRings(points) {
    return points
      .filter((point) => point.kind === 'home' || point.kind === 'selected' || point.kind === 'contested' || point.kind === 'unit-selected')
      .map((point) => ({
        lat: point.lat,
        lng: point.lng,
        color: `${point.color}b8`,
        maxRadius: point.kind === 'selected' ? 4.2 : 2.8,
        speed: this.reducedMotion ? 0 : point.kind === 'selected' ? 2.2 : 1.35,
        repeat: this.reducedMotion ? 0 : point.kind === 'selected' ? 920 : 1450
      }));
  }

  collectArcs() {
    const arcs=[];
    for(const route of this.visualState.supplyRoutes||[]){const from=this.findCountry(route.from),to=this.findCountry(route.to),start=from&&geometryCentroid(from),end=to&&geometryCentroid(to),status=route.status||(route.active===false?'disrupted':'secure'),color=status==='disrupted'?PALETTE.supplyDisrupted:status==='strained'?PALETTE.supplyStretched:PALETTE.supply,integrity=clamp(route.integrity??100,0,100);if(start&&end&&from!==to)arcs.push({startLat:start.lat,startLng:start.lng,endLat:end.lat,endLng:end.lng,startColor:color,endColor:status==='disrupted'?PALETTE.routeFailure:color,kind:'supply',status,integrity,stroke:0.28+integrity/180})}
    for(const route of this.visualState.unitRoutes||[]){const from=this.findCountry(route.from),to=this.findCountry(route.to),start=from&&geometryCentroid(from),end=to&&geometryCentroid(to);if(start&&end&&from!==to)arcs.push({startLat:start.lat,startLng:start.lng,endLat:end.lat,endLng:end.lng,startColor:route.side==='opposition'?PALETTE.oppositionUnit:PALETTE.friendlyUnit,endColor:route.attack?PALETTE.routeFailure:PALETTE.route})}
    if (!this.visualState.showRoute) return arcs;
    const from = this.findCountry(this.visualState.routeFromCode || this.visualState.homeCode);
    const to = this.findCountry(this.visualState.routeToCode || this.visualState.targetCode);
    const start = from && geometryCentroid(from);
    const end = to && geometryCentroid(to);
    if (!start || !end || from === to) return arcs;
    const endColor = this.visualState.routeOutcome === 'success'
      ? PALETTE.routeSuccess
      : this.visualState.routeOutcome === 'failure'
        ? PALETTE.routeFailure
        : PALETTE.route;
    arcs.push({
      startLat: start.lat,
      startLng: start.lng,
      endLat: end.lat,
      endLng: end.lng,
      startColor: PALETTE.home,
      endColor
    });return arcs;
  }

  applyVisualState() {
    if (this.disposed) return;
    if (this.mode === 'fallback') {
      this.updateFallbackDetail();
      return;
    }
    if (!this.globe) return;

    const points = this.collectPoints();
    callGlobe(this.globe, 'polygonCapColor', (feature) => colorForStatus(statusForFeature(feature, this.visualState)));
    callGlobe(this.globe, 'polygonAltitude', (feature) => {
      const status = statusForFeature(feature, this.visualState);
      if (status === 'selected') return 0.025;
      if (status === 'home') return 0.018;
      if (status === 'controlled' || status === 'contested') return 0.012;
      return 0.006;
    });
    callGlobe(this.globe, 'pointsData', points);
    callGlobe(this.globe, 'ringsData', this.collectRings(points));
    callGlobe(this.globe, 'arcsData', this.collectArcs());
    const routeKey = `${this.visualState.routeFromCode || this.visualState.homeCode}:${this.visualState.routeToCode || this.visualState.targetCode}`;
    callGlobe(this.globe, 'arcDashInitialGap', this.reducedMotion ? 0 : stableUnitInterval(routeKey));
  }

  updateCampaignVisuals(nextState = {}) {
    if (this.disposed) return this;
    this.visualState = updateVisualState(this.visualState, nextState);
    this.applyVisualState();
    return this;
  }

  update(nextState = {}) {
    return this.updateCampaignVisuals(nextState);
  }

  getCountries() {
    const countries = this.features
      .map((feature) => {
        const centroid = geometryCentroid(feature) || { lat: 0, lng: 0 };
        return Object.freeze({
          countryCode: primaryCountryCode(feature),
          name: countryName(feature),
          continent: String(featureProperties(feature).CONTINENT || featureProperties(feature).continent || ''),
          lat: clamp(centroid.lat, -90, 90),
          lng: clamp(centroid.lng, -180, 180)
        });
      })
      .filter((country) => country.countryCode)
      .sort((left, right) => left.name.localeCompare(right.name));
    return Object.freeze(countries);
  }

  getCountryScreenPosition(code, altitude = 0.08) {
    const feature = this.findCountry(code);
    const centroid = feature && geometryCentroid(feature);
    if (!centroid || !this.root) return null;
    const bounds = this.root.getBoundingClientRect();
    if (this.mode === 'globe' && this.globe) {
      const point = callGlobe(this.globe, 'getScreenCoords', centroid.lat, centroid.lng, altitude);
      if (Number.isFinite(point?.x) && Number.isFinite(point?.y)) {
        return { x: point.x, y: point.y, width: bounds.width, height: bounds.height, lat: centroid.lat, lng: centroid.lng };
      }
    }
    return {
      x: ((centroid.lng + 180) / 360) * bounds.width,
      y: ((90 - centroid.lat) / 180) * bounds.height,
      width: bounds.width,
      height: bounds.height,
      lat: centroid.lat,
      lng: centroid.lng
    };
  }

  focusRoute(fromCode, toCode, options = {}) {
    const fromFeature = this.findCountry(fromCode), toFeature = this.findCountry(toCode);
    const from = fromFeature && geometryCentroid(fromFeature), to = toFeature && geometryCentroid(toFeature);
    if (!from || !to) return false;
    if (this.mode === 'fallback' || !this.globe) return true;
    const radians = value => value * Math.PI / 180;
    const degrees = value => value * 180 / Math.PI;
    const fromLng = radians(from.lng), toLng = radians(to.lng);
    const midpointLng = degrees(Math.atan2(Math.sin(fromLng) + Math.sin(toLng), Math.cos(fromLng) + Math.cos(toLng)));
    const latDistance = Math.abs(to.lat - from.lat), lngDistance = Math.abs(((to.lng - from.lng + 540) % 360) - 180);
    const span = Math.hypot(latDistance, lngDistance * Math.cos(radians((from.lat + to.lat) / 2)));
    const altitude = clamp(options.altitude ?? 1.5 + span / 72, 1.7, 3.35);
    const duration = this.reducedMotion ? 0 : clamp(options.duration ?? 760, 0, 5000);
    callGlobe(this.globe, 'pointOfView', { lat: (from.lat + to.lat) / 2, lng: midpointLng, altitude }, duration);
    return true;
  }

  focusCountry(code, options = {}) {
    const feature = this.findCountry(code);
    const centroid = feature && geometryCentroid(feature);
    if (!centroid) return false;
    if (this.mode === 'fallback') {
      this.updateFallbackDetail(feature);
      return true;
    }
    const altitude = clamp(options.altitude ?? 1.65, 1.1, 4);
    const duration = this.reducedMotion ? 0 : clamp(options.duration ?? 760, 0, 5000);
    callGlobe(this.globe, 'pointOfView', { ...centroid, altitude }, duration);
    return true;
  }

  showWorld(options = {}) {
    if (this.mode === 'fallback' || !this.globe) return false;
    const altitude = clamp(options.altitude ?? 2.35, 1.5, 4),duration = this.reducedMotion ? 0 : clamp(options.duration ?? 700, 0, 5000);
    callGlobe(this.globe, 'pointOfView', { ...DEFAULT_VIEW, altitude }, duration);
    return true;
  }

  configureMotion() {
    if (!this.globe) return;
    const controls = callGlobe(this.globe, 'controls');
    if (controls) controls.autoRotate = false;
    callGlobe(this.globe, 'polygonsTransitionDuration', this.reducedMotion ? 0 : 320);
    callGlobe(this.globe, 'pointsTransitionDuration', this.reducedMotion ? 0 : 320);
    callGlobe(this.globe, 'arcsTransitionDuration', this.reducedMotion ? 0 : 450);
    callGlobe(this.globe, 'arcDashLength', this.reducedMotion ? 1 : 0.48);
    callGlobe(this.globe, 'arcDashGap', this.reducedMotion ? 0 : 0.22);
    callGlobe(this.globe, 'arcDashInitialGap', this.reducedMotion ? 0 : stableUnitInterval('campaign-route'));
    callGlobe(this.globe, 'arcDashAnimateTime', this.reducedMotion ? 0 : 1450);
  }

  observeSize() {
    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
      this.resizeObserver.observe(this.root);
      return;
    }
    this.boundWindowResize = () => this.scheduleResize();
    globalThis.addEventListener?.('resize', this.boundWindowResize, { passive: true });
  }

  scheduleResize() {
    if (this.resizeFrame || this.disposed) return;
    const raf = globalThis.requestAnimationFrame || ((callback) => setTimeout(callback, 16));
    this.resizeFrame = raf(() => {
      this.resizeFrame = 0;
      this.resize();
    });
  }

  resize(width, height) {
    if (this.disposed || !this.root) return this;
    const bounds = this.root.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(Number(width) || bounds.width || this.container.clientWidth || 1));
    const nextHeight = Math.max(1, Math.round(Number(height) || bounds.height || this.container.clientHeight || 320));
    if (nextWidth === this.lastSize.width && nextHeight === this.lastSize.height) return this;
    this.lastSize = { width: nextWidth, height: nextHeight };
    callGlobe(this.globe, 'width', nextWidth);
    callGlobe(this.globe, 'height', nextHeight);
    return this;
  }

  setActive(active) {
    this.active = Boolean(active);
    if (!this.globe || this.disposed) return this;
    const controls = callGlobe(this.globe, 'controls');
    if (controls) {
      controls.enabled = this.active;
      controls.autoRotate = false;
    }
    callGlobe(this.globe, this.active ? 'resumeAnimation' : 'pauseAnimation');
    return this;
  }

  renderFallback(reason) {
    if (!this.root || this.disposed) return;
    this.mode = 'fallback';
    this.fallbackReason = reason;
    this.stage?.remove();
    const fallback = document.createElement('div');
    fallback.className = 'campaign-globe-fallback';
    fallback.setAttribute('role', 'img');
    fallback.setAttribute('aria-label', 'Static world campaign overview');
    setInlineStyles(fallback, {
      position: 'absolute',
      inset: '0',
      display: 'grid',
      placeItems: 'center',
      padding: '28px',
      color: '#dceaf3',
      textAlign: 'center',
      background: 'radial-gradient(circle at 50% 42%, rgba(46,93,119,.45), rgba(5,9,15,.96) 58%)'
    });
    const panel = document.createElement('div');
    setInlineStyles(panel, { maxWidth: '430px' });
    const orb = document.createElement('div');
    orb.setAttribute('aria-hidden', 'true');
    setInlineStyles(orb, {
      width: 'min(42vw, 180px)',
      aspectRatio: '1',
      margin: '0 auto 22px',
      borderRadius: '50%',
      border: '1px solid rgba(125,210,230,.48)',
      boxShadow: 'inset -28px -20px 48px rgba(0,0,0,.55), 0 0 55px rgba(63,170,202,.18)',
      background: 'radial-gradient(circle at 32% 28%, #2f7185 0 6%, #173b4f 25%, #0a1825 68%, #05080d 100%)'
    });
    const heading = document.createElement('strong');
    heading.textContent = 'Strategic map in reduced mode';
    setInlineStyles(heading, { display: 'block', fontSize: '18px', letterSpacing: '.02em' });
    const detail = document.createElement('p');
    detail.textContent = reason;
    setInlineStyles(detail, { margin: '9px 0 0', color: '#92aabb', lineHeight: '1.55', fontSize: '13px' });
    panel.append(orb, heading, detail);
    fallback.append(panel);
    this.root.append(fallback);
    this.fallbackDetail = detail;
    this.updateFallbackDetail();
    this.options.onReady?.({ mode: this.mode, reason, countryCount: this.features.length });
  }

  updateFallbackDetail(focusedFeature = null) {
    if (!this.fallbackDetail) return;
    const home = this.findCountry(this.visualState.homeCode);
    const target = focusedFeature || this.findCountry(this.visualState.targetCode);
    const parts = this.fallbackReason ? [this.fallbackReason] : [];
    if (home) parts.push(`Home command: ${countryName(home)}`);
    if (target) parts.push(`Selected market: ${countryName(target)}`);
    parts.push('Use the campaign controls beside the map to continue.');
    this.fallbackDetail.textContent = parts.join(' · ');
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abortController.abort();
    this.motionQuery?.removeEventListener?.('change', this.boundMotionChange);
    this.resizeObserver?.disconnect();
    if (this.boundWindowResize) globalThis.removeEventListener?.('resize', this.boundWindowResize);
    if (this.resizeFrame) {
      (globalThis.cancelAnimationFrame || clearTimeout)(this.resizeFrame);
      this.resizeFrame = 0;
    }
    callGlobe(this.globe, 'pauseAnimation');
    const renderer = callGlobe(this.globe, 'renderer');
    renderer?.dispose?.();
    renderer?.forceContextLoss?.();
    this.root?.remove();
    this.features = [];
    this.countryIndex.clear();
    this.globe = null;
    this.root = null;
    this.stage = null;
  }
}

export async function createCampaignGlobe(container, options = {}) {
  const controller = new CampaignGlobeController(container, options);
  return controller.mount();
}

export const mountCampaignGlobe = createCampaignGlobe;

export default createCampaignGlobe;
