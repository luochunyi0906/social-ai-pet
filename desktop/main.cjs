const {app,BrowserWindow,ipcMain,dialog,shell,Menu,screen,powerMonitor,net}=require('electron');
const path=require('node:path');const fs=require('node:fs/promises');const {randomUUID}=require('node:crypto');
const {PET_SIZE,PANEL_SIZE,fitPet,fitPanel,defaultPet,petCenter,gazeNear}=require('./window-layout.cjs');
const {places:{fox:foxOrigin}}=require('./pet-layout.json');
const {preferences,validAppearance}=require('./window-preferences.cjs');
const {outfitPreferences}=require('./outfit-preferences.cjs');
const chatModel=require('./chat-model.cjs');
const modelSettings=require('./model-settings.cjs');
const dotenv=require('dotenv');
const MODEL_KEYS=[...chatModel.KEYS,'MODEL_PROVIDER','ZHIDA_MODEL','MODEL_API_KEY','MODEL_BASE_URL','MODEL_NAME','MODEL_TOKEN_PARAMETER','MODEL_JSON_MODE','MODEL_TIMEOUT_MS','SEARCH_PROVIDER','SEARCH_API_KEY','ZHIHU_ACCESS_SECRET'];
const startupEnvironment=Object.fromEntries(MODEL_KEYS.filter(name=>Object.hasOwn(process.env,name)).map(name=>[name,process.env[name]]));
const isWoodlandPreview=require('../package.json').woodlandPreview===true;
app.setPath('userData',process.env.KANSHAN_DATA_DIR?path.resolve(process.env.KANSHAN_DATA_DIR):path.join(app.getPath('appData'),isWoodlandPreview?'看山有伴-林间预览':'看山有伴-v0.3-preview'));
const configPath=app.isPackaged?path.join(app.getPath('userData'),'model.env'):path.join(__dirname,'../.env');
dotenv.config({quiet:true,path:configPath});
const localDirectory=app.isPackaged&&process.platform==='darwin'&&process.arch==='arm64'
 ?path.resolve(__dirname,'../../../../../../../..','.local-config'):null;
const localChat=require('./local-chat.cjs').createLocalChat(localDirectory);
function zhihuEnvironment(){
 const env={...process.env};
 if(app.isPackaged&&isWoodlandPreview&&!env.KANSHAN_DATA_DIR&&
   !Object.hasOwn(env,'ZHIHU_ACCESS_SECRET')){
  // Reuse only the credential of the previous Kanshan profile on this Mac.
  const previous=path.join(app.getPath('appData'),'看山有伴-v0.3-preview','model.env');
  try{env.ZHIHU_ACCESS_SECRET=dotenv.parse(require('node:fs').readFileSync(previous)).ZHIHU_ACCESS_SECRET;}
  catch{}
 }
 return env;
}
const chatConfiguration=()=>localChat.configuration(zhihuEnvironment());
const hot=require('./hot-list.cjs').hotList(app.getPath('userData'),()=>zhihuEnvironment().ZHIHU_ACCESS_SECRET?.trim());
const {teachingStore,teachingSession,clean:cleanTeaching}=require('./teaching.cjs');
const teachings=teachingStore(app.getPath('userData'));
const core=require('./core.cjs');const model=require('./model.cjs');const discovery=require('./search.cjs');const store=require('./garden.cjs');const receipts=new Map();const chat=require('./chat-session.cjs').createChatSession(app.getPath('userData'),{complete:localChat.complete,getHot:hot.forChat,teachings});let win,selected=null,selectionVersion=0,selecting=false;const pending=new Map();let queue=Promise.resolve();let quitting=false;
const teaching=teachingSession({store:teachings,complete:localChat.complete,config:chatConfiguration,
 canStart:()=>!chat.busy()&&!pending.size,origin:teachingOrigin});
const recommendations=require('./recommendations.cjs').recommendations(app.getPath('userData'),()=>zhihuEnvironment().ZHIHU_ACCESS_SECRET?.trim());
const sourceFor=async id=>receipts.get(id)||(typeof id==='string'&&id.startsWith('hot:')?await hot.source(id):
 typeof id==='string'&&id.startsWith('recommendation:')?await recommendations.source(id):undefined);
const proactive=require('./companion-chat.cjs').companionChat(app.getPath('userData'),{hot,chat,teachingCandidate});
const hasInstanceLock=app.requestSingleInstanceLock();if(!hasInstanceLock)app.quit();
app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
const storePath=()=>path.join(app.getPath('userData'),'garden-v3.json');
async function readStore(){
 for(const name of ['garden-v3.json','garden-v2.json','garden-v1.json']){
  try{return store.from(JSON.parse(await fs.readFile(path.join(app.getPath('userData'),name),'utf8')));}catch(e){if(e.code!=='ENOENT')throw Error('无法读取花园数据，已保留原文件并停止写入。');}
 }
 return store.empty();
}
async function teachingOrigin(p){
 if(!['topic','conversation','favorite'].includes(p.kind))throw Error('请选择一种教学来源。');
 const user=await chat.teachingOrigin(p.sessionId,p.kind==='conversation'?p.messageId:undefined);
 if(p.kind==='favorite'){
  const item=(await readStore()).favorites.find(favorite=>favorite.id===p.favoriteId&&!favorite.hidden);
  if(!item)throw Error('找不到可用的收藏。');
  const excerpt=item.source?.verification==='api_excerpt'?cleanTeaching(item.source.excerpt,1000):'';
  return {topic:cleanTeaching(item.title,120),source:{
   kind:'favorite',favoriteId:item.id,title:cleanTeaching(item.title,240),url:item.kind==='zhihu_post'?item.source?.sourceUrl||item.url:undefined,
   coverage:excerpt?'excerpt':'title',...(excerpt?{excerpt}:{})
  }};
 }
 if(p.kind==='conversation'&&!user)throw Error('请先选择当前会话里的一条话题。');
 if(p.kind==='topic'&&(typeof p.topic!=='string'||p.topic.trim().length>120))throw Error('请输入 120 字以内的主题。');
 const topic=cleanTeaching(user?.content??p.topic,120);
 if(!topic)throw Error('请先填写本轮主题。');
 return {topic,source:user?{kind:'conversation',messageId:user.id,quote:cleanTeaching(user.content,800)}:{kind:'topic'}};
}
async function teachingCandidate(excluded,now){
 const [garden,recorded]=await Promise.all([readStore(),teachings.list()]);
 const used=new Set([...excluded,...recorded.filter(entry=>entry.status!=='deleted').map(entry=>entry.source?.favoriteId)]);
 return [...garden.favorites].reverse().find(item=>!item.hidden&&!item.simulated&&!used.has(item.id)&&
  Date.parse(item.createdAt)>=now-3*86400000);
}

function mutate(fn){const next=queue.then(async()=>{const data=fn(await readStore());const target=storePath(),temp=target+'.'+randomUUID()+'.tmp';await fs.mkdir(path.dirname(target),{recursive:true});const h=await fs.open(temp,'wx',0o600);try{await h.writeFile(JSON.stringify(data));await h.sync();}finally{await h.close();}await fs.rename(temp,target);return data;});queue=next.catch(()=>{});return next;}
const roamIPC=new Set(['roam-hit','roam-press','roam-chat','roam-ready','window-drag-start','window-drag-end','menu']);
function check(event,name){const child=roam.child;const window=child&&event.sender===child.webContents&&roamIPC.has(name)?child:win;
 if(!window||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame)throw Error('无效调用来源。');
 return window===child;
}
function handle(name,fn){ipcMain.handle(name,async(event,...args)=>{const inRoam=check(event,name);try{if(quitting)throw Error('应用正在保存并退出。');return{ok:true,data:await fn(...args,...(roamIPC.has(name)?[inRoam]:[]))};}catch(e){return{ok:false,error: e?.name==='AbortError'?'处理已取消或超时。':e.message||'操作失败，请重试。'};}});}
function hasPending(){return pending.size||chat.busy()||teaching.busy();}
function stop(){resetCaveVisit();void chat.cancel().catch(()=>{});teaching.cancel();for(const c of pending.values())c.abort();pending.clear();selected=null;selectionVersion++;selecting=false;}
async function extractFile(file,signal){const stat=await fs.stat(file);if(stat.size>10*1024*1024)throw Error('文件超过 10 MB，请摘选内容后重试。');if(signal.aborted)throw new DOMException('Aborted','AbortError');const bytes=await fs.readFile(file,{signal});if(signal.aborted)throw new DOMException('Aborted','AbortError');if(path.extname(file).toLowerCase()==='.txt')return core.validateText(new TextDecoder('utf-8',{fatal:true}).decode(bytes));const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');if(signal.aborted)throw new DOMException('Aborted','AbortError');const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,disableFontFace:true,useSystemFonts:false});const cancel=()=>void task.destroy();signal.addEventListener('abort',cancel,{once:true});try{const doc=await task.promise;if(doc.numPages>80)throw Error('PDF 超过 80 页，请摘选部分页面。');let text='';for(let i=1;i<=doc.numPages;i++){if(signal.aborted)throw new DOMException('Aborted','AbortError');const p=await doc.getPage(i);const content=await p.getTextContent();if(!content.items.some(x=>x.str?.trim()))throw Error('PDF 含无可提取文字的页面，可能是扫描件；请先 OCR 或粘贴文本。');text+=content.items.map(x=>x.str||'').join(' ')+'\n';if(text.length>core.LIMIT)throw Error('PDF 文字超过 12000 字，请摘选内容。');}return core.validateText(text);}catch(e){if(e.name==='PasswordException')throw Error('暂不支持加密 PDF，请提供未加密副本。');throw e;}finally{signal.removeEventListener('abort',cancel);await task.destroy();}}
function modelStatus(){return {...model.publicStatus(),platform:process.platform};}
function settingsView(){return modelSettings.publicSettings(process.env,zhihuEnvironment().ZHIHU_ACCESS_SECRET);}
function applyModelConfig(values){
 for(const name of MODEL_KEYS){
  if(Object.hasOwn(values,name))process.env[name]=values[name];
  else if(Object.hasOwn(startupEnvironment,name))process.env[name]=startupEnvironment[name];
  else delete process.env[name];
 }
}
let configChange;
async function changeConfig(operation){
 if(configChange||hasPending())throw Error('请先完成或取消当前处理，再修改模型配置。');
 configChange=operation();
 try{return await configChange;}
 finally{configChange=undefined;}
}
handle('status',modelStatus);
handle('refresh-config',()=>changeConfig(async()=>{
 let values={};
 try{values=dotenv.parse(await fs.readFile(configPath));}
 catch(error){if(error.code!=='ENOENT')throw Error('无法读取本机模型配置。');}
 applyModelConfig(values);
 return modelStatus();
}));
handle('model-settings',settingsView);
handle('save-model-settings',patch=>changeConfig(async()=>{
 applyModelConfig(await modelSettings.saveSettings(configPath,patch,process.env));
 return {settings:settingsView(),model:modelStatus(),chat:chatModel.publicStatus(chatConfiguration()),search:discovery.status()};
}));
handle('check-model',async p=>{
 if(!p||p.consent!==true)throw Error('请先同意向所选服务发送内置测试材料。');
 const config=model.configuration();model.requireConfiguration(config,p.configId);
 if(typeof p.id!=='string'||!p.id||p.id.length>80||hasPending())throw Error('已有处理任务，请先取消。');
 const controller=new AbortController();pending.set(p.id,controller);
 try{const questions=await model.requestQuestions(model.CONNECTION_SAMPLE,{config,signal:controller.signal});if(controller.signal.aborted)throw Error('连接测试已取消。');return{questionCount:questions.length,destination:config.destination,model:config.model,checkedAt:new Date().toISOString()};}
 finally{if(pending.get(p.id)===controller)pending.delete(p.id);}
});
function revokeSelection(){selectionVersion++;selected=null;selecting=false;}
function beginSelection(){
 if(hasPending())throw Error('请先完成或取消当前处理，再更换文件。');
 revokeSelection();selecting=true;return selectionVersion;
}
function requireSelection(version){if(version!==selectionVersion)throw Error('文件选择已取消。');}
async function selectFile(file,version){
 requireSelection(version);core.validateFilePath(file);
 const stat=await fs.stat(file).catch(()=>{throw Error('无法访问此文件，请重新选择。');});
 requireSelection(version);core.validateFileMetadata(stat);
 if(hasPending())throw Error('请先完成或取消当前处理，再更换文件。');
 selected={token:randomUUID(),path:file};return{token:selected.token,name:path.basename(file)};
}
handle('select-drop',async file=>{const version=beginSelection();try{return await selectFile(file,version);}finally{if(version===selectionVersion)selecting=false;}});
handle('forget-file',()=>{revokeSelection();return true;});
handle('choose-file',async()=>{
 if(selecting)throw Error('文件选择尚未完成，请稍候或取消。');
 const version=beginSelection();
 try{
  const result=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'文本或 PDF',extensions:['txt','pdf']}]});
  requireSelection(version);if(result.canceled)return null;
  return await selectFile(result.filePaths[0],version);
 }finally{if(version===selectionVersion)selecting=false;}
});
handle('process',async p=>{if(selecting)throw Error('请先完成或取消文件选择。');if(!p||typeof p.id!=='string'||p.id.length>80||pending.has(p.id)||hasPending())throw Error('已有处理任务，请先取消。');if(p.consent!==true)throw Error('请先授权本次处理。');if(!['sample','model'].includes(p.mode))throw Error('处理模式无效。');const config=model.configuration();if(p.mode==='model')model.requireConfiguration(config,p.configId);const controller=new AbortController();pending.set(p.id,controller);let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort();},p.mode==='model'?config.timeoutMs:45000);try{let text;if(p.fileToken){if(selected?.token!==p.fileToken)throw Error('文件选择已失效，请重新选择。');text=await extractFile(selected.path,controller.signal);}else{text=core.validateText(p.text);}const questions=p.mode==='sample'?core.sampleQuestions(text):await model.requestQuestions(text,{config,signal:controller.signal});if(controller.signal.aborted)throw new DOMException('Aborted','AbortError');selected=null;return{questions,simulated:p.mode==='sample'};}catch(e){if(timedOut)throw Error('处理超时，已停止等待；可摘选内容后重试。');throw e;}finally{clearTimeout(timer);if(pending.get(p.id)===controller)pending.delete(p.id);}});
handle('cancel',async id=>{pending.get(id)?.abort();revokeSelection();await chat.cancel(id);return true;});handle('load',()=>mutate(s=>store.advance(s)));
handle('save',async p=>{
 const receipt=await sourceFor(p?.resultId);
 let favoriteCreated=false;
 const garden=await mutate(previous=>{
  const next=store.add(previous,p,receipt);
  favoriteCreated=next.favorites.length>previous.favorites.length;
  return next;
 });
 return {...garden,favoriteCreated};
});
handle('update',p=>mutate(s=>store.update(s,p)));
handle('garden-action',p=>mutate(s=>store.act(s,p)));
handle('open-post',async value=>{await shell.openExternal(discovery.postUrl(value).sourceUrl);return true;});
handle('open',async words=>{await shell.openExternal(core.safeLink(core.searchUrl(words)));return true;});
handle('search-status',()=>discovery.status());
handle('hot-open',hot.opened);
handle('hot-refresh',hot.refresh);
handle('hot-read',hot.markRead);
handle('hot-settings',hot.settings);
handle('hot-tick',hot.tick);
handle('companion-settings',proactive.read);
handle('companion-save',proactive.settings);
handle('companion-tick',proactive.tick);
handle('companion-choose',(id,choice)=>proactive.choose(id,choice,windowPrefs.get().chatStickers!==false));
handle('recommendations-latest',recommendations.latest);
handle('recommendations-request',async p=>{
 if(typeof p?.id!=='string'||!/^[0-9a-f-]{36}$/i.test(p.id)||hasPending())throw Error('请先完成或停止正在进行的请求。');
 const controller=new AbortController();pending.set(p.id,controller);
 try{return await recommendations.fetch(p,controller.signal);}
 finally{if(pending.get(p.id)===controller)pending.delete(p.id);}
});
handle('recommendations-quota',async p=>{
 if(typeof p?.id!=='string'||!/^[0-9a-f-]{36}$/i.test(p.id)||hasPending())throw Error('请先完成或停止正在进行的请求。');
 const configuration=discovery.config({...zhihuEnvironment(),SEARCH_PROVIDER:'zhihu'});
 const controller=new AbortController();pending.set(p.id,controller);
 try{return await discovery.quota({configuration,configId:configuration.revision,signal:controller.signal,scope:'question_discovery'});}
 finally{if(pending.get(p.id)===controller)pending.delete(p.id);}
});
handle('question-answers',async p=>{
 if(typeof p?.id!=='string'||!/^[0-9a-f-]{36}$/i.test(p.id)||hasPending())throw Error('请先完成或停止正在进行的请求。');
 const controller=new AbortController();
 pending.set(p.id,controller);
 try{
  return await require('./skills.cjs').runSkill('question-answers',{url:p.url,offset:p.offset,limit:p.limit},{
   key:zhihuEnvironment().ZHIHU_ACCESS_SECRET?.trim(),signal:controller.signal
  });
 }finally{if(pending.get(p.id)===controller)pending.delete(p.id);}
});
handle('open-search-config',async()=>{
 await fs.mkdir(path.dirname(configPath),{recursive:true});
 try{
  const template=await fs.readFile(path.join(__dirname,'../.env.example'));
  await fs.writeFile(configPath,template,{flag:'wx',mode:0o600});
 }catch(e){if(e.code!=='EEXIST')throw Error('无法创建本机配置。');}
 const error=await shell.openPath(configPath);if(error)throw Error('无法打开配置文件，请使用配套Configure-Model.command。');return true;
});
handle('zhihu-quota',async p=>{
 if(!p||p.consent!==true||typeof p.id!=='string'||!p.id||p.id.length>80)throw Error('请主动确认本次知乎额度查询。');if(hasPending())throw Error('请先完成或取消当前请求。');const controller=new AbortController();pending.set(p.id,controller);
 try{const result=await discovery.quota({configuration:discovery.config(),configId:p.configId,signal:controller.signal});if(controller.signal.aborted)throw Error('额度查询已取消。');return result;}finally{if(pending.get(p.id)===controller)pending.delete(p.id);}
});
handle('replay-search',()=>{
 // This title and source URL were captured in docs/V071_LIVE_ACCEPTANCE.md.
 const link=discovery.postUrl('https://www.zhihu.com/question/586758033/answer/2916132178');
 const post={
  id:'camp-replay-arctic-fox',title:'比北极熊娇小的北极狐，为什么能长期生活在北极？',
  ...link,kind:'answer',provider:'camp-replay',verification:'index_only',retrievedAt:'2026-11-18',authorName:'赵泠'
 };
 receipts.set(post.id,post);
 return {results:[post],partialResults:[],query:'北极狐',provider:'camp-replay',
  diagnostics:{attempts:[],rawCount:1,validCount:1,matchedCount:1,partialCount:0,rejectedCount:0,terms:['北极狐'],reason:'offline-replay'}};
});
handle('search-posts',async p=>{
 if(!p||p.consent!==true)throw Error('请先同意向检索服务发送本次关键词。');
 if(typeof p.id!=='string'||!p.id||p.id.length>80||hasPending())throw Error('已有处理任务，请先取消。');
 const controller=new AbortController();pending.set(p.id,controller);
 try{const result=await discovery.search(p.query,{configuration:discovery.config(),configId:p.configId,signal:controller.signal});if(controller.signal.aborted)throw Error('检索已取消。');
 receipts.clear();for(const post of [...result.results,...(result.partialResults||[])])receipts.set(post.id,post);return result;}finally{if(pending.get(p.id)===controller)pending.delete(p.id);}
});
handle('chat-status',()=>chatModel.publicStatus(chatConfiguration()));
handle('chat-state',chat.state);
handle('chat-change',async (mode,id)=>{
 if(!['new','select','clear'].includes(mode))throw Error('会话操作无效。');
 teaching.cancel();
 return chat.change(mode,id);
});
handle('teaching-start',teaching.start);
handle('teaching-answer',teaching.answer);
handle('teaching-finish',teaching.finish);
handle('teaching-save',teaching.save);
handle('teaching-cancel',id=>{if(typeof id!=='string')return false;return teaching.cancel(id);});
handle('teaching-list',teachings.list);
handle('teaching-update',async payload=>{
 const entry=await teachings.update(payload);
 await chat.invalidateTeaching(entry.id);
 return entry;
});
handle('chat-sticker',async p=>chat.sendSticker(p,{allowCaveReward:await caveRewardStatus()}));
handle('chat',async p=>{
 if(pending.size||teaching.busy())throw Error('已有处理任务，请先取消。');
 return chat.send(p,{config:chatConfiguration(),source:await sourceFor(p?.sourceId),
  stickers:windowPrefs.get().chatStickers!==false,
  onProgress:p?.stream===true?(text,messageId)=>{if(win&&!win.isDestroyed())win.webContents.send('chat-progress',{id:p.id,messageId,text});}:undefined});
});
const windowPrefs=preferences(app.getPath('userData'));
const caveWardrobe=require('./cave-wardrobe.json');
const {weatherController,defaults:weatherDefaults,validWeather,fetchWeather}=require('./weather.cjs');
const {windowInfo,windowPlan}=require('./window-target.cjs');
const weather=weatherController({request:(city,signal)=>fetchWeather(city,signal,net.fetch),publish:state=>{
 if(win&&!win.isDestroyed())win.webContents.send('weather-state',state);
}});
let weatherBlocked=false,chaseCooldown=0;
const localWeather=()=>windowPrefs.get().weather??{...weatherDefaults,chase:false};
const costume=()=>windowPrefs.get().caveStickerReward?windowPrefs.get().caveOutfit??null:null;
function weatherLook(){
 const {look}=weather.state();
 return windowPrefs.get().caveStickerReward?look:{...look,clothing:'normal'};
}
handle('weather-status',weather.state);
handle('weather-refresh',async()=>{await weather.refresh();return weather.state();});
handle('weather-save',async value=>{
 if(!validWeather(value)||typeof value.chase!=='boolean')throw Error('天气设置无效。');
 windowPrefs.update({weather:{enabled:value.enabled,city:value.city,chase:value.chase}});
 await windowPrefs.flush();
 weather.configure(localWeather());
 if(!value.chase)roam.stopChase();
 return weather.state();
});
handle('cave-wardrobe-status',async()=>({unlocked:await caveRewardStatus(),outfit:costume(),hintSeen:windowPrefs.get().wardrobeHintSeen===true}));
handle('cave-wardrobe-wear',async id=>{
 if(!await caveRewardStatus()||windowPrefs.get().appearance!=='fox')throw Error('请先找到山洞彩蛋，并选用狐狸 Q 版。');
 if(id!==null&&(typeof id!=='string'||!Object.hasOwn(caveWardrobe,id)))throw Error('这套服装不可用。');
 const previous=costume();
 windowPrefs.update({caveOutfit:id});
 try{await windowPrefs.flush();}
 catch(error){windowPrefs.update({caveOutfit:previous});throw error;}
 return id;
});
handle('cave-wardrobe-hint',async()=>{
 if(await caveRewardStatus()&&!windowPrefs.get().wardrobeHintSeen){
  windowPrefs.update({wardrobeHintSeen:true});
  await windowPrefs.flush();
 }
});
handle('chase-start',()=>{
 if(surface!=='pet'||!localWeather().chase||!win.isVisible()||Date.now()<chaseCooldown)return;
 chaseCooldown=Date.now()+20000;
 if(Math.random()<.3)roam.chase();
});
handle('chase-stop',()=>roam.stopChase());
let caveTicket,caveRewardWrite;
function resetCaveVisit(){
 caveTicket=undefined;
}
async function caveRewardStatus(){
 await caveRewardWrite?.catch(()=>{});
 return windowPrefs.get().caveStickerReward===true;
}
handle('cave-visit',()=>{
 if(surface!=='panel'||!win.isVisible())return null;
 caveTicket={id:randomUUID(),issuedAt:performance.now()};
 return caveTicket.id;
});
handle('cave-reset',resetCaveVisit);
handle('cave-sticker-status',caveRewardStatus);
handle('cave-sticker-claim',async id=>{
 if(typeof id!=='string'||id!==caveTicket?.id||surface!=='panel'||!win.isVisible()||
  performance.now()-caveTicket.issuedAt<2000)throw Error('山洞赠礼需要在彩蛋播放时领取。');
 caveTicket=undefined;
 if(await caveRewardStatus())return false;
 windowPrefs.update({caveStickerReward:true});
 const save=windowPrefs.flush();
 caveRewardWrite=save;
 try{await save;return true;}
 catch(error){
  windowPrefs.update({caveStickerReward:false});
  throw error;
 }finally{caveRewardWrite=undefined;}
});
const outfitPrefs=outfitPreferences(app.getPath('userData'));
handle('outfit-settings',outfitPrefs.read);
handle('outfit-wear',outfitPrefs.save);
const nativeSleep=require('./native-sleep.cjs');
handle('sleep-music',mode=>nativeSleep.music(mode,async()=>{
 const result=await dialog.showOpenDialog(win,{title:'选一首歌用 QQ 音乐播放',properties:['openFile'],
  filters:[{name:'音频',extensions:nativeSleep.AUDIO_EXTENSIONS}]});
 return result.canceled?null:result.filePaths[0];
}));
handle('sleep-clock',nativeSleep.clock);
handle('sleep-alarm-status',nativeSleep.alarmStatus);
handle('sleep-alarm-add',nativeSleep.addAlarm);
let probeTimer,probeId=0,lastProbe=null,captureUntil=0,ignoring=null,surface='pet',nativeDrag=null;
let roamProbeId=0;
const {roaming,DEFAULT_WANDER,validWander,wanderSettings}=require('./roaming.cjs');
const roam=roaming({
 anchor:()=>{
  const home=surface==='pet'?win.getBounds():windowPrefs.get().pet;
  return {x:home.x+foxOrigin.x,y:home.y+foxOrigin.y};
 },
 cursor:()=>screen.getCursorScreenPoint(),area:point=>screen.getDisplayNearestPoint(point).workArea,
 areas:()=>screen.getAllDisplays().map(display=>display.workArea),
 readWindow:windowInfo,
 notify:sendWindowPlayNotice,
 planWindow:(target,size,side,form)=>target?windowPlan(target,screen.getDisplayMatching({
  x:Math.round(target.x),y:Math.round(target.y),width:Math.round(target.width),height:Math.round(target.height)
 }),size,side,form):undefined,
 publish:state=>{
  if(win&&!win.isDestroyed())win.webContents.send('roam-state',state);
  weather.setBlocked(weatherBlocked||roam.special||state.dragging);
 },
 create:bounds=>{
  const child=new BrowserWindow({...bounds,show:false,frame:false,transparent:true,backgroundColor:'#00000000',
   focusable:false,resizable:false,hasShadow:false,alwaysOnTop:true,skipTaskbar:true,
   webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
  child.setIgnoreMouseEvents(true,{forward:true});
  child.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  child.webContents.on('will-navigate',event=>event.preventDefault());
  void child.loadFile(path.join(__dirname,'../dist/index.html'),{query:{companion:'1'}});
  return child;
 }
});
handle('roam-hit',(payload,child)=>{if(child&&typeof payload?.active==='boolean'&&payload.id===roamProbeId)roam.hit(payload.active);});
handle('roam-ready',child=>{if(child)roam.visual();});
handle('roam-press',(active,child)=>{
 if(typeof active!=='boolean'||(!child&&surface!=='pet'))return;
 if(child&&active)action('pet-interaction');
 roam.press(active);
});
handle('roam-chat',child=>{if(child){roam.setPanel(true);show();action('chat');}});
handle('roam-update',p=>{
 if(typeof p?.blocked!=='boolean'||typeof p.sleeping!=='boolean'||typeof p.outfitId!=='string'||
  !/^[a-z-]{1,48}$/.test(p.outfitId)||typeof p.action!=='string'||!/^[a-z-]{1,32}$/.test(p.action))throw Error('角色显示状态无效。');
 const motion=p.motion;
 if(motion!==undefined&&(!['act_idle','act_sit','act_sleep','emo_happy','emo_curious','emo_thinking'].includes(motion?.clip)||
  !['loop','enter','hold'].includes(motion.stage)||!Number.isFinite(motion.since)||
  (motion.until!==null&&!Number.isFinite(motion.until))||typeof p.motionEnabled!=='boolean'))throw Error('角色动画状态无效。');
 weatherBlocked=p.blocked||p.weatherBlocked===true;
 weather.setBlocked(weatherBlocked||roam.special||roam.dragging);
 roam.update({outfitId:p.outfitId,appearance:windowPrefs.get().appearance,sleeping:p.sleeping,action:p.action,motion,motionEnabled:p.motionEnabled,daydream:p.daydream===true,
  weather:weatherLook(),caveOutfit:costume(),autoClimbBlocked:weatherBlocked},p.blocked);
});
function ignore(value) {
 if(!win||ignoring===value)return;
 ignoring=value;
 win.setIgnoreMouseEvents?.(value,{forward:true});
}
function closestArea(position,mode) {
 const point=mode==='pet'?petCenter(position):{x:Math.round(position.x+position.width/2),y:Math.round(position.y+position.height/2)};
 return screen.getDisplayNearestPoint(point).workArea;
}
function rememberBounds() {
 const {x,y,width,height}=win.getBounds();
 windowPrefs.update(surface==='pet'?{pet:{x,y}}:{panel:{x,y,width,height}});
}
function sampleDrag() {
 const pointer=screen.getCursorScreenPoint();
 const {offsetX,offsetY,width,height}=nativeDrag;
 const area=screen.getDisplayNearestPoint(pointer).workArea;
 const position={x:pointer.x-offsetX,y:pointer.y-offsetY,width,height};
 const target=surface==='pet'?fitPet(position,area):fitPanel(position,area);
 const before=win.getBounds();
 if(target.x!==before.x||target.y!==before.y)win.setPosition(target.x,target.y);
}
function finishDrag(finalSample=false) {
 if(!nativeDrag)return false;
 if(finalSample)sampleDrag();
 clearInterval(nativeDrag.timer);
 clearTimeout(nativeDrag.watchdog);
 nativeDrag=null;
 lastProbe=null;
 captureUntil=0;
 rememberBounds();
 if(surface==='pet')roam.endCampDrag();
 return true;
}
function reconcileDisplay() {
 if(!win||win.isDestroyed?.())return;
 finishDrag();
 const bounds=win.getBounds();
 const area=closestArea(bounds,surface);
 if(surface==='panel')win.setMinimumSize(Math.min(600,area.width),Math.min(540,area.height));
 const target=surface==='pet'?fitPet(bounds,area):fitPanel(bounds,area);
 if(['x','y','width','height'].some(key=>target[key]!==bounds[key]))win.setBounds(target);
 rememberBounds();
 roam.reconcile();
}
function panelBounds(savedPanel, pet) {
 const area=savedPanel?closestArea(savedPanel,'panel'):closestArea(pet,'pet');
 const desired=savedPanel||{...PANEL_SIZE,
  x:Math.round(area.x+(area.width-PANEL_SIZE.width)/2),
  y:Math.round(area.y+(area.height-PANEL_SIZE.height)/2)};
 return fitPanel(desired,area);
}
function setSurface(value) {
 if(!['pet','panel'].includes(value))throw Error('显示模式无效。');
 if(surface===value)return true;
 finishDrag();rememberBounds();
 const before=win.getBounds();
 const saved=windowPrefs.get();
 surface=value;
 roam.setPanel(value==='panel');
 captureUntil=0;lastProbe=null;ignore(false);
 if(value==='panel'){
  const bounds=panelBounds(saved.panel,before);
  win.setResizable(true);
  win.setMinimumSize(Math.min(600,bounds.width),Math.min(540,bounds.height));
  win.setAlwaysOnTop(false);
  win.setBounds(bounds);
 }else{
  const position=saved.pet||defaultPet(screen.getPrimaryDisplay().workArea);
  win.setMinimumSize(1,1);
  win.setBounds(fitPet(position,closestArea(position,'pet')));
  win.setResizable(false);
  win.setAlwaysOnTop(true);
 }
 rememberBounds();
 return true;
}
handle('surface',setSurface);
handle('guide-seen',async()=>{
 windowPrefs.update({illustratedGuideSeen:true});
 await windowPrefs.flush();
 return true;
});
handle('window-drag-start',(payload,child)=>{
 if(payload?.surface==='roam')return !nativeDrag&&(child||surface==='pet')&&roam.start(payload,child);
 if(child)return false;
 if(!payload||payload.surface!==surface||nativeDrag||!win.isVisible())return false;
 const bounds=win.getBounds();
 const content=win.getContentBounds();
 const {x,y}=payload;
 if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>content.width||y>content.height)return false;
 if(surface==='pet'&&!roam.beginCampDrag())return false;
 lastProbe=null;
 ignore(false);
 nativeDrag={
  offsetX:x+content.x-bounds.x,offsetY:y+content.y-bounds.y,width:bounds.width,height:bounds.height,
  timer:setInterval(sampleDrag,16),watchdog:setTimeout(()=>finishDrag(),45000)
 };
 sampleDrag();
 return true;
});
handle('window-drag-end',(mode,finalSample,child)=>{
 if(mode==='roam')return roam.finish(finalSample===true);
 if(child)return false;
 if(mode!==surface)return false;
 return finishDrag(finalSample===true);
});
handle('hit-test',p=>{
 if(surface!=='pet'||nativeDrag||!p||typeof p.active!=='boolean'||p.id!==lastProbe?.id||Date.now()-lastProbe.at>250)return false;
 ignore(Date.now()<captureUntil?false:!p.active);
 return true;
});
handle('capture',active=>{
 if(typeof active!=='boolean')throw Error('指针状态无效。');
 captureUntil=active?Date.now()+10000:0;
 if(active)ignore(false);
 return true;
});
handle('window-settings',()=>({snow:windowPrefs.get().snow,appearance:windowPrefs.get().appearance??'classic'}));
handle('appearance-save',async appearance=>{
 if(!validAppearance(appearance))throw Error('角色外貌无效。');
 const previous=windowPrefs.get().appearance??'classic';
 windowPrefs.update({appearance});
 try{await windowPrefs.flush();}
 catch(error){
  if(windowPrefs.get().appearance===appearance)windowPrefs.update({appearance:previous});
  throw error;
 }
 return appearance;
});
handle('camp-snow',async enabled=>{
 if(typeof enabled!=='boolean')throw Error('特效状态无效。');
 windowPrefs.update({snow:enabled});
 await windowPrefs.flush();
 return {snow:enabled};
});
handle('movement-settings',()=>windowPrefs.get().wander??DEFAULT_WANDER);
handle('movement-save',async value=>{
 if(!validWander(value))throw Error('自由活动设置超出范围。');
 const prefs=wanderSettings(value);
 windowPrefs.update({wander:prefs});
 roam.configure(prefs);
 await windowPrefs.flush();
 return prefs;
});
handle('chat-sticker-settings',()=>windowPrefs.get().chatStickers!==false);
handle('chat-sticker-settings-save',async value=>{
 if(typeof value!=='boolean')throw Error('表情设置无效。');
 windowPrefs.update({chatStickers:value});
 await windowPrefs.flush();
 return value;
});
function action(name){win.webContents.send('desktop-action',name);}
function show(){win.show();win.focus();ignore(false);}
function sendWindowPlayNotice(message){
 if(win&&!win.isDestroyed())win.webContents.send('play-notice',message);
}
function requestWindowPlay(){
 setTimeout(async()=>{
  if(!win||win.isDestroyed()||!win.isVisible())return;
  if(surface!=='pet'){sendWindowPlayNotice('请先点「收回桌面」，再从桌宠菜单选「去窗口边上玩」。');return;}
  sendWindowPlayNotice('');
  try{
   action('pet-interaction');
   const problem=await roam.playWindow();
   if(problem)sendWindowPlayNotice(problem);
  }catch(error){sendWindowPlayNotice(error.message);}
 },220);
}
function contextMenu(){const menu=Menu.buildFromTemplate([{label:'打开好奇心营地',click:()=>action('camp')},{label:'回家',click:()=>{show();action('home');}},{label:'叫醒刘看山',click:()=>{show();action('wake');}},{label:'和刘看山聊聊',click:()=>action('chat')},{label:'打开山洞',click:()=>action('cave')},{label:'去窗口边上玩',click:requestWindowPlay},{label:'打开花园',click:()=>action('garden')},{label:'投喂内容',click:()=>action('feed')},{type:'separator'},{label:'暂停／恢复',click:()=>action('pause')},{label:'低打扰开关',click:()=>action('quiet')},{label:'模型与检索设置',click:()=>action('settings')},{label:'使用教程',click:()=>{show();action('tutorial');}},{label:'重置桌面布局',click:()=>action('reset-layout')},{label:'隐藏桌宠',click:()=>{stop();win.hide();}},{label:'退出',click:()=>{stop();app.quit();}}]);
 menu.on('menu-will-show',()=>roam.setMenu(true));
 menu.on('menu-will-close',()=>roam.setMenu(false));
 return menu;
}
let petPopup;
handle('menu',inRoam=>{
 const owner=inRoam?roam.child:win;
 if(petPopup||!owner?.isVisible())return false;
 const menu=contextMenu();
 petPopup=menu;
 if(inRoam)roam.hit(true);
 else{captureUntil=Date.now()+60000;ignore(false);}
 roam.setMenu(true);
 function close(){
  if(petPopup!==menu)return;
  petPopup=undefined;
  if(!inRoam)captureUntil=0;
  roam.setMenu(false);
 }
 try{menu.popup({window:owner,callback:close});}
 catch(error){close();throw error;}
 return true;
});
handle('control',command=>{if(command==='quit'){stop();app.quit();}else if(command==='hide'){stop();win.webContents.send('suspend');win.hide();}else if(command==='compact'){setSurface('pet');win.webContents.send('suspend');}else if(command==='expand'){setSurface('panel');}else throw Error('无效窗口操作。');return true;});
app.whenReady().then(async()=>{
 if(!hasInstanceLock)return;
 if(screen?.getPrimaryDisplay)await windowPrefs.read();
 weather.configure(localWeather());
 powerMonitor?.on('suspend',()=>roam.suspend(true));
 powerMonitor?.on('resume',()=>{roam.suspend(!win?.isVisible());void weather.refresh();});
 roam.configure(windowPrefs.get().wander??DEFAULT_WANDER);
 const primary=screen?.getPrimaryDisplay?.().workArea;
 const saved=windowPrefs.get().pet;
 const firstPosition=primary?defaultPet(primary):null;
 if(firstPosition&&isWoodlandPreview)firstPosition.x=primary.x+24;
 const initialPet=primary?(saved?fitPet(saved,closestArea(saved,'pet')):fitPet(firstPosition,primary)):PET_SIZE;
 const firstGuide=!!primary&&!windowPrefs.get().illustratedGuideSeen;
 const initial=firstGuide?panelBounds(windowPrefs.get().panel,initialPet):initialPet;
 if(firstGuide){
  if(!saved)windowPrefs.update({pet:{x:initialPet.x,y:initialPet.y}});
  surface='panel';
  roam.setPanel(true);
 }
 win=new BrowserWindow({title:isWoodlandPreview?'看山有伴 · 林间预览':'看山有伴 · 好奇心花园',...initial,frame:false,transparent:true,backgroundColor:'#00000000',
  resizable:firstGuide,hasShadow:false,alwaysOnTop:!firstGuide,skipTaskbar:false,
  ...(firstGuide?{minWidth:Math.min(600,initial.width),minHeight:Math.min(540,initial.height)}:{}),
  webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',e=>e.preventDefault());
 win.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
 const visible=value=>win.webContents.send('window-visibility',value);
 win.on('close',()=>{finishDrag();roam.dispose();stop();});
 win.on('blur',()=>{captureUntil=0;finishDrag();roam.press(false);});
 win.on('hide',()=>{finishDrag();roam.suspend(true);stop();visible(false);win.webContents.send('suspend');});
 win.on('minimize',()=>{finishDrag();roam.suspend(true);visible(false);});
 win.on('restore',()=>{roam.suspend(false);visible(true);});
 win.on('show',()=>{roam.suspend(false);visible(true);});
 win.on('focus',()=>visible(true));
 if(screen?.on){
  for(const event of ['display-added','display-removed','display-metrics-changed'])screen.on(event,reconcileDisplay);
 }
 if(primary){
  const remember=()=>{if(!nativeDrag&&!quitting)rememberBounds();};
  win.on('move',remember);
  win.on('resize',remember);
 }
 app.on('before-quit',event=>{
  stop();
  finishDrag();
  if(quitting)return;
  quitting=true;
  event.preventDefault();
  roam.dispose();
  weather.stop();
  hot.stop();
  localChat.stop();
  void Promise.allSettled([queue,configChange,windowPrefs.flush(),outfitPrefs.flush(),chat.flush(),hot.flush(),proactive.flush(),recommendations.flush(),teachings.flush()]).then(()=>app.quit());
 });
 const menu=Menu.buildFromTemplate([
  {label:'看山有伴',submenu:[{label:'显示桌宠',click:show},{label:'操作菜单',submenu:contextMenu()},
   {label:'隐藏',click:()=>win.hide()},{type:'separator'},{label:'退出',role:'quit'}]},
  {label:'编辑',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]}
 ]);
 Menu.setApplicationMenu(menu);
 if(screen?.getCursorScreenPoint){
  probeTimer=setInterval(()=>{
   roam.probe(++roamProbeId);
   if(!win||!win.isVisible()||surface!=='pet'||nativeDrag)return;
   roam.scanNearby();
   if(selecting||Date.now()<captureUntil){ignore(false);return;}
   const point=screen.getCursorScreenPoint();
   const bounds=win.getContentBounds();
   const x=point.x-bounds.x,y=point.y-bounds.y;
   if(x<0||y<0||x>=bounds.width||y>=bounds.height){
    lastProbe=null;ignore(true);
    if(!roam.away&&gazeNear(bounds,x,y))win.webContents.send('pointer-probe',{id:0,x,y});
    return;
   }
   lastProbe={id:++probeId,at:Date.now()};
   win.webContents.send('pointer-probe',{id:probeId,x,y});
  },25);
  app.on('before-quit',()=>clearInterval(probeTimer));
 }
 win.loadFile(path.join(__dirname,'../dist/index.html'),firstGuide?{query:{guide:'1'}}:undefined);
});
app.on('activate',()=>{if(win)show();});
app.on('window-all-closed',()=>app.quit());
