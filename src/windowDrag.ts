import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import type {Surface} from './types';

const bridge=window.kanshan;
const THRESHOLD=5;

export function useWindowDrag(surface:Surface,onActivity?:(event:string)=>void,enabled=true){
 const pointer=useRef<{id:number;screenX:number;screenY:number;x:number;y:number;started:boolean;at:number}|null>(null);
 const suppress=useRef(false);
 const activity=useRef(onActivity);
 activity.current=onActivity;
 const [dragging,setDragging]=useState(false);

 function finish(finalSample:boolean){
  const current=pointer.current;
  pointer.current=null;
  if(!current?.started)return;
  suppress.current=true;
  void bridge?.endWindowDrag(surface,finalSample);
  setDragging(false);
  activity.current?.(finalSample?'land':'idle');
 }
 useEffect(()=>{
  const cancel=()=>finish(false);
  window.addEventListener('blur',cancel);
  return()=>{
   window.removeEventListener('blur',cancel);
   if(pointer.current?.started)void bridge?.endWindowDrag(surface,false);
   pointer.current=null;
  };
 },[surface]);

 useEffect(()=>{if(!enabled)finish(false);},[enabled]);

 function onPointerDown(event:ReactPointerEvent<Element>){
  if(!bridge||!enabled||event.button!==0||event.ctrlKey||!event.isPrimary)return;
  suppress.current=false;
  pointer.current={id:event.pointerId,screenX:event.screenX,screenY:event.screenY,x:event.clientX,y:event.clientY,started:false,at:performance.now()};
  event.currentTarget.setPointerCapture(event.pointerId);
 }
 function onPointerMove(event:ReactPointerEvent<Element>){
  const current=pointer.current;
  if(!current||current.id!==event.pointerId||current.started)return;
  if(Math.hypot(event.screenX-current.screenX,event.screenY-current.screenY)<(surface==='roam'?15:THRESHOLD))return;
  current.started=true;
  suppress.current=true;
  setDragging(true);
  activity.current?.('lift');
  void bridge?.startWindowDrag({surface,x:current.x,y:current.y});
 }
 function onPointerUp(event:ReactPointerEvent<Element>){
  if(event.button!==0||pointer.current?.id!==event.pointerId)return;
  const current=pointer.current;
  onPointerMove(event);
  if(surface==='roam'&&performance.now()-current.at>500)suppress.current=true;
  finish(true);
 }
 function didDrag(clickCount:number){
  if(clickCount===0)return false;
  const result=suppress.current;
  suppress.current=false;
  return result;
 }
 return {dragging,didDrag,bindings:{onPointerDown,onPointerMove,onPointerUp,
  onPointerCancel:()=>{suppress.current=true;finish(false);},onLostPointerCapture:()=>{if(pointer.current)suppress.current=true;finish(false);}}};
}
