import {chartPixel} from './archerfield-reference.mjs';
import {hangarPoint} from './archerfield-hangars.mjs';
import {drawHangarExterior} from './archerfield-hangar-architecture.mjs';
export function drawArcherfieldAirfield(layout,{ctx,project,poly,line,groundText,hit,scale,zoom,pavement,runwaySurfaces,taxiwayPavement}){
 const {referencePavement:surface}=layout;
 // The chart's compound surface includes unsealed routes as well as asphalt.
 // Paint it first so it cannot cover the grass runway strips at intersections.
 ctx.beginPath();for(const ring of surface.rings){ring.forEach((p,i)=>{const q=project(...p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.closePath()}
 ctx.fillStyle='#91a39a';ctx.fill('evenodd');pavement.push(...surface.triangles);
 ctx.save();ctx.clip('evenodd');
 // One clipped geographic region colours the unsealed network continuously,
 // including its curved junctions; individual strokes left grey corner shards.
 poly([[350,500],[970,500],[970,638],[896,656],[844,694],[813,866],[801,866],[645,846],[548,921],[385,873]].map(chartPixel),'#9db487');
 for(const t of layout.taxiways){taxiwayPavement.push(t);if(t.surface!=='grass')line(t.points,'#e0cb7f',Math.max(.4,scale*.075));}
 ctx.restore();
 for(const r of layout.runways.filter(r=>r.surface==='grass')){
  const [nearId,farId]=r.id==='grass-west'?['21393','21395']:['21392','21396'];
  const near=layout.runwayReferencePolygons[nearId],far=layout.runwayReferencePolygons[farId];
  // Share the chart edge vertices with the sealed end pads. A second
  // independently calculated rectangle leaves fine grass wedges beside them.
  const strip=[near[0],far[1],far[2],near[3]];
  const length=Math.hypot(r.end[0]-r.start[0],r.end[1]-r.start[1]);
  const ux=(r.end[0]-r.start[0])/length,uy=(r.end[1]-r.start[1])/length;
  const at=(d,n)=>[r.start[0]+ux*d-uy*n,r.start[1]+uy*d+ux*n];
  poly(strip,'#91ad70');
  ctx.save();ctx.clip();
  // Subtle mowing bands stay inside the real 30 m grass surface.
  const band=60*layout.metresToWorld;
  for(let d=0;d<length;d+=band*2){const end=Math.min(length,d+band);poly([at(d,-r.width/2),at(end,-r.width/2),at(end,r.width/2),at(d,r.width/2)],'#96b275');}
  ctx.restore();
 }
 for(const c of layout.surfaceWidthCorrections){for(const p of c.polygons){poly(p,'#91a39a');pavement.push(p);}line(c.points,'#e0cb7f',Math.max(.4,scale*.075));}
 for(const h of layout.hangars)if(h.forecourt){poly(h.forecourt.polygon,'#b7bdb0');pavement.push(h.forecourt.polygon);}
 for(const id of ['21392','21393','21394','21395','21396'])poly(layout.runwayReferencePolygons[id],'#677d7b');
 for(const r of layout.runways){
  const length=Math.hypot(r.end[0]-r.start[0],r.end[1]-r.start[1]),ux=(r.end[0]-r.start[0])/length,uy=(r.end[1]-r.start[1])/length;
  const at=(d,n=0)=>[r.start[0]+ux*d-uy*n,r.start[1]+uy*d+ux*n];
  if(r.surface!=='grass'){
   const id=r.role==='primary'?'21886':'21847';poly(layout.runwayReferencePolygons[id],'#617779');
   line([at(8),at(length-8)],'#f6efda',Math.max(.4,scale*.09),[scale*2,scale*2.8]);
  }
  runwaySurfaces.push({id:r.id,polygon:r.polygon});
  for(const [i,d] of [0,length].entries()){
   const sign=i?-1:1,threshold=d+sign*(i?r.displacedEndM||0:r.displacedStartM||0)*layout.metresToWorld;
   const width=r.width,angle=Math.atan2(uy,ux)+(i?1:-1)*Math.PI/2;
   // Grass runway threshold asphalt is already defined by the five chart
   // polygons above (including displaced 22R). Extra rectangles protruded
   // from those outlines and produced slivers at the taxiway connections.
   if(r.surface!=='grass')for(let j=0;j<3;j++)for(const side of [-1,1])poly([at(threshold+sign,side*(.5+j*.6)),at(threshold+sign*3,side*(.5+j*.6)),at(threshold+sign*3,side*(.8+j*.6)),at(threshold+sign,side*(.8+j*.6))],'#f4efd9');
   groundText(r.designators[i],...at(threshold+sign*5),width*.27,'#fff4d6',angle);
   if(threshold!==d)for(let n=5;n<Math.abs(threshold-d)-3;n+=7)line([at(d+sign*(n-2),-.5),at(d+sign*n),at(d+sign*(n-2),.5)],'#efe8d1',Math.max(.4,scale*.1));
  }
 }
 for(const s of layout.stands){const [x,y]=s.position,ux=Math.cos(s.heading),uy=Math.sin(s.heading);line([s.merge,s.position],'#ecd590',Math.max(.45,scale*.1));line([[x-uy,y+ux],[x+uy,y-ux]],'#fbefd0',Math.max(.5,scale*.12));if(zoom>1.4)groundText(s.referenceStand,x-uy*2,y+ux*2,1,'#41665e');}
 const r=layout.runways[0];hit('building','runwaySurface',0,116-r.width/2,300,r.width,'10L / 28R runway');hit('building','runwayLength',292,116-r.width/2,8,r.width,'Runway development');
 const t=layout.taxiways.find(t=>t.id==='B'),p=t.points[2];hit('building','taxiway',p[0]-3,p[1]-3,6,6,'Archerfield taxiways');
 if(zoom>1.5)for(const id of ['A','B','C','D','F','H','J','S']){const t=layout.taxiways.find(t=>t.id===id),a=t.points[0],b=t.points[1];groundText(id,(a[0]+b[0])/2,(a[1]+b[1])/2,1.3,'#526e59');}
}
export function drawArcherfieldBuildings(layout,{defer,shapedTerminal,poly,line,scale,zoom,parkedAircraft,groundText,badge}){
 const shells=new Set(layout.hangars.map(h=>h.sourcePath).filter(Number.isFinite));
 for(const b of layout.referenceBuildings){if(shells.has(b.sourcePath)||b.id==='hangar-101-shell'||b.id==='101-rear-office')continue;
  const r=b.rect;defer(r.x+r.w/2,r.y+r.h/2,()=>shapedTerminal(b.polygon,b.height));
 }
 const cutaway=zoom>=10;
 for(const h of layout.hangars){const r=h.rect,z=h.height,W=h.widthM,D=h.depthM,at=(x,y,height=0)=>[...hangarPoint(h,x,y),height];
  defer(r.x+r.w/2,r.y+r.h/2,()=>{
   poly(h.polygon,'#d7d8c8');poly(h.floor,'#bcc9c0');
   // The complete floor and aircraft are composed together. Near cut walls
   // follow the aircraft; the overview roof covers the same interior geometry.
   for(const b of h.parking){const [x,y]=b.position;line(b.leadIn,'#c3aa66',Math.max(.45,scale*.07));parkedAircraft(b.aircraftId,{x,y,heading:b.heading},'#688f9b');}
   if(!cutaway){
    drawHangarExterior(h,{poly,line,scale});
    if(zoom>=1.7)badge(h.displayName||h.name,...hangarPoint(h,W/2,D+2),{small:true});
    return;
   }
   const wall=(a,b,height,fill='#9dada5')=>poly([[...a,0],[...b,0],[...b,height],[...a,height]],fill);
   const wallHeight=z*.3;
   const frontDistance=p=>(p[0]-h.origin[0])*h.v[0]+(p[1]-h.origin[1])*h.v[1];
   for(let i=0;i<h.polygon.length;i++){const a=h.polygon[i],b=h.polygon[(i+1)%h.polygon.length];if(Math.abs(frontDistance(a))<.02&&Math.abs(frontDistance(b))<.02)continue;wall(a,b,wallHeight);}
   for(const p of h.partitions)wall(...p,z*.17,'#8fa9a0');
   // Offices stay separate from usable hangar floor and aircraft envelopes.
   for(const o of h.offices){poly(o.polygon,'#d5c19b');line([...o.polygon,o.polygon[0]].map(p=>[...p,z*.15]),'#a59e86',Math.max(.6,scale*.12));}
   let previous=0;
   for(const [a,b] of h.doors){wall(hangarPoint(h,previous,0),hangarPoint(h,a,0),wallHeight);previous=b;
    line([at(a,0),at(b,0)],'#e8d79a',Math.max(.5,scale*.08));
   }
   wall(hangarPoint(h,previous,0),hangarPoint(h,W,0),wallHeight);
   for(const p of h.polygon)line([p,[...p,z]],'#9aafa8',Math.max(.6,scale*.1));
   line([...h.polygon,h.polygon[0]].map(p=>[...p,z]),'#91a89c80',Math.max(.6,scale*.06),[4,4]);
   badge(`${h.name} · roof cutaway`,...hangarPoint(h,W/2,D+3),{small:true});
  });
 }
}
export function drawArcherfieldParking(layout,{line,disc,groundText,defer,parkedAircraft,scale}){
 for(const bay of layout.aircraftParking){const [x,y]=bay.position,c=Math.cos(bay.heading),s=Math.sin(bay.heading);line([[x-c*1.5,y-s*1.5],[x+c,y+s]],'#ead694',Math.max(.4,scale*.08));
  if(bay.hangarId){line([[x-s*1.2,y+c*1.2],[x+s*1.2,y-c*1.2]],'#f3e9c8',Math.max(.5,scale*.08));}
  defer(x,y,()=>parkedAircraft(bay.aircraftId||'c172',{x,y,heading:bay.heading},'#75959d'));}
 for(const pad of layout.helipads){const [x,y]=pad.position;line(Array.from({length:33},(_,i)=>[x+Math.cos(i/32*Math.PI*2)*pad.radius,y+Math.sin(i/32*Math.PI*2)*pad.radius]),'#f3edd5',Math.max(.45,scale*.1));groundText('H',x,y,2,'#f8f2df');}
}

