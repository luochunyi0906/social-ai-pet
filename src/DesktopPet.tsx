import {useEffect,useRef,type CSSProperties,type Dispatch,type PointerEvent,type ReactNode,type SetStateAction} from 'react';
import {Companion} from './Companion';
import {DESKTOP_SIZE,PIECES,placePiece} from './shared/layout.mjs';
import {useWindowDrag} from './windowDrag';
import {snowyArt,SnowyGround,SnowyProp} from './snowy-art';
import {Snowfall} from './Snowfall';
import {usePetClicks} from './usePetClicks';
import {usePetGaze} from './usePetGaze';
import {shakeDetector} from './shared/mouse-gesture.mjs';
import type {WeatherStatus} from './types';
import './desktop-pet.css';

export {DEFAULT_PLACES} from './shared/layout.mjs';

const bridge=window.kanshan;
const propLabels = {
 garden:{ title:'好奇心花园', label:'打开好奇心花园，可拖动花箱' },
 cave:{ title:'好奇心山洞', label:'打开山洞，可拖动山洞' },
 feed:{ title:'投喂线索', label:'投喂文字或文件，可拖动投喂箱' }
} as const;
type PlaceKey=keyof typeof PIECES;
type PropKey=keyof typeof propLabels;
type Point={x:number;y:number};
type Places=Record<string,Point>;
type Drag={key:PropKey;pointer:number;start:Point;origin:Point;moved:boolean;blocked:boolean};

function Caption({title,location,context=false}:{title:string;location:{x:number;y:number;w:number};context?:boolean}){
 return <span className={`pet-caption ${context?'pet-caption-context':''}`} style={{top:location.y,left:location.x,width:location.w}} aria-hidden="true">{title}</span>;
}

export function DesktopPet({action,reason,onOpen,onInteraction,paused,quiet,sleeping,onWake,snow,places,setPlaces,hotReminder,hotNotice,onHot,away,invitation,weather}:{
 action:string;reason:string;onOpen:(name:string)=>void;onInteraction:(kind:string)=>void;
 paused:boolean;quiet:boolean;sleeping:boolean;onWake:()=>void;snow:boolean;places:Places;setPlaces:Dispatch<SetStateAction<Places>>;
 hotReminder?:boolean;hotNotice?:boolean;onHot?:()=>void;
 away?:boolean;invitation?:ReactNode;weather?:WeatherStatus;
}){
 const clicks=usePetClicks(()=>onOpen('camp'),onInteraction);
 const windowDrag=useWindowDrag('roam',clicks.dragAction,!paused&&!sleeping);
 const gaze=usePetGaze(!paused&&!quiet&&!sleeping&&!away&&!windowDrag.dragging);
 const campDrag=useWindowDrag('pet');
 const drag=useRef<Drag|null>(null);
 const suppress=useRef(false);
 const shake=useRef(shakeDetector());
 const captureTimer=useRef<ReturnType<typeof setInterval>|null>(null);
 function endChase(){
  shake.current.reset();
  void bridge?.chaseStop();
 }

 function releaseCapture(){
  if(captureTimer.current)clearInterval(captureTimer.current);
  captureTimer.current=null;
  void bridge?.capture(false);
 }

 function endPropDrag(){
  if(!drag.current)return;
  suppress.current=drag.current.moved;
  drag.current=null;
  releaseCapture();
 }

 useEffect(()=>{
  window.addEventListener('blur',endPropDrag);
  return()=>{window.removeEventListener('blur',endPropDrag);endPropDrag();};
 },[]);

 function down(event:PointerEvent<HTMLButtonElement>,key:PropKey){
  if(event.button!==0||!event.isPrimary)return;
  suppress.current=false;
  drag.current={key,pointer:event.pointerId,start:{x:event.clientX,y:event.clientY},origin:places[key],moved:false,blocked:false};
  event.currentTarget.setPointerCapture(event.pointerId);
  void bridge?.capture(true);
  if(captureTimer.current)clearInterval(captureTimer.current);
  captureTimer.current=setInterval(()=>void bridge?.capture(true),2000);
 }

 function move(event:PointerEvent<HTMLButtonElement>){
  const current=drag.current;
  if(!current||current.pointer!==event.pointerId)return;
  const dx=event.clientX-current.start.x,dy=event.clientY-current.start.y;
  if(!current.moved&&Math.hypot(dx,dy)<5)return;
  current.moved=true;
  const result=placePiece(places,current.key,{x:current.origin.x+dx,y:current.origin.y+dy});
  current.blocked=result.blocked;
  if(!result.blocked)setPlaces(result.places);
 }

 function up(event:PointerEvent<HTMLButtonElement>){
  if(drag.current?.pointer!==event.pointerId)return;
  if(drag.current.blocked)onInteraction('layout-blocked');
  endPropDrag();
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
 }

 function spot(key:PlaceKey):CSSProperties {
  const piece=PIECES[key];
  return {left:places[key].x,top:places[key].y,width:piece.w,height:piece.h,'--pet-art-height':`${piece.body}px`} as CSSProperties;
 }

 function prop(key:PropKey){
  const art=snowyArt[key],labels=propLabels[key],size=PIECES[key];
  return <button type="button" className={`pet-piece pet-object pet-${key}`} data-hit aria-label={labels.label} style={spot(key)}
   onPointerDown={event=>down(event,key)} onPointerMove={move} onPointerUp={up} onPointerCancel={endPropDrag}
   onLostPointerCapture={endPropDrag} onPointerEnter={key==='garden'?()=>onInteraction('gardenlook'):undefined} onClick={event=>{
    if(suppress.current&&event.detail!==0){suppress.current=false;return;}
    onOpen(key);
   }}>
   <span className="pet-contact" aria-hidden="true"/>
   <span className="pet-art" aria-hidden="true">
    <SnowyProp name={key}/>
    {key==='cave'&&<span className="pet-lantern"/>}
   </span>
   <svg className="pet-hit" viewBox={art.viewBox} aria-hidden="true"><path d={art.path}/></svg>
   <Caption title={labels.title} location={size.label}/>
  </button>;
 }

 return <div className={`desktop-pet ${paused?'paused':''} ${quiet?'quiet':''} ${sleeping?'sleeping':''} ${campDrag.dragging?'camp-dragging':''}`} aria-label="刘看山的林间营地" style={DESKTOP_SIZE}
  onPointerDownCapture={event=>{if(event.button===0&&event.isPrimary&&!event.ctrlKey){endChase();void bridge?.roamPress(true);}}}
  onPointerUpCapture={event=>{if(event.button===0&&event.isPrimary)void bridge?.roamPress(false);}}
  onPointerCancelCapture={event=>{if(event.isPrimary)void bridge?.roamPress(false);}}
  onLostPointerCaptureCapture={()=>void bridge?.roamPress(false)}>
  <SnowyGround {...campDrag.bindings} onPointerLeave={endChase} onPointerMove={event=>{
   campDrag.bindings.onPointerMove(event);
   if(!weather?.prefs.chase||paused||quiet||sleeping||event.buttons)return;
   if(shake.current.sample(event.clientX,event.clientY,performance.now()))void bridge?.chaseStart();
  }}/>
  {snow&&!paused&&!quiet&&!sleeping&&<Snowfall surface="pet"/>}
  <div className="pet-weather" role="status" aria-label="今日气温">
   {weather?.observation?.temperature!==undefined
    ?<>今日 <strong>{Math.round(weather.observation.temperature)}°C</strong></>
    :weather?.problem||weather?.observation?'暂无气温':'气温更新中'}
  </div>
  {hotReminder&&<button type="button" className={'pet-hot-reminder '+(hotNotice?'pet-hot-bubble':'')} data-hit
   aria-label="查看今日热榜" title="今日热榜已到" onClick={onHot}>{hotNotice?'今日热榜已到':'•'}</button>}
  <button ref={gaze} type="button" className={`pet-piece pet-fox ${windowDrag.dragging?'is-dragging':''} ${away?'is-away':''}`} data-hit
   aria-label="和刘看山互动，可双击打开营地" aria-haspopup="menu" title="单击互动，双击打开营地" style={spot('fox')} {...windowDrag.bindings}
   onPointerEnter={()=>{if(!windowDrag.dragging)onInteraction('look');}}
   onContextMenu={clicks.openMenu}
   onKeyDown={clicks.menuKey}
   onClick={event=>{if(event.ctrlKey||windowDrag.didDrag(event.detail))return;clicks.pick(event.detail);}}>
   <span className="pet-contact" aria-hidden="true"/>
   <Companion action={action} gesture={clicks.gesture}/>
   <Caption title="刘看山" location={PIECES.fox.label} context/>
  </button>
  {prop('garden')}
  {prop('cave')}
  {prop('feed')}
  <button type="button" className="pet-camp-grip" data-hit aria-label="拖动营地" title="拖动手柄或雪地可单独移动营地" {...campDrag.bindings}>⠿</button>
  {invitation}
  {sleeping&&<button type="button" className="pet-wake" data-hit onClick={onWake} aria-label="叫醒刘看山">休息中 · 叫醒</button>}
  {!sleeping&&<div className={`pet-status ${paused||quiet?'pet-status-visible':''}`} aria-live="polite">{paused?'已暂停':quiet?'低打扰':reason}</div>}
 </div>;
}
