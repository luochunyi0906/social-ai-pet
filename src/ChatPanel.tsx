import { FeatureGuide } from './FeatureGuide';
import {catalog,stickerIds,caveStickerIds,StickerArt} from './ChatSticker';
import './chat-stickers.css';
import {useActorEvents} from './ActorAnimation';
import {useEffect,useRef,useState} from 'react';
import {Companion} from './Companion';
import {QuestionAnswers,questionOrigin} from './QuestionAnswers';
import {TeachingPanel} from './TeachingPanel';
import {unwrap,type ChatState,type ChatStatus,type ChatTurn,type Favorite,type Post,type StickerId,type TeachingRecord,type TeachingRef} from './types';

const bridge=window.kanshan;
const turnLabels={pending:'等待回复',complete:'',failed:'发送失败',cancelled:'已停止'};

export function ChatPanel({source,onClose,onSpeech,onActivity,actorAction,windowVisible,freshOpening,favorites,
 initialFavorite,initialSession,initialLesson,onFavorite,onLesson}:{
 source:Post|null;onClose:()=>void;onSpeech:(text:string,tone:string)=>void;onActivity:(kind:string)=>void;actorAction:string;
 windowVisible:boolean;freshOpening?:string;favorites:Favorite[];initialFavorite?:string;initialSession?:string;initialLesson?:string;
 onFavorite:(id:string)=>void;onLesson:(id:string)=>void;
}){
 const actor=useActorEvents();
 const [message,setMessage]=useState('');
 const [agree,setAgree]=useState(false);
 const [error,setError]=useState('');
 const [progress,setProgress]=useState<{messageId:string;text:string}>();
 const [autoSticker,setAutoSticker]=useState<boolean>();
 const [savingStickerPref,setSavingStickerPref]=useState(false);
 const [picker,setPicker]=useState(false);
 const [caveReward,setCaveReward]=useState(false);
 const [stickerShelf,setStickerShelf]=useState<'regular'|'cave'>('regular');
 const [selected,setSelected]=useState<StickerId>();
 const [fresh,setFresh]=useState<string>();
 const [openingAnimation,setOpeningAnimation]=useState(freshOpening);
 const following=useRef(true);
 const [status,setStatus]=useState<ChatStatus>();
 const [state,setState]=useState<ChatState>();
 const [teachingOpen,setTeachingOpen]=useState(Boolean(initialFavorite));
 const [teachingRecords,setTeachingRecords]=useState<TeachingRecord[]>([]);
 const [pending,setPending]=useState<{messageId:string;message:string;draft?:string}|null>(null);
 const [changing,setChanging]=useState(false);
 const request=useRef<string|null>(null);
 const transition=useRef(false);
 const alive=useRef(false);
 const lines=useRef<HTMLDivElement>(null);

 useEffect(()=>{
  alive.current=true;
  if(bridge){
   const client=bridge;
   void Promise.all([unwrap(initialSession?client.changeChat('select',initialSession):client.chatState()),unwrap(client.chatStatus())]).then(([conversation,config])=>{
    if(alive.current){setState(conversation);setStatus(config);}
   }).catch((problem:Error)=>{if(alive.current)setError(problem.message);});
   void unwrap(client.stickerSettings()).then(value=>{if(alive.current)setAutoSticker(value);}).catch(e=>{if(alive.current)setError(e.message);});
   void unwrap(client.caveStickerStatus()).then(value=>{if(alive.current)setCaveReward(value);}).catch(e=>{if(alive.current)setError(e.message);});
  }else setError('请在桌宠应用中打开对话。');
  const unsubscribe=bridge?.onChatProgress(({id,messageId,text})=>{
   if(request.current!==id||!text)return;
   setProgress({messageId,text});
   actor.request('chat',id,false);
  });
  return()=>{
   unsubscribe?.();
   alive.current=false;
   const id=request.current;
   request.current=null;
   if(id){actor.request('chat',id,false);void bridge?.cancel(id);}
  };
 },[]);
 useEffect(()=>{
  if(!bridge?.teachingList||!state?.activeId||teachingOpen)return;
  let active=true;
  void unwrap(bridge.teachingList()).then(items=>{if(active)setTeachingRecords(items);}).catch(()=>{});
  return()=>{active=false;};
 },[state?.activeId,teachingOpen]);
 useEffect(()=>{
  if(!windowVisible)setTeachingOpen(false);
 },[windowVisible]);

 useEffect(()=>{
  const element=lines.current;
  if(element&&following.current)element.scrollTop=element.scrollHeight;
  if(initialLesson&&!teachingOpen)element?.querySelector('[data-lesson-id="'+CSS.escape(initialLesson)+'"]')?.scrollIntoView({block:'nearest'});
 },[state,pending,progress,picker,teachingRecords,teachingOpen]);

 async function moveConversation(mode:'new'|'select'|'clear'|'stop',id?:string){
  if(!bridge||transition.current)return;
  transition.current=true;
  setChanging(true);
  setTeachingOpen(false);
  setError('');
  setAgree(false);
  setFresh(undefined);
  setOpeningAnimation(undefined);
  setProgress(undefined);
  following.current=true;
  const stopping=request.current;
  request.current=null;
  try{
   if(stopping){
    actor.request('chat',stopping,false);
    await unwrap(bridge.cancel(stopping));
    if(alive.current)onActivity('idle');
   }
   const conversation=await unwrap(mode==='stop'?bridge.chatState():bridge.changeChat(mode,id));
   if(alive.current){
    setState(conversation);
    if(mode!=='stop')setMessage('');
    else if(pending?.draft!==undefined&&!conversation.turns.some(turn=>turn.user.id===pending.messageId))setMessage(pending.draft);
   }
  }catch(problem){
   if(alive.current){
    if(pending?.draft!==undefined)setMessage(pending.draft);
    setError((problem as Error).message);
   }
  }finally{
   transition.current=false;
   if(alive.current){setChanging(false);setPending(null);}
  }
 }

 async function send(retry?:ChatTurn){
  if(!bridge||request.current||transition.current||savingStickerPref||!status||!state)return;
  const consent=status.managed||agree;
  if(!consent)return;
  const text=retry?.user.content||message.trim();
  if(!text)return;
  const id=crypto.randomUUID();
  const messageId=retry?.user.id||crypto.randomUUID();
  const draft=retry?undefined:message;
  request.current=id;
  following.current=true;
  setFresh(undefined);
  setProgress(undefined);
  setPicker(false);
  setPending({messageId,message:text,draft});
  if(draft!==undefined)setMessage('');
  setAgree(false);
  setError('');
  actor.request('chat',id,true);
  onActivity('thinking');
  try{
   const result=await unwrap(bridge.chat({
    id,messageId,sessionId:state.activeId,configId:status.configId,consent,stream:true,
    ...(retry?{}:{message:text,sourceId:source?.id})
   }));
   if(!alive.current||request.current!==id)return;
   setProgress(undefined);
   const recorded=result.state.turns.find(turn=>turn.user.id===messageId);
   setFresh(recorded?.assistant?.id);
   setState(result.state);
   if(!recorded&&draft!==undefined)setMessage(draft);
   if(result.reply)onSpeech(result.reply.text,result.reply.tone);
   else onActivity(result.state.turns.at(-1)?.state==='failed'?'oops':'idle');
  }catch(problem){
   if(alive.current&&request.current===id){
    if(draft!==undefined){
     const history=await bridge.chatState().catch(()=>null);
     if(!alive.current||request.current!==id)return;
     if(history?.ok)setState(history.data);
     if(!history?.ok||!history.data.turns.some(turn=>turn.user.id===messageId))setMessage(draft);
    }
    setError((problem as Error).message);
    onActivity('oops');
   }
  }finally{
   actor.request('chat',id,false);
   if(request.current===id){
    request.current=null;
    if(alive.current){setPending(null);setProgress(undefined);}
   }
  }
 }

 async function saveAutoSticker(enabled:boolean){
  if(!bridge||savingStickerPref)return;
  const previous=autoSticker;
  setSavingStickerPref(true);
  setAutoSticker(enabled);
  try{setAutoSticker(await unwrap(bridge.saveStickerSettings(enabled)));}
  catch(problem){setAutoSticker(previous);setError((problem as Error).message);}
  finally{setSavingStickerPref(false);}
 }
 async function sendManualSticker(){
  if(!bridge||!selected||!state||request.current||transition.current)return;
  transition.current=true;
  setChanging(true);
  setError('');
  try{
   const messageId=crypto.randomUUID();
   const updated=await unwrap(bridge.sendSticker({sessionId:state.activeId,messageId,stickerId:selected}));
   if(alive.current){
    following.current=true;
    setFresh(messageId);setState(updated);setPicker(false);setSelected(undefined);setAgree(false);
   }
  }catch(problem){if(alive.current)setError((problem as Error).message);}
  finally{transition.current=false;if(alive.current)setChanging(false);}
 }

 const latest=state?.turns.at(-1);
 const retry=latest&&(latest.state==='failed'||latest.state==='cancelled')?latest:undefined;
 const working=!!pending||changing;
 const ready=!!status&&!!state;
 const canSend=ready&&!working&&!savingStickerPref&&(status?.managed||agree);
 const displayed=state?.turns||[];
 const question=questionOrigin(source?.url??state?.opening?.source?.url);
 function referencedCard(ref:TeachingRef){
  const record=teachingRecords.find(item=>item.id===ref.id);
  if(!record)return null;
  if(record.status==='deleted')return <small key={ref.id} className="teaching-note">关联学习记录已删除</small>;
  const label=record.status==='inactive'?'关联学习卡已停用':record.revision!==ref.revision?'关联学习卡已更新':'用到了你教过的方法';
  return <button key={ref.id} className="chat-teaching-reference" title={record.card.topic} onClick={()=>onLesson(record.id)}>{label}</button>;
 }
 return <div className="modal-backdrop"><section className="modal chat-modal" role="dialog" aria-modal="true" aria-labelledby="chat-title" data-hit>
  <button className="modal-close" aria-label="关闭对话" onClick={onClose}>×</button>
  {!teachingOpen&&<p className="eyebrow">A MOMENT TOGETHER</p>}
  <h2 id="chat-title">{teachingOpen?'今天你来当老师':'说一点你正想着的事'}</h2>
  <FeatureGuide key={teachingOpen ? "teaching" : "chat"} feature={teachingOpen ? "teaching" : "chat"} openFirst={teachingOpen}/>
  <div className="chat-top">
   <div className="modal-companion"><Companion action={actorAction}/><p>{teachingOpen?'我先听你讲。':pending&&!progress?'先想清楚，再回答。':'我在，慢慢说。'}</p></div>
   <div className="chat-session-controls">
   <label>会话 <select aria-label="切换会话" disabled={!state||changing} value={state?.activeId||''} onChange={event=>void moveConversation('select',event.target.value)}>
    {!state&&<option value="">读取中…</option>}
    {state?.sessions.map((entry,index)=><option key={entry.id} value={entry.id}>会话 {index+1}</option>)}
   </select></label>
   <button disabled={!state||changing} onClick={()=>void moveConversation('new')}>新建会话</button>
   {!teachingOpen&&<button disabled={!state||working||!bridge?.teachingStart} onClick={()=>{setPicker(false);setTeachingOpen(true);}}>教看山</button>}
   </div>
   <span className="chat-local-note">会话保存在本机</span>
  </div>
  {teachingOpen&&state?<TeachingPanel key={state.activeId} state={state} status={status} favorites={favorites} initialFavorite={initialFavorite}
   onExit={()=>setTeachingOpen(false)} onFavorite={onFavorite} onSaved={record=>setTeachingRecords(items=>[record,...items.filter(item=>item.id!==record.id)])}
   onActivity={onActivity}/>:<>
  <details className="chat-connection">
   <summary>连接与表情设置</summary>
   <p>{status?.ready?`已配置 ${status.model} · ${status.destination}`:status?'真实模型尚未配置。请在模型设置中检查配置。':'正在读取聊天配置。'}</p>
   {status&&!status.ready&&status.issues.length>0&&<p className="inline-error">{status.issues.join(' ')}</p>}
   <label><input type="checkbox" checked={autoSticker===true} disabled={autoSticker===undefined||savingStickerPref||!!pending}
    onChange={event=>void saveAutoSticker(event.target.checked)}/> 允许刘看山随回复发送表情</label>
  </details>
  {source&&<p className="source-context">关联：{source.title}（{source.excerpt?'可使用接口摘要，全文未核验':'只有标题，正文未核验'}）</p>}
  {question&&bridge?.questionAnswers&&<QuestionAnswers key={question} url={question}/>}
  <div className={'chat-stage'+(picker?' picker-open':'')}>
  <div className="chat-lines" ref={lines} aria-live="polite" onScroll={event=>{
   const element=event.currentTarget;following.current=element.scrollHeight-element.clientHeight-element.scrollTop<36;
  }}>
   {!displayed.length&&!pending&&!state?.opening&&<p className="chat-empty">今天有点卡住，或者刚遇到一个新问题，都可以从这里说起。</p>}
   {state?.opening&&<div className="chat-turn companion-opening fox-message">
    {state.opening.source&&<p className="source-context">知乎热榜 · {new Date(state.opening.source.retrievedAt).toLocaleString('zh-CN',{hour12:false})} 获取 · 标题和可用摘要，全文未核验
     <br/><button onClick={()=>{const url=state?.opening?.source?.url;if(bridge&&url)void unwrap(bridge.openPost(url)).catch(e=>setError(e.message));}}>{state.opening.source.title} ↗</button></p>}
    <p className="fox-line"><strong className="chat-speaker">刘看山：</strong>{state.opening.line}</p>
    {state.opening.stickerId&&<StickerArt id={state.opening.stickerId} alt={state.opening.stickerAlt}
     enabled={windowVisible} autoplay={openingAnimation===state.opening.id}/>}
   </div>}
   {displayed.map(turn=><div className="chat-turn" key={turn.user.id}>
    <div className="chat-message user-message" data-message-id={turn.user.id}>
     <p className="user-line"><strong className="chat-speaker">你：</strong><span>{turn.user.content||'发送了表情'}</span></p>
     {turn.user.stickerId&&<StickerArt id={turn.user.stickerId} alt={turn.user.stickerAlt} enabled={windowVisible} autoplay={fresh===turn.user.id}/>}
    </div>
    {turn.sourceTitle&&<p className="source-context">关联：{turn.sourceTitle}</p>}
    {turn.assistant&&turn.hotTopic&&<p className="source-context">模型解读 · 依据热榜标题与现有摘要，全文未核验</p>}
    {turn.assistant?<div className="chat-message fox-message" data-message-id={turn.assistant.id}>
     <p className="fox-line"><strong className="chat-speaker">刘看山：</strong><span>{turn.assistant.content}</span></p>
     {turn.assistant.stickerId&&<StickerArt id={turn.assistant.stickerId} alt={turn.assistant.stickerAlt} enabled={windowVisible} autoplay={fresh===turn.assistant.id}/>}
     {turn.teachingRefs?.map(referencedCard)}
    </div>:turn.user.stickerId?null:pending?.messageId===turn.user.id&&progress?
     <p className="fox-line chat-progress" data-message-id={progress.messageId} aria-live="off"><strong className="chat-speaker">刘看山：</strong><span>{progress.text}</span></p>:
     <p className={turn.error&&pending?.messageId!==turn.user.id?'inline-error':'chat-empty'}>
      {pending?.messageId===turn.user.id?'等待回复':turn.error||turnLabels[turn.state]}
     </p>}
    {turn.hotList&&<div className="hot-chat-list">
     <p>知乎热榜 · {new Date(turn.hotList.retrievedAt).toLocaleString('zh-CN',{hour12:false})} 获取{turn.hotList.cached?' · 缓存内容':''} · 标题</p>
     <ol>{turn.hotList.items.map(post=><li key={post.id}><button onClick={()=>{if(bridge)void unwrap(bridge.openPost(post.sourceUrl||post.url)).catch(error=>setError(error.message));}}>{post.title}</button></li>)}</ol>
    </div>}
   </div>)}
   {teachingRecords.filter(record=>record.sessionId===state?.activeId).map(record=><div className="chat-turn" data-lesson-id={record.id} key={record.id}>
    {record.status==='deleted'?<p className="teaching-note">本次会话的学习记录已删除</p>:
     <button className="chat-teaching-reference" onClick={()=>onLesson(record.id)}>
      学习卡 · {record.card.topic}{record.status==='inactive'?'（已停用）':''}
     </button>}
   </div>)}
   {pending&&!displayed.some(turn=>turn.user.id===pending.messageId)&&<div className="chat-turn">
    <p className="user-line"><strong className="chat-speaker">你：</strong><span>{pending.message}</span></p>
    {progress&&<p className="fox-line chat-progress" data-message-id={progress.messageId} aria-live="off"><strong className="chat-speaker">刘看山：</strong><span>{progress.text}</span></p>}
   </div>}
  </div>
  {picker&&<section className="chat-sticker-picker" id="chat-sticker-picker" aria-label="刘看山的表情">
   <header><strong>刘看山的表情</strong><button type="button" aria-label="关闭表情" onClick={()=>setPicker(false)}>×</button></header>
   {caveReward&&<div className="chat-sticker-shelves" role="group" aria-label="表情分组">
    <button type="button" aria-pressed={stickerShelf==='regular'} onClick={()=>{setStickerShelf('regular');setSelected(undefined);}}>常用</button>
    <button type="button" aria-pressed={stickerShelf==='cave'} onClick={()=>{setStickerShelf('cave');setSelected(undefined);}}>山洞赠礼</button>
   </div>}
   <div className="chat-sticker-grid">{(stickerShelf==='cave'&&caveReward?caveStickerIds:stickerIds).map(id=><button key={id} type="button" aria-pressed={selected===id}
    onClick={()=>setSelected(id)} title={catalog[id].caption}><StickerArt id={id} preview enabled={windowVisible} autoplay={selected===id}/>{catalog[id].label}</button>)}</div>
   <footer><span>{selected?catalog[selected].caption:'选择表情预览'}</span><button type="button" disabled={!selected||working||!state}
    onClick={()=>void sendManualSticker()}>发送表情</button></footer>
  </section>}
  </div>
  <div className="chat-compose">
   <div className="chat-input">
    <textarea aria-label="对刘看山说的话" value={message} disabled={working} maxLength={2000}
     onChange={event=>{setMessage(event.target.value);setAgree(false);}} placeholder="你愿意分享的一小段话……"/>
    <button type="button" aria-label="刘看山的表情" aria-expanded={picker} aria-controls={picker?'chat-sticker-picker':undefined}
     className="chat-sticker-toggle" title="刘看山的表情" onClick={()=>setPicker(!picker)}>
     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 12 6 5q1-3 4 0l2 2 2-2q3-3 4 0l2 7c2 6-2 9-8 9s-10-3-8-9Z"/><path strokeLinecap="round" d="M9 12h.1m5.8 0h.1"/></svg>
    </button>
   </div>
   <button className="primary" disabled={!canSend||!message.trim()} onClick={()=>void send()}>{pending?'想一想…':'发送'}</button>
  </div>
  <div className="chat-bottom">
  {status?.managed?<p className="dialog-description">{pending?'首次使用会自动加载本机模型，请稍候。':'本机模型可处理消息、当前会话及相关的已确认学习卡。'}{source?'模型也会使用这条关联来源。':''}</p>:
  <label className="consent"><input type="checkbox" checked={agree} disabled={!ready||working} onChange={event=>setAgree(event.target.checked)}/>
   <span>同意向所选服务发送本次消息、必要会话上下文及命中的已确认学习卡。{source?'关联来源也会一同发送。':''}</span>
  </label>}
  {error&&<p className="inline-error" role="alert">{error}</p>}
  <div className="dialog-actions">
   <button disabled={!state?.turns.length||working} onClick={()=>void moveConversation('clear')}>清除本次会话</button>
   <button onClick={()=>void moveConversation('stop')} disabled={!pending||changing}>停止回复</button>
   {retry&&<button disabled={!canSend} onClick={()=>void send(retry)}>重试上一条</button>}
  </div>
  </div>
  </>}
 </section></div>;
}
