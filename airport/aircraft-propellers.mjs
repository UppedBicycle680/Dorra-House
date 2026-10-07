const TAU=Math.PI*2;
// Shared blade mesh for Canvas fallback and the depth-buffer renderer.
export function propellerFaces(prop,time=0,reducedMotion=false){
  const faces=[],angle=reducedMotion?.32:time*.021+prop.index*.8;
  for(let i=0;i<prop.blades;i++){
    const a=angle+TAU*i/prop.blades,r=prop.radius;
    const point=(radius,offset)=>[prop.x,prop.y+Math.cos(a+offset)*radius,prop.z+Math.sin(a+offset)*radius];
    const points=[point(r*.11,-.4),point(r*.72,-.085),point(r,.005),point(r*.96,.09),point(r*.20,.21)];
    faces.push({points,material:'rubber',part:'propeller',normal:[1,0,0],shade:1});
    faces.push({points:[point(r*.83,-.055),point(r,.005),point(r*.96,.09),point(r*.82,.10)],material:'body',part:'propeller-tip',normal:[1,0,0],shade:1});
  }
  return faces;
}
