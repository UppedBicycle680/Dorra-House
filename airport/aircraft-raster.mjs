// A shared offscreen depth buffer lets the existing 2D airport canvas display
// detailed 3D airframes without moving airport UI or scenery into WebGL.
import {propellerFaces} from './aircraft-propellers.mjs';
const colours={body:'#f5f7f5',wing:'#d6e2e6',under:'#bdccd3',metal:'#849aa5',glass:'#244958',rubber:'#23343e',intake:'#142632',stripe:'#48aaba',cargo:'#d6dcd9',rim:'#c3d2d7',panel:'#bdccd3',glint:'#8bb6c3'};
const rgb=hex=>{const n=parseInt(hex.replace('#',''),16);return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]};
let canvas,gl,program,cache=new WeakMap(),disabled=false,uniforms;
// Straight taxi/flight segments reuse the same camera-relative airframe. Keep
// a bounded LRU of those exact views instead of reading WebGL back every frame.
const views=new Map();let viewPixels=0;const MAX_VIEW_PIXELS=8_000_000;
const stats={uploads:0,cacheHits:0,cacheMisses:0,trianglesDrawn:0};
export const aircraftRasterStats=()=>({...stats,cachedViews:views.size,cachedPixels:viewPixels});
function initialise(){
  if(disabled||typeof document==='undefined')return false;
  if(gl)return true;
  try{
    canvas=document.createElement('canvas');
    gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:true});
    if(!gl){disabled=true;return false}
    const context=gl;
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();if(gl===context){gl=null;cache=new WeakMap()}});
    const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
    program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,`
      attribute vec3 position; attribute vec3 normal; attribute vec3 colour;
      attribute float stripe; attribute float gear; attribute vec3 propCentre; attribute float propIndex;
      uniform vec3 screenX; uniform vec3 screenY; uniform vec3 view;
      uniform vec4 bounds; uniform vec2 origin; uniform vec2 heading;
      uniform vec3 livery; uniform float extent; uniform float gearDown; uniform float spin; uniform float reducedMotion;
      varying vec3 litColour;
      void main(){
        vec3 vertex=position;
        if(propIndex>=0.0){float a=reducedMotion>0.5?0.32:spin+propIndex*0.8;vec2 q=position.yz-propCentre.yz;vertex.yz=propCentre.yz+vec2(q.x*cos(a)-q.y*sin(a),q.x*sin(a)+q.y*cos(a));}
        vec2 p=vec2(dot(vertex,screenX),dot(vertex,screenY))+origin;
        gl_Position=vec4(2.0*(p.x-bounds.x)/bounds.z-1.0,1.0-2.0*(p.y-bounds.y)/bounds.w,-dot(vertex,view)/extent,1.0);
        if(gear>0.5 && gearDown<0.5)gl_Position=vec4(3.0,3.0,3.0,1.0);
        vec3 raw=vec3(normal.x*heading.x-normal.y*heading.y,normal.x*heading.y+normal.y*heading.x,normal.z);
        vec3 n=raw/max(length(raw),0.0001);
        float light=0.76+0.25*max(0.0,dot(n,normalize(vec3(-0.38,-0.46,0.82))));
        litColour=mix(colour,livery,stripe)*light;
      }`));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision mediump float;varying vec3 litColour;void main(){gl_FragColor=vec4(litColour,1.0);}`));
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
    uniforms=Object.fromEntries(['screenX','screenY','view','bounds','origin','heading','livery','extent','gearDown','spin','reducedMotion'].map(name=>[name,gl.getUniformLocation(program,name)]));
    return true;
  }catch{gl=null;disabled=true;return false}
}
function upload(g){
  if(cache.has(g))return cache.get(g);
  stats.uploads++;
  const props=g.propellers.flatMap(prop=>propellerFaces({...prop,index:0}).map(face=>({...face,prop}))),packed=g.packed;
  const faces=packed?props:g.faces.concat(props);
  const vertexCount=(packed?packed.count*3:0)+faces.reduce((sum,face)=>sum+(face.points.length-2)*3,0);
  const data=new Float32Array(vertexCount*15);let cursor=0;
  if(packed){
    const palette=packed.materials.map(material=>rgb(colours[material]||colours.body));
    for(let f=0;f<packed.count;f++){
      const material=packed.materialIds[f],color=palette[material];
      for(let v=0;v<3;v++){
        for(let k=0;k<6;k++)data[cursor++]=packed.attributes[f*18+v*6+k];
        for(let k=0;k<3;k++)data[cursor++]=color[k];
        data[cursor++]=packed.materials[material]==='stripe'?1:0;data[cursor++]=packed.gear[f];
        data[cursor++]=0;data[cursor++]=0;data[cursor++]=0;data[cursor++]=-1;
      }
    }
  }
  for(const face of faces){
    const color=rgb(colours[face.material]||colours.body);
    for(let i=1;i<face.points.length-1;i++)for(const index of [0,i,i+1]){
      for(const value of [...face.points[index],...(face.normals?.[index]||face.normal),...color,face.material==='stripe'?1:0,face.part==='landing-gear'?1:0,...(face.prop?[face.prop.x,face.prop.y,face.prop.z,face.prop.index]:[0,0,0,-1])])data[cursor++]=value;
    }
  }
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
  const min=packed?[...packed.min]:[Infinity,Infinity,Infinity],max=packed?[...packed.max]:[-Infinity,-Infinity,-Infinity];
  if(!packed)for(const p of g.vertices)for(let i=0;i<3;i++){min[i]=Math.min(min[i],p[i]);max[i]=Math.max(max[i],p[i])}
  for(const p of g.propellers){min[1]=Math.min(min[1],p.y-p.radius);max[1]=Math.max(max[1],p.y+p.radius);min[2]=Math.min(min[2],p.z-p.radius);max[2]=Math.max(max[2],p.z+p.radius)}
  const result={buffer,count:data.length/15,min,max};cache.set(g,result);return result;
}
export function paintAircraftMesh(ctx,g,{x=0,y=0,heading=0,altitude=0,metresToWorld=.2,project,colour='#48aaba',gearDown=true,time=0,reducedMotion=false}={}){
  if(!g.fidelity||!initialise())return false;
  const c=Math.cos(heading),s=Math.sin(heading),scale=metresToWorld;
  const o=project(x,y,altitude),ax=project(x+c*scale,y+s*scale,altitude),ay=project(x-s*scale,y+c*scale,altitude),az=project(x,y,altitude+scale);
  const sx=[ax.x-o.x,ay.x-o.x,az.x-o.x],sy=[ax.y-o.y,ay.y-o.y,az.y-o.y];
  const v=[sx[1]*sy[2]-sx[2]*sy[1],sx[2]*sy[0]-sx[0]*sy[2],sx[0]*sy[1]-sx[1]*sy[0]],d=Math.hypot(...v)||1,view=v.map(n=>n/d);
  const gpu=upload(g),lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];
  for(const a of [gpu.min[0],gpu.max[0]])for(const b of [gpu.min[1],gpu.max[1]])for(const z of [gpu.min[2],gpu.max[2]]){
    const p=[o.x+a*sx[0]+b*sx[1]+z*sx[2],o.y+a*sy[0]+b*sy[1]+z*sy[2]];
    for(let i=0;i<2;i++){lo[i]=Math.min(lo[i],p[i]);hi[i]=Math.max(hi[i],p[i])}
  }
  const w=hi[0]-lo[0]+4,h=hi[1]-lo[1]+4;
  if(!Number.isFinite(w+h)||w<=0||h<=0)return false;
  const transform=ctx.getTransform?.(),ratio=Math.min(2,Math.max(1,Math.hypot(transform?.a||1,transform?.b||0)),2048/Math.max(w,h));
  const width=Math.max(1,Math.ceil(w*ratio)),height=Math.max(1,Math.ceil(h*ratio));
  const smallProp=g.propellers.length&&!reducedMotion&&w<260&&h<260;
  const phase=smallProp?Math.round(((time*.021)%(Math.PI*2))/(Math.PI*2)*96)%96:0;
  const spin=smallProp?phase*Math.PI*2/96:time*.021;
  const canCache=!g.propellers.length||reducedMotion||smallProp;
  // Numerical projection noise below one thousandth of a pixel across the
  // largest airframe does not describe a different view.
  const key=canCache?[g.id,...sx.map(n=>n.toFixed(6)),...sy.map(n=>n.toFixed(6)),c.toFixed(6),s.toFixed(6),ratio.toFixed(5),colour,gearDown||g.fixedGear?1:0,reducedMotion?1:0,phase].join('|'):null;
  const cached=key&&views.get(key);
  if(cached){stats.cacheHits++;views.delete(key);views.set(key,cached);ctx.drawImage(cached.image,o.x+cached.x,o.y+cached.y,cached.w,cached.h);return true}
  stats.cacheMisses++;
  if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
  gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER,gpu.buffer);
  for(const [name,size,offset]of [['position',3,0],['normal',3,3],['colour',3,6],['stripe',1,9],['gear',1,10],['propCentre',3,11],['propIndex',1,14]]){
    const location=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,60,offset*4);
  }
  gl.uniform3fv(uniforms.screenX,sx);gl.uniform3fv(uniforms.screenY,sy);gl.uniform3fv(uniforms.view,view);
  gl.uniform4f(uniforms.bounds,lo[0]-2,lo[1]-2,w,h);gl.uniform2f(uniforms.origin,o.x,o.y);gl.uniform2f(uniforms.heading,c,s);
  gl.uniform3fv(uniforms.livery,rgb(/^#[0-9a-f]{6}$/i.test(colour)?colour:'#48aaba'));
  gl.uniform1f(uniforms.extent,Math.hypot(...gpu.max.map((n,i)=>n-gpu.min[i])));gl.uniform1f(uniforms.gearDown,gearDown||g.fixedGear?1:0);
  gl.uniform1f(uniforms.spin,spin);gl.uniform1f(uniforms.reducedMotion,reducedMotion?1:0);
  gl.drawArrays(gl.TRIANGLES,0,gpu.count);
  stats.trianglesDrawn+=gpu.count/3;
  if(canCache&&width*height<=MAX_VIEW_PIXELS/2){
    const copy=document.createElement('canvas');copy.width=width;copy.height=height;copy.getContext('2d').drawImage(canvas,0,0);
    const entry={image:copy,x:lo[0]-2-o.x,y:lo[1]-2-o.y,w,h,pixels:width*height};views.set(key,entry);viewPixels+=entry.pixels;
    while(viewPixels>MAX_VIEW_PIXELS||views.size>256){const oldest=views.keys().next().value;viewPixels-=views.get(oldest).pixels;views.delete(oldest)}
    ctx.drawImage(copy,lo[0]-2,lo[1]-2,w,h);
  }else ctx.drawImage(canvas,lo[0]-2,lo[1]-2,w,h);
  return true;
}
