// Visible 07/25 paint in the 10 June 2024 Moreton Bay aerial. The runway has
// four threshold stripes at each end, no continuous edge lines or aiming blocks.
// Font-independent numerals retain their strokes at miniature canvas sizes.
const digits={
  '0':[[[0,0],[1,0],[1,3],[0,3],[0,0]],[[.23,.25],[.23,2.75],[.77,2.75],[.77,.25],[.23,.25]]],
  '2':[[[0,0],[1,0],[1,1.3],[.23,2.05],[.23,2.75],[1,2.75],[1,3],[0,3],[0,1.95],[.77,1.2],[.77,.25],[0,.25]]],
  '5':[[[0,0],[1,0],[1,.25],[.23,.25],[.23,1.2],[1,1.2],[1,3],[0,3],[0,2.75],[.77,2.75],[.77,1.45],[0,1.45]]],
  '7':[[[0,0],[1,0],[1,.3],[.4,3],[.15,3],[.75,.25],[0,.25]]]
};
export function drawRedcliffeRunwayMarkings(r,{poly}){
  const [start,y]=r.start,end=r.end[0],white='#f4f2de';
  const quad=(x0,y0,x1,y1)=>poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]],white);
  for(const [x,d,label] of [[start,1,'25'],[end,-1,'07']]){
    quad(x+d*.1,y-r.width*.48,x+d*.38,y+r.width*.48);
    for(const offset of [-2.1,-.9,.9,2.1])quad(x+d*2.2,y+offset-.22,x+d*12.6,y+offset+.22);
    for(const [i,char] of [...label].entries()){
      const at=([u,v])=>[x+d*(18+1.5-v),y+d*(u+i*1.55-1.275)];
      const rings=digits[char];
      if(char==='0'){
        // Four solid strips leave the centre open without painting over asphalt.
        const a=rings[0],b=rings[1];
        for(const [u,v,k,l] of [[0,1,3,0],[1,2,2,3],[2,3,1,2],[3,0,0,1]])poly([a[u],a[v],b[k],b[l]].map(at),white);
      }else poly(rings[0].map(at),white);
    }
  }
  for(let x=start+26;x<end-25;x+=23.8)quad(x,y-.065,Math.min(x+12,end-25),y+.065);
}

export function drawRedcliffeHold([x,y],width,{line,scale}){
  // Solid pair faces aircraft approaching the runway; broken pair faces runway.
  for(const offset of [0,.22])line([[x-width/2+.08,y+offset],[x+width/2-.08,y+offset]],'#e4c676',Math.max(.45,scale*.07));
  for(const offset of [.55,.77])line([[x-width/2+.08,y+offset],[x+width/2-.08,y+offset]],'#e4c676',Math.max(.45,scale*.07),[scale*.2,scale*.17]);
}

export function drawRedcliffeTaxiwayMarkings(taxiways,{line,scale}){
  const paint=q=>line(q,'#dfc16d',Math.max(.45,scale*.075));
  for(const t of taxiways){
    if(t.id.startsWith('TWY '))continue;
    const q=t.points.map(p=>[...p]);
    if(t.id==='A')q[0][0]+=6;
    if(t.id==='C')q[0][1]=84;
    if(['B','C','D'].includes(t.id)){
      const x=q.at(-1)[0];q.at(-1)[1]=111;paint(q);
      // The photographed centreline divides into two runway entry curves.
      for(const side of [-1,1])paint(Array.from({length:17},(_,i)=>{
        const a=i/16*Math.PI/2;return [x+side*5*(1-Math.cos(a)),111+5*Math.sin(a)];
      }));
    }else paint(q);
  }
  // Rounded joins in the aerial, rather than square centreline T-junctions.
  for(const side of [-1,1]){
    paint(Array.from({length:17},(_,i)=>{const a=i/16*Math.PI/2;return [31-6*Math.sin(a),78+side*6*(1-Math.cos(a))]}));
    paint(Array.from({length:17},(_,i)=>{const a=i/16*Math.PI/2;return [173+side*6*(1-Math.cos(a)),84-6*Math.sin(a)]}));
  }
}
