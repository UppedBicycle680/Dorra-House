import {HAMILTON_ISLAND_TERRAIN as terrain} from './hamilton-island-data.mjs';
import {HAMILTON_TOWER_CENTRE,HAMILTON_TOWER_FLOOR} from './hamilton-tower.mjs';

const inside=(x,y,p)=>{let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes}return yes};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const elevationCache=new Map();
const shallowContours=terrain.shallows.map(points=>{
  let p=points.slice(0,-1);
  // Round the classification grid's stair-step boundary at its sample scale.
  for(let n=0;n<2;n++)p=p.flatMap((a,i)=>{const b=p[(i+1)%p.length];return [[a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75]]});
  return p;
});
export function drawHamiltonShallows({poly}){
  for(const p of shallowContours)poly(p,'#b4d7c5');
}
export function hamiltonIslandElevation(x,y){
  const key=`${x},${y}`;if(elevationCache.has(key))return elevationCache.get(key);
  const g=terrain.grid,u=clamp((x-g.x)/g.step,0,g.cols-1.001),v=clamp((y-g.y)/g.step,0,g.rows-1.001),i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j;
  const at=(i,j)=>g.heights[j*g.cols+i];
  let z=(at(i,j)*(1-a)+at(i+1,j)*a)*(1-b)+(at(i,j+1)*(1-a)+at(i+1,j+1)*a)*b;
  if(terrain.graded.some(p=>inside(x,y,p)))z=0;
  // The 30 m-class DEM cannot resolve the surveyed tower's small platform.
  const [cx,cy]=HAMILTON_TOWER_CENTRE,r=Math.hypot((x-cx)/7,(y-cy)/7);
  if(r<1){const w=clamp((r-.4)/.6,0,1);z=HAMILTON_TOWER_FLOOR*(1-w)+z*w}
  elevationCache.set(key,z);return z;
}

export function drawHamiltonIsland(layout,{poly,line,defer,hash,landContains}){
  const woods=terrain.natural.filter(f=>['wood','scrub'].includes(f.kind));
  const surfaces=terrain.natural.filter(f=>['water','beach','sand'].includes(f.kind));
  const [tx,ty]=HAMILTON_TOWER_CENTRE;
  const drawFace=(p,cover=0)=>{
    const x=p.reduce((n,v)=>n+v[0],0)/p.length,y=p.reduce((n,v)=>n+v[1],0)/p.length;
    const q=p.map(v=>[...v,hamiltonIslandElevation(...v)]),zs=q.map(v=>v[2]);
    if(Math.max(...zs)<.04)return;
    const wooded=cover||woods.some(f=>inside(x,y,f.points));
    const slope=(Math.max(...zs)-Math.min(...zs))/(Math.max(...p.slice(1).map(v=>Math.hypot(v[0]-p[0][0],v[1]-p[0][1])))||1);
    const a=q[0],b=q[1],c=q[2],ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;if(nz<0){nx=-nx;ny=-ny;nz=-nz}
    const light=clamp(.82+(-nx*.3-ny*.35+nz*.28)/(Math.hypot(nx,ny,nz)||1),.6,1.12),base=slope>.85?[157,148,120]:wooded?[95,127,78]:[116,146,91];
    poly(q,`rgb(${base.map(n=>Math.round(n*light)).join(',')})`);
  };
  const sorted=terrain.triangles.map((p,index)=>({p,index,depth:p.reduce((n,v)=>n+v[0]+v[1],0)/3})).sort((a,b)=>a.depth-b.depth);
  for(const {index,p} of sorted){
    if(p.some(v=>Math.abs(v[0]-tx)<9&&Math.abs(v[1]-ty)<9))continue;
    drawFace(p,terrain.cover[index]);
  }
  // A fine local mesh keeps the small control-tower pad level and visible.
  const g=terrain.grid,x0=g.x+Math.floor((tx-9-g.x)/g.step)*g.step,y0=g.y+Math.floor((ty-9-g.y)/g.step)*g.step;
  const x1=g.x+Math.ceil((tx+9-g.x)/g.step)*g.step,y1=g.y+Math.ceil((ty+9-g.y)/g.step)*g.step;
  for(let x=x0;x<x1;x++)for(let y=y0;y<y1;y++){drawFace([[x,y],[x+1,y],[x+1,y+1]]);drawFace([[x,y],[x+1,y+1],[x,y+1]])}
  for(const f of surfaces){const p=f.points,x=p.reduce((n,v)=>n+v[0],0)/p.length,y=p.reduce((n,v)=>n+v[1],0)/p.length;
    const colour=f.kind==='water'?'#487d73':'#e4d6ab';
    poly(p.map(v=>[...v,hamiltonIslandElevation(...v)+.08]),colour);
  }
  const obstacles=[...layout.neighbourhood.filter(f=>['building','pool','pitch'].includes(f.kind)),...layout.gaBuildings,...layout.terminals];
  const roads=layout.neighbourhood.filter(f=>f.kind==='road').flatMap(f=>f.points.slice(1).map((b,i)=>[f.points[i],b]));
  const [minX,minY,maxX,maxY]=terrain.bounds;
  for(let i=0;i<6500;i++){
    const x=minX+hash(i+21817)*(maxX-minX),y=minY+hash(i+5249)*(maxY-minY);
    if(!landContains(x,y)||(!woods.some(f=>inside(x,y,f.points))&&hamiltonIslandElevation(x,y)<8)||surfaces.some(f=>inside(x,y,f.points)))continue;
    if(layout.runways.some(r=>inside(x,y,r.protectedPolygon)))continue;
    if(Math.hypot(x-tx,y-ty)<9||obstacles.some(f=>{const r=f.rect;return x>r.x-1.5&&x<r.x+r.w+1.5&&y>r.y-1.5&&y<r.y+r.h+1.5}))continue;
    if(roads.some(([a,b])=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)<1.5}))continue;
    const z=hamiltonIslandElevation(x,y),r=.8+hash(i+990)*.65;
    defer(x,y,()=>{line([[x,y,z],[x,y,z+2]],'#6d7654',.4);for(let j=0;j<2;j++)poly(Array.from({length:8},(_,k)=>[x+Math.cos(k*Math.PI/4)*r,y,z+1.8+j*.8+Math.sin(k*Math.PI/4)*r]),j?'#6c925a':'#49744d')});
  }
}
