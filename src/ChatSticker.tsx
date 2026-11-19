import {useEffect,useRef,useState} from 'react';
import classic from '../desktop/chat-stickers.json';
import scarf from '../desktop/scarf-stickers.json';
import cave from '../desktop/cave-stickers.json';
import registry from './assets/companion/registry.json';
import type {StickerId} from './types';

export const catalog = {...scarf,...classic,...cave};
const images=import.meta.glob<string>('./assets/companion/*/*.png',{eager:true,query:'?url&no-inline',import:'default'});
const stickerImages=import.meta.glob<string>('./assets/chat-stickers/*/*.png',{eager:true,query:'?url&no-inline',import:'default'});
export const stickerIds=Object.keys({...scarf,...classic}) as StickerId[];
export const caveStickerIds=Object.keys(cave) as StickerId[];

function useStickerMotion(ref:React.RefObject<HTMLElement|null>,enabled:boolean){
 const [visible,setVisible]=useState(false);
 const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 const [active,setActive]=useState(()=>!document.hidden);
 useEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const change=()=>setReduced(media.matches);
  const visibility=()=>setActive(!document.hidden);
  const observer=new IntersectionObserver(entries=>setVisible(entries[0].isIntersecting));
  if(ref.current)observer.observe(ref.current);
  media.addEventListener('change',change);
  document.addEventListener('visibilitychange',visibility);
  return()=>{observer.disconnect();media.removeEventListener('change',change);document.removeEventListener('visibilitychange',visibility);};
 },[ref]);
 return enabled&&visible&&active&&!reduced;
}

export function StickerArt({id,alt,autoplay=false,preview=false,enabled=true}:{
 id:StickerId;alt?:string;autoplay?:boolean;preview?:boolean;enabled?:boolean;
}){
 const host=useRef<HTMLSpanElement>(null);
 const canPlay=useStickerMotion(host,enabled);
 const [play,setPlay]=useState(0);
 const autoPlayed=useRef(false);
 const [frame,setFrame]=useState<number>();
 const [unavailable,setUnavailable]=useState(false);
 const [decoded,setDecoded]=useState(false);
 const meta=catalog[id];
 const isCave=Object.hasOwn(cave,id);
 const series=isCave?cave[id as keyof typeof cave]:Object.hasOwn(scarf,id)?scarf[id as keyof typeof scarf]:undefined;
 const seriesUrl=(name:string)=>stickerImages[`./assets/chat-stickers/${isCave?'cave':'scarf'}/${name}`];
 const clip=Object.hasOwn(registry.clips,id)?registry.clips[id as keyof typeof registry.clips]:undefined;
 const frameCount=series?.frameCount??clip?.frames.length??0;
 const frameMs=series?.frameMs??(clip?1000/clip.fps:0);
 const atlas=series?seriesUrl(series.animation):undefined;
 useEffect(()=>{
  if(!autoplay)autoPlayed.current=false;
  if(autoplay&&canPlay&&!autoPlayed.current){autoPlayed.current=true;setPlay(run=>run+1);}
 },[autoplay,canPlay]);
 useEffect(()=>{
  if(!atlas||!canPlay||!play||decoded||unavailable)return;
  let live=true;
  const image=new Image();
  image.src=atlas;
  void image.decode().then(()=>{if(live)setDecoded(true);},()=>{if(live)setUnavailable(true);});
  return()=>{live=false;};
 },[atlas,canPlay,play,decoded,unavailable]);
 useEffect(()=>{
  if(!canPlay||!play||!frameCount||unavailable||(atlas&&!decoded)){setFrame(undefined);return;}
  let index=0;
  setFrame(index);
  const timer=setInterval(()=>{
   index++;
   if(index<frameCount)setFrame(index);
   else{clearInterval(timer);setFrame(undefined);setPlay(0);}
  },frameMs);
  return()=>clearInterval(timer);
 },[canPlay,play,frameCount,frameMs,unavailable,atlas,decoded]);
 useEffect(()=>{if(!canPlay)setPlay(0);},[canPlay]);
 if(!meta||(!clip&&!series))return <span className="sticker-fallback">{alt||'表情暂不可用'}</span>;
 const animated=canPlay&&frame!==undefined&&!unavailable;
 const description=alt??series?.alt??meta.label;
 const uri=series?seriesUrl(series.preview):clip&&'frame' in meta?
  images[`./assets/companion/${id}/${clip.frames[animated?frame:meta.frame-1]}`]:undefined;
 const picture=atlas&&animated?<span className="sticker-frame" role={preview?undefined:'img'}
  aria-hidden={preview||undefined} aria-label={preview?undefined:description}
  style={{backgroundImage:`url("${atlas}")`,backgroundPosition:`0 ${frame/(frameCount-1)*100}%`}}/>:
  uri?<img src={uri} alt={preview?'':description} draggable={false}
   onError={event=>{event.currentTarget.hidden=true;setUnavailable(true);}}/>:null;
 const body=picture&&!unavailable?picture:
  series&&picture?<>{picture}<span className="sticker-error">{meta.label}</span></>:
  <span className="sticker-fallback">{meta.label} · {meta.caption}</span>;
 return <span ref={host} className="sticker-art" data-sticker-id={id} data-sticker-frame={animated?frame:undefined}>
  {preview?body:<><button type="button" className="sticker-replay" aria-label={'重播'+meta.label+'表情'}
   disabled={!canPlay||unavailable} onClick={()=>setPlay(run=>run+1)}>{body}</button><span className="sticker-caption">{meta.caption}</span></>}
 </span>;
}
