import { skipGuide } from './skip-guide.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';

const root=fileURLToPath(new URL('../',import.meta.url));
const executablePath=resolve(root,process.env.KANSHAN_PACKAGE_DIR||'release','看山有伴.app/Contents/MacOS/Kanshan');
const profile=await mkdtemp(join(tmpdir(),'kanshan-native-chat-'));
const real=process.env.KANSHAN_CHAT_REAL==='1';
const provider=process.env.KANSHAN_CHAT_PROVIDER||'ollama';
const llama=provider==='llama.cpp';
const zhida=provider==='zhida';
const model=process.env.KANSHAN_CHAT_MODEL||(zhida?'zhida-fast-1p5':'qwen3.5:9b');
const base=zhida?'https://developer.zhihu.com':process.env.KANSHAN_CHAT_BASE_URL||(llama?'http://127.0.0.1:8080':'http://127.0.0.1:11434');
const keyFile=process.env.KANSHAN_TEST_ZHIHU_CONFIG;
const gap=real&&zhida?Number(process.env.KANSHAN_ZHIDA_TEST_GAP_MS||0):0;
const context=Number(process.env.KANSHAN_CHAT_CONTEXT||4096);
const replyBudget=384;
const memoryQuestion='请告诉我在这个会话里我明确说过的姓名、项目名称、演示日期。如果我没说过，请明确说不知道。';
const report={mode:zhida?(real?'real-zhida':'fixture-zhida'):real?(llama?'real-llama':'real-ollama'):'fixture',model,context,replyBudget,checks:[],http:[],metadata:{}};
let app,page;
let key;
let rateLimited=false;

function add(key,passed,detail){
 report.checks.push({key,passed,detail});
 console.log(passed?'PASS':'FAIL',key,JSON.stringify(detail));
}

async function check(key,run){
 if(rateLimited){report.checks.push({key,passed:false,skipped:true,detail:'真实服务返回 HTTP 429，停止余下请求。'});console.log('SKIP',key);return;}
 try{add(key,true,await run());}
 catch(error){add(key,false,error.message);if(real&&zhida&&error.message.includes('429'))rateLimited=true;}
}

async function configure(tokens){
 await writeFile(join(profile,'model.env'),
  `CHAT_PROVIDER=${provider}\nCHAT_BASE_URL=${base}\nCHAT_MODEL=${model}\n${zhida?`ZHIDA_MODEL=${model}\n`:''}CHAT_CONTEXT_TOKENS=${tokens}\nCHAT_REPLY_TOKENS=${replyBudget}\nCHAT_TIMEOUT_MS=180000\n`);
}

async function launch(){
 app=await electron.launch({executablePath,env:{...process.env,KANSHAN_DATA_DIR:profile,...(zhida?{ZHIHU_ACCESS_SECRET:key}:{})},timeout:25000});
 // This wrapper captures test-only context metadata; the real branch uses the original transport and returns its response.
 await app.evaluate((_,{real,zhida,gap,lastSent})=>{
  const nativeFetch=globalThis.fetch;
  globalThis.chatTrace=[];
  globalThis.chatFixture={fail:false,hold:false};
  let last=lastSent;
  globalThis.fetch=async (url,options)=>{
   if(!String(url).endsWith('/api/chat')&&!String(url).endsWith('/v1/chat/completions'))return nativeFetch(url,options);
   const payload=JSON.parse(options.body);
   const summary=payload.messages[0].content.startsWith('从会话材料提取');
   if(zhida){
    if(String(url)!=='https://developer.zhihu.com/v1/chat/completions'||
      Object.keys(payload).sort().join(',')!=='messages,model,stream'||payload.stream!==false||
      !/^Bearer \S+$/.test(options.headers.Authorization)||options.headers['Content-Type']!=='application/json'||
      Math.abs(Number(options.headers['X-Request-Timestamp'])-Date.now()/1000)>2){
     throw Error('直答请求与已确认的协议不符');
    }
   }
   const trace={summary,roles:payload.messages.map(message=>message.role),model:payload.model,
    current:payload.messages.at(-1).content,history:summary?undefined:payload.messages.slice(1,-1),
    ...(zhida?{target:String(url),keys:Object.keys(payload).sort(),timestamp:Number(options.headers['X-Request-Timestamp'])}:{}),
    numCtx:payload.options?.num_ctx,numPredict:payload.options?.num_predict??payload.max_tokens,think:payload.think??payload.chat_template_kwargs?.enable_thinking};
   globalThis.chatTrace.push(trace);
   const start=Date.now();
   try{
    if(real){
     const wait=last+gap-Date.now();
     if(wait>0)await new Promise((resolve,reject)=>{
      const signal=options.signal;
      if(signal.aborted){reject(signal.reason);return;}
      const abort=()=>{clearTimeout(timer);reject(signal.reason);};
      const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},wait);
      signal.addEventListener('abort',abort,{once:true});
     });
     last=trace.sentAt=Date.now();
     const response=await nativeFetch(url,options);
     trace.status=response.status;
     trace.retryAfter=response.headers.get('retry-after');
     if(!response.ok)return response;
     const data=await response.clone().json();
     trace.tokens=data.prompt_eval_count??data.usage?.prompt_tokens;
     trace.outputTokens=data.eval_count??data.usage?.completion_tokens;
     trace.responseModel=data.model;
     trace.loadMs=data.load_duration===undefined?undefined:data.load_duration/1e6;
     trace.modelMs=data.total_duration===undefined?data.timings?.predicted_ms:data.total_duration/1e6;
     trace.doneReason=data.done_reason??data.choices?.[0]?.finish_reason;
     return response;
    }
    if(globalThis.chatFixture.fail){
     globalThis.chatFixture.fail=false;
     return new Response(null,{status:503});
    }
    if(globalThis.chatFixture.hold){
     globalThis.chatFixture.hold=false;
     // Deliberately ignores AbortSignal to simulate a late response.
     await new Promise(resolve=>setTimeout(resolve,1300));
    }
    const content=summary?'【模拟摘要】仅用于验证摘要链路。':'【模拟回复】仅用于验证聊天链路。';
    if(zhida)return Response.json({choices:[{finish_reason:'stop',message:{content,reasoning_content:'【模拟，应隐藏】'}}]});
    return Response.json({done:true,done_reason:'stop',message:{thinking:'【模拟，应隐藏】',content}});
   }finally{trace.elapsedMs=Date.now()-start;}
  };
 },{real,zhida,gap,lastSent:report.http.findLast(trace=>trace.sentAt)?.sentAt||0});
 page=await app.firstWindow();
 await skipGuide(page);
 page.setDefaultTimeout(20000);
 await page.locator('.desktop-pet').waitFor();
 if(zhida){
  const result=await page.evaluate(()=>window.kanshan.chatStatus());
  assert.equal(result.data?.skillId,'zhida');
 }
}

async function harvest(){
 if(app)report.http.push(...await app.evaluate(()=>globalThis.chatTrace));
}

async function closeApp(){
 if(app){
  await harvest();
  await app.close();
  app=undefined;
 }
}

const button=name=>page.getByRole('button',{name,exact:true});
const dialog=()=>page.locator('.chat-modal');
const input=()=>dialog().getByRole('textbox',{name:'对刘看山说的话'});
const history=()=>dialog().locator('.chat-lines');
const disk=async()=>JSON.parse(await readFile(join(profile,'chat-v1.json'),'utf8'));
const current=async()=>{const db=await disk();return db.sessions.find(session=>session.id===db.activeId);};

async function openChat(){
 if(await page.locator('.desktop-pet').isVisible())await page.locator('.pet-fox .fox-costume-hit').dblclick();
 if(!await dialog().isVisible())await button('和刘看山互动，可双击打开聊天').dblclick();
 await dialog().waitFor();
 await dialog().getByText('聊天服务',{exact:false}).waitFor();
}
async function start(text){
 await input().fill(text);
 await dialog().getByRole('checkbox').check();
 await button('发送').click();
}
async function completed(){
 await button('发送').waitFor({timeout:200000});
 return (await current()).turns.at(-1);
}
async function hideTestWindow(){
 await app.evaluate(({BrowserWindow})=>{BrowserWindow.getAllWindows()[0].hide();});
}
async function send(text,scripted=false){
 if(scripted){
  const result=await page.evaluate(async message=>{
   const bridge=window.kanshan;
   const state=await bridge.chatState();
   const config=await bridge.chatStatus();
   if(!state.ok||!config.ok)throw Error('读取会话或配置失败');
   return bridge.chat({id:crypto.randomUUID(),messageId:crypto.randomUUID(),message,sessionId:state.data.activeId,configId:config.data.configId,consent:true});
  },text);
  assert.ok(result.ok,result.error);
  assert.equal(result.data.state.turns.at(-1).state,'complete',result.data.state.turns.at(-1).error||result.data.state.turns.at(-1).state);
  return result.data.reply.text;
 }
 await start(text);
 const turn=await completed();
 assert.equal(turn.state,'complete',turn.error||turn.state);
 return turn.assistant.content;
}
function expected(text,{name=false,date='8'}={}){
 if(real){
  assert.match(text,/雪松/);
  if(name)assert.match(text,/小林/);
  if(name)assert.doesNotMatch(text,/小林[、，,和与及]\s*刘看山|姓名[^\n。]{0,18}刘看山/);
  const day=date==='10'?'10|十':'8|八';
  assert.match(text,new RegExp(`(?:12|十二)\\s*月\\s*(?:${day})\\s*(?:日|号)|12[-/]${date.padStart(2,'0')}`));
  assert.doesNotMatch(text,/不知道|无法确认|未直接说|没有明确(?:提|说)/);
  if(date==='10')assert.doesNotMatch(text,/(?:12|十二)\s*月\s*(?:8|八)\s*(?:日|号)/);
 }else assert.match(text,/【模拟回复】/);
 return text;
}
async function modelRequest(route,body){
 const response=await fetch(new URL(route,base),body?{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
 }:undefined);
 if(!response.ok)throw Error(`Ollama ${route} HTTP ${response.status}`);
 return response.json();
}

try{
 if(zhida){
  key=real?(process.env.ZHIHU_ACCESS_SECRET|| (keyFile&&dotenv.parse(await readFile(keyFile)).ZHIHU_ACCESS_SECRET))?.trim():'fixture-only';
  assert.ok(key,'真实直答测试需要在本机配置 ZHIHU_ACCESS_SECRET');
  report.metadata.provider='知乎直答';
 }else if(real&&llama){
  const props=await modelRequest('/props');
  report.metadata.serverContext=props.default_generation_settings?.n_ctx;
  report.metadata.model=(await modelRequest('/v1/models')).data[0];
 }else if(real){
  report.metadata.version=(await modelRequest('/api/version')).version;
  const show=await modelRequest('/api/show',{model});
  report.metadata.model=show.details;
 }
 await configure(context);
 await launch();
 await openChat();

 await check('A 即时追问',async()=>{
  const introduction=await send('我叫小林，我的项目叫雪松，演示日期是 12 月 8 日。');
  const answer=await send('我的项目名称和演示日期是什么？');
  assert.match(await history().locator('.user-line').first().innerText(),/^你：/);
  assert.match(await history().locator('.fox-line').last().innerText(),/^刘看山：/);
  const latest=(await app.evaluate(()=>globalThis.chatTrace)).at(-1);
  assert.deepEqual(latest.roles,['system','user','assistant','user']);
  assert.ok(latest.history[0].content.includes('我叫小林，我的项目叫雪松'));
  assert.equal(latest.history[1].content,introduction);
  assert.equal([latest.current,...latest.history.map(item=>item.content)].join('\n').split('我的项目名称和演示日期是什么？').length,2);
  return{introduction,answer:expected(answer)};
 });
 const background=real&&zhida;
 if(background)await hideTestWindow();
 await check('B 隔几轮再问',async()=>{
  const intervening=[];
  for(const question of ['泡茶之前为什么要温杯？请用一句话。','下雨时闻到的泥土气味来自哪里？请用一句话。','为什么窗户朝东早晨会更亮？请用一句话。'])
   intervening.push(await send(question,background));
  return{intervening,answer:expected(await send(memoryQuestion,background),{name:true})};
 });
 await check('C 使用更正',async()=>{
  const acknowledged=await send('演示日期改成 12 月 10 日了。',background);
  return{acknowledged,answer:expected(await send('在本会话中，我明确说过的姓名、项目名称和目前的演示日期是什么？只列现在的值。',background),{name:true,date:'10'})};
 });
 await check('D 原生应用退出重开',async()=>{
  const prior=await current();
  await closeApp();
  if(background&&gap)await new Promise(resolve=>setTimeout(resolve,gap));
  await launch();
  if(!background){
   await openChat();
   await history().getByText('演示日期改成 12 月 10 日了。').waitFor();
  }
  assert.equal((await current()).id,prior.id);
  assert.equal((await current()).turns.length,prior.turns.length);
  const answer=expected(await send('项目叫什么？现在的演示日期是哪天？',background),{date:'10'});
  const latest=(await app.evaluate(()=>globalThis.chatTrace)).at(-1);
  assert.ok(latest.history.some(item=>item.role==='user'&&/(?:12|十二)\s*月\s*(?:10|十)\s*(?:日|号)/.test(item.content)));
  return answer;
 });
 if(background)await hideTestWindow();
 await check('E 缩小应用预算强制摘要',async()=>{
  const original=await current();
  const priorSummary=original.summary?.through;
  await configure(Math.min(zhida&&real?3540:2880,context));
  await page.evaluate(()=>window.kanshan.refreshConfig());
  if(!background){await button('关闭对话').click();await openChat();}
  let answer=await send(memoryQuestion,background);
  for(let i=0;i<7&&(!(await current()).summary||(await current()).summary.through===priorSummary);i++){
   await send(`这是独立拼写练习第 ${i+1} 条。请忽略后面填充文字，只说收到即可。`+'风吹过杉树林，影子轻轻移动。'.repeat(12),background);
   answer=await send(memoryQuestion,background);
  }
  const after=await current();
  assert.ok(after.summary?.through&&after.summary.through!==priorSummary,'摘要未更新');
  assert.deepEqual(after.turns.slice(0,original.turns.length),original.turns);
  answer=expected(answer,{name:true,date:'10'});
  if(real){
   assert.match(after.summary.text,/雪松/);
   assert.match(after.summary.text,/(?:10|十)\s*(?:日|号)/);
   const oldDateLine=after.summary.text.split('\n').find(line=>/(?:12|十二)\s*月\s*(?:8|八)\s*(?:日|号)/.test(line));
   if(oldDateLine)assert.match(oldDateLine,/原日期|旧日期|原定|更正|已改为|不再有效/);
   if(zhida){
    const latest=(await app.evaluate(()=>globalThis.chatTrace)).at(-1);
    assert.equal(latest.history.filter(item=>item.content.includes('本会话较早消息的历史笔记')).length,1);
    assert.ok(latest.history.some(item=>item.role==='assistant'),'摘要后未保留任何近期原文');
   }
  }
  return{answer,summary:after.summary.text,turnsRetained:after.turns.length};
 });
 await check('F 新建会话隔离',async()=>{
  const prior=(await current()).id;
  if(background)await page.evaluate(()=>window.kanshan.changeChat('new'));
  else{
   await button('新建会话').click();
   await history().getByText('今天有点卡住',{exact:false}).waitFor();
  }
  const answer=await send(memoryQuestion,background);
  assert.notEqual((await current()).id,prior);
  assert.equal((await current()).turns.length,1);
  const last=(await app.evaluate(()=>globalThis.chatTrace)).at(-1);
  assert.deepEqual(last.roles,['system','user']);
  if(real){
   assert.match(answer,/不知道|不清楚|没(?:有)?(?:明确)?(?:说|提|告诉|提供|告知)|尚未|未提供|未提及/);
   assert.doesNotMatch(answer,/小林|雪松|你的项目(?:名称|名字)?\s*(?:是|叫|为)\s*[“「]?看山有伴/);
  }
  return{answer,roles:last.roles};
 });

 if(real){
  await check('真实服务发送后中止并原地重试',async()=>{
   await configure(context);
   await page.evaluate(()=>window.kanshan.refreshConfig());
   if(background)await app.evaluate(({BrowserWindow})=>{BrowserWindow.getAllWindows()[0].showInactive();});
   else await button('关闭对话').click();
   await openChat();
   const question='请用约180字解释为什么雨后能闻到泥土香味。';
   await start(question);
   if(zhida){
    const until=Date.now()+gap+10000;
    while(Date.now()<until&&!(await app.evaluate((_,question)=>globalThis.chatTrace.some(trace=>
     !trace.summary&&trace.current.includes(question)&&trace.sentAt),question)))await page.waitForTimeout(50);
    assert.ok(await app.evaluate((_,question)=>globalThis.chatTrace.some(trace=>
     !trace.summary&&trace.current.includes(question)&&trace.sentAt),question),'真实取消用例未发出 HTTP 请求');
   }
   await button('停止回复').click();
   const stopped=await completed();
   assert.equal(stopped.state,'cancelled');
   await dialog().getByRole('checkbox').check();
   await button('重试上一条').click();
   const retried=await completed();
   assert.equal(retried.state,'complete',retried.error||retried.state);
   assert.equal(retried.user.id,stopped.user.id);
   assert.equal((await current()).turns.filter(turn=>turn.user.id===retried.user.id).length,1);
   return{sameMessageId:true};
  });
 }else{
  await check('模拟 HTTP 失败并原地重试',async()=>{
   await app.evaluate(()=>{globalThis.chatFixture.fail=true;});
   await start('【测试】模拟服务失败。');
   const failed=await completed();
   assert.equal(failed.state,'failed');
   await dialog().getByRole('checkbox').check();
   await button('重试上一条').click();
   const retried=await completed();
   assert.equal(retried.user.id,failed.user.id);
   assert.equal(retried.state,'complete');
   assert.equal((await current()).turns.filter(turn=>turn.user.id===retried.user.id).length,1);
   return{failure:failed.error,sameMessageId:true};
  });
  await check('模拟迟到回复，切换会话与原地重试',async()=>{
   const prior=(await current()).id;
   await app.evaluate(()=>{globalThis.chatFixture.hold=true;});
   await start('【测试】这条需要停止。');
   await button('停止回复').click();
   const stopped=await completed();
   assert.equal(stopped.state,'cancelled');
   await dialog().getByRole('checkbox').check();
   await button('重试上一条').click();
   assert.equal((await completed()).user.id,stopped.user.id);
   await app.evaluate(()=>{globalThis.chatFixture.hold=true;});
   await start('【测试】切换会话之后这条返回太晚。');
   await button('新建会话').click();
   await history().getByText('今天有点卡住',{exact:false}).waitFor();
   await page.waitForTimeout(1450);
   assert.equal((await current()).turns.length,0);
   await dialog().getByRole('combobox').selectOption(prior);
   await history().getByText('已停止',{exact:true}).waitFor();
   assert.equal((await current()).turns.at(-1).state,'cancelled');
   return{lateReplyDiscarded:true};
  });
  await check('模拟退出时仍有未完成请求，重启标记取消',async()=>{
   const message='【测试】请求仍在等待时退出应用。';
   await app.evaluate(()=>{globalThis.chatFixture.hold=true;});
   await start(message);
   await page.waitForFunction(message=>Array.from(document.querySelectorAll('.chat-turn,.user-line')).some(row=>row.textContent.includes(message)),message);
   let turnBefore;
   for(let attempt=0;attempt<30;attempt++){
    turnBefore=(await current()).turns.at(-1);
    if(turnBefore.user.content===message&&turnBefore.state==='pending')break;
    await page.waitForTimeout(30);
   }
   assert.equal(turnBefore.user.content,message);
   assert.equal(turnBefore.state,'pending');
   assert.match(await history().locator('.user-line').last().innerText(),/^你：/);
   await closeApp();
   await launch();
   await openChat();
   const turn=(await current()).turns.at(-1);
   assert.equal(turn.user.content,message);
   assert.equal(turn.state,'cancelled');
   assert.equal(turn.assistant,undefined);
   return{interruptedTurnRestored:true};
  });
 }
 if(real&&!llama&&!zhida)report.metadata.running=(await modelRequest('/api/ps')).models;
 await mkdir(join(root,'artifacts'),{recursive:true});
 if(!background||await dialog().isVisible())await dialog().screenshot({path:join(root,'artifacts',`chat-${report.mode}.png`)});
}catch(error){
 add('运行环境与桌宠入口',false,error.message);
}finally{
 await closeApp().catch(error=>add('退出',false,error.message));
 await mkdir(join(root,'artifacts'),{recursive:true});
 await writeFile(join(root,'artifacts',`chat-${report.mode}.json`),JSON.stringify(report,null,2)+'\n');
 await rm(profile,{recursive:true,force:true});
}
if(report.checks.some(entry=>!entry.passed))process.exitCode=1;
