const {hasSticker,isCaveSticker,stickerFields,parseStickerReply}=require('./chat-stickers.cjs');
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {chatMessages,summaryMessages,request}=require('./chat-model.cjs');
const {hotIntent}=require('./hot-intent.cjs');
const {teachingEvidence}=require('./teaching.cjs');

const isId=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const cancelled=()=>new DOMException('对话已取消。','AbortError');
const explicitCorrection=/更正|纠正|改[成为到期]|换成|应该是|实际(?:上)?是|说错|记错|前面.*(?:作废|不算)|\b(?:correction|actually|changed to|update:)/i;
// Deliberately conservative planning estimate for an unknown tokenizer, including per-message framing.
const estimateMessages=messages=>64+messages.reduce((size,message)=>size+16+Buffer.byteLength(message.content),0);

function isMessage(value,role){
 return isId(value?.id)&&value.role===role&&typeof value.content==='string'&&
  Number.isFinite(Date.parse(value.createdAt));
}

function validate(data){
 if(data?.version!==1||!Array.isArray(data.sessions)||
  !data.sessions.some(session=>session?.id===data.activeId))throw Error();
 const ids=new Set();
 for(const session of data.sessions){
  if(!isId(session?.id)||ids.has(session.id)||!Number.isFinite(Date.parse(session.createdAt))||!Array.isArray(session.turns))throw Error();
  ids.add(session.id);
  const turnIds=new Set();
  for(const turn of session.turns){
   if(!isMessage(turn?.user,'user')||turnIds.has(turn.user.id)||!['pending','complete','failed','cancelled'].includes(turn.state)||
     (turn.state==='complete'?!isMessage(turn.assistant,'assistant')&&!(hasSticker(turn.user.stickerId)&&!turn.assistant):turn.assistant))throw Error();
   turnIds.add(turn.user.id);
  }
  if(session.summary&&(
   typeof session.summary.text!=='string'||!session.summary.text.trim()||
   !session.turns.some(turn=>turn.state==='complete'&&turn.user.id===session.summary.through)
  ))throw Error();
 }
}

function sourceData(post){
 if(!post)return undefined;
 return{
  title:String(post.title).slice(0,400),url:String(post.sourceUrl||post.url).slice(0,800),verification:post.verification,
  ...(post.verification==='api_excerpt'&&post.excerpt?{excerpt:String(post.excerpt).slice(0,2000)}:{})
 };
}

async function prepareContext(session,turn,config,signal,complete,stickers=false,teaching=[]){
 const history=session.turns.filter(record=>record.state==='complete'&&!record.teachingContext?.length);
 const previous=session.summary;
 let summary=previous;
 let remaining=history.slice(previous?history.findIndex(record=>record.user.id===previous.through)+1:0);
 const budget=config.context-config.reply;
 let contextTurn={...turn,teaching};
 let promptStickers=stickers;
 const prompt=(records,brief)=>chatMessages({turn:contextTurn,config,history:records,summary:brief?.text,opening:session.opening,stickers:promptStickers});
 if(teaching.length&&estimateMessages(prompt([],null))>budget*0.88)promptStickers=false;
 if(turn.source?.excerpt&&estimateMessages(prompt([],null))>budget*0.82){
  const source={...turn.source,excerpt:''};
  contextTurn={...contextTurn,source};
  const room=Math.max(0,Math.floor((budget*0.82-estimateMessages(prompt([],null)))/4));
  source.excerpt=turn.source.excerpt.slice(0,room);
 }
 if(contextTurn.teaching.length&&estimateMessages(prompt([],null))>budget*0.95){
  contextTurn.teaching=contextTurn.teaching.map(({card,...record})=>({...record,card:{...card,
   summary:card.summary.slice(0,220),scope:card.scope.slice(0,100),example:'',uncertainty:card.uncertainty.slice(0,90)}}));
 }
 while(contextTurn.teaching.length&&estimateMessages(prompt([],null))>budget){
  contextTurn.teaching=contextTurn.teaching.slice(0,-1);
 }
 const correction=remaining.findLast(record=>explicitCorrection.test(record.user.content))?.user;
 if(estimateMessages(prompt([],null))>budget)throw Error('本条消息和来源超出当前上下文预算，请缩短文字或提高聊天窗口。');

 async function summarize(chunk,update){
  const messages=summaryMessages(config,summary?.text||'',chunk,update?.content);
  if(estimateMessages(messages)>budget)throw Error('有一轮历史过长，暂时无法生成摘要。请提高聊天窗口后重试。');
  signal.throwIfAborted();
  let result;
  try{result=await complete(messages,{config,signal,summary:true});}
  catch(error){
   if(signal.aborted)throw signal.reason;
   throw Error('会话摘要生成失败。'+error.message);
  }
  signal.throwIfAborted();
  summary={through:chunk.at(-1)?.user.id||summary.through,
   text:result.text||summary?.text||'没有已确认的用户信息可补充。',
   correctionId:result.text&&update?update.id:summary?.correctionId,updatedAt:new Date().toISOString()};
 }

 // Compact in chronological batches. Leave more than the bare minimum of room for the next turn.
 while(estimateMessages(prompt(remaining,summary))>budget){
  if(!remaining.length)throw Error('本条消息与历史摘要超出当前预算，请缩短文字或提高聊天窗口。');
  let count=1;
  const target=budget*0.78;
  while(count<remaining.length-1 && estimateMessages(prompt(remaining.slice(count),summary))>target &&
    estimateMessages(summaryMessages(config,summary?.text||'',remaining.slice(0,count+1),correction?.content))<=budget)count++;
  const chunk=remaining.slice(0,count);
  const update=correction&&estimateMessages(summaryMessages(config,summary?.text||'',chunk,correction.content))<=budget?correction:undefined;
  await summarize(chunk,update);
  remaining=remaining.slice(count);
 }
 // Only settled turns may update the note. The pending message belongs exclusively in the final user turn.
 if(correction&&summary&&summary.correctionId!==correction.id&&estimateMessages(summaryMessages(config,summary.text,[],correction.content))<=budget){
  await summarize([],correction);
 }
 const messages=prompt(remaining,summary);
 if(estimateMessages(messages)>budget)throw Error('更新后的会话摘要超出当前预算，请提高聊天窗口后重试。');
 return{messages,summary,teaching:contextTurn.teaching};
}

const stripTeaching=text=>text.replace(/\s*\[\[KS(?:(?:\d{1,3})\]\]|\d{0,3}\]?\s*$)/gi,'').trim();
const teachingRefs=records=>records.map(({id,revision})=>({id,revision}));
function citeTeaching(text,records,question){
 const body=stripTeaching(text);
 const attributed=/你(?:之前|先前|以前|教过|分享|提到|当时|说过)|你教给我|你(?:上次|那时)|你曾|you (?:previously|shared|taught)/i.test(body);
 const cited=new Set([...text.matchAll(/\[\[KS(\d{1,3})\]\]/gi)].map(match=>Number(match[1])-1));
 const used=records.filter((record,index)=>cited.has(index)&&(attributed||teachingEvidence(record.card,question,body)>0));
 if(attributed&&used.length)return {text:body,refs:teachingRefs(used)};
 const matches=(used.length?used:records).map(record=>({record,score:teachingEvidence(record.card,question,body)}))
  .filter(({record,score})=>score>0&&(attributed||record.card.kind!=='explanation')).sort((a,b)=>b.score-a.score);
 const best=matches[0];
 if(!best||best.score===(matches[1]?.score??0))return {text:body,refs:[]};
 const first=best.record.card.summary.split(/[。！？\n]/u)[0].slice(0,120);
 const attribution=attributed?'':'你之前在学习卡里分享过「'+first+'」。\n\n';
 return {text:attribution+body,refs:teachingRefs([best.record])};
}

function createChatSession(directory,{complete=request,getHot,teachings}={}){
 const file=path.join(directory,'chat-v1.json');
 let queue=Promise.resolve(),database,activeRequest;
 function serialize(action){
  const next=queue.then(action);
  queue=next.catch(()=>{});
  return next;
 }

 function newSession(){
  return{id:randomUUID(),createdAt:new Date().toISOString(),turns:[],summary:null};
 }

 async function save(next){
  const temp=file+'.'+randomUUID()+'.tmp';
  try{
   await fs.mkdir(directory,{recursive:true});
   const handle=await fs.open(temp,'wx',0o600);
   try{await handle.writeFile(JSON.stringify(next));await handle.sync();}
   finally{await handle.close();}
   await fs.rename(temp,file);
  }catch{
   await fs.rm(temp,{force:true}).catch(()=>{});
   throw Error('无法保存会话，请检查本机存储并重试。');
  }
  database=next;
 }

 async function load(){
  if(database)return database;
  let data;
  try{
   data=JSON.parse(await fs.readFile(file,'utf8'));
   validate(data);
  }catch(error){
   if(error.code!=='ENOENT')throw Error('无法读取会话，原始文件已保留。');
   const first=newSession();
   await save({version:1,activeId:first.id,sessions:[first]});
   return database;
  }
  let interrupted=false;
  for(const session of data.sessions){
   for(const turn of session.turns){
    if(turn.state==='pending'){
     turn.state='cancelled';
     interrupted=true;
    }
   }
  }
  if(interrupted)await save(data);
  else database=data;
  return database;
 }

 function current(data){
  return data.sessions.find(session=>session.id===data.activeId);
 }

 function view(data){
  const session=current(data);
  return{
   activeId:data.activeId,
   sessions:data.sessions.map(({id,createdAt})=>({id,createdAt})),
   opening:session.opening,
   turns:session.turns.map(({user,assistant,state,error,source,hotList,hotTopic,teachingRefs})=>({user,assistant,state,error,sourceTitle:source?.title,hotList,hotTopic,teachingRefs}))
  };
 }

 function state(){
  return serialize(async()=>view(await load()));
 }
 function teachingOrigin(sessionId,messageId){
  return serialize(async()=>{
   const data=await load();
   const session=current(data);
   if(session.id!==sessionId)throw Error('会话已切换，请在当前会话开始。');
   if(!messageId)return;
   const user=session.turns.find(turn=>turn.user.id===messageId&&turn.state==='complete')?.user;
   if(!user?.content?.trim())throw Error('该话题已不在当前会话。');
   return user;
  });
 }

 function opening(offer,stickers=false){
  return serialize(async()=>{
   if(activeRequest)throw Error('请先结束当前对话。');
   const data=structuredClone(await load());
   if(data.sessions.some(session=>session.opening?.id===offer.id))throw Error('这段对话已经开始。');
   let session=current(data);
   if(session.opening||session.turns.length){
    session=newSession();data.sessions.push(session);data.activeId=session.id;
   }
   session.opening={id:offer.id,kind:offer.kind,line:offer.line,createdAt:new Date().toISOString(),
    ...(stickers?stickerFields(offer.kind==='daily'?'scarf_hello':'scarf_curious'):{}),
    source:offer.source?{...sourceData(offer.source),retrievedAt:offer.source.retrievedAt}:undefined};
   await save(data);
   return view(data);
  });
 }
 function invitedFollowup(){
  return serialize(async()=>{
   const data=await load();
   for(const session of [...data.sessions].reverse()){
    for(const turn of [...session.turns].reverse()){
     if(turn.state!=='complete')continue;
     const match=turn.user.content.match(/^(?:下次|改天)(?:见面)?[，,\s]*(?:请|记得|可以)?问(?:问)?我[：:\s]*(.{2,40}?)[。！!？?]?$/u);
     if(match)return {id:turn.user.id,topic:match[1]};
    }
   }
  });
 }

 async function finish(operation,result,error){
  return serialize(async()=>{
   const data=structuredClone(await load());
   const session=current(data);
   const turn=session.id===operation.sessionId&&session.turns.find(row=>row.user.id===operation.messageId);
   if(!operation.started||!turn||turn.state!=='pending')return{state:view(data)};
   if(operation.controller.signal.aborted)turn.state='cancelled';
   else if(error){
    turn.state='failed';
    turn.error=error.message;
   }else{
    turn.state='complete';
    turn.assistant={id:turn.responseId,role:'assistant',createdAt:new Date().toISOString(),content:result.reply.text,
     ...stickerFields(result.reply.stickerId)};
    if(result.hotList)turn.hotList=result.hotList;
    if(result.teachingContext?.length)turn.teachingContext=result.teachingContext;
    if(result.teachingRefs?.length)turn.teachingRefs=result.teachingRefs;
    session.summary=result.summary;
   }
   await save(data);
   return{state:view(data),reply:turn.state==='complete'?result.reply:undefined};
  });
 }

 function cancel(requestId){
  const operation=activeRequest;
  if(!operation||(requestId&&requestId!==operation.id))return Promise.resolve(false);
  operation.controller.abort(cancelled());
  activeRequest=null;
  return finish(operation).then(()=>true);
 }

 function change(mode,id){
  const stopping=cancel();
  return serialize(async()=>{
   await stopping;
   const data=structuredClone(await load());
   if(mode==='new'){
    const session=newSession();
    data.sessions.push(session);
    data.activeId=session.id;
   }else if(mode==='select'){
    if(!data.sessions.some(session=>session.id===id))throw Error('找不到该会话。');
    data.activeId=id;
   }else{
    const session=current(data);
    session.turns=[];
    session.summary=null;
    delete session.opening;
   }
   await save(data);
   return view(data);
  });
 }

 function sendSticker({sessionId,messageId,stickerId}={},{allowCaveReward=false}={}){
  if(!isId(sessionId)||!isId(messageId)||!hasSticker(stickerId))throw Error('表情消息无效。');
  if(isCaveSticker(stickerId)&&!allowCaveReward)throw Error('这套表情需要先获得山洞赠礼。');
  return serialize(async()=>{
   if(activeRequest)throw Error('请先完成或停止正在进行的对话。');
   const data=structuredClone(await load());
   const session=current(data);
   if(session.id!==sessionId)throw Error('会话已切换，请在当前会话发送。');
   if(!session.turns.some(row=>row.user.id===messageId)){
    session.turns.push({user:{id:messageId,role:'user',content:'',...stickerFields(stickerId),createdAt:new Date().toISOString()},state:'complete'});
    await save(data);
   }
   return view(data);
  });
 }

 async function send(payload,{config,source,stickers=false,onProgress}){
  const {id,messageId,sessionId,consent,configId}=payload||{};
  if(!isId(id)||!isId(messageId)||!isId(sessionId))throw Error('消息标识无效。');
  if(consent!==true)throw Error('请先授权发送本次文字与会话上下文。');
  if(configId!==config.configId)throw Error('聊天配置已变化，请刷新状态并重新授权。');
  if(activeRequest)throw Error('请先完成或停止正在进行的对话。');

  const controller=new AbortController();
  const operation={id,messageId,sessionId,controller,started:false};
  activeRequest=operation;
  try{
   const prepared=await serialize(async()=>{
    controller.signal.throwIfAborted();
    const data=structuredClone(await load());
    const session=current(data);
    if(session.id!==sessionId)throw Error('会话已切换，请在当前会话发送。');
    let turn=session.turns.find(row=>row.user.id===messageId);
    if(turn?.state==='complete')return{state:view(data)};
    const previous=session.turns.findLast(row=>!row.user.stickerId||row.assistant);
    const batch=getHot?session.turns.findLast(row=>row.hotList)?.hotList:undefined;
    const intent=getHot?hotIntent(String(turn?.user.content??payload.message??''),Boolean(batch)):undefined;
    const listing=intent&&Object.hasOwn(intent,'limit');
    if(!listing&&!config.ready)throw Error(config.issues.join(' '));
    if(turn){
     if(turn!==session.turns.at(-1)||!['failed','cancelled'].includes(turn.state))throw Error('只能重试当前会话最近一条失败或取消的消息。');
     if(payload.message!==undefined&&(typeof payload.message!=='string'||payload.message.trim()!==turn.user.content))throw Error('重试内容与原消息不同。');
     turn.state='pending';
     delete turn.error;
    }else{
     if(typeof payload.message!=='string'||!payload.message.trim()||payload.message.length>2000)throw Error('请输入 2000 字以内的非空消息。');
     if(payload.sourceId&&!source)throw Error('关联来源已失效，请重新打开来源。');
     const referenced=intent&&Object.hasOwn(intent,'index')?batch.items[intent.index]:undefined;
     if(intent&&Object.hasOwn(intent,'index')&&!referenced)throw Error('这份热榜没有该位置，请按刚才展示的列表选择。');
     const followup=!source&&!referenced?(previous?.hotTopic?previous.source:!previous?session.opening?.source:undefined):undefined;
     turn={user:{id:messageId,role:'user',content:payload.message.trim(),createdAt:new Date().toISOString()},state:'pending',
      source:listing?undefined:sourceData(referenced||source)||followup,
      hotTopic:!listing&&Boolean(referenced||typeof payload.sourceId==='string'&&payload.sourceId.startsWith('hot:')||followup)};
     session.turns.push(turn);
    }
    turn.responseId??=randomUUID();
    await save(data);
    operation.started=true;
    return{session,turn,listing:listing?intent:undefined};
   });
   if(!prepared.turn)return prepared;
   let result,error;
   try{
    const signal=controller.signal;
    if(prepared.listing){
     const hotList=await getHot(prepared.listing.limit,prepared.listing.force,signal);
     result={hotList,summary:prepared.session.summary,reply:{tone:'calm',
      text:hotList.items.length?`知乎热榜 · 展示 ${hotList.items.length} 条`:'知乎本次没有返回热榜条目。'}};
    }else{
     const retrieved=teachings?await teachings.retrieve(prepared.turn.user.content).catch(()=>[]):[];
     const {messages,summary,teaching}=await prepareContext(prepared.session,prepared.turn,config,signal,complete,stickers,retrieved);
     operation.teaching=teachingRefs(teaching);
     if(teaching.length&&!await teachings.current(operation.teaching))throw Error('学习记录已更新，请重试这条消息。');
     signal.throwIfAborted();
     let visible='';
     const raw=await complete(messages,{config,signal,onDelta:onProgress?partial=>{
      const text=stripTeaching(parseStickerReply(partial).text);
      if(text&&text!==visible&&!signal.aborted){visible=text;onProgress(text,prepared.turn.responseId);}
     }:undefined});
     const reply={tone:raw.tone,...parseStickerReply(raw.text,true,stickers)};
     const citation=citeTeaching(reply.text,teaching,prepared.turn.user.content);
     reply.text=citation.text;
     if(!reply.text)throw Error('模型未返回可用的正文，可以重试。');
     if(teaching.length&&!await teachings.current(operation.teaching))throw Error('学习记录已更新，请重试这条消息。');
     result={reply,summary,teachingContext:operation.teaching,teachingRefs:citation.refs};
    }
   }catch(problem){error=problem;}
   // A cancelled operation has already queued its own write. Its late reply cannot change a retry with the same message ID.
   if(controller.signal.aborted)return{state:await state()};
   return await finish(operation,result,error);
  }finally{
   if(activeRequest===operation)activeRequest=null;
  }
 }
 return{state,send,sendSticker,cancel,change,opening,invitedFollowup,teachingOrigin,
  invalidateTeaching:id=>activeRequest?.teaching?.some(ref=>ref.id===id)?cancel(activeRequest.id):Promise.resolve(false),
  busy:()=>Boolean(activeRequest),flush:()=>queue};
}

module.exports={createChatSession,prepareContext,estimateMessages};
