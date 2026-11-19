import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {AppearanceArt} from '../../src/PetAppearance';
import {ClassicWardrobeArt} from '../../src/ClassicWardrobeArt';
import {MotionPreviewTime} from '../../src/RigMath';
import {smooth,timingFor} from '../../src/shared/locomotion.mjs';
import {dropTime,fallingPosition} from '../../desktop/window-drop.mjs';
import type {PetAppearance,WeatherLook,WindowPose} from '../../src/types';
import type {ActorMotion} from '../../src/ActorAnimation';
import '../../src/live-actor.css';
import './style.css';

type Mode='walk'|'run'|'climb'|'drop'|'rain';
type Outfit='default'|'dressed'|'rain';
const forms:[PetAppearance,string][]=[['classic','原版'],['human','人版'],['fox','狐狸 Q 版']];
const root=createRoot(document.getElementById('root')!);
const labels={walk:'走路',run:'跑步',climb:'攀爬',drop:'切窗掉落',rain:'雨天 · 戴帽雨衣'};
const clothes={classic:'森林引路者',human:'清凉短袖',fox:'明服'};
const rain:WeatherLook={clothing:'normal',umbrella:true,glasses:false};

function drop(form:PetAppearance,t:number){
 const ledge={x:151,y:51},landing={x:70,y:form==='fox'?102:105};
 const q=form==='fox';
 const phases=[['perch',460],['balance',q?320:dropTime.balance],['fall',dropTime.fall],['land',q?350:dropTime.land],
  ['shake',q?700:0],['walk-away',q?650:0]] as const;
 let elapsed=t*3200;
 for(const [phase,duration] of phases){
  if(elapsed>=duration){elapsed-=duration;continue;}
  const fraction=elapsed/duration;
  const at=phase==='fall'?q?{x:ledge.x+(landing.x-ledge.x)*fraction,
   y:ledge.y+(landing.y-ledge.y)*fraction-35*Math.sin(fraction*Math.PI)}:fallingPosition(ledge,landing,fraction):
   phase==='walk-away'?{...landing,x:landing.x-35*elapsed/duration}:
   phase==='land'||phase==='shake'?landing:ledge;
  return {...at,time:elapsed,phase};
 }
 return {...landing,x:landing.x-(q?35:0),time:0,phase:'land' as const};
}

function progress(form:PetAppearance,mode:Mode,t:number){
 if(mode==='drop')return drop(form,t);
 if(mode==='rain')return {time:0,x:81,y:70};
 const timing=timingFor(form,mode);
 if(mode!=='climb')return {time:t*timing.cycle*2,x:22+t*timing.cycle*2*timing.speed,y:form==='fox'?98:form==='human'?113:118};
 const elapsed=t*3500;
 const span=2200;
 if(elapsed<span)return {time:elapsed,x:117,y:152-elapsed*timing.speed};
 if(elapsed<span+650){
  const time=elapsed-span;
  const eased=smooth(time/650);
  return {time,x:117+40*eased,y:152-span*timing.speed-(77-span*timing.speed)*eased};
 }
 return {time:elapsed-span-650,x:157,y:75};
}
function sheet(mode:Mode,t:number,outfit:Outfit){
 const dressed=outfit==='dressed';
 const wet=outfit==='rain'||mode==='rain';
 return <>
  <header><h1>{labels[mode]}</h1><span>{wet?'三种外观 · 运行画面':dressed?'穿着同一套衣服':'默认外观 · 动作参考'}</span></header>
  <section>
   {forms.map(([form,name])=>{
    const p=progress(form,mode,t);
    const facing=mode==='drop'?'left':'right';
    const motion:ActorMotion|undefined=mode==='walk'||mode==='run'?{clip:mode==='run'?'act_run':'act_walk',stage:'loop',since:0,until:null,facing}:undefined;
    const onWindow:WindowPose|undefined=mode==='drop'&&'phase' in p?{phase:p.phase,side:0,facing,since:0}:mode!=='climb'?undefined:{
     phase:t*3500<2200?'climb':t*3500<2850?'pull':'perch',side:0,facing,since:0,
    };
    return <article key={form}>
     <h2>{name}{dressed?<> <small>{clothes[form]}</small></>:null}</h2>
     {mode==='climb'||mode==='drop'?<div className={mode==='drop'?'rail drop-rail':'rail'}/>:<div className="ground"/>}
     <div className={`model model-${form}`} data-animation-ms={p.time} style={{left:p.x,top:p.y}}>
      <MotionPreviewTime.Provider value={p.time}>
       {form==='classic'?<ClassicWardrobeArt id={dressed?'forest-guide':'default'} raincoat={wet} motion={motion} windowPose={onWindow}/>:
        form==='human'?<AppearanceArt appearance="human" humanWeather={wet?'rain':dressed?'hot':'normal'} weatherUnlocked motion={motion} windowPose={onWindow}/>:
        <AppearanceArt appearance="fox" caveOutfit={dressed?'ming':null} weather={wet?rain:undefined} weatherUnlocked motion={motion} windowPose={onWindow}/>}
      </MotionPreviewTime.Provider>
     </div>
    </article>;
   })}
  </section>
 </>;
}
Object.assign(window,{setPreviewFrame(mode:Mode,t:number,outfit:Outfit){
 flushSync(()=>root.render(sheet(mode,t,outfit)));
}});
