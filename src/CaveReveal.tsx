import {useEffect,useRef,useState} from 'react';
import film from './assets/cave/reveal.mp4?url&no-inline';
import './cave-reveal.css';

export function CaveReveal({onClose,onPersonRevealed}:{onClose:()=>void;onPersonRevealed:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const player=useRef<HTMLVideoElement>(null);
 const [failed,setFailed]=useState(false);
 const reportedReveal=useRef(false);
 function reportReveal(){
  const video=player.current!;
  if(reportedReveal.current||video.seeking||video.currentTime<2.5)return;
  const played=video.played;
  if(!played.length||played.start(0)>.2||played.end(0)<2.5)return;
  reportedReveal.current=true;
  onPersonRevealed();
 }
 useEffect(()=>{
  const modal=dialog.current!;
  const video=player.current!;
  let active=true;
  modal.showModal();
  void video.play().catch(()=>{if(active)setFailed(true);});
  return()=>{
   active=false;
   video.pause();
   modal.close();
  };
 },[]);
 return <dialog ref={dialog} className="cave-reveal" aria-label="山洞换装间"
  onCancel={event=>{event.preventDefault();onClose();}}
  onKeyDown={event=>{if(event.key==='Escape')event.stopPropagation();}}>
  <video ref={player} src={film} playsInline aria-label="刘看山的山洞彩蛋"
   onTimeUpdate={reportReveal} onEnded={()=>{reportReveal();onClose();}} onError={()=>setFailed(true)}/>
  <button type="button" autoFocus className="cave-reveal-close" onClick={onClose}>离开</button>
  {failed&&<p role="alert">暂时无法播放山洞彩蛋。</p>}
 </dialog>;
}
