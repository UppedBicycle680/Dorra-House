// Coordinates are native PDF points, from the top left. They are chart
// registration measurements, not survey coordinates. Keep reference controls
// independent of the implementation and review them on source overlays.
import {YBSU_CHART_GEOMETRY} from './ybsu-chart-geometry.mjs';
export const YBSU_REFERENCE = Object.freeze({
  airport:'YBSU',baseline:'2026-09-08',metresToWorld:.2,
  aerodrome:{url:'https://www.airservicesaustralia.com/aip/pending/dap/BSUAD01-188_03SEP2026.pdf',page:1},
  apron:{url:'https://www.airservicesaustralia.com/aip/pending/dap/BSUAP01-188_03SEP2026.pdf',page:1},
  stands:{url:'https://www.airservicesaustralia.com/aip/pending/dap/BSUAP02-188_03SEP2026.pdf',page:1},
  operatingNotes:{url:'https://www.airservicesaustralia.com/aip/pending/ersa/FAC_YBSU_03SEP2026.pdf',pages:[3,4]},
  runwayDistances:{url:'https://www.airservicesaustralia.com/aip/pending/ersa/RDS_YBSU_03SEP2026.pdf',page:1},
  lighting:{url:'https://www.airservicesaustralia.com/aip/pending/dap/BSUAD02-182_03SEP2026.pdf',page:1},
  supplement:{url:'https://www.airservicesaustralia.com/aip/current/sup/s26-h116.pdf',effective:'2026-09-03',aerodromePage:3,apronPage:4},
  terminalWorks:{url:'https://www.airservicesaustralia.com/aip/current/sup/a26-h42.pdf',effective:'2026-08-03',worksPage:4},
  hashes:YBSU_CHART_GEOMETRY.manifest,
  // Registration uses the 31 pavement cap and the scale ratio 6000/20000.
  end31:[302.8,409.726],end13:[50.6,82.976],apronEnd31:[346.6,101.026],
  apronScale:.3,runwayWorldLength:560,
  caveat:'Cartographic symbols and dimension labels are distinct. Runway width uses the published 45 m; the chart symbol includes a wider cap and turning area.'
});
const [ax,ay]=YBSU_REFERENCE.end31,[bx,by]=YBSU_REFERENCE.end13;
const length=Math.hypot(bx-ax,by-ay),ux=(bx-ax)/length,uy=(by-ay)/length;
const scale=YBSU_REFERENCE.runwayWorldLength/length;
export const ybsuChartPoint=([x,y])=>[((x-ax)*ux+(y-ay)*uy)*scale,116+(-(x-ax)*uy+(y-ay)*ux)*scale];
export const ybsuWorldToChart=([x,y])=>[ax+(x*ux-(y-116)*uy)/scale,ay+(x*uy+(y-116)*ux)/scale];
export const ybsuApronToChart=([x,y])=>[ax+(x-346.6)*.3,ay+(y-101.026)*.3];
export const ybsuApronPoint=p=>ybsuChartPoint(ybsuApronToChart(p));
export const ybsuWorldToApron=p=>{const q=ybsuWorldToChart(p);return [346.6+(q[0]-ax)/.3,101.026+(q[1]-ay)/.3]};
export const YBSU_NORTH_VECTOR=[-uy,-ux];

// Published stand coordinates: seconds within 26°36′S and 153°05′E.
// AP01's latitude/longitude grid locates these without using terminal vertices.
export const YBSU_PUBLISHED_STANDS = [
  [10,24.33,21.49,'A321/B739',36],['10A',24.50,22.29,'B350',18],
  [11,23.28,20.77,'A35K/B773',65],[12,22.72,20.84,'A321/B739',36],
  [13,21.35,21.22,'A321/B739',36],[14,19.98,21.60,'A321/B739',36],
  [15,18.94,21.73,'A321/B738',36],[16,17.37,20.51,'A321/B738',36],
  [17,16.19,19.49,'A321/B738',36],[18,15.15,18.41,'A321/B738',36],
  [19,13.79,17.24,'A321/B738',36],[20,12.68,16.28,'A321/B738',36],
  ['19A',13.27,17.65,'GLEX/GLF6',29],['20A',12.26,16.73,'GLEX/GLF6',29],
  [30,34.92,19.67,'B350',18],[31,35.27,19.57,'B350',18]
].map(([id,latSeconds,lonSeconds,capacity,maxSpanM])=>({id:String(id),latSeconds,lonSeconds,capacity,maxSpanM}));
export const ybsuStandApronPoint=s=>[93.3+(s.lonSeconds-12)*(235.0/18),83.176+(s.latSeconds-12)*(435.8/30)];

// These terminal and tower controls are not used to fit the chart transform.
export const YBSU_CONTROL_POINTS = [
  {id:'terminal-north',apron:[158.8,127.776],aerodrome:[246.5,417.776],tolerancePdf:.12},
  {id:'terminal-apron-corner',apron:[205.7,172.476],aerodrome:[260.5,431.176],tolerancePdf:.12},
  {id:'terminal-south',apron:[188.7,229.876],aerodrome:[255.4,448.376],tolerancePdf:.12},
  {id:'terminal-west',apron:[165.6,165.376],aerodrome:[248.5,429.076],tolerancePdf:.12}
];

// Complete permanent named network inventory. A graph node is shared only
// where a real junction exists. Lines crossing on a page do not imply a link.
export const YBSU_GRAPH_NODES = {
  a2Runway:[177,247.4],a2:[157.2,263],jA:[230.5,358.5],a1:[250,380],a1Runway:[266.6,363.7],
  jE:[210.8,373],jWest:[205,379],westEnd:[162,333],eM:[241.4,396],mWest:[233,404],
  westApron:ybsuApronToChart([140,94]),bTop:ybsuApronToChart([160,73]),b3A:ybsuApronToChart([210,58]),b3B:ybsuApronToChart([175,80]),
  b2A:ybsuApronToChart([234,90]),b2B:ybsuApronToChart([207,100]),
  b1B:ybsuApronToChart([266,183]),b1F:ybsuApronToChart([308,183]),
  fRunway:[302.8,409.726],fG:ybsuApronToChart([283.5,308]),fC:ybsuApronToChart([249,425]),
  bG:ybsuApronToChart([193,291]),gD:ybsuApronToChart([227,296]),dH:ybsuApronToChart([207,375]),
  hApron:ybsuApronToChart([188,370]),cD:ybsuApronToChart([191,422])
};
const N=YBSU_GRAPH_NODES,ap=ybsuApronToChart;
const edge=(id,from,to,via=[],widthM=23,kind='taxiway')=>({id,from,to,points:[N[from],...via,N[to]],widthM,kind});
export const YBSU_REFERENCE_EDGES = [
  edge('A','a2','jA'),edge('A','jA','a1'),edge('A','a1','b3A'),edge('A','b3A','b2A'),
  edge('A','b2A','b1F',[ap([279,148]),ap([294,167])]),
  edge('A1','a1','a1Runway',[[251.8,375.2],[258.7,369.6]]),
  edge('A2','a2','a2Runway',[[157.7,256.6],[168.0,251.1]]),
  edge('B','bTop','b3B'),edge('B','b3B','b2B'),edge('B','b2B','b1B',[ap([250,163]),ap([260,177])]),
  edge('B','b1B','bG',[ap([262,207]),ap([244,269]),ap([199,271])]),
  edge('B1','b1B','b1F'),edge('B2','b2B','b2A'),edge('B3','b3B','b3A'),
  edge('F','fRunway','b1F',[ap([334,118]),ap([329,138]),ap([319,160])]),edge('F','b1F','fG'),
  edge('F','fG','fC',[ap([252.5,415]),ap([250.8,421])]),
  edge('J','jA','jE',[[226,358.5],[221,362.7],[212.1,371]],15),edge('J','jE','jWest',[],15),
  edge('E','jE','eM',[],10.5),edge('M','eM','mWest',[[238,397],[233,402]],10.5),
  edge('M','eM','bTop',[ap([151,50]),ap([160,52])],10.5),
  edge('West GA','westEnd','jWest',[[187,359],[203,375]],10.5,'taxilane'),
  edge('West GA','jWest','mWest',[],10.5,'taxilane'),
  edge('West GA','mWest','westApron',[ap([124,85])],10.5,'taxilane'),
  edge('TXL G','bG','gD',[],10.5,'taxilane'),edge('TXL G','gD','fG',[],10.5,'taxilane'),
  edge('TXL D','gD','dH',[],10.5,'taxilane'),edge('TXL D','dH','cD',[ap([203,404])],10.5,'taxilane'),
  edge('TXL H','hApron','dH',[],10.5,'taxilane'),
  edge('TXL C','cD','fC',[ap([217,426]),ap([237,429])],10.5,'taxilane')
];
