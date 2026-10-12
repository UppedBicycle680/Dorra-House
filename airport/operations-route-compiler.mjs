// Build-time only. Keep the authoritative runtime free of layout and mesh data.
import {AIRCRAFT_GROUND_SHAPES} from './aircraft-ground-geometry.mjs';
import {bnePolygonsOverlap,floorFor} from './brisbane-route-clearance.mjs';

const bounds=p=>({minX:Math.min(...p.map(q=>q[0])),minY:Math.min(...p.map(q=>q[1])),maxX:Math.max(...p.map(q=>q[0])),maxY:Math.max(...p.map(q=>q[1]))});
const overlaps=(a,b)=>a.minX<b.maxX&&a.maxX>b.minX&&a.minY<b.maxY&&a.maxY>b.minY;

/** Compile the exact existing 0.15-world-unit hull/wheel clearance sampling.
 * Fixed pavement/building failures reject a route. Occupied-stand intersections
 * become its trusted blocker list and are evaluated against live gates later.
 * No occupancy is assumed while compiling; every other stand is considered. */
export function compileBrisbaneRequirements(layout,stand,model,plan,roundedPath,phaseCache=new Map()){
  const shape=AIRCRAFT_GROUND_SHAPES[model.id];
  if(!shape||!plan.routeAvailable)return null;
  const unit=layout.metresToWorld,on=floorFor(layout,roundedPath);
  const fixed=layout.terminals.map(t=>({polygon:t.polygon,bounds:bounds(t.polygon)}));
  const parked=layout.stands.filter(s=>s.plotId!==stand.plotId).map(s=>({plotId:s.plotId,polygon:s.envelope,bounds:bounds(s.envelope)}));
  const radius=Math.max(...shape.hull.map(p=>Math.hypot(...p)))*unit;
  const blockers=new Set();
  for(const phase of ['inbound','pushback','outbound']){
    const points=plan[phase],key=JSON.stringify([stand.plotId,model.id,phase,points]);
    if(phaseCache.has(key)){
      const result=phaseCache.get(key);if(result===null)return null;
      for(const id of result)blockers.add(id);continue;
    }
    const blocked=new Set();
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],distance=Math.hypot(b[0]-a[0],b[1]-a[1]);if(distance<.0001)continue;
      const heading=Math.atan2(b[1]-a[1],b[0]-a[0])+(phase==='pushback'?Math.PI:0),c=Math.cos(heading),s=Math.sin(heading),steps=Math.ceil(distance/.15);
      // This is an exact broad-phase exclusion: a polygon outside the complete
      // segment's radius envelope cannot overlap a hull sampled on that segment.
      const sweep={minX:Math.min(a[0],b[0])-radius,maxX:Math.max(a[0],b[0])+radius,minY:Math.min(a[1],b[1])-radius,maxY:Math.max(a[1],b[1])+radius};
      const fixedCandidates=fixed.filter(o=>overlaps(sweep,o.bounds)),parkedCandidates=parked.filter(o=>!blocked.has(o.plotId)&&overlaps(sweep,o.bounds));
      const transform=p=>[(p[0]*c-p[1]*s)*unit,(p[0]*s+p[1]*c)*unit];
      const contacts=shape.contactGroups.map(g=>({centre:transform(g.centre),radius:g.radius*unit,points:g.points.map(transform)})),hull=shape.hull.map(transform);
      for(let j=0;j<=steps;j++){
        const x=a[0]+(b[0]-a[0])*j/steps,y=a[1]+(b[1]-a[1])*j/steps;
        const wheelClear=contacts.every(g=>on.disc([x+g.centre[0],y+g.centre[1]],g.radius)||g.points.every(p=>on([x+p[0],y+p[1]])));
        if(!wheelClear){phaseCache.set(key,null);return null;}
        const envelope={minX:x-radius,maxX:x+radius,minY:y-radius,maxY:y+radius};
        const nearbyFixed=fixedCandidates.filter(o=>overlaps(envelope,o.bounds));
        const nearbyParked=parkedCandidates.filter(o=>!blocked.has(o.plotId)&&overlaps(envelope,o.bounds));
        if(nearbyFixed.length||nearbyParked.length){
          const poly=hull.map(p=>[x+p[0],y+p[1]]);
          if(nearbyFixed.some(o=>bnePolygonsOverlap(poly,o.polygon))){phaseCache.set(key,null);return null;}
          for(const o of nearbyParked)if(bnePolygonsOverlap(poly,o.polygon))blocked.add(o.plotId);
        }
      }
    }
    const result=[...blocked].sort();phaseCache.set(key,result);for(const id of result)blockers.add(id);
  }
  return [...blockers].sort();
}
