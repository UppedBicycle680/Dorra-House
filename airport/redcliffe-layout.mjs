import {redcliffeAerialPoint as p,REDCLIFFE_APRONS,REDCLIFFE_ROOFS,REDCLIFFE_CLUB,REDCLIFFE_CLUB_AREA,REDCLIFFE_BAYS,REDCLIFFE_07_TURN,REDCLIFFE_25_MOUTH,REDCLIFFE_07_MOUTH} from './redcliffe-reference.mjs';
const box=polygon=>{const xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1]);return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}};
import {REDCLIFFE_HANGAR_PAVEMENTS} from './redcliffe-ground.mjs';
import {REDCLIFFE_C_MOUTH,REDCLIFFE_C_JUNCTION} from './redcliffe-reference.mjs';
export const REDCLIFFE_ACTIVE_BAYS=[1,2,4,5];
export function redcliffeConfig({bounds,rect,building,lane,runway}){
  const s=300/853,width=7*s;
  const roof=id=>({...box(REDCLIFFE_ROOFS.find(r=>r.id===id).polygon),referenceOnly:true});
  return {
    version:4,id:'redcliffe',name:'Redcliffe Airport',setting:'Redcliffe · hangar rows, two fuel bays & 07 run-up',
    metresToWorld:s,geographyScale:s,taxiwayWidthM:7,magneticHeading:246,standVisualScale:.24,
    taxiwayNetwork:'redcliffe',referenceFacilities:true,apronJunctionX:25,arrivalExitX:260,
    inboundLaneY:59,inboundY:59,outboundLaneY:78,outboundY:78,holdShort:[25,98],holdShortLine:[25,101.5],
    referencePavements:[REDCLIFFE_07_TURN,REDCLIFFE_25_MOUTH,REDCLIFFE_07_MOUTH,REDCLIFFE_C_MOUTH,REDCLIFFE_C_JUNCTION],preserveRunwayIntersections:true,
    hangarPavements:REDCLIFFE_HANGAR_PAVEMENTS,
    standHeading:Math.PI/2,bounds:bounds(-85,-75,335,165),terminalStyle:'aero-club',explicitLandside:true,
    standSpecs:REDCLIFFE_ACTIVE_BAYS.map(index=>{const [x,y]=REDCLIFFE_BAYS[index].position;return {x,y,position:[x,y],apronId:'east-apron',heading:Math.PI/2,headingDeg:90}}),
    land:[[[ -78,145],[-78,12],[-62,-30],[-42,-69],[135,-69],[275,-51],[332,48],[332,144]]],
    water:[{name:'Deception Bay wetlands',polygon:[[-90,151],[340,151],[340,180],[-90,180]]}],
    runways:[runway('main',['25','07'],[0,116],[300,116],853,18,s,{protectedWidth:30})],
    aprons:REDCLIFFE_APRONS.map(a=>({id:a.id,polygon:a.polygon,scenic:a.id!=='east-apron'})),
    taxiways:[
      lane('A',[[25,78],REDCLIFFE_07_TURN.centreline.at(-1)],width,{cornerRadius:0}),
      lane('B',[...REDCLIFFE_07_TURN.centreline.toReversed(),[260,98],[260,116]],width,{cornerRadius:0}),
      lane('C',[[173,78],[173,116]],width,{cornerRadius:0}),
      lane('D',[[25,59],[25,116]],width,{cornerRadius:0}),
      lane('TWY EAST',[[-43,59],[25,59]],width,{cornerRadius:0}),
      lane('TWY WEST',[[25,59],[50,60.2],[145,60.2]],width,{cornerRadius:0})
    ],
    terminals:[{...building('club-terminal','Redcliffe Aero Club',0,0,1,1,'club'),rect:box(REDCLIFFE_CLUB),polygon:REDCLIFFE_CLUB,heightScale:.35}],
    facilities:{handling:roof('helicopter-maintenance'),researchLab:roof('central-north'),cargo:roof('central-south'),tower:{...box(REDCLIFFE_CLUB),referenceOnly:true}},
    roads:[lane('wirraway-drive',[[828,811],[1460,668],[1503,684],[1537,874]].map(p),4),
      lane('club-access',REDCLIFFE_CLUB_AREA.access,2.6)],
    landmarks:[],sourceIds:['redcliffe-airservices','redcliffe-moreton-bay-aerial','redcliffe-world-fuel-location'],
    notes:['Hangar roofs, eastern apron bays and west-side fuel compound are traced against dated Moreton Bay aerial imagery.',
      'Geography, aircraft and runway width share one scale; the 600/800 m game upgrade lengths remain independent.',
      'Four eastern parking positions host game traffic; the eastern refuelling position is reserved. D is the only runway 25 connection.',
      'The 07 run-up widening is traced inside the A/B turn. Only the interim short-runway exit remains a development-stage adaptation.',
      'No fictional control-tower building is added; its game upgrade is represented through the club footprint.']
  };
}
