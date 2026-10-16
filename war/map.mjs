const COLORS = { ocean: '#101b23', land: '#29383e', border: '#516066', friendly: '#31594f', hostile: '#633d40', allied: '#354f63', selected: '#8a7851', text: '#c1cdce' };
const countryId = feature => String(feature.properties?.countryId || feature.properties?.sovereignId || feature.properties?.id || feature.id || feature.properties?.ISO_A2 || '');
const regionId = feature => String(feature.properties?.regionId || feature.properties?.id || feature.id || '');
const provinceId = feature => String(feature.properties?.id || feature.id || '');

export class CommandMap {
  constructor(canvas, { onSelect = () => {}, onUnits = () => {}, onTarget = () => {}, onHover = () => {}, onError = () => {} } = {}) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.onSelect = onSelect; this.onUnits = onUnits; this.onTarget = onTarget; this.onHover = onHover; this.onError = onError;
    this.countries = []; this.chunks = new Map(); this.provinces = new Map(); this.pending = new Set(); this.failedChunks = new Set();
    this.nations = []; this.view = null; this.selectedCountry = null; this.selectedProvince = null; this.selectedUnits = new Set();
    this.camera = { x: 180, y: 88, zoom: 1 }; this.pointers = new Map(); this.unitHits = []; this.frame = 0; this.drag = null;
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(canvas);
    this.listeners = [];
    this.listen('wheel', event => { event.preventDefault(); this.zoom(Math.exp(-event.deltaY * .0015), event.offsetX, event.offsetY); }, { passive: false });
    this.listen('pointerdown', event => this.pointerDown(event));
    this.listen('pointermove', event => this.pointerMove(event));
    this.listen('pointerup', event => this.pointerUp(event));
    this.listen('pointercancel', event => { this.pointers.delete(event.pointerId); this.drag = null; this.invalidate(); });
    this.listen('contextmenu', event => { event.preventDefault(); const hit = this.hit(event.offsetX, event.offsetY, true); if (hit) this.onTarget(hit); });
    this.listen('keydown', event => { if (event.key === '+' || event.key === '=') this.zoom(1.3); if (event.key === '-') this.zoom(1 / 1.3); if (event.key.toLowerCase() === 'h') this.home(); });
  }
  listen(type, listener, options) { this.canvas.addEventListener(type, listener, options); this.listeners.push([type, listener, options]); }
  async load() {
    const response = await fetch('./assets/war/world.json');
    if (!response.ok) throw new Error('The world map could not be downloaded. Reconnect to try again.');
    const data = await response.json();
    this.countries = (data.features || []).map(feature => this.prepare(feature)); this.invalidate();
  }
  prepare(feature) {
    const path = new Path2D(); let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const polygons = feature.geometry?.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry?.type === 'MultiPolygon' ? feature.geometry.coordinates : [];
    for (const polygon of polygons) for (const ring of polygon) {
      let previous = null;
      for (const point of ring) {
        const x = point[0] + 180, y = 90 - Math.max(-85, Math.min(85, point[1]));
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        if (previous === null || Math.abs(point[0] - previous) > 180) path.moveTo(x, y); else path.lineTo(x, y);
        previous = point[0];
      }
      path.closePath();
    }
    return { feature, path, bounds: { minX, minY, maxX, maxY } };
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
  setView(view) { this.view = view; this.displayTime = view?.match?.gameTime; this.invalidate(); this.loadVisible(); }
  setDisplayTime(gameTime) { this.displayTime = gameTime; if (this.view?.units?.some(unit => unit.order?.arrival)) this.invalidate(); }
  setOrderPreview(order) { this.orderPreview = order; this.invalidate(); }
  setTargeting(enabled) { this.targeting = Boolean(enabled); }
  setSelection({ country = this.selectedCountry, province = this.selectedProvince, units = this.selectedUnits } = {}) { this.selectedCountry = country; this.selectedProvince = province; this.selectedUnits = new Set(units); this.invalidate(); }
  async focus(country) {
    this.selectedCountry = country;
    const nation = this.nations.find(item => item.id === country);
    if (nation) { this.camera.x = Number(nation.lng) + 180; this.camera.y = 90 - Number(nation.lat); this.camera.zoom = 3.6; }
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
    if (!id || this.chunks.has(id) || this.pending.has(id) || this.failedChunks.has(id)) return;
    this.pending.add(id);
    try {
      const response = await fetch(`./assets/war/provinces/${encodeURIComponent(id)}.json`);
      if (!response.ok) throw new Error(`Province map for ${this.nations.find(n => n.id === id)?.name || id} is unavailable.`);
      const data = await response.json(); const chunks = (data.features || []).map(feature => this.prepare(feature));
      this.chunks.set(id, chunks); for (const item of chunks) this.provinces.set(provinceId(item.feature), item.feature); this.invalidate();
    } catch (error) { this.failedChunks.add(id); this.onError(error); }
    finally { this.pending.delete(id); }
  }
  loadVisible() {
    if (this.camera.zoom < 2.6 || !this.view) return;
    const min = this.toWorld(0, 0), max = this.toWorld(this.width, this.height);
    const visible = this.countries.filter(item => item.bounds.maxX > min.x && item.bounds.minX < max.x && item.bounds.maxY > min.y && item.bounds.minY < max.y);
    // Fetch visible chunks only, with a small concurrency bound on mobile.
    for (const item of visible) { const id = regionId(item.feature); if (this.chunks.has(id) || this.pending.has(id) || this.failedChunks.has(id)) continue; if (this.pending.size >= 3) break; void this.loadChunk(id).then(() => { if (this.pending.size === 0) this.loadVisible(); }); }
  }
  invalidate() { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.draw(); }); }
  relation(id) {
    if (id === this.view?.player?.nationId || (!this.view && id === this.selectedCountry)) return 'friendly';
    const relation = this.view?.nations?.find(nation => nation.id === id)?.relation;
    return ['war', 'hostile', 'enemy'].includes(relation) ? 'hostile' : ['allied', 'alliance', 'coalition'].includes(relation) ? 'allied' : 'neutral';
  }
  draw() {
    if (!this.width || !this.height) return;
    const ctx = this.ctx; ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.fillStyle = COLORS.ocean; ctx.fillRect(0, 0, this.width, this.height);
    const gradient = ctx.createRadialGradient(this.width * .6, this.height * .4, 0, this.width * .5, this.height * .5, this.width); gradient.addColorStop(0, '#1a2b34'); gradient.addColorStop(1, '#0c151c'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, this.width, this.height);
    this.transform(); ctx.lineWidth = .35 / this.scale; ctx.strokeStyle = '#35434c'; ctx.globalAlpha = .35;
    for (let x = 0; x <= 360; x += 30) { ctx.beginPath(); ctx.moveTo(x, 5); ctx.lineTo(x, 175); ctx.stroke(); }
    for (let y = 0; y <= 180; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(360, y); ctx.stroke(); } ctx.globalAlpha = 1;
    for (const item of this.countries) {
      const id = countryId(item.feature), relation = this.relation(id);
      ctx.fillStyle = id === this.selectedCountry ? COLORS.selected : COLORS[relation] || COLORS.land;
      ctx.fill(item.path, 'evenodd'); ctx.strokeStyle = id === this.selectedCountry ? '#d7bc7b' : COLORS.border; ctx.lineWidth = (id === this.selectedCountry ? 1.2 : .7) / this.scale; ctx.stroke(item.path);
    }
    const ownership = new Map((this.view?.provinces || []).map(province => [province.id, province]));
    if (this.camera.zoom >= 2.6 && this.view) for (const chunks of this.chunks.values()) for (const item of chunks) {
      const id = provinceId(item.feature), province = ownership.get(id);
      if (province) { const owner = province.ownerId || province.nationId; ctx.fillStyle = id === this.selectedProvince ? '#8a7851' : COLORS[this.relation(owner)] || COLORS.land; ctx.fill(item.path, 'evenodd'); }
      ctx.strokeStyle = id === this.selectedProvince ? '#f1d091' : '#718080'; ctx.globalAlpha = id === this.selectedProvince ? 1 : .36; ctx.lineWidth = (id === this.selectedProvince ? 1.6 : .65) / this.scale; ctx.stroke(item.path); ctx.globalAlpha = 1;
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawLabels(); this.drawRoutePreview(); this.drawUnits();
    if (this.drag?.selecting) { ctx.fillStyle = '#cdb57918'; ctx.strokeStyle = '#cdb579'; const { x, y, currentX, currentY } = this.drag; ctx.fillRect(x, y, currentX - x, currentY - y); ctx.strokeRect(x, y, currentX - x, currentY - y); }
  }
  drawLabels() {
    const ctx = this.ctx, occupied = [];
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const nation of [...this.nations].sort((a, b) => (b.military || 0) - (a.military || 0))) {
      const point = this.toScreen(Number(nation.lng), Number(nation.lat));
      if (point.x < 0 || point.x > this.width || point.y < 0 || point.y > this.height) continue;
      const label = nation.name?.toUpperCase() || nation.id, width = Math.min(130, label.length * 6);
      if (occupied.some(previous => Math.abs(previous.x - point.x) < (previous.width + width) / 2 && Math.abs(previous.y - point.y) < 22) && nation.id !== this.selectedCountry) continue;
      occupied.push({ ...point, width }); ctx.font = `${nation.id === this.selectedCountry ? '600' : '500'} ${this.camera.zoom > 3 ? 10 : 8}px system-ui`; ctx.letterSpacing = '1px'; ctx.fillStyle = nation.id === this.selectedCountry ? '#f3dca3' : '#a7b4b4'; ctx.shadowColor = '#0b151b'; ctx.shadowBlur = 5; ctx.fillText(label, point.x, point.y); ctx.shadowBlur = 0;
    }
    if (this.camera.zoom > 5) for (const feature of this.provinces.values()) {
      const properties = feature.properties; if (!properties.city && !properties.capital) continue;
      const point = this.toScreen(properties.lng, properties.lat); if (point.x < 0 || point.x > this.width || point.y < 0 || point.y > this.height) continue;
      ctx.fillStyle = '#c6b47e'; ctx.beginPath(); ctx.arc(point.x, point.y, properties.capital ? 3 : 1.8, 0, Math.PI * 2); ctx.fill(); ctx.font = '10px system-ui'; ctx.fillStyle = '#b8c2c1'; ctx.fillText(properties.name, point.x, point.y + 13);
    }
  }
  unitPoint(unit) {
    const feature = this.provinces.get(unit.provinceId), nation = this.nations.find(item => item.id === unit.nationId);
    let position = unit.position || feature?.properties || nation;
    const order = unit.order, destination = order?.legTarget && this.provinces.get(order.legTarget)?.properties;
    if (!unit.position && position && destination && Number.isFinite(Number(order.arrival)) && Number(order.arrival) > Number(order.departure)) {
      const fraction = Math.max(0, Math.min(1, ((this.displayTime ?? this.view.match.gameTime) - Number(order.departure)) / (Number(order.arrival) - Number(order.departure))));
      let longitudeChange = Number(destination.lng) - Number(position.lng); if (longitudeChange > 180) longitudeChange -= 360; if (longitudeChange < -180) longitudeChange += 360;
      const lng = ((Number(position.lng) + longitudeChange * fraction + 540) % 360) - 180;
      position = { lng, lat: Number(position.lat) + (Number(destination.lat) - Number(position.lat)) * fraction };
    }
    return position && Number.isFinite(Number(position.lng)) ? this.toScreen(Number(position.lng), Number(position.lat)) : null;
  }
  drawRoutePreview() {
    const order = this.orderPreview; if (!order) return;
    const unit = this.view?.units?.find(item => item.id === order.unitIds[0]);
    const start = unit && this.unitPoint(unit); if (!start) return;
    const ctx = this.ctx; ctx.save(); ctx.strokeStyle = '#e2c68a'; ctx.fillStyle = '#e2c68a'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(start.x, start.y);
    const points = [...(order.waypoints || []), order.targetProvinceId].map(id => this.provinces.get(id)?.properties).filter(Boolean).map(properties => this.toScreen(properties.lng, properties.lat));
    for (const point of points) ctx.lineTo(point.x, point.y); ctx.stroke(); ctx.setLineDash([]);
    for (let index = 0; index < points.length; index++) { const point = points[index]; ctx.beginPath(); ctx.arc(point.x, point.y, index === points.length - 1 ? 6 : 4, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  drawUnits() {
    this.unitHits = []; const ctx = this.ctx; const grouped = new Map();
    for (const unit of this.view?.units || []) {
      const point = this.unitPoint(unit); if (!point) continue;
      const key = `${Math.round(point.x / 20)}:${Math.round(point.y / 20)}:${unit.nationId}`;
      if (!grouped.has(key)) grouped.set(key, { point, units: [] }); grouped.get(key).units.push(unit);
    }
    for (const { point, units } of grouped.values()) {
      if (point.x < -20 || point.x > this.width + 20 || point.y < -20 || point.y > this.height + 20) continue;
      const selected = units.some(unit => this.selectedUnits.has(unit.id)), relation = this.relation(units[0].nationId);
      ctx.fillStyle = selected ? '#cdb579' : relation === 'friendly' ? '#408575' : relation === 'hostile' ? '#b06665' : '#627d8e'; ctx.strokeStyle = selected ? '#f9e3aa' : '#d1ddda'; ctx.lineWidth = selected ? 2 : .8;
      ctx.beginPath(); ctx.roundRect(point.x - 14, point.y - 11, 28, 22, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = selected ? '#18252a' : '#eef3ef'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(units.length > 1 ? String(units.length) : units[0].domain === 'air' ? '✈' : units[0].domain === 'sea' || units[0].domain === 'naval' ? '⚓' : '▰', point.x, point.y + 1);
      this.unitHits.push({ x: point.x, y: point.y, units });
    }
  }
  hit(x, y, groundFirst = this.targeting) {
    const unit = this.unitHits.find(item => Math.abs(item.x - x) < 19 && Math.abs(item.y - y) < 17);
    if (unit && !groundFirst) return { unitIds: unit.units.map(item => item.id), countryId: unit.units[0].nationId, provinceId: unit.units[0].provinceId };
    const world = this.toWorld(x, y), ctx = this.ctx; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    let selected = null;
    if (this.camera.zoom >= 2.6 && this.view) for (const chunks of this.chunks.values()) { const item = chunks.find(item => ctx.isPointInPath(item.path, world.x, world.y, 'evenodd')); if (item) { selected = { countryId: item.feature.properties.countryId, provinceId: provinceId(item.feature), feature: item.feature }; break; } }
    if (!selected) { const item = this.countries.find(item => ctx.isPointInPath(item.path, world.x, world.y, 'evenodd')); if (item) selected = { countryId: countryId(item.feature), feature: item.feature }; }
    ctx.restore();
    // Moving markers retain their logical source province until arrival. An
    // order tap names the ground beneath them, while ordinary taps select units.
    if (selected && groundFirst) return { ...selected, ...(unit ? { unitIds: unit.units.map(item => item.id) } : {}) };
    if (unit) return { unitIds: unit.units.map(item => item.id), countryId: unit.units[0].nationId, provinceId: unit.units[0].provinceId };
    return selected;
  }
  pointerDown(event) {
    if (event.button !== 0) return; this.canvas.setPointerCapture(event.pointerId); this.pointers.set(event.pointerId, { x: event.offsetX, y: event.offsetY });
    if (this.pointers.size === 1) this.drag = { x: event.offsetX, y: event.offsetY, currentX: event.offsetX, currentY: event.offsetY, cameraX: this.camera.x, cameraY: this.camera.y, moved: false, selecting: event.shiftKey, pinched: false };
    if (this.pointers.size === 2) { const points = [...this.pointers.values()]; this.pinchDistance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y); if (this.drag) this.drag.pinched = true; }
  }
  pointerMove(event) {
    if (!this.pointers.has(event.pointerId)) { const hit = this.hit(event.offsetX, event.offsetY); this.canvas.style.cursor = hit ? 'pointer' : 'grab'; this.onHover(hit, { x: event.offsetX, y: event.offsetY }); return; }
    this.pointers.set(event.pointerId, { x: event.offsetX, y: event.offsetY });
    if (this.pointers.size === 2) { const points = [...this.pointers.values()], distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y); if (this.pinchDistance > 0) this.zoom(distance / this.pinchDistance, (points[0].x + points[1].x) / 2, (points[0].y + points[1].y) / 2); this.pinchDistance = distance; return; }
    if (!this.drag || this.drag.pinched) return;
    this.drag.currentX = event.offsetX; this.drag.currentY = event.offsetY;
    const dx = event.offsetX - this.drag.x, dy = event.offsetY - this.drag.y;
    if (Math.hypot(dx, dy) > 5) this.drag.moved = true;
    if (!this.drag.selecting) { this.camera.x = this.drag.cameraX - dx / this.scale; this.camera.y = this.drag.cameraY - dy / this.scale; this.constrain(); }
    this.invalidate();
  }
  pointerUp(event) {
    this.pointers.delete(event.pointerId); if (this.pointers.size) return;
    const drag = this.drag; this.drag = null; this.invalidate(); this.loadVisible();
    if (!drag || drag.pinched) return;
    if (drag.selecting && drag.moved) { const x1 = Math.min(drag.x, drag.currentX), x2 = Math.max(drag.x, drag.currentX), y1 = Math.min(drag.y, drag.currentY), y2 = Math.max(drag.y, drag.currentY); this.onUnits(this.unitHits.filter(hit => hit.x >= x1 && hit.x <= x2 && hit.y >= y1 && hit.y <= y2).flatMap(hit => hit.units).filter(unit => unit.nationId === this.view?.player?.nationId).map(unit => unit.id)); }
    else if (!drag.moved) { const hit = this.hit(event.offsetX, event.offsetY); if (hit) this.onSelect(hit); }
  }
  destroy() { this.resizeObserver.disconnect(); if (this.frame) cancelAnimationFrame(this.frame); for (const args of this.listeners) this.canvas.removeEventListener(...args); }
}
