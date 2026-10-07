import {enhanceBrisbaneTerminals} from './brisbane-terminals.mjs';
import {BRISBANE_EXIT_CENTRELINES} from './brisbane-exit-centrelines.mjs';
import {BRISBANE_NORTH_CENTRELINES} from './brisbane-north-centrelines.mjs';
// Brisbane's chart-informed relationships are kept separate from the generic airport
// template. See brisbane-reference.mjs for independent chart calibration points.
import {brisbaneChartPoint as chart} from './brisbane-reference.mjs';
export function brisbaneConfig({bounds,rect,rectPolygon,building,landmark,lane,runway}) {
  const s=420/3560, tw=30*s;
  const taxi=(id,points,options={})=>lane(id,points,tw,{scenic:true,reference:true,cornerRadius:0,...options});
  const traced=(id,points,options={})=>taxi(id,points.map(chart),options);
  const onB=point=>[chart(point)[0],79];
  // Source pavement cross-sections, not an evenly spaced gate-grid network.
  const eastConnections=[
    ['A1',[[431.65,93],[431.65,100],[431.03,105],[428.39,110],[424,114],[420,116]],2],
    ['A3',[[326.18,93],[326.18,116]],0],
    ['A4',[[270.75,93],[270.75,116]],0],
    ['A4S',[[267,93],[259.18,96],[252.09,100],[245.12,104],[237.02,108],[226,112],[215.3,116]],2],
    ['A6',[[163.5,93],[171.5,96],[178.54,100],[185.41,104],[193.59,108],[204.5,112],[215.3,116]],2],
    ['A7',[[104.48,93],[104.48,116]],0],
    ['A9',[[-5.25,93],[-4.87,100],[-4.52,104],[-2.9,108],[.4,112],[6,116]],2]
  ];
  const result={
    version:3,id:'brisbane',name:'Brisbane Airport',setting:'Moreton Bay · International, Domestic & General Aviation',
    metresToWorld:s,geographyScale:s,taxiwayWidthM:30,magneticHeading:10,
    departureThreshold:[420,116],inboundLaneY:79,outboundLaneY:93,inboundY:79,outboundY:93,
    holdShort:[-4.52,104],holdShortLine:[-2.9,108],standVisualScale:.65,
    bounds:bounds(-185,-190,640,262),terminalStyle:'dual-terminal-hub',baseGround:'#a0bd84',explicitLandside:true,authoredTaxiways:true,
    standSpecs:[
      ...[-74,-52,-30,-8].map(x=>({x,y:65,apronId:'international-apron'})),
      ...[165,185,205,225,245,265].map((x,i)=>({x,y:[48,50,54,54,50,48][i],apronId:'domestic-apron'})),
      ...[385,407].map(x=>({x,y:28,apronId:'north-apron'}))
    ],
    land:[[[-185,-155],[80,-155],[156,-168],[350,-168],[555,-167],[597,-144],[603,-73],[580,-15],[547,13],[537,77],[496,124],[464,156],[455,242],[360,254],[187,246],[-185,249]]],
    water:[
      {name:'Moreton Bay',polygon:[[590,-205],[658,-205],[658,277],[440,277],[450,251],[464,166],[509,133],[550,84],[559,23],[593,-10],[619,-72],[612,-145]]},
      {name:'Kedron Brook Floodway',polygon:[[-190,-166],[77,-166],[155,-180],[357,-180],[557,-181],[606,-159],[600,-150],[555,-174],[351,-173],[157,-173],[80,-159],[-190,-159]]}
    ],
    runways:[
      runway('main',['01R','19L'],[0,116],[420,116],3560,45,s,{geographicalSide:'east',protectedWidth:18}),
      runway('western-parallel',['01L','19R'],[176.27,-119.86],[176.27+3300*s,-119.86],3300,60,s,
        {role:'parallel',geographicalSide:'west',activeForGame:false,simulated:false,realSeparationM:2000,approximateStaggerM:1510,protectedWidth:18})
    ],
    aprons:[
      {id:'international-apron',polygon:[[-88,49],[13,49],[28,70],[28,103],[-98,103],[-98,75]]},
      {id:'domestic-apron',polygon:[[151,31],[176,36],[197,40],[233,40],[254,36],[279,31],[289,70],[289,88],[145,88],[145,64]]},
      {id:'north-apron',polygon:[[366,-12],[424,-12],[424,89],[374,89],[374,38],[366,38]]},
      {id:'north-remote-apron',scenic:true,polygon:[[503,-14],[530,-20],[544,-6],[539,16],[512,20],[503,9]]},
      {id:'airline-maintenance-apron',scenic:true,polygon:[[25,158],[135,158],[135,189],[101,189],[99,192],[62,192],[60,179],[25,179]]},
      {id:'ga-maintenance-apron',scenic:true,polygon:rectPolygon(rect(239,164,78,32))},
      {id:'south-logistics-apron',scenic:true,polygon:rectPolygon(rect(-173,45,51,30))}
    ],
    taxiways:[
      taxi('A',[[-5.25,93],[431.65,93]],{scenic:false,purpose:'departure',family:'A'}),
      taxi('B',[[-92,79],[431.65,79]],{scenic:false,purpose:'arrival',family:'B'}),
      taxi('C',[[274.55,67.4],[316.1,67.4]],{maxCode:'E'}),
      ...[['C1',274.55],['C2',252.8],['C3',238.1],['C3T',220.5],['C4',202.8],['C5',188.4],['C6',166.5]].map(([id,x])=>taxi(id,[[x,60],[x,79]])),
      taxi('C8',[[44.7,79],[44.7,24]]),taxi('C9',[[-5,79],[-5,54]]),
      taxi('C10',[[-59,79],[-59,58]]),
      taxi('L',[[-92,79],[-111,84],[-130,70],[-145,60]],{cornerRadius:4}),taxi('C12',[[-145,60],[-162,60]]),
      ...eastConnections.map(([id,points,cornerRadius])=>taxi(id,points,{runwayId:'main',followsRunwayDevelopment:true,cornerRadius})),
      ...[['B1',431.65],['B2',396.16],['B3',326.18],['B4',270.75],['B5',215.26],['B6',159.86],['B7',104.48],['B8',30.62],['B9',-5.25]].map(([id,x])=>taxi(id,[[x,79],[x,93]])),
      taxi('S',[[172,-85.8],[548,-85.8]]),taxi('T',[[307,-97],[370.7,-97]]),
      // The chart's T is a short central link, not a second full parallel.
      // Exit mouths were measured from the source pavement polygon. T6/T7 and
      // T8/T9 share runway mouths and split toward different S connections.
      ...[
        ['T1',[[563.16,-120],[563.16,-114],[562.53,-110],[560.61,-106],[558.3,-102],[555.65,-97]],2],
        ['T2',[[548.77,-120],[548.77,-110],[547.52,-106],[545.52,-102],[542.9,-97]],2],
        ['T3',[[488.5,-120],[488.5,-97]],0],
        ['T4',[[457,-120],[488.5,-97]],0],
        ['T5',[[434.4,-120],[434.4,-97]],0],
        ['T6',[[403.3,-120],[434.4,-97]],0],
        ['T7',[[403.3,-120],[369,-97]],0],
        ['T8',[[338.2,-120],[369,-97]],0],
        ['T9',[[338.2,-120],[307,-97]],0],
        ['T10',[[307,-120],[307,-97]],0],
        ['T11',[[284.4,-120],[252.7,-97]],0],
        ['T12',[[252.7,-120],[252.7,-97]],0],
        ['T13',[[183.35,-119.86],[183.35,-97]],0],
        ['T14',[[176.27,-119.86],[172,-115.5],[172,-97]],3]
      ].map(([id,points,cornerRadius])=>taxi(id,points,{runwayId:'western-parallel',cornerRadius})),
      ...[[3,488.5],[5,434.4],[7,370.7],[10,307],[12,252.7],[13,183.35],[14,172]]
        .map(([n,x])=>taxi(`S${n}`,[[x,-97],[x,-85.8]])),
      taxi('S1',[[555.65,-97],[552.7,-91.5],[550.1,-87.6],[548,-85.8]],{cornerRadius:2}),
      taxi('S2',[[555.65,-97],[542.9,-97],[538.95,-90],[534,-85.8]],{cornerRadius:[0,0,2]}),
      taxi('Y',[[329,-85.8],[329,79]]),
      taxi('Z',[[339.95,-85.8],[339.95,93]]),
      taxi('Y1',[[329,67.4],[339.95,67.4]]),taxi('Y2',[[329,44.4],[339.95,44.4]]),taxi('Y3',[[329,15.1],[339.95,15.1]]),
      taxi('W',[[316.1,44.4],[316.1,79]]),
      taxi('W1',[[316.1,67.4],[329,67.4]]),taxi('W2',[[316.1,44.4],[329,44.4]]),
      taxi('D',[[431.65,79],[455.5,78.1],[459.8,78.1],[460.55,75.6],[488.2,24.8]],{cornerRadius:[0,0,2,2]}),
      taxi('D3',[[488.2,24.8],chart([296.5,173]),chart([294,151]),chart([291,147])],{cornerRadius:[0,2,2]}),
      taxi('E',[[448.06,68.675],[482.839,4.504]]),
      taxi('E1',[[448.06,68.675],[460.55,75.6]]),
      taxi('E2',[[465.25,36.51],[478.01,43.05]]),
      taxi('E3',[[475.414,18.203],[488.2,24.8]]),
      taxi('E4',[[482.402,5.31],[499.1,14.695]]),
      taxi('G1',[[410.65,64.15],chart([306,220]),[448.06,68.675]],{cornerRadius:[0,3]}),
      taxi('F1',[[410.65,28],[410.65,79]]),
      taxi('F2',[chart([273,231]),onB([302.5,246])]),
      taxi('F3',[[397.96,6.94],[452.69,6.94],[475.414,18.203]],{cornerRadius:3}),
      taxi('F4',[chart([256,224]),chart([272.8,190.5]),[482.839,4.504]],{cornerRadius:3}),
      taxi('H2',[[298.2,153],[297.7,185.35]]),
      taxi('H3',[[326.2,116],[326.2,136],[325,140],[321,143],[307,143.5],[303,144.8],[300.5,147],[299,151],[298.2,153]],{runwayId:'main',followsRunwayDevelopment:true,cornerRadius:2}),
      taxi('H4',[[270.75,116],[270.75,141.8],[290,141.8],[298.2,149],[298.2,153]],{runwayId:'main',followsRunwayDevelopment:true,cornerRadius:[0,7,4,4]}),
      taxi('H2N',[[297.7,185.35],[315,185.35],[317.5,186.5],[318.5,190.8],[329,192.6],[332,196.4]],{cornerRadius:2}),
      // Finish the painted approach on the forecourt, clear of building 285.
      // The previous rounded pavement cap extended through its apron wall.
      taxi('H2S',[[297.7,185.35],[238.3,185.35],[238.3,195.35]],{cornerRadius:2}),
      taxi('M',[[104.4,116],[104.4,163.5]],{runwayId:'main',followsRunwayDevelopment:true}),
      taxi('M1',[[104.4,163.5],chart([275.5,427]),chart([280.3,418.4]),chart([288,420.8])],{cornerRadius:[0,4,4]}),
      taxi('M2',[[104.4,163.5],chart([273,428]),chart([271.2,437]),chart([279,441])],{cornerRadius:[0,3,3]}),
      taxi('M3',[[104.4,163.5],[59.5,163.5],chart([263.5,453])],{cornerRadius:2})
    ],
    terminals:[
      {...building('international-terminal','International terminal',-81,26,60,17,'international'),heightScale:1.15},
      building('international-concourse','International boarding concourse',-83,43,85,6,'pier'),
      ...[-74,-52,-30,-8].map((x,i)=>building(`international-pier-${i}`,'International boarding pier',x-1.5,48,3,7,'pier')),
      building('domestic-headhouse','Domestic terminal headhouse',178,-2,62,14,'domestic'),
      ...[194,235].map((x,i)=>({...building(`domestic-connector-${i}`,'Domestic connecting concourse',x,10,5,16,'pier'),heightScale:.75})),
      {...building('domestic-terminal','Domestic terminal crescent',158,7,121,33,'domestic'),
        polygon:[[158,7],[165,19],[183,31],[201,37],[218,40],[235,37],[253,31],[271,19],[279,7],
          [271,7],[265,14],[250,25],[233,31],[218,33],[203,31],[186,25],[171,14],[166,7]]},
      ...[175,218,261].flatMap((x,i)=>[
        building(`domestic-link-${i}`,'Domestic boarding link',x-1.5,i===1?37:25,3,i===1?6:7,'pier'),
        {...building(`domestic-satellite-${i}`,'Domestic circular gate lounge',x-4,i===1?37:28,8,8,'satellite'),
          polygon:Array.from({length:20},(_,j)=>[x+Math.cos(j/20*Math.PI*2)*4,(i===1?41:32)+Math.sin(j/20*Math.PI*2)*4])}
      ])
    ],
    facilities:{tower:rect(152,-1,8,11),handling:rect(350,3,14,32),researchLab:rect(104,-59,20,14),cargo:rect(-166,24,31,18)},
    fictionalFacilities:['researchLab','cargo','handling'],
    roads:[
      lane('moreton-drive',[[-180,-115],[-30,-111],[76,-102],[138,-94],[160,-75],[277,-65]],6),
      lane('airport-drive',[[-180,-35],[-95,-20],[-33,6],[115,6],[151,-9],[173,-9],[254,-9],[278,-20]],5),
      lane('international-forecourt',[[-88,-17],[-88,20],[-15,20],[-15,6]],4),
      lane('domestic-forecourt',[[173,-9],[173,-13],[250,-13],[250,-9]],4),
      lane('domestic-parking-access',[[168,-74],[168,-55],[261,-55],[261,-23],[278,-20]],4),
      lane('airport-north-road',[[277,-65],[285,-48],[349,-48],[425,-48]],4,{underpasses:[[306,-48],[324,-48]]}),
      lane('lomandra-drive',[[-177,224],[120,230],[200,237],[340,237]],5)
    ],
    railways:[lane('airtrain',[[-178,-60],[-109,-21],[-61,11],[-5,11],[35,-4],[99,-4],[150,-27],[177,-20],[229,-20]],2)],
    stations:[{id:'international-station',name:'International Airtrain',x:-71,y:11,w:22,h:4},
      {id:'domestic-station',name:'Domestic Airtrain',x:205,y:-20,w:24,h:4}],
    landmarks:[
      landmark('parking','International parking',-78,-14,58,17),
      landmark('parking','Domestic P1 parking',180,-51,32,23,{decks:2,id:'domestic-p1'}),
      landmark('parking','Domestic P2 parking',218,-51,36,23,{decks:2,id:'domestic-p2'}),
      landmark('parking','Long stay parking',-135,-99,82,23),
      landmark('hangars','Airline maintenance',31,180,23,19,{id:'airline-south'}),
      landmark('hangars','Airline maintenance',68,193,27,17,{id:'airline-middle'}),
      landmark('hangars','Airline maintenance',106,190,26,18,{id:'airline-north'}),
      landmark('hangars','General aviation maintenance',252,198,58,21,{id:'ga-maintenance'}),
      landmark('industrial','Airport Central',52,-36,36,23),
      landmark('industrial','Airport South logistics',-171,100,46,34),
      landmark('wetland','Kedron Brook wetlands',34,-151,100,15),
      landmark('wetland','Northern mangroves',566,-114,22,48),landmark('wetland','Bay wetlands',501,35,23,47)
    ],
    labels:[{text:'INTERNATIONAL',x:-51,y:34},{text:'DOMESTIC',x:210,y:5},
      {text:'GENERAL AVIATION',x:357,y:18},{text:'NORTH REMOTE APRON',x:520,y:6,detail:true},
      {text:'MORETON BAY',x:603,y:11,terrain:true},{text:'KEDRON BROOK',x:378,y:-178,terrain:true},
      ...[['A',150,98],['B',150,84],['C',274,66],['S',455,-82],['T',455,-105],['Y',306,-27],['Z',324,-27],['D',469,38],['E',439,48]].map(([text,x,y])=>({text,x,y,detail:true})),
      {text:'AIRTRAIN',x:127,y:-23,detail:true}],
    sourceIds:['brisbane-operator','brisbane-airservices','brisbane-ground-movement','brisbane-domestic-apron','brisbane-north-apron','brisbane-precinct-map'],
    notes:['Buildings are positioned against independently calibrated chart anchors; outlines remain simplified.',
      'General aviation is beside the northern end of 01R/19L; Airport North remote apron is farther north via D/E, not connected directly to S.',
      'T/S, A/B/C and Y/Z preserve published network relationships and valid connector designations. Individual curves are simplified.',
      'Twelve saved game plots, research/cargo upgrades and aircraft eligibility remain fictional game choices.',
      'Aircraft and runway widths now share the Brisbane geographic scale. Only the developed eastern runway carries animated traffic.']
  };
  for(const t of result.taxiways)if(BRISBANE_EXIT_CENTRELINES[t.id])Object.assign(t,BRISBANE_EXIT_CENTRELINES[t.id]);
  for(const t of result.taxiways)if(BRISBANE_NORTH_CENTRELINES[t.id])Object.assign(t,BRISBANE_NORTH_CENTRELINES[t.id]);
  // Re-register existing precinct artwork to the measured runway polygon.
  // This corrects the earlier hand-picked threshold calibration without changing
  // saved plot IDs or the established architectural materials.
  const legacyPoint=([x,y])=>chart([211+(x*119+(y-116)*230)/420,466+(-x*230+(y-116)*119)/420]);
  const boxOf=polygon=>{const xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1]);return rect(Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))};
  const legacyRect=r=>boxOf(rectPolygon(r).map(legacyPoint));
  for(const t of result.taxiways.filter(t=>['H3','H4','M'].includes(t.id)))t.points[0][1]=116;
  result.land=result.land.map(p=>p.map(legacyPoint));
  result.water=result.water.map(w=>({...w,polygon:w.polygon.map(legacyPoint)}));
  result.aprons=result.aprons.map(a=>({...a,polygon:a.polygon.map(legacyPoint)}));
  result.aprons.push({id:'international-north-apron',scenic:true,polygon:[[0,20],[48,20],[53,30],[53,80],[0,80]]});
  result.standSpecs=result.standSpecs.map(s=>{const [x,y]=legacyPoint([s.x,s.y]);return {...s,x,y}});
  result.terminals=result.terminals.map(t=>({...t,rect:legacyRect(t.rect),...(t.polygon?{polygon:t.polygon.map(legacyPoint)}:{})}));
  const international=result.terminals.find(t=>t.id==='international-terminal');
  international.rect.x+=international.rect.w/2-18;international.rect.w=36;
  result.facilities=Object.fromEntries(Object.entries(result.facilities).map(([id,r])=>[id,legacyRect(r)]));
  result.landmarks=result.landmarks.map(l=>({...l,...legacyRect(l)}));
  // Keep the source hangar centres while replacing oversized precinct blocks
  // with building depths that leave their actual forecourts clear.
  for(const [id,w,h] of [['airline-south',20,10],['airline-middle',20,8],['airline-north',19,8],['ga-maintenance',92,12]]){
    const l=result.landmarks.find(l=>l.id===id);l.x+=(l.w-w)/2;l.y+=(l.h-h)/2;l.w=w;l.h=h;
  }
  result.aprons=result.aprons.filter(a=>!['airline-maintenance-apron','ga-maintenance-apron'].includes(a.id));
  for(const [id,pdfPoints] of [
    ['airline-north-apron',[[280,416],[295,419],[292,426],[282,423]]],
    ['airline-middle-apron',[[278,435],[290,440],[286,447],[276,442]]],
    ['airline-south-apron',[[262,451],[274,456],[270,464],[258,458]]],
    ['ga-maintenance-apron',[[338,311],[349,308],[323,364],[313,360]]]
  ])result.aprons.push({id,scenic:true,polygon:pdfPoints.map(chart)});
  for(const key of ['roads','railways'])result[key]=result[key].map(l=>({...l,points:l.points.map(legacyPoint),...(l.underpasses?{underpasses:l.underpasses.map(legacyPoint)}:{})}));
  result.stations=result.stations.map(s=>({...s,...legacyRect({...s,y:s.y-s.h/2})})).map(s=>({...s,y:s.y+s.h/2}));
  result.labels=result.labels.map(l=>{const [x,y]=legacyPoint([l.x,l.y]);return {...l,x,y}});
  const northRoad=result.roads.find(r=>r.id==='airport-north-road');
  northRoad.points=[[288,-66],[296,-49],[362,-49],[437,-49]];northRoad.underpasses=[[329,-49],[339.95,-49]];
  result.roads.find(r=>r.id==='moreton-drive').points=[[-180,-115],[-30,-113],[72,-109],[135,-106],[153,-95],[163,-74],[288,-66]];
  result.roads.find(r=>r.id==='domestic-parking-access').points=[[163,-74],[177,-68],[270,-68],[278,-30],[278,-20]];
  for(const id of ['A','B','C','S','T','Y','Z','D','E']){
    const label=result.labels.find(l=>l.text===id),t=result.taxiways.find(t=>t.id===id),p=t.points[Math.floor((t.points.length-1)/2)];
    if(label){label.x=(p[0]+t.points.at(-1)[0])/2;label.y=(p[1]+t.points.at(-1)[1])/2}
  }
  const chartBuilding=(id,name,pdfPoints,kind)=>{const polygon=pdfPoints.map(chart),r=boxOf(polygon);return {...building(id,name,r.x,r.y,r.w,r.h,kind),polygon}};
  const head=chartBuilding('domestic-headhouse','Domestic terminal headhouse',[[213.5,307.976],[217.9,310.276],[206.4,332.976],[202,330.676]],'domestic');
  const crescent=chartBuilding('domestic-terminal','Domestic terminal crescent',[[231.5,306.976],[233.6,311.076],[234.9,315.876],[235,320.576],[233.7,326.376],[230,332.876],[223.5,337.876],[219.2,339.476],[218,334.676],[221.5,333.776],[226.7,329.576],[230,323.076],[230.3,315.676],[227.7,309.576]],'domestic');
  result.terminals=result.terminals.filter(t=>!t.id.startsWith('domestic'));
  result.terminals.push(head,crescent,building('domestic-connector-0','Domestic connecting concourse',214,1,3.5,29,'pier'));
  for(const [i,pdf,root] of [[0,[222,347.2],[218,337.5]],[1,[240,332],[231,328.5]],[2,[241.5,308.5],[232,311]]]){
    const [x,y]=chart(pdf),a=chart(root),dx=x-a[0],dy=y-a[1],len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;
    const polygon=[[a[0]+nx,a[1]+ny],[x+nx,y+ny],[x-nx,y-ny],[a[0]-nx,a[1]-ny]],r=boxOf(polygon);
    result.terminals.push({...building(`domestic-link-${i}`,'Domestic boarding link',r.x,r.y,r.w,r.h,'pier'),polygon});
    result.terminals.push({...building(`domestic-satellite-${i}`,'Domestic circular gate lounge',x-2.5,y-2.5,5,5,'satellite'),polygon:Array.from({length:20},(_,j)=>[x+Math.cos(j/20*Math.PI*2)*2.5,y+Math.sin(j/20*Math.PI*2)*2.5])});
  }
  for(const index of [5,8])result.standSpecs[index].y=49;
  return enhanceBrisbaneTerminals(result);
}
