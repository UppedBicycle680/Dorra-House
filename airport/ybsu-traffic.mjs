// The economy keeps eight logical gate IDs. The physical airport has a single
// shared widebody bay, so the presentation schedules one complete movement at
// a time. This avoids inventing a parallel departure lane or enlarging bays.
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const length=p=>p.slice(1).reduce((n,b,i)=>n+dist(p[i],b),0);
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const subtract=(a,b)=>a.map((v,i)=>v-b[i]);
function cleanPath(points){
  const result=points.filter((p,i)=>!i||dist(p,points[i-1])>.001).map(p=>[...p]);
  // PDF tracing can leave tiny overshoots at shared junctions. They must not
  // become a 180-degree aircraft heading change on a sub-metre segment.
  for(let changed=true;changed;){changed=false;for(let i=1;i<result.length-1;i++){
    const a=result[i-1],p=result[i],b=result[i+1],v=subtract(b,a),d=v[0]**2+v[1]**2;
    const t=Math.max(0,Math.min(1,((p[0]-a[0])*v[0]+(p[1]-a[1])*v[1])/(d||1)));
    if(dist(p,a.map((q,k)=>q+v[k]*t))<.1||dist(p,b)<.35&&t===1){result.splice(i,1);changed=true;break}
  }}return result;
}
function splitBefore(points,target,clearance){
  let travelled=0,best={distance:Infinity,along:0};
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],v=subtract(b,a),d=dist(a,b),t=Math.max(0,Math.min(1,((target[0]-a[0])*v[0]+(target[1]-a[1])*v[1])/(d*d||1)));
    const q=a.map((n,k)=>n+v[k]*t),error=dist(q,target);if(error<best.distance)best={distance:error,along:travelled+d*t};travelled+=d;
  }
  let remaining=Math.max(0,best.along-clearance);
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],d=dist(a,b);if(remaining<=d){const q=a.map((n,k)=>n+(b[k]-n)*remaining/d);return [[...points.slice(0,i),q],[q,...points.slice(i)]]}remaining-=d}
  throw new Error('YBSU hold position outside route');
}
const allowed=new Set(['A','A1','A2','B','B1','B2','B3','F']);

export function ybsuGraphRoute(graph,from,to,extra=[]){
  const edges=[...graph.edges.filter(e=>allowed.has(e.id)),...extra],best=new Map([[from,{cost:0,points:[],ids:[]}]]),done=new Set();
  while(true){
    const next=[...best].filter(([id])=>!done.has(id)).sort((a,b)=>a[1].cost-b[1].cost)[0];
    if(!next)throw new Error(`YBSU disconnected route: ${from} to ${to}`);
    const [node,route]=next;if(node===to)return route;done.add(node);
    for(const edge of edges){
      const forward=edge.from===node,back=edge.to===node;if(!forward&&!back)continue;
      const end=forward?edge.to:edge.from,points=forward?edge.points:[...edge.points].reverse(),cost=route.cost+length(points);
      if(cost>=(best.get(end)?.cost??Infinity))continue;
      best.set(end,{cost,points:[...route.points,...points.slice(route.points.length?1:0)],ids:[...route.ids,edge.id]});
    }
  }
}

export function createYbsuPlan(layout,runway,logicalStand,model,roundedPath){
  const physical=model.wingspan>36?layout.widebodyStand:logicalStand;
  const heading=physical.heading,unit=[Math.cos(heading),Math.sin(heading)],back=unit.map(v=>-v);
  const position=physical.pin.map((v,i)=>v-unit[i]*model.length*.34*layout.metresToWorld);
  const stand={...physical,plotId:logicalStand.plotId,position};
  let merge=null;
  for(const edge of layout.taxiGraph.edges.filter(e=>e.id==='B'))for(let i=1;i<edge.points.length;i++){
    const a=edge.points[i-1],b=edge.points[i],v=subtract(b,a),w=subtract(a,physical.pin),den=cross(back,v);
    if(Math.abs(den)<1e-8)continue;
    const t=cross(w,v)/den,s=cross(w,back)/den;
    if(t<0||s<0||s>1||merge&&t>=merge.distance)continue;
    const point=physical.pin.map((n,k)=>n+back[k]*t);
    merge={point,distance:t,extra:[{id:'stand-access',from:edge.from,to:'stand-merge',points:[...edge.points.slice(0,i),point]},
      {id:'stand-access',from:'stand-merge',to:edge.to,points:[point,...edge.points.slice(i)]}]};
  }
  if(!merge)throw new Error(`YBSU bay ${physical.referenceStand} has no lead-in to B`);
  const heavy=model.wingspan>36;
  const graph={...layout.taxiGraph,edges:layout.taxiGraph.edges.filter(e=>{
    if(e.id==='B3'&&model.wingspan>24)return false;
    if(e.id==='B2'&&model.wingspan>24)return false;
    if(!heavy)return true;
    if(e.id==='A2'||e.id==='B2'||e.id==='B3'||e.id==='A'&&['a2','jA'].includes(e.from))return false;
    if(e.id==='B'&&e.from!=='b1B')return false;
    return true;
  })},n=graph.nodes,arrivalNode=model.wingspan>24?'a1Runway':'a2Runway';
  const arrival=ybsuGraphRoute(graph,arrivalNode,'stand-merge',merge.extra);
  const departure=ybsuGraphRoute(graph,'stand-merge','b1F',merge.extra);
  const first=departure.points.find(p=>dist(p,merge.point)>.1),direction=subtract(first,merge.point),d=Math.hypot(...direction);
  const tugPoint=merge.point.map((v,i)=>v-direction[i]/d*5);
  const pushback=roundedPath([position,merge.point,tugPoint],4);
  const f=graph.edges.find(e=>e.id==='F'&&e.from==='fRunway');
  const departureF=[...f.points].reverse();
  const runwayHold=layout.holdShort;
  const threshold=[0,116],touchdown=[480,116],exitStart=[n[arrivalNode][0]+7,116];
  const arrivalPoints=cleanPath([exitStart,...arrival.points,position]).map(p=>{
    // Long-wheelbase aircraft oversteer toward A1's outer flare; their main
    // gear then follows inside the turn without enlarging its source outline.
    if(heavy&&p[0]>70&&p[0]<90&&p[1]>95&&p[1]<116)return [p[0]+.55*Math.sin((p[1]-95)/21*Math.PI),p[1]];
    return p;
  });
  const inbound=roundedPath(arrivalPoints,arrivalPoints.map(p=>p[0]>65?5:12));
  const junction=n[model.wingspan>24?'a1':'a2'];let exitSplit=1;
  for(let i=2;i<inbound.length-2;i++)if(dist(inbound[i],junction)<dist(inbound[exitSplit],junction))exitSplit=i;
  const exit=inbound.slice(0,exitSplit+1);
  // Join inside the runway end so the main wheels do not pivot beyond the cap.
  const fullOutbound=roundedPath(cleanPath([tugPoint,...departure.points,...departureF.slice(1,-1),[8,116],[18,116]]),8);
  // Hold points are selected along the actual departure path. Code D/E holds
  // on B south of B1; smaller aircraft may proceed to F's runway hold.
  const holdTarget=heavy?layout.heavyHold:runwayHold;
  const [outbound,lineup]=splitBefore(fullOutbound,holdTarget,model.length*.5*layout.metresToWorld+1);
  return {routeModel:'ybsu',runway,stand,logicalStand,period:800,slotDuration:100,hold:outbound.at(-1),
    aircraftId:model.id,supported:model.wingspan<=65,arrivalConnectorId:model.wingspan>24?'A1':'A2',departureConnectorId:'F',
    arrivalEdges:arrival.ids,departureEdges:departure.ids,
    approach:[[660,116],touchdown],landing:[touchdown,exitStart],exit,inbound:inbound.slice(exitSplit),
    pushback,outbound,lineup,
    takeoff:[[18,116],[540,116]],climb:[[540,116],[670,116]]};
}

export function sampleYbsuFlight(plan,elapsed,index,reduced,samplePath){
  const clock=((elapsed%plan.period)+plan.period)%plan.period,slot=Math.floor(clock/100),active=index%8===slot;
  const t=reduced?45:clock%100;
  if(!active||!plan.supported)return {x:-300,y:116,heading:0,altitude:30,opacity:0,phase:'queued',reverse:false,cycle:Math.floor(elapsed/plan.period),timeInCycle:t,period:plan.period};
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
  else if(t<88){phase='line-up';pose=at('lineup',84,88)}
  else if(t<95){phase='takeoff';pose=at('takeoff',88,95)}
  else{phase='climb';pose=at('climb',95,100);altitude=(t-95)/5*18}
  const opacity=phase==='approach'?Math.min(1,t/1.3):phase==='climb'?Math.min(1,(100-t)/1.3):1;
  return {...pose,altitude,phase,opacity,reverse,physicalStand:plan.stand.referenceStand,cycle:Math.floor(elapsed/plan.period),timeInCycle:t,period:plan.period};
}
