// Reference pavement and connected taxiways. See GOLD-COAST-TAXIWAY-QA-PLAN.md.
import {GOLD_COAST_REFERENCE as reference,goldCoastChartPoint as chart} from './gold-coast-reference.mjs';
import {GOLD_COAST_CHART_GEOMETRY as geometry} from './gold-coast-chart-geometry.mjs';
import {GOLD_COAST_NETWORK as network} from './gold-coast-network.mjs';
import {GOLD_COAST_BAYS,GOLD_COAST_PARKING_CAPACITY} from './gold-coast-bays.mjs';
import {goldCoastGeographicPoint} from './gold-coast-bays.mjs';
import {GOLD_COAST_GA_IMAGERY as gaImage} from './gold-coast-ga-imagery.mjs';
import {GOLD_COAST_HANGARS} from './gold-coast-hangars.mjs';
export function goldCoastConfig({bounds,rect,rectPolygon,building,landmark,lane,runway}) {
  const s=.2, length=2492*s, crossLength=582*s, angle=34*Math.PI/180;
  const crossStart=chart(reference.runway17),crossEnd=[crossStart[0]+crossLength*Math.cos(angle),crossStart[1]+crossLength*Math.sin(angle)];
  const [fireX,fireY]=chart(reference.fireStation),[towerX,towerY]=chart(reference.tower),[fuelX,fuelY]=chart(reference.fuel);
  const placed=(kind,label,anchor,w,h,options={})=>{const [x,y]=chart(anchor);return landmark(kind,label,x-w/2,y-h/2,w,h,{reference:true,...options})};
  const extent=polygon=>({x:Math.min(...polygon.map(p=>p[0])),y:Math.min(...polygon.map(p=>p[1])),w:Math.max(...polygon.map(p=>p[0]))-Math.min(...polygon.map(p=>p[0])),h:Math.max(...polygon.map(p=>p[1]))-Math.min(...polygon.map(p=>p[1]))});
  const nodes=Object.fromEntries(Object.entries(network.nodes).map(([id,p])=>[id,chart(p)]));
  // Centrelines follow the middle of the source pavement, whose black runway
  // stroke is wider than the physical 45 m seal. Extend mouth axes to that seal.
  for(const [id,y] of [['hC',78.5],['hotspot',78.6],['aC',78.9],['fC',79.5],['dC',79.7],['lC',80.1],['kC',80.8]])nodes[id][1]=y;
  for(const id of ['aE','dE','lE','eSouth'])nodes[id][1]=55;
  for(const [id,junction,mouth] of [['hR','hC',[181.2,266.8]],['bR','hotspot',[202,303.2]],['aR','aC',[222.5,338.4]],['fR','fC',[246.5,386]],['dR','dC',[253.5,398]],['kR','kC',[299.5,478]],['jR','j35',[241.5,389.2]]]){
    const a=chart(mouth),b=nodes[junction],t=(116-a[1])/(b[1]-a[1]);nodes[id]=[a[0]+t*(b[0]-a[0]),116];
  }
  // Centre sections measured between the two vector edges in the source PDF.
  for(const [r,c,x] of [['hR','hC',121.85],['fR','fC',314.6],['kR','kC',465.9]]){nodes[r]=[x,116];nodes[c][0]=x;}
  nodes.c14=[5,116];nodes.c32=[length-5,116];
  // J meets the side of 17/35, just short of threshold 35. Keep the published
  // runway length instead of inheriting the diagram's slight compression.
  const along=(nodes.j35[0]-crossStart[0])*Math.cos(angle)+(nodes.j35[1]-crossStart[1])*Math.sin(angle);
  nodes.j35=[crossStart[0]+along*Math.cos(angle),crossStart[1]+along*Math.sin(angle)];
  // G enters the GA apron before meeting its G1 taxilane. Split G1 at the
  // perpendicular projection of that entrance so both lines share one node.
  const gaA=chart([248,266]),gaB=nodes.gaSouth,gaV=gaB.map((v,i)=>v-gaA[i]);
  const gaT=Math.max(0,Math.min(1,gaV.reduce((n,v,i)=>n+(nodes.gaG[i]-gaA[i])*v,0)/gaV.reduce((n,v)=>n+v*v,0)));
  nodes.gaJunction=gaA.map((v,i)=>v+gaT*gaV[i]);
  const taxiways=network.edges.map(([id,from,to,via=[]])=>lane(id,[nodes[from],...via.map(chart),nodes[to]],['H','F','G','G1','J','17-access'].includes(id)?2.4:4.6,
    {from,to,cornerRadius:0,surface:id==='J'?'grass':'asphalt',reference:true}));
  const parking=GOLD_COAST_BAYS.map(b=>{
    const pin=b.pin,c=Math.cos(b.heading),d=Math.sin(b.heading);
    let join,access;
    if(b.group==='G1'){
      const points=taxiways.filter(t=>t.id==='G1'&&t.to==='gaJunction')[0].points;
      let best=Infinity,segment=0;
      for(let i=1;i<points.length;i++){
        const a=points[i-1],v=points[i].map((n,k)=>n-a[k]),t=Math.max(0,Math.min(1,v.reduce((n,x,k)=>n+(pin[k]-a[k])*x,0)/v.reduce((n,x)=>n+x*x,0)));
        const q=a.map((n,k)=>n+t*v[k]),dist=Math.hypot(q[0]-pin[0],q[1]-pin[1]);
        if(dist<best){best=dist;join=q;segment=i;}
      }
      // Align the final centreline to the actual GA stop; route through G1.
      access=[nodes.dE,nodes.dC,nodes.fC,nodes.aC,nodes.hotspot,nodes.gaG,nodes.gaJunction,...points.slice(segment).toReversed().slice(1),join];
      const heading=Math.atan2(pin[1]-join[1],pin[0]-join[0]);
      const position=pin.map((v,i)=>v-[Math.cos(heading),Math.sin(heading)][i]*b.maxLength*.34*s);
      return {...b,position,x:position[0],y:position[1],heading,headingDeg:heading*180/Math.PI,leadIn:[join,pin],access};
    }
    if(['1','2'].includes(b.group)){
      join=[pin[0]-18,pin[1]];access=[nodes.dE,nodes.aE,nodes.eNorth,[join[0],38],join];
    }else if(b.group==='30'){
      join=[235,pin[1]];access=[nodes.dE,nodes.aE,[244,43],[244,pin[1]],join];
    }else if(b.bay==='3L'){
      join=[pin[0]-c*10,pin[1]-d*10];access=[nodes.dE,nodes.aE,[245,47],join];
    }else{
      const t=(55-pin[1])/d;join=[pin[0]+c*t,55];
      access=join[0]<nodes.dE[0]?[nodes.dE,join]:[nodes.dE,...(join[0]>nodes.lE[0]?[nodes.lE]:[]),join];
    }
    return {...b,leadIn:[join,pin],access};
  });
  const terminalPolygon=geometry.terminal.map(chart);
  const geographic=p=>goldCoastGeographicPoint({latitudeSeconds:(-p.latitude-28.15)*3600,longitudeSeconds:(p.longitude-153.5)*3600});
  const helicopterParking=gaImage.helipads.map(p=>({...p,position:geographic(p),radius:p.markingDiameterM*s/2}));
  return {
    version:6,id:'gold-coast',name:'Gold Coast Airport',
    setting:'Bilinga coast · intersecting runways, general aviation & coastal terminal',
    metresToWorld:s,geographyScale:s,taxiwayWidthM:25,magneticHeading:139,headingPrecision:'operator-magnetic-bearing',
    departureThreshold:[length,116],bounds:bounds(-50,-115,550,230),
    terminalStyle:'linear-international',baseGround:'#a5bd82',authoredTaxiways:true,preserveRunwayIntersections:true,
    routeModel:'gold-coast',fixedReferenceRunway:true,explicitLandside:true,
    taxiGraph:{nodes,edges:taxiways},taxiways,referenceParking:parking,standSpecs:parking,parkingCapacity:GOLD_COAST_PARKING_CAPACITY,
    helicopterParking,parkingSurfaces:[gaImage.helicopterApron.map(geographic)],
    sharedParkingAreas:gaImage.sharedAreas.map(a=>({...a,polygon:a.polygon.map(geographic)})),
    observedGaAircraft:gaImage.observedAircraft.map(a=>({...a,position:geographic(a),heading:a.headingDeg*Math.PI/180})),
    imageryReference:{captureDate:gaImage.captureDate,provider:gaImage.provider,resolutionM:gaImage.resolutionM,positionalAccuracyM:gaImage.positionalAccuracyM},
    referencePavement:{rings:geometry.pavement.rings.map(r=>r.map(chart)),triangles:geometry.pavement.triangles.map(t=>t.map(chart))},
    holdShort:[nodes.aR[0]+(nodes.aC[0]-nodes.aR[0])*.65,116+(nodes.aC[1]-116)*.65],
    land:[[[-50,-64],[20,-77],[240,-78],[400,-88],[550,-89],[550,230],[-50,230]]],
    water:[
      {name:'Pacific Ocean',polygon:[[-55,-125],[560,-125],[560,-106],[400,-105],[240,-95],[20,-94],[-55,-81]]},
      {name:'Cobaki wetlands',polygon:[[40,191],[148,183],[232,200],[320,187],[450,196],[545,181],[560,240],[40,240]]}
    ],
    runways:[
      runway('main',['14','32'],[0,116],[length,116],2492,45,s),
      runway('short-cross',['17','35'],crossStart,crossEnd,582,18,s,
        {role:'cross',activeForGame:false,simulated:false,magneticHeading:173,precisePavement:true,protectedWidth:90*s,protectedExtension:45*s})
    ],
    aprons:[{id:'main-apron',polygon:[[237.55,57.8],[237.78,27.08],[237.86,23.23],[232.91,5.96],[267.91,-4.16],[269.35,.72],[266.47,6.06],[266.44,8.97],[262.14,9.12],[261.93,30.6],...[ [327.7,407.7],[313.3,415.9],[319.3,427],[312,430.6],[281,381],[250,326] ].map(chart)]},
      {id:'remote-apron',polygon:[[216.18,26.8],[237.78,27.08],[237.58,42.56],[218.25,42.27],[216.44,38.32],[216.14,34.58]]},
      {id:'ga-apron',scenic:true,polygon:geometry.pavement.rings[0].slice(49,82).map(chart)}],
    terminals:[{id:'passenger-terminal',name:'Domestic / international terminal',kind:'terminal',polygon:terminalPolygon,rect:extent(terminalPolygon),height:3}],
    referenceBuildings:GOLD_COAST_HANGARS,
    facilities:{tower:rect(towerX-4,towerY-4,8,8),handling:rect(478,-8,25,18),researchLab:rect(153,-29,26,19),cargo:rect(511,-27,36,21)},
    roads:[lane('eastern-avenue',[[-25,-39],[537,-39]],9),lane('gold-coast-highway',[[-40,-70],[535,-84]],12),
      lane('fire-response-access',[[fireX,fireY+5],[fireX-3,fireY+10]],2,{gameAdaptation:true})],
    landmarks:[
      placed('fire-station','Airport fire station',reference.fireStation,12,8),
      placed('fuel-compound','Aviation fuel compound',reference.fuel,13,13),
      placed('ndb','NDB',reference.ndb,5,5),placed('vor-dme','VOR / DME',reference.vor,8,8),
      landmark('parking','Terminal parking',252,-29,197,16),landmark('beach','Bilinga Beach',33,-93,442,8),
      landmark('town','Bilinga',205,-62,235,16),landmark('wetland','Cobaki Broadwater',90,211,366,12)],
    labels:[{text:'GA · SHARED LIGHT AIRCRAFT PARKING',x:123,y:13,detail:true},{text:'GA · LIGHT AIRCRAFT / HEL PARKING',x:185,y:-4,detail:true},{text:'REMOTE 30 / 30L / 30R',x:220,y:24,detail:true},{text:'FIRE STATION',x:fireX,y:fireY+11,detail:true},{text:'CONTROL TOWER',x:towerX,y:towerY+20,detail:true},
      {text:'FUEL',x:fuelX,y:fuelY+10,detail:true},{text:'17 / 35 · 582 × 18 m',x:crossEnd[0]+9,y:crossEnd[1]+3,detail:true}],
    sourceIds:['goldcoast-operator','goldcoast-airservices','goldcoast-apron','goldcoast-master-plan-2024'],
    caveat:'Gold Coast chart topology with published runway dimensions. Docking points, scenery heights and outlying game facilities are approximate. Upgrades change game capacity while the reference runway stays 2492 m. Not for navigation.',
    notes:['14/32 and 17/35 share the aircraft scale; their 34-degree crossing lies near midfield.',
      'Taxiways and grass islands follow the official aerodrome and apron charts, including the B/C/G/17 hotspot and grass J.',
      'Published parking coordinates include terminal MARS alternatives, remote 30 and GA G1. Shared GA parking north of G has no fixed published bay count. H1–H3 and observed GA parking rows are located from Vantor satellite imagery captured 1 December 2025 (0.34 m imagery, stated positional accuracy 8.47 m). Parked aircraft illustrate observed occupancy, not fixed capacity.']
  };
}
