import {buildFidelityAircraft} from './aircraft-fidelity.mjs';
import {paintAircraftMesh} from './aircraft-raster.mjs';
import {propellerFaces} from './aircraft-propellers.mjs';

/** Original aircraft artwork. Dimensions are metres; references and variant
 * choices are recorded in AIRCRAFT-REFERENCES.md. Nose points along local +X.
 * The scene camera projects every 3D vertex, including propellers and winglets. */
const model = (id, name, length, wingspan, height, details) => Object.freeze({
  id, name, length, wingspan, height, fuselageWidth: 3.5, bodyHeight: null,
  wingMount: 'low', tailType: 'conventional', engineCount: 2, engineMount: 'wing',
  propellerBlades: 0, upperDeck: 'none', wingtip: 'plain', nose: 'round',
  wingRoot: .12, wingSweep: .22, rootChord: .25, tipChord: .045,
  tailSpan: .36, tailSweep: .075, tailChord: .13,
  engineStations: [.34], engineDiameter: 1.8, engineLength: 3.4,
  windows: 20, struts: false, cargo: false, sourceIds: [], ...details
});

export const AIRCRAFT_MODELS = Object.freeze(Object.fromEntries([
  model('c172', 'Cessna 172 Skyhawk', 8.28, 11, 2.72, {fuselageWidth:1.05,bodyHeight:1.24,wingMount:'high',engineCount:1,engineMount:'nose',propellerBlades:2,propellerDiameter:1.93,engineDiameter:.62,engineLength:1.2,wingRoot:.17,wingSweep:.025,rootChord:.20,tipChord:.13,tailSpan:.31,tailChord:.16,tailSweep:.025,windows:2,struts:true,nose:'utility',sourceIds:['cessna-172']}),
  model('caravan', 'Cessna 208 Caravan', 11.4554, 15.875, 4.5339, {fuselageWidth:1.75,bodyHeight:1.72,wingMount:'high',engineCount:1,engineMount:'nose',propellerBlades:3,propellerDiameter:2.6924,engineDiameter:.85,engineLength:2.25,wingRoot:.15,wingSweep:.035,rootChord:.22,tipChord:.15,tailSpan:.35,tailChord:.17,tailSweep:.055,windows:5,struts:true,cargoPod:true,nose:'utility',sourceIds:['cessna-caravan']}),
  model('king-air', 'Beechcraft King Air 350', 14.22, 17.65, 4.37, {fuselageWidth:1.66,bodyHeight:1.70,tailType:'t',propellerBlades:4,propellerDiameter:2.667,engineStations:[.30],engineDiameter:.90,engineLength:5.40,wingtip:'winglet',wingRoot:.12,wingSweep:.10,rootChord:.22,tipChord:.085,tailSpan:.29,tailChord:.12,windows:7,nose:'point',sourceIds:['king-air']}),
  model('atr42', 'ATR 42-600', 22.67, 24.57, 7.59, {fuselageWidth:2.87,bodyHeight:2.87,wingMount:'high',tailType:'t',propellerBlades:6,propellerDiameter:3.93,engineStations:[.33],engineDiameter:1.15,engineLength:4.2,wingRoot:.105,wingSweep:.07,rootChord:.20,tipChord:.075,tailSpan:.35,tailChord:.13,windows:13,nose:'round',sourceIds:['atr-42']}),
  model('atr72', 'ATR 72-600', 27.17, 27.05, 7.65, {fuselageWidth:2.87,bodyHeight:2.87,wingMount:'high',tailType:'t',propellerBlades:6,propellerDiameter:3.93,engineStations:[.30],engineDiameter:1.15,engineLength:4.2,wingRoot:.08,wingSweep:.065,rootChord:.19,tipChord:.067,tailSpan:.32,tailChord:.12,windows:18,nose:'round',sourceIds:['atr-72']}),
  model('q400', 'De Havilland Dash 8-400', 32.83, 28.42, 8.30, {fuselageWidth:2.69,bodyHeight:2.57,wingMount:'high',tailType:'t',propellerBlades:6,propellerDiameter:4.11,engineStations:[.32],engineDiameter:.9144,engineLength:8.80,wingRoot:.115,wingSweep:.058,rootChord:.17,tipChord:.064,tailSpan:.39,tailChord:.13,windows:22,nose:'point',sourceIds:['dash-8']}),
  model('e175', 'Embraer E175 · extended winglets', 31.68, 28.65, 9.86, {fuselageWidth:3.01,bodyHeight:3.35,wingtip:'winglet',engineDiameter:1.70,engineLength:4.07,wingRoot:.08,wingSweep:.22,rootChord:.23,tipChord:.05,tailSpan:.35,windows:19,nose:'point',sourceIds:['e175']}),
  model('b717', 'Boeing 717-200', 37.8, 28.4, 8.9, {fuselageWidth:3.35,tailType:'t',engineMount:'rear',engineDiameter:1.55,engineLength:3.9,wingRoot:.02,wingSweep:.16,rootChord:.23,tipChord:.048,tailSpan:.40,windows:25,nose:'point',sourceIds:['b717']}),
  model('a220', 'Airbus A220-300', 38.6893, 35.0855, 11.65, {fuselageWidth:3.5052,bodyHeight:3.7211,wingtip:'sharklet',engineDiameter:2.48,engineLength:4.72948,wingRoot:.11,wingSweep:.24,rootChord:.24,tipChord:.034,tailSpan:.33,windows:27,nose:'point',cockpitMask:true,sourceIds:['a220']}),
  model('e195', 'Embraer E195-E2', 41.6, 35.12, 10.60, {fuselageWidth:3.01,bodyHeight:3.35,wingtip:'raked',engineDiameter:2.48,engineLength:4.78,wingRoot:.07,wingSweep:.21,rootChord:.23,tipChord:.018,tailSpan:.34,windows:29,nose:'point',sourceIds:['e195']}),
  model('b737', 'Boeing 737-800 · winglets', 39.47, 35.79, 12.55, {fuselageWidth:3.76,wingtip:'winglet',engineDiameter:2.44,engineLength:3.95,wingRoot:.09,wingSweep:.23,rootChord:.26,tipChord:.046,tailSpan:.40,windows:44,nose:'point',flatNacelle:true,sourceIds:['b737']}),
  model('a320', 'Airbus A320neo · sharklets', 37.57, 35.8, 11.95, {fuselageWidth:3.95,wingtip:'sharklet',engineDiameter:2.67,engineLength:5.09,wingRoot:.12,wingSweep:.245,rootChord:.265,tipChord:.04,tailSpan:.35,windows:28,sourceIds:['a320']}),
  model('a321', 'Airbus A321neo · sharklets', 44.51, 35.8, 11.95, {fuselageWidth:3.95,wingtip:'sharklet',engineDiameter:2.67,engineLength:5.09,wingRoot:.10,wingSweep:.208,rootChord:.23,tipChord:.035,tailSpan:.35,windows:35,sourceIds:['a321']}),
  model('b757', 'Boeing 757-200 · original wings', 47.32, 38.05, 13.56, {fuselageWidth:3.76,engineDiameter:2.55,engineLength:4.6,wingRoot:.12,wingSweep:.23,rootChord:.245,tipChord:.035,tailSpan:.35,windows:36,nose:'point',sourceIds:['b757']}),
  model('b767', 'Boeing 767-300', 54.94, 47.57, 15.8, {fuselageWidth:5.03,engineDiameter:2.85,engineLength:5.0,wingRoot:.115,wingSweep:.245,rootChord:.275,tipChord:.041,tailSpan:.38,windows:33,nose:'point',sourceIds:['b767']}),
  model('a330', 'Airbus A330-300', 63.67, 60.3, 16.79, {fuselageWidth:5.64,bodyHeight:5.64,wingtip:'winglet',engineDiameter:3.08,engineLength:7.95,wingRoot:.14,wingSweep:.30,rootChord:.28,tipChord:.035,tailSpan:.33,windows:40,sourceIds:['a330']}),
  model('b777', 'Boeing 777-300ER', 73.86, 64.8, 18.5, {fuselageWidth:6.20,engineDiameter:3.76,engineLength:6.4,wingtip:'raked',wingRoot:.13,wingSweep:.28,rootChord:.265,tipChord:.014,tailSpan:.34,windows:45,nose:'point',sourceIds:['b777']}),
  model('a350', 'Airbus A350-1000', 73.79, 64.75, 17.19, {fuselageWidth:5.96,bodyHeight:6.09,engineDiameter:3.94,engineLength:7.94,wingtip:'sharklet',wingRoot:.13,wingSweep:.28,rootChord:.265,tipChord:.025,tailSpan:.32,windows:45,cockpitMask:true,sourceIds:['a350']}),
  model('b747', 'Boeing 747-8 Intercontinental', 76.25, 68.4, 19.4, {fuselageWidth:6.5,bodyHeight:6.7,engineCount:4,engineStations:[.35,.62],engineDiameter:3.15,engineLength:5.7,upperDeck:'hump',wingtip:'raked',wingRoot:.15,wingSweep:.31,rootChord:.30,tipChord:.022,tailSpan:.34,windows:45,nose:'round',sourceIds:['b747']}),
  model('a380', 'Airbus A380-800', 72.73, 79.75, 24.12, {fuselageWidth:7.14,bodyHeight:8.41,engineCount:4,engineStations:[.36,.645],engineDiameter:3.88,engineLength:8.39,upperDeck:'full',wingtip:'fence',wingRoot:.16,wingSweep:.32,rootChord:.32,tipChord:.042,tailSpan:.38,windows:43,nose:'blunt',sourceIds:['a380']}),
  model('c5', 'Lockheed C-5M Super Galaxy', 75.53, 67.91, 19.84, {fuselageWidth:7.30,bodyHeight:7.98,wingMount:'high',tailType:'t',engineCount:4,engineStations:[.37,.65],engineDiameter:3.0,engineLength:5.7,wingRoot:.12,wingSweep:.28,rootChord:.265,tipChord:.035,tailSpan:.42,tailChord:.15,windows:0,cargo:true,gearPods:true,nose:'blunt',sourceIds:['c5']}),
  model('an225', 'Antonov An-225 Mriya', 84, 88.4, 18.1, {fuselageWidth:8.2,bodyHeight:8.2,wingMount:'high',tailType:'twin',engineCount:6,engineStations:[.30,.49,.68],engineDiameter:3.0,engineLength:5.7,wingRoot:.15,wingSweep:.26,rootChord:.265,tipChord:.04,tailSpan:.34,tailChord:.16,windows:0,cargo:true,gearPods:true,nose:'blunt',sourceIds:['an225']})
].map(item => [item.id,item])));

const cache=new Map(), TAU=Math.PI*2;
const PALETTE={body:'#f5f7f5',wing:'#d6e2e6',under:'#bdccd3',metal:'#849aa5',glass:'#244958',rubber:'#23343e',intake:'#142632',stripe:'#48aaba',cargo:'#d6dcd9',rim:'#c3d2d7',panel:'#a2b6be',glint:'#8bb6c3'};
const normal=(points)=>{
  const n=[0,0,0];
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];n[0]+=(a[1]-b[1])*(a[2]+b[2]);n[1]+=(a[2]-b[2])*(a[0]+b[0]);n[2]+=(a[0]-b[0])*(a[1]+b[1])}
  const d=Math.hypot(...n)||1;return n.map(q=>q/d);
};

/** Local metre-space mesh, exported for geometry/coverage regression checks. */
export function aircraftGeometry(id){
  if(cache.has(id))return cache.get(id);
  const m=AIRCRAFT_MODELS[id];if(!m)return null;
  const rebuilt=buildFidelityAircraft(m,{compact:typeof document!=='undefined'});if(rebuilt){cache.set(id,rebuilt);return rebuilt}
  const faces=[],props=[],L=m.length,S=m.wingspan,W=m.fuselageWidth,H=m.bodyHeight||W;
  const gearClearance=m.engineMount==='nose'?Math.max(.30,m.propellerDiameter/2-H/2+.20):
    m.propellerBlades&&m.wingMount==='low'?Math.max(.62,m.propellerDiameter/2+.15-H*.20-m.engineDiameter*.15):
    !m.propellerBlades&&m.wingMount==='low'&&m.engineMount==='wing'?Math.max(.72,m.engineDiameter*1.07-H*.20+.42):Math.max(.62,H*.25);
  const bodyZ=gearClearance+H/2,wingZ=bodyZ+(m.wingMount==='high'?H*.45:-H*.30);
  const add=(points,material='body',part='body',shade=1)=>{faces.push({points,material,part,normal:normal(points),shade})};
  const loft=(rings,material='body',part='body',segments=12,{caps=true,flatBottom=false}={})=>{
    const rows=rings.map(([x,y,z,ry,rz])=>Array.from({length:segments},(_,i)=>{const a=TAU*i/segments;return[x,y+Math.cos(a)*ry,z+(flatBottom?Math.max(-.76,Math.sin(a)):Math.sin(a))*rz]}));
    for(let k=0;k<rows.length-1;k++)for(let i=0;i<segments;i++){
      const p=[rows[k][i],rows[k][(i+1)%segments],rows[k+1][(i+1)%segments],rows[k+1][i]],n=normal(p.slice(0,3));
      if(Math.abs(n.reduce((v,q,j)=>v+q*(p[3][j]-p[0][j]),0))>1e-7){add(p.slice(0,3),material,part);add([p[0],p[2],p[3]],material,part)}else add(p,material,part);
    }
    if(caps){add([...rows[0]].reverse(),material,part);add(rows.at(-1),material,part)}
    // Interpolate on the actual polygonal skin, not an enclosing ellipse.
    // Decals use this same surface so they remain attached through taper.
    return (x,angle,offset=0)=>{
      let k=0;while(k<rings.length-2&&x>rings[k+1][0])k++;
      const t=Math.max(0,Math.min(1,(x-rings[k][0])/(rings[k+1][0]-rings[k][0]||1)));
      const a=((angle%TAU)+TAU)%TAU/TAU*segments,i=Math.floor(a)%segments,f=a-Math.floor(a),j=(i+1)%segments;
      return rows[k][i].map((v,axis)=>{
        const p=f>=t?v*(1-f)+rows[k][j][axis]*(f-t)+rows[k+1][j][axis]*t:v*(1-t)+rows[k+1][j][axis]*f+rows[k+1][i][axis]*(t-f);
        return p+(axis===1?Math.cos(angle)*offset:axis===2?Math.sin(angle)*offset:0);
      });
    };
  };
  const prism=(points,thickness,material='wing',part='wing')=>{
    add(points,material,part);add(points.map(p=>[p[0],p[1],p[2]-thickness]).reverse(),'under',part);
    for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];add([a,[a[0],a[1],a[2]-thickness],[b[0],b[1],b[2]-thickness],b],material,part,.84)}
  };
  const rod=(a,b,r,material='metal',part='gear')=>{
    const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],d=Math.hypot(dx,dy,dz)||1;
    let side=[-dy,dx,0];if(Math.hypot(...side)<.001)side=[1,0,0];const s=Math.hypot(...side);side=side.map(v=>v/s*r);
    const up=[(dy*side[2]-dz*side[1])/d,(dz*side[0]-dx*side[2])/d,(dx*side[1]-dy*side[0])/d];
    const corners=p=>[[1,1],[-1,1],[-1,-1],[1,-1]].map(([u,v])=>p.map((q,i)=>q+u*side[i]+v*up[i]));
    const aa=corners(a),bb=corners(b);for(let i=0;i<4;i++)add([aa[i],aa[(i+1)%4],bb[(i+1)%4],bb[i]],material,part);
  };
  // Lofted belly/roof rather than a flat fuselage ellipse. Nose profiles are
  // deliberately different for blunt cargo aircraft, utility props and jets.
  // Nose length follows body width, so a stretched jet gains cabin rather than
  // an implausibly stretched radome. These profiles are artistic approximations.
  const noseStart=m.nose==='utility'?.25:Math.max(.225,.5-W/L*(m.cargo?1.65:m.nose==='point'?1.65:m.nose==='blunt'?1.3:1.45));
  const noseProfile=m.nose==='point'?[[0,1],[.32,.9],[.65,.59],[.88,.25],[1,.012]]:m.nose==='blunt'?[[0,1],[.40,.94],[.72,.71],[.92,.36],[1,.035]]:[[0,1],[.36,.95],[.68,.71],[.91,.32],[1,.02]];
  const nose=m.nose==='utility'?[[.25,.99],[.31,.83],[.37,.55],[.43,.40],[.475,.34]]:noseProfile.map(([t,r])=>[noseStart+(.5-noseStart)*t,r]);
  const stations=[[-.5,.025],[-.445,.22],[-.365,.58],[-.29,.85],[-.23,.98],[-.13,1],[0,1],[.12,1],[.19,1],...nose];
  const bodyEnd=m.engineMount==='nose'?.475:.5;
  const bodyRings=stations.map(([x,r])=>[Math.min(x,bodyEnd)*L,0,bodyZ+(x<-.25?(-x-.25)*H*.55:x>.3?(x-.3)*-H*.38:0),W*r/2,H*r/2]);
  const skin=loft(bodyRings,m.cargo?'cargo':'body','fuselage',12);
  if(m.cargoPod)loft([[-.29*L,0,.45,W*.33,.23],[-.20*L,0,.43,W*.39,.31],[.19*L,0,.43,W*.34,.27],[.25*L,0,.47,.04,.08]],'under','cargo-pod',8);
  if(m.gearPods)for(const side of [-1,1])loft([[-.27*L,side*W*.49,gearClearance+.3,.1,.18],[-.15*L,side*W*.49,gearClearance+.2,W*.14,H*.14],[.06*L,side*W*.49,gearClearance+.2,W*.14,H*.14],[.12*L,side*W*.49,gearClearance+.35,.08,.12]],m.cargo?'cargo':'body','gear-pod',8);
  const deckSkin=m.upperDeck==='hump'?loft([[-.02*L,0,bodyZ+H*.40,.06,.04],[.045*L,0,bodyZ+H*.43,W*.23,H*.24],[.13*L,0,bodyZ+H*.44,W*.32,H*.36],[.24*L,0,bodyZ+H*.44,W*.32,H*.36],[.32*L,0,bodyZ+H*.43,W*.29,H*.35],[.39*L,0,bodyZ+H*.36,W*.22,H*.29],[.452*L,0,bodyZ+H*.22,.03,.025]],'body','upper-deck',12):null;

  const blendedTip=['winglet','sharklet'].includes(m.wingtip),curvedTip=m.id==='a350';
  const wingPoint=(side,t,leading)=>{
    const bend=blendedTip?Math.max(0,(t-.90)/.10):0;
    const rake=m.wingtip==='raked'?Math.max(0,(t-.84)/.16)*L*.035:0;
    return [L*(m.wingRoot-m.wingSweep*t-(leading?0:m.rootChord+(m.tipChord-m.rootChord)*t))-rake,
      side*(W*.36+(S/2-W*.36)*t),wingZ+Math.pow(t,1.35)*S*(m.wingMount==='high'?.005:.018)+S*(curvedTip?.048:.038)*bend*bend];
  };
  for(const side of [-1,1]){
    const spans=blendedTip?[0,.18,.44,.72,.90,.96,1]:[0,.18,.44,.72,.90,1];
    const chordPoint=(t,f,bottom=false)=>{
      const a=wingPoint(side,t,true),b=wingPoint(side,t,false),thickness=(a[0]-b[0])*(m.propellerBlades?.10:.075);
      return [a[0]+(b[0]-a[0])*f,a[1],a[2]+(bottom?-.27:1)*thickness*Math.sin(Math.PI*f)];
    };
    for(let j=0;j<spans.length-1;j++)for(const [a,b]of [[0,.22],[.22,.72],[.72,1]]){
      const t=spans[j],u=spans[j+1],p=[chordPoint(t,a),chordPoint(u,a),chordPoint(u,b),chordPoint(t,b)];
      add(side>0?p:p.reverse(),t>=.9&&blendedTip?'stripe':a===0?'rim':a===.72?'panel':'wing','main-wing');
      const q=[chordPoint(t,a,true),chordPoint(u,a,true),chordPoint(u,b,true),chordPoint(t,b,true)];
      add(side<0?q:q.reverse(),'under','main-wing');
    }
    // The outer wing now bends continuously; fences retain their two-sided tip plate.
    if(m.wingtip==='fence'){
      const a=wingPoint(side,1,true),b=wingPoint(side,1,false),h=m.wingtip==='fence'?S*.016:S*(m.wingtip==='sharklet'?.047:.052);
      // Winglet bends in height; its outer tip remains within the real span.
      const tip=[a[0]-(b[0]-a[0])*.20,a[1],a[2]+h];
      const p=[a,b,[b[0]+(a[0]-b[0])*.63,b[1],b[2]+h],tip];add(p,'stripe','winglet');add([...p].reverse(),'stripe','winglet');
      const q=[a,b,[b[0]+(a[0]-b[0])*.5,b[1],b[2]-h*.7]];add(q,'stripe','winglet');add([...q].reverse(),'stripe','winglet');
    }
    for(const [t,u]of [[.20,.43],[.46,.70]]){
      const a=chordPoint(t,.73),b=chordPoint(u,.73);rod(a,b,W*.003,'metal','flap');
    }
    if(m.struts)rod([L*.02,side*W*.44,bodyZ-H*.37],[L*.03,side*S*.31,wingZ+.01],W*.018,'metal','wing-strut');
  }

  const tailZ=m.tailType==='t'?m.height*.90:bodyZ+H*.28;
  const finBase=bodyZ+H*.30,finTop=m.height;
  const fin=(y,twin=false)=>{
    const height=twin?m.height:finTop,base=twin?tailZ:finBase;
    const outline=[[-.285*L,base],[-.407*L,height],[-.478*L,height*.98],[-.477*L,base]],half=W*.019;
    const left=outline.map(([x,z])=>[x,y-half,z]),right=outline.map(([x,z])=>[x,y+half,z]);
    add(left,'stripe','vertical-tail');add([...right].reverse(),'stripe','vertical-tail');
    for(let i=0;i<4;i++){const j=(i+1)%4;add([left[i],right[i],right[j],left[j]],'stripe','vertical-tail',.9)}
    for(const side of [-1,1]){
      const p=[[-.374*L,y+side*(half+W*.001),base+(height-base)*.51],[-.432*L,y+side*(half+W*.001),height*.88],[-.462*L,y+side*(half+W*.001),height*.88]];
      add(side<0?p:p.reverse(),'body','tail-mark');
    }
  };
  for(const side of [-1,1]){
    const half=S*m.tailSpan/2;
    const p=[[-.30*L,side*W*.13,tailZ],[-(.30+m.tailSweep)*L,side*half,tailZ+.1],[-(.30+m.tailSweep+m.tailChord*.46)*L,side*half,tailZ+.1],[-(.30+m.tailChord)*L,side*W*.13,tailZ]];
    prism(side>0?p:p.reverse(),W*.035,'wing','horizontal-tail');
  }
  if(m.tailType==='twin'){fin(-S*m.tailSpan/2,true);fin(S*m.tailSpan/2,true)}else fin(0);

  const engine=(x,y,z,diameter,length,index)=>{
    const r=diameter/2;
    const rings=(profile)=>profile.map(([u,v])=>[x+length*u,y,z,r*v,r*v]);
    if(m.propellerBlades){
      loft(rings([[-.55,.28],[-.36,.65],[.12,1],[.34,.88],[.48,.50]]),'body',`engine-${index}`,10);
      loft(rings([[.47,.49],[.55,.30],[.63,.015]]),'metal',`prop-spinner-${index}`,10);
      props.push({x:x+length*.56,y,z,radius:m.propellerDiameter/2,blades:m.propellerBlades,index});
      // A small under-cowl inlet instead of a jet fan on a turboprop.
      const p=[[x+length*.36,y-r*.32,z-r*.58],[x+length*.36,y+r*.32,z-r*.58],[x+length*.34,y+r*.26,z-r*.91],[x+length*.34,y-r*.26,z-r*.91]];
      add([...p].reverse(),'intake',`prop-inlet-${index}`);
    }else{
      loft(rings([[-.52,.53],[-.32,.81],[.12,1],[.43,1],[.50,.94]]),'body',`engine-${index}`,12,{caps:false,flatBottom:m.flatNacelle});
      // Annular lip continues inward to a recessed fan. No solid cap closes the mouth.
      loft(rings([[.50,.94],[.515,.85],[.47,.79]]),'rim',`engine-lip-${index}`,12,{caps:false,flatBottom:m.flatNacelle});
      loft(rings([[.47,.79],[.32,.75]]),'intake',`engine-throat-${index}`,12,{caps:false,flatBottom:m.flatNacelle});
      const disk=(u,radius)=>Array.from({length:12},(_,i)=>{const a=TAU*i/12;return[x+length*u,y+Math.cos(a)*r*radius,z+Math.sin(a)*r*radius]});
      add(disk(.321,.75),'intake',`engine-intake-${index}`);
      for(let i=0;i<8;i++){
        const a=TAU*i/8,p=(rr,aa)=>[x+length*.325,y+Math.cos(aa)*r*rr,z+Math.sin(aa)*r*rr];
        add([p(.23,a),p(.69,a+.20),p(.72,a+.34),p(.28,a+.33)],'metal',`engine-fan-${index}`);
      }
      loft(rings([[.324,.24],[.405,.03]]),'rim',`fan-spinner-${index}`,8);
      loft(rings([[-.52,.53],[-.56,.45],[-.44,.36]]),'metal',`engine-exhaust-${index}`,10,{caps:false});
      add(disk(-.441,.36).reverse(),'intake',`exhaust-core-${index}`);
    }
  };
  if(m.engineMount==='nose'){
    // Cessna piston/turboprop cowl is part of the fuselage; retain a compact
    // spinner without adding a jet nacelle or an intake on its nose.
    loft([[L*.45,0,bodyZ,W*.30,H*.28],[L*.49,0,bodyZ,W*.14,H*.12],[L*.50,0,bodyZ,.018,.018]],'metal','spinner',8);
    props.push({x:L*.489,y:0,z:bodyZ,radius:m.propellerDiameter/2,blades:m.propellerBlades,index:0});
  }else if(m.engineMount==='rear'){
    for(const [i,side]of[-1,1].entries()){const y=side*(W*.48+m.engineDiameter*.49);rod([-.30*L,side*W*.33,bodyZ],[ -.30*L,y,bodyZ],W*.13,'wing','engine-pylon');engine(-.30*L,y,bodyZ,m.engineDiameter,m.engineLength,i)}
  }else{
    let i=0;for(const side of [-1,1])for(const station of m.engineStations){
      const y=side*S*.5*station,x=L*(m.wingRoot-m.wingSweep*station)+m.engineLength*.15;
      const z=m.propellerBlades?wingZ+m.engineDiameter*(m.wingMount==='high'?-.42:.15):wingZ-m.engineDiameter*.57;
      rod([x-m.engineLength*.16,y,wingZ],[x-m.engineLength*.16,y,z],m.engineDiameter*.10,'wing','engine-pylon');
      engine(x,y,z,m.engineDiameter,m.engineLength,i++);
    }
  }

  // Wheels and bogies sit on the ground plane. Cargo airframes have their
  // characteristic side pods and extra wheel pairs, props retain fixed gear.
  const wheelRadius=Math.max(.12,Math.min(.55,W*.095));
  const wheel=(x,y,z)=>{
    const steps=6,ry=wheelRadius*.35;
    const rows=[-ry,ry].map(d=>Array.from({length:steps},(_,i)=>{const a=TAU*i/steps;return[x+Math.cos(a)*wheelRadius,y+d,z+Math.sin(a)*wheelRadius]}));
    add(rows[0],'rubber','landing-gear');add(rows[1].slice().reverse(),'rubber','landing-gear');for(let i=0;i<steps;i++)add([rows[0][i],rows[1][i],rows[1][(i+1)%steps],rows[0][(i+1)%steps]],'rubber','landing-gear');
  };
  const mainX=-L*.10,mainY=m.engineMount==='nose'?W*.92:m.cargo?W*.55:W*.60;
  for(const side of [-1,1]){
    rod([mainX,side*W*.32,bodyZ-H*.35],[mainX,side*mainY,wheelRadius],W*.022,'metal','landing-gear');
    const count=m.cargo?5:L>65?3:L>45?2:1;
    for(let n=0;n<count;n++)wheel(mainX+(n-(count-1)/2)*wheelRadius*2.15,side*mainY,wheelRadius);
  }
  rod([L*.34,0,bodyZ-H*.30],[L*.34,0,wheelRadius],W*.018,'metal','landing-gear');wheel(L*.34,0,wheelRadius);

  // Split markings at skin facets so the painted polygons neither float above
  // the taper nor cut through it. Angles are measured above the side equator.
  const decal=(coords,side,material,part,surface=skin)=>{
    let polygons=[coords];
    const cuts=[[0,[...stations.map(p=>p[0]),-.02,.045,.13,.24,.32,.39,.452]],[1,[-Math.PI/6,0,Math.PI/6,Math.PI/3,Math.PI/2]]];
    for(const [axis,values]of cuts)for(const value of values){
      const next=[];
      for(const polygon of polygons){
        if(!polygon.some(p=>p[axis]<value-1e-8)||!polygon.some(p=>p[axis]>value+1e-8)){next.push(polygon);continue}
        for(const sign of [-1,1]){
          const clipped=[];
          for(let i=0;i<polygon.length;i++){
            const a=polygon[i],b=polygon[(i+1)%polygon.length],da=(a[axis]-value)*sign,db=(b[axis]-value)*sign;
            if(da>=-1e-8)clipped.push(a);
            if((da>1e-8&&db< -1e-8)||(da< -1e-8&&db>1e-8)){const t=da/(da-db);clipped.push(a.map((v,j)=>v+(b[j]-v)*t))}
          }
          if(clipped.length>=3)next.push(clipped);
        }
      }
      polygons=next;
    }
    for(const polygon of polygons){
      const points=polygon.map(([x,a])=>surface(x*L,side>0?a:Math.PI-a,W*.0015)),n=normal(points);
      const angle=polygon.reduce((sum,p)=>sum+p[1],0)/polygon.length;
      if(n[1]*side*Math.cos(angle)+n[2]*Math.sin(angle)<0)points.reverse();
      add(points,material,part);
    }
  };
  const rectangle=(x0,x1,a0,a1)=>[[x0,a0],[x1,a0],[x1,a1],[x0,a1]];
  for(const side of [-1,1]){
    const windowRow=(start,end,count,angle,part,surface=skin)=>{for(let i=0;i<count;i++){
      const x=start+(end-start)*(i+.5)/count,w=Math.min(.42/L,(end-start)/count*.46),h=Math.min(.15,.40/H);
      decal([[x-w*.5,angle-h*.65],[x-w*.3,angle-h],[x+w*.3,angle-h],[x+w*.5,angle-h*.65],[x+w*.5,angle+h*.65],[x+w*.3,angle+h],[x-w*.3,angle+h],[x-w*.5,angle+h*.65]],side,'glass',part,surface);
    }};
    if(m.id==='c172'){
      decal([[-.045,.12],[.04,.12],[.045,.80],[-.035,.73]],side,'glass','cabin-window');
      decal([[.054,.12],[.16,.16],[.18,.78],[.057,.80]],side,'glass','cabin-window');
    }else if(m.windows)windowRow(-.25,Math.min(.35,noseStart-.018),m.windows,m.upperDeck==='full'?-.17:.35,'cabin-window');
    if(m.upperDeck==='full')windowRow(-.24,Math.min(.35,noseStart-.018),m.windows-2,.57,'upper-window');
    if(deckSkin)windowRow(.13,.32,13,.38,'upper-window',deckSkin);
    decal(rectangle(-.30,.29,-.31,-.16),side,'stripe','fuselage-stripe');
    const cockpitStart=m.engineMount==='nose'?.19:m.upperDeck==='hump'?.325:noseStart+(.5-noseStart)*.22;
    const cockpitEnd=m.engineMount==='nose'?.305:m.upperDeck==='hump'?.411:noseStart+(.5-noseStart)*.70;
    const cockpitSurface=deckSkin||skin,mid=cockpitStart+(cockpitEnd-cockpitStart)*.49;
    if(m.cockpitMask)decal([[cockpitStart-.012,.30],[cockpitEnd+.01,.41],[cockpitEnd+.005,1.26],[cockpitStart-.01,1.04]],side,'intake','cockpit-mask',cockpitSurface);
    decal([[cockpitStart,.39],[mid-.004,.43],[mid-.004,1.08],[cockpitStart,1.0]],side,'glass','cockpit',cockpitSurface);
    decal([[mid+.004,.43],[cockpitEnd,.53],[cockpitEnd-.007,1.22],[mid+.004,1.10]],side,'glass','cockpit',cockpitSurface);
    decal([[mid+.008,1.02],[cockpitEnd-.01,1.10],[cockpitEnd-.009,1.16],[mid+.008,1.09]],side,'glint','cockpit-highlight',cockpitSurface);
    const doors=m.cargo?[-.14]:m.engineMount==='nose'?[.055]:[-.28,.29];
    for(const x of doors){
      const w=Math.min(.032,.86/L),a0=-.40,a1=m.upperDeck==='full'?.07:.57,line=.026,dx=.027/L;
      for(const rect of [rectangle(x-w/2,x-w/2+dx,a0,a1),rectangle(x+w/2-dx,x+w/2,a0,a1),rectangle(x-w/2,x+w/2,a0,a0+line),rectangle(x-w/2,x+w/2,a1-line,a1)])decal(rect,side,'panel','cabin-door');
      decal(rectangle(x+w*.1,x+w*.34,.01,.045),side,'metal','door-handle');
    }
  }
  // Adjacent faces share most vertices. Index them once so animation projects
  // each physical point once, rather than four times per adjoining polygon.
  const vertices=[],vertexIds=new Map();
  for(const face of faces){
    face.centre=face.points.reduce((v,p)=>v.map((n,i)=>n+p[i]/face.points.length),[0,0,0]);
    face.detail=/^(cabin-door|door-handle|cockpit-highlight|engine-fan-|fan-spinner-|exhaust-core-)/.test(face.part);
    face.indices=face.points.map(point=>{const key=point.map(n=>n.toFixed(7)).join(',');let index=vertexIds.get(key);if(index===undefined){index=vertices.length;vertices.push(point);vertexIds.set(key,index)}return index});
  }
  const geometry=Object.freeze({id,faces,vertices,propellers:props,dimensions:{length:L,wingspan:S,height:m.height},bodyZ});cache.set(id,geometry);return geometry;
}

const tintCache=new Map();
function tint(hex,amount){
  const step=Math.round(amount*48),key=hex+step;if(tintCache.has(key))return tintCache.get(key);
  const clean=/^#[0-9a-f]{6}$/i.test(hex||'')?hex:'#48aaba',n=parseInt(clean.slice(1),16),value=`rgb(${[16,8,0].map(s=>Math.max(0,Math.min(255,Math.round(((n>>s)&255)*step/48)))).join(',')})`;
  tintCache.set(key,value);return value;
}
function projectedFaces(id,{x=0,y=0,heading=0,altitude=0,metresToWorld=.2,project,colour='#48aaba',time=0,reducedMotion=false,gearDown=true}={}){
  const geometry=aircraftGeometry(id);if(!geometry||typeof project!=='function')return[];
  const c=Math.cos(heading),s=Math.sin(heading),scale=Number.isFinite(metresToWorld)?metresToWorld:.2;
  const origin=project(x,y,altitude),ax=project(x+c*scale,y+s*scale,altitude),ay=project(x-s*scale,y+c*scale,altitude),az=project(x,y,altitude+scale);
  const screenX=[ax.x-origin.x,ay.x-origin.x,az.x-origin.x],screenY=[ax.y-origin.y,ay.y-origin.y,az.y-origin.y];
  // The nullspace of the affine screen projection is the true viewing axis.
  const view=[screenX[1]*screenY[2]-screenX[2]*screenY[1],screenX[2]*screenY[0]-screenX[0]*screenY[2],screenX[0]*screenY[1]-screenX[1]*screenY[0]],vd=Math.hypot(...view)||1;
  for(let i=0;i<3;i++)view[i]/=vd;
  const transform=([u,v,w])=>({x:origin.x+u*screenX[0]+v*screenX[1]+w*screenX[2],y:origin.y+u*screenY[0]+v*screenY[1]+w*screenY[2],depth:u*view[0]+v*view[1]+w*view[2]});
  const vertices=new Array(geometry.vertices.length),lengthPixels=Math.hypot(screenX[0],screenY[0])*AIRCRAFT_MODELS[id].length;
  const faces=geometry.faces.concat(...geometry.propellers.map(p=>propellerFaces(p,time,reducedMotion)));
  const result=[],lightX=-.38*c-.46*s,lightY=.38*s-.46*c;
  for(const face of faces){
    if(!gearDown&&face.part==='landing-gear'&&!AIRCRAFT_MODELS[id].struts)continue;
    if(lengthPixels<180&&face.detail)continue;
    const [nx,ny,nz]=face.normal;
    if(!face.part.startsWith('propeller')&&nx*view[0]+ny*view[1]+nz*view[2]<=1e-7)continue;
    let depth=0;const points=face.indices?face.indices.map(index=>vertices[index]||(vertices[index]=transform(geometry.vertices[index]))):face.points.map(point=>transform(point));
    if(face.centre)depth=face.centre[0]*view[0]+face.centre[1]*view[1]+face.centre[2]*view[2];
    else{for(const point of points)depth+=point.depth/points.length}
    const light=.73+.30*Math.max(0,nx*lightX+ny*lightY+nz*.82);
    const material=face.material==='stripe'?colour:PALETTE[face.material]||PALETTE.body;
    result.push({points,depth,fill:tint(material,light*face.shade),part:face.part});
  }
  return result.sort((a,b)=>a.depth-b.depth);
}

/** Draws only the airframe (the airport renderer owns the shadow and flight path).
 * Heading 0 is world +X; PI/2 is +Y. project(x,y,z) returns {x,y} in CSS pixels. */
export function drawAircraft(ctx,options){
  const id=AIRCRAFT_MODELS[options?.id]?options.id:'c172';
  if(paintAircraftMesh(ctx,aircraftGeometry(id),options))return true;
  const faces=projectedFaces(id,options);if(!faces.length)return false;
  ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
  const m=AIRCRAFT_MODELS[id],p0=options.project(options.x||0,options.y||0,0),p1=options.project((options.x||0)+m.length*(options.metresToWorld??.2),options.y||0,0),joinSeams=Math.hypot(p1.x-p0.x,p1.y-p0.y)>65;
  for(const face of faces){ctx.beginPath();face.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=face.fill;ctx.fill();if(joinSeams){ctx.lineWidth=.35;ctx.strokeStyle=face.fill;ctx.stroke()}}
  ctx.restore();return true;
}

const svgCache=new Map();
/** Same type-specific 3D airframe as the map, projected for the fleet catalogue. */
export function aircraftSvg(id){
  if(svgCache.has(id))return svgCache.get(id);const m=AIRCRAFT_MODELS[id];if(!m)return'';
  if(aircraftGeometry(id).fidelity&&typeof document!=='undefined'){
    const canvas=document.createElement('canvas');canvas.width=720;canvas.height=420;const ctx=canvas.getContext('2d');
    const scale=420/Math.max(m.length,m.wingspan);
    if(drawAircraft(ctx,{id,metresToWorld:scale,heading:-.36,reducedMotion:true,project:(x,y,z)=>({x:360+x-y,y:242+(x+y)*.45-z})})){
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 420" role="img" aria-label="${m.name}" data-aircraft-model="${id}"><title>${m.name}</title><image width="720" height="420" href="${canvas.toDataURL('image/png')}"/></svg>`;
      svgCache.set(id,svg);return svg;
    }
  }
  // Work at a fixed close-up scale so SVG detail is independent of real length.
  const svgScale=240/Math.max(m.length,m.wingspan);
  const faces=projectedFaces(id,{metresToWorld:svgScale,heading:-.36,project:(x,y,z)=>({x:(x-y)*1.0,y:(x+y)*.45-z}),reducedMotion:true});
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const face of faces)for(const p of face.points){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y)}
  const w=maxX-minX,h=maxY-minY,pad=Math.max(w,h)*.065;
  const paths=faces.map(f=>`<path d="${f.points.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('')}Z" fill="${f.fill}" stroke="${f.fill}" stroke-width=".35" stroke-linejoin="round"/>`).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(minX-pad).toFixed(2)} ${(minY-pad).toFixed(2)} ${(w+pad*2).toFixed(2)} ${(h+pad*2).toFixed(2)}" role="img" aria-label="${m.name}" data-aircraft-model="${id}"><title>${m.name} · ${m.length} m long · ${m.wingspan} m wingspan</title>${paths}</svg>`;
  svgCache.set(id,svg);return svg;
}
