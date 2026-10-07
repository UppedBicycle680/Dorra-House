import {BRISBANE_APRON_PDF_POLYGONS} from './brisbane-apron-pavement.mjs';
import {addBrisbaneRetiredRunway} from './brisbane-retired-runway.mjs';
import {addBrisbaneHangars} from './brisbane-hangars.mjs';
import {addBrisbaneDomesticPrecinct} from './brisbane-domestic-precinct.mjs';
import {BRISBANE_JUNCTION_PAVEMENT} from './brisbane-junction-pavement.mjs';
import {BRISBANE_TAXIWAY_PAVEMENT} from './brisbane-taxiway-pavement.mjs';
import {insideBne} from './brisbane-traffic.mjs';
import {BRISBANE_BAYS,BNE_LOUNGES,BNE_SCALE,domesticPoint as dp,internationalPoint as ip,northPoint as np,logisticsPoint as lp} from './brisbane-bays.mjs';
import {BRISBANE_PUBLISHED_POSITIONS} from './brisbane-parking-source.mjs';
import {BRISBANE_LOGISTICS_POSITIONS,BRISBANE_LOGISTICS_PAVEMENT,BRISBANE_LOGISTICS_BUILDINGS,BRISBANE_LOGISTICS_LINK_PAVEMENT,BRISBANE_LOGISTICS_SERVICE_LANES} from './brisbane-logistics-source.mjs';

const boxOf=p=>{const x=p.map(q=>q[0]),y=p.map(q=>q[1]);return {x:Math.min(...x),y:Math.min(...y),w:Math.max(...x)-Math.min(...x),h:Math.max(...y)-Math.min(...y)}};
const strip=(a,b,width)=>{const d=Math.hypot(b[0]-a[0],b[1]-a[1]),n=[-(b[1]-a[1])*width/d/2,(b[0]-a[0])*width/d/2];return [[a[0]+n[0],a[1]+n[1]],[b[0]+n[0],b[1]+n[1]],[b[0]-n[0],b[1]-n[1]],[a[0]-n[0],a[1]-n[1]]]};
export function closestOnPolygon(p,polygon){
  let best=null,dist=Infinity;
  polygon.forEach((a,i)=>{const b=polygon[(i+1)%polygon.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy))),q=[a[0]+t*dx,a[1]+t*dy],d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<dist){best=q;dist=d}});return best;
}
export function enhanceBrisbaneTerminals(layout){
  const terminals=[];
  const add=(id,name,polygon,height,kind='pier')=>terminals.push({id,name,polygon,rect:boxOf(polygon),height,kind});
  // The two landside black blocks in AP01 are P2/P1 car parks, not extra
  // departure halls (operator Parking Location Map, April 2025).
  // Preserve internal obstacle IDs used by the ground-route cache.
  add('domestic-headhouse','Domestic P2 car park',[[90,183],[108,191],[94,220],[85,238],[75,255],[58,246],[72,219],[80,223],[85,215],[76,211]].map(dp),2.4,'parking');
  add('domestic-checkin','Domestic P1 car park',[[110.5,201],[128,210],[96,272],[78.5,263]].map(dp),3.2,'parking');
  const crescent=[[162,179],[168,190],[173,203],[176,216],[176.5,230],[174,244],[169,258],[162,271],[151,284],[138,295],[123,303],[113,308],[108.5,291],[119,287],[131,280],[142,270],[150,260],[156,247],[160,233],[161,219],[159,205],[154,192],[147,189]];
  add('domestic-terminal','Domestic terminal crescent',crescent.map(dp),1.9,'domestic');
  for(const [i,root] of [[0,[171,200]],[1,[166,265]],[2,[117,305]]]){
    const centre=BNE_LOUNGES[i];
    add(`domestic-link-${i}`,'Domestic boarding link',strip(dp(root),centre,.95),1.25);
    add(`domestic-satellite-${i}`,'Domestic circular gate lounge',Array.from({length:40},(_,j)=>[centre[0]+Math.cos(j/40*Math.PI*2)*3.35,centre[1]+Math.sin(j/40*Math.PI*2)*3.35]),1.5,'satellite');
  }
  add('international-terminal','International check-in and arrivals',[[139,312],[179,331],[162,371],[117,352]].map(ip),2.65,'international');
  add('international-landside','International P1 car park',[[111.5,291.3],[124,297.4],[101,343],[88.7,337]].map(ip),2.3,'parking');
  const spine=[[246,222],[240,234],[232,244],[224,249],[213,260],[194,297],[173,338],[153,375],[145,384],[136,392],[108,410]].map(ip);
  for(let i=1;i<spine.length;i++)add(`international-concourse-${i}`,'International boarding concourse',strip(spine[i-1],spine[i],i<=3?2.1:1.35),1.75);
  add('international-north-lounge','International northern gate lounge',[[244.6,218.48],[251.5,222.08],[241.5,241.5],[231.8,242.98]].map(ip),1.9);
  for(const [i,points] of [
    [[49,463],[57,467],[53,476],[45,472]],
    [[60,472],[68,476],[64,484],[56,480]],
    [[71,479],[79,483],[77,488],[69,484]],
    [[113,500],[132,510],[129,516],[110,506]],
    [[136,517],[149,524],[147,530],[133,523]]
  ].entries())add(`ga-hangar-${i}`,'General aviation hangar',points.map(np),1.5,'hangar');
  const service=boxOf([[36,500],[51,507],[48,516],[33,509]].map(np));
  add('ga-service','General aviation ground services',[[36,500],[51,507],[48,516],[33,509]].map(np),1.3,'hangar');
  layout.facilities.handling={...service,referenceOnly:true};
  for(const [i,polygon] of BRISBANE_LOGISTICS_BUILDINGS.entries())add(`logistics-building-${i}`,'Airport South freight / service building',polygon.map(lp),1.6,'hangar');
  // The former cargo upgrade block sat on the newly registered apron.
  // Keep its gameplay identity at a real logistics warehouse footprint.
  layout.facilities.cargo={...boxOf([[176,494],[229,451],[240,461],[192,505]].map(lp)),referenceOnly:true};
  layout.bounds.minX=-350;
  layout.land.push([[-350,-90],[-140,-90],[-140,145],[-350,145]]);
  // L bends around the southern terminal before continuing to Airport South.
  // C12/C13 and J join the logistics chart, which extends beyond AD page 1.
  const link=(id,points,cornerRadius=0)=>({id,points,width:30*BNE_SCALE,scenic:true,reference:true,cornerRadius});
  layout.taxiways=layout.taxiways.filter(t=>!['L','C12','C13','J'].includes(t.id));
  layout.taxiways.push(
    // The bend is sampled at midpoints of horizontal cuts through the AD01
    // vector pavement; AP04 supplies the straight continuation to the south.
    link('L',[[-92,79],[-99,77],[-105,74],[-111,71],[-115,66],[-117.2,60],[-117.6,54],[-118,49],[-118.6,45],[-120.2,40],[-122.9,35],[-126.94,30],[-133.37,25],[-144,20],...[[350,137],[165,322]].map(lp)],3),
    link('C12',[[300,95],[324,119],[338,129],[350,137]].map(lp),2),
    link('C13',[[133,257],[155,266],[165,286],[162,311],[153,334]].map(lp),3),
    link('J',[[171,320],[172,337],[185,354],[200,373],[207,388],[202,403],[184,421],[168,437]].map(lp),3));
  layout.labels.push({text:'AIRPORT SOUTH',x:-196,y:-44,detail:true},{text:'LOGISTICS APRON',x:-286,y:-3,detail:true});
  layout.terminals=terminals;
  layout.landmarks=layout.landmarks.filter(m=>!['domestic-p1','domestic-p2'].includes(m.id)&&m.label!=='Airport South logistics');
  const airportDrive=layout.roads.find(r=>r.id==='airport-drive');
  airportDrive.points=[[-174,-64],[-136,-50],...airportDrive.points.slice(1)];
  layout.roads.find(r=>r.id==='international-forecourt').points=[[-89.45,-27.07],[-89.45,20],[-14.65,20],[-14.65,-3.1]];
  layout.standSpecs=BRISBANE_BAYS.map(b=>({...b,conflicts:[...b.conflicts]}));
  layout.depthSortedTraffic=true;
  layout.apronServiceLanes=BRISBANE_LOGISTICS_SERVICE_LANES.map(p=>p.map(lp));
  layout.routeModel='brisbane-bays';
  layout.version=5;
  layout.taxiwayVersion=5;
  // The chart outlines include the remote aprons that the former twelve-plot
  // map omitted. Taxiway geometry stays in brisbane-layout.mjs.
  layout.aprons=layout.aprons.filter(a=>!['international-apron','international-north-apron','domestic-apron','north-apron','north-remote-apron'].includes(a.id));
  // Preserve the holes and islands from the source PDF compound paths.
  layout.aprons=layout.aprons.filter(a=>!['international-apron','domestic-apron','north-apron','south-logistics-apron'].includes(a.id));
  for(const [area,transform] of [['domestic',dp],['international',ip],['north',np],['logistics',lp]]){
    const polys=(area==='logistics'?BRISBANE_LOGISTICS_PAVEMENT:BRISBANE_APRON_PDF_POLYGONS[area]).map(p=>p.map(transform));
    const areaOf=p=>Math.abs(p.reduce((a,q,i)=>{const r=p[(i+1)%p.length];return a+q[0]*r[1]-r[0]*q[1]},0));
    const records=polys.map((polygon,index)=>({id:`${area}-source-${index}`,polygon,area:areaOf(polygon),holes:[]})).sort((a,b)=>b.area-a.area);
    const outer=[];
    for(const record of records){const parent=outer.find(r=>insideBne(record.polygon[0],r.polygon));if(parent)parent.holes.push(record.polygon);else outer.push(record);}
    layout.aprons.push(...outer);
  }
  // The general apron charts simplify some terminal-edge pockets. Reconcile
  // those edges with the more precise published parking stops and H109/26.
  // These are local apron surfaces, never invented named taxiways.
  const hull=points=>{const sorted=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),half=ps=>{const out=[];for(const p of ps){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};return [...half(sorted).slice(0,-1),...half([...sorted].reverse()).slice(0,-1)];};
  for(const b of layout.standSpecs){
    if(!(b.area==='domestic'&&['5','24'].includes(b.bay))&&layout.aprons.some(a=>insideBne(b.position,a.polygon)&&!(a.holes||[]).some(h=>insideBne(b.position,h))))continue;
    const nearest=layout.aprons.filter(a=>a.id.startsWith(b.area+'-source')).map(a=>closestOnPolygon(b.position,a.polygon)).sort((a,c)=>Math.hypot(a[0]-b.x,a[1]-b.y)-Math.hypot(c[0]-b.x,c[1]-b.y))[0];
    if(nearest)layout.aprons.push({id:`${b.area}-parking-pocket-${b.bay}`,parkingReconciliation:true,polygon:hull([...b.envelope,...Array.from({length:8},(_,i)=>[nearest[0]+Math.cos(i/8*Math.PI*2)*2,nearest[1]+Math.sin(i/8*Math.PI*2)*2])])});
  }
  for(const b of layout.standSpecs){const apron=layout.aprons.find(a=>insideBne(b.position,a.polygon)&&!(a.holes||[]).some(h=>insideBne(b.position,h)));if(apron)b.apronId=apron.id;}
  // Restore the chart's actual junction fillets omitted by constant-width
  // centreline strips. These are clipped source polygons, not widened lanes.
  layout.aprons.push(...BRISBANE_JUNCTION_PAVEMENT.filter(p=>!p.polygon.every(q=>q[0]>380&&q[1]<72)).map((p,i)=>({id:`junction-source-${i}`,sourceJunction:true,...p})));
  layout.aprons.push(...BRISBANE_LOGISTICS_LINK_PAVEMENT.map((p,i)=>({id:`logistics-link-source-${i}`,sourceJunction:true,...p})));
  layout.jetways=[];
  for(const b of layout.standSpecs.filter(b=>b.contact)){
    const candidates=terminals.filter(t=>b.area==='international'?t.id.startsWith('international-concourse')||t.id==='international-north-lounge':b.lounge!==undefined?t.id===`domestic-satellite-${b.lounge}`:t.id==='domestic-terminal');
    const anchor=candidates.map(t=>({terminalId:t.id,point:closestOnPolygon(b.referencePoint,t.polygon)})).sort((a,c)=>Math.hypot(a.point[0]-b.referencePoint[0],a.point[1]-b.referencePoint[1])-Math.hypot(c.point[0]-b.referencePoint[0],c.point[1]-b.referencePoint[1]))[0];
    if(!anchor)continue;
    const dx=b.referencePoint[0]-anchor.point[0],dy=b.referencePoint[1]-anchor.point[1],d=Math.hypot(dx,dy)||1;
    layout.jetways.push({plotId:b.plotId,bay:b.bay,terminalId:anchor.terminalId,anchor:anchor.point,elbow:[anchor.point[0]+dx/d*.7,anchor.point[1]+dy/d*.7],retracted:[anchor.point[0]+dx/d*1.65,anchor.point[1]+dy/d*1.65],height:.65,dual:b.referenceCapacity==='A388'||b.area==='international'&&b.bay==='80'});
  }
  layout.helipads=[...BRISBANE_PUBLISHED_POSITIONS,...BRISBANE_LOGISTICS_POSITIONS].filter(p=>p.bay==='H').map(p=>({position:p.referencePoint,radius:1.4}));
  layout.notes=layout.notes.filter(n=>!n.startsWith('Twelve saved'));
  layout.notes.push('197 published fixed-wing parking configurations and two helipads, including overlapping alternatives and contingency taxiway positions. This is not 197 simultaneous aircraft capacity. Each position is individually purchasable; conflicting configurations share operating space.','The remote bay 71 has an enlarged game-only oversize-cargo operating reservation which keeps neighbouring positions inactive. Its published reference remains A388; this is not an aviation approval.',
    'The original twelve plot identifiers and purchased levels remain saved. Aircraft dispatch now respects each real bay envelope.','Apron chart outlines, stop coordinates and lounge locations are registered to the airport map; roof detail, jetway articulation and aircraft-centre offsets are game interpretations.');
    layout.aprons.push(...BRISBANE_TAXIWAY_PAVEMENT);
    addBrisbaneRetiredRunway(layout);
    addBrisbaneHangars(layout);
    addBrisbaneDomesticPrecinct(layout);
    return layout;
}
