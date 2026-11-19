import {useEffect,useState} from 'react';
import {Companion,CompanionProvider} from './Companion';
import {findOutfit} from './outfits';
import {useWindowDrag} from './windowDrag';
import {usePetClicks} from './usePetClicks';
import {usePetGaze} from './usePetGaze';
import type {RoamView} from './types';

const bridge=window.kanshan;
const idle={outfitId:'default',sleeping:false,action:'observe'};
export function RoamingCompanion(){
 const [view,setView]=useState<RoamView>(idle);
 const [cue,setCue]=useState(0);
 const clicks=usePetClicks(()=>void bridge?.roamChat());
 const {bindings,didDrag,dragging}=useWindowDrag('roam',clicks.dragAction,!view.sleeping&&view.motionEnabled!==false);
 const gaze=usePetGaze(!view.sleeping&&view.motionEnabled!==false&&!dragging);
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
 return <CompanionProvider appearance={view.appearance} outfit={findOutfit(view.outfitId)} sleeping={view.sleeping} action={view.action} enabled cue={cue} motion={view.motion} motionEnabled={view.motionEnabled} walkingGif={view.walkingGif} daydream={view.daydream&&!dragging} weather={view.weather} caveOutfit={view.caveOutfit} windowPose={view.windowPose} stillIdle preloadBase onError={ignore}>
  <button ref={gaze} type="button" className={`roam-character pet-piece pet-fox ${view.appearance==='fox'?'roam-fox-form':''} ${dragging?'is-dragging':''}`}
   aria-label="和刘看山聊聊，或拖动刘看山" aria-haspopup="menu" {...bindings}
   onPointerDown={event=>{if(event.button===0&&event.isPrimary&&!event.ctrlKey)void bridge?.roamPress(true);bindings.onPointerDown(event);}}
   onPointerUp={event=>{bindings.onPointerUp(event);if(event.button===0&&event.isPrimary)void bridge?.roamPress(false);}}
   onPointerCancel={()=>{bindings.onPointerCancel();void bridge?.roamPress(false);}}
   onLostPointerCapture={()=>{bindings.onLostPointerCapture();void bridge?.roamPress(false);}}
   onContextMenu={clicks.openMenu}
   onKeyDown={clicks.menuKey}
   onClick={event=>{if(!event.ctrlKey&&!didDrag(event.detail))clicks.pick(event.detail);}}>
   <span className="pet-contact" aria-hidden="true"/><Companion action={view.action}
    gesture={clicks.gesture??(view.action==='lift'||view.action==='land'?view.action:undefined)}/>
  </button>
 </CompanionProvider>;
}
function ignore(){}
