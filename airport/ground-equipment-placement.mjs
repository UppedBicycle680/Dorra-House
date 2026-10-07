import {GROUND_EQUIPMENT,groundEquipmentGeometry,equipmentFitsAirport} from './ground-equipment.mjs';
import {AIRCRAFT_MODELS} from './aircraft-models.mjs';
import {planPassengerShuttle} from './passenger-shuttle.mjs';

const inside=(p,ring)=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit}return hit};
const rect=r=>[[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h]];
const orient=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const crosses=(a,b,c,d)=>orient(a,b,c)*orient(a,b,d)<-1e-12&&orient(c,d,a)*orient(c,d,b)<-1e-12;
const boundsCache=new WeakMap();
const bounds=p=>{if(boundsCache.has(p))return boundsCache.get(p);const b=[Infinity,Infinity,-Infinity,-Infinity];for(const q of p){b[0]=Math.min(b[0],q[0]);b[1]=Math.min(b[1],q[1]);b[2]=Math.max(b[2],q[0]);b[3]=Math.max(b[3],q[1])}boundsCache.set(p,b);return b};
export function equipmentOverlaps(a,b){
  const aa=bounds(a),bb=bounds(b);if(aa[2]<bb[0]||bb[2]<aa[0]||aa[3]<bb[1]||bb[3]<aa[1])return false;
  return a.some(p=>inside(p,b))||b.some(p=>inside(p,a))||a.some((p,i)=>b.some((q,j)=>crosses(p,a[(i+1)%a.length],q,b[(j+1)%b.length])));
}
function rectangleAt(x,y,heading,minX,maxX,minY,maxY){
  const c=Math.cos(heading),s=Math.sin(heading);
  return [[minX,minY],[maxX,minY],[maxX,maxY],[minX,maxY]].map(([u,v])=>[x+u*c-v*s,y+u*s+v*c]);
}
export function equipmentFootprint(e,scale,padding=0){
  const {min,max}=groundEquipmentGeometry(e.kind).bounds;
  return rectangleAt(e.x,e.y,e.heading,min[0]*scale-padding,max[0]*scale+padding,min[1]*scale-padding,max[1]*scale+padding);
}
export function aircraftEquipmentExclusion(pose,model,scale,padding=0){
  return rectangleAt(pose.x,pose.y,pose.heading,-model.length*scale/2-padding,model.length*scale/2+padding,-model.wingspan*scale/2-padding,model.wingspan*scale/2+padding);
}
const distanceToSegment=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)};
function indexedPolygon(ring,cellSize){
  const rows=new Map(),cells=new Map();
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],edge=[a,b],minX=Math.floor(Math.min(a[0],b[0])/cellSize),maxX=Math.floor(Math.max(a[0],b[0])/cellSize);
    for(let y=Math.floor(Math.min(a[1],b[1])/cellSize);y<=Math.floor(Math.max(a[1],b[1])/cellSize);y++){
      if(!rows.has(y))rows.set(y,[]);rows.get(y).push(edge);
      for(let x=minX;x<=maxX;x++){const key=x+':'+y;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(edge)}
    }
  }
  return {
    contains(p){let hit=false;for(const [a,b]of rows.get(Math.floor(p[1]/cellSize))||[])if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;return hit},
    crosses(footprint){const bb=bounds(footprint),nearby=new Set();for(let x=Math.floor(bb[0]/cellSize);x<=Math.floor(bb[2]/cellSize);x++)for(let y=Math.floor(bb[1]/cellSize);y<=Math.floor(bb[3]/cellSize);y++)for(const e of cells.get(x+':'+y)||[])nearby.add(e);return footprint.some((a,i)=>[...nearby].some(([b,c])=>crosses(a,footprint[(i+1)%4],b,c)))}
  };
}
const nearestModel=(span)=>Object.values(AIRCRAFT_MODELS).filter(m=>m.wingspan<=span+.01).sort((a,b)=>b.length-a.length)[0]||AIRCRAFT_MODELS.c172;

// A visual fleet parked on existing apron pavement. No economy, routing, airport
// footprints or save data are altered. Bounds are taken from the actual meshes.
export function groundEquipmentPlacements(layout,airport){
  const level=airport?.buildings?.find(b=>b.key==='handling')?.level??0;
  if(!airport?.owned||level<1)return [];
  const scale=layout.metresToWorld,margin=.6*scale;
  const capability=airport.maxSize??5;
  const types=Object.keys(GROUND_EQUIPMENT).filter(k=>k!=='bus'&&GROUND_EQUIPMENT[k].minLevel<=level&&equipmentFitsAirport(k,capability));
  const buildings=[...(layout.terminals||[]),...(layout.referenceBuildings||[]),...(layout.gaBuildings||[]),...Object.values(layout.facilities||{}),...(layout.landmarks||[]).filter(b=>b.individualHangar)].map(b=>b.polygon||(b.rect?rect(b.rect):Number.isFinite(b.w)?rect(b):null)).filter(Boolean);
  const exclusions=(layout.stands||[]).map(stand=>{
    const gate=airport.gates?.find(g=>g.plotId===stand.plotId),assigned=gate?.currentAircraft||gate?.aircraft;
    const model=nearestModel(Math.max(stand.maxAircraftSpan||11,AIRCRAFT_MODELS[assigned?.id]?.wingspan||0));
    return aircraftEquipmentExclusion({x:stand.position[0],y:stand.position[1],heading:stand.heading??layout.standHeading??0},model,scale,margin);
  });
  for(const p of [...(layout.aircraftParking||[]),...(layout.observedGaAircraft||[])])if(p.position){const m=AIRCRAFT_MODELS[p.aircraftId]||AIRCRAFT_MODELS.c172;exclusions.push(aircraftEquipmentExclusion({x:p.position[0],y:p.position[1],heading:p.heading||0},m,scale,margin))}
  const aprons=(layout.aprons||[]).filter(a=>!a.scenic&&!/junction|link-source|parking-pocket/.test(a.id)),placed=[];
  const apronQueries=new Map(aprons.map(a=>[a,indexedPolygon(a.polygon,20*scale)]));
  const candidates=[];
  for(const apron of aprons){
    const xs=apron.polygon.map(p=>p[0]),ys=apron.polygon.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    // Bound the grid size even for the international apron. Prefer points near
    // actual stands so equipment reads as part of the working airport.
    const step=Math.max(4*scale,(maxX-minX)/38,(maxY-minY)/38);
    for(let x=minX+step/2;x<maxX;x+=step)for(let y=minY+step/2;y<maxY;y+=step){
      if(!apronQueries.get(apron).contains([x,y]))continue;
      if([...buildings,...exclusions].some(p=>{const b=bounds(p);return x>=b[0]&&x<=b[2]&&y>=b[1]&&y<=b[3]&&inside([x,y],p)}))continue;
      const stand=(layout.stands||[]).reduce((best,s)=>!best||Math.hypot(x-s.position[0],y-s.position[1])<Math.hypot(x-best.position[0],y-best.position[1])?s:best,null);
      candidates.push({x,y,heading:stand?.heading??layout.standHeading??0,apron,distance:stand?Math.hypot(x-stand.position[0],y-stand.position[1]):0});
    }
  }
  candidates.sort((a,b)=>a.distance-b.distance);
  const bridgeCorridors=(layout.jetways||[]).flatMap(j=>{
    const stand=layout.stands.find(s=>s.plotId===j.plotId);
    return [{points:[j.anchor,j.elbow,j.retracted],width:j.dual?1.6:.6},...(stand?[{points:[j.elbow,stand.position],width:.6}]:[])];
  });
  const lanes=[...(layout.taxiways||[]),...(layout.roads||[]),...bridgeCorridors],reserved=[];
  // Dense chart-derived taxiways have thousands of short segments. Index once
  // so checking a bus pose only visits nearby lanes, not the entire airport.
  const laneCells=new Map(),cellSize=20*scale;
  for(const lane of lanes)for(let i=1;i<lane.points.length;i++){
    const a=lane.points[i-1],b=lane.points[i],r=(lane.width||4)/2+margin,segment={a,b,r};
    for(let x=Math.floor((Math.min(a[0],b[0])-r)/cellSize);x<=Math.floor((Math.max(a[0],b[0])+r)/cellSize);x++)for(let y=Math.floor((Math.min(a[1],b[1])-r)/cellSize);y<=Math.floor((Math.max(a[1],b[1])+r)/cellSize);y++){
      const key=x+':'+y;if(!laneCells.has(key))laneCells.set(key,[]);laneCells.get(key).push(segment);
    }
  }
  const clear=e=>{
    // Shuttle planning includes the larger live aircraft-avoidance margin so
    // an approved stop remains reachable while its aircraft is on stand.
    const footprint=equipmentFootprint(e,scale,e.kind==='bus'?.8*scale:margin),apron=e.apron;
    if([...buildings,...exclusions,...reserved,...placed.map(p=>p.footprint)].some(p=>equipmentOverlaps(footprint,p)))return false;
    // Edge samples catch narrow concavities; explicit edge crossings and hole
    // overlap catch inlets/courtyards that lie between the samples.
    const samples=footprint.flatMap((a,i)=>{const b=footprint[(i+1)%4];return Array.from({length:5},(_,j)=>[a[0]+(b[0]-a[0])*j/5,a[1]+(b[1]-a[1])*j/5])});
    const query=apronQueries.get(apron);if(!samples.every(p=>query.contains(p))||query.crosses(footprint))return false;
    if((apron.holes||[]).some(h=>equipmentOverlaps(footprint,h)))return false;
    if((layout.runways||[]).some(r=>equipmentOverlaps(footprint,r.protectedPolygon||r.polygon||[])))return false;
    const nearby=new Set(),bb=bounds(footprint);
    for(let x=Math.floor(bb[0]/cellSize);x<=Math.floor(bb[2]/cellSize);x++)for(let y=Math.floor(bb[1]/cellSize);y<=Math.floor(bb[3]/cellSize);y++)for(const segment of laneCells.get(x+':'+y)||[])nearby.add(segment);
    for(const {a,b,r}of nearby){
      if(bb[2]<Math.min(a[0],b[0])-r||bb[0]>Math.max(a[0],b[0])+r||bb[3]<Math.min(a[1],b[1])-r||bb[1]>Math.max(a[1],b[1])+r)continue;
      if(inside(a,footprint)||inside(b,footprint)||footprint.some((p,j)=>crosses(p,footprint[(j+1)%4],a,b)||distanceToSegment(p,a,b)<r||distanceToSegment(a,p,footprint[(j+1)%4])<r||distanceToSegment(b,p,footprint[(j+1)%4])<r))return false;
    }
    return footprint;
  };
  if(level>=3&&equipmentFitsAirport('bus',capability)){
    const remoteStands=(layout.stands||[]).filter(s=>!(layout.jetways||[]).some(j=>j.plotId===s.plotId)&&airport.gates?.some(g=>g.plotId===s.plotId&&g.active!==false&&g.size>=2&&g.operationType!=='cargo'&&!AIRCRAFT_MODELS[(g.currentAircraft||g.aircraft)?.id]?.cargo));
    const route=planPassengerShuttle(candidates,remoteStands,layout.terminals||[],scale,clear);
    if(route){const p=route.points[0];placed.push({kind:'bus',x:p.x,y:p.y,heading:p.heading,apronId:route.apronId,footprint:route.footprints[0],shuttleRoute:route,standPlotId:route.standPlotId});reserved.push(...route.footprints)}
    else if(remoteStands.length){
      const stops=candidates.map(c=>({...c,stand:remoteStands.reduce((best,s)=>!best||Math.hypot(c.x-s.position[0],c.y-s.position[1])<Math.hypot(c.x-best.position[0],c.y-best.position[1])?s:best,null)})).sort((a,b)=>Math.hypot(a.x-a.stand.position[0],a.y-a.stand.position[1])-Math.hypot(b.x-b.stand.position[0],b.y-b.stand.position[1]));
      for(const c of stops){if(Math.hypot(c.x-c.stand.position[0],c.y-c.stand.position[1])>45*scale)continue;const e={...c,kind:'bus'},footprint=clear(e);if(footprint){placed.push({kind:'bus',x:e.x,y:e.y,heading:e.heading,apronId:e.apron.id,footprint,standPlotId:c.stand.plotId});break}}
    }
  }
  const count=(level===1?1:Math.min(capability<2?6:16,2+level*3))-placed.length;
  for(let i=0;i<count;i++){
    const kind=types[i%types.length];
    for(const c of candidates){const e={...c,kind},footprint=clear(e);if(!footprint)continue;placed.push({kind,x:e.x,y:e.y,heading:e.heading,apronId:e.apron.id,footprint});break}
  }
  return placed;
}
