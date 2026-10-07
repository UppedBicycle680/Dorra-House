// Presentation uses one complete ground movement at a time on the real shared
// network. No arrival corridor or animation-derived pavement is introduced.
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function createGoldCoastPlan(layout,airport,runway,logicalStand,model,roundedPath){
  const n=layout.taxiGraph.nodes,edge=(from,to)=>{
    const e=layout.taxiGraph.edges.find(e=>e.from===from&&e.to===to||e.from===to&&e.to===from);
    if(!e)throw new Error(`Gold Coast disconnected route: ${from} / ${to}`);
    return e.from===from?e.points:[...e.points].reverse();
  };
  const physical=logicalStand;
  const position=physical.pin.map((v,i)=>v-[Math.cos(physical.heading),Math.sin(physical.heading)][i]*model.length*.34*layout.metresToWorld);
  const stand={...physical,position,plotId:logicalStand.plotId};
  const ga=physical.group==='G1',merge=physical.leadIn[0],fromD=ga?physical.access.slice(1):physical.access;
  const exitStart=[n.dR[0]-8,116];
  const arrival=roundedPath([exitStart,n.dR,...(ga?[]:[n.dC]),...fromD,position],4);
  // Split in the middle of a straight segment, preserving both position and
  // tangent at the animation boundary instead of slicing through a turn.
  const splitNode=ga?n.dC:n.dE;
  let cut=1;for(let i=1;i<arrival.length-1;i++)if(distance(arrival[i],splitNode)<distance(arrival[cut],splitNode))cut=i;
  const middle=arrival[cut].map((v,i)=>(v+arrival[cut+1][i])/2);
  const exit=[...arrival.slice(0,cut+1),middle],inbound=[middle,...arrival.slice(cut+1)];
  const before=fromD.at(-2),dist=distance(before,merge),v=merge.map((n,i)=>(n-before[i])/dist);
  const tug=merge.map((n,i)=>n+v[i]*2);
  const pushback=roundedPath([position,merge,tug],Math.min(2,distance(position,merge)*.2));
  const pathToD=[tug,merge,...fromD.toReversed().slice(1)];
  const fullOutbound=roundedPath([...pathToD,...(ga?[]:edge('dE','dC').slice(1)),...edge('dC','lC').slice(1),...edge('lC','kC').slice(1),...edge('kC','c32').slice(1),[runway.end[0]-18,116]],4);
  // Hold on the actual end-loop path before the runway edge.
  let split=fullOutbound.length-2;
  while(split>1&&fullOutbound[split][1]>98)split--;
  const outbound=fullOutbound.slice(0,split+1),lineup=fullOutbound.slice(split);
  const count=Math.max(1,airport.gates?.filter(g=>g.status!=='waiting'&&g.aircraft).length??9);
  return {routeModel:'gold-coast',runway,stand,logicalStand,period:count*120,slotDuration:120,slotCount:count,hold:outbound.at(-1),
    supported:model.wingspan<=physical.maxSpan+.01&&model.length<=physical.maxLength+.01,arrivalConnectorId:'D',departureConnectorId:'C',arrivalEdges:ga?['D','C','G','G1']:['D','E'],departureEdges:ga?['G1','G','C']:['E','D','C'],
    approach:[[-80,116],[35,116]],landing:[[35,116],exitStart],exit,inbound,
    pushback,outbound,lineup,takeoff:[[runway.end[0]-18,116],[18,116]],climb:[[18,116],[-95,116]]};
}
export function sampleGoldCoastFlight(plan,elapsed,index,reduced,samplePath){
  const clock=((elapsed%plan.period)+plan.period)%plan.period,slot=Math.floor(clock/120),t=reduced?55:clock%120;
  if(index%plan.slotCount!==slot)return {x:-300,y:116,heading:0,altitude:30,opacity:0,phase:'queued',reverse:false,cycle:Math.floor(elapsed/plan.period),timeInCycle:t,period:plan.period};
  const at=(key,a,b)=>samplePath(plan[key],(t-a)/(b-a));
  let phase,pose,altitude=0,reverse=false;
  if(t<8){phase='approach';pose=at('approach',0,8);altitude=14*(1-t/8)}
  else if(t<18){phase='landing';pose=at('landing',8,18)}
  else if(t<30){phase='runway-exit';pose=at('exit',18,30)}
  else if(t<45){phase='taxi-in';pose=at('inbound',30,45)}
  else if(t<65){phase='servicing';pose={x:plan.stand.position[0],y:plan.stand.position[1],heading:plan.stand.heading}}
  else if(t<75){phase='pushback';pose=at('pushback',65,75);pose.heading+=Math.PI;reverse=true}
  else if(t<99){phase='taxi-out';pose=at('outbound',75,99)}
  else if(t<101){phase='holding';pose=samplePath(plan.outbound,1)}
  else if(t<108){phase='line-up';pose=at('lineup',101,108)}
  else if(t<116){phase='takeoff';pose=at('takeoff',108,116)}
  else{phase='climb';pose=at('climb',116,120);altitude=(t-116)*4.5}
  return {...pose,altitude,phase,reverse,opacity:phase==='approach'?Math.min(1,t/1.3):phase==='climb'?Math.min(1,(120-t)/1.3):1,
    cycle:Math.floor(elapsed/plan.period),timeInCycle:t,period:plan.period};
}
