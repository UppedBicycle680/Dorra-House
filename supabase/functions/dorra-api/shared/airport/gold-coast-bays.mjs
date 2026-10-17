import {GOLD_COAST_PUBLISHED_POSITIONS} from './gold-coast-parking-source.mjs';
import {goldCoastChartPoint} from './gold-coast-reference.mjs';

// Interpolate the aerodrome chart's longitude/latitude ticks, including its
// small grid rotation. Published stops stay independent of the terminal mesh.
export function goldCoastGeographicPoint(p){
  let y=90.376+261.6*p.latitudeSeconds/60;
  const x=127.1+231.9*p.longitudeSeconds/60-(1.9+.1*p.longitudeSeconds/60)*(y-72.976)/470.6;
  y+=(x-29.8)*1.5/360;
  return goldCoastChartPoint([x,y]);
}
const legacy=Array.from({length:9},(_,i)=>String(i+2));
const ordered=[...legacy.map(id=>GOLD_COAST_PUBLISHED_POSITIONS.find(p=>p.bay===id)),...GOLD_COAST_PUBLISHED_POSITIONS.filter(p=>!legacy.includes(p.bay))];
export const GOLD_COAST_BAYS=ordered.map((p,index)=>{
  const group=p.bay.replace(/[LR]$/,''),ga=group==='G1',remote=group==='30';
  const pin=goldCoastGeographicPoint(p),heading=ga?Math.PI/2:remote?Math.PI:['1','2'].includes(group)?0:group==='3'?({ '3L':-30,'3':-45,'3R':-80 }[p.bay])*Math.PI/180:-Math.PI/2;
  const maxSpan=ga?18:p.code==='E'?65:36,maxLength=ga?18:p.code==='E'?74:44.51,maxSize=ga?1:p.code==='E'?4:3;
  const position=pin.map((v,i)=>v-[Math.cos(heading),Math.sin(heading)][i]*maxLength*.34*.2);
  // Compact selection footprint. Aircraft clearance is verified with actual
  // projected meshes; rectangular wing/length bounds overlap valid MARS bays.
  const envelope=[[-2,-2],[2,-2],[2,2],[-2,2]].map(p=>p.map((v,i)=>v+position[i]));
  return {...p,group,pin,referencePoint:pin,referenceStand:p.bay,position,x:position[0],y:position[1],heading,headingDeg:heading*180/Math.PI,
    plotId:`plot-${index+1}`,index,label:`Bay ${p.bay}`,physicalBay:true,maxSpan,maxLength,maxSize,
    precinct:ga?'General aviation':remote?'Remote apron':'Terminal',referenceCapacity:ga?'Code B · maximum 18 m wingspan':`Code ${p.code}`,apronId:ga?'ga-apron':remote?'remote-apron':'main-apron',
    docking:['8','9'].includes(group)?'SAFEGATE':'MARSHALLER',envelope,maxAircraftSpan:maxSpan*.2,rect:{x:position[0]-2,y:position[1]-2,w:4,h:4},conflicts:[]};
});
for(const a of GOLD_COAST_BAYS)for(const b of GOLD_COAST_BAYS){
  if(a!==b&&a.group===b.group&&(a.code==='E'||b.code==='E'))a.conflicts.push(b.plotId);
}
export const GOLD_COAST_BAY_BY_PLOT=Object.fromEntries(GOLD_COAST_BAYS.map(b=>[b.plotId,b]));
export const GOLD_COAST_PARKING_CAPACITY={terminalPositions:28,terminalCodeC:19,terminalCodeE:7,remotePositions:3,remoteCodeC:2,remoteCodeE:1,publishedGaPositions:1,helicopterPositions:3,sharedGaCapacity:null};
