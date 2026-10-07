// Independently sampled points from BBNAD01-188, effective 3 September 2026.
// PDF page coordinates, in points from the TOP LEFT (page 419.528 × 595.276 pt).
// These identify building/precinct centres, not surveyed property boundaries.
export const BRISBANE_SOURCE = Object.freeze({
  chart: 'https://www.airservicesaustralia.com/aip/pending/dap/BBNAD01-188_03SEP2026.pdf',
  ground: 'https://www.airservicesaustralia.com/aip/pending/dap/BBNAG01-188_03SEP2026.pdf',
  domestic: 'https://www.airservicesaustralia.com/aip/pending/dap/BBNAP01-186_03SEP2026.pdf',
  north: 'https://www.airservicesaustralia.com/aip/pending/dap/BBNAP06-187_03SEP2026.pdf',
  precinct: 'https://www.bne.com.au/media/1456/download?inline=',
  effective: '2026-09-03', east01R: [214.15,467.826], east19L: [329,243.376], runwayWorldLength: 420,
  calibrationMethod: 'Midpoints of the four-corner eastern runway polygon extracted from the PDF vector path; page height 595.276 pt.',
});
export function brisbaneChartPoint([x,y]) {
  const {east01R:a,east19L:b,runwayWorldLength:length}=BRISBANE_SOURCE;
  const dx=b[0]-a[0],dy=b[1]-a[1],square=dx*dx+dy*dy;
  return [((x-a[0])*dx+(y-a[1])*dy)/square*length,
    116+(-(x-a[0])*dy+(y-a[1])*dx)/square*length];
}
export const BRISBANE_ANCHORS = Object.freeze({
  international: {pdf:[152,471], tolerance:10, target:'international-terminal'},
  domesticHead: {pdf:[211,322], tolerance:10, target:'domestic-headhouse'},
  domesticCrescent: {pdf:[224,323], tolerance:10, target:'domestic-terminal'},
  domesticSouthLounge: {pdf:[222,347.2], tolerance:3, target:'domestic-satellite-0'},
  domesticCentreLounge: {pdf:[240,332], tolerance:3, target:'domestic-satellite-1'},
  domesticNorthLounge: {pdf:[241.5,308.5], tolerance:3, target:'domestic-satellite-2'},
  tower: {pdf:[194,349], tolerance:5, facility:'tower'},
  aviationBuildings: {pdf:[259,243], tolerance:8, facility:'handling'},
  generalAviation: {pdf:[260,234], apron:'north-apron'},
  northRemote: {pdf:[293,148], apron:'north-remote-apron'},
  airlineSouth: {pdf:[263,464], tolerance:6, landmark:'airline-south'},
  airlineMiddle: {pdf:[281,445], tolerance:6, landmark:'airline-middle'},
  airlineNorth: {pdf:[290,425], tolerance:6, landmark:'airline-north'},
  gaMaintenance: {pdf:[341,338], tolerance:8, landmark:'ga-maintenance'},
});
export const BRISBANE_UNUSED_TAXIWAYS = Object.freeze(['A2','A5','A8','C7','C11','H1','S4','S6','S8','S9','S11']);
