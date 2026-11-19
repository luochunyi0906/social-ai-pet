import {useEffect,useRef,useState,type MouseEvent, type RefObject} from 'react';
import type {ListeningStatus} from './types';

const phrases=['烦恼 −1','松一口气','紧绷 −1','好奇心 +1'];
const doubleClickWindow=450;
const minKnockInterval=250;
const bridge=window.kanshan;

export function useDesktopKnock(enabled:boolean,listening:ListeningStatus,interrupt:()=>void){
 const [active,setActive]=useState(false);
 const [beat,setBeat]=useState(0);
 const [striking,setStriking]=useState(false);
 const [phrase,setPhrase]=useState('');
 const mode=useRef(false);
 const tally=useRef(0);
 const lastHit=useRef(-Infinity);
 const menuTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const impactTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const phraseTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const player=useRef<HTMLAudioElement>(null);
 const ready=useRef(enabled);
 ready.current=enabled;
 const pending=useRef(false);
 const clearMenu=()=>{clearTimeout(menuTimer.current);menuTimer.current=undefined;};
 function stop(){
  clearTimeout(impactTimer.current);
  clearTimeout(phraseTimer.current);
  player.current?.pause();
  tally.current=0;lastHit.current=-Infinity;
  setBeat(0);setStriking(false);setPhrase('');
 }
 function apply(value:boolean){
  if(mode.current===value)return;
  mode.current=value;
  setActive(value);
  if(!value)stop();
 }
 useEffect(()=>{
  const unsubscribe=bridge?.onKnockMode(apply);
  const suspend=bridge?.onSuspend(()=>{clearMenu();apply(false);});
  const audio=player.current;
  function escape(event:KeyboardEvent){
   if(event.key!=='Escape'||!mode.current)return;
   event.preventDefault();
   apply(false);void bridge?.setKnockMode(false);
  }
  window.addEventListener('keydown',escape);
  window.addEventListener('blur',clearMenu);
  return()=>{
   unsubscribe?.();suspend?.();
   window.removeEventListener('keydown',escape);
   window.removeEventListener('blur',clearMenu);
   clearMenu();clearTimeout(impactTimer.current);clearTimeout(phraseTimer.current);
   audio?.pause();
  };
 },[]);
 useEffect(()=>{
  if(!enabled){clearMenu();apply(false);}
 },[enabled]);
 useEffect(()=>{player.current?.pause();},[listening.mode,listening.route]);
 function hit(){
  const now=performance.now();
  if(!mode.current||!ready.current||now-lastHit.current<minKnockInterval)return;
  lastHit.current=now;
  const next=++tally.current;
  clearTimeout(impactTimer.current);clearTimeout(phraseTimer.current);
  setBeat(next);setStriking(true);
  setPhrase(next===5?'慢一点也没关系。':next===10?'陪你歇了一小会儿。':phrases[(next-1)%phrases.length]);
  if(player.current&&listening.mode==='off'){
   player.current.currentTime=0;
   player.current.volume=.18;
   void player.current.play().catch(()=>{});
  }
  impactTimer.current=setTimeout(()=>setStriking(false),240);
  phraseTimer.current=setTimeout(()=>setPhrase(''),next===5||next===10?1800:800);
 }
 function contextMenu(event:MouseEvent){
  event.preventDefault();
  interrupt();
  if(pending.current)return;
  if(!enabled){void bridge?.menu();return;}
  if(menuTimer.current===undefined){
   menuTimer.current=setTimeout(()=>{menuTimer.current=undefined;void bridge?.menu();},doubleClickWindow);
   return;
  }
  clearMenu();
  if(!bridge)return;
  const next=!mode.current;
  pending.current=true;
  void bridge.setKnockMode(next).then(result=>{
   if(!result.ok)return;
   apply(result.data);
   if(next&&result.data)hit();
  }).catch(()=>{}).finally(()=>{pending.current=false;});
 }
 return {active:active&&enabled,beat,striking,phrase,player,hit,contextMenu};
}

export function DesktopKnockArt({active,beat,striking,phrase,player}:{
 active:boolean;beat:number;striking:boolean;phrase:string;player:RefObject<HTMLAudioElement|null>;
}){
 return <>
  <audio ref={player} src="./room/soft-tap.wav" preload="auto" data-knock-audio hidden/>
  {active&&<span className="desktop-knock-art" data-knock-beat={beat} aria-hidden="true">
   <svg key={beat} className={striking?'knock-mallet-hit':undefined} viewBox="0 0 140 100">
    <g transform="rotate(-32 70 55)" stroke="#2b4368" strokeWidth="4">
     <rect x="70" y="47" width="58" height="13" rx="6.5" fill="#93aedf"/>
     <rect x="20" y="32" width="68" height="40" rx="19" fill="#eef4ff"/>
     <path d="M34 39H71" stroke="#fff" strokeWidth="6" strokeLinecap="round"/>
     <path d="M38 65H73" stroke="#9bb3ef" strokeWidth="6" strokeLinecap="round"/>
     <path d="M63 42L74 46L72 59L60 56Z" fill="#6c8fd7" stroke="none"/>
    </g>
   </svg>
   {striking&&<span className="desktop-knock-spark" key={`spark-${beat}`}>✦</span>}
   {phrase&&<span className="desktop-knock-float" key={`word-${beat}`} data-milestone={beat===5||beat===10||undefined}>{phrase}</span>}
  </span>}
 </>;
}
