import {BNE_SCALE as S} from './brisbane-bays.mjs';

const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const clip=(p,axis,limit,greater)=>{
 const out=[];
 for(let i=0;i<p.length;i++){
  const a=p[i],b=p[(i+1)%p.length],aa=greater?a[axis]>=limit:a[axis]<=limit,bb=greater?b[axis]>=limit:b[axis]<=limit;
  if(aa)out.push(a);if(aa!==bb)out.push(mix(a,b,(limit-a[axis])/(b[axis]-a[axis])));
 }
 return out;
};
export function drawBrisbaneHangar(b,{poly,line,ctx,project}){
 const angle=19.5*Math.PI/180;
 const u=b.front==='+x'?[0,1]:b.front==='south-apron'?[Math.cos(angle),Math.sin(angle)]:[1,0];
 const v=b.front==='+x'?[-1,0]:b.front==='south-apron'?[-Math.sin(angle),Math.cos(angle)]:[0,1];
 const dot=(p,a)=>p[0]*a[0]+p[1]*a[1],us=b.polygon.map(p=>dot(p,u)),vs=b.polygon.map(p=>dot(p,v));
 const u0=Math.min(...us),v0=Math.min(...vs),w=Math.max(...us)-u0,d=Math.max(...vs)-v0;
 const local=b.polygon.map(p=>[(dot(p,u)-u0)/w,(dot(p,v)-v0)/d]);
 const world=(q,z=0)=>[u[0]*(u0+q[0]*w)+v[0]*(v0+q[1]*d),u[1]*(u0+q[0]*w)+v[1]*(v0+q[1]*d),z];
 const parts=b.parts.map(part=>{
  let p=local;
  for(const [axis,value,greater] of [[0,part.u,true],[0,part.u+part.w,false],[1,part.v,true],[1,part.v+part.d,false]])p=clip(p,axis,value,greater);
  return {...part,p};
 }).filter(p=>p.p.length>=3).sort((a,b)=>{
  const depth=p=>p.p.reduce((sum,q)=>{const [x,y]=world(q);return sum+(x+y)/p.p.length},0);
  return depth(a)-depth(b);
 });
 poly(b.polygon.map(([x,y])=>[x+.18,y+.24]),'#334b4420');
 for(const part of parts){
  const z=part.eave*S,rise=part.rise*S,axis=part.ridgeAxis==='u'?1:0,start=axis?part.v:part.u,span=axis?part.d:part.w;
  const height=q=>z+rise*(1-Math.abs((q[axis]-start)/span-.5)*2);
  const top=q=>world(q,height(q));
  const edges=part.p.map((a,i)=>[a,part.p[(i+1)%part.p.length]]).sort(([a,b],[c,d])=>{
   const depth=q=>{const p=world(q);return p[0]+p[1]};return depth(a)+depth(b)-depth(c)-depth(d);
  });
  // Office pods can project ahead of the hall. Its actual apron elevation is
  // then set back from the compound's minimum v; use the real boundary edge.
  const doorEdge=part.doors&&edges.filter(([a,c])=>Math.abs(a[0]-c[0])>part.w*.35&&Math.abs(a[1]-c[1])<Math.abs(a[0]-c[0])*.15&&Math.min(a[1],c[1])<part.v+part.d*.4).sort(([a,c],[p,q])=>a[1]+c[1]-p[1]-q[1])[0];
  for(const [a,c] of edges){
   const at=(t,h)=>world(mix(a,c,t),h),length=Math.hypot(...world(c).slice(0,2).map((n,i)=>n-world(a)[i]));
   const middle=start+span*.5,roof=[top(c)];
   if((a[axis]-middle)*(c[axis]-middle)<0)roof.push(top(mix(a,c,(middle-a[axis])/(c[axis]-a[axis]))));
   roof.push(top(a));
   const hasDoor=doorEdge&&a===doorEdge[0]&&c===doorEdge[1];
   const front=hasDoor||Math.abs(a[1]-part.v)<.04&&Math.abs(c[1]-part.v)<.04;
   poly([at(0,0),at(1,0),...roof],front?'#dce0d2':'#aebeb1','#9cafa2',.35);
   const projectedLength=Math.hypot(project(...at(1,0)).x-project(...at(0,0)).x,project(...at(1,0)).y-project(...at(0,0)).y);
   if(projectedLength>24)for(let s=.3;s<length;s+=.38)line([at(s/length,.04),at(s/length,z-.04)],'#718d7c35',.4);
   if(hasDoor){
    const doorZ=part.doorHeight?part.doorHeight*S:z*.87;
    for(let j=0;j<part.doors;j++){
     const span=part.doorWidth?Math.min(.995,part.doorWidth*S/length):.95,margin=(1-span)/2;
     const lo=margin+span*j/part.doors,hi=margin+span*(j+1)/part.doors-(part.doorWidth?0:.009);
     poly([at(lo,.03),at(hi,.03),at(hi,doorZ),at(lo,doorZ)],part.panels===1?'#bac4bd':'#718c87','#e8e9db',.65);
     for(let k=1;k<(part.panels||4);k++){const t=lo+(hi-lo)*k/(part.panels||4);line([at(t,.03),at(t,doorZ)],'#cbd4c7',.6);}
     for(let h=.18;h<doorZ;h+=.22)line([at(lo,h),at(hi,h)],'#78918835',.35);
    }
    line([at(.015,doorZ+.05),at(.985,doorZ+.05)],'#f0eedc',1);
    if(part.sign&&projectedLength>75){
     const left=at(.045,z*.91),right=at(.955,z*.91),a2=project(...left),b2=project(...right),len=Math.hypot(b2.x-a2.x,b2.y-a2.y);
     ctx.save();ctx.beginPath();[at(.015,doorZ+.03),at(.985,doorZ+.03),at(.985,z-.015),at(.015,z-.015)].forEach((p,i)=>{const s=project(...p);i?ctx.lineTo(s.x,s.y):ctx.moveTo(s.x,s.y)});ctx.closePath();ctx.clip();
     ctx.translate(a2.x,a2.y);ctx.rotate(Math.atan2(b2.y-a2.y,b2.x-a2.x));
     // Keep facade lettering upright when the outline is wound the other way.
     if(b2.x<a2.x){ctx.translate(len,0);ctx.rotate(Math.PI);}
     const fasciaPixels=Math.abs(project(...at(.5,z)).y-project(...at(.5,doorZ)).y);
     ctx.font=`600 ${Math.max(1,Math.min(14,fasciaPixels*.8))}px system-ui`;ctx.fillStyle='#476764';ctx.textBaseline='bottom';ctx.fillText(part.sign,0,0,len);ctx.restore();
    }
   }else if(part.office&&projectedLength>18){
    for(let t=.10;t<.88;t+=.18)poly([at(t,z*.35),at(t+.12,z*.35),at(t+.12,z*.68),at(t,z*.68)],'#73979a');
   }
  }
  // Roof planes follow each footprint's notches instead of bridging them.
  for(const [side,color] of [[false,part.roof||'#e9eadc'],[true,'#d0d9cd']]){
   const p=clip(part.p,axis,start+span*.5,side);
   if(p.length>=3)poly(p.map(top),color,'#f2f0df',.65);
  }
  const roofLine=(a,c,color,width)=>{
   let segment=[a,c];
   // Convex clipping is not valid for the notched building outlines. Split at
   // every boundary intersection, then keep only interior pieces.
   const cuts=[0,1],delta=[c[0]-a[0],c[1]-a[1]],cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
   for(let i=0;i<part.p.length;i++){
    const q=part.p[i],r=part.p[(i+1)%part.p.length],e=[r[0]-q[0],r[1]-q[1]],qa=[q[0]-a[0],q[1]-a[1]],det=cross(delta,e);
    if(Math.abs(det)<1e-10)continue;const t=cross(qa,e)/det,s=cross(qa,delta)/det;if(t>0&&t<1&&s>=0&&s<=1)cuts.push(t);
   }
   cuts.sort((a,b)=>a-b);
   const inside=q=>{let yes=false;for(let i=0,j=part.p.length-1;i<part.p.length;j=i++){const a=part.p[i],b=part.p[j];if((a[1]>q[1])!==(b[1]>q[1])&&q[0]<(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
   for(let i=1;i<cuts.length;i++)if(inside(mix(...segment,(cuts[i-1]+cuts[i])/2)))line([top(mix(...segment,cuts[i-1])),top(mix(...segment,cuts[i]))],color,width);
  };
  for(let n=1;n<15;n++){
   const a=[part.u+part.w*n/15,part.v+.008],c=[a[0],part.v+part.d-.008];
   roofLine(a,c,'#83978b35',.45);
  }
  for(let n=0;n<(part.skylights||0);n++){
   const t=part.v+part.d*(.10+.8*(n+.5)/part.skylights);
   roofLine([part.u+part.w*.08,t],[part.u+part.w*.92,t],'#aebeb6',1.5);
  }
  for(let n=0;n<(part.vents||0);n++){
   const t=part.u+part.w*(n+1)/(part.vents+1),q=[t,part.v+part.d*.45];
   roofLine([q[0]-.008,q[1]],[q[0]+.008,q[1]],'#758d82',2.2);
  }
  if(part.canopy){
   const c=part.canopy*S/d,a=[part.u,part.v],b=[part.u+part.w,part.v],zRoof=z*.93;
   poly([world(a,zRoof),world(b,zRoof),world([b[0],b[1]-c],zRoof),world([a[0],a[1]-c],zRoof)],'#e5e5d5','#a2b1a4',.8);
   for(let n=0;n<=6;n++){const q=mix(a,b,n/6);line([world(q,zRoof-.55),world([q[0],q[1]-c],zRoof)],'#7c9286',.7);}
  }
  if(part.roundOffice){
   // The two neighbouring Alliance-era facilities have a rounded office pod
   // at the apron end of the lower side wing (Colliers oblique photograph).
   const centre=[part.u+part.w*.52,part.v+part.d*.16],r=[part.w*.25,part.d*.10];
   const ring=Array.from({length:28},(_,i)=>[centre[0]+Math.cos(i/28*Math.PI*2)*r[0],centre[1]+Math.sin(i/28*Math.PI*2)*r[1]]);
   const high=z+2*S;
   for(let i=0;i<ring.length;i++){
    const a=ring[i],c=ring[(i+1)%ring.length];
    poly([world(a,z),world(c,z),world(c,high),world(a,high)],'#d9dfd1');
    poly([world(a,z+.2*S),world(c,z+.2*S),world(c,high-.35*S),world(a,high-.35*S)],'#77999a','#d9dfd1',.4);
   }
   poly(ring.map(p=>world(p,high)),'#d8ded2','#eef0e1',.6);
  }
 }
}
