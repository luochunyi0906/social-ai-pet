import {useEffect,useRef,useState,type KeyboardEvent,type SyntheticEvent} from 'react';

export type PetGesture='look'|'upset'|'wipe'|'lift'|'land';
export function usePetClicks(open:()=>void,activity?:(kind:string)=>void){
 const [gesture,setGesture]=useState<PetGesture>();
 const clicks=useRef<number[]>([]);
 const timers=useRef<{open?:ReturnType<typeof setTimeout>;pose?:ReturnType<typeof setTimeout>}>({});
 const mutedUntil=useRef(0);
 const latest=useRef({open,activity});
 latest.current={open,activity};
 function clear(){
  clearTimeout(timers.current.open);clearTimeout(timers.current.pose);
  timers.current={};
  clicks.current=[];
 }
 useEffect(()=>()=>clear(),[]);
 function display(pose:PetGesture,duration:number){
  clearTimeout(timers.current.pose);
  setGesture(pose);
  timers.current.pose=setTimeout(()=>setGesture(undefined),duration);
 }
 function pick(detail:number){
  const now=performance.now();
  if(now<mutedUntil.current)return;
  if(detail===0){
   display('look',1000);
   latest.current.activity?.('look');
   return;
  }
  clicks.current=clicks.current.filter(time=>now-time<=1500);
  clicks.current.push(now);
  if(clicks.current.length>=3){
   clear();mutedUntil.current=now+8500;
   setGesture('upset');
   latest.current.activity?.('upset');
   timers.current.pose=setTimeout(()=>display('wipe',450),2050);
   return;
  }
  display('look',1000);
  latest.current.activity?.('look');
  if(clicks.current.length===2)timers.current.open=setTimeout(()=>{
   clear();timers.current.open=undefined;
   latest.current.open();
  },1500);
 }
 function dragAction(kind:string){
  clear();timers.current.open=undefined;
  if(kind==='lift')setGesture('lift');
  else if(kind==='land')display('land',340);
  else setGesture(undefined);
  latest.current.activity?.(kind);
 }
 function openMenu(event:SyntheticEvent){
  event.preventDefault();
  clear();
  setGesture(undefined);
  void window.kanshan?.menu();
 }
 function menuKey(event:KeyboardEvent){
  if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10')openMenu(event);
 }
 return {gesture,pick,dragAction,openMenu,menuKey};
}
