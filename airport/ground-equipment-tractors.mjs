// Reference-led conventional tractors. See GROUND-EQUIPMENT-REFERENCES.md.
// Coordinates are metres, with the front at +X. Mechanical detail dimensions
// not published by the manufacturers are modelled estimates.
const TAU=Math.PI*2;
export function buildGroundTractor(kind,{add,box,tube,torus}){
  const wheels=[],hitches=[];
  function tyre(x,y,r,width,tag='tractor'){
    const sign=Math.sign(y)||1,segments=80;
    // A pneumatic tyre section: bead, bulging sidewall, shoulder and broad
    // tread crown. Width is independent of radius (unlike a circular torus).
    const profile=[[-.5,.58],[-.51,.7],[-.5,.84],[-.46,.94],[-.36,.987],[-.22,1],[0,1],[.22,1],[.36,.987],[.46,.94],[.5,.84],[.51,.7],[.5,.58]];
    const rings=profile.map(([yy,rr])=>Array.from({length:segments},(_,i)=>{const a=i*TAU/segments;return [x+r*rr*Math.cos(a),y+width*yy,r+r*rr*Math.sin(a)]}));
    for(let j=0;j<profile.length-1;j++)for(let i=0;i<segments;i++){
      const k=(i+1)%segments,normal=(a,b)=>{const before=profile[Math.max(0,b-1)],after=profile[Math.min(profile.length-1,b+1)],dy=(after[0]-before[0])*width,dr=(after[1]-before[1])*r,d=Math.hypot(dy,dr)||1;return [Math.cos(a)*dy/d,-dr/d,Math.sin(a)*dy/d]};
      add([rings[j][i],rings[j][k],rings[j+1][k],rings[j+1][i]],'rubber','wheel',[normal(i*TAU/segments,j),normal(k*TAU/segments,j),normal(k*TAU/segments,j+1),normal(i*TAU/segments,j+1)]);
    }
    const outer=y+sign*width*.49;
    tube([x,y-width*.43,r],[x,y+width*.43,r],r*.58,'metal','wheel',64);
    tube([x,outer-sign*.05,r],[x,outer,r],r*.45,'intake','rim-recess',64);
    torus(x,outer,r,r*.54,.014,'rim','rim-lip','y',64,12);
    tube([x,outer,r],[x,outer+sign*.028,r],r*.28,'metal','wheel-hub',48);
    for(let i=0;i<8;i++){
      const a=i*TAU/8,xx=x+Math.cos(a)*r*.205,zz=r+Math.sin(a)*r*.205;
      tube([xx,outer,zz],[xx,outer+sign*.048,zz],.019,'rim','wheel-bolts',12);
      const hx=x+Math.cos(a+.2)*r*.36,hz=r+Math.sin(a+.2)*r*.36;
      tube([hx,outer-sign*.004,hz],[hx,outer+sign*.004,hz],r*.065,'rubber','rim-vent',16);
    }
    for(let i=0;i<64;i++)for(const lane of [-1,0,1]){
      const a=(i+.2*lane)*TAU/64,b=a+.035,yy=y+lane*width*.22;
      add([[x+r*Math.cos(a),yy-width*.075,r+r*Math.sin(a)],[x+r*Math.cos(b),yy-width*.075,r+r*Math.sin(b)],[x+r*Math.cos(b),yy+width*.075,r+r*Math.sin(b)],[x+r*Math.cos(a),yy+width*.075,r+r*Math.sin(a)]],'intake','tyre-tread');
    }
    wheels.push({x,y,radius:r,width,tag});
  }
  function axle(x,track,r,width,tag){
    tube([x,-track/2,r],[x,track/2,r],.065,'metal','axle');
    box(x,0,r-.1,.27,.34,.2,'under','differential');
    for(const s of [-1,1])tyre(x,s*track/2,r,width,tag);
  }
  function eye(x,z,r=.073){
    // Horizontal towing eye: the pin axis is vertical.
    const before=[];for(let i=0;i<48;i++)before.push([x+Math.cos(i*TAU/48)*r,Math.sin(i*TAU/48)*r,z]);
    for(let i=0;i<48;i++)tube(before[i],before[(i+1)%48],.021,'metal','towing-eye',8);
  }
  function hitch(x,z,direction=1,tag='tractor'){
    box(x-direction*.045,0,z-.105,.09,.22,.25,'metal','hitch-mount');
    for(const h of [-.095,.085])box(x+direction*.028,0,z+h,.2,.2,.035,'stripe','hitch-jaw',.012);
    tube([x+direction*.075,0,z-.12],[x+direction*.075,0,z+.16],.035,'metal','hitch-pin',32);
    tube([x+direction*.075,0,z+.16],[x+direction*.14,0,z+.19],.016,'metal','hitch-handle',16);
    hitches.push({x:x+direction*.075,z,tag});
  }
  function chevrons(x,width,z,height){
    box(x,0,z,.042,width,height,'rubber','hazard-bumper',.008);
    // Sloped yellow bands clipped to the physical bumper edges.
    for(let y=-width/2-.4;y<width/2;y+=.36){
      const pts=[[y,z+.014],[y+.17,z+.014],[y+.17+height*.65,z+height-.014],[y+height*.65,z+height-.014]];
      let poly=pts;
      for(const [edge,keep]of [[-width/2+.012,1],[width/2-.012,-1]]){
        const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],aa=(a[0]-edge)*keep>=0,bb=(b[0]-edge)*keep>=0;if(aa)out.push(a);if(aa!==bb){const t=(edge-a[0])/(b[0]-a[0]);out.push([edge,a[1]+(b[1]-a[1])*t])}}poly=out;
      }
      if(poly.length>=3)add(poly.map(([y,z])=>[x+Math.sign(x)*.024,y,z]),'stripe','hazard-chevron');
    }
  }
  function lamps(x,w,z){
    for(const s of [-1,1]){
      box(x,s*w*.37,z-.09,.055,.31,.19,'rubber','lamp-housing',.025);
      tube([x,s*w*.4,z],[x+Math.sign(x)*.042,s*w*.4,z],.061,'body','headlight',32);
      tube([x,s*w*.315,z],[x+Math.sign(x)*.044,s*w*.315,z],.036,'stripe','indicator',24);
    }
  }
  function seat(x,y,z){
    tube([x,y,z-.28],[x,y,z],.065,'metal','seat-pedestal');
    box(x,y,z,.41,.45,.13,'rubber','seat-cushion',.055);
    box(x-.17,y,z+.11,.11,.43,.48,'rubber','seat-back',.045);
    for(let i=0;i<4;i++)box(x-.105,y,z+.18+i*.075,.018,.35,.025,'intake','seat-stitch',.004);
  }
  function steering(x,y,z){
    tube([x+.18,y,z-.43],[x,y,z],.031,'metal','steering-column');
    const centre=[x,y,z],u=[0,1,0],v=[.72,0,.694],r=.17;
    const p=a=>centre.map((n,i)=>n+r*(u[i]*Math.cos(a)+v[i]*Math.sin(a)));
    for(let i=0;i<48;i++)tube(p(i*TAU/48),p((i+1)*TAU/48),.019,'rubber','steering-rim',10);
    for(let i=0;i<3;i++)tube(centre,p(i*TAU/3),.012,'metal','steering-spoke',12);
    for(const dy of [-.09,.09])box(x+.18,y+dy,z-.54,.14,.07,.03,'rubber','pedal',.01);
  }
  function fenderPanel(x0,x1,y,top,stations,base=.22,opening=null){
    // Separate strips follow actual circular wheel openings. No solid body
    // faces cross a tyre, and no concave polygon is fan-triangulated.
    const bottom=x=>Math.max(base,...stations.map(([cx,r])=>Math.abs(x-cx)<r+.055?r+Math.sqrt(Math.max(0,(r+.055)**2-(x-cx)**2)):base));
    const steps=Math.ceil((x1-x0)/.035);
    for(let i=0;i<steps;i++){
      const a=x0+(x1-x0)*i/steps,b=x0+(x1-x0)*(i+1)/steps,za=bottom(a),zb=bottom(b);
      const cap=opening&&a>=opening[0]&&b<=opening[1] ? .42 : top;
      if(za>=cap||zb>=cap)continue;
      const yy=y+Math.sign(y)*.045;
      add([[a,y,za],[b,y,zb],[b,y,cap],[a,y,cap]],'body','wheel-arch-panel');
      add([[a,yy,za],[b,yy,zb],[b,y,zb],[a,y,za]],'under','wheel-arch-lip');
      add([[a,y,cap],[b,y,cap],[b,yy,cap],[a,yy,cap]],'body','fender-top');
    }
  }
  function bonnet(x0,x1,w,z0,z1,base,part='bonnet'){
    const rings=[[x0,w*.45,z0-.08],[x0+.13,w/2,z0],[x1-.14,w/2,z1],[x1,w*.46,z1-.055]];
    for(let i=0;i<3;i++){
      const [a,wa,za]=rings[i],[b,wb,zb]=rings[i+1];
      add([[a,-wa,za],[b,-wb,zb],[b,wb,zb],[a,wa,za]],'body',part);
      for(const s of [-1,1])add([[a,s*wa,base],[b,s*wb,base],[b,s*wb,zb],[a,s*wa,za]],'body',part);
    }
    for(const [x,ww,z]of [rings[0],rings[3]])add([[x,-ww,base],[x,ww,base],[x,ww,z],[x,-ww,z]],'body',part);
  }
  if(kind==='tug'||kind==='heavyTug'){
    const heavy=kind==='heavyTug',l=heavy?6.88:4.56,w=heavy?2.8:2.08,front=l/2,rear=-l/2,track=heavy?2.25:1.68,r=heavy?.57:.415;
    const stations=heavy?[[-2.04,r],[1.36,r]]:[[-1.3,r],[.85,r]],cabRear=heavy?1.02:.57,cabFront=front-.07,cabWidth=heavy?2.04:1.94,roof=heavy?2.08:1.96,deck=heavy?1.31:1.08;
    box(0,0,.22,l-.12,track-.46,.23,'under','chassis');
    for(const [x,r] of stations)axle(x,track,r,heavy?.39:.26,'tractor');
    for(const s of [-1,1]){
      fenderPanel(rear+.05,front-.04,s*w/2,deck,stations,.22,s>0?[front-.88,front-.1]:null);
      box((rear+cabRear)/2,s*(w/2-.12),deck-.02,cabRear-rear,.22,.055,'body','side-deck');
    }
    // The rear ballast and engine cover are distinct masses behind a low cab.
    bonnet(rear+.08,cabRear-.08,w-.17,deck+.025,deck-.02,deck-.1,'engine-cover');
    box(rear+.32,0,.3,.55,w-.12,.38,'body','rear-ballast',.08);
    for(const s of [-1,1]){
      for(let i=0;i<10;i++)box(rear+.38+i*.08,s*(w/2+.008),deck-.22,.033,.023,.16,'intake','engine-louvre',.004);
      tube([rear+.48,s*.5,deck+.035],[cabRear-.35,s*.5,deck+.035],.012,'panel','engine-panel-seam',12);
      tube([rear+.35,s*.69,deck+.065],[rear+.64,s*.69,deck+.065],.022,'metal','service-handle',16);
    }
    box((cabRear+cabFront)/2,0,.34,cabFront-cabRear,1.12,.075,'metal','cab-floor');
    box(cabFront-.02,0,.4,.14,cabWidth,.4,'body','cab-front',.04);
    const windBottom=cabFront-.1,windTop=cabFront-.37,topRear=cabRear+.05,zBottom=.88,zTop=roof-.07;
    // Raked windshield and real frame members; the cab is not a raised box.
    add([[windBottom,-cabWidth*.46,zBottom],[windBottom,cabWidth*.46,zBottom],[windTop,cabWidth*.46,zTop],[windTop,-cabWidth*.46,zTop]],'glass','windscreen');
    add([[windTop-.003,-cabWidth*.42,zTop-.08],[windTop-.003,cabWidth*.2,zTop-.08],[windBottom-.07,cabWidth*.38,1.05]],'glint','glass-reflection');
    for(const s of [-1,1]){
      tube([windBottom,s*cabWidth*.49,.78],[windTop,s*cabWidth*.49,roof],.033,'body','cab-pillar');
      tube([cabRear,s*cabWidth*.49,deck+.02],[topRear,s*cabWidth*.49,roof],.032,'body','cab-pillar');
      tube([windTop,s*cabWidth*.49,roof-.02],[topRear,s*cabWidth*.49,roof-.02],.034,'body','cab-pillar');
      // An open driver's entrance reveals the seat, wheel and recessed step.
      if(s<0)add([[cabRear+.065,s*cabWidth*.487,.88],[windBottom-.03,s*cabWidth*.487,.88],[windTop-.055,s*cabWidth*.487,zTop],[topRear+.04,s*cabWidth*.487,zTop]],'glass','side-window');
      box(cabFront-.5,s*cabWidth*.45,.26,.61,.27,.07,'metal','recessed-step');
      tube([cabRear+.06,s*cabWidth*.51,.74],[cabRear+.06,s*cabWidth*.51,1.16],.018,'metal','door-grab');
      tube([windBottom-.04,s*cabWidth*.5,1.21],[windBottom+.07,s*(cabWidth/2+.12),1.36],.018,'metal','mirror-arm');
      box(windBottom+.07,s*(cabWidth/2+.12),1.29,.09,.08,.18,'rubber','mirror');
      tube([windBottom+.015,s*.43,.91],[windTop+.08,s*.23,1.63],.014,'rubber','windscreen-wiper',12);
    }
    add([[cabRear-.004,-cabWidth*.43,.98],[cabRear-.004,cabWidth*.43,.98],[cabRear-.004,cabWidth*.43,zTop],[cabRear-.004,-cabWidth*.43,zTop]],'glass','rear-window');
    box((topRear+windTop)/2,0,roof,windTop-topRear+.16,cabWidth+.08,.065,'body','cab-roof',.027);
    tube([cabRear+.32,0,roof+.067],[cabRear+.32,0,roof+.19],.075,'stripe','beacon',40);
    box(cabFront-.22,0,.77,.22,cabWidth*.82,.15,'rubber','dashboard');
    seat(cabRear+.34,.43,.71);seat(cabRear+.34,-.43,.71);steering(cabFront-.54,.43,1.11);
    for(const s of [-1,1]){chevrons(s*(front+.015),w-.08,.32,.28);lamps(s*(front+.055),w,.78);hitch(s*(front+.125),.46,s)}
    // Visible towbar attachment points are part of the model, rather than an
    // unconnected cylinder emerging from the nose.
    return {reference:heavy?'TMX conventional heavy proportions':'TLD TMX-150',wheels,hitches,wheelbase:stations[1][0]-stations[0][0],bodyLength:l,bodyWidth:w};
  }
  if(kind!=='baggage')return null;
  // JST-style tractor: open operator station aft of a long, forward bonnet.
  const tractorX=2.01,front=tractorX+1.4925,rear=tractorX-1.4925;
  box(tractorX,0,.13,2.985,.84,.21,'under','chassis');
  axle(tractorX+.7475,1.24,.325,.185,'tractor-front');axle(tractorX-.8525,1.155,.3556,.2286,'tractor-rear');
  for(const s of [-1,1]){
    fenderPanel(tractorX+.08,front-.03,s*.72,.91,[[tractorX+.7475,.325]],.24);
    fenderPanel(rear+.025,tractorX-.36,s*.7,.805,[[tractorX-.8525,.3556]],.23);
    box(rear+.45,s*.62,.8,.83,.19,.07,'body','rear-fender');
    box(tractorX-.24,s*.54,.32,.62,.31,.065,'metal','operator-step');
    tube([rear+.22,s*.65,.84],[rear+.22,s*.65,1.16],.026,'stripe','operator-grab');
    tube([rear+.22,s*.65,1.16],[rear+.67,s*.65,1.16],.026,'stripe','operator-grab');
    tube([rear+.67,s*.65,1.16],[rear+.67,s*.65,.84],.026,'stripe','operator-grab');
  }
  bonnet(tractorX+.04,front-.025,1.43,1.09,.96,.75);
  box(tractorX+.075,0,.88,.21,1.23,.32,'body','dashboard-pedestal');
  box(tractorX+.03,0,1.17,.32,1.22,.08,'rubber','dashboard');
  for(const y of [-.21,0,.21])tube([tractorX-.137,y,1.16],[tractorX-.15,y,1.16],.046,'glass','instrument',32);
  seat(tractorX-.66,0,.78);steering(tractorX-.18,0,1.27);
  tube([rear+.23,-.55,.8],[rear+.23,-.55,1.57],.023,'metal','beacon-mast');
  tube([rear+.23,-.55,1.57],[rear+.23,-.55,1.7],.065,'stripe','beacon',32);
  box(rear+.12,0,.36,.24,1.36,.41,'body','rear-counterweight');
  for(let i=0;i<7;i++)box(front-.004,0,.48+i*.058,.022,.85,.024,'intake','radiator-grille',.004);
  for(const s of [-1,1])for(let i=0;i<4;i++)box(tractorX+.24,s*.726,.8+i*.05,.25,.015,.023,'intake','bonnet-vent',.004);
  chevrons(front+.008,1.37,.23,.18);lamps(front+.035,1.44,.85);hitch(rear-.065,.4,-1,'tractor-rear');

  // A 5 x 10 foot load floor, covered sides and a fifth-wheel steering axle.
  const cx=-1.93,cartFront=cx+1.524,cartRear=cx-1.524,deck=.56,cartWidth=1.524;
  box(cx,0,deck-.1,3.048,cartWidth,.1,'metal','cart-floor',.025);
  for(const y of [-.52,.52])box(cx,y,.34,2.98,.09,.12,'under','cart-frame');
  for(const x of [cartRear+.48,cartFront-.48]){
    const before=wheels.length;axle(x,1.22,.22,.115,'cart');
    for(const s of [-1,1])for(let j=0;j<3;j++)box(x,s*.44,.27+j*.019,.57,.06,.013,'metal','leaf-spring',.003);
    if(wheels.length!==before+2)throw Error('Cart axle topology');
  }
  tube([cartFront-.48,0,.34],[cartFront-.48,0,.44],.27,'metal','steering-turntable',64);
  // A-frame connects to the front turntable, with the eye captured by the pin.
  const hitchX=rear-.14;
  for(const y of [-.35,.35])tube([cartFront-.48,y,.38],[hitchX+.07,0,.4],.035,'metal','cart-drawbar',24);
  eye(hitchX,.4);tube([cartFront-.06,-.19,.43],[cartFront-.06,.19,.43],.022,'metal','drawbar-lift-handle');
  tube([cartFront-.48,0,.35],[cartFront-.74,0,.29],.023,'metal','parking-brake-link');
  hitch(cartRear-.045,.38,-1,'cart-rear');
  for(const x of [cartRear,cartFront]){
    box(x,0,deck,.055,cartWidth,1.22,'body','cart-end-wall',.015);
    for(const y of [-cartWidth/2,cartWidth/2])tube([x,y,deck],[x,y,1.86],.026,'metal','cart-corner-post');
    box(x,0,1.17,.065,cartWidth*.88,.055,'metal','end-wall-stiffener');
  }
  // Shallow pitched roof and eaves/drip rails, rather than a flat floating lid.
  for(const s of [-1,1]){
    add([[cartRear-.045,0,1.94],[cartFront+.045,0,1.94],[cartFront+.045,s*.82,1.84],[cartRear-.045,s*.82,1.84]],'body','cart-pitched-roof');
    tube([cartRear-.05,s*.82,1.825],[cartFront+.05,s*.82,1.825],.022,'metal','roof-drip-rail');
    box(cx,s*.8,.6,3.1,.055,.12,'rubber','cart-rub-rail');
    // One side is open for loading. Its curtain is rolled tightly below the
    // roof; the opposite curtain is closed and has vertical reinforced seams.
    if(s>0){tube([cartRear+.055,s*.782,1.75],[cartFront-.055,s*.782,1.75],.075,'glass','rolled-curtain',48)}
    else{
      for(let i=0;i<64;i++){
        const a=cartRear+.06+(2.928*i/64),b=cartRear+.06+(2.928*(i+1)/64),ya=s*.783+Math.sin(i*.6)*.008,yb=s*.783+Math.sin((i+1)*.6)*.008;
        add([[a,ya,.69],[b,yb,.69],[b,yb,1.78],[a,ya,1.78]],'glass','closed-curtain');
      }
      for(let i=1;i<6;i++)tube([cartRear+i*.5,-.797,.71],[cartRear+i*.5,-.797,1.77],.01,'glint','curtain-seam',12);
    }
    for(const x of [cartRear,cartFront]){box(x,s*.79,1.72,.19,.13,.17,'rubber','cart-corner-bumper');tube([cartFront+.055,s*.5,.92],[cartFront+.055,s*.5,1.16],.019,'metal','cart-grab-handle')}
  }
  for(let i=0;i<5;i++){
    const x=cartRear+.35+i*.53,y=(i%2?-.2:.2),z=.57,h=.42+(i%3)*.12;
    box(x,y,z,.44,.52,h,i%2?'cargo':'under','suitcase',.045);
    for(const dy of [-.19,.19])tube([x-.2,y+dy,z+.04],[x-.2,y+dy,z+.09],.027,'rubber','suitcase-wheel',16);
    tube([x-.095,y,z+h+.025],[x+.095,y,z+h+.025],.018,'rubber','suitcase-handle',16);
    box(x,y+.265,z+.06,.018,.009,h-.1,'metal','suitcase-zip',.002);
  }
  return {reference:'TLD JST / Wilcox 5 x 10 ft cart',wheels,hitches,tractor:{length:2.985,width:1.44,wheelbase:1.6},cart:{floorLength:3.048,floorWidth:1.524,steering:'fifth-wheel',axles:2}};
}
