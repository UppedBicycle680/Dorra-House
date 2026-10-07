import {YBSU_CHART_GEOMETRY} from './ybsu-chart-geometry.mjs';
import {ybsuApronPoint} from './ybsu-reference.mjs';

const EPS=1e-7;
const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function clip(points,plane,sign=1){
  const out=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],fa=plane(a)*sign,fb=plane(b)*sign;
    if(fa>=0)out.push(a);
    if((fa>=0)!==(fb>=0))out.push(mix(a,b,fa/(fa-fb)));
  }
  return out.length>=3?out:[];
}

// Subtract the terminal's opaque shadow volumes along the actual orthographic
// camera ray. This is geometric visibility, not a screen-space roof stencil:
// an awning in front of a wall remains visible, while a rear post is hidden.
export function createYbsuTerminalVisibility(t,height,project){
  const origin=project(0,0,0),basis=[[1,0,0],[0,1,0],[0,0,1]].map(p=>project(...p));
  const rowX=basis.map(p=>p.x-origin.x),rowY=basis.map(p=>p.y-origin.y);
  let view=cross(rowX,rowY);if(view[2]<0)view=view.map(v=>-v);
  const faces=[...YBSU_CHART_GEOMETRY.terminal.triangles.map(ps=>ps.map(p=>[...ybsuApronPoint(p),height])),
    ...t.polygon.map((p,i)=>{const q=t.polygon[(i+1)%t.polygon.length];return [[...p,0],[...q,0],[...q,height],[...p,height]]})];
  const occluders=faces.flatMap(ps=>{
    const n=cross(sub(ps[1],ps[0]),sub(ps[2],ps[0])),length=Math.hypot(...n),toward=dot(n,view);
    if(length<EPS||Math.abs(toward)<EPS)return [];
    const normal=n.map(v=>v/length*Math.sign(toward)),distance=dot(normal,ps[0]),screen=ps.map(p=>project(...p));
    const area=screen.reduce((a,p,i)=>{const q=screen[(i+1)%screen.length];return a+p.x*q.y-q.x*p.y},0);
    const planes=[p=>distance-dot(normal,p)-EPS];
    for(let i=0;i<screen.length;i++){
      const a=screen[i],b=screen[(i+1)%screen.length],dx=b.x-a.x,dy=b.y-a.y;
      planes.push(p=>{const q=project(...p);return Math.sign(area)*(dx*(q.y-a.y)-dy*(q.x-a.x))});
    }
    return [{planes,bounds:[Math.min(...screen.map(p=>p.x)),Math.min(...screen.map(p=>p.y)),Math.max(...screen.map(p=>p.x)),Math.max(...screen.map(p=>p.y))]}];
  });
  function candidates(ps){
    const screen=ps.map(p=>project(...p)),bounds=[Math.min(...screen.map(p=>p.x)),Math.min(...screen.map(p=>p.y)),Math.max(...screen.map(p=>p.x)),Math.max(...screen.map(p=>p.y))];
    return occluders.filter(o=>bounds[0]<=o.bounds[2]&&bounds[2]>=o.bounds[0]&&bounds[1]<=o.bounds[3]&&bounds[3]>=o.bounds[1]&&ps.some(p=>o.planes[0](p)>0));
  }
  function polygons(ps){
    let fragments=[ps];
    for(const {planes} of candidates(ps)){
      fragments=fragments.flatMap(fragment=>{
        if(planes.some(f=>fragment.every(p=>f(p)<=0)))return [fragment];
        const visible=[];let remainder=fragment;
        for(const plane of planes){
          const outside=clip(remainder,plane,-1);if(outside.length)visible.push(outside);
          remainder=clip(remainder,plane);if(!remainder.length)break;
        }
        return visible;
      });
      if(!fragments.length)break;
    }
    return fragments.filter(ps=>{
      const s=ps.map(p=>project(...p)),a=s[0];
      const area=s.reduce((sum,p,i)=>{const q=s[(i+1)%s.length];return sum+(p.x-a.x)*(q.y-a.y)-(q.x-a.x)*(p.y-a.y)},0);
      return Math.abs(area)>Math.max(dot(rowX,rowX),dot(rowY,rowY))*1e-10;
    });
  }
  function lines(ps){
    const visible=[];
    for(let i=1;i<ps.length;i++){
      let segments=[[ps[i-1],ps[i]]];
      for(const {planes} of candidates(segments[0])){
        segments=segments.flatMap(([a,b])=>{
          let start=0,end=1;
          for(const f of planes){
            const fa=f(a),fb=f(b);if(fa<=0&&fb<=0)return [[a,b]];
            if((fa>0)!==(fb>0)){const at=fa/(fa-fb);if(fa<=0)start=Math.max(start,at);else end=Math.min(end,at);}
          }
          if(start>=end)return [[a,b]];
          return [...(start>EPS?[[a,mix(a,b,start)]]:[]),...(end<1-EPS?[[mix(a,b,end),b]]:[])];
        });
        if(!segments.length)break;
      }
      visible.push(...segments);
    }
    return visible;
  }
  return {polygons,lines,depth:p=>dot(view,p)};
}
