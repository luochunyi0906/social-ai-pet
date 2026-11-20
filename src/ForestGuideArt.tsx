import {useId} from 'react';
import outfit from '../desktop/outfits/forest-guide.json';
import type {ActorMotion} from './ActorAnimation';
import {costumePose,windowCrouch} from './CostumeMotion';
import {ExpressionArt} from './ExpressionArt';
import {assetUrl,type Outfit} from './outfits';
import {useMotionTime,windowGrip} from './RigMath';
import type {WindowPose} from './types';
import type {PetGesture} from './usePetClicks';
import front from './assets/outfits/forest-guide/front.webp';
import left from './assets/outfits/forest-guide/side-left.webp';
import right from './assets/outfits/forest-guide/side-right.webp';
import back from './assets/outfits/forest-guide/back.webp';
import frontLeft from './assets/outfits/forest-guide/front-left.webp';
import frontRight from './assets/outfits/forest-guide/front-right.webp';
import turntable from './assets/outfits/forest-guide/turntable.webp';

import {costumeTransform,registration} from './CostumeRegistration';

export const forestGuideViews={front,side:left,back,turntable};
const views={front,left,right,back,frontLeft,frontRight};
const target='M55 140Q51 92 79 73Q83 50 102 55L128 76Q134 54 149 51Q173 58 176 96L190 130 186 187 174 219 161 276H83L63 235 55 194Z';
const leftPocket='M106 242Q111 240 135 242L136 278H104L102 264Z';
const rightPocket='M109 244H138L143 259 145 277H106Z';
const frontFeet=['M82 248H108L109 279H81Z','M117 248H144L146 279H116Z'];
const backFeet=['M96 254H123V279H95Z','M129 254H157V279H129Z'];
const glove='M113 175Q124 169 136 176L147 197 141 217Q136 224 130 222L120 215 115 198Z';
const pixelsToArt=240/92;

export function ForestGuideArt({motion,windowPose,gesture,animate=true,angle,frame,showcase,paper}:{
 motion?:ActorMotion;windowPose?:WindowPose;gesture?:PetGesture;animate?:boolean;angle?:number;
 frame?:string;showcase?:boolean;paper?:boolean;
}){
 const key=useId();
 const pose=angle===undefined?costumePose(motion,windowPose):'stand';
 const time=useMotionTime(animate&&pose!=='stand'&&pose!=='land',windowPose?.since??motion?.since);
 const sample=windowPose?.phase==='balance'?windowPose.release?.elapsed??time:time;
 const {gait,grip,pull,weight}=windowGrip('classic',pose,sample,windowPose?.speed??motion?.speed,windowPose?.release);
 const climbing=pose==='climb'||pose==='pull';
 const rear=climbing||(pose==='fall'&&windowPose?.release?.from==='climb'&&time<185);
 const walking=pose==='walk'||pose==='run';
 const facing=windowPose?.facing??motion?.facing??'left';
 const staged=walking||rear||pose==='perch'||pose==='fall';
 const view=angle!==undefined?(angle===180?'back':angle===90?'left':angle===270?'right':'front'):
  rear?'back':walking?facing:gesture==='lift'?facing==='left'?'frontLeft':'frontRight':'front';
 const flip=rear&&windowPose?.side===0;
 const silhouette=views[view];
 const feet=view==='left'?[leftPocket,leftPocket]:view==='right'?[rightPocket,rightPocket]:rear?backFeet:frontFeet;
 const lean=gait?(facing==='left'?-1:1)*gait.lean*.72:climbing?-3-7*pull:gesture==='lift'?10:0;
 const bounce=gait?gait.body*pixelsToArt:0;
 const crouch=windowCrouch(pose,sample);
 const inAir=pose==='fall'?Math.sin(Math.PI*Math.min(1,time/720)):0;
 const bodyDrop=crouch*4;
 const raw=showcase&&frame&&!staged&&view==='front'?assetUrl(outfit as Outfit,frame):undefined;
 const armReach=grip?(grip.right.y*pixelsToArt*.36-grip.right.reach*.7)*weight:0;
 const coreMoved=staged?feet.join(''):undefined;
 function foot(index:number){
  const step=gait?.[index===0?'left':'right'];
  const dx=(step?.x??0)*pixelsToArt*(facing==='left'?-1:1)*(index===0?.79:.95)+(walking?(index===0?-1:2):0);
  const dy=(step?.y??0)*pixelsToArt
   -(climbing?Math.max(0,Math.sin(sample/120+index*Math.PI))*7:0)
   -(crouch?4+Math.sin(time/143+index*2.6)*2:0)-inAir*4;
  const pitch=(step?.pitch??0)*.45+(index===0?-1:1)*(crouch*5+inAir*4);
  const x=walking?view==='left'?119:123:index===0?106:140;
  return <g key={index} className="costume-limb" data-pose-sample={Math.round(sample)}
   transform={`translate(${dx} ${dy}) rotate(${pitch} ${x} 248)`} opacity={walking&&index===0?.9:1}>
   <image href={silhouette} width="240" height="310" clipPath={`url(#${key}-foot-${index})`}/>
  </g>;
 }
 const fit=costumeTransform(registration.forest[view]);
 return <svg className="fox fox-costume fox-classic-model" viewBox="0 0 240 310" role="img" aria-label="刘看山 · 森林引路者"
  data-outfit-id={outfit.id} data-classic-garment={outfit.id} data-outfit-frame={frame} data-gesture={gesture}
  data-classic-angle={view==='left'||view==='right'?'side':view} data-window-pose={windowPose?.phase} data-window-side={windowPose?.side}
  data-animation={motion?.clip} data-animation-stage={motion?.stage} data-animation-facing={motion?.facing}
  data-animation-pose={motion?.stage==='hold'?'sit_hold':undefined} data-outfit-motion={walking?motion?.clip:undefined}>
  <g data-rig-pose={pose} aria-hidden="true" pointerEvents="none" transform={flip?'translate(240 0) scale(-1 1)':undefined}>
   <g transform={fit}>
   <defs>
    {feet.map((d,index)=><clipPath key={index} id={`${key}-foot-${index}`}><path d={d}/></clipPath>)}
    <clipPath id={key+'-glove'}><path d={glove}/></clipPath>
    {coreMoved&&<mask id={key+'-body'} maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="310">
     <rect width="240" height="310" fill="white"/><path d={coreMoved} fill="black"/>
    </mask>}
    {raw&&<filter id={key+'-edge'} colorInterpolationFilters="sRGB">
     <feComponentTransfer><feFuncA type="linear" slope="1.14" intercept="-.14"/></feComponentTransfer>
    </filter>}
   </defs>
   <g className="costume-rig-body" transform={`translate(0 ${bounce+bodyDrop}) rotate(${lean} 120 246)`}>
    {staged&&feet.map((_,index)=>foot(index))}
    {rear&&<g className="costume-limb" transform={`translate(24 ${armReach-15}) rotate(${-77*weight+pull*21} 135 189)`}>
     <image href={right} width="240" height="310" clipPath={`url(#${key}-glove)`}/>
    </g>}
    {raw?<image href={raw} width="392" height="392" x="-77.4" y="-107.2" filter={`url(#${key}-edge)`}/>:
     <image href={silhouette} width="240" height="310" mask={coreMoved?`url(#${key}-body)`:undefined}/>}
   </g>
   </g>
  </g>
  {paper&&<rect x="134" y="205" width="31" height="24" rx="4" fill="#e7d6ac" stroke="#8a785a" strokeWidth="3"/>}
  <ExpressionArt gesture={gesture}/>
  <path className="fox-costume-hit fox-animation-hit" d={target} transform={fit} fill="transparent" aria-hidden="true"/>
 </svg>;
}
