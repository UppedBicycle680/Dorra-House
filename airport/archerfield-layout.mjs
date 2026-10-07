import {ARCHERFIELD_SCALE as scale,archerfieldChartPoint as p,chartPixel as px,referencePavement,referenceBuildings,runwayReferencePolygons,polygonRect,ARCHERFIELD_APRONS,ARCHERFIELD_TAXIWAYS,archerfieldStandSpecs} from './archerfield-reference.mjs';
import {ARCHERFIELD_HANGARS,ARCHERFIELD_HANGAR_PARKING,hangarReferenceBuildings,replacedHangarSitePaths} from './archerfield-hangars.mjs';
import {archerfieldSurfaceWidths} from './archerfield-surface-widths.mjs';
export function archerfieldConfig({bounds,rect,lane,runway}){
 const main=runway('main',['10L','28R'],[0,116],[300,116],1727,30,scale,{displacedStartM:150,displacedEndM:227,declaredDistancesM:{runway10LTora:1556,runway28RTora:1577},protectedWidth:90*scale});
 const south=runway('south-parallel',['10R','28L'],p([88.6,348.026]),p([253.2,400.726]),1100,30,scale,{role:'parallel',activeForGame:false,sealedWidthM:18,protectedWidth:90*scale});
 const grass=(id,designators,a,b,length,options={})=>runway(id,designators,p(a),p(b),length,30,scale,{role:'cross',surface:'grass',activeForGame:false,protectedWidth:90*scale,...options});
 // Master Plan building 28 is the stepped footprint southwest of Hangar 6.
 // Path 21455 is Hangar 6; path 21432 is a separate landside office.
 const terminal=referenceBuildings.find(b=>b.sourcePath===21454),towerPos=px([493,1120]),north=p([67.5,313.026]).map((n,i)=>n-[0,116][i]),northLength=Math.hypot(...north);
 const hangar101=ARCHERFIELD_HANGARS.find(h=>h.id==='hangar-101');
 return {version:5,id:'archerfield',name:'Archerfield Airport',setting:'Archerfield · chart-aligned runways, hangars & aprons',
  metresToWorld:scale,taxiwayWidthM:15,magneticHeading:100,northVector:north.map(v=>v/northLength),
  bounds:bounds(-25,-115,335,190),baseGround:'#a4bf78',terminalStyle:'heritage',
  routeModel:'archerfield',fixedReferenceRunway:true,authoredTaxiways:true,explicitLandside:true,referenceFacilities:true,depthSortedTraffic:true,
  referencePavement,referenceBuildings:hangarReferenceBuildings.filter(b=>b!==terminal),runwayReferencePolygons,
  hangars:ARCHERFIELD_HANGARS,hangarParking:ARCHERFIELD_HANGAR_PARKING,replacedHangarSitePaths,
  surfaceWidthCorrections:archerfieldSurfaceWidths,
  standSpecs:archerfieldStandSpecs(),taxiRouting:{inboundId:'H',outboundId:'B',connectorIds:['B1','B8']},
  holdShort:px([218,815]),holdShortLine:px([218,815]),
  land:[[[160,790],[387,743],[614,646],[651,477],[877,494],[975,564],[884,1188],[456,1140],[146,1010]].map(px)],
  runways:[main,south,grass('grass-west',['04L','22R'],[147.55,326.826],[300.8,205.326],1245,{displacedEndM:290}),grass('grass-east',['04R','22L'],[186.35,339.126],[321.75,231.726],1100)],
  aprons:[...ARCHERFIELD_APRONS,...ARCHERFIELD_HANGARS.filter(h=>h.forecourt).map(h=>h.forecourt)],taxiways:ARCHERFIELD_TAXIWAYS,
  terminals:[{...terminal,id:'heritage-terminal',name:'Heritage terminal · Building 28',kind:'heritage',height:2.35}],
  facilities:{tower:{...rect(towerPos[0]-.7,towerPos[1]-.7,1.4,1.4),referenceOnly:true},
   handling:{...referenceBuildings.find(b=>b.sourcePath===21869).rect,referenceOnly:true},researchLab:{...referenceBuildings.find(b=>b.sourcePath===21432).rect,referenceOnly:true},cargo:{...referenceBuildings.find(b=>b.sourcePath===21905).rect,referenceOnly:true}},
  roads:[lane('beatty-road',[[975,564],[884,1188]].map(px),3),lane('southern-access',[[319.0308,162.8006],[319.0308,166.5],[288,172],[266,176],[108.0317,204.8]],2)],
  landmarks:[],aircraftParking:[...hangar101.exteriorParking,
   ...[[231,810],[249,816],[852,813],[849,831],[846,849],[743,1132.5],[771,1150.1],[810,1143.8],[917,670]].map((q,i)=>{const position=px(q);return {id:'GA'+(i+1),position,grassParking:i>=2,apronId:i>=2&&i<=4?'hotel-apron':i<2?'western-apron':i===8?'northern-apron':'southern-apron',heading:archerfieldStandSpecs()[0].heading,rect:polygonRect([px([q[0]-3,q[1]-3]),px([q[0]+3,q[1]+3])]),leadIn:[position,position],aircraftId:'c172'};})],
  helipads:[{id:'central-helipad',position:px([672,872]),radius:1.9},{id:'northern-helipad',position:px([894,635]),radius:1.9}],
  sourceIds:['archerfield-operator','archerfield-airservices'],
  notes:['Geographic pavement and base building footprints extracted from Airservices BAFAD01-180; the cleared Hangar 101 site is updated from operator plans. All geometry uses one runway-calibrated scale.',
   'Named hangars 001–006 and 101 have airside doors and illustrative aircraft storage. Hangar 101 compartments follow the published floor plan; older interiors are simplified. Detail zoom shows a roof cutaway.',
   'Five playable allocations within the sealed Eastern Apron and scenic aircraft are game abstractions, not current stand or tenant assignments. Generalized source maps do not establish survey-grade boundaries.',
   'Fixed 1727 m physical runway geometry; game runway upgrades retain their existing economy. Grass runways remain visible as open real-world infrastructure.']};
}
