import {chartPixel as p} from './archerfield-reference.mjs';
export function createArcherfieldPlan(layout,runway,stand,roundedPath){
 const chain=nodes=>nodes.map(p),radius=1;
 const b1=[[285,116],...chain([[866,1063],[870,1052],[869,1046],[861,1034],[852,1025],[839,1015],[815,1003],[790,998],[779,994]])];
 const join=stand.merge;
 const inbound=roundedPath([b1.at(-1),join,stand.position],radius);
 const departure=roundedPath([join,...chain([[779,994],[760,987],[610,940.9],[380,867.2],[275,833.5],[250,825.5],[218,815]])],radius);
 const lineup=roundedPath(chain([[218,815],[211,812.5],[204,811.5],[197,813],[193,817],[187,838],[187,846]]).concat([[8,116],[30,116]]),radius);
 return {routeModel:'archerfield',period:500,stand,runway,hold:departure.at(-1),
  approach:[[-55,116],[38,116]],landing:[[38,116],b1[0]],exit:roundedPath(b1,radius),inbound,
  pushback:[stand.position,join],outbound:departure,lineup,takeoff:[lineup.at(-1),[290,116]],climb:[[290,116],[355,116]],
  arrivalConnectorId:'B1',departureConnectorId:'B8'};
}
export function sampleArcherfieldFlight(plan,elapsed,index,reduced,samplePath){
 const clock=((elapsed%500)+500)%500,t=clock%100,active=Math.floor(clock/100)===index;
 const base={altitude:0,opacity:1,reverse:false,cycle:Math.floor(elapsed/500),timeInCycle:t,period:500};
 if(reduced||!active)return {...base,x:plan.stand.position[0],y:plan.stand.position[1],heading:plan.stand.heading,phase:'servicing'};
 let phase,pose,altitude=0,reverse=false;const at=(name,a,b)=>samplePath(plan[name],(t-a)/(b-a));
 if(t<8){phase='approach';pose=at('approach',0,8);altitude=10*(1-t/8)}
 else if(t<18){phase='landing';pose=at('landing',8,18)}
 else if(t<28){phase='runway-exit';pose=at('exit',18,28)}
 else if(t<40){phase='taxi-in';pose=at('inbound',28,40)}
 else if(t<60){phase='servicing';pose={x:plan.stand.position[0],y:plan.stand.position[1],heading:plan.stand.heading}}
 else if(t<68){phase='pushback';pose=at('pushback',60,68);pose.heading+=Math.PI;reverse=true}
 else if(t<84){phase='taxi-out';pose=at('outbound',68,84)}
 else if(t<86){phase='holding';pose=samplePath(plan.outbound,1)}
 else if(t<90){phase='line-up';pose=at('lineup',86,90)}
 else if(t<97){phase='takeoff';pose=at('takeoff',90,97)}
 else{phase='climb';pose=at('climb',97,100);altitude=(t-97)/3*12}
 return {...base,...pose,phase,altitude,reverse};
}
