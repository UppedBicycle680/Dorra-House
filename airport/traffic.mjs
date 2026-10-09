import {createGoldCoastPlan,sampleGoldCoastFlight} from './gold-coast-traffic.mjs';
import {createGatewayPlan} from './queensland-gateway-traffic.mjs';
import {createHamiltonPlan,sampleHamiltonFlight} from './hamilton-traffic.mjs';
import {createBrisbanePlan} from './brisbane-traffic.mjs';
import {createArcherfieldPlan,sampleArcherfieldFlight} from './archerfield-traffic.mjs';
// Presentation routes only. This module never calculates or changes game rewards.
// All coordinates share the airport's ground plane; heading 0 is +X, PI/2 is +Y.
import {createYbsuPlan,sampleYbsuFlight} from './ybsu-traffic.mjs';
const mix=(a,b,t)=>a+(b-a)*t;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);

export function roundedPath(points,radius=6){
  const result=[points[0]];
  for(let i=1;i<points.length-1;i++){
    const a=points[i-1],b=points[i],c=points[i+1],ab=distance(a,b),bc=distance(b,c);
    if(ab<.001||bc<.001)continue;
    const requested=Array.isArray(radius)?radius[i]??0:radius;
    if(requested<=0){result.push(b);continue}
    const r=Math.min(requested,ab*.45,bc*.45);
    const entry=[mix(b[0],a[0],r/ab),mix(b[1],a[1],r/ab)];
    const leave=[mix(b[0],c[0],r/bc),mix(b[1],c[1],r/bc)];
    result.push(entry);
    for(let j=1;j<=12;j++){const t=j/12,s=1-t;result.push([s*s*entry[0]+2*s*t*b[0]+t*t*leave[0],s*s*entry[1]+2*s*t*b[1]+t*t*leave[1]])}
  }
  result.push(points.at(-1));
  return result;
}

// Authored pavement has explicit corner treatment. Aircraft steering curves
// remain separate and never silently turn a surveyed straight into a dogleg.
export function taxiwayPath(taxiway){
  return taxiway.cornerRadius===0?taxiway.points.map(p=>[...p]):roundedPath(taxiway.points,taxiway.cornerRadius??3);
}

export function apronConnectors(layout){
  return layout.taxiways.filter(t=>layout.taxiRouting
    ?layout.taxiRouting.connectorIds.includes(t.id):/^B\d+$/.test(t.id));
}

export function samplePath(points,progress){
  const lengths=points.slice(1).map((p,i)=>distance(points[i],p));
  let remainder=clamp(progress,0,1)*lengths.reduce((sum,n)=>sum+n,0);
  for(let i=0;i<lengths.length;i++){
    if(remainder<=lengths[i]||i===lengths.length-1){const a=points[i],b=points[i+1],t=lengths[i]?clamp(remainder/lengths[i],0,1):0;return {x:mix(a[0],b[0],t),y:mix(a[1],b[1],t),heading:Math.atan2(b[1]-a[1],b[0]-a[0])}}
    remainder-=lengths[i];
  }
  return {x:points[0][0],y:points[0][1],heading:0};
}

export function operatingRunway(layout,airport){
  const source=layout.runways.find(r=>r.role==='primary')||layout.runways[0];
  const start=source.start[0],maxEnd=source.end[0];
  if(layout.fixedReferenceRunway)return {...source,maxEnd};
  const ratio=clamp((airport.runwayLength||600)/(airport.maxRunwayLength||source.gameMaxLengthM||source.realLengthM||600),.1,1);
  return {...source,start:[start,source.start[1]],end:[start+(maxEnd-start)*ratio,source.start[1]],maxEnd};
}

// Keep the visible arrival connector and its routes at the same development
// stage. The full-length Redcliffe runway has a partial parallel, not an end loop.
export function operatingTaxiways(layout,airport){
  if(layout.taxiwayNetwork!=='redcliffe')return layout.taxiways;
  const exitX=Math.min(layout.arrivalExitX??225,operatingRunway(layout,airport).end[0]-8);
  if(exitX===layout.arrivalExitX)return layout.taxiways;
  const a=layout.taxiways.find(t=>t.id==='A'),start=a.points[0],end=a.points.at(-1);
  const y=start[1]+(exitX-start[0])/(end[0]-start[0])*(end[1]-start[1]);
  return layout.taxiways.map(t=>t.id==='A'?{...t,points:[start,[exitX,y]]}
    :t.id==='B'?{...t,points:[[exitX,y],[exitX,116]]}:t);
}

export function createFlightPlan(layout,airport,stand,model={id:'a321',length:44.51,wingspan:35.8}){
  if(layout.routeModel==='queensland-gateway')return createGatewayPlan(layout,airport,stand,roundedPath);
  const runway=operatingRunway(layout,airport),ry=runway.start[1],sx=runway.start[0],end=runway.end[0];
  if(layout.routeModel==='archerfield')return createArcherfieldPlan(layout,runway,stand,roundedPath);
  if(layout.routeModel==='hamilton')return createHamiltonPlan(layout,airport,runway,stand,model,roundedPath);
  if(layout.routeModel==='gold-coast')return createGoldCoastPlan(layout,airport,runway,stand,model,roundedPath);
  if(layout.routeModel==='brisbane-bays')return createBrisbanePlan(layout,airport,stand,model,runway,roundedPath);
  if(layout.routeModel==='ybsu')return {...createYbsuPlan(layout,runway,stand,model,roundedPath),period:Math.max(1,airport.gates?.filter(g=>g.status!=='waiting'&&g.aircraft).length??8)*100};
  if(layout.taxiwayNetwork==='redcliffe'){
    const [gx,gy]=stand.position,jx=layout.apronJunctionX,inY=layout.inboundLaneY,outY=layout.outboundLaneY;
    const exitTaxiway=operatingTaxiways(layout,airport).find(t=>t.id==='B'),exitX=exitTaxiway.points.at(-1)[0];
    const a=layout.taxiways.find(t=>t.id==='A').points,aY=x=>a[0][1]+(x-a[0][0])/(a.at(-1)[0]-a[0][0])*(a.at(-1)[1]-a[0][1]);
    const radius=7*layout.metresToWorld,push=14*layout.metresToWorld;
    const merge=[exitTaxiway.points[0][0]-6,aY(exitTaxiway.points[0][0]-6)],touchdown=[sx+24,ry],pushX=gx+(gx<jx?-push:push);
    return {
      runway,stand,period:Math.max(120,layout.stands.length*40),hold:layout.holdShort,
      approach:[[sx-80,ry],touchdown],landing:[touchdown,[exitX-7,ry]],
      exit:roundedPath([[exitX-7,ry],...exitTaxiway.points.toReversed(),merge],radius),
      inbound:roundedPath([merge,[jx,aY(jx)],[jx,inY],[gx,inY],[gx,gy]],radius),
      pushback:roundedPath([[gx,gy],[gx,inY],[pushX,inY]],radius),
      outbound:roundedPath([[pushX,inY],[jx,inY],layout.holdShort],radius),
      lineup:roundedPath([layout.holdShort,[jx,ry],[jx+11,ry]],8*layout.metresToWorld),
      takeoff:[[jx+11,ry],[end-10,ry]],climb:[[end-10,ry],[end+95,ry]],
      departureConnectorId:'D',arrivalConnectorId:'B'
    };
  }
  const inbound=layout.inboundLaneY??58,outbound=layout.outboundLaneY??82;
  if(layout.routeModel==='terminal-end'){
    const [gx,gy]=stand.position,exitX=Math.min(end-8,layout.runwayExitX),joinX=layout.apronEntryX;
    const hold=layout.holdShort,pushX=gx-14,merge=[exitX-7,outbound];
    const displacement=end>=runway.maxEnd-.01?(runway.displacedStartM||0)/runway.realLengthM*(end-sx):0;
    const touchdown=[sx+Math.max(24,displacement+12),ry];
    return {
      runway,stand,period:Math.max(120,layout.stands.length*40),hold,
      approach:[[sx-80,ry],touchdown],landing:[touchdown,[exitX-7,ry]],
      exit:roundedPath([[exitX-7,ry],[exitX,ry],[exitX,outbound],merge],7),
      inbound:roundedPath([merge,[joinX,outbound],[joinX,inbound],[gx,inbound],[gx,gy]],7),
      pushback:roundedPath([[gx,gy],[gx,outbound],[pushX,outbound]],8),
      outbound:roundedPath([[pushX,outbound],[hold[0],outbound],hold],7),
      departureConnectorId:'F',arrivalConnectorId:exitX===layout.runwayExitX?'A2':'temporary-exit',
      lineup:roundedPath([hold,[sx+6,ry],[sx+22,ry]],8),
      takeoff:[[sx+22,ry],[end-10,ry]],climb:[[end-10,ry],[end+95,ry]]
    };
  }
  const [gx,gy]=stand.position,bypass=layout.arrivalBypass;
  let exitX=Math.min(end-8,layout.arrivalExitX??Infinity);
  // Keep development-stage exits outside the reference emergency-services
  // precinct. Arrival traffic follows its authored landside bypass.
  if(bypass&&exitX>bypass.westX-14&&exitX<bypass.eastX+14)exitX=bypass.westX-14;
  const dir=gx>=exitX?1:-1;
  const merge=[exitX+dir*Math.min(7,Math.abs(gx-exitX)*.5),inbound],touchdown=[sx+Math.min(24,(end-sx)*.35),ry];
  // Each layout defines clearance in its own aircraft/pavement scale.
  const hold=layout.holdShort||[sx+6,ry-30];
  // Stands south of runway 01R push in the opposite direction before taxiing
  // north to its entry. Preserve heading continuity when reversing ends.
  const pushX=stand.pushbackX??(gx+(gx+14>hold[0]?14:-14));
  const pushLane=layout.authoredTaxiways?inbound:outbound;
  const departureConnector=layout.authoredTaxiways?apronConnectors(layout).filter(t=>t.points[0][0]<=pushX-7)
    .sort((a,b)=>b.points[0][0]-a.points[0][0])[0]:null;
  const connectorX=gx<hold[0]?hold[0]:departureConnector?.points[0][0]??hold[0];
  const departureNodes=layout.authoredTaxiways?[[pushX,inbound],[connectorX,inbound],[connectorX,outbound],[hold[0],outbound],hold]:[[pushX,outbound],[hold[0],outbound],hold];
  return {
    runway,stand,period:Math.max(120,(layout.stands?.length||airport.gates?.length||1)*40),
    approach:[[sx-80,ry],touchdown],
    landing:[touchdown,[exitX-7,ry]],
    exit:roundedPath([[exitX-7,ry],[exitX,ry],[exitX,inbound],merge],7),
    inbound:roundedPath([merge,...(stand.approachVia??[]),...(bypass&&merge[0]<bypass.westX&&gx>bypass.eastX
      ?[[bypass.westX,inbound],[bypass.westX,bypass.y],[bypass.eastX,bypass.y],[bypass.eastX,inbound]]:[]),...(stand.approachVia?[]:[[gx,inbound]]),[gx,gy]],7),
    pushback:roundedPath([[gx,gy],...(stand.pushbackVia??[[gx,pushLane]]),[pushX,pushLane]],8),
    outbound:roundedPath(departureNodes,7),
    departureConnectorId:layout.authoredTaxiways?(gx<hold[0]?(layout.taxiRouting?null:'B9'):departureConnector?.id??(layout.taxiRouting?null:'B9')):null,
    hold,
    lineup:roundedPath([hold,[sx+6,ry],[sx+22,ry]],8),
    takeoff:[[sx+22,ry],[end-10,ry]],
    climb:[[end-10,ry],[end+95,ry]]
  };
}

// Forty-second arrival slots contain a separate departure slot. Aircraft finish
// pushback/taxi-out before the previous slot's arrival joins the apron taxilane.
// Long gate service occupies the remaining interval; there is one plane per gate.
export function sampleFlight(plan,elapsedSeconds,index=0,reducedMotion=false){
  if(plan.routeModel==='queensland-gateway')index=plan.slotIndex;
  if(plan.routeModel==='gold-coast')return sampleGoldCoastFlight(plan,elapsedSeconds,index,reducedMotion,samplePath);
  if(plan.routeModel==='archerfield')return sampleArcherfieldFlight(plan,elapsedSeconds,index,reducedMotion,samplePath);
  if(plan.routeModel==='hamilton')return sampleHamiltonFlight(plan,elapsedSeconds,index,reducedMotion,samplePath);
  if(plan.routeModel==='ybsu')return sampleYbsuFlight(plan,elapsedSeconds,index,reducedMotion,samplePath);
  if(plan.routeModel==='brisbane-bays'&&!plan.routeAvailable)reducedMotion=true;
  const period=plan.period,t=reducedMotion?40:((elapsedSeconds+index*40)%period+period)%period;
  let phase,pose,altitude=0,reverse=false;
  const at=(name,start,end)=>samplePath(plan[name],(t-start)/(end-start));
  if(t<8){phase='approach';pose=at('approach',0,8);altitude=14*(1-t/8)}
  else if(t<14){phase='landing';pose=at('landing',8,14)}
  else if(t<20){phase='runway-exit';pose=at('exit',14,20)}
  else if(t<32){phase='taxi-in';pose=at('inbound',20,32)}
  else if(t<period-36){phase='servicing';pose={x:plan.stand.position[0],y:plan.stand.position[1],heading:plan.stand.heading??-Math.PI/2}}
  else if(t<period-30){phase='pushback';pose=at('pushback',period-36,period-30);pose.heading+=Math.PI;reverse=true}
  else if(t<period-22){phase='taxi-out';pose=at('outbound',period-30,period-22)}
  else if(t<period-20){phase='holding';pose={x:plan.hold[0],y:plan.hold[1],heading:plan.holdHeading??Math.PI/2}}
  else if(t<period-16){phase='line-up';pose=at('lineup',period-20,period-16)}
  else if(t<period-6){phase='takeoff';pose=at('takeoff',period-16,period-6)}
  else{phase='climb';pose=at('climb',period-6,period);altitude=(t-(period-6))/6*18}
  const opacity=phase==='approach'?clamp(t/1.3,0,1):phase==='climb'?clamp((period-t)/1.8,0,1):1;
  return {...pose,altitude,phase,reverse,opacity,cycle:Math.floor((elapsedSeconds+index*40)/period),timeInCycle:t,period};
}

// Interactive traffic follows the engine's current phase, never the decorative
// repeating clock. A late poll holds the last confirmed endpoint until the
// engine supplies the next phase, and an incident freezes only that flight.
export function sampleInteractiveFlight(plan,flight,now,reducedMotion=false){
  const started=Number(flight.phaseStartedAt)||0,ends=Number(flight.phaseEndsAt)||started;
  const clock=Number.isFinite(flight.pausedAt)?Math.min(now,flight.pausedAt):now;
  const progress=ends>started?clamp((clock-started)/(ends-started),0,1):0;
  const base={operationPhase:flight.phase,phaseProgress:progress,altitude:0,opacity:1,reverse:false};
  const stand={x:plan.stand.position[0],y:plan.stand.position[1],heading:plan.stand.heading??-Math.PI/2};
  const at=(key,t)=>samplePath(plan[key],t);
  if(flight.phase==='awaiting-landing')return {...base,...at('approach',0),altitude:14,phase:'awaiting-landing'};
  if(flight.phase==='servicing')return {...base,...stand,phase:'servicing'};
  if(flight.phase==='awaiting-takeoff')return {...base,...at('outbound',1),phase:'holding'};
  const kind=plan.routeModel;
  const arrival=kind==='gold-coast'?[8,10,12,15]:kind==='archerfield'?[8,10,10,12]
    :['hamilton','ybsu'].includes(kind)?[8,10,7,15]:[8,6,6,12];
  const taxi=kind==='gold-coast'?[10,24]:kind==='hamilton'?[8,14]
    :['archerfield','ybsu'].includes(kind)?[8,18]:[6,8];
  const departure=kind==='gold-coast'?[7,8,4]:kind==='hamilton'?[8,5,5]
    :['archerfield','ybsu'].includes(kind)?[4,7,5]:[4,10,6];
  let names,weights,labels;
  if(flight.phase==='arriving'){names=['approach','landing','exit','inbound'];weights=arrival;labels=['approach','landing','runway-exit','taxi-in']}
  else if(flight.phase==='taxiing-out'){names=['pushback','outbound'];weights=taxi;labels=['pushback','taxi-out']}
  else if(flight.phase==='departing'){names=['lineup','takeoff','climb'];weights=departure;labels=['line-up','takeoff','climb']}
  else return {...base,...stand,phase:'servicing'};
  // Reduced motion uses a static, meaningful location for each confirmed phase.
  if(reducedMotion){
    if(flight.phase==='arriving')return {...base,...stand,phase:'taxi-in'};
    if(flight.phase==='taxiing-out')return {...base,...at('outbound',1),phase:'taxi-out'};
    return {...base,...at('takeoff',1),phase:'takeoff'};
  }
  const total=weights.reduce((sum,n)=>sum+n,0),elapsed=progress*total;
  let offset=0,index=0;
  while(index<weights.length-1&&elapsed>=offset+weights[index]){offset+=weights[index];index++}
  const local=clamp((elapsed-offset)/weights[index],0,1),phase=labels[index],pose=at(names[index],local);
  if(phase==='pushback'){pose.heading+=Math.PI;base.reverse=true}
  if(phase==='approach')base.altitude=14*(1-local);
  if(phase==='climb'){base.altitude=18*local;base.opacity=clamp((1-local)*4,0,1)}
  // Match the authored stand heading at the end of taxi-in, including bays whose
  // parking orientation differs from their final steering tangent.
  if(flight.phase==='arriving'&&progress===1)pose.heading=stand.heading;
  return {...base,...pose,phase};
}
