import {REDCLIFFE_BAYS,REDCLIFFE_FUEL_REFERENCE,REDCLIFFE_EAST_FUEL,REDCLIFFE_FUEL_BAYS,REDCLIFFE_APRONS,redcliffeAerialPoint as p} from './redcliffe-reference.mjs';
import {REDCLIFFE_ACTIVE_BAYS} from './redcliffe-layout.mjs';
import {drawRedcliffeApronMarkings} from './redcliffe-ground.mjs';
import {REDCLIFFE_HANGAR_SECTIONS,drawRedcliffeHangars} from './redcliffe-hangars.mjs';
export const REDCLIFFE_HANGARS=REDCLIFFE_HANGAR_SECTIONS;
export const REDCLIFFE_PARKING=REDCLIFFE_BAYS.slice(1); // Position zero is the eastern fuel bay.
export const REDCLIFFE_FUEL=REDCLIFFE_FUEL_REFERENCE;
const centre=points=>points.reduce((s,p)=>[s[0]+p[0]/points.length,s[1]+p[1]/points.length],[0,0]);

export function drawRedcliffeFacilities({rect,road,line,poly,box,disc,defer,groundText,badge,aircraft,zoom,scale,clipMarkings=draw=>draw()}){
  // Hangar pavement is painted and recorded with the airfield surfaces.
  const apron=REDCLIFFE_APRONS.find(a=>a.id==='fuel-apron');poly(apron.polygon,'#c9cebb');
  // The real visitor area lies beyond the eastern apron, towards runway 25.
  poly([[1430,445],[1680,390],[1660,303],[1430,356]].map(p),'#a6bd85');
  for(const [i,bay] of REDCLIFFE_BAYS.entries()){
    if(i===0)continue; // This source aircraft is at the eastern fuel bay.
    const [x,y]=bay.position,grass=bay.surface==='grass',heading=i>=7&&i<13?-Math.PI/2:Math.PI/2;
    if(grass)for(const dx of [-1.8,1.8])disc(x+dx,y,.13,'#e0ddba');
    if(bay.occupied&&!REDCLIFFE_ACTIVE_BAYS.includes(i))aircraft(x,y,heading,grass?'#bb946c':'#72959e');
  }
  drawRedcliffeHangars({poly,line,defer,scale});
  const f=REDCLIFFE_FUEL_REFERENCE,compound=f.compound,[cx,cy]=centre(compound);
  poly(compound,'#a9b9a4');line([...compound,compound[0]],'#687f73',Math.max(.6,scale*.1));
  defer(cx,cy,()=>{
    for(const dx of [-.72,.42])box(cx+dx,cy-1,.8,2,.75,'#f2edda','#d4d7c9','#a6b9ad');
    for(const v of compound)line([[...v,0],[...v,1]],'#819789',Math.max(.4,scale*.07));
  });
  const [fx,fy]=f.dispenser;defer(fx,fy,()=>{box(fx-.3,fy-.3,.6,.6,.9,'#d9d5bd','#afbb99','#8da18c');line([[fx,fy,.6],[fx+1,fy+1,.1],[...f.stand,.1]],'#476459',Math.max(.7,scale*.09))});
  // The pad in the source photograph is occupied by a light helicopter.
  const [hx,hy]=f.stand;
  defer(hx,hy,()=>{disc(hx,hy,1.1,'#3e5e4825');box(hx-.38,hy-.7,.76,1.4,.65,'#94afae','#678c8e','#526f74');line([[hx,hy+.2,.4],[hx,hy+1.9,.6]],'#6b8981',scale*.25);line([[hx-1.7,hy,.8],[hx+1.7,hy,.8]],'#5d7368',Math.max(.6,scale*.1));for(const dx of [-.5,.5])line([[hx+dx,hy-.6,.1],[hx+dx,hy+.8,.1]],'#607869',Math.max(.45,scale*.08))});
  const east=REDCLIFFE_EAST_FUEL,[ex,ey]=centre(east.compound),[px,py]=east.dispenser;
  poly(east.walkway,'#c0c7b6');
  poly(east.compound,'#8ea9a1');line([...east.compound,east.compound[0]],'#6c827a',Math.max(.6,scale*.1));
  // Independently traced fittings and two separate white frontage sections.
  // Height and hose shape remain simplified interpretations of aerial detail.
  defer(ex,ey,()=>{
    for(const [x,y] of east.fittings)box(x-.16,y-.2,.32,.4,.4,'#d7ddcf','#b7c6b7','#8fa69d');
    poly(east.serviceRack,'#9bab96');line(east.serviceRack.map(v=>[...v,.3]),'#d0d8bc',Math.max(.6,scale*.1));
    for(const q of east.frontSections){
      for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4];poly([[...a,0],[...b,0],[...b,.85],[...a,.85]],i%2?'#79958a':'#a6b9ad')}
      poly(q.map(v=>[...v,.85]),'#d9e0d2');
    }
    box(px-.2,py-.2,.4,.4,.6,'#d6dfcb','#a4b598','#819d8a');
    line([[px,py,.5],[px-.35,py-.8,.08],[east.stand[0],east.stand[1]+.5,.08]],'#486a5f',Math.max(.65,scale*.08));
  });
  clipMarkings(()=>{
    line([east.pad[1],east.pad[2]],'#89ac94',Math.max(.6,scale*.09));
    line([east.pad[2],east.pad[3],east.pad[0]],'#cfbd78',Math.max(.6,scale*.09));
    drawRedcliffeApronMarkings({line,groundText,scale});
  });
  aircraft(...east.stand,east.heading,'#aebbb5');
  if(zoom>=1.5){for(const bay of REDCLIFFE_FUEL_BAYS)badge('FUEL · '+bay.label,bay.dispenser[0]+(bay.id==='east-avgas'?7:0),bay.dispenser[1]+(bay.id==='east-avgas'?4:5),{small:true});badge('VISITOR PARKING',-30,92,{small:true})}
}
