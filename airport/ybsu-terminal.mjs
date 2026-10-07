import {ybsuApronPoint as ap, ybsuWorldToApron} from './ybsu-reference.mjs';
import {createYbsuTerminalVisibility} from './ybsu-terminal-visibility.mjs';

// H116/26 supplies the footprint. The existing frontage and roof articulation
// use the Palisade photograph and Myers' May 2024 aerial; see YBSU-TERMINAL.md.
export const YBSU_TERMINAL_HEIGHT=1.65;
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const xyz=(p,z)=>[...ap(p),z];
export const YBSU_FRONT_WALK=[[165.6,165.4],[169.2,174],[172,184],[173.6,194],[173.8,204],[172.9,215],[172,220]];
export const YBSU_DROPOFF=[[153,163],[160,168],[164,177],[167,187],[168.5,198],[168,210],[165.5,220],[160,228],[151,227]];
export const YBSU_ENTRANCE_SAILS=[
  {corners:[[166,185],[164,199],[175,201],[180,186]],peak:[172,191],outerHeight:1.15},
  {corners:[[175,201],[173,211],[181,210],[183,200]],peak:[178,205],outerHeight:1.7}
];
const inside=(q,p)=>{let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>q[1])!==(b[1]>q[1])&&q[0]<(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c};
const roofAnchor=(q,p,clearance=.15)=>inside(q,p)||p.some((a,i)=>{const b=p[(i+1)%p.length],dx=b[0]-a[0],dy=b[1]-a[1],f=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(q[0]-a[0]-f*dx,q[1]-a[1]-f*dy)<clearance});
export function ybsuSailGeometry(t){
  const faces=[],supports=[],rigging=[];
  // Clearance applies to the fabric near the curved eave as well as its
  // attachment vertices; a triangle can cross the roof between its vertices.
  const clearRoof=(p,h)=>roofAnchor(ap(p),t.polygon,.6)?Math.max(h,YBSU_TERMINAL_HEIGHT+.2):h;
  for(const {corners,peak,outerHeight} of YBSU_ENTRANCE_SAILS){
    const heights=corners.map(p=>clearRoof(p,roofAnchor(ap(p),t.polygon)?2.12:outerHeight)),centre=xyz(peak,2.32);
    corners.forEach((a,i)=>{
      const j=(i+1)%corners.length,b=corners[j];let last=xyz(a,heights[i]);
      for(let n=1;n<=6;n++){
        const f=n/6,q=mix(a,b,f),toward=mix(q,peak,.14*Math.sin(Math.PI*f));
        let h=heights[i]+(heights[j]-heights[i])*f-.13*Math.sin(Math.PI*f);
        h=clearRoof(toward,h);
        const next=xyz(toward,h);faces.push({points:[last,next,centre],fill:i%2?'#e3e9df':'#fff9ec'});last=next;
      }
      const top=heights[i]+.18,base=roofAnchor(ap(a),t.polygon)?YBSU_TERMINAL_HEIGHT:0;
      supports.push([xyz(a,base),xyz(a,top)]);
      rigging.push([xyz(a,top),xyz(peak,2.7)]);
    });
    rigging.push([xyz(peak,2.32),xyz(peak,2.85)]);
  }
  return {faces,supports,rigging};
}
export function ybsuTerminalHitPolygons(t,project){
  const z=YBSU_TERMINAL_HEIGHT;
  return [t.polygon.map(p=>project(...p,z)),
    ...t.polygon.map((p,i)=>{const q=t.polygon[(i+1)%t.polygon.length];return [project(...p),project(...q),project(...q,z),project(...p,z)]}),
    ...ybsuSailGeometry(t).faces.map(f=>f.points.map(p=>project(...p)))];
}

const drawingCache=new WeakMap();
export function drawYbsuTerminal(t,api){
  const project=api.project||((x,y,z=0)=>({x:x-y,y:(x+y)*.455-z}));
  const origin=project(0,0,0),basis=[[1,0,0],[0,1,0],[0,0,1]].map(p=>project(...p));
  const scale=Math.hypot(...basis.map(p=>p.x-origin.x))||1;
  const rows=['x','y'].map(axis=>basis.map(p=>Number(((p[axis]-origin[axis])/scale).toFixed(10))));
  const key=JSON.stringify(rows),dot=(row,p)=>row.reduce((s,v,i)=>s+v*p[i],0);
  let cached=drawingCache.get(t);
  if(!cached||cached.key!==key){
    const commands=[];
    buildYbsuTerminal(t,{
      project:(x,y,z=0)=>({x:dot(rows[0],[x,y,z]),y:dot(rows[1],[x,y,z])}),
      poly:(...args)=>commands.push({kind:'poly',args}),
      line:(...args)=>commands.push({kind:'line',args}),
      polygons:(...args)=>commands.push({kind:'polygons',args})
    });
    cached={key,commands};drawingCache.set(t,cached);
  }
  // Only geometry visibility is cached. Projection remains live for pan,
  // zoom and resize, and the body stays in the game's aircraft depth order.
  for(const {kind,args} of cached.commands){
    if(kind!=='polygons'){api[kind](...args);continue;}
    const [fragments,fill]=args;
    if(api.ctx){
      const ctx=api.ctx;ctx.beginPath();
      for(const fragment of fragments){fragment.forEach((p,i)=>{const s=project(...p);i?ctx.lineTo(s.x,s.y):ctx.moveTo(s.x,s.y)});ctx.closePath()}
      ctx.fillStyle=fill;ctx.fill();
    }else for(const fragment of fragments)api.poly(fragment,fill);
  }
  return true;
}

function buildYbsuTerminal(t,api){
  let {poly,line}=api;
  const z=YBSU_TERMINAL_HEIGHT,p=t.polygon;
  const edges=p.map((a,i)=>[a,p[(i+1)%p.length]]).sort(([a,b],[c,d])=>a[0]+a[1]+b[0]+b[1]-c[0]-c[1]-d[0]-d[1]);
  poly(p.map(([x,y])=>[x+.3,y+.4]),'#36534720');
  for(const [a,b] of edges){
    const q=ybsuWorldToApron(mix(a,b,.5));
    poly([[...a,0],[...b,0],[...b,z],[...a,z]],'#dddccc');
    // The service wing has solid walls. Glazing is concentrated at the main
    // passenger hall and the sheltered concave frontage, not every outbuilding.
    if(q[1]>166&&q[1]<221){
      const at=(f,h)=>[...mix(a,b,f),h];
      poly([at(.03,.25),at(.97,.25),at(.97,1.13),at(.03,1.13)],'#739797');
      const len=Math.hypot(b[0]-a[0],b[1]-a[1]);
      for(let d=1;d<len;d+=1.3)line([at(d/len,.2),at(d/len,1.4)],'#eeeadd',.7);
    }
  }
  poly(p.map(q=>[...q,z]),'#eeeede','#faf7e9',.6);
  const roof=(ps,h,fill)=>poly(ps.map(q=>xyz(q,h)),fill);
  // Shallow roof planes and a narrow central spine, not a steep gabled hall.
  roof([[183,171],[204,173],[191,223],[179,220]],z+.015,'#e1e5dc');
  line([xyz([194,173],z+.035),xyz([181,220],z+.035)],'#c3cdc3',.65);
  roof([[148,144],[159,130],[167,139],[166,148],[161,151]],z+.015,'#e2e5dc');
  function panels(q,cols,rows){
    const at=(u,v)=>mix(mix(q[0],q[1],u),mix(q[3],q[2],u),v);
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)roof([at((x+.08)/cols,(y+.07)/rows),at((x+.92)/cols,(y+.07)/rows),at((x+.92)/cols,(y+.93)/rows),at((x+.08)/cols,(y+.93)/rows)],z+.055,'#648589');
  }
  panels([[192.7,174],[195.5,174.7],[183.5,220],[180.7,219.3]],2,25);
  panels([[173.8,177],[176,177.4],[179,187],[176.8,187.5]],1,6);
  panels([[176.8,204],[178.8,204.3],[177.5,216],[175.5,215.7]],1,7);
  // Low roof plant, concentrated in the broad curved section visible in the
  // aerial. Individual vents are miniature interpretations, not surveyed items.
  for(const [x,y] of [[174,169],[178,173],[181,180],[184,195],[185,202],[187,210],[159,142],[163,146]]){
    roof([[x,y],[x+1.4,y+.3],[x+1.1,y+1.5],[x-.3,y+1.2]],z+.08,'#bac8bf');
    roof([[x,y],[x+1.2,y+.3],[x+1,y+1],[x-.2,y+.8]],z+.22,'#f3f0e4');
  }
  const project=api.project||((x,y,h=0)=>({x:x-y,y:(x+y)*.455-h}));
  const visibility=createYbsuTerminalVisibility(t,z,project),rawPoly=poly,rawLine=line;
  poly=(ps,fill,stroke,lw)=>{
    const fragments=visibility.polygons(ps);
    // Fill fragments as one path so shared clipping edges do not leave seams.
    if(api.polygons&&fragments.length>1)api.polygons(fragments,fill);
    else for(const fragment of fragments)rawPoly(fragment,fill,stroke,lw);
  };
  line=(ps,colour,lw)=>{for(const segment of visibility.lines(ps))rawLine(segment,colour,lw)};
  // A narrow awning follows the chart's curved landside wall. Its ground
  // columns and the separate entrance membrane must not be clipped to a roof.
  for(let i=1;i<YBSU_FRONT_WALK.length;i++){
    const a=YBSU_FRONT_WALK[i-1],b=YBSU_FRONT_WALK[i],u=[a[0]-2.4,a[1]],v=[b[0]-2.4,b[1]];
    line([xyz(u,0),xyz(u,1.1)],'#f6f2e3',1);
    roof([a,b,v,u],1.13,'#f7f3e5');
    line([xyz(u,1.14),xyz(v,1.14)],'#d4dbcd',.7);
  }
  // Bowed fabric edges descend between tension points. Two joined sails
  // replace the former single solid pyramid sitting on the passenger roof.
  const sail=ybsuSailGeometry(t);
  for(const ps of sail.supports)line(ps,'#f5f1e5',.8);
  sail.faces.sort((a,b)=>a.points.reduce((n,p)=>n+visibility.depth(p),0)-b.points.reduce((n,p)=>n+visibility.depth(p),0));
  for(const face of sail.faces)poly(face.points,face.fill);
  for(const ps of sail.rigging)line(ps,'#dde3d9',.6);
  return true;
}

export function drawYbsuTerminalGround({poly,line}){
  // Footpath only: no aircraft pavement is added or registered here.
  for(let i=1;i<YBSU_FRONT_WALK.length;i++){
    const a=YBSU_FRONT_WALK[i-1],b=YBSU_FRONT_WALK[i];
    poly([a,b,[b[0]-4,b[1]],[a[0]-4,a[1]]].map(ap),'#d8d7b9');
  }
  poly([[165,182],[162,201],[172,213],[181,211],[183,184]].map(ap),'#d8d7b9');
  for(const y of [176,218])line([ap([164,y]),ap([168,y+1])],'#eee9d5',1.2);
}
