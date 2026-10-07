import {ARCHERFIELD_SCALE as s} from './archerfield-reference.mjs';

// Slice the actual registered roof outline. Keeping concave annex corners here
// prevents a rotated bounding rectangle from filling neighbouring access lanes.
function clip(points,axis,value,greater){
 const out=[];
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],ia=greater?a[axis]>=value:a[axis]<=value,ib=greater?b[axis]>=value:b[axis]<=value;
  if(ia)out.push(a);
  if(ia!==ib){const t=(value-a[axis])/(b[axis]-a[axis]);out.push(a.map((v,j)=>v+(b[j]-v)*t));}
 }
 return out;
}
const geometryCache=new WeakMap();
export function drawSiteHangarExterior(h,{poly,line,scale}){
 let commands=geometryCache.get(h);
 if(!commands){
  commands=[];
  const capture={poly:(p,c)=>commands.push({p,c}),line:(p,c,w)=>commands.push({p,c,w}),scale:0};
  for(const q of h.architecture.sections)drawSection(h,q,capture);
  geometryCache.set(h,commands);
 }
 for(const command of commands){
  if(command.w!==undefined)line(command.p,command.c,Math.max(command.w,scale*.045));
  else poly(command.p,command.c);
 }
}
function drawSection(h,q,{poly,line,scale}){
 const a=h.architecture,outline=q.localPolygon,W=h.widthM,D=h.depthM,axis=q.ridgeAlongFront?1:0,span=axis?D:W;
 const at=([x,y,z=0])=>[h.origin[0]+(h.u[0]*x+h.v[0]*y)*s,h.origin[1]+(h.u[1]*x+h.v[1]*y)*s,z*s];
 const face=(p,c)=>{if(p.length>=3)poly(p.map(at),c);};
 const stroke=(p,c,w=.5)=>line(p.map(at),c,Math.max(w,scale*.045));
 const height=p=>{const t=Math.max(0,Math.min(1,p[axis]/span));return q.eave+q.rise*(q.shape==='barrel'?Math.sin(Math.PI*t):q.shape==='gable'?1-Math.abs(2*t-1):q.shape==='skillion'?1-t:0);};
 const edges=outline.map((p,i)=>[p,outline[(i+1)%outline.length]]).sort((a,b)=>{const depth=e=>e.flatMap(at).reduce((n,v)=>n+v,0);return depth(a)-depth(b);});
 for(const [p,r] of edges){
  const splitPoints=[p];
  const divisions=q.shape==='barrel'?12:q.shape==='gable'?2:1;
  const extra=[];for(let j=1;j<divisions;j++)if((p[axis]-span*j/divisions)*(r[axis]-span*j/divisions)<0){const t=(span*j/divisions-p[axis])/(r[axis]-p[axis]);extra.push({t,p:p.map((v,i)=>v+(r[i]-v)*t)});}extra.sort((a,b)=>a.t-b.t);splitPoints.push(...extra.map(e=>e.p),r);
  face([[...p,0],[...r,0],...splitPoints.toReversed().map(p=>[...p,height(p)])],a.wall);
  // Vertical sheet cladding follows each real wall, including stepped annexes.
  const length=Math.hypot(r[0]-p[0],r[1]-p[1]);
  for(let d=1.6;d<length;d+=1.6){const t=d/length,c=p.map((v,i)=>v+(r[i]-v)*t);stroke([[...c,.2],[...c,height(c)-.15]],'#52736025',.35);}
  if(a.officeWindows)for(let d=1;d<length-2;d+=4){const pa=p.map((v,i)=>v+(r[i]-v)*d/length),pb=p.map((v,i)=>v+(r[i]-v)*(d+2)/length);for(const z of (q.eave>6?[1.2,4]:[1.2]))face([[...pa,z],[...pb,z],[...pb,z+1.3],[...pa,z+1.3]],'#587d80');}
 }
 // Doors follow actual airside wall segments, rather than an envelope edge
 // crossing the recess of a stepped building.
 for(const [p,r] of edges){
  if(a.officeWindows||Math.abs(r[0]-p[0])<2||Math.abs(r[1]-p[1])>Math.abs(r[0]-p[0])*.15||Math.max(p[1],r[1])>D*.3)continue;
  const lo=Math.min(p[0],r[0]),hi=Math.max(p[0],r[0]);
  for(const [dl,dr] of h.doors){const l=Math.max(lo+.25,dl),right=Math.min(hi-.25,dr);if(right-l<2)continue;
   const top=Math.min(height([l,0]),height([right,0]))-.75,y=(p[1]+r[1])/2-.025;
   face([[l,y,.1],[right,y,.1],[right,y,top],[l,y,top]],a.lifeFlight?'#354a50':a.trim);
   if(!a.lifeFlight)for(let x=l;x<right;x+=2.7)stroke([[x,y-.02,.15],[x,y-.02,top]],'#d3d6c15a');
   if(a.lifeFlight){
    face([[l-.4,y-.06,0],[l+.1,y-.06,0],[l+.1,y-.06,q.eave],[l-.4,y-.06,q.eave]],'#205485');
    stroke([[l,y-.08,top],[right,y-.08,top]],'#d7ded7',1.2);
    for(let x=l;x<right-1;x+=2.4)stroke([[x,y-.09,top],[Math.min(x+1.2,right),y-.09,top+.6],[Math.min(x+2.4,right),y-.09,top]],'#c0ccc8',.55);
   }
  }
 }
 const bands=q.shape==='barrel'?Array.from({length:12},(_,i)=>[span*i/12,span*(i+1)/12]):q.shape==='gable'?[[0,span/2],[span/2,span]]:[[0,span]];
 for(const [i,[lo,hi]] of bands.entries()){
  const p=clip(clip(outline,axis,lo,true),axis,hi,false);face(p.map(p=>[...p,height(p)]),i<bands.length/2?(q.roofLight||a.roofLight):(q.roofShade||a.roofShade));
 }
 // Corrugation is clipped to the roof footprint, following the roof slope.
 const cross=1-axis,extent=cross?D:W;
 for(let t=1.5;t<extent;t+=1.5){const p=clip(clip(outline,cross,t,true),cross,t+.045,false);face(p.map(p=>[...p,height(p)+.025]),'#647d6930');}
 if(q.shape==='gable'){
  const p=clip(clip(outline,axis,span/2-.065,true),axis,span/2+.065,false);face(p.map(p=>[...p,height(p)+.04]),'#d6d9c9');
 }
 if(a.roofLights)for(let i=0;i<a.roofLights;i++)for(const f of [.28,.72]){
  const c=[W*(i+1)/(a.roofLights+1),D*f];
  const p=clip(clip(clip(clip(outline,0,c[0]-.4,true),0,c[0]+.4,false),1,c[1]-2,true),1,c[1]+2,false);face(p.map(p=>[...p,height(p)+.04]),'#d8d4b7');
 }
 if(a.lifeFlight){
  // Rear office/service block and rooftop plant visible in completed aerials.
  const l=W*.18,r=W*.82,y=D*.83,z=height([W/2,D])+.7;
  face([[l,y,height([l,y])],[r,y,height([r,y])],[r,y,z],[l,y,z]],'#aebbbc');
  face([[l,y,z],[r,y,z],[r,D-.4,z],[l,D-.4,z]],'#d8dfdd');
  for(let i=0;i<8;i++){const x=W*.2+i*W*.08;face([[x,D*.77,q.eave+.2],[x+1.3,D*.77,q.eave+.2],[x+1.3,D*.77+1.4,q.eave+.2],[x,D*.77+1.4,q.eave+.2]],'#8a9a98');}
 }
}
