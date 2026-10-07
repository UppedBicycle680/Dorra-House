// Original miniature scenery; relief is photo-informed, not surveyed elevations.
export function hamiltonTerrainElevation(mark,x,y){
  const u=(x-mark.x)/mark.w;if(u<=0||u>=1)return 0;
  const front=mark.y+mark.h*(.85+.23*u)+Math.sin(u*11)*5;
  const v=(front-3-y)/(mark.h*.86*Math.sin(Math.PI*u)**.4);if(v<0||v>1)return 0;
  return mark.height*Math.sin(Math.PI*u)**.8*((.32+.10*Math.sin(u*17))*Math.pow(1-v,.4)+.72*Math.sin(Math.PI*v)**1.1);
}
export function drawHamiltonCliff(mark,{poly,line,hash,defer=null,exclusions=[]}){
  const {x,y,w,h,height}=mark,objects=[];
  const front=u=>y+h*(.85+.23*u)+Math.sin(u*11)*5;
  const top=u=>height*Math.sin(Math.PI*u)**.8;
  const surface=(u,v)=>[x+w*u,front(u)-3-v*h*.86*Math.sin(Math.PI*u)**.4,
    top(u)*((.32+.10*Math.sin(u*17))*Math.pow(1-v,.4)+.72*Math.sin(Math.PI*v)**1.1)];
  const add=(points,colour)=>objects.push({depth:points.reduce((n,p)=>n+p[0]+p[1],0)/points.length,draw:()=>poly(points,colour)});
  const greens=['#71875c','#748b5d','#6f8759','#6a8356','#778c5e'];
  for(let i=0;i<34;i++){
    const u=i/34,v=(i+1)/34,a=[x+w*u,front(u),0],b=[x+w*v,front(v),0],c=surface(v,0),d=surface(u,0);
    const mid=[(a[0]+b[0])/2+hash(i+44)*2,(a[1]+b[1])/2-1,(c[2]+d[2])*(.15+.15*hash(i+65))];
    const rocks=['#a09881','#99917b','#a19982','#a49a83','#958e78'];
    for(const [j,points] of [[a,b,mid],[b,c,mid],[c,d,mid],[d,a,mid]].entries())add(points,rocks[Math.floor(hash(i*7+j)*rocks.length)]);
    for(let j=0;j<13;j++){
      const q=j/13,r=(j+1)/13,aa=surface(u,q),bb=surface(v,q),cc=surface(v,r),dd=surface(u,r);
      add([aa,bb,cc],greens[Math.floor(hash(i*71+j)*greens.length)]);add([aa,cc,dd],greens[Math.floor(hash(i*91+j)*greens.length)]);
    }
  }
  for(let i=0;i<1100;i++){
    const u=.02+hash(i+500)*.96,v=hash(i+700)*.96,[px,py,z]=surface(u,v),size=.65+hash(i+90)*.65;
    if(exclusions.some(r=>px>r.x-1&&px<r.x+r.w+1&&py>r.y-1&&py<r.y+r.h+1))continue;
    objects.push({depth:px+py,draw:()=>{line([[px,py,z],[px,py,z+1]],'#757c57',.45);
      for(let n=0;n<2;n++)poly(Array.from({length:10},(_,k)=>[px+(n-.5)*size*.35+Math.cos(k/10*Math.PI*2)*size,py,z+size*(1.5+n*.5)+Math.sin(k/10*Math.PI*2)*size*1.15]),['#527348','#68844f','#829258'][(i+n)%3]);}});
  }
  objects.sort((a,b)=>a.depth-b.depth).forEach(o=>defer?defer(o.depth/2,o.depth/2,o.draw):o.draw());
}
export function drawHamiltonTerminal(t, {box, poly, line, groundText}) {
  const {x,y,w,h}=t.rect,wall=3.1,eave=4.1,ridge=6.2;
  box(x,y,w,h,wall,'#e8e6cf','#e3ddc7','#b6c4ad');
  for(let px=x+2;px<x+w-3;px+=4) {
    poly([[px,y+h,.7],[px+2.8,y+h,.7],[px+2.8,y+h,2.8],[px,y+h,2.8]],'#628f90');
  }
  // A series of shallow gables, with cream corrugated roofing and deep eaves.
  for(let n=0;n<3;n++) {
    const a=x+n*w/3,b=x+(n+1)*w/3,m=(a+b)/2;
    poly([[a-.4,y-.5,eave],[b+.4,y-.5,eave],[m,y-.5,ridge]],'#f4ecdb');
    poly([[a-.4,y-.5,eave],[m,y-.5,ridge],[m,y+h+.6,ridge],[a-.4,y+h+.6,eave]],'#d5dfd5');
    poly([[m,y-.5,ridge],[b+.4,y-.5,eave],[b+.4,y+h+.6,eave],[m,y+h+.6,ridge]],'#f2f1df');
    poly([[a-.4,y+h+.6,eave],[b+.4,y+h+.6,eave],[m,y+h+.6,ridge]],'#e9e4d0');
    for(let px=a+1;px<b;px+=1.5) {
      const z=eave+(ridge-eave)*(1-Math.abs(px-m)/((b-a)/2));
      line([[px,y-.3,z+.03],[px,y+h+.45,z+.03]],'#a6b8ad',.4);
    }
  }
  // Shaded apron-facing veranda, contained in the terminal's landside footprint.
  poly([[x-1,y+h-2,3.5],[x+w+1,y+h-2,3.5],[x+w+1,y+h+2,2.9],[x-1,y+h+2,2.9]],'#b6cbbc');
  for(let px=x+1;px<x+w;px+=7)line([[px,y+h+1.5,0],[px,y+h+1.5,3]],'#e8e4cf',1.2);
  groundText('HAMILTON ISLAND',x+w/2,y+h-1,2.1,'#355e59',0,3.6);
}

export function drawIslandMountain(mark,{poly,line,disc,hash}) {
  const {x,y,w,h,height=38}=mark,cx=x+w/2,cy=y+h/2;
  const elevation=(u,v)=>height*Math.pow(Math.max(0,1-u*u-v*v),1.25)*(.78+.22*Math.cos(u*5+v*2));
  const point=(ring,i)=>{const a=i/40*Math.PI*2,r=ring/8,u=Math.cos(a)*r,v=Math.sin(a)*r;
    return [cx+u*w/2,cy+v*h/2,elevation(u,v)];};
  const faces=[];
  for(let ring=1;ring<=8;ring++)for(let i=0;i<40;i++) {
    const a=point(ring,i),b=point(ring,i+1),c=point(ring-1,i+1),d=point(ring-1,i);
    faces.push({points:[a,b,c,d],depth:(a[0]+a[1]+b[0]+b[1]+c[0]+c[1]+d[0]+d[1])/4,shade:i});
  }
  const greens=['#75956b','#819e70','#8aa575','#729567','#688c62','#61825b','#6c8d61','#76956a'];
  faces.sort((a,b)=>a.depth-b.depth).forEach(f=>poly(f.points,greens[Math.floor(f.shade/5)]));
  // Tree roots follow the relief so the ridge reads as terrain, not floating trees.
  const trees=Array.from({length:220},(_,i)=>{const a=hash(i+510)*Math.PI*2,r=Math.sqrt(hash(i+730))*.94;
    const u=Math.cos(a)*r,v=Math.sin(a)*r;return {x:cx+u*w/2,y:cy+v*h/2,z:elevation(u,v),i};});
  trees.sort((a,b)=>a.x+a.y-b.x-b.y).forEach(t=>{
    const size=1.8+hash(t.i+350)*1.3;
    line([[t.x,t.y,t.z],[t.x,t.y,t.z+size*2.3]],'#6e7956',.65);
    for(let n=0;n<3;n++)poly(Array.from({length:12},(_,j)=>{
      const a=j/12*Math.PI*2,r=size*(1.05-n*.14);
      return [t.x+(n-1)*size*.3+Math.cos(a)*r,t.y,t.z+size*(1.5+n*.5)+Math.sin(a)*r*1.25];
    }),['#4f7755','#658b5e','#83a36c'][(t.i+n)%3]);
  });
}
