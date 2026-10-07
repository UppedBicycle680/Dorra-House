import {hamiltonPoint,HAMILTON_SCALE} from './hamilton-reference.mjs';

// Roof components are registered to the apron-chart footprint. The three
// triangular roof projections and lower wings follow exterior photographs and
// overhead imagery; heights and fine architectural details are not surveyed.
export const HAMILTON_TERMINAL_HEIGHT=10.6*HAMILTON_SCALE;
export const terminalPoint=(u,v,m=0)=>[
  ...hamiltonPoint([149.4+u*.9945-v*.1045,136.1+u*.1045+v*.9945]),m*HAMILTON_SCALE,
];

export function drawHamiltonTerminalArchitecture(t,{poly,line,disc,ctx,project,scale=1}){
  const at=terminalPoint,quad=(u,v,w,d,m)=>[[u,v],[u+w,v],[u+w,v+d],[u,v+d]].map(p=>at(...p,m));
  const panel=(points,colour,stroke=null,width=.5)=>poly(points.map(p=>at(...p)),colour,stroke,width);
  const detail=scale>6;
  // Use the actual stepped outline, including the narrow connecting passage.
  const edges=t.polygon.slice(1).map((b,i)=>[t.polygon[i],b]).sort(([a,b],[c,d])=>a[0]+a[1]+b[0]+b[1]-c[0]-c[1]-d[0]-d[1]);
  for(const [a,b] of edges){
    poly([[...a,0],[...b,0],[...b,4*HAMILTON_SCALE],[...a,4*HAMILTON_SCALE]],'#dedbcc');
  }
  poly(t.polygon.map(p=>[...p,4*HAMILTON_SCALE]),'#707b74');

  function hip(u,v,w,d,eave,ridge,hipLength=1.3){
    const middle=v+d/2,a=[u+hipLength,middle,ridge],b=[u+w-hipLength,middle,ridge];
    panel([[u,v,eave],[u+w,v,eave],b,a],'#79817c');
    panel([[u,v,eave],a,[u,v+d,eave]],'#657069');
    panel([[u+w,v,eave],[u+w,v+d,eave],b],'#8b9287');
    panel([a,b,[u+w,v+d,eave],[u,v+d,eave]],'#596761');
    line([at(...a),at(...b)],'#a8afa2',.55);
    if(detail)for(let x=u+hipLength;x<u+w-hipLength;x+=.38){
      line([at(x,v,eave+.02),at(x,middle,ridge+.02)],'#a9b0a544',.35);
      line([at(x,middle,ridge+.02),at(x,v+d,eave+.02)],'#b4baac44',.35);
    }
  }
  // Western low wing, connection, and larger eastern hall. Small setbacks keep
  // the roof components within the chart's detailed recesses and porch outline.
  hip(.9,.1,17.6,5.75,4.05,6.5,1.1);
  hip(18.98,1.65,3.2,14.85,4.05,5.1,.35);
  hip(19.02,7.8,18.6,9.4,4.2,9.8,2.1);
  hip(37.85,7.8,7.95,9.95,4.05,5.8,.65);
  // Rear linking roof and the two shallow entrance projections.
  poly(quad(22.4,5.86,4.8,1.65,4.1),'#7c857a');
  poly(quad(12.8,6.42,2.02,2.05,3.5),'#69776f');
  poly(quad(17.5,16.65,2.75,2.1,3.5),'#69776f');

  // The western wing is shaded and open-looking too, rather than a blank wall.
  for(const [u,w,v] of [[1.05,7.7,7.6],[9.05,3.55,6.34],[15.1,2.3,5.9]]){
    panel([[u,v,.45],[u+w,v,.45],[u+w,v,2.95],[u,v,2.95]],'#55736b');
    for(let x=u;x<u+w;x+=1.35)line([at(x,v,.4),at(x,v,3)],'#c6cfbd',.55);
  }
  panel([[.95,5.7,4.1],[8.85,5.7,4.1],[8.85,7.55,3.3],[.95,7.55,3.3]],'#738176');
  for(const u of [1.3,3.4,5.5,7.6])line([at(u,7.55,0),at(u,7.55,3.3)],'#dfdeca',.75);

  // Three dark triangular dormers rise from one continuous hall roof. The
  // recessed glazing and substantial rake edges are the terminal's signature.
  for(const u of [24.2,27.5,30.8]){
    const w=2.7,mid=u+w/2,front=13.5,back=10.6;
    panel([[u,front,6.35],[mid,back,10.2],[mid,front,10.6]],'#505e58');
    panel([[mid,front,10.6],[mid,back,10.2],[u+w,front,6.35]],'#7b8379');
    panel([[u,front,6.35],[u+w,front,6.35],[mid,front,10.6]],'#344e4b');
    line([at(u,front,6.35),at(mid,front,10.6),at(u+w,front,6.35)],'#8e998b',detail?1.2:.6);
    line([at(mid,front,6.4),at(mid,front,10.1)],'#839486',.5);
  }

  // Apron-facing veranda, with a dark glazed wall behind slender cream posts.
  panel([[20.55,16.75,.25],[33.55,16.75,.25],[33.55,16.75,3.15],[20.55,16.75,3.15]],'#4e706c');
  for(let u=20.6;u<33.6;u+=1.1)line([at(u,16.75,.25),at(u,16.75,3.3)],'#b8c5b5',.55);
  panel([[19.05,15.8,4.25],[37.6,15.8,4.25],[37.6,17.25,3.3],[20.5,17.25,3.3]],'#7c877c');
  line([at(20.5,17.25,3.3),at(37.6,17.25,3.3)],'#c1c8b8',.6);
  for(let u=20.6;u<33.6;u+=2.5)line([at(u,17.2,0),at(u,17.2,3.3)],'#dddcc7',detail?1:.65);

  // Large, dark service openings on the low eastern wing, as seen from the tower.
  for(const u of [38.35,41.1,43.8]){
    panel([[u,17.76,.05],[u+1.5,17.76,.05],[u+1.5,17.76,2.9],[u,17.76,2.9]],'#394d48');
    line([at(u,17.76,3),at(u+1.5,17.76,3)],'#bbc4b5',.55);
  }
  // Sheltered arrivals entrance inside the chart's projecting porch.
  panel([[33.85,18.25,.05],[37.6,18.25,.05],[37.6,18.25,2.7],[33.85,18.25,2.7]],'#3f605a');
  panel([[33.8,17.45,3.85],[37.65,17.45,3.85],[37.65,19.05,3.15],[33.8,19.05,3.15]],'#586b61');
  for(const u of [34,37.45])line([at(u,18.9,0),at(u,18.9,3.15)],'#e4decb',.7);
  // Small signs are on the canopy fascia, never a large invented roof label.
  if(detail&&ctx&&project){
    const p=project(...at(35.75,19.06,2.94)),a=project(...at(36.75,19.06,2.94)),b=project(...at(35.75,19.06,1.94));
    ctx.save();ctx.transform(a.x-p.x,a.y-p.y,b.x-p.x,b.y-p.y,p.x,p.y);
    ctx.fillStyle='#eef0dc';ctx.font='600 .48px sans-serif';ctx.textAlign='center';ctx.fillText('ARRIVALS',0,0);ctx.restore();
  }
  // Tropical planters are kept inside the entrance recesses, away from stands.
  for(const [u,v] of [[34.3,18.65],[36.9,18.65],[13.15,8.05],[14.45,8.05]]){
    poly(quad(u-.18,v-.18,.36,.36,.45),'#aaa88c');
    const p=at(u,v,.85);disc(p[0],p[1],.18,'#527b51',p[2]);
    line([at(u,v,.4),at(u,v,1.7)],'#739057',.75);
  }
  // White island flags echo the photographed arrival frontage. Their exact
  // spacing is illustrative; every pole and flag remains inside the porch.
  for(const [i,u] of [34.1,35.35,36.6].entries()){
    const top=6.4+i*.25;
    line([at(u,19.1,0),at(u,19.1,top)],'#dce4d5',.65);
    panel([[u,19.1,top-.1],[u+.5,19.1,top-.35],[u+.5,19.1,top-1.3],[u,19.1,top-1.05]],'#e4e9db');
  }
}
