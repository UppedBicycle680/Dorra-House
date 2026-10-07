import {AIRCRAFT_GROUND_SHAPES} from './aircraft-ground-geometry.mjs';
import {AIRCRAFT_DIMENSIONS} from './aircraft-dimensions.mjs';

// A split stand changes which arm serves an aircraft, not how many bridges
// physically exist. Keep the other arm folded when only one half is occupied.
export function visibleBrisbaneJetways(jetways,occupiedPlots){
  return jetways.filter(j=>{
    const base=j.bay.replace(/[AB]$/,''),primary=jetways.find(k=>k.bay===base);
    const occupiedAlternatives=jetways.some(k=>k.bay!==base&&k.bay.replace(/[AB]$/,'')===base&&occupiedPlots.has(k.plotId));
    if(primary===j&&!occupiedPlots.has(j.plotId)&&occupiedAlternatives)return false;
    if(primary&&primary!==j&&!occupiedPlots.has(j.plotId))return Boolean(primary.dual&&occupiedAlternatives);
    return true;
  });
}

export function drawBrisbaneBays(layout,airport,{line,groundText,hit,scale,zoom,project}){
  const gates=new Map(airport.gates.map(g=>[g.plotId,g]));
  for(const s of layout.stands){
    const g=gates.get(s.plotId),active=g?.active,p=s.position,c=Math.cos(s.heading),n=Math.sin(s.heading);
    const local=(u,v)=>[p[0]+u*c-v*n,p[1]+u*n+v*c];
    const length=s.maxLength*layout.metresToWorld,span=s.maxSpan*layout.metresToWorld;
    // Alternate stops are real markings on shared concrete, not new green land.
    const alternate=/[ABCD]$/.test(s.bay),colour=active?'#eed28a':alternate?'#d8cba47a':'#dfd0a9';
    if(!alternate||g){line([local(-length*.52,-span*.51),local(length*.52,-span*.51),local(length*.52,span*.51),local(-length*.52,span*.51)],active?'#f4e4b6':'#e9dfc0a0',Math.max(.45,scale*.045));}
    line([local(-length*.75,0),local(length*.27,0)],colour,Math.max(.5,scale*.065));
    line([local(length*.27,-.55),local(length*.27,.55)],colour,Math.max(.55,scale*.075));
    if((zoom>=1.7||active)&&(!alternate||active||zoom>=8)){const q=local(-length*.62,0);groundText(s.bay,...q,Math.min(1.5,span*.3),active?'#3e746c':'#6b8075');}
    const r=s.rect,target=hit(g?'gate':'plot',g?.id||s.plotId,r.x,r.y,r.w,r.h,`${s.precinct} · bay ${s.bay}${g?'':' · Purchase operating space'}`);target.points=s.envelope.map(p=>project(...p));
  }
}
export function jetwayGeometry(j,stand,flight,scale){
  const m=flight?.phase==='servicing'?AIRCRAFT_DIMENSIONS[flight.aircraftId]:null;
  // Light aircraft use stairs; the jet bridge stays parked by the concourse.
  if(!m||m.length<30||AIRCRAFT_GROUND_SHAPES[flight.aircraftId]?.cargo)return {...j,end:j.retracted,attached:false};
  const door=AIRCRAFT_GROUND_SHAPES[flight.aircraftId]?.door;
  const h=flight.heading,c=Math.cos(h),s=Math.sin(h),forward=(door?.[0]??m.length*.29)*scale,side=(door?.[1]??-Math.min(m.wingspan*.05,3.2))*scale;
  const second=AIRCRAFT_GROUND_SHAPES[flight.aircraftId]?.secondDoor;
  const secondEnd=j.dual&&second?[flight.x+(second[0]*c-second[1]*s)*scale,flight.y+(second[0]*s+second[1]*c)*scale]:null;
  return {...j,end:[flight.x+forward*c-side*s,flight.y+forward*s+side*c],endHeight:Math.max(.3,(door?.[2]??4)*scale+.12),secondEnd,secondHeight:second?second[2]*scale+.12:null,attached:true};
}
export function drawBrisbaneJetway(j,{poly,line,disc,defer,scale}){
  const beam=(a,b,width,z,endZ=z)=>{
    const d=Math.hypot(b[0]-a[0],b[1]-a[1])||1,n=[-(b[1]-a[1])/d*width/2,(b[0]-a[0])/d*width/2];
    const p=[[a[0]+n[0],a[1]+n[1]],[b[0]+n[0],b[1]+n[1]],[b[0]-n[0],b[1]-n[1]],[a[0]-n[0],a[1]-n[1]]];
    const heights=[z,endZ,endZ,z];
    poly(p.map((q,i)=>[...q,heights[i]]),'#e7eee4','#7c9d94',Math.max(.3,scale*.035));
    for(let i=0;i<4;i++){const a=p[i],b=p[(i+1)%4];poly([[...a,heights[i]-.24],[...b,heights[(i+1)%4]-.24],[...b,heights[(i+1)%4]],[...a,heights[i]]],i%2?'#9fbcba':'#bfd1c7');}
    line([[...a,z-.12],[...b,endZ-.12]],'#59888e',Math.max(.5,scale*.075));
  };
  const [x,y]=j.end;
  defer((j.anchor[0]+x)/2,(j.anchor[1]+y)/2+.2,()=>{
    line([j.anchor,j.elbow,j.end],'#395d4622',Math.max(1,scale*.5));
    beam(j.anchor,j.elbow,.48,j.height);beam(j.elbow,j.end,.43,j.height,j.endHeight??j.height);
    disc(...j.elbow,.25,'#e9ecda',j.height+.03);
    line([[x,y,.12],[x,y,(j.endHeight??j.height)-.24]],'#78918a',Math.max(.7,scale*.13));
    disc(x-.19,y,.12,'#3e5956');disc(x+.19,y,.12,'#3e5956');disc(x,y,.28,'#6f9391',(j.endHeight??j.height)-.04);
    if(j.dual){
      // An unused arm remains folded by the rotunda. A second live arm follows
      // a separate modelled boarding door, including the A380 upper deck.
      const end=j.secondEnd||[j.elbow[0]+.55,j.elbow[1]+.55],z=j.secondEnd?j.secondHeight:j.height;
      beam(j.elbow,end,.38,j.height,z);
      line([[...end,.12],[...end,z-.24]],'#78918a',Math.max(.6,scale*.1));
      disc(...end,.22,'#6f9391',z-.04);
    }
  });
}
