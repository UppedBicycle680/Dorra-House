import {taxiwayPath} from './traffic.mjs';
import {ribbonCentre} from './queensland-gateway-data.mjs';

export function drawGatewayAirfield(layout,airport,{poly,rect,line,road,disc,runwayPaint,groundText,hit,scale,zoom,pavement,taxiwayPavement}) {
  for(const r of layout.runways)poly(r.protectedPolygon,'#c0cd9f');
  for(const apron of layout.aprons) {
    poly(apron.polygon,'#bdcbc4');pavement.push(apron.polygon);
    const x=apron.polygon[0][0],y=apron.polygon[0][1],w=apron.polygon[1][0]-x,h=apron.polygon[2][1]-y;
    for(let dx=0;dx<=w;dx+=14)line([[x+dx,y],[x+dx,y+h]],'#799d9438',Math.max(.3,scale*.1));
    for(let dy=0;dy<=h;dy+=14)line([[x,y+dy],[x+w,y+dy]],'#799d9438',Math.max(.3,scale*.1));
  }
  for(const t of layout.taxiways) {
    const points=taxiwayPath(t);
    road(points,t.width+1.4,'#b2c2ae');road(points,t.width,'#6f8986');
    line(points,'#ead189',Math.max(.45,scale*.15));taxiwayPavement.push({...t,points});
    if(zoom>=2)for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]);
      for(let n=12;n<d;n+=24)disc(a[0]+(b[0]-a[0])*n/d+1,a[1]+(b[1]-a[1])*n/d,.21,'#a1e2df');
    }
  }
  for(const r of layout.runways) {
    runwayPaint(r,false);
    const [x,y]=r.start,end=r.end[1],w=r.width;
    // Runway-local geometry: strips are vertical in world space, so all paint,
    // lighting and clickable footprints follow that axis as well.
    for(const e of [y,end])for(let n=8;n<58;n+=8){const py=e===y?e-n:e+n;
      line([[x-1.8,py],[x+1.8,py]],'#d3d5bb',Math.max(.4,scale*.2));
      for(const dx of [-1.5,0,1.5])disc(x+dx,py,.23,'#fff0bd');
    }
    for(const e of [y,end])for(let n=0;n<6;n++)for(const sign of [-1,1])
      rect(x+sign*(.6+n*.44),e===y?y+2:end-8,.27,6,'#fff4de');
    for(const py of [y+40,y+64,end-40,end-64])for(const sign of [-1,1])rect(x+sign*2.5,py,.55,6,'#f7f2df');
    for(let py=y+5;py<end;py+=12)for(const sign of [-1,1])disc(x+sign*(w/2+.6),py,.2,'#fff4c7');
    for(let i=0;i<4;i++)disc(x-8,y+44+i,.35,i<2?'#dc8b70':'#fff5d1');
    for(const dx of [11,11.8])line([[x+r.side*dx,y+7.5],[x+r.side*dx,y+16.5]],'#efcc79',Math.max(.6,scale*.2));
    groundText(`${r.designators.join(' / ')}  4,500 m`,x+12,(y+end)/2,2.2,'#5e817d',Math.PI/2);
    hit('building','runwaySurface',x-w/2,y,w,end-y,'Runway '+r.designators[0]);
    hit('building','runwayLength',x-6,end-10,12,16,'Runway operating length');
    hit('building','taxiway',x+r.side*26-4,y,8,end-y,'Parallel taxiway');
  }
}

export function drawGatewayStands(layout,airport,{line,groundText,hit,badge,box,defer,scale,zoom}) {
  const gates=new Map((airport?.gates||[]).map(g=>[g.plotId,g]));
  for(const s of layout.stands) {
    const [x,y]=s.position,gate=gates.get(s.plotId),f=s.flank;
    line([[x-6,y+f*8],[x-6,y-f*7],[x+6,y-f*7],[x+6,y+f*8]],gate?'#f5e5b5':'#dce7cb',Math.max(.4,scale*.13));
    line([[x,s.taxiInY],[x,y-f*3]],'#dcb967',Math.max(.5,scale*.14));
    line([[x-1.3,y-f*3],[x+1.3,y-f*3]],'#fff2c9',Math.max(.6,scale*.16));
    if(zoom>=1.4)groundText(s.referenceStand,x,y+f*10,1.8,'#416864');
    if(!gate&&zoom>=3)badge('+',x,y,{small:true});
    hit(gate?'gate':'plot',gate?.id??s.plotId,x-6,y-7,12,14,gate?.label??`Build stand ${s.referenceStand}`);
    if(s.cargo)continue;
    const [ax,ay]=s.jetwayAnchor,jy=y-f*8;
    defer(ax,Math.max(ay,jy),()=>{
      box(ax-.7,Math.min(ay,jy),1.4,Math.abs(jy-ay),2.4,'#e4ebdd','#b7cfc8','#649a9c');
      box(ax-.8,jy-1,3.5,2,2.6,'#e9eddf','#99bfba','#6d9e9e');
      line([[ax,ay,2.45],[ax,jy,2.45]],'#5a8f97',Math.max(.5,scale*.2));
    });
  }
}

const ribbonRoof=(y,u)=>{
  const phase=(y+220)/530*Math.PI*2;
  const wave=u<0?Math.sin(phase)*1.7:-Math.sin(phase)*1.7;
  return 8.2+Math.sin(Math.abs(u)*Math.PI)*6+wave*Math.sin(Math.abs(u)*Math.PI);
};
function ribbonSection(t,{poly,line}) {
  const {y0,y1}=t,at=(y,u,z)=>[ribbonCentre(y)+u*29,y,z];
  // Both curtain walls and their structural ribs share the roof's curve.
  for(const u of [-1,1]){
    poly([at(y0,u,0),at(y1,u,0),at(y1,u,8.2),at(y0,u,8.2)],u<0?'#7fb0b2':'#4e858e');
    for(let y=y0;y<=y1;y+=5){line([at(y,u,.6),at(y,u,8.1)],'#e3e8d3',.8);line([at(y,u,1),at(Math.min(y+2,y1),u,5.6)],'#bbcdbb',.5)}
    line([at(y0,u,1),at(y1,u,1)],'#c8b594',1);
  }
  if(y0===-220)poly([at(y0,-1,0),at(y0,1,0),...Array.from({length:21},(_,i)=>{const u=1-i*.1;return at(y0,u,ribbonRoof(y0,u))})],'#61989e');
  for(let j=0;j<20;j++) {
    const a=-1+j*.1,b=a+.1,mid=(a+b)/2,glass=Math.abs(mid)<.31;
    poly([at(y0,a,ribbonRoof(y0,a)),at(y1,a,ribbonRoof(y1,a)),at(y1,b,ribbonRoof(y1,b)),at(y0,b,ribbonRoof(y0,b))],
      glass?(mid<0?'#8fc6c6':'#6ba5af'):mid<0?'#faf3de':'#d5e2d7');
  }
  for(const u of [-.96,-.32,0,.32,.96])line([at(y0,u,ribbonRoof(y0,u)+.05),at(y1,u,ribbonRoof(y1,u)+.05)],u===0?'#d4e9dd':'#f7f1df',.7);
  for(let y=y0;y<y1;y+=5)line([at(y,-.31,ribbonRoof(y,-.31)+.05),at(y,0,8.25),at(y,.31,ribbonRoof(y,.31)+.05)],'#d3e9df',.65);
}

export function drawGatewayTerminal(t,api) {
  if(!t.kind?.startsWith('gateway-'))return false;
  const {box,rect,poly,line,groundText}=api,{x,y,w,h}=t.rect,z=t.height;
  if(t.kind==='gateway-ribbon'){ribbonSection(t,api);return true}
  if(t.kind==='gateway-concourse') {
    const height=xx=>6.3+5.7*Math.exp(-Math.abs(xx-t.root)/48);
    for(const yy of [y,y+h]){
      poly([[x,yy,0],[x+w,yy,0],[x+w,yy,height(x+w)],[x,yy,height(x)]],'#6c9ea2');
      for(let xx=x+2;xx<x+w;xx+=5)line([[xx,yy,.5],[xx,yy,height(xx)-.4]],'#e3e8d6',.65);
      line([[x,yy,1],[x+w,yy,1]],'#c1ab88',.9);
    }
    for(let xx=x;xx<x+w;xx+=7) {
      const ex=Math.min(xx+7,x+w);
      const cross=[0,.22,.4,.6,.78,1];
      for(let i=1;i<cross.length;i++){
        const a=cross[i-1],b=cross[i],roof=(vx,f)=>[vx,y+h*f,height(vx)+Math.sin(f*Math.PI)*1.5];
        poly([roof(xx,a),roof(ex,a),roof(ex,b),roof(xx,b)],i===3?'#8ebfc1':i<3?'#f7f0dc':'#d8e3d4');
      }
      line([[xx,y+h*.4,height(xx)+1.45],[xx,y+h*.6,height(xx)+1.45]],'#e5ecdb',.65);
    }
    groundText(t.precinct,x+w*.48,y+h/2,4,'#386e76',0,9);return true;
  }
  if(t.kind==='gateway-central') {
    box(x,y,w,h,8.2,'#9ec6c5','#62969e','#4d7d88');
    for(let xx=x+3;xx<x+w;xx+=6)line([[xx,y+h,.5],[xx,y+h,8.1]],'#ece8d2',.8);
    for(let yy=y;yy<y+h;yy+=4){const ey=Math.min(yy+4,y+h);
      for(let xx=x;xx<x+w;xx+=4){const ex=Math.min(xx+4,x+w),roof=vx=>8.2+Math.sin((vx-x)/w*Math.PI)*7;
        poly([[xx,yy,roof(xx)],[ex,yy,roof(ex)],[ex,ey,roof(ex)],[xx,ey,roof(xx)]],Math.abs(xx)<15?'#89babb':xx<0?'#f7f0de':'#d2dfd3');
      }
      line([[x+w*.4,yy,14.7],[x+w*.6,yy,14.7]],'#dcebdc',.6);
    }
    box(x+5,y+h-1,w-10,9,4,'#f1e9ce','#bdcfc0','#7ca4a5');
    groundText('TIDAL RIBBON',0,y+h-4,5,'#386a72',0,8.4);return true;
  }
  if(t.kind==='gateway-station') {
    box(x,y,w,h,z*.55,'#8ebaba','#76a4a8','#548b94');
    for(let yy=y;yy<y+h;yy+=4)for(let j=0;j<12;j++){
      const ax=x+w*j/12,bx=x+w*(j+1)/12,roof=xx=>z*.55+Math.sin((xx-x)/w*Math.PI)*z*.5;
      poly([[ax,yy,roof(ax)],[bx,yy,roof(bx)],[bx,Math.min(yy+4,y+h),roof(bx)],[ax,Math.min(yy+4,y+h),roof(ax)]],j>3&&j<8?'#94c4c4':'#eee9d3');
    }
    for(let yy=y;yy<=y+h;yy+=8)line(Array.from({length:13},(_,i)=>{const xx=x+w*i/12;return [xx,yy,z*.55+Math.sin(i/12*Math.PI)*z*.5+.05]}),'#e9edde',.8);
    return true;
  }
  box(x,y,w,h,z,'#eeeedd','#bdcfc6','#82a8a4');
  if(t.kind==='gateway-hotel') {
    for(let floor=1;floor<z-1;floor+=2)for(const yy of [y,y+h])poly([[x+.7,yy,floor],[x+w-.7,yy,floor],[x+w-.7,yy,floor+1.2],[x+.7,yy,floor+1.2]],'#56858f');
    for(let xx=x+2;xx<x+w;xx+=5)line([[xx,y+h,1],[xx,y+h,z-.3]],'#dce3cc',.65);
    rect(x+3,y+3,w-6,h-6,'#90b68e',z+.05);return true;
  }
  for(let xx=x+3;xx<x+w-4;xx+=7){poly([[xx,y+h,.3],[xx+4,y+h,.3],[xx+4,y+h,z-1],[xx,y+h,z-1]],'#61898b');rect(xx,y+3,5,h-6,'#527f8c',z+.05)}
  return true;
}

export function drawGatewayDetails(layout,{rect,poly,line,disc,box,road,defer,tree,vehicle,scale}) {
  // Continuous seawall, shallows and a planted landside forecourt.
  const coast=layout.land[0];line([...coast,coast[0]],'#efe1b8',Math.max(2,scale*4));
  line([...coast.map(([x,y])=>[x*1.013,y*1.013]),[coast[0][0]*1.013,coast[0][1]*1.013]],'#b6e0d8',Math.max(2,scale*6));
  const p=layout.solarPark;rect(p.x,p.y,p.w,p.h,'#a4b98c');
  for(let x=p.x+4;x<p.x+p.w-8;x+=10)for(let y=p.y+4;y<p.y+p.h-5;y+=8){rect(x,y,7,4,'#557f8a',.5);line([[x+3.5,y,.55],[x+3.5,y+4,.55]],'#a2c4c4',.5)}
  for(const side of [-1,1]) {
    for(let y=385;y<500;y+=12)tree(side*83,y,1.8,Math.abs(y)%3);
    for(let i=0;i<13;i++)tree(side*(104+i*12),505,1.6,i%3);
    for(let i=0;i<8;i++)vehicle(side*66,402+i*10,Math.PI/2,'car',['#e5d7b4','#659b9e','#e2ead7'][i%3]);
    const gx=side<0?-58:24;
    rect(gx,395,34,68,'#bbceb0');
    poly([[gx+4,401],[gx+27,405],[gx+24,453],[gx+6,458]],'#84bfc1');
    for(let y=405;y<455;y+=14)tree(gx+31,y,1.3,1);
  }
  // Rain gardens occupy the open spaces between neighbouring gate aprons.
  for(const [side,cy] of [[-1,-115],[-1,65],[1,-25],[1,155]]) {
    const x=side<0?-280:120,cy0=cy-9;
    rect(x,cy0,158,18,'#9bb58a');
    poly([[x+4,cy0+4],[x+60,cy0+2],[x+74,cy0+12],[x+136,cy0+10],[x+149,cy0+16],[x+20,cy0+14]],'#91bdb5');
    for(let i=0;i<12;i++){
      const tx=x+7+i*12;
      if(side>0&&cy===-25&&tx>170&&tx<211)continue;
      tree(tx,cy0+3+(i%2)*12,1.2+(i%3)*.25,i%3);
    }
  }
  for(const [px,py] of [[-315,318],[240,350],[-200,362],[125,555],[-140,548]])
    for(let i=0;i<12;i++)tree(px+(i%4)*9,py+Math.floor(i/4)*9,1.5+(i%2)*.3,i%3);
  for(let i=0;i<60;i++){
    const x=-695+i*23,y=550+Math.sin(i*.7)*5;
    if(Math.abs(x)<100)continue;
    tree(x,y,1.5+(i%3)*.2,i%3);
  }
  for(const {side,y,id} of layout.precincts) {
    // Roof-independent ground furnishings stay clear of aircraft envelopes.
    for(let i=0;i<6;i++){
      const x=side*(104+i*36),fy=y+76;
      defer(x,fy,()=>{line([[x,fy],[x,fy,7]],'#839990',Math.max(.7,scale*.3));box(x-1.3,fy-.5,2.6,1,7.2,'#eef0d4','#b4c9bc','#8aa9a1')});
      if(id==='F')for(const f of [-1,1])defer(x,y+f*11,()=>box(x-2,y+f*11,4,2,1.6,['#a3bdae','#c6a577','#72a3a4'][i%3]));
    }
  }
  for(const yy of [502,538])for(const xx of [-19,-9,9,15])line([[xx,yy],[xx,yy,2.2]],'#d5dcc5',Math.max(.8,scale*.5));
  defer(12,490,()=>{for(let i=0;i<4;i++)box(10.8,477+i*5,2.4,4.3,2.5,'#e9ecdc','#aacbc5','#508f9b')});
}
