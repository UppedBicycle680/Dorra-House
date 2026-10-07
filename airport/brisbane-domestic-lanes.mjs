// Road cross-sections [left kerb x,y, right kerb x,y], on the geographically
// registered 1600px aerial. Ordering follows the stated travel direction.
// Counts are observed lane bands, not a rule inferred from pavement width.
// Details hidden by roofs/shadows are separately identified in the audit.
export const DOMESTIC_LANE_SOURCE={
  image:'Esri GE01 2025-10-05; tmp/brisbane-domestic-area/aerial.json',
  continuations:[
    {id:'north-road-join',points:[[785,0],[769,-45],[755,-103]],width:18},
    {id:'staff-road-continuation',points:[[1203,3],[1254.375,-103.125],[1307.5,-220],[1350,-311.375],[1356.375,-370.875],[1337.25,-396.375],[1275.625,-424]],width:16},
    {id:'parking-inbound-join',points:[[455,1666],[434,1636],[413.5,1600]],width:11},
    {id:'parking-outbound-join',points:[[366.5,1598],[396,1660],[431,1700]],width:11},
  ],
  sections:[
    {id:'moreton-inbound',road:'domestic-airport-drive',name:'Moreton Drive inbound',directions:[1,1,1],stations:[
      [-14,1424,14,1436],[318,730,342,742],[367,630,392,642],[414,532,439,544],[447,468,474,482],[479,422,501,444],[523,389,538,415],[566,369,572,398],[608,366,607,396],[652,376,641,405],[694,394,681,422],[708,402,696,429]],arrows:[[454,493,472,463,'straight'],[550,393,567,386,'straight']]},
    {id:'public-entry',road:'domestic-airport-drive',name:'Airport Drive terminal entry',directions:[1,1,1],stations:[[757.21,430.47,746.79,457.53],[797.48,446.03,784.52,471.97],[855.1,478.45,836.9,503.55],[904.69,522.82,881.31,543.18],[946.74,585.07,921.26,598.93],[974.91,653.92,947.09,662.08],[991.92,740.52,964.08,743.48],[992.0,818.0,964.0,818.0]],arrows:[[910,558,920,576,'straight'],[964,697,969,715,'straight']]},
    {id:'public-south',road:'domestic-airport-drive',name:'Airport Drive southbound pickup carriageway',directions:[1,1,1],stations:[[991.6,821.32,964.4,814.68],[969.98,909.24,944.02,898.76],[922.37,992.99,899.63,975.01],[845.3,1068.13,826.7,1045.87],[769.32,1121.18,748.68,1100.82],[704.99,1209.23,681.01,1194.77],[639.52,1336.26,614.48,1323.74],[581.75,1455.78,556.25,1444.22],[517.86,1604.53,492.14,1593.47]],arrows:[[934,945,921,963,'straight'],[826,1062,809,1074,'straight'],[671,1240,661,1260,'straight']]},
    {id:'dryandra-north-out',road:'domestic-dryandra',name:'Dryandra northbound',directions:[1],stations:[
      [719,401,729,404],[741,353,751,357],[757,304,767,307],[769,252,779,253],[771,200,781,200],[769,149,779,149],[755,1,765,0]],arrows:[[759,324,765,304,'straight']]},
    {id:'dryandra-north-in',road:'domestic-dryandra',name:'Dryandra southbound and terminal turn approach',directions:[1,1],stations:[
      [785,0,773,1],[799,150,785,150],[798,201,785,200],[795,251,782,249],[784,303,770,300],[770,355,756,349],[750,407,735,400]],arrows:[[759,368,751,389,'right'],[754,367,746,388,'straight']]},
    {id:'dryandra-south',road:'domestic-p2-west',name:'Dryandra alongside P2',directions:[1,-1],stations:[
      [734,453,719,447],[705,512,689,505],[676,573,661,566],[646,634,631,627],[616,695,601,688],[586,756,571,749],[556,817,541,810],[526,878,511,871],[496,939,481,932],[483,965,468,958]],arrows:[[682,543,674,561,'straight'],[668,565,676,547,'straight']]},
    {id:'dryandra-hotel',road:'domestic-p2-west',name:'Dryandra P2 extension and hotel access',directions:[1,-1],stations:[
      [483,999,468,992],[467,1033,452,1026],[450,1071,435,1064],[443,1107,428,1106],[460,1142,447,1150],[487,1171,476,1183],[534,1205,523,1217]],arrows:[[446,1061,439,1080,'straight']]},
    {id:'p2-access-spine',road:'domestic-p1-p2-access',name:'Parking access between P1 and P2',directions:[1,-1],visibility:'partly shadowed beside structures',stations:[
      [842,639,829,634],[801,691,788,686],[771,751,758,746],[741,811,728,806],[711,872,698,867],[682,936,669,931],[660,997,647,992],[635,1059,622,1054],[610,1121,597,1116],[603,1210,589,1212]],arrows:[[637,1049,630,1067,'straight'],[622,1071,629,1053,'straight']]},
    {id:'p1-south-access',road:'domestic-p1-south',name:'P1 southern ground entry',directions:[1,-1],stations:[
      [660,1001,655,1012],[688,1023,682,1034],[720,1042,715,1053],[748,1050,748,1061],[773,1047,779,1057],[788,1035,797,1043],[803,1044,795,1052],[815,1058,807,1066]],arrows:[[739,1055,759,1055,'straight']]},
    {id:'parking-south-in',road:'domestic-p1-p2-access',name:'Parking and hotels inbound south of roundabout',directions:[1],stations:[
      [408,1600,419,1600],[452,1501,463,1506],[497,1400,508,1405],[527,1331,538,1336],[548,1288,559,1294]],arrows:[[487,1436,496,1417,'straight']]},
    {id:'parking-south-out',road:'domestic-p1-p2-access',name:'Parking exit south of roundabout',directions:[1],stations:[
      [527,1262,516,1263],[518,1290,507,1287],[491,1331,480,1327],[460,1400,449,1396],[415,1501,404,1497],[372,1600,361,1596]],arrows:[[473,1367,464,1387,'straight']]},
    {id:'stradbroke-west',road:'domestic-stradbroke-return',name:'Stradbroke northern return',directions:[1,-1],stations:[
      [780,280,791,287],[807,251,817,261],[840,226,848,239],[880,207,885,221],[925,193,927,209],[966,196,963,212],[1002,205,999,221]],arrows:[[859,226,840,238,'straight']]},
    {id:'stradbroke-north',road:'domestic-stradbroke-return',name:'Stradbroke continuation towards northern facilities',directions:[1,-1],stations:[
      [1078,214,1094,225],[1102,180,1116,189],[1136,125,1150,134],[1196,0,1210,7]],arrows:[[1135,144,1145,125,'straight']]},
    {id:'aero-north-loop',road:'domestic-north-loop',name:'Northern commercial access / Aero Road loop',directions:[1,-1],stations:[[1078.3,241.92,1073.7,254.08],[1123.93,259.2,1118.07,270.8],[1171.63,289.44,1162.37,298.56],[1194.37,331.71,1181.63,334.29],[1191.21,384.92,1178.79,381.08],[1158.74,449.06,1147.26,442.94],[1133.07,493.06,1124.93,482.94],[1063.83,525.85,1058.17,514.15],[1041.01,537.76,1034.99,526.24]],arrows:[[1184,360,1183,380,'straight'],[1152,452,1161,435,'straight']]},
    {id:'north-parking-exit',road:'domestic-north-loop',name:'Northern parking exit to terminal access',directions:[1],stations:[
      [923,480,928,490],[956,475,955,487],[987,482,982,493],[1017,505,1008,513],[1040,528,1032,537]],arrows:[[991,493,1006,505,'straight']]},
    {id:'north-parking-spur',road:'domestic-north-loop',name:'Northern parking circulation entry',directions:[1],stations:[
      [802,453,796,464],[840,474,835,485],[884,485,884,496],[923,480,928,490]],arrows:[[849,485,869,490,'straight']]},
    {id:'macleay-north-entry',road:'domestic-macleay',name:'MacLeay Way entry and merge',directions:[1],stations:[[851.57,488.77,840.43,493.23],[870.12,536.64,861.88,545.36],[898.16,535.06,899.84,546.94],[930.18,526.0,929.82,538.0],[968.5,538.12,961.5,547.88],[995.39,572.36,984.61,577.64],[1014.84,631.63,1003.16,634.37],[1016.0,659.78,1004.0,660.22]],arrows:[[993,589,999,609,'straight']]},
    {id:'macleay-north',road:'domestic-macleay',name:'MacLeay Way north kerbside lanes',directions:[1,1],stations:[
      [1016,658,1002,660],[1022,693,1008,695],[1028,733,1014,734],[1028,771,1014,770],[1024,810,1010,808],[1016,848,1002,844]],arrows:[[1018,713,1020,733,'straight']]},
    {id:'macleay-south',road:'domestic-macleay',name:'MacLeay Way south kerbside lanes',directions:[1,1],visibility:'Skywalk hides the middle connection',stations:[[1021.84,849.49,1008.16,846.51],[1016.46,873.69,1003.54,868.31],[975.89,959.78,964.11,952.22],[917.74,1027.16,908.26,1016.84],[838.68,1085.95,831.32,1074.05],[757.12,1126.66,748.88,1115.34],[700.62,1186.17,689.38,1177.83],[699.97,1202.7,686.03,1201.3]],arrows:[[961,968,947,985,'straight'],[804,1093,785,1102,'straight']]},
    {id:'taxi-north',road:'domestic-taxi-kerb',name:'Terminal taxi drop-off / commercial kerb',directions:[1,1],stations:[[1038.83,538.45,1037.17,525.55],[1004.63,540.26,993.37,533.74],[1021.94,567.36,1010.06,572.64],[1045.24,625.19,1032.76,628.81],[1063.45,710.21,1050.55,711.79],[1064.49,782.43,1051.51,781.57],[1055.4,834.13,1042.6,831.87]],arrows:[[1043,643,1047,663,'straight']]},
    {id:'taxi-south',road:'domestic-taxi-kerb',name:'Terminal taxi/bus south kerb and exit',directions:[1,1],visibility:'Skywalk hides the middle connection',stations:[[1055.18,835.01,1042.82,830.99],[1042.88,872.77,1031.12,867.23],[991.39,970.63,980.61,963.37],[928.35,1042.83,919.65,1033.17],[849.09,1098.72,842.91,1087.28],[764.2,1131.66,757.8,1120.34],[703.08,1181.06,694.92,1170.94]],arrows:[[1001,935,991,954,'straight'],[866,1080,847,1091,'straight']]},
  ],
  stoppingAreas:[
    {id:'macleay-north-stopping',a:[1001,674],b:[1010,738],width:9,spacing:5,side:-1},
    {id:'macleay-middle-stopping',a:[1009,791],b:[999,834],width:9,spacing:5,side:-1},
    {id:'macleay-south-stopping',a:[967,937],b:[910,998],width:9,spacing:5,side:-1},
    {id:'taxi-north-stopping',a:[1045,676],b:[1051,736],width:8,spacing:11,side:-1},
    {id:'taxi-south-stopping',a:[1006,950],b:[935,1025],width:8,spacing:11,side:-1},
  ],
  unmarkedAisles:[
    {id:'north-parking-aisle-1',points:[[865,271],[799,408]]},
    {id:'north-parking-aisle-2',points:[[896,266],[822,423]]},
    {id:'north-parking-aisle-3',points:[[922,277],[847,435]]},
    {id:'north-parking-aisle-4',points:[[948,289],[873,447]]},
    {id:'north-parking-aisle-5',points:[[974,301],[899,459]]},
    {id:'north-parking-aisle-6',points:[[1000,298],[925,457]]},
    {id:'north-parking-cross-aisle',points:[[782,411],[887,462],[911,467],[932,461]]},
    {id:'east-parking-aisle-1',points:[[1022,290],[961,419]]},
    {id:'east-parking-aisle-2',points:[[1047,302],[990,418]]},
    {id:'east-parking-aisle-3',points:[[1074,314],[1019,420]]},
    {id:'east-parking-cross-aisle',points:[[1080,352],[1123,378],[1135,402],[1117,426]]},
  ],
  junctions:[
    {id:'dryandra-moreton',polygon:[[696,425],[711,397],[730,400],[741,387],[760,400],[754,421],[779,440],[764,467],[741,456],[729,464],[714,454],[718,438]]},
    {id:'stradbroke-aero',polygon:[[998,204],[1009,193],[1035,206],[1055,204],[1078,194],[1098,209],[1087,233],[1078,261],[1062,247],[1038,244],[1021,229],[998,221]]},
  ],
  islands:[
    {id:'dryandra-central-hatch',kind:'hatch',polygon:[[781,154],[791,206],[786,252],[774,307],[753,367],[743,393],[739,390],[761,324],[775,270],[780,220]]},
    {id:'junction-left-slip',kind:'hatch',polygon:[[700,393],[719,397],[736,382],[726,405],[719,412]]},
    {id:'north-terminal-split',kind:'hatch',polygon:[[867,529],[894,535],[921,526],[937,526],[943,539],[923,544],[893,546],[881,554]]},
    {id:'stradbroke-west-gore',kind:'hatch',polygon:[[979,190],[1005,204],[1034,218],[1018,228],[1005,218]]},
    {id:'stradbroke-east-gore',kind:'hatch',polygon:[[1057,222],[1077,209],[1090,188],[1080,227],[1068,237]]},
    {id:'p2-south-gore',kind:'hatch',polygon:[[591,1107],[584,1149],[581,1178],[551,1168],[524,1172],[499,1178],[536,1187],[565,1182],[591,1191],[594,1170]]},
    {id:'roundabout-west-gore',kind:'hatch',polygon:[[492,1185],[505,1217],[513,1225],[517,1201]]},
    {id:'roundabout-south-gore',kind:'hatch',polygon:[[512,1266],[526,1290],[551,1293],[535,1281],[523,1257]]},
  ],
  roundabouts:[
    {id:'hotel-roundabout',centre:[562,1238],rx:43,ry:48,width:10},
    {id:'p2-extension-roundabout',centre:[461,978],rx:16,ry:20,width:7},
  ],
  ramps:[
    {id:'p2-express-ramp',name:'P2 northern access ramp',points:[[817,487],[832,517],[835,546],[831,578],[816,610],[805,634]],width:5,height:.8},
    {id:'p1-express-ramp',name:'P1 northern express ramp',points:[[826,490],[846,523],[852,553],[850,587],[839,617],[826,640]],width:5,height:1.4},
    {id:'parking-ground-entry',name:'Ground entry beside access ramps',points:[[836,495],[857,531],[865,562],[862,594],[847,628],[831,650]],width:6,height:0},
  ],
  // Individual stop/give-way controls, not full-road bars across opposing lanes.
  controls:[
    {id:'moreton-stop',kind:'stop',points:[[708,402],[696,429]]},
    {id:'dryandra-north-stop',kind:'stop',points:[[750,407],[735,400]]},
    {id:'dryandra-south-stop',kind:'stop',points:[[725,451],[719,447]]},
    {id:'aero-west-give-way',kind:'give-way',points:[[1047,235],[1038,240]]},
    {id:'parking-south-give-way',kind:'give-way',points:[[545,1288],[554,1293]]},
  ],
  crossings:[
    {id:'public-north-crossing',a:[956,762],b:[999,763],width:7},
    {id:'macleay-north-crossing',a:[1014,762],b:[1029,763],width:7},
    {id:'taxi-north-crossing',a:[1044,762],b:[1073,763],width:7},
    {id:'public-south-crossing',a:[915,931],b:[950,960],width:7},
    {id:'macleay-south-crossing',a:[950,958],b:[961,968],width:7},
    {id:'taxi-south-crossing',a:[993,978],b:[1004,988],width:7},
  ],
};

export function domesticLaneGeometry(point,pixel){
  const polygon=p=>p.map(point);
  return {
    continuations:DOMESTIC_LANE_SOURCE.continuations.map(s=>({...s,points:polygon(s.points),width:s.width*pixel})),
    sections:DOMESTIC_LANE_SOURCE.sections.map(s=>{
      const left=s.stations.map(p=>point(p.slice(0,2))),right=s.stations.map(p=>point(p.slice(2,4))),n=s.directions.length;
      const at=f=>left.map((p,i)=>p.map((v,k)=>v+(right[i][k]-v)*f));
      return {...s,left,right,polygon:[...left,...right.toReversed()],
        lanes:s.directions.map((direction,i)=>({id:`${s.id}-${i+1}`,direction,points:direction===1?at((i+.5)/n):at((i+.5)/n).toReversed()})),
        dividers:Array.from({length:n-1},(_,i)=>({points:at((i+1)/n),kind:s.directions[i]===s.directions[i+1]?'dash':'double'})),
        arrows:(s.arrows||[]).map(a=>({a:point(a.slice(0,2)),b:point(a.slice(2,4)),kind:a[4]}))};
    }),
    junctions:DOMESTIC_LANE_SOURCE.junctions.map(s=>({...s,polygon:polygon(s.polygon)})),
    islands:DOMESTIC_LANE_SOURCE.islands.map(s=>({...s,polygon:polygon(s.polygon)})),
    roundabouts:DOMESTIC_LANE_SOURCE.roundabouts.map(s=>{
      const ring=(rx,ry)=>Array.from({length:64},(_,i)=>point([s.centre[0]+Math.cos(i/64*Math.PI*2)*rx,s.centre[1]+Math.sin(i/64*Math.PI*2)*ry]));
      return {...s,centre:point(s.centre),outer:ring(s.rx+s.width/2,s.ry+s.width/2),inner:ring(s.rx-s.width/2,s.ry-s.width/2),lane:ring(s.rx,s.ry)};
    }),
    ramps:DOMESTIC_LANE_SOURCE.ramps.map(s=>({...s,points:polygon(s.points),width:s.width*pixel})),
    stoppingAreas:DOMESTIC_LANE_SOURCE.stoppingAreas.map(s=>({...s,a:point(s.a),b:point(s.b),width:s.width*pixel,spacing:s.spacing*pixel})),
    unmarkedAisles:DOMESTIC_LANE_SOURCE.unmarkedAisles.map(s=>({...s,points:polygon(s.points),width:7*pixel})),
    controls:DOMESTIC_LANE_SOURCE.controls.map(s=>({...s,points:polygon(s.points)})),
    crossings:DOMESTIC_LANE_SOURCE.crossings.map(s=>({...s,a:point(s.a),b:point(s.b),width:s.width*pixel})),
  };
}
