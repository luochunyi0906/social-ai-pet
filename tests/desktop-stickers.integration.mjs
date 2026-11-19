import { skipGuide } from './skip-guide.mjs';
import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';

const root=fileURLToPath(new URL('../',import.meta.url));
const profile=await mkdtemp(join(tmpdir(),'kanshan-stickers-native-'));
const output=process.env.KANSHAN_STICKER_ARTIFACTS||tmpdir();
const live=process.env.KANSHAN_LIVE_STICKERS==='1';
let app,key;
try{
 if(live){
  for(const path of ['看山有伴-林间预览','看山有伴-v0.3-preview']){
   try{key=dotenv.parse(await readFile(join(homedir(),'Library/Application Support',path,'model.env'))).ZHIHU_ACCESS_SECRET?.trim();}
   catch{}
   if(key)break;
  }
  if(!key)throw Error('本机未找到知乎测试凭据。');
 }
 await writeFile(join(profile,'model.env'),`CHAT_PROVIDER=zhida\nZHIDA_MODEL=zhida-fast-1p5\nCHAT_TIMEOUT_MS=45000\nZHIHU_ACCESS_SECRET=${key||'fixture-key'}\n`,{mode:0o600});
 await mkdir(output,{recursive:true});
 const launch=async()=>electron.launch({executablePath:resolve(root,process.env.KANSHAN_PACKAGE_DIR||'release','看山有伴.app/Contents/MacOS/Kanshan'),
  env:{...process.env,KANSHAN_DATA_DIR:profile},timeout:20000});
 app=await launch();
 await app.evaluate((_,useReal)=>{
  const fetch=globalThis.fetch;
  globalThis.stickerTransport={calls:0,sse:0,mode:'sticker'};
  globalThis.fetch=async (url,options)=>{
   if(!String(url).includes('/v1/chat/completions'))return fetch(url,options);
   const trace=globalThis.stickerTransport;
   trace.calls++;
   if(useReal){
    const result=await fetch(url,options);
    trace.status=result.status;
    if(result.headers.get('content-type')?.includes('text/event-stream'))trace.sse++;
    return result;
   }
   if(trace.mode==='http')return new Response(null,{status:503});
   const encoder=new TextEncoder();
   let stopped=false;
   const quote=trace.mode==='plain'?'这是普通文字。':trace.mode==='bad'?'测试非法 ID。':'辛苦啦，终于可以松口气了。';
   return new Response(new ReadableStream({
    async start(controller){
     const pushes=trace.mode==='plain'?[quote]:[quote+'\n','[[LKS','_STICKER:emo_',trace.mode==='bad'?'bad]]':'happy]]'];
     for(const content of pushes){
      if(stopped)return;
      controller.enqueue(encoder.encode('data: '+JSON.stringify({choices:[{delta:{content}}]})+'\n\n'));
      await new Promise(resolve=>setTimeout(resolve,250));
     }
     if(trace.mode==='stop')await new Promise(resolve=>setTimeout(resolve,4000));
     if(stopped)return;
     controller.enqueue(encoder.encode('data: [DONE]\n\n'));
     controller.close();
    },
    cancel(){stopped=true;}
   }),{headers:{'Content-Type':'text/event-stream'}});
  };
 },live);
 let page;
 const open=async()=>{
  page=await app.firstWindow();
  await skipGuide(page);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator('.pet-fox .fox-nose').dblclick();
  await page.getByRole('button',{name:'和刘看山互动，可双击打开聊天',exact:true}).dblclick();
  await page.getByRole('heading',{name:'说一点你正想着的事'}).waitFor();
 };
 const btn=name=>page.getByRole('button',{name,exact:true});
 const draft=()=>page.getByRole('textbox',{name:'对刘看山说的话'});
 const consent=()=>page.locator('.chat-modal .consent input');
 const state=()=>page.evaluate(async()=> (await window.kanshan.chatState()).data);
 const stickers=()=>page.locator('.fox-message [data-sticker-id]');
 const mode=next=>app.evaluate((_,mode)=>{globalThis.stickerTransport.mode=mode;},next);
 const send=async text=>{
  await draft().fill(text);
  assert.equal(await btn('发送').isDisabled(),true);
  await consent().check();
  await btn('发送').click();
 };
 const settled=()=>btn('发送').waitFor({timeout:52000});
 await open();
 await send('今天终于把小组作业交上去了，真想击个掌庆祝一下！');
 if(!live){
  await btn('想一想…').waitFor();
  assert.equal(await draft().inputValue(),'');
  assert.equal(await page.locator('.chat-lines .user-line').count(),1);
  const progress=page.locator('.chat-progress');
  await progress.waitFor();
  const replyId=await progress.getAttribute('data-message-id');
  await page.waitForTimeout(500);
  assert.doesNotMatch(await page.locator('.chat-lines').innerText(),/LKS_STICKER|\[\[/);
  await settled();
  assert.equal(await page.locator('.fox-message').last().getAttribute('data-message-id'),replyId);
 }else await settled();
 let latest=(await state()).turns.at(-1);
 if(latest.state!=='complete')throw Error('模型验收未成功：'+latest.error);
 if(live)console.log('知乎真实响应',JSON.stringify({...(await app.evaluate(()=>globalThis.stickerTransport)),stickerId:latest.assistant.stickerId??null}));
 await stickers().last().waitFor({timeout:5000});
 assert.match(await stickers().last().getAttribute('data-sticker-id'),/^(emo_(happy|laugh|curious|thinking|expect)|act_idle|scarf_[a-z]+)$/);
 const confirmed=latest.assistant.id;
 const image=stickers().last().locator('img');
 await image.evaluate(img=>img.decode());
 if(!live){
  await mode('plain');
  await send('请简单解释一下什么是光合作用。');await settled();
  assert.equal((await state()).turns.at(-1).assistant.stickerId,undefined);
  await mode('bad');
  await send('无效表情标记测试');await settled();
  assert.equal((await state()).turns.at(-1).assistant.stickerId,undefined);
  await mode('stop');
  await send('取消回复测试');
  await page.locator('.chat-progress').waitFor();
  assert.equal(await draft().inputValue(),'');
  await btn('停止回复').click();await settled();
  latest=(await state()).turns.at(-1);
  const stopped=latest.user.id;
  assert.equal(latest.state,'cancelled');
  assert.equal(latest.assistant,undefined);
  assert.equal(await draft().inputValue(),'');
  const unfinished='我还在写的下一条消息';
  await draft().fill(unfinished);
  await mode('http');
  await consent().check();await btn('重试上一条').click();await settled();
  latest=(await state()).turns.at(-1);
  assert.equal(latest.state,'failed');
  assert.equal(latest.user.id,stopped);
  assert.equal(await draft().inputValue(),unfinished);
  await mode('sticker');
  await consent().check();await btn('重试上一条').click();await settled();
  assert.equal((await state()).turns.filter(turn=>turn.user.id===stopped).length,1);
  assert.equal((await state()).turns.at(-1).assistant.stickerId,'emo_happy');
  assert.equal(await draft().inputValue(),unfinished);
  const turnsBeforeRejection=(await state()).turns.length;
  await app.evaluate(()=>{process.env.CHAT_TIMEOUT_MS='46000';});
  const rejected='  这段草稿还没有入会话  ';
  await send(rejected);
  await page.getByRole('alert').filter({hasText:'聊天配置已变化'}).waitFor();
  assert.equal(await draft().inputValue(),rejected);
  assert.equal((await state()).turns.length,turnsBeforeRejection);
  await app.evaluate(()=>{process.env.CHAT_TIMEOUT_MS='45000';});
  console.log('通过：点发送后立即清空；取消、失败和重试保留正确的消息；未记录时恢复原草稿。');
  // Verify the renderer exposes the user's automatic-sticker setting and the stored preference is enforced.
  await page.getByText('连接与表情设置',{exact:true}).click();
  const toggle=page.getByRole('checkbox',{name:'允许刘看山随回复发送表情'});
  await toggle.uncheck();
  await page.waitForFunction(async()=> (await window.kanshan.stickerSettings()).data===false);
  await send('关闭时应只有文字。');await settled();
  assert.equal((await state()).turns.at(-1).assistant.stickerId,undefined);
  await page.getByText('连接与表情设置',{exact:true}).click();
 }
 await btn('刘看山的表情').click();
 const picker=page.getByRole('region',{name:'刘看山的表情'});
 await picker.waitFor();
 assert.equal(await picker.locator('.chat-sticker-grid button').count(),14);
 // Both controls must remain within the view and outside the picker at both window sizes.
 for(const dimensions of [[900,740],[600,560]]){
  await app.evaluate(({BrowserWindow},[width,height])=>BrowserWindow.fromId(1).setSize(width,height),dimensions);
  await page.waitForFunction(([width,height])=>innerWidth===width&&innerHeight===height,dimensions);
  const [area,input,button]=await Promise.all([picker.boundingBox(),draft().boundingBox(),btn('发送').boundingBox()]);
  assert.ok(area.y+area.height<=input.y+1,JSON.stringify({dimensions,area,input}));
  assert.ok(button.y+button.height<=dimensions[1],JSON.stringify({dimensions,button}));
 }
 await app.evaluate(({BrowserWindow})=>BrowserWindow.fromId(1).setSize(900,740));
 await page.waitForFunction(()=>innerWidth===900&&innerHeight===740);
 if(!live)await page.locator(`[data-message-id="${confirmed}"]`).scrollIntoViewIfNeeded();
 await page.screenshot({path:join(output,live?'kanshan-stickers-zhida-live.png':'kanshan-stickers-fixture.png'),scale:'css'});
 await picker.getByRole('button',{name:'期待',exact:true}).click();
 await picker.getByRole('button',{name:'发送表情',exact:true}).click();
 await page.locator('.user-message [data-sticker-id="emo_expect"]').waitFor();
 assert.equal((await state()).turns.at(-1).assistant,undefined);
 await app.close();app=await launch();
 await open();
 const reopened=await state();
 assert.ok(reopened.turns.some(turn=>turn.assistant?.id===confirmed&&turn.assistant.stickerId));
 assert.equal(reopened.turns.at(-1).user.stickerId,'emo_expect');
 assert.equal(await page.locator('.user-message [data-sticker-id="emo_expect"]').count(),1);
 if(!live){
  const desktopMenu=label=>app.evaluate(({Menu},text)=>{
   Menu.getApplicationMenu().items[0].submenu.items.find(item=>item.label==='操作菜单')
    .submenu.items.find(item=>item.label===text).click();
  },label);
  await desktopMenu('回家');
  await btn('休息／睡眠').click();
  await page.locator('.home-bed-sleeper [data-rendering="legacy-blanket"]').waitFor();
  await desktopMenu('和刘看山聊聊');
  const sleep=page.locator('.chat-modal [data-rendering="legacy-blanket"]');
  await sleep.waitFor();
  const replay=btn('重播期待表情');
  await page.waitForFunction(()=>!document.querySelector('.user-message .sticker-replay')?.disabled);
  await replay.click();
  await sleep.waitFor();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>document.querySelector('.user-message .sticker-replay')?.disabled);
  await sleep.waitFor();
 }
 console.log('通过：'+(live?'真实模型配表情、':'流式分块隐藏、普通和非法标记、取消、失败重试、关闭自动表情、睡眠状态回看、减少动态、')+'两种窗口尺寸、手动表情归属、重启恢复。');
} finally {
 await app?.close();await rm(profile,{recursive:true,force:true});
}
