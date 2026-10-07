import {GROUND_EQUIPMENT,groundEquipmentGeometry,drawGroundEquipment,equipmentFitsAirport} from './ground-equipment.mjs';
const art=new Map();
const descriptions={bus:'Wide low-floor passenger bus with six double doors, panoramic glazing and roof cooling. Shuttles to remote stands where a clear apron loop fits; otherwise waits at a stand.',fuel:'Rounded fuel tank, access ladder, hose reels and a three-axle chassis.',tug:'Low cab with raked glazing, open wheel arches and front/rear towing jaws.',baggage:'Open driving position, long bonnet and a covered cart with curtains and fifth-wheel steering.',gpu:'Towable generator with cooling louvres, controls and a cable reel.',belt:'Raised baggage conveyor with handrails and hydraulic supports.',stairs:'Mobile boarding stairs with anti-slip edges and stabiliser feet.',cargo:'Scissor-lift cargo platform with transfer rollers and a container.',heavyTug:'Heavy ballast tractor with broad side decks, a low cab and large pneumatic tyres.'};

export function equipmentPreview(kind,heading=-.35){
  const key=kind+':'+heading;if(art.has(key))return art.get(key);
  const g=groundEquipmentGeometry(kind),c=Math.cos(heading),s=Math.sin(heading),points=g.vertices.map(([x,y,z])=>[(x*c-y*s)-(x*s+y*c),((x*c-y*s)+(x*s+y*c))*.455-z]);
  const lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];for(const p of points)for(let k=0;k<2;k++){lo[k]=Math.min(lo[k],p[k]);hi[k]=Math.max(hi[k],p[k])}
  const canvas=document.createElement('canvas');canvas.width=720;canvas.height=440;
  const scale=Math.min(650/(hi[0]-lo[0]),360/(hi[1]-lo[1])),cx=360-(lo[0]+hi[0])/2*scale,cy=215-(lo[1]+hi[1])/2*scale;
  drawGroundEquipment(canvas.getContext('2d'),{kind,heading,colour:kind==='bus'?'#319aa7':'#dfa342',metresToWorld:1,project:(x,y,z)=>({x:cx+(x-y)*scale,y:cy+(x+y)*scale*.455-z*scale})});
  const url=canvas.toDataURL('image/png');art.set(key,url);return url;
}

export function equipmentFleetMarkup(airport,rear=false){
  const level=airport.buildings?.find(b=>b.key==='handling')?.level??0;
  return `<p class="dialog-lead">Your ground fleet grows with Ground equipment upgrades. Vehicles are staged on available apron space, with a smaller fleet at light and regional airports.</p><div class="segmented-control" aria-label="Equipment viewing angle"><button data-action="equipment-angle" data-rear="false" class="${rear?'':'active'}">Front view</button><button data-action="equipment-angle" data-rear="true" class="${rear?'active':''}">Rear view</button></div><div class="dialog-grid ground-equipment-grid">${Object.entries(GROUND_EQUIPMENT).map(([kind,m])=>{
    const fits=equipmentFitsAirport(kind,airport.maxSize),unlocked=fits&&level>=m.minLevel;
    return `<article class="operation-card fleet-card"><div class="ground-equipment-art"><img src="${equipmentPreview(kind,rear?Math.PI-.35:-.35)}" alt="${m.name}" width="720" height="440"></div><span class="aircraft-class">GROUND SUPPORT · LEVEL ${m.minLevel}</span><h3>${m.name}</h3><span class="status-chip ${unlocked?'':'locked'}">${unlocked?'Unlocked':fits?'Ground equipment L'+m.minLevel:'Requires a larger airport'}</span><p>${descriptions[kind]}</p></article>`;
  }).join('')}</div>`;
}
