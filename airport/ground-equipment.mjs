// Authored, metre-space ground support meshes. These are illustrative fleet
// designs, not manufacturer CAD. +X is the driving direction; Z is up.
// Curved tyres, tanks, reels and hydraulics carry the tessellation; flat panels
// are deliberately not subdivided just to inflate a triangle counter.
import {paintAircraftMesh} from './aircraft-raster.mjs';
import {buildGroundTractor} from './ground-equipment-tractors.mjs';
import {buildApronBus} from './ground-equipment-bus.mjs';

export const GROUND_EQUIPMENT=Object.freeze({
  fuel:{name:'Aviation fuel bowser',length:7.6,width:2.6,minLevel:1},
  tug:{name:'Pushback tractor',length:5.11,width:2.3,minLevel:2},
  baggage:{name:'Baggage tractor & cart',length:7.23,width:1.72,minLevel:2},
  gpu:{name:'Ground power unit',length:3.6,width:1.8,minLevel:3},
  belt:{name:'Belt loader',length:7.6,width:2.2,minLevel:3},
  stairs:{name:'Mobile passenger stairs',length:6.6,width:2.6,minLevel:3},
  bus:{name:'Passenger apron bus',length:13.9,width:3,minLevel:3},
  cargo:{name:'Container high loader',length:8.4,width:3.4,minLevel:4},
  heavyTug:{name:'Heavy pushback tractor',length:7.43,width:2.9,minLevel:5},
});
const cache=new Map(),TAU=Math.PI*2;
const fallbackViews=new Map();let fallbackPixels=0;
export const equipmentFitsAirport=(kind,capability=5)=>(capability>=2||['fuel','tug','baggage'].includes(kind))&&(capability>=4||!['cargo','heavyTug'].includes(kind));
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const d=Math.hypot(...a)||1;return a.map(v=>v/d)};

export function groundEquipmentGeometry(kind){
  if(cache.has(kind))return cache.get(kind);
  if(!GROUND_EQUIPMENT[kind])return null;
  const faces=[];
  const add=(points,material='body',part='body',normals)=>{
    const normal=unit(cross(sub(points[1],points[0]),sub(points[2],points[0])));
    if(Math.hypot(...normal)<.5)return;
    faces.push({points,material,part,normal,...(normals?{normals}:{})});
  };
  // Chamfered corners and shoulders catch light without painted fake edges.
  function box(x,y,z,l,w,h,material='body',part='body',bevel=.055){
    const b=Math.min(bevel,l/4,w/4,h/4),outline=(inset)=>[
      [-l/2+b,-w/2+inset],[l/2-b,-w/2+inset],[l/2-inset,-w/2+b],[l/2-inset,w/2-b],
      [l/2-b,w/2-inset],[-l/2+b,w/2-inset],[-l/2+inset,w/2-b],[-l/2+inset,-w/2+b],
    ];
    const rings=[[b*.5,z],[0,z+b],[0,z+h-b],[b*.5,z+h]].map(([inset,height])=>outline(inset).map(([u,v])=>[x+u,y+v,height]));
    for(let j=0;j<3;j++)for(let i=0;i<8;i++)add([rings[j][i],rings[j][(i+1)%8],rings[j+1][(i+1)%8],rings[j+1][i]],material,part);
    add([...rings[0]].reverse(),material,part);add(rings[3],material,part);
  }
  function tube(a,b,r,material='metal',part='hardware',segments=24,r2=r){
    const axis=unit(sub(b,a)),u=unit(cross(axis,Math.abs(axis[2])>.9?[0,1,0]:[0,0,1])),v=cross(axis,u);
    const ns=Array.from({length:segments},(_,i)=>u.map((q,k)=>q*Math.cos(i*TAU/segments)+v[k]*Math.sin(i*TAU/segments)));
    const row=(p,radius)=>ns.map(n=>p.map((q,k)=>q+n[k]*radius)),aa=row(a,r),bb=row(b,r2);
    for(let i=0;i<segments;i++){const j=(i+1)%segments;add([aa[i],aa[j],bb[j],bb[i]],material,part,[ns[i],ns[j],ns[j],ns[i]])}
    add([...aa].reverse(),material,part);add(bb,material,part);
  }
  function torus(x,y,z,major,minor,material='rubber',part='tyre',axis='y',segments=64,sides=16){
    const point=(a,b)=>{const rr=major+minor*Math.cos(b);return axis==='y'?[x+rr*Math.cos(a),y+minor*Math.sin(b),z+rr*Math.sin(a)]:[x+minor*Math.sin(b),y+rr*Math.cos(a),z+rr*Math.sin(a)]};
    const normal=(a,b)=>axis==='y'?[Math.cos(b)*Math.cos(a),Math.sin(b),Math.cos(b)*Math.sin(a)]:[Math.sin(b),Math.cos(b)*Math.cos(a),Math.cos(b)*Math.sin(a)];
    for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){
      const angles=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]].map(([a,b])=>[a*TAU/segments,b*TAU/sides]);
      add(angles.map(p=>point(...p)),material,part,angles.map(p=>normal(...p)));
    }
  }
  function wheel(x,y,r=.46,width=.29){
    const sign=Math.sign(y)||1,part='wheel';
    torus(x,y,r,r*.76,r*.24,'rubber',part);
    tube([x,y-width*.45,r],[x,y+width*.45,r],r*.56,'rim',part,48);
    tube([x,y+sign*width*.46,r],[x,y+sign*width*.57,r],r*.25,'metal',part,32);
    for(let i=0;i<8;i++){const a=i*TAU/8,xx=x+Math.cos(a)*r*.39,zz=r+Math.sin(a)*r*.39;tube([xx,y+sign*width*.46,zz],[xx,y+sign*width*.53,zz],.026,'under','wheel-bolts',12)}
    // Raised tread blocks, with the dark tyre surface visible between them.
    for(let i=0;i<48;i++){const a=i*TAU/48,b=a+.045;add([[x+r*Math.cos(a),y-.065,r+r*Math.sin(a)],[x+r*Math.cos(b),y-.065,r+r*Math.sin(b)],[x+r*Math.cos(b),y+.065,r+r*Math.sin(b)],[x+r*Math.cos(a),y+.065,r+r*Math.sin(a)]],'intake','tread')}
  }
  function chassis(l,w,axles,r=.46){
    box(0,0,.42,l,w,.28,'under','chassis');
    for(const x of axles){tube([x,-w/2,r],[x,w/2,r],.075,'metal','axle');for(const sign of [-1,1])wheel(x,sign*(w/2-.12),r)}
    for(const sign of [-1,1]){box(sign*(l/2-.08),0,.59,.16,w,.2,'rubber','bumper');for(const y of [-w*.36,w*.36])box(sign*(l/2+.005),y,.76,.045,.26,.13,sign>0?'body':'stripe','lights',.015)}
  }
  function cab(x,w=2,z=.73,h=1.75){
    box(x,0,z,1.55,w,h,'body','cab',.14);
    box(x+.785,0,z+h*.66,.018,w*.8,h*.4,'glass','windscreen',.004);
    box(x,0,z+h+.025,1.62,w+.05,.09,'body','cab-roof');
    for(const sign of [-1,1]){
      box(x+.03,sign*(w/2+.012),z+h*.66,1.18,.02,h*.4,'glass','side-window',.005);
      box(x+.15,sign*(w/2+.035),z+.38,1.25,.028,.12,'stripe','livery',.005);
      box(x-.37,sign*(w/2+.04),z+.76,.22,.04,.045,'metal','door-handle',.008);
      tube([x+.65,sign*w/2,z+h*.7],[x+.78,sign*(w/2+.2),z+h*.73],.025);
      box(x+.78,sign*(w/2+.2),z+h*.64,.08,.13,.26,'metal','mirror');
      box(x,sign*(w/2-.12),.47,1.1,.3,.14,'metal','cab-step');
    }
    tube([x-.3,0,z+h+.12],[x-.3,0,z+h+.3],.11,'stripe','beacon',32);
    for(let j=0;j<5;j++)box(x+.793,0,z+.18+j*.063,.025,w*.43,.026,'intake','grille',.003);
    tube([x+.805,-w*.24,z+h*.47],[x+.805,w*.11,z+h*.76],.016,'rubber','wiper',12);
  }
  function rails(x0,x1,y,z0,z1){
    for(let i=0;i<=4;i++){const t=i/4,x=x0+(x1-x0)*t,z=z0+(z1-z0)*t;tube([x,y,z],[x,y,z+.9],.026,'metal','handrail')}
    tube([x0,y,z0+.9],[x1,y,z1+.9],.032,'metal','handrail');
    tube([x0,y,z0+.44],[x1,y,z1+.44],.022,'metal','handrail');
  }
  function reel(x,y,z,r=.36){
    for(const dy of [-.12,.12])tube([x,y+dy-.022,z],[x,y+dy+.022,z],r,'stripe','reel',48);
    for(let i=0;i<7;i++)torus(x,y-.1+i*.033,z,r*.66,.038,'rubber','hose','y',48,10);
    tube([x,y-.18,z],[x,y+.18,z],.075,'metal','reel-axle');
  }
  let components=null;
  if(['tug','heavyTug','baggage'].includes(kind)){
    components=buildGroundTractor(kind,{add,box,tube,torus});
  }else if(kind==='bus'){
    components=buildApronBus({add,box,tube,torus});
  }else if(kind==='fuel'){
    chassis(7.25,2.25,[-2.6,-1.25,2.5],.48);cab(2.35,2.18);
    // An elliptical tank with rounded end domes and smooth per-vertex normals.
    const rings=[[-3.48,.05],[-3.45,.3],[-3.36,.6],[-3.2,.85],[-2.98,1],[-2.7,1],[-1.5,1],[0,1],[.68,1],[.9,.86],[1.08,.62],[1.18,.3],[1.2,.05]];
    const rows=rings.map(([x,r])=>Array.from({length:64},(_,i)=>[x,Math.cos(i*TAU/64)*1.05*r,1.85+Math.sin(i*TAU/64)*.98*r]));
    for(let k=0;k<rows.length-1;k++)for(let i=0;i<64;i++){const j=(i+1)%64,ids=[[k,i],[k,j],[k+1,j],[k+1,i]];add(ids.map(([a,b])=>rows[a][b]),'body','tank',ids.map(([a,b])=>unit([(a<4?-1:a>8?1:0)*.7,Math.cos(b*TAU/64),Math.sin(b*TAU/64)])))}
    for(const x of [-2.7,-.5,.6]){torus(x,0,1.85,1.02,.028,'metal','tank-band','x');tube([x,0,2.8],[x,0,2.94],.22,'metal','tank-hatch',48)}
    for(const sign of [-1,1]){box(-.85,sign*1.056,1.76,3.75,.026,.22,'stripe','fuel-band');box(-2.2,sign*.98,.7,1.4,.38,.22,'metal','running-board');reel(.75,sign*1.07,1.06,.33)}
    for(let j=0;j<6;j++)tube([-3.49,-.37,.65+j*.36],[-3.49,.37,.65+j*.36],.025,'metal','ladder');
    for(const y of [-.37,.37])tube([-3.49,y,.6],[-3.49,y,2.68],.032,'metal','ladder');
  }else if(kind==='gpu'){
    chassis(3.2,1.5,[-.95,.9],.29);box(-.2,0,.68,2.6,1.45,1.1,'body','generator',.11);
    for(const sign of [-1,1]){for(let i=0;i<16;i++)box(-1.26+i*.072,sign*.734,.91,.032,.025,.64,'intake','cooling-louvre',.004);box(.62,sign*.744,1.04,.45,.025,.4,'glass','control-panel');for(let i=0;i<3;i++)tube([.48+i*.12,sign*.76,1.15],[.48+i*.12,sign*.78,1.15],.035,'stripe','controls',16)}
    reel(.6,0,1.99,.32);tube([1.5,0,.46],[1.8,0,.33],.045,'metal','drawbar');
    tube([-1.05,0,1.78],[-1.05,0,2.02],.047,'intake','exhaust');
  }else if(kind==='belt'){
    chassis(6.7,1.85,[-2.1,2.25],.36);box(-1.8,-.32,.7,1.35,1.05,.55,'body','engine-cover');
    const start=-3.65,end=3.65,low=.94,high=2.9,at=(x,y,dz=0)=>[x,y,low+(x-start)/(end-start)*(high-low)+dz];
    add([at(start,-.59),at(end,-.59),at(end,.59),at(start,.59)],'rubber','conveyor');
    for(let i=0;i<45;i++){const x=start+(end-start)*i/45;tube(at(x,-.58,.018),at(x,.58,.018),.022,'panel','belt-cleat',12)}
    for(const y of [-.68,.68]){tube(at(start,y),at(end,y),.072,'body','belt-frame');rails(start,end,y,low,high)}
    for(const y of [-.45,.45]){tube([-1.5,y,.67],at(2.5,y,-.12),.066,'metal','lift-arm');tube([1.9,y,.68],at(-1,y,-.1),.075,'stripe','hydraulic-cylinder')}
    box(-1.3,-.85,.85,.5,.4,.13,'rubber','operator-seat');tube([-1,-.8,.75],[-.75,-.8,1.28],.03);torus(-.75,-.8,1.3,.14,.023,'rubber','steering-wheel','x',32,10);
  }else if(kind==='stairs'){
    chassis(5.65,2.15,[-1.8,1.85],.36);
    for(let i=0;i<16;i++){const x=-2.93+i*.32,z=.72+i*.19;box(x,0,z,.34,1.48,.12,'body','stair-tread',.016);box(x-.15,0,z+.125,.026,1.42,.025,'stripe','tread-edge',.004)}
    box(2.57,0,3.57,1.2,1.7,.16,'body','landing');
    for(const y of [-.84,.84]){rails(-3.08,2.03,y,.8,3.65);rails(2.03,3.15,y,3.65,3.65);tube([-2.9,y,.6],[2.2,y,3.45],.08,'metal','stringer');tube([1.7,y,.68],[1.7,y,3.46],.09,'metal','lift-column')}
    for(const x of [-2.1,2.1])for(const y of [-1.16,1.16]){tube([x,y,.08],[x,y,.92],.055,'metal','stabiliser');box(x,y,.04,.3,.3,.08,'rubber','stabiliser-foot')}
  }else if(kind==='cargo'){
    chassis(7.8,2.95,[-2.55,2.65],.49);box(-1.45,0,2.72,4.8,2.9,.25,'body','lift-platform');box(2.6,0,3.02,2.9,2.9,.24,'body','transfer-platform');
    for(const y of [-1.08,1.08]){tube([-3.3,y,.73],[.7,y,2.65],.12,'metal','scissor-lift');tube([.7,y,.73],[-3.3,y,2.65],.12,'metal','scissor-lift');tube([-1.2,y,.75],[.6,y,2.55],.08,'stripe','hydraulic-cylinder');rails(-3.8,.85,y*1.36,2.98,2.98)}
    for(let i=0;i<32;i++){const x=-3.68+i*.24,z=x<1?3.01:3.31;tube([x,-1.25,z],[x,1.25,z],.055,'metal','cargo-roller',24)}
    box(-1.7,0,3.08,2.45,2.35,1.68,'cargo','uld-container',.18);
    for(const y of [-1.18,1.18]){box(-1.7,y,3.19,2.1,.022,1.38,'under','container-panel');for(const x of [-2.55,-.85])tube([x,y,3.21],[x,y,4.49],.025,'metal','container-lock')}
    box(2.5,-1.3,1.65,1.2,.45,.12,'rubber','operator-platform');tube([2.9,-1.3,1.7],[2.9,-1.3,2.55],.044);box(2.9,-1.3,2.5,.45,.4,.16,'glass','control-console');
  }
  const vertices=faces.flatMap(f=>f.points),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const p of vertices)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k])}
  const geometry={id:'gse-'+kind,fidelity:true,fixedGear:true,faces,vertices,propellers:[],components,bounds:{min,max},triangles:faces.reduce((n,f)=>n+f.points.length-2,0)};
  cache.set(kind,geometry);return geometry;
}

export function drawGroundEquipment(ctx,{kind='tug',x=0,y=0,heading=0,metresToWorld=1,project,colour='#dfa342',...options}){
  const g=groundEquipmentGeometry(kind);if(!g)return false;
  const c=Math.cos(heading),s=Math.sin(heading),point=p=>project(x+(p[0]*c-p[1]*s)*metresToWorld,y+(p[0]*s+p[1]*c)*metresToWorld,p[2]*metresToWorld);
  const {min,max}=g.bounds;
  ctx.save();ctx.fillStyle='#263d3529';ctx.beginPath();
  [[min[0],min[1],0],[max[0],min[1],0],[max[0],max[1],0],[min[0],max[1],0]].map(point).forEach((p,i)=>i?ctx.lineTo(p.x+1,p.y+1):ctx.moveTo(p.x+1,p.y+1));ctx.closePath();ctx.fill();ctx.restore();
  if(paintAircraftMesh(ctx,g,{x,y,heading,metresToWorld,project,colour,reducedMotion:true,...options}))return true;
  // Canvas-only fallback preserves the recognisable silhouette if WebGL fails.
  // Cache the flattened view so detailed tyres are not repainted every frame.
  const origin=point([0,0,0]),axis=point([1,0,0]),side=point([0,1,0]),up=point([0,0,1]);
  const key=[kind,heading,colour,...[axis,side,up].flatMap(p=>[(p.x-origin.x).toFixed(5),(p.y-origin.y).toFixed(5)])].join('|');
  const cached=fallbackViews.get(key);
  if(cached){fallbackViews.delete(key);fallbackViews.set(key,cached);ctx.drawImage(cached.canvas,origin.x+cached.x,origin.y+cached.y,cached.w,cached.h);return true}
  const corners=[];for(const a of [min[0],max[0]])for(const b of [min[1],max[1]])for(const z of [min[2],max[2]])corners.push(point([a,b,z]));
  const left=Math.floor(Math.min(...corners.map(p=>p.x)))-2,top=Math.floor(Math.min(...corners.map(p=>p.y)))-2,w=Math.ceil(Math.max(...corners.map(p=>p.x))-left)+2,h=Math.ceil(Math.max(...corners.map(p=>p.y))-top)+2;
  const bitmap=document.createElement('canvas'),ratio=Math.min(2,1024/Math.max(w,h));bitmap.width=Math.max(1,Math.ceil(w*ratio));bitmap.height=Math.max(1,Math.ceil(h*ratio));
  const paint=bitmap.getContext('2d');paint.scale(ratio,ratio);paint.translate(-left,-top);
  const palette={body:'#e7eeeb',under:'#a5b6b7',rubber:'#28383c',intake:'#1c3038',glass:'#315564',metal:'#8eaaaf',rim:'#c5d2d3',cargo:'#c3cfc8',panel:'#b8c7ca',stripe:colour};
  const visible=g.faces.map(f=>({f,depth:f.points.reduce((n,p)=>n+p[0]*(c+s)+p[1]*(c-s)+p[2]*2,0)/f.points.length})).sort((a,b)=>a.depth-b.depth);
  for(const {f} of visible){paint.beginPath();f.points.map(point).forEach((p,i)=>i?paint.lineTo(p.x,p.y):paint.moveTo(p.x,p.y));paint.closePath();paint.fillStyle=palette[f.material]||palette.body;paint.fill()}
  fallbackViews.set(key,{canvas:bitmap,x:left-origin.x,y:top-origin.y,w,h,pixels:bitmap.width*bitmap.height});fallbackPixels+=bitmap.width*bitmap.height;
  while(fallbackViews.size>64||fallbackPixels>4_000_000){const oldest=fallbackViews.keys().next().value;fallbackPixels-=fallbackViews.get(oldest).pixels;fallbackViews.delete(oldest)}
  ctx.drawImage(bitmap,left,top,w,h);
  return true;
}
