import {ARCHERFIELD_CHART_GEOMETRY as geometry} from './archerfield-chart-geometry.mjs';
export const ARCHERFIELD_SOURCE={chart:'https://www.airservicesaustralia.com/aip/pending/dap/BAFAD01-180_03SEP2026.pdf',effective:'2026-09-03',physicalLengthM:1727,start:[67.5,314.026],end:[325.4,396.526]};
// One similarity transform for lengths, widths, aircraft and every precinct.
export const ARCHERFIELD_SCALE=300/1727;
export function archerfieldChartPoint([x,y]){
 const a=ARCHERFIELD_SOURCE.start,b=ARCHERFIELD_SOURCE.end,dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy;
 return [300*((x-a[0])*dx+(y-a[1])*dy)/d,116+300*(-(x-a[0])*dy+(y-a[1])*dx)/d];
}
export const chartPixel=p=>archerfieldChartPoint(p.map(v=>v*595.276/1600));
export const transformSurface=s=>({rings:s.rings.map(r=>r.map(archerfieldChartPoint)),triangles:s.triangles.map(r=>r.map(archerfieldChartPoint))});
export const referencePavement=transformSurface(geometry.pavement);
export function polygonRect(p){const xs=p.map(p=>p[0]),ys=p.map(p=>p[1]);return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};}
export const referenceBuildings=geometry.buildings.flatMap(b=>b.rings.filter(r=>r.length>3).map((r,i)=>{const polygon=r.map(archerfieldChartPoint);return {id:b.id+(i?'-'+i:''),sourcePath:b.sourcePath,polygon,rect:polygonRect(polygon),height:1.3};}));
export const runwayReferencePolygons=Object.fromEntries(Object.entries(geometry.runwayPolygons).map(([id,p])=>[id,p.map(archerfieldChartPoint)]));
export const ARCHERFIELD_APRONS=[
 ['hotel-apron',[[833,796],[889,802],[875,871],[819,861]]],
 ['northern-apron',[[897,650],[930,658],[912,734],[881,725]]],
 ['eastern-apron',[[801,955],[867,966],[857,1008],[788,991]]],
 ['western-apron',[[217,796],[266,811],[256,830],[211,816]]],
 ['southern-apron',[[710,1120],[843,1138],[838,1170],[703,1150]]]
].map(([id,p])=>({id,polygon:p.map(chartPixel),scenic:true}));
// Centre lines sampled inside the extracted surface. Surface boundaries, not
// these lines or animation paths, determine what is paved.
export const ARCHERFIELD_TAXIWAYS=[
 ['B',[[211,812.5],[250,825.5],[275,833.5],[380,867.2],[610,940.9],[760,987],[779,994],[815,1003],[839,1015],[852,1025],[861,1034],[869,1046],[870,1052],[866,1063]]],
 ['A',[[176,882],[265,913],[771,1083],[850,1101]]],
 ['B8',[[187,846],[187,838],[193,817],[197,813],[204,812],[211,816]]],
 ['B7',[[213,817],[222,792],[247,802]]],
 ['B6',[[246,865],[254,835]]],['B5',[[337,895],[348,860]]],
 ['B4',[[510,950],[520,918]]],['B3',[[612,981],[623,947]]],
 ['B2',[[773,1034],[785,997]]],['B1',[[866,1064],[874,1046],[858,1029],[842,1038]]],
 ['A8',[[183,845],[169,886],[184,895]]],['A7',[[243,936],[250,908]]],
 ['A6',[[359,973],[367,947]]],['A5',[[458,1004],[466,980]]],['A4',[[555,1034],[563,1013]]],['A3',[[668,1070],[675,1050]]],
 ['A2',[[773,1034],[762,1080]]],['A1',[[866,1064],[857,1099],[844,1100]]],
 ['C',[[451,890],[830,590],[803,558]],'grass'],
 ['D',[[543,915],[874,654],[859,628]],'grass'],
 ['D2',[[830,590],[889,545],[902,543],[941,589],[941,604]],'grass'],
 ['F',[[645,852],[806,875]]],['F1',[[645,852],[621,823]],'grass'],['F2',[[587,781],[563,751]],'grass'],
 ['G',[[692,699],[800,831],[812,854]],'grass'],
 ['G1',[[741,759],[762,785]],'grass'],['G2',[[679,683],[706,716]],'grass'],
 ['H3',[[776,614],[807,653]],'grass'],['H2',[[839,688],[887,650]],'grass'],
 ['H1',[[809,862],[844,690],[896,650]]],['H',[[779,996],[809,862]]],
 ['E',[[625,948],[797,918]]],['J',[[882,874],[899,765]]],['J1',[[809,875],[879,888]]],
 ['K',[[893,750],[900,706],[929,712]]],
 ['S',[[661,1102],[715,1120],[713,1130],[835,1151],[845,1117],[865,1120]]],
 ['S1',[[847,1100],[842,1133]]],['S2',[[786,1088],[775,1140]]],['S3',[[663,1070],[646,1130]]]
].map(([id,p,surface])=>({id,points:p.map(chartPixel),width:15*ARCHERFIELD_SCALE,surface:surface||'asphalt',cornerRadius:0,scenic:true}));
export const archerfieldStandSpecs=()=>[802,815,828,841,854].map((x,i)=>{
 const y=970+(x-802)*.31,position=chartPixel([x,y]),merge=chartPixel([x-4,y+20]);
 const heading=Math.atan2(position[1]-merge[1],position[0]-merge[0]);
 const envelope=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[position[0]+u*3*Math.cos(heading)-v*2.6*Math.sin(heading),position[1]+u*3*Math.sin(heading)+v*2.6*Math.cos(heading)]);
 return {x:position[0],y:position[1],position,merge,heading,headingDeg:heading*180/Math.PI,
  rect:{x:position[0]-3,y:position[1]-3,w:6,h:6},physicalBay:true,envelope,conflicts:[],referenceStand:'G'+(i+1),apronId:'eastern-apron',maxAircraftSpan:28.42*ARCHERFIELD_SCALE};
});
