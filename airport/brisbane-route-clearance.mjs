import {AIRCRAFT_GROUND_SHAPES} from './aircraft-ground-geometry.mjs';
const bounds=p=>({minX:Math.min(...p.map(q=>q[0])),minY:Math.min(...p.map(q=>q[1])),maxX:Math.max(...p.map(q=>q[0])),maxY:Math.max(...p.map(q=>q[1]))});
const intersectBounds=(a,b)=>a.minX<b.maxX&&a.maxX>b.minX&&a.minY<b.maxY&&a.maxY>b.minY;
function inside(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export function bnePolygonsOverlap(a,b){
  if(!intersectBounds(bounds(a),bounds(b)))return false;
  if(a.some(p=>inside(p,b))||b.some(p=>inside(p,a)))return true;
  for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){const p=a[i],q=a[(i+1)%a.length],r=b[j],s=b[(j+1)%b.length];if(cross(p,q,r)*cross(p,q,s)<0&&cross(r,s,p)*cross(r,s,q)<0)return true;}return false;
}
const buildings=new WeakMap();
const floors=new WeakMap(),wheelChecks=new WeakMap();
// Index polygon edges by horizontal band. The exact crossing test is retained,
// but long chart outlines no longer scan hundreds of irrelevant edges per tyre.
function indexedInside(poly){
  const extent=bounds(poly);
  const bands=new Map();
  for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];if(a[1]===b[1])continue;
    for(let y=Math.floor(Math.min(a[1],b[1]));y<=Math.floor(Math.max(a[1],b[1]));y++){if(!bands.has(y))bands.set(y,[]);bands.get(y).push([a,b]);}}
  const contains=p=>{if(p[0]<extent.minX||p[0]>extent.maxX||p[1]<extent.minY||p[1]>extent.maxY)return false;let yes=false;for(const [a,b] of bands.get(Math.floor(p[1]))||[])if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;return yes;};
  // Horizontal edges are irrelevant to ray casting, but required for discs.
  const edgeBands=new Map();for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];for(let y=Math.floor(Math.min(a[1],b[1]));y<=Math.floor(Math.max(a[1],b[1]));y++){if(!edgeBands.has(y))edgeBands.set(y,[]);edgeBands.get(y).push([a,b]);}}
  contains.clearEdge=(p,r)=>{if(p[0]+r<extent.minX||p[0]-r>extent.maxX||p[1]+r<extent.minY||p[1]-r>extent.maxY)return true;for(let y=Math.floor(p[1]-r);y<=Math.floor(p[1]+r);y++)for(const [a,b] of edgeBands.get(y)||[]){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));if(Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)<=r)return false;}return true;};
  return contains;
}
export function floorFor(layout,roundedPath){
  if(floors.has(layout))return floors.get(layout);
  const regions=layout.aprons.map(a=>({polygon:a.polygon,holes:a.holes||[]}));
  for(const t of layout.taxiways){
    const points=t.cornerRadius===0?t.points:roundedPath(t.points,t.cornerRadius??3),w=Math.min(7,t.width)/2;
    for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.01)continue;const x=-(b[1]-a[1])/length*w,y=(b[0]-a[0])/length*w;regions.push({polygon:[[a[0]+x,a[1]+y],[b[0]+x,b[1]+y],[b[0]-x,b[1]-y],[a[0]-x,a[1]-y]],holes:[]});}
    for(const p of points)regions.push({polygon:Array.from({length:20},(_,i)=>[p[0]+Math.cos(i/20*Math.PI*2)*w,p[1]+Math.sin(i/20*Math.PI*2)*w]),holes:[]});
  }
  const buckets=new Map();for(const r of regions){r.bounds=bounds(r.polygon);r.contains=indexedInside(r.polygon);r.holeTests=r.holes.map(indexedInside);for(let x=Math.floor(r.bounds.minX/10);x<=Math.floor(r.bounds.maxX/10);x++)for(let y=Math.floor(r.bounds.minY/10);y<=Math.floor(r.bounds.maxY/10);y++){const k=x+':'+y;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(r);}}
  const on=p=>(buckets.get(Math.floor(p[0]/10)+':'+Math.floor(p[1]/10))||[]).some(r=>p[0]>=r.bounds.minX&&p[0]<=r.bounds.maxX&&p[1]>=r.bounds.minY&&p[1]<=r.bounds.maxY&&r.contains(p)&&!r.holeTests.some(test=>test(p)));
  on.disc=(p,radius)=>(buckets.get(Math.floor(p[0]/10)+':'+Math.floor(p[1]/10))||[]).some(r=>p[0]-radius>=r.bounds.minX&&p[0]+radius<=r.bounds.maxX&&p[1]-radius>=r.bounds.minY&&p[1]+radius<=r.bounds.maxY&&r.contains(p)&&r.contains.clearEdge(p,radius)&&r.holeTests.every(test=>!test(p)&&test.clearEdge(p,radius)));
  floors.set(layout,on);return on;
}
export function clearBrisbaneRoute(layout,airport,stand,model,plan,roundedPath){
  const shape=AIRCRAFT_GROUND_SHAPES[model.id];if(!shape)return true; // Offline route compilation uses the design envelope.
  let fixed=buildings.get(layout);if(!fixed){fixed=layout.terminals.map(t=>({id:t.id,kind:'building',polygon:t.polygon,bounds:bounds(t.polygon)}));buildings.set(layout,fixed);}
  const parked=(airport.gates||[]).filter(g=>g.plotId!==stand.plotId&&g.active!==false&&g.status!=='waiting').map(g=>layout.stands.find(s=>s.plotId===g.plotId)).filter(Boolean).map(s=>({id:s.bay,kind:'occupied-bay',polygon:s.envelope,bounds:bounds(s.envelope)}));
  const obstacles=[...fixed,...parked],unit=layout.metresToWorld;
  const radius=Math.max(...shape.hull.map(p=>Math.hypot(...p)))*unit;
  let checks=wheelChecks.get(layout);if(!checks){checks=new Map();wheelChecks.set(layout,checks);}
  const checkKey=stand.plotId+':'+model.id+':'+plan.routeGeometryKey,result=checks.get(checkKey),cached=result?.passed??result,on=floorFor(layout,roundedPath);
  if(cached===false){plan.clearanceFinding=result.finding;return false;}
  for(const phase of ['inbound','pushback','outbound']){
    const points=plan[phase];
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],distance=Math.hypot(b[0]-a[0],b[1]-a[1]);if(distance<.0001)continue;
      const heading=Math.atan2(b[1]-a[1],b[0]-a[0])+(phase==='pushback'?Math.PI:0),c=Math.cos(heading),s=Math.sin(heading),steps=Math.ceil(distance/(cached?.45:.15));
      for(let j=0;j<=steps;j++){
        const x=a[0]+(b[0]-a[0])*j/steps,y=a[1]+(b[1]-a[1])*j/steps;
        const wheelClear=cached===true||shape.contactGroups.every(g=>on.disc([x+(g.centre[0]*c-g.centre[1]*s)*unit,y+(g.centre[0]*s+g.centre[1]*c)*unit],g.radius*unit)||g.points.every(p=>on([x+(p[0]*c-p[1]*s)*unit,y+(p[0]*s+p[1]*c)*unit])));
        if(!wheelClear){plan.clearanceFinding={kind:'pavement',phase,position:[x,y]};checks.set(checkKey,{passed:false,finding:plan.clearanceFinding});return false;}
        const nearby=obstacles.filter(o=>intersectBounds({minX:x-radius,maxX:x+radius,minY:y-radius,maxY:y+radius},o.bounds));
        if(nearby.length){const poly=shape.hull.map(p=>[x+(p[0]*c-p[1]*s)*unit,y+(p[0]*s+p[1]*c)*unit]);
          const obstacle=nearby.find(o=>bnePolygonsOverlap(poly,o.polygon));if(obstacle){plan.clearanceFinding={kind:obstacle.kind,obstacle:obstacle.id,phase,position:[x,y]};return false;}}
      }
    }
  }checks.set(checkKey,true);return true;
}
