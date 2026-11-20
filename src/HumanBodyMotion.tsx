import {useId} from 'react';
import {windowCrouch,type CostumePose} from './CostumeMotion';
import type {HumanWeather,WindowRelease} from './types';
import type {HumanView} from './HumanAngles';
import {blend,joint,link,rotatePoint,useMotionTime,windowGrip,type Point} from './RigMath';

const sideSleeve='M449 510Q490 477 525 508Q550 527 558 565Q569 620 580 666Q594 709 588 760L581 803 563 843 549 912 521 944 484 951 455 938 438 911 441 869 455 822 450 778 451 717 450 650Z';
const rainSleeve='M483 502Q506 464 544 458Q576 464 586 508L594 646Q603 687 590 730Q593 789 575 826L553 850L558 918Q553 944 520 944Q487 935 487 913L491 851Q467 839 470 790L482 731Q465 693 478 651Z';
const frontNear='M357 514Q382 516 394 544L415 605 473 590 517 603 525 642 507 681 431 705 393 743 319 754 260 716 261 658 312 573Z';
const frontFar='M648 490Q687 482 722 550L777 788 753 896 712 959 654 951 638 914 651 849 669 805 649 686Z';
const pixel=185/1024*92/240;
const toUnits=(value:number)=>value/pixel;

export function HumanBodyMotion({src,pose,look,view,animate,since,speed,release,frozen,fit}:{
 src:string;pose:Exclude<CostumePose,'stand'>;look:HumanWeather;view:HumanView;animate:boolean;since?:number;speed?:number;
 release?:WindowRelease;frozen?:boolean;fit?:string;
}){
 const id=useId();
 const live=useMotionTime(animate,since);
 const time=frozen?release?.elapsed??live:live;
 const {gait,grip,pull,weight}=windowGrip('human',pose,time,speed,release);
 const profile=view==='side';
 const rain=look==='rain';
 const reaching=Boolean(grip);
 const movingArms=profile;
 const windowLegs=!profile&&!gait&&!reaching;
 const crouch=windowCrouch(pose,time);
 const knee=rain?1190:look==='hot'?1128:1156;
 const hips=rain?1025:profile?900:880;
 const shoe=rain?1395:1373;
 const coatHem=rain?1021:look==='sun'?841:860;
 const nearTorso=rain?'M459 502Q510 472 549 510Q565 554 558 598L583 787L601 995H450Z':
  `M434 519Q477 485 516 520Q540 551 535 635Q533 696 552 752L565 816 557 ${Math.min(coatHem,hips+22)}H429Z`;
 const leftLeg=profile?`M270 ${hips}H650V1536H270Z`:`M${rain?290:322} ${hips}H514L511 1536H286Z`;
 const rightLeg=profile?leftLeg:`M514 ${hips}H${rain?713:664}L717 1170V1536H511Z`;
 const parts={
  nearArm:profile?(rain?rainSleeve:sideSleeve):frontNear,farArm:profile?(rain?rainSleeve:sideSleeve):frontFar,
  leftLeg,rightLeg,
 };
 const stem=profile?486:421;
 const bodyY=toUnits(gait?.body??0);
 const lean=gait?(pose==='run'?-6:-2):reaching?(-4-4*pull)*weight:0;
 const bodyTransform=`translate(0 ${bodyY})`;
 const sample=(name:string)=>`${id}-${name}`;
 function image(part:string,strip?:string){
  return <g clipPath={`url(#${sample(part)})`}><image href={src} width="1024" height="1536"
   clipPath={strip?`url(#${sample(strip)})`:undefined}/></g>;
 }
 function legs(near:boolean){
  const part=near?'leftLeg':'rightLeg';
  const x=profile?stem:near?425:601;
  if(windowLegs){
   const tilt=(near?1:-1)*(pose==='perch'?2.3+.9*Math.sin(time/175):2.3*crouch);
   return <g className="costume-limb human-leg" data-pose-sample={Math.round(time)}
    transform={`translate(${x} ${hips}) rotate(${tilt}) scale(1 ${1-.19*crouch}) translate(${-x} ${-hips})`}>
    {image(part)}
   </g>;
  }
  const offset=profile?(near?7:-16):0;
  const originalHip:Point=[x,hips];
  const originalKnee:Point=[x+(profile?-5:near?10:-5),knee];
  const originalAnkle:Point=[x,shoe];
  originalAnkle[0]+=profile?2:near?13:-9;
  const support=gait?.[near?'left':'right'];
  const hand=grip?.[near?'left':'right'];
  const hip:Point=[x+offset,hips];
  const want:Point=[
   originalAnkle[0]+offset-toUnits(support?.x??0)+(reaching?-80*weight:0),
   shoe+toUnits((support?.y??0)-(gait?.body??0))+(hand?(-55-hand.reach*9)*weight:0),
  ];
  const upper=Math.hypot(knee-hips,originalKnee[0]-x)*(pose==='perch'?.84:1.10);
  const lower=Math.hypot(shoe-knee,originalAnkle[0]-originalKnee[0])*(pose==='perch'?.91:1.05);
  const solved=joint(hip,want,upper,lower,profile?1:near?1:-1);
  const [ex,ey]=solved.end;
  const pitch=profile?-(support?.pitch??(reaching?-15:0)):0;
  return <g className="costume-limb human-leg" data-pose-sample={Math.round(time)} opacity={near||!profile?1:.88}>
   <g transform={link(originalHip,originalKnee,hip,solved.middle)}>{image(part,'thigh')}</g>
   <g transform={link(originalKnee,originalAnkle,solved.middle,solved.end)}>{image(part,'calf')}</g>
   <g transform={`translate(${ex-originalAnkle[0]} ${ey-shoe}) rotate(${pitch} ${originalAnkle[0]} ${shoe})`}>{image(part,'shoe')}</g>
  </g>;
 }
 function arms(near:boolean){
  const sourceShoulder:Point=profile?(rain?[538,482]:[503,528]):near?[369,514]:[650,510];
  const elbow:Point=profile?(rain?[535,704]:[516,718]):near?[330,651]:[697,705];
  const wrist:Point=profile?(rain?[519,864]:[488,881]):near?[480,645]:[680,889];
  const shift=profile&&!near?-21:0;
  const shoulder=rotatePoint([sourceShoulder[0]+shift,sourceShoulder[1]],[stem,hips],lean);
  const hand=grip?.[near?'left':'right'];
  const stride=gait?.[near?'left':'right'];
  const swing=toUnits(stride?.x??0)*(pose==='run'?.7:.44);
  const relaxed:Point=[wrist[0]+shift+swing,wrist[1]-Math.abs(swing)*.35];
  const want:Point=hand?[
   blend(relaxed[0],near?173:192,weight),
   blend(relaxed[1],453+toUnits(hand.y)-hand.reach*8+pull*38,weight),
  ]:relaxed;
  const solved=joint(shoulder,want,Math.hypot(elbow[0]-sourceShoulder[0],elbow[1]-sourceShoulder[1]),
   Math.hypot(wrist[0]-elbow[0],wrist[1]-elbow[1]),near?-1:1);
  const part=near?'nearArm':'farArm';
  return <g className="costume-limb human-arm" data-pose-sample={Math.round(time)} opacity={near?1:.9}>
   <g transform={link(sourceShoulder,elbow,shoulder,solved.middle)}>{image(part,'upper-arm')}</g>
   <g transform={link(elbow,wrist,solved.middle,solved.end)}>{image(part,'forearm')}</g>
  </g>;
 }
 return <svg className="human-body-motion costume-rig" transform={fit} data-rig-pose={pose} data-limb-view={view}
  x={27} y={13} width={185} height={277} viewBox="0 0 1024 1536" overflow="visible" pointerEvents="none" aria-hidden="true">
  <defs>
   {Object.entries(parts).map(([name,d])=><clipPath key={name} id={sample(name)}><path d={d}/></clipPath>)}
   <clipPath id={sample('thigh')}><rect width="1024" height={knee+26}/></clipPath>
   <clipPath id={sample('calf')}><rect y={knee-22} width="1024" height={shoe-knee+43}/></clipPath>
   <clipPath id={sample('shoe')}><rect y={shoe-14} width="1024" height={1550-shoe}/></clipPath>
   <clipPath id={sample('upper-arm')}><rect width="1024" height={profile?741:723}/></clipPath>
   <clipPath id={sample('forearm')}><rect y={profile?692:623} width="1024" height="400"/></clipPath>
   <mask id={sample('core')} maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1536">
    <rect width="1024" height="1536" fill="white"/>
    <path d={leftLeg+(profile?'':rightLeg)+(movingArms?parts.nearArm+(profile?'':parts.farArm):'')} fill="black"/>
   </mask>
   <linearGradient id={sample('side-fabric')} x1=".25" y1="0" x2=".9" y2=".65">
    <stop stopColor={look==='rain'?'#7295c6':look==='sun'?'#345cac':'#e3e6f4'}/>
    <stop offset="1" stopColor={look==='rain'?'#a6bbdf':look==='sun'?'#7a9fdf':'#adaecb'}/>
   </linearGradient>
  </defs>
  <g className="costume-rig-body" transform={bodyTransform}>
   {movingArms&&arms(false)}
   {legs(false)}
   {legs(true)}
   <g transform={`rotate(${lean} ${stem} ${hips})`}>
    <image href={src} width="1024" height="1536" mask={`url(#${sample('core')})`}/>
    {profile&&<g clipPath={`url(#${sample('nearArm')})`}>
     <path d={`M425 ${coatHem-22}H553V${hips+26}H425Z`} fill="#363b56"/>
     <path d={nearTorso} fill={`url(#${sample('side-fabric')})`}/>
    </g>}
   </g>
   {movingArms&&arms(true)}
  </g>
 </svg>;
}
