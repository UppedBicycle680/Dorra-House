import {HAMILTON_NEIGHBOURHOOD_FEATURES} from './hamilton-neighbourhood-data.mjs';
import {HAMILTON_ISLAND_FEATURES} from './hamilton-island-data.mjs';
import {HAMILTON_SCALE,hamiltonRect,hamiltonGeoPoint} from './hamilton-reference.mjs';
export {hamiltonGeoPoint} from './hamilton-reference.mjs';
// Geographic registration uses published stand 1 as the fixed anchor, retaining
// the same metre scale and runway-aligned coordinate system as the airfield.
export const HAMILTON_NEIGHBOURHOOD=[...HAMILTON_NEIGHBOURHOOD_FEATURES,...HAMILTON_ISLAND_FEATURES].map(f=>{
  const points=f.points.map(hamiltonGeoPoint);
  return {...f,points,holes:f.holes?.map(r=>r.map(hamiltonGeoPoint)),rect:hamiltonRect(points)};
});

// Photo-informed villa hillside; elevation is an artistic approximation. Fade
// into the mapped shore so the marina and waterfront promenade remain at sea level.
export function createHamiltonVillaElevation(layout){
  const edges=layout.land.flatMap(p=>p.slice(1).map((b,i)=>[p[i],b]));
  return (x,y)=>{
    const r=((x+120)/67)**2+((y+53)/64)**2;
    if(r>=1)return 0;
    let shore=8;
    for(const [a,b] of edges){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));shore=Math.min(shore,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy))}
    return 8*(1-r)**1.4*Math.min(1,shore/8);
  };
}

export function drawHamiltonNeighbourhood(layout,{poly,line,disc,defer,hash,elevation,landContains}){
  const features=layout.neighbourhood;
  const at=(p,z=0)=>[p[0],p[1],elevation(...p)+z];
  const centre=f=>[f.rect.x+f.rect.w/2,f.rect.y+f.rect.h/2];
  const boats=[];
  // This shallow, continuous hillside is a ground layer. Paint it before roads
  // and building objects so a triangle cannot erase a whole path or villa face.
  for(let x=-187;!layout.fullIslandTerrain&&x<-53;x+=4)for(let y=-117;y<11;y+=4){
    const p=[[x,y],[x+4,y],[x+4,y+4],[x,y+4]];
    if(!p.every(v=>landContains(...v))||p.every(v=>elevation(...v)<.01))continue;
    for(const triangle of [[p[0],p[1],p[2]],[p[0],p[2],p[3]]]){
      poly(triangle.map(v=>at(v)),hash(x+y)>.5?'#85a569':'#89a96d');
    }
  }
  const paintPath=(points,width,colour,z=0)=>{
    const split=[points[0]];
    for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3);for(let n=1;n<=steps;n++)split.push([a[0]+(b[0]-a[0])*n/steps,a[1]+(b[1]-a[1])*n/steps])}
    for(let i=1;i<split.length;i++){
      const a=split[i-1],b=split[i],dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy);if(d<.001)continue;
      const n=[-dy/d*width/2,dx/d*width/2],shape=[[a[0]+n[0],a[1]+n[1]],[b[0]+n[0],b[1]+n[1]],[b[0]-n[0],b[1]-n[1]],[a[0]-n[0],a[1]-n[1]]];
      defer((a[0]+b[0])/2,(a[1]+b[1])/2,()=>poly(shape.map(p=>at(p,z)),colour));
    }
  };
  for(const f of features){
    const [x,y]=centre(f),p=f.points;
    if(f.kind==='road'){paintPath(p,f.width||.9,['path','track','footway','steps'].includes(f.roadType)?'#bbb38e':'#c4c5ad',.12);continue}
    if(f.kind==='pitch'){defer(x,y,()=>{poly(p.map(v=>at(v,.12)),'#839a71','#ddd9b9',.6);line(p.slice(0,2).map(v=>at(v,.15)),'#efead1',.5)});continue}
    if(f.kind==='pier'){
      const closed=p.length>3&&Math.hypot(p[0][0]-p.at(-1)[0],p[0][1]-p.at(-1)[1])<.01;
      if(closed)defer(x,y,()=>poly(p.map(v=>[...v,.18]),'#d9d3b9','#f0e9d1',.4));
      else paintPath(p,.55,'#e5ddc1',.18);
      // Boats are illustrative occupancy, attached to mapped marina piers.
      const edges=p.slice(1).map((b,i)=>({a:p[i],b,d:Math.hypot(b[0]-p[i][0],b[1]-p[i][1])})).sort((a,b)=>b.d-a.d);
      for(const {a,b,d} of edges.slice(0,closed?2:edges.length)){
        for(let t=2;t<d-1;t+=3.4)for(const side of [-1,1]){
          if(hash(f.id+t+side)<.25)continue;
          const ux=(b[0]-a[0])/d,uy=(b[1]-a[1])/d,bx=a[0]+ux*t-uy*2*side,by=a[1]+uy*t+ux*2*side;
          const hull=[[bx-uy*1.5,by+ux*1.5],[bx+ux*.5-uy*.6,by+uy*.5+ux*.6],[bx+ux*.5+uy*1.4,by+uy*.5-ux*1.4],[bx-ux*.5+uy*1.4,by-uy*.5-ux*1.4],[bx-ux*.5-uy*.6,by-uy*.5+ux*.6]];
          if(hull.some(v=>landContains(...v))||boats.some(v=>Math.hypot(v[0]-bx,v[1]-by)<2.8))continue;
          boats.push([bx,by]);
          defer(bx,by,()=>{poly(hull.map(v=>[...v,.25]),'#faf4df','#789fa2',.4);line([[bx+uy*.7,by-ux*.7,.3],[bx-uy*.4,by+ux*.4,.3]],'#718d99',1.2);if(hash(f.id+t)>.6)line([[bx,by,.3],[bx,by,2.8]],'#c8d1c3',.5)});
        }
      }continue;
    }
    if(f.kind==='pool'){
      const z=elevation(x,y);
      poly(p.map(v=>[...v,z+.12]),'#dedaca','#e5e1c9',2);poly(p.map(v=>[...v,z+.14]),'#64bcbf');
      for(const hole of f.holes||[])poly(hole.map(v=>[...v,z+.16]),'#b9bf9c','#e5e1c9',.6);
      line(p.slice(0,3).map(v=>[...v,z+.17]),'#c9eeee',.7);continue;
    }
    const base=Math.max(elevation(x,y),...p.map(v=>elevation(...v))),villa=f.precinct==='yacht-club-villas',club=f.id===261802784;
    const height=Math.min(24,f.levels)*2.9*HAMILTON_SCALE,roof=base+height;
    defer(x,y,()=>{
      for(let i=0;i<p.length-1;i++){
        const a=p[i],b=p[i+1],dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy);
        poly([at(a),at(b),[...b,roof],[...a,roof]],villa?'#a49b80':dx>dy?'#e7e1cc':'#b9c9b7');
        if(d<1.1)continue;
        for(let floor=0;floor<f.levels;floor++){
          const z=base+(floor+.2)*2.9*HAMILTON_SCALE,top=z+1.8*HAMILTON_SCALE;
          for(let n=.3;n<d-.3;n+=1){const end=Math.min(n+.65,d-.15),point=(v,h)=>[a[0]+dx*v/d,a[1]+dy*v/d,h];poly([point(n,z),point(end,z),point(end,top),point(n,top)],villa?'#826c57':'#729797')}
          if(villa){const z=base+(floor+1)*2.9*HAMILTON_SCALE;line([[...a,z-.18],[...b,z-.18]],'#e4dfca',.8);line([[...a,z-.5],[...b,z-.5]],'#b6c8c0',.6)}
        }
      }
      poly(p.map(v=>[...v,roof]),villa?'#4f6254':f.precinct==='island-surroundings'&&f.levels<5?['#859180','#a3aa95','#d4d8c7'][f.id%3]:'#dce0cd');
      // A low folded roof on the club echoes its distinctive sail-like forms.
      if(club){for(let i=0;i<p.length-1;i++){const a=p[i],b=p[i+1];poly([[...a,roof],[...b,roof],[x,y,roof+2.2]],i%2?'#bec7b3':'#e1e4cf')}}
      else if(villa){
        for(let i=0;i<p.length-1;i++)poly([[...p[i],roof],[...p[i+1],roof],[x,y,roof+.5]],i%2?'#596c58':'#697960');
        const edge=p.slice(1).map((b,i)=>({a:p[i],b,d:Math.hypot(b[0]-p[i][0],b[1]-p[i][1])})).sort((a,b)=>b.d-a.d)[0];
        if(edge)line([[...edge.a,roof+.1],[...edge.b,roof+.1]],'#79896d',1.2);
      }
    });
  }
  // Photo-informed gardens: only on land, outside footprints and access roads.
  const buildings=features.filter(f=>f.kind==='building'),obstacles=features.filter(f=>['building','pool'].includes(f.kind));
  const minX=Math.min(...buildings.map(f=>f.rect.x))-12,maxX=Math.max(...buildings.map(f=>f.rect.x+f.rect.w))+12;
  const minY=Math.min(...buildings.map(f=>f.rect.y))-12,maxY=Math.max(...buildings.map(f=>f.rect.y+f.rect.h))+12;
  const roads=features.filter(f=>f.kind==='road').flatMap(f=>f.points.slice(1).map((b,i)=>[f.points[i],b]));
  const nearRect=(x,y,r,m)=>x>r.x-m&&x<r.x+r.w+m&&y>r.y-m&&y<r.y+r.h+m;
  for(let i=0;i<1200;i++){
    const x=minX+hash(i+921)* (maxX-minX),y=minY+hash(i+1801)*(maxY-minY);
    if(!landContains(x,y)||!buildings.some(f=>nearRect(x,y,f.rect,17))||obstacles.some(f=>nearRect(x,y,f.rect,1.1)))continue;
    if(layout.referenceBuildings.some(f=>nearRect(x,y,f.rect,5))||layout.terminals.some(f=>nearRect(x,y,f.rect,8)))continue;
    if(roads.some(([a,b])=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)<1.5}))continue;
    const z=elevation(x,y),h=2.5+hash(i+41)*2,r=1.1+hash(i+99)*.8;
    defer(x,y,()=>{
      line([[x,y,z],[x,y,z+h]],'#8d8462',.65);
      if(i%3===0)for(let n=0;n<7;n++){const a=n*Math.PI*2/7;poly([[x,y,z+h],[x+Math.cos(a)*r*1.5,y+Math.sin(a)*r*1.5,z+h-.65],[x+Math.cos(a+.4)*r,y+Math.sin(a+.4)*r,z+h+.35]],n%2?'#537b4f':'#749153')}
      else for(let n=0;n<3;n++)disc(x+(n-1)*r*.3,y,r*(1-n*.15),['#547b4e','#638b53','#7c9a5b'][n],z+h-r+n*.55);
    });
  }
}
