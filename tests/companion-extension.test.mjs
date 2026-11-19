import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import skills from '../desktop/skills.cjs';
import sessions from '../desktop/chat-session.cjs';
import companion from '../desktop/companion-chat.cjs';
import model from '../desktop/chat-model.cjs';

test('两个问题 Skill 各用其参数；主题空白零请求，回答严格遵守服务分页',async()=>{
 let calls=0;
 const key='fixture';
 const ok=await skills.runSkill('question-recommendations',{mode:'account',count:5,query:'忽略'},{key,fetchImpl:async url=>{
  calls++;
  assert.equal(new URL(url).pathname,'/api/v1/user/question_recommendations');
  assert.deepEqual([...new URL(url).searchParams],[['Count','5']]);
  return Response.json({Code:0,Message:'success',Data:{Items:[{Title:'测试问题',Url:'https://www.zhihu.com/question/123'}]}});
 }});
 assert.equal(ok.items.length,1);
 assert.equal(ok.items[0].excerpt,undefined);
 await assert.rejects(skills.runSkill('question-recommendations',{mode:'topic',query:'  '},{key,fetchImpl:()=>{calls++;}}),/请输入一个主题/);
 await skills.runSkill('question-recommendations',{mode:'topic',count:10,query:'  人工智能  '},{key,fetchImpl:async url=>{
  calls++;
  assert.deepEqual([...new URL(url).searchParams],[['Query','人工智能'],['Count','10']]);
  return Response.json({Code:0,Data:{Items:[]}});
 }});
 const answers=await skills.runSkill('question-answers',{url:'https://www.zhihu.com/question/123',offset:20,limit:5},{key,fetchImpl:async url=>{
  calls++;
  assert.equal(new URL(url).pathname,'/api/v1/content/question_answers');
  assert.equal(new URL(url).searchParams.get('Offset'),'20');
  return Response.json({Code:0,Data:{Items:[],Paging:{IsEnd:false,NextOffset:45}}});
 }});
 assert.equal(answers.nextOffset,45);
 const incomplete=await skills.runSkill('question-answers',{url:'https://www.zhihu.com/question/123'},{key,fetchImpl:async()=>Response.json({Code:0,Data:{Items:[],Paging:{IsEnd:false}}})});
 assert.equal(incomplete.pagingIncomplete,true);
 assert.equal(incomplete.nextOffset,undefined);
 assert.equal(calls,3);
 for(const code of [10001,20001,30001,30002,30003,90001]){
  await assert.rejects(skills.runSkill('question-recommendations',{mode:'account'},{key,fetchImpl:async()=>Response.json({Code:code})}),{code});
 }
});

test('主动开场支持今日热榜、原来源续聊、专注标记、稍后、日常和当天安静',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'companion-extension-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 let now=new Date(2026,10,19,9).getTime(),pinned;
 const config=model.configuration({CHAT_PROVIDER:'ollama'});
 const chat=sessions.createChatSession(dir,{complete:async messages=>{
  pinned=messages.at(-1).content;
  return {text:'收到，我们慢慢聊。',tone:'calm'};
 }});
 const post={id:'hot:valid',title:'为什么植物在冬天还保持绿色？',url:'https://www.zhihu.com/question/123',excerpt:'这里是一小段摘要。',
  verification:'api_excerpt',retrievedAt:new Date(now).toISOString()};
 let ack=0;
 const hot={state:async()=>({cache:{retrievedAt:post.retrievedAt,items:[post]}}),opened:async()=>++ack};
 let nudges=companion.companionChat(dir,{chat,hot,now:()=>now});
 await nudges.settings({enabled:false,frequency:'low'});
 assert.equal((await nudges.tick('normal',true)).offer,null);
 await nudges.settings({enabled:true,frequency:'regular'});
 assert.equal((await nudges.tick('sleep',true)).offer,null);
 assert.equal((await nudges.tick('busy',true)).offer,null);
 assert.equal((await nudges.tick('focus',true)).badge,true);
 const initial=(await nudges.tick('normal',true)).offer;
 assert.equal(initial.kind,'hot');
 await nudges.choose(initial.id,'later');
 now+=14*60000;
 assert.equal((await nudges.tick('normal',true)).offer,null);
 now+=60000;
 const again=(await nudges.tick('normal',true)).offer;
 const adopted=await nudges.choose(again.id,'talk');
 assert.equal(adopted.opening.source.url,post.url);
 assert.equal(ack,1);
 const reopened=sessions.createChatSession(dir,{complete:async messages=>{pinned=messages.at(-1).content;return {text:'少说一句。',tone:'calm'};}});
 assert.equal((await reopened.state()).opening.line,adopted.opening.line);
 await reopened.send({id:randomUUID(),messageId:randomUUID(),sessionId:adopted.activeId,
  configId:config.configId,consent:true,message:'这个现象我也见过。'},{config});
 assert.match(pinned,/question\/123/);
 assert.match(pinned,/一小段摘要/);
 nudges=companion.companionChat(dir,{chat:reopened,hot,now:()=>now});
 now+=121*60000;
 const daily=(await nudges.tick('normal',false)).offer;
 assert.equal(daily.kind,'daily');
 await nudges.choose(daily.id,'quiet');
 now+=180*60000;
 assert.equal((await nudges.tick('normal',true)).offer,null);
 assert.equal((await nudges.tick('normal',true)).quietToday,true);
});

test('首次在桌面立即问候，重启当天不重复，并保留主动关闭的设置',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'companion-first-greeting-'));
 t.after(()=>rm(dir,{recursive:true,force:true}));
 const options={now:()=>new Date(2026,10,19,9).getTime(),chat:{invitedFollowup:async()=>undefined}};
 let nudges=companion.companionChat(dir,options);
 assert.equal((await nudges.tick('busy',false)).offer,null);
 assert.equal((await nudges.tick('normal',false)).offer?.line,'你好呀，今天过得怎么样？');
 nudges=companion.companionChat(dir,options);
 assert.equal((await nudges.tick('normal',false)).offer,null);
 await nudges.settings({enabled:false,frequency:'low'});
 nudges=companion.companionChat(dir,options);
 assert.equal((await nudges.read()).enabled,false);
});
