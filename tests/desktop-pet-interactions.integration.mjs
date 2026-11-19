import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import { _electron as electron } from 'playwright';
import {skipGuide} from './skip-guide.mjs';

const packageDir=resolve(process.env.KANSHAN_PACKAGE_DIR||'release');
const routeFile=process.env.KANSHAN_AUDIO_ROUTE_TEST;
const proof=process.env.KANSHAN_INTERACTION_PROOF;
const profile=await mkdtemp(join(tmpdir(),'kanshan-interaction-test-'));
const sleep=ms=>new Promise(done=>setTimeout(done,ms));
let app;

async function record(page,name,exercise,clip){
 if(!proof){await exercise();return;}
 const directory=join(proof,name);
 await mkdir(directory,{recursive:true});
 let finished=false;
 const timestamps=[];
 const grab=(async()=>{
  let frame=0;
  while(!finished){
   timestamps.push(Date.now());
   await page.screenshot({path:join(directory,String(frame++).padStart(4,'0')+'.png'),omitBackground:true,clip});
   await sleep(38);
  }
 })();
 try{await exercise();}finally{
  finished=true;await grab;
  await writeFile(join(directory,'frames.json'),JSON.stringify(timestamps));
 }
}

try{
 if(proof)await mkdir(proof,{recursive:true});
 await writeFile(join(profile,'window-preferences.json'),JSON.stringify({
  version:1,appearance:'fox',snow:false,pet:{x:24,y:44},weather:{enabled:false,city:'hong-kong',chase:false},
  wander:{enabled:false,interval:90,distance:75,dwell:4},
 }));
 const selectRoute=async(output,device)=>{
  if(routeFile)await writeFile(routeFile,JSON.stringify({device,output})+'\n');
 };
 await selectRoute('other',41);
 app=await electron.launch({
  executablePath:join(packageDir,'看山有伴.app','Contents','MacOS','Kanshan'),
  env:{...process.env,KANSHAN_DATA_DIR:profile},
 });
 const page=await app.firstWindow();
 await skipGuide(page);
 await page.emulateMedia({reducedMotion:'no-preference'});
 const menu=label=>app.evaluate(({Menu,BrowserWindow},wanted)=>{
  BrowserWindow.fromId(1).show();
  Menu.getApplicationMenu().items[0].submenu.items.find(item=>item.label==='操作菜单').submenu.items
   .find(item=>item.label===wanted).click();
 },label);
 const status=()=>page.evaluate(async()=>(await window.kanshan.listeningStatus()).data);
 const setMode=mode=>page.evaluate(async name=>window.kanshan.chooseListening(name),mode);
 const close=async()=>{
  await page.getByRole('button',{name:'收起',exact:true}).click();
  await page.locator('.desktop-pet').waitFor();
 };
 const actor=page.locator('.pet-fox .fox-appearance');
 await actor.waitFor();
 await page.evaluate(()=>window.kanshan.companionSave({enabled:false,frequency:'low'}));
 await menu('陪听');
 const listen=page.getByRole('dialog',{name:'一起听一会儿'});
 await listen.waitFor();
 await setMode('off');
 if(routeFile){
  await page.waitForFunction(async()=> (await window.kanshan.listeningStatus()).data.output==='other');
  await close();
  await record(page,'01-desktop-headset',async()=>{
   await sleep(300);
   await selectRoute('headphones',73);
   await page.waitForFunction(async()=> (await window.kanshan.listeningStatus()).data.mode==='auto');
   await sleep(1450);
   assert.equal(await page.getByRole('dialog').count(),0);
  });
  const auto=await status();
  assert.equal(auto.output,'headphones');
  await sleep(550);
  assert.equal((await status()).cue,auto.cue);
  await menu('陪听');
  await listen.waitFor();
  assert.match(await listen.innerText(),/耳机已连接/);
  await listen.getByRole('button',{name:'播放林间夜曲'}).click();
  await listen.getByRole('button',{name:'暂停林间夜曲'}).waitFor();
  await selectRoute('other',41);
  await listen.getByRole('button',{name:'播放林间夜曲'}).waitFor();
  await page.waitForFunction(async()=> (await window.kanshan.listeningStatus()).data.mode==='off');
 }
 await listen.getByRole('button',{name:'手动戴上耳机'}).click();
 await listen.locator('[data-worn]').waitFor();
 assert.match(await listen.innerText(),/手动陪听/);
 assert.doesNotMatch(await listen.innerText(),/正在播放|进度|节拍/);
 await sleep(1150);
 if(proof)await listen.screenshot({path:join(proof,'陪听.png')});
 await close();

 const position=async(x,y)=>{
  await app.evaluate(({BrowserWindow,screen},p)=>{
   const native=BrowserWindow.fromId(1);
   const b=native.getContentBounds();
   globalThis.fixtureCursor={x:b.x+p.x,y:b.y+p.y};
   if(!globalThis.originalCursor)globalThis.originalCursor=screen.getCursorScreenPoint.bind(screen);
   screen.getCursorScreenPoint=()=>globalThis.fixtureCursor||originalCursor();
   native.setIgnoreMouseEvents(false);
  },{x,y});
  await page.mouse.move(x,y);
 };
 async function pinch(side){
  const node=actor.locator(`[data-cheek-direction="${side}"]`);
  const box=await node.boundingBox();
  assert.ok(box);
  const x=box.x+box.width*.5,y=box.y+box.height*.54;
  await page.evaluate(()=>{
   globalThis.cheekEvents=[];
   window.addEventListener('pointermove',event=>cheekEvents.push([event.clientX,event.clientY,event.target.getAttribute('class')]),{capture:true,once:true});
  });
  await position(x,y);
  try{await actor.locator('[data-cheek-stage="ready"]').waitFor({timeout:1800});}
  catch(error){
   console.log('cheek target',side,box,await page.evaluate(({x,y})=>({
    events:globalThis.cheekEvents,
    at:document.elementsFromPoint(x,y).map(e=>[e.tagName,e.getAttribute('class'),e.getAttribute('data-cheek-side')]),
    style:getComputedStyle(document.querySelector('.cheek-target')).pointerEvents,
   }),{x,y}));
   throw error;
  }
  await page.mouse.down();
  const end=side==='left'?-35:35;
  for(let i=1;i<=4;i++){await position(x+end*i/4,y);await sleep(43);}
  const shape=actor.locator('[data-cheek-stage="pull"]');
  await shape.waitFor({state:'attached'});
  const expansion=await shape.locator('.cheek-texture').evaluate(el=>getComputedStyle(el).getPropertyValue('--cheek-expansion'));
  assert.ok(Number(expansion)>1.25&&Number(expansion)<=1.54);
  assert.equal(await actor.locator('[data-worn]').count(),1);
  assert.notEqual(await actor.getAttribute('data-gesture'),'lift');
  if(proof&&side==='right')await page.screenshot({path:join(proof,'捏脸.png'),omitBackground:true});
  await sleep(350);
  await page.mouse.up();
  await actor.locator('[data-cheek-stage="release"]').waitFor({state:'attached'});
  await actor.locator('[data-cheek-stage="release"]').waitFor({state:'detached'});
  await page.mouse.move(290,24);
 }
 await record(page,'02-cheek-rebound',async()=>{
  await pinch('left');
  await pinch('right');
  await sleep(1520);
  assert.equal(await page.getByRole('dialog').count(),0);
  assert.equal(app.windows().length,1);
 });
 const cheekBox=await actor.locator('[data-cheek-direction="left"]').boundingBox();
 await position(cheekBox.x+cheekBox.width/2,cheekBox.y+cheekBox.height/2);
 await actor.locator('[data-cheek-stage="ready"]').waitFor();
 await page.mouse.down();await page.mouse.up();
 await page.locator('.camp-shell').waitFor();
 await page.getByRole('button',{name:'收回桌面'}).click();
 await page.locator('.desktop-pet').waitFor();

 const knock=page.locator('.desktop-pet .desktop-knock-art');
 const button=page.locator('.desktop-pet button.pet-fox');
 const location=await actor.locator('.fox-costume-hit').boundingBox();
 const center={x:location.x+location.width*.6,y:location.y+location.height*.65};
 async function doubleSecondary(){
  await position(center.x,center.y);
  await page.mouse.click(center.x,center.y,{button:'right'});
  await sleep(65);
  await page.mouse.click(center.x,center.y,{button:'right'});
 }
 await page.evaluate(()=>{
  globalThis.softTapPlayCount=0;
  globalThis.softTapTimes=[];
  document.querySelector('[data-knock-audio]').addEventListener('play',()=>{
   globalThis.softTapPlayCount++;globalThis.softTapTimes.push(Date.now());
  });
 });
 await doubleSecondary();
 await knock.waitFor();
 await page.waitForFunction(()=>document.querySelector('.desktop-knock-art')?.dataset.knockBeat==='1');
 assert.equal(await page.getByRole('dialog').count(),0);
 assert.equal(await page.evaluate(()=>globalThis.softTapPlayCount),0,'陪听中静音');
 await doubleSecondary();
 await knock.waitFor({state:'detached'});
 await setMode('off');
 await record(page,'03-knock',async()=>{
  await doubleSecondary();
  await knock.waitFor();
  await page.waitForFunction(()=>document.querySelector('.desktop-knock-art')?.dataset.knockBeat==='1');
  await sleep(300);
  await button.evaluate(el=>{for(let i=0;i<9;i++)el.click();});
  assert.equal(await knock.getAttribute('data-knock-beat'),'2');
  for(let i=3;i<=10;i++){
   await sleep(320);
   await page.mouse.click(center.x,center.y);
   if(proof&&i===5){
    await sleep(65);
    await page.screenshot({path:join(proof,'看山敲敲.png'),omitBackground:true});
   }
  }
  assert.equal(await knock.getAttribute('data-knock-beat'),'10');
  assert.match(await knock.textContent(),/陪你歇了一小会儿/);
  await page.waitForFunction(()=>globalThis.softTapPlayCount===10);
  await sleep(410);
 });
 if(proof)await writeFile(join(proof,'03-knock','sounds.json'),JSON.stringify(await page.evaluate(()=>globalThis.softTapTimes)));
 await menu('暂停／恢复');
 await knock.waitFor({state:'detached'});
 assert.equal(await page.locator('[data-knock-audio]').evaluate(audio=>audio.paused),true);
 await menu('暂停／恢复');
 await page.locator('.desktop-pet.paused').waitFor({state:'detached'});
 await menu('敲敲');
 await knock.waitFor();
 await page.evaluate(()=>window.kanshan.control('hide'));
 await knock.waitFor({state:'detached'});
 assert.equal(await page.locator('[data-knock-audio]').evaluate(audio=>audio.paused),true);
 await status();
 console.log('PASS 陪听、左右准备态捏脸、回弹、节流、计数、音效和暂停清理。');
}finally{
 await app?.close();
 await rm(profile,{recursive:true,force:true});
}
