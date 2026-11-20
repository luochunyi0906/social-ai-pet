import {useLayoutEffect,useRef} from 'react';
import type {PetAppearance,WeatherLook,HumanWeather,WindowPose,CheekPose,ListeningStatus} from './types';
import type {ActorMotion} from './ActorAnimation';
import human from './assets/cave/kanshan-human.png';
import fox from './assets/cave/kanshan-fox.png';
import foxHeat from './assets/cave/weather/heat.webp';
import foxSun from './assets/cave/weather/sun.webp';
import foxHeld from './assets/cave/motion/lift-face-down.webp';
import foxListening from './assets/cave/interactions/listening.webp';
import foxListeningHot from './assets/cave/interactions/listening-hot.webp';
import humanListening from './assets/cave/interactions/listening-human.webp';
import humanHot from './assets/cave/weather/human/hot.webp';
import humanRain from './assets/cave/weather/human/rain.webp';
import humanWalk from './assets/cave/motion/human-walk.webp';
import humanSun from './assets/cave/weather/human/sun.webp';
import {CheekArt,CheekRegions,Headset,RestingEyes,KnockEar} from './FaceInteractionArt';
import {FoxEyelids} from './FoxEyelids';
import {ExpressionArt} from './ExpressionArt';
import type {PetGesture} from './usePetClicks';
import {WeatherArt} from './WeatherArt';
import {PortraitDetailFrame} from './PortraitDetails';
import {FoxMotionStrip,FoxPerchArt,FoxWindowSnow,useFoxMovement,type FoxMovement} from './FoxMotionArt';
import {FoxWardrobePortrait,foxWardrobeArt} from './FoxWardrobeArt';
import {HumanBodyMotion} from './HumanBodyMotion';
import {costumePose} from './CostumeMotion';
import {useHumanAngle,type HumanView} from './HumanAngles';
import timings from '../desktop/locomotion.json';
import {useMotionTime} from './RigMath';
import {costumeTransform,foxStandTransform,registration} from './CostumeRegistration';

const humanPortraits={normal:human,hot:humanHot,rain:humanRain,sun:humanSun};
const listeningFox={normal:foxListening,hot:foxListeningHot};

const portraits = {
 human: {src: human, label: '人版', x: 27, y: 13, width: 185, height: 277,
  hit: 'M78 84Q62 50 83 29Q115 10 146 25Q174 39 169 87L160 111 166 151 161 190 151 234 153 286H84L88 236 79 200 75 143 83 109Z'},
 fox: {src: fox, label: '狐狸版', x: 21.5, y: 23, width: 196, height: 257,
  hit: 'M157.5 45L164.5 45 171.5 52 181.5 81 191.5 80 188.5 95 201.5 106 206.5 115 206.5 121 196.5 119 201.5 129 201.5 139 194.5 137 196.5 149 189.5 153 195.5 164 192.5 179 205.5 190 209.5 201 205.5 212 205.5 228 199.5 243 192.5 245 181.5 268 170.5 271 154.5 270 148.5 265 139.5 271 117.5 271 112.5 270 103.5 259 90.5 267 68.5 267 46.5 256 38.5 249 39.5 241 31.5 231 30.5 220 35.5 206 55.5 184 75.5 182 85.5 186 80.5 177 67.5 179 64.5 169 56.5 174 52.5 168 52.5 158 45.5 162 40.5 158 44.5 138 39.5 137 34.5 128 46.5 123 40.5 119 39.5 114 49.5 109 49.5 88 56.5 68 61.5 63 68.5 63 98.5 76 113.5 71 125.5 58 132.5 66Z'}
} as const;

export function AppearanceArt({appearance,motion,motionEnabled,windowPose,daydream,caveOutfit,weather,humanWeather,weatherUnlocked,gesture,cheek,faceEnabled=false,listening,liftScale=1}:{
 appearance:Exclude<PetAppearance,'classic'>;motion?:ActorMotion;motionEnabled?:boolean;windowPose?:WindowPose;
 daydream?:boolean;caveOutfit?:string|null;weather?:WeatherLook;humanWeather?:HumanWeather|null;weatherUnlocked?:boolean;gesture?:PetGesture;
 cheek?:CheekPose;faceEnabled?:boolean;listening?:ListeningStatus;liftScale?:number;
}){
 const art=portraits[appearance];
 const isFox=appearance==='fox';
 const chosen=isFox?caveOutfit:null;
 const rainStyle=isFox&&(chosen==='rain'||(!chosen&&weatherUnlocked&&weather?.umbrella));
 const wardrobe=chosen??(rainStyle?'rain':undefined);
 const referenceClothes=Boolean(chosen&&chosen!=='rain');
 const wardrobeArt=foxWardrobeArt(wardrobe,'front');
 const weatherPortrait=isFox&&!wardrobeArt&&weather?.clothing==='hot'?foxHeat:undefined;
 const humanLook:HumanWeather|undefined=!isFox&&weatherUnlocked?
  humanWeather??(weather?.umbrella?'rain':weather?.clothing&&weather.clothing!=='normal'?weather.clothing:
   weather?.glasses?'sun':'normal'):undefined;
 const accessoryLook=humanLook&&humanWeather?{clothing:'normal' as const,umbrella:humanLook==='rain',glasses:humanLook==='sun'}:
  humanLook&&weather?{...weather,clothing:'normal' as const}:weather;
 const context=chosen==='rain'?{clothing:'normal' as const,umbrella:true,glasses:false}:
  wardrobeArt&&weather?{...weather,clothing:'normal' as const}:accessoryLook;
 const phase=windowPose?.phase;
 const humanPose=!isFox?costumePose(motion,windowPose):'stand';
 const hooded=rainStyle||humanLook==='rain';
 const walkingArt=!isFox&&humanPose==='walk'&&(!humanLook||humanLook==='normal');
 const walkingTime=useMotionTime(walkingArt&&motionEnabled!==false,windowPose?.since??motion?.since);
 const walkFrame=Math.floor(walkingTime/timings.human.walk.cycle*8)%8;
 const humanRig=humanPose!=='stand'&&humanPose!=='land';
 const leavingGrip=humanPose==='fall'&&Boolean(windowPose?.release);
 const humanAngle:HumanView=leavingGrip||['walk','run','climb','pull'].includes(humanPose)?'side':'front';
 const angledPortrait=useHumanAngle(!isFox,humanLook??'normal',humanAngle);
 const humanView=angledPortrait?humanAngle:'front';
 const facing=windowPose?.facing??motion?.facing;
 const mirror=(walkingArt||humanView==='side'?(leavingGrip||humanPose==='climb'||humanPose==='pull'?windowPose?.side===0:facing==='right'):facing==='left')?'translate(240 0) scale(-1 1)':undefined;
 const active=!gesture&&isFox;
 const movement:FoxMovement|undefined=!active?undefined:
  phase==='climb'||phase==='pull'?'climb':
  phase==='perch'&&referenceClothes?'perch':
  motion?.clip==='act_run'?'run':
  motion?.clip==='act_walk'||phase==='approach'||phase==='walk-away'?'walk':undefined;
 const glasses=isFox&&!wardrobeArt&&Boolean(context?.glasses&&!context.umbrella);
 const darkGlasses=Boolean(context?.glasses&&!context.umbrella);
 const frame=useFoxMovement(movement,facing,weather?.clothing,glasses,wardrobe);
 const perched=active&&phase==='perch';
 const standing=!movement&&humanPose==='stand'&&!perched&&!phase&&gesture!=='lift'&&gesture!=='land';
 const baseFaceLayers=!hooded&&!referenceClothes;
 const headphoneOn=standing&&baseFaceLayers&&listening?.mode!==undefined&&listening.mode!=='off';
 const basePortrait=humanLook?humanPortraits[humanLook]:wardrobeArt??weatherPortrait??art.src;
 const listeningPortrait=isFox?wardrobeArt?(foxWardrobeArt(wardrobe,'headset')??wardrobeArt):listeningFox[weather?.clothing??'normal']:
  humanLook&&humanLook!=='normal'?basePortrait:humanListening;
 const portrait=headphoneOn?listeningPortrait:basePortrait;
 const foxCostume=wardrobe??(weatherPortrait?'heat':glasses?'sun':undefined);
 const standFit=isFox?foxStandTransform(foxCostume):costumeTransform(registration.human[humanLook??'normal'].front);
 const rigFit=!isFox?costumeTransform(registration.human[humanLook??'normal'][humanView]):undefined;
 const cheekPose=standing&&baseFaceLayers?cheek:undefined;
 const faceFrame=isFox?'0 0 1096 1435':'0 0 1024 1536';
 const expression=gesture==='knock'||gesture==='calm'?'knock':cheekPose?.stage==='pull'?'pinch':
  headphoneOn&&!cheekPose?'listen':undefined;
 const drifting=isFox&&daydream&&!gesture&&!movement&&!phase&&!headphoneOn&&!cheekPose;
 const rear=movement==='climb'&&Boolean(frame);
 const rearMirror=rear&&windowPose?.side===0?'translate(240 0) scale(-1 1)':undefined;
 const body=useRef<SVGGElement>(null);
 const bodyMotion=useRef<Animation>(null);
 const lifted=gesture==='lift';
 const held=foxWardrobeArt(wardrobe,'held');
 const faceDownPose=isFox&&Boolean(held||(!weatherPortrait&&!context?.umbrella&&!glasses))&&!phase&&!movement;
 useLayoutEffect(()=>{
  const element=body.current;
  const prior=bodyMotion.current;
  if(!element||(!lifted&&!prior))return;
  const {rotate,translate,scale}=getComputedStyle(element);
  prior?.cancel();
  bodyMotion.current=null;
  if(motionEnabled===false){
   if(lifted&&liftScale!==1)bodyMotion.current=element.animate({scale:[String(liftScale)]},{duration:0,fill:'both'});
   return;
  }
  const from={rotate:rotate==='none'?'0deg':rotate,translate:translate==='none'?'0 0':translate,scale:scale==='none'?'1':scale};
  const rest={rotate:'0deg',translate:'0 0',scale:'1'};
  const lean=isFox&&!faceDownPose?(facing==='left'?-1:1)*29:0;
  const center=lean===0?-1.8:lean;
  const hold={rotate:`${center}deg`,translate:lean===0?'0 -4px':`${lean>0?-9:9}px -6px`,scale:String(liftScale*(lean===0?1:.89))};
  const transition=lifted?[from,hold]:[from,{...rest,translate:'0 2px',offset:.66},rest];
  const animation=element.animate(transition,{duration:lifted?160:300,easing:'cubic-bezier(.24,.72,.34,1)',fill:'forwards'});
  bodyMotion.current=animation;
  animation.onfinish=()=>{
   if(bodyMotion.current!==animation)return;
   animation.cancel();
   bodyMotion.current=lifted?element.animate([hold,{...hold,rotate:`${center+4}deg` }],
    {duration:690,direction:'alternate',iterations:Infinity,easing:'ease-in-out'}):null;
  };
 },[lifted,motionEnabled,isFox,faceDownPose,facing,liftScale]);
 useLayoutEffect(()=>()=>{bodyMotion.current?.cancel();bodyMotion.current=null;},[]);
 return <svg className="fox fox-costume fox-appearance" viewBox="0 0 240 310" role="img"
  data-gesture={gesture} data-pet-appearance={appearance} data-cave-outfit={chosen||undefined} data-human-weather={humanLook}
  data-raincoat={hooded||undefined}
  data-hearing-gesture={headphoneOn&&listening&&Date.now()-listening.changedAt<1050||undefined}
  data-grip-pose={faceDownPose?'face-down':undefined}
  data-pinch-side={cheekPose?.side} data-daydream={drifting||undefined} data-fox-motion={frame?movement:undefined}
  data-weather-motion={frame&&weatherPortrait?weather?.clothing:undefined}
  data-human-motion={humanPose==='stand'?undefined:humanPose} data-wardrobe-pose={wardrobeArt?(frame?movement:perched?'perch':lifted&&faceDownPose?'held':'standing'):undefined} data-window-pose={phase} data-window-side={windowPose?.side} aria-label={art.label+'刘看山'}>
  <g className="portrait-drag-body" ref={body}>
   <g className="portrait-standing" data-rain-hood={hooded?(frame&&movement==='climb'?'back':humanView):undefined}>
   {frame?<FoxMotionStrip key={movement} {...frame} animated={motionEnabled!==false}
     mirror={rearMirror}/>:
    perched?<g transform={mirror}><g transform={standFit}><FoxPerchArt src={portrait}/></g></g>:
    walkingArt?<g transform={mirror}>
     <svg className="human-walk-art" transform={costumeTransform(registration.humanWalk)} data-rig-pose="walk" data-walk-frame={walkFrame} x={art.x} y={art.y} width={art.width} height={art.height}
      viewBox="0 0 384 576" overflow="hidden" aria-hidden="true" pointerEvents="none">
      <image href={humanWalk} x={-384*walkFrame} width="3072" height="576"/>
     </svg>
    </g>:
    !isFox&&humanRig?<g transform={mirror}>
     <HumanBodyMotion fit={rigFit} src={angledPortrait??portrait} view={humanView} pose={humanPose} look={humanLook??'normal'} animate={motionEnabled!==false}
      since={windowPose?.since??motion?.since} speed={windowPose?.speed??motion?.speed}
      release={windowPose?.release} frozen={phase==='balance'}/>
    </g>:
    <FoxWardrobePortrait src={portrait} outfit={isFox?foxCostume:humanLook} fit={standFit} animate={motionEnabled!==false} mirror={mirror}
     x={art.x} y={art.y} width={art.width} height={art.height}/>}
   <g transform={rear?rearMirror:mirror}><g transform={standFit}>
    {baseFaceLayers&&!frame&&!perched&&!phase&&humanPose==='stand'&&<PortraitDetailFrame form={appearance}
     x={art.x} y={art.y} width={art.width} height={art.height} facing={facing}
     gaze={!gesture&&!darkGlasses&&cheekPose?.stage!=='pull'}
     clothing={wardrobeArt?undefined:weather?.clothing}/>}
    {isFox&&baseFaceLayers&&!frame&&!phase&&!glasses&&<FoxEyelids/>}
    {glasses&&!frame&&<image href={foxSun} x={art.x} y={art.y} width={art.width} height={art.height}/>}
    <WeatherArt look={context} form={appearance} rear={rear||humanPose==='climb'||humanPose==='pull'}
     clothingArt={Boolean(wardrobeArt||weatherPortrait||humanLook)} glassesArt={Boolean(wardrobeArt)||humanLook==='sun'||glasses&&(!frame||Boolean(frame.glasses))}/>
    {standing&&baseFaceLayers&&<svg x={art.x} y={art.y} width={art.width} height={art.height} viewBox={faceFrame} overflow="visible" aria-hidden="true">
     {isFox&&gesture==='knock'&&<KnockEar source={portrait}/>}
     {cheekPose&&<CheekArt form={appearance} pose={cheekPose} source={portrait}/>}
     {expression&&!darkGlasses&&<RestingEyes form={appearance} kind={expression}/>}
     {listening&&<Headset form={appearance} status={listening}/>}

    </svg>}
    {!rear&&<ExpressionArt appearance={appearance} gesture={gesture}/>}
   </g>
   </g>
   {phase==='shake'&&<g transform={standFit}><FoxWindowSnow/></g>}
   <path className="fox-costume-hit" d={art.hit} transform={[mirror,standFit].filter(Boolean).join(' ')||undefined} fill="transparent" aria-hidden="true"/>
   {standing&&baseFaceLayers&&faceEnabled&&!darkGlasses&&<g transform={[mirror,standFit].filter(Boolean).join(' ')||undefined}>
    <svg x={art.x} y={art.y} width={art.width} height={art.height} viewBox={faceFrame}>
     <CheekRegions form={appearance} mirrored={facing==='left'}/>
    </svg>
   </g>}
   </g>
   {faceDownPose&&<g className="portrait-held" transform={mirror} pointerEvents="none" aria-hidden="true">
    <image href={held??foxHeld} x={-2} y={49} width={244} height={240}/>
   </g>}
  </g>
 </svg>;
}

export function AppearancePicker({value,saving,error,onSelect}:{
 value:PetAppearance;saving:boolean;error:string;onSelect:(value:PetAppearance)=>void;
}){
 return <fieldset className="appearance-picker" disabled={saving}>
  <legend>刘看山的外貌</legend>
  <div className="appearance-options">
   {(['human','fox'] as const).map(id=><label key={id}>
    <input type="radio" name="pet-appearance" checked={value===id} onChange={()=>onSelect(id)}/>
    <img src={portraits[id].src} alt=""/>
    <span>{portraits[id].label}</span>
   </label>)}
  </div>
  <button type="button" className="appearance-classic" disabled={value==='classic'} onClick={()=>onSelect('classic')}>恢复原版与衣柜装扮</button>
  {error&&<p role="alert" className="inline-error">{error}</p>}
 </fieldset>;
}
