import {useEffect,useRef,useState,type PointerEvent} from 'react';
import {unwrap,type MinesRect,type MinesState} from './types';
import './mines-companion.css';

const bridge=window.kanshan;
function useMines(){
 const [state,set]=useState<MinesState>({status:'idle',enabled:true});
 useEffect(()=>{
  let current=true;
  const off=bridge?.onMines(set);
  if(bridge)void unwrap(bridge.minesStatus()).then(value=>{if(current)set(value);}).catch(()=>{});
  return()=>{current=false;off?.();};
 },[]);
 return state;
}

export function MinesSettings(){
 const state=useMines();
 const [error,setError]=useState('');
 const [pending,setPending]=useState(false);
 async function enable(value:boolean){
  if(!bridge)return;
  setPending(true);setError('');
  try{await unwrap(bridge.minesEnable(value));}
  catch(e){setError((e as Error).message);}
  finally{setPending(false);}
 }
 return <fieldset className="mines-settings">
  <legend>扫雷陪玩</legend>
  <label><input type="checkbox" checked={state.enabled} disabled={pending} onChange={event=>void enable(event.currentTarget.checked)}/> 打开 Minesweeper 时自动陪玩</label>
  <p>Minesweeper 3.0.0 · 自动观察可见棋盘</p>
  {(state.needsPermission||state.status==='permission')&&<button type="button" onClick={()=>void bridge?.minesPermission()}>打开屏幕录制权限设置</button>}
  {error&&<p role="alert">{error}</p>}
 </fieldset>;
}

function Calibration({src,onSave}:{src:string;onSave:(rect:MinesRect)=>void}){
 const start=useRef<{x:number;y:number}|null>(null);
 const [selection,set]=useState<MinesRect>();
 function point(e:PointerEvent<HTMLDivElement>){
  const rect=e.currentTarget.getBoundingClientRect();
  const clamp=(v:number)=>Math.min(1,Math.max(0,v));
  return {x:clamp((e.clientX-rect.left)/rect.width),y:clamp((e.clientY-rect.top)/rect.height)};
 }
 function drag(e:PointerEvent<HTMLDivElement>){
  if(!start.current)return;
  const a=start.current,b=point(e);
  set({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)});
 }
 return <div className="mines-calibration">
  <div onPointerDown={e=>{
   if(e.button!==0)return;
   start.current=point(e);set(undefined);e.currentTarget.setPointerCapture(e.pointerId);
  }} onPointerMove={drag} onPointerUp={e=>{drag(e);start.current=null;}} onPointerCancel={()=>{start.current=null;set(undefined);}}>
   <img src={src} alt="扫雷窗口预览" draggable={false}/>
   {selection&&<span style={{left:selection.x*100+'%',top:selection.y*100+'%',width:selection.width*100+'%',height:selection.height*100+'%'}}/>}
  </div>
  <button type="button" disabled={!selection||selection.width<.2||selection.height<.2} onClick={()=>selection&&onSave(selection)}>保存棋盘范围</button>
 </div>;
}

export function MinesCompanion(){
 const state=useMines();
 const [error,setError]=useState(''),[frame,setFrame]=useState('');
 const [online,setOnline]=useState(false);
 const task=useRef(0);
 useEffect(()=>{
  task.current++;
  setError('');setOnline(false);
  if(state.status!=='calibration')setFrame('');
 },[state.status,state.turn]);
 async function run<T>(call:()=>Promise<T>,accept?:(value:T)=>void){
  const version=++task.current;
  try{const value=await call();if(version===task.current)accept?.(value);}
  catch(e){if(version===task.current)setError((e as Error).message);}
 }
 if(!bridge)return null;
 const {status,rows,columns,notice,hint,board,opened,flags,level,explanation,result,review}=state;
 return <aside className="mines-sidecar" aria-label="扫雷陪玩" data-status={status}>
  <header><strong>雪地探路</strong><span>{status==='ready'?`${rows} × ${columns}`:'扫雷陪玩'}</span></header>
  {notice&&<p className="mines-notice">{notice}</p>}
  {status==='calibration'&&(frame?<Calibration src={frame} onSave={rect=>void run(()=>unwrap(bridge.minesCalibrate(rect)),()=>setFrame(''))}/>:
   <button type="button" onClick={()=>void run(()=>unwrap(bridge.minesFrame()),v=>setFrame('data:image/png;base64,'+v.image))}>框选棋盘</button>)}
  {status==='locating'&&<p>正在核对最新棋盘。</p>}
  {status==='ready'&&<>
   <p className="mines-counts">已翻开 {opened} 格 · 已标记 {flags} 格</p>
   {result==='lost'&&review&&!hint&&<button type="button" onClick={()=>void run(()=>unwrap(bridge.minesAdvice(2)))}>看看刚才的线索</button>}
   {(!result||result==='lost'&&review&&hint)&&<div className="mines-levels">
    {(['给点线索','讲详细一点','告诉我下一步'] as const).map((name,i)=><button type="button" key={name}
     aria-pressed={level===i+1} onClick={()=>void run(()=>unwrap(bridge.minesAdvice((i+1) as 1|2|3)))}>{name}</button>)}
   </div>}
   {hint&&<div className="mines-proof">
    <p>{hint.text}</p>
    {!!board&&!!columns&&hint.clues.length>0&&<div className="mines-mini" aria-label="提示所依据的可见棋盘"
     style={{gridTemplateColumns:`repeat(${columns}, minmax(3px,1fr))`}}>
     {board.map((cell,index)=><span key={index} data-clue={hint.clues.includes(index)||undefined}
      data-area={hint.area.includes(index)||undefined} data-result={hint.cell===index?hint.kind:undefined}>
      {typeof cell==='number'?cell||'':cell==='flag'?'⚑':cell==='?'?'?':'·'}</span>)}
    </div>}
    {!result&&<button type="button" className="mines-link" onClick={()=>setOnline(!online)}>为什么？</button>}
    {online&&<div className="mines-online">
     <button type="button" onClick={()=>void run(()=>unwrap(bridge.minesExplain({question:'为什么这一步成立？',consent:true})))}>授权并问聊天服务</button>
     <small>发送当前本地依据和本次问题。</small>
    </div>}
    {explanation&&<p>{explanation}</p>}
   </div>}
  </>}
  {error&&<p role="alert">{error}</p>}
  {(status==='ready'||status==='calibration'||status==='locating')&&<footer>
   <button className="mines-link" type="button" onClick={()=>void run(()=>unwrap(bridge.minesMute()))}>这次先不用</button>
   <button className="mines-link" type="button" onClick={()=>void run(()=>unwrap(bridge.minesEnable(false)))}>关闭自动陪玩</button>
  </footer>}
 </aside>;
}
