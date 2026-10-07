import {AIRCRAFT_MODELS,aircraftGeometry} from './aircraft-models.mjs';

const hull=points=>{
 const sorted=[...new Map(points.map(p=>[p.join(','),p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const half=ps=>{const out=[];for(const p of ps){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};
 return [...half(sorted).slice(0,-1),...half([...sorted].reverse()).slice(0,-1)];
};
const cache=new Map();
const frontDoor=points=>{
 if(!points.length)return null;
 const x=Math.max(...points.map(p=>p[0])),front=points.filter(p=>p[0]>x-2);
 return [front.reduce((n,p)=>n+p[0],0)/front.length,front.reduce((n,p)=>n+p[1],0)/front.length,Math.min(...front.map(p=>p[2]))+.1];
};
export function getAircraftGroundShape(id){
 if(!AIRCRAFT_MODELS[id])return undefined;
 if(cache.has(id))return cache.get(id);
 const model=AIRCRAFT_MODELS[id],geometry=aircraftGeometry(id);
 const gear=geometry.faces.filter(f=>f.part==='landing-gear').flatMap(f=>f.points),minZ=Math.min(...gear.map(p=>p[2]));
 const doors=geometry.faces.filter(f=>f.part==='cabin-door').flatMap(f=>f.points).filter(p=>p[0]>0&&p[1]<0);
 const upper=geometry.faces.filter(f=>f.part==='upper-cabin-door').flatMap(f=>f.points).filter(p=>p[0]>0&&p[1]<0);
 const firstX=Math.max(...doors.map(p=>p[0]));
 const contacts=[...new Map(gear.filter(p=>p[2]<minZ+.03*model.height).map(p=>[p.slice(0,2).join(','),p.slice(0,2)])).values()];
 const remaining=new Set(contacts),contactGroups=[];
 while(remaining.size){const points=[remaining.values().next().value];remaining.delete(points[0]);
  for(let i=0;i<points.length;i++)for(const p of remaining)if(Math.hypot(p[0]-points[i][0],p[1]-points[i][1])<=1.1){remaining.delete(p);points.push(p);}
  const centre=[points.reduce((n,p)=>n+p[0],0)/points.length,points.reduce((n,p)=>n+p[1],0)/points.length];
  contactGroups.push({points,centre,radius:Math.max(...points.map(p=>Math.hypot(p[0]-centre[0],p[1]-centre[1])))+.00001});
 }
 const shape={cargo:Boolean(model.cargo),door:frontDoor(doors),secondDoor:frontDoor(upper.length?upper:doors.filter(p=>p[0]<firstX-2)),contacts,contactGroups,
  hull:hull(geometry.faces.flatMap(f=>f.points).map(p=>p.slice(0,2))),
  wheels:hull(contacts)};
 // The extracted ground data owns its points. Return browser models to their
 // compact rendering representation after this exact double-precision audit.
 // Node geometry and the resulting collision/door coordinates are unchanged.
 geometry.releaseInspectionGeometry?.();
 cache.set(id,shape);return shape;
}
// Lazy access keeps unshown aircraft inexpensive and shares aircraftGeometry's
// own cache. No generated snapshot can drift away from the rendered mesh.
export const AIRCRAFT_GROUND_SHAPES=Object.defineProperties({},Object.fromEntries(
 Object.keys(AIRCRAFT_MODELS).map(id=>[id,{enumerable:true,get:()=>getAircraftGroundShape(id)}])
));
