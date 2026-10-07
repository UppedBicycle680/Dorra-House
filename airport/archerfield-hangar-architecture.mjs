import {ARCHERFIELD_SCALE as s} from './archerfield-reference.mjs';
import {hangarPoint} from './archerfield-hangars.mjs';
import {drawSiteHangarExterior} from './archerfield-site-hangar-rendering.mjs';

// Exterior forms: approved master plan pp.309–312; H004 photograph and H101
// elevations in the operator's 2026 Hangar 101 memorandum pp.7–10,13.
// Section proportions/heights are visual estimates within registered footprints.
// They are not an as-built survey or a claim about hidden room arrangements.
export function hangarArchitecture(h){
 if(h.architecture)return h.architecture;
 const W=h.widthM,D=h.depthM;
 const part=(id,x,y,w,d,shape,eave,rise,extra={})=>({id,x,y,w,d,shape,eave,rise,...extra});
 switch(h.architectureId){
 case '001':return {wall:'#b9c2b7',trim:'#6e8278',door:'braced',sections:[
  part('north-admin',0,0,10,24.05,'gable',4,1),
  part('original-1927',10,0,W-13.8,24.05,'gable',5.7,2.1,{front:true,lights:'opposed-panels',panelCount:7}),
  part('south-lean-to',W-3.8,0,3.4,24.05,'skillion',3.4,.8),
  part('rear-workshop',10,24.05,W-13.8,D-24.05,'saw',4.4,1.6,{teeth:3,roofPanels:8}),
  part('admin-east',0,24.05,10,D-24.05,'skillion',3.8,.6)
 ],awning:true};
 case '002':return {wall:'#bcc5bf',trim:'#73897f',door:'glazed',roofLight:'#ccc9bb',roofShade:'#aeb3a7',sections:[
  part('north-workshop',0,0,5,D,'skillion',3.6,.9),
  part('continuous-coat-hanger',5,0,W-10,D,'barrel',6.2,2.3,{front:true,lights:'sparse-patches'}),
  part('south-workshop',W-5,0,5,D,'skillion',3.6,.9,{reverse:true})
 ]};
 case '003':return {wall:'#acb8af',trim:'#506d64',door:'panel',sections:[
  part('comet-1935',0,0,W-6.5,D*.52,'barrel',5.6,1.55,{front:true,lights:'centre-patches'}),
  part('east-workshop',0,D*.52,W-6.5,D*.48,'saw',4.4,1.6,{teeth:3}),
  part('south-annex',W-6.5,0,6.5,D,'skillion',3.6,.5,{reverse:true})
 ]};
 case '004':return {wall:'#c5cac5',trim:'#385872',door:'modern-open',sections:[
  part('tisdall-north-bay',0,0,W/2,D,'gable',7.7,.9,{front:true,fascia:'#475659',noCentrePost:true,lights:'opposed-panels',panelCount:4,stagger:true}),
  part('tisdall-south-bay',W/2,0,W/2,D,'gable',7.7,.9,{front:true,fascia:'#475659',noCentrePost:true,lights:'opposed-panels',panelCount:4,stagger:true})
 ]};
 case '005':{const wing=(W-27.4)/2;return {wall:'#d2d6ca',trim:'#6d7e78',door:'sliding',sections:[
  part('north-workshop',0,0,wing,D,'skillion',4.3,1.1),
  part('continuous-2016-dome',wing,0,27.4,D,'barrel',6,3.1,{front:true,lights:'opposed-panels',panelCount:12,clerestory:true}),
  part('south-office',W-wing,0,wing,D,'skillion',4.3,1.1,{reverse:true})
 ],sideWindows:true};}
 case '006':return {wall:'#c2c8bd',trim:'#647871',door:'high-tail',sections:[
  part('east-maintenance',0,0,W*.19,D,'skillion',4.1,1.1),
  part('north-opening-coat-hanger',W*.19,0,W*.66,D*.82,'barrel',6.5,2.5,{front:true,lights:'six-panels',ridgeVent:true}),
  part('west-terminal-remnant',W*.85,0,W*.15-2.7,D*.82,'skillion',3.6,1,{reverse:true}),
  part('west-door-track-cover',W-2.7,0,2.7,7,'flat',3.6,0),
  part('south-ancillary',W*.19,D*.82,W*.81-2.7,D*.18,'skillion',4.2,.8)
 ]};
 case '101':return {wall:'#e1e1d5',trim:'#424e50',door:'contemporary',sections:[
  part('north-compartment',8,0,57,D,'skillion',9.3,1.1,{front:true,fascia:'#424e50'}),
  part('south-compartment',65,0,39,D,'skillion',10.1,.8,{front:true,fascia:'#424e50'})
 ],bronzeOffices:true};
 default:throw new Error(`No individual architecture for ${h.id}`);
 }
}

export function drawHangarExterior(h,{poly,line,scale}){
 if(h.architecture?.footprintRoof)return drawSiteHangarExterior(h,{poly,line,scale});
 const a=hangarArchitecture(h),at=(x,y,z=0)=>[...hangarPoint(h,x,y),z*s];
 const face=(p,c)=>poly(p.map(([x,y,z])=>at(x,y,z)),c);
 const stroke=(p,c,w=.6)=>line(p.map(([x,y,z])=>at(x,y,z)),c,Math.max(w,scale*.045));
 const sectionHeight=(q,t)=>q.eave+(q.shape==='barrel'?Math.sin(Math.PI*t):q.shape==='gable'?1-Math.abs(t*2-1):q.shape==='skillion'?(q.reverse?t:1-t):0)*q.rise;
 // Only these offices project beyond the section roofs. Internal offices are
 // already enclosed by their own admin/lean-to assembly. Window heights scale
 // with the annex, avoiding the generic terminal's taller window dimensions.
 for(const o of h.offices.filter(o=>['004-rear-annex','101-north-office','101-rear-office'].includes(o.id))){
  const edges=o.polygon.map((p,i)=>[p,o.polygon[(i+1)%o.polygon.length]]).sort((a,b)=>a.flat().reduce((s,n)=>s+n,0)-b.flat().reduce((s,n)=>s+n,0));
  for(const [p,q] of edges){
   const H=o.height,d=Math.hypot(q[0]-p[0],q[1]-p[1]),point=(t,z)=>[p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,z];
   poly([[...p,0],[...q,0],[...q,H],[...p,H]],'#cbd2c5');
   for(let n=s;n<d-2*s;n+=3.2*s)poly([point(n/d,H*.25),point((n+1.8*s)/d,H*.25),point((n+1.8*s)/d,H*.65),point(n/d,H*.65)],'#638a8a');
  }
  poly(o.polygon.map(p=>[...p,o.height]),'#e8e6d7');
 }
 // Back sections are painted first in the fixed isometric camera. Each whole
 // assembly owns its walls and roof, preventing tall generic walls piercing it.
 const ordered=[...a.sections].sort((p,q)=>{const pp=hangarPoint(h,p.x+p.w/2,p.y+p.d/2),qq=hangarPoint(h,q.x+q.w/2,q.y+q.d/2);return pp[0]+pp[1]-qq[0]-qq[1];});
 for(const q of ordered){
  const {x,y,w,d}=q;
  if(q.shape==='saw'){
   const tw=w/q.teeth;
   for(const xx of [x,x+w])face([[xx,y,0],[xx,y+d,0],[xx,y+d,q.eave],[xx,y,q.eave]],a.wall);
   for(let i=0;i<q.teeth;i++){
    const l=x+i*tw,r=l+tw,z=q.eave;
    face([[l,y,0],[r,y,0],[r,y,z+q.rise],[l,y,z]],a.wall);
    face([[l,y+d,0],[r,y+d,0],[r,y+d,z+q.rise],[l,y+d,z]],a.wall);
    face([[r,y,z],[r,y+d,z],[r,y+d,z+q.rise],[r,y,z+q.rise]],'#91b1b1');
    face([[l,y,z],[r,y,z+q.rise],[r,y+d,z+q.rise],[l,y+d,z]],'#dce0d1');
    for(let yy=y+1.4;yy<y+d;yy+=1.4)stroke([[l,yy,z+.02],[r,yy,z+q.rise+.02]],'#82938335',.4);
    if(q.roofPanels)for(let n=0;n<q.roofPanels;n++){const yy=y+1.5+n*(d-3)/q.roofPanels,lo=l+.5,hi=r-.5;face([[lo,yy,z+q.rise*.5/tw+.03],[hi,yy,z+q.rise*(tw-.5)/tw+.03],[hi,yy+.75,z+q.rise*(tw-.5)/tw+.03],[lo,yy+.75,z+q.rise*.5/tw+.03]],'#c8c5ac');}
    for(let n=y+3;n<y+d;n+=4)stroke([[r,n,z],[r,n,z+q.rise]],'#617e77',.45);
    stroke([[r,y,z+q.rise],[r,y+d,z+q.rise]],'#9aaea2');
   }
   continue;
  }
  const segments=q.shape==='barrel'?12:q.shape==='gable'?2:1;
  const profile=Array.from({length:segments+1},(_,i)=>[x+w*i/segments,sectionHeight(q,i/segments)]);
  face([[x,y,0],[x,y+d,0],[x,y+d,profile[0][1]],[x,y,profile[0][1]]],'#9aada2');
  face([[x+w,y,0],[x+w,y+d,0],[x+w,y+d,profile.at(-1)[1]],[x+w,y,profile.at(-1)[1]]],a.wall);
  face([[x,y+d,0],[x+w,y+d,0],...profile.toReversed().map(([xx,z])=>[xx,y+d,z])],a.wall);
  face([[x,y,0],[x+w,y,0],...profile.toReversed().map(([xx,z])=>[xx,y,z])],a.wall);
  if(q.front){
   const opening=a.door==='contemporary'?h.doors.find(([l,r])=>l>=x&&r<=x+w):null;
   const dh=a.door==='contemporary'?8.5:q.eave*.87,l=opening?.[0]??x+.6,r=opening?.[1]??x+w-.6,open=a.door==='modern-open',modern=['modern-open','contemporary'].includes(a.door);
   face([[l,y-.025,0],[r,y-.025,0],[r,y-.025,dh],[l,y-.025,dh]],open?'#455b59':'#bdc9bf');
   const step=modern?3:2.4;
   for(let xx=l;xx<r;xx+=step){
    stroke([[xx,y-.04,.1],[xx,y-.04,dh]],open?'#536867':'#8c9f92',.5);
    if(['glazed','contemporary'].includes(a.door))face([[xx+.3,y-.06,dh*.28],[Math.min(xx+step-.3,r-.1),y-.06,dh*.28],[Math.min(xx+step-.3,r-.1),y-.06,dh*.46],[xx+.3,y-.06,dh*.46]],'#4c7475');
    if(a.door==='braced')stroke([[xx,y-.06,.2],[Math.min(xx+step,r),y-.06,dh-.1],[xx,y-.06,dh-.1],[Math.min(xx+step,r),y-.06,.2]],'#7c8f81',.5);
   }
   if(open){const m=(l+r)/2;for(const xx of (q.noCentrePost?[l,r]:[l,m,r]))face([[xx-.35,y-.08,0],[xx+.35,y-.08,0],[xx+.35,y-.08,q.eave],[xx-.35,y-.08,q.eave]],'#365c79');}
   face([[x,y-.09,dh],[x+w,y-.09,dh],[x+w,y-.09,q.eave],[x,y-.09,q.eave]],q.fascia||a.trim);
   if(a.door==='high-tail'){const m=x+w/2;face([[m-2,y-.1,dh],[m+2,y-.1,dh],[m+2,y-.1,q.eave+q.rise*.7],[m-2,y-.1,q.eave+q.rise*.7]],'#a8b9ad');stroke([[m-2,y-.11,dh],[m-2,y-.11,q.eave+q.rise*.7],[m+2,y-.11,q.eave+q.rise*.7],[m+2,y-.11,dh]],a.trim);}
   // Door tracks remain inside the reference footprint to keep access lanes clear.
   stroke([[x,y-.1,dh],[x+w,y-.1,dh]],'#e0e1d0',.75);
  }
  for(let i=0;i<segments;i++){
   const [l,zl]=profile[i],[r,zr]=profile[i+1];
   face([[l,y,zl],[r,y,zr],[r,y+d,zr],[l,y+d,zl]],i<segments/2?(a.roofLight||'#e6e8d9'):(a.roofShade||'#bbc8bd'));
  }
  // Sheet ribs follow the fall of the roof, across its gable/arch profile.
  for(let yy=y+1.4;yy<y+d;yy+=1.4)stroke(profile.map(([xx,z])=>[xx,yy,z+.025]),'#7e98873b',.4);
  const zAt=xx=>{const t=Math.max(0,Math.min(segments-.000001,(xx-x)/w*segments)),i=Math.floor(t);return profile[i][1]+(profile[i+1][1]-profile[i][1])*(t-i);};
  const panel=(lo,hi,yy,length=.85)=>{const xs=[lo,...profile.map(p=>p[0]).filter(xx=>xx>lo&&xx<hi),hi];for(let i=1;i<xs.length;i++){const l=xs[i-1],r=xs[i];face([[l,yy,zAt(l)+.03],[r,yy,zAt(r)+.03],[r,yy+length,zAt(r)+.03],[l,yy+length,zAt(l)+.03]],'#c8c5ad');}};
  if(q.lights==='opposed-panels')for(let n=0;n<q.panelCount;n++){
   const yy=y+2+n*(d-4)/q.panelCount,gap=w*.08;
   panel(x+.7,x+w/2-gap,yy);panel(x+w/2+gap,x+w-.7,Math.min(y+d-1,yy+(q.stagger?(d-4)/q.panelCount*.35:0)));
  }
  if(q.lights==='centre-patches')for(let n=0;n<4;n++)panel(x+w/2-3.4,x+w/2+3.4,y+5+n*(d-10)/3,.8);
  if(q.lights==='sparse-patches')for(const t of [.23,.77])for(let n=0;n<3;n++)panel(x+w*t-1.5,x+w*t+1.5,y+10+n*6,.85);
  if(q.lights==='six-panels')for(const t of [.27,.73])for(const f of [.24,.46,.68])panel(x+w*t-3.7,x+w*t+3.7,y+d*f,1.5);
  if(q.ridgeVent){const l=x+w/2-.7,r=x+w/2+.7,front=y+d*.18,back=y+d*.82,z=q.eave+q.rise;face([[l,front,z],[r,front,z],[r,front,z+.5],[l,front,z+.5]],'#92a39a');face([[l,front,z],[l,back,z],[l,back,z+.5],[l,front,z+.5]],'#93a69b');face([[l,front,z+.5],[r,front,z+.5],[r,back,z+.5],[l,back,z+.5]],'#d9ded4');}
  if(q.lights==='length')for(const t of [.3,.7]){const l=x+w*t-.7,r=l+1.4;face([[l,y+2,sectionHeight(q,(l-x)/w)+.03],[r,y+2,sectionHeight(q,(r-x)/w)+.03],[r,y+d-2,sectionHeight(q,(r-x)/w)+.03],[l,y+d-2,sectionHeight(q,(l-x)/w)+.03]],'#b3ccce');}
  if(q.lights==='cross')for(const yy of [y+d*.35,y+d*.68])for(let i=1;i<segments-1;i++){const [l,zl]=profile[i],[r,zr]=profile[i+1];face([[l,yy,zl+.03],[r,yy,zr+.03],[r,yy+1.2,zr+.03],[l,yy+1.2,zl+.03]],'#b4ced0');}
  if(q.clerestory)for(const xx of [x,x+w])for(let yy=y+2;yy<y+d-2;yy+=3)face([[xx,yy,5.5],[xx,yy+2,5.5],[xx,yy+2,6],[xx,yy,6]],'#547a7c');

 }
 if(a.awning){face([[10,0,4.9],[h.widthM-3.8,0,4.9],[h.widthM-3.8,-1.1,4.65],[10,-1.1,4.65]],'#879b8d');}
 if(h.architectureId==='001')for(let x=1;x<8;x+=3)face([[x,h.depthM+.01,1.2],[x+1.8,h.depthM+.01,1.2],[x+1.8,h.depthM+.01,2.6],[x,h.depthM+.01,2.6]],'#608788');
 if(a.sideWindows){const xx=h.widthM;for(let y=4;y<h.depthM-3;y+=4)face([[xx+.02,y,1.3],[xx+.02,y+2.5,1.3],[xx+.02,y+2.5,2.8],[xx+.02,y,2.8]],'#608788');}
 if(a.bronzeOffices){
  // Completed-facility photographs, AODELI 12 June 2026: Medium Bronze,
  // Monument and Shining Silver, with upper glazing and vertical sunshades.
  // https://aodeli.com.au/hangar_101_archerfield_airport_aluminium_cladding/
  for(const [x,y,w,z] of [[66,43,33,6],[0,36,14,6]]){
   face([[x,y,0],[x+w,y,0],[x+w,y,z],[x,y,z]],'#454e50');
   face([[x+.4,y+.02,z*.48],[x+w-.4,y+.02,z*.48],[x+w-.4,y+.02,z],[x+.4,y+.02,z]],'#b3a38a');
   face([[x+1,y+.04,z*.56],[x+w*.65,y+.04,z*.56],[x+w*.65,y+.04,z*.86],[x+1,y+.04,z*.86]],'#638080');
   for(let xx=x+1;xx<x+w*.65;xx+=1.5)face([[xx,y+.08,z*.52],[xx+.22,y+.08,z*.52],[xx+.22,y+.08,z*.91],[xx,y+.08,z*.91]],'#3f5052');
   face([[x+w*.2,y+.04,0],[x+w*.2+1.8,y+.04,0],[x+w*.2+1.8,y+.04,2.5],[x+w*.2,y+.04,2.5]],'#638080');
   face([[x,y+.1,z],[x+w,y+.1,z],[x+w,y+.1,z+.35],[x,y+.1,z+.35]],'#d4d8d3');
   for(const xx of [x,x+w-.4])face([[xx,y+.1,0],[xx+.4,y+.1,0],[xx+.4,y+.1,z+.35],[xx,y+.1,z+.35]],'#cbd2ce');
  }
 }
}
