import {REDCLIFFE_SOURCE,redcliffeAerialPoint} from './redcliffe-reference.mjs';

// Native pixels in the preserved 2000 x 1450 Moreton Bay aerial, 10 June 2024.
// Pavement boundaries are traced independently from roofs. Concrete door
// aprons meet asphalt access lanes; these polygons do not create traffic routes.
export const REDCLIFFE_GROUND_FRAME={width:2000,height:1450,xmin:17039538.739644844,ymin:-3149545.3062749407,xmax:17040177.52612754,ymax:-3149082.1860749871};
export function redcliffeGroundPoint([x,y]){
  const e=REDCLIFFE_GROUND_FRAME,s=REDCLIFFE_SOURCE.extent;
  return redcliffeAerialPoint([(e.xmin+x/e.width*(e.xmax-e.xmin)-s.xmin)/(s.xmax-s.xmin)*1800,(s.ymax-e.ymax+y/e.height*(e.ymax-e.ymin))/(s.ymax-s.ymin)*1300]);
}
const p=redcliffeGroundPoint;
export const REDCLIFFE_HANGAR_PAVEMENTS=[
  // D widens continuously into both aprons; its eastern flare is much wider
  // than the seven-metre taxiway. Trace the grass boundary, not the route.
  ['d-apron-junction','asphalt',[[1225,300],[1252,300],[1264,365],[1300,387],[1334,404],[1348,468],[1378,643],[1224,680],[1206,584],[1240,557],[1254,545],[1264,531],[1267,497],[1252,442],[1238,425],[1221,414],[1197,411],[1197,385],[1220,368],[1231,334]]],
  ['runway-row-front','asphalt',[[123,809],[183,786],[349,746],[360,742],[556,697],[565,694],[739,653],[748,703],[1277,581],[1303,617],[136,864]]],
  ['southern-apron-front','asphalt',[[136,864],[1303,617],[1342,633],[1359,659],[1130,710],[1014,738],[956,750],[843,779],[813,786],[749,754],[638,779],[613,785],[521,803],[417,826],[386,834],[325,834],[212,862],[161,880]]],
  ['western-outside-doors','concrete',[[155,877],[227,869],[283,1132],[246,1163],[212,1164],[187,1138]]],
  ['western-detached-door','concrete',[[153,1062],[181,1051],[205,1141],[173,1142]]],
  ['west-middle-doors','concrete',[[329,844],[425,828],[438,879],[440,884],[482,1091],[390,1107]]],
  ['middle-east-doors','concrete',[[528,799],[637,775],[647,823],[647,827],[670,929],[674,946],[679,954],[694,1035],[694,1060],[594,1069],[589,1061],[566,960],[564,954],[538,852],[537,851]]],
  ['central-west-doors','concrete',[[739,749],[790,748],[821,760],[843,779],[853,792],[860,825],[866,858],[878,894],[896,985],[900,1013],[813,1030],[793,1009],[779,930],[779,922],[776,904],[751,809],[750,805]]],
  ['central-service','asphalt',[[995,746],[1146,694],[1173,822],[1196,928],[1152,956],[1081,960],[1012,949]]],
  ['central-north-front','concrete',[[893,766],[886,740],[954,730],[949,753]]],
  ['central-north-south-doors','concrete',[[866,858],[902,860],[971,844],[983,880],[888,908]]],
  ['helicopter-front','concrete',[[1132,704],[1292,662],[1315,644],[1321,694],[1143,727]]],
  ['helicopter-cross-passage','concrete',[[1173,822],[1316,788],[1309,803],[1173,837]]],
  ['helicopter-east-access','asphalt',[[1279,677],[1338,645],[1380,873],[1335,894],[1326,883],[1318,849],[1305,789],[1299,767]]],
  ['helicopter-annex-access','concrete',[[1168,825],[1179,826],[1192,889],[1224,907],[1226,923],[1185,930]]],
  ['east-west-row-doors','concrete',[[1338,645],[1363,655],[1407,856],[1378,876]]],
  ['east-middle-doors','concrete',[[1438,638],[1508,620],[1556,828],[1554,843],[1514,828],[1483,838]]],
  ['east-outside-access','asphalt',[[1607,594],[1645,581],[1676,745],[1667,817],[1639,833]]],
  ['club-hangar-door','concrete',[[1659,630],[1675,646],[1695,739],[1678,758]]],
  // Darker asphalt spines remain inside the wider concrete door forecourts.
  ['west-spine','asphalt',[[350,840],[407,827],[480,1095],[427,1100]]],
  ['middle-spine','asphalt',[[551,797],[616,785],[684,1057],[613,1067]]],
  ['central-spine','asphalt',[[779,750],[819,764],[834,799],[876,1006],[817,1024]]],
  ['east-spine','asphalt',[[1475,626],[1501,620],[1550,837],[1520,830]]]
].map(([id,surface,pixels])=>({id,surface,pixels,polygon:pixels.map(p)}));

// Visible apron paint. Green separators are distinct from yellow movement
// and clearance lines. No invented U-boxes or animation-path lead-ins.
export const REDCLIFFE_APRON_LINES=[
  ['yellow',[[145,835],[738,711],[788,712],[822,704],[1045,649],[1236,605],[1268,591],[1288,570],[1294,552],[1293,533],[1285,500]]],
  ['yellow',[[1285,500],[1295,520],[1306,536],[1320,547],[1337,553],[1350,553],[1363,550]]],
  ['yellow',[[1353,510],[1763,419],[1791,408],[1807,390],[1815,370],[1818,353]]],
  ['yellow',[[1363,550],[1597.0,494.2],[1809.4,442.8],[1823.9,437.0],[1836.1,427.2],[1844.3,415.4],[1850.6,402.9],[1855.3,389.1],[1859.6,372.3],[1858,344]]],
  ['yellow',[[1347,632],[1340,609],[1428,590],[1433,613]]],
  ['yellow',[[1498,587],[1492,562],[1584,541],[1592,572]]],
  ['yellow',[[1654.6,561.2],[1646.8,520.4],[1885.1,466.0],[1918.0,431.5],[1904.3,372.3],[1900,338]]],
  ['green',[[1464,432],[1478,482]]],['green',[[1524,419],[1538,469]]],
  ['green',[[1560,411],[1574,461]]],['green',[[1607,400],[1621,450]]],
  ['green',[[1646.4,395.4],[1655.4,439.3]]],['green',[[1690.7,385.6],[1701.3,428.3]]],
  ['green',[[1738.1,375.0],[1748.3,417.8]]],['green',[[1784.3,364.8],[1794.1,407.6]]],
  ['green',[[1378,603],[1386,628]]],['green',[[1536,553],[1544,580]]],
  ['green',[[1691.5,509.5],[1700.5,547.9]]],['green',[[1738.9,498.9],[1749.1,537.7]]],
  ['green',[[1840.4,475.0],[1850.2,513.8]]],['green',[[1887.4,464.4],[1896.8,503.6]]],
  ['green',[[1916.4,384.4],[1933.6,379.3]]],['green',[[1923.5,429.1],[1945.4,424.0]]],
  ['yellow',[[1004,560],[1019,626],[1024,647],[1031,653],[1052,647]]],
  ['yellow',[[1145,510],[1162,590],[1173,624],[1186,617]]],
  ['green',[[790,674],[1018,620]]],['green',[[944,568.5],[956,631]]]
].map(([colour,pixels])=>({colour,pixels,points:pixels.map(p)}));
export const REDCLIFFE_KEEP_CLEAR=[[1464,596],[1617,552],[1771,450],[817,705],[1344,558]].map(p);
// Dashed apron limits visible at hangar entrances and the D apron crossing.
export const REDCLIFFE_APRON_LIMITS=[
  [[756,742],[825,763]],[[995,730],[1066,712]],
  [[1219,666],[1336,638]],[[1193,590],[1219,666]],
  [[1353,510],[1379.5,627.5]]
].map(q=>q.map(p));
export function drawRedcliffeApronMarkings({line,groundText,scale}){
  for(const a of REDCLIFFE_APRON_LINES)line(a.points,a.colour==='green'?'#79a88c':'#dfc16d',Math.max(.45,scale*.065));
  for(const a of REDCLIFFE_APRON_LIMITS)line(a,'#d7bf77',Math.max(.4,scale*.055),[scale*.12,scale*.17]);
  for(const [i,[x,y]] of REDCLIFFE_KEEP_CLEAR.entries()){
    if(i===2||i===3)groundText('KEEP CLEAR',x,y,.7,'#ddc47b',-Math.PI/2);
    else {groundText('KEEP',x,y,.7,'#ddc47b',Math.PI/2);groundText('CLEAR',x-.9,y,.7,'#ddc47b',Math.PI/2)}
  }
  for(const [x,y,r] of [[1007,576,16],[1149,525,15]]){
    const circle=Array.from({length:49},(_,i)=>p([x+Math.cos(i/48*Math.PI*2)*r,y+Math.sin(i/48*Math.PI*2)*r]));
    line(circle,'#e4cf74',Math.max(.6,scale*.1));
  }
}
