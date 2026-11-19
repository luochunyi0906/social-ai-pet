import {createContext,useContext,useEffect,useLayoutEffect,useMemo,useReducer,useState} from 'react';
import registry from './assets/companion/registry.json';
import {animationEvent,animationFrame,animationPlan,initialAnimation} from './shared/animation.mjs';

export type AnimationMode='normal'|'focus'|'sleep';
export type AnimationFeedback='emo_happy'|'emo_curious';
export type RequestScope='chat'|'search'|'hot'|'recommendations'|'answers';
export type RequestAnimation=(scope:RequestScope,id:string,waiting:boolean)=>void;
export type ActorMotion={
 clip:'act_idle'|'act_walk'|'act_run'|'act_sit'|'act_sleep'|'emo_thinking'|AnimationFeedback;
 stage:'loop'|'enter'|'hold';
 since:number;
 until:number|null;
 facing?:'left'|'right';
 speed?:number;
};

type ActorEvents={request:RequestAnimation;feedback:(clip:AnimationFeedback)=>void;clear:()=>void};
export const ActorEventsContext=createContext<ActorEvents>({request:()=>{},feedback:()=>{},clear:()=>{}});
export const useActorEvents=()=>useContext(ActorEventsContext);
export const defaultMotion:ActorMotion={clip:'act_idle',stage:'loop',since:0,until:null};

const urls=import.meta.glob<string>('./assets/companion/*/*.png',{eager:true,query:'?url&no-inline',import:'default'});
const ready=new Set<string>();
const loading=new Map<string,Promise<void>>();
const clipUrl=(clip:ActorMotion['clip'],index:number)=>urls[`./assets/companion/${clip}/${registry.clips[clip].frames[index]}`];
function preload(url:string){
 let promise=loading.get(url);
 if(!promise){
  const image=new Image();
  image.src=url;
  promise=image.decode().then(()=>{ready.add(url);}).catch(()=>{loading.delete(url);});
  loading.set(url,promise);
 }
 return promise;
}

export function useActorAnimation(mode:AnimationMode){
 const [state,emit]=useReducer(animationEvent,undefined,()=>initialAnimation());
 const [,refresh]=useState(0);
 useLayoutEffect(()=>{
  emit({type:'mode',mode,at:Date.now()});
 },[mode]);
 const motion=animationPlan(state,Date.now()) as ActorMotion;
 useEffect(()=>{
  if(motion.until===null)return;
  const timer=setTimeout(()=>refresh(value=>value+1),Math.max(1,motion.until-Date.now()+1));
  return ()=>clearTimeout(timer);
 },[motion.until]);
 const events=useMemo<ActorEvents>(()=>({
  request:(scope,id,waiting)=>emit({type:waiting?'begin':'end',scope,id,at:Date.now()}),
  feedback:clip=>emit({type:'feedback',clip,at:Date.now()}),
  clear:()=>emit({type:'clear-feedback',at:Date.now()}),
 }),[emit]);
 return {motion,events};
}

export function useCompanionFrame(motion:ActorMotion,enabled:boolean,reduced:boolean,preloadAll:boolean){
 const [visible,setVisible]=useState(()=>!document.hidden);
 const [cached,setCached]=useState<{clip:ActorMotion['clip'];url:string;index:number}>();
 const {clip,stage,since,until}=motion;
 const still=reduced||!enabled;
 useEffect(()=>{
  const onVisibility=()=>setVisible(!document.hidden);
  document.addEventListener('visibilitychange',onVisibility);
  return ()=>document.removeEventListener('visibilitychange',onVisibility);
 },[]);
 useEffect(()=>{
  if(!preloadAll)return;
  Object.entries(registry.clips).forEach(([id,entry])=>{
   if(entry.active)entry.frames.forEach((_name,index)=>void preload(clipUrl(id as ActorMotion['clip'],index)));
  });
 },[preloadAll]);
 useEffect(()=>{
  let live=true;
  let timer=0;
  let previous=-1;
  const plan={clip,stage,since,until};
  function draw(){
   if(!live)return;
   const index=animationFrame(plan,Date.now(),still);
   const url=clipUrl(clip,index);
   if(ready.has(url)&&index!==previous){
    previous=index;
    setCached({clip,url,index});
   }else if(!ready.has(url)){
    void preload(url).then(()=>{
     if(live&&ready.has(url)&&(!visible||still||stage==='hold'))draw();
    });
   }
   if(visible&&!still&&(stage==='loop'||(stage==='enter'&&until!==null&&Date.now()<until)))timer=requestAnimationFrame(draw);
  }
  draw();
  return ()=>{live=false;cancelAnimationFrame(timer);};
 },[clip,stage,since,until,still,visible]);
 const index=animationFrame(motion,Date.now(),still);
 const url=clipUrl(clip,index);
 return cached?.clip===clip&&(!still||cached.index===index)?cached:ready.has(url)?{clip,url,index}:undefined;
}
