import {GATEWAY_ID,GATEWAY_SCALE,GATEWAY_PRECINCTS,ribbonCentre,gatewayBank} from './queensland-gateway-data.mjs';

// Tidal Ribbon: one connected architectural spine, six double-sided gate arms,
// and two staggered banks. Career/plot IDs are intentionally unchanged.
export function queenslandGatewayConfig({bounds,rect,rectPolygon,building,landmark,lane,runway}) {
  const runways=[],taxiways=[],aprons=[],standSpecs=[],terminals=[],roads=[],railways=[],stations=[],landmarks=[],labels=[];
  const taxi=(id,points,width=7.2,shared=true)=>taxiways.push(lane(id,points,width,{cornerRadius:0,shared}));
  for(const p of GATEWAY_PRECINCTS) {
    const {id,side,y,runwayX:rx,runwayY:sy}=p,ey=sy+540,bank=gatewayBank(side);
    const arrivalX=rx+side*26,departureX=rx+side*44;
    runways.push(runway(p.runway,p.designators,[rx,sy],[rx,ey],4500,60,GATEWAY_SCALE,
      {role:p.runway==='main'?'primary':'parallel',fictional:true,protectedWidth:30,protectedExtension:20,precinct:id,side}));
    taxi(`${id}-PARALLEL-ARR`,[[arrivalX,bank.north],[arrivalX,bank.south]]);
    taxi(`${id}-PARALLEL-DEP`,[[departureX,bank.north],[departureX,bank.south]]);
    taxi(`${id}-ENTRY`,[[departureX,sy+12],[rx,sy+12],[rx,sy+30]],7.2,false);
    taxi(`${id}-EXIT`,[[rx,ey-30],[rx,ey-14],[arrivalX,ey-14],[arrivalX,ey+5]],7.2,false);
    for(const offset of [155,300,425])taxi(`${id}-RAPID-${offset}`,[[rx,sy+offset],[arrivalX,sy+offset+22]],6,false);
    const tip=side*310,root=ribbonCentre(y),x=Math.min(tip,root),w=Math.abs(tip-root);
    terminals.push({...building(`${id}-concourse`,p.name,x,y-9,w,18,'gateway-concourse'),height:6.8,colour:p.colour,precinct:id,side,root});
    aprons.push({id:`${id}-apron`,polygon:rectPolygon(rect(side<0?-329:76,y-76,253,152))});
    for(const flank of [-1,1]) {
      const inY=y+flank*51,outY=y+flank*65;
      taxi(`${id}-${flank}-APRON-IN`,[[bank.arrivalX,inY],[side*83,inY]],6);
      taxi(`${id}-${flank}-APRON-OUT`,[[bank.departureX,outY],[side*83,outY]],6);
      // Connect the two lanes at the closed end of each apron.
      taxi(`${id}-${flank}-APRON-TURN`,[[side*83,inY],[side*83,outY]],6);
      for(let i=0;i<16;i++) {
        const gx=side*(90+i*14),gy=y+flank*24,index=(flank===-1?0:16)+i;
        standSpecs.push({x:gx,y:gy,position:[gx,gy],rect:rect(gx-6,gy-7,12,14),
          heading:-flank*Math.PI/2,headingDeg:-flank*90,apronId:`${id}-apron`,runwayId:p.runway,
          precinct:id,referenceStand:`${id}${String(index+1).padStart(2,'0')}`,maxAircraftSpan:88.4*GATEWAY_SCALE,
          baselineRoutesOnly:false,jetwayAnchor:[gx-3,y+flank*9],cargo:id==='F',flank,side,taxiInY:inY,taxiOutY:outY});
      }
    }
    labels.push({text:p.name,x:side*195,y:y-3,detail:true},{text:p.role,x:side*205,y:y+84,detail:true});
  }
  // Clear passages outside both runway banks, and two cross-terminal links.
  for(const side of [-1,1]) {
    const b=gatewayBank(side),outer=side*634;
    taxi(`${side}-NORTH-END-AROUND`,[[outer,b.north],[b.arrivalX,b.north]]);
    taxi(`${side}-SOUTH-END-AROUND`,[[outer,b.south],[b.arrivalX,b.south]]);
    taxi(`${side}-ARRIVAL-SPINE`,[[b.arrivalX,b.north],[b.arrivalX,520]]);
    taxi(`${side}-DEPARTURE-SPINE`,[[b.departureX,b.north],[b.departureX,520]]);
  }
  taxi('NORTH-TRANSFER',[[-348,-270],[348,-270]]);
  taxi('SOUTH-TRANSFER',[[-362,520],[362,520]]);

  // Small joined loft sections give the continuous S-shaped building correct
  // depth ordering with the piers and aircraft, rather than a giant sprite.
  for(let y=-220;y<310;y+=10) {
    const y1=Math.min(y+10,310),a=ribbonCentre(y),b=ribbonCentre(y1);
    const polygon=[[a-29,y],[a+29,y],[b+29,y1],[b-29,y1]];
    terminals.push({id:`ribbon-${y}`,name:'Tidal Ribbon · central transfer galleria',kind:'gateway-ribbon',
      rect:rect(Math.min(a,b)-29,y,Math.abs(a-b)+58,y1-y),polygon,height:14,y0:y,y1,colour:'#528f96'});
  }
  terminals.push({...building('gateway-central-hall','Tidal Ribbon · arrivals and departures',-62,305,124,62,'gateway-central'),height:13,colour:'#528f96'},
    {...building('gateway-station-gallery','Central station · covered arrivals gallery',-12,364,24,51,'gateway-station'),height:7},
    {...building('gateway-central-station','Queensland Airport Express',-20,410,40,64,'gateway-station'),height:8});
  // A single landside address. Road and rail go beneath the southern taxi link.
  roads.push(lane('arrivals-west',[[-14,675],[-14,538]],7),lane('arrivals-underpass',[[-14,538],[-14,502]],7,{underground:true}),
    lane('arrivals-frontage',[[-14,502],[-14,488],[-70,488],[-70,386],[70,386],[70,488],[-14,488]],7),
    lane('drop-off',[[-70,386],[-70,376],[70,376],[70,386]],4),
    lane('west-logistics',[[-14,585],[-706,585],[-706,-410]],5),
    lane('east-logistics',[[-14,585],[726,585],[726,-190]],5),
    lane('hotel-boulevard',[[-70,445],[-180,445],[-180,490],[180,490],[180,445],[70,445]],5));
  railways.push(lane('express-mainline',[[12,675],[12,538]],2),lane('express-tunnel',[[12,538],[12,502]],2,{underground:true}),
    lane('express-arrival',[[12,502],[12,474]],2),lane('express-platform',[[12,474],[12,410]],2,{covered:true}),
    lane('terminal-people-mover',[[12,410],[12,364],[0,310],...Array.from({length:54},(_,i)=>{const y=310-i*10;return [ribbonCentre(y),y]})],2,{covered:true}));
  for(const side of [-1,1]) {
    for(let i=0;i<2;i++)terminals.push({...building(`gateway-hotel-${side}-${i}`,i?'Gateway business hotel':'Tidal Ribbon Grand',side<0?-168:100,402+i*53,58,30,'gateway-hotel'),height:i?16:23,colour:'#729f9e'});
    landmarks.push(landmark('parking','Terminal parking terraces',side<0?-278:206,407,65,78,{decks:3}),
      landmark('parking','Airport park and ride',side<0?-278:206,554,118,48));
  }
  // One western engineering district and one eastern logistics district.
  for(let i=0;i<6;i++) {
    const y=-365+i*67;
    landmarks.push(landmark('hangars',`Airline engineering hangar ${i+1}`,-697,y,47,34,
      {id:`MRO-${i}`,individualHangar:true,height:9,doorWidth:34,forecourt:rect(-697,y+34,58,20)}));
    taxi(`MRO-${i}-ACCESS`,[[-634,y+45],[-672,y+45]],7.2);
    aprons.push({id:`MRO-${i}-apron`,scenic:true,polygon:rectPolygon(rect(-697,y+34,65,20))});
    const fy=-145+i*75;
    terminals.push({...building(`freight-warehouse-${i}`,`Queensland freight distribution ${i+1}`,655,fy,52,29,'gateway-warehouse'),height:6});
  }
  landmarks.push(landmark('fuel-compound','Western aviation fuel reserve',-688,-430,35,35),
    landmark('fuel-compound','Eastern aviation fuel reserve',666,340,42,38),
    landmark('fire-station','West airfield rescue',-684,112,30,17),landmark('fire-station','East airfield rescue',661,402,30,17));
  const land=[[-732,-465],[-653,-572],[-315,-572],[-295,-352],[345,-352],[645,-352],[754,-180],[754,565],[714,615],[260,615],[145,675],[-155,675],[-299,615],[-730,615],[-755,530]];
  labels.push({text:'TIDAL RIBBON · QUEENSLAND GATEWAY',x:-52,y:598,terrain:true},
    {text:'AIRLINE ENGINEERING',x:-666,y:201,detail:true},{text:'QUEENSLAND FREIGHT CITY',x:681,y:318,detail:true},
    {text:'NORTH TRANSFER',x:0,y:-279,detail:true},{text:'AIRPORT EXPRESS',x:0,y:459,detail:true});
  return {
    id:GATEWAY_ID,name:'Queensland Gateway International',fictional:true,designName:'Tidal Ribbon',
    setting:'Tidal Ribbon · 6 staggered runways · 192 connected stands',routeModel:'queensland-gateway',
    metresToWorld:GATEWAY_SCALE,geographyScale:GATEWAY_SCALE,taxiwayWidthM:60,magneticHeading:90,
    fixedReferenceRunway:true,explicitLandside:true,authoredTaxiways:true,depthSortedTraffic:true,
    terminalStyle:'tidal-ribbon',cameraRotationDeg:-35,baseGround:'#afc291',bounds:bounds(-762,-592,784,685),land:[land],
    water:[{polygon:[[-5000,-5000],[5000,-5000],[5000,5000],[-5000,5000]]}],
    runwayCentreY:0,inboundLaneY:0,outboundLaneY:0,inboundY:0,outboundY:0,
    holdShort:[-605,-468],holdShortLine:[-601,-468],approachThreshold:[-590,-480],departureThreshold:[-590,60],
    runways,taxiways,aprons,standSpecs,terminals,roads,railways,stations,landmarks,labels,
    facilities:{tower:rect(182,-32,18,14),handling:rect(-144,300,30,26),researchLab:rect(98,323,32,25),cargo:rect(651,294,55,32)},
    precincts:GATEWAY_PRECINCTS,solarPark:rect(-533,345,150,84),
    sourceIds:['fictional-layout'],caveat:'Original fictional Queensland hub based on the selected Tidal Ribbon concept; not a navigation chart.',
    notes:['Legacy career and all 192 plot IDs are preserved.','Six double-sided concourses join one S-shaped ribbon terminal.',
      'Two staggered three-runway banks share end-around taxi routes; all six strips are 4,500 by 60 metres.',
      'The adjacent fictional runway numbers distinguish the banks; all six share the same drawn axis.','Road and rail pass beneath the south taxiway.']
  };
}
