import { PLATFORMS } from './catalog.mjs';
import { getArtwork } from './art.mjs';
import { MAP_DEFAULT_LAYERS, RELATION_COLORS, ROLE_PATHS, cityLabelVisible, denseMarkerChoices, getMapLegend, markerRole, nationColor, normalizeMapLayers, provinceColor, rangeRing, selectedOwnUnits } from './map-style.mjs';

const COLORS = { ocean: '#111f28', land: '#536168', border: '#a3b4ae', selected: '#cdb579', text: '#d5dfd8' };
const countryId = feature => String(feature.properties?.countryId || feature.properties?.sovereignId || feature.properties?.id || feature.id || feature.properties?.ISO_A2 || '');
const regionId = feature => String(feature.properties?.regionId || feature.properties?.id || feature.id || '');
const provinceId = feature => String(feature.properties?.id || feature.id || '');

export class CommandMap {
  constructor(canvas, { onSelect = () => {}, onUnits = () => {}, onTarget = () => {}, onHover = () => {}, onError = () => {} } = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.onSelect = onSelect; this.onUnits = onUnits; this.onTarget = onTarget; this.onHover = onHover; this.onError = onError;
    this.countries = []; this.chunks = new Map(); this.provinces = new Map(); this.pending = new Map(); this.failedChunks = new Set();
    this.nations = []; this.view = null; this.selectedCountry = null; this.selectedProvince = null; this.selectedUnits = new Set();
    this.layers = { ...MAP_DEFAULT_LAYERS }; this.setPlatforms(PLATFORMS); this.ownership = new Map(); this.images = new Map();
    this.rolePaths = new Map(Object.entries(ROLE_PATHS).map(([role, path]) => [role, new Path2D(path)]));
    this.camera = { x: 180, y: 88, zoom: 1 }; this.pointers = new Map(); this.unitHits = []; this.frame = 0; this.drag = null;
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas);
    this.listeners = [];
    this.listen('wheel', event => { event.preventDefault(); this.zoom(Math.exp(-event.deltaY * (event.deltaMode === 1 ? 16 : 1) * .0015), event.offsetX, event.offsetY); }, { passive: false });
    this.listen('pointerdown', event => this.pointerDown(event));
    this.listen('pointermove', event => this.pointerMove(event));
    this.listen('pointerup', event => this.pointerUp(event));
    this.listen('pointercancel', event => this.pointerUp(event, true));
    this.listen('contextmenu', event => { event.preventDefault(); const hit = this.hit(event.offsetX, event.offsetY, true); if (hit) this.onTarget(hit); });
    this.listen('keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === '+' || event.key === '=') this.zoom(1.3);
      else if (event.key === '-') this.zoom(1 / 1.3);
      else if (event.key.toLowerCase() === 'h') this.home();
      else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        this.camera.x += (event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0) * this.width * .15 / this.scale;
        this.camera.y += (event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0) * this.height * .15 / this.scale;
        this.constrain(); this.invalidate(); this.loadVisible();
      } else return;
      event.preventDefault();
    });
  }
  listen(type, listener, options) { this.canvas.addEventListener(type, listener, options); this.listeners.push([type, listener, options]); }
  async load() {
    const response = await fetch('./assets/war/world.json');
    if (!response.ok) throw new Error('The world map could not be downloaded. Reconnect to try again.');
    const data = await response.json();
    this.countries = (data.features || []).map(feature => this.prepare(feature)); this.invalidate();
  }
  prepare(feature) {
    const path = new Path2D(), parts = []; let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const polygons = feature.geometry?.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry?.type === 'MultiPolygon' ? feature.geometry.coordinates : [];
    for (const polygon of polygons) { const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }; for (const ring of polygon) {
      let previous = null;
      for (const point of ring) {
        const x = point[0] + 180, y = 90 - Math.max(-85, Math.min(85, point[1]));
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x); bounds.minY = Math.min(bounds.minY, y); bounds.maxY = Math.max(bounds.maxY, y);
        if (previous === null || Math.abs(point[0] - previous) > 180) path.moveTo(x, y); else path.lineTo(x, y);
        previous = point[0];
      }
      path.closePath();
    } parts.push(bounds); }
    return { feature, path, parts, bounds: { minX, minY, maxX, maxY } };
  }
  resize() { const rect = this.canvas.getBoundingClientRect(); this.width = rect.width; this.height = rect.height; this.dpr = Math.min(devicePixelRatio || 1, 2); this.canvas.width = Math.round(this.width * this.dpr); this.canvas.height = Math.round(this.height * this.dpr); this.invalidate(); }
  get scale() { return Math.min(this.width / 360, this.height / 165) * this.camera.zoom; }
  toScreen(lng, lat) { return { x: this.width / 2 + (lng + 180 - this.camera.x) * this.scale, y: this.height / 2 + (90 - lat - this.camera.y) * this.scale }; }
  toWorld(x, y) { return { x: (x - this.width / 2) / this.scale + this.camera.x, y: (y - this.height / 2) / this.scale + this.camera.y }; }
  transform() { const scale = this.scale; this.ctx.setTransform(this.dpr * scale, 0, 0, this.dpr * scale, this.dpr * (this.width / 2 - this.camera.x * scale), this.dpr * (this.height / 2 - this.camera.y * scale)); }
  home() { this.camera = { x: 180, y: 88, zoom: 1 }; this.invalidate(); }
  zoom(factor, x = this.width / 2, y = this.height / 2) {
    const before = this.toWorld(x, y); this.camera.zoom = Math.max(1, Math.min(28, this.camera.zoom * factor));
    const after = this.toWorld(x, y); this.camera.x += before.x - after.x; this.camera.y += before.y - after.y; this.constrain(); this.invalidate(); this.loadVisible();
  }
  constrain() { this.camera.x = Math.max(0, Math.min(360, this.camera.x)); this.camera.y = Math.max(5, Math.min(175, this.camera.y)); }
  setNations(nations) { this.nations = nations; this.invalidate(); }
  setPlatforms(platforms) {
    this.platforms = new Map(platforms.map(platform => [platform.id, platform]));
    this.platformStyles = new Map([...this.platforms.values()].map(platform => [platform.id, { role: markerRole(platform), art: getArtwork(platform) }]));
  }
  setView(view) { this.view = view; this.displayTime = view?.match?.gameTime; this.ownership = new Map((view?.provinces || []).map(province => [province.id, province])); this.relations = new Map((view?.nations || []).map(nation => [nation.id, nation.relation])); this.setPlatforms([...PLATFORMS, ...(view?.catalog?.platforms || [])]); this.invalidate(); this.loadVisible(); this.loadTacticalGeography(); }
  setDisplayTime(gameTime) { this.displayTime = gameTime; if (this.view?.units?.some(unit => unit.order?.arrival)) this.invalidate(); }
  setOrderPreview(order) { this.orderPreview = order; this.invalidate(); this.loadTacticalGeography(); }
  setTargeting(enabled) { this.targeting = Boolean(enabled); }
  setLayers(patch) { this.layers = normalizeMapLayers(this.layers, patch); this.invalidate(); return this.getLayers(); }
  getLayers() { return { ...this.layers }; }
  getLegend() { return getMapLegend(this.layers.mode); }
  setSelection({ country = this.selectedCountry, province = this.selectedProvince, units = this.selectedUnits } = {}) { this.selectedCountry = country; this.selectedProvince = province; this.selectedUnits = new Set(units); this.invalidate(); this.loadTacticalGeography(); }
  async focus(country) {
    this.selectedCountry = country;
    const nation = this.nations.find(item => item.id === country);
    if (nation) {
      const anchor = { x: Number(nation.lng) + 180, y: 90 - Number(nation.lat) };
      const region = this.countries.find(item => regionId(item.feature) === country) || this.countries.find(item => countryId(item.feature) === country);
      // Fit the primary geographical part around the nation label, rather than
      // letting a distant dependency or antimeridian island flatten the theatre.
      const bounds = region?.parts?.filter(part => Number.isFinite(part.minX)).sort((a, b) => {
        const distance = part => Math.max(part.minX - anchor.x, 0, anchor.x - part.maxX) ** 2 + Math.max(part.minY - anchor.y, 0, anchor.y - part.maxY) ** 2;
        return distance(a) - distance(b) || (b.maxX - b.minX) * (b.maxY - b.minY) - (a.maxX - a.minX) * (a.maxY - a.minY);
      })[0];
      const baseScale = Math.min(this.width / 360, this.height / 165), mobile = this.width <= 700;
      this.camera.zoom = bounds && baseScale > 0 ? Math.max(1.6, Math.min(28, this.width * (mobile ? .72 : .53) / Math.max(.35, bounds.maxX - bounds.minX) / baseScale, this.height * .56 / Math.max(.35, bounds.maxY - bounds.minY) / baseScale)) : 3.6;
      const center = bounds ? { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 } : anchor;
      this.camera.x = center.x - (mobile ? 0 : this.width * .16 / this.scale); this.camera.y = center.y + (mobile ? this.height * .04 / this.scale : 0); this.constrain();
    }
    this.invalidate();
    const regions = [...(nation?.regionIds || [country])];
    await Promise.all(Array.from({ length: Math.min(3, regions.length) }, async () => { while (regions.length) await this.loadChunk(regions.shift()); }));
    this.loadVisible();
  }
  async focusUnit(id, anchor = null) {
    const request = this.unitFocusRequest = (this.unitFocusRequest || 0) + 1;
    const unit = this.view?.units?.find(unit => unit.id === id); if (!unit) return;
    if (!this.provinces.has(unit.provinceId)) {
      const nation = this.nations.find(nation => nation.id === unit.nationId), regions = [...(nation?.regionIds || [unit.nationId])];
      await Promise.all(Array.from({ length: Math.min(3, regions.length) }, async () => { while (regions.length) await this.loadChunk(regions.shift()); }));
    }
    if (request !== this.unitFocusRequest) return;
    const point = this.unitPoint(unit); if (!point) return;
    const world = this.toWorld(point.x, point.y);
    this.camera.zoom = Math.max(4, this.camera.zoom);
    if (anchor) {
      const baseScale = Math.min(this.width / 360, this.height / 165);
      const offsetX = this.width / 2 - anchor.x, offsetY = this.height / 2 - anchor.y;
      // Keep the selected formation above the mobile panel, including southern
      // provinces where the camera's latitude limit would otherwise hide it.
      const roomX = offsetX >= 0 ? 360 - world.x : world.x;
      const roomY = offsetY >= 0 ? 175 - world.y : world.y - 5;
      this.camera.zoom = Math.min(28, Math.max(this.camera.zoom, roomX > 0 ? Math.abs(offsetX) / roomX / baseScale : 4, roomY > 0 ? Math.abs(offsetY) / roomY / baseScale : 4));
      this.camera.x = world.x + offsetX / this.scale; this.camera.y = world.y + offsetY / this.scale;
    } else { this.camera.x = world.x; this.camera.y = world.y; }
    this.constrain(); this.invalidate(); this.loadVisible();
  }
  async loadChunk(id) {
    if (!id || this.chunks.has(id) || this.failedChunks.has(id)) return;
    if (this.pending.has(id)) return this.pending.get(id);
    const loading = (async () => { try {
      const response = await fetch(`./assets/war/provinces/${encodeURIComponent(id)}.json`);
      if (!response.ok) throw new Error(`Province map for ${this.nations.find(n => n.id === id)?.name || id} is unavailable.`);
      const data = await response.json(); const chunks = (data.features || []).map(feature => this.prepare(feature));
      this.chunks.set(id, chunks); for (const item of chunks) this.provinces.set(provinceId(item.feature), item.feature); this.invalidate();
    } catch (error) { this.failedChunks.add(id); this.onError(error); }
    finally { this.pending.delete(id); }
    })();
    this.pending.set(id, loading); return loading;
  }
  loadTacticalGeography() {
    if (!this.view || !this.countries.length) return;
    const ids = new Set();
    for (const unit of selectedOwnUnits(this.view, this.selectedUnits)) {
      ids.add(unit.provinceId);
      for (const id of [unit.order?.legTarget, unit.order?.targetProvinceId, unit.order?.homeProvinceId, ...(unit.order?.path || [])]) if (id) ids.add(id);
    }
    if (this.orderPreview?.unitIds?.every(id => selectedOwnUnits(this.view, [id]).length)) for (const id of [...(this.orderPreview.waypoints || []), this.orderPreview.targetProvinceId]) if (id) ids.add(id);
    for (const id of ids) {
      if (this.provinces.has(id)) continue;
      const region = this.countries.find(item => item.feature.properties?.iso3 === id.split('-')[0]);
      const key = region && regionId(region.feature);
      if (!key || this.pending.has(key) || this.chunks.has(key) || this.failedChunks.has(key)) continue;
      if (this.pending.size >= 3) break;
      void this.loadChunk(key).then(() => this.loadTacticalGeography());
    }
  }
  loadVisible() {
    if (this.camera.zoom < 2.6 || !this.view) return;
    const min = this.toWorld(0, 0), max = this.toWorld(this.width, this.height);
    const visible = this.countries.filter(item => item.bounds.maxX > min.x && item.bounds.minX < max.x && item.bounds.maxY > min.y && item.bounds.minY < max.y);
    // Fetch visible chunks only, with a small concurrency bound on mobile.
    for (const item of visible) { const id = regionId(item.feature); if (this.chunks.has(id) || this.pending.has(id) || this.failedChunks.has(id)) continue; if (this.pending.size >= 3) break; void this.loadChunk(id).then(() => { this.loadTacticalGeography(); if (this.pending.size === 0) this.loadVisible(); }); }
  }
  invalidate() { if (!this.destroyed && !this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.draw(); }); }
  relation(id) {
    if (id === this.view?.player?.nationId || (!this.view && id === this.selectedCountry)) return 'friendly';
    const relation = this.relations?.get(id);
    return ['war', 'hostile', 'enemy'].includes(relation) ? 'hostile' : ['allied', 'alliance', 'coalition'].includes(relation) ? 'allied' : 'neutral';
  }
  draw() {
    if (!this.width || !this.height) return;
    const ctx = this.ctx; ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.fillStyle = COLORS.ocean; ctx.fillRect(0, 0, this.width, this.height);
    const gradient = ctx.createRadialGradient(this.width * .6, this.height * .4, 0, this.width * .5, this.height * .5, this.width); gradient.addColorStop(0, '#203c47'); gradient.addColorStop(1, '#0d1a24'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, this.width, this.height);
    const min = this.toWorld(-40, -40), max = this.toWorld(this.width + 40, this.height + 40);
    const visible = item => item.bounds.maxX >= min.x && item.bounds.minX <= max.x && item.bounds.maxY >= min.y && item.bounds.minY <= max.y;
    this.transform(); ctx.lineWidth = .5 / this.scale; ctx.strokeStyle = '#8ca7ad'; ctx.globalAlpha = .09;
    for (let x = 0; x <= 360; x += 30) { ctx.beginPath(); ctx.moveTo(x, 5); ctx.lineTo(x, 175); ctx.stroke(); }
    for (let y = 0; y <= 180; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); } ctx.globalAlpha = 1;
    const countries = this.countries.filter(visible);
    for (const item of countries) {
      const id = countryId(item.feature), relation = this.relation(id);
      ctx.fillStyle = this.layers.mode === 'political' ? nationColor(id) : this.layers.mode === 'relations' ? provinceColor({ mode: 'relations', relation }) : COLORS.land;
      ctx.fill(item.path, 'evenodd');
    }
    this.visibleProvinceItems = [];
    if (this.camera.zoom >= 2.6 && this.view) for (const chunks of this.chunks.values()) for (const item of chunks) {
      if (!visible(item)) continue;
      this.visibleProvinceItems.push(item);
      const id = provinceId(item.feature), province = this.ownership.get(id), owner = province?.ownerId || province?.nationId || countryId(item.feature);
      ctx.fillStyle = provinceColor({ mode: this.layers.mode, ownerId: owner, relation: this.relation(owner), terrain: item.feature.properties?.terrain, morale: province?.morale });
      ctx.fill(item.path, 'evenodd');
      ctx.strokeStyle = id === this.selectedProvince ? '#ffe4a5' : '#c8d0b5'; ctx.globalAlpha = id === this.selectedProvince ? 1 : .27; ctx.lineWidth = (id === this.selectedProvince ? 2.2 : .65) / this.scale; ctx.stroke(item.path); ctx.globalAlpha = 1;
      if (province && owner !== countryId(item.feature)) { ctx.strokeStyle = RELATION_COLORS[this.relation(owner)]; ctx.lineWidth = 1.35 / this.scale; ctx.setLineDash([4 / this.scale, 2 / this.scale]); ctx.stroke(item.path); ctx.setLineDash([]); }
    }
    for (const item of countries) {
      const id = countryId(item.feature), selected = id === this.selectedCountry;
      ctx.strokeStyle = selected ? '#ffe4a5' : RELATION_COLORS[this.relation(id)]; ctx.globalAlpha = selected ? 1 : .7;
      ctx.lineWidth = (selected ? 2 : this.relation(id) === 'hostile' ? 1.3 : .85) / this.scale; ctx.stroke(item.path); ctx.globalAlpha = 1;
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawTacticalOverlays(); this.drawLabels(); this.drawRoutePreview(); this.drawUnits();
    this.canvas.dataset.mapMode = this.layers.mode;
    this.canvas.dataset.mapArtReady = [...this.images.values()].filter(image => image.complete && image.naturalWidth > 0).length;
    if (this.drag?.selecting) { ctx.fillStyle = '#cdb57918'; ctx.strokeStyle = '#cdb579'; const { x, y, currentX, currentY } = this.drag; ctx.fillRect(x, y, currentX - x, currentY - y); ctx.strokeRect(x, y, currentX - x, currentY - y); }
  }
  drawLabels() {
    const ctx = this.ctx, occupied = [];
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const nation of [...this.nations].sort((a, b) => Number(b.id === this.selectedCountry || b.id === this.view?.player?.nationId) - Number(a.id === this.selectedCountry || a.id === this.view?.player?.nationId) || (b.military || 0) - (a.military || 0))) {
      const point = this.toScreen(Number(nation.lng), Number(nation.lat));
      if (point.x < 0 || point.x > this.width || point.y < 0 || point.y > this.height) continue;
      const region = this.countries.find(item => regionId(item.feature) === nation.id), area = region && (region.bounds.maxX - region.bounds.minX) * (region.bounds.maxY - region.bounds.minY) * this.scale ** 2;
      const important = nation.id === this.selectedCountry || nation.id === this.view?.player?.nationId;
      if (!important && area < (this.camera.zoom > 6 ? 16000 : 3600)) continue;
      const label = nation.name?.toUpperCase() || nation.id;
      ctx.font = `${important ? '700' : '600'} ${this.camera.zoom > 3 ? 12 : 10}px system-ui`; const width = ctx.measureText(label).width;
      if (occupied.some(previous => Math.abs(previous.x - point.x) < (previous.width + width) / 2 + 14 && Math.abs(previous.y - point.y) < 26) && !important) continue;
      occupied.push({ ...point, width }); ctx.letterSpacing = '1px'; ctx.fillStyle = important ? '#fff1c8' : '#d6dfcf'; ctx.strokeStyle = '#12212c'; ctx.lineWidth = 3; ctx.strokeText(label, point.x, point.y); ctx.fillText(label, point.x, point.y);
    }
    if (!this.layers.cities || this.camera.zoom < 4) return;
    const cities = []; let cityLabelCount = 0; const cityLabelBudget = Math.max(12, Math.min(42, Math.floor(this.width * this.height / 17000)));
    for (const item of this.visibleProvinceItems || []) {
      const p = item.feature.properties;
      if (p.cities?.length) for (const city of p.cities) cities.push({ ...city, province: p.id, port: p.ports?.some(port => port.name === city.name) });
      else if (p.city || p.capital) cities.push({ ...p, province: p.id });
      if (this.camera.zoom >= 7) for (const port of p.ports || []) {
        const point = this.toScreen(port.lng, port.lat); if (point.x < 0 || point.x > this.width || point.y < 0 || point.y > this.height) continue;
        ctx.strokeStyle = '#9cb9bc'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(point.x, point.y - 3, 1.5, 0, Math.PI * 2); ctx.moveTo(point.x, point.y - 1.5); ctx.lineTo(point.x, point.y + 4.5); ctx.moveTo(point.x - 3.5, point.y + 1.5); ctx.quadraticCurveTo(point.x, point.y + 7, point.x + 3.5, point.y + 1.5); ctx.stroke();
      }
    }
    for (const city of cities.sort((a, b) => Number(b.capital) - Number(a.capital) || (b.population || 0) - (a.population || 0))) {
      const point = this.toScreen(Number(city.lng), Number(city.lat)); if (point.x < 4 || point.x > this.width - 4 || point.y < 4 || point.y > this.height - 4) continue;
      if (!city.capital && city.province !== this.selectedProvince && this.scale < 24 && city.population < 100000) continue;
      ctx.fillStyle = city.capital ? '#fff0bd' : '#b0bcb3'; ctx.strokeStyle = '#263a3b'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(point.x, point.y, city.capital ? 3.5 : 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (city.capital) { ctx.beginPath(); ctx.arc(point.x, point.y, 6, 0, Math.PI * 2); ctx.strokeStyle = '#f3d795'; ctx.lineWidth = 1; ctx.stroke(); }
      if (!cityLabelVisible(city, this.scale, this.selectedProvince) || (!city.capital && city.province !== this.selectedProvince && cityLabelCount >= cityLabelBudget)) continue;
      ctx.font = `${city.capital ? '600' : '400'} 11px system-ui`; ctx.letterSpacing = '0px'; const width = ctx.measureText(city.name || '').width;
      const labelPoint = { x: point.x, y: point.y + 14, width };
      if (occupied.some(previous => Math.abs(previous.x - labelPoint.x) < (previous.width + width) / 2 + 8 && Math.abs(previous.y - labelPoint.y) < 16)) continue;
      occupied.push(labelPoint); cityLabelCount++; ctx.fillStyle = city.capital ? '#fff0c7' : '#c8d1c9'; ctx.strokeStyle = '#14232a'; ctx.lineWidth = 3; ctx.strokeText(city.name, labelPoint.x, labelPoint.y); ctx.fillText(city.name, labelPoint.x, labelPoint.y);
    }
  }
  unitLocation(unit) {
    const feature = this.provinces.get(unit.provinceId);
    let position = unit.position || feature?.properties;
    // Visible contacts retain their server position/province. Private enemy
    // mission fields are never used, even if a malformed fixture contains them.
    const order = unit.nationId === this.view?.player?.nationId ? unit.order : null, destination = order?.legTarget && this.provinces.get(order.legTarget)?.properties;
    if (!unit.position && position && destination && Number.isFinite(Number(order.arrival)) && Number(order.arrival) > Number(order.departure)) {
      const fraction = Math.max(0, Math.min(1, ((this.displayTime ?? this.view.match.gameTime) - Number(order.departure)) / (Number(order.arrival) - Number(order.departure))));
      let longitudeChange = Number(destination.lng) - Number(position.lng); if (longitudeChange > 180) longitudeChange -= 360; if (longitudeChange < -180) longitudeChange += 360;
      const lng = ((Number(position.lng) + longitudeChange * fraction + 540) % 360) - 180;
      position = { lng, lat: Number(position.lat) + (Number(destination.lat) - Number(position.lat)) * fraction };
    }
    return position && Number.isFinite(Number(position.lng)) && Number.isFinite(Number(position.lat)) ? { lng: Number(position.lng), lat: Number(position.lat) } : null;
  }
  unitPoint(unit) { const position = this.unitLocation(unit); return position ? this.toScreen(position.lng, position.lat) : null; }
  traceRoute(points) {
    const ctx = this.ctx; let previous = null;
    for (const point of points) { const screen = this.toScreen(point.lng, point.lat); if (!previous || Math.abs(point.lng - previous.lng) > 180) ctx.moveTo(screen.x, screen.y); else ctx.lineTo(screen.x, screen.y); previous = point; }
  }
  drawTacticalOverlays() {
    const ctx = this.ctx; let rangeCount = 0, routeCount = 0;
    ctx.save();
    for (const unit of selectedOwnUnits(this.view, this.selectedUnits)) {
      const position = this.unitLocation(unit); if (!position) continue;
      const platform = this.platforms.get(unit.platformId), radius = Number(platform?.stats?.range);
      if (this.layers.ranges && radius > 0) {
        const ring = rangeRing(position.lng, position.lat, radius);
        ctx.beginPath();
        for (let index = 0; index < ring.length; index++) {
          const point = ring[index]; let delta = point.lng - position.lng; if (delta > 180) delta -= 360; if (delta < -180) delta += 360;
          const screen = this.toScreen(position.lng + delta, point.lat); if (index === 0) ctx.moveTo(screen.x, screen.y); else ctx.lineTo(screen.x, screen.y);
        }
        ctx.closePath(); ctx.fillStyle = '#e8ca7e13'; ctx.strokeStyle = '#ead395'; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); ctx.fill(); ctx.stroke(); rangeCount++;
      }
      if (this.layers.routes && unit.order) {
        const order = unit.order, ids = order.path?.length ? order.path.slice(Math.max(1, Number(order.legIndex) || 1)) : [order.legTarget || order.targetProvinceId];
        const route = [position, ...ids.map(id => this.provinces.get(id)?.properties).filter(Boolean)];
        if (route.length > 1) {
          ctx.beginPath(); this.traceRoute(route); ctx.strokeStyle = ['attack', 'bombard'].includes(order.type) ? '#f3a394' : '#9edcc5'; ctx.lineWidth = 2; ctx.setLineDash([7, 5]); ctx.stroke();
          const last = route.at(-1), end = this.toScreen(last.lng, last.lat); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(end.x, end.y, 5, 0, Math.PI * 2); ctx.stroke(); routeCount++;
        }
      }
    }
    ctx.restore(); this.canvas.dataset.mapRangeCount = rangeCount; this.canvas.dataset.mapRouteCount = routeCount;
  }
  drawRoutePreview() {
    const order = this.orderPreview; if (!order || !this.layers.routes) return;
    const unit = selectedOwnUnits(this.view, order.unitIds)[0];
    const start = unit && this.unitPoint(unit); if (!start) return;
    const ctx = this.ctx; ctx.save(); ctx.strokeStyle = '#e2c68a'; ctx.fillStyle = '#e2c68a'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(start.x, start.y);
    const points = [...(order.waypoints || []), order.targetProvinceId].map(id => this.provinces.get(id)?.properties).filter(Boolean).map(properties => this.toScreen(properties.lng, properties.lat));
    for (const point of points) ctx.lineTo(point.x, point.y); ctx.stroke(); ctx.setLineDash([]);
    for (let index = 0; index < points.length; index++) { const point = points[index]; ctx.beginPath(); ctx.arc(point.x, point.y, index === points.length - 1 ? 6 : 4, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  drawUnits() {
    this.unitHits = []; const ctx = this.ctx; const grouped = new Map();
    if (!this.layers.units) { this.canvas.dataset.mapMarkerCount = 0; return; }
    for (const unit of this.view?.units || []) {
      const point = this.unitPoint(unit); if (!point) continue;
      const key = `${Math.round(point.x / 24)}:${Math.round(point.y / 24)}:${unit.nationId}`;
      if (!grouped.has(key)) grouped.set(key, { point, units: [] }); grouped.get(key).units.push(unit);
    }
    const groups = [...grouped.values()].filter(({ point }) => point.x >= -35 && point.x <= this.width + 35 && point.y >= -35 && point.y <= this.height + 35);
    const detailed = this.camera.zoom >= 3.6;
    // Hit centres remain the real geographical positions, including contact
    // stacks. Dense selection cycles rather than inventing displaced locations.
    this.unitHits = groups.map(({ point, units }) => ({ x: point.x, y: point.y, halfWidth: detailed ? 27 : 22, halfHeight: detailed ? 23 : 22, units }));
    for (const { point, units } of [...groups].sort((a, b) => Number(a.units.some(unit => this.selectedUnits.has(unit.id))) - Number(b.units.some(unit => this.selectedUnits.has(unit.id))))) {
      if (point.x < -20 || point.x > this.width + 20 || point.y < -20 || point.y > this.height + 20) continue;
      const selected = units.some(unit => this.selectedUnits.has(unit.id)), relation = this.relation(units[0].nationId);
      const chosen = units.find(unit => this.selectedUnits.has(unit.id)) || units[0], style = this.platformStyles.get(chosen.platformId), role = style?.role || markerRole({}, chosen.domain);
      const width = detailed ? 46 : 30, height = detailed ? 34 : 24, left = point.x - width / 2, top = point.y - height / 2;
      ctx.save(); ctx.shadowColor = '#06121caa'; ctx.shadowBlur = 7; ctx.fillStyle = selected ? COLORS.selected : '#1c2d35'; ctx.strokeStyle = selected ? '#ffedbc' : RELATION_COLORS[relation]; ctx.lineWidth = selected ? 2 : 1.5;
      ctx.beginPath(); ctx.roundRect(left, top, width, height, 4); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.save(); ctx.beginPath(); ctx.roundRect(left + 1, top + 1, width - 2, height - 2, 3); ctx.clip();
      ctx.fillStyle = nationColor(chosen.nationId); ctx.fillRect(left + 1, top + 1, width - 2, 4);
      const imageDrawn = detailed && this.drawArtwork(style?.art, left + 2, top + 5, width - 4, height - 10);
      const selectedHere = units.filter(unit => this.selectedUnits.has(unit.id));
      const mixed = selectedHere.length !== 1 && new Set(units.map(unit => this.platformStyles.get(unit.platformId)?.role || markerRole({}, unit.domain))).size > 1;
      ctx.strokeStyle = selected ? '#172b2c' : '#f0f4e7'; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.translate(point.x + (imageDrawn ? 12 : 0), point.y + (imageDrawn ? 6 : 1)); ctx.scale(imageDrawn ? .52 : .82, imageDrawn ? .52 : .82);
      if (imageDrawn) { ctx.fillStyle = selected ? '#e9d6a5ee' : '#20343bee'; ctx.beginPath(); ctx.roundRect(-11, -11, 22, 22, 4); ctx.fill(); }
      if (mixed) { ctx.strokeRect(-7, -5, 14, 10); ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(4, -8); ctx.moveTo(-10, -8); ctx.lineTo(-10, 2); ctx.stroke(); }
      else ctx.stroke(this.rolePaths.get(role) || this.rolePaths.get('infantry'));
      ctx.restore();
      const health = units.reduce((sum, unit) => sum + Math.max(0, Number(unit.health) || 0), 0) / Math.max(1, units.reduce((sum, unit) => sum + (Number(unit.maxHealth) || 100), 0));
      ctx.fillStyle = '#0e2027'; ctx.fillRect(left + 3, top + height - 4, width - 6, 2); ctx.fillStyle = health < .35 ? '#e3957c' : health < .7 ? '#e4c878' : '#98d0b1'; ctx.fillRect(left + 3, top + height - 4, (width - 6) * Math.min(1, health), 2);
      if (units.length > 1) {
        ctx.fillStyle = selected ? '#fff0c5' : '#e0e7d7'; ctx.strokeStyle = '#183039'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(point.x + width / 2 - 9, top - 6, 19, 15, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#142b30'; ctx.font = '700 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(units.length), point.x + width / 2, top + 1);
      }
      ctx.restore();
    }
    this.canvas.dataset.mapMarkerCount = this.unitHits.length;
  }
  drawArtwork(art, x, y, width, height) {
    if (!art?.src) return false;
    let image = this.images.get(art.src);
    if (!image) {
      if (this.images.size >= 2) return false;
      image = new Image(); this.images.set(art.src, image); image.onload = () => this.invalidate(); image.onerror = () => this.invalidate(); image.src = art.src;
    }
    if (!image.complete || !image.naturalWidth) return false;
    const tileWidth = image.naturalWidth / art.columns, tileHeight = image.naturalHeight / art.rows;
    this.ctx.drawImage(image, art.column * tileWidth, art.row * tileHeight, tileWidth, tileHeight, x, y, width, height); return true;
  }
  hit(x, y, groundFirst = this.targeting) {
    const unit = denseMarkerChoices(this.unitHits, x, y)[0];
    if (unit && !groundFirst) return unit;
    const world = this.toWorld(x, y), ctx = this.ctx; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    let selected = null;
    if (this.camera.zoom >= 2.6 && this.view) for (const chunks of this.chunks.values()) { const item = chunks.find(item => ctx.isPointInPath(item.path, world.x, world.y, 'evenodd')); if (item) { selected = { countryId: item.feature.properties.countryId, provinceId: provinceId(item.feature), feature: item.feature }; break; } }
    if (!selected) { const item = this.countries.find(item => ctx.isPointInPath(item.path, world.x, world.y, 'evenodd')); if (item) selected = { countryId: countryId(item.feature), feature: item.feature }; }
    ctx.restore();
    // Moving markers retain their logical source province until arrival. An
    // order tap names the ground beneath them, while ordinary taps select units.
    if (selected && groundFirst) return { ...selected, ...(unit ? { unitIds: unit.unitIds } : {}) };
    if (unit) return unit;
    return selected;
  }
  tapHit(x, y, time) {
    if (this.targeting) { this.lastTap = null; return this.hit(x, y, true); }
    const choices = denseMarkerChoices(this.unitHits, x, y);
    if (!choices.length) { this.lastTap = null; return this.hit(x, y); }
    const ids = [...new Set(choices.flatMap(choice => choice.unitIds))], live = new Set(ids), previous = this.lastTap;
    const continuing = previous && time - previous.time < 2500 && Math.hypot(x - previous.x, y - previous.y) < 18 && previous.order.some(id => live.has(id));
    // Interpolation can reorder markers or split/recombine a stack between
    // taps. Keep individual selection progress, rather than restarting whenever
    // a distance sort or pixel grouping changes. Every return still comes from
    // the formations intersecting this tap in the current filtered view.
    const order = continuing ? [...previous.order.filter(id => live.has(id)), ...ids.filter(id => !previous.order.includes(id))] : ids;
    const visited = continuing ? new Set(previous.visited) : new Set();
    const next = continuing && order.find(id => !visited.has(id));
    let selected = choices[0];
    if (next) { selected = choices.find(choice => choice.unitIds.length === 1 && choice.unitIds[0] === next); visited.add(next); }
    else visited.clear();
    this.lastTap = { x, y, order, visited, time }; return selected;
  }
  pointerDown(event) {
    if (event.button !== 0) return; this.canvas.setPointerCapture(event.pointerId); this.pointers.set(event.pointerId, { x: event.offsetX, y: event.offsetY });
    if (this.pointers.size === 1) this.drag = { x: event.offsetX, y: event.offsetY, currentX: event.offsetX, currentY: event.offsetY, cameraX: this.camera.x, cameraY: this.camera.y, moved: false, selecting: event.shiftKey, pinched: false };
    if (this.pointers.size === 2) { const points = [...this.pointers.values()]; this.pinch = { distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }; if (this.drag) this.drag.pinched = true; this.lastTap = null; }
  }
  pointerMove(event) {
    if (!this.pointers.has(event.pointerId)) { const hit = this.hit(event.offsetX, event.offsetY); this.canvas.style.cursor = hit ? 'pointer' : 'grab'; this.onHover(hit, { x: event.offsetX, y: event.offsetY }); return; }
    this.pointers.set(event.pointerId, { x: event.offsetX, y: event.offsetY });
    if (this.pointers.size >= 2) {
      const points = [...this.pointers.values()], pinch = { distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      if (this.pinch?.distance > 0) {
        const before = this.toWorld(this.pinch.x, this.pinch.y); this.camera.zoom = Math.max(1, Math.min(28, this.camera.zoom * pinch.distance / this.pinch.distance));
        this.camera.x = before.x - (pinch.x - this.width / 2) / this.scale; this.camera.y = before.y - (pinch.y - this.height / 2) / this.scale; this.constrain(); this.invalidate();
      }
      this.pinch = pinch; return;
    }
    if (!this.drag) return;
    this.drag.currentX = event.offsetX; this.drag.currentY = event.offsetY;
    const dx = event.offsetX - this.drag.x, dy = event.offsetY - this.drag.y;
    if (Math.hypot(dx, dy) > 5) { this.drag.moved = true; this.lastTap = null; }
    if (!this.drag.selecting) { this.camera.x = this.drag.cameraX - dx / this.scale; this.camera.y = this.drag.cameraY - dy / this.scale; this.constrain(); }
    this.invalidate();
  }
  pointerUp(event, cancelled = false) {
    this.pointers.delete(event.pointerId); if (this.canvas.hasPointerCapture?.(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    if (this.pointers.size) {
      const point = this.pointers.values().next().value;
      this.drag = { x: point.x, y: point.y, currentX: point.x, currentY: point.y, cameraX: this.camera.x, cameraY: this.camera.y, moved: true, selecting: false, pinched: true };
      this.pinch = null; return;
    }
    const drag = this.drag; this.drag = null; this.invalidate(); this.loadVisible();
    this.pinch = null; if (!drag || drag.pinched || cancelled) return;
    if (drag.selecting && drag.moved) { const x1 = Math.min(drag.x, drag.currentX), x2 = Math.max(drag.x, drag.currentX), y1 = Math.min(drag.y, drag.currentY), y2 = Math.max(drag.y, drag.currentY); this.onUnits(this.unitHits.filter(hit => hit.x >= x1 && hit.x <= x2 && hit.y >= y1 && hit.y <= y2).flatMap(hit => hit.units).filter(unit => unit.nationId === this.view?.player?.nationId).map(unit => unit.id)); }
    else if (!drag.moved) { const hit = this.tapHit(event.offsetX, event.offsetY, event.timeStamp); if (hit) this.onSelect(hit); }
  }
  destroy() { this.destroyed = true; this.resizeObserver.disconnect(); if (this.frame) cancelAnimationFrame(this.frame); for (const args of this.listeners) this.canvas.removeEventListener(...args); for (const image of this.images.values()) image.onload = image.onerror = null; this.pointers.clear(); }
}
