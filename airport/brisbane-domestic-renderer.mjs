import {domesticAerialPoint as point,DOMESTIC_PIXEL_SCALE as pixel} from './brisbane-domestic-precinct.mjs';
import {DOMESTIC_DETAIL as detail,DOMESTIC_MATERIALS as material} from './brisbane-domestic-details.mjs';
import {drawDomesticLanes,drawDomesticRamps} from './brisbane-domestic-lane-renderer.mjs';

const mix=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);
const centre=p=>p.reduce((a,b)=>a.map((x,i)=>x+b[i]/p.length),[0,0]);
const rectangle=(a,b,w)=>{const d=Math.hypot(b[0]-a[0],b[1]-a[1])||1,n=[-(b[1]-a[1])/d*w/2,(b[0]-a[0])/d*w/2];return [[a[0]+n[0],a[1]+n[1]],[b[0]+n[0],b[1]+n[1]],[b[0]-n[0],b[1]-n[1]],[a[0]-n[0],a[1]-n[1]]];};
function clip(polygons,z,{ctx,project},paint,rule='evenodd'){
  ctx.save();ctx.beginPath();
  for(const ring of polygons){ring.forEach((q,i)=>{const p=project(...q,z);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)});ctx.closePath()}
  ctx.clip(rule);paint();ctx.restore();
}
const clipRoadPaint=(polygons,api,paint)=>clip(polygons,0,api,paint,'nonzero');
function ribbon(points,width,colour,z,{poly}){for(let i=1;i<points.length;i++)poly(rectangle(points[i-1],points[i],width).map(q=>[...q,z]),colour)}
function grid(q,z,columns,rows,{poly,line,scale},colour='#536d70',gap=.12,subdivisions=false){
  const at=(u,v)=>[...mix(mix(q[0],q[1],u),mix(q[3],q[2],u),v),z];
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
    const p=[at((x+gap)/columns,(y+gap)/rows),at((x+1-gap)/columns,(y+gap)/rows),at((x+1-gap)/columns,(y+1-gap)/rows),at((x+gap)/columns,(y+1-gap)/rows)];
    poly(p,colour);
    if(subdivisions)for(let j=1;j<5;j++)line([mix(p[0],p[1],j/5),mix(p[3],p[2],j/5)],'#849b96',Math.max(.28,scale*.015));
  }
}

export function drawDomesticApron(layout,api){
  const d=layout.domesticPrecinct;if(!d)return;
  // Material overlays are clipped to the audited aircraft floor, including
  // its islands. They do not expand the operating pavement or route graph.
  for(const a of layout.aprons.filter(a=>a.id.startsWith('domestic-source'))){
    clip([a.polygon,...(a.holes||[])],0,api,()=>{
      api.poly(d.apronConcrete,'#c8c6b3');
      clip([d.apronConcrete],0,api,()=>{
        for(let x=660;x<1600;x+=32)api.line([[x,320],[x,1600]].map(point),'#939f9440',Math.max(.3,api.scale*.025));
        for(let y=360;y<1600;y+=32)api.line([[620,y],[1600,y]].map(point),'#939f9440',Math.max(.3,api.scale*.025));
      });
      ribbon(d.apronService,1.06,'#9ea79b',0,api);
      api.line(d.apronService,'#e5e4d2',Math.max(.4,api.scale*.035),[api.scale*.28,api.scale*.2]);
      const edge=d.apronService.map((p,i)=>{const a=d.apronService[Math.max(0,i-1)],b=d.apronService[Math.min(d.apronService.length-1,i+1)],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;return [p[0]-dy/len*.53,p[1]+dx/len*.53]});
      api.line(edge,'#af806d',Math.max(.45,api.scale*.035));
    });
  }
}

export function drawDomesticGround(layout,api){
  const d=layout.domesticPrecinct;if(!d)return;
  const {poly,line,road,scale}=api;
  for(const bed of detail.plantedBeds)poly(bed,'#708968');
  for(const path of detail.paths)road(path,pixel*4.5,material.path);
  for(const p of detail.parkingAreas){
    poly(p.polygon,material.parking);
    clip([p.polygon],0,api,()=>{
      for(const [row,[a,b]] of p.rows.entries()){
        const length=Math.hypot(b[0]-a[0],b[1]-a[1]),n=[-(b[1]-a[1])/length,(b[0]-a[0])/length],spacing=pixel*4.2;
        line([a,b],material.white,Math.max(.3,scale*.017));
        for(let distance=0,i=0;distance<length;distance+=spacing,i++)for(const side of [-1,1]){
          const q=mix(a,b,distance/length),end=[q[0]+n[0]*pixel*7*side,q[1]+n[1]*pixel*7*side];
          line([q,end],material.white,Math.max(.3,scale*.017));
          if((i+row*3)%5!==0){
            const along=mix(a,b,Math.min(1,(distance+spacing*.48)/length));
            // A real 4.5m car, independent of the airport-wide oversized props.
            poly(rectangle([along[0]+n[0]*pixel*side,along[1]+n[1]*pixel*side],[along[0]+n[0]*pixel*6.2*side,along[1]+n[1]*pixel*6.2*side],pixel*2.3),['#d8dcdb','#c2c7c8','#3d484c','#83969d','#b39489'][(i+row)%5]);
          }
        }
      }
    });
  }
  for(const island of d.islands)poly(island.polygon,island.colour,'#dddcca',Math.max(.45,scale*.07));
  drawDomesticLanes(d.laneModel,api);
  // Actual coloured lane panels: no invented wording or generic arrows.
  const roadPolygons=d.laneModel.sections.map(s=>s.polygon);
  for(const panel of detail.lanePanels)clipRoadPaint(roadPolygons,api,()=>{
    poly(rectangle(panel.a,panel.b,panel.width*pixel),panel.colour);
  });
  // Six published accessible positions beneath the Skywalk, with blue paint.
  for(let i=0;i<6;i++){
    const a=point([982+i*1.5,853+i*6]),b=point([990+i*1.5,855+i*6]);
    poly(rectangle(a,b,.34),'#678d9b','#ecebd8',Math.max(.4,scale*.04));
  }
  for(const [a,b] of [[[1018,909],[1028,914]],[[1037,737],[1046,737]]])poly(rectangle(point(a),point(b),.42),'#678d9b','#ecebd8',Math.max(.4,scale*.04));
}

export function drawDomesticStructures(layout,api){
  const d=layout.domesticPrecinct;if(!d)return;
  const {poly,line,defer,scale,tree}=api;
  drawDomesticRamps(d.laneModel,api);
  // Small trees are deliberately scaled to the precinct, not the game's
  // generic 40-metre scenic trees.
  for(const p of d.trees)tree(...p,.19,2);
  // Recreate observed planted strips as groups of modestly sized trees.
  for(const bed of detail.plantedBeds){
    const xs=bed.map(p=>p[0]),ys=bed.map(p=>p[1]);
    const within=p=>{let yes=false;for(let i=0,j=bed.length-1;i<bed.length;j=i++){const a=bed[i],b=bed[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes}return yes};
    for(let x=Math.min(...xs);x<Math.max(...xs);x+=.7)for(let y=Math.min(...ys);y<Math.max(...ys);y+=.7){const q=[x+Math.sin(x*13+y*7)*.19,y+Math.cos(y*11-x*5)*.19];if(within(q))tree(...q,.24+Math.abs(Math.sin(x*8+y*3))*.13,Math.floor(Math.abs(Math.sin(x+y))*3))}
  }
  for(const s of detail.signals){
    defer(...s.p,()=>{
      const z=s.arm?.88:.58,top=[...s.p,z],head=s.arm||s.p;
      line([[...s.p,0],top],'#596369',Math.max(.65,scale*.055));
      if(s.arm)line([top,[...s.arm,z]],'#727b7f',Math.max(.6,scale*.05));
      const p=api.project(...head,z),w=Math.max(2.4,scale*.14),h=w*2.6,ctx=api.ctx;
      ctx.fillStyle='#242b2e';ctx.fillRect(p.x-w/2,p.y-h/2,w,h);
      // A frozen illustrative phase; these are scenery, not live road control.
      for(let i=0;i<3;i++){ctx.fillStyle=i===(s.axis==='ew'?0:2)?['#ef5446','#edb64d','#65d998'][i]:'#404a47';ctx.beginPath();ctx.arc(p.x,p.y+(i-1)*h*.29,w*.28,0,Math.PI*2);ctx.fill()}
    });
  }
  const canopy=(s,deck=0)=>{
    const q=s.polygon,z=s.height,c=centre(q);
    defer(...c,()=>{
      poly(q.map(([x,y])=>[x+.25,y+.32]),'#36534725');
      if(deck){poly(q.map(p=>[...p,deck]),'#b8c7bd');for(let i=0;i<4;i++)line([[...q[i],deck],[...q[(i+1)%4],deck]],'#75979a',Math.max(.5,scale*.1))}
      for(const i of [0,1,2,3])line([[...q[i],0],[...q[i],z-.08]],'#b1bdb0',Math.max(.5,scale*.09));
      const n=s.segments||3;
      for(let i=0;i<n;i++){
        const a=mix(q[0],q[1],i/n),b=mix(q[0],q[1],(i+1)/n),c=mix(q[3],q[2],i/n),e=mix(q[3],q[2],(i+1)/n),m=mix(a,c,.5),k=mix(b,e,.5);
        poly([[...a,z],[...b,z],[...k,z+.15],[...m,z+.15]],'#f0efdf');poly([[...m,z+.15],[...k,z+.15],[...e,z],[...c,z]],'#d9dfd4');
        line([[...a,z+.01],[...c,z+.01]],'#b8c6ba',Math.max(.35,scale*.03));
      }
    });
  };
  const st=d.station,c=centre(st.platform);
  defer(...c,()=>{
    poly(st.platform.map(p=>[...p,.68]),'#cdd0be');
    for(const [a,b] of [[st.platform[0],st.platform[3]],[st.platform[1],st.platform[2]]])line([[...a,.7],[...b,.7]],'#e3cc80',Math.max(.6,scale*.08));
  });
  canopy({polygon:st.roof,height:1.35});
  for(const s of d.shelters)canopy(s);
  for(const s of d.bridges)canopy(s,s.deck);
  for(const s of detail.coveredWalks)canopy(s);
}

const facadeTextures=new Map();
function kineticScreen(a,b,low,high,api,partial=false){
  // Reusable silver mesh/flap texture: full-height terminal-facing screen,
  // and shorter sections on the opposite face, as in the UAP photographs.
  const key=partial?'partial':'full';
  if(!facadeTextures.has(key)){
    const canvas=document.createElement('canvas');canvas.width=960;canvas.height=160;
    const c=canvas.getContext('2d');c.fillStyle='#727a7f';c.fillRect(0,0,960,160);
    for(let y=0;y<40;y++)for(let x=0;x<240;x++){
      const wave=Math.sin(x*.08+y*.22)+Math.sin(x*.033-y*.39)*.5;
      const g=Math.round(173+wave*29);c.fillStyle=`rgb(${g-4},${g},${g+3})`;c.fillRect(x*4,y*4,3.25,3.1);
    }
    facadeTextures.set(key,canvas);
  }
  const {ctx,project}=api,origin=project(...a,high),u=project(...b,high),v=project(...a,low),image=facadeTextures.get(key);
  ctx.save();ctx.transform((u.x-origin.x)/image.width,(u.y-origin.y)/image.width,(v.x-origin.x)/image.height,(v.y-origin.y)/image.height,origin.x,origin.y);ctx.drawImage(image,0,0);ctx.restore();
}

export function drawDomesticTerminal(layout,t,api){
  if(!['domestic-headhouse','domestic-checkin','domestic-p2-extension','domestic-terminal'].includes(t.id))return false;
  const {poly,line,scale=1}=api,p=t.polygon,z=t.height,parking=t.kind==='parking';
  const edges=p.map((a,i)=>({a,b:p[(i+1)%p.length],index:i})).sort((u,v)=>u.a[0]+u.a[1]+u.b[0]+u.b[1]-v.a[0]-v.a[1]-v.b[0]-v.b[1]);
  for(const {a,b,index} of edges){
    poly([[...a,0],[...b,0],[...b,z],[...a,z]],parking?material.parkingFrame:'#cbd1cc');
    const levels=parking?(t.id==='domestic-checkin'?9:6):2;
    for(let j=0;j<levels;j++){
      const low=z*(j+.18)/levels,high=z*(j+.78)/levels;
      poly([[...a,low],[...b,low],[...b,high],[...a,high]],parking?material.opening:'#769897');
      if(parking)line([[...a,low],[...b,low]],'#d1d3d2',Math.max(.35,scale*.025));
    }
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
    for(let f=.6;f<length;f+=parking?.6:.9){const q=mix(a,b,f/length);line([[...q,0],[...q,z]],parking?material.parkingFrame:'#d7dfd0',Math.max(.45,scale*.04))}
    if(t.id==='domestic-checkin'){
      if(index===1){
        kineticScreen(mix(a,b,.02),mix(a,b,.98),z*.09,z*.94,api);
        line([[...a,z*.95],[...b,z*.95]],'#eef0ef',Math.max(.6,scale*.06));
      }else if(index===3){
        for(let section=0;section<3;section++)kineticScreen(mix(a,b,section/3+.015),mix(a,b,(section+1)/3-.025),z*.1,z*.76,api,true);
      }
      // Dark stair/core strips and exposed concrete end elevations.
      for(const f of [0,.975])poly([[...mix(a,b,f),0],[...mix(a,b,Math.min(1,f+.025)),0],[...mix(a,b,Math.min(1,f+.025)),z],[...mix(a,b,f),z]],material.pier);
    }else if(parking){
      // P2 is an open-deck grey structure. The extension's vertical fins
      // form three broad screens, unlike P1's continuous silver artwork.
      const extension=t.id==='domestic-p2-extension',spacing=extension?.18:.25;
      for(let f=.04;f<length-.04;f+=spacing){const q=mix(a,b,f/length);
        if(extension)for(let j=0;j<3;j++)line([[...q,z*(j*2+.3)/6],[...q,z*(j*2+1.82)/6]],'#929a9d',Math.max(.32,scale*.026));
        else line([[...q,z*.04],[...q,z*.94]],'#969fa1',Math.max(.28,scale*.013));
      }
      for(const f of [0,.97])poly([[...mix(a,b,f),0],[...mix(a,b,Math.min(1,f+.03)),0],[...mix(a,b,Math.min(1,f+.03)),z],[...mix(a,b,f),z]],'#969d9e');
    }
  }
  poly(p.map(q=>[...q,z]),parking?material.roof:'#eeefea','#f3f3ef',.6);
  clip([p],z,api,()=>{
    if(parking){
      for(const s of layout.domesticPrecinct.solar.filter(s=>s.building===t.id))grid(s.polygon,z+.025,s.columns,s.rows,api,material.solar,s.building==='domestic-checkin'?.1:.06,s.building==='domestic-checkin');
    }else{
      for(const [i,spine] of layout.domesticPrecinct.terminalRoof.entries())ribbon(spine,i?.1:.23,i?'#c0cbc1':'#9cafaa',z+.025,api);
      const p1=layout.domesticPrecinct.terminalRoof[0],p2=layout.domesticPrecinct.terminalRoof[1];
      for(let i=1;i<p1.length;i++)for(let f=0;f<1;f+=.2){const a=mix(p1[i-1],p1[i],f),b=mix(p2[i-1],p2[i],f),v=[b[0]-a[0],b[1]-a[1]];line([[a[0]-v[0]*3,a[1]-v[1]*3,z+.02],[b[0]+v[0]*3,b[1]+v[1]*3,z+.02]],'#cbd3c4',Math.max(.3,scale*.023))}
    }
  });
  return true;
}
