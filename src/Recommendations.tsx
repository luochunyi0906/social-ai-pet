import {useActorEvents} from './ActorAnimation';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Companion} from './Companion';
import {Icon} from './HotIcon';
import {QuestionAnswers} from './QuestionAnswers';
import {unwrap,type Favorite,type Post,type RecommendationBatch,type RecommendationMode} from './types';
import './recommendations.css';

const bridge=window.kanshan;
const sample=[
 '刚开始学习 AI Agent，应该先理解哪些概念？',
 '第一次参加黑客松，应该如何分配团队任务？',
 '做一个桌宠，怎样设计自然的陪伴感？',
 '你有哪些坚持记录生活的好方法？',
 '准备公开演讲时，你会怎样整理表达思路？'
];
type Row={id:string;title:string;post?:Post};
export function Recommendations({active,example,onExample,version,tabs,favorites,action,onOpen,onChat,onSave,onSettings}:{
 active:boolean;example:boolean;onExample:(enabled:boolean)=>void;version:number;tabs:ReactNode;favorites:Favorite[];
 action:string;onOpen:(post:Post)=>Promise<void>;onChat:(post:Post)=>void;onSave:(post:Post)=>Promise<void>;onSettings:()=>void;
}){
 const actor=useActorEvents();
 const [mode,setMode]=useState<RecommendationMode>('topic');
 const [topic,setTopic]=useState('');
 const [count,setCount]=useState(5);
 const [batch,setBatch]=useState<RecommendationBatch|null>(null);
 const [selectedUrl,setSelectedUrl]=useState<string>();
 const [detail,setDetail]=useState(false);
 const [loading,setLoading]=useState(false);
 const [problem,setProblem]=useState<{code:number;message:string}>();
 const [inputError,setInputError]=useState(false);
 const [message,setMessage]=useState('');
 const [keeping,setKeeping]=useState(false);
 const [quota,setQuota]=useState('');
 const [quotaPending,setQuotaPending]=useState(false);
 const request=useRef<string|null>(null),quotaRequest=useRef<string|null>(null),generation=useRef(0);
 const detailRef=useRef<HTMLElement>(null),rowsRef=useRef<HTMLDivElement>(null);
 const links=new Set(favorites.filter(item=>item.kind==='zhihu_post').map(item=>item.url));
 const rows:Row[]=example?sample.map((title,index)=>({id:'demo-'+index,title})):
  batch?.items.map(post=>({id:post.url,title:post.title,post}))??[];
 const selected=rows.find(row=>row.id===selectedUrl)??rows[0];
 const selectedPost=selected?.post;
 const kept=!!selectedPost&&links.has(selectedPost.url);
 function cancel(){
  const id=request.current;
  request.current=null;
  if(id){actor.request('recommendations',id,false);void bridge?.cancel(id);}
  setLoading(false);
 }
 useEffect(()=>{
  if(!active){
   cancel();
   return;
  }
  if(!bridge?.recommendationsLatest)return;
  setBatch(null);setQuota('');
  const version=++generation.current;
  void unwrap(bridge.recommendationsLatest()).then(value=>{
   if(generation.current===version)setBatch(value);
  }).catch(error=>{if(generation.current===version)setProblem({code:0,message:error.message});});
  return()=>{generation.current++;const id=request.current;request.current=null;if(id){actor.request('recommendations',id,false);void bridge?.cancel(id);}};
 },[active,version]);
 useEffect(()=>()=>{const id=quotaRequest.current;if(id)void bridge?.cancel(id);},[]);
 useEffect(()=>{detailRef.current?.scrollTo(0,0);},[selected?.id]);
 function setExample(value:boolean){
  cancel();setProblem(undefined);setInputError(false);setMessage('');setSelectedUrl(undefined);setDetail(false);
  if(value){setMode('account');setCount(5);}
  else setMode('topic');
  onExample(value);
 }
 async function submit(event:React.FormEvent){
  event.preventDefault();
  if(example){setSelectedUrl(undefined);setDetail(false);return;}
  const query=topic.trim();
  if(mode==='topic'&&!query){setInputError(true);return;}
  if(!bridge?.recommendationsRequest||request.current)return;
  generation.current++;
  const id=crypto.randomUUID();
  request.current=id;actor.request('recommendations',id,true);setLoading(true);setInputError(false);setProblem(undefined);setMessage('');
  try{
   const value=await unwrap(bridge.recommendationsRequest({id,mode,count,...(mode==='topic'?{query}:{})}));
   if(request.current!==id)return;
   if(value.batch){
    setBatch(value.batch);setSelectedUrl(previous=>value.batch?.items.some(item=>item.url===previous)?previous:undefined);
    rowsRef.current?.scrollTo(0,0);
   }else setProblem(value.problem);
  }catch(error){if(request.current===id)setProblem({code:0,message:(error as Error).message});}
  finally{actor.request('recommendations',id,false);if(request.current===id){request.current=null;setLoading(false);}}
 }
 async function checkQuota(){
  if(!bridge?.recommendationsQuota||quotaRequest.current)return;
  const id=crypto.randomUUID();
  quotaRequest.current=id;setQuotaPending(true);
  try{
   const value=await unwrap(bridge.recommendationsQuota({id}));
   const item=value.items.find(row=>row.apiId==='question_discovery');
   setQuota(item?`剩余 ${item.remaining}／${item.total} 次`:'剩余额度暂不可查询');
  }catch{setQuota('剩余额度暂不可查询');}
  finally{quotaRequest.current=null;setQuotaPending(false);}
 }
 async function keep(){
  if(!selectedPost){setMessage('示例问题仅用于视觉对照。请切回真实推荐收藏。');return;}
  if(keeping)return;
  setKeeping(true);
  try{await onSave(selectedPost);setMessage('已收藏到手账。');}
  catch(error){setMessage((error as Error).message);}
  finally{setKeeping(false);}
 }
 const empty=loading?'正在获取知乎问题推荐…':problem?'本次推荐未完成，检查提示后可以重试。':
  batch?.mode==='account'?'当前账号暂未获得推荐，可以按主题找一找。':
  batch?'暂时没有找到合适的问题，试试换个关键词。':'选择推荐方式，再点击获取推荐。';
 return <div hidden={!active} className={'hot-columns recommendation-columns '+(detail&&selected?'hot-show-detail':'')}>
  <section className="hot-list rec-list" aria-label="知乎问题推荐列表">
   {tabs}
   <form className="recommendation-controls" onSubmit={submit}>
    <div className="rec-modes" role="group" aria-label="推荐方式">
     {(['account','topic'] as const).map(value=><button key={value} type="button" aria-pressed={mode===value}
      onClick={()=>{if(value!==mode){cancel();setMode(value);setInputError(false);setProblem(undefined);}}}>{value==='account'?'按账号推荐':'按主题推荐'}</button>)}
    </div>
    {mode==='account'?<p>依据当前接入的知乎账号画像推荐</p>:
     <label className="rec-topic">你想参与什么话题？
      <input value={topic} maxLength={180} placeholder="例如：人工智能、校园生活、养猫"
       aria-invalid={inputError} onChange={event=>{cancel();setTopic(event.target.value);setInputError(false);}}/>
     </label>}
    {inputError&&<p className="rec-problem" role="alert">请输入一个主题。</p>}
    <div className="rec-submit">
     <label>数量 <select value={count} onChange={event=>{cancel();setCount(Number(event.target.value));}}>
      {[5,10,20].map(n=><option value={n} key={n}>{n} 条</option>)}
     </select></label>
     <button className="hot-outline" disabled={loading}><Icon name="refresh"/>{loading?'正在获取…':batch||example?'重新推荐':'获取推荐'}</button>
     {(example||batch)&&<span>本次{example?'展示':'返回'} {rows.length} 个问题</span>}
    </div>
    {!example&&batch&&<p className="rec-provenance" title={batch.query||'当前接入的知乎账号'}>
     {batch.mode==='account'?'当前接入账号':`主题「${batch.query}」`} · 请求 {batch.count} 条 · {new Date(batch.retrievedAt).toLocaleString('zh-CN',{hour12:false,month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})} 获取
    </p>}
    {!example&&problem&&<p className="rec-problem" role="alert">{batch?'本次未更新。':''}{problem.message} {problem.code===20001&&<button type="button" onClick={onSettings}>连接设置</button>}</p>}
   </form>
   <div className="hot-rows rec-rows" ref={rowsRef} tabIndex={0} aria-label="可滚动的问题列表">
    {rows.map((row,index)=><button className="hot-row rec-row" key={row.id} aria-pressed={selected?.id===row.id}
     onClick={()=>{if(row.post&&selectedUrl!==row.id)actor.feedback('emo_curious');setSelectedUrl(row.id);setDetail(true);setMessage('');}}>
     <span className="hot-rank">{String(index+1).padStart(2,'0')}</span>
     <span className="hot-row-text"><strong>{row.title}</strong></span>
    </button>)}
    {!rows.length&&<p className="hot-empty" role="status">{empty}</p>}
   </div>
   <footer className="rec-footer"><div><strong>ⓘ　问题发现额度：{quota||'待查询'}</strong><small>与问题回答共用额度</small></div>
    {!example&&<button onClick={()=>void checkQuota()} disabled={quotaPending}>{quotaPending?'查询中…':'查询额度'}</button>}
    <button onClick={()=>setExample(!example)}>{example?'返回真实推荐':'查看视觉示例'}</button>
   </footer>
  </section>
  <article className="hot-detail rec-detail" ref={detailRef} aria-label="推荐问题详情">
   <button className="hot-list-return" onClick={()=>setDetail(false)}>‹ 返回问题列表</button>
   {selected?<div className="hot-detail-inner">
    <p className="hot-source"><Icon name="bookmark"/>知乎问题</p>
    <h2>{selected.title}</h2>
    <p className="rec-boundary">这里只展示标题，问题详情请在知乎查看。</p>
    <section className="rec-thought"><h3><Icon name="leaf"/>回答前，先想一想</h3><ul>
     <li>你亲自实践过什么？</li><li>能举一个具体例子吗？</li><li>哪些判断还需要核实？</li>
    </ul></section>
    <div className="hot-actions rec-actions">
     <button className="hot-primary" onClick={()=>selectedPost?void onOpen(selectedPost):setMessage('示例问题没有真实原文链接。')}>去知乎看问题 <Icon name="external"/></button>
     <button className="hot-outline" onClick={()=>selectedPost?onChat(selectedPost):setMessage('示例问题仅用于视觉对照。')}><Icon name="chat"/>和看山聊聊</button>
     <button className="hot-outline" disabled={keeping||kept} onClick={()=>void keep()}><Icon name="bookmark"/>{kept?'已收藏到手账':'收藏到手账'}</button>
    </div>
    {message&&<p className="hot-feedback" role="status">{message}</p>}
    <div className="hot-companion"><Companion action={action}/><p>这题，你想从哪里讲起？</p></div>
    {selectedPost&&bridge?.questionAnswers&&<QuestionAnswers key={selectedPost.url} url={selectedPost.url}/>}
   </div>:<p className="hot-empty">选一个想到话说的问题，和看山聊聊。</p>}
  </article>
 </div>;
}
