import {BRISBANE_HANGAR_SOURCE} from './brisbane-hangar-source.mjs';
import {BRISBANE_HANGAR_PAVEMENT} from './brisbane-hangar-pavement.mjs';
import {BRISBANE_LOGISTICS_BUILDINGS} from './brisbane-logistics-source.mjs';
import {logisticsPoint,BNE_SCALE} from './brisbane-bays.mjs';

// Individual roof/annex partitions, measured against the registered aerials.
// u runs along the apron elevation; v runs from that elevation to the rear.
// Elevation estimates are deliberately separate from the chart footprints.
const part=(u,v,w,d,eave,rise=0,extra={})=>({u,v,w,d,eave,rise,...extra});
const profiles={
 'qantas-3':{name:'Qantas heavy maintenance Hangar 3',front:'+x',parts:[
  part(0,0,.10,1,8),part(.10,.61,.72,.39,9),part(.82,0,.18,1,12),
  part(.10,0,.72,.61,30,1.4,{doors:5,panels:1,doorHeight:28,doorWidth:160,ridgeAxis:'u',sign:'QANTAS  3',roof:'#dddccf',vents:6})]},
 'qantas-2':{name:'Qantas maintenance Hangar 2',front:'+x',parts:[
  part(0,0,.12,1,7),part(.12,.84,.88,.16,7),
  part(.12,0,.88,.84,18,3,{doors:2,panels:3,ridgeAxis:'u',canopy:4,sign:'QANTAS  2',roof:'#e9e3ce',skylights:1})]},
 'northrop-1':{name:'Northrop Grumman Hangar 1',front:'+x',parts:[
  part(0,0,.21,1,8,1,{skylights:2}),part(.80,0,.20,1,8,0,{office:true}),
  part(.21,0,.59,.42,13,1,{doors:1,panels:5,skylights:3}),
  part(.21,.42,.59,.58,20,2,{skylights:6,vents:3})]},
 'qld-airwing':{name:'Queensland Government Air Wing hangar',front:'+x',parts:[
  part(0,.78,1,.22,4.5,0,{office:true}),part(0,0,1,.78,8.5,1.2,{doors:2,panels:3,skylights:2})]},
 'pandanus-104':{parts:[part(0,0,1,1,11,1.2,{doors:2,panels:4,skylights:5})]},
 'pandanus-249':{parts:[part(0,.76,1,.24,4.5,0,{office:true}),part(0,0,1,.76,8,1.5,{doors:1,panels:4,skylights:4})]},
 'pandanus-084':{parts:[part(0,.65,1,.35,4),part(0,0,1,.65,8,1,{doors:1,panels:4,roof:'#d3d4c4',skylights:2})]},
 'pandanus-217':{parts:[part(0,.84,1,.16,7,0,{office:true}),part(0,0,1,.84,18,1.5,{doors:2,panels:6,ridgeAxis:'u',roof:'#efeee0'})]},
 'pandanus-136':{parts:[part(.68,0,.32,1,6,0,{office:true}),part(0,0,.68,.51,9.5,1.2,{doors:1,panels:5,skylights:3}),part(0,.51,.68,.49,8,1,{skylights:3})]},
 'pandanus-224':{parts:[part(0,0,1,1,18,1.2,{doors:2,panels:6,ridgeAxis:'u',roof:'#efeee0'})]},
 'pandanus-137':{parts:[part(.73,0,.27,1,4,0,{office:true,roundOffice:true}),part(0,0,.73,1,10,1.5,{doors:1,panels:5,skylights:10,roof:'#dedfcf'})]},
 'pandanus-138':{name:'Hangar One, 81 Pandanus Avenue, building 138',parts:[part(.58,0,.42,1,4,0,{office:true,roundOffice:true}),part(0,0,.58,.67,10.3,1.1,{doors:1,panels:4,doorHeight:9.3,doorWidth:31.3}),part(0,.67,.58,.33,8.5,1,{skylights:2})]},
 'pandanus-223':{name:'Virgin Australia maintenance hangar, building 223',parts:[part(0,.78,1,.22,7,0,{office:true}),part(0,0,1,.78,18,1.5,{doors:2,panels:5,ridgeAxis:'u',roof:'#efeee0',sign:'virgin australia'})]},
 'pandanus-285':{name:'Southern Pandanus hangar, building 285',parts:[part(0,.86,1,.14,4),part(0,0,1,.86,10,1.1,{doors:1,panels:6,vents:4})]},
 'ga-204':{name:'Royal Flying Doctor Service base, building 204',parts:[part(0,.75,1,.25,4,0,{office:true}),part(0,0,1,.75,8,1.2,{doors:2,panels:4,skylights:4})]},
 'ga-128':{parts:[part(0,.80,1,.20,4,0,{office:true}),part(0,0,1,.80,7,1.2,{doors:1,panels:4,skylights:3,roof:'#d5d2bd'})]},
 'ga-129':{kind:'support',parts:[part(0,0,1,1,4.5,.3,{office:true})]},
 'ga-130':{kind:'support',parts:[part(0,0,1,1,4,.2,{office:true})]},
 'ga-131':{kind:'support',parts:[part(0,0,1,1,4,1.5,{office:true})]},
 'ga-132':{parts:[part(0,.77,1,.23,5,0,{office:true}),part(0,0,.26,.77,7,1,{doors:1,panels:3}),part(.26,0,.74,.77,10,1.5,{doors:2,panels:4,ridgeAxis:'u'})]},
 'ga-133':{parts:[part(0,.73,1,.27,4.5,0,{office:true}),part(0,0,1,.73,9,.7,{doors:1,panels:6,vents:3})]},
 'ga-973':{kind:'support',name:'Casuarina workshop, building 973',parts:[part(0,0,.38,1,6,1),part(.38,0,.62,1,8,1.2,{skylights:5})]},
 'south-246':{name:'Boronia Road hangar, building 246',front:'south-apron',replace:'logistics-building-1',parts:[part(0,.80,1,.20,4,0,{office:true}),part(0,0,1,.80,8,1.1,{doors:2,panels:4,skylights:3})]},
 'south-206':{name:'Boronia Road airside support building 206',kind:'support',front:'south-apron',replace:'logistics-building-3',parts:[part(0,.70,1,.30,5,0,{office:true}),part(0,0,1,.70,8,1,{office:true,vents:5})]},
 'south-218':{name:'Aviation Australia training hangar, building 218',front:'south-apron',replace:'logistics-building-29',parts:[part(0,.66,1,.34,5,0,{office:true}),part(0,0,.35,.66,7,1.2,{doors:1,panels:3}),part(.35,0,.65,.66,10,1.5,{doors:1,panels:5,skylights:3})]},
};
export const hangarBounds=p=>({x:Math.min(...p.map(q=>q[0])),y:Math.min(...p.map(q=>q[1])),w:Math.max(...p.map(q=>q[0]))-Math.min(...p.map(q=>q[0])),h:Math.max(...p.map(q=>q[1]))-Math.min(...p.map(q=>q[1]))});

export function addBrisbaneHangars(layout){
 const sources=[...BRISBANE_HANGAR_SOURCE,...[[246,1],[206,3],[218,29]].map(([id,i])=>({id:`south-${id}`,area:'south',sourceFile:'BBNAP04-181_03SEP2026.pdf',sourcePath:i,pdfPolygon:BRISBANE_LOGISTICS_BUILDINGS[i],polygon:BRISBANE_LOGISTICS_BUILDINGS[i].map(logisticsPoint)}))];
 const buildings=sources.map(source=>{
  const profile=profiles[source.id];
  if(!profile)throw new Error(`Missing Brisbane hangar profile ${source.id}`);
  const rect=hangarBounds(source.polygon),front=profile.front||(source.area==='east'?'-y':'+x');
  return {...source,...profile,rect,front,name:profile.name||`${source.area==='east'?'Pandanus Avenue':'General aviation'} building ${source.id.split('-').at(-1)}`,kind:profile.kind||'hangar',hangarArchitecture:true,height:Math.max(...profile.parts.map(p=>p.eave+p.rise))*BNE_SCALE};
 });
 const replaced=new Set(buildings.map(b=>b.replace).filter(Boolean));
 layout.terminals=layout.terminals.filter(t=>!t.id.startsWith('ga-hangar-')&&t.id!=='ga-service'&&!replaced.has(t.id));
 for(const t of layout.terminals)if(t.id.startsWith('logistics-building-'))t.kind='warehouse';
 layout.terminals.push(...buildings);
 layout.hangars=buildings.filter(b=>b.kind==='hangar');
 layout.hangarSupportBuildings=buildings.filter(b=>b.kind==='support');
 layout.landmarks=layout.landmarks.filter(l=>!['airline-south','airline-middle','airline-north','ga-maintenance'].includes(l.id));
 layout.aprons=layout.aprons.filter(a=>!['airline-north-apron','airline-middle-apron','airline-south-apron','ga-maintenance-apron'].includes(a.id));
 layout.aprons.push(...BRISBANE_HANGAR_PAVEMENT);
 layout.notes.push('Hangars use individual chart footprints and photo-informed roofs, cladding, doors and annexes. Hidden elevations and unmeasured heights remain estimates. The aeromedical precinct under construction is not represented as an operational hangar.');
 return layout;
}
