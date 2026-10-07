import {ARCHERFIELD_SCALE as s,chartPixel as px,ARCHERFIELD_TAXIWAYS} from './archerfield-reference.mjs';
// Aerodrome chart strokes are generalized. ERSA 03 SEP 2026, p.2 gives
// physical pavement widths: Bravo 10.5 m, B1/B8 15 m. Preserve centreline
// registration while restoring those widths for full-size wheel footprints.
export const ARCHERFIELD_WIDTH_SOURCE='https://www.airservicesaustralia.com/aip/current/ersa/FAC_YBAF_03SEP2026.pdf';
function corridor(id,points,widthM){
 const r=widthM*s/2,polygons=[];
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]),n=[-(b[1]-a[1])*r/d,(b[0]-a[0])*r/d];polygons.push([a.map((v,i)=>v+n[i]),b.map((v,i)=>v+n[i]),b.map((v,i)=>v-n[i]),a.map((v,i)=>v-n[i])]);}
 for(const a of points)polygons.push(Array.from({length:24},(_,i)=>[a[0]+Math.cos(i*Math.PI/12)*r,a[1]+Math.sin(i*Math.PI/12)*r]));
 return {id,widthM,points,polygons,source:ARCHERFIELD_WIDTH_SOURCE};
}
export const archerfieldSurfaceWidths=[
 corridor('B',ARCHERFIELD_TAXIWAYS.find(t=>t.id==='B').points,10.5),
 corridor('B1',[[815,1003],[839,1015],[852,1025],[861,1034],[869,1046],[870,1052],[866,1063]].map(px),15),
 corridor('B8',[[218,815],[211,812.5],[204,811.5],[197,813],[193,817],[187,838],[187,846]].map(px),15)
];
