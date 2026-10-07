import {DOMESTIC_MATERIALS as m,DOMESTIC_DETAIL as detail} from './brisbane-domestic-details.mjs';
const mix=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);
const rectangle=(a,b,w)=>{const dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy)||1,n=[-dy/d*w/2,dx/d*w/2];return [[a[0]+n[0],a[1]+n[1]],[b[0]+n[0],b[1]+n[1]],[b[0]-n[0],b[1]-n[1]],[a[0]-n[0],a[1]-n[1]]];};
function arrow(a,b,kind,{line,scale}){
  const d=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/d,(b[1]-a[1])/d],n=[-u[1],u[0]],c=mix(a,b,.5),size=.36;
  const local=(x,y)=>[c[0]+u[0]*x+n[0]*y,c[1]+u[1]*x+n[1]*y];
  const w=Math.max(.4,scale*.028);
  if(kind==='right'||kind==='left'){
    const s=kind==='right'?1:-1;line([local(-size,0),local(0,0),local(.07,size*s)],m.white,w);
    line([local(-.08,(size-.13)*s),local(.07,size*s),local(.16,(size-.13)*s)],m.white,w);
  }else{line([local(-size,0),local(size,0)],m.white,w);line([local(size-.17,-.12),local(size,0),local(size-.17,.12)],m.white,w)}
}
export function drawDomesticLanes(model,api){
  const {poly,line,road,scale,ctx,project}=api;
  const clipTo=(polygons,draw)=>{
    ctx.save();ctx.beginPath();
    for(let p of polygons){
      const signed=p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0]},0);
      if(signed<0)p=p.toReversed();
      p.forEach((a,i)=>{const q=project(...a);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.closePath();
    }
    ctx.clip();draw();ctx.restore();
  };
  clipTo(detail.parkingAreas.map(p=>p.polygon),()=>{for(const a of model.unmarkedAisles)road(a.points,a.width,m.parking)});
  for(const c of model.continuations)road(c.points,c.width,m.asphalt);
  // Paint the union before edges/markings, so adjoining pieces don't erase
  // each other's lane dividers. Curbs are authored independently of lane count.
  for(const s of model.sections)poly(s.polygon,m.asphalt);
  for(const s of model.junctions)poly(s.polygon,m.asphalt);
  for(const r of model.ramps)road(r.points,r.width,m.asphalt);
  for(const r of model.roundabouts){poly(r.outer,m.asphalt);poly(r.inner,'#9da67b',m.concrete,Math.max(.4,scale*.04))}
  for(const s of model.stoppingAreas){
    const p=rectangle(s.a,s.b,s.width);poly(p,'#737a7b');
    const length=Math.hypot(s.b[0]-s.a[0],s.b[1]-s.a[1]);
    for(let t=0;t<length;t+=s.spacing){const f=t/length,g=Math.min(1,(t+s.spacing*.45)/length);line([mix(p[0],p[1],f),mix(p[3],p[2],g)],m.white,Math.max(.3,scale*.018))}
    line([p[0],p[1]],'#dac985',Math.max(.35,scale*.022));
  }
  for(const s of model.sections){
    for(const edge of [s.left,s.right])line(edge,m.concrete,Math.max(.35,scale*.028));
    for(const d of s.dividers){
      if(d.kind==='dash')line(d.points,m.white,Math.max(.35,scale*.022),[scale*.28,scale*.5]);
      else{
        line(d.points,m.white,Math.max(.75,scale*.065));
        line(d.points,m.asphalt,Math.max(.25,scale*.025));
      }
    }
    for(const a of s.arrows)arrow(a.a,a.b,a.kind,api);
  }
  for(const island of model.islands){
    poly(island.polygon,m.asphalt,m.white,Math.max(.4,scale*.025));
    ctx.save();ctx.beginPath();island.polygon.forEach((p,i)=>{const q=project(...p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.closePath();ctx.clip();
    const xs=island.polygon.map(p=>p[0]),ys=island.polygon.map(p=>p[1]),lo=Math.min(...ys),hi=Math.max(...ys);
    for(let x=Math.min(...xs)-(hi-lo)*1.8;x<Math.max(...xs);x+=.35)line([[x,lo],[x+(hi-lo)*1.8,hi]],m.white,Math.max(.4,scale*.028));
    ctx.restore();
  }
  for(const c of model.controls)line(c.points,m.white,Math.max(.55,scale*.07),c.kind==='give-way'?[scale*.12,scale*.12]:[]);
  clipTo(model.sections.map(s=>s.polygon),()=>{for(const c of model.crossings){
    const d=Math.hypot(c.b[0]-c.a[0],c.b[1]-c.a[1]);
    for(let t=0;t<d;t+=.15){const a=mix(c.a,c.b,t/d),b=mix(c.a,c.b,Math.min(1,(t+.075)/d));poly(rectangle(a,b,c.width),m.white)}
  }});
}

export function drawDomesticRamps(model,{poly,line,scale,defer}){
  for(const r of model.ramps){
    if(!r.height)continue;
    for(let i=1;i<r.points.length;i++){
      const a=r.points[i-1],b=r.points[i],za=(i-1)/(r.points.length-1)*r.height,zb=i/(r.points.length-1)*r.height,q=rectangle(a,b,r.width);
      defer(...mix(a,b,.5),()=>{
        poly([[...q[0],za],[...q[1],zb],[...q[2],zb],[...q[3],za]],'#70797c');
        for(const [u,v] of [[0,1],[3,2]])line([[...q[u],za+.09],[...q[v],zb+.09]],'#d0d2ce',Math.max(.45,scale*.045));
      });
    }
  }
}
