import {redcliffeGroundPoint} from './redcliffe-ground.mjs';

// Individual visible roof sections, traced in the preserved 2000 x 1450
// City of Moreton Bay / Esri aerial dated 10 June 2024. IDs are modelling
// keys, not cadastral hangar numbers. Heights and obscured door divisions
// are conservative interpretations; roof extents, offsets and details are
// aerial observations. Attached annexes are distinguished from hangars.
export const REDCLIFFE_HANGAR_SOURCE={date:'2024-06-10',frame:'REDCLIFFE_GROUND_FRAME',
  imagery:'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
  heliflite:'https://heliflite.com.au/contact-heliflite/',
  accuracy:'Manual aerial trace; not a measured elevation or facade survey.'};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const uv=(q,u,v)=>mix(mix(q[0],q[1],u),mix(q[3],q[2],u),v);
const sections=[];
function add(group,id,pixels,profile={}){
  sections.push({id:group+'-'+id,group,pixels,polygon:pixels.map(redcliffeGroundPoint),
    kind:'hangar',axis:'u',height:2,rise:.45,roof:['#d6dcd3','#aebdb7'],
    doors:[3],features:[],...profile});
}
function row(group,q,axis,cuts,profiles){
  cuts.slice(1).forEach((b,i)=>{
    const a=cuts[i],pixels=axis==='v'?[uv(q,0,a),uv(q,1,a),uv(q,1,b),uv(q,0,b)]:[uv(q,a,0),uv(q,b,0),uv(q,b,1),uv(q,a,1)];
    add(group,String(i+1).padStart(2,'0'),pixels,{axis:axis==='v'?'u':'v',...profiles[i]});
  });
}
// Features occupy local roof coordinates and are projected onto each slope.
const strip=(u,v,w,h,kind='skylight')=>({kind,u,v,w,h});
const lights=(us,v=.13,h=.72)=>us.map(u=>strip(u,v,.025,h));
const vent=(u=.5,v=.5)=>strip(u-.025,v-.025,.05,.05,'vent');
const solar=(u,v,w,h)=>strip(u,v,w,h,'solar');
row('runway-side-west',[[173,737],[340,698],[349,746],[183,786]],'u',[0,.33,.67,1],[
  {doors:[2],features:[vent(.5,.35),vent(.5,.77)]},
  {doors:[2],features:[vent(.5,.35),vent(.5,.77)]},
  {doors:[2],roof:['#d8ded5','#bec8c0']}]);
row('runway-side-middle',[[349,695],[545,649],[556,697],[360,742]],'u',[0,.5,.75,1],[
  {doors:[2],rise:.3,features:[solar(.04,.61,.34,.12),solar(.04,.79,.39,.12)]},
  {doors:[2],roof:['#e0e2d6','#c3ccc1']},
  {doors:[2],features:[strip(.07,.1,.86,.06,'patch'),strip(.07,.63,.86,.04,'patch')]}]);
row('runway-side-east',[[554,645],[728,605],[739,653],[565,694]],'u',[0,.33,.68,1],[
  {doors:[2],roof:['#e1e4da','#bdc9c1']},
  {doors:[2],roof:['#bdc9c6','#a6b8b4']},
  {doors:[2],roof:['#d5ddd5','#b6c6bf']}]);
row('western-long-row',[[227,869],[329,844],[391,1107],[283,1132]],'v',[0,.2,.4,.6,.8,1],[
  {doors:[1,3],features:[vent(.35,.17),vent(.35,.5),vent(.35,.67),vent(.69,.3),vent(.69,.67)]},
  {doors:[1,3],roof:['#dce0d5','#acbbb5'],features:[...lights([.76],.54,.41),vent(.25)]},
  {doors:[1,3],features:[...lights([.77],.06,.85),vent(.53,.48),vent(.53,.69)]},
  {doors:[1,3],roof:['#cfd8cf','#bac7bd'],features:lights([.6],.06,.86)},
  {doors:[1,3],features:[vent(.32,.29),vent(.32,.76),...lights([.52],.04,.88),solar(.78,.24,.2,.045)]}]);
add('middle-long-row','north',[[425,828],[528,799],[537,851],[438,879]],{doors:[1,3],features:[vent(.91)]});
row('middle-long-row',[[440,884],[475,874],[522,1079],[482,1090]],'v',[0,.26,.51,.76,1],[
  {height:1.65,doors:[3],features:[strip(.74,.54,.08,.4,'blue')]}, {height:1.65,doors:[3],roof:['#c4d1c6','#a8bbb1']},
  {height:1.65,doors:[3]}, {height:1.65,doors:[3],features:[solar(.14,.29,.57,.09)]}]);
add('middle-long-row','east-middle',[[477,868],[538,852],[564,954],[499,970]],{doors:[1],features:[solar(.18,.68,.58,.045),solar(.18,.8,.58,.045)]});
add('middle-long-row','east-south-1',[[511,970],[566,960],[577.5,1010.5],[521.5,1022]],{doors:[1],roof:['#c6d3c8','#a6bab1'],features:[vent(.08,.15),vent(.08,.55),vent(.08,.82),vent(.38,.48)]});
add('middle-long-row','east-south-2',[[521.5,1022],[577.5,1010.5],[589,1061],[532,1074]],{doors:[1],features:[vent(.12)]});
add('eastern-long-row','north',[[637,775],[739,749],[750,805],[647,823]],{doors:[1,3],features:[vent(.92)]});
row('eastern-long-row',[[647,827],[751,809],[776,904],[670,929]],'v',[0,.5,1],[
  {doors:[1,3],features:[...lights([.28,.63],.02,.93),vent(.45,.2),vent(.45,.4),vent(.45,.65),vent(.45,.85)]},
  {doors:[1,3],features:[...lights([.19,.43,.55,.68],.02,.93),vent(.27),vent(.41),vent(.6),vent(.78),vent(.88)]}]);
add('eastern-long-row','canopy',[[670,929],[776,905],[779,922],[674,946]],{kind:'canopy',height:1.45,rise:0,doors:[],roof:['#c5d0c6','#c5d0c6']});
add('eastern-long-row','south',[[679,954],[779,930],[793,1009],[694,1035]],{doors:[1,3],features:[vent(.08,.13),vent(.23,.13),vent(.14,.48),vent(.84,.48),strip(.08,.29,.88,.025,'rust'),...lights([.07,.15],.55,.38)],roof:['#d7d9ca','#b4bfae']});
add('western-detached','main',[[102,1074],[153,1062],[173,1142],[121,1154]],{axis:'v',doors:[1],rise:.18,height:1.55,roof:['#d3dfd8','#c3d2cb']});
add('central-north','main',[[886,787],[954,771],[971,844],[902,860]],{doors:[2],features:[{kind:'circle',u:.44,v:.26,w:.24,h:.27}],roof:['#bbc8bd','#aabbb0']});
add('central-north','north-extension',[[893,766],[949,753],[954,771],[900,783]],{kind:'annex',doors:[0],height:1.85,rise:.08});
add('central-north','west-1',[[853,792],[885,785],[891,818],[860,825]],{height:1.5,doors:[3],rise:.2});
add('central-north','west-2',[[860,825],[891,818],[898,851],[866,858]],{height:1.5,doors:[3],rise:.2});
add('central-south','main',[[878,894],[976,872],[994,947],[892,970]],{doors:[3],features:[...lights([.1,.3,.53,.8],.15,.23),...lights([.1,.3,.53,.8],.61,.24),vent(.16),vent(.34),vent(.55),vent(.73),vent(.88)]});
add('central-south','south-awning',[[892,970],[994,947],[996,961],[896,985]],{kind:'canopy',height:1.75,rise:0,doors:[],roof:['#608b99','#608b99'],features:[strip(0,.68,1,.25,'skylight')]});
add('central-narrow','north',[[1063,814],[1123,802],[1135,863],[1078,876]],{doors:[3],features:[vent(.88)]});
add('central-narrow','south',[[1078,876],[1135,863],[1149,925],[1092,938]],{doors:[3],features:lights([.12,.44,.76],.02,.94)});
add('helicopter-maintenance','main',[[1158,706],[1279,677],[1299,767],[1179,797]],{doors:[0],height:2.5,rise:.35,
  roof:['#e5e7dc','#cbd7cf'],features:[solar(.04,.08,.18,.37),solar(.39,.075,.57,.065),
    {kind:'lettering',text:'HELIFLITE',u:.26,v:.17,w:.7,h:.23,reverse:true},
    ...lights([.35,.39,.43,.56,.6,.64],.58,.09),strip(.13,.85,.84,.055,'blue'),vent(.34,.08)]});
add('helicopter-south','main',[[1199,815],[1305,789],[1318,849],[1215,872]],{doors:[1],features:[solar(.02,.06,.78,.3),vent(.4),strip(.44,.93,.53,.05,'rust')]});
add('helicopter-south','south',[[1215,872],[1318,849],[1326,883],[1224,907]],{doors:[1],features:[vent(.33),vent(.36,.87)]});
add('helicopter-south','west-annex',[[1179,826],[1199,822],[1211,884],[1192,889]],{kind:'annex',doors:[3],axis:'v',height:1.45,rise:.16,features:lights([.2,.64])});
row('east-long-west',[[1363,655],[1438,638],[1483,838],[1407,856]],'v',[0,.25,.5,.75,1],[
  {doors:[1,3],features:[...[.08,.25,.43,.6,.8].map(u=>strip(u,.02,.025,.94,'smoked')),vent(.9,.22)]},
  {doors:[1,3],roof:['#dce2d6','#83a8b0'],features:lights([.1,.29,.48,.67,.86],.52,.43)},
  {doors:[1,3],features:[vent(.45)]},
  {doors:[1,3],roof:['#e3e7dc','#c7d3ca'],features:[vent(.18),vent(.58),vent(.8)]}]);
row('east-long-east',[[1508,620],[1588,601],[1636,810],[1556,828]],'v',[0,.25,.5,.75,1],[
  {doors:[3],features:[...lights([.12,.37,.64,.89]),vent(.65)]},
  {doors:[3],features:lights([.12,.37,.64,.89])},
  {doors:[3],features:lights([.12,.37,.64,.89])},
  {doors:[3],features:lights([.12,.37,.64,.89])}]);
row('club-west',[[1675,646],[1756,628],[1775,720],[1695,739]],'v',[0,.5,1],[
  {doors:[3],features:[.15,.4,.64,.88].map(u=>strip(u,.05,.025,.9,'patch'))},
  {doors:[3],features:[.15,.4,.64,.88].map(u=>strip(u,.05,.025,.9,'patch'))}]);
export const REDCLIFFE_HANGAR_SECTIONS=sections;

const glyphs={H:['101','101','111','101','101'],E:['111','100','110','100','111'],L:['100','100','100','100','111'],I:['111','010','010','010','111'],F:['111','100','110','100','100'],T:['111','010','010','010','010']};
export function drawRedcliffeHangars({poly,line,defer,scale}){
  for(const h of sections){
    const q=h.polygon,c=uv(q,.5,.5),z=h.height;
    const height=(u,v)=>z+h.rise*(1-Math.abs((h.axis==='u'?v:u)*2-1));
    const vertex=(u,v,extra=0)=>[...uv(q,u,v),height(u,v)+extra];
    // Shadows belong to the ground pass, before any deferred roof is drawn.
    // Painting them inside each building callback could overpaint its neighbour.
    poly(q.map(([x,y])=>[x+.45,y+.6]),'#38554628');
    defer(...c,()=>{
      // Draw far faces first; only exterior access faces receive door panels.
      const edges=q.map((a,i)=>({a,b:q[(i+1)%4],i})).sort((a,b)=>a.a[0]+a.a[1]+a.b[0]+a.b[1]-b.a[0]-b.a[1]-b.b[0]-b.b[1]);
      for(const {a,b,i} of edges){
        if(h.kind==='canopy'){
          for(const p of [a,b])line([[...p,0],[...p,z]],'#8b9c8b',Math.max(.5,scale*.06));
        }else{
          poly([[...a,0],[...b,0],[...b,z],[...a,z]],i%2?'#a2b8ab':'#bfcbbd');
          if(h.doors.includes(i)){
            const u=mix(a,b,.08),v=mix(a,b,.92);
            poly([[...u,.08],[...v,.08],[...v,z*.87],[...u,z*.87]],'#8da69b');
            for(const t of [.25,.5,.75]){const p=mix(u,v,t);line([[...p,.1],[...p,z*.85]],'#748f824c',Math.max(.35,scale*.035))}
          }
        }
      }
      const r=h.axis==='u'?[[0,.5],[1,.5]]:[[.5,0],[.5,1]],end=h.axis==='u'?[[0,3],[1,2]]:[[0,1],[3,2]];
      end.forEach(([a,b],i)=>poly([[...q[a],z],[...q[b],z],vertex(...r[i])],'#b6c6b9'));
      const slopes=h.axis==='u'?[[[0,0],[1,0],[1,.5],[0,.5]],[[0,.5],[1,.5],[1,1],[0,1]]]:[[[0,0],[.5,0],[.5,1],[0,1]],[[.5,0],[1,0],[1,1],[.5,1]]];
      slopes.forEach((face,i)=>poly(face.map(v=>vertex(...v)),h.roof[i]));
      // Split details at the ridge so they cannot bridge through the roof.
      const patch=(u,v,w,d,colour)=>{
        const us=h.axis==='v'&&u<.5&&u+w>.5?[u,.5,u+w]:[u,u+w],vs=h.axis==='u'&&v<.5&&v+d>.5?[v,.5,v+d]:[v,v+d];
        for(let i=1;i<us.length;i++)for(let j=1;j<vs.length;j++)poly([[us[i-1],vs[j-1]],[us[i],vs[j-1]],[us[i],vs[j]],[us[i-1],vs[j]]].map(p=>vertex(...p,.012)),colour);
      };
      for(const f of h.features){
        if(f.kind==='lettering'){
          const cell=f.w/(f.text.length*4-1),dy=f.h/5;
          [...f.text].forEach((char,k)=>glyphs[char].forEach((row,j)=>[...row].forEach((bit,i)=>{if(bit==='1'){const x=k*4+i,y=j;patch(f.reverse?f.u+f.w-(x+1)*cell:f.u+x*cell,f.reverse?f.v+f.h-(y+1)*dy:f.v+y*dy,cell*.94,dy*.94,'#405951')}})));
        }else if(f.kind==='circle'){
          const points=Array.from({length:24},(_,i)=>{const a=i/24*Math.PI*2;return vertex(f.u+Math.cos(a)*f.w/2,f.v+Math.sin(a)*f.h/2,.015)});poly(points,'#83bab9');
        }else{
          patch(f.u,f.v,f.w,f.h,{solar:'#486772',skylight:'#dde3d4',smoked:'#829c96',vent:'#6d8780',patch:'#a5b7a9',blue:'#658e9b',rust:'#b2957f'}[f.kind]);
          if(f.kind==='solar')for(let t=.1;t<1;t+=.15){const u=f.u+f.w*t;line([vertex(u,f.v,.02),vertex(u,f.v+f.h,.02)],'#a0b7b540',Math.max(.3,scale*.025))}
        }
      }
      line(r.map(v=>vertex(...v,.02)),'#e4e8dc',Math.max(.35,scale*.035));
    });
  }
}
