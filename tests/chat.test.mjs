import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import session from '../desktop/chat-session.cjs';
import model from '../desktop/chat-model.cjs';

const config=model.configuration({CHAT_PROVIDER:'ollama'});
const fixtureReply={text:'【模拟回复】收到。',tone:'calm'};

async function profile(t){
 const directory=await mkdtemp(join(tmpdir(),'kanshan-chat-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 return directory;
}

function send(service,activeId,message,options={}){
 const settings=options.config||config;
 return service.send({
  id:options.id||randomUUID(),messageId:options.messageId||randomUUID(),
  sessionId:activeId,configId:settings.configId,consent:true,message
 },{config:settings});
}

test('Ollama 走回环、请求携带角色历史与窗口，不返回思考字段',async()=>{
 assert.equal(config.endpoint,'http://127.0.0.1:11434/api/chat');
 assert.equal(model.configuration({CHAT_PROVIDER:'ollama',CHAT_BASE_URL:'http://127.0.0.1.example.invalid'}).ready,false);
 assert.equal(model.configuration({CHAT_PROVIDER:'ollama',CHAT_CONTEXT_TOKENS:'262144'}).ready,false);
 const messages=[{role:'system',content:'身份'},{role:'user',content:'上文'},{role:'assistant',content:'回应'},{role:'user',content:'继续'}];
 let captured;
 const reply=await model.request(messages,{config,fetchImpl:async(url,options)=>{
  captured={url,...JSON.parse(options.body)};
  return Response.json({done:true,done_reason:'stop',message:{thinking:'内部',content:'<think>同样不显示</think>真实文本字段'}});
 }});
 assert.deepEqual(reply,{text:'真实文本字段',tone:'calm'});
 assert.deepEqual(captured,{url:config.endpoint,model:'qwen3.5:9b',messages,stream:false,think:false,
  options:{num_ctx:4096,num_predict:384,temperature:0.4}});
 await assert.rejects(model.request(messages,{config,fetchImpl:async()=>new Response(null,{status:404})}),/找不到模型/);
});

test('文件重开恢复会话，按角色发送原文，新会话隔离且可返回',async t=>{
 const directory=await profile(t);
 const calls=[];
 const complete=async messages=>{calls.push(messages);return fixtureReply;};
 let service=session.createChatSession(directory,{complete});
 const {activeId}=await service.state();
 const first=await send(service,activeId,'第一条私有上下文');
 assert.equal(first.state.turns[0].state,'complete');
 assert.deepEqual(first.reply,fixtureReply);
 const file=join(directory,'chat-v1.json');
 assert.equal((await stat(file)).mode&0o777,0o600);
 service=session.createChatSession(directory,{complete});
 assert.equal((await service.state()).activeId,activeId);
 await send(service,activeId,'继续说');
 assert.deepEqual(calls.at(-1).slice(1),[
  {role:'user',content:'第一条私有上下文'},{role:'assistant',content:fixtureReply.text},{role:'user',content:'继续说'}
 ]);
 const next=await service.change('new');
 await send(service,next.activeId,'新会话里我说过什么？');
 assert.equal(calls.at(-1).length,2);
 assert.equal((await service.change('select',activeId)).turns.length,2);
 assert.equal((await service.change('clear')).turns.length,0);
 assert.equal((await service.change('select',next.activeId)).turns.length,1);
});

test('失败原地重试，取消后迟到回复无法覆盖重试或串入其他会话',async t=>{
 const directory=await profile(t);
 let fail=true,hold=false,resolveSlow,startSlow;
 const slowStarted=new Promise(resolve=>{startSlow=resolve;});
 const calls=[];
 const service=session.createChatSession(directory,{complete:async messages=>{
  calls.push(messages);
  if(fail){fail=false;throw Error('【模拟】网络失败');}
  if(hold){
   hold=false;
   return new Promise(resolve=>{resolveSlow=resolve;startSlow();});
  }
  return fixtureReply;
 }});
 const {activeId}=await service.state();
 const messageId=randomUUID();
 let result=await send(service,activeId,'允许重试的文本',{messageId});
 assert.equal(result.state.turns[0].state,'failed');
 result=await send(service,activeId,undefined,{messageId});
 assert.equal(result.state.turns.length,1);
 assert.equal(result.state.turns[0].state,'complete');
 await send(service,activeId,undefined,{messageId});
 assert.equal(calls.length,2);
 hold=true;
 const id=randomUUID(),second=randomUUID();
 const slow=send(service,activeId,'稍后取消',{id,messageId:second});
 await slowStarted;
 assert.equal(await service.cancel(id),true);
 assert.equal((await service.state()).turns.at(-1).state,'cancelled');
 result=await send(service,activeId,undefined,{messageId:second});
 assert.equal(result.state.turns.length,2);
 assert.equal(result.state.turns[1].assistant.content,fixtureReply.text);
 await service.change('new');
 resolveSlow({text:'模拟迟到回复',tone:'calm'});
 assert.equal((await slow).reply,undefined);
 assert.equal((await service.state()).turns.length,0);
 assert.equal((await service.change('select',activeId)).turns[1].assistant.content,fixtureReply.text);
});

test('预算触发滚动摘要，更新纠正，原始记录和近期角色原文保留',async t=>{
 const directory=await profile(t);
 const settings=model.configuration({CHAT_PROVIDER:'ollama',CHAT_CONTEXT_TOKENS:'2880',CHAT_REPLY_TOKENS:'384'});
 const budget=settings.context-settings.reply;
 const calls=[];
 const service=session.createChatSession(directory,{complete:async(messages,{summary})=>{
  assert.ok(session.estimateMessages(messages)<=budget);
  calls.push({messages,summary});
  if(!summary)return fixtureReply;
  const data=JSON.parse(messages.at(-1).content);
  return{text:data.用户最新更正?'【模拟摘要】日期更新为10日。':'【模拟摘要】日期原为8日。'};
 }});
 const {activeId}=await service.state();
 const sendOne=message=>send(service,activeId,message,{config:settings});
 await sendOne('日期是8日。');
 for(let i=0;i<8;i++){
  const result=await sendOne('题目 '+i+' '+('间隔话题。'.repeat(19)));
  assert.ok(result.reply,JSON.stringify(result.state.turns.at(-1)));
 }
 assert.ok(calls.some(call=>call.summary));
 const corrected=await sendOne('日期改成10日。');
 assert.ok(corrected.reply);
 assert.equal(calls.at(-1).messages.filter(message=>message.content.includes('日期改成10日。')).length,1);
 assert.ok((await sendOne('现在是什么日期？')).reply);
 const lastSummary=calls.findLast(call=>call.summary);
 assert.equal(JSON.parse(lastSummary.messages.at(-1).content).用户最新更正,'日期改成10日。');
 assert.match(calls.at(-1).messages[1].content,/10日/);
 assert.ok(calls.at(-1).messages.some(message=>message.role==='assistant'&&message.content===fixtureReply.text));
 const disk=JSON.parse(await readFile(join(directory,'chat-v1.json'),'utf8'));
 assert.match(disk.sessions[0].summary.text,/10日/);
 assert.equal(disk.sessions[0].turns.length,11);
 assert.equal(disk.sessions[0].turns[0].user.content,'日期是8日。');
});

test('恢复异常终止的等待状态，损坏文件原样保留',async t=>{
 const directory=await profile(t),file=join(directory,'chat-v1.json');
 const service=session.createChatSession(directory);
 await service.state();
 const data=JSON.parse(readFileSync(file,'utf8'));
 data.sessions[0].turns.push({state:'pending',user:{id:randomUUID(),role:'user',createdAt:new Date().toISOString(),content:'中断前的消息'}});
 await writeFile(file,JSON.stringify(data));
 const restarted=session.createChatSession(directory);
 assert.equal((await restarted.state()).turns[0].state,'cancelled');
 assert.equal(JSON.parse(readFileSync(file,'utf8')).sessions[0].turns[0].state,'cancelled');
 await writeFile(file,'损坏的会话文件');
 await assert.rejects(session.createChatSession(directory).state(),/原始文件已保留/);
 assert.equal(await readFile(file,'utf8'),'损坏的会话文件');
});

test('llama.cpp 走回环兼容协议，并为 Qwen 关闭思考输出',async()=>{
 const settings=model.configuration({CHAT_PROVIDER:'llama.cpp'});
 assert.equal(settings.endpoint,'http://127.0.0.1:8080/v1/chat/completions');
 assert.equal(model.configuration({CHAT_PROVIDER:'llama.cpp',CHAT_BASE_URL:'https://other.example'}).ready,false);
 const reply=await model.request([{role:'user',content:'继续'}],{config:settings,fetchImpl:async(url,options)=>{
  const body=JSON.parse(options.body);
  assert.equal(url,settings.endpoint);
  assert.deepEqual(body.chat_template_kwargs,{enable_thinking:false});
  assert.equal(options.headers.Authorization,undefined);
  assert.equal(body.max_tokens,384);
  return Response.json({choices:[{message:{reasoning_content:'只在服务层',content:'【模拟】正常回复'},finish_reason:'stop'}]});
 }});
 assert.equal(reply.text,'【模拟】正常回复');
});

test('滚动摘要过滤虚构的空值和无信息判断，保留已记录的事实',async()=>{
 const result=await model.request([{role:'user',content:'测试材料'}],{config,summary:true,fetchImpl:async()=>
  Response.json({done:true,message:{content:'用户阿岚选择了北区作为地点。关于地点，用户未明确提及，故记为未知。\n当前有效事实仅包含一次询问。\n计划：大门会合。'}})
 });
 assert.equal(result.text,'用户阿岚选择了北区作为地点。\n计划：大门会合。');
});

test('聊天默认直答快速档，支持备用档及显式回退，线上正文忽略推理',async()=>{
 const env={ZHIHU_ACCESS_SECRET:'fixture-zhihu',MODEL_PROVIDER:'openai-compatible',MODEL_API_KEY:'fixture-other',MODEL_NAME:'other-model'};
 const zhida=model.configuration(env);
 assert.equal(zhida.provider,'zhida');
 assert.equal(zhida.model,'zhida-fast-1p5');
 assert.equal(model.configuration({...env,ZHIDA_MODEL:'zhida-thinking-1p5'}).model,'zhida-thinking-1p5');
 assert.equal(model.configuration({...env,ZHIDA_MODEL:'zhida-agent'}).ready,false);
 assert.equal(model.configuration({...env,CHAT_PROVIDER:'existing'}).model,'other-model');
 assert.equal(model.configuration({MODEL_API_KEY:'fixture-other',MODEL_NAME:'other-model'}).ready,false);
 assert.doesNotMatch(JSON.stringify(model.publicStatus(zhida)),/fixture-zhihu/);
 const messages=model.chatMessages({config:zhida,turn:{user:{content:'新的问题'}},
  summary:'旧的事实',history:[{user:{content:'近期问题'},assistant:{content:'近期回答'}}]});
 assert.deepEqual(messages.map(message=>message.role),['system','user','assistant','user']);
 assert.match(messages[1].content,/旧的事实/);
 assert.match(messages[1].content,/近期问题$/);
 assert.equal(messages.filter(message=>message.content.includes('新的问题')).length,1);
 const reply=await model.request(messages,{config:zhida,fetchImpl:async(url,options)=>{
  assert.equal(url,'https://developer.zhihu.com/v1/chat/completions');
  assert.equal(options.headers.Authorization,'Bearer fixture-zhihu');
  assert.deepEqual(JSON.parse(options.body),{model:'zhida-fast-1p5',stream:false,messages});
  return Response.json({choices:[{finish_reason:'stop',message:{content:'回答正文',reasoning_content:'隐藏推理'}}]});
 }});
 assert.deepEqual(reply,{text:'回答正文',tone:'calm'});
});

test('直答 Skill 已注册，按原顺序且只请求一次，不接受空输入',async()=>{
 const zhida=model.configuration({ZHIHU_ACCESS_SECRET:'fixture-zhihu'});
 assert.equal(model.publicStatus(zhida).skillId,'zhida');
 assert.equal(model.publicStatus(config).skillId,undefined);
 const messages=[
  {role:'system',content:'身份'},
  {role:'user',content:'较早的历史摘要及上轮消息'},
  {role:'assistant',content:'上轮回复'},
  {role:'user',content:'继续'}
 ];
 let calls=0;
 const fetchImpl=async(_url,options)=>{
  calls++;
  assert.deepEqual(JSON.parse(options.body),{model:'zhida-fast-1p5',stream:false,messages});
  return Response.json({choices:[{finish_reason:'stop',message:{content:'收到'}}]});
 };
 await assert.rejects(model.request([],{config:zhida,fetchImpl}),{code:'invalid_input'});
 await model.request(messages,{config:zhida,fetchImpl});
 assert.equal(calls,1);
});

test('直答的鉴权、额度、空内容、中断、网络和超时都返回错误',async()=>{
 const zhida=model.configuration({ZHIHU_ACCESS_SECRET:'fixture',CHAT_TIMEOUT_MS:'1000'});
 const run=fetchImpl=>model.request([{role:'user',content:'测试直答传输'}],{config:zhida,fetchImpl});
 for(const [response,code] of [
  [new Response(null,{status:401}),'unauthorized'],
  [new Response(null,{status:403}),'forbidden'],
  [new Response(null,{status:429}),'rate_limit'],
  [Response.json({Code:30001}),'rate_limit'],
  [Response.json({Code:20001}),'unauthorized'],
  [Response.json({choices:[{finish_reason:'length',message:{content:'尚未完整'}}]}),'truncated'],
  [Response.json({choices:[{finish_reason:'stop',message:{content:'  '}}]}),'invalid_response']
 ])await assert.rejects(run(async()=>response),{code});
 await assert.rejects(run(async()=>{throw Error('offline');}),{code:'network'});
 await assert.rejects(run(async(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))),{code:'timeout'});
});
