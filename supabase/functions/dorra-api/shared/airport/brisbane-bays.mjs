import {GOLD_COAST_BAY_BY_PLOT} from './gold-coast-bays.mjs';
import {BRISBANE_PUBLISHED_POSITIONS} from './brisbane-parking-source.mjs';
import {BRISBANE_LOGISTICS_POSITIONS} from './brisbane-logistics-source.mjs';
import {AIRCRAFT_DIMENSIONS} from './aircraft-dimensions.mjs';

export const BNE_SCALE=420/3560;
export const domesticPoint=([x,y])=>[x*.19040323877248091-y*.3712851153739013+287.38036160387077,x*.3809566595123212+y*.19751216640168548-80.71474807429486];
export const internationalPoint=([x,y])=>domesticPoint([56.5+(x-52.5)-36*46.7/6,91.8+(y-226.4)+72*52.3/6]);
export const northPoint=([x,y])=>domesticPoint([56.5+x-71.3+24*46.7/6,91.8+y-84.9-66*52.3/6]);
// AP04 is 1:8000. Its printed grid is registered at 153°05'48E / 27°24'36S.
export const logisticsPoint=([x,y])=>domesticPoint([56.5-72*46.7/6+(x-94.9)*46.7/58.35,91.8+108*52.3/6+(y-109.3)*52.3/65.4]);
export const BNE_LOUNGES=[[257.027138,35.658869],[221.039451,51.266737],[184.839743,36.107621]];
const dimensions={B752:[47.32,38.05,3],GL7T:[33.8,31.7,2],DH8D:[32.83,28.42,1],A321:[44.51,35.8,3],B738:[39.5,35.8,3],A332:[58.82,60.3,4],B744:[70.67,64.44,4],B773:[73.9,64.8,4],B733:[33.4,28.9,3],B739:[42.2,35.8,3],E190:[36.24,28.72,2],A320:[37.57,35.8,3],SF34:[19.73,21.44,1],SF3:[19.73,21.44,1],A388:[72.73,79.75,5],B757:[47.32,38.05,3],F70:[30.91,28.08,1],F100:[35.53,28.08,1],Q300:[25.68,27.43,1],B350:[14.2,17.65,1]};
export const orientedBox=(p,heading,length,span,pad=0)=>{
  const c=Math.cos(heading),s=Math.sin(heading);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[p[0]+u*(length/2+pad)*c-v*(span/2+pad)*s,p[1]+u*(length/2+pad)*s+v*(span/2+pad)*c]);
};
export function boxesOverlap(a,b){
  for(const polygon of [a,b])for(let i=0;i<polygon.length;i++){
    const p=polygon[i],q=polygon[(i+1)%polygon.length],x=p[1]-q[1],y=q[0]-p[0];
    const u=a.map(p=>p[0]*x+p[1]*y),v=b.map(p=>p[0]*x+p[1]*y);
    if(Math.max(...u)<=Math.min(...v)||Math.max(...v)<=Math.min(...u))return false;
  }return true;
}
function arrangement(p){
  const n=parseInt(p.bay),r=p.referencePoint;
  // P7/P7B occupy the isolated shoulder beside J, facing the junction.
  if(p.area==='logistics')return {heading:p.bay.startsWith('L')||/^P7B?$/.test(p.bay)?1.873:-1.269};
  if(p.area==='international'){
    if(n<=71)return {heading:Math.PI/2};
    if(n===72)return {heading:Math.PI};
    return {heading:n>=84?-Math.PI/2+(n-83)*.15:-Math.PI/2,contact:p.docking==='SAFEGATE'};
  }
  if(p.area==='domestic'){
    // 50A is a nose-in position on the sloping western terminal edge. Its
    // heading follows that edge's normal, rather than a generic apron row.
    if(p.bay==='50A')return {heading:.802};
    const lounge=n>=16&&n<=21?0:n>=26&&n<=32?1:n>=43&&n<=49?2:null;
    if(lounge!==null){const c=BNE_LOUNGES[lounge];return {heading:Math.atan2(c[1]-r[1],c[0]-r[0]),lounge,contact:p.docking==='SAFEGATE'};}
    if(n>=60&&n<=64)return {heading:Math.PI};
    if(n>=100)return {heading:n>=108?Math.PI/2:-Math.PI/2};
    if(n>=53&&n<=57)return {heading:-Math.PI/2};
    if(n>=22&&n<=41){const c=[219,4];return {heading:Math.atan2(c[1]-r[1],c[0]-r[0]),contact:p.docking==='SAFEGATE'};}
    return {heading:n<=6?Math.PI*.9:-Math.PI/2};
  }
  if(p.bay.startsWith('G'))return {heading:nanNumber(p.bay)<=6?Math.PI/2:nanNumber(p.bay)<=11?Math.PI:nanNumber(p.bay)>=19?Math.PI:0};
  if(p.bay.startsWith('R'))return {heading:p.bay==='R1A'?2.05:nanNumber(p.bay)<=5?2.05:1.37,contingency:true};
  return {heading:p.bay.startsWith('ER')?-Math.PI/2:p.bay.includes('F3')?(nanNumber(p.bay)<=3?0:.48):-1.08,contingency:true};
}
const nanNumber=s=>Number(s.match(/\d+/)?.[0]||0);
// Keep the original twelve saved identifiers, assigned to separate real bays.
const legacy=['international:85','international:82','international:79','international:76','domestic:53','domestic:43','domestic:38','domestic:26','domestic:20','domestic:19B','north:G6','north:G10'];
// Append the newly audited logistics inventory; never renumber existing saves.
const raw=[...BRISBANE_PUBLISHED_POSITIONS,...BRISBANE_LOGISTICS_POSITIONS].filter(p=>p.bay!=='H');
const ordered=[...legacy.map(k=>raw.find(p=>`${p.area}:${p.bay}`===k)),...raw.filter(p=>!legacy.includes(`${p.area}:${p.bay}`))];
export const BRISBANE_BAYS=ordered.map((p,index)=>{
  const limits=p.referenceCapacity.split(/[\/-]/).map(k=>dimensions[k]);
  if(limits.some(d=>!d))throw new Error(`Missing published bay envelope: ${p.referenceCapacity}`);
  let maxLength=Math.max(...limits.map(d=>d[0])),maxSpan=Math.max(...limits.map(d=>d[1])),maxSize=Math.max(...limits.map(d=>d[2]));
  // H109/26 apron-usability tables supersede the older type-only capacities.
  if(p.area==='domestic'&&p.bay==='20'){maxLength=65;maxSpan=61;}
  if(p.area==='domestic'&&p.bay==='24'){maxLength=71;maxSpan=65;}
  // A380 positions retain a modest longitudinal buffer for the game's 747-8
  // and C-5; the source Code F lateral envelope remains the hard limit.
  if(p.referenceCapacity==='A388')maxLength=80;
  // Preserve the game's oversize cargo family in one remote operating area.
  // Its enlarged reservation closes neighbouring positions; it does not add
  // a fictitious extra bay or assert an Airservices aircraft approval.
  const oversizeReservation=p.area==='international'&&p.bay==='71';
  if(oversizeReservation){maxLength=84;maxSpan=88.4;}
  const a=arrangement(p),heading=a.heading;
  // Published parking coordinates anchor each stand. The charts do not define
  // a rendered model's centre; these offsets place its footprint on the apron.
  // Small aircraft share the design aircraft centre in this game.
  const stopOffset=p.area==='domestic'&&p.bay==='50A'?.55:p.area==='international'&&parseInt(p.bay)>=73?(p.bay==='75A'?.85:.7):p.area==='logistics'&&/^P4[ABC]?$/.test(p.bay)?.4:.27;
  const position=p.referencePoint.map((n,i)=>n-[Math.cos(heading),Math.sin(heading)][i]*maxLength*stopOffset*BNE_SCALE);
  const envelope=orientedBox(position,heading,maxLength*BNE_SCALE,maxSpan*BNE_SCALE,.35);
  const xs=envelope.map(p=>p[0]),ys=envelope.map(p=>p[1]);
  return {...p,...a,index,plotId:`plot-${index+1}`,referenceStand:p.bay,physicalBay:true,oversizeReservation,maxLength,maxSpan,maxSize,
    label:`Bay ${p.bay}`,precinct:p.area==='logistics'?'Logistics / Airport South':p.area==='international'?'International':p.area==='domestic'?'Domestic':a.contingency?'North remote / taxiway parking':'General aviation',
    position,x:position[0],y:position[1],envelope,rect:{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)},
    maxAircraftSpan:maxSpan*BNE_SCALE,apronId:p.area==='north'?'north-apron':`${p.area}-apron`,conflicts:[]};
});
for(const a of BRISBANE_BAYS)for(const b of BRISBANE_BAYS){
  if(a===b)continue;
  if(boxesOverlap(a.envelope,b.envelope))a.conflicts.push(b.plotId);
}
export const BRISBANE_BAY_BY_PLOT=Object.fromEntries(BRISBANE_BAYS.map(b=>[b.plotId,b]));
export const bayFor=(airportId,plotId)=>airportId==='brisbane'?BRISBANE_BAY_BY_PLOT[plotId]:airportId==='gold-coast'?GOLD_COAST_BAY_BY_PLOT[plotId]:null;
export function aircraftFitsBay(airportId,plotId,aircraftId){
  const b=bayFor(airportId,plotId),m=AIRCRAFT_DIMENSIONS[aircraftId];
  return !b||Boolean(m&&m.length<=b.maxLength+.01&&m.wingspan<=b.maxSpan+.01);
}
const cache=new WeakMap();
export function activeBayPlots(airport){
  if(!['brisbane','gold-coast'].includes(airport.id))return null;
  const signature=airport.gates.map(g=>`${g.plotId}:${g.active!==false}`).join('|'),old=cache.get(airport);
  if(old?.signature===signature)return old.result;
  const result=new Set();
  for(const g of airport.gates){
    const b=bayFor(airport.id,g.plotId);
    if(g.active===false||!b||b.conflicts.some(id=>result.has(id)))continue;
    if(airport.id==='gold-coast'&&b.precinct==='Terminal'){
      const terminal=[...result].map(id=>bayFor(airport.id,id)).filter(p=>p.precinct==='Terminal'),wide=terminal.filter(p=>p.code==='E').length,narrow=terminal.length-wide;
      if(b.code==='E'&&(wide>=7||wide===6&&narrow>1)||b.code==='C'&&wide===7&&narrow>=1)continue;
    }
    result.add(g.plotId);
  }
  cache.set(airport,{signature,result});return result;
}
