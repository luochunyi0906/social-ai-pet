import { skipGuide } from './skip-guide.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(import.meta.url);
const core=require('../desktop/core.cjs');
const {version}=require('../package.json');
const profile=await mkdtemp(join(tmpdir(),'kanshan-home-test-'));
const artifacts=process.env.KANSHAN_HOME_ARTIFACTS||join(root,'artifacts','home');
const userPrefs=join(profile,'outfit-preference.json');
const legacy=core.addFavorite(core.emptyStore(),{kind:'generated_question',title:'小屋升级前的收藏',keywords:'旧收藏',simulated:true});
const savedLegacy=JSON.stringify(legacy);
await mkdir(artifacts,{recursive:true});
await writeFile(join(profile,'garden-v1.json'),savedLegacy);

let app, page;
const checks=[];
const mark=(name,evidence)=>{checks.push({name,evidence});console.log('PASS',name);};
const btn=name=>page.getByRole('button',{name,exact:true});
const room=()=>page.locator('.home-scene');
const closet=()=>page.locator('.home-closet');
const forestCard=()=>closet().locator('.home-outfit-card').filter({hasText:'森林引路者'});
const awakeSprite=()=>room().locator('.home-companion .fox-costume');
const desktopSprite=()=>page.locator('.desktop-pet .fox-costume');
const bounds=()=>app.evaluate(({BrowserWindow})=>BrowserWindow.fromId(1).getBounds());
const snap=name=>page.screenshot({path:join(artifacts,name+'.png'),omitBackground:true});
const has=locator=>locator.waitFor({state:'visible'});
const hasNot=locator=>locator.waitFor({state:'hidden'});
const stored=async()=>JSON.parse(await readFile(userPrefs,'utf8')).outfitId;
const api=async (method,...args)=>page.evaluate(([name,params])=>window.kanshan[name](...params),[method,args]);
async function launch(){
 app=await electron.launch({
  executablePath:resolve(root,process.env.KANSHAN_PACKAGE_DIR||'release','看山有伴.app/Contents/MacOS/Kanshan'),
  env:{...process.env,KANSHAN_DATA_DIR:profile}, timeout:20000
 });
 page=await app.firstWindow();
 await skipGuide(page);
 page.setDefaultTimeout(7200);
 await page.emulateMedia({reducedMotion:'no-preference'});
 await has(page.locator('.desktop-pet'));
 await page.waitForFunction(async()=> (await window.kanshan.load()).ok);
}
async function enterHome(){
 await btn('进入暖木小屋').click();
 await has(room());
}
async function openCloset(){
 await btn('换装').click();
 await has(room().locator('.home-wardrobe.is-opening'));
 await has(closet());
}
async function wakeFromAppMenu(){
 const result=await app.evaluate(({Menu})=>{
  const item=Menu.getApplicationMenu().items[0].submenu.items.find(entry=>entry.label==='操作菜单')
   ?.submenu.items.find(entry=>entry.label==='叫醒刘看山');
  if(!item)return false;
  item.click();
  return true;
 });
 assert.equal(result,true);
}
async function dragOutfit(){
 const hit=desktopSprite().locator('.fox-costume-hit');
 const box=await hit.boundingBox();
 const spritePoint={x:Math.round(box.x+box.width*.46),y:Math.round(box.y+box.height*.55)};
 assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.classList.contains('fox-costume-hit'),spritePoint),true);
 const grip=await page.locator('.pet-camp-grip').boundingBox();
 const point={x:Math.round(grip.x+grip.width/2),y:Math.round(grip.y+grip.height/2)};
 const start=await bounds();
 const origin={x:start.x+point.x,y:start.y+point.y};
 await app.evaluate(({screen},origin)=>{
  globalThis.homeTestCursor=origin;
  globalThis.homeGetCursor=screen.getCursorScreenPoint;
  screen.getCursorScreenPoint=()=>globalThis.homeTestCursor;
 },origin);
 try {
  await page.mouse.move(point.x,point.y);
  await page.mouse.down();
  await page.mouse.move(point.x+12,point.y);
  await has(page.locator('.camp-dragging .pet-camp-grip'));
  await app.evaluate((_,point)=>{globalThis.homeTestCursor=point;},{x:origin.x+40,y:origin.y-30});
  await page.waitForTimeout(110);
  await page.mouse.up();
  const after=await bounds();
  assert.equal(after.x,start.x+40);
  assert.equal(after.y,start.y-30);
  assert.deepEqual([after.width,after.height],[start.width,start.height]);
  assert.equal(await page.locator('.pet-fox').getAttribute('class').then(value=>value.includes('is-away')),true);
  return after;
 } finally {
  await app.evaluate(({screen})=>{screen.getCursorScreenPoint=globalThis.homeGetCursor;});
 }
}
try{
 await launch();
 await page.locator('.pet-fox .fox-costume-hit').dblclick();
 await has(btn('进入暖木小屋'));
 await page.locator('.camp-journal').click();
 await has(page.getByText('小屋升级前的收藏',{exact:true}).first());
 await btn('关闭收藏手账').click();
 await enterHome();
 const first=await bounds();
 assert.deepEqual([first.width,first.height],[900,740]);
 await page.locator('.home-furniture-art img').evaluateAll(async images=>Promise.all(images.map(image=>image.decode())));
 await page.mouse.move(430,71);
 await snap('01-暖木小屋');
 assert.equal(await btn('休息／睡眠').getAttribute('title'),'休息／睡眠');
 await btn('休息／睡眠').click();
 await has(room().locator('.home-bed-sleeper .fox-sleep'));
 await has(room().getByText('休息中',{exact:true}));
 assert.equal(await room().getAttribute('data-behavior'),'sleep');
 assert.deepEqual(await bounds(),first);
 await snap('02-睡眠');
 mark('小屋、床、衣柜及原收藏手账可用，点击床熄灯入睡且窗口未移动',first);

 const table=room().locator('.home-nightstand');
 const gaps=[];
 for(const viewport of [[900,740],[720,620],[600,540]]){
  await app.evaluate(({BrowserWindow},size)=>BrowserWindow.fromId(1).setSize(...size),viewport);
  await page.waitForFunction(([width,height])=>innerWidth===width&&innerHeight===height,viewport);
  const [bed, desk, wardrobe]=await Promise.all([
   btn('起床').boundingBox(),table.boundingBox(),btn('换装').boundingBox()
  ]);
  const spaces=[desk.x-bed.x-bed.width,wardrobe.x-desk.x-desk.width];
  assert.ok(spaces.every(value=>value>=6),JSON.stringify({viewport,spaces}));
  await btn('音乐').click({trial:true});
  await btn('闹钟').click({trial:true});
  gaps.push({viewport,minimumGap:Math.round(Math.min(...spaces))});
  if(viewport[0]!==720)await snap('sleep-table-'+viewport.join('x'));
 }
 await app.evaluate(({BrowserWindow})=>BrowserWindow.fromId(1).setSize(900,740));
 await btn('音乐').click();
 await btn('播放林间夜曲').click();
 await has(room().getByText(/已把音频交给 QQ 音乐/));
 await btn('关闭').click();
 await hasNot(room().locator('.home-sleep-controls'));
 await btn('闹钟').click();
 await has(page.getByLabel('响铃时间',{exact:true}));
 assert.equal((await api('addSystemAlarm','25:00')).ok,false);
 if(process.env.KANSHAN_TEST_CLOCK_INSTALLED==='1'){
  assert.deepEqual(await api('sleepAlarmStatus'),{ok:true,data:{installed:true}});
  await has(room().getByText(/快捷指令已就绪/));
  await hasNot(btn('导入新版闹钟快捷指令'));
 }
 if(process.env.KANSHAN_TEST_CLOCK_MISSING==='1'){
  await btn('设置系统闹钟').click();
  await has(room().getByText(/请导入新版闹钟快捷指令/));
 }
 await btn('打开时钟').click();
 await has(room().locator('.home-sleep-controls'));
 await btn('关闭').click();
 assert.deepEqual(await bounds(),first);
 mark('三种窗口的桌上入口留有间距，QQ 音乐接收音轨，可以打开 Mac 时钟，非法响铃时间被拒绝',gaps);


 await openCloset();
 assert.equal(await closet().locator('.home-outfit-card').count(),1);
 await forestCard().click();
 await btn('查看实际效果').click();
 await has(closet().locator('.home-preview-stage [data-classic-garment="forest-guide"]'));
 await closet().locator('.home-preview-stage').screenshot({path:join(artifacts,'forest-guide-detail.png')});
 await snap('03-睡眠中预览森林引路者');
 await btn('关闭预览').click();
 await hasNot(closet());
 await openCloset();
 assert.equal(await closet().getByRole('heading',{name:'默认装扮',exact:true}).isVisible(),true);
 await forestCard().click();

 // Simulate one unavailable runtime resource at the image decode boundary.
 await page.evaluate(()=>{
  globalThis.homeDecode=Image.prototype.decode;
  Image.prototype.decode=function(){return this.src.includes('INFJ_')?Promise.reject(Error('fixture missing PNG')):globalThis.homeDecode.call(this);};
 });
 await btn('穿上').click();
 await has(page.getByRole('alert').filter({hasText:'尺寸不兼容'}));
 assert.equal((await api('outfitSettings')).data.outfitId,'default');
 await page.evaluate(()=>{Image.prototype.decode=globalThis.homeDecode;});
 await btn('穿上').click();
 await has(forestCard().getByText('正在穿着',{exact:true}));
 assert.equal(await stored(),'forest-guide');
 assert.equal(await room().getAttribute('data-behavior'),'sleep');
 assert.equal(await closet().getByRole('button',{name:'展示水晶动作'}).count(),0);
 assert.equal(await room().locator('.fox-sleep').getAttribute('data-outfit-id'),'forest-guide');
 await snap('04-睡眠中换装');
 mark('单 ZIP 一张套装卡，预览可取消，坏资源不覆盖当前装扮；确认换装后保持睡眠');

 await btn('收回桌面').click();
 await has(page.locator('.desktop-pet .fox-sleep'));
 assert.equal(await page.locator('.pet-snowy-flurries').count(),0);
 await snap('05-桌面睡眠');
 await btn('叫醒刘看山').click();
 await has(desktopSprite());
 assert.equal(await desktopSprite().getAttribute('data-outfit-id'),'forest-guide');
 const position=await dragOutfit();
 await snap('06-桌面森林引路者');
 await desktopSprite().waitFor({state:'visible',timeout:23000});
 await desktopSprite().locator('.fox-costume-hit').dblclick();
 await has(page.locator('.camp-fox [data-outfit-id="forest-guide"]'));
 const spacing=[];
 for(const viewport of [[900,740],[720,620],[600,540]]){
  await app.evaluate(({BrowserWindow},size)=>BrowserWindow.fromId(1).setSize(...size),viewport);
  await page.waitForFunction(([width,height])=>innerWidth===width&&innerHeight===height,viewport);
  const bench=btn('坐一会儿');
  const companion=btn('和刘看山互动，可双击打开聊天');
  const benchLabel=bench.getByText('坐一会儿');
  const benchBox=await benchLabel.boundingBox();
  const companionBox=await companion.boundingBox();
  const costumeBox=await companion.locator('.fox-costume-hit').boundingBox();
  const gap=Math.min(companionBox.x,costumeBox.x)-benchBox.x-benchBox.width;
  assert.ok(benchBox.x>=0&&gap>=10,JSON.stringify({viewport,gap}));
  await benchLabel.click({trial:true});
  await companion.click({trial:true});
  spacing.push({viewport,gapPx:Math.round(gap)});
  if(viewport[0]!==720)await snap('camp-bench-spacing-'+viewport.join('x'));
 }
 await app.evaluate(({BrowserWindow})=>BrowserWindow.fromId(1).setSize(900,740));
 mark('森林引路者与长椅分别可点，默认及小窗口均保留间距',spacing);
 await enterHome();
 await has(awakeSprite());
 await snap('07-清醒后的装扮');
 mark('从桌面唤醒，换装保持；真实小窗拖动位移正确，营地与小屋角色已同步',position);

 await openCloset();
 await page.evaluate(()=>{
  const actor=document.querySelector('.home-companion [data-outfit-frame]');
  globalThis.homeFrameLog=[];
  globalThis.homeObserver=new MutationObserver(()=>{
   globalThis.homeFrameLog.push(actor.getAttribute('data-outfit-frame'));
  });
  globalThis.homeObserver.observe(actor,{attributes:true,attributeFilter:['data-outfit-frame']});
 });
 await btn('展示水晶动作').click();
 await page.waitForFunction(()=>globalThis.homeFrameLog.some(frame=>/INFJ_0[12]/.test(frame)));
 await snap('08-水晶动作');
 await page.waitForFunction(()=>globalThis.homeFrameLog.at(-1)==='INFJ_001.png');
 const frames=await page.evaluate(()=>{globalThis.homeObserver.disconnect();return globalThis.homeFrameLog;});
 const indices=frames.slice(0,-1).map(frame=>Number(frame.match(/\d+/)[0]));
 assert.ok(indices.length>=20,JSON.stringify(frames));
 assert.ok(indices.every((value,i)=>i===0||value>indices[i-1]),JSON.stringify(frames));
 assert.equal(await awakeSprite().getAttribute('data-outfit-frame'),'INFJ_001.png');

 await btn('展示水晶动作').click();
 await page.waitForFunction(()=>document.querySelector('.home-companion [data-outfit-frame]')?.getAttribute('data-outfit-frame')!=='INFJ_001.png');
 await btn('关闭预览').click();
 await btn('休息／睡眠').click();
 await page.waitForTimeout(1800);
 assert.equal(await room().getAttribute('data-behavior'),'sleep');
 await has(room().locator('.home-bed-sleeper .fox-sleep'));
 await btn('返回营地').click();
 await has(page.locator('.camp-fox .fox-sleep'));
 assert.equal(await page.locator('.camp-snow').count(),0);
 await wakeFromAppMenu();
 await has(page.locator('.camp-fox .fox-costume'));
 assert.equal(await page.locator('.camp-fox .fox-costume').getAttribute('data-outfit-frame'),'INFJ_001.png');
 mark('运行时 PNG 按序单次播放，休眠中断优先，结束回调没有唤醒；系统应用菜单可叫醒',{displayedFrameSequence:frames});

 await enterHome();
 await btn('休息／睡眠').click();
 await app.close();
 app=null;
 await launch();
 await has(desktopSprite());
 assert.equal(await page.locator('.pet-wake').count(),0);
 assert.deepEqual(await bounds(),position);
 assert.equal(await stored(),'forest-guide');
 assert.equal(await readFile(join(profile,'garden-v1.json'),'utf8'),savedLegacy);
 assert.equal((await api('load')).data.favorites[0].title,'小屋升级前的收藏');
 assert.equal((await api('wearOutfit','unregistered')).ok,false);
 await desktopSprite().locator('.fox-costume-hit').dblclick();
 await enterHome();
 await openCloset();
 await btn('恢复默认装扮').click();
 assert.equal(await stored(),'default');
 await has(room().locator('.home-companion .fox-costume-hit'));
 await btn('关闭预览').click();
 await btn('收回桌面').click();
 await has(page.locator('.pet-fox .fox-costume-hit'));
 assert.deepEqual(await bounds(),position);
 mark('重启保留确认的套装与位置，按规则正常醒来；恢复默认有效，旧收藏字节未改');

 await page.locator('.pet-fox .fox-costume-hit').dblclick();
 await enterHome();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.fromId(1).setSize(600,560));
 await page.waitForFunction(()=>innerWidth===600);
 await openCloset();
 await has(btn('穿上'));
 const fit=await btn('穿上').boundingBox();
 assert.ok(fit.y+fit.height<=560);
 await snap('09-小窗口衣柜');
 mark('600 × 560 窗口可见套装和确认按钮',{ viewport:[600,560] });
 await writeFile(join(artifacts,'home-acceptance.json'),JSON.stringify({version,checks},null,2)+'\n');
} finally {
 if(app)await app.close();
 await rm(profile,{recursive:true,force:true});
}
