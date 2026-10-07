// Conservative apron-only shuttle loops. The same full-mesh clearance test as
// parked equipment validates every metre of travel and reserves the whole route.
export function planPassengerShuttle(candidates,stands,terminals,scale,clear){
  if(!stands.length||!terminals.length)return null;
  const distance=(p,q)=>Math.hypot(p.x-q[0],p.y-q[1]);
  const terminalPoints=terminals.flatMap(t=>t.polygon||(t.rect?[[t.rect.x,t.rect.y],[t.rect.x+t.rect.w,t.rect.y],[t.rect.x+t.rect.w,t.rect.y+t.rect.h],[t.rect.x,t.rect.y+t.rect.h]]:[])),terminalDistances=new Map(candidates.map(p=>[p,Math.min(...terminalPoints.map(q=>distance(p,q)))]));
  const terminalDistance=p=>terminalDistances.get(p);
  const starts=candidates.filter(c=>terminalDistance(c)<45*scale).sort((a,b)=>terminalDistance(a)-terminalDistance(b));
  // Try a bounded subset; routes are computed only when infrastructure changes.
  let attempts=0;
  for(const stand of stands){
    const ends=candidates.filter(c=>distance(c,stand.position)<35*scale).sort((a,b)=>distance(a,stand.position)-distance(b,stand.position)).slice(0,24);
    for(const a of starts)for(const b of ends){
      if(a.apron!==b.apron)continue;
      const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<20*scale||d>160*scale)continue;
      if(++attempts>2500)return null;
      const heading=Math.atan2(dy,dx),u=[dx/d,dy/d],n=[-u[1],u[0]],r=9*scale,poses=[];
      if(!clear({kind:'bus',x:a.x+n[0]*r,y:a.y+n[1]*r,heading,apron:a.apron})||!clear({kind:'bus',x:b.x-n[0]*r,y:b.y-n[1]*r,heading:heading-Math.PI,apron:a.apron}))continue;
      const push=(x,y,h)=>poses.push({kind:'bus',x,y,heading:h,apron:a.apron});
      const lineSteps=Math.ceil(d/scale),turnSteps=48;
      for(let i=0;i<=lineSteps;i++){const t=i/lineSteps;push(a.x+dx*t+n[0]*r,a.y+dy*t+n[1]*r,heading)}
      const standIndex=poses.length-1;
      for(let i=1;i<=turnSteps;i++){const q=Math.PI*i/turnSteps;push(b.x+r*(n[0]*Math.cos(q)+u[0]*Math.sin(q)),b.y+r*(n[1]*Math.cos(q)+u[1]*Math.sin(q)),heading-q)}
      for(let i=1;i<=lineSteps;i++){const t=i/lineSteps;push(b.x-dx*t-n[0]*r,b.y-dy*t-n[1]*r,heading-Math.PI)}
      for(let i=1;i<=turnSteps;i++){const q=Math.PI*i/turnSteps;push(a.x-r*(n[0]*Math.cos(q)+u[0]*Math.sin(q)),a.y-r*(n[1]*Math.cos(q)+u[1]*Math.sin(q)),heading-Math.PI-q)}
      const footprints=[];let valid=true;
      for(const p of poses){const fp=clear(p);if(!fp){valid=false;break}footprints.push(fp)}
      if(!valid)continue;
      let length=0;const points=poses.map((p,i)=>{if(i)length+=Math.hypot(p.x-poses[i-1].x,p.y-poses[i-1].y);return {x:p.x,y:p.y,heading:p.heading,distance:length}});
      return {standPlotId:stand.plotId,apronId:a.apron.id,points,footprints,length,standDistance:points[standIndex].distance};
    }
  }
  return null;
}

export function samplePassengerShuttle(route,distance){
  const d=Math.max(0,Math.min(route.length,distance)),i=route.points.findIndex(p=>p.distance>=d),b=route.points[Math.max(1,i)],a=route.points[Math.max(0,i-1)],t=(d-a.distance)/(b.distance-a.distance||1);
  return {kind:'bus',x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,heading:a.heading+(b.heading-a.heading)*t};
}

// Stateful motion prevents a departure/arrival phase change from teleporting
// the bus. Aircraft priority pauses the vehicle before it enters an occupied box.
export function advancePassengerShuttle(state,route,dt,serviceAvailable,isClear,scale){
  dt=Math.max(0,Math.min(dt,.25));
  if(!state.phase)Object.assign(state,{phase:'terminal',distance:0,dwell:0,passengersOnboard:false});
  if(state.phase==='terminal'){
    state.dwell+=dt;
    if(serviceAvailable&&state.dwell>=8)Object.assign(state,{phase:'to-stand',passengersOnboard:true,dwell:0});
  }else if(state.phase==='stand'){
    state.dwell+=dt;
    if(state.dwell>=10)Object.assign(state,{phase:'to-terminal',passengersOnboard:false,dwell:0});
  }else{
    const limit=state.phase==='to-stand'?route.standDistance:route.length;
    const distance=Math.min(limit,state.distance+4*scale*dt),pose=samplePassengerShuttle(route,distance);
    state.waitingForAircraft=!isClear(pose);
    if(!state.waitingForAircraft){state.distance=distance;if(distance>=limit)Object.assign(state,state.phase==='to-stand'?{phase:'stand',dwell:0,passengersOnboard:false}:{phase:'terminal',distance:0,dwell:0,passengersOnboard:false})}
  }
  return {...samplePassengerShuttle(route,state.distance),phase:state.phase,passengersOnboard:!!state.passengersOnboard,waitingForAircraft:!!state.waitingForAircraft,standPlotId:route.standPlotId};
}
