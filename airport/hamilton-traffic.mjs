import {hamiltonPoint as p} from './hamilton-reference.mjs';
// One movement at a time on the real, compact apron. Additional economy plots
// share suitable airline positions instead of fabricating another jet apron.
export function createHamiltonPlan(layout,airport,runway,logicalStand,model,roundedPath){
  const physical=model.wingspan*layout.metresToWorld>logicalStand.maxAircraftSpan||model.length*layout.metresToWorld>logicalStand.maxAircraftLength?layout.stands[0]:logicalStand;
  const stand={...physical,plotId:logicalStand.plotId},i=physical.index;
  const backDistance=physical.referenceStand==='6'?Math.max(2,model.length*layout.metresToWorld*.55):7;
  const back=[stand.position[0]-Math.cos(stand.heading)*backDistance,stand.position[1]-Math.sin(stand.heading)*backDistance];
  const connector=['1','1A','2'].includes(physical.referenceStand)?'A':'B';
  const join=p(connector==='D'?[164,246]:connector==='B'?[185,242]:[140,184]);join[1]=116;
  const access=connector==='D'?[[148.1,259.3],[146.8,268],[149,278],[162,294]]:
    connector==='A'?[[155,174],[161,170]]:
    i===5?[[203,230],[214,236]]:[[203,230],[216,228],[226,217],...(i===4?[]:[[215,199],...(i===3?[]:[[205,185]])])];
  const inbound=roundedPath([join,...access.map(p),back,stand.position],2.1);
  const exit=inbound.slice(0,14),taxiIn=inbound.slice(13);
  const pushback=[stand.position,back];
  const depart=roundedPath([back,...access.map(p).reverse(),join],2.1);
  let split=depart.length-2;for(let n=1;n<depart.length;n++)if(Math.abs(depart[n][1]-116)<12){split=Math.max(1,n-1);break}
  const outbound=depart.slice(0,split+1),lineup=roundedPath([...depart.slice(split),[20,116],[8,113],[3,116],[10,116]],1.5);
  return {routeModel:'hamilton',runway,stand,logicalStand,aircraftId:model.id,period:Math.max(1,airport.gates?.filter(g=>g.status!=='waiting'&&g.aircraft).length??7)*100,
    hold:outbound.at(-1),arrivalConnectorId:connector,departureConnectorId:connector,
    approach:[[535,116],[360,116]],landing:[[360,116],[join[0]+8,116]],
    exit:roundedPath([[join[0]+8,116],...exit],2.1),inbound:taxiIn,pushback,outbound,lineup,
    takeoff:[[10,116],[400,116]],climb:[[400,116],[535,116]]};
}
export function sampleHamiltonFlight(plan,elapsed,index,reduced,samplePath){
  const clock=((elapsed%plan.period)+plan.period)%plan.period,slot=Math.floor(clock/100),t=reduced?45:clock%100;
  const base={cycle:Math.floor(elapsed/plan.period),timeInCycle:t,period:plan.period};
  if(index!== (reduced?0:slot))return {...base,x:-300,y:116,heading:0,altitude:30,opacity:0,phase:'queued',reverse:false};
  let phase,pose,altitude=0,reverse=false;
  const at=(name,start,end)=>samplePath(plan[name],(t-start)/(end-start));
  if(t<8){phase='approach';pose=at('approach',0,8);altitude=14*(1-t/8)}
  else if(t<18){phase='landing';pose=at('landing',8,18)}
  else if(t<25){phase='runway-exit';pose=at('exit',18,25)}
  else if(t<40){phase='taxi-in';pose=at('inbound',25,40)}
  else if(t<60){phase='servicing';pose={x:plan.stand.position[0],y:plan.stand.position[1],heading:plan.stand.heading}}
  else if(t<68){phase='pushback';pose=at('pushback',60,68);pose.heading+=Math.PI;reverse=true}
  else if(t<82){phase='taxi-out';pose=at('outbound',68,82)}
  else if(t<84){phase='holding';pose=samplePath(plan.outbound,1)}
  else if(t<92){phase='line-up';pose=at('lineup',84,92)}
  else if(t<97){phase='takeoff';pose=at('takeoff',92,97)}
  else{phase='climb';pose=at('climb',97,100);altitude=(t-97)/3*18}
  return {...base,...pose,phase,altitude,reverse,opacity:1,physicalStand:plan.stand.referenceStand};
}
