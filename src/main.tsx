import { FeatureGuide } from './FeatureGuide';
import { FirstRunGuide } from './FirstRunGuide';
import{PostCard}from'./PostCard';
import{CampSheet,GardenPanel}from'./GardenPanel';
import{DesktopPet,DEFAULT_PLACES}from'./DesktopPet';import{SearchPanel}from'./SearchPanel';import{ChatPanel}from'./ChatPanel';
import React,{useEffect,useRef,useState} from 'react';import{createRoot}from'react-dom/client';import{Companion,CompanionProvider}from'./Companion';
import{HomeRoom}from'./HomeRoom';
import{ActorEventsContext,useActorAnimation}from'./ActorAnimation';
import{HotList}from'./HotList';
import{RoamingCompanion}from'./RoamingCompanion';
import{CompanionInvitation}from'./CompanionInvitation';
import{checkOutfit,DEFAULT_OUTFIT,findOutfit,loadIdle}from'./outfits';import{ModelPanel}from'./ModelPanel';import{unwrap,type Question,type Favorite,type Garden,type ModelStatus,type Post,type SearchResponse,type CompanionChoice,type CompanionState}from'./types';import'./style.css';import{INITIAL_STATE,nextBehavior}from'./shared/behavior.mjs';
import{feedingJourney,phaseLabels,type FeedingPhase}from'./feeding';
import{Snowfall}from'./Snowfall';
import {AppearancePicker} from './PetAppearance';
import {CaveCompanion,CaveReveal} from './CaveReveal';
import {useDaydream} from './useDaydream';
import type {WeatherStatus} from './types';
import './live-actor.css';
import type {PetAppearance} from './types';
import caveArt from './assets/camp/cave.png';
const bridge=window.kanshan;
const wardrobeUnlockNotice='衣柜里，好像多了一些新东西。';
const sampleRobot='研究材料摘选：机器人信任会受到外观、语言与互动经验影响。人们可能向机器人道谢，但这不一定表示他们相信机器人具有人类情感。';
const sampleTea='研究材料摘选：茶饮品牌使用本地插画和城市限定杯，将消费者的地方认同与日常饮品联系起来。独特包装可能吸引购买，但收藏兴趣不一定转化为长期忠诚。';
function App(){
const [guideOpen, setGuideOpen] = useState(() => !!bridge && new URLSearchParams(location.search).get('guide') === '1');
const [guideError, setGuideError] = useState('');
const [guideClosing, setGuideClosing] = useState(false);
const savingGuide = useRef(false);
const [campGuideOpen, setCampGuideOpen] = useState(false);
const[snow,setSnow]=useState(true);const[snowSaving,setSnowSaving]=useState(false);const[windowVisible,setWindowVisible]=useState(true);const[places,setPlaces]=useState<Record<string,{x:number;y:number}>>(DEFAULT_PLACES);const[surface,setSurface]=useState<'pet'|'panel'>(guideOpen?'panel':'pet');const[searchQuery,setSearchQuery]=useState<string|null>(null);const[posts,setPosts]=useState<Post[]>([]);const[searched,setSearched]=useState(false);const[searchReport,setSearchReport]=useState<SearchResponse|null>(null);const[showPartial,setShowPartial]=useState(false);const[postQuery,setPostQuery]=useState('');const[chatOpen,setChatOpen]=useState(false);const[chatSource,setChatSource]=useState<Post|null>(null);const[caveOpen,setCaveOpen]=useState(false);const[feed,setFeed]=useState(false);const[text,setText]=useState('');const[file,setFile]=useState<{token:string;name:string}|null>(null);const[consent,setConsent]=useState(false);const[mode,setMode]=useState<'sample'|'model'>('sample');const[status,setStatus]=useState<ModelStatus>({modelReady:false,destination:'尚未配置',platform:'browser',model:'',configId:'',issues:[],hasKey:false,timeoutMs:45000});const[modelOpen,setModelOpen]=useState(false);const[paused,setPaused]=useState(false);const[quiet,setQuiet]=useState(false);const[interaction,setInteraction]=useState('idle');const interactionRef=useRef('idle'),interactionTimer=useRef<ReturnType<typeof setTimeout>|null>(null);const[behaviorTick,setBehaviorTick]=useState(0);const[questions,setQuestions]=useState<Question[]>([]);const[simulated,setSimulated]=useState(true);const[garden,setGarden]=useState<Garden>({version:3,favorites:[],plants:[],revision:0,operations:[]});const[ready,setReady]=useState(false);const[busy,setBusy]=useState(false);const[error,setError]=useState('');const[toast,setToast]=useState('');const[choosing,setChoosing]=useState(false);const selectionPending=useRef(false);const[dragging,setDragging]=useState(false);const[phase,setPhase]=useState<FeedingPhase>('idle');const journey=useRef<AbortController|null>(null);const selection=useRef(0);const dragDepth=useRef(0);const request=useRef<string|null>(null);const alive=useRef(true);
useEffect(() => {
 if (!guideOpen) return;
 setSurface('panel');
 void bridge?.surface('panel');
}, [guideOpen]);

async function closeGuide(enterCamp: boolean) {
 if (!bridge || savingGuide.current) return;
 savingGuide.current = true;
 setGuideClosing(true);
 setGuideError('');
 try {
  await unwrap(bridge.guideSeen());
  setGuideOpen(false);
  if (enterCamp) {
   setCampGuideOpen(true);
   showPanel('camp');
  } else {
   returnToDesktop();
  }
 } catch {
  setGuideError('无法保存教程进度，请再试一次。');
 } finally {
  savingGuide.current = false;
  setGuideClosing(false);
 }
}

const [homeOpen,setHomeOpen]=useState(false);
const [hotOpen,setHotOpen]=useState(false);
const [hotQuick,setHotQuick]=useState(false);
const [hotBadge,setHotBadge]=useState(false);
const [hotNotice,setHotNotice]=useState(false);
const [roam,setRoam]=useState({away:false,dragging:false,walking:false,strolling:false});
const [invitation,setInvitation]=useState<CompanionState>();
const [choosingInvitation,setChoosingInvitation]=useState(false);
const [freshOpening,setFreshOpening]=useState<string>();
const [chatNavigation,setChatNavigation]=useState<{key:string;favoriteId?:string;sessionId?:string;lessonId?:string}>();
const [journalNavigation,setJournalNavigation]=useState<{tab:'favorites'|'teaching';id:string}>();
const choosingInvitationRef=useRef(false);
const [reminderRevision,setReminderRevision]=useState(0);
const [recommendationRevision,setRecommendationRevision]=useState(0);
const [sleeping,setSleeping]=useState(false);
const resting=useRef(false);
const [outfitId,setOutfitId]=useState(DEFAULT_OUTFIT);
const [outfitChanging,setOutfitChanging]=useState(false);
const [wardrobeError,setWardrobeError]=useState('');
const [windowPlayNotice,setWindowPlayNotice]=useState('');
const [appearance,setAppearance]=useState<PetAppearance>('classic');
const [appearanceSaving,setAppearanceSaving]=useState(false);
const [appearanceError,setAppearanceError]=useState('');
const appearanceWrite=useRef(false);
const [caveReveal,setCaveReveal]=useState<{ticket:Promise<string|null>}>();
const [newCaveGift,setNewCaveGift]=useState(false);
const [wardrobe,setWardrobe]=useState({unlocked:false,outfit:null as string|null,hintSeen:true});
const [wardrobeGlint,setWardrobeGlint]=useState(false);
const [weather,setWeather]=useState<WeatherStatus>();
const {daydream,wakeDaydream}=useDaydream(appearance==='fox'&&surface==='pet'&&windowVisible&&!sleeping&&!paused&&!quiet);
const outfitWrite=useRef(false);
const [outfitCue,setOutfitCue]=useState(0);
const outfit=findOutfit(outfitId);
const {motion,events:animation}=useActorAnimation(sleeping?'sleep':quiet?'focus':'normal');

function sleep(value:boolean){
 if(resting.current===value)return;
 resting.current=value;
 interact('idle');
 setSleeping(value);
 setToast('');
}
async function wearOutfit(id:string){
 if(outfitWrite.current)return false;
 const next=findOutfit(id);
 if(id!==DEFAULT_OUTFIT&&!next){
  setWardrobeError('这个套装在当前版本不可用。');
  return false;
 }
 outfitWrite.current=true;
 setOutfitChanging(true);
 setWardrobeError('');
 try{
  if(next)await checkOutfit(next);
  if(bridge)await unwrap(bridge.wearOutfit(id));
  setOutfitId(id);
  interact(next?'showcase':'idle');
  return true;
 }catch(error){
  setWardrobeError((error as Error).message);
  return false;
 }finally{
  outfitWrite.current=false;
  setOutfitChanging(false);
 }
}
useEffect(()=>{
 if(!bridge)return;
 let active=true;
 void unwrap(bridge.outfitSettings()).then(async saved=>{
  if(!active||outfitWrite.current)return;
  if(saved.warning)setError(saved.warning);
  if(saved.outfitId===DEFAULT_OUTFIT)return;
  const savedOutfit=findOutfit(saved.outfitId);
  if(!savedOutfit)throw Error('已保存的套装缺少有效配置，已展示默认装扮。');
  try{await loadIdle(savedOutfit);}catch{throw Error('已保存套装的待机素材缺失或尺寸不兼容，已展示默认装扮。');}
  if(active&&!outfitWrite.current)setOutfitId(savedOutfit.id);
 }).catch(error=>{if(active)setError(error.message);});
 return()=>{active=false;};
},[]);
function invalidateSelection(){selection.current++;selectionPending.current=false;setChoosing(false);setFile(null);setConsent(false);if(bridge)void bridge.forgetFile();}
const cancel=()=>{invalidateSelection();dragDepth.current=0;setDragging(false);journey.current?.abort();journey.current=null;setPhase('idle');setFile(null);setConsent(false);const id=request.current;request.current=null;if(id&&bridge)void unwrap(bridge.cancel(id)).catch(()=>{});setBusy(false);};
function resetCaveClicks(){
 setCaveReveal(undefined);
 void bridge?.resetCaveVisit();
}
function returnToDesktop(){
 resetCaveClicks();
 setNewCaveGift(false);
 animation.clear();cancel();interact('idle');setHomeOpen(false);setHotOpen(false);setFeed(false);setCaveOpen(false);setModelOpen(false);setSearchQuery(null);setChatOpen(false);setFreshOpening(undefined);setSurface('pet');void bridge?.surface('pet');
}
function showPanel(name:string,openingId?:string){
 resetCaveClicks();
 setNewCaveGift(false);
 if(name==='cave')animation.feedback('emo_curious');
 setSurface('panel');void bridge?.surface('panel');
 setHomeOpen(name==='home');
 setHotOpen(name==='hot');
 if(name!=='hot')setHotQuick(false);
 setCaveOpen(name==='cave');setFeed(name==='feed');setSearchQuery(null);setChatOpen(name==='chat');setModelOpen(name==='settings');
 setFreshOpening(openingId);
 setChatNavigation(undefined);
 if(name!=='journal')setJournalNavigation(undefined);
 if(name==='chat')setChatSource(null);
}
function playCaveReveal(){
 if(caveReveal||!caveOpen||busy||feed||chatOpen||modelOpen||searchQuery!==null)return;
 setNewCaveGift(false);
 const ticket=bridge?unwrap(bridge.visitCave()).catch(()=>null):Promise.resolve(null);
 setCaveReveal({ticket});
}
async function receiveCaveGift(ticket:Promise<string|null>){
 if(!bridge)return;
 const id=await ticket;
 if(!id)return;
 try{
  if(await unwrap(bridge.claimCaveSticker(id))){
   setNewCaveGift(true);
   setWardrobe(await unwrap(bridge.wardrobeStatus()));
  }
 }catch(error){setError((error as Error).message);}
}
async function wearCaveOutfit(id:string|null){
 if(!bridge)return;
 const outfit=await unwrap(bridge.saveCaveOutfit(id));
 setWardrobe(previous=>({...previous,outfit}));
}
useEffect(()=>{
 if(!bridge)return;
 const unsubscribe=bridge.onWeather(setWeather);
 const noWindow=bridge.onPlayNotice(setWindowPlayNotice);
 void unwrap(bridge.weatherStatus()).then(setWeather).catch(()=>{});
 void unwrap(bridge.wardrobeStatus()).then(setWardrobe).catch(()=>{});
 return()=>{unsubscribe();noWindow();};
},[]);
useEffect(()=>{
 if(!bridge||!homeOpen||!windowVisible||!wardrobe.unlocked||wardrobe.hintSeen)return;
 setWardrobeGlint(true);
 setToast(wardrobeUnlockNotice);
 void unwrap(bridge.seeWardrobeHint()).then(()=>setWardrobe(previous=>({...previous,hintSeen:true}))).catch(e=>setError(e.message));
},[homeOpen,windowVisible,wardrobe.unlocked,wardrobe.hintSeen]);
useEffect(()=>{if(!homeOpen)setWardrobeGlint(false);},[homeOpen]);
function closeCave(){
 resetCaveClicks();
 setNewCaveGift(false);
 setCaveOpen(false);
}
async function chooseAppearance(value:PetAppearance){
 if(!bridge||appearanceWrite.current||value===appearance)return;
 appearanceWrite.current=true;
 setAppearanceSaving(true);
 setAppearanceError('');
 try{setAppearance(await unwrap(bridge.saveAppearance(value)));}
 catch{setAppearanceError('未能保存外貌，请重试。');}
 finally{appearanceWrite.current=false;setAppearanceSaving(false);}
}
function openTeaching(favoriteId:string){
 showPanel('chat');
 setChatNavigation({key:crypto.randomUUID(),favoriteId});
}
function openTeachingConversation(sessionId:string,lessonId:string){
 showPanel('chat');
 setChatNavigation({key:crypto.randomUUID(),sessionId,lessonId});
}
function openJournal(tab:'favorites'|'teaching',id:string){
 showPanel('journal');
 setJournalNavigation({tab,id});
}
function openHot(quick=false){
 setHotQuick(quick);setHotBadge(false);setHotNotice(false);showPanel('hot');
}
useEffect(()=>{
 if(!bridge?.hotTick)return;
 let active=true;
 const mode=sleeping||paused||!windowVisible?'sleep':surface==='panel'||roam.dragging||roam.walking||roam.strolling||interaction==='lift'?'busy':quiet?'focus':'normal';
 async function tick(){
  if(!bridge)return;
  const hot=await unwrap(bridge.hotTick(hotOpen||mode==='sleep'?'sleep':mode==='normal'?'normal':'focus'))
   .catch(()=>({badge:false,notify:false}));
  if(!active)return;
  setHotBadge(hot.badge);
  const next=bridge.companionTick?await unwrap(bridge.companionTick(mode,hot.badge)):undefined;
  if(!active)return;
  setInvitation(next);
  if(next?.enabled)setHotNotice(false);
  else if(hot.notify)setHotNotice(true);
 }
 const poll=()=>void tick().catch(()=>{});
 poll();
 const timer=setInterval(poll,30000);
 return()=>{active=false;clearInterval(timer);};
},[sleeping,hotOpen,quiet,paused,windowVisible,reminderRevision,surface,roam.dragging,roam.walking,roam.strolling,interaction==='lift']);
useEffect(()=>bridge?.onRoamState?.(setRoam),[]);
useEffect(()=>{
 const offer=invitation?.offer;
 if(!offer)return;
 const hide=setTimeout(()=>setInvitation(old=>old?.offer?.id===offer.id?{...old,offer:null}:old),Math.max(0,offer.expires-Date.now()));
 return()=>clearTimeout(hide);
},[invitation?.offer]);
async function chooseInvitation(choice:CompanionChoice){
 if(!bridge||choosingInvitationRef.current)return;
 choosingInvitationRef.current=true;setChoosingInvitation(true);
 try{
  const offer=invitation?.offer??(invitation?.badge&&choice==='talk'?(await unwrap(bridge.companionTick('normal',hotBadge))).offer:undefined);
  if(!offer)return;
  const result=await unwrap(bridge.companionChoose(offer.id,choice));
  setInvitation(old=>old?{...old,offer:null,badge:false}:old);
  if(choice==='talk'){
   if(result&&'teachingFavoriteId' in result)openTeaching(result.teachingFavoriteId);
   else showPanel('chat',offer.id);
  }
 }catch(error){setError((error as Error).message);}
 finally{choosingInvitationRef.current=false;setChoosingInvitation(false);setReminderRevision(value=>value+1);}
}
useEffect(()=>{
 if(!hotNotice)return;
 const timer=setTimeout(()=>setHotNotice(false),9000);
 return()=>clearTimeout(timer);
},[hotNotice]);
useEffect(()=>{if(!bridge)return;const offProbe=bridge.onProbe(p=>{if(!p.id)return;const el=document.elementFromPoint(p.x,p.y);const active=!!el?.closest('[data-hit],.modal,button,input,textarea,a,summary');void bridge.hitTest({id:p.id,active});});const offAction=bridge.onAction(name=>{if(name==='tutorial'){setGuideOpen(true);return;}if(guideOpen)return;if(name==='pet-interaction')wakeDaydream();else if(name==='pause')setPaused(p=>!p);else if(name==='quiet')setQuiet(p=>!p);else if(name==='wake')sleep(false);else if(name==='reset-layout'){setPlaces(DEFAULT_PLACES);interact('greet');}else showPanel(name);});return()=>{offProbe();offAction();};},[wakeDaydream,guideOpen]);
useEffect(()=>{alive.current=true;if(bridge){unwrap(bridge.status()).then(s=>{if(alive.current)setStatus(s);}).catch(e=>setError(e.message));unwrap(bridge.load()).then(s=>{if(alive.current){setGarden(s);setReady(true);}}).catch(e=>setError(e.message));const off=bridge.onSuspend(()=>{resetCaveClicks();cancel();setFile(null);});return()=>{alive.current=false;journey.current?.abort();off();const id=request.current;request.current=null;if(id)void bridge.cancel(id);};}setError('当前是浏览器预览。请通过桌面应用使用文件、模型和收藏功能。');return()=>{alive.current=false;};},[]);
useEffect(()=>{
 if(!bridge)return;
 let active=true;
 void unwrap(bridge.windowSettings()).then(settings=>{
  if(!active)return;
  setSnow(settings.snow);
  if(!appearanceWrite.current)setAppearance(settings.appearance);
 }).catch(e=>{if(active)setError(e.message);});
 const unsubscribe=bridge.onWindowVisibility(setWindowVisible);
 const pageVisibility=()=>setWindowVisible(!document.hidden);
 document.addEventListener('visibilitychange',pageVisibility);
 return()=>{active=false;unsubscribe();document.removeEventListener('visibilitychange',pageVisibility);};
},[]);
useEffect(()=>{if(!windowVisible||paused)resetCaveClicks();},[windowVisible,paused]);
async function toggleSnow(){
 if(!bridge||snowSaving)return;
 setSnowSaving(true);
 try{const value=await unwrap(bridge.setSnow(!snow));setSnow(value.snow);}
 catch(e){setError((e as Error).message);}
 finally{setSnowSaving(false);}
}
function interact(kind:string){
 if(kind==='look')wakeDaydream();
 if(resting.current&&kind!=='idle')return;
 const priority=(k:string)=>k==='lift'?5:['searching','thinking'].includes(k)?4:['found','empty','oops','keep','seed-select','plant','water','fertilize','garden-stage','bloom','garden-error','layout-blocked'].includes(k)?3:['look','gardenlook'].includes(k)?1:2;
 if(interactionRef.current==='lift'&&!['lift','land','idle'].includes(kind))return;const terminal=['found','empty','oops','keep','plant','water','fertilize','garden-stage','bloom','garden-error','layout-blocked'].includes(kind)||kind==='showcase'||kind.startsWith('speak-');if(kind!=='idle'&&kind!=='land'&&!terminal&&priority(kind)<priority(interactionRef.current))return;
 if(interactionTimer.current)clearTimeout(interactionTimer.current);interactionRef.current=kind;setInteraction(kind);
 if(['found','gardenlook','showcase'].includes(kind))setOutfitCue(cue=>cue+1);
 if(!['idle','lift','searching','thinking'].includes(kind))interactionTimer.current=setTimeout(()=>{interactionRef.current='idle';setInteraction('idle');},kind==='look'?1500:2600);
}
useEffect(()=>{if(paused||quiet||sleeping||!windowVisible)return;const timer=setInterval(()=>setBehaviorTick(t=>t+1),16000);return()=>clearInterval(timer);},[paused,quiet,sleeping,windowVisible]);
useEffect(()=>()=>{if(interactionTimer.current)clearTimeout(interactionTimer.current);},[]);
useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(t);},[toast]);
useEffect(()=>{const handler=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!guideOpen)returnToDesktop();};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[guideOpen]);
async function submit(){if(!bridge||request.current||selectionPending.current)return;setError('');const id=crypto.randomUUID();const animation=new AbortController();journey.current=animation;request.current=id;setBusy(true);setQuestions([]);setPosts([]);setSearched(false);setCaveOpen(false);
try{const payload=bridge.process({id,consent,mode,configId:status.configId,...(file?{fileToken:file.token}:{text})});
const[result]=await Promise.all([unwrap(payload),feedingJourney(animation.signal,setPhase,paused||quiet||resting.current||matchMedia('(prefers-reduced-motion: reduce)').matches)]);
if(request.current!==id||!alive.current)return;request.current=null;setQuestions(result.questions);setSimulated(result.simulated);setText('');setFile(null);setConsent(false);setFeed(false);if(!resting.current){setCaveOpen(true);setToast('山洞里多了几张想问的纸条。');}
}catch(e){if(request.current===id){request.current=null;setConsent(false);setError((e as Error).message);}}
finally{animation.abort();if(journey.current===animation){journey.current=null;setPhase('idle');setBusy(false);}}}
async function choose(){if(!bridge||busy||request.current||selectionPending.current)return;cancel();const version=selection.current;selectionPending.current=true;setChoosing(true);
try{const value=await unwrap(bridge.chooseFile());if(version!==selection.current)return;setFile(value);setConsent(false);setError('');}
catch(e){if(version===selection.current)setError((e as Error).message);}
finally{if(version===selection.current){selectionPending.current=false;setChoosing(false);}}}
async function drop(e:React.DragEvent){e.preventDefault();dragDepth.current=0;setDragging(false);if(busy||modelOpen)return;
if(!e.dataTransfer.types.includes('Files'))return;
cancel();showPanel('feed');setError('');const files=Array.from(e.dataTransfer.files);if(files.length!==1){setError('请每次只拖入一个 TXT 或 PDF 文件。');return;}
if(!bridge){setError('请通过桌面应用拖入本机文件。');return;}const version=selection.current;selectionPending.current=true;setChoosing(true);
try{const chosen=await unwrap(bridge.dropFile(files[0]));if(version!==selection.current)return;setFile(chosen);setConsent(false);}
catch(e){if(version===selection.current)setError((e as Error).message);}
finally{if(version===selection.current){selectionPending.current=false;setChoosing(false);}}}
function dragEnter(e:React.DragEvent){if(!e.dataTransfer.types.includes('Files'))return;e.preventDefault();if(busy||modelOpen)return;dragDepth.current++;setDragging(true);}
function dragLeave(e:React.DragEvent){e.preventDefault();dragDepth.current=Math.max(0,dragDepth.current-1);if(!dragDepth.current)setDragging(false);}
function acceptFavorite(result:Garden&{favoriteCreated:boolean},success:string,showNotice=true){
 const {favoriteCreated,...value}=result;
 acceptGarden(value);
 if(favoriteCreated){animation.feedback('emo_happy');interact('keep');}
 if(showNotice)setToast(favoriteCreated?success:'这条发现已在手账里，种子不会重复发放。');
}
async function save(q:Question,kind:Favorite['kind']){
 if(!bridge||!ready)return;
 try{acceptFavorite(await unwrap(bridge.save({kind,title:kind==='search_entry'?q.keywords.join(' · '):q.text,keywords:q.keywords.join(' '),simulated})),
  '种子已放进种子箱，去花园选择空田播种吧。');}
 catch(e){setError((e as Error).message);}
}
async function open(words:string){if(!bridge)return;try{await unwrap(bridge.open(words));setToast('已交给浏览器打开搜索；搜索结果和原文尚未核验。');}catch(e){setError((e as Error).message);}}
useEffect(()=>{setConsent(false);},[status.configId]);
async function openPost(post:Post){if(bridge)try{await unwrap(bridge.openPost(post.sourceUrl||post.url));setToast('已打开对应知乎原文；页面可能需要登录，完整正文尚未核验。');}catch(e){setError((e as Error).message);}}
async function savePost(post:Post,hot=false){
 if(!bridge)return;
 try{acceptFavorite(await unwrap(bridge.save({kind:'zhihu_post',title:post.title,keywords:post.title.slice(0,100),simulated:false,resultId:post.id})),
  '真实来源已收藏，种子留在箱子里等你亲手播种。',!hot);}
 catch(e){if(hot)throw e;setError((e as Error).message);}
}
const actor=nextBehavior({...INITIAL_STATE,paused:paused||!windowVisible,sleeping},behaviorTick,quiet,phase,interaction);const actorAction=actor.action,reason=actor.reason;
useEffect(()=>{
 void bridge?.roamUpdate?.({outfitId,action:actorAction,sleeping,motion,daydream,motionEnabled:!paused&&windowVisible,
  weatherBlocked:caveReveal!==undefined||interaction==='lift'||interaction==='land'||interaction==='upset',
  blocked:guideOpen||sleeping||quiet||paused||!windowVisible||chatOpen||homeOpen||hotOpen||caveOpen||feed||modelOpen||searchQuery!==null||busy});
},[outfitId,appearance,actorAction,sleeping,daydream,quiet,paused,windowVisible,chatOpen,homeOpen,hotOpen,caveOpen,feed,modelOpen,searchQuery,busy,motion.clip,motion.stage,motion.since,motion.until,weather,wardrobe,caveReveal,interaction]);
function acceptSearch(result:SearchResponse){
 setPosts(result.results);setSearchReport(result);setShowPartial(false);setPostQuery(result.query);setSearched(true);setCaveOpen(true);
}
async function replaySearch(){
 if(!bridge)return;
 try{acceptSearch(await unwrap(bridge.replaySearch()));interact('found');}
 catch(e){setError((e as Error).message);}
}
function acceptGarden(value:Garden){setGarden(previous=>value.revision>=previous.revision?value:previous);}
function openFavorite(f:Favorite){if(f.kind==='zhihu_post'&&bridge)void unwrap(bridge.openPost(f.source?.sourceUrl||f.url)).catch(e=>setError(e.message));else void open(f.keywords);}
const availableOffer=!sleeping&&!quiet&&!paused&&windowVisible&&!roam.dragging&&!roam.walking&&!roam.strolling&&interaction!=='lift'?invitation?.offer:null;
useEffect(()=>{if(surface==='pet'&&availableOffer?.kind==='teaching')animation.feedback('emo_curious');},[surface,availableOffer?.id]);
const invite=availableOffer?<CompanionInvitation offer={availableOffer} choices={choosingInvitation}
 onChoose={choice=>void chooseInvitation(choice)} onSource={url=>{if(bridge)void unwrap(bridge.openPost(url)).catch(e=>setError(e.message));}}/>:
 !sleeping&&!paused&&quiet&&invitation?.badge?<button className="pet-invitation-badge" type="button" aria-label="查看刘看山的邀请" onClick={()=>void chooseInvitation('talk')}>•</button>:null;
function dismissNotice(){
 if(windowPlayNotice)setWindowPlayNotice('');else setError('');
}
const scene=surface==='pet'?<div onDragEnter={dragEnter} onDragLeave={dragLeave} onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();}} onDrop={drop}><DesktopPet places={places} setPlaces={setPlaces} action={actorAction} reason={reason} onOpen={showPanel} onInteraction={interact} paused={paused} quiet={quiet} sleeping={sleeping} onWake={()=>sleep(false)} snow={snow&&windowVisible} hotReminder={hotBadge&&!sleeping} hotNotice={hotNotice&&!quiet&&!paused} onHot={()=>openHot(true)} away={roam.away} invitation={invite} weather={weather}/>{(windowPlayNotice||error)&&<div className="pet-error" data-hit role="alert">{windowPlayNotice||error}<button type="button" aria-label="关闭提示" onClick={dismissNotice}>×</button></div>}</div>: <main data-hit onContextMenu={e=>{e.preventDefault();void bridge?.menu();}} onDragEnter={dragEnter} onDragLeave={dragLeave} onDragOver={e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();e.dataTransfer.dropEffect=busy?'none':'copy';}}} onDrop={drop}
 className={`camp-shell ${roam.away?'companion-away':''} ${caveOpen?'cave-open':''} ${paused?'paused':''} ${quiet||sleeping?'quiet':''}`}>
 {!homeOpen&&!hotOpen&&snow&&windowVisible&&!paused&&!quiet&&!sleeping&&<Snowfall surface="camp"/>}
 <div hidden={homeOpen||hotOpen} className="camp-view">
 {!guideOpen&&!caveOpen&&!feed&&!chatOpen&&!modelOpen&&<FeatureGuide feature="camp" floating openFirst={campGuideOpen}/>}
 <GardenPanel hasClues={questions.length>0||(searched&&(posts.length>0||!!searchReport?.partialResults?.length))}
  snow={snow} snowSaving={snowSaving} onSnow={()=>void toggleSnow()} garden={garden} ready={ready} action={actorAction} reason={busy?phaseLabels[phase]:reason} quiet={paused||quiet||sleeping}
  blocked={busy||feed||searchQuery!==null||chatOpen||modelOpen} onGarden={acceptGarden} onActivity={interact} onOpenSource={openFavorite}
  onTeach={openTeaching} onTeachingConversation={openTeachingConversation} onFavorite={id=>openJournal('favorites',id)} journalNavigation={journalNavigation}
  onHome={()=>showPanel('home')} onCave={()=>showPanel('cave')} onFeed={()=>showPanel('feed')} onChat={()=>showPanel('chat')} onSettings={()=>showPanel('settings')} onReturn={returnToDesktop}/>
 </div>
 {homeOpen&&<HomeRoom sleeping={sleeping} action={actorAction} outfitId={outfitId} changing={outfitChanging}
  caveAvailable={appearance==='fox'&&wardrobe.unlocked} caveOutfit={wardrobe.outfit} onCaveWear={wearCaveOutfit} wardrobeGlint={wardrobeGlint}
  onWardrobeOpen={()=>setToast(message=>message===wardrobeUnlockNotice?'':message)}
  error={wardrobeError} onClearError={()=>setWardrobeError('')} canShowcase={!paused&&!quiet&&windowVisible} onSleep={sleep} onWear={wearOutfit} onShowcase={()=>interact('showcase')}
  onCamp={()=>setHomeOpen(false)} onCompact={returnToDesktop}/>}
 {hotOpen&&<HotList favorites={garden.favorites} action={actorAction} daily={hotQuick} onBack={()=>showPanel('cave')} onCompact={returnToDesktop}
  onChat={post=>{animation.feedback('emo_curious');setChatSource(post);setChatOpen(true);}} onSave={post=>savePost(post,true)} onOpen={openPost}
  onSettings={()=>setModelOpen(true)} onReminderChange={()=>setReminderRevision(revision=>revision+1)} recommendationRevision={recommendationRevision}/>}
 {hotNotice&&!hotOpen&&!sleeping&&!quiet&&!paused&&!chatOpen&&!feed&&!modelOpen&&!searchQuery&&<button className="hot-daily-message" onClick={()=>openHot(true)}>今日热榜已到 · 和看山一起看看</button>}
 {caveOpen&&<CampSheet title="山洞探索桌" detail="好奇心山洞" side="reading" onClose={closeCave}>
   <FeatureGuide feature="cave"/>
   {!caveReveal&&newCaveGift&&<p className="cave-gift-notice" role="status">刘看山送了你 9 张 Q 版动图。聊天时可在「山洞赠礼」里发送。</p>}
   <div className="cave-actions">
     <button type="button" className="cave-entrance" onClick={playCaveReveal}><img src={caveArt} alt=""/>山洞入口</button>
     <CaveCompanion action={actorAction} onActivity={interact} onChat={()=>{setChatSource(null);setChatOpen(true);}}/>
   </div>
   <AppearancePicker value={appearance} saving={appearanceSaving} error={appearanceError} onSelect={chooseAppearance}/>
   <div className="discovery-panel"><div className="panel-heading"><div><button className="search-entry" onClick={()=>{animation.feedback('emo_curious');setSearchQuery('');}}>主动检索知乎</button><button className="camp-replay-entry" onClick={()=>openHot(hotBadge)}>今日热榜{hotBadge?' · 有新内容':''}</button><button className="camp-replay-entry" onClick={()=>void replaySearch()}>检索演示 · 离线回放</button></div>{questions.length>0&&<span className="mode-tag">{simulated?'模拟数据 · 本地模板':'AI 生成问题'}</span>}</div>{searched&&<section className="real-posts"><h3>{searchReport?.provider==='camp-replay'?'离线回放':searchReport?.provider==='zhihu'?'知乎接口结果':'真实知乎索引'} · {postQuery}</h3><p>{searchReport?.provider==='camp-replay'?'来自过去的检索验收记录，保留标题和原文链接。回放未包含正文或摘要。':searchReport?.provider==='zhihu'?'标题、摘要和来源来自知乎接口，未取得或核验全文；按接口返回顺序展示，相关性仍需判断。':'仅取得搜索索引，正文尚未核验。标题匹配不代表全文观点相关。'}{posts.length?'':searchReport?.emptyReason||'本次没有可展示的相关内容，可以调整关键词重试。'}</p>{searchReport&&<p className="search-diagnostics">返回 {searchReport.diagnostics.rawCount} 条 · 有效知乎 {searchReport.diagnostics.validCount} 条 · 展示 {posts.length} 条{searchReport.provider!=='zhihu'&&<> · 标题全匹配 {searchReport.diagnostics.matchedCount} 条 · 部分匹配 {searchReport.diagnostics.partialCount} 条</>}</p>}{!!searchReport?.partialResults.length&&<label className="partial-switch"><input type="checkbox" checked={showPartial} onChange={e=>setShowPartial(e.target.checked)}/>显示仅部分关键词匹配的来源（可能不相关）</label>}{[...posts,...(showPartial?searchReport?.partialResults||[]:[])].map(post=><PostCard key={post.id} post={post} onOpen={()=>openPost(post)} onSave={()=>savePost(post)} onChat={()=>{setChatSource(post);setChatOpen(true);}}/>)}</section>}{questions.length===0&&!searched?<div className="empty-notes"><h3>这里还没有新发现</h3><p>分享一小段内容，让好奇心有个出发点。</p><button className="primary" disabled={busy} onClick={()=>showPanel('feed')}>投喂内容</button></div>:<div className="question-list">{questions.map((q)=><article className="question-card" key={q.question_id}><div><span className="source-label">{simulated?'模拟问题 · 不是知乎帖子':'AI 生成的探索问题'}</span><h3>{q.text}</h3><p>{q.relation_to_input}</p><div className="card-actions"><button onClick={()=>{animation.feedback('emo_curious');setSearchQuery(q.keywords.join(' ').slice(0,180));}}>查找真实知乎内容</button><button onClick={()=>open(q.keywords.join(' '))}>去知乎搜索 ↗</button><button disabled={!ready} onClick={()=>save(q,'generated_question')}>收藏问题</button><button disabled={!ready} onClick={()=>save(q,'search_entry')}>收藏搜索入口</button></div></div></article>)}</div>}{questions.length>0&&<button className="text-button" onClick={()=>{setQuestions([]);setToast('本次解析记录已清除，收藏和植物保留。');}}>清除本次问题记录</button>}</div>
 </CampSheet>}
{(windowPlayNotice||error)&&!feed&&<div className="error-banner camp-error" role="alert">{windowPlayNotice||error}<button aria-label="关闭提示" onClick={dismissNotice}>×</button></div>}
{toast&&<div className="toast" role="status">{toast}</div>}
{dragging&&<div className="drop-target" role="status"><span>▤</span><h2>把一个线索放在这里</h2><p>松开后确认本次授权，才会读取正文</p><small>一个 TXT / PDF · 最大 10 MB · 原文件不动</small></div>}
{feed&&<div className={`modal-backdrop ${busy?'feeding-backdrop':''}`}><section className="modal feed-modal" role={busy?'region':'dialog'} aria-modal={busy?undefined:true} aria-labelledby={busy?'feeding-title':'feed-title'}>{busy&&<div className="feeding-progress"><Companion action={actorAction} paper={phase==='carry'}/><div><p className="eyebrow">A LITTLE DISCOVERY IN PROGRESS</p><h2 id="feeding-title" role="status">{phaseLabels[phase]||'正在准备线索'}</h2><p>{mode==='sample'?'本地模拟 · 不调用模型':'真实模型 · 正在等待问题'}{paused||quiet?' · 角色保持安静':''}</p></div><button onClick={()=>{cancel();setFeed(false);}}>取消本次探索</button></div>}<button className="modal-close" aria-label="取消投喂" onClick={()=>{cancel();setFeed(false);setConsent(false);}}>×</button><p className="eyebrow">A SMALL OFFERING</p><h2 id="feed-title">给它一点好奇的线索</h2><div className="modal-companion"><Companion action={actorAction}/><p>{busy?actor.reason:'我先看看线索，再想值得追问的地方。'}</p></div>{!busy&&<FeatureGuide feature="feed"/>}<p className="dialog-description">粘贴内容，或拖入 / 选择一个 TXT、PDF。确认授权后才读正文，原文件留在原处。</p><div className="input-tools"><button disabled={busy||choosing} onClick={choose}>＋ 选择文件</button><button disabled={busy||choosing} onClick={()=>{invalidateSelection();showPanel('cave');setSearchQuery('');}}>直接搜知乎</button><button disabled={busy} onClick={()=>{invalidateSelection();setText(sampleRobot);setConsent(false);}}>机器人信任样例</button><button disabled={busy} onClick={()=>{invalidateSelection();setText(sampleTea);setConsent(false);}}>茶饮品牌样例</button></div>{file?<div className="selected-file"><span>▤ {file.name}</span><small>仅记录本次选择；授权后才读取正文。</small><button disabled={busy} onClick={()=>{invalidateSelection();}}>移除文件</button></div>:<><textarea autoFocus aria-label="本次投喂文本" placeholder="把你愿意分享的一小段内容放在这里……" value={text} disabled={busy} onChange={e=>{setText(e.target.value);setConsent(false);}}/><span className={`char-count ${text.length>12000?'invalid':''}`}>{text.length} / 12000 字</span></>}
<div className="processing-mode"><label><input type="radio" checked={mode==='sample'} disabled={busy} onChange={()=>{setMode('sample');setConsent(false);}}/>本地演示 <small>模拟数据，不调用模型</small></label><label><input type="radio" checked={mode==='model'} disabled={busy||!status.modelReady} onChange={()=>{setMode('model');setConsent(false);}}/>真实模型 <small>{status.modelReady?status.destination:'尚未配置'}</small></label></div>
<label className="consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/><span>同意读取{file?'此文件正文':'本次文本'}并生成探索问题。{mode==='model'?`最多 12000 字将发送至 ${status.destination}，不发送文件名或路径。`:'本次仅在本机使用模板，不向模型外发。'}不长期保存原文。</span></label>
{choosing&&<p role="status" className="processing">正在确认文件，尚未读取正文……可以随时取消。</p>}{error&&<p role="alert" className="inline-error">{error}</p>}{busy&&<p role="status" className="processing">正在读取并寻找问题……可以随时取消，动画不阻挡处理。</p>}
<div className="dialog-actions"><button onClick={()=>{cancel();setFeed(false);setConsent(false);}}>取消</button><button className="primary" disabled={busy||choosing||!bridge||!consent||(!file&&!text.trim())||(!file&&text.length>12000)} onClick={submit}>{busy?'正在探索…':mode==='sample'?'开始本地模拟':'授权并开始探索'}</button></div><p className="modal-foot">支持 UTF-8 .txt 与文字型 PDF（10 MB / 80 页内）。扫描件、加密文件会明确提示。</p></section></div>}
{searchQuery!==null&&!modelOpen&&<SearchPanel onConfigure={query=>{setSearchQuery(query);setModelOpen(true);}} onModelStatus={setStatus} actorAction={actorAction} onActivity={interact} query={searchQuery} onClose={()=>setSearchQuery(null)} onResults={acceptSearch}/>}
{chatOpen&&<ChatPanel key={chatNavigation?.key} source={chatSource} windowVisible={windowVisible} freshOpening={freshOpening}
 favorites={garden.favorites} initialFavorite={chatNavigation?.favoriteId} initialSession={chatNavigation?.sessionId} initialLesson={chatNavigation?.lessonId}
 onFavorite={id=>openJournal('favorites',id)} onLesson={id=>openJournal('teaching',id)}
 onClose={()=>{setChatOpen(false);setChatNavigation(undefined);setFreshOpening(undefined);interact('idle');}} actorAction={actorAction} onActivity={interact} onSpeech={(_text,tone)=>interact('speak-'+tone)}/>}
{modelOpen&&<ModelPanel status={status} onStatus={value=>{setStatus(value);setRecommendationRevision(revision=>revision+1);}} onClose={()=>setModelOpen(false)} onCompanionChange={()=>setReminderRevision(value=>value+1)}/>}

</main>;
return <ActorEventsContext.Provider value={animation}><CompanionProvider appearance={appearance} outfit={outfit} sleeping={sleeping} action={actorAction}
 enabled={!paused&&!quiet&&windowVisible} cue={outfitCue} motion={motion} motionEnabled={!paused&&windowVisible}
 stillIdle={surface==='pet'} daydream={daydream&&!roam.dragging} weather={weather&&(wardrobe.unlocked?weather.look:{...weather.look,clothing:'normal'})}
 caveOutfit={wardrobe.unlocked?wardrobe.outfit:null} preloadBase onError={setError}>{scene}{guideOpen&&<FirstRunGuide onClose={enterCamp => void closeGuide(enterCamp)} error={guideError} closing={guideClosing}/>}{caveReveal&&<CaveReveal onClose={resetCaveClicks}
  onPersonRevealed={()=>void receiveCaveGift(caveReveal.ticket)}/>}</CompanionProvider></ActorEventsContext.Provider>;
}
const standaloneCompanion=new URLSearchParams(location.search).get('companion')==='1';
createRoot(document.getElementById('root')!).render(<React.StrictMode>{standaloneCompanion?<RoamingCompanion/>:<App/>}</React.StrictMode>);
