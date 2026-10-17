import test from 'node:test';
import assert from 'node:assert/strict';
import { CommandMap } from '../war/map.mjs';
import { MAP_DEFAULT_LAYERS, cityLabelVisible, denseMarkerChoices, getMapLegend, markerRole, moraleColor, nationColor, normalizeMapLayers, provinceColor, rangeRing, selectedOwnUnits } from '../war/map-style.mjs';

const own = (id, extra = {}) => ({ id, nationId: 'FR', provinceId: 'FR-1', platformId: 'test-platform', domain: 'land', health: 100, ...extra });
const contact = (id, extra = {}) => own(id, { nationId: 'LU', ...extra });
function mapFixture() {
  const map = Object.create(CommandMap.prototype);
  const calls = [];
  Object.assign(map, {
    width: 390, height: 844, camera: { x: 180, y: 88, zoom: 8 },
    canvas: { dataset: {}, setPointerCapture() {}, hasPointerCapture: () => false },
    pointers: new Map(), provinces: new Map(), nations: [], countries: [], unitHits: [],
    layers: { ...MAP_DEFAULT_LAYERS }, selectedUnits: new Set(), platforms: new Map(),
    view: { player: { nationId: 'FR' }, match: { gameTime: 50 }, units: [] },
    invalidate() {}, loadVisible() {}, onSelect: hit => calls.push(hit),
  });
  return { map, calls };
}

test('map layers accept only the four supported lenses and boolean visibility options', () => {
  assert.deepEqual(normalizeMapLayers(null, { mode: 'satellite', units: 'false', privateRadar: true }), MAP_DEFAULT_LAYERS);
  const changed = normalizeMapLayers(MAP_DEFAULT_LAYERS, { mode: 'morale', ranges: false, cities: false });
  assert.deepEqual(changed, { ...MAP_DEFAULT_LAYERS, mode: 'morale', ranges: false, cities: false });
  assert.equal(MAP_DEFAULT_LAYERS.ranges, true);
});

test('morale remains unknown when the filtered view does not disclose a number', () => {
  for (const unknown of [null, undefined, '', '100', NaN]) assert.equal(moraleColor(unknown), '#394b54');
  assert.equal(moraleColor(-10), moraleColor(0)); assert.equal(moraleColor(120), moraleColor(100));
  assert.notEqual(moraleColor(20), moraleColor(80));
  assert.equal(provinceColor({ mode: 'morale', ownerId: 'LU' }), '#394b54');
  assert.equal(getMapLegend('morale').entries.at(-1).color, moraleColor(null));
});

test('political ownership, relations and terrain have matching deterministic legend colours', () => {
  assert.equal(nationColor('FR'), nationColor('FR')); assert.notEqual(nationColor('FR'), nationColor('LU'));
  assert.equal(provinceColor({ mode: 'political', ownerId: 'LU' }), nationColor('LU'));
  const relations = getMapLegend('relations');
  assert.equal(provinceColor({ mode: 'relations', relation: 'hostile' }), relations.entries.find(entry => entry.label === 'At war').color);
  const terrain = getMapLegend('terrain');
  assert.equal(provinceColor({ mode: 'terrain', terrain: 'forest' }), terrain.entries.find(entry => entry.label === 'Forest').color);
});

test('role glyphs distinguish armour, indirect fire, engineering, naval and air formations', () => {
  for (const [platform, expected] of [
    [{ domain: 'land', capabilities: ['armor'] }, 'armor'],
    [{ domain: 'land', capabilities: ['indirect-fire'] }, 'artillery'],
    [{ domain: 'land', capabilities: ['entrench', 'repair'] }, 'engineers'],
    [{ domain: 'sea', capabilities: ['submarine'] }, 'submarine'],
    [{ domain: 'sea', capabilities: ['air-base-at-sea'] }, 'carrier'],
    [{ domain: 'air', role: 'rotary' }, 'helicopter'],
    [{ domain: 'air', role: 'drones' }, 'drone'],
    [{ domain: 'missile', capabilities: ['interceptor'] }, 'air-defense'],
  ]) assert.equal(markerRole(platform), expected);
});

test('listed game range follows spherical distance at high latitudes and across the antimeridian', () => {
  const radians = Math.PI / 180;
  for (const center of [{ lng: 179.8, lat: 70 }, { lng: 174.7772, lat: -41.2921 }]) {
    const ring = rangeRing(center.lng, center.lat, 350);
    assert.equal(ring.length, 73);
    for (const point of ring) {
      assert.ok(point.lng >= -180 && point.lng <= 180);
      const cosine = Math.sin(center.lat * radians) * Math.sin(point.lat * radians) + Math.cos(center.lat * radians) * Math.cos(point.lat * radians) * Math.cos((point.lng - center.lng) * radians);
      assert.ok(Math.abs(6371 * Math.acos(Math.max(-1, Math.min(1, cosine))) - 350) < .00001);
    }
  }
  assert.deepEqual(rangeRing(0, 0, 0), []); assert.deepEqual(rangeRing(NaN, 0, 30), []);
});

test('selected tactical information excludes enemy formations and views without a player nation', () => {
  const view = { player: { nationId: 'FR' }, units: [own('a'), contact('b')] };
  assert.deepEqual(selectedOwnUnits(view, ['a', 'b']).map(unit => unit.id), ['a']);
  assert.deepEqual(selectedOwnUnits({ units: [{ id: 'unknown' }] }, ['unknown']), []);
});

test('theatre label hierarchy keeps capitals and selections while delaying ordinary city names', () => {
  assert.equal(cityLabelVisible({ capital: true }, 4, 'selected'), true);
  assert.equal(cityLabelVisible({ province: 'selected' }, 4, 'selected'), true);
  assert.equal(cityLabelVisible({ province: 'other' }, 20, 'selected'), false);
  assert.equal(cityLabelVisible({ port: true }, 11, 'selected'), false);
  assert.equal(cityLabelVisible({ port: true }, 12, 'selected'), true);
  assert.equal(cityLabelVisible({}, 24, 'selected'), true);
});

test('dense stacks retain geographic centres and expose every member plus overlapping contacts', () => {
  const hits = [{ x: 100, y: 200, halfWidth: 27, halfHeight: 23, units: [own('infantry'), own('engineers'), own('tank')] }, { x: 100, y: 200, halfWidth: 27, halfHeight: 23, units: [contact('visible-contact')] }];
  assert.deepEqual(denseMarkerChoices(hits, 100, 200).map(choice => choice.unitIds), [['infantry', 'engineers', 'tank'], ['infantry'], ['engineers'], ['tank'], ['visible-contact']]);
  assert.deepEqual(denseMarkerChoices(hits, 128, 200), []);
  assert.equal(hits[0].x, 100); assert.equal(hits[1].y, 200);
});

test('ordinary repeat taps cycle formations while an order tap retains ground-first targeting', () => {
  const { map } = mapFixture();
  map.unitHits = [{ x: 100, y: 200, halfWidth: 27, halfHeight: 23, units: [own('infantry'), own('engineers')] }];
  assert.deepEqual(map.tapHit(100, 200, 100).unitIds, ['infantry', 'engineers']);
  assert.deepEqual(map.tapHit(100, 200, 200).unitIds, ['infantry']);
  assert.deepEqual(map.tapHit(100, 200, 300).unitIds, ['engineers']);
  assert.deepEqual(map.tapHit(100, 200, 3000).unitIds, ['infantry', 'engineers']);
  map.targeting = true; map.hit = (x, y, groundFirst) => ({ provinceId: 'under-travelling-marker', groundFirst });
  assert.deepEqual(map.tapHit(100, 200, 3100), { provinceId: 'under-travelling-marker', groundFirst: true });
});

test('moving and regrouping counters preserve cycling progress without selecting departed contacts', () => {
  const { map } = mapFixture();
  const hit = (x, units) => ({ x, y: 200, halfWidth: 27, halfHeight: 23, units });
  const infantry = own('infantry'), engineers = own('engineers'), tank = own('tank'), enemy = contact('visible-contact');
  map.unitHits = [hit(100, [infantry, engineers, tank]), hit(102, [enemy])];
  assert.deepEqual(map.tapHit(100, 200, 100).unitIds, ['infantry', 'engineers', 'tank']);
  assert.deepEqual(map.tapHit(100, 200, 200).unitIds, ['infantry']);
  // The moving infantry splits off and the foreign counter becomes closest.
  map.unitHits = [hit(100, [enemy]), hit(101, [tank, engineers]), hit(105, [infantry])];
  assert.deepEqual(map.tapHit(100, 200, 300).unitIds, ['engineers']);
  // Pixel groups merge again in a new member order; every original individual
  // remains reachable exactly once before another whole-stack selection.
  map.unitHits = [hit(99, [tank, infantry, engineers]), hit(101, [enemy])];
  assert.deepEqual(map.tapHit(100, 200, 400).unitIds, ['tank']);
  assert.deepEqual(map.tapHit(100, 200, 500).unitIds, ['visible-contact']);
  assert.deepEqual(map.tapHit(100, 200, 600).unitIds, ['tank', 'infantry', 'engineers']);
  assert.deepEqual(map.tapHit(100, 200, 700).unitIds, ['infantry']);
  // A contact outside the hit box cannot be returned from a cached sequence.
  map.unitHits = [hit(100, [infantry, engineers, tank]), hit(150, [enemy])];
  assert.deepEqual(map.tapHit(100, 200, 800).unitIds, ['engineers']);
  assert.deepEqual(map.tapHit(100, 200, 900).unitIds, ['tank']);
  assert.deepEqual(map.tapHit(100, 200, 1000).unitIds, ['infantry', 'engineers', 'tank']);
  // New visible contacts join the current cycle; removed ones do not survive.
  const newcomer = contact('new-visible-contact');
  map.unitHits = [hit(100, [infantry]), hit(101, [newcomer])];
  assert.deepEqual(map.tapHit(100, 200, 1100).unitIds, ['infantry']);
  assert.deepEqual(map.tapHit(100, 200, 1200).unitIds, ['new-visible-contact']);
});

test('visible enemy private mission fields never move a contact or invent a fallback position', () => {
  const { map } = mapFixture();
  map.provinces.set('FR-1', { properties: { lng: 2, lat: 48 } });
  map.provinces.set('destination', { properties: { lng: 4, lat: 50 } });
  const order = { legTarget: 'destination', departure: 0, arrival: 100 };
  assert.deepEqual(map.unitLocation(own('a', { order })), { lng: 3, lat: 49 });
  assert.deepEqual(map.unitLocation(contact('b', { order })), { lng: 2, lat: 48 });
  assert.equal(map.unitLocation(contact('unknown', { provinceId: 'unloaded' })), null);
  assert.deepEqual(map.unitLocation(contact('server-position', { order, position: { lng: 3.2, lat: 49.1 } })), { lng: 3.2, lat: 49.1 });
});

test('range and route rendering counts only selected friendly information and obeys layer toggles', () => {
  const { map } = mapFixture();
  map.ctx = new Proxy({}, { get: (_, key) => key === 'setLineDash' ? () => {} : () => {}, set: () => true });
  map.platforms.set('test-platform', { stats: { range: 200 } });
  map.provinces.set('FR-1', { properties: { lng: 2, lat: 48 } }); map.provinces.set('target', { properties: { lng: 3, lat: 49 } });
  map.view.units = [own('a', { order: { targetProvinceId: 'target' } }), contact('b', { order: { targetProvinceId: 'target' } })];
  map.selectedUnits = new Set(['a', 'b']); map.drawTacticalOverlays();
  assert.equal(map.canvas.dataset.mapRangeCount, 1); assert.equal(map.canvas.dataset.mapRouteCount, 1);
  map.selectedUnits = new Set(['b']); map.drawTacticalOverlays();
  assert.equal(map.canvas.dataset.mapRangeCount, 0); assert.equal(map.canvas.dataset.mapRouteCount, 0);
  map.selectedUnits = new Set(['a']); map.layers.ranges = false; map.layers.routes = false; map.drawTacticalOverlays();
  assert.equal(map.canvas.dataset.mapRangeCount, 0); assert.equal(map.canvas.dataset.mapRouteCount, 0);
});

test('pinch preserves the geographic midpoint, permits one-finger continuation and never selects', () => {
  const { map, calls } = mapFixture();
  const event = (id, x, y) => ({ pointerId: id, button: 0, offsetX: x, offsetY: y, timeStamp: 100 });
  map.pointerDown(event(1, 100, 200)); map.pointerDown(event(2, 200, 200));
  const anchor = map.toWorld(150, 200);
  map.pointerMove(event(1, 80, 220));
  const after = map.toWorld(140, 210);
  assert.ok(Math.abs(anchor.x - after.x) < 1e-10); assert.ok(Math.abs(anchor.y - after.y) < 1e-10);
  assert.ok(map.camera.zoom > 8);
  map.pointerUp(event(1, 80, 220)); const priorX = map.camera.x;
  map.pointerMove(event(2, 180, 200)); assert.notEqual(map.camera.x, priorX);
  map.pointerUp(event(2, 180, 200)); assert.deepEqual(calls, []);
  map.pointerDown(event(3, 100, 200)); map.pointerUp(event(3, 100, 200), true); assert.deepEqual(calls, []);
});

test('phone country focus fits the primary theatre and ignores distant dependencies', async () => {
  const { map } = mapFixture();
  map.nations = [{ id: 'FR', lng: 2.5, lat: 46.5, regionIds: ['FR', 'GF'] }];
  map.countries = [{ feature: { properties: { id: 'FR', countryId: 'FR' } }, parts: [{ minX: 175, maxX: 188, minY: 39, maxY: 48 }, { minX: 125, maxX: 127, minY: 84, maxY: 86 }] }];
  map.loadChunk = async () => {};
  await map.focus('FR');
  assert.ok(map.camera.zoom > 10 && map.camera.zoom <= 28);
  const left = map.toScreen(-5, 46), right = map.toScreen(8, 46);
  assert.ok(right.x - left.x > 250 && right.x - left.x < 390);
});
