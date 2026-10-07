import {HAMILTON_SCALE as S} from './hamilton-reference.mjs';
import {hamiltonGeoPoint} from './hamilton-neighbourhood.mjs';

// Visual tracing of Esri World Imagery z18, origin tile 239531 / 146212.
// Esri, Vantor, Earthstar Geographics and the GIS User Community.
// Retrieved 9 September 2026; acquisition date unknown. Paint widths and fine
// details are approximations at this imagery's roughly 0.56 m/pixel resolution.
export function hamiltonImagePoint([x,y]){
  const n=2**18,tx=239531+x/256,ty=146212+y/256;
  return hamiltonGeoPoint([Math.atan(Math.sinh(Math.PI*(1-2*ty/n)))*180/Math.PI,tx/n*360-180]);
}
const smooth=points=>{
  const out=[];
  for(let i=0;i<points.length-1;i++){
    const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)];
    for(let j=0;j<12;j++){const t=j/12;out.push(b.map((v,k)=>.5*(2*v+(-a[k]+c[k])*t+(2*a[k]-5*v+4*c[k]-d[k])*t*t+(-a[k]+3*v-3*c[k]+d[k])*t*t*t)))}
  }
  return [...out,points.at(-1)];
};
const trace=(id,points,curve=true,widthM=.2,colour='yellow')=>({id,points:(curve?smooth(points):points).map(hamiltonImagePoint),widthM,colour});
export const HAMILTON_PAINT_TRACES=[
  trace('E-entry',[[265,435],[283,440],[302,435],[394,374],[435,347]],true),
  trace('E-return',[[298,465],[292,449],[298,432],[315,421]],true),
  trace('A-entry',[[336,515],[360,545],[388,563],[414,565],[438,558],[503,512],[530,495],[551,490],[570,498],[582,517]]),
  trace('B-entry',[[558,855],[578,862],[600,859],[622,846],[721,813],[758,794],[788,770],[805,742],[813,714],[809,687],[795,664],[745,591]],true),
  trace('B-south-turn',[[618,930],[603,907],[602,888],[610,869],[629,849]],true),
  trace('RPT-spine',[[551,490],[563,508],[569,542],[592,587],[621,630],[674,703],[720,765],[751,804],[784,841],[806,856],[821,858],[832,848],[823,827],[795,787]],true),
  trace('stand-1-lead',[[569,542],[570,519],[579,496],[587,481]],true),
  trace('stand-1A-lead',[[621,630],[606,598],[591,562],[586,538],[586,518]],true),
  trace('stand-2-lead',[[592,587],[588,562],[601,543],[621,536],[654,544],[674,537],[706,482]],true),
  trace('stand-3-arc',[[796,665],[760,612],[746,588],[754,578],[777,573],[811,571]],true),
  trace('stand-4-arc',[[810,716],[810,690],[800,669],[802,654],[828,649],[876,656]],true),
  trace('stand-5-arc',[[722,811],[751,789],[778,777],[806,771],[857,773],[882,771],[902,743]],true),
  trace('stand-6-access',[[742,819],[805,815],[877,810]],false),
  trace('C-entry',[[766,1067],[786,1063],[806,1051],[866,997],[892,976],[909,969],[922,974]],true),
  trace('GA-spine',[[874,1007],[904,987],[924,989],[940,1009],[977,1060],[1009,1100],[1025,1110],[1038,1108]],true),
  trace('D-entry',[[606,931],[588,910],[568,889],[550,894],[525,913],[473,953],[461,982],[456,1013],[466,1045],[497,1088],[584,1202]],true),
  trace('western-bay-turn',[[457,1005],[471,1024],[495,1053],[504,1075],[503,1092],[493,1107]],true,.15),
  trace('western-stop',[[486,1107],[499,1107]],false,.2),
  trace('western-clearance',[[456,1002],[492,1032],[602,1180],[611,1206],[570,1237],[552,1213]],false,.15),
  trace('RPT-clearance',[[535,460],[539,487],[602,527],[638,543],[670,563],[697,601],[743,663],[797,733],[820,795],[877,793],[911,751],[932,707],[922,683],[872,609],[815,528],[768,471],[700,450]],false,.15),
  trace('GA-boundary',[[904,1014],[1039,1181],[1103,1124],[1080,1086]],false,.2),
  trace('GA-apron-divider',[[943,1053],[1010,1145],[1024,1158],[1089,1111]],false,.15,'white'),
  trace('pedestrian-1',[[587,444],[548,473],[543,493]],false,.25,'white'),
  trace('pedestrian-2',[[590,448],[608,494]],false,.25,'white'),
  trace('pedestrian-3',[[657,451],[680,473]],false,.25,'white'),
  trace('pedestrian-4',[[808,532],[808,556]],false,.25,'white'),
  trace('pedestrian-5',[[887,681],[839,699]],false,.25,'white'),
  trace('pedestrian-6',[[891,725],[848,741]],false,.25,'white'),
];
export const HAMILTON_PAINT_HOLDS=[
  ['E',[392.6,372.7],5.5],['A',[504.3,519.1],23],['B',[729.5,818.7],23],['C',[870.5,1003.3],10.5],['D',[469,947.7],14.5]
].map(([id,p,widthM])=>({id,point:hamiltonImagePoint(p),widthM}));
export const HAMILTON_HELICOPTER_CIRCLES=[[908,1011],[928,1037],[948,1063],[969,1089],[989,1116],[1009,1143],[1029,1170]].map(hamiltonImagePoint);
export const HAMILTON_ALTERNATIVE_STAND={referenceStand:'1A',pin:hamiltonGeoPoint([-20.3523833333333,148.9489083333333]),heading:Math.atan2(-.51,-.86)};
// The chart's schematic building cut-out clips the painted H square visible
// beside the hangar. Restore only this small, image-confirmed apron corner.
export const HAMILTON_MARKING_PAVEMENT=[[[967,1008],[1008,1008],[1045,1050],[1065,1080],[1040,1103],[1000,1064]].map(hamiltonImagePoint)];

// Every stripe is a ground polygon in metres, so zoom and isometric projection
// cannot change its physical width or the dash/gap ratio.
export function drawHamiltonMarkings(layout,{poly,groundText}){
  const white='#eeeede',yellow='#d9be68',red='#b36c61';
  const stroke=(points,widthM,colour=yellow,dashM=0,gapM=0)=>{
    let travelled=0;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy);if(d<1e-8)continue;
      const nx=-dy/d*widthM*S/2,ny=dx/d*widthM*S/2;
      const part=(s,e)=>{const p=[a[0]+dx*s/d,a[1]+dy*s/d],q=[a[0]+dx*e/d,a[1]+dy*e/d];poly([[p[0]+nx,p[1]+ny],[q[0]+nx,q[1]+ny],[q[0]-nx,q[1]-ny],[p[0]-nx,p[1]-ny]],colour)};
      if(!dashM)part(0,d);else{let t=0;while(t<d-1e-8){const phase=(travelled+t)%((dashM+gapM)*S),on=phase<dashM*S,step=Math.min(d-t,(on?dashM*S:(dashM+gapM)*S)-phase);if(on)part(t,t+step);t+=Math.max(step,1e-7)}}travelled+=d;
    }
  };
  const r=layout.runways[0],length=r.end[0]-r.start[0],at=(x,y)=>[r.start[0]+x*S,r.start[1]+y*S];
  const rectangle=(x,y,w,h,colour)=>poly([at(x,y),at(x+w,y),at(x+w,y+h),at(x,y+h)],colour);
  const L=length/S,threshold=60;
  stroke([[.5,121.16],[.5,104.1],[12.6,104.1],[20.6,110.84],[419.5,110.84],[419.5,127.9],[407.4,127.9],[399.4,121.16],[.5,121.16]],.45,white);
  stroke([at(threshold+70,0),at(L-threshold-70,0)],.45,white,30,30);
  for(const end of [0,1]){
    const x=end?L-threshold:threshold,d=end?-1:1;
    rectangle(x-.9,-22.5,1.8,45,white);
    for(const side of [-1,1])for(let i=0;i<6;i++){
      const across=side*(2.7+i*3.6);
      rectangle(x+d*6-(end?30:0),across-.9,30,1.8,white);
    }
    // One narrow touchdown pair at 150 m, broad aiming pair at 300 m,
    // and the following narrow pair at 450 m, as visible at both runway ends.
    for(const [distance,len,w] of [[150,22.5,1.8],[300,45,6],[450,22.5,1.8]])for(const side of [-1,1])rectangle(x+d*distance-(end?len:0),side*12-w/2,len,w,white);
    groundText(end?'32':'14',...at(x+d*48,0),9*S,white,end?Math.PI/2:-Math.PI/2);
    const loop=[[115,0],[80,0],[59,-2],[42,-8],[29,-23],[22,-37],[13,-39],[5,-31],[4,-14],[13,1],[28,11],[45,11],[59,5],[80,0]].map(([u,v])=>at(end?L-u:u,end?-v:v));
    stroke(smooth(loop),.2,yellow);
  }
  for(const f of HAMILTON_PAINT_TRACES)stroke(f.points,f.widthM,f.colour==='white'?white:yellow);
  for(const h of HAMILTON_PAINT_HOLDS){
    const [x,y]=h.point,sign=y<r.start[1]?1:-1,half=h.widthM*S/2;
    // Two solid lines on the apron side, two dashed lines facing the runway.
    for(let i=0;i<4;i++)stroke([[x-half,y+sign*i*.6*S],[x+half,y+sign*i*.6*S]],.3,yellow,i>1?1.2:0,.9);
    const w=Math.min(h.widthM-1,13)*S,depth=3.2*S,py=y-sign*3.8*S;
    poly([[x-w/2,py-depth/2],[x+w/2,py-depth/2],[x+w/2,py+depth/2],[x-w/2,py+depth/2]],red);
    groundText('14–32',x,py,2.4*S,white,sign<0?Math.PI:0);
  }
  for(const [x,y] of HAMILTON_HELICOPTER_CIRCLES){
    stroke(Array.from({length:49},(_,i)=>[x+3.5*S*Math.cos(i*Math.PI/24),y+3.5*S*Math.sin(i*Math.PI/24)]),.2,yellow);
  }
  const hp=hamiltonImagePoint([1021,1059]),hs=4*S;
  stroke([[hp[0]-hs,hp[1]-hs],[hp[0]+hs,hp[1]-hs],[hp[0]+hs,hp[1]+hs],[hp[0]-hs,hp[1]+hs],[hp[0]-hs,hp[1]-hs]],.25,yellow);
  groundText('H',...hp,3*S,white);
  // Published stand pins remain authoritative for stops and game selections.
  for(const s of layout.referenceParking){
    const [x,y]=s.pin,c=Math.cos(s.heading),n=Math.sin(s.heading);
    stroke([[x-c*12*S,y-n*12*S],[x,y]],.2,yellow);
    for(const distance of [0,2,4]){const px=x-c*distance*S,py=y-n*distance*S;stroke([[px-n*2*S,py+c*2*S],[px+n*2*S,py-c*2*S]],.18,yellow)}
    groundText(s.referenceStand,x+n*3*S,y-c*3*S,2.5*S,yellow,s.heading+Math.PI/2);
  }
}
