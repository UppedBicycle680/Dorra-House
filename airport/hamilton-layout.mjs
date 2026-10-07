import {HAMILTON_NEIGHBOURHOOD} from './hamilton-neighbourhood.mjs';
import {HAMILTON_GA_BUILDINGS,HAMILTON_GA_ACCESS} from './hamilton-ga.mjs';
import {HAMILTON_TOWER_RECT} from './hamilton-tower.mjs';
import {HAMILTON_ISLAND_LAND} from './hamilton-island-data.mjs';
import {HAMILTON_SCALE,HAMILTON_TERMINAL_POLYGON,HAMILTON_PAVEMENT,HAMILTON_BUILDINGS,hamiltonStandSpecs,hamiltonTaxiways,hamiltonPoint,hamiltonRect} from './hamilton-reference.mjs';
export function hamiltonConfig({bounds,runway}){
  const at=(p,w,h)=>{const [x,y]=hamiltonPoint(p);return {x:x-w/2,y:y-h/2,w,h}};
  return {
    id:'hamilton-island',name:'Hamilton Island Airport',setting:'Whitsunday island · marina, Catseye Beach and forested ridges',
    metresToWorld:HAMILTON_SCALE,taxiwayWidthM:23,magneticHeading:140,magneticVariation:8,northVector:[-.8,-.6],
    bounds:bounds(-410,-680,775,430),terminalStyle:'island-resort',baseGround:'#87a96c',fullIslandTerrain:true,
    neighbourhood:HAMILTON_NEIGHBOURHOOD,gaBuildings:HAMILTON_GA_BUILDINGS,routeModel:'hamilton',fixedReferenceRunway:true,explicitLandside:true,
    standSpecs:hamiltonStandSpecs(),referenceParking:hamiltonStandSpecs(),referenceBuildings:HAMILTON_BUILDINGS,
    referencePavement:HAMILTON_PAVEMENT,land:HAMILTON_ISLAND_LAND,
    runways:[runway('main',['14','32'],[0,116],[420,116],1766,45,HAMILTON_SCALE,{protectedWidth:150*HAMILTON_SCALE,protectedExtension:90*HAMILTON_SCALE,displacedStartM:60,displacedEndM:60})],
    turningPads:[[[0,110.65],[0,103.66],[12.82,103.66],[20.48,110.65]],[[420,121.35],[420,128.34],[407.18,128.34],[399.52,121.35]]],
    taxiways:hamiltonTaxiways(),aprons:[{id:'main-apron',polygon:HAMILTON_PAVEMENT.rings[0],holes:[HAMILTON_PAVEMENT.rings[1]]},{id:'western-apron',polygon:HAMILTON_PAVEMENT.rings[2]}],
    terminals:[{id:'island-terminal',name:'Hamilton Island passenger terminal',kind:'island-terminal',height:1.5,polygon:HAMILTON_TERMINAL_POLYGON,rect:hamiltonRect(HAMILTON_TERMINAL_POLYGON)}],
    facilities:{tower:HAMILTON_TOWER_RECT,handling:at([252,260],4,4),researchLab:at([252,260],4,4),cargo:at([252,260],4,4)},
    roads:[{id:'airport-road',points:[...[[147,127],[170,130],[205,145]].map(hamiltonPoint),...HAMILTON_GA_ACCESS[0].points.slice(1)],width:6*HAMILTON_SCALE},HAMILTON_GA_ACCESS[1]],
    landmarks:[{kind:'cliff',label:'Wooded eastern ridge and airport rock cut',x:55,y:-135,w:245,h:185,height:40}],
    sourceIds:['airservices-ybhm-ad','airservices-ybhm-apron','hamilton-airport-operations','casa-hamilton-aerial','openstreetmap-hamilton-neighbourhood'],
    notes:['Chart outlines and 1766 x 45 m runway share one scale. Seven saved plots map to published stands 1–6 and alternative 1A. Overlapping positions operate through scheduled sharing; oversized stand-6 aircraft use an airline bay.',
      'The complete island coast and surrounding footprints use OSM; relief uses Mapzen Terrain Tiles with airport grading and a tower platform. Fine architecture and rock cuts are approximate.',
      'Nearby villa, village, pool and marina footprints use OpenStreetMap geometry. Roofs, untagged building heights, gardens and boat occupancy are artistic approximations. © OpenStreetMap contributors, ODbL 1.0; https://www.openstreetmap.org/copyright'],
    caveat:'Chart-based airport layout · terrain and operations simplified for the game.'
  };
}
