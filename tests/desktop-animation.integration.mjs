import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';

const root=fileURLToPath(new URL('../',import.meta.url));
const profile=await mkdtemp(join(tmpdir(),'kanshan-animation-'));
const out=process.env.KANSHAN_ANIMATION_ARTIFACTS||join(root,'artifacts/animation');
const real=Boolean(process.env.KANSHAN_ANIMATION_ZHIHU_CONFIG);
const checks=[];
const mark=name=>{checks.push(name);console.log('PASS',name);};
let app;
try{
 await mkdir(out,{recursive:true});
 const key=real?dotenv.parse(await readFile(process.env.KANSHAN_ANIMATION_ZHIHU_CONFIG)).ZHIHU_ACCESS_SECRET:'';
 if(real&&!key)throw Error('未找到知乎验收配置。');
 await writeFile(join(profile,'model.env'), real
  ? `CHAT_PROVIDER=zhida\nSEARCH_PROVIDER=zhihu\nZHIHU_ACCESS_SECRET=${key}\nCHAT_TIMEOUT_MS=35000\n`
  : 'CHAT_PROVIDER=ollama\nCHAT_TIMEOUT_MS=1600\nSEARCH_PROVIDER=bing-rss\n',{mode:0o600});
 app=await electron.launch({
  executablePath:resolve(root,process.env.KANSHAN_PACKAGE_DIR||'release','看山有伴.app/Contents/MacOS/Kanshan'),
  env:{...process.env,KANSHAN_DATA_DIR:profile},timeout:16000,
 });
 const page=await app.firstWindow();
 page.setDefaultTimeout(real?39000:6500);
 await page.emulateMedia({reducedMotion:'no-preference'});
 const button=(name,scope=page)=>scope.getByRole('button',{name,exact:true});
 const waitSprite=(clip,stage,where='body')=>page.locator(where).locator(
  `[data-animation="${clip}"]${stage?`[data-animation-stage="${stage}"]`:''}:visible`).first().waitFor();
 const capture=(name)=>page.screenshot({path:join(out,name+'.png'),omitBackground:true});
 const menu=async name=>app.evaluate(({Menu},label)=>{
  const item=Menu.getApplicationMenu().items[0].submenu.items.find(e=>e.label==='操作菜单')
    ?.submenu.items.find(e=>e.label===label);
  if(!item)throw Error('缺少原生菜单：'+label);
  item.click();
 },name);
 const behavior=(chat,search)=>app.evaluate((_,modes)=>{
  globalThis.animationFixture=modes;
 },{chat,search});
 await app.evaluate((_,real)=>{
  const native=globalThis.fetch;
  globalThis.animationFixture={chat:'success',search:'success'};
  globalThis.fetch=async (url,options={})=>{
   const address=String(url);
   const chat=/\/api\/chat$|\/v1\/chat\/completions$/.test(address);
   const search=/bing\.com\/search|developer\.zhihu\.com\/api\/v1\/content\/zhihu_search/.test(address);
   if(real){
    if(chat||search)await new Promise(resolve=>setTimeout(resolve,650));
    return native(url,options);
   }
   if(!chat&&!search)return native(url,options);
   const mode=globalThis.animationFixture[chat?'chat':'search'];
   if(mode==='timeout')await new Promise((_,reject)=>{
    const signal=options.signal;
    if(signal.aborted)reject(signal.reason);
    else signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
   });
   await new Promise(resolve=>setTimeout(resolve,mode==='late'?1250:500));
   if(mode==='failure')return new Response('',{status:503});
   if(chat)return Response.json({done:true,done_reason:'stop',message:{content:mode==='late'?'验收迟到正文':'验收夹具正文',thinking:'内部推理夹具'}});
   return new Response('<rss><channel><item><title>雪地观察（验收夹具）</title><link>https://www.zhihu.com/question/123456</link></item></channel></rss>');
  };
 },real);
 const send=async (text,check=true)=>{
  const textarea=page.getByRole('textbox',{name:'对刘看山说的话'});
  await textarea.fill(text);
  await page.locator('.chat-modal .consent input').check();
  await button('发送').click();
  if(check)await waitSprite('emo_thinking','loop','.chat-modal');
 };
 const openChat=()=>button('和刘看山聊聊').click();
 const openSearch=async()=>{
  await page.locator('.camp-cave').click();
  await waitSprite('emo_curious','enter');
  await button('主动检索知乎').click();
  await page.getByRole('textbox',{name:'本次关键词'}).fill(real?'香港城市大学':'雪地观察');
  await page.locator('.search-modal .consent input').check();
 };
 async function startSearch(label='查找真实知乎内容'){
  await button(label,page.locator('.search-modal')).click();
  await waitSprite('emo_thinking','loop','.search-modal');
 }

 await waitSprite('act_idle','loop','.desktop-pet');
 if(!real){
  const seen=await page.locator('.desktop-pet .pet-fox').evaluate(async fox=>{
   const frames=new Set();
   const sample=()=>frames.add(fox.querySelector('[data-animation-frame]')?.getAttribute('data-animation-frame'));
   const observer=new MutationObserver(sample);
   sample();
   observer.observe(fox,{subtree:true,childList:true,attributes:true,attributeFilter:['data-animation-frame']});
   await new Promise(resolve=>setTimeout(resolve,2000));
   observer.disconnect();
   return [...frames];
  });
  assert.deepEqual(seen,['1']);
  mark('桌面营地的角色待机固定显示第一帧');
  await capture('01-desktop-idle');
 }
 await page.locator('.pet-fox .fox-animation-hit').click();
 await page.locator('.camp-shell').waitFor();
 if(!real){
  await page.waitForFunction(()=>Number(document.querySelector('.camp-fox [data-animation="act_idle"]')?.getAttribute('data-animation-frame'))>1);
  mark('展开营地后待机动作仍按序播放');
 }
 await openChat();
 await send('请用一句话问候。');
 const response=real?page.locator('.chat-modal .fox-line').last():page.getByText('验收夹具正文',{exact:false});
 await response.waitFor();
 await waitSprite('act_idle','loop','.chat-modal');
 assert.equal(await page.getByText('内部推理夹具',{exact:true}).count(),0);
 mark(real?'真实知乎直答正文进入界面后结束思考':'聊天夹具：首次可见正文出现后结束思考');
 if(real){
  await button('关闭对话').click();
  await openSearch();
  await startSearch();
  await page.waitForFunction(()=>!document.querySelector('.search-modal [data-animation="emo_thinking"]'));
  const got=await page.locator('.post-card h3').count();
  if(!got)throw Error('真实检索未得到可展示结果：'+await page.locator('.search-modal .search-notice,.search-modal [role="alert"]').allTextContents());
  mark('真实知乎检索结果结束等待');
 }else{
  await behavior('late','late');
  await send('取消后不得出现迟到正文');
  await button('停止回复').click();
  await waitSprite('act_idle','loop','.chat-modal');
  await page.waitForTimeout(1300);
  assert.equal(await page.getByText('验收迟到正文',{exact:false}).count(),0);
  await behavior('failure','late');
  await send('测试请求失败');
  await page.getByText(/HTTP 503/).waitFor();
  await waitSprite('act_idle','loop','.chat-modal');
  await behavior('timeout','late');
  await send('测试超时');
  await page.getByText(/回复超时/).waitFor();
  await waitSprite('act_idle','loop','.chat-modal');
  mark('聊天夹具：取消即时停止、晚到丢弃、HTTP 失败和超时均恢复');
  await button('关闭对话').click();

  await openSearch();
  await startSearch();
  await button('停止检索').click();
  await waitSprite('act_idle','loop','.search-modal');
  await page.waitForTimeout(1350);
  assert.equal(await page.locator('.post-card').count(),0);
  await button('返回山洞').click();
  await button('主动检索知乎').click();
  await page.getByRole('textbox',{name:'本次关键词'}).fill('雪地观察');
  await page.locator('.search-modal .consent input').check();
  await behavior('success','success');
  await startSearch();
  await page.locator('.post-card').waitFor();
  const before=await page.evaluate(async()=> (await window.kanshan.load()).data.favorites.length);
  await button('收藏这条来源').click();
  await waitSprite('emo_happy','enter');
  const after=await page.evaluate(async()=> (await window.kanshan.load()).data.favorites.length);
  assert.equal(after,before+1);
  assert.equal(await page.locator('.camp-seed').getAttribute('aria-label'),`种子箱 · ${after}`);
  await page.locator('[data-animation="emo_happy"][data-animation-frame="4"]:visible').first().waitFor({timeout:1300});
  await capture('02-saved-and-happy');
  await waitSprite('act_idle','loop');
  await button('收藏这条来源').click();
  await page.getByText(/种子不会重复发放/).waitFor();
  assert.equal(await page.locator('[data-animation="emo_happy"]').count(),0);
  const bad=await page.evaluate(()=>window.kanshan.save({kind:'zhihu_post',title:'无效',keywords:'无效',simulated:false,resultId:'missing'}));
  assert.equal(bad.ok,false);
  assert.equal(await page.locator('[data-animation="emo_happy"]').count(),0);
  mark('检索夹具：取消与回包同步，收藏提交后得种子，失败和重复均不播放');
  await button('关闭山洞探索桌').click();

  await menu('低打扰开关');
  await waitSprite('act_sit','hold','.camp-fox');
  await capture('03-focus');
  await openChat();
  await send('专注模式仍然可以聊天');
  await page.getByText('验收夹具正文',{exact:false}).last().waitFor();
  await waitSprite('act_sit','hold','.chat-modal');
  await behavior('late','success');
  await send('在等待中进入睡眠');
  await menu('回家');
  await button('休息／睡眠').click();
  await waitSprite('act_sleep','hold','.home-bed-sleeper');
  await page.waitForTimeout(600);
  await waitSprite('act_sleep','hold','.home-bed-sleeper');
  assert.equal(await page.locator('.home-bed-sleeper [data-rendering="legacy-blanket"]').count(),1);
  await capture('04-sleep');
  await button('音乐').click();
  await button('打开 QQ 音乐').waitFor();
  await button('关闭',page.locator('.home-sleep-controls')).click();
  await button('闹钟').click();
  await page.getByLabel('响铃时间',{exact:true}).waitFor();
  assert.equal((await page.evaluate(()=>window.kanshan.sleepAlarmStatus())).ok,true);
  await button('关闭',page.locator('.home-sleep-controls')).click();
  await button('收回桌面').click();
  await waitSprite('act_sleep','hold','.desktop-pet');
  await button('叫醒刘看山').click();
  await waitSprite('act_sit','hold','.desktop-pet');
  await menu('低打扰开关');
  await waitSprite('act_idle','loop','.desktop-pet');
  mark('专注、睡眠、晚到回复、收起与唤醒；睡眠下保留音乐和闹钟入口');

  const d=await page.locator('.pet-fox .fox-animation-hit').boundingBox();
  assert.ok(d);
  const local={x:Math.round(d.x+d.width/2),y:Math.round(d.y+d.height/2)};
  const native=await app.evaluate(({screen,BrowserWindow},local)=>{
   const main=BrowserWindow.getAllWindows().find(win=>!win.webContents.getURL().includes('companion=1'));
   const position=main.getBounds();
   globalThis.animationNativeCursor=screen.getCursorScreenPoint;
   globalThis.animationDragPosition={x:position.x+local.x,y:position.y+local.y};
   screen.getCursorScreenPoint=()=>globalThis.animationDragPosition;
   return position;
  },local);
  const detached=app.waitForEvent('window',{timeout:6500});
  try{
   await page.mouse.move(local.x,local.y);
   await page.mouse.down();
   await page.mouse.move(local.x+10,local.y);
   const child=await detached;
   await app.evaluate(()=>{globalThis.animationDragPosition.x+=180;globalThis.animationDragPosition.y-=42;});
   await page.waitForTimeout(200);
   await page.mouse.up();
   await page.locator('.pet-fox.is-away').waitFor({state:'attached'});
   await child.locator('.roam-character [data-animation="act_idle"]').waitFor();
   const changed=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()
    .find(win=>win.webContents.getURL().includes('companion=1')).getBounds());
   assert.ok(Math.abs(changed.x-native.x)>100);
   await menu('低打扰开关');
   await child.locator('.roam-character [data-animation-pose="sit_hold"]').waitFor();
   mark('透明角色可拖动到独立窗口，原生桥接同步专注与坐姿');
  }finally{
   await app.evaluate(({screen})=>{screen.getCursorScreenPoint=globalThis.animationNativeCursor;});
  }
 }
 await writeFile(join(out,real?'real-api.json':'native-fixture.json'),JSON.stringify({real,checks},null,2)+'\n');
}finally{
 await app?.close();
 await rm(profile,{recursive:true,force:true});
}
