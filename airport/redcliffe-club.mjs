import {REDCLIFFE_CLUB as roof,REDCLIFFE_CLUB_AREA as area} from './redcliffe-reference.mjs';
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const centre=q=>q.reduce((a,p)=>[a[0]+p[0]/q.length,a[1]+p[1]/q.length],[0,0]);

// Traced plan geometry; facade and heights remain simplified interpretations.
export function drawRedcliffeClubBuilding({poly,line}){
  const z=1.15,ridge=1.35;
  for(let i=0;i<4;i++){
    const a=roof[i],b=roof[(i+1)%4];
    poly([[...a,0],[...b,0],[...b,z],[...a,z]],i%2?'#69887c':'#8ea18a');
    for(let n=0;n<5;n++){const u=mix(a,b,(n+.16)/5),v=mix(a,b,(n+.82)/5);poly([[...u,.35],[...v,.35],[...v,.87],[...u,.87]],'#567c80')}
    line([[...a,1.05],[...b,1.05]],'#d6ddc8',.7);
  }
  const a=mix(roof[0],roof[3],.5),b=mix(roof[1],roof[2],.5);
  poly([[...roof[0],z],[...roof[3],z],[...a,ridge]],'#69887c');
  poly([[...roof[1],z],[...roof[2],z],[...b,ridge]],'#8ea18a');
  poly([[...roof[0],z],[...roof[1],z],[...b,ridge],[...a,ridge]],'#c3ccc5');
  poly([[...a,ridge],[...b,ridge],[...roof[2],z],[...roof[3],z]],'#e0e4db');
  line([[...a,ridge],[...b,ridge]],'#e9ece2',.8);
  for(let t=.08;t<1;t+=.08){const n=mix(roof[0],roof[1],t),m=mix(a,b,t),s=mix(roof[3],roof[2],t);line([[...n,z+.01],[...m,ridge+.01],[...s,z+.01]],'#9aada02a',.5)}
  poly(area.entrance.map(p=>[...p,.98]),'#edf0e4','#b8c8b9',.6);
  for(const p of [area.entrance[1],area.entrance.at(-2)])line([[...p,0],[...p,.98]],'#bdc8b4',.65);
}

export function drawRedcliffeClubGrounds({poly,line,road,disc,defer,tree,vehicle,badge,zoom,scale}){
  poly(area.lawn,'#a3bd85');poly(area.carpark,'#9eafa3');poly(area.terrace,'#bcbaa0');
  for(const path of area.paths)road(path,.45,'#c6c7ac');
  const c=area.crossing;
  for(let t=0;t<1;t+=.1)poly([mix(c[0],c[3],t),mix(c[1],c[2],t),mix(c[1],c[2],t+.045),mix(c[0],c[3],t+.045)],'#e4e8d8');
  const lowBuilding=(q,z,colour)=>defer(...centre(q),()=>{
    for(let i=0;i<4;i++){const a=q[i],b=q[(i+1)%4];poly([[...a,0],[...b,0],[...b,z],[...a,z]],i%2?'#8fa58e':'#b3bea4')}
    poly(q.map(p=>[...p,z]),colour,'#a1b19e',.5);
  });
  lowBuilding(area.annex,.85,'#89978a');lowBuilding(area.annexAwning,.8,'#bdc9bd');lowBuilding(area.storage,.8,'#e2e3d6');
  for(const fence of area.fences)for(let i=1;i<fence.length;i++){
    const a=fence[i-1],b=fence[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.9);
    for(let j=0;j<n;j++){const p=mix(a,b,j/n),q=mix(a,b,(j+1)/n);
      defer(...mix(p,q,.5),()=>{line([[...p,.55],[...q,.55]],'#6e887683',.6);line([[...p,.15],[...q,.15]],'#6e88775a',.5);line([[...p,0],[...p,.6]],'#859784',.6)});
    }
  }
  for(const [i,p] of area.trees.entries())tree(...p,.85+(i%3)*.18,i%3);
  for(const [x,y] of area.palms)defer(x,y,()=>{
    disc(x+.5,y+.6,.75,'#3558411a');line([[x,y],[x,y,2.8]],'#9d9e7b',Math.max(.65,scale*.09));
    for(let i=0;i<7;i++){const t=i/7*Math.PI*2;line([[x,y,2.8],[x+Math.cos(t)*.45,y+Math.sin(t)*.45,2.98],[x+Math.cos(t)*.95,y+Math.sin(t)*.95,2.6]],i%2?'#729967':'#8eae70',Math.max(1,scale*.13))}
  });
  for(const [i,[x,y]] of area.cars.entries()){
    defer(x,y,()=>vehicle(x,y,Math.PI/2,'car',['#dae0d4','#b8cac5','#6b8991'][i%3]));
    line([[x-.49,y-.9],[x-.49,y+.9]],'#d6dcc8',.55);
  }
  for(const [a,b] of area.benches)defer(...mix(a,b,.5),()=>{line([[...a,.25],[...b,.25]],'#b49d76',Math.max(1,scale*.3));for(const p of [a,b])line([[...p,0],[...p,.25]],'#7e8a6f',.6)});
  if(zoom>=1.5){const p=centre(area.carpark);badge('REDCLIFFE AERO CLUB',p[0],p[1]-3,{small:true})}
}
