import {createContext,useContext,useEffect,useState} from 'react';
import {climbFrame,gaitFrame,smooth} from './shared/locomotion.mjs';
import type {CostumePose} from './CostumeMotion';
import type {WindowRelease} from './types';

export type Point=[number,number];
export const MotionPreviewTime=createContext<number|undefined>(undefined);
export function useMotionTime(enabled:boolean,since?:number){
 const preview=useContext(MotionPreviewTime);
 const [time,setTime]=useState(()=>Date.now());
 useEffect(()=>{
  if(!enabled||preview!==undefined)return;
  let frame=0,last=0;
  function draw(now:number){
   if(now-last>=1000/30&&!document.hidden){last=now;setTime(Date.now());}
   frame=requestAnimationFrame(draw);
  }
  frame=requestAnimationFrame(draw);
  return()=>cancelAnimationFrame(frame);
 },[enabled,preview]);
 return preview??(enabled?Math.max(0,time-(since??time)):0);
}

const radians=180/Math.PI;
const angle=(a:Point,b:Point)=>Math.atan2(b[1]-a[1],b[0]-a[0])*radians;
export function rotatePoint(point:Point,pivot:Point,degrees:number):Point{
 const turn=degrees/radians;
 const x=point[0]-pivot[0],y=point[1]-pivot[1];
 return [pivot[0]+x*Math.cos(turn)-y*Math.sin(turn),pivot[1]+x*Math.sin(turn)+y*Math.cos(turn)];
}

export function link(source:Point,sourceEnd:Point,target:Point,targetEnd:Point){
 const length=Math.hypot(sourceEnd[0]-source[0],sourceEnd[1]-source[1]);
 const next=Math.hypot(targetEnd[0]-target[0],targetEnd[1]-target[1]);
 return `translate(${target.join(' ')}) rotate(${angle(target,targetEnd)}) scale(${next/length} 1) rotate(${-angle(source,sourceEnd)}) translate(${-source[0]} ${-source[1]})`;
}

// Solve a connected pair of bones, choosing the bend facing the character.
export function joint(root:Point,wanted:Point,upper:number,lower:number,bend:1|-1){
 const dx=wanted[0]-root[0],dy=wanted[1]-root[1];
 const distance=Math.max(.01,Math.hypot(dx,dy));
 const reach=Math.max(Math.abs(upper-lower)+.01,Math.min(upper+lower-.01,distance));
 const vx=dx/distance,vy=dy/distance;
 const along=(upper**2-lower**2+reach**2)/(2*reach);
 const sideways=Math.sqrt(Math.max(0,upper**2-along**2))*bend;
 return {
  middle:[root[0]+vx*along-vy*sideways,root[1]+vy*along+vx*sideways] as Point,
  end:[root[0]+vx*reach,root[1]+vy*reach] as Point,
 };
}

export function characterMotion(form:'classic'|'human',pose:CostumePose,time:number,speed?:number){
 const gait=pose==='walk'||pose==='run'?gaitFrame(form,pose,time,speed):undefined;
 const grip=pose==='climb'||pose==='pull'?climbFrame(form,pose==='pull'?0:time,speed):undefined;
 const pull=pose==='pull'?smooth(time/650):0;
 return {gait,grip,pull};
}

export function windowGrip(form:'classic'|'human',pose:CostumePose,time:number,speed?:number,release?:WindowRelease){
 const lettingGo=pose==='fall'&&release;
 const [heldPose,heldTime]=lettingGo?[release.from,release.elapsed] as const:[pose,time] as const;
 return {...characterMotion(form,heldPose,heldTime,speed),weight:lettingGo?1-smooth(time/360):1};
}

export const blend=(a:number,b:number,weight:number)=>a+(b-a)*weight;
