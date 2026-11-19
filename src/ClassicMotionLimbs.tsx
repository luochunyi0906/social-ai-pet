import {useId} from 'react';
import {windowCrouch,type CostumePose} from './CostumeMotion';
import {blend,joint,rotatePoint,windowGrip,type Point} from './RigMath';
import type {WindowRelease} from './types';

const pixelsPerUnit=274/256*92/240;
const toUnits=(screen:number)=>screen/pixelsPerUnit;
const number=(point:Point)=>point.join(' ');

export function ClassicMotionLimbs({ pose,time,speed,profile,layer,lean,release,raincoat }: {
 pose:CostumePose;time:number;speed?:number;profile:boolean;lean:number;layer:'near'|'far';release?:WindowRelease;raincoat:boolean;
}){
 const key=useId();
 const {gait,grip,pull,weight}=windowGrip('classic',pose,time,speed,release);
 const near=layer==='near';
 const foot=gait?.[near?'left':'right'];
 const hand=grip?.[near?'left':'right'];
 const climbing=Boolean(grip);
 const crouch=windowCrouch(pose,time)*(pose==='fall'&&release?.from==='climb'?.3:1);
 const air=pose==='fall'?Math.sin(Math.PI*Math.min(1,time/720)):0;
 const hip:Point=profile?[near?135:131,190]:[near?113:156,190];
 const arm=rotatePoint(profile?[near?133:126,121]:[near?82:187,120],[128,190],lean);
 const ankle:Point=[
  hip[0]-toUnits(foot?.x??0)+(climbing?-22*weight:0)+crouch*(near?-5:5),
  228-18*crouch+toUnits((foot?.y??0)-(gait?.body??0))-(hand?.reach??0)*2.4*weight,
 ];
 const gripX=near?54:60;
 const gripY=raincoat?115:94;
 const relaxed:Point=[arm[0]+(profile?toUnits(foot?.x??0)*.7:(near?-1:1)*(12+9*air)),arm[1]+49-18*air];
 const wrist:Point=hand?[
  blend(relaxed[0],gripX+hand.reach*1.5+35*pull,weight),
  blend(relaxed[1],gripY+toUnits(hand.y)+12*pull,weight),
 ]:relaxed;
 const leg=joint(hip,ankle,24,25,profile?1:near?1:-1);
 const upper=joint(arm,wrist,45,49,profile?-1:near?-1:1);
 const [ax,ay]=leg.end;
 const [wx,wy]=upper.end;
 const shade=near?'#282729':'#202022';
 return <g className="costume-limb classic-connected" data-pose-sample={Math.round(time)} pointerEvents="none">
  <defs><linearGradient id={key} x1="0" y1="0" x2="1" y2="0">
   <stop stopColor="#101012"/><stop offset=".54" stopColor={shade}/><stop offset="1" stopColor="#101012"/>
  </linearGradient></defs>
  <path d={`M${number(hip)} Q${number(leg.middle)} ${number(leg.end)}`} stroke={`url(#${key})`} strokeWidth="12" strokeLinecap="round" fill="none"/>
  <g transform={`translate(${ax} ${ay+1}) rotate(${profile?-(foot?.pitch??0):0})`}>
   <path d={profile?'M3-5Q9-1 7 7Q2 10-12 8Q-20 7-19 2Q-18-3-8-3Z':'M-7-4Q5-6 9 0Q14 9-1 10Q-14 11-11 4Z'} fill={`url(#${key})`}/>
  </g>
  <path d={`M${number(arm)} Q${number(upper.middle)} ${number(upper.end)}`} stroke={`url(#${key})`} strokeWidth="9" strokeLinecap="round" fill="none"/>
  <g transform={`translate(${wx} ${wy}) rotate(${climbing?blend(9,83,weight):9})`}>
   <ellipse cx="0" cy="2" rx="5" ry="7" fill={shade}/>
   <path d="M-3 4L-4 9M0 5L0 10M3 4L4 8" stroke="#282729" strokeWidth="2.7" strokeLinecap="round"/>
  </g>
 </g>;
}
