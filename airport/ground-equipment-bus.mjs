// Original apron-bus mesh, informed by the COBUS 3000's wide, low-floor body
// and three double doors on each side. Detail dimensions are authored estimates.
const TAU=Math.PI*2;
export function buildApronBus({add,box,tube,torus}){
  const wheels=[],doors=[],axles=[-3.7,3.4],length=13.9,width=3;
  box(0,0,.31,13.6,2.05,.18,'under','chassis');
  box(0,0,.5,13.65,2.05,.12,'panel','low-floor');
  for(const [a,b]of [[-6.825,-4.31],[-3.09,2.79],[4.01,6.825]])for(const s of [-1,1])box((a+b)/2,s*1.23,.5,b-a,.45,.12,'panel','low-floor');
  function wheel(x,y){
    const r=.49,w=.3,sign=Math.sign(y),segments=96;
    const profile=[[-.5,.58],[-.52,.72],[-.49,.87],[-.42,.96],[-.3,1],[-.15,1],[0,1],[.15,1],[.3,1],[.42,.96],[.49,.87],[.52,.72],[.5,.58]];
    const point=(a,j)=>[x+r*profile[j][1]*Math.cos(a),y+w*profile[j][0],r+r*profile[j][1]*Math.sin(a)];
    const normal=(a,j)=>{const p=profile[Math.max(0,j-1)],q=profile[Math.min(profile.length-1,j+1)],dy=(q[0]-p[0])*w,dr=(q[1]-p[1])*r,d=Math.hypot(dy,dr);return [Math.cos(a)*dy/d,-dr/d,Math.sin(a)*dy/d]};
    for(let i=0;i<segments;i++)for(let j=0;j<profile.length-1;j++){const a=i*TAU/segments,b=(i+1)*TAU/segments;add([point(a,j),point(b,j),point(b,j+1),point(a,j+1)],'rubber','wheel',[normal(a,j),normal(b,j),normal(b,j+1),normal(a,j+1)])}
    const outer=y+sign*.151;
    tube([x,y-.145,r],[x,y+.145,r],.29,'metal','rim',64);
    tube([x,outer-sign*.015,r],[x,outer+sign*.009,r],.247,'intake','rim-dish',64);
    torus(x,outer,r,.266,.019,'rim','rim-lip','y',96,16);
    tube([x,outer,r],[x,outer+sign*.05,r],.135,'metal','hub',64);
    for(let i=0;i<10;i++){const a=i*TAU/10,xx=x+Math.cos(a)*.184,zz=r+Math.sin(a)*.184;tube([xx,outer,zz],[xx,outer+sign*.037,zz],.019,'rim','wheel-bolts',16)}
    for(let i=0;i<12;i++){const a=i*TAU/12,xx=x+Math.cos(a)*.225,zz=r+Math.sin(a)*.225;tube([xx,outer,zz],[xx,outer+sign*.012,zz],.023,'rubber','rim-vent',16)}
    for(let i=0;i<80;i++)for(const lane of [-1,0,1]){const a=(i+lane*.18)*TAU/80,b=a+.021,yy=y+lane*.075;add([[x+r*Math.cos(a),yy-.02,r+r*Math.sin(a)],[x+r*Math.cos(b),yy-.02,r+r*Math.sin(b)],[x+r*Math.cos(b),yy+.02,r+r*Math.sin(b)],[x+r*Math.cos(a),yy+.02,r+r*Math.sin(a)]],'intake','tread')}
    wheels.push({x,y,radius:r,width:w});
  }
  for(const x of axles){tube([x,-1.28,.49],[x,1.28,.49],.085,'metal','axle',32);for(const s of [-1,1])wheel(x,s*1.3)}
  // Individual skirt sections and curved wheel openings: no solid slab through tyres.
  for(const s of [-1,1]){
    const y=s*1.485;
    for(const [a,b]of [[-6.87,-4.31],[-3.09,2.79],[4.01,6.87]])box((a+b)/2,y,.45,b-a,.03,.72,'body','skirt',.014);
    for(const x of axles)for(let i=0;i<48;i++){
      const a=i*Math.PI/48,b=(i+1)*Math.PI/48;
      add([[x+.59*Math.cos(a),y,.49+.59*Math.sin(a)],[x+.59*Math.cos(b),y,.49+.59*Math.sin(b)],[x+.59*Math.cos(b),y,1.18],[x+.59*Math.cos(a),y,1.18]],'body','wheel-arch-panel');
      add([[x+.59*Math.cos(a),y+s*.015,.49+.59*Math.sin(a)],[x+.59*Math.cos(b),y+s*.015,.49+.59*Math.sin(b)],[x+.625*Math.cos(b),y+s*.015,.49+.625*Math.sin(b)],[x+.625*Math.cos(a),y+s*.015,.49+.625*Math.sin(a)]],'rubber','wheel-arch-trim');
    }
    box(0,y,1.17,13.72,.034,.17,'stripe','waist-rail',.012);
    box(0,y,2.74,13.72,.045,.18,'body','cantrail',.022);
    // Door positions leave both axles clear. Six paired full-height glazed doors.
    for(const x of [-5.3,-.3,5.1]){
      doors.push({x,y,side:s,width:1.45,sill:.55});
      box(x,y+s*.025,.55,1.49,.04,2.16,'rubber','door-seal',.015);
      for(const dx of [-.367,.367]){
        box(x+dx,y+s*.049,.61,.68,.027,2.03,'glass','passenger-door',.014);
        box(x+dx,y+s*.067,.67,.64,.015,.36,'body','door-kickplate',.008);
        box(x+dx,y+s*.068,1.59,.64,.015,.055,'metal','door-crossbar',.006);
      }
      box(x,y+s*.07,.59,.035,.027,2.06,'metal','door-centre-seal',.005);
      box(x,y+s*.09,.535,1.5,.18,.045,'stripe','threshold',.008);
      tube([x+.83,y+s*.04,1.25],[x+.83,y+s*.073,1.25],.043,'stripe','door-button',24);
    }
    for(const [a,b]of [[-6.78,-6.11],[-4.49,-2.52],[-2.43,-1.12],[.52,2.22],[2.31,4.29],[5.92,6.65]]){
      box((a+b)/2,y,1.36,b-a,.043,1.35,'rubber','window-seal',.025);
      box((a+b)/2,y+s*.026,1.41,b-a-.085,.025,1.245,'glass','side-window',.018);
      box((a+b)/2,y+s*.046,2.39,b-a-.06,.013,.025,'metal','window-vent-divider',.004);
      box(a+.08,y+s*.048,1.57,.023,.012,.62,'glint','window-reflection',.002);
    }
    for(const x of [-6.4,-2.45,1.7,6.25]){
      box(x,y+s*.02,.71,.47,.018,.22,'panel','service-hatch',.012);
      box(x+.14,y+s*.034,.81,.07,.018,.022,'metal','hatch-latch',.004);
    }
    for(let x=-6.5;x<=6.5;x+=1.3)box(x,y+s*.035,1.19,.13,.019,.04,'stripe','side-marker',.006);
    for(let i=0;i<15;i++)box(-6.5+i*.043,y+s*.027,1.45,.018,.023,.53,'intake','rear-louvre',.002);
  }
  // Rounded roof shoulders are genuinely curved surfaces with smooth normals.
  box(0,0,2.88,13.62,2.68,.12,'body','roof',.045);
  for(const s of [-1,1])for(let i=0;i<32;i++){
    const a=i*Math.PI/64,b=(i+1)*Math.PI/64,pt=(x,t)=>[x,s*(1.32+.18*Math.cos(t)),2.82+.18*Math.sin(t)],n=t=>[0,s*Math.cos(t),Math.sin(t)];
    add([pt(-6.81,a),pt(6.81,a),pt(6.81,b),pt(-6.81,b)],'body','roof-shoulder',[n(a),n(a),n(b),n(b)]);
  }
  for(const x of [-2.1,2]){box(x,0,3.0,1.16,.93,.07,'rubber','roof-hatch-seal');box(x,0,3.055,1.05,.84,.07,'panel','roof-hatch')}
  box(-4.8,0,3.0,2.55,1.85,.25,'body','air-conditioning',.1);
  for(const x of [-5.4,-4.3]){
    tube([x,0,3.24],[x,0,3.27],.38,'intake','fan-inset',64);
    for(let i=0;i<6;i++){const a=i*TAU/6;add([[x,0,3.275],[x+.3*Math.cos(a),.3*Math.sin(a),3.275],[x+.32*Math.cos(a+.5),.32*Math.sin(a+.5),3.275]],'metal','fan-blade')}
    for(let i=-5;i<=5;i++){const y=i*.06,half=Math.sqrt(.36*.36-y*y);tube([x-half,y,3.29],[x+half,y,3.29],.008,'rim','fan-guard',12)}
  }
  // Front/rear fascias, panoramic screen, destination panel and paired lamps.
  for(const s of [-1,1]){
    const x=s*6.9;
    box(x,0,.45,.1,2.88,.75,'body','fascia',.035);
    box(x+s*.017,0,.41,.11,2.93,.13,'rubber','bumper',.025);
    box(x,0,1.2,.09,2.88,1.57,'rubber',s>0?'windscreen-seal':'rear-screen-seal',.03);
    box(x+s*.055,0,1.32,.018,2.69,1.21,'glass',s>0?'windscreen':'rear-window',.007);
    box(x+s*.07,0,2.55,.022,1.57,.17,'intake','destination-display',.005);
    // Geometric amber destination bars remain crisp at fleet-inspection zoom.
    for(let i=0;i<13;i++)box(x+s*.085,-.6+i*.1,2.6,.015,.052,.06,'stripe','display-pixels',.002);
    box(x,0,2.78,.11,2.84,.18,'body','header',.025);
    box(x+s*.071,0,.61,.018,.37,.09,'intake','number-plate',.005);
    for(const y of [-1.07,1.07]){
      box(x+s*.06,y,.76,.04,.39,.22,'rubber','lamp-housing',.025);
      for(const dy of [-.095,.095])tube([x+s*.07,y+dy,.87],[x+s*.1,y+dy,.87],.068,s>0?'glint':'stripe','lamp',48);
    }
    for(let i=0;i<18;i++)box(x+s*.06,-.59+i*.07,1.08,.016,.035,.08,'intake','fascia-grille',.003);
  }
  box(6.969,0,1.32,.013,.035,1.2,'metal','windscreen-divider',.004);
  for(const s of [-1,1]){
    tube([6.985,s*.83,1.36],[7.0,s*.39,1.91],.017,'rubber','wiper-arm',24);
    tube([7.01,s*.57,1.67],[7.01,s*.16,2.11],.022,'rubber','wiper-blade',24);
    tube([6.47,s*1.46,2.67],[6.67,s*1.7,2.7],.032,'metal','mirror-arm',24);
    tube([6.67,s*1.7,2.7],[6.67,s*1.7,2.29],.027,'metal','mirror-arm',24);
    box(6.68,s*1.7,2.12,.16,.14,.42,'rubber','mirror-housing',.05);
    box(6.59,s*1.7,2.155,.018,.114,.34,'glint','mirror-glass',.008);
  }
  return {length,width,capacity:110,axles,wheels,doors,role:'passenger-shuttle'};
}
