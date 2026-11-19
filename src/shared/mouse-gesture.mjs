const TURN_COS=Math.cos(70*Math.PI/180);
export function shakeDetector(){
 let origin,segments=[];
 function reset(){origin=undefined;segments=[];}
 function sample(x,y,time){
  if(!origin){origin={x,y,time};return false;}
  if(time-origin.time>400){reset();origin={x,y,time};return false;}
  const dx=x-origin.x,dy=y-origin.y,distance=Math.hypot(dx,dy);
  if(time-origin.time<50||distance<24)return false;
  origin={x,y,time};
  segments=segments.filter(segment=>time-segment.time<=2000);
  segments.push({dx,dy,distance,time});
  let path=0,turns=0;
  for(let i=0;i<segments.length;i++){
   const next=segments[i],prior=segments[i-1];
   path+=next.distance;
   if(prior&&(prior.dx*next.dx+prior.dy*next.dy)/(prior.distance*next.distance)<=TURN_COS)turns++;
  }
  if(path<450||turns<4)return false;
  reset();
  return true;
 }
 return {reset,sample};
}
