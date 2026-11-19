import { skipGuide } from './skip-guide.mjs';
import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import dotenv from 'dotenv';

const root=fileURLToPath(new URL('../',import.meta.url));
const profile=await mkdtemp(join(tmpdir(),'kanshan-scarf-native-'));
const output=process.env.KANSHAN_SCARF_ARTIFACTS||tmpdir();
const live=process.env.KANSHAN_LIVE_SCARF==='1';
const cases=[
 {message:'你好',reply:'你好呀，今天想聊点什么？',id:'scarf_hello'},
 {message:'我准备开始学习了',reply:'先选一小节开个头，我给你加油。',id:'scarf_cheer'},
 {message:'我打算做那个东西，但不确定该从哪儿开始。你能先问我一个具体的问题，把我的意思弄清楚吗？',reply:'你说的那个东西，最终要给谁用呢？',id:'scarf_curious'},
 {message:'水的化学式是什么？只给我化学式。',reply:'H₂O。'}
];
let app,page,key;
try{
 if(live){
  for(const name of ['看山有伴-林间预览','看山有伴-v0.3-preview']){
   try{key=dotenv.parse(await readFile(join(homedir(),'Library/Application Support',name,'model.env'))).ZHIHU_ACCESS_SECRET?.trim();}catch{}
   if(key)break;
  }
  if(!key)throw Error('本机未找到可用的知乎直答凭据。');
 }
 await mkdir(output,{recursive:true});
 await writeFile(join(profile,'model.env'),`CHAT_PROVIDER=zhida\nZHIDA_MODEL=zhida-fast-1p5\nCHAT_TIMEOUT_MS=35000\nZHIHU_ACCESS_SECRET=${key||'fixture-key'}\n`,{mode:0o600});
 if(!live){
  const id=randomUUID(),createdAt=new Date().toISOString();
  await writeFile(join(profile,'chat-v1.json'),JSON.stringify({version:1,activeId:id,sessions:[{id,createdAt,summary:null,turns:[
   {state:'complete',user:{id:randomUUID(),role:'user',content:'下次问我花园的观察记录',createdAt},
    assistant:{id:randomUUID(),role:'assistant',content:'好呀。',createdAt}}
  ]}]}),{mode:0o600});
 }
 const launch=async()=>{
  app=await electron.launch({executablePath:resolve(root,process.env.KANSHAN_PACKAGE_DIR||'release','看山有伴.app/Contents/MacOS/Kanshan'),
   env:{...process.env,KANSHAN_DATA_DIR:profile},timeout:22000});
  page=await app.firstWindow();
  await skipGuide(page);
  page.setDefaultTimeout(12000);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator('.desktop-pet').waitFor();
 };
 const button=name=>page.getByRole('button',{name,exact:true});
 const draft=()=>page.getByRole('textbox',{name:'对刘看山说的话'});
 const state=()=>page.evaluate(async()=> (await window.kanshan.chatState()).data);
 const menu=label=>app.evaluate(({Menu},text)=>Menu.getApplicationMenu().items[0].submenu.items.find(item=>item.label==='操作菜单')
  .submenu.items.find(item=>item.label===text).click(),label);
 const screenshot=name=>page.screenshot({path:join(output,name+'.png'),scale:'css'});
 const resize=async(width,height)=>{
  await app.evaluate(({BrowserWindow},size)=>BrowserWindow.fromId(1).setSize(...size),[width,height]);
  await page.waitForFunction(([w,h])=>innerWidth===w&&innerHeight===h,[width,height]);
 };
 const send=async text=>{
  await draft().fill(text);
  await page.locator('.chat-modal .consent input').check();
  await button('发送').click();
 };
 const openChat=async()=>{
  await menu('和刘看山聊聊');
  await page.getByRole('heading',{name:'说一点你正想着的事'}).waitFor();
 };
 await launch();
 await app.evaluate((_,real)=>{
  const original=globalThis.fetch;
  globalThis.scarfFixture={calls:[],next:{}};
  globalThis.fetch=async (url,request)=>{
   if(!String(url).includes('/v1/chat/completions'))return original(url,request);
   const trace=globalThis.scarfFixture;
   const body=JSON.parse(request.body);
   trace.calls.push({keys:Object.keys(body).sort(),askedStream:body.stream});
   if(real){
    const response=await original(url,request);
    Object.assign(trace.calls.at(-1),{status:response.status,sse:response.headers.get('content-type')?.includes('text/event-stream')});
    return response;
   }
   const {reply,id,mode}=trace.next;
   if(mode==='fail')return new Response(null,{status:503});
   let cancelled=false;
   const stream=new ReadableStream({
    async start(controller){
     const encoder=new TextEncoder();
     const push=delta=>controller.enqueue(encoder.encode('data: '+JSON.stringify({choices:[{delta}]})+'\n\n'));
     push({reasoning_content:'这里属于思考，请勿显示。'});
     for(const content of [reply,...(id?['\n[[LKS','_STICKER:scarf_',id.slice(6)+']]']:[])]){
      if(cancelled)return;
      push({content});
      await new Promise(resolve=>setTimeout(resolve,110));
     }
     if(mode==='hold')await new Promise(resolve=>setTimeout(resolve,900));
     if(cancelled)return;
     controller.enqueue(encoder.encode('data: [DONE]\n\n'));
     controller.close();
    },
    cancel(){cancelled=true}
   });
   return new Response(stream,{headers:{'Content-Type':'text/event-stream'}});
  };
 },live);
 const setFixture=value=>app.evaluate((_,entry)=>{globalThis.scarfFixture.next=entry;},value);
 if(live)await openChat();
 else{
  await page.getByRole('button',{name:'聊聊',exact:true}).click();
  await page.locator('.companion-opening [data-sticker-id="scarf_curious"]').waitFor();
  assert.equal((await state()).opening.stickerPack,'camp-scarf-v1');
  await button('新建会话').click();
 }
 await resize(900,740);
 const seen=[];
 let savedMessage;
 for(const entry of cases){
  if(live&&seen.length){await page.waitForTimeout(8000);await button('新建会话').click();}
  else if(!live)await setFixture(entry);
  await send(entry.message);
  if(!live)await page.locator('.chat-progress').waitFor();
  assert.doesNotMatch(await page.locator('.chat-lines').innerText(),/LKS_STICKER|这里属于思考/);
  await button('发送').waitFor({timeout:45000});
  const turn=(await state()).turns.at(-1);
  seen.push({message:entry.message,status:turn?.state,expected:entry.id??null,selected:turn?.assistant?.stickerId??null,
   ...(live?{reply:turn?.assistant?.content??turn?.error}:{} )});
  if(!live)assert.equal(turn.assistant?.stickerId,entry.id);
  if(turn?.assistant?.stickerId?.startsWith('scarf_')){
   const sticker=page.locator(`[data-message-id="${turn.assistant.id}"] [data-sticker-id]`);
   await sticker.waitFor();
   if(!savedMessage){
    savedMessage={...turn.assistant,sessionId:(await state()).activeId};
    assert.equal(savedMessage.stickerPack,'camp-scarf-v1');
    assert.ok(savedMessage.stickerAlt);
    await sticker.locator('.sticker-frame').waitFor();
    await sticker.locator('img').waitFor();
    await sticker.locator('img').evaluate(img=>img.decode());
    await page.waitForTimeout(230);
    assert.equal(await sticker.getAttribute('data-sticker-frame'),null);
    await sticker.getByRole('button').click();
    await sticker.locator('.sticker-frame').waitFor();
    await sticker.locator('img').waitFor();
    await screenshot(live?'围巾表情-真实直答':'围巾表情-本地验证');
   }
  }
 }
 const calls=await app.evaluate(()=>globalThis.scarfFixture.calls);
 assert.equal(calls.length,4,'每个回答请求只调用一次直答');
 for(const call of calls)assert.deepEqual(call.keys,['messages','model','stream']);
 if(live)console.log('真实接入',JSON.stringify({cases:seen,transport:calls}));
 if(!live){
  await resize(600,560);
  await button('新建会话').click();
  await setFixture({...cases[1],mode:'hold'});
  await send('取消这次回复');
  await page.locator('.chat-progress').waitFor();
  await button('停止回复').click();
  await button('发送').waitFor();
  const stopped=(await state()).turns.at(-1);
  assert.equal(stopped.state,'cancelled');
  await setFixture({...cases[1],mode:'fail'});
  await page.locator('.chat-modal .consent input').check();
  await button('重试上一条').click();
  await button('发送').waitFor();
  assert.equal((await state()).turns.at(-1).state,'failed');
  await setFixture(cases[1]);
  await page.locator('.chat-modal .consent input').check();
  await button('重试上一条').click();
  await button('发送').waitFor();
  const history=(await state()).turns;
  assert.equal(history.filter(t=>t.user.id===stopped.user.id).length,1);
  assert.equal(history.at(-1).assistant.stickerId,'scarf_cheer');
  const sendBox=await button('发送').boundingBox();
  assert.ok(sendBox.y+sendBox.height<=560);
  await setFixture({...cases[1],mode:'hold'});
  await send('切换会话，放弃未完成的回复');
  await page.locator('.chat-progress').waitFor();
  await button('新建会话').click();
  await page.waitForTimeout(1150);
  assert.equal((await state()).turns.length,0);
 }
 if(savedMessage){
  await app.close();
  await launch();
  await openChat();
  await page.getByRole('combobox',{name:'切换会话'}).selectOption(savedMessage.sessionId);
  const restored=page.locator(`[data-message-id="${savedMessage.id}"] [data-sticker-id="${savedMessage.stickerId}"]`);
  await restored.scrollIntoViewIfNeeded();
  await restored.locator('img').waitFor();
  assert.equal(await restored.getAttribute('data-sticker-frame'),null);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(id=>document.querySelector(`[data-message-id="${id}"] .sticker-replay`)?.disabled,savedMessage.id);
 }
 if(!live){
  await menu('回家');
  await resize(900,740);
  await button('换装').click();
  await page.getByRole('heading',{name:'衣柜'}).waitFor();
  const outfit=()=>page.evaluate(async()=> (await window.kanshan.outfitSettings()).data.outfitId);
  const original=await outfit();
  const closet=page.locator('.home-closet');
  const costume=(name)=>closet.locator('.home-outfit-card').filter({hasText:name});
  const angle=(name)=>closet.getByRole('button',{name,exact:true});
  assert.deepEqual(await closet.locator('.home-outfit-card strong').allTextContents(),['森林引路者']);
  await costume('森林引路者').click();
  await screenshot('wardrobe-unified-gallery');
  const rotation=closet.getByRole('slider');
  const frame=rotation.locator('.wardrobe-turntable-figure[data-ready="true"]');
  assert.equal(await outfit(),original);
  await costume('森林引路者').click();
  const directions=[['正面','0'],['侧面','90'],['背面','180'],['另一侧','270']];
  for(const [name,degrees] of directions){
   await frame.waitFor();
   await angle(name).click();
   assert.equal(await rotation.getAttribute('aria-valuenow'),degrees);
  }
  await rotation.press('Home');
  const views=[];
  for(let index=0;index<8;index++){
   views.push(await frame.getAttribute('data-view'));
   await rotation.press('ArrowRight');
  }
  assert.deepEqual(views,Array.from({length:8},(_,index)=>String(index)));
  const box=await rotation.boundingBox();
  const y=Math.round(box.y+box.height*.5);
  const x=Math.round(box.x+box.width*.2);
  await page.mouse.move(x,y);
  await page.mouse.down();
  await page.mouse.move(Math.round(x+box.width*.225),y,{steps:5});
  await page.mouse.up();
  assert.equal(await rotation.getAttribute('aria-valuenow'),'90');
  await resize(600,560);
  await screenshot('wardrobe-turntable-small');
  for(const name of ['返回房间','关闭预览']){
   const buttonBox=await closet.getByRole('button',{name,exact:true}).boundingBox();
   assert.ok(buttonBox&&buttonBox.y>=0&&buttonBox.y+buttonBox.height<=560);
  }
  await button('查看实际效果').click();
  await closet.locator('.home-preview [data-outfit-id="forest-guide"]').waitFor();
  await button('穿上').click();
  await page.waitForFunction(async()=> (await window.kanshan.outfitSettings()).data.outfitId==='forest-guide');
  await button('返回房间').click();
  await button('休息／睡眠').click();
  await page.locator('.home-bed-sleeper [data-rendering="legacy-blanket"]').waitFor();
  await button('收回桌面').click();
  await page.locator('.desktop-pet [data-rendering="legacy-blanket"]').waitFor();
  await button('叫醒刘看山').click();
  await page.locator('.desktop-pet [data-outfit-id="forest-guide"]').waitFor();
  console.log('本地通过：森林引路者与可恢复的默认外观、八个方向的原画预览，以及拖动、键盘导航、小窗、穿戴和睡眠回归。');
 }
 if(live&&seen.some(row=>row.status!=='complete'||row.expected!==row.selected))process.exitCode=2;
}finally{
 await app?.close();
 await rm(profile,{recursive:true,force:true});
}
