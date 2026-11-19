import {useEffect,useId,useState} from 'react';
import type {ActorMotion} from './ActorAnimation';
import type {WeatherLook,WindowPose} from './types';
import type {PetGesture} from './usePetClicks';
import {WeatherArt} from './WeatherArt';
import {ExpressionArt} from './ExpressionArt';
import {type ClassicView} from './ClassicGarment';
import {ForestGuideArt} from './ForestGuideArt';
import {costumePose} from './CostumeMotion';
import {animationFrame} from './shared/animation.mjs';
import {characterMotion,useMotionTime} from './RigMath';
import {ClassicMotionLimbs} from './ClassicMotionLimbs';
import './costume-motion.css';

import front from './assets/wardrobe-designs/default/front-cutout.png';
import side from './assets/wardrobe-designs/default/side-cutout.png';
import back from './assets/wardrobe-designs/default/back-cutout.png';
import rainFront from './assets/wardrobe-designs/default/rain-front.webp';
import rainSide from './assets/wardrobe-designs/default/rain-side.webp';
import rainFrontCore from './assets/wardrobe-designs/default/rain-front-core.webp';
import rainSideCore from './assets/wardrobe-designs/default/rain-side-core.webp';
const model={front,side,back};

const outerLeft='M81 113Q67 128 62 147Q58 165 60 177Q61 185 71 184L81 176 81 158 86 116Z';
const outerRight='M186 113Q198 120 203 140Q209 158 209 174Q208 185 198 185L188 177 188 156 185 135Z';
const sideArm='M129 117Q137 111 143 117Q149 124 149 140Q149 155 145 168L145 179H120Q112 175 113 165Q113 158 126 150Q132 145 131 136Z';
const sideFlank='M126 115Q135 105 147 114L155 132Q160 153 158 170L151 181Q138 186 120 180Q106 170 114 155L125 145Z';
const leftLeg='M104 189Q111 190 124 195L124 222 128 243H95L96 223 103 219Z';
const rightLeg='M145 195Q156 194 166 189L166 223 175 226 175 244H141L142 224Z';
const narrowLeg='M124 193Q135 188 146 193L146 223 150 244H102L101 225 123 219Z';
const normalHit='M76 45Q86 35 99 68H143Q158 32 171 48L177 118 191 153 195 228 178 278 69 278 46 223 54 157 72 120Z';
const sideHit='M40 70Q53 57 115 64L136 37Q158 34 171 80L184 164 213 185 203 223 153 232 145 277 84 280 71 257 81 209 69 149 44 113Z';

type ClassicWardrobeProps={
 id?:string;motion?:ActorMotion;windowPose?:WindowPose;gesture?:PetGesture;weather?:WeatherLook;raincoat?:boolean;animate?:boolean;
 angle?:number;frame?:string;showcase?:boolean;paper?:boolean;
};
export function ClassicWardrobeArt(props:ClassicWardrobeProps){
 return props.id==='forest-guide'&&!props.raincoat?<ForestGuideArt {...props}/>:<ClassicBaseArt {...props}/>;
}
function ClassicBaseArt({id='default',motion,windowPose,gesture,weather,raincoat=false,animate=true,angle,frame,paper}:ClassicWardrobeProps){
 const key=useId();
 const pose=angle===undefined?costumePose(motion,windowPose):'stand';
 const sitting=angle===undefined&&!windowPose&&(motion?.clip==='act_sit'||motion?.clip==='emo_thinking');
 const moving=(pose!=='stand'&&pose!=='land')||sitting;
 const [tick,draw]=useState(0);
 useEffect(()=>{
  if(!motion||!animate||angle!==undefined||motion.stage==='hold')return;
  let last=-1;
  const id=setInterval(()=>{
   if(document.hidden)return;
   const next=animationFrame(motion,Date.now());
   if(next!==last){last=next;draw(next);}
  },33);
  return ()=>clearInterval(id);
 },[motion,animate,angle]);
 const frameIndex=motion?motion.stage==='hold'||!animate?animationFrame(motion,Date.now(),true):tick:undefined;
 const reactionY=motion?.clip==='emo_happy'?-Math.sin(Math.min(5,tick)*Math.PI/5)*7:
  motion?.clip==='act_sit'||motion?.clip==='emo_thinking'?3:motion?.clip==='act_idle'?-Math.sin(tick*Math.PI/4):0;
 const walking=pose==='walk'||pose==='run';
 const reaching=pose==='climb'||pose==='pull';
 const releasing=pose==='fall'&&Boolean(windowPose?.release);
 const view:ClassicView=angle!==undefined?(angle===180?'back':angle===0?'front':'side'):
  reaching||walking||releasing?'side':'front';
 const mirrored=angle!==undefined?angle===270:
  reaching||releasing?windowPose?.side===0:view==='side'&&(windowPose?.facing??motion?.facing)==='right';
 const flipped=mirrored?'translate(240 0) scale(-1 1)':undefined;
 const limbs=view==='side'?{near:sideArm,far:sideArm,left:narrowLeg,right:narrowLeg}:
  {near:outerLeft,far:outerRight,left:leftLeg,right:rightLeg};
 const frameTime=useMotionTime(moving&&animate,windowPose?.since??motion?.since);
 const time=windowPose?.phase==='balance'?windowPose.release?.elapsed??frameTime:frameTime;
 const {gait,pull}=characterMotion('classic',pose,time,windowPose?.speed??motion?.speed);
 const lean=gait?-(4+gait.lean*.35):reaching?-(4+pull*8):0;
 const y=gait?gait.body*2.4:reactionY;
 const source=raincoat?(view==='side'?(moving?rainSideCore:rainSide):(moving?rainFrontCore:rainFront)):model[view];
 const image=(part?:keyof typeof limbs)=> <image href={source} width="256" height="256"
  clipPath={part?`url(#${key}-${part})`:undefined} filter={part?`url(#${key}-limb-ink)`:undefined}/>;
 return <svg className="fox fox-costume fox-classic-model" viewBox="0 0 240 310" role="img"
  aria-label={id==='default'?'原版刘看山':'刘看山 · 森林引路者'}
  data-outfit-id={id} data-outfit-frame={frame} data-gesture={gesture}
  data-raincoat={raincoat||undefined}
  data-classic-angle={view} data-window-pose={windowPose?.phase} data-window-side={windowPose?.side}
  data-animation={motion?.clip} data-animation-frame={frameIndex===undefined?undefined:frameIndex+1} data-animation-stage={motion?.stage} data-animation-facing={motion?.facing}
  data-animation-pose={motion?.stage==='hold'?'sit_hold':undefined} data-outfit-motion={walking?motion?.clip:undefined}>
  <g transform={flipped}>
   <svg x="-17" y="18" width="274" height="274" viewBox="0 0 256 256"
    className={`costume-rig${animate?' costume-rig-animate':''}`} data-rig-pose={pose} pointerEvents="none" aria-hidden="true" overflow="visible">
    <defs>
     {Object.entries(limbs).map(([part,d])=><clipPath key={part} id={`${key}-${part}`}><path d={d}/></clipPath>)}
     <filter id={key+'-limb-ink'} colorInterpolationFilters="sRGB" x="0%" y="0%" width="100%" height="100%">
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -.84 -1.72 -.44 0 1.63" result="ink"/>
      <feComposite in="SourceGraphic" in2="ink" operator="in"/>
     </filter>
     <clipPath id={key+'-tail'}><path d="M105 175Q109 161 127 158Q140 159 148 171Q154 186 136 193Q113 195 105 175Z"/></clipPath>
     <mask id={key+'-classic-core'} maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256">
      <rect width="256" height="256" fill="white"/>
      {moving&&<path d={view==='side'?sideArm+narrowLeg:outerLeft+outerRight+leftLeg+rightLeg} fill="black"/>}
     </mask>
     <linearGradient id={key+'-flank'} gradientUnits="userSpaceOnUse" x1="123" y1="122" x2="145" y2="182">
      <stop stopColor="#f9f6f7"/><stop offset=".59" stopColor="#ece9ea"/><stop offset="1" stopColor="#cdc9ca"/>
     </linearGradient>
     <filter id={key+'-flank-feather'} x="-24%" y="-20%" width="148%" height="140%" colorInterpolationFilters="sRGB">
      <feGaussianBlur stdDeviation="2.2"/>
     </filter>
    </defs>
    <g className="costume-rig-body" transform={`translate(0 ${y})`}>
     {moving&&<ClassicMotionLimbs pose={pose} time={time} speed={windowPose?.speed??motion?.speed}
      profile={view==='side'} lean={lean} release={windowPose?.release} raincoat={raincoat} layer="far"/>}
     <g transform={`rotate(${lean} 128 190)`} data-rain-hood={raincoat?view:undefined}>
     <image href={source} width="256" height="256" mask={raincoat?undefined:`url(#${key}-classic-core)`}/>
     {!raincoat&&moving&&view==='side'&&<g fill={`url(#${key}-flank)`}>
      <path d={sideArm}/>
      <path d={sideFlank} filter={`url(#${key}-flank-feather)`}/>
     </g>}
     {view==='back'&&id!=='default'&&<image href={source} width="256" height="256" clipPath={`url(#${key}-tail)`}/>}
     {!raincoat&&!moving&&id!=='default'&&view==='side'&&image('near')}
     </g>
     {moving&&<ClassicMotionLimbs pose={pose} time={time} speed={windowPose?.speed??motion?.speed}
      profile={view==='side'} lean={lean} release={windowPose?.release} raincoat={raincoat} layer="near"/>}

    </g>
   </svg>
   {paper&&<rect x="135" y="143" width="37" height="27" rx="4" fill="#e7d6ac" stroke="#8a785a" strokeWidth="3"/>}
   <WeatherArt look={weather} rear={reaching} clothingArt={raincoat||id!=='default'}/>
   <ExpressionArt gesture={gesture}/>
   <path className="fox-costume-hit fox-animation-hit" d={view==='side'?sideHit:normalHit} fill="transparent" aria-hidden="true"/>
  </g>
 </svg>;
}
