import {clearBrisbaneRoute,floorFor} from './brisbane-route-clearance.mjs';
import {BRISBANE_BAY_ROUTES} from './brisbane-bay-routes.mjs';
import {AIRCRAFT_GROUND_SHAPES} from './aircraft-ground-geometry.mjs';
import {BRISBANE_ROUTE_ADJUSTMENTS} from './brisbane-route-adjustments.mjs';
export function insideBne(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
const distanceToSegment=(p,a,b)=>{const x=b[0]-a[0],y=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/(x*x+y*y||1)));return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y)};
const grids=new WeakMap();
class Heap{
  q=[];
  push(v){let i=this.q.length;this.q.push(v);while(i){const p=(i-1)>>1;if(this.q[p].f<=v.f)break;this.q[i]=this.q[p];i=p;}this.q[i]=v;}
  pop(){const first=this.q[0],last=this.q.pop();if(this.q.length){let i=0;while(i*2+1<this.q.length){let c=i*2+1;if(c+1<this.q.length&&this.q[c+1].f<this.q[c].f)c++;if(this.q[c].f>=last.f)break;this.q[i]=this.q[c];i=c;}this.q[i]=last;}return first;}
}
// Grid search is confined to existing apron/taxiway pavement. It never paints
// its search path as a taxiway or changes the surveyed straight centrelines.
function localRoute(layout,airport,stand,model,start,end,roundedPath){
  let cache=grids.get(layout);if(!cache){cache=new Map();grids.set(layout,cache);}
  const obstacles=(airport.gates||[]).filter(g=>g.plotId!==stand.plotId&&g.active!==false&&g.status!=='waiting').map(g=>layout.stands.find(s=>s.plotId===g.plotId)).filter(Boolean);
  const clearance=stand.area==='international'
    ?Math.max(model.wingspan*.5,model.length*.45)*layout.metresToWorld+.1
    :Math.min(2.6,model.wingspan*layout.metresToWorld*.28);
  const on=floorFor(layout,roundedPath),gridStep=stand.area==='north'?.5:1;
  const wheelShape=AIRCRAFT_GROUND_SHAPES[model.id]?.wheels;
  const margin=wheelShape?Math.min(.65,Math.max(...wheelShape.map(w=>Math.abs(w[1])))*layout.metresToWorld+.12):.65;
  const minX=Math.floor(Math.min(start[0],end[0])-35),maxX=Math.ceil(Math.max(start[0],end[0])+35),minY=Math.min(Math.floor(Math.min(start[1],end[1])-30),stand.area==='logistics'?-60:Infinity),maxY=83;
  const free=p=>{
    const key=margin.toFixed(4)+':'+p.join(',');let base=cache.get(key);
    if(base===undefined){base=on(p)&&Array.from({length:8},(_,i)=>[p[0]+Math.cos(i*Math.PI/4)*margin,p[1]+Math.sin(i*Math.PI/4)*margin]).every(on)&&!layout.terminals.some(t=>insideBne(p,t.polygon));cache.set(key,base);}
    if(!base)return false;
    if(layout.terminals.some(t=>t.polygon.some((q,i)=>distanceToSegment(p,q,t.polygon[(i+1)%t.polygon.length])<clearance)))return false;
    return !obstacles.some(s=>insideBne(p,s.envelope)||s.envelope.some((q,i)=>distanceToSegment(p,q,s.envelope[(i+1)%s.envelope.length])<clearance));
  };
  const visible=(a,b)=>{const distance=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(distance*4),c=(b[0]-a[0])/(distance||1),s=(b[1]-a[1])/(distance||1);
    for(let i=0;i<=n;i++){const p=[a[0]+(b[0]-a[0])*i/(n||1),a[1]+(b[1]-a[1])*i/(n||1)];if(!free(p))return false;
      if(wheelShape&&distance>.001)for(const sign of [-1,1])if(!wheelShape.every(w=>on([p[0]+sign*(w[0]*c-w[1]*s)*layout.metresToWorld,p[1]+sign*(w[0]*s+w[1]*c)*layout.metresToWorld])))return false;
    }return true;};
  const nearest=p=>{let best=null,d=Infinity;for(let x=Math.round(p[0]/gridStep)-3/gridStep;x<=Math.round(p[0]/gridStep)+3/gridStep;x++)for(let y=Math.round(p[1]/gridStep)-3/gridStep;y<=Math.round(p[1]/gridStep)+3/gridStep;y++){const q=[x*gridStep,y*gridStep],n=Math.hypot(q[0]-p[0],q[1]-p[1]);if(n<d&&free(q)&&visible(p,q)){best=q;d=n;}}return best;};
  const a=nearest(start),b=nearest(end);if(!a||!b)return null;
  const moves=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  // Long aircraft cannot rotate to a 45-degree grid diagonal on a narrow
  // oblique taxilane. Include shallow, fully checked straight primitives.
  for(const n of [2,3,4,5])for(const x of [-1,1])for(const y of [-1,1])moves.push([x,y*n],[x*n,y]);
  const key=p=>`${p[0]},${p[1]}`,open=new Heap(),cost=new Map([[key(a),0]]),parents=new Map(),visited=new Set();
  const estimate=p=>Math.hypot(p[0]-b[0],p[1]-b[1])*2;
  open.push({p:a,f:estimate(a)});
  while(open.q.length){
    const {p}=open.pop(),k=key(p);if(visited.has(k))continue;visited.add(k);
    if(k===key(b)){
      const path=[end,p];let prev=parents.get(k);while(prev){path.push(prev);prev=parents.get(key(prev));}path.push(start);path.reverse();
      const simple=[path[0]];for(let i=1;i<path.length;){let j=i;while(j+1<path.length&&visible(simple.at(-1),path[j+1]))j++;simple.push(path[j]);i=j+1;}return simple;
    }
    for(const [dx,dy] of moves){
      const q=[p[0]+dx*gridStep,p[1]+dy*gridStep],next=key(q);if(q[0]<minX||q[0]>maxX||q[1]<minY||q[1]>maxY||visited.has(next)||!free(q)||!visible(p,q))continue;
      const score=cost.get(k)+Math.hypot(dx,dy)*gridStep;if(score>=(cost.get(next)??Infinity))continue;
      cost.set(next,score);parents.set(next,p);open.push({p:q,f:score+estimate(q)});
    }
  }return null;
}
export const bayRouteSignature=s=>[...s.position,s.heading,s.maxLength,s.maxSpan].map(n=>n.toFixed(4)).join(',');
export function createBrisbanePlan(layout,airport,stand,model,runway,roundedPath){
  const adjustment=BRISBANE_ROUTE_ADJUSTMENTS[`${stand.plotId}:${model.id}`];
  if(adjustment?.signature===bayRouteSignature(stand)&&adjustment.taxiwayVersion===layout.taxiwayVersion&&!airport.buildRoutes&&!airport.routePreview)airport={routePoints:adjustment.points,routeTurnFactor:adjustment.turnFactor,routeInboundTurnFactor:adjustment.inboundFactor,routeOutboundTurnFactor:adjustment.outboundFactor,routePocketLength:adjustment.pocketLength,routePushRadius:adjustment.pushRadius,...airport};
  const smooth=(points,radius)=>roundedPath(points.filter((p,i)=>!i||Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>.00001),radius);
  const end=runway.end[0],ry=116,hold=layout.holdShort;
  const fullRunway=end>=layout.runways.find(r=>r.id==='main').end[0]-.01;
  const arrivalExit=layout.taxiways.filter(t=>/^A(?:1|3|4|4S|6|7|9)$/.test(t.id)&&t.points.at(-1)[0]<=end-(fullRunway?0:8)+.01)
    .sort((a,b)=>b.points.at(-1)[0]-a.points.at(-1)[0])[0];
  const exitMouth=arrivalExit.points.at(-1),arrivalA=arrivalExit.points[0];
  const arrivalB=layout.taxiways.filter(t=>/^B\d+$/.test(t.id)).sort((a,b)=>Math.abs(a.points[0][0]-arrivalA[0])-Math.abs(b.points[0][0]-arrivalA[0]))[0];
  const start=[arrivalB.points[0][0]-7,79],landingEnd=[exitMouth[0]-3,ry];
  const departureB=layout.taxiways.find(t=>t.id==='B9'),departureA=layout.taxiways.find(t=>t.id==='A9');
  // Join the published apron connectors on their centreline. A bay's X
  // coordinate is not itself a connection across the grass beside taxiway B.
  const connectorIds=stand.area==='international'?['C8','C9','C10']:stand.area==='domestic'?['C1','C2','C3','C3T','C4','C5','C6']:[];
  const connectors=layout.taxiways.filter(t=>connectorIds.includes(t.id)).sort((a,b)=>Math.abs(a.points[0][0]-stand.x)-Math.abs(b.points[0][0]-stand.x));
  const connector=connectors[0];
  let portal=connector?[connector.points[0][0],79]:stand.area==='logistics'?[-92,79]:[410.65,79];
  const entryFor=t=>t.id==='C1'?[t.points[0][0],67.4]:t.id==='C8'?[t.points[0][0],70]:[...t.points.find(p=>p[1]!==79)];
  // Join C at its C1 intersection, and enter the north international apron
  // before C8's far end. Driving to those dead ends forced an abrupt reversal.
  const apronEntry=connector?entryFor(connector):stand.area==='logistics'?[-105,74]:[410.65,66];
  const h=stand.heading,confinedPush=stand.area==='domestic'&&stand.bay==='50';
  const back=Math.min(model.length*.6+8,confinedPush?8.5:Infinity)*layout.metresToWorld,tail=[stand.x-Math.cos(h)*back,stand.y-Math.sin(h)*back];
  const compiled=BRISBANE_BAY_ROUTES[stand.plotId];
  let local=airport.routePoints|| (airport.routePreview?[portal,tail]:airport.buildRoutes?localRoute(layout,airport,stand,model,apronEntry,tail,roundedPath):compiled?.signature===bayRouteSignature(stand)?compiled.points:null);
  if(!local&&airport.buildRoutes)for(const factor of [.35,.12]){
    const closer=[stand.x-Math.cos(h)*model.length*layout.metresToWorld*factor,stand.y-Math.sin(h)*model.length*layout.metresToWorld*factor];
    local=localRoute(layout,airport,stand,model,apronEntry,closer,roundedPath);if(local)break;
  }
  if(!local&&airport.buildRoutes)for(const alternate of connectors.slice(1)){
    const entry=entryFor(alternate);
    for(const factor of [.6,.35,.12]){
      const stop=[stand.x-Math.cos(h)*(model.length*factor+ (factor===.6?8:0))*layout.metresToWorld,stand.y-Math.sin(h)*(model.length*factor+(factor===.6?8:0))*layout.metresToWorld];
      local=localRoute(layout,airport,stand,model,entry,stop,roundedPath);
      if(local){portal=[alternate.points[0][0],79];break;}
    }if(local)break;
  }
  if(local&&airport.buildRoutes)local=[portal,...local];
  if(local&&!airport.buildRoutes&&!airport.routePreview)portal=local[0];
  // Bay 50 backs out beside the southern satellite. Turn the tug after the
  // short clear straight instead of reversing the tail into the lounge.
  if(local&&confinedPush)local=[...local.slice(0,-1),tail];
  const approach=local?[...local,stand.position]:[portal,tail,stand.position];
  const reverse=[...approach].reverse(),pushEnd=reverse[1];
  // A tug rotates the aircraft to the outbound taxilane while backing. Preserve
  // the reverse heading at the phase boundary by using a short turning pocket.
  const onward=reverse[2]||portal,dx=onward[0]-pushEnd[0],dy=onward[1]-pushEnd[1],len=Math.hypot(dx,dy)||1;
  const pocketLength=airport.routePocketLength??1.1;
  const pocket=[pushEnd[0]-dx/len*pocketLength,pushEnd[1]-dy/len*pocketLength];
  const pushback=smooth([stand.position,pushEnd,pocket],airport.routePushRadius??.45);
  const turn=Math.max(.45,model.length*layout.metresToWorld*(airport.routeTurnFactor??.3));
  const inboundTurn=airport.routeInboundTurnFactor===undefined?turn:Math.max(.45,model.length*layout.metresToWorld*airport.routeInboundTurnFactor);
  const outboundTurn=airport.routeOutboundTurnFactor===undefined?turn:Math.max(.45,model.length*layout.metresToWorld*airport.routeOutboundTurnFactor);
  const localOut=[pocket,pushEnd,...reverse.slice(2)];
  const touchdown=[Math.min(24,end*.35),ry];
  const plan={routeModel:'brisbane-bays',apronRoute:local,routeGeometryKey:JSON.stringify([local,inboundTurn,outboundTurn,pocket,pushback]),routeAvailable:Boolean(local),runway,stand,period:Math.max(120,(airport.gates?.filter(g=>g.active!==false&&g.status!=='waiting').length||12)*40),hold,
    approach:[[-80,ry],touchdown],landing:[touchdown,landingEnd],
    exit:smooth([landingEnd,...[...arrivalExit.points].reverse(),arrivalB.points[1],arrivalB.points[0],start],2.4),
    inbound:smooth([start,portal,...approach.slice(1)],inboundTurn),pushback,
    outbound:smooth([...localOut,departureB.points[0],departureB.points[1],hold],outboundTurn),
    lineup:smooth([hold,...departureA.points.filter(p=>p[1]>hold[1]),[22,ry]],1.8),
    takeoff:[[22,ry],[end-10,ry]],climb:[[end-10,ry],[end+95,ry]],departureConnectorId:'B9',arrivalConnectorId:arrivalExit.id,arrivalApronConnectorId:arrivalB.id};
  if(local&&!airport.routePreview&&!airport.buildRoutes)plan.routeAvailable=clearBrisbaneRoute(layout,airport,stand,model,plan,roundedPath);
  if(local&&!airport.routePreview&&!airport.buildRoutes&&!plan.routeAvailable&&airport.routeTurnFactor===undefined){
    for(const factor of [.1,.2,.4,.6,.8,1]){const candidate=createBrisbanePlan(layout,{...airport,routeTurnFactor:factor},stand,model,runway,roundedPath);if(candidate.routeAvailable)return candidate;}
  }
  return plan;
}
