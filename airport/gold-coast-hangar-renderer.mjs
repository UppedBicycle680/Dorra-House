const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export function drawGoldCoastHangars(layout,{defer,poly,line,scale}){
 for(const b of layout.referenceBuildings){
  const p=b.polygon,z=b.eaveM*.2,ridge=b.ridgeM*.2;
  defer(b.rect.x+b.rect.w/2,b.rect.y+b.rect.h/2,()=>{
   poly(p.map(([x,y])=>[x+.22,y+.3]),'#334b4428');
   const edges=p.map((a,i)=>({a,c:p[(i+1)%p.length],index:i})).sort((a,b)=>a.a[0]+a.a[1]+a.c[0]+a.c[1]-b.a[0]-b.a[1]-b.c[0]-b.c[1]);
   for(const {a,c,index} of edges){
    const at=(t,h)=>[...mix(a,c,t),h],length=Math.hypot(c[0]-a[0],c[1]-a[1]);
    const front=index===0,doorEdge=b.sideDoors?[1,3].includes(index):front&&b.doors;
    poly([at(0,0),at(1,0),at(1,z),at(0,z)],front?b.wall:'#a7b3a8');
    // Sheet cladding, without the continuous glass ribbon of a terminal.
    if(scale>2)for(let d=.22;d<length;d+=.3)line([at(d/length,.05),at(d/length,z-.08)],'#84968a55',.45);
    if(doorEdge){
     const n=b.sideDoors||1,end=b.office? .64:.95;
     for(let j=0;j<n;j++){
      const lo=.04+(end-.04)*j/n,hi=.04+(end-.04)*(j+1)/n-.025;
      poly([at(lo,.03),at(hi,.03),at(hi,z*.8),at(lo,z*.8)],'#5f7775','#b9c6bc',.6);
      for(let panel=1;panel<b.doorPanels;panel++){const t=lo+(hi-lo)*panel/b.doorPanels;line([at(t,.04),at(t,z*.8)],'#c4cec2',.45);}
      line([at(lo-.01,z*.83),at(hi+.01,z*.83)],'#e0e3d5',Math.max(.6,scale*.08));
     }
    }
    if(front&&b.office){
     const red=b.office==='airways',lo=.67,hi=.98;
     poly([at(lo,.01),at(hi,.01),at(hi,z*.95),at(lo,z*.95)],red?'#b95143':'#d4ddd3');
     for(const [bottom,top] of [[.12,.36],[.56,.84]])for(let j=0;j<3;j++){
      const l=lo+.02+j*.095,h=l+.077;poly([at(l,z*bottom),at(h,z*bottom),at(h,z*top),at(l,z*top)],'#6a9395','#dbe1d5',.5);
     }
     line([at(lo,z*.97),at(hi,z*.97)],'#e6e8dd',Math.max(.8,scale*.13));
     if(red)for(let j=0;j<4;j++){const t=lo+j*.1;line([at(t,z*.57),at(Math.max(lo,t-.02),z*.97)],'#586c68',.7);}
    }else if(b.kind==='office'){
     for(let j=.1;j<.9;j+=.22)poly([at(j,z*.3),at(j+.15,z*.3),at(j+.15,z*.73),at(j,z*.73)],'#6f9393');
    }
    line([at(0,z),at(1,z)],'#edf0e1',.65);
   }
   if(b.roofForm==='faceted'){
    // Authored apex stays within the visibility kernel of this concave outline.
    const center=b.roofApex||p.reduce((s,q)=>s.map((v,i)=>v+q[i]/p.length),[0,0]);
    p.forEach((q,i)=>poly([[...q,z],[...p[(i+1)%p.length],z],[...center,ridge]],i%2?b.roof:'#c6d0c8','#b6c1b5',.5));return;
   }
   const frame=b.roofFrame||p;
   const at=(u,v)=>mix(mix(frame[0],frame[1],u),mix(frame[3],frame[2],u),v);
   const roofZ=(u,v)=>b.roofForm==='mono'?z+(ridge-z)*v:z+(ridge-z)*(1-Math.abs(u-.5)*2);
   const rp=(u,v)=>[...at(u,v),roofZ(u,v)];
   // Clip roof markings to the real outline, including the Airways rear notch.
   const inside=q=>{let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],c=p[j];if((a[1]>q[1])!==(c[1]>q[1])&&q[0]<(c[0]-a[0])*(q[1]-a[1])/(c[1]-a[1])+a[0])yes=!yes;}return yes;};
   const roofLine=(a,c,color,width)=>{
    const cuts=[0,1],d=[c[0]-a[0],c[1]-a[1]],cross=(v,w)=>v[0]*w[1]-v[1]*w[0];
    for(let i=0;i<p.length;i++){const q=p[i],r=p[(i+1)%p.length],e=[r[0]-q[0],r[1]-q[1]],qa=[q[0]-a[0],q[1]-a[1]],det=cross(d,e);if(Math.abs(det)<1e-9)continue;const t=cross(qa,e)/det,s=cross(qa,d)/det;if(t>0&&t<1&&s>=0&&s<=1)cuts.push(t);}
    cuts.sort((a,b)=>a-b);for(let i=1;i<cuts.length;i++)if(inside(mix(a,c,(cuts[i-1]+cuts[i])/2)))line([mix(a,c,cuts[i-1]),mix(a,c,cuts[i])],color,width);
   };
   const roofPanel=(points,...style)=>{if(points.every(inside))poly(points,...style);};
   if(b.roofForm==='mono'){
    const corners=[rp(0,0),rp(1,0),rp(1,1),rp(0,1)];
    for(let i=0;i<4;i++)poly([[...p[i],z],[...p[(i+1)%4],z],corners[(i+1)%4],corners[i]],'#c4cec0');
    poly(corners,b.roof,'#eff0e2',.65);
   }
   else{
    const d=frame[3].map((v,i)=>v-frame[0][i]),w=frame[1].map((v,i)=>v-frame[0][i]),det=w[0]*d[1]-w[1]*d[0];
    const u=q=>((q[0]-frame[0][0])*d[1]-(q[1]-frame[0][1])*d[0])/det;
    const height=q=>roofZ(Math.max(0,Math.min(1,u(q))),0);
    const half=left=>{const out=[];for(let i=0;i<p.length;i++){const a=p[i],c=p[(i+1)%p.length],ua=u(a)-.5,uc=u(c)-.5;if(left?ua<=0:ua>=0)out.push(a);if(ua*uc<0)out.push(mix(a,c,ua/(ua-uc)));}return out;};
    for(let i=0;i<p.length;i++){const a=p[i],c=p[(i+1)%p.length],ua=u(a)-.5,uc=u(c)-.5,top=[[...c,height(c)]];if(ua*uc<0){const mid=mix(a,c,ua/(ua-uc));top.push([...mid,ridge]);}top.push([...a,height(a)]);poly([[...a,z],[...c,z],...top],'#c4cec0');}
    poly(half(true).map(q=>[...q,height(q)]),b.roof,'#e9ecdf',.6);
    poly(half(false).map(q=>[...q,height(q)]),b.roofRight||'#d2d8cd','#edf0e3',.6);
    roofLine(rp(.5,0),rp(.5,1),'#f3f2e5',.8);
   }
   if(scale>2)for(let v=.045;v<1;v+=.06){roofLine(rp(.015,v),rp(.49,v),'#8f9f9548',.4);roofLine(rp(.51,v),rp(.985,v),'#8f9f9548',.4);}
   for(let j=0;j<(b.skylights||0);j++){
    const v=.13+j*.7/Math.max(1,b.skylights-1),w=b.sideDoors?.035:.025;
    for(const [lo,hi] of b.skylightSides==='left'?[[.08,.4]]:[[.08,.4],[.6,.92]])roofPanel([rp(lo,v),rp(hi,v),rp(hi,v+w),rp(lo,v+w)],'#c4c8b8');
   }
   if(b.solar)for(let row=0;row<5;row++)for(let col=0;col<4;col++){
    const u=.055+col*.097,v=.1+row*.14;
    poly([rp(u,v),rp(u+.085,v),rp(u+.085,v+.125),rp(u,v+.125)],'#354d61','#b6c9c1',.4);
   }
   for(let j=0;j<(b.vents||0);j++){
    const v=.18+j*.65/Math.max(1,b.vents-1);poly([rp(.47,v),rp(.53,v),rp(.53,v+.03),rp(.47,v+.03)],'#8b9b91');
   }
  });
 }
}
