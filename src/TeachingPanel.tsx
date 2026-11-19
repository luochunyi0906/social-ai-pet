import {useEffect,useRef,useState} from 'react';
import {useActorEvents} from './ActorAnimation';
import {unwrap,type ChatState,type ChatStatus,type Favorite,type TeachingCard,type TeachingDraft,type TeachingKind,
 type TeachingRecord,type TeachingSource,type TeachingStart,type TeachingUpdate} from './types';
import './teaching.css';

const bridge=window.kanshan;
const kinds:Record<TeachingKind,string>={preference:'个人偏好',experience:'个人经验或方法',explanation:'知识解释'};
const fields=[
 ['topic','主题',120],['summary','我理解到的',360],['scope','适用的时候',160],
 ['example','一个例子',200],['uncertainty','还没确定的',180]
] as const;

function TeachingCardFields({card,onChange,showTopic=true}:{card:TeachingCard;onChange?:(card:TeachingCard)=>void;showTopic?:boolean}){
 const verification=card.kind!=='explanation'?'用户分享 · 适用于你说明的情境':
  card.verification==='conflicting'?'与现有材料可能有分歧 · 待核实':'用户分享的解释 · 待核实';
 return <div className="teaching-fields">
  {fields.map(([key,label,limit])=>onChange?
   <label key={key}>{label}{key==='topic'?<input value={card[key]} maxLength={limit}
    onChange={event=>onChange({...card,[key]:event.target.value})}/>:
    <textarea rows={key==='summary'?3:2} value={card[key]} maxLength={limit} onChange={event=>onChange({...card,[key]:event.target.value})}/>}</label>:
   (key!=='topic'||showTopic)&&(key!=='uncertainty'||card[key])&&<div key={key}><strong>{label}</strong><p>{card[key]||'尚未填写'}</p></div>)}
  {onChange?<label>记录性质<select value={card.kind} onChange={event=>onChange({...card,kind:event.target.value as TeachingKind})}>
   {Object.entries(kinds).map(([kind,label])=><option key={kind} value={kind}>{label}</option>)}
  </select></label>:<div><strong>记录性质</strong><p>{kinds[card.kind]}</p></div>}
  <p className="teaching-note">{verification}</p>
  {onChange&&<label>关键词 <small>用逗号分隔，最多 12 项</small>
   <Keywords card={card} onChange={onChange}/></label>}
 </div>;
}

function Keywords({card,onChange}:{card:TeachingCard;onChange:(card:TeachingCard)=>void}){
 const [text,setText]=useState(card.keywords.join('，'));
 return <input value={text} maxLength={390} onChange={event=>{
  setText(event.target.value);
  onChange({...card,keywords:event.target.value.split(/[，,、]/).map(word=>word.trim().slice(0,32)).filter(Boolean).slice(0,12)});
 }}/>;
}

function TeachingSourceDetails({source,onFavorite,onError,existing=true}:{source:TeachingSource;onFavorite:(id:string)=>void;
 onError:(message:string)=>void;existing?:boolean}){
 return <div className="teaching-origin">
  <strong>来自哪里</strong>
  {source.kind==='favorite'?<>
   <p>{source.title} · {source.coverage==='excerpt'?'知乎接口摘要，全文未核验':'仅有标题和收藏线索，正文未查阅'}</p>
   {source.excerpt&&<details><summary>查看本次可用摘要</summary><p>{source.excerpt}</p></details>}
   <div className="teaching-actions">
    <button onClick={()=>onFavorite(source.favoriteId)} disabled={!existing}>回到原收藏</button>
    {source.url&&<button onClick={()=>{if(bridge)void unwrap(bridge.openPost(source.url!)).catch(e=>onError(e.message));}}>打开原始链接 ↗</button>}
   </div>
  </>:source.kind==='conversation'?<p>当前会话曾聊到「{source.quote}」</p>:<p>你主动选的话题</p>}
 </div>;
}

export function TeachingPanel({state,status,favorites,initialFavorite,onExit,onFavorite,onSaved,onActivity}:{
 state:ChatState;status?:ChatStatus;favorites:Favorite[];initialFavorite?:string;onExit:()=>void;
 onFavorite:(id:string)=>void;onSaved:(record:TeachingRecord)=>void;onActivity:(event:string)=>void;
}){
 const actor=useActorEvents();
 const [kind,setKind]=useState<TeachingStart['kind']>(initialFavorite?'favorite':'topic');
 const [selection,setSelection]=useState(initialFavorite||'');
 const [topic,setTopic]=useState('');
 const [draft,setDraft]=useState<TeachingDraft>();
 const [text,setText]=useState('');
 const [useModel,setUseModel]=useState(false);
 const [editing,setEditing]=useState(false);
 const [card,setCard]=useState<TeachingCard>();
 const [saved,setSaved]=useState<TeachingRecord>();
 const [working,setWorking]=useState<'start'|'answer'|'review'|'save'>();
 const [error,setError]=useState('');
 const task=useRef<string|undefined>(undefined);
 const request=useRef<string|undefined>(undefined);
 const alive=useRef(true);
 const running=useRef(false);
 const transcript=useRef<HTMLDivElement>(null);
 const cardElement=useRef<HTMLElement>(null);
 const allowedFavorites=favorites.filter(item=>!item.hidden);
 const messages=state.turns.filter(item=>item.state==='complete'&&item.user.content.trim()).slice(-12).reverse();

 useEffect(()=>{
  alive.current=true;
  return()=>{
   alive.current=false;
   if(request.current)actor.request('chat',request.current,false);
   if(task.current)void bridge?.teachingCancel(task.current).catch(()=>{});
  };
 },[]);
 useEffect(()=>{
  if(draft?.phase==='question'&&transcript.current)transcript.current.scrollTop=transcript.current.scrollHeight;
 },[draft,working]);
 useEffect(()=>{
  if(draft?.phase==='review')cardElement.current?.scrollIntoView({block:'start'});
 },[draft?.phase]);

 async function run<T>(phase:NonNullable<typeof working>,action:()=>Promise<T>,apply:(result:T)=>void){
  if(running.current)return;
  running.current=true;
  setError('');
  setWorking(phase);
  try{const result=await action();if(alive.current)apply(result);}
  catch(problem){if(alive.current)setError((problem as Error).message);}
  finally{running.current=false;if(alive.current)setWorking(undefined);}
 }
 function accept(next:TeachingDraft){
  setDraft(next);
  setCard(next.card);
  setText('');
  setUseModel(false);
 }
 function start(){
  if(!bridge||running.current)return;
  const id=crypto.randomUUID();
  task.current=id;
  const base={id,sessionId:state.activeId};
  const input:TeachingStart=kind==='topic'?{...base,kind,topic}:
   kind==='favorite'?{...base,kind,favoriteId:selection}:{...base,kind,messageId:selection};
  void run('start',()=>unwrap(bridge.teachingStart(input)),next=>{accept(next);actor.feedback('emo_curious');});
 }
 function answer(){
  if(!bridge||!draft||running.current)return;
  const messageId=crypto.randomUUID();
  request.current=messageId;
  if(useModel){actor.request('chat',messageId,true);onActivity('thinking');}
  void run('answer',async()=>{
   try{return await unwrap(bridge.teachingAnswer({id:draft.id,messageId,text,model:useModel,consent:useModel,configId:status?.configId}));}
   finally{
    actor.request('chat',messageId,false);
    if(request.current===messageId)request.current=undefined;
    if(alive.current)onActivity('idle');
   }
  },accept);
 }
 function review(){
  if(bridge&&draft)void run('review',()=>unwrap(bridge.teachingFinish(draft.id)),accept);
 }
 function save(){
  if(!bridge||!draft||!card)return;
  void run('save',()=>unwrap(bridge.teachingSave({id:draft.id,value:card})),record=>{
   setSaved(record);setEditing(false);actor.feedback('emo_happy');onSaved(record);
  });
 }
 const changeKind=(next:TeachingStart['kind'])=>{setKind(next);setSelection('');};
 const done=saved!==undefined;
 return <section className="teaching-panel" aria-label="反向拜师">
  <div className="teaching-header"><p>{draft?.topic||'选一个话题，讲讲你会怎么解释。'}</p>
   <button type="button" onClick={onExit} disabled={working==='save'}>{!draft||done?'返回聊天':'结束'}</button></div>
  {!draft?<div className="teaching-scroll">
   <div className="teaching-actions" role="group" aria-label="开始方式">
    <button onClick={()=>changeKind('favorite')} aria-pressed={kind==='favorite'}>从收藏里选</button>
    <button onClick={()=>changeKind('conversation')} aria-pressed={kind==='conversation'}>接着刚才聊</button>
    <button onClick={()=>changeKind('topic')} aria-pressed={kind==='topic'}>我想教你</button>
   </div>
   {kind==='topic'?<label className="teaching-input">本轮主题<input value={topic} maxLength={120} onChange={event=>setTopic(event.target.value)}
    placeholder="一个概念、一段经验，或你自己的判断方法"/></label>:
    <label className="teaching-input">{kind==='favorite'?'选择一条收藏':'选择当前会话里的话题'}
     <select value={selection} onChange={event=>setSelection(event.target.value)}>
      <option value="">{kind==='favorite'?(allowedFavorites.length?'请选择':'还没有可选收藏'):(messages.length?'请选择':'当前会话还没有可选话题')}</option>
      {kind==='favorite'?allowedFavorites.map(item=><option key={item.id} value={item.id}>{item.title}</option>):
       messages.map(item=><option key={item.user.id} value={item.user.id}>{item.user.content.slice(0,110)}</option>)}
     </select>
    </label>}
   <button type="button" className="primary" disabled={Boolean(working)||!(kind==='topic'?topic.trim():selection)} onClick={start}>开始聊这个话题</button>
  </div>:<>
   <div className="teaching-scroll chat-lines" ref={transcript}>
    {draft.source.kind!=='topic'&&<TeachingSourceDetails source={draft.source} onFavorite={onFavorite} onError={setError}
     existing={draft.source.kind!=='favorite'||allowedFavorites.some(item=>item.id===(draft.source as {favoriteId:string}).favoriteId)}/>}
    {draft.messages.map(entry=><div className={`chat-message ${entry.role==='user'?'user-message':'fox-message'}`} key={entry.id} data-message-id={entry.id}>
     <p className={entry.role==='user'?'user-line':'fox-line'}><strong className="chat-speaker">{entry.role==='user'?'你':'刘看山'}：</strong><span>{entry.content}</span></p>
    </div>)}
    {draft.notice&&<p role="status" className="teaching-note">{draft.notice}</p>}
    {draft.phase==='review'&&card&&<article className="learning-card" ref={cardElement}>
     <h3>今天你教给我的</h3>
     <TeachingCardFields card={saved?.status==='active'?saved.card:card} onChange={editing?setCard:undefined}/>
     {draft.source.kind==='topic'&&<TeachingSourceDetails source={draft.source} onFavorite={onFavorite} onError={setError}/>}
    </article>}
    {done&&<p role="status" className="teaching-success">我把你的解释记下来了。</p>}
   </div>
   {!done&&draft.phase==='question'&&<div className="teaching-controls">
    <div className="chat-compose">
     <label className="teaching-input">我的解释<textarea value={text} aria-label="我的解释" maxLength={800} disabled={Boolean(working)}
      placeholder="说说你怎么看，或举一个自己的例子" onChange={event=>{setText(event.target.value);setUseModel(false);}}/></label>
     <button className="primary" disabled={Boolean(working)||!text.trim()} onClick={answer}>{working==='answer'?'正在整理…':'讲给看山听'}</button>
    </div>
    <label className="teaching-consent"><input type="checkbox" checked={useModel} disabled={!status?.ready||Boolean(working)}
     onChange={event=>setUseModel(event.target.checked)}/> 同意用 {status?.model||'已配置模型'} 整理这轮解释和必要材料{draft.source.kind==='favorite'&&draft.source.excerpt?'（包含接口摘要）':''}</label>
    <button disabled={Boolean(working)||!draft.card} onClick={review}>先记到这里</button>
   </div>}
   {!done&&draft.phase==='review'&&card&&<div className="teaching-actions teaching-review-actions">
    <button className="primary" disabled={Boolean(working)||!card.topic.trim()||!card.summary.trim()} onClick={save}>{working==='save'?'正在保存…':error?'重试记进手账':'记进手账'}</button>
    <button disabled={Boolean(working)} onClick={()=>setEditing(!editing)}>{editing?'查看卡片':'改一下'}</button>
    <button disabled={Boolean(working)} onClick={onExit}>暂不保存</button>
   </div>}
  </>}
  {error&&<p className="inline-error" role="alert">{error}</p>}
 </section>;
}

export function TeachingJournal({target,onConversation,onFavorite,favorites}:{
 target?:string;onConversation:(sessionId:string,lessonId:string)=>void;onFavorite:(id:string)=>void;favorites:Favorite[];
}){
 const [records,setRecords]=useState<TeachingRecord[]>();
 const [selected,select]=useState(target);
 const [editing,setEditing]=useState<TeachingCard>();
 const [working,setWorking]=useState(false);
 const [remove,setRemove]=useState(false);
 const [error,setError]=useState('');
 const alive=useRef(true);
 const pending=useRef(false);
 useEffect(()=>{
  alive.current=true;
  if(bridge)void unwrap(bridge.teachingList()).then(value=>{if(alive.current)setRecords(value);}).catch(e=>{if(alive.current)setError(e.message);});
  return()=>{alive.current=false;};
 },[]);
 useEffect(()=>{select(target);setEditing(undefined);setRemove(false);},[target]);
 const entry=records?.find(record=>record.id===selected);
 async function update(action:TeachingUpdate['action']){
  if(!bridge||!entry||entry.status==='deleted'||pending.current||action==='edit'&&!editing)return;
  pending.current=true;setWorking(true);setError('');
  const base={id:entry.id,revision:entry.revision};
  try{
   const next=await unwrap(bridge.teachingUpdate(action==='edit'?{...base,action,value:editing!}:{...base,action}));
   if(alive.current){setRecords(current=>current?.map(item=>item.id===next.id?next:item));setEditing(undefined);setRemove(false);}
  }catch(problem){if(alive.current)setError((problem as Error).message);}
  finally{pending.current=false;if(alive.current)setWorking(false);}
 }
 return <div className="teaching-journal">
  {!selected?<>{records?.filter(record=>record.status!=='deleted').length?
   records.filter(record=>record.status!=='deleted').map(record=><button className="teaching-entry" key={record.id}
    onClick={()=>select(record.id)}><strong>{record.card.topic}</strong><span>{record.card.summary}</span>
    <small>{new Date(record.confirmedAt).toLocaleDateString('zh-CN')}{record.status==='inactive'?' · 已停用':''}</small></button>):
   <p>{records?'聊完一个话题并确认后，学习卡会放在这里。':'正在读取手账…'}</p>}</>:
   <>
    <button onClick={()=>{select(undefined);setEditing(undefined);setRemove(false);}} disabled={working}>返回学习卡列表</button>
    {!entry||entry.status==='deleted'?<p>{records?'这条学习记录已删除或找不到。':'正在读取手账…'}</p>:<article className="learning-card">
     <h3>{entry.card.topic}</h3><p className="teaching-note">{new Date(entry.confirmedAt).toLocaleDateString('zh-CN')} · {entry.status==='inactive'?'已停用':'已确认'} · 第 {entry.revision} 版</p>
     <TeachingCardFields card={editing||entry.card} onChange={editing?setEditing:undefined} showTopic={false}/>
     <TeachingSourceDetails source={entry.source} onFavorite={onFavorite} onError={setError}
      existing={entry.source.kind!=='favorite'||favorites.some(item=>item.id===(entry.source as {favoriteId:string}).favoriteId&&!item.hidden)}/>
     <details className="teaching-original"><summary>查看原始解释</summary>
      {entry.messages.filter(message=>message.role==='user').map(message=><p key={message.id}>{message.content}</p>)}
     </details>
     <div className="teaching-actions">
      <button disabled={working} onClick={()=>onConversation(entry.sessionId,entry.id)}>返回原对话</button>
      {editing?<><button className="primary" disabled={working||!editing.topic.trim()||!editing.summary.trim()} onClick={()=>void update('edit')}>确认修改</button>
       <button disabled={working} onClick={()=>setEditing(undefined)}>取消修改</button></>:<>
       <button disabled={working} onClick={()=>{setRemove(false);setEditing(entry.card);}}>编辑学习卡</button>
       <button disabled={working} onClick={()=>void update(entry.status==='active'?'deactivate':'activate')}>{entry.status==='active'?'停用记忆':'重新启用'}</button>
       <button disabled={working} onClick={()=>setRemove(!remove)}>删除学习记录</button></>}
     </div>
     {remove&&<div className="teaching-confirm"><p>这会删除学习卡及卡内的解释副本。原会话和原收藏单独保留。</p>
      <button className="danger" disabled={working} onClick={()=>void update('delete')}>确认删除学习记录</button>
      <button disabled={working} onClick={()=>setRemove(false)}>取消删除</button></div>}
    </article>}
   </>}
  {error&&<p className="inline-error" role="alert">{error}</p>}
 </div>;
}
