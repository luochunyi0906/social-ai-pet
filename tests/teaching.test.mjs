import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,mkdir,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {teachingStore,teachingSession} from '../desktop/teaching.cjs';
import {createChatSession} from '../desktop/chat-session.cjs';
import {companionChat} from '../desktop/companion-chat.cjs';
import {configuration} from '../desktop/chat-model.cjs';

const config=configuration({CHAT_PROVIDER:'ollama'});
const profile=async t=>{
 const path=await mkdtemp(join(tmpdir(),'kanshan-teaching-test-'));
 t.after(()=>rm(path,{recursive:true,force:true}));
 return path;
};
const topic='怎么判断一个校园活动做得好不好？';
const explanation='我会先看活动目标，再选择相应指标，不能只看浏览量。比如想让同学报名，就看有效报名。';
const related='我准备做一个迎新招募，效果应该怎么衡量？';
const unrelated='豆腐炖汤应该放多久？';
const origin=async ({topic})=>({topic,source:{kind:'topic'}});
const addAnswer=(teacher,record,text=explanation)=>teacher.answer({id:record.id,text,messageId:randomUUID()});
const send=(chat,sessionId,message,progress)=>chat.send({sessionId,message,id:randomUUID(),messageId:randomUUID(),consent:true,
 configId:config.configId},{config,stickers:true,onProgress:progress});

test('仅确认后跨重启检索，回到原会话可追踪，输入无关不注入，编辑和撤回即时生效',async t=>{
 const directory=await profile(t),seen=[];
 const complete=async (messages,{onDelta})=>{
  const input=messages.at(-1).content;
  seen.push(input);
  if(input.includes('相关学习卡')){
   const text='你之前分享过，要先确定活动目标，再选能反映目标的指标。[[KS1]]';
   onDelta?.(text);
   return {text,tone:'calm'};
  }
  return {text:'这里没有匹配的教学材料。',tone:'calm'};
 };
 let store=teachingStore(directory),chat=createChatSession(directory,{teachings:store,complete});
 const original=(await chat.state()).activeId;
 const teacher=teachingSession({store,origin});
 const draft=await teacher.start({id:randomUUID(),sessionId:original,topic});
 const review=await addAnswer(teacher,draft);
 assert.equal(review.phase,'review');
 assert.deepEqual(await store.retrieve(related),[]);
 const [record,again]=await Promise.all([teacher.save({id:draft.id,value:review.card}),teacher.save({id:draft.id,value:review.card})]);
 assert.equal(record.id,again.id);
 assert.equal((await store.list()).length,1);
 assert.equal(record.messages[1].content,explanation);
 const file=join(directory,'teaching-v1.json');
 assert.equal((await stat(file)).mode&0o777,0o600);
 store=teachingStore(directory);chat=createChatSession(directory,{teachings:store,complete});
 assert.equal((await chat.state()).activeId,original);
 const next=(await chat.change('new')).activeId;
 assert.notEqual(next,original);
 const streamed=[];
 const retrieved=await send(chat,next,related,text=>streamed.push(text));
 assert.deepEqual(retrieved.state.turns[0].teachingRefs,[{id:record.id,revision:1}]);
 assert.ok(streamed.every(text=>!text.includes('KS1')));
 assert.match(retrieved.reply.text,/先确定活动目标/);
 assert.equal(retrieved.reply.text.includes('KS1'),false);
 assert.match(seen.at(-1),/不能只看浏览量/);
 assert.equal((await send(chat,next,unrelated)).state.turns.at(-1).teachingRefs,undefined);
 assert.doesNotMatch(seen.at(-1),/浏览量|相关学习卡/);
 const edited=await store.update({id:record.id,revision:1,action:'edit',
  value:{...record.card,summary:'我会先定目标，再跟踪七日到场转化率。'}});
 assert.equal(edited.revision,2);
 await send(chat,next,related);
 assert.match(seen.at(-1),/七日到场转化率/);
 assert.doesNotMatch(seen.at(-1),/不能只看浏览量/);
 const inactive=await store.update({id:record.id,revision:2,action:'deactivate'});
 await send(chat,next,related);
 assert.doesNotMatch(seen.at(-1),/七日到场转化率|相关学习卡|先确定活动目标/);
 const gone=await store.update({id:record.id,revision:inactive.revision,action:'delete'});
 assert.equal(gone.status,'deleted');
 assert.equal(gone.sessionId,original);
 assert.doesNotMatch(await readFile(file,'utf8'),/浏览量|七日到场转化率/);
 await assert.rejects(store.create(review,review.card),/已删除|不存在/);
 assert.deepEqual(await store.retrieve(related),[]);
});

test('缺证解释保留待核实，写失败不丢草稿，重试和重复确认不重复保存',async t=>{
 const directory=await profile(t);
 const store=teachingStore(directory);
 const teacher=teachingSession({store,origin});
 await store.list();
 const draft=await teacher.start({id:randomUUID(),sessionId:randomUUID(),topic:'为什么某种天文现象会发生'});
 let state=await addAnswer(teacher,draft,'这是我读过一些描述后对这种天文现象的理解，具体原因和资料还需要再查。');
 assert.equal(state.card.kind,'explanation');
 const file=join(directory,'teaching-v1.json');
 await mkdir(file);
 await assert.rejects(teacher.save({id:draft.id,value:state.card}),/未能保存/);
 assert.deepEqual(await store.list(),[]);
 await rm(file,{recursive:true});
 const saved=await teacher.save({id:draft.id,value:state.card});
 assert.equal(saved.card.verification,'unverified');
 assert.equal((await teacher.save({id:draft.id,value:state.card})).id,saved.id);
 await assert.rejects(store.update({id:saved.id,revision:0,action:'edit',value:saved.card}),/记录已更新/);
});

test('模型遗漏引用标记时只关联有明确复用证据的个人方法，泛泛回复不贴标',async t=>{
 const directory=await profile(t);
 const store=teachingStore(directory);
 const teacher=teachingSession({store,origin});
 let output='先明确活动目标，若想让同学报名，跟踪有效报名和转化率，比只看浏览量更适合这个指标。';
 const chat=createChatSession(directory,{teachings:store,complete:async()=>({text:output,tone:'calm'})});
 const sessionId=(await chat.state()).activeId;
 const draft=await teacher.start({id:randomUUID(),sessionId,topic});
 const review=await addAnswer(teacher,draft);
 const saved=await teacher.save({id:draft.id,value:review.card});
 const applied=await send(chat,sessionId,related);
 assert.deepEqual(applied.state.turns.at(-1).teachingRefs,[{id:saved.id,revision:1}]);
 assert.match(applied.reply.text,/你之前在学习卡里分享过「我会先看活动目标/);
 output='可以考虑海报和现场宣传这两个渠道。';
 const generic=await send(chat,sessionId,related);
 assert.equal(generic.state.turns.at(-1).teachingRefs,undefined);
 assert.equal(generic.reply.text,output);
});

test('真实格式候选须受控，最多两次追问，取消后的晚到候选无法串入新主题',async t=>{
 const store=teachingStore(await profile(t));
 let release,requested;
 const pending=new Promise(resolve=>{requested=resolve;});
 const teacher=teachingSession({store,origin,config:()=>config,complete:()=>new Promise(resolve=>{release=resolve;requested();})});
 const sessionId=randomUUID();
 const first=await teacher.start({id:randomUUID(),sessionId,topic});
 await assert.rejects(teacher.answer({id:first.id,messageId:randomUUID(),text:explanation,model:true,consent:false,
  configId:config.configId}),/授权/);
 const stale=teacher.answer({id:first.id,messageId:randomUUID(),text:explanation,model:true,consent:true,configId:config.configId});
 const rejection=assert.rejects(stale,{name:'AbortError'});
 await pending;
 const fresh=await teacher.start({id:randomUUID(),sessionId,topic:'手冲咖啡'});
 release({text:'错误格式'});
 await rejection;
 let step=await addAnswer(teacher,fresh,'先试一次');
 assert.equal(step.followups,1);
 step=await addAnswer(teacher,step,'比如水温');assert.equal(step.followups,2);
 step=await addAnswer(teacher,step,'每次调一次');assert.equal(step.phase,'review');
 assert.deepEqual(await store.list(),[]);
 assert.equal(step.topic,'手冲咖啡');
});

test('教学邀请沿用调度，睡眠和低打扰不显示，拒绝后保留原冷却',async t=>{
 let now=new Date(2026,10,19,10).getTime();
 const directory=await profile(t);
 const favorite={id:randomUUID(),title:'山坡上的种子'};
 const options={now:()=>now,hot:{},chat:{invitedFollowup:async()=>undefined},teachingCandidate:async seen=>seen.includes(favorite.id)?undefined:favorite};
 const reminders=companionChat(directory,options);
 assert.equal((await reminders.tick('sleep',false)).offer,null);
 const offer=(await reminders.tick('normal',false)).offer;
 assert.equal(offer.kind,'teaching');
 assert.equal((await reminders.tick('focus',false)).offer,null);
 assert.equal((await reminders.tick('focus',false)).badge,false);
 await reminders.choose(offer.id,'later');
 now+=20*60000;
 assert.equal((await reminders.tick('normal',false)).offer,null);
 now+=86400000;
 const reopened=companionChat(directory,options);
 now+=11*60000;
 assert.equal((await reopened.tick('normal',false)).offer.kind,'daily');
});
