import { FeatureGuide } from './FeatureGuide';
import {useActorEvents} from './ActorAnimation';
import {useEffect,useRef,useState} from 'react';
import {Companion} from './Companion';
import {Icon} from './HotIcon';
import {Recommendations} from './Recommendations';
import {QuestionAnswers,questionOrigin} from './QuestionAnswers';
import {useWindowDrag} from './windowDrag';
import {unwrap,type Favorite,type HotItem,type HotPreferences,type HotState,type Post} from './types';
import snow from './assets/hot/snow.webp';
import stars from './assets/hot/stars.webp';
import pine from './assets/hot/pine.webp';
import notebook from './assets/hot/notebook.webp';
import './hot-list.css';

const bridge=window.kanshan;
const sample = [
 ['为什么下过雪的夜晚，周围会显得特别安静？','从雪后的一次散步，聊起冬日的安静。',snow],
 ['山里的星空，为什么比城市里更清楚？','抬头看看，我们共享的那片夜空。',stars],
 ['第一次独自旅行，怎样安排行程更从容？','',undefined],
 ['为什么有些植物到了冬天仍然保持绿色？','关于常绿植物的一点好奇。',pine],
 ['哪些小习惯，会让人更容易保持好奇心？','把日常观察，变成新的问题。',notebook]
] as const;
const tabs = [['all','全部'],['unread','未读'],['kept','已收藏']] as const;
type Tab = typeof tabs[number][0];
type Row = {id:string;title:string;rank:number;excerpt?:string;thumbnail?:string;post?:HotItem};
type Props = {favorites:Favorite[];action:string;daily:boolean;onBack:()=>void;backLabel?:string;onCompact:()=>void;
 onChat:(post:Post)=>void;onSave:(post:Post)=>Promise<void>;onOpen:(post:Post)=>Promise<void>;
 onReminderChange:()=>void;onSettings:()=>void;recommendationRevision:number};
const demoRows:Row[]=sample.map(([title,excerpt,thumbnail],i)=>({id:'sample-'+i,title,rank:i+1,excerpt,thumbnail}));

export function hotTime(value:string) {
 return new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
}
const hotDate = (value:string) => new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));

function Picture({src,className}:{src:string;className:string}) {
 const [failed,setFailed]=useState(false);
 return failed?null:<img className={className} src={src} alt="" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>;
}
const contentKey = (url:string) => url.replace(/^https:\/\/www\.zhihu\.com\/question\/\d+\/answer\//,'https://www.zhihu.com/answer/');

export function HotList({favorites,action,daily,onBack,backLabel='返回山洞探索桌',onCompact,onChat,onSave,onOpen,onSettings,onReminderChange,recommendationRevision}:Props) {
 const actor=useActorEvents();
 const manualRefresh=useRef<string|null>(null);
 const [state,setState]=useState<HotState>();
 const [loading,setLoading]=useState(false);
 const [fresh,setFresh]=useState(false);
 const [problem,setProblem]=useState('');
 const [demo,setDemo]=useState(false);
 const [section,setSection]=useState<'hot'|'recommendations'>('hot');
 const [sampleRecommendations,setSampleRecommendations]=useState(false);
 const [tab,setTab]=useState<Tab>('all');
 const [current,setCurrent]=useState<string>();
 const [detail,setDetail]=useState(false);
 const [settings,setSettings]=useState(false);
 const [draft,setDraft]=useState<HotPreferences>();
 const [saving,setSaving]=useState(false);
 const [keeping,setKeeping]=useState(false);
 const [preview,setPreview]=useState(daily);
 const [message,setMessage]=useState('');
 const listRef=useRef<HTMLDivElement>(null);
 const detailRef=useRef<HTMLElement>(null);
 const live=useRef(false);
 const fetchBusy=useRef(false);
 const drag=useWindowDrag('panel');
 const favoriteUrls=new Set(favorites.filter(f=>f.kind==='zhihu_post').map(f=>contentKey(f.url)));
 const rows=demo?demoRows:state?.cache?.items.map(post=>({...post,post}))??[];
 const visible=rows.filter(row=>tab==='all'||(tab==='kept'?row.post&&favoriteUrls.has(contentKey(row.post.url)):
  !row.post||!state?.readUrls.includes(row.post.url)||row.id===current));
 const shown=preview&&!demo?visible.slice(0,state?.prefs.count??5):visible;
 const selected=shown.find(row=>row.id===current)??shown[0];
 const selectedPost=selected?.post;
 const question=questionOrigin(selectedPost?.url);
 const kept=Boolean(selectedPost&&favoriteUrls.has(contentKey(selectedPost.url)));
 const date=state?.cache?.retrievedAt;

 async function load(refresh:boolean) {
  if(!bridge||fetchBusy.current)return;
  fetchBusy.current=true;
  const id=refresh?crypto.randomUUID():null;
  if(id){manualRefresh.current=id;actor.request('hot',id,true);}
  setLoading(true);
  setProblem('');
  try{
   const view=await unwrap(refresh?bridge.hotRefresh():bridge.hotOpen());
   if(!live.current)return;
   setState(view);
   if(refresh)setFresh(!view.problem);
   const stale=view.cache&&(Date.now()-Date.parse(view.cache.retrievedAt)>=30*60000||
    new Date(view.cache.retrievedAt).toDateString()!==new Date().toDateString());
   if(!refresh&&(!view.cache||stale)&&!view.problem){
    const result=await unwrap(bridge.hotRefresh());
    if(live.current){setState(result);setFresh(!result.problem);}
   }
  }catch(error){if(live.current)setProblem((error as Error).message);}
  finally{
   if(id&&manualRefresh.current===id){manualRefresh.current=null;actor.request('hot',id,false);}
   fetchBusy.current=false;if(live.current)setLoading(false);
  }
 }
 useEffect(()=>{
  live.current=true;
  void load(false);
  return()=>{
   live.current=false;
   const id=manualRefresh.current;manualRefresh.current=null;
   if(id)actor.request('hot',id,false);
  };
 },[]);
 useEffect(()=>{
  detailRef.current?.scrollTo(0,0);
 },[selected?.id]);
 useEffect(()=>{
  const list=listRef.current;
  if(list)list.scrollTop=0;
 },[tab,demo,preview]);

 function choose(row:Row){
  if(row.post&&current!==row.id)actor.feedback('emo_curious');
  setCurrent(row.id);
  setDetail(true);
  setMessage('');
  const url=row.post?.url;
  if(url&&bridge&&!state?.readUrls.includes(url)){
   void unwrap(bridge.hotRead(url)).then(()=>{
    setState(old=>old&&!old.readUrls.includes(url)?{...old,readUrls:[...old.readUrls,url]}:old);
   }).catch(error=>setProblem(error.message));
  }
 }
 function toggleDemo(enabled:boolean){
  setDemo(enabled);setCurrent(undefined);setTab('all');setDetail(false);setMessage('');setSettings(false);
 }
 async function saveSettings(){
  if(!draft||!bridge||saving)return;
  setSaving(true);
  try{
   const result=await unwrap(bridge.hotSettings(draft));
   setState(result);setDraft(result.prefs);onReminderChange();setMessage('提醒设置已保存。');setSettings(false);
  }catch(error){setProblem((error as Error).message);}
  finally{setSaving(false);}
 }
 async function keep(post:Post){
  if(keeping)return;
  setKeeping(true);
  try{await onSave(post);setMessage('已收藏到手账。');}
  catch(error){setMessage((error as Error).message);}
  finally{setKeeping(false);}
 }
 const issue=problem||state?.problem?.message;
 const summary=demo&&selected?.id==='sample-0'?
  '雪后的街道为什么仿佛按下了静音键？这条讨论从日常观察出发，聊聊人们熟悉的冬日体验。':selected?.excerpt;
 const recommendations=section==='recommendations';
 const sections=<div className="discovery-tabs" role="tablist" aria-label="今日好奇心内容">
  <button type="button" role="tab" aria-selected={!recommendations} onClick={()=>setSection('hot')}>今日热榜</button>
  <button type="button" role="tab" aria-selected={recommendations} onClick={()=>setSection('recommendations')}>等你来答</button>
 </div>;
 return <section className="hot-screen" aria-label="今日好奇心">
  <header className="hot-top">
   <button className="hot-back" type="button" onClick={onBack} aria-label={backLabel} title={backLabel}><Icon name="back"/></button>
   <div className="hot-brand" {...drag.bindings} title="拖动窗口"><Icon name="mountain"/><b>看山有伴</b></div>
   <button className="hot-outline" type="button" onClick={()=>{if(recommendations){onSettings();return;}setDraft(state?.prefs??{enabled:false,time:'09:00',count:5});setSettings(true);}}><Icon name="bell"/>{recommendations?'设置':'推送设置'}</button>
   <button className="hot-outline" type="button" onClick={onCompact}><Icon name="shrink"/>收回桌面</button>
  </header>
  <div className="hot-card">
   <header className="hot-heading">
    <h1><Icon name="leaf"/>今日好奇心</h1>
    <p>{recommendations?'知乎问题推荐':`知乎热榜${demo?' · 09:00 获取（示意）':date?' · '+(new Date(date).toDateString()===new Date().toDateString()?hotTime(date):hotDate(date))+' 获取':''}`}</p>
    {recommendations?(sampleRecommendations&&<span className="hot-badge hot-demo-badge">示例数据 · 非实时推荐</span>):
     <span className={'hot-badge '+(demo?'hot-demo-badge':'')}>{demo?'示例数据 · 非实时热榜':loading?'正在获取':date?(fresh&&!issue?'已获取':'缓存内容'):issue?'获取失败':'等待获取'}</span>}
   </header>
   <FeatureGuide feature="hot"/>
   {!recommendations&&!demo&&issue&&<div className="hot-problem" role="alert">
    <span>{date?'本次刷新失败，保留上次内容。 ':''}{issue}</span>
    {state?.problem?.code==='auth'&&<button onClick={onSettings}>连接配置</button>}
   </div>}
   {!recommendations&&message&&<p className="hot-feedback" role="status">{message}</p>}
   <div hidden={recommendations} className={'hot-columns '+(demo?'hot-samples ':'')+(detail&&selected?'hot-show-detail':'')}>
    <section className="hot-list" aria-label="热榜列表">
     {sections}
     <div className="hot-list-bar">
      <div className="hot-tabs" role="group" aria-label="筛选热榜">
       {tabs.map(([key,label])=><button key={key} aria-pressed={key===tab} onClick={()=>{setTab(key);setCurrent(undefined);setDetail(false);}}>{label}</button>)}
      </div>
      <button className="hot-refresh" disabled={loading&&!demo} onClick={()=>demo?(setCurrent(undefined),setTab('all'),setDetail(false),setMessage('已恢复示例列表。')):void load(true)}><Icon name="refresh"/>{loading&&!demo?'获取中':'刷新'}</button>
     </div>
     {preview&&!demo&&<button className="hot-preview-note" onClick={()=>setPreview(false)}>每日速览 · 前 {state?.prefs.count??5} 条　查看完整榜单 ›</button>}
     <div className="hot-rows" ref={listRef} tabIndex={0} aria-label="可滚动的热榜条目">
      {shown.map(row=><button key={row.id} className="hot-row" aria-pressed={selected?.id===row.id}
       onClick={()=>choose(row)}>
       <span className="hot-rank">{String(row.rank).padStart(2,'0')}</span>
       <span className="hot-row-text"><strong>{row.title}</strong><small>{row.excerpt||'暂无摘要'}</small></span>
       {row.thumbnail&&<Picture key={row.thumbnail} src={row.thumbnail} className="hot-thumb"/>}
      </button>)}
      {!shown.length&&<div className="hot-empty" role="status">
       {loading&&!demo?'正在获取知乎热榜…':issue&&!demo&&!date?'暂时无法获取，点击刷新重试。':
        tab==='unread'?'这份榜单的条目都已经看过了。':tab==='kept'?'这份榜单里还没有已收藏的条目。':'知乎本次没有返回热榜条目。'}
      </div>}
     </div>
     <p className="hot-list-foot">按接口返回顺序展示</p>
    </section>
    <article className="hot-detail" ref={detailRef} aria-label="热榜详情">
     <button className="hot-list-return" onClick={()=>setDetail(false)}>‹ 返回热榜列表</button>
     {selected?<div className="hot-detail-inner">
      <p className="hot-source"><Icon name="bookmark"/>知乎热榜</p>
      <h2>{selected.title}</h2>
      {selected.thumbnail&&<Picture key={selected.thumbnail} src={selected.thumbnail} className="hot-story-image"/>}
      <section className="hot-summary" aria-label="热榜摘要">
       <h3><Icon name="leaf"/>热榜摘要</h3>
       <p>{summary||'本条暂无摘要，可以去知乎查看原文。'}</p>
       <small>这里只展示摘要，全文请查看原文。</small>
      </section>
      <div className="hot-actions">
       <button className="hot-primary" onClick={()=>selectedPost?void onOpen(selectedPost):setMessage('示例条目没有原文链接，请切回真实热榜。')}>去知乎看原文 <Icon name="external"/></button>
       <button className="hot-outline" onClick={()=>selectedPost?onChat(selectedPost):setMessage('示例条目仅用于视觉对照，请切回真实热榜再聊。')}><Icon name="chat"/>和看山聊聊</button>
       <button className="hot-outline" disabled={keeping||kept} onClick={()=>selectedPost?void keep(selectedPost):setMessage('示例条目仅用于视觉对照。请切回真实热榜收藏。')}><Icon name="bookmark"/>{kept?'已收藏到手账':'收藏到手账'}</button>
      </div>
      <div className="hot-companion"><Companion action={action}/><p>挑一条，一起看看。</p></div>
      {question&&bridge?.questionAnswers&&<QuestionAnswers key={question} url={question}/>}
     </div>:<div className="hot-empty">选择一条，和看山一起看看。</div>}
    </article>
   </div>
   <Recommendations active={recommendations} example={sampleRecommendations} onExample={setSampleRecommendations}
    version={recommendationRevision} tabs={sections} favorites={favorites} action={action} onOpen={onOpen} onChat={onChat} onSave={onSave} onSettings={onSettings}/>
  </div>
  {settings&&draft&&<div className="hot-settings-backdrop" onClick={()=>setSettings(false)}>
   <section className="hot-settings" role="dialog" aria-modal="true" aria-labelledby="hot-settings-title" onClick={event=>event.stopPropagation()}>
    <header><h2 id="hot-settings-title">推送设置</h2><button aria-label="关闭推送设置" onClick={()=>setSettings(false)}>×</button></header>
    <label><span>每日热榜提醒</span><input type="checkbox" checked={draft.enabled} onChange={e=>setDraft({...draft,enabled:e.target.checked})}/></label>
    <label><span>提醒时间</span><input type="time" value={draft.time} required onChange={e=>setDraft({...draft,time:e.target.value})}/></label>
    <label><span>每日速览</span><select value={draft.count} onChange={e=>setDraft({...draft,count:Number(e.target.value) as 3|5|10})}><option value={3}>3 条</option><option value={5}>5 条</option><option value={10}>10 条</option></select></label>
    <p>设备时区 {state?.timezone??Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
    <p>{state?.nextAt?'下次计划提醒 '+hotDate(state.nextAt):'每日提醒未开启'}</p>
    <small>桌宠运行时获取。错过时段后，下次打开仅处理当天。专注模式只标记入口，睡眠模式静默保存。</small>
    <footer><button className="hot-outline" onClick={()=>toggleDemo(!demo)}>{demo?'切回真实热榜':'查看视觉示例'}</button><button className="hot-primary" disabled={saving||!draft.time} onClick={()=>void saveSettings()}>保存设置</button></footer>
   </section>
  </div>}
 </section>;
}
