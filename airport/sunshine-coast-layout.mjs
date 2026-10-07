import {YBSU_CHART_GEOMETRY as geometry} from './ybsu-chart-geometry.mjs';
import {YBSU_TRACED_NETWORK} from './ybsu-network-trace.mjs';
import {YBSU_DROPOFF} from './ybsu-terminal.mjs';
import {YBSU_REFERENCE,YBSU_NORTH_VECTOR,YBSU_PUBLISHED_STANDS,ybsuChartPoint as ad,ybsuApronPoint as ap,ybsuStandApronPoint} from './ybsu-reference.mjs';

const extent=points=>{const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}};
const footprint=(source,transform)=>{const polygon=source.rings[0].map(transform);return {polygon,rect:extent(polygon)}};
function insertDistance(points,distance){
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]);if(distance<=d){const p=a.map((v,k)=>v+(b[k]-v)*distance/d);points.splice(i,0,p);return p}distance-=d}
  return points.at(-1);
}
export function ybsuParkingPosition(reference){
  const publishedPoint=ybsuStandApronPoint(reference),pin=ap(publishedPoint);
  const direction=Number(reference.id)<=15?[-.975,-.222]:[-.76,.65];
  const next=ap(publishedPoint.map((v,i)=>v+direction[i])),heading=Math.atan2(next[1]-pin[1],next[0]-pin[0]);
  // Published docking positions stay immutable. The aircraft centre is behind
  // the stop position and is refined for its model by ybsu-traffic.mjs.
  const position=pin.map((v,i)=>v-[Math.cos(heading),Math.sin(heading)][i]*44.51*.34*.2);
  return {referenceStand:reference.id,publishedPoint,pin,position,x:position[0],y:position[1],heading,headingDeg:heading*180/Math.PI,
    maxSpanM:reference.maxSpanM,maxAircraftSpan:reference.maxSpanM*.2,apronId:'rpt-apron',rect:extent([pin.map(v=>v-2),pin.map(v=>v+2)]),capacity:reference.capacity};
}
export function sunshineCoastConfig({bounds,runway}) {
  const parking=YBSU_PUBLISHED_STANDS.filter(s=>/^\d+$/.test(s.id)&&Number(s.id)<=20).map(ybsuParkingPosition);
  const selected=['10','12','13','14','16','18','19','20'];
  const terminal={id:'coast-terminal',name:'Sunshine Coast terminal · YBSU',kind:'terminal',...footprint(geometry.terminal,ap),heightScale:.55};
  const buildings=[...geometry.buildings.map(g=>({id:g.id,...footprint(g,ap)})),...geometry.westBuildings.map(g=>({id:g.id,...footprint(g,ad)}))];
  const tower=footprint(geometry.tower,ap);
  const gameHangars=buildings.filter(b=>b.id.startsWith('west-building-')).sort((a,b)=>b.rect.w*b.rect.h-a.rect.w*a.rect.h).slice(0,3);
  const gameFacilities=Object.fromEntries(['handling','researchLab','cargo'].map((key,i)=>[key,{...gameHangars[i].rect,polygon:gameHangars[i].polygon,gameAdaptation:true}]));
  const taxiways=YBSU_TRACED_NETWORK.edges.map((edge,index)=>({...edge,key:`${edge.id}-${index}`,points:edge.points.map(ad),width:edge.widthM*.2,cornerRadius:0}));
  const holdShort=insertDistance(taxiways.find(t=>t.id==='F'&&t.from==='fRunway').points,145*.2);
  const heavyHold=insertDistance(taxiways.find(t=>t.id==='B'&&t.from==='b1B').points,5);
  const label=(text,p,detail=true)=>({text,x:p[0],y:p[1],detail});
  return {
    version:3,id:'sunshine-coast',icao:'YBSU',name:'Sunshine Coast Airport',
    setting:'YBSU · Marcoola · Runway 13/31 & published terminal apron',
    metresToWorld:.2,taxiwayWidthM:23,magneticHeading:311,headingPrecision:'YBSU-ERSA',reference:YBSU_REFERENCE,northVector:YBSU_NORTH_VECTOR,
    bounds:bounds(-170,-65,600,160),terminalStyle:'coastal-regional',baseGround:'#a7c283',
    authoredTaxiways:true,routeModel:'ybsu',fixedReferenceRunway:true,explicitLandside:true,depthSortedTraffic:true,
    holdShort,holdShortLine:holdShort,heavyHold,helicopterAimingPoints:[{taxiway:'F',position:ap([275,341])},{taxiway:'J',position:ad([210,374])}],
    standSpecs:selected.map(id=>parking.find(s=>s.referenceStand===id)),referenceParking:parking,
    additionalParking:YBSU_PUBLISHED_STANDS.filter(s=>!parking.some(p=>p.referenceStand===s.id)).map(s=>({id:s.id,pin:ap(ybsuStandApronPoint(s))})),
    widebodyStand:parking.find(s=>s.referenceStand==='11'),referenceBuildings:buildings,
    land:[[[-190,-85],[620,-85],[620,180],[-190,180]]],water:[],
    runways:[runway('main',['31','13'],[0,116],[560,116],2800,45,.2,{
      displacedStartM:350,displacedEndM:0,runway13EndOffsetM:175,protectedWidth:60,
      declaredDistancesM:{runway13Tora:2625,runway13Lda:2625,runway31Tora:2800,runway31Lda:2450}
    })],
    // Compound outlines retain grass islands. Animation never adds pavement.
    referencePavement:{rings:geometry.combinedPavement.rings.map(r=>r.map(ad)),triangles:geometry.combinedPavement.triangles.map(t=>t.map(ad))},
    aprons:[{id:'rpt-apron',polygon:geometry.apronPavement.rings[0].map(ap)}],taxiways,
    taxiGraph:{nodes:Object.fromEntries(Object.entries(YBSU_TRACED_NETWORK.nodes).map(([id,p])=>[id,ad(p)])),edges:taxiways},
    closedPavements:[],terminals:[terminal],facilities:{...gameFacilities,tower:{...tower.rect,polygon:tower.polygon}},
    roads:[{id:'terminal-dropoff',points:YBSU_DROPOFF.map(ap),width:1.4},
      {id:'terminal-access',points:[[144,174],[148,208],[151,227],[164,234],[177,235]].map(ap),width:1.4},
      {id:'friendship-drive',points:[[109,274],[137,279],[126,337],[110,400],[111,457]].map(ap),width:1.8}],
    landmarks:[],labels:[label('YBSU · SUNSHINE COAST',ad([201,314]),false),label('TERMINAL',ap([149,205])),label('GA SOUTH',ap([162,375])),label('WEST GA',ad([181,358]))],
    sourceIds:['sunshine-airservices'],
    caveat:'YBSU permanent chart geometry, 3 September 2026. Temporary terminal works are omitted. Game upgrades change capacity, while the reference runway remains 2800 m. Not for navigation.',
    notes:['Pavement and terminal outlines are extracted from AIP SUP H116/26; north and scale share one transform.',
      'A, A1/A2, B, B1/B2/B3, E, F, J, M, West GA and C/D/G/H retain their charted connections.',
      'Eight saved plot IDs use published parking positions. Widebodies share bay 11 and ground movements are serialized for the game presentation.',
      'The permanent layout omits temporary H42/26 terminal-work closures and shifted stop positions. No future terminal expansion is fabricated.',
      'Former runway 18/36 is represented by its current taxiway/apron outlines, not an additional operational runway.']
  };
}
