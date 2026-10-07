import {goldCoastHangarPixelPoint as imagePoint} from './gold-coast-hangars.mjs';

// Measured in the same 2048 × 2304 aerial extent as the hangars. Paint is
// authored separately from the schematic traffic graph: graph edges are not
// evidence of painted centreline positions. Current coverage was checked in
// Vantor's 2025-12-01 image; the City aerial resolves faded line details.
const yellow='#e4cd86',white='#eeeeda';
const cubic=(a,b,c,d,n=24)=>Array.from({length:n+1},(_,i)=>{const t=i/n,s=1-t;return a.map((v,k)=>s*s*s*v+3*s*s*t*b[k]+3*s*t*t*c[k]+t*t*t*d[k]);});
const ring=(x,y,r)=>Array.from({length:65},(_,i)=>[x+r*Math.cos(i*Math.PI/32),y+r*Math.sin(i*Math.PI/32)]);
const paths=[];
const add=(id,pixels,widthM=.15,colour=yellow,extra={})=>paths.push({id,sourcePixels:pixels,points:pixels.map(imagePoint),widthM,colour,...extra});

add('north-centreline',[[132,504],[370,745],...cubic([370,745],[408,783],[397,813],[419,836]).slice(1),[700,1097],[900,1295],[1145,1524],[1185,1562],[1389,1762]],.15);
add('g-north-curve',cubic([1389,1762],[1468,1830],[1429,1860],[1379,1878]),.15);
// G's entrance joins both apron turns at a shared point.
add('g-entrance',[[509.7940936,2203.0978496],[1379,1878]],.15);
add('g-south-curve',cubic([1379,1878],[1463,1846],[1485,1879],[1525,1927]),.15);

add('northern-apron-boundary',[[152,374],[60,468],[367,765],[370,834],[430,891],[423,900],[1048,1503],[1099,1551],[1048,1605],[370,953]],.3);
add('north-training-outer',[[731,1296],[692,1338],[1003,1646]],.25);
add('hangar-front-boundary',[[474,751],[439,786],[883,1228],[1159,1482],[1195,1440]],.3);
add('central-hangar-return',[[883,1228],[914,1198]],.25);
add('southern-hangar-boundary',[[1233,1452],[1203,1480],[1580,1870],[1525,1927],[1495,1957],[1576,2036]],.3);
// Two cross-lines divide the visible shared row and the southern G1 box;
// they do not create numbered or independently allocatable game bays.
add('training-cross-line',[[994,1553],[1048,1503]],.25);
add('g1-box-cross-line',[[1031,1587],[1080,1535]],.25);
add('g1-lead-in',[[1048.45058,1558.385865],[1080,1535],...cubic([1080,1535],[1106,1508],[1119,1499],[1145,1524]).slice(1)],.15);
add('training-south-turn',[...cubic([993,1592],[996,1640],[1045,1665],[1081,1634]),[1154,1560],...cubic([1154,1560],[1167,1547],[1171,1547],[1185,1562]).slice(1)],.15);
add('training-turn-dashes',[...cubic([1003,1590],[1007,1630],[1045,1650],[1076,1624]),[1127,1573]],.2,yellow,{dashM:[1.1,1.1]});

add('helicopter-apron-edge',[[1066,1701],[1158,1612],[1346,1793],[1306,1834]],.3,white);
for(const [number,x,y,r] of [[3,1158,1651,13],[2,1221,1714,13],[1,1295,1789,17]]){
 add('helicopter-circle-'+number,ring(x,y,r),.25);
 add('helicopter-axis-'+number,[[x-r*.8,y+r*.8],[x+r*1.15,y-r*1.15]],.15);
}
for(const [i,p] of [
 [[1316,1827],[1338,1814]],[[1319,1835],[1343,1840]],[[1314,1844],[1330,1860]],
 [[1400,1900],[1404,1912]],[[1425,1889],[1432,1915]],[[1457,1884],[1450,1912]],[[1507,1930],[1490,1949]],
].entries())add('g-edge-hatch-'+i,p,.8,white);
add('helicopter-hatched-end',cubic([1338,1807],[1355,1830],[1344,1854],[1330,1866]),.2);
add('g-south-apron-edge',[[1379,1901],...cubic([1379,1901],[1450,1872],[1471,1873],[1498,1911]).slice(1)],.2);

// Separate grass-side helicopter landing mark, not an additional parking bay.
const landingPixels=[[904,1784],[938,1819],[904,1853],[870,1819]];
add('landing-circle',ring(904,1819,22.5),.9,white,{landing:true});
const h=(u,v)=>[904+(u+v)*.7071,1819+(v-u)*.7071];
for(const [i,p] of [[[h(-5,-10),h(-5,10)]],[[h(5,-10),h(5,10)]],[[h(-5,0),h(5,0)]]].entries())add('landing-H-'+i,p[0],1.1,white,{landing:true});

export const GOLD_COAST_GA_MARKINGS={
 source:{image:'city-aerial-ga.png',imageCaptureDate:null,crossCheckImage:'satellite-2025-12-ga.png',crossCheckCaptureDate:'2025-12-01',positionalAccuracyM:8.47,paintWidthAccuracy:'visual estimate',unresolved:'Very small or aircraft-obscured lettering is not reconstructed.'},
 paths,landingSurface:landingPixels.map(imagePoint),
 // Actual asphalt shoulder, traced at the grass edge. It repairs the coarse
 // chart outline rather than expanding pavement around simulated flight paths.
 apronShoulders:[
  [[48,468],[148,365],[168,369],[161,438],[481,756],[620,889],[875,1148],[1198,1456],[1433,1760],[1360,1800],[1158,1608],[1054,1724],[1000,1658],[680,1338],[721,1298],[359,953],[414,903],[358,841],[355,776]],
  [[1302,1836],[1330,1870],...cubic([1330,1870],[1354,1848],[1356,1828],[1338,1803]).slice(1)],
  [[1195,1440],[1246,1455],[1295,1500],[1245,1530],[1198,1485]],
 ].map(p=>p.map(imagePoint)),
 padLabels:[3,2,1].map((n,i)=>({text:String(n),position:imagePoint([[1158,1651],[1221,1714],[1295,1789]][i])})),
};
export function drawGoldCoastGaMarkings({line,poly,groundText,scale}){
 poly(GOLD_COAST_GA_MARKINGS.landingSurface,'#929f97');
 for(const p of paths)line(p.points,p.colour,Math.max(.4,p.widthM*.2*scale),(p.dashM||[]).map(n=>n*.2*scale));
 const a=imagePoint([0,0]),b=imagePoint([1,1]),angle=Math.atan2(b[1]-a[1],b[0]-a[0]);
 for(const p of GOLD_COAST_GA_MARKINGS.padLabels)groundText(p.text,...p.position,.65,white,angle);
}
