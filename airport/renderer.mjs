import {drawHamiltonNeighbourhood} from './hamilton-neighbourhood.mjs';
import {drawGatewayAirfield,drawGatewayStands,drawGatewayTerminal,drawGatewayDetails} from './queensland-gateway-rendering.mjs';
import {drawHamiltonTerminalArchitecture,HAMILTON_TERMINAL_HEIGHT} from './hamilton-terminal.mjs';
import {drawHamiltonGA} from './hamilton-ga.mjs';
import {drawHamiltonIsland,drawHamiltonShallows,hamiltonIslandElevation} from './hamilton-island.mjs';
import {drawHamiltonMarkings,HAMILTON_MARKING_PAVEMENT} from './hamilton-markings.mjs';
import {drawHamiltonTower,HAMILTON_TOWER_POLYGON,HAMILTON_TOWER_FLOOR,HAMILTON_TOWER_TOP} from './hamilton-tower.mjs';
import {drawBrisbaneBays, drawBrisbaneJetway, jetwayGeometry, visibleBrisbaneJetways} from './brisbane-apron-renderer.mjs';
import {drawBrisbaneRetiredRunwayMarkings} from './brisbane-retired-runway.mjs';
import {drawReferenceTerminal,terminalArchitectureHeight} from './terminal-architecture.mjs';
import {drawGoldCoastHangars} from './gold-coast-hangar-renderer.mjs';
import {drawGoldCoastGaMarkings,GOLD_COAST_GA_MARKINGS} from './gold-coast-ga-markings.mjs';
import {BRISBANE_HANGAR_ROADS} from './brisbane-hangar-roads.mjs';
import {drawDomesticGround,drawDomesticStructures,drawDomesticApron} from './brisbane-domestic-renderer.mjs';
import {inDomesticDetailRegion} from './brisbane-domestic-details.mjs';
import {drawYbsuTerminalGround,ybsuTerminalHitPolygons} from './ybsu-terminal.mjs';
import {drawYbsuMarkings,ybsuMarkingPavement} from './ybsu-markings.mjs';
import {operatingTaxiways} from './traffic.mjs';
import {drawArcherfieldAirfield,drawArcherfieldBuildings,drawArcherfieldParking} from './archerfield-rendering.mjs';
import {drawRedcliffeFacilities} from './redcliffe-facilities.mjs';
import {drawRedcliffeClubGrounds} from './redcliffe-club.mjs';
import {drawRedcliffeRunwayMarkings,drawRedcliffeHold,drawRedcliffeTaxiwayMarkings} from './redcliffe-markings.mjs';
import {getAirportLayout,runwayPolygon} from './layouts.mjs';
import {drawHamiltonTerminal,drawIslandMountain} from './hamilton-scenery.mjs';
import {AIRCRAFT_MODELS,drawAircraft} from './aircraft-models.mjs';
import {GROUND_EQUIPMENT,drawGroundEquipment} from './ground-equipment.mjs';
import {advancePassengerShuttle} from './passenger-shuttle.mjs';
import {groundEquipmentPlacements,equipmentOverlaps,equipmentFootprint,aircraftEquipmentExclusion} from './ground-equipment-placement.mjs';
import {operatingRunway,createFlightPlan,sampleFlight,sampleInteractiveFlight,roundedPath,taxiwayPath,apronConnectors} from './traffic.mjs';

// Presentation only: routes, camera and models cannot change balances or rewards.
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)};
const surfaces=['#b7966c','#aaa897','#637980','#526b76','#b9c7c8'];
const inside=(p,points)=>{let found=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)found=!found}return found};
const convexHull=points=>{const sorted=[...points].sort((a,b)=>a.x-b.x||a.y-b.y),cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x),half=items=>{const result=[];for(const p of items){while(result.length>1&&cross(result.at(-2),result.at(-1),p)<=0)result.pop();result.push(p)}return result};return half(sorted).slice(0,-1).concat(half([...sorted].reverse()).slice(0,-1))};

export function createAirportRenderer(canvas,{onSelect=()=>{},onCameraChange=()=>{},presentationTime=null}={}){
  let ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw new Error('Your browser could not open the airport playfield.');
  let width=1,height=1,dpr=1,scale=1,offsetX=0,offsetY=0,frame=0,disposed=false;
  let airport=null,layout=getAirportLayout('redcliffe'),selected=null,hover=null,hits=[],objects=[],flights=[],pavement=[],taxiwayPavement=[],recordPavement=false;
  let projXX=1,projXY=-1,projYX=.455,projYY=.455;
  let zoom=1,panX=0,panY=0,drag=null,lastViewTime=performance.now(),serverTime=Date.now(),lastPaint=0;
  let staticDirty=true,worldSignature='',renderedFrames=0,lastFrameMs=0,totalRenderMs=0,routeSignature='';
  let staticObjects=[],staticHits=[],selectedSurfaceId=null,incidentSnapshot=null;
  let equipment=[],visibleEquipment=[],towEquipment=[],shuttleState={},lastShuttleTime=null;
  const foregroundContext=ctx,staticCanvas=document.createElement('canvas'),staticContext=staticCanvas.getContext('2d',{alpha:false});
  const assignments=new Map(),interactiveAssignments=new Map(),parkedCache=new Map(),motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
  const allAssignments=()=>[...assignments.values(),...interactiveAssignments.values()];
  let runwaySurfaces=[];
  let reduced=motionQuery.matches;
  const motionChange=e=>{reduced=e.matches};motionQuery.addEventListener('change',motionChange);
  const terrainImage=new Image();terrainImage.src='assets/airport/coastal-terrain.png';
  const project=(x,y,z=0)=>({x:offsetX+(x*projXX+y*projXY)*scale,y:offsetY+(x*projYX+y*projYY)*scale-z*scale});
  const level=key=>airport?.buildings?.find(b=>b.key===key)?.level??(['researchLab','cargo'].includes(key)?0:1);
  const defer=(x,y,draw)=>objects.push({depth:x*projYX+y*projYY,draw});
  const landContains=(x,y)=>(layout.land||[]).some(p=>inside({x,y},p.map(a=>({x:a[0],y:a[1]}))));
  function polygon(points,fill,stroke=null,lw=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke()}}
  function poly(points,fill,stroke=null,lw=1){polygon(points.map(p=>project(...p)),fill,stroke,lw)}
  function rect(x,y,w,h,fill,z=0,stroke=null){poly([[x,y,z],[x+w,y,z],[x+w,y+h,z],[x,y+h,z]],fill,stroke)}
  function line(points,colour,lw=1,dash=[]){ctx.beginPath();points.forEach((p,i)=>{const s=project(...p);i?ctx.lineTo(s.x,s.y):ctx.moveTo(s.x,s.y)});ctx.strokeStyle=colour;ctx.lineWidth=lw;ctx.lineCap='round';ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([])}
  function disc(x,y,r,fill,z=0){poly(Array.from({length:20},(_,i)=>[x+Math.cos(i/20*TAU)*r,y+Math.sin(i/20*TAU)*r,z]),fill)}
  function clipPavementPaint(draw){
    ctx.save();ctx.beginPath();
    // Consistent winding forms a union: overlapping apron pieces must not
    // punch holes into paint at junctions. Stroke edges remain on pavement.
    for(const polygon of pavement){
      const area=polygon.reduce((s,a,i)=>{const b=polygon[(i+1)%polygon.length];return s+a[0]*b[1]-a[1]*b[0]},0);
      const ring=area<0?[...polygon].reverse():polygon;
      ring.forEach((p,i)=>{const q=project(...p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.closePath();
    }
    ctx.clip();draw();ctx.restore();
  }
  function road(points,w,fill,marking=null){
    for(let i=1;i<points.length;i++){const [x,y]=points[i-1],[ex,ey]=points[i],d=Math.hypot(ex-x,ey-y);if(d<.01)continue;const nx=-(ey-y)/d*w/2,ny=(ex-x)/d*w/2,shape=[[x+nx,y+ny],[ex+nx,ey+ny],[ex-nx,ey-ny],[x-nx,y-ny]];poly(shape,fill);if(recordPavement)pavement.push(shape)}
    points.forEach(p=>{disc(...p,w/2,fill);if(recordPavement)pavement.push(Array.from({length:20},(_,i)=>[p[0]+Math.cos(i/20*TAU)*w/2,p[1]+Math.sin(i/20*TAU)*w/2]))});if(marking)line(points,marking,Math.max(.65,scale*.13));
  }
  function box(x,y,w,d,h,roof='#e8e6d6',front='#cbd7cc',side='#adc2b8'){
    rect(x+.6,y+.8,w,d,'#36534720');
    poly([[x+w,y,0],[x+w,y+d,0],[x+w,y+d,h],[x+w,y,h]],side);
    poly([[x,y+d,0],[x+w,y+d,0],[x+w,y+d,h],[x,y+d,h]],front);
    rect(x,y,w,d,roof,h);line([[x,y,h],[x+w,y,h],[x+w,y+d,h]],'#fff7',.6);
  }
  function shapedTerminal(points,height,{skylights=true,roof='#f0ecda'}={}){
    // Extrude the authored footprint with the same cream/teal materials as the
    // rectangular terminals. The crescent stays open on its landside edge.
    poly(points.map(([x,y])=>[x+.6,y+.8]),'#36534720');
    const edges=points.map((a,i)=>({a,b:points[(i+1)%points.length]})).sort((u,v)=>(u.a[0]+u.a[1]+u.b[0]+u.b[1])-(v.a[0]+v.a[1]+v.b[0]+v.b[1]));
    for(const {a,b} of edges){
      poly([[...a,0],[...b,0],[...b,height],[...a,height]],b[0]-a[0]>b[1]-a[1]?'#d0daca':'#9eb8b0');
      const d=Math.hypot(b[0]-a[0],b[1]-a[1]);
      for(let n=1;n<d-1;n+=3){const f=n/d,g=Math.min(n+1.8,d-.5)/d,at=(t,z)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,z];poly([at(f,1),at(g,1),at(g,height-.4),at(f,height-.4)],'#71999d')}
    }
    poly(points.map(p=>[...p,height]),roof,'#fff7',.6);
    if(!skylights)return;
    // Clip skylights to the roof instead of filling the crescent's courtyard.
    ctx.save();ctx.beginPath();points.forEach((p,i)=>{const q=project(...p,height+.05);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.closePath();ctx.clip();
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),minY=Math.min(...ys),maxY=Math.max(...ys);
    for(let x=Math.min(...xs)+3;x<Math.max(...xs);x+=9)rect(x,minY+2,4,maxY-minY-4,'#9eb9b9',height+.05);
    ctx.restore();
  }
  function groundText(text,x,y,size=2,colour='#eef0dc',angle=0,z=0){
    const p=project(x,y,z),u=project(x+Math.cos(angle),y+Math.sin(angle),z),v=project(x-Math.sin(angle),y+Math.cos(angle),z);
    ctx.save();ctx.transform(u.x-p.x,u.y-p.y,v.x-p.x,v.y-p.y,p.x,p.y);ctx.fillStyle=colour;ctx.font='800 '+size+'px Inter';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,0,0);ctx.restore();
  }
  function badge(text,x,y,{colour='#4b706d',background='#f8fff0dd',small=false}={}){
    const p=project(x,y);ctx.save();ctx.font=(small?'600 9':'800 10')+'px Inter';const w=ctx.measureText(text).width+14;ctx.fillStyle=background;ctx.beginPath();ctx.roundRect(p.x-w/2,p.y-10,w,20,6);ctx.fill();ctx.fillStyle=colour;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,p.x,p.y);ctx.restore();
  }
  function hit(kind,id,x,y,w,h,label,objectHeight=0){const corners=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],ground=corners.map(p=>project(...p));hits.push({kind,id,label,x,y,w,h,objectHeight,points:objectHeight?convexHull([...ground,...corners.map(p=>project(...p,objectHeight))]):ground});return hits.at(-1)}
  function terrain(time){
    const dry=/inland|farmland/i.test(layout.setting),b=layout.bounds;
    const island=layout.id==='hamilton-island';
    const g=ctx.createLinearGradient(0,0,width,height);g.addColorStop(0,island?'#b2dedd':dry?'#d5d4ab':'#c7dcc0');g.addColorStop(1,island?'#83becb':dry?'#bdc490':'#a9c8a3');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
    for(const water of layout.water||[])poly(water.polygon,'#95cbd1');
    if(island)drawHamiltonShallows({poly});
    for(const p of layout.land||[]){poly(p,'#d9ddba',null);poly(p,layout.baseGround||'#b4cc92','#d9ddba',Math.max(2,scale*2));}
    if(terrainImage.complete&&terrainImage.naturalWidth){ctx.save();ctx.globalAlpha=.035;ctx.globalCompositeOperation='multiply';ctx.drawImage(terrainImage,0,0,width,height);ctx.restore()}
    for(let i=0;i<230;i++){const x=b.minX+hash(i+42)*(b.maxX-b.minX),y=b.minY+hash(i+330)*(b.maxY-b.minY);if(!landContains(x,y))continue;rect(x,y,.55,.22,i%3?'#dce5b842':'#749d682c')}
    for(const mark of layout.landmarks){const {x,y,w,h}=mark;if(mark.kind==='hill'||mark.kind==='island')poly(Array.from({length:36},(_,i)=>[x+w*.5+Math.cos(i/36*TAU)*w*.5,y+h*.5+Math.sin(i/36*TAU)*h*.5]),'#97b981');else if(mark.kind==='beach')rect(x,y,w,h,'#ddd6a8');else if(mark.kind==='wetland')rect(x,y,w,h,'#97b69b');else if(mark.kind==='farmland'){rect(x,y,w,h,'#ccc48f');for(let px=x+2;px<x+w;px+=4)line([[px,y],[px,y+h]],'#aeb779',scale*.2)}}
    for(const w of layout.water||[])for(let i=0;i<28;i++){const x=b.minX+hash(i+691)*(b.maxX-b.minX),y=b.minY+hash(i+734)*(b.maxY-b.minY);if(landContains(x,y)||!inside({x,y},w.polygon.map(p=>({x:p[0],y:p[1]}))))continue;const drift=reduced?0:Math.sin(time/2400+i)*.9;line([[x+drift,y],[x+4+drift,y]],'#e7f7e850',1)}
  }
  function tree(x,y,size=1,seed=0){defer(x,y,()=>{disc(x+.8,y+.9,size*1.3,'#3f694723');line([[x,y],[x,y,size*4]],'#8a9475',Math.max(1,scale*.25));for(let i=0;i<3;i++){const p=project(x+(i-1)*size*.5,y,size*(2.2+i*.8));ctx.fillStyle=['#709a70','#8bb078','#aec98c'][(i+seed)%3];ctx.beginPath();ctx.ellipse(p.x,p.y,size*scale*(1.15-i*.1),size*scale*(1.5-i*.12),-.15,0,TAU);ctx.fill()}})}
  function scenery(){
    if(layout.domesticPrecinct)drawDomesticStructures(layout,{poly,line,get ctx(){return ctx},project,defer,scale,tree});
    if(layout.id==='brisbane')for(const surface of BRISBANE_HANGAR_ROADS){
      ctx.beginPath();
      for(const ring of [surface.polygon,...surface.holes]){
        ring.forEach((p,i)=>{const q=project(...p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.closePath();
      }
      ctx.fillStyle='#91a298';ctx.fill('evenodd');
    }
    if(layout.routeModel==='queensland-gateway')drawGatewayDetails(layout,{rect,poly,line,disc,box,road,defer,tree,vehicle,scale});
    if(layout.routeModel==='gold-coast')drawGoldCoastHangars(layout,{defer,poly,line,scale});
    if(layout.routeModel==='archerfield')return drawArcherfieldBuildings(layout,{defer,shapedTerminal,poly,line,scale,zoom,parkedAircraft,groundText,badge});
    if(['ybsu','hamilton'].includes(layout.routeModel)){
      if(layout.routeModel==='hamilton'){
        drawHamiltonIsland(layout,{poly,line,defer,hash,landContains});
        drawHamiltonNeighbourhood(layout,{poly,line,disc,defer,groundText,hash,landContains,elevation:hamiltonIslandElevation});
      }
      if(layout.routeModel==='hamilton')drawHamiltonGA(layout,{poly,line,defer,scale});
      else for(const b of layout.referenceBuildings)defer(b.rect.x+b.rect.w/2,b.rect.y+b.rect.h/2,()=>shapedTerminal(b.polygon,1.6));
      return;
    }
    if(layout.id==='redcliffe')drawRedcliffeFacilities({rect,road,line,poly,box,disc,defer,groundText,badge,zoom,scale,clipMarkings:clipPavementPaint,
      aircraft:(x,y,heading,colour)=>defer(x,y,()=>parkedAircraft('c172',{x,y,heading,altitude:0},colour))});
    if(layout.id==='redcliffe')drawRedcliffeClubGrounds({poly,line,road,disc,defer,tree,vehicle,badge,zoom,scale});
    const b=layout.bounds,ry=layout.runwayCentreY;
    const nearLane=(x,y,lane)=>lane.points.slice(1).some((p,i)=>{const a=lane.points[i],dx=p[0]-a[0],dy=p[1]-a[1],t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)<(lane.width||4)/2+5});
    const occupied=(x,y)=>layout.explicitLandside&&(
      [...layout.terminals.map(t=>t.rect),...Object.values(layout.facilities),...layout.landmarks].some(r=>x>r.x-5&&x<r.x+r.w+5&&y>r.y-5&&y<r.y+r.h+5)
      ||layout.aprons.some(a=>inside({x,y},a.polygon.map(p=>({x:p[0],y:p[1]}))))
      ||[...layout.roads,...layout.taxiways,...(layout.railways||[])].some(r=>nearLane(x,y,r)));
    for(let i=0;i<65;i++){const x=b.minX+hash(i+831)*(b.maxX-b.minX),y=b.minY+hash(i+851)*(b.maxY-b.minY);if(y>-20&&y<ry+25)continue;if(layout.id==='brisbane'&&inDomesticDetailRegion(x,y))continue;if(layout.runways.some(r=>inside({x,y},r.protectedPolygon.map(p=>({x:p[0],y:p[1]})))))continue;if(!landContains(x,y)||occupied(x,y))continue;tree(x,y,1.3+hash(i+7)*1.2,i%3)}
    for(const mark of layout.landmarks||[]){
      const {x,y,w=10,h=8}=mark;
      if(mark.kind==='mountain'){defer(x+w/2,y+h/2,()=>drawIslandMountain(mark,{poly,line,disc,hash}));continue}
      if(['water','label','parking','wetland','beach','farmland'].includes(mark.kind))continue;
      if(['hill','island'].includes(mark.kind)){for(let i=0;i<20;i++){const a=hash(i+3)*TAU,r=Math.sqrt(hash(i+61))*.46;tree(x+w*.5+Math.cos(a)*w*r,y+h*.5+Math.sin(a)*h*r,2.3,i%3)}}
      else if(!landContains(x+w/2,y+h/2)&&mark.kind!=='marina')continue;
      else if(['suburb','town','industrial'].includes(mark.kind)){for(let px=x;px<x+w-6;px+=11)for(let py=y;py<y+h-4;py+=9)defer(px,py,()=>box(px,py,7,5,2,['#cbbd9d','#d9d3bb','#9fb8b1'][Math.abs(Math.round(px))%3]))}
      else if(mark.kind==='silos'){for(let px=x;px<x+w-5;px+=7)defer(px,y,()=>{box(px,y,5,8,8,'#d9d2b8');disc(px+2.5,y+4,2.5,'#eef0d8',8.1)})}
      else if(mark.kind==='fire-station')defer(x+w/2,y+h/2,()=>{
        box(x,y,w,h,2.8,'#d5d8c7','#b9c6b7','#9caf9f');rect(x+1,y+1,w-2,h-2,'#b1bfc0',2.85);
        for(let i=0;i<3;i++){const bx=x+1+i*(w-1)/3;poly([[bx,y+h,.2],[bx+2.5,y+h,.2],[bx+2.5,y+h,2.1],[bx,y+h,2.1]],'#91675e');vehicle(bx+1.2,y+h+1.5,Math.PI/2,'fire','#c58c65')}
      });
      else if(mark.kind==='fuel-compound')defer(x+w/2,y+h/2,()=>{
        rect(x,y,w,h,'#a6b4a4');line([[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]],'#7c9487',Math.max(.7,scale*.2));
        for(const cx of [x+w*.28,x+w*.72]){disc(cx,y+h*.45,w*.18,'#92aaa4');disc(cx,y+h*.45,w*.18,'#d9dfcc',2);line([[cx,y+h*.45,2],[cx+w*.16,y+h*.45,2]],'#a6b9ae',.7)}
        box(x+w*.6,y+h*.74,w*.3,h*.19,1.3,'#c7d1bf');
      });
      else if(mark.kind==='ndb'||mark.kind==='vor-dme')defer(x+w/2,y+h/2,()=>{
        const cx=x+w/2,cy=y+h/2;disc(cx,cy,w*.65,'#b6c69d');
        if(mark.kind==='vor-dme'){disc(cx,cy,w*.44,'#d9dfd3',.3);box(cx-.5,cy-.5,1,1,1.4,'#e8e8d9')}
        else{for(const dx of [-w*.25,w*.25])line([[cx+dx,cy],[cx+dx,cy,3]],'#b8c8be',Math.max(.8,scale*.2));line([[cx-w*.25,cy,3],[cx+w*.25,cy,3]],'#7a9692',.8)}
      });
      else if(mark.kind==='marina'){road([[x,y+h],[x+w,y+h]],3,'#d8d1ad');for(let px=x;px<x+w;px+=8)road([[px,y],[px,y+h]],1.5,'#d8d1ad')}
      else if(mark.kind==='rail'){line([[x,y],[x+w,y]],'#82968d',scale*1.4);for(let px=x;px<x+w;px+=4)line([[px,y-1],[px,y+1]],'#ced6bd',scale*.4)}
      else if(mark.individualHangar){
        const f=mark.forecourt;rect(f.x,f.y,f.w,f.h,'#b9c4b3');
        const doorY=mark.doorSide==='north'?y:y+h,leadEnd=mark.doorSide==='north'?f.y:f.y+f.h;
        line([[x+w/2,doorY],[x+w/2,leadEnd]],'#e0c66e',Math.max(.65,scale*.14));
        defer(x+w/2,y+h/2,()=>{
          const z=mark.height||6,door=Math.min(mark.doorWidth||12,w-4),left=x+(w-door)/2;
          box(x,y,w,h,z,'#bccbc5','#b8c9bf','#8fabaa');
          poly([[x-.3,y-.3,z],[x+w/2,y-.3,z+2],[x+w/2,y+h+.3,z+2],[x-.3,y+h+.3,z]],'#dce2d7');
          poly([[x+w/2,y-.3,z+2],[x+w+.3,y-.3,z],[x+w+.3,y+h+.3,z],[x+w/2,y+h+.3,z+2]],'#acbfb8');
          for(const dy of [3,h-3])line([[x+2,y+dy,z+.35],[x+w/2,y+dy,z+2]],'#a1b6ae',Math.max(.5,scale*.1));
          if(mark.doorSide!=='north'){
            poly([[left,doorY+.03,0],[left+door,doorY+.03,0],[left+door,doorY+.03,z-1],[left,doorY+.03,z-1]],'#47666b');
            for(let dx=0;dx<=door;dx+=door/4)line([[left+dx,doorY+.04,.1],[left+dx,doorY+.04,z-1]],'#9bb2ae',Math.max(.6,scale*.12));
          }
          groundText(mark.id,x+w/2,y+h/2,1.35,'#4b6968',0,z+2.05);
        });
      }
      else defer(x+w/2,y+h/2,()=>{box(x,y,w,h,4,'#d5dad1');rect(x+1,y+1,w-2,h-2,'#bac8bf',4.1);for(let px=x+2;px<x+w-6;px+=9)poly([[px,y+h,0],[px+7,y+h,0],[px+7,y+h,3],[px,y+h,3]],'#829e94')});
    }
  }
  function vehicle(x,y,heading,kind='car',colour='#e9d59a'){
    if(GROUND_EQUIPMENT[kind]){
      const p=project(x,y),extent=12*layout.metresToWorld*scale;
      if(p.x+extent<0||p.x-extent>width||p.y+extent<0||p.y-extent>height)return;
      drawGroundEquipment(ctx,{kind,x,y,heading,metresToWorld:layout.metresToWorld,project,colour});return;
    }
    const s=layout.metresToWorld,length=(kind==='fuel'?6:kind==='tug'?3.2:4.5)*s,w=(kind==='fuel'?2.3:1.9)*s,h=(kind==='fuel'?2.4:1.4)*s;
    const local=(u,v,z=0)=>[x+u*Math.cos(heading)-v*Math.sin(heading),y+u*Math.sin(heading)+v*Math.cos(heading),z];
    const p=[[-length/2,-w/2],[length/2,-w/2],[length/2,w/2],[-length/2,w/2]];
    poly(p.map(([u,v])=>local(u+.2,v+.2)),'#3457442a');
    poly([local(-length/2,w/2),local(length/2,w/2),local(length/2,w/2,h),local(-length/2,w/2,h)],'#a4b5a9');
    poly(p.map(([u,v])=>local(u,v,h)),colour);
    poly([[length*.14,-w*.4],[length*.35,-w*.4],[length*.35,w*.4],[length*.14,w*.4]].map(([u,v])=>local(u,v,h+.02)),'#658d9c');
    if(kind==='fuel')poly([[-length*.4,-w*.36],[length*.06,-w*.36],[length*.06,w*.36],[-length*.4,w*.36]].map(([u,v])=>local(u,v,h+.4*s)),'#f3eee0');
  }
  function roads(){
    if(layout.id==='sunshine-coast')drawYbsuTerminalGround({poly,line});
    for(const r of layout.roads||[])if(!r.domesticPrecinct&&!r.underground)road(r.points,r.width||4,'#97a99f','#d9dfbc');
    if(layout.domesticPrecinct)drawDomesticGround(layout,{poly,line,road,ctx,project,scale,vehicle});
    if(layout.explicitLandside){
      for(const p of layout.landmarks.filter(p=>p.kind==='parking')){
        const {x,y,w,h}=p;rect(x,y,w,h,'#adbaa7');
        const paint=(z=0)=>{for(let px=x+2;px<x+w-3;px+=4)for(let py=y+2;py<y+h-5;py+=9){line([[px,py,z],[px,py+5,z]],'#e3e7d1',.65);if(!z&&Math.round(px+py)%3)vehicle(px+1.6,py+2.5,Math.PI/2,'car',['#e8dfc5','#7d9fa7','#b78e78'][Math.abs(Math.round(px))%3])}};
        if(p.decks)defer(x+w/2,y+h/2,()=>{box(x,y,w,h,p.decks*1.4,'#cbd4be','#b7c7b6','#9fb6ac');paint(p.decks*1.4+.05)});else paint();
      }
      for(const rail of (layout.railways||[]).filter(r=>!r.underground&&!r.covered)){
        for(let i=1;i<rail.points.length;i++){
          const a=rail.points[i-1],b=rail.points[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/d,ny=(b[0]-a[0])/d;
          defer((a[0]+b[0])/2,(a[1]+b[1])/2,()=>{
            const railZ=rail.domesticPrecinct&&i>=6?.62:2.2;
            const strip=z=>[[a[0]+nx*1.2,a[1]+ny*1.2,z],[b[0]+nx*1.2,b[1]+ny*1.2,z],[b[0]-nx*1.2,b[1]-ny*1.2,z],[a[0]-nx*1.2,a[1]-ny*1.2,z]];
            poly(strip(0),'#36534720');
            for(let n=0;n<d;n+=12){const x=a[0]+(b[0]-a[0])*n/d,y=a[1]+(b[1]-a[1])*n/d;box(x-.2,y-.2,.4,.4,railZ,'#d4ddc8','#b9c9bc','#9eb8b0')}
            if(rail.domesticPrecinct&&i>=6){
              const q=[[a[0]+nx*.36,a[1]+ny*.36,railZ],[b[0]+nx*.36,b[1]+ny*.36,railZ],[b[0]-nx*.36,b[1]-ny*.36,railZ],[a[0]-nx*.36,a[1]-ny*.36,railZ]];
              poly(q,'#a1aea0');for(const side of [-.16,.16])line([[a[0]+nx*side,a[1]+ny*side,railZ+.04],[b[0]+nx*side,b[1]+ny*side,railZ+.04]],'#577773',Math.max(.6,scale*.045));
            }else{poly(strip(railZ),'#c6d0bd');line([[...a,railZ+.05],[...b,railZ+.05]],'#718f87',Math.max(.8,scale*.5));}
          });
        }
      }
      for(const station of (layout.stations||[]).filter(s=>!s.domesticPrecinct)){const {x,y,w,h}=station;defer(x+w/2,y,()=>{box(x,y-h/2,w,h,3.2,'#e4e4cf','#b9c9bc','#9eb8b0');rect(x+1,y-h/2+.6,w-2,h-1.2,'#91b4b4',3.25)})}
      return;
    }
    for(const t of layout.terminals||[]){const r=t.rect;rect(r.x,r.y-10,r.w,7,'#adbaa7');for(let x=r.x+1;x<r.x+r.w-2;x+=3){line([[x,r.y-9],[x,r.y-4]],'#e3e7d1',.65);if(Math.round(x)%3)vehicle(x+1,r.y-7,Math.PI/2,'car',['#e8dfc5','#7d9fa7','#b78e78'][Math.round(x)%3])}}
  }
  function runwayPaint(r,surface,active=true,paintStrip=true,paintMarkings=true){
    const [x,y]=r.start,w=r.end[0]-x,rw=r.sealedWidthM?r.width*r.sealedWidthM/r.realWidthM:r.width;
    if(paintStrip)rect(x-5,y-r.width/2-5,w+10,r.width+10,'#becb9e');
    if(r.sealedWidthM)rect(x,y-r.width/2,w,r.width,'#aaa897');
    rect(x,y-rw/2,w,rw,surfaces[clamp(surface-1,0,4)]);
    runwaySurfaces.push({id:r.id,polygon:[[x,y-rw/2],[x+w,y-rw/2],[x+w,y+rw/2],[x,y+rw/2]]});
    if(active)pavement.push([[x,y-rw/2],[x+w,y-rw/2],[x+w,y+rw/2],[x,y+rw/2]]);
    if(surface<3){for(let i=0;i<75;i++)rect(x+hash(i+422)*w,y-rw*.45+hash(i+666)*rw*.9,.45,.18,i%2?'#ddc79d66':'#81795b35')}
    else if(layout.id==='redcliffe')drawRedcliffeRunwayMarkings(r,{poly});
    else if(paintMarkings){
      line([[x+10,y],[x+w-10,y]],'#f8f4df',Math.max(.6,scale*rw*.025),[scale*2.5,scale*3.5]);
      for(const side of [-1,1])line([[x,y+side*(rw/2-.2)],[x+w,y+side*(rw/2-.2)]],'#f1efe0',Math.max(.5,scale*.13));
      const stripe=rw/12,complete=r.maxEnd!==undefined&&r.end[0]>=r.maxEnd-.01;
      const startMark=x+(complete?(r.displacedStartM||0)/r.realLengthM*w:0);
      const endMark=x+w-(complete?(r.displacedEndM||0)/r.realLengthM*w:0);
      for(let i=0;i<4;i++)for(const side of [-1,1]){rect(startMark+1,y+side*(rw*.14+i*stripe),4,stripe*.58,'#f4f2de');rect(endMark-5,y+side*(rw*.14+i*stripe),4,stripe*.58,'#f4f2de')}
      if(w>65)for(const px of [startMark+25,endMark-29])for(const side of [-1,1])rect(px,y+side*rw*.3,4,rw*.09,'#f3f1dc');
      groundText(r.designators[0],startMark+8,y,rw*.28,'#f9f6e6',-Math.PI/2);groundText(r.designators[1],endMark-8,y,rw*.28,'#f9f6e6',Math.PI/2);
      if(startMark>x){
        line([[startMark,y-rw/2],[startMark,y+rw/2]],'#fff8df',Math.max(1,scale*.5));
        for(let px=x+8;px<startMark-3;px+=9)line([[px-3,y-1],[px,y],[px-3,y+1]],'#fff8df',Math.max(.8,scale*.2));
      }
    }
    if(surface>=4)for(let px=x+2;px<x+w;px+=8)for(const sign of [-1,1])disc(px,y+sign*(rw/2+.5),.18,'#fff6ce');
    if(active){hit('building','runwaySurface',x,y-rw/2,w,rw,'Runway surface');hit('building','runwayLength',x+w-5,y-rw/2-2,10,rw+4,'Extend runway')}
  }
  function paintPreciseRunway(secondary,paintStrip=true){
        // A runway is a square-ended pavement polygon, never a round-capped
        // road stroke. Local coordinates keep physical width independent of yaw.
        const length=Math.hypot(secondary.end[0]-secondary.start[0],secondary.end[1]-secondary.start[1]);
        const ux=(secondary.end[0]-secondary.start[0])/length,uy=(secondary.end[1]-secondary.start[1])/length,w=secondary.width;
        const at=(along,across)=>[secondary.start[0]+ux*along-uy*across,secondary.start[1]+uy*along+ux*across];
        if(paintStrip)poly(secondary.protectedPolygon,'#becb9e');
        const pavementPolygon=runwayPolygon(secondary);poly(pavementPolygon,layout.routeModel==='queensland-gateway'?'#4c6268':surfaces[clamp(level('runwaySurface')-1,2,4)]);pavement.push(pavementPolygon);
        runwaySurfaces.push({id:secondary.id,polygon:pavementPolygon.map(p=>[...p])});
        for(const side of [-1,1])line([at(.2,side*(w/2-.15)),at(length-.2,side*(w/2-.15))],'#f1efe0',Math.max(.4,scale*.09));
        line([at(9,0),at(length-9,0)],'#f8f4df',Math.max(.4,scale*.09),[scale*2.5,scale*3.5]);
        for(const [i,d] of [0,length].entries()){
          const direction=i?-1:1;poly([at(d+direction*.3,-w*.46),at(d+direction*.8,-w*.46),at(d+direction*.8,w*.46),at(d+direction*.3,w*.46)],'#f5f2df');
          groundText(secondary.designators[i],...at(d+direction*5,0),w*.28,'#f9f6e6',Math.atan2(uy,ux)+(i?1:-1)*Math.PI/2);
        }
  }
  function airfield(){
    recordPavement=true;
    runwaySurfaces=[];
    if(layout.routeModel==='queensland-gateway'){
      drawGatewayAirfield(layout,airport,{poly,rect,line,road,disc,runwayPaint:paintPreciseRunway,groundText,hit,scale,zoom,pavement,taxiwayPavement});
      recordPavement=false;return;
    }
    if(layout.routeModel==='archerfield'){
      drawArcherfieldAirfield(layout,{ctx,project,poly,line,groundText,hit,scale,zoom,pavement,runwaySurfaces,taxiwayPavement});
      recordPavement=false;return;
    }
    if(layout.routeModel==='hamilton'){
      const surface=layout.referencePavement;
      for(const pad of layout.turningPads){poly(pad,surfaces[clamp(level('runwaySurface'),3,4)-1]);pavement.push(pad)}
      ctx.beginPath();for(const ring of surface.rings){ring.forEach((p,i)=>{const q=project(...p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.closePath()}
      ctx.fillStyle='#94a29a';ctx.fill('evenodd');pavement.push(...surface.triangles);
      for(const p of HAMILTON_MARKING_PAVEMENT){poly(p,'#94a29a');pavement.push(p)}
      taxiwayPavement=layout.taxiways.map(t=>({...t,points:t.points.map(p=>[...p])}));
      runwayPaint(operatingRunway(layout,airport||{}),clamp(level('runwaySurface'),3,4),true,false,false);
      // Imagery and chart pavement differ slightly at their edges. Clip the
      // paint layer to the actual game pavement, preserving all grass islands.
      ctx.save();ctx.beginPath();
      for(const ring of [...surface.triangles,...HAMILTON_MARKING_PAVEMENT,...layout.turningPads,...runwaySurfaces.map(r=>r.polygon)]){
        const area=ring.reduce((n,p,i)=>{const q=ring[(i+1)%ring.length];return n+p[0]*q[1]-q[0]*p[1]},0);
        const points=area<0?[...ring].reverse():ring;
        points.forEach((p,i)=>{const q=project(...p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.closePath();
      }
      ctx.clip();drawHamiltonMarkings(layout,{poly,groundText});ctx.restore();
      const a=taxiwayPavement.find(t=>t.id==='A').points[1];hit('building','taxiway',a[0]-2,a[1]-2,4,4,'Hamilton Island taxiways');
      badge('14 / 32 · 1,766 m',210,132,{small:true});recordPavement=false;return;
    }
    if(layout.routeModel==='ybsu'){
      const surface=layout.referencePavement;
      ctx.beginPath();for(const ring of surface.rings){ring.forEach((p,i)=>{const q=project(...p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.closePath()}
      ctx.fillStyle='#97aaa5';ctx.fill('evenodd');pavement.push(...surface.triangles);
      for(const shoulder of ybsuMarkingPavement(layout)){poly(shoulder,'#97aaa5');pavement.push(shoulder)}
      taxiwayPavement=layout.taxiways.map(t=>({...t,points:t.points.map(p=>[...p])}));
      runwayPaint(operatingRunway(layout,airport||{}),clamp(level('runwaySurface'),3,4),true,false,false);
      clipPavementPaint(()=>drawYbsuMarkings(layout,{poly,groundText}));
      const t=layout.taxiways.find(t=>t.id==='A'),p=t.points[Math.floor(t.points.length/2)];hit('building','taxiway',p[0]-3,p[1]-3,6,6,'YBSU taxiways');
      badge('13 / 31 · 2,800 m',280,132,{small:true});
      recordPavement=false;return;
    }
    const r=operatingRunway(layout,airport||{}),ry=r.start[1],end=r.end[0],sx=r.start[0],inY=layout.inboundLaneY,outY=layout.outboundLaneY;
    const redcliffe=layout.taxiwayNetwork==='redcliffe',namedPavement=layout.authoredTaxiways||redcliffe;
    const activeTaxiways=operatingTaxiways(layout,airport||{});
    const taxiColour=surfaces[clamp(level('taxiway')-1,0,4)],taxiWidth=([7,15,18,23,25,30][airport?.maxSize??0])*layout.metresToWorld;
    if(layout.preserveRunwayIntersections)rect(sx-5,ry-r.width/2-5,end-sx+10,r.width+10,'#becb9e');
    for(const closed of layout.closedPavements||[]){
      recordPavement=false;
      road(closed.points,closed.width,'#a9b2a0');
      const [a,b]=closed.points;
      for(const t of [.12,.4,.68,.9]){const x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;
        line([[x-2,y-2],[x+2,y+2]],'#eee6ba',Math.max(1,scale*.45));line([[x-2,y+2],[x+2,y-2]],'#eee6ba',Math.max(1,scale*.45));}
      recordPavement=true;
    }
    for(const secondary of layout.runways.filter(a=>a.role!=='primary')){
      if(secondary.precisePavement){
        if(layout.routeModel==='gold-coast')poly(secondary.protectedPolygon,'#becb9e');else paintPreciseRunway(secondary);
      }
      else if(secondary.start[1]===secondary.end[1])runwayPaint(secondary,secondary.surface==='grass'?1:3,false);
      else{
        road([secondary.start,secondary.end],secondary.width,secondary.surface==='grass'?'#92b381':'#84958c');
        const angle=Math.atan2(secondary.end[1]-secondary.start[1],secondary.end[0]-secondary.start[0]);
        if(!secondary.closureForGame&&secondary.surface!=='grass')line([secondary.start,secondary.end],'#f2f0dd',Math.max(.6,scale*.12),[scale*2,scale*2]);
        for(const [i,p] of [secondary.start,secondary.end].entries()){
          const direction=i?-1:1,along=d=>[p[0]+Math.cos(angle)*direction*d,p[1]+Math.sin(angle)*direction*d];
          if(secondary.sealedThresholdLength)road([p,along(secondary.sealedThresholdLength)],secondary.width,'#637980');
          groundText(secondary.designators[i],...along(4),secondary.width*.28,'#f8f5df',angle+(i?1:-1)*Math.PI/2);
          if(secondary.closureForGame){const q=along(12);line([[q[0]-2,q[1]-2],[q[0]+2,q[1]+2]],'#eee9bf',scale*.5);line([[q[0]-2,q[1]+2],[q[0]+2,q[1]-2]],'#eee9bf',scale*.5)}
        }
      }
    }
    if(layout.routeModel==='gold-coast'){
      const surface=layout.referencePavement;
      ctx.beginPath();for(const ring of surface.rings){ring.forEach((p,i)=>{const q=project(...p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.closePath()}
      ctx.fillStyle='#97aaa5';ctx.fill('evenodd');pavement.push(...surface.triangles);
      for(const polygon of layout.parkingSurfaces||[]){poly(polygon,'#97aaa5');pavement.push(polygon)}
      for(const polygon of GOLD_COAST_GA_MARKINGS.apronShoulders){poly(polygon,'#97aaa5');pavement.push(polygon)}
      taxiwayPavement=layout.taxiways.map(t=>({...t,points:t.points.map(p=>[...p])}));
      // Join the diagram's mouths to the published-width runway. These short
      // bridges do not pave any of the aircraft's animation trajectories.
      for(const t of taxiwayPavement){
        if(t.surface==='grass'){road(t.points,t.width,'#9fb58a');continue}
        const p=t.points;
        for(const [a,b] of [[p[0],p[1]],[p.at(-1),p.at(-2)]])if(Math.abs(a[1]-116)<.001){
          const d=Math.hypot(b[0]-a[0],b[1]-a[1]),length=Math.min(d,7);
          road([a,[a[0]+(b[0]-a[0])*length/d,a[1]+(b[1]-a[1])*length/d]],t.width,'#97aaa5');
        }
      }
      for(const secondary of layout.runways.filter(r=>r.precisePavement))paintPreciseRunway(secondary,false);
      runwayPaint(r,clamp(level('runwaySurface'),3,4),true,false);
      // Use the union of the actual drawn polygons, with consistent winding.
      // Clipping an even-odd set of overlapping rings would punch new holes at
      // runway mouths. Nonzero winding keeps every paved overlap connected.
      ctx.save();ctx.beginPath();
      for(const polygon of pavement){
        const area=polygon.reduce((sum,a,i)=>{const b=polygon[(i+1)%polygon.length];return sum+a[0]*b[1]-a[1]*b[0]},0);
        const points=area<0?[...polygon].reverse():polygon;
        points.forEach((p,i)=>{const q=project(...p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.closePath();
      }
      ctx.clip();
      for(const t of taxiwayPavement.filter(t=>t.surface!=='grass'&&!['G','G1'].includes(t.id))){
        // Runway centrelines remain white; taxi markings meet their edge.
        ctx.save();const rw=r.width/2;
        ctx.beginPath();const rings=[[[layout.bounds.minX,layout.bounds.minY],[layout.bounds.maxX,layout.bounds.minY],[layout.bounds.maxX,116-rw],[layout.bounds.minX,116-rw]],[[layout.bounds.minX,116+rw],[layout.bounds.maxX,116+rw],[layout.bounds.maxX,layout.bounds.maxY],[layout.bounds.minX,layout.bounds.maxY]]];
        for(const ring of rings){ring.forEach((p,i)=>{const q=project(...p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.closePath()}ctx.clip();
        line(t.points,'#e3cd7b',Math.max(.75,scale*.12));ctx.restore();
      }
      const named=new Map();for(const t of taxiwayPavement){if(['17-access','G1'].includes(t.id))continue;const d=t.points.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-t.points[i][0],p[1]-t.points[i][1]),0);if(d>(named.get(t.id)?.d??0))named.set(t.id,{t,d})}
      for(const t of taxiwayPavement.filter(t=>['H','B','A','F','D','K'].includes(t.id)&&t.points[0][1]===116)){
        const a=t.points[0],b=t.points[1],d=Math.hypot(b[0]-a[0],b[1]-a[1]);
        const x=a[0]+(b[0]-a[0])*.55,y=a[1]+(b[1]-a[1])*.55,nx=-(b[1]-a[1])/d*t.width/2,ny=(b[0]-a[0])/d*t.width/2;
        line([[x-nx,y-ny],[x+nx,y+ny]],'#fff0a4',Math.max(.7,scale*.2));
      }
      ctx.restore();
      if(zoom>=1.35)for(const {t} of named.values()){const a=t.points[0],b=t.points.at(-1);groundText(t.id,(a[0]+b[0])/2,(a[1]+b[1])/2+2,1.7,'#45645e')}
      const c=layout.taxiGraph.nodes.dC;hit('building','taxiway',c[0]-3,c[1]-3,6,6,'Gold Coast taxiways');
      badge('14 / 32 · 2,492 m',130,132,{small:true});
      recordPavement=false;return;
    }
    for(const a of layout.hangarPavements||[]){poly(a.polygon,a.surface==='concrete'?'#c8cbbb':'#a5b5ab');pavement.push(a.polygon)}
    for(const a of layout.aprons){poly(a.polygon,a.surfaceColour||'#b9c4b3');for(const hole of a.holes||[])poly(hole,layout.baseGround);pavement.push(a.polygon)}
    if(layout.domesticPrecinct)drawDomesticApron(layout,{poly,line,ctx,project,scale});
    for(const retired of layout.retiredRunways||[])poly(retired.polygon,'#899c92');
    for(const lane of layout.apronServiceLanes||[])poly(lane,'#d9dcc7');
    for(const surface of layout.referencePavements||[]){poly(surface.polygon,taxiColour);pavement.push(surface.polygon)}
    for(const taxiway of activeTaxiways.filter(t=>namedPavement||layout.compactTaxiways||t.scenic)){
      if(taxiway.followsRunwayDevelopment&&end<layout.runways.find(r=>r.id==='main').end[0]-.01&&taxiway.points.some(p=>Math.abs(p[1]-ry)<.01&&p[0]>end-3))continue;
      const points=taxiwayPath(taxiway),w=layout.compactTaxiways?taxiway.width:Math.min(layout.taxiwayRenderWidthCap??7,taxiway.width);
      // Traced Redcliffe aprons already contain these lanes. Route strokes
      // would overpaint their surface and protrude beyond their grass edges.
      if(!(redcliffe&&taxiway.id.startsWith('TWY ')))road(points,w,taxiway.surface==='grass'?'#a8b98a':taxiway.scenic?'#8c9e94':taxiColour,layout.authoredTaxiways||redcliffe?null:'#e1cd7e');
      taxiwayPavement.push({id:taxiway.id,points,width:w,surface:taxiway.surface});
    }
    // Preserve the traced apron edges and material joins over the D road cap.
    if(redcliffe){
      for(const a of layout.hangarPavements)poly(a.polygon,a.surface==='concrete'?'#c8cbbb':'#a5b5ab');
      for(const a of layout.aprons)poly(a.polygon,'#b9c4b3');
    }
    // The north access road passes beneath the cross-field taxiways.
    for(const r of layout.roads)for(const [x,y] of r.underpasses||[]){line([[x-4,y-r.width/2],[x+4,y-r.width/2]],'#d4dcc3',scale*.6);line([[x-4,y+r.width/2],[x+4,y+r.width/2]],'#d4dcc3',scale*.6)}
    const maxStand=Math.max(50,...layout.stands.map(s=>s.position[0]+16));
    if(!namedPavement&&!layout.compactTaxiways){
    road([[sx+6,inY],[Math.max(end-8,maxStand),inY]],taxiWidth,taxiColour,'#e5ce78');
    road([[sx+6,outY],[maxStand,outY]],taxiWidth,taxiColour,'#e5ce78');
    road(roundedPath([[sx+22,ry],[sx+6,ry],[sx+6,outY]],8),taxiWidth,taxiColour,'#e5ce78');
    road(roundedPath([[end-15,ry],[end-8,ry],[end-8,inY]],7),taxiWidth,taxiColour,'#e5ce78');
    for(const oldEnd of new Set(allAssignments().map(a=>a.plan?.runway.end[0]).filter(v=>Number.isFinite(v)&&Math.abs(v-end)>.01)))road(roundedPath([[oldEnd-15,ry],[oldEnd-8,ry],[oldEnd-8,inY]],7),taxiWidth,taxiColour,'#e5ce78');
    }
    const apronPlans=(layout.id==='brisbane'?layout.stands.slice(0,1):layout.stands).map(s=>createFlightPlan(layout,layout.id==='brisbane'?{...airport,routePreview:true}:airport||{},s));
    const pavedPhases=redcliffe?['exit','lineup']:layout.authoredTaxiways&&layout.routeModel!=='terminal-end'?(layout.arrivalBypass?['exit','inbound','lineup']:['exit','lineup']):['exit','inbound','pushback','outbound','lineup'];
    for(const plan of [...new Map([...apronPlans,...allAssignments().map(a=>a.plan)].map(p=>[JSON.stringify(pavedPhases.map(key=>p[key])),p])).values()])for(const key of pavedPhases){
      // Sunshine Coast's A2 turn needs a pavement flare for widebody main gear.
      const width=taxiWidth+(key==='exit'?(layout.routeModel==='terminal-end'?3:layout.arrivalBypass?1:0):0);
      road(plan[key],width,taxiColour);
    }
    if(layout.authoredTaxiways){
      // Local junction fillets support steering off-tracking. They are attached
      // to published connectors; a stand's animation never creates a new road.
      for(const t of apronConnectors(layout).filter(()=>layout.routeModel!=='terminal-end')){const x=t.points[0][0];if(layout.taxiRouting&&x===sx+6)continue;road(roundedPath([[x+8,inY],[x,inY],[x,outY],[x-8,outY]],7),taxiWidth+(layout.arrivalBypass?1:0),taxiColour)}
      if(layout.taxiRouting)road(roundedPath([[sx+14,inY],[sx+6,inY],[sx+6,outY],[sx+6,outY+4]],7),taxiWidth,taxiColour);
    }
    // A paved turning/holding bulb accommodates nosewheel off-tracking when
    // widebodies turn from the outbound lane toward the holding position.
    if(!redcliffe)road([[sx+6,outY+2],[sx+6,outY+2]],taxiWidth+6*(layout.standVisualScale||1),taxiColour);
    // Centrelines follow the same fillets as the aeroplane's nosewheel route.
    if(namedPavement){
      for(const t of taxiwayPavement.filter(t=>t.surface!=='grass'&&!redcliffe))line(t.points,'#e1cd7e',Math.max(.65,scale*.13));
      if(layout.taxiRouting)for(const plan of apronPlans)for(const key of ['exit','lineup'])line(plan[key],'#e5ce78',Math.max(.65,scale*.13));
      // Only apron lead-ins are clipped into apron pavement. Long straight named
      // centrelines stay visible instead of receiving twelve curved overprints.
      ctx.save();ctx.beginPath();
      for(const a of layout.aprons){a.polygon.forEach((p,i)=>{const q=project(...p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.closePath()}
      ctx.clip();
      for(const plan of layout.id==='brisbane'||redcliffe?[]:apronPlans)for(const key of ['inbound','pushback'])line(plan[key],'#e5ce78',Math.max(.65,scale*.13));
      ctx.restore();
    }else for(const plan of apronPlans)for(const key of ['exit','inbound','pushback','outbound','lineup'])line(plan[key],'#e5ce78',Math.max(.65,scale*.13));
    if(end<r.maxEnd-.5){rect(end,ry-r.width/2,r.maxEnd-end,r.width,'#a5bd8b');line([[end,ry-r.width/2],[r.maxEnd,ry-r.width/2],[r.maxEnd,ry+r.width/2],[end,ry+r.width/2]],'#ecedcd',1,[4,5]);for(let x=end+10;x<r.maxEnd;x+=20){line([[x-1,ry-1],[x+1,ry+1]],'#d3dfb4',1);line([[x-1,ry+1],[x+1,ry-1]],'#d3dfb4',1)}}
    if(layout.paintSealedRunwaysLast)for(const secondary of layout.runways.filter(a=>a.role!=='primary'&&a.surface!=='grass'))runwayPaint(secondary,3,false,false);
    runwayPaint(r,level('runwaySurface'),true,!layout.preserveRunwayIntersections);
    if(layout.id==='brisbane'){
      recordPavement=false;
      drawBrisbaneRetiredRunwayMarkings(layout,{poly,groundText,zoom});
      recordPavement=true;
    }
    if(redcliffe)clipPavementPaint(()=>drawRedcliffeTaxiwayMarkings(taxiwayPavement,{line,scale}));
    for(const surface of layout.referencePavements||[])if(surface.runupMark)line(surface.runupMark,'#e6c775',Math.max(.6,scale*.1));
    if(layout.compactTaxiways)for(const taxiway of layout.taxiways){
      if(!taxiway.labelPosition||!taxiwayPavement.some(t=>t.id===taxiway.id))continue;
      groundText(taxiway.id,...taxiway.labelPosition,3.2,'#f4d676');
      if(taxiway.id==='A'||taxiway.id==='C')for(const y of [96,96.7])line([[taxiway.points[0][0]-taxiWidth/2,y],[taxiway.points[0][0]+taxiWidth/2,y]],'#f6d478',Math.max(.7,scale*.18));
    }
    if(redcliffe)drawRedcliffeHold(layout.holdShortLine,taxiWidth,{line,scale});
    else for(let i=0;i<2;i++){const y=layout.holdShortLine[1]+i*.6,hx=sx+6;line([[hx-taxiWidth/2,y],[hx+taxiWidth/2,y]],'#f6d478',Math.max(.7,scale*.18));line([[hx-taxiWidth/2,y+1.4],[hx+taxiWidth/2,y+1.4]],'#f6d478',Math.max(.7,scale*.16),[scale*.5,scale*.5])}
    for(const t of layout.taxiways.filter(t=>taxiwayPavement.some(p=>p.id===t.id))){
      if(t.holdShortLine){const [x,y]=t.holdShortLine;for(const offset of [0,.6])line([[x-t.width/2,y+offset],[x+t.width/2,y+offset]],'#f6d478',Math.max(.7,scale*.18))}
      if(t.labelAt)groundText(t.id,...t.labelAt,1.8,'#f5df94');
    }
    if(!redcliffe&&level('taxiway')>=3)for(const y of [inY,outY]){const id=y===inY?(layout.taxiRouting?.inboundId??'B'):(layout.taxiRouting?.outboundId??'A');const laneEnd=layout.authoredTaxiways?layout.taxiways.find(t=>t.id===id).points.at(-1)[0]:maxStand;for(let x=sx+15;x<laneEnd;x+=13)disc(x,y+taxiWidth/2+.5,.17,'#83ccf0')}
    if(layout.routeModel==='terminal-end'){
      for(const id of ['A','B']){const t=layout.taxiways.find(t=>t.id===id),a=t.points[0],b=t.points.at(-1);hit('building','taxiway',a[0],a[1]-taxiWidth/2,b[0]-a[0],taxiWidth,'Taxiway '+id);}
    }else hit('building','taxiway',sx+20,inY-taxiWidth/2,Math.max(40,maxStand-sx-25),taxiWidth,'Taxiways');
    if(redcliffe){
      for(const t of activeTaxiways.filter(t=>['B','C','D'].includes(t.id))){
        const hx=t.points.at(-1)[0];
        if(t.id!=='D')drawRedcliffeHold([hx,99],taxiWidth,{line,scale});
      }
      // The old western label anchor sat beneath the runway-side hangars.
      if(zoom>=1.25){badge('TWY EAST',24,inY+8,{small:true});badge('TWY WEST',150,inY+1,{small:true})}
    }else if(zoom>=1.25){badge('ARRIVALS → APRON',maxStand*.65,inY+5,{small:true});badge('← DEPARTURES',maxStand*.6,outY+6,{small:true})}
    const displayedRunwayLength=layout.id==='brisbane'?Math.round((r.end[0]-r.start[0])/layout.metresToWorld):(airport?.runwayLength||600);
    badge(r.designators.join(' / ')+' · '+displayedRunwayLength.toLocaleString()+' m',Math.min(end/2,130),ry+r.width/2+11);
    recordPavement=false;
  }
  function stands(){
    if(layout.routeModel==='queensland-gateway')return drawGatewayStands(layout,airport,{line,groundText,hit,badge,box,defer,scale,zoom});
    if(layout.id==='brisbane'&&airport)return drawBrisbaneBays(layout,airport,{line,groundText,hit,scale,zoom,project});
    if(layout.referenceFacilities){
      // The reference scenery supplies the real bay markings; game plots only
      // provide interaction and must not add differently oriented concrete pads.
      for(const s of layout.stands){
        const plot=(airport?.gatePlots||[]).find(p=>p.id===s.plotId);if(!plot)continue;
        const gate=airport.gates.find(g=>g.plotId===plot.id),[x,y]=s.position;
        if(!gate)badge('+',x,y,{small:true});
        hit(gate?'gate':'plot',gate?.id??plot.id,x-2.3,y-2.3,4.6,4.6,gate?.label||'Build an aircraft stand');
      }
      return;
    }
    if(['ybsu','hamilton','gold-coast'].includes(layout.routeModel)){
      if(layout.id==='gold-coast')for(const s of layout.referenceParking.filter(s=>['1','2','30'].includes(s.group)))line(s.access.slice(1),'#ead58b',Math.max(.45,scale*.1));
      for(const s of layout.referenceParking.filter(s=>!['hamilton','ybsu'].includes(layout.routeModel)&&!(layout.id==='gold-coast'&&s.group==='G1'))){
        const [x,y]=s.pin,c=Math.cos(s.heading),n=Math.sin(s.heading),stop=d=>[x+c*d,y+n*d];
        line(s.leadIn||[stop(-6),stop(0)],'#ead58b',Math.max(.45,scale*.1));line([[x-n,y+c],[x+n,y-c]],'#faf0cb',Math.max(.6,scale*.15));
        groundText(s.referenceStand,x+n*2,y-c*2,1.5,'#496c67',s.heading+Math.PI/2);
      }
      if(layout.routeModel!=='ybsu')for(const s of layout.additionalParking||[]){const [x,y]=s.pin;disc(x,y,.22,'#ecdfaa');if(zoom>=1.5)groundText(s.id,x,y+1,1,'#496c67')}
      for(const s of layout.stands){
        const plot=(airport?.gatePlots||[]).find(p=>p.id===s.plotId);if(!plot)continue;
        const gate=airport.gates.find(g=>g.plotId===plot.id),[x,y]=s.pin;
        if(!gate&&layout.id!=='gold-coast')badge('+',x,y,{small:true});
        hit(gate?'gate':'plot',gate?.id??plot.id,x-2,y-2,4,4,gate?`${gate.label||'Stand'} · ${layout.routeModel==='hamilton'?'Hamilton':layout.routeModel==='gold-coast'?'Gold Coast':'YBSU'} bay ${s.referenceStand}`:`Build at ${layout.routeModel==='hamilton'?'Hamilton':layout.routeModel==='gold-coast'?'Gold Coast':'YBSU'} bay ${s.referenceStand}`);
      }
      return;
    }
    for(const s of layout.stands){
      const plot=(airport?.gatePlots||[]).find(p=>p.id===s.plotId);if(!plot)continue;
      const gate=airport.gates.find(g=>g.plotId===plot.id),[x,y]=s.position,size=gate?.size??airport.maxSize;
      const unit=layout.standVisualScale||1,half=Math.max(5,Math.min(10,5+size))*unit,depth=Math.max(12,10+size*2)*unit;
      rect(x-10*unit,y-12*unit,20*unit,26*unit,gate?'#b8c4b9':'#bad29c');
      if(gate){
        rect(x-half,y-depth/2,half*2,depth,size>=3?'#bbc8c5':'#c7cfb9');
        line([[x-half+.5,y+depth/2],[x-half+.5,y-depth/2],[x+half-.5,y-depth/2],[x+half-.5,y+depth/2]],'#ecdfad',Math.max(.6,scale*.12));
        line([[x,y+depth/2],[x,y-2]],'#e0c365',Math.max(.65,scale*.15));line([[x-1.3,y-2],[x+1.3,y-2]],'#f5dda0',Math.max(.8,scale*.2));
        groundText(s.referenceStand??String(s.index+1).padStart(2,'0'),x,y-9*unit,2*unit,'#6c887f');hit('gate',gate.id,x-10*unit,y-12*unit,20*unit,26*unit,gate.label||'Stand '+(s.index+1));
      }else{line([[x-9*unit,y-11*unit],[x+9*unit,y-11*unit],[x+9*unit,y+13*unit],[x-9*unit,y+13*unit],[x-9*unit,y-11*unit]],'#f5f3d5',1.4,[4,5]);badge('+',x,y,{background:'#f7ffe4df'});hit('plot',plot.id,x-10*unit,y-12*unit,20*unit,26*unit,'Build a new aircraft stand')}
    }
  }
  function aircraftParking(){
    if(layout.id==='gold-coast'){
      drawGoldCoastGaMarkings({line,poly,groundText,scale});
      for(const a of layout.observedGaAircraft||[]){const [x,y]=a.position;defer(x,y,()=>parkedAircraft(a.aircraftId,{x,y,heading:a.heading},'#eceadf'));}
    }

    if(layout.routeModel==='archerfield')return drawArcherfieldParking(layout,{line,disc,groundText,defer,parkedAircraft,scale});
    for(const bay of layout.aircraftParking||[]){
      const [x,y]=bay.position,r=bay.rect;
      line(bay.leadIn,'#ddc775',Math.max(.6,scale*.12));
      line([[r.x,r.y+r.h],[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h]],'#eee2af',Math.max(.6,scale*.12));
      line([[x-1,y-2],[x+1,y-2]],'#f5df97',Math.max(.6,scale*.15));
      groundText(bay.id,x,y+4.8,1.8,'#647c70');
      for(const dx of [-3,3])disc(x+dx,y,.23,'#d7deb9');
      defer(x,y,()=>{disc(x+.5,y+.7,2,'#3b574422');parkedAircraft(bay.aircraftId,{x,y,heading:bay.heading},'#6e9aa3')});
    }
    for(const pad of layout.helipads||[]){
      const [x,y]=pad.position;disc(x,y,pad.radius,'#9daea5');
      line(Array.from({length:49},(_,i)=>[x+Math.cos(i/48*TAU)*(pad.radius-1),y+Math.sin(i/48*TAU)*(pad.radius-1)]),'#efe7bf',Math.max(.7,scale*.2));
      groundText('H',x,y,7,'#f6f0da');
    }
  }
  function terminal(){
    for(const t of layout.terminals){
      const {x,y,w,h}=t.rect,l=level('terminal'),height=terminalArchitectureHeight(layout,t,t.height??Math.min(6,2+l*.7)*(t.heightScale||1));
      defer(x+w/2,y+h/2,()=>{
        if(drawGatewayTerminal(t,{box,rect,poly,line,groundText}))return;
        if(drawReferenceTerminal(layout,t,{poly,line,ctx,project}))return;
        if(t.kind==='island-terminal'&&t.polygon){drawHamiltonTerminalArchitecture(t,{poly,line,disc,ctx,project,scale});return}
        if(t.kind==='island-terminal'){drawHamiltonTerminal(t,{box,poly,line,groundText});return}
        if(t.polygon){shapedTerminal(t.polygon,height);return}
        box(x,y,w,h,height,'#f0ecda','#d0daca','#9eb8b0');
        for(let wx=x+1;wx<x+w-2;wx+=3)poly([[wx,y+h,1],[wx+2,y+h,1],[wx+2,y+h,height-.4],[wx,y+h,height-.4]],'#71999d');
        for(let rx=x+3;rx<x+w-5;rx+=9){rect(rx,y+2,6,Math.max(1,h-4),'#9eb9b9',height+.05);for(let k=1;k<4;k++)line([[rx+k*1.5,y+2,height+.07],[rx+k*1.5,y+h-2,height+.07]],'#bdd0c8',.45)}
        if(l>=3)box(x+w*.43,y+h*.25,w*.14,h*.5,height+1.5,'#d9e5df','#b9d0c7','#91ada5');
      });
      if(t.kind==='parking')continue;
      hit('building','terminal',x,y,w,h,t.name||'Passenger terminal',t.kind==='island-terminal'?(t.polygon?HAMILTON_TERMINAL_HEIGHT:6.2):height+(!t.polygon&&l>=3?1.5:0));
      hits.at(-1).surfaceId=t.id;
      if(layout.routeModel==='ybsu'){
        hits.at(-1).polygons=ybsuTerminalHitPolygons(t,project);
        hits.at(-1).points=hits.at(-1).polygons[0];
      }
      if(layout.id==='brisbane'&&t.polygon)hits.at(-1).polygons=[t.polygon.map(p=>project(...p,height)),...t.polygon.map((p,i)=>{const q=t.polygon[(i+1)%t.polygon.length];return [project(...p),project(...q),project(...q,height),project(...p,height)]})];
      if(t.kind==='island-terminal'&&t.polygon)hits.at(-1).points=convexHull([...t.polygon.map(p=>project(...p)),...t.polygon.map(p=>project(...p,HAMILTON_TERMINAL_HEIGHT))]);
    }
  }
  function precinctLabels(){
    for(const label of layout.labels||[]){
      if(label.detail&&zoom<1.5)continue;
      // Small ground lettering belongs to the miniature, leaving HUD weight intact.
      if(!label.terrain&&!label.detail&&zoom>=1.25)badge(label.text,label.x,label.y,{small:true});
      else groundText(label.text,label.x,label.y,label.terrain?6:label.detail?2.5:3,label.terrain?'#548c8e':'#4b706d',0,!label.terrain&&!label.detail?Math.min(6,2+level('terminal')*.7)+.1:0);
    }
  }
  function facilities(){
    if(layout.routeModel==='archerfield'){
      const f=layout.facilities.tower,x=f.x+f.w/2,y=f.y+f.h/2;defer(x,y,()=>{box(x-.4,y-.4,.8,.8,3.2,'#dce1cf');box(x-.8,y-.8,1.6,1.6,4,'#dce1cf','#86b1b1','#66969e')});
      for(const [key,r] of Object.entries(layout.facilities))hit('building',key,r.x,r.y,r.w,r.h,key==='tower'?'Control tower':key,1.5);return;
    }
    if(layout.routeModel==='hamilton'){
      const f=layout.facilities.tower;drawHamiltonTower({poly,line,defer,scale});
      hit('building','tower',f.x,f.y,f.w,f.h,'Hamilton Island control tower',HAMILTON_TOWER_TOP);
      hits.at(-1).points=convexHull([HAMILTON_TOWER_FLOOR,HAMILTON_TOWER_TOP].flatMap(z=>HAMILTON_TOWER_POLYGON.map(p=>project(...p,z))));return;
    }
    if(layout.routeModel==='ybsu'){
      const f=layout.facilities.tower;defer(f.x,f.y,()=>{shapedTerminal(f.polygon,2);const x=f.x+f.w/2,y=f.y+f.h/2;box(x-.45,y-.45,.9,.9,5,'#dce1cf');box(x-.9,y-.9,1.8,1.8,5.8,'#dce1cf','#86b1b1','#66969e')});
      hit('building','tower',f.x,f.y,f.w,f.h,'YBSU control tower',5.8);
      for(const key of ['handling','researchLab','cargo']){const r=layout.facilities[key];hit('building',key,r.x,r.y,r.w,r.h,{handling:'Game ground handling',researchLab:'Game research centre',cargo:'Game cargo operation'}[key],1.6);hits.at(-1).points=r.polygon.map(p=>project(...p,1.6))}
      return;
    }
    for(const key of ['handling','researchLab','cargo','tower']){
      const f=layout.facilities[key];if(!f)continue;const {x,y,w,h}=f,l=level(key),label={handling:'Ground equipment',researchLab:'Research centre',cargo:'Cargo terminal',tower:'Control tower'}[key];
      if(f.referenceOnly){if(!(layout.id==='redcliffe'&&key==='tower'))hit('building',key,x,y,w,h,label,2.5);continue}
      rect(x-1,y-1,w+2,h+2,'#bac7b3');hit('building',key,x,y,w,h,label,l?(key==='tower'?9+l:4+l*.25):0);
      if(!l){line([[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]],'#f5f1cf',1.3,[4,4]);badge('+',x+w/2,y+h/2);continue}
      defer(x+w/2,y+h/2,()=>{
        if(key==='tower'){
          const cx=x+w/2,cy=y+h/2,height=7+l;box(cx-1.4,cy-1.4,2.8,2.8,height,'#dce1cf','#d4dcc7','#a4bcae');box(cx-3,cy-3,6,6,height+2,'#e9e8d4','#86b1b1','#66969e');rect(cx-3.5,cy-3.5,7,7,'#e4e4cf',height+2.3);line([[cx,cy,height+2.3],[cx,cy,height+5]],'#789486',1);line([[cx-2,cy,height+4.4],[cx+2,cy,height+4.4]],'#789486',1.2);
        }else{
          const height=3+l*.25;box(x,y,w,h,height,key==='cargo'?'#d3c8ad':key==='researchLab'?'#e9e3d1':'#bdcdc4');
          if(key==='researchLab'){rect(x+1,y+1,w-2,h-2,'#8fb2b3',height+.05);disc(x+w*.65,y+h*.6,1.5,'#dceae0',height+1)}
          else{for(let i=1;i<w-3;i+=4)poly([[x+i,y+h,.2],[x+i+2.8,y+h,.2],[x+i+2.8,y+h,height-.6],[x+i,y+h,height-.6]],'#8baba1');for(let i=2;i<w-3;i+=5)rect(x+i,y+2,3,Math.max(1,h-4),'#98b1aa',height+.02)}
          if(key==='cargo')for(let i=0;i<3;i++)box(x+1+i*3,y+h+1,2.5,2,1.2,['#a4b6a2','#d8bd86','#95b4b4'][i]);
        }
      });
    }
  }
  let parkedPixels=0;
  function parkedAircraft(id,pose,colour){
    const m=AIRCRAFT_MODELS[id]||AIRCRAFT_MODELS.c172,s=layout.metresToWorld,key=[id,pose.heading,scale,dpr,s,colour,layout.cameraRotationDeg||0].join('|');
    const pad=4,extent=(m.length+m.wingspan)*s*scale/2,cssWidth=Math.ceil(extent*2+pad*2),cssHeight=Math.ceil(extent*.91+m.height*s*scale+pad*2);
    const originX=cssWidth/2,originY=cssHeight-extent*.455-pad,p=project(pose.x,pose.y);
    if(p.x-originX>width||p.x-originX+cssWidth<0||p.y-originY>height||p.y-originY+cssHeight<0)return;
    let sprite=parkedCache.get(key);
    if(!sprite){
      const image=document.createElement('canvas');image.width=Math.ceil(cssWidth*dpr);image.height=Math.ceil(cssHeight*dpr);const context=image.getContext('2d');context.scale(dpr,dpr);
      drawAircraft(context,{id,x:0,y:0,heading:pose.heading,altitude:0,metresToWorld:s,project:(x,y,z=0)=>({x:originX+(x*projXX+y*projXY)*scale,y:originY+(x*projYX+y*projYY)*scale-z*scale}),colour,time:0,reducedMotion:true});
      sprite={image,cssWidth,cssHeight,originX,originY,pixels:image.width*image.height};
      if(sprite.pixels<=8_000_000){
        parkedCache.set(key,sprite);parkedPixels+=sprite.pixels;
        while(parkedPixels>8_000_000||parkedCache.size>512){const oldest=parkedCache.keys().next().value;parkedPixels-=parkedCache.get(oldest).pixels;parkedCache.delete(oldest)}
      }
    }else{parkedCache.delete(key);parkedCache.set(key,sprite)}
    ctx.drawImage(sprite.image,p.x-sprite.originX,p.y-sprite.originY,sprite.cssWidth,sprite.cssHeight);
  }
  function drawTrafficFlight(pose,id,gate,colour,time){
    const model=AIRCRAFT_MODELS[id]||AIRCRAFT_MODELS.c172,s=layout.metresToWorld,length=model.length*s,span=model.wingspan*s;
    const shadow=[];for(let j=0;j<24;j++){const a=j/24*TAU,u=Math.cos(a)*length*.5,v=Math.sin(a)*span*.24;shadow.push([pose.x+u*Math.cos(pose.heading)-v*Math.sin(pose.heading)+pose.altitude*.3,pose.y+u*Math.sin(pose.heading)+v*Math.cos(pose.heading)+pose.altitude*.3])}poly(shadow,pose.altitude?'#2e56441d':'#2e56442c');
    defer(pose.x,pose.y+pose.altitude,()=>{if(pose.phase==='servicing'){parkedAircraft(id,pose,colour);return}ctx.save();ctx.globalAlpha=pose.opacity;drawAircraft(ctx,{id,x:pose.x,y:pose.y,heading:pose.heading,altitude:pose.altitude,metresToWorld:s,project,colour,time,reducedMotion:reduced,gearDown:pose.phase!=='climb'||(pose.operationPhase?pose.phaseProgress<.85:pose.timeInCycle<pose.period-3)});ctx.restore()});
    if(pose.reverse&&layout.routeModel!=='archerfield'&&level('handling')>=2){
      const kind=gate.size>=4&&level('handling')>=5?'heavyTug':'tug',distance=length/2+(GROUND_EQUIPMENT[kind].length/2+.8)*s;
      const x=pose.x+Math.cos(pose.heading)*distance,y=pose.y+Math.sin(pose.heading)*distance;
      towEquipment.push({kind,x,y,heading:pose.heading});
      defer(x,y,()=>vehicle(x,y,pose.heading,kind,'#dfa342'));
    }
  }
  function interactiveFlightHit(flight,pose,id){
    if(pose.opacity<.15)return;
    const model=AIRCRAFT_MODELS[id]||AIRCRAFT_MODELS.c172,s=layout.metresToWorld,c=Math.cos(pose.heading),sn=Math.sin(pose.heading);
    const points=[[-model.length*.5,-model.wingspan*.5],[model.length*.5,-model.wingspan*.5],[model.length*.5,model.wingspan*.5],[-model.length*.5,model.wingspan*.5]].map(([u,v])=>project(pose.x+(u*c-v*sn)*s,pose.y+(u*sn+v*c)*s,pose.altitude));
    const screen=project(pose.x,pose.y,pose.altitude),padding=13;
    // Small GA aircraft remain selectable when the whole airfield is in view.
    points.push({x:screen.x-padding,y:screen.y-padding},{x:screen.x+padding,y:screen.y-padding},{x:screen.x+padding,y:screen.y+padding},{x:screen.x-padding,y:screen.y+padding});
    hits.push({kind:'flight',id:flight.id,flightId:flight.id,gateId:flight.gateId,label:[flight.airline,model.name||flight.aircraft?.name,flight.destination].filter(Boolean).join(' · '),x:pose.x,y:pose.y,w:0,h:0,points:convexHull(points),screen});
  }
  function traffic(time){
    flights=[];towEquipment=[];if(!airport?.owned)return;
    const now=presentationTime?presentationTime():serverTime+performance.now()-lastViewTime,elapsed=now/1000;
    const interactive=airport.operations?.flights||[],occupiedGates=new Set(interactive.map(f=>f.gateId)),liveIds=new Set(interactive.map(f=>f.id));
    const occupiedPhysicalStands=new Set(interactive.map(f=>f.physicalStandId||`${airport.id}:${f.routePlan?.stand?.referenceStand??f.plotId}`));
    const controlledRunways=new Set(interactive.map(f=>f.routePlan?.runway?.id||f.runwayId||'main'));
    for(const id of interactiveAssignments.keys())if(!liveIds.has(id))interactiveAssignments.delete(id);
    const activeGates=['ybsu','hamilton','gold-coast','brisbane-bays'].includes(layout.routeModel)?airport.gates.filter(g=>g.status!=='waiting'&&g.aircraft&&(!['brisbane','gold-coast'].includes(layout.id)||g.active!==false)):airport.gates;
    for(const [i,gate] of activeGates.entries()){
      const stand=layout.stands.find(s=>s.plotId===gate.plotId);if(!stand||gate.status==='waiting'||!gate.aircraft||occupiedGates.has(gate.id))continue;
      const plane=gate.currentAircraft||gate.aircraft;
      const assignedModel=AIRCRAFT_MODELS[plane.id]||AIRCRAFT_MODELS.c172;
      const preview=layout.id==='brisbane'&&(reduced||airport.operations?.present===true||controlledRunways.has(stand.runwayId||layout.primaryRunwayId));
      let assignment=assignments.get(gate.id),plan=assignment?.plan,pose=plan?sampleFlight(plan,elapsed,i,reduced):null;
      if(!assignment||!!assignment.preview!==preview||(reduced||preview)&&assignment.id!==plane.id||assignment.cycle!==pose.cycle||layout.routeModel==='ybsu'&&assignment.plan.period!==activeGates.length*100||layout.routeModel==='gold-coast'&&assignment.plan.period!==activeGates.length*120){
        plan=createFlightPlan(layout,preview?{...airport,routePreview:true}:airport,stand,assignedModel);
        pose=sampleFlight(plan,elapsed,i,reduced);assignment={cycle:pose.cycle,id:plane.id||'c172',plan,preview};assignments.set(gate.id,assignment);
      }
      if(occupiedPhysicalStands.has(`${airport.id}:${plan.stand.referenceStand??gate.plotId}`))continue;
      // Decorative timer loops are parked while this runway is under the
      // player's control. Only server-cleared spotlight traffic may move on it.
      if(preview||controlledRunways.has(plan.runway.id))pose={...pose,x:plan.stand.position[0],y:plan.stand.position[1],heading:plan.stand.heading??-Math.PI/2,phase:'servicing',altitude:0,opacity:1,reverse:false,ambientHeld:controlledRunways.has(plan.runway.id)};
      if(pose.phase==='queued')continue;
      const id=assignment.id;
      flights.push({...pose,routePreview:assignment.preview,waitingForClearance:plan.routeAvailable===false,id:gate.id,gateId:gate.id,aircraftId:id,screen:project(pose.x,pose.y,pose.altitude)});
      drawTrafficFlight(pose,id,gate,['#3b9f9d','#e0a461','#698eb8','#9982b8'][i%4],time);
    }
    for(const [i,flight] of interactive.entries()){
      const gate=airport.gates.find(g=>g.id===flight.gateId),stand=layout.stands.find(s=>s.plotId===(flight.plotId||gate?.plotId));if(!gate||!stand)continue;
      let assignment=interactiveAssignments.get(flight.id);
      if(!assignment){const id=flight.aircraftId||flight.aircraft?.id||'c172';assignment={id,plan:flight.routePlan||createFlightPlan(layout,airport,stand,AIRCRAFT_MODELS[id]||AIRCRAFT_MODELS.c172)};interactiveAssignments.set(flight.id,assignment)}
      const {id,plan}=assignment,pose=sampleInteractiveFlight(plan,flight,now,reduced);
      flights.push({...pose,id:flight.id,flightId:flight.id,gateId:flight.gateId,plotId:flight.plotId||gate.plotId,aircraftId:id,runwayId:flight.runwayId||plan.runway.id,waitingForClearance:!!flight.blockedReason,paused:!!flight.pausedAt,serviceProgress:flight.serviceProgress,screen:project(pose.x,pose.y,pose.altitude)});
      drawTrafficFlight(pose,id,gate,['#279e98','#d69d4d','#667ec4'][i%3],time);
      interactiveFlightHit(flight,pose,id);
    }
    if(layout.id==='brisbane')for(const j of visibleBrisbaneJetways(layout.jetways,new Set(flights.map(f=>airport.gates.find(g=>g.id===f.gateId)?.plotId)))){
      const stand=layout.stands.find(s=>s.plotId===j.plotId),gate=airport.gates.find(g=>g.plotId===j.plotId),flight=flights.find(f=>f.gateId===gate?.id);
      drawBrisbaneJetway(jetwayGeometry(j,stand,flight,layout.metresToWorld),{poly,line,disc,defer,scale});
    }
    const nextRoutes=[...new Set(allAssignments().map(a=>`${a.plan.runway.id}:${a.plan.runway.end}`))].sort().join('|');if(nextRoutes!==routeSignature){routeSignature=nextRoutes;staticDirty=true}
  }
  function groundSupport(time){
    // Moving aircraft retain priority over decorative staging at every phase.
    const occupied=flights.filter(f=>f.altitude<1).map(f=>aircraftEquipmentExclusion(f,AIRCRAFT_MODELS[f.aircraftId]||AIRCRAFT_MODELS.c172,layout.metresToWorld,.8*layout.metresToWorld));
    occupied.push(...towEquipment.map(e=>equipmentFootprint(e,layout.metresToWorld,.6*layout.metresToWorld)));
    const dt=lastShuttleTime===null?0:(time-lastShuttleTime)/1000;lastShuttleTime=time;
    visibleEquipment=equipment.map(e=>{
      if(!e.shuttleRoute)return e;
      const gate=airport.gates.find(g=>g.plotId===e.standPlotId),flight=flights.find(f=>f.gateId===gate?.id);
      const serviceAvailable=flight?.phase==='servicing'&&gate?.operationType!=='cargo'&&!AIRCRAFT_MODELS[flight.aircraftId]?.cargo;
      const clear=p=>!occupied.some(o=>equipmentOverlaps(equipmentFootprint(p,layout.metresToWorld,.6*layout.metresToWorld),o));
      const pose=advancePassengerShuttle(shuttleState,e.shuttleRoute,reduced?0:dt,serviceAvailable,clear,layout.metresToWorld);
      return {...pose,apronId:e.apronId,footprint:equipmentFootprint(pose,layout.metresToWorld,.6*layout.metresToWorld)};
    }).filter(e=>!occupied.some(p=>equipmentOverlaps(e.footprint,p)));
    for(const e of visibleEquipment)defer(e.x,e.y,()=>vehicle(e.x,e.y,e.heading,e.kind,e.kind==='bus'?'#319aa7':'#dfa342'));
  }
  function incident(time){
    incidentSnapshot=null;
    const event=airport?.operations?.incident;if(!event)return;
    const gate=airport.gates.find(g=>g.id===event.gateId),stand=layout.stands.find(s=>s.plotId===(event.plotId||gate?.plotId));if(!stand)return;
    const plane=flights.find(f=>f.gateId===gate?.id),assignment=interactiveAssignments.get(plane?.flightId)||assignments.get(gate?.id);
    const position=assignment?.plan.stand.position||stand.position,s=layout.metresToWorld;
    const model=AIRCRAFT_MODELS[plane?.aircraftId]||AIRCRAFT_MODELS.c172,clearance=Math.max(4,model.wingspan*.55*s);
    const onPavement=p=>pavement.some(ring=>inside({x:p[0],y:p[1]},ring.map(v=>({x:v[0],y:v[1]}))))&&!(layout.aprons||[]).some(a=>(a.holes||[]).some(h=>inside({x:p[0],y:p[1]},h.map(v=>({x:v[0],y:v[1]})))));
    const aircraftExclusions=flights.filter(f=>f.altitude<1).map(f=>aircraftEquipmentExclusion(f,AIRCRAFT_MODELS[f.aircraftId]||AIRCRAFT_MODELS.c172,s,.8*s));
    const clear=p=>!aircraftExclusions.some(ring=>inside({x:p[0],y:p[1]},ring.map(v=>({x:v[0],y:v[1]}))));
    // Emergency equipment stays beside the stand on existing pavement. The
    // response has no decorative trip across active runways or other aircraft.
    const candidates=Array.from({length:24},(_,i)=>{const a=i/24*TAU;return [position[0]+Math.cos(a)*(clearance+3*s),position[1]+Math.sin(a)*(clearance+3*s)]});
    const support=equipment.filter(e=>e.standPlotId===stand.plotId).map(e=>[e.x,e.y]);
    const site=[...candidates,...support].find(p=>onPavement(p)&&clear(p))||position;
    const [x,y]=site,isFire=event.type==='fire'||event.type==='apron-fire'||event.type==='equipment-fire';
    const heading=stand.heading??-Math.PI/2,kind=isFire?'fire':['fuel','fuel-shortage'].includes(event.type)?'fuel':'baggage';
    const responseSite=[...support,...candidates].find(p=>{
      if(!onPavement(p)||!clear(p)||Math.hypot(p[0]-x,p[1]-y)<4*s)return false;
      const c=Math.cos(heading),sn=Math.sin(heading),footprint=kind==='fire'?[[-2.5,-1.2],[2.5,-1.2],[2.5,1.2],[-2.5,1.2]].map(([u,v])=>[p[0]+(u*c-v*sn)*s,p[1]+(u*sn+v*c)*s]):equipmentFootprint({kind,x:p[0],y:p[1],heading},s,.25*s);
      return footprint.every(onPavement)&&!layout.runways.some(r=>equipmentOverlaps(footprint,r.protectedPolygon))&&!aircraftExclusions.some(ring=>equipmentOverlaps(footprint,ring));
    });
    const now=presentationTime?presentationTime():serverTime+performance.now()-lastViewTime;
    const resolves=Number(event.resolvesAt),responseStart=Number(event.respondedAt||event.responseStartedAt||event.startedAt);
    const progress=event.responding&&resolves>responseStart?clamp((now-responseStart)/(resolves-responseStart),0,1):null;
    incidentSnapshot={...event,position:[...position],site:[...site],responseSite:responseSite?[...responseSite]:null,progress,reducedMotion:reduced};
    defer(x,y,()=>{
      disc(x,y,Math.max(1,3*s),isFire?'#d1694544':'#e4aa4455');
      if(isFire){
        if(reduced){badge('FIRE',x,y,{colour:'#a63d26',background:'#fff0dc'});}
        else{
          for(let i=0;i<3;i++){
            const drift=Math.sin(time/450+i)*.25,base=project(x+(i-1)*1.2*s,y,0),top=project(x+(i-1)*1.2*s+drift,y,(3.5+Math.sin(time/220+i)*.7)*s);
            ctx.save();ctx.fillStyle=i===1?'#f3c35b':'#e77940';ctx.beginPath();ctx.moveTo(base.x-2.1*s*scale,base.y);ctx.quadraticCurveTo(top.x-2*s*scale,top.y,top.x,top.y-1.2*s*scale);ctx.quadraticCurveTo(top.x+2*s*scale,top.y,base.x+2.1*s*scale,base.y);ctx.fill();ctx.restore();
            const smoke=project(x+(i-1)*1.2*s+drift,y,(6+i*2)*s);ctx.save();ctx.fillStyle='#67777b80';ctx.beginPath();ctx.ellipse(smoke.x,smoke.y,(2+i*.4)*s*scale,(1.4+i*.3)*s*scale,0,0,TAU);ctx.fill();ctx.restore();
          }
        }
      }
      if(event.responding){
        if(responseSite){
          const [vehicleX,vehicleY]=responseSite;vehicle(vehicleX,vehicleY,heading,kind,isFire?'#c35d4c':'#dfa342');
          if(isFire)line([[vehicleX,vehicleY],[x,y]],'#b6d4e2',Math.max(1,scale*.25));
        }
        badge(`Responding${progress===null?'':` · ${Math.round(progress*100)}%`}`,x,y-5*s,{colour:'#496b71',background:'#e5f5ffed',small:true});
      }else badge(isFire?'Dispatch fire crew':event.title||'Service interrupted',x,y-5*s,{colour:'#9c4b2e',background:'#fff1d9ed',small:true});
    });
    const p=project(x,y),extent=Math.max(14,5*s*scale);
    hits.push({kind:'incident',id:event.id,label:event.title||'Airport incident',x,y,w:0,h:0,points:[{x:p.x-extent,y:p.y-extent},{x:p.x+extent,y:p.y-extent},{x:p.x+extent,y:p.y+extent},{x:p.x-extent,y:p.y+extent}]});
  }
  function construction(time){
    for(const task of airport?.constructions||[]){
      const target=hits.find(h=>h.id===(task.building||task.buildingKey||task.targetId))||hits.find(h=>h.id===task.plotId)||hits.find(h=>h.id===task.gateId);if(!target)continue;
      const {x,y,w,h}=target;line([[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]],'#efc46f',2,[5,4]);
      if(layout.id==='brisbane'&&task.kind==='gate'){badge('Preparing bay',x+w/2,y+h/2,{small:true});continue;}
      const cx=x+w*.75,cy=y+h*.5;line([[cx,cy],[cx,cy,10]],'#c19f5c',Math.max(1,scale*.3));line([[cx-5,cy,10],[cx+5,cy,10]],'#e7c775',Math.max(1,scale*.3));line([[cx+3,cy,10],[cx+3,cy,reduced?4:4+Math.sin(time/1100)]],'#8f957a',.8);
    }
  }
  function highlight(){const choice=hover||selected,surface=hover?.surfaceId||(!hover&&selectedSurfaceId);const target=hits.find(h=>h.kind===choice?.kind&&h.id===choice?.id&&(!surface||h.surfaceId===surface));if(!target)return;polygon(target.polygons?.[0]||target.points,'#fff9d333',target.kind==='flight'?'#fff6a0':'#fffde4',target.kind==='flight'?3:2.2);if(hover){if(target.screen){const p=target.screen;ctx.save();ctx.font='700 11px Inter';const label=target.label.slice(0,80),w=ctx.measureText(label).width+16;ctx.fillStyle='#f8fff0f0';ctx.beginPath();ctx.roundRect(clamp(p.x-w/2,8,width-w-8),p.y-36,w,22,6);ctx.fill();ctx.fillStyle='#345e61';ctx.textAlign='center';ctx.fillText(label,clamp(p.x,w/2+8,width-w/2-8),p.y-21);ctx.restore()}else badge(target.label,target.x+target.w/2,target.y-3)}}
  function compass(){
    const [nx,ny]=layout.northVector,p=project(nx*12,ny*12),zero=project(0,0),dx=p.x-zero.x,dy=p.y-zero.y,n=Math.hypot(dx,dy)||1;
    ctx.save();ctx.translate(width-53,height-185);ctx.fillStyle='#fffdf4d9';ctx.beginPath();ctx.arc(0,0,24,0,TAU);ctx.fill();ctx.strokeStyle='#739384';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-dx/n*12,-dy/n*12);ctx.lineTo(dx/n*13,dy/n*13);ctx.stroke();polygon([{x:dx/n*15,y:dy/n*15},{x:-dy/n*4,y:dx/n*4},{x:dy/n*4,y:-dx/n*4}],'#3a8079');ctx.font='800 9px Inter';ctx.textAlign='center';ctx.fillStyle='#4a766e';ctx.fillText('N',dx/n*18,dy/n*18-4);ctx.restore();
  }
  function draw(time){
    if(disposed)return;frame=requestAnimationFrame(draw);const modal=document.querySelector('#airportDialog'),dashboard=document.querySelector('#airportDashboard');if(document.hidden||(modal&&!modal.hidden)||(dashboard&&!dashboard.hidden)||time-lastPaint<(reduced?180:30))return;lastPaint=time;
    const started=performance.now();
    if(staticDirty){
      ctx=staticContext;ctx.setTransform(dpr,0,0,dpr,0,0);hits=[];objects=[];pavement=[];taxiwayPavement=[];
      terrain(time);roads();airfield();stands();scenery();terminal();facilities();aircraftParking();
      staticHits=[...hits];
      staticObjects=layout.depthSortedTraffic?[...objects]:[];
      if(!layout.depthSortedTraffic)objects.sort((a,b)=>a.depth-b.depth).forEach(object=>object.draw());precinctLabels();
      ctx=foregroundContext;staticDirty=false;
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.drawImage(staticCanvas,0,0,width,height);objects=[...staticObjects];hits=[...staticHits];
    traffic(time);groundSupport(time);incident(time);objects.sort((a,b)=>a.depth-b.depth).forEach(object=>object.draw());construction(time);highlight();compass();
    renderedFrames++;lastFrameMs=performance.now()-started;totalRenderMs+=lastFrameMs;
  }
  function updateCamera(){
    const angle=(layout.cameraRotationDeg||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
    projXX=c-s;projXY=-s-c;projYX=(c+s)*.455;projYY=(c-s)*.455;
    const b=layout.bounds,corners=[[b.minX,b.minY],[b.maxX,b.minY],[b.maxX,b.maxY],[b.minX,b.maxY]],xs=corners.map(p=>p[0]*projXX+p[1]*projXY),ys=corners.map(p=>p[0]*projYX+p[1]*projYY);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    scale=Math.min((width-80)/(maxX-minX),(height-275)/(maxY-minY))*zoom;
    panX=clamp(panX,-width*zoom*.65,width*zoom*.65);panY=clamp(panY,-height*zoom*.65,height*zoom*.65);
    offsetX=width*.5-(minX+maxX)/2*scale+panX;offsetY=height*.54-(minY+maxY)/2*scale+panY;
    const label=document.querySelector('#cameraZoom');if(label)label.textContent=Math.round(zoom*100)+'%';onCameraChange({zoom,panX,panY});lastPaint=0;staticDirty=true;
  }
  function zoomBy(factor){zoom=clamp(zoom*factor,.8,['granite-plains','brisbane','archerfield','hamilton-island','sunshine-coast','gold-coast'].includes(layout.id)?12:4);updateCamera()}
  function panBy(dx,dy){panX+=dx;panY+=dy;updateCamera()}
  function resetCamera(){zoom=1;panX=0;panY=0;updateCamera()}
  function focusWorld(target,factor=zoom){zoom=clamp(factor,.8,12);panX=0;panY=0;updateCamera();const p=project(...target);panBy(width/2-p.x,height/2-p.y)}
  const pick=e=>{const r=canvas.getBoundingClientRect();return [...hits].reverse().find(h=>(h.polygons||[h.points]).some(p=>inside({x:e.clientX-r.left,y:e.clientY-r.top},p)))};
  const pointerdown=e=>{if(e.button!==0)return;canvas.focus({preventScroll:true});drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId)};
  const pointermove=e=>{if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>4)drag.moved=true;if(drag.moved)panBy(dx,dy);drag.x=e.clientX;drag.y=e.clientY;canvas.style.cursor='grabbing';return}hover=pick(e)||null;canvas.style.cursor=hover?'pointer':'grab'};
  const pointerup=e=>{if(drag&&!drag.moved){const h=pick(e);if(h){selectedSurfaceId=h.surfaceId||null;selected={kind:h.kind,id:h.id};onSelect(selected)}}drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);canvas.style.cursor='grab'};
  const pointerleave=()=>{hover=null},pointercancel=()=>{drag=null;hover=null};
  const wheel=e=>{e.preventDefault();zoomBy(e.deltaY<0?1.1:1/1.1)};
  const keydown=e=>{if(e.key==='+'||e.key==='='){e.preventDefault();zoomBy(1.25)}else if(e.key==='-'){e.preventDefault();zoomBy(.8)}else if(e.key==='0'||e.key==='Home'){e.preventDefault();resetCamera()}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const step=e.shiftKey?100:40;panBy(e.key==='ArrowLeft'?step:e.key==='ArrowRight'?-step:0,e.key==='ArrowUp'?step:e.key==='ArrowDown'?-step:0)}};
  const controls=e=>{const button=e.target.closest('[data-camera]');if(!button)return;const action=button.dataset.camera;if(action==='zoom-in')zoomBy(1.25);else if(action==='zoom-out')zoomBy(.8);else if(action==='reset')resetCamera()};
  for(const [name,listener] of Object.entries({pointerdown,pointermove,pointerup,pointerleave,pointercancel,wheel,keydown}))canvas.addEventListener(name,listener,name==='wheel'?{passive:false}:undefined);
  document.addEventListener('click',controls);
  function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;dpr=Math.min(devicePixelRatio||1,2,Math.sqrt(6_000_000/Math.max(1,width*height)));canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);staticCanvas.width=canvas.width;staticCanvas.height=canvas.height;updateCamera()}
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();frame=requestAnimationFrame(draw);
  return {
    setView(next,view){const changed=next?.id!==airport?.id;airport=next;serverTime=view?.serverNow||Date.now();lastViewTime=performance.now();layout=getAirportLayout(next?.id||'redcliffe');if(changed){assignments.clear();interactiveAssignments.clear();incidentSnapshot=null;routeSignature='';resetCamera();const info=document.querySelector('#sceneLocation');if(info){info.textContent=layout.setting;const caption=info.nextElementSibling;if(caption)caption.textContent=layout.id==='granite-plains'?'FICTIONAL QUEENSLAND MEGA HUB · SIX ACTIVE RUNWAYS':layout.id==='hamilton-island'?'SCENERY © OPENSTREETMAP · TERRAIN © GEOSCIENCE AUSTRALIA':layout.id==='archerfield'?'CHART-ALIGNED GEOGRAPHY · GAME STAND ALLOCATIONS':layout.id==='gold-coast'?'CHART-SCALED AIRPORT · PUBLISHED PARKING POSITIONS':'SCHEMATIC REDEVELOPMENT · RUNWAY LENGTHS COMPRESSED'}}const signature=JSON.stringify([next?.id,next?.owned,next?.runwayLength,next?.buildings?.map(b=>[b.key,b.level]),next?.gates?.map(g=>[g.id,g.plotId,g.size,g.active,g.operationType,!!AIRCRAFT_MODELS[(g.currentAircraft||g.aircraft)?.id]?.cargo]),next?.gatePlots?.map(p=>[p.id,p.occupied])]);if(signature!==worldSignature){worldSignature=signature;equipment=groundEquipmentPlacements(layout,airport);shuttleState={};lastShuttleTime=null;staticDirty=true;if(['brisbane','granite-plains'].includes(layout.id))assignments.clear()}lastPaint=0},
    setSelected(value){if(!value||value.kind!==selected?.kind||value.id!==selected?.id)selectedSurfaceId=null;selected=value;lastPaint=0},resize,zoomBy,panBy,resetCamera,focusWorld,
    getSceneSnapshot(){return {layoutId:layout.id,projection:{offsetX,offsetY},pavementRegions:pavement.map(p=>({polygon:p,holes:layout.aprons.find(a=>a.polygon===p)?.holes||[]})),camera:{zoom,panX,panY},hits:hits.map(h=>({...h})),flights:flights.map(f=>({...f})),incident:incidentSnapshot?{...incidentSnapshot}:null,groundEquipment:visibleEquipment.map(e=>({...e})),pavement:pavement.map(p=>p.map(v=>[...v])),runways:runwaySurfaces.map(r=>({...r,polygon:r.polygon.map(p=>[...p])})),taxiways:taxiwayPavement.map(t=>({...t,points:t.points.map(p=>[...p])})),bounds:{...layout.bounds},scale,stats:{renderedFrames,lastFrameMs,totalRenderMs}}},
    dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();motionQuery.removeEventListener('change',motionChange);for(const [name,listener] of Object.entries({pointerdown,pointermove,pointerup,pointerleave,pointercancel,wheel,keydown}))canvas.removeEventListener(name,listener);document.removeEventListener('click',controls)}
  };
}
