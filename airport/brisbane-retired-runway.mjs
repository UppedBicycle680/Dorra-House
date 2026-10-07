import {northPoint, BNE_SCALE} from './brisbane-bays.mjs';

const strip = (a,b,width) => {
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])*width/length/2,ny=(b[0]-a[0])*width/length/2;
  return [[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]];
};

export function addBrisbaneRetiredRunway(layout) {
  // AP06-187's two straight pavement edges establish the axis. The apron
  // chart clips the northern end at its neatline; it is not the runway end.
  // BAC's 2014 runway booklet gives 1,760 x 30 m. Continue that same axis
  // northward, checked against the geographically registered 2025 imagery.
  const end=northPoint([371.2,312.5]),axis=northPoint([191.9,51.876]);
  const d=Math.hypot(end[0]-axis[0],end[1]-axis[1]),u=end.map((v,i)=>(v-axis[i])/d);
  const lengthM=1760,widthM=30,start=end.map((v,i)=>v-u[i]*lengthM*BNE_SCALE);
  const at=(along,across=0)=>[start[0]+(u[0]*along-u[1]*across)*BNE_SCALE,start[1]+(u[1]*along+u[0]*across)*BNE_SCALE];
  const polygon=strip(start,end,widthM*BNE_SCALE);
  // CASA MOS 8.106: white permanent-closure crosses, 36 x 14.5 m,
  // 1.8 m strokes, at both ends and no more than 300 m apart.
  let angle=.36;
  for(let i=0;i<12;i++)angle=Math.atan2(7.25-.9*Math.cos(angle),18-.9*Math.sin(angle));
  const halfAlong=18-.9*Math.sin(angle),halfAcross=7.25-.9*Math.cos(angle);
  const stations=Array.from({length:8},(_,i)=>20+i*(lengthM-40)/7);
  const crosses=stations.map(distance=>({distance,polygons:[-1,1].map(sign=>strip(at(distance-halfAlong,-sign*halfAcross),at(distance+halfAlong,sign*halfAcross),1.8*BNE_SCALE))}));
  layout.retiredRunways=[{id:'former-14-32',designators:['14','32'],closed:true,activeForGame:false,simulated:false,parkingAllowed:true,lengthM,widthM,start,end,polygon,crosses,
    parkingBays:['R1','R1A','R2','R3','R4','R5'],adjacentParkingBays:['R6','R7','R8'],
    source:'BAC 2014 runway booklet; AP06-187; Esri/Vantor 2025 imagery',
    labelPosition:at(480,35),labelAngle:Math.atan2(u[1],u[0])+Math.PI}];
  // An apron surface supports parking; it never enters operatingRunway's
  // runway inventory or receives approach, threshold, centreline or lights.
  layout.aprons.push({id:'former-14-32-pavement',polygon,retiredRunway:true});
  layout.notes.push('Former runway 14/32 retains its 1,760 m pavement with white closure crosses. R1–R5 and alternative R1A are individually purchasable parking positions on the strip; R6–R8 are on its adjoining spur. It cannot be used for takeoff or landing.');
}

export function drawBrisbaneRetiredRunwayMarkings(layout,{poly,groundText,zoom}) {
  for(const runway of layout.retiredRunways||[]){
    for(const cross of runway.crosses)for(const polygon of cross.polygons)poly(polygon,'#faf8ec');
    if(zoom>=1.7)groundText('FORMER 14 / 32 · CLOSED · PARKING',...runway.labelPosition,1.8,'#496c67',runway.labelAngle);
  }
}
