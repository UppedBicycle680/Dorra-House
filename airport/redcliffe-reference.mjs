// Manual roof/apron samples from the preserved 1800 x 1300 aerial export.
// Source: City of Moreton Bay imagery, 10 June 2024, served by Esri World Imagery.
// The renderer uses original geometry only; no aerial imagery is shipped in-game.
export const REDCLIFFE_SOURCE = Object.freeze({
  imagery:'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
  imageDate:'2024-06-10',retrieved:'2026-09-08',width:1800,height:1300,
  attribution:'City of Moreton Bay / Esri World Imagery',
  runway25:[1445,227],runway07:[78,549],worldRunwayLength:300,
  fuelListing:'https://maps.apple.com/place?auid=1254899322660595919&lsp=9902',
  fuelOperator:'https://www.world-kinect.com/world-fuel/aviation/country-pages/australia-and-new-zealand-aviation/extensive-network-australia/redcliffe-world-fuel',
  fuelLatLon:[-27.206328,153.071046],fuelPinPixel:[1152.982,526.347],
  extent:{xmin:17039006.538781624,ymin:-3149799.745623368,xmax:17040231.05318035,ymax:-3148915.3741131756}
});
export function redcliffeAerialPoint([x,y]){
  const a=REDCLIFFE_SOURCE.runway25,b=REDCLIFFE_SOURCE.runway07,dx=b[0]-a[0],dy=b[1]-a[1],q=dx*dx+dy*dy;
  return [((x-a[0])*dx+(y-a[1])*dy)/q*300,116+(-(x-a[0])*dy+(y-a[1])*dx)/q*300];
}
export function redcliffeWorldToAerial([x,y]){
  const a=REDCLIFFE_SOURCE.runway25,b=REDCLIFFE_SOURCE.runway07;
  return [a[0]+(x*(b[0]-a[0])-(y-116)*(b[1]-a[1]))/300,a[1]+(x*(b[1]-a[1])+(y-116)*(b[0]-a[0]))/300];
}
// Legacy overview groups are retained as stable game-facility anchors.
// Rendered individual roofs and collision QA use redcliffe-hangars.mjs.
export const REDCLIFFE_ROOFS = [
  ['runway-side-west',[[862,584],[943,565],[951,598],[870,617]],3],
  ['runway-side-middle',[[950,564],[1039,544],[1046,577],[957,597]],4],
  ['runway-side-east',[[1047,544],[1124,527],[1132,560],[1054,578]],3],
  ['western-long-row',[[882,650],[935,637],[969,763],[914,777]],6],
  ['middle-long-row',[[978,633],[1027,622],[1061,747],[1013,760]],5],
  ['eastern-long-row',[[1082,611],[1134,599],[1164,729],[1108,743]],5],
  ['western-detached',[[830,748],[855,742],[866,784],[841,790]],1],
  ['central-north',[[1178,611],[1232,597],[1244,650],[1190,664]],1],
  ['central-south',[[1192,668],[1246,654],[1257,707],[1205,721]],2],
  ['central-narrow',[[1278,628],[1309,620],[1326,678],[1294,688]],1],
  ['helicopter-maintenance',[[1319,574],[1387,558],[1400,615],[1333,631]],1],
  ['helicopter-south',[[1333,638],[1397,622],[1409,665],[1344,681]],2],
  ['east-long-west',[[1422,550],[1472,539],[1493,634],[1442,647]],5],
  ['east-long-east',[[1490,535],[1537,524],[1563,629],[1512,641]],4],
  ['club-west',[[1574,549],[1615,539],[1625,578],[1584,590]],1]
].map(([id,pixels,doors])=>({id,pixels,polygon:pixels.map(redcliffeAerialPoint),doors}));
export const REDCLIFFE_CLUB_FRAME={width:1400,height:1300,xmin:17040048.8144746,ymin:-3149363.811391625,xmax:17040224.04875175,ymax:-3149201.0938485595};
export function redcliffeClubPoint([x,y]){
  const e=REDCLIFFE_CLUB_FRAME,s=REDCLIFFE_SOURCE.extent;
  return redcliffeAerialPoint([(e.xmin+x/e.width*(e.xmax-e.xmin)-s.xmin)/(s.xmax-s.xmin)*1800,(s.ymax-e.ymax+y/e.height*(e.ymax-e.ymin))/(s.ymax-s.ymin)*1300]);
}
export const REDCLIFFE_CLUB = [[550,535],[758,485],[798,657],[590,705]].map(redcliffeClubPoint);
// The adjacent club hangar is part of this detailed precinct pass. Preserve
// its stable ID, replacing only the older overview geometry and roof axes.
const clubHangar=REDCLIFFE_ROOFS.find(r=>r.id==='club-west');
clubHangar.polygon=[[196,699],[405,651],[451,886],[249,934]].map(redcliffeClubPoint);
clubHangar.pixels=clubHangar.polygon.map(redcliffeWorldToAerial);
clubHangar.doors=2;
// Independent detailed aerial traces, same 10 June 2024 imagery as overview.
export const REDCLIFFE_CLUB_AREA={
  annex:[[420,613],[483,600],[500,665],[437,680]].map(redcliffeClubPoint),
  annexAwning:[[426,587],[477,576],[483,600],[430,612]].map(redcliffeClubPoint),
  entrance:[[695,680],[703,686],[716,688],[731,686],[742,681],[751,668]].map(redcliffeClubPoint),
  terrace:[[560,486],[746,443],[757,485],[550,535]].map(redcliffeClubPoint),
  lawn:[[360,492],[741,400],[813,705],[438,790]].map(redcliffeClubPoint),
  carpark:[[439,766],[777,690],[824,885],[492,954],[447,1021],[351,1061],[346,1018],[452,921]].map(redcliffeClubPoint),
  storage:[[778,691],[805,685],[832,797],[802,805]].map(redcliffeClubPoint),
  paths:[[[395,484],[417,574],[431,608]],[[482,601],[550,584]],[[548,540],[589,739]],[[487,449],[510,441],[495,399]]].map(q=>q.map(redcliffeClubPoint)),
  crossing:[[481,307],[508,302],[527,389],[500,396]].map(redcliffeClubPoint),
  fences:[[[432,767],[356,486],[479,457]],[[524,447],[909,355]]].map(q=>q.map(redcliffeClubPoint)),
  palms:[[487,460],[517,462],[606,468],[650,451],[695,439],[739,428]].map(redcliffeClubPoint),
  trees:[[864,556],[890,469],[930,434],[953,605],[889,749],[960,793],[1005,800],[971,922],[860,984],[750,1000],[658,1040],[546,1055]].map(redcliffeClubPoint),
  cars:[[477,786],[503,780],[551,770],[617,752],[644,747],[670,741],[758,777]].map(redcliffeClubPoint),
  benches:[[[578,508],[598,503]],[[615,500],[636,495]]].map(q=>q.map(redcliffeClubPoint)),
  access:[redcliffeAerialPoint([1460,668]),...[[88,1191],[264,1140],[369,1060],[425,963],[540,897]].map(redcliffeClubPoint)]
};
export const REDCLIFFE_APRONS = [
  // Southern edge refined against the detailed club export: the former
  // overview trace clipped about two metres from the marked parking frontage.
  {id:'east-apron',pixels:[[1390,464],[1687,398],[1702,475.3],[1408,546.3]]},
  {id:'west-apron',pixels:[[840,625],[1382,510],[1394,535],[846,651]]},
  {id:'fuel-apron',pixels:[[1147,533],[1200,519],[1207,552],[1153,565]]},
  {id:'helicopter-pad-2',pixels:[[1198,518],[1262,504],[1270,541],[1207,554]]},
  {id:'helicopter-pad-1',pixels:[[1310,480],[1334,474],[1344,522],[1320,528]]}
].map(a=>({...a,polygon:a.pixels.map(redcliffeAerialPoint)}));
// The source distinguishes marked hardstand positions from aircraft parked on
// grass. IDs below are internal keys, not invented painted stand numbers.
export const REDCLIFFE_BAYS = [
  [1448,470],[1485,463],[1523,454],[1545,447],[1588,437],[1614,432],[1688,435],
  [1640,480],[1617,485],[1519,511],[1496,515],[1444,533],[1424,537],
  [1570,350],[1571,381],[1574,402],[1668,350]
].map((pixel,i)=>({id:`reference-bay-${i+1}`,pixel,position:redcliffeAerialPoint(pixel),surface:i>=13?'grass':'sealed',occupied:[2,4,7,9,13,15].includes(i)}));
export const REDCLIFFE_FUEL_REFERENCE = {
  id:'west-jet-a1',label:'JET A1',
  // Dispenser/tank compound and concrete standing pad are both visible here.
  compound:[[1145,524],[1157,521],[1162,537],[1149,540]].map(redcliffeAerialPoint),
  dispenser:redcliffeAerialPoint([1154,539]),stand:redcliffeAerialPoint([1178,548]),
  pin:redcliffeAerialPoint(REDCLIFFE_SOURCE.fuelPinPixel)
};

// Complete 1000 x 1000 eastern installation export, retrieved 9 September
// 2026. Its returned Mercator extent registers the detail to the overview.
export const REDCLIFFE_EAST_FUEL_FRAME={width:1000,height:1000,xmin:17039924.605445661,ymin:-3149276.1940172161,xmax:17040030.997231938,ymax:-3149169.8022309402};
export function redcliffeEastFuelPoint([x,y]){
  const e=REDCLIFFE_EAST_FUEL_FRAME,s=REDCLIFFE_SOURCE.extent;
  return redcliffeAerialPoint([(e.xmin+x/e.width*(e.xmax-e.xmin)-s.xmin)/(s.xmax-s.xmin)*1800,(s.ymax-e.ymax+y/e.height*(e.ymax-e.ymin))/(s.ymax-s.ymin)*1300]);
}
export const REDCLIFFE_EAST_FUEL = {
  id:'east-avgas',label:'AVGAS',
  compound:[[550,354],[661,330],[696,525],[582,551]].map(redcliffeEastFuelPoint),
  walkway:[[514,395],[549,387],[582,551],[550,558]].map(redcliffeEastFuelPoint),
  frontSections:[[[582,493],[621,484],[626,516],[587,525]],[[661,475],[688,471],[697,502],[668,509]]].map(q=>q.map(redcliffeEastFuelPoint)),
  fittings:[[570,369],[615,362],[605,380],[568,408]].map(redcliffeEastFuelPoint),
  serviceRack:[[584,445],[626,437],[633,477],[592,486]].map(redcliffeEastFuelPoint),
  dispenser:redcliffeEastFuelPoint([640,510]),stand:redcliffeEastFuelPoint([640,612]),heading:0,
  // Shared apron standing space; the north edge is not a painted fuel box.
  pad:[[416,589],[763,501],[791,627],[444,715]].map(redcliffeEastFuelPoint)
};
REDCLIFFE_BAYS[0].position=REDCLIFFE_EAST_FUEL.stand;
REDCLIFFE_BAYS[0].pixel=redcliffeWorldToAerial(REDCLIFFE_EAST_FUEL.stand);
REDCLIFFE_BAYS[0].heading=REDCLIFFE_EAST_FUEL.heading;
export const REDCLIFFE_FUEL_BAYS=[REDCLIFFE_FUEL_REFERENCE,REDCLIFFE_EAST_FUEL];

// Higher resolution 07 export (1400 x 1400); translate into the same overview
// coordinate system through the independently returned map extents.
export const REDCLIFFE_07_FRAME={width:1400,height:1400,xmin:17039071.306807622,ymin:-3149420.1371371984,xmax:17039309.125075255,ymax:-3149182.3188695651};
export function redcliffe07Point([x,y]){
  const e=REDCLIFFE_07_FRAME,s=REDCLIFFE_SOURCE.extent;
  return redcliffeAerialPoint([(e.xmin+x/e.width*(e.xmax-e.xmin)-s.xmin)/(s.xmax-s.xmin)*1800,(s.ymax-e.ymax+y/e.height*(e.ymax-e.ymin))/(s.ymax-s.ymin)*1300]);
}
export const REDCLIFFE_07_TURN={
  id:'07-turn-runup',
  polygon:[[737,801],[779,994],[796,1054],[815,1094],[850,1126],[892,1145],[935,1153],[980,1153],[1120,1121],[1120,1058],[1093,1049],[1052,1031],[1012,1009],[981,979],[958,946],[934,921],[907,905],[883,901],[854,909],[829,916],[812,913],[797,905],[786,893],[779,877],[761,796]].map(redcliffe07Point),
  // This is the short L marking inside the widened turn, not another taxiway.
  runupMark:[[880,906],[900,1001],[907,1022],[921,1028],[1008,1007]].map(redcliffe07Point),
  centreline:[[758,900],[790,1036],[805,1078],[831,1100],[870,1119],[915,1129],[970,1123],[1120,1084]].map(redcliffe07Point)
};

// Widened runway mouths: a single throat at each connection, with fillets
// spreading along the runway edge. These do not add a parallel entry taxiway.
export const REDCLIFFE_25_MOUTH={id:'25-D-mouth',polygon:[[1290,276],[1304,273],[1320,275],[1330,286],[1337,319],[1355,315],[1349,287],[1350,276],[1358,266],[1376,258]].map(redcliffeAerialPoint)};
export const REDCLIFFE_C_MOUTH={id:'C-runway-mouth',polygon:[[600,442],[621,436],[640,438],[650,447],[659,479],[675,475],[669,446],[671,433],[680,424],[705,415]].map(redcliffeAerialPoint)};
// The C/A junction's two curved shoulders, interpreted from the same aerial.
export const REDCLIFFE_C_JUNCTION={id:'C-A-junction',polygon:[[171.77,88],[174.23,88],[174.23,84],[174.8,82],[176,80.3],[178,79.23],[181,79.23],[181,76.77],[165,76.77],[165,79.23],[168,79.23],[170,80.3],[171.2,82],[171.77,84]]};
export const REDCLIFFE_07_MOUTH={id:'07-B-mouth',polygon:[[573,560],[607,563],[637,574],[657,591],[670,616],[704,757],[763,744],[732,603],[733,570],[743,542],[764,523],[797,506],[826,496]].map(redcliffe07Point)};
