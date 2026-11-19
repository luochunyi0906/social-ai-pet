import {useCallback,useEffect,useState} from 'react';

const IDLE_BEFORE_DAYDREAM=2*60*1000;

export function useDaydream(eligible:boolean){
 const [daydream,setDaydream]=useState(false);
 const [interaction,setInteraction]=useState(0);
 const wakeDaydream=useCallback(()=>{
  setDaydream(false);
  setInteraction(previous=>previous+1);
 },[]);

 useEffect(()=>{
  if(!eligible){
   setDaydream(false);
   return;
  }
  const timer=window.setTimeout(()=>setDaydream(true),IDLE_BEFORE_DAYDREAM);
  window.addEventListener('pointerdown',wakeDaydream,true);
  window.addEventListener('keydown',wakeDaydream,true);
  return()=>{
   window.clearTimeout(timer);
   window.removeEventListener('pointerdown',wakeDaydream,true);
   window.removeEventListener('keydown',wakeDaydream,true);
  };
 },[eligible,interaction,wakeDaydream]);

 return {daydream:eligible&&daydream,wakeDaydream};
}
