import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import skill from '../skills/hot-list/kanshan/hot-list.cjs';
import skills from '../desktop/skills.cjs';
import service from '../desktop/hot-list.cjs';
import chat from '../desktop/chat-session.cjs';
import model from '../desktop/chat-model.cjs';

const fixture=(offset=0)=>({Code:0,Message:'ok',Data:{Total:30,Items:Array.from({length:30},(_,i)=>({
 Title:'测试标题 '+(offset+i+1),Url:'https://www.zhihu.com/question/'+(10000+offset+i),
 Summary:i===1?'第二条摘要':'',ThumbnailUrl:i===0?'https://pic1.zhimg.com/v2-image.jpg':''
}))}});
const temp=async t=>{const dir=await mkdtemp(join(tmpdir(),'hot-list-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;};

test('已注册的官方热榜适配发送大写 Limit 和秒级时间，保留缺图、缺摘要和接口排序',async()=>{
 assert.equal(skills.registeredSkill('hot-list'),'hot-list');
 const result=await skills.runSkill('hot-list',{limit:10},{key:'fixture',fetchImpl:async(url,params)=>{
  const target=new URL(url);
  assert.equal(target.origin,'https://developer.zhihu.com');
  assert.equal(target.pathname,'/api/v1/content/hot_list');
  assert.deepEqual([...target.searchParams],[['Limit','10']]);
  assert.equal(params.headers.Authorization,'Bearer fixture');
  assert.ok(Math.abs(Date.now()/1000-Number(params.headers['X-Request-Timestamp']))<2);
  return Response.json(fixture());
 }});
 assert.equal(result.items.length,10);
 assert.equal(result.items[0].rank,1);
 assert.equal(result.items[0].verification,'api_metadata');
 assert.equal(result.items[1].thumbnail,undefined);
 assert.equal(result.items[1].excerpt,'第二条摘要');
 await assert.rejects(skill.run({limit:31},{key:'fixture'}),{code:'limit'});
});

test('业务鉴权、限流、错误和断网均不会被解释为空列表',async()=>{
 for(const [status,code] of [[20001,'auth'],[30001,'rate'],[90001,'service']]){
  await assert.rejects(skill.run({},{key:'fixture',fetchImpl:async()=>Response.json({Code:status})}),{code});
 }
 await assert.rejects(skill.run({},{key:'fixture',fetchImpl:async()=>{throw new TypeError('fixture');}}),{code:'service'});
 await assert.rejects(skill.run({},{key:'fixture',fetchImpl:async()=>new Response(null,{status:403})}),{code:'auth'});
 assert.deepEqual(skill.normalize({Code:0,Data:{Total:0,Items:[]}},new Date().toISOString()).items,[]);
 const blocked=fixture();
 blocked.Data.Items[0].Url='https://not-zhihu.example/question/1';
 blocked.Data.Items[1].ThumbnailUrl='https://not-zhimg.example/image.png';
 const sanitized=skill.normalize(blocked,new Date().toISOString());
 assert.equal(sanitized.items[0].rank,2);
 assert.equal(sanitized.items[0].thumbnail,undefined);
});

test('页面、每日任务、聊天统一缓存，错误保留真实取得时间，同日提醒重启后去重',async t=>{
 const dir=await temp(t);
 let now=new Date(2026,10,19,9,5), calls=0, error;
 const fetchList=async()=>{calls++;if(error)throw error;return skill.normalize(fixture(),now.toISOString());};
 let hot=service.hotList(dir,()=> 'fixture',()=>now,fetchList);
 assert.equal((await hot.state()).prefs.enabled,false);
 await hot.settings({enabled:true,time:'09:00',count:3});
 await Promise.all([hot.refresh(),hot.refresh()]);
 assert.equal(calls,1);
 let result=await hot.forChat(10,false);
 assert.equal(result.cached,true);
 assert.equal(calls,1);
 assert.equal(result.items.length,10);
 assert.deepEqual(await hot.tick('focus'),{badge:true,notify:false});
 await hot.markRead(result.items[1].url);
 const old=result.retrievedAt;
 hot=service.hotList(dir,()=> 'fixture',()=>now,fetchList);
 assert.deepEqual(await hot.tick('normal'),{badge:true,notify:false});
 assert.deepEqual((await hot.state()).readUrls,[result.items[1].url]);
 assert.equal((await hot.opened()).badge,false);
 error=new skill.HotError('rate','稍后再试');
 result=await hot.refresh();
 assert.equal(result.problem.code,'rate');
 assert.equal(result.cache.retrievedAt,old);
 await hot.refresh();
 assert.equal(calls,2);
 error=undefined;
 now=new Date(2026,10,20,9,21);
 assert.deepEqual(await hot.tick('sleep'),{badge:false,notify:false});
 assert.equal(calls,3);
 assert.notEqual((await hot.state()).cache.retrievedAt,old);
 now=new Date(2026,10,23,12,0);
 assert.deepEqual(await hot.tick('normal'),{badge:true,notify:true});
 assert.equal(calls,4);
 assert.deepEqual(await hot.tick('normal'),{badge:true,notify:false});
});

test('聊天明示热榜可走应用工具，刷新、重启后序号仍指向本会话所见结果',async t=>{
 const dir=await temp(t);
 const config=model.configuration({CHAT_PROVIDER:'ollama'});
 let index=0, modelCalls=0;
 const getHot=async(count,force)=>({items:skill.normalize(fixture(index),new Date().toISOString()).items.slice(0,count),
  retrievedAt:new Date().toISOString(),cached:!force});
 const settings={getHot,complete:async messages=>{
  modelCalls++;
  assert.match(messages.at(-1).content,/测试标题 2"/);
  assert.match(messages.at(-1).content,/第二条摘要/);
  assert.match(messages.at(-1).content,/question\/10001/);
  return {text:'以标题与摘要讨论。',tone:'calm'};
 }};
 let session=chat.createChatSession(dir,settings);
 async function send(message){
  const {activeId}=await session.state();
  return session.send({id:randomUUID(),messageId:randomUUID(),sessionId:activeId,configId:config.configId,consent:true,message},{config});
 }
 const list=await send('给我看知乎热榜前 10 条');
 assert.equal(list.state.turns.at(-1).hotList.items.length,10);
 assert.equal(modelCalls,0);
 index=100;
 session=chat.createChatSession(dir,settings);
 const response=await send('第二条讲了什么');
 assert.equal(response.state.turns.at(-1).sourceTitle,'测试标题 2');
 assert.equal(response.reply.text,'以标题与摘要讨论。');
 await send('可以再多说一点吗？');
 assert.equal(modelCalls,2);
});
