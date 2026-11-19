import {useEffect,useRef,useState,type PointerEvent} from 'react';
import type {CheekPose,CheekSide} from './types';

type CheekTarget={element:Element;side:CheekSide;direction:number};
type Press=CheekTarget&{id:number;x:number;y:number;at:number;distance:number;pulling:boolean;owner:HTMLElement};
const target=(event:PointerEvent):CheekTarget|undefined=>{
 const element=(event.target as Element).closest('[data-cheek-side]');
 const side=element?.getAttribute('data-cheek-side');
 if(!element||(side!=='left'&&side!=='right'))return;
 return {element,side,direction:element.getAttribute('data-cheek-direction')==='left'?-1:1};
};

export function useCheekGesture(enabled:boolean,shortClick:()=>void,takeover:()=>void,wake?:()=>void){
 const [pose,setPose]=useState<CheekPose>();
 const [hint,setHint]=useState(false);
 const hinted=useRef(false);
 const ready=useRef<CheekTarget>(undefined);
 const hovered=useRef<CheekTarget>(undefined);
 const pressed=useRef<Press>(undefined);
 const suppress=useRef(false);
 const hoverTimer=useRef<ReturnType<typeof setTimeout>>(undefined);
 const rebound=useRef<ReturnType<typeof setTimeout>>(undefined);
 const renew=useRef<ReturnType<typeof setInterval>>(undefined);
 const callback=useRef({shortClick,takeover,wake});
 callback.current={shortClick,takeover,wake};

 function clearHover(){
  clearTimeout(hoverTimer.current);
  hovered.current=undefined;ready.current=undefined;
  setHint(false);
  setPose(previous=>previous?.stage==='ready'?undefined:previous);
 }

 function end(pointer?:number,commit=false){
  const press=pressed.current;
  if(!press||(pointer!==undefined&&pointer!==press.id))return false;
  pressed.current=undefined;
  clearInterval(renew.current);
  clearHover();
  void window.kanshan?.cheekCapture(false);
  if(press.owner.hasPointerCapture(press.id))press.owner.releasePointerCapture(press.id);
  if(press.pulling&&commit){
   setPose({side:press.side,stage:'release',strength:0});
   rebound.current=setTimeout(()=>setPose(undefined),270);
  }else{
   setPose(undefined);
   if(commit&&press.distance<15&&performance.now()-press.at<=500)callback.current.shortClick();
  }
  return true;
 }

 useEffect(()=>{
  const cancel=()=>{end();clearHover();clearTimeout(rebound.current);setPose(undefined);};
  const visibility=()=>{if(document.hidden)cancel();};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')cancel();};
  const offSuspend=window.kanshan?.onSuspend(cancel);
  window.addEventListener('blur',cancel);
  window.addEventListener('keydown',escape);
  document.addEventListener('visibilitychange',visibility);
  if(!enabled)cancel();
  return()=>{
   offSuspend?.();
   window.removeEventListener('blur',cancel);
   window.removeEventListener('keydown',escape);
   document.removeEventListener('visibilitychange',visibility);
   end();clearTimeout(rebound.current);clearTimeout(hoverTimer.current);
   hovered.current=undefined;ready.current=undefined;
  };
 },[enabled]);

 function down(event:PointerEvent<HTMLElement>){
  if(!enabled||event.button!==0||!event.isPrimary||event.ctrlKey)return false;
  suppress.current=false;
  const cheek=target(event);
  if(!cheek||ready.current?.element!==cheek.element){clearHover();return false;}
  clearTimeout(rebound.current);
  clearHover();
  suppress.current=true;
  const owner=event.currentTarget;
  pressed.current={...cheek,owner,id:event.pointerId,x:event.clientX,y:event.clientY,
   at:performance.now(),distance:0,pulling:false};
  owner.setPointerCapture(event.pointerId);
  void window.kanshan?.cheekCapture(true);
  renew.current=setInterval(()=>void window.kanshan?.cheekCapture(true),2500);
  return true;
 }

 function move(event:PointerEvent<HTMLElement>){
  const press=pressed.current;
  if(press){
   if(press.id!==event.pointerId)return true;
   const dx=event.clientX-press.x;
   press.distance=Math.max(press.distance,Math.hypot(dx,event.clientY-press.y));
   const outward=dx*press.direction;
   if(!press.pulling&&outward<4)return true;
   if(!press.pulling){press.pulling=true;callback.current.takeover();}
   const strength=1-Math.exp(-Math.max(0,outward-3)/18);
   setPose({side:press.side,stage:'pull',strength});
   return true;
  }
  const cheek=enabled&&!event.buttons?target(event):undefined;
  if(cheek?.element===hovered.current?.element)return false;
  clearHover();
  if(!cheek)return false;
  hovered.current=cheek;
  hoverTimer.current=setTimeout(()=>{
   if(hovered.current?.element!==cheek.element||!cheek.element.isConnected)return;
   ready.current=cheek;
   callback.current.wake?.();
   setPose({side:cheek.side,stage:'ready',strength:0});
   if(!hinted.current){hinted.current=true;setHint(true);}
  },400);
  return false;
 }

 return {pose,hint,down,move,
  up:(event:PointerEvent<HTMLElement>)=>{
   if(!pressed.current)return false;
   move(event);
   return end(event.pointerId,true);
  },
  cancel:(event:PointerEvent<HTMLElement>)=>end(event.pointerId),
  leave:()=>{if(!pressed.current)clearHover();},
  skipClick:(detail:number)=>{
   if(!detail||!suppress.current)return false;
   suppress.current=false;
   return true;
  }};
}
