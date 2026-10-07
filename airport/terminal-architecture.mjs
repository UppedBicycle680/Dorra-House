import {drawYbsuTerminal,YBSU_TERMINAL_HEIGHT} from './ybsu-terminal.mjs';
import {drawRedcliffeClubBuilding} from './redcliffe-club.mjs';
import {domesticPoint as dp} from './brisbane-bays.mjs';
import {drawBrisbaneHangar} from './brisbane-hangar-renderer.mjs';
import {drawDomesticTerminal} from './brisbane-domestic-renderer.mjs';

// Photo-informed miniature architecture on the existing chart footprints.
// Heights and panel subdivisions are artistic approximations; see TERMINAL-ARCHITECTURE.md.
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const mid=p=>p.reduce((a,b)=>a.map((v,i)=>v+b[i]/p.length),[0,0]);
const rectangle=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
export function terminalArchitectureHeight(layout,t,fallback){
  if(layout.id==='sunshine-coast')return YBSU_TERMINAL_HEIGHT;
  if(layout.id==='redcliffe')return 1.35;
  if(layout.id==='archerfield')return 2.35;
  return fallback;
}

export function drawReferenceTerminal(layout,t,{poly,line,ctx,project}){
  if(t.hangarArchitecture){drawBrisbaneHangar(t,{poly,line,ctx,project});return true;}
  if(layout.domesticPrecinct&&drawDomesticTerminal(layout,t,{poly,line,ctx,project,scale:Math.abs(project(1,0).x-project(0,0).x)}))return true;
  if(!t.polygon||!['sunshine-coast','gold-coast','brisbane','archerfield','redcliffe'].includes(layout.id))return false;
  const p=t.polygon;
  function shell(points,z,{roof='#ececdd',glass='#73999a',wall='#d2d9ca',sill=.28,band=.6,step=1.8}={}){
    poly(points.map(([x,y])=>[x+.25,y+.35]),'#36534720');
    const edges=points.map((a,i)=>[a,points[(i+1)%points.length]]).sort(([a,b],[c,d])=>a[0]+a[1]+b[0]+b[1]-c[0]-c[1]-d[0]-d[1]);
    for(const [a,b] of edges){
      poly([[...a,0],[...b,0],[...b,z],[...a,z]],b[0]-a[0]>b[1]-a[1]?wall:'#aebfb2');
      const len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(len<.2)continue;
      const at=(f,h)=>[...mix(a,b,f),h];
      if(glass){poly([at(.025,z*sill),at(.975,z*sill),at(.975,z*(sill+band)),at(.025,z*(sill+band))],glass);
        for(let n=step;n<len;n+=step)line([at(n/len,z*sill),at(n/len,z*(sill+band))],'#d6dfd1',.55);}
      line([at(0,z-.12),at(1,z-.12)],'#e9ecdc',.65);
    }
    poly(points.map(q=>[...q,z]),roof,'#f6f3e6',.6);
  }
  function clip(points,z,draw){ctx.save();ctx.beginPath();points.forEach((q,i)=>{const s=project(...q,z);i?ctx.lineTo(s.x,s.y):ctx.moveTo(s.x,s.y)});ctx.closePath();ctx.clip();draw();ctx.restore();}
  function panels(q,z,cols,rows){
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const at=(u,v)=>[...mix(mix(q[0],q[1],u),mix(q[3],q[2],u),v),z];
      poly([at((x+.07)/cols,(y+.08)/rows),at((x+.93)/cols,(y+.08)/rows),at((x+.93)/cols,(y+.92)/rows),at((x+.07)/cols,(y+.92)/rows)],'#597f86','#9eb6b5',.35);
    }
  }
  function solarGroups(q,z,columns=3,rows=3){
    const at=(u,v)=>mix(mix(q[0],q[1],u),mix(q[3],q[2],u),v);
    for(let y=0;y<rows;y++)for(let x=0;x<columns;x++)panels([at((x+.12)/columns,(y+.15)/rows),at((x+.88)/columns,(y+.15)/rows),at((x+.88)/columns,(y+.85)/rows),at((x+.12)/columns,(y+.85)/rows)],z,4,4);
  }
  function gable(q,eave,ridge,colours=['#dce1d8','#f0eee0']){
    const a=mix(q[0],q[3],.5),b=mix(q[1],q[2],.5);
    poly([[...q[0],eave],[...q[1],eave],[...b,ridge],[...a,ridge]],colours[0]);
    poly([[...a,ridge],[...b,ridge],[...q[2],eave],[...q[3],eave]],colours[1]);
    line([[...a,ridge],[...b,ridge]],'#b6c4b9',.65);
  }
  if(layout.id==='sunshine-coast'){
    drawYbsuTerminal(t,{poly,line,ctx,project});
  }else if(layout.id==='gold-coast'){
    shell(p,1.55,{step:1.8});
    // Existing low linear hall; the 2022 southern expansion is taller and has
    // a dark glazed apron elevation. Cut along the footprint, never over aprons.
    const cut=(points,x)=>{const out=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],aa=a[0]>=x,bb=b[0]>=x;if(aa)out.push(a);if(aa!==bb)out.push(mix(a,b,(x-a[0])/(b[0]-a[0])));}return out;};
    const south=cut(p,345);shell(south,3,{glass:'#55797c',wall:'#a9bcb5',sill:.12,band:.76,step:1.4});
    clip(p,1.56,()=>{for(let x=283;x<341;x+=5){poly(rectangle(x,14,2.6,1.4).map(q=>[...q,1.58]),'#b4c3b9');line([[x,16,1.57],[x,29,1.57]],'#c6d1c6',.45);}});
    clip(south,3,()=>{for(let x=348;x<369;x+=5)poly(rectangle(x,17,3.8,3).map(q=>[...q,3.03]),'#cbd2c7');line([[346,27,3.03],[373,27,3.03]],'#c0cbc1',.6);});
  }else if(layout.id==='archerfield'){
    // Terminal 28: single-storey wings, a three-storey central block and a
    // railed observation deck. The former rooftop control cab is not present.
    shell(p,.85,{wall:'#e0d7bc',glass:'#6a9293',step:.65});
    const a=[257.95,59.35],b=[259.75,59.12],c=[260.45,64.48],d=[258.55,64.72];
    const block=[mix(a,d,.27),mix(b,c,.27),mix(b,c,.74),mix(a,d,.74)];
    shell(block,2.05,{wall:'#e3d8bd',glass:null});
    for(let i=0;i<4;i++){const u=block[i],v=block[(i+1)%4];for(const h of [.92,1.48])for(let n=0;n<3;n++){const q=mix(u,v,(n+.18)/3),r=mix(u,v,(n+.78)/3);poly([[...q,h],[...r,h],[...r,h+.34],[...q,h+.34]],'#658b8d');}}
    // Re-cover rear elevation windows before the deck railings. Otherwise
    // those windows project over the roof and make the block appear hollow.
    poly(block.map(q=>[...q,2.05]),'#ececdd','#f6f3e6',.6);
    for(let i=0;i<4;i++){const u=block[i],v=block[(i+1)%4];line([[...u,2.2],[...v,2.2]],'#849d90',.5);for(const f of [0,.5,1]){const q=mix(u,v,f);line([[...q,2.04],[...q,2.21]],'#a5b4a5',.5);}}
    line([[...mid(block),2.06],[...mid(block),2.65]],'#788f83',.6);
  }else if(layout.id==='redcliffe'){
    drawRedcliffeClubBuilding({poly,line});
  }else if(t.kind==='satellite'){
    shell(p,1.5,{glass:'#719594',sill:.16,band:.72,step:.55});
    const centre=mid(p),inner=p.map(q=>mix(centre,q,.43));
    for(let i=0;i<p.length;i++){const j=(i+1)%p.length;poly([[...p[i],1.5],[...p[j],1.5],[...inner[j],1.9],[...inner[i],1.9]],i<20?'#eef0e4':'#d9e1d7');if(i%2===0)line([[...p[i],1.51],[...inner[i],1.91]],'#bac8bc',.45);}
    shell(inner,2.14,{glass:'#7f9d98',sill:.89,band:.08,step:.5});
    // The upper drum rests on the roof; repaint the lower annulus after its
    // shell so no hidden wall can show through the sloping lower roof.
    for(let i=0;i<p.length;i++){const j=(i+1)%p.length;poly([[...p[i],1.5],[...p[j],1.5],[...inner[j],1.9],[...inner[i],1.9]],i<20?'#eef0e4':'#d9e1d7');}
    poly(inner.map(q=>[...q,2.14]),'#e7ebde');
  }else{
    const z=t.height??1.8;shell(p,z,{glass:['hangar','warehouse','parking'].includes(t.kind)?null:'#789b9c',step:1.25});
    if(t.kind==='parking')for(let i=0;i<p.length;i++)for(let h=.35;h<z-.1;h+=.45){const a=p[i],b=p[(i+1)%p.length];poly([[...a,h],[...b,h],[...b,h+.22],[...a,h+.22]],'#839d94');}
    if(t.kind==='parking')poly(p.map(q=>[...q,z]),'#ececdd','#f6f3e6',.6);
    clip(p,z,()=>{
      if(t.id==='domestic-terminal'){
        const outer=p.slice(0,14),inner=p.slice(14).reverse();
        const centre=outer.map((q,i)=>mix(q,inner[Math.min(i,inner.length-1)],.54));
        for(let i=1;i<centre.length;i++){const a=centre[i-1],b=centre[i],dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy),nx=-dy/d*.35,ny=dx/d*.35;poly([[a[0]+nx,a[1]+ny,z+.03],[b[0]+nx,b[1]+ny,z+.03],[b[0]-nx,b[1]-ny,z+.03],[a[0]-nx,a[1]-ny,z+.03]],'#86a6a3');}
        for(let i=1;i<outer.length;i++)line([[...outer[i],z+.04],[...inner[Math.min(i,inner.length-1)],z+.04]],'#ccd5c8',.5);
      }else if(t.kind==='international'||t.kind==='parking'){
        const q=t.id==='domestic-headhouse'?[[90,185],[106,192],[77,253],[60,245]].map(dp):p;
        solarGroups(q,z+.04,t.kind==='international'?4:2,t.kind==='international'?3:5);
      }else if(t.kind==='domestic'){
        const q=t.id==='domestic-checkin'?p:[[90,185],[106,192],[77,253],[60,245]].map(dp);
        gable(q,z,z+.3);
        panels([mix(q[0],q[3],.12),mix(q[1],q[2],.12),mix(q[1],q[2],.85),mix(q[0],q[3],.85)],z+.34,4,12);
      }else if(t.id.startsWith('international-concourse')){
        panels(p,z+.03,Math.max(1,Math.round(Math.hypot(p[1][0]-p[0][0],p[1][1]-p[0][1])/1.8)),1);
      }
    });
  }
  return true;
}
