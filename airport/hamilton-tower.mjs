import {HAMILTON_SCALE as S,hamiltonGeoPoint,hamiltonRect} from './hamilton-reference.mjs';
import {hamiltonTerrainElevation} from './hamilton-scenery.mjs';

// ERSA FAC YBHM: permanent tower 20 21 10.50 S / 148 57 04.60 E,
// obstacle top 101 ft AMSL; aerodrome 15 ft. Airservices lists height 5 m.
// Detailed elevations and hill profile are photo-informed, not surveyed.
export const HAMILTON_TOWER_CENTRE=hamiltonGeoPoint([-(20+21/60+10.5/3600),148+57/60+4.6/3600]);
// Fit the highest mast point to the obstacle elevation; the occupied building
// remains 5 m tall. The inferred base elevation is not a surveyed spot height.
export const HAMILTON_TOWER_FLOOR=((101-15)*.3048-6.8)*S;
export const HAMILTON_TOWER_TOP=HAMILTON_TOWER_FLOOR+5*S;
// OSM way 474159027, retrieved 9 September 2026.
// © OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright
const geo=[[-20.3528545,148.9511991],[-20.3528142,148.9512608],[-20.3528632,148.9512972],[-20.352867,148.9513205],[-20.3528746,148.9513307],[-20.3529307,148.9513345],[-20.3529318,148.951315],[-20.3529561,148.9512814],[-20.3529556,148.9512464],[-20.3529261,148.951223],[-20.352897,148.9512306],[-20.3528545,148.9511991]];
export const HAMILTON_TOWER_POLYGON=geo.map(hamiltonGeoPoint);
export const HAMILTON_TOWER_RECT=hamiltonRect(HAMILTON_TOWER_POLYGON);
export const HAMILTON_TOWER_TERRAIN_RECT={x:HAMILTON_TOWER_CENTRE[0]-10,y:HAMILTON_TOWER_CENTRE[1]-18,w:20,h:26};

export function drawHamiltonTowerTerrain(layout,{poly,defer}){
  const [cx,cy]=HAMILTON_TOWER_CENTRE,cells=[],radii=[0,.2,.42,.62,.8,1],segments=40;
  const vertex=(r,i)=>{const a=i/segments*Math.PI*2,x=cx+Math.cos(a)*10*r,y=cy+Math.sin(a)*(Math.sin(a)>0?8:18)*r;
    const z=HAMILTON_TOWER_FLOOR*Math.min(1,Math.pow((1-r)/.58,.7));
    return [x,y,Math.max(z,hamiltonTerrainElevation(layout.landmarks[0],x,y))]};
  for(let ring=1;ring<radii.length;ring++)for(let i=0;i<segments;i++){
    const q=[vertex(radii[ring-1],i),vertex(radii[ring],i),vertex(radii[ring],i+1),vertex(radii[ring-1],i+1)];
    const y=q.reduce((n,p)=>n+p[1],0)/4,shade=y>cy+4?'#a39b81':(i%3===0?'#8c9c70':'#8a9c6b');
    cells.push({q,shade,depth:q.reduce((n,p)=>n+p[0]+p[1],0)/4});
  }
  // Render this continuous terrace before the structure it supports. Sorting
  // individual elevated cells among the cab faces buried the front windows.
  defer(cx-4,cy-4,()=>{for(const {q,shade} of cells.sort((a,b)=>a.depth-b.depth)){poly([q[0],q[1],q[2]],shade);poly([q[0],q[2],q[3]],shade)}});
}

export function drawHamiltonTower({poly,line,defer,scale}){
  const [cx,cy]=HAMILTON_TOWER_CENTRE,z=HAMILTON_TOWER_FLOOR;
  const point=(x,y,h)=>[cx+x*S,cy+y*S,z+h*S];
  const ring=(radius,h)=>Array.from({length:8},(_,i)=>point(Math.cos(Math.PI/8+i*Math.PI/4)*radius,Math.sin(Math.PI/8+i*Math.PI/4)*radius,h));
  const walls=(base,top,colours)=>{
    const edges=base.map((a,i)=>({a,b:base[(i+1)%base.length],c:top[(i+1)%top.length],d:top[i],i})).sort((a,b)=>a.a[0]+a.b[0]+a.a[1]+a.b[1]-b.a[0]-b.b[0]-b.a[1]-b.b[1]);
    for(const e of edges){poly([e.a,e.b,e.c,e.d],colours[e.i%colours.length]);if(scale>6)line([e.a,e.d],'#c0c8ba',.45)}
  };
  defer(cx,cy,()=>{
    const footprint=HAMILTON_TOWER_POLYGON.slice(0,3).concat([[114.0,50.9]]);
    poly(footprint.map(p=>[...p,z]),'#aeac94');
    walls(footprint.map(p=>[...p,z]),footprint.map(p=>[...p,z+2.65*S]),['#d9dfd0','#c6d0bf','#e5e7d7']);
    poly(footprint.map(p=>[...p,z+2.65*S]),'#d8dccb');
    // Low corrugated equipment room adjoining the cab, with a service door.
    for(let x=112.6;x<113.85;x+=.14)line([[x,50.84,z+.15*S],[x,50.84,z+2.55*S]],'#aebdac',.4);
    poly([[112.75,50.85,z],[113.05,50.85,z],[113.05,50.85,z+1.9*S],[112.75,50.85,z+1.9*S]],'#41615a');
    walls(ring(2.8,0),ring(2.8,2.2),['#e6e9db','#c9d4c5']);
    const deck=ring(3.5,2.2);poly(deck,'#d7decd');
    walls(ring(2.65,2.2),ring(2.65,2.5),['#e6e9db','#c9d4c5']);
    // Outward-sloping wraparound glass; no tall glass-covered shaft.
    const lower=ring(2.65,2.5),upper=ring(3.25,4.45);
    walls(lower,upper,['#254e58','#3d7681','#5b939b','#294f60']);
    for(let i=0;i<8;i++){
      const a=lower[i],b=upper[i];line([a,b],'#c7d2c7',.65);
      const j=(i+1)%8;line([a.map((v,k)=>(v+lower[j][k])/2),b.map((v,k)=>(v+upper[j][k])/2)],'#a9beb5',.45);
    }
    // White corner columns carry the broad clipped-corner roof fascia.
    for(const x of [-2.5,2.5])for(const y of [-2.5,2.5]){
      const a=[point(x-.15,y-.15,0),point(x+.15,y-.15,0),point(x+.15,y+.15,0),point(x-.15,y+.15,0)];
      walls(a,a.map(p=>[p[0],p[1],z+4.6*S]),['#edf0e0','#cdd8c6']);
    }
    walls(ring(3.7,4.45),ring(3.7,5),['#f0efdf','#d7ddcd']);poly(ring(3.7,5),'#d8dfd2');
    const rail=ring(3.5,2.9);line([...rail,rail[0]],'#e4e8d7',.8);
    for(let i=0;i<8;i++)line([deck[i],rail[i]],'#d9e2d1',.7);
    // Exterior maintenance stair/ladder, rear mast and service equipment.
    for(const x of [-6.6,-5.7])line([point(x,2.9,.05),point(x,-1.8,2.75)],'#b8c5b5',.7);
    for(let n=0;n<10;n++){const t=n/9;line([point(-6.6,2.9-4.7*t,.05+2.7*t),point(-5.7,2.9-4.7*t,.05+2.7*t)],'#dce2d2',.6)}
    line([point(-4.3,-3.7,2.7),point(-4.3,-3.7,6.8)],'#bbc8b8',.65);
    line([point(-5,-3.7,5.8),point(-3.6,-3.7,5.8)],'#bbc8b8',.5);
    const dish=Array.from({length:20},(_,i)=>point(-7.7+1.3*Math.cos(i*Math.PI/10),-4.1,2.3+1.0*Math.sin(i*Math.PI/10)));
    line([point(-7.7,-4.1,0),point(-7.7,-4.1,2.2)],'#7c8f7b',.8);poly(dish,'#dedfcd');
  });
}
