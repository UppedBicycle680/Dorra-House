import {redcliffeConfig} from './redcliffe-layout.mjs';
import {queenslandGatewayConfig} from './queensland-gateway-layout.mjs';
/**
 * Recognisable, hand-authored airport schematics; not aeronautical charts.
 * The main runway is horizontal for a consistent isometric camera. Aircraft and
 * pavement widths share metresToWorld; most runway lengths are compressed.
 * YBSU is an exception: its chart-derived layout uses one uniform scale.
 * Real runway topology is retained, while game plots/roads are redevelopment.
 * See REFERENCES.md for primary sources and deliberate schematic departures.
 */
import { brisbaneConfig } from './brisbane-layout.mjs';
import {hamiltonConfig} from './hamilton-layout.mjs';
import { goldCoastConfig } from './gold-coast-layout.mjs';
import { createFlightPlan } from './traffic.mjs';
import { archerfieldConfig } from './archerfield-layout.mjs';
import { sunshineCoastConfig } from './sunshine-coast-layout.mjs';
const PI = Math.PI;
const frozen = object => {
  if (object && typeof object === 'object') { for (const value of Object.values(object)) frozen(value); Object.freeze(object); }
  return object;
};
export const rectPolygon = ({ x, y, w, h }) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

export function runwayPolygon(runway, width = runway.width, extension = 0) {
  const [ax, ay] = runway.start, [bx, by] = runway.end, length = Math.hypot(bx - ax, by - ay);
  if (!length || !Number.isFinite(width) || width <= 0) throw new RangeError('A runway needs nonzero length and positive width.');
  const dx = (bx - ax) / length, dy = (by - ay) / length, nx = -dy * width / 2, ny = dx * width / 2;
  return [[ax - dx * extension + nx, ay - dy * extension + ny], [bx + dx * extension + nx, by + dy * extension + ny],
    [bx + dx * extension - nx, by + dy * extension - ny], [ax - dx * extension - nx, ay - dy * extension - ny]];
}
export function polylineLength(points) {
  return points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point[0] - points[index][0], point[1] - points[index][1]), 0);
}
export function pointAlongPath(points, fraction) {
  if (!Array.isArray(points) || !points.length) throw new RangeError('A path needs at least one point.');
  const t = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  const total = polylineLength(points);
  if (!total) return { x: points[0][0], y: points[0][1], heading: 0, headingDeg: 0, segmentIndex: 0, t };
  let remaining = t * total;
  for (let index = 0; index < points.length - 1; index++) {
    const a = points[index], b = points[index + 1], segment = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!segment) continue;
    if (remaining <= segment || index === points.length - 2) {
      const local = Math.min(1, remaining / segment), heading = Math.atan2(b[1] - a[1], b[0] - a[0]);
      return { x: a[0] + (b[0] - a[0]) * local, y: a[1] + (b[1] - a[1]) * local, heading, headingDeg: heading * 180 / PI, segmentIndex: index, t };
    }
    remaining -= segment;
  }
  return { x: points.at(-1)[0], y: points.at(-1)[1], heading: 0, headingDeg: 0, segmentIndex: points.length - 2, t };
}

const bounds = (minX = -50, minY = -70, maxX = 355, maxY = 165) => ({ minX, minY, maxX, maxY });
const rect = (x, y, w, h) => ({ x, y, w, h });
const building = (id, name, x, y, w, h, kind = 'terminal') => ({ id, name, kind, rect: rect(x, y, w, h) });
const landmark = (kind, label, x, y, w, h, options = {}) => ({ kind, label, x, y, w, h, ...options });
const lane = (id, points, width, options = {}) => ({ id, points, width, ...options });

function runway(id, designators, start, end, realLengthM, realWidthM, metresToWorld, options = {}) {
  const entry = { id, designators, start, end, width: realWidthM * metresToWorld, realLengthM, realWidthM,
    role: 'primary', surface: 'asphalt', operational: true, activeForGame: true, ...options };
  entry.polygon = runwayPolygon(entry);
  entry.protectedWidth ??= Math.max(30, entry.width + 12);
  entry.protectedPolygon = runwayPolygon(entry, entry.protectedWidth, entry.protectedExtension??18);
  return entry;
}
function standardTaxiways(width = 6) {
  return [
    lane('inbound', [[6, 58], [298, 58]], width, { direction: 'westbound', purpose: 'arrival' }),
    lane('outbound', [[6, 82], [298, 82]], width, { direction: 'westbound', purpose: 'departure' }),
    lane('runway-entry', [[6, 82], [6, 86], [6, 96], [6, 116], [22, 116]], width, { holdShort: [6, 86], holdShortLine: [6, 96] }),
    lane('runway-exit', [[285, 116], [292, 116], [292, 58], [285, 58]], width)
  ];
}
function stands(xs, y = 28, apronId = 'main-apron', runwayId = 'main') {
  return xs.map((x, index) => ({ plotId: `plot-${index + 1}`, index, position: [x, y], x, y,
    heading: -PI / 2, headingDeg: -90, maxAircraftSpan: 18, rect: rect(x - 11, y - 11, 22, 22), apronId, runwayId,
    baselineRoutesOnly: true,
    arrivalPath: [[0, 116], [285, 116], [292, 116], [292, 58], [285, 58], [x, 58], [x, y]],
    departurePath: [[x, y], [x, 82], [x + 14, 82], [6, 82], [6, 86], [6, 96], [6, 116], [22, 116], [300, 116]],
    taxiPath: [[x, y], [x, 82], [x + 14, 82], [6, 82], [6, 86]],
    holdShort: [6, 86], holdShortLine: [6, 96]
  }));
}
function makeLayout(config) {
  const result = {
    version: 1, fictional: false, magneticVariation: 11, headingPrecision: 'runway-designator',
    primaryRunwayId: 'main', activeRunwayIndex: 0, runwayCentreY: 116,
    approachThreshold: [0, 116], departureThreshold: [300, 116],
    inboundLaneY: 58, outboundLaneY: 82, inboundY: 58, outboundY: 82, holdShort: [6, 86], holdShortLine: [6, 96],
    standHeading: -PI / 2, roads: [], water: [], landmarks: [],
    terminalStyle: 'regional', baseGround: '#9fc481',
    caveat: 'Schematic redevelopment inspired by the real airport. Game plots, upgrade lengths and facilities are fictional; this is not a navigation chart.',
    ...config
  };
  // World +x has the stated magnetic runway bearing. True north includes local
  // east magnetic variation; use the vector through the isometric projection.
  result.northAngleDeg = -result.magneticHeading - result.magneticVariation;
  result.northVector = config.northVector??[Math.cos(result.northAngleDeg * PI / 180), Math.sin(result.northAngleDeg * PI / 180)];
  result.northLabel = 'N';
  result.taxiwayWidth = result.taxiwayWidthM * result.metresToWorld;
  result.taxiways ??= standardTaxiways(result.taxiwayWidth);
  result.stands = config.standSpecs
    ? config.standSpecs.map((spec, index) => ({ ...stands([spec.x], spec.y ?? 28, spec.apronId)[0], ...spec,
      plotId: `plot-${index + 1}`, index }))
    : stands(config.standXs, config.standY ?? 28);
  // Baseline paths use each site's full runway, including Brisbane's larger
  // geographic footprint. Live routes still follow the developed runway length.
  const primary = result.runways.find(item => item.id === result.primaryRunwayId);
  for (const stand of config.standSpecs ? result.stands : []) {
    const [x, y] = stand.position, [sx, ry] = primary.start, end = primary.end[0];
    const inY = result.inboundLaneY, outY = result.outboundLaneY;
    if(result.standVisualScale&&!stand.physicalBay){const half=11*result.standVisualScale;stand.rect=rect(x-half,y-half,half*2,half*2);stand.maxAircraftSpan=88.4*result.metresToWorld;}
    stand.holdShort=result.holdShort;stand.holdShortLine=result.holdShortLine;
    const pushX=x+(x+14>sx+6?14:-14);
    stand.arrivalPath = [[sx, ry], [end - 15, ry], [end - 8, ry], [end - 8, inY], [x, inY], [x, y]];
    stand.departurePath = [[x, y], [x, outY], [pushX, outY], [sx + 6, outY], result.holdShort, result.holdShortLine, [sx + 6, ry], [sx + 22, ry], [end, ry]];
    stand.taxiPath = stand.departurePath.slice(0, 5);
  }
  result.aprons ??= [{ id: 'main-apron', polygon: rectPolygon(rect(Math.min(...config.standXs) - 15, 13, Math.max(...config.standXs) - Math.min(...config.standXs) + 30, 78)) }];
  if (result.compactTaxiways) for (const stand of result.stands) {
    const plan = createFlightPlan(result, { runwayLength: primary.realLengthM, maxRunwayLength: primary.realLengthM }, stand);
    stand.arrivalPath = [...plan.landing, ...plan.exit, ...plan.inbound];
    stand.departurePath = [...plan.pushback, ...plan.outbound, ...plan.lineup, ...plan.takeoff];
    stand.taxiPath = [...plan.pushback, ...plan.outbound];
  }
  result.runwayProtectedCorridors = result.runways.map(item => ({ runwayId: item.id, activeForGame: item.activeForGame, polygon: item.protectedPolygon }));
  if (result.taxiwayNetwork === 'redcliffe') for (const stand of result.stands) {
    const plan = createFlightPlan(result, { runwayLength: 800, maxRunwayLength: 800 }, stand);
    stand.arrivalPath = [...plan.landing, ...plan.exit, ...plan.inbound];
    stand.departurePath = [...plan.pushback, ...plan.outbound, ...plan.lineup, ...plan.takeoff];
    stand.taxiPath = [...plan.pushback, ...plan.outbound];
  }
  if(['queensland-gateway','brisbane-bays','terminal-end','ybsu','hamilton','gold-coast'].includes(result.routeModel)||result.taxiRouting)for(const stand of result.stands){
    const plan=createFlightPlan(result,{runwayLength:primary.realLengthM,maxRunwayLength:primary.realLengthM},stand,['brisbane-bays','gold-coast'].includes(result.routeModel)?{length:stand.maxLength,wingspan:stand.maxSpan}:undefined);
    if(result.routeModel==='queensland-gateway'){stand.holdShort=plan.hold;stand.holdShortLine=plan.holdLine}
    stand.arrivalPath=[...plan.landing,...plan.exit.slice(1),...plan.inbound.slice(1)];
    stand.departurePath=[...plan.pushback,...plan.outbound.slice(1),...plan.lineup.slice(1),...plan.takeoff.slice(1)];
    stand.taxiPath=[...plan.pushback,...plan.outbound.slice(1)];
  }
  delete result.standXs; delete result.standY; delete result.standSpecs;
  return result;
}

export const AIRPORT_LAYOUTS = frozen({
  redcliffe: makeLayout(redcliffeConfig({bounds,rect,building,lane,runway})),
  archerfield: makeLayout(archerfieldConfig({bounds,rect,rectPolygon,building,landmark,lane,runway})),
  'granite-plains': makeLayout(queenslandGatewayConfig({bounds,rect,rectPolygon,building,landmark,lane,runway})),
  'hamilton-island': makeLayout(hamiltonConfig({bounds,runway})),
  'sunshine-coast': makeLayout(sunshineCoastConfig({bounds,rect,rectPolygon,building,landmark,lane,runway})),
  'gold-coast': makeLayout(goldCoastConfig({bounds,rect,rectPolygon,building,landmark,lane,runway})),
  brisbane: makeLayout(brisbaneConfig({bounds,rect,rectPolygon,building,landmark,lane,runway}))
});

export function getAirportLayout(id) {
  if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(AIRPORT_LAYOUTS, id)) throw new RangeError(`Unknown airport layout: ${String(id)}`);
  return AIRPORT_LAYOUTS[id];
}
export function getStandLayout(airportId, plotId) {
  const layout = getAirportLayout(airportId);
  const stand = typeof plotId === 'number' ? layout.stands[plotId] : layout.stands.find(item => item.plotId === plotId);
  if (!stand) throw new RangeError(`Unknown stand ${String(plotId)} at ${airportId}`);
  return stand;
}

