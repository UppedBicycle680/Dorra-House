import {referenceBuildings,chartPixel as px,polygonRect,ARCHERFIELD_SCALE as s} from './archerfield-reference.mjs';
import {ADDITIONAL_ARCHERFIELD_HANGARS} from './archerfield-hangar-inventory.mjs';

export const HANGAR_SOURCES={
 site:'https://archerfieldairport.com.au/wp-content/uploads/2025/04/Archerfield-Airport-Approved-2023-43-MP-and-AES-26-March-2025.pdf',
 floorPlan:'https://archerfieldairport.com.au/wp-content/uploads/2026/02/Hangar-101-Information-Memorandum_v1.pdf',
 demolition:'https://archerfieldairport.com.au/wp-content/uploads/2026/04/Archerfield-Airport-Building-Approvals-Register.pdf'
};
// Site 101/103/104/107/117 was demolished for the completed dual Hangar 101.
// 21447 duplicates 21446 in the source PDF. Retire both copies of that cleared
// building, as well as the other superseded site symbols.
export const replacedHangarSitePaths=[...new Set([21905,21422,21423,21445,21446,21447,21448,21449,21450,...ADDITIONAL_ARCHERFIELD_HANGARS.flatMap(h=>h.replacesChartPaths)])];
// Figure 4 of the approved master plan: replacement H004 (~2,020 m²),
// including its stepped rear annex. Register using the 10L/28R strip centre.
const masterPoint=([x,y])=>{const a=[297.035,397.58],d=[559.92,179.22],n=d[0]**2+d[1]**2;return [((x-a[0])*d[0]+(y-a[1])*d[1])*300/n,116+(-(x-a[0])*d[1]+(y-a[1])*d[0])*300/n];};
const h4Polygon=[[867.47,393.56],[864.05,413.03],[874.52,414.86],[875.36,410.13],[878.39,410.63],[879.62,402.41],[876.59,401.888],[877.76,395.21]].map(masterPoint);
// H001's older aerodrome symbol omitted much of the northern annex.
const h1Polygon=[[874.07,354.14],[872.15,365.24],[880.25,366.50],[880.448,365.363],[890,367.01],[891.65,357.17]].map(masterPoint);
const add=(a,b,k=1)=>a.map((v,i)=>v+b[i]*k);
const unit=v=>v.map(n=>n/Math.hypot(...v));
const ring=p=>p.length>1&&Math.hypot(...p[0].map((v,i)=>v-p.at(-1)[i]))<.001?p.slice(0,-1):p;

function frame(id,name,origin,u,v,width,depth,polygon,extra={}){
 const at=(x,y)=>add(add(origin,u,x*s),v,y*s);
 return {id,name,origin,u,v,widthM:width,depthM:depth,polygon,rect:polygonRect(polygon),height:7*s,
  doors:[[2,width-2]],floor:[at(1,1),at(width-1,1),at(width-1,depth-1),at(1,depth-1)],
  parking:[],offices:[],partitions:[],roof:'gable',source:HANGAR_SOURCES.site,
  placement:'Chart footprint; use and airside frontage cross-checked against master plan Figures 4 and 29.',
  occupancy:'Illustrative aircraft storage; not current tenant assignments or a surveyed interior.',...extra};
}
export function hangarPoint(h,x,y){return add(add(h.origin,h.u,x*s),h.v,y*s);}
function bay(h,id,x,y,aircraftId='c172'){
 return {id,hangarId:h.id,position:hangarPoint(h,x,y),heading:Math.atan2(-h.v[1],-h.v[0]),aircraftId,
  interior:y>0,leadIn:[hangarPoint(h,x,0),hangarPoint(h,x,y)],illustrative:true};
}
// Qantas Avenue hangars open west onto Juliet; Hangar 006 opens north.
// Keep the extracted footprint instead of inflating a generic box across lanes.
const heritage=[[1,21905],[2,21906],[3,21421],[4,21423],[5,21424],[6,21455]].map(([number,sourcePath])=>{
 const b=number===4?{polygon:h4Polygon}:number===1?{polygon:h1Polygon}:referenceBuildings.find(b=>b.sourcePath===sourcePath),p=ring(b.polygon);
 const candidates=p.map((a,i)=>{const c=p[(i+1)%p.length],m=add(a,c).map(n=>n/2);return {a,c,m,d:Math.hypot(c[0]-a[0],c[1]-a[1])};}).filter(e=>e.d>2);
 // Inverse geographic east coordinate selects the western frontage even when
 // a hangar's deeper side is its longest edge.
 const sourceY=q=>q[0]*82.5+q[1]*257.9,sourceX=q=>q[0]*257.9-q[1]*82.5;
 candidates.sort((a,b)=>number===6?sourceY(a.m)-sourceY(b.m):sourceX(a.m)-sourceX(b.m));
 let {a,c}=candidates[0];if(number===6?sourceX(a)<sourceX(c):sourceY(a)>sourceY(c))[a,c]=[c,a];
 const u=unit(c.map((n,i)=>n-a[i])),v=[u[1],-u[0]],w=Math.hypot(c[0]-a[0],c[1]-a[1])/s;
 const d=Math.max(...p.map(q=>q.reduce((sum,n,i)=>sum+(n-a[i])*v[i],0)))/s;
 const h=frame('hangar-'+number,String(number).padStart(3,'0'),a,u,v,w,number===4?30.5:d,b.polygon,{sourcePath,roof:[2,3,5,6].includes(number)?'barrel':'gable',architectureId:String(number).padStart(3,'0'),frontage:number===6?'north':'west'});
 h.floor=b.polygon;
 if(number===1)h.placement='Complete H001 footprint including northern annex, traced from approved master plan Figure 4 and registered to runway strip centre.';
 const localBox=(x,y,w,d)=>[[x,y],[x+w,y],[x+w,y+d],[x,y+d]].map(p=>hangarPoint(h,...p));
 if(number===1){h.doors=[[10.6,w-4.4]];h.offices=[{id:'001-north-administration',polygon:localBox(.5,.5,9,d-1),height:4*s}];}
 if(number===2)h.doors=[[5.6,w-5.6]];
 if(number===3){h.doors=[[.6,w-7.1]];h.offices=[{id:'003-south-classrooms',polygon:localBox(w-6.5,.5,6,d-1),height:3.5*s}];}
 if(number===5){const wing=(w-27.4)/2;h.doors=[[wing+.6,w-wing-.6]];h.offices=[{id:'005-south-office',polygon:localBox(w-wing,.5,wing-.5,d-1),height:4*s}];}
 if(number===6){h.doors=[[w*.19+.6,w*.85-.6]];h.offices=[{id:'006-south-ancillary',polygon:localBox(w*.19,d*.82,w*.81-2.7,d*.18-.5),height:4*s}];}
 if(number===4){h.placement='Replacement building traced from approved master plan Figure 4, registered to runway strip centre; supersedes chart buildings 21422 and 21423.';h.doors=[[1.5,w/2-.6],[w/2+.6,w-1.5]];h.offices=[{id:'004-rear-annex',polygon:[p[3],p[4],p[5],p[6]],height:5*s}];}
 const usable=w-4,count=[4,6].includes(number)?2:Math.max(1,Math.floor(usable/15));
 for(let i=0;i<count;i++)h.parking.push(bay(h,`${h.name}-IN-${i+1}`,[2,5].includes(number)?w/2+(i-.5)*14:number===3?(w-6.5)/2:number===6?w*.52+(i-.5)*16:2+usable*(i+.5)/count,[1,2,3].includes(number)?16:Math.min(h.depthM*.52,h.depthM-7)));
 return h;
});

// Register the 2026 floor plan to the former Beatty South site beside the
// Eastern Apron. Uniform metre scale and the road-aligned axis are retained.
// The chart is a generalized aerodrome drawing, not a cadastral survey.
const front=px([873,974]),u=unit(px([865,1018]).map((v,i)=>v-front[i])),v=[u[1],-u[0]];
const h101=frame('hangar-101','101',front,u,v,104,36,[],{
 height:10*s,roof:'skillion',architectureId:'101',frontage:'west',doors:[[20,60],[66,102]],source:HANGAR_SOURCES.floorPlan,
 placement:'2026 operator floor plan and location aerial, registered to the cleared Beatty South site.',
 occupancy:'Two compartments and ancillary blocks follow the published plan. Aircraft are illustrative light-aircraft storage positions.'
});
const hp=(x,y)=>hangarPoint(h101,x,y),box=(x,y,w,d)=>[hp(x,y),hp(x+w,y),hp(x+w,y+d),hp(x,y+d)];
h101.polygon=box(0,0,104,36);h101.rect=polygonRect(h101.polygon);
h101.floor=box(1,1,102,34);
h101.partitions=[[hp(65,0),hp(65,36)]];
// Internal ancillary block at the northern end; rear office for compartment 2.
h101.offices=[{id:'101-north-office',polygon:[hp(0,0),hp(8,0),hp(8,20),hp(14,20),hp(14,36),hp(0,36)],height:6*s},
 {id:'101-rear-office',polygon:box(66,36,33,7),height:6*s}];
for(const [i,x] of [27,40,53,75,94].entries())h101.parking.push(bay(h101,'101-IN-'+(i+1),x,20));
// Keep the door manoeuvring strip empty. These bays occupy the adjacent apron,
// nose away from the hangar, with a clear strip between parking and the doors.
h101.exteriorParking=[22,43,77,96].map((x,i)=>({...bay(h101,'101-OUT-'+(i+1),x,-10),apronId:'hangar-101-forecourt',grassParking:false}));
h101.forecourt={id:'hangar-101-forecourt',polygon:box(0,-18,104,18),surface:'concrete',source:HANGAR_SOURCES.floorPlan};

const additional=ADDITIONAL_ARCHERFIELD_HANGARS.map(h=>({...h,rect:polygonRect(h.polygon)}));
export const ARCHERFIELD_HANGARS=[...heritage,h101,...additional];
export const ARCHERFIELD_HANGAR_PARKING=ARCHERFIELD_HANGARS.flatMap(h=>h.parking);
export const hangarReferenceBuildings=[
 ...referenceBuildings.filter(b=>!replacedHangarSitePaths.includes(b.sourcePath)),
 {...heritage.find(h=>h.name==='001'),id:'hangar-1-shell',parking:undefined,offices:undefined},
 {...heritage.find(h=>h.name==='004'),id:'hangar-4-shell',parking:undefined,offices:undefined},
 {...h101,id:'hangar-101-shell',parking:undefined,offices:undefined},
 ...additional.map(h=>({...h,id:h.id+'-shell',parking:undefined,offices:undefined})),
 ...h101.offices.filter(o=>o.id==='101-rear-office').map(o=>({...o,rect:polygonRect(o.polygon)}))
];
