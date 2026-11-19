import {useEffect,useState} from 'react';
import type {HumanWeather} from './types';

export type HumanView='front'|'side'|'back';
const angles=import.meta.glob<string>('./assets/cave/weather/human/angles/*.webp',
 {eager:true,query:'?url&no-inline',import:'default'});
export const humanAngle=(look:HumanWeather,side:Exclude<HumanView,'front'>)=>
 angles[`./assets/cave/weather/human/angles/${look}-${side}.webp`];
const decoded=new Set<string>();
const decoding=new Map<string,Promise<void>>();
function preload(url:string){
 const task=decoding.get(url);
 if(task)return task;
 const image=new Image();
 image.src=url;
 const result=image.decode().then(()=>{decoded.add(url);},()=>{decoding.delete(url);});
 decoding.set(url,result);
 return result;
}

export function useHumanAngle(enabled:boolean,look:HumanWeather,side:HumanView){
 const [,recheck]=useState(0);
 useEffect(()=>{
  if(!enabled)return;
  let visible=true;
  const targets=[humanAngle(look,'side'),humanAngle(look,'back')].filter(url=>url&&!decoded.has(url));
  if(targets.length)void Promise.all(targets.map(preload)).then(()=>{if(visible)recheck(value=>value+1);});
  return()=>{visible=false;};
 },[enabled,look]);
 const url=enabled&&side!=='front'?humanAngle(look,side):undefined;
 return url&&decoded.has(url)?url:undefined;
}
