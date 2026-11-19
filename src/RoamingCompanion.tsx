import {useEffect,useState} from 'react';
import {Companion,CompanionProvider} from './Companion';
import {findOutfit} from './outfits';
import {useWindowDrag} from './windowDrag';
import {usePetClicks} from './usePetClicks';
import {usePetGaze} from './usePetGaze';
import {useCheekGesture} from './useCheekGesture';
import {DesktopKnockArt,useDesktopKnock} from './DesktopKnock';
import {useListening} from './useListening';
import type {RoamView} from './types';

const bridge=window.kanshan;
const idle={outfitId:'default',sleeping:false,action:'observe'};
export function RoamingCompanion(){
 const [view,setView]=useState<RoamView>(idle);
 const [cue,setCue]=useState(0);
 const clicks=usePetClicks(()=>void bridge?.roamChat());
 const {bindings,didDrag,dragging}=useWindowDrag('roam',clicks.dragAction,!view.sleeping&&view.motionEnabled!==false);
 const {status:listening}=useListening();
 const interactive=!view.sleeping&&view.motionEnabled!==false&&!dragging&&!view.windowPose;
 const gaze=usePetGaze(interactive);
 const knock=useDesktopKnock(interactive,listening,clicks.interrupt);
 const cheek=useCheekGesture(interactive&&!knock.active,()=>clicks.pick(1),clicks.interrupt);
 useEffect(()=>{
  const view=bridge?.onRoamView(value=>{setView(value);setCue(previous=>previous+1);});
  const probe=bridge?.onProbe(point=>{
   if(!point.id)return;
   const active=Boolean(document.elementFromPoint(point.x,point.y)?.closest('.roam-character'));
   void bridge?.roamHit({id:point.id,active});
  });
  void bridge?.roamReady();
  return()=>{view?.();probe?.();};
 },[]);
 return <CompanionProvider appearance={view.appearance} outfit={findOutfit(view.outfitId)} sleeping={view.sleeping} action={view.action} enabled cue={cue} motion={view.motion} motionEnabled={view.motionEnabled} daydream={view.daydream&&!dragging} weather={view.weather} caveOutfit={view.caveOutfit} humanWeather={view.humanWeather} weatherUnlocked={view.weatherUnlocked} windowPose={view.windowPose} stillIdle onError={ignore}>
  <button ref={gaze} type="button" className={`roam-character pet-piece pet-fox ${view.appearance==='fox'?'roam-fox-form':''} ${dragging?'is-dragging':''}`}
   aria-label={knock.active?'敲一下刘看山，双指双点或 Escape 退出':'和刘看山互动，可双击打开聊天'} aria-haspopup="menu" title="单击互动，双击打开聊天"
   onPointerDown={event=>{if(event.button===0&&event.isPrimary&&!event.ctrlKey)void bridge?.roamPress(true);if(!cheek.down(event))bindings.onPointerDown(event);}}
   onPointerMove={event=>{if(!cheek.move(event))bindings.onPointerMove(event);}}
   onPointerLeave={cheek.leave}
   onPointerUp={event=>{if(!cheek.up(event))bindings.onPointerUp(event);if(event.button===0&&event.isPrimary)void bridge?.roamPress(false);}}
   onPointerCancel={event=>{if(!cheek.cancel(event))bindings.onPointerCancel();void bridge?.roamPress(false);}}
   onLostPointerCapture={event=>{if(!cheek.cancel(event))bindings.onLostPointerCapture();void bridge?.roamPress(false);}}
   onContextMenu={knock.contextMenu} data-knocking={knock.active||undefined} data-striking={knock.striking||undefined}
   onKeyDown={event=>{if(knock.active&&event.repeat&&(event.key===' '||event.key==='Enter'))event.preventDefault();else clicks.menuKey(event);}}
   onClick={event=>{if(event.ctrlKey||cheek.skipClick(event.detail)||didDrag(event.detail))return;if(knock.active)knock.hit();else clicks.pick(event.detail);}}>
   <span className="pet-contact" aria-hidden="true"/><Companion action={view.action}
    cheek={cheek.pose} faceEnabled={interactive&&!knock.active} listening={interactive?listening:undefined}
    gesture={knock.striking?'knock':clicks.gesture??(view.action==='lift'||view.action==='land'?view.action:undefined)}/>
   <DesktopKnockArt {...knock}/>
   {cheek.hint&&<span className="pet-cheek-hint">按住，轻轻往外拉</span>}
  </button>
 </CompanionProvider>;
}
function ignore(){}
