const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');

const topics=[
 {line:'你好呀，今天过得怎么样？'},
 {line:'我刚想到，种子埋下去以后，最难判断的反而是什么时候该等。你最近有在等什么吗？'},
 {line:'有些路走熟了，就很少抬头看。我还挺喜欢偶尔换条路的。'},
 {line:'今天有没有哪一小段时间，过得比你想象中舒服？'},
 {line:'我想留一个没想明白的小问题。你最近有什么东西，明明每天都见到，却还说不清为什么会那样？'},
 {line:'同样一杯热茶，忙完了喝和边忙边喝，感觉好像不太一样。你今天有给自己留一点空吗？'}
];
const byFrequency={low:{spacing:6*3600000,start:10*60000,max:1},regular:{spacing:2*3600000,start:3*60000,max:3}};
const day=t=>{const d=new Date(t);return [d.getFullYear(),d.getMonth()+1,d.getDate()].join('-');};
const tomorrow=t=>{const d=new Date(t);d.setHours(24,0,0,0);return d.getTime();};
const defaults={enabled:true,frequency:'low'};
function hotOpening(post){
 const title=post.title.length<=92?post.title:post.title.slice(0,89)+'…';
 const thought=/游戏|手机|电脑|技术|人工智能|AI/i.test(title)?
  '我好奇这种变化会不会真的影响日常。':
  /旅行|城市|家乡|通勤/.test(title)?'我想知道同一件事，换个地方看会不会不一样。':
  /动物|植物|下雪|星空|山|自然/.test(title)?'这类平常容易错过的细节，我总想多看一眼。':
  '这条标题让我停了一下。我好奇大家会从哪里看出不同。';
 return '我看到知乎热榜在聊「'+title+'」。'+thought+'你看到标题先想到什么？';
}
function companionChat(directory,{hot,chat,now=Date.now,teachingCandidate}){
 const file=path.join(directory,'companion-chat-v1.json');
 let queue=Promise.resolve(),data,offer,started=now(),deferred;
 function serial(fn){
  const result=queue.then(fn);
  queue=result.catch(()=>{});
  return result;
 }
 async function load(){
  if(data)return;
  try{
   const value=JSON.parse(await fs.readFile(file,'utf8'));
   if(value.version!==1||typeof value.prefs?.enabled!=='boolean'||!Object.hasOwn(byFrequency,value.prefs.frequency))throw Error();
   data=value;
  }catch(error){
   if(error.code!=='ENOENT')throw Error('无法读取主动聊天设置，原文件已保留。');
   data={version:1,prefs:defaults,day:null,count:0,hotDay:null,nextAt:0,quietUntil:0,topicIndex:0,followupId:null};
  }
 }
 async function write(next){
  await fs.mkdir(directory,{recursive:true});
  const temp=file+'.'+randomUUID()+'.tmp';
  try{
   await fs.writeFile(temp,JSON.stringify(next),{flag:'wx',mode:0o600});
   await fs.rename(temp,file);
  }finally{await fs.rm(temp,{force:true});}
  data=next;
 }
 function view(mode){
  return {enabled:data.prefs.enabled,frequency:data.prefs.frequency,
   offer:mode==='normal'?offer??null:null,badge:Boolean(offer&&offer.kind!=='teaching'&&mode==='focus'),quietToday:data.quietUntil>now()};
 }
 async function tick(mode,hotBadge){
  if(!['normal','focus','sleep','busy'].includes(mode)||typeof hotBadge!=='boolean')throw Error('主动聊天状态无效。');
  return serial(async()=>{
   await load();
   const time=now(),today=day(time),rule=byFrequency[data.prefs.frequency];
   if(offer?.expires<=time)offer=undefined;
   if(!data.prefs.enabled||data.quietUntil>time||mode==='sleep'||mode==='busy')return view('sleep');
   if(offer||time<data.nextAt)return view(mode);
   let candidate;
   let resuming=false;
   if(deferred&&deferred.day===today&&time>=deferred.at){
    const old=deferred.candidate;
    if(!old.source||time-Date.parse(old.source.retrievedAt)<30*60000){
     candidate={...old,resumed:true};resuming=true;
    }
    deferred=undefined;
   }else if(hotBadge&&data.hotDay!==today){
    const state=await hot.state();
    if(state.cache&&day(Date.parse(state.cache.retrievedAt))===today&&time-Date.parse(state.cache.retrievedAt)<30*60000){
     const post=state.cache.items.find(item=>item.excerpt&&/自然|生活|植物|雪|日常|旅行|计算机|天气|创作|城市|读书/.test(item.title))??
      state.cache.items.find(item=>item.excerpt)??state.cache.items[0];
     if(post)candidate={kind:'hot',line:hotOpening(post),source:post};
    }
   }
   if(!candidate&&(data.day===null||time-started>=rule.start)&&(data.day!==today||data.count<rule.max)){
    const followup=await chat.invitedFollowup();
    if(followup&&followup.id!==data.followupId){
     candidate={kind:'followup',line:'你上次让我问问「'+followup.topic+'」。今天想聊聊进展吗？',followupId:followup.id};
    }else{
     const previous=Array.isArray(data.teachingInvites)?data.teachingInvites:[];
     const favorite=mode==='normal'?await teachingCandidate?.(previous,time).catch(()=>undefined):undefined;
     if(favorite)candidate={kind:'teaching',favoriteId:favorite.id,line:'你收藏的「'+favorite.title.slice(0,26)+'」，你会怎么讲给我听？'};
     else candidate={kind:'daily',line:topics[data.topicIndex%topics.length].line};
    }
   }
   if(!candidate)return view(mode);
   const next={...data,day:today,count:(data.day===today?data.count:0)+(resuming||candidate.kind==='hot'?0:1),nextAt:time+rule.spacing,
    hotDay:candidate.kind==='hot'?today:data.hotDay,
    topicIndex:data.topicIndex+(candidate.kind==='daily'?1:0),followupId:candidate.followupId??data.followupId,
    ...(candidate.kind==='teaching'?{teachingInvites:[...(Array.isArray(data.teachingInvites)?data.teachingInvites:[]),candidate.favoriteId].slice(-80)}:{})};
   await write(next);
   offer={...candidate,id:randomUUID(),expires:time+90000};
   return view(mode);
  });
 }
 function choose(id,action,stickers=false){
  if(!['talk','later','quiet'].includes(action))throw Error('主动聊天操作无效。');
  return serial(async()=>{
   await load();
   if(!offer||offer.id!==id||offer.expires<=now())throw Error('这条邀请已经收起。');
   const chosen=offer;
   if(action==='talk'){
    if(chosen.kind==='teaching'){
     offer=undefined;
     return {teachingFavoriteId:chosen.favoriteId};
    }
    const opening=await chat.opening(chosen,stickers);
    offer=undefined;
    if(chosen.kind==='hot')void hot.opened().catch(()=>{});
    return opening;
   }
   if(action==='quiet'){
    await write({...data,quietUntil:tomorrow(now())});
    deferred=undefined;
   }else if(chosen.kind!=='teaching'){
    await write({...data,nextAt:now()+15*60000});
    // Retry the same offer once in this process. Restart preserves the snooze time and daily deduplication.
    deferred=chosen.resumed?undefined:{day:day(now()),at:now()+15*60000,candidate:chosen};
   }
   offer=undefined;
  });
 }
 return {tick,choose,read:()=>serial(async()=>{await load();return data.prefs;}),
  settings:prefs=>serial(async()=>{
   await load();
   if(typeof prefs?.enabled!=='boolean'||!Object.hasOwn(byFrequency,prefs.frequency))throw Error('主动聊天设置无效。');
   await write({...data,prefs:{enabled:prefs.enabled,frequency:prefs.frequency}});
   if(!prefs.enabled){offer=undefined;deferred=undefined;}
   return data.prefs;
  }),flush:()=>queue,available:()=>offer?{id:offer.id,kind:offer.kind,expires:offer.expires}:null};
}
module.exports={companionChat};
