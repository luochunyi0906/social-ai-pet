import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {parseStickerReply,stickerFields} from '../desktop/chat-stickers.cjs';
import {createChatSession} from '../desktop/chat-session.cjs';
import {configuration,request} from '../desktop/chat-model.cjs';

const marker='[[LKS_STICKER:emo_happy]]';
test('分块标记、无效 ID、不完整标记、多个表情与关闭偏好均安全处理',()=>{
 for(let i=0;i<=marker.length;i++){
  assert.deepEqual(parseStickerReply('真好。\n'+marker.slice(0,i)),{text:'真好。'});
 }
 assert.deepEqual(parseStickerReply('真好。\n'+marker,true),{text:'真好。',stickerId:'emo_happy'});
 for(const tail of ['[[LKS_STIC','[[LKS_STICKER]]','[[LKS_STICKER:../../a.png]]','[[LKS_STICKER:unknown]]',marker+marker]){
  assert.deepEqual(parseStickerReply('真好。 '+tail,true),{text:'真好。'});
 }
 assert.deepEqual(parseStickerReply('真好。\n'+marker,true,false),{text:'真好。'});
 assert.deepEqual(parseStickerReply('普通回复。',true),{text:'普通回复。'});
});

test('围巾系列使用本地对白标记，播种庆祝保留给真实事件，媒体路径不进入模型记录',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'kanshan-scarf-history-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const tag='[[LKS_STICKER:scarf_cheer]]';
 for(let i=0;i<=tag.length;i++)assert.deepEqual(parseStickerReply('加油。\n'+tag.slice(0,i)),{text:'加油。'});
 assert.deepEqual(parseStickerReply('加油。\n'+tag,true),{text:'加油。',stickerId:'scarf_cheer'});
 assert.deepEqual(parseStickerReply('我听见了。\n[[LKS_STICKER:scarf_celebrate]]',true),{text:'我听见了。'});
 let input;
 const complete=async messages=>{input=messages;return{text:'加油。\n'+tag,tone:'warm'};};
 const config=configuration({CHAT_PROVIDER:'zhida',ZHIHU_ACCESS_SECRET:'test-only'});
 let chat=createChatSession(directory,{complete});
 const open=await chat.opening({id:randomUUID(),kind:'followup',line:'你上次提到一个想继续聊的问题。'},true);
 assert.deepEqual({...open.opening,...stickerFields('scarf_curious')},open.opening);
 assert.equal(open.opening.stickerId,'scarf_curious');
 const send=()=>chat.send({id:randomUUID(),messageId:randomUUID(),sessionId:open.activeId,message:'准备开始学习了。',configId:config.configId,consent:true},
  {config,stickers:true,onProgress(){}}); 
 const first=await send();
 const assistant=first.state.turns[0].assistant;
 assert.equal(assistant.stickerPack,'camp-scarf-v1');
 assert.match(assistant.stickerAlt,/加油/);
 chat=createChatSession(directory,{complete});
 assert.deepEqual((await chat.state()).turns[0].assistant,assistant);
 await send();
 assert.ok(input.some(m=>m.role==='assistant'&&m.content.includes('刘看山发送了加油表情')));
 assert.ok(input.every(m=>!m.content.includes('scarf_cheer-frames.png')));
});

test('知乎分块流隐藏标记，完成后才提交，取消、断流重试、重启及用户表情归属',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'kanshan-stickers-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 const config=configuration({CHAT_PROVIDER:'zhida',ZHIHU_ACCESS_SECRET:'test-only'});
 const encoder=new TextEncoder();
 let mode='cut',requestBody,partial,late;
 const complete=(input,options)=>request(input,{...options,fetchImpl:async(_url,params)=>{
  requestBody=JSON.parse(params.body);
  const records=['完成作业了，真好。\n','[[L','KS_STICKER:emo_','happy]]'];
  const rows=records.map(content=>'data: '+JSON.stringify({choices:[{delta:{content}}]})+'\n\n');
  const bytes=encoder.encode(rows.join('')+(mode==='cut'?'':'data: [DONE]\n\n'));
  return new Response(new ReadableStream({start(controller){
   for(let offset=0;offset<bytes.length;offset+=7)controller.enqueue(bytes.slice(offset,offset+7));
   if(mode==='hold')late=()=>{controller.close();};else controller.close();
  },cancel(){late=()=>{};}}),{headers:{'Content-Type':'text/event-stream'}});
 }});
 let chat=createChatSession(directory,{complete});
 const {activeId}=await chat.state();
 const manual={sessionId:activeId,messageId:randomUUID(),stickerId:'emo_expect'};
 await chat.sendSticker(manual);
 await chat.sendSticker(manual);
 assert.equal((await chat.state()).turns[0].assistant,undefined);
 await assert.rejects(async()=>chat.sendSticker({...manual,stickerId:'__proto__'}),/无效/);
 const base={sessionId:activeId,messageId:randomUUID(),message:'终于交了作业！',configId:config.configId,consent:true};
 const seen=[];
 const send=(payload=base)=>chat.send({...payload,id:randomUUID()},{config,stickers:true,onProgress:text=>{seen.push(text);partial?.();}});
 const failed=await send();
 assert.equal(failed.state.turns.at(-1).state,'failed');
 assert.equal(failed.state.turns.at(-1).assistant,undefined);
 assert.ok(seen.length>0&&seen.every(line=>!line.includes('[[')));
 assert.deepEqual(Object.keys(requestBody).sort(),['messages','model','stream']);
 assert.equal(requestBody.stream,true);
 assert.match(requestBody.messages.at(-1).content,/用户发送了期待表情/);
 mode='hold';
 const started=new Promise(resolve=>partial=resolve);
 const pending=send();
 await started;
 await chat.cancel();
 late();
 await pending;
 assert.equal((await chat.state()).turns.at(-1).state,'cancelled');
 mode='done';
 const done=await send();
 assert.equal(done.state.turns.length,2);
 assert.equal(done.state.turns.at(-1).assistant.stickerId,'emo_happy');
 assert.ok(!done.state.turns.at(-1).assistant.content.includes('[['));
 chat=createChatSession(directory,{complete});
 assert.equal((await chat.state()).turns.at(-1).assistant.id,done.state.turns.at(-1).assistant.id);
 await send({...base,messageId:randomUUID(),message:'谢谢。'});
 assert.ok(requestBody.messages.some(line=>line.role==='assistant'&&line.content.includes('刘看山发送了开心表情：给你鼓掌')));
});
