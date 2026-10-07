import {BRISBANE_DOMESTIC_SOURCE as source} from './brisbane-domestic-source.mjs';
import {domesticPoint} from './brisbane-bays.mjs';
import {domesticLaneGeometry} from './brisbane-domestic-lanes.mjs';

// Geographic registration, not an image fitted to the game's old roads.
// Source pixels refer to the 1600-square review of the original 2048 export.
export function domesticAerialPoint([x,y]){
  const e=source.extent,n=source.pixelSize;
  const mx=e.xmin+x/n*(e.xmax-e.xmin),my=e.ymax-y/n*(e.ymax-e.ymin);
  const lon=mx/6378137*180/Math.PI,lat=(2*Math.atan(Math.exp(my/6378137))-Math.PI/2)*180/Math.PI;
  return domesticPoint([56.5+(lon-153.11666666666667)*3600/6*46.7,91.8+(-27.38-lat)*3600/6*52.3]);
}
const polygon=p=>p.map(domesticAerialPoint);
const bounds=p=>({x:Math.min(...p.map(q=>q[0])),y:Math.min(...p.map(q=>q[1])),w:Math.max(...p.map(q=>q[0]))-Math.min(...p.map(q=>q[0])),h:Math.max(...p.map(q=>q[1]))-Math.min(...p.map(q=>q[1]))});
const origin=domesticAerialPoint([800,800]),unit=domesticAerialPoint([801,800]);
export const DOMESTIC_PIXEL_SCALE=Math.hypot(unit[0]-origin[0],unit[1]-origin[1]);
const geometry=rows=>rows.map(r=>({...r,polygon:polygon(r.polygon)}));
export function addBrisbaneDomesticPrecinct(layout){
  const roads=source.roads.map(r=>({...r,points:polygon(r.points),width:r.width*DOMESTIC_PIXEL_SCALE,domesticPrecinct:true}));
  // Replace only the obsolete domestic legs; keep the southern approach and
  // the airport-wide northern road and its protected taxiway underpasses.
  layout.roads=layout.roads.filter(r=>!['domestic-forecourt','domestic-parking-access'].includes(r.id));
  const drive=layout.roads.find(r=>r.id==='airport-drive');
  drive.points=[...drive.points.slice(0,4),...polygon(source.approaches.airport),roads[0].points[0]];
  drive.width=2.3;
  const moreton=layout.roads.find(r=>r.id==='moreton-drive');
  moreton.points=[...moreton.points.slice(0,2),...polygon(source.approaches.moreton),roads[0].points.at(-1)];
  moreton.width=2.4;
  // The old generic industrial block covers the observed Moreton approach
  // and wooded land, not an Airport Central building in the aerial.
  layout.landmarks=layout.landmarks.filter(m=>m.label!=='Airport Central');
  const north=layout.roads.find(r=>r.id==='airport-north-road');
  const dryandra=polygon(source.approaches.dryandra);
  north.points=[...dryandra,[329,-49],[339.95,-49],...north.points.slice(2)];
  roads.find(r=>r.id==='domestic-stradbroke-return').points.push(...polygon(source.approaches.staff).slice(1));
  // The parking-access branch rejoins Airport Drive beyond the southern end
  // of P2; it must not terminate at an arbitrary aerial-image boundary.
  roads.find(r=>r.id==='domestic-p1-p2-access').points.push(polygon(source.approaches.airport).at(-2));
  layout.roads.push(...roads);
  const rail=layout.railways.find(r=>r.id==='airtrain');
  rail.points=[...rail.points.slice(0,6),...polygon(source.station.rail)];
  rail.width=.75;rail.domesticPrecinct=true;
  const station=layout.stations.find(s=>s.id==='domestic-station'),platform=polygon(source.station.platform),r=bounds(platform);
  Object.assign(station,{...r,y:r.y+r.h/2,polygon:platform,domesticPrecinct:true});
  const extension=polygon(source.p2Extension);
  layout.terminals.push({id:'domestic-p2-extension',name:'Domestic P2 southern extension',polygon:extension,rect:bounds(extension),height:2.4,kind:'parking'});
  // AP01's black terminal symbols create cut-outs in its grey pavement.
  // The aerial shows concrete, rather than grass, around these lounges and
  // beneath their boarding links. Restore only those local building courts.
  for(const court of source.apronCourts){
    const points=Array.from({length:48},(_,i)=>[court.centre[0]+Math.cos(i/48*Math.PI*2)*court.radius,court.centre[1]+Math.sin(i/48*Math.PI*2)*court.radius]);
    layout.aprons.push({id:`domestic-building-court-${court.id}`,polygon:polygon(points),surfaceColour:'#c8c6b3',sourceBuildingCourt:true});
  }
  for(const [i,[a,b]] of source.apronLinks.entries()){
    const dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy),nx=-dy/d*15,ny=dx/d*15;
    layout.aprons.push({id:`domestic-building-link-${i}`,polygon:polygon([[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]]),surfaceColour:'#c8c6b3',sourceBuildingCourt:true});
  }
  for(const [i,p] of source.apronCourtyards.entries())layout.aprons.push({id:`domestic-building-courtyard-${i}`,polygon:polygon(p),surfaceColour:'#c8c6b3',sourceBuildingCourt:true});
  layout.domesticPrecinct={
    laneModel:domesticLaneGeometry(domesticAerialPoint,DOMESTIC_PIXEL_SCALE),
    source:'BRISBANE-DOMESTIC-AREA-AUDIT.md',roads,
    islands:geometry(source.islands),bridges:geometry(source.bridges),shelters:geometry(source.shelters),
    crossings:source.crossings.map(c=>({...c,a:domesticAerialPoint(c.a),b:domesticAerialPoint(c.b),width:c.width*DOMESTIC_PIXEL_SCALE})),
    station:{platform,roof:polygon(source.station.roof)},solar:geometry(source.solar),
    terminalRoof:source.terminalRoof.map(polygon),apronConcrete:polygon(source.apronConcrete),apronService:polygon(source.apronService),
    surfaceParking:geometry(source.surfaceParking),trees:polygon(source.treePixels)
  };
  return layout;
}
