import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {homedir,tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright';
import dotenv from 'dotenv';

const root=fileURLToPath(new URL('../',import.meta.url));
const release=resolve(root,process.env.KANSHAN_PACKAGE_DIR||'release','看山有伴.app');
const profile=await mkdtemp(join(tmpdir(),'kanshan-native-hot-'));
const artifacts=join(root,'artifacts','hot-list');
const report={mode:'real API and separately labelled fixture failures',checks:[],requests:[],layouts:[]};
let app,page,key;
const button=name=>page.getByRole('button',{name,exact:true});
const screen=()=>page.getByRole('region',{name:'今日好奇心',exact:true});
const detail=()=>page.locator('.hot-detail');
const rows=()=>screen().locator('.hot-row');
function pass(name,detail){
 report.checks.push({name,detail});
 console.log('PASS',name,JSON.stringify(detail??null));
}
async function secret(){
 for(const folder of ['看山有伴-林间预览','看山有伴-v0.3-preview']){
  try{const result=dotenv.parse(await readFile(join(homedir(),'Library/Application Support',folder,'model.env'))).ZHIHU_ACCESS_SECRET?.trim();
   if(result)return result;
  }catch{}
 }
 throw Error('本机无知乎访问密钥。');
}
async function launch(){
 app=await electron.launch({executablePath:join(release,'Contents/MacOS/Kanshan'),cwd:'/',
  env:{PATH:'/usr/bin:/bin:/usr/sbin:/sbin',HOME:homedir(),TMPDIR:tmpdir(),KANSHAN_DATA_DIR:profile,CHAT_PROVIDER:'zhida',ZHIDA_MODEL:'zhida-fast-1p5',ZHIHU_ACCESS_SECRET:key},timeout:25000});
 await app.evaluate(({shell})=>{
  const native=globalThis.fetch;
  globalThis.hotTrace=[];
  globalThis.hotLinks=[];
  globalThis.hotFailure=null;
  shell.openExternal=async value=>{globalThis.hotLinks.push(value);};
  globalThis.fetch=async (url,options)=>{
   const target=new URL(String(url));
   if(target.hostname!=='developer.zhihu.com')return native(url,options);
   const listing=target.pathname==='/api/v1/content/hot_list';
   const model=target.pathname==='/v1/chat/completions';
   if(!listing&&!model)return native(url,options);
   const started=Date.now();
   const payload=model?JSON.parse(options.body):null;
   const trace={path:target.pathname,limit:target.searchParams.get('Limit'),http:null,
    model:payload?.model,fixture:listing&&globalThis.hotFailure||undefined,
    timestamp:Number(options.headers['X-Request-Timestamp']),credentialsPresent:/^Bearer \S+$/.test(options.headers.Authorization)};
   if(model)trace.current=payload.messages.at(-1).content;
   globalThis.hotTrace.push(trace);
   const response=trace.fixture==='offline'?await Promise.reject(new TypeError('fixture offline')):
    trace.fixture==='layout'?Response.json({Code:0,Data:{Total:1,Items:[{
     Title:'长标题与换行验证'.repeat(30),Url:'https://www.zhihu.com/question/73561',
     Summary:'这段文字用来验证超长摘要在右栏独立滚动。'.repeat(100)
    }]}}):trace.fixture?Response.json({Code:trace.fixture}):await native(url,options);
   const json=await response.clone().json();
   trace.http=response.status;
   trace.code=json.Code;
   trace.count=json.Data?.Items?.length;
   trace.elapsedMs=Date.now()-started;
   return response;
  };
 });
 page=await app.firstWindow();
 page.setDefaultTimeout(12000);
 await page.locator('.desktop-pet').waitFor();
}
async function openHot(){
 await page.locator('.pet-fox .fox-nose').click();
 await button('好奇心山洞').click();
 await page.getByRole('region',{name:'山洞探索桌'}).waitFor();
 await button('今日热榜').click();
 await screen().waitFor();
}
async function snapshot(name){
 const size=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}));
 report.layouts.push({name,...size,screenshotScale:'css'});
 await page.screenshot({path:join(artifacts,name+'.png'),scale:'css'});
 return size;
}
async function resize(width,height){
 await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setSize(...size),[width,height]);
 await page.waitForFunction(([w,h])=>innerWidth===w&&innerHeight===h,[width,height]);
}
async function close(){
 if(!app)return;
 report.requests.push(...await app.evaluate(()=>globalThis.hotTrace.map(({current,...trace})=>trace)));
 await app.close();
 app=undefined;
}
async function chat(text){
 const dialog=page.locator('.chat-modal');
 await dialog.getByRole('textbox',{name:'对刘看山说的话'}).fill(text);
 await dialog.getByRole('checkbox').check();
 await dialog.getByRole('button',{name:'发送',exact:true}).click();
 await dialog.getByRole('button',{name:'发送',exact:true}).waitFor({timeout:110000});
}
try{
 await mkdir(artifacts,{recursive:true});
 const dir=join(release,'Contents/Resources/app/skills/hot-list');
 const manifest=JSON.parse(await readFile(join(dir,'manifest.json'),'utf8'));
 for(const [file,expected] of Object.entries(manifest.upstream.files)){
  assert.equal(createHash('sha256').update(await readFile(join(dir,file))).digest('hex'),expected);
 }
 key=await secret();
 await launch();
 await openHot();
 await resize(900,740);
 await rows().first().waitFor({timeout:25000});
 const size=await snapshot('native-hot-live-900x740');
 assert.equal(await rows().count(),30);
 pass('独立签名桌宠通过注册技能加载真实热榜',{size,count:await rows().count()});
 await button('推送设置').click();
 await button('查看视觉示例').click();
 await page.getByText('示例数据 · 非实时热榜',{exact:true}).waitFor();
 await page.locator('.hot-story-image').evaluate(image=>image.decode());
 await page.mouse.move(457,90);
 await snapshot('native-hot-example-900x740');
 await button('去知乎看原文').click();
 await page.getByText('示例条目没有原文链接，请切回真实热榜。',{exact:true}).waitFor();
 await button('收藏到手账').click();
 await page.getByText('示例条目仅用于视觉对照。请切回真实热榜收藏。',{exact:true}).waitFor();
 assert.equal(await app.evaluate(()=>globalThis.hotLinks.length),0);
 assert.equal(JSON.parse(await readFile(join(profile,'garden-v3.json'),'utf8')).favorites.length,0);
 await resize(600,620);
 await rows().nth(2).click();
 await page.getByText('本条暂无摘要，可以去知乎查看原文。',{exact:true}).waitFor();
 await button('‹ 返回热榜列表').click();
 await snapshot('native-hot-example-600x620');
 await resize(900,740);
 await button('推送设置').click();
 await button('切回真实热榜').click();

 const moved=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getBounds());
 const grip=await page.locator('.hot-brand').boundingBox();
 const origin={x:moved.x+grip.x+grip.width/2,y:moved.y+grip.y+grip.height/2};
 await app.evaluate(({screen},start)=>{globalThis.cursorOriginal=screen.getCursorScreenPoint;globalThis.hotCursor=start;screen.getCursorScreenPoint=()=>globalThis.hotCursor;},origin);
 await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);
 await page.mouse.down();
 await page.mouse.move(grip.x+grip.width/2+9,grip.y+grip.height/2);
 await app.evaluate((_,next)=>{globalThis.hotCursor=next;},{x:origin.x+19,y:origin.y});
 await page.waitForTimeout(120);
 await page.mouse.up();
 const after=await app.evaluate(({BrowserWindow,screen})=>{screen.getCursorScreenPoint=globalThis.cursorOriginal;return BrowserWindow.getAllWindows()[0].getBounds();});
 assert.notEqual(after.x,moved.x);
 const list=page.locator('.hot-rows');
 await list.hover();
 await page.mouse.wheel(0,470);
 await page.waitForFunction(()=>document.querySelector('.hot-rows').scrollTop>80);
 await list.evaluate(el=>el.scrollTo(0,0));
 const selection=await detail().locator('h2').evaluate(el=>{
  const range=document.createRange();range.selectNodeContents(el);
  const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
  const value=selection.toString();selection.removeAllRanges();return value;
 });
 assert.ok(selection.trim().length>5);
 pass('原生窗口拖动、正文可选与列表独立滚动',{dx:after.x-moved.x});
 const cached=JSON.parse(await readFile(join(profile,'hot-list-v1.json'),'utf8')).cache;
 const selected=cached.items[1];
 await rows().nth(1).click();
 assert.equal(await detail().locator('h2').innerText(),selected.title);
 await button('去知乎看原文').click();
 assert.equal((await app.evaluate(()=>globalThis.hotLinks)).at(-1),selected.sourceUrl);
 await button('收藏到手账').click();
 await button('已收藏到手账').waitFor();
 await button('已收藏').click();
 assert.equal(await rows().count(),1);
 const garden=JSON.parse(await readFile(join(profile,'garden-v3.json'),'utf8'));
 const saved=garden.favorites.find(f=>f.url===selected.url);
 assert.equal(saved.source.retrievedAt,cached.retrievedAt);
 assert.equal(saved.source.excerpt,selected.excerpt);
 assert.equal(saved.slot,null);
 await button('未读').click();
 assert.equal(await rows().count(),29);
 await button('全部').click();
 await rows().nth(1).click();
 await button('和看山聊聊').click();
 const dialog=page.locator('.chat-modal');
 await dialog.getByText('关联：'+selected.title,{exact:false}).waitFor();
 await chat('给我看知乎热榜前 10 条');
 assert.equal(await dialog.locator('.hot-chat-list li').count(),10);
 assert.match(await dialog.locator('.hot-chat-list').innerText(),/缓存内容/);
 assert.equal(await dialog.locator('.hot-chat-list li').nth(1).innerText(),selected.title);
 await chat('第二条讲了什么');
 await dialog.getByText('模型解读 · 依据热榜标题与现有摘要，全文未核验',{exact:true}).waitFor();
 assert.equal(await dialog.locator('.fox-line').count(),2);
 assert.equal((await app.evaluate(()=>globalThis.hotTrace.filter(trace=>trace.model).map(trace=>trace.current))).length,1);
 const prompt=(await app.evaluate(()=>globalThis.hotTrace.find(trace=>trace.model).current));
 assert.ok(prompt.includes(selected.title)&&prompt.includes(selected.sourceUrl));
 pass('真实热榜前十命中缓存，第二条使用对应摘要与原文链接进行直答',{retrievedAt:cached.retrievedAt,title:selected.title,url:selected.url});
 await button('关闭对话').click();
 await button('刷新').click();
 await page.waitForFunction(()=>document.querySelector('.hot-badge')?.textContent==='已获取');
 const traces=await app.evaluate(()=>globalThis.hotTrace.filter(trace=>trace.limit));
 assert.equal(traces.length,2);
 assert.deepEqual(traces.map(trace=>trace.code),[0,0]);
 for(const [failure,pattern] of [['offline',/检查网络/],[20001,/鉴权失败/],[30001,/查询受限/]]){
  await app.evaluate((_,value)=>{globalThis.hotFailure=value;},failure);
  await button('刷新').click();
  await page.getByRole('alert').filter({hasText:pattern}).waitFor();
  assert.equal(await rows().count(),30);
 }
 const refreshed=JSON.parse(await readFile(join(profile,'hot-list-v1.json'),'utf8')).cache;
 pass('页面首次加载与点击刷新各一次；注入断网、鉴权、限流时真实缓存保留',{count:refreshed.items.length,retrievedAt:refreshed.retrievedAt});
 await button('推送设置').click();
 const settings=page.getByRole('dialog',{name:'推送设置'});
 await settings.getByLabel('每日热榜提醒').check();
 await settings.getByLabel('提醒时间').fill('00:00');
 await settings.getByLabel('每日速览').selectOption('3');
 await settings.getByRole('button',{name:'保存设置'}).click();
 await page.getByText('提醒设置已保存。',{exact:true}).waitFor();
 await new Promise(resolve=>setTimeout(resolve,400));
 const reminder=JSON.parse(await readFile(join(profile,'hot-list-v1.json'),'utf8'));
 assert.deepEqual(reminder.prefs,{enabled:true,time:'00:00',count:3});
 assert.match(reminder.attemptedDay,/^\d{4}-\d{2}-\d{2}$/);
 await button('收回桌面').click();
 await page.locator('.desktop-pet').waitFor();
 await close();
 await launch();
 await openHot();
 await page.getByText('缓存内容',{exact:true}).waitFor();
 await button('未读').click();
 assert.ok(!(await rows().allTextContents()).some(text=>text.includes(selected.title)));
 await button('已收藏').click();
 if(refreshed.items.some(post=>post.url===selected.url))assert.equal(await rows().count(),1);
 assert.equal(await app.evaluate(()=>globalThis.hotTrace.length),0);
 await button('推送设置').click();
 const restoredSettings=page.getByRole('dialog',{name:'推送设置'});
 assert.equal(await restoredSettings.getByLabel('每日速览').inputValue(),'3');
 await restoredSettings.getByText('下次计划提醒',{exact:false}).waitFor();
 await button('关闭推送设置').click();
 await button('全部').click();
 await app.evaluate(()=>{globalThis.hotFailure='layout';});
 await button('刷新').click();
 await rows().first().getByText(/长标题与换行验证/).waitFor();
 assert.equal(await detail().locator('h2').innerText(),'长标题与换行验证'.repeat(30));
 assert.equal(await detail().locator('img').count(),0);
 assert.equal(await detail().evaluate(el=>el.scrollHeight>el.clientHeight&&el.scrollWidth<=el.clientWidth),true);
 assert.equal(await page.locator('.hot-row-text strong').evaluate(el=>el.scrollHeight>el.clientHeight),true);
 pass('长标题两行收束，完整标题和长摘要在详情内滚动，缺图保留纯文字排版');
 await button('返回山洞探索桌').click();
 await page.getByRole('region',{name:'山洞探索桌'}).waitFor();
 pass('退出重启后恢复缓存、已读、收藏和山洞入口',{readUrl:selected.url});
}catch(error){
 report.failure=error.message;
 console.error(error.stack);
 process.exitCode=1;
}finally{
 await close().catch(()=>{});
 if(key)await writeFile(join(artifacts,'native-hot-acceptance.json'),JSON.stringify(report,null,2).replaceAll(key,'[隐藏]')+'\n');
 await rm(profile,{recursive:true,force:true});
}
