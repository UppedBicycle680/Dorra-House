const WORLD_DATA_URL = new URL('../assets/world/countries-110m.geojson', import.meta.url);

const QUEENSLAND_VIEW = Object.freeze({ lat: -26.9, lng: 152.6, altitude: 0.78 });
const AUSTRALIA_VIEW = Object.freeze({ lat: -25.2, lng: 134.4, altitude: 1.48 });
const PALETTE = Object.freeze({
  ocean: '#f4f7f8',
  land: '#dce5e8',
  australia: '#173b54',
  side: '#c3d1d6',
  stroke: '#ffffff',
  point: '#8f1f3d',
  selected: '#f4a261',
  ring: '#8f1f3d',
  atmosphere: '#bfd4db'
});

function globeFactory() {
  if (typeof globalThis.Globe === 'function') return globalThis.Globe;
  if (typeof globalThis.Globe?.default === 'function') return globalThis.Globe.default;
  return null;
}

function canUseWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      globalThis.WebGLRenderingContext
      && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

function callGlobe(globe, method, ...args) {
  if (typeof globe?.[method] !== 'function') return globe;
  try {
    return globe[method](...args);
  } catch {
    return globe;
  }
}

function safeText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function countryCode(feature) {
  const properties = feature?.properties || {};
  return properties.ISO_A3 || properties.ADM0_A3 || '';
}

function pointLabel(site) {
  if (site.kind === 'region') {
    return `<div class="globe-location-label"><strong>${safeText(site.region)}</strong><span>${site.count} available sites</span><small>Select to inspect locations</small></div>`;
  }
  return [
    `<div class="globe-location-label">`,
    `<strong>${safeText(site.name)}</strong>`,
    `<span>${safeText(site.region)}</span>`,
    `<small>${Number(site.lotHectares || 0).toFixed(1)} ha · talent ${Math.round(site.talent || 0)}</small>`,
    `</div>`
  ].join('');
}

function regionClusters(locations) {
  const groups = new Map();
  for (const site of locations) {
    const region = String(site.region || 'Queensland');
    const group = groups.get(region) || [];
    group.push(site);
    groups.set(region, group);
  }
  return [...groups].map(([region, sites]) => ({
    id: `region:${region}`,
    kind: 'region',
    region,
    count: sites.length,
    lat: sites.reduce((total, site) => total + Number(site.lat || 0), 0) / sites.length,
    lng: sites.reduce((total, site) => total + Number(site.lng || 0), 0) / sites.length
  }));
}

export class FootballLocationGlobe {
  constructor(container, options = {}) {
    if (!(container instanceof Element)) throw new TypeError('A location globe container is required.');
    this.container = container;
    // Globe.gl annotates point and ring records with internal Three.js fields.
    // Reference data is deeply frozen, so markers must always be mutable copies.
    this.locations = Array.isArray(options.locations) ? options.locations.map(site => ({ ...site })) : [];
    this.selectedId = options.selectedId || '';
    this.activeRegion = options.activeRegion || '';
    this.onSelect = typeof options.onSelect === 'function' ? options.onSelect : () => {};
    this.onRegionFocus = typeof options.onRegionFocus === 'function' ? options.onRegionFocus : () => {};
    this.onModeChange = typeof options.onModeChange === 'function' ? options.onModeChange : () => {};
    this.motionQuery = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)') || null;
    this.reducedMotion = this.motionQuery?.matches ?? false;
    this.boundMotionChange = event => {
      this.reducedMotion = Boolean(event.matches);
      const controls = callGlobe(this.globe, 'controls');
      if (controls && controls !== this.globe) controls.autoRotate = this.active && !this.paused && !this.reducedMotion;
      this.refreshRings();
    };
    this.clusters = regionClusters(this.locations);
    this.active = true;
    this.paused = false;
    this.abortController = new AbortController();
    this.globe = null;
    this.features = [];
    this.resizeObserver = null;
    this.resizeFrame = 0;
    this.root = null;
  }

  async mount() {
    this.container.replaceChildren();
    this.root = document.createElement('div');
    this.root.className = 'location-globe-stage';
    this.root.setAttribute('role', 'img');
    this.root.setAttribute('aria-label', 'A rotatable globe focused on Queensland, with selectable club sites.');
    this.container.append(this.root);
    this.motionQuery?.addEventListener?.('change', this.boundMotionChange);

    if (!canUseWebGL()) {
      this.renderFallback('3D view is not available on this device. Choose a site from the list.');
      return this;
    }

    const factory = globeFactory();
    if (!factory) {
      this.renderFallback('The local globe library did not load. Choose a site from the list.');
      return this;
    }

    try {
      const response = await fetch(WORLD_DATA_URL, {
        cache: 'force-cache',
        signal: this.abortController.signal
      });
      if (!response.ok) throw new Error(`World data returned ${response.status}.`);
      const geojson = await response.json();
      this.features = Array.isArray(geojson?.features) ? geojson.features : [];
      this.mountGlobe(factory);
      this.observeSize();
      this.onModeChange({ mode: 'globe', message: 'Drag to rotate. Select a glowing site or use the location list.' });
    } catch (error) {
      if (error?.name !== 'AbortError') {
        this.renderFallback('The map could not be prepared. All sites remain available in the list.');
      }
    }
    return this;
  }

  mountGlobe(factory) {
    let globe;
    try {
      globe = factory({ waitForGlobeReady: true, animateIn: !this.reducedMotion })(this.root);
    } catch {
      globe = factory()(this.root);
    }
    this.globe = globe;

    callGlobe(globe, 'backgroundColor', PALETTE.ocean);
    callGlobe(globe, 'showGlobe', true);
    callGlobe(globe, 'showAtmosphere', true);
    callGlobe(globe, 'atmosphereColor', PALETTE.atmosphere);
    callGlobe(globe, 'atmosphereAltitude', 0.12);
    callGlobe(globe, 'showGraticules', false);
    callGlobe(globe, 'globeMaterial');
    callGlobe(globe, 'polygonsData', this.features);
    callGlobe(globe, 'polygonCapColor', feature => countryCode(feature) === 'AUS' ? PALETTE.australia : PALETTE.land);
    callGlobe(globe, 'polygonSideColor', () => PALETTE.side);
    callGlobe(globe, 'polygonStrokeColor', () => PALETTE.stroke);
    callGlobe(globe, 'polygonAltitude', feature => countryCode(feature) === 'AUS' ? 0.018 : 0.004);
    callGlobe(globe, 'polygonLabel', feature => safeText(feature?.properties?.NAME_LONG || feature?.properties?.NAME || ''));
    this.refreshPoints();
    callGlobe(globe, 'pointLat', site => site.lat);
    callGlobe(globe, 'pointLng', site => site.lng);
    callGlobe(globe, 'pointColor', site => site.kind === 'region' ? PALETTE.australia : site.id === this.selectedId ? PALETTE.selected : PALETTE.point);
    callGlobe(globe, 'pointAltitude', site => site.kind === 'region' ? 0.1 : site.id === this.selectedId ? 0.12 : 0.075);
    callGlobe(globe, 'pointRadius', site => site.kind === 'region' ? 0.52 : site.id === this.selectedId ? 0.34 : 0.23);
    callGlobe(globe, 'pointResolution', 18);
    callGlobe(globe, 'pointLabel', pointLabel);
    callGlobe(globe, 'onPointClick', site => {
      if (site?.kind === 'region') {
        this.focusRegion(site.region);
        return;
      }
      if (site?.disabled) return;
      if (!site?.id) return;
      this.selectLocation(site.id, true);
      this.onSelect(site);
    });
    callGlobe(globe, 'onPointHover', site => {
      this.root.style.cursor = site ? 'pointer' : 'grab';
    });
    this.refreshRings();

    const controls = callGlobe(globe, 'controls');
    if (controls && controls !== globe) {
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = false;
      controls.autoRotate = this.active && !this.reducedMotion;
      controls.autoRotateSpeed = 0.18;
      controls.minDistance = 130;
      controls.maxDistance = 430;
    }

    callGlobe(globe, 'pointOfView', this.reducedMotion ? QUEENSLAND_VIEW : AUSTRALIA_VIEW, 0);
    if (!this.reducedMotion) {
      this.introTimer = setTimeout(() => {
        if (this.active && !this.paused) callGlobe(globe, 'pointOfView', QUEENSLAND_VIEW, 1050);
      }, 180);
    }
    this.resize();
  }

  refreshRings() {
    if (!this.globe) return;
    const selected = this.locations.find(site => site.id === this.selectedId);
    callGlobe(this.globe, 'ringsData', selected ? [selected] : []);
    callGlobe(this.globe, 'ringLat', site => site.lat);
    callGlobe(this.globe, 'ringLng', site => site.lng);
    callGlobe(this.globe, 'ringColor', () => PALETTE.ring);
    callGlobe(this.globe, 'ringMaxRadius', 2.1);
    callGlobe(this.globe, 'ringPropagationSpeed', this.reducedMotion ? 0 : 1.2);
    callGlobe(this.globe, 'ringRepeatPeriod', this.reducedMotion ? 0 : 900);
  }

  visiblePoints() {
    if (!this.activeRegion) return this.clusters;
    return this.locations.filter(site => site.region === this.activeRegion);
  }

  refreshPoints() {
    if (!this.globe) return;
    callGlobe(this.globe, 'pointsData', this.visiblePoints());
  }

  focusRegion(region) {
    const sites = this.locations.filter(site => site.region === region);
    if (!sites.length) {
      this.activeRegion = '';
      this.refreshPoints();
      callGlobe(this.globe, 'pointOfView', QUEENSLAND_VIEW, this.reducedMotion ? 0 : 650);
      return;
    }
    this.activeRegion = region;
    this.refreshPoints();
    const lat = sites.reduce((total, site) => total + Number(site.lat || 0), 0) / sites.length;
    const lng = sites.reduce((total, site) => total + Number(site.lng || 0), 0) / sites.length;
    callGlobe(this.globe, 'pointOfView', { lat, lng, altitude: 0.34 }, this.reducedMotion ? 0 : 700);
    this.root?.querySelectorAll?.('[data-fallback-site]').forEach(button => {
      button.hidden = button.dataset.region !== region;
    });
    this.onRegionFocus(region);
  }

  selectLocation(id, focus = false) {
    const selected = this.locations.find(site => site.id === id);
    if (!selected) return;
    if (selected.region !== this.activeRegion) this.focusRegion(selected.region);
    this.selectedId = id;
    if (this.globe) {
      callGlobe(this.globe, 'pointColor', site => site.id === this.selectedId ? PALETTE.selected : PALETTE.point);
      callGlobe(this.globe, 'pointAltitude', site => site.id === this.selectedId ? 0.12 : 0.075);
      callGlobe(this.globe, 'pointRadius', site => site.id === this.selectedId ? 0.34 : 0.23);
      this.refreshRings();
      if (focus) {
        callGlobe(this.globe, 'pointOfView', { lat: selected.lat, lng: selected.lng, altitude: 1.25 }, this.reducedMotion ? 0 : 650);
      }
    }
    this.root?.querySelectorAll?.('[data-fallback-site]').forEach(button => {
      button.classList.toggle('selected', button.dataset.fallbackSite === id);
    });
  }

  selectSite(id, focus = false) {
    this.selectLocation(id, focus);
  }

  renderFallback(message) {
    if (!this.root) return;
    const latMax = Math.max(...this.locations.map(site => Number(site.lat || -26)));
    const latMin = Math.min(...this.locations.map(site => Number(site.lat || -29)));
    const lngMax = Math.max(...this.locations.map(site => Number(site.lng || 154)));
    const lngMin = Math.min(...this.locations.map(site => Number(site.lng || 151)));
    const dots = this.locations.map(site => {
      const left = 13 + ((Number(site.lng) - lngMin) / Math.max(.01, lngMax - lngMin)) * 73;
      const top = 16 + ((latMax - Number(site.lat)) / Math.max(.01, latMax - latMin)) * 69;
      return `<button type="button" class="fallback-site-dot${site.id === this.selectedId ? ' selected' : ''}" style="left:${left.toFixed(2)}%;top:${top.toFixed(2)}%" data-fallback-site="${safeText(site.id)}" data-region="${safeText(site.region)}" aria-label="Choose ${safeText(site.name)}, ${safeText(site.region)}${site.disabled ? ', unavailable with current funds' : ''}" title="${safeText(site.name)}" ${site.disabled ? 'disabled' : ''}></button>`;
    }).join('');
    this.root.innerHTML = `<div class="location-globe-fallback-map" role="group" aria-label="Simplified map of south-east Queensland club sites">
      <svg viewBox="0 0 520 560" aria-hidden="true"><path d="M95 30h344l-9 92 35 59-31 69 18 71-45 48 7 84-88 60-91-20-76 34-47-66 20-73-47-68 31-66-17-70 45-51Z"/><path d="M112 390c95-23 198-16 302 24M150 110c75 48 167 74 276 78" fill="none" opacity=".45"/></svg>${dots}<div class="fallback-map-key"><strong>2D location map</strong><br>${safeText(message)} Select a maroon site marker or use the full list.</div></div>`;
    this.root.querySelectorAll('[data-fallback-site]').forEach(button => button.addEventListener('click', () => {
      const site = this.locations.find(item => item.id === button.dataset.fallbackSite);
      if (!site) return;
      this.selectLocation(site.id, false);
      this.onSelect(site);
    }));
    this.onModeChange({ mode: 'fallback', message });
  }

  pause() {
    this.paused = true;
    callGlobe(this.globe, 'pauseAnimation');
    const controls = callGlobe(this.globe, 'controls');
    if (controls && controls !== this.globe) controls.autoRotate = false;
  }

  resume() {
    this.paused = false;
    if (!this.active) return;
    callGlobe(this.globe, 'resumeAnimation');
    const controls = callGlobe(this.globe, 'controls');
    if (controls && controls !== this.globe) controls.autoRotate = !this.reducedMotion;
  }

  setActive(active) {
    this.active = Boolean(active);
    if (this.active) this.resume();
    else this.pause();
  }

  observeSize() {
    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
      this.resizeObserver.observe(this.container);
    } else {
      this.boundResize = () => this.scheduleResize();
      globalThis.addEventListener('resize', this.boundResize, { passive: true });
    }
  }

  scheduleResize() {
    if (this.resizeFrame) return;
    this.resizeFrame = (globalThis.requestAnimationFrame || setTimeout)(() => {
      this.resizeFrame = 0;
      this.resize();
    });
  }

  resize() {
    if (!this.globe || !this.container) return;
    const width = Math.max(280, Math.round(this.container.clientWidth || 560));
    const height = Math.max(300, Math.round(this.container.clientHeight || 480));
    callGlobe(this.globe, 'width', width);
    callGlobe(this.globe, 'height', height);
  }

  dispose() {
    this.abortController.abort();
    this.motionQuery?.removeEventListener?.('change', this.boundMotionChange);
    this.resizeObserver?.disconnect();
    if (this.boundResize) globalThis.removeEventListener('resize', this.boundResize);
    if (this.resizeFrame) (globalThis.cancelAnimationFrame || clearTimeout)(this.resizeFrame);
    if (this.introTimer) clearTimeout(this.introTimer);
    const controls = callGlobe(this.globe, 'controls');
    controls?.dispose?.();
    this.container.replaceChildren();
    this.globe = null;
  }

  destroy() {
    this.dispose();
  }
}

export async function createFootballLocationGlobe(container, options = {}) {
  const controller = new FootballLocationGlobe(container, options);
  return controller.mount();
}

export default createFootballLocationGlobe;
