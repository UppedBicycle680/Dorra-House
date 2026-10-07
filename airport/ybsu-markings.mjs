import {ybsuApronPoint as ap,YBSU_PUBLISHED_STANDS,ybsuStandApronPoint} from './ybsu-reference.mjs';

// Permanent YBSU paint, reviewed against Esri/Vantor satellite imagery on
// 9 Sep 2026, Airservices H116/26 and BSUAP02, and the airport's Airside
// Vehicle Control Handbook v5.3 pp10–16. Fine apron curves are visual
// approximations; published stand pins and runway dimensions are authoritative.
// Keep this presentation layer independent of aircraft routing and saved plots.
export const YBSU_MARKING_SOURCES={
  satellite:'https://www.arcgis.com/apps/mapviewer/index.html?center=153.09,-26.605&level=18',
  chart:'https://www.airservicesaustralia.com/aip/current/sup/s26-h116.pdf',
  handbook:'https://www.sunshinecoastairport.com.au/wp-content/uploads/2023/11/Airside-Vehicle-Control-Handbook-Version-5.3-October2023-compressed.pdf',
  standard:'https://www.legislation.gov.au/F2019L01146/2024-12-14/text',
  imageryDate:'unknown; construction/closure marks are not copied',
};
const S=.2,WHITE='#f2f0df',YELLOW='#dfc35e',RED='#b46159';
const mix=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t);
const length=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
const unit=(a,b)=>{const d=length(a,b)||1;return [(b[0]-a[0])/d,(b[1]-a[1])/d]};
const offset=(p,u,d)=>p.map((v,k)=>v+u[k]*d);
function rounded(points,radius=2){
  const out=[points[0]];
  for(let i=1;i<points.length-1;i++){
    const a=points[i-1],b=points[i],c=points[i+1],r=Math.min(radius,length(a,b)*.35,length(b,c)*.35);
    if(r<.02){out.push(b);continue}
    const p=offset(b,unit(b,a),r),q=offset(b,unit(b,c),r);out.push(p);
    for(let j=1;j<=10;j++){const t=j/10;out.push(mix(mix(p,b,t),mix(b,q,t),t))}
  }
  return [...out,points.at(-1)];
}
function nearest(p,paths){
  let best;
  for(const points of paths)for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],d=length(a,b),u=unit(a,b),t=Math.max(0,Math.min(d,(p[0]-a[0])*u[0]+(p[1]-a[1])*u[1])),q=offset(a,u,t),distance=length(p,q);
    if(!best||distance<best.distance)best={point:q,u,distance};
  }
  return best;
}
export function ybsuMarkingHolds(layout){
  const holds=['A1','A2'].map(id=>{
    const t=layout.taxiways.find(t=>t.id===id),p=t.points;
    // Satellite measurement: approximately 75 m from runway centreline.
    for(let i=1;i<p.length;i++)if((p[i-1][1]-101)*(p[i][1]-101)<=0){
      const point=mix(p[i-1],p[i],(101-p[i-1][1])/(p[i][1]-p[i-1][1]));
      return {id,point,u:unit(p[i-1],p[i]),widthM:23};
    }
    throw Error('YBSU '+id+' does not cross the 75 m holding position');
  });
  const f=layout.taxiways.find(t=>t.id==='F'&&t.from==='fRunway');
  const near=nearest(layout.holdShortLine,[f.points]);
  holds.push({id:'F',point:layout.holdShortLine,u:near.u.map(v=>-v),widthM:23});
  return holds;
}
// The small-scale chart narrows some taxiway symbols below their published
// 23 m width (15 m on J). Restore continuous shoulders, rather than isolated pads
// under markings. The chart's larger turning fillets and islands remain.
export function ybsuMarkingPavement(layout){
  const polygons=[];
  for(const t of layout.taxiways.filter(t=>['A','A1','A2','F','J'].includes(t.id))){
    const points=rounded(t.points,.9),half=t.widthM*S/2;
    for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],u=unit(a,b),n=[-u[1],u[0]];
      polygons.push([offset(a,n,half),offset(b,n,half),offset(b,n,-half),offset(a,n,-half)]);
    }
    for(const p of points)polygons.push(Array.from({length:16},(_,i)=>offset(p,[Math.cos(i*Math.PI/8),Math.sin(i*Math.PI/8)],half)));
  }
  return polygons;
}
// A single mesh of physical ground polygons avoids zoom-dependent stroke widths
// and screen-space dash distortion in the isometric camera.
export function createYbsuMarkings(layout){
  const polygons=[],labels=[];
  const poly=(points,colour,id)=>polygons.push({points,colour,id});
  const stroke=(points,widthM,colour=YELLOW,dashM=0,gapM=0,id='taxi-centre')=>{
    let travelled=0;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],d=length(a,b);if(d<1e-8)continue;
      const u=unit(a,b),n=[-u[1],u[0]],part=(s,e)=>{if(e-s<1e-7)return;const p=offset(a,u,s),q=offset(a,u,e),w=widthM*S/2;poly([offset(p,n,w),offset(q,n,w),offset(q,n,-w),offset(p,n,-w)],colour,id)};
      if(!dashM)part(0,d);else for(let t=0;t<d-1e-8;){const phase=(travelled+t)%((dashM+gapM)*S),on=phase<dashM*S,step=Math.min(d-t,(on?dashM*S:(dashM+gapM)*S)-phase);if(on)part(t,t+step);t+=Math.max(step,1e-7)}
      travelled+=d;
    }
  };
  const at=(x,y)=>[x*S,116+y*S];
  const rect=(x,y,w,h,colour=WHITE,id='runway')=>poly([at(x,y),at(x+w,y),at(x+w,y+h),at(x,y+h)],colour,id);
  // CASA 8.17–8.26: 45 m runway, twelve 30 m piano keys, permanent
  // 350 m displaced 31 threshold; 13's declared end is 175 m before the cap.
  stroke([at(0,22.275),at(2800,22.275)],.45,WHITE,0,0,'runway-edge');
  const mouths=layout.taxiways.filter(t=>['A1','A2'].includes(t.id)).map(t=>[t.points.at(-1)[0]-8,t.points.at(-1)[0]+8]);
  mouths.push([513.5,550]);mouths.sort((a,b)=>a[0]-b[0]);
  let edgeStart=0;for(const [a,b] of [...mouths,[560,560]]){stroke([[edgeStart,111.545],[a,111.545]],.45,WHITE,0,0,'runway-edge');edgeStart=b}
  rect(175,-22.5,1.2,45,WHITE,'13-declared-end');
  for(const [name,threshold,direction] of [['31',350,1],['13',2800,-1]]){
    const box=(along,across,l,w,id)=>rect(threshold+direction*along-(direction<0?l:0),across-w/2,l,w,WHITE,name+'-'+id);
    box(0,0,1.2,45,'threshold');
    for(const side of [-1,1])for(let i=0;i<6;i++)box(6,side*(2.55+i*3.4),30,1.7,'piano-key');
    // Stencil geometry uses 9 m high numbers, rather than the interface font.
    const digit=(char,cross)=>{
      const shape=char==='1'?[[1,0],[3,0],[3,9],[1.6,9],[0,7.4],[0,5.8],[1,6.8]]:[[0,0],[4,0],[4,9],[0,9],[0,7.5],[2.5,7.5],[2.5,5.3],[.7,5.3],[.7,3.8],[2.5,3.8],[2.5,1.5],[0,1.5]];
      poly(shape.map(([x,y])=>at(threshold+direction*(48+y),direction*(cross+x))),WHITE,name+'-number');
    };
    digit(name[0],-5.5);digit(name[1],1.5);
    // The 67 ft / 3 degree PAPI origin is approximately 390 m from each
    // threshold. Use the 400 m precision-pattern aiming location (8.22).
    for(const side of [-1,1]){
      box(400,side*16,45,9,'aiming');
      for(const d of [150,300,600,750,900])box(d,side*13,22.5,3,'touchdown');
    }
  }
  // Equal dashes and gaps, with clean gaps around both designators.
  stroke([at(419,0),at(2731,0)],.45,WHITE,30,30,'runway-centre');
  for(let tip=336;tip-40>=175;tip-=50){
    stroke([at(tip-40,0),at(tip-10,0)],.45,WHITE,0,0,'displaced-arrow');
    stroke([at(tip-10,-1.75),at(tip,0),at(tip-10,1.75)],.9,WHITE,0,0,'displaced-arrow');
  }
  // South of the reciprocal declared end the pavement remains available for
  // take-off. Do not copy the obsolete white construction X from the imagery.
  for(let tip=136;tip>=40;tip-=50){
    stroke([at(tip-40,0),at(tip-10,0)],.45,WHITE,0,0,'displaced-arrow');
    stroke([at(tip-10,-1.75),at(tip,0),at(tip-10,1.75)],.9,WHITE,0,0,'displaced-arrow');
  }
  // Northern backtrack turning loop visible outside the runway side stripe.
  // The chart supplies the turning-pad outline; imagery supplies the yellow loop.
  stroke(rounded([[513,115.7],[526,111],[536,103.3],[545,103.3],[548,106],[548,111],[544,115.7],[530,115.7]],2),.2,YELLOW,0,0,'13-turn-pad');
  for(const inset of [.15,.24])stroke([[513.8,110.45+inset],[529.4,100.9+inset],[549.84-inset,100.96+inset],[549.82-inset,111.5]],.15,YELLOW,0,0,'13-turn-pad-edge');
  for(const t of layout.taxiways){
    let points=rounded(t.points,.9);
    if(['A1','A2'].includes(t.id)){
      const end=t.points.at(-1),cut=points.findIndex(p=>p[1]>111);
      if(cut>0){const p=mix(points[cut-1],points[cut],(111-points[cut-1][1])/(points[cut][1]-points[cut-1][1]));points=[...points.slice(0,cut),p];
        for(const direction of [-1,1]){const q=[end[0]+direction*9,115.7],c=[end[0],115.7],curve=[];for(let i=0;i<=20;i++){const f=i/20;curve.push(mix(mix(p,c,f),mix(c,q,f),f))}stroke(curve,.2,YELLOW,0,0,'taxi-'+t.id+'-runway-turn')}
      }
    }
    stroke(points,.2,YELLOW,0,0,'taxi-'+t.id);
  }
  // Double yellow edges on the main taxiways. Leave junction mouths open;
  // these mark the high-strength pavement, not the edges of a traffic route.
  for(const t of layout.taxiways.filter(t=>['A','A1','A2','F'].includes(t.id))){
    const points=rounded(t.points,.9),others=layout.taxiways.filter(o=>o.id!==t.id);
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],d=length(a,b),u=unit(a,b),n=[-u[1],u[0]];
      for(let start=0;start<d-.0001;start+=.8)for(const side of [-1,1])for(const inset of [.3,.75]){
        const across=side*(t.widthM/2-inset)*S,p=offset(offset(a,u,start),n,across),q=offset(offset(a,u,Math.min(d,start+.8)),n,across),mid=mix(p,q,.5);
        if(mid[1]>111.45&&mid[0]>=0&&mid[0]<=560)continue;
        if(others.some(o=>nearest(mid,[o.points]).distance<o.width/2+.12))continue;
        stroke([p,q],.15,YELLOW,0,0,'edge-'+t.id);
      }
    }
  }
  const panel=(text,p,u,widthM=9)=>{
    const n=[-u[1],u[0]],w=widthM*S/2,h=1.5*S;
    poly([offset(offset(p,n,-w),u,-h),offset(offset(p,n,w),u,-h),offset(offset(p,n,w),u,h),offset(offset(p,n,-w),u,h)],RED,'mandatory-panel');
    labels.push({text,point:p,size:2.2*S,colour:WHITE,angle:Math.atan2(u[1],u[0])+Math.PI/2});
  };
  for(const h of ybsuMarkingHolds(layout)){
    const n=[-h.u[1],h.u[0]],half=(h.widthM/2-.4)*S;
    for(let i=0;i<4;i++){const p=offset(h.point,h.u,(i-1.5)*.6*S);stroke([offset(p,n,-half),offset(p,n,half)],.3,YELLOW,i>=2?.9:0,.6,'hold-'+h.id)}
    for(const side of [-1,1])panel('13–31',offset(offset(h.point,h.u,-4*S),n,side*5.8*S),h.u);
  }
  const b=nearest(layout.heavyHold,layout.taxiways.filter(t=>t.id==='B').map(t=>t.points)),bn=[-b.u[1],b.u[0]];
  stroke([offset(layout.heavyHold,bn,-2.15),offset(layout.heavyHold,bn,2.15)],.3,YELLOW,1,1,'B-intermediate-hold');
  // Satellite-visible apron organisation: yellow curved entries, white
  // pushback alignment, and the red/yellow parking-clearance boundary.
  const spine=layout.taxiways.filter(t=>t.id==='B').map(t=>rounded(t.points,1.4));
  for(const stand of layout.referenceParking){
    const u=[Math.cos(stand.heading),Math.sin(stand.heading)],n=[-u[1],u[0]],pin=stand.pin;
    const join=nearest(offset(pin,u,-7),spine),q=join.point;
    const approach=offset(pin,u,-Math.min(4,length(pin,q)*.5));
    for(const direction of [-1,1]){
      const start=offset(q,join.u,direction*3),control=offset(q,join.u,direction*1.4),points=[];
      for(let j=0;j<=18;j++){const t=j/18,a=mix(start,control,t),b=mix(control,approach,t),c=mix(approach,pin,t);points.push(mix(mix(a,b,t),mix(b,c,t),t))}
      stroke(points,.2,YELLOW,0,0,'bay-'+stand.referenceStand+'-lead');
    }
    stroke([offset(pin,n,-.8),offset(pin,n,.8)],.2,YELLOW,0,0,'bay-'+stand.referenceStand+'-stop');
    const label=offset(pin,u,-2.1);labels.push({text:stand.referenceStand,point:label,size:.6,colour:YELLOW,angle:stand.heading+Math.PI/2});
    stroke([offset(q,n,-2),offset(q,n,2)],.2,WHITE,1,1,'pushback-'+stand.referenceStand);
  }
  for(const s of YBSU_PUBLISHED_STANDS.filter(s=>!layout.referenceParking.some(p=>p.referenceStand===s.id))){
    const source=ybsuStandApronPoint(s),pin=ap(source),direction=parseInt(s.id,10)<=15||parseInt(s.id,10)>=30?[-.975,-.222]:[-.76,.65],u=unit(pin,ap(source.map((v,i)=>v+direction[i]))),n=[-u[1],u[0]];
    stroke([offset(pin,u,-3),pin],.15,YELLOW,0,0,'bay-'+s.id+'-lead');
    stroke([offset(pin,n,-.55),offset(pin,n,.55)],.15,YELLOW,0,0,'bay-'+s.id+'-stop');
    labels.push({text:s.id,point:offset(pin,u,-1.1),size:.42,colour:YELLOW,angle:Math.atan2(u[1],u[0])+Math.PI/2});
  }
  const clearance=[[155,73],[170,87],[195,110],[244,173],[257,185],[237,268],[231,275]].map(ap);
  stroke(clearance,.65,YELLOW,0,0,'parking-clearance-border');stroke(clearance,.25,RED,0,0,'parking-clearance-red');
  // The apron service road / pedestrian corridor hugs the terminal frontage.
  const frontage=[[155,110],[171,126],[188,143],[207,163],[217,176],[203,229],[203,241],[197,259]].map(ap);
  stroke(frontage,2.4,WHITE,.45,.6,'passenger-zebra');
  const service=[[151,108],[171,125],[189,143],[207,162],[220,176],[206,232],[205,242],[200,259]].map(ap);
  stroke(service,.15,WHITE,0,0,'service-road');
  for(const point of layout.helicopterAimingPoints){
    const near=nearest(point.position,layout.taxiways.filter(t=>t.id===point.taxiway).map(t=>t.points)),p=near.point,u=near.u,n=[-u[1],u[0]];
    const triangle=[offset(p,u,1.04),offset(offset(p,u,-.52),n,.9),offset(offset(p,u,-.52),n,-.9)];
    stroke([...triangle,triangle[0]],.3,WHITE,0,0,'heli-aiming');
  }
  return {polygons,labels};
}
const cache=new WeakMap();
export function drawYbsuMarkings(layout,{poly,groundText}){
  let mesh=cache.get(layout);if(!mesh){mesh=createYbsuMarkings(layout);cache.set(layout,mesh)}
  for(const p of mesh.polygons)poly(p.points,p.colour);
  for(const t of mesh.labels)groundText(t.text,...t.point,t.size,t.colour,t.angle);
}
