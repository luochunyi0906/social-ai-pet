import {useLayoutEffect,useRef,useState} from 'react';
import outfits from '../desktop/cave-wardrobe.json';

const sprites=import.meta.glob<string>('./assets/cave/outfits-q/*/*.webp',
 {eager:true,query:'?url&no-inline',import:'default'});

type WardrobePose='front'|'headset'|'held'|'angle-front'|'angle-side'|'angle-back'|'turntable'|
 'walk-left'|'walk-right'|'run-left'|'run-right'|'climb'|'perch';
export function foxWardrobeArt(id:string|null|undefined,pose:WardrobePose){
 return id&&(id==='rain'||Object.hasOwn(outfits,id))?sprites[`./assets/cave/outfits-q/${id}/${id}-${pose}.webp`]:undefined;
}

const requiredPoses:WardrobePose[]=['front','held','walk-right','walk-left','run-right','run-left','climb','perch','turntable'];
export async function prepareFoxWardrobe(id:string){
 await Promise.all(requiredPoses.map(async pose=>{
  const url=foxWardrobeArt(id,pose);
  if(!url)throw Error('这套装扮缺少动作素材。');
  const image=new Image();
  image.src=url;
  await image.decode();
 }));
}

export function FoxWardrobePortrait({src,outfit,animate,mirror,fit,x,y,width,height}:{
 src:string;outfit?:string;animate:boolean;mirror?:string;fit?:string;x:number;y:number;width:number;height:number;
}){
 const current={src,outfit,fit};
 const previous=useRef(current);
 const [leaving,setLeaving]=useState<typeof current>();
 useLayoutEffect(()=>{
  const old=previous.current;
  previous.current={src,outfit,fit};
  if(!animate||old.src===src||old.outfit===outfit){setLeaving(undefined);return;}
  setLeaving(old);
  const timeout=setTimeout(()=>setLeaving(undefined),144);
  return ()=>clearTimeout(timeout);
 },[src,outfit,fit,animate]);
 return <g transform={mirror}>
  <image href={src} transform={fit} x={x} y={y} width={width} height={height}/>
  {leaving&&<image key={leaving.src} className="fox-wardrobe-leaving" href={leaving.src} transform={leaving.fit}
   x={x} y={y} width={width} height={height}/>}
 </g>;
}
