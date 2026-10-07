import {HAMILTON_CHART} from './hamilton-chart-geometry.mjs';
export const HAMILTON_APRON_SOURCE='https://www.airservicesaustralia.com/aip/pending/dap/BHMAP01-179_03SEP2026.pdf';
export const HAMILTON_SCALE=420/1766;
export function hamiltonGeoPoint([lat,lon]){
  const east=(lon-148.94891944444445)*111320*Math.cos(20.3521972222*Math.PI/180);
  const south=(-20.352197222222223-lat)*111320;
  return [64.58965553572077+HAMILTON_SCALE*(east*.6+south*.8),85.6656008556688+HAMILTON_SCALE*(-east*.8+south*.6)];
}
// BHMAP01-179 parking table. 1A is an overlapping alternative to 1, not a
// seventh simultaneous airliner bay. Keep plot 1–6 IDs; old plot 7 becomes 1A.
export const HAMILTON_PARKING_TABLE=[
  ['1',7.91,56.11,36],['2',7.93,58.41,36],['3',9.55,60.45,36],
  ['4',11.10,61.69,36],['5',12.53,62.43,36],['6',14.04,60.13,28.5],['1A',8.58,56.07,36]
].map(([id,latSeconds,lonSeconds,maxSpanM])=>({id,geo:[-(20+21/60+latSeconds/3600),148+56/60+lonSeconds/3600],maxSpanM}));
// Native PDF points, calibrated to its 200 m scale bar. One orthonormal
// transform for every precinct feature: no longitudinal or lateral stretching.
export function hamiltonPoint([px,py]) {
  const x=px-78.956,y=py-115.434,s=HAMILTON_SCALE*200/70.8;
  return [(x*.6+y*.8)*s,116+(-x*.8+y*.6)*s];
}
export function hamiltonApronPoint(p){return hamiltonPoint(p.map(n=>n*595.276/1800))}
export const HAMILTON_STAND_CHART_POINTS=[[522.4,499.7],[593.7,500.4],[656.9,553.6],[695.4,604.5],[718.3,651.4],[647,700.98]];
export const HAMILTON_TERMINAL_POLYGON=HAMILTON_CHART.terminal.map(hamiltonPoint);
export const HAMILTON_PAVEMENT=Object.fromEntries(['rings','triangles'].map(k=>[k,HAMILTON_CHART.apron[k].map(r=>r.map(hamiltonPoint))]));
// Close the 1.3 m chart-symbol gap where D meets the physically dimensioned runway.
const dThroat=[[163.9,243.176],[168.1,248.376],[170.5,247],[166.3,241.8]].map(hamiltonPoint);
HAMILTON_PAVEMENT.rings.push(dThroat);HAMILTON_PAVEMENT.triangles.push([dThroat[0],dThroat[1],dThroat[2]],[dThroat[0],dThroat[2],dThroat[3]]);
export const hamiltonRect=points=>{const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}};
export const HAMILTON_LAND=HAMILTON_CHART.land.map(r=>r.map(([px,py])=>{
  // Continue clipped land beyond the camera instead of drawing the PDF page
  // boundary as a straight coastline on tall screens. Interior coast stays exact.
  if(Math.abs(px-29.88)<.02)px=-10000;if(Math.abs(px-389.64)<.02)px=10000;
  if(Math.abs(py-73.08)<.02)py=-10000;if(Math.abs(py-543.24)<.02)py=10000;
  // The smaller AD chart has a 1:30,000 scale, independently calibrated.
  const x=px-175.9,y=py-220.7,s=HAMILTON_SCALE/.0945;
  return [(x*.6+y*.8)*s,116+(-x*.8+y*.6)*s];
}));
export function hamiltonStandSpecs(){
  return HAMILTON_PARKING_TABLE.map((row,index)=>{const pin=hamiltonGeoPoint(row.geo);return {x:pin[0],y:pin[1],position:pin,pin,physicalBay:true,
    heading:row.id==='6'?0:(index<2||row.id==='1A')?Math.atan2(-.51,-.86):-Math.PI/2,referenceStand:row.id,
    sourceGeo:row.geo,capacity:row.id==='6'?'GLF5':'A20N/B38M',conflictGroup:['1','1A'].includes(row.id)?'1/1A':row.id,
    rect:hamiltonRect([[pin[0]-2,pin[1]-2],[pin[0]+2,pin[1]+2]]),maxAircraftSpan:row.maxSpanM*HAMILTON_SCALE,
    maxAircraftLength:(row.id==='6'?29.4:Infinity)*HAMILTON_SCALE,apronId:'main-apron'};});
}
export function hamiltonTaxiways(){
  const traces=[['E',[[113,158],[136,142]],6],['A',[[138,186],[159,171]],23],
    ['B',[[183,245],[211,225]],23],['C',[[213,282],[230,270]],10.5],
    ['D',[[169,246],[148,260],[148,270],[176,311]],18],
    ['apron',[[143,146],[162,172],[196,219],[203,229]],23]];
  return traces.map(([id,points,width])=>({id,points:points.map(hamiltonPoint),width:width*HAMILTON_SCALE,cornerRadius:0}));
}
export const HAMILTON_BUILDINGS=HAMILTON_CHART.buildings.map(p=>({polygon:p.map(hamiltonPoint),rect:hamiltonRect(p.map(hamiltonPoint))}));
