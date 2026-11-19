import {useEffect,useId,useRef,useState,type KeyboardEvent,type ReactNode} from 'react';
import {Companion} from './Companion';
import {MusicButtons} from './MusicButtons';
import {unwrap,type ListeningStatus,type PetAppearance} from './types';
import './pet-interactions.css';

function InteractionCard({title,onClose,children}:{
 title:string;onClose:()=>void;children:ReactNode;
}){
 const top=useRef<HTMLElement>(null);
 const close=useRef<HTMLButtonElement>(null);
 const titleId=useId();
 useEffect(()=>{
  const previous=document.activeElement;
  close.current?.focus();
  return()=>{if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};
 },[]);
 function keys(event:KeyboardEvent<HTMLElement>){
  if(event.key==='Escape'){event.stopPropagation();onClose();return;}
  if(event.key!=='Tab')return;
  const items=[...(top.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')??[])];
  const first=items[0],last=items.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 }
 return <div className="pet-interaction-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
  <section ref={top} className="pet-interaction-card" role="dialog" aria-modal="true"
   aria-labelledby={titleId} onKeyDown={keys}>
   <header><div><h2 id={titleId}>{title}</h2></div>
    <button type="button" aria-label="收起" ref={close} onClick={onClose}>×</button>
   </header>
   {children}
  </section>
 </div>;
}

export function ListeningPanel({status,appearance,choose,onClose}:{
 status:ListeningStatus;appearance:PetAppearance;choose:(mode:'manual'|'off')=>Promise<void>;onClose:()=>void;
}){
 const music=useRef<HTMLAudioElement>(null);
 const [playing,setPlaying]=useState(false);
 const [volume,setVolume]=useState(20);
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const pending=useRef(false);
 useEffect(()=>{if(music.current)music.current.volume=volume/100;},[volume]);
 useEffect(()=>{
  const player=music.current;
  return()=>{player?.pause();};
 },[]);
 useEffect(()=>{music.current?.pause();},[status.route, status.mode]);
 async function run(task:()=>Promise<void>){
  if(pending.current)return;
  pending.current=true;setBusy(true);setNotice('');
  try{await task();}catch(error){setNotice((error as Error).message);}finally{pending.current=false;setBusy(false);}
 }
 function action(kind:'sample'|'file'|'open'){
  void run(async()=>{
   if(kind==='sample'){
    const player=music.current;
    if(!player)return;
    if(!player.paused){player.pause();return;}
    await player.play();
    return;
   }
   if(!window.kanshan)throw Error('请通过桌面应用打开 QQ 音乐。');
   const result=await unwrap(window.kanshan.sleepMusic(kind));
   if(result.state!=='cancelled')setNotice('已交给 QQ 音乐，可在客户端操作播放。');
  });
 }
 const caption=status.mode==='manual'?'手动陪听 · 陪你听一会儿':
  status.output==='headphones'?'耳机已连接 · 当前使用耳机输出':
  status.output==='other'?'当前输出为扬声器或其他设备':'暂无法识别当前输出';
 return <InteractionCard title="一起听一会儿" onClose={onClose}>
  <div className="listen-stage" data-listening-mode={status.mode}>
   <div className="listen-portrait"><Companion listening={status}/></div>
   <div className="listen-note" aria-hidden="true">♪</div>
  </div>
  <p className="listen-status" role="status">{caption}</p>
  {appearance==='classic'&&status.mode!=='off'&&<p className="pet-interaction-muted">狐狸 Q 版和人版支持戴耳机表情。</p>}
  <audio ref={music} src="./room/night-music.wav" preload="none"
   onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)}/>
  <MusicButtons busy={busy} onAction={action} sampleLabel={playing?'暂停林间夜曲':'播放林间夜曲'}/>
  <label className="pet-interaction-slider">夜曲音量 <input type="range" min="0" max="40" value={volume} onChange={event=>setVolume(event.currentTarget.valueAsNumber)}/></label>
  {notice&&<p className="pet-interaction-muted" role="status">{notice}</p>}
  <footer>
   {status.mode==='off'?<button type="button" disabled={busy} onClick={()=>void run(()=>choose('manual'))}>手动戴上耳机</button>:
    <button type="button" disabled={busy} onClick={()=>void run(()=>choose('off'))}>摘下耳机</button>}
   <button type="button" onClick={()=>{
    music.current?.pause();
    if(status.mode==='off')onClose();
    else void run(async()=>{await choose('off');onClose();});
   }}>结束陪听</button>
  </footer>
 </InteractionCard>;
}
