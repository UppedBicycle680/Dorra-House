import {HAMILTON_GA_DATA,HAMILTON_GA_ROADS} from './hamilton-ga-data.mjs';
import {hamiltonGeoPoint} from './hamilton-neighbourhood.mjs';
import {hamiltonRect,HAMILTON_SCALE as S} from './hamilton-reference.mjs';

export const HAMILTON_GA_BUILDINGS=HAMILTON_GA_DATA.map(f=>{
  const polygon=f.geo.map(hamiltonGeoPoint);
  return {...f,polygon,rect:hamiltonRect(polygon)};
});
export const HAMILTON_GA_ACCESS=HAMILTON_GA_ROADS.map(r=>({id:r.id,points:r.geo.map(hamiltonGeoPoint),width:r.widthM*S}));
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);

export function drawHamiltonGA(layout,{poly,line,defer,scale}){
  for(const f of layout.gaBuildings){
    const p=f.polygon.slice(0,-1),r=f.rect,z=f.heightM*S;
    defer(r.x+r.w/2,r.y+r.h/2,()=>{
      const edges=p.map((a,i)=>[a,p[(i+1)%p.length]]).sort(([a,b],[c,d])=>a[0]+a[1]+b[0]+b[1]-c[0]-c[1]-d[0]-d[1]);
      for(const [a,b] of edges){
        poly([[...a,0],[...b,0],[...b,z],[...a,z]],f.kind==='hangar'?'#7e8878':'#c5ccba');
        if(scale>5){const d=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let u=.4;u<d;u+=.35){const q=mix(a,b,u/d);line([[...q,.1],[...q,z-.1]],'#82917b55',.35)}}
      }
      if(f.kind==='hangar'){
        // Three shallow barrel roofs and broad apron-facing doors, visible in
        // the original Hamilton Island Air aerial. Elevations are estimates.
        const point=(u,v,h)=>[...mix(mix(p[0],p[1],u),mix(p[3],p[2],u),v),h];
        for(let bay=0;bay<3;bay++){
          const u0=bay/3,u1=(bay+1)/3,curve=t=>z+2.7*S*Math.sin(Math.PI*t);
          for(let k=0;k<12;k++){
            const a=k/12,b=(k+1)/12,ua=u0+(u1-u0)*a,ub=u0+(u1-u0)*b;
            poly([point(ua,0,curve(a)),point(ub,0,curve(b)),point(ub,1,curve(b)),point(ua,1,curve(a))],k<6?'#a3a18b':'#8c947f');
            if(scale>5)line([point(ua,0,curve(a)+.015),point(ua,1,curve(a)+.015)],'#b8ba9e55',.35);
            for(const v of [.3,.74])poly([point(ua,v,curve(a)+.02),point(ub,v,curve(b)+.02),point(ub,v+.045,curve(b)+.02),point(ua,v+.045,curve(a)+.02)],'#d9dcc6');
          }
          const arch=Array.from({length:13},(_,k)=>point(u0+(u1-u0)*k/12,1,curve(k/12)));
          poly([point(u0,1,0),...arch,point(u1,1,0)],'#748273');
          const left=u0+.026,right=u1-.026;
          poly([point(left,1,.06),point(right,1,.06),point(right,1,z-.18),point(left,1,z-.18)],'#2f4943');
          // Recess, door track and a folded sliding panel at the bay edge.
          poly([point(left,1,.06),point(right,1,.06),point(right,.94,.06),point(left,.94,.06)],'#aeb7a0');
          poly([point(right-.032,1,.08),point(right,1,.08),point(right,1,z-.2),point(right-.032,1,z-.2)],'#acb3a0');
          line([point(left,1,z-.12),point(right,1,z-.12)],'#d8ddc8',.7);
          line(arch,'#c0c7ab',.6);
        }
      }else{
        // Split a pitched roof at its ridge while preserving each mapped notch.
        const a=p[0],b=p[1],d=Math.hypot(b[0]-a[0],b[1]-a[1]),normal=[-(b[1]-a[1])/d,(b[0]-a[0])/d];
        const v=q=>(q[0]-a[0])*normal[0]+(q[1]-a[1])*normal[1],values=p.map(v),lo=Math.min(...values),hi=Math.max(...values),mid=(lo+hi)/2;
        const height=q=>z+1.25*S*(1-Math.abs(v(q)-mid)/((hi-lo)/2));
        const cut=sign=>{const out=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],va=(v(a)-mid)*sign,vb=(v(b)-mid)*sign;if(va>=0)out.push(a);if((va>=0)!==(vb>=0))out.push(mix(a,b,va/(va-vb)))}return out};
        for(const side of [-1,1]){const q=cut(side);poly(q.map(q=>[...q,height(q)]),side===1?'#9ea798':'#c9cebb');const ridge=q.filter(q=>Math.abs(v(q)-mid)<.001);if(ridge.length>1)line(ridge.map(q=>[...q,height(q)+.02]),'#e0e1cf',.6)}
        // Small service entrances, not invented public aircraft-storage bays.
        const [frontA,frontB]=edges.at(-1),at=(t,h)=>[...mix(frontA,frontB,t),h];
        poly([at(.13,.05),at(.31,.05),at(.31,z*.76),at(.13,z*.76)],'#56716a');
        poly([at(.53,z*.35),at(.85,z*.35),at(.85,z*.7),at(.53,z*.7)],'#7e9b8d');
      }
    });
  }
}
