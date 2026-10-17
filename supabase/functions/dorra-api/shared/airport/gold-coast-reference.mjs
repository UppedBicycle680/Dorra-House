// Independent source anchors in PDF points (419.528 x 595.276 page).
// Airservices BCGAD01-173, 1 Dec 2022, September 2026 DAP edition.
// The diagram exaggerates pavement widths and slightly compresses the short
// strip. Published physical dimensions therefore take precedence over tracing.
export const GOLD_COAST_REFERENCE=Object.freeze({
  chartUrl:'https://www.airservicesaustralia.com/aip/pending/dap/BCGAD01-173_03SEP2026.pdf',
  main14:[135.5,193.526],main32:[310.2,500.426],
  runway17:[219.75,320.676],runway35:[213.85,398.676],
  fireStation:[244,301.5],tower:[251,310.5],fuel:[257,289.5],
  ndb:[171,311.5],vor:[180,390],
  primaryLengthM:2492,primaryWidthM:45,secondaryLengthM:582,secondaryWidthM:18,
  mainBearing:139,secondaryBearing:173,
  // Identity/location confirmed by 2024 Master Plan, printed pp.129,133,140.
  masterPlanUrl:'https://cdn.intelligencebank.com/au/share/gvLrlP/MP89V/2y9ZN/original/GCA_Master%2BPlan%2BReport_250721_V4-SCREEN-72dpi'
});
export function goldCoastChartPoint([x,y]){
  const {main14:a,main32:b}=GOLD_COAST_REFERENCE,dx=b[0]-a[0],dy=b[1]-a[1],factor=498.4/(dx*dx+dy*dy);
  return [((x-a[0])*dx+(y-a[1])*dy)*factor,116+(-(x-a[0])*dy+(y-a[1])*dx)*factor];
}
