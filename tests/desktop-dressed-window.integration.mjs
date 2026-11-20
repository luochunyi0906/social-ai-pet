import assert from 'node:assert/strict';
import {execFile,spawn} from 'node:child_process';
import {once} from 'node:events';
import {access,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {promisify} from 'node:util';
import {_electron as electron} from 'playwright';
import {skipGuide} from './skip-guide.mjs';
import windowTargets from '../desktop/window-target.cjs';
import layout from '../desktop/pet-layout.json' with {type:'json'};

const bundle=resolve(process.env.KANSHAN_PACKAGE_DIR||'release','看山有伴.app');
const profile=await mkdtemp(join(tmpdir(),'kanshan-dressed-window-'));
const form=process.env.KANSHAN_TEST_FORM||'fox';
const outfit=process.env.KANSHAN_TEST_OUTFIT||process.env.KANSHAN_FOX_OUTFIT||
 ({fox:'ming',classic:'forest-guide',human:'hot'})[form];
const selector=form==='human'?'[data-pet-appearance="human"]':form==='classic'?'.fox-classic-model':'[data-pet-appearance="fox"]';
const automatic=form!=='human'&&['rain','heat','sun'].includes(outfit);
const automaticRain=automatic&&outfit==='rain';
const baseline=outfit==='default'||outfit==='normal';
const selectStandard=form==='fox'&&(outfit==='default'||outfit==='heat'||outfit==='sun');
const expectedClassicId=automatic?'default':outfit;
const marker=form==='human'?'data-human-weather':form==='classic'?'data-outfit-id':automaticRain?'data-raincoat':'data-cave-outfit';
const selected=automaticRain&&form==='fox'?'true':selectStandard?null:form==='classic'?expectedClassicId:outfit;
const rig=form==='human'?'.human-body-motion':'.fox-classic-model';
const costume=selected===null?`${selector}:not([${marker}])`:`${selector}[${marker}="${selected}"]`;
const proof=process.env.KANSHAN_FOX_PROOF;
const proofPath=phase=>join(proof,`${form}-${outfit}-${phase}.png`);
const artOnly='.pet-contact,.pet-snowy-ground,.pet-object,.pet-weather,.pet-caption-context,.pet-camp-grip,.pet-listen-trigger,.pet-avatar-tag,.pet-invitation {visibility:hidden!important} .desktop-pet,.roam-character{background:transparent!important}';
const rain=outfit==='rain';
const releaseEarly=process.env.KANSHAN_TEST_RELEASE==='climb';
const reverseReturn=process.env.KANSHAN_TEST_DIRECTION==='right';
const windows=[];
const nativeWindowFixture=process.env.KANSHAN_WINDOW_FIXTURE||join(profile,'window-fixture');
const command=promisify(execFile);
let app;

async function capture(page,phase,frames=1){
 if(!proof)return;
 for(let index=0;index<frames;index++){
  if(index)await page.waitForTimeout(95);
  await page.screenshot({path:proofPath(index?`${phase}-${index+1}`:phase),omitBackground:true});
 }
}

async function fixture(kind){
 const process=spawn(nativeWindowFixture,[kind],{stdio:['ignore','pipe','inherit']});
 windows.push(process);
 await Promise.race([once(process.stdout,'data'),once(process,'exit').then(([code])=>{
  throw Error('The native test window exited before opening: '+code);
 })]);
 return process;
}
async function inspect(id=0){
 const helper=join(bundle,'Contents/Resources/app/desktop/native/window-info');
 const {stdout}=await command(helper,[String(app.process().pid),String(id)]);
 return JSON.parse(stdout);
}

async function waitForActive(process){
 let snapshot;
 for(let attempt=0;attempt<50;attempt++){
  snapshot=await inspect();
  if(snapshot.activePID===process.pid&&snapshot.candidate?.pid===process.pid)return snapshot;
  await new Promise(resolve=>setTimeout(resolve,110));
 }
 throw Error(`The test window ${process.pid} did not become frontmost: ${JSON.stringify(snapshot)}`);
}

try{
 if(!process.env.KANSHAN_WINDOW_FIXTURE){
  const sdk=process.env.KANSHAN_MAC_SDK;
  await command('/usr/bin/xcrun',['clang',...(sdk?['-isysroot',sdk]:[]),'-fobjc-arc','-framework','AppKit',
   'tests/fixtures/dressed-window.m','-o',nativeWindowFixture]);
 }
 await writeFile(join(profile,'window-preferences.json'),JSON.stringify({
  version:1,appearance:form,caveStickerReward:true,snow:false,
  ...(form==='fox'&&!automatic&&!baseline?{caveOutfit:outfit}:form==='human'?{humanWeather:outfit}:{}),
  weather:{enabled:false,city:'hong-kong',chase:false},
  wander:{enabled:false,interval:90,distance:75,dwell:4},
 }));
 if(form==='classic')await writeFile(join(profile,'outfit-preference.json'),JSON.stringify({version:1,outfitId:expectedClassicId}));
 app=await electron.launch({executablePath:join(bundle,'Contents/MacOS/Kanshan'),env:{...process.env,KANSHAN_DATA_DIR:profile}});
 const desktop=await app.firstWindow();
 await skipGuide(desktop);
 if(automatic){
  await desktop.locator('.desktop-pet').waitFor();
  await app.evaluate(({net},look)=>{
   const fetch=net.fetch;
   net.fetch=(url,options)=>String(url).startsWith('https://api.open-meteo.com/')?
    Promise.resolve(new Response(JSON.stringify({
     current_units:{apparent_temperature:'°C',temperature_2m:'°C',rain:'mm',showers:'mm',weather_code:'wmo code'},
     current:{time:Math.floor(Date.now()/1000),interval:900,apparent_temperature:look==='heat'?33:20,temperature_2m:look==='heat'?33:20,
      weather_code:look==='rain'?61:0,is_day:1,uv_index:look==='sun'?9:1,rain:look==='rain'?.4:0,showers:0},
    }))):fetch(url,options);
  },outfit);
  assert.equal((await desktop.evaluate(()=>window.kanshan.saveWeather({enabled:true,city:'shanghai',chase:false}))).ok,true);
 }
 const resting=desktop.locator(`.desktop-pet ${costume}`);
 await resting.waitFor();
 if(automaticRain)await resting.locator('[data-rain-hood]').waitFor();
 if(automatic&&outfit==='heat'){
  await desktop.waitForFunction(async()=>(await window.kanshan.weatherStatus()).data?.look.clothing==='hot');
  await resting.locator('image:is([href*="heat-"],[href*="listening-hot-"])').first().waitFor();
 }
 if(automatic&&outfit==='sun')await resting.locator('image[href*="sun-"]').first().waitFor();
 if(proof){
  await desktop.evaluate(()=>window.kanshan.chooseListening('off'));
  await desktop.addStyleTag({content:artOnly});
  await resting.evaluate(async actor=>{
   await Promise.all(actor.getAnimations({subtree:true}).filter(animation=>Number.isFinite(animation.effect.getTiming().iterations))
    .map(animation=>animation.finished.catch(()=>{})));
  });
  await resting.evaluate(async actor=>Promise.all([...actor.querySelectorAll('image')].map(async element=>{
   const image=new Image();
   image.src=element.getAttribute('href');
   await image.decode();
  })));
  await capture(desktop,'stand');
 }
 let companion;
 if(!releaseEarly){
  await app.evaluate(({BrowserWindow,screen},reverse)=>{
   const area=screen.getPrimaryDisplay().workArea;
   const camp=BrowserWindow.fromId(1);
   camp.setPosition(reverse?area.x+area.width-camp.getBounds().width-24:area.x+24,area.y+45);
   const cursor=screen.getCursorScreenPoint.bind(screen);
   screen.getCursorScreenPoint=()=>globalThis.fixturePointer||cursor();
   const timeout=globalThis.setTimeout;
   globalThis.setTimeout=(task,ms,...args)=>timeout(task,ms===15000?720:ms,...args);
  },reverseReturn);
  for(const [pose,distance] of [['walk',.11],['run',.56]]){
   await app.evaluate(({BrowserWindow,screen},distance)=>{
    const camp=BrowserWindow.fromId(1).getBounds();
    const area=screen.getPrimaryDisplay().workArea;
    globalThis.fixturePointer={x:camp.x+151+Math.round(area.width*distance),y:camp.y+75};
   },reverseReturn?-distance:distance);
   const created=companion?Promise.resolve(companion):app.waitForEvent('window');
   assert.equal((await desktop.evaluate(async()=>{
    const started=await window.kanshan.startWindowDrag({surface:'roam',x:151,y:75});
    if(started.data)await window.kanshan.endWindowDrag('roam',true);
    return started;
   })).data,true);
   companion=await created;
   await companion.emulateMedia({reducedMotion:'no-preference'});
   if(proof)await companion.addStyleTag({content:artOnly});
   const atlas=form==='human'&&outfit==='normal'&&pose==='walk';
   const strip=form==='fox';
   const movement=strip?'.fox-motion-strip':atlas?'.human-walk-art':'.costume-limb';
   const scene=strip?`${costume}[data-fox-motion="${pose}"]`:`${costume} [data-rig-pose="${pose}"]`;
   const leg=companion.locator(scene+(atlas?'':' '+movement)).first();
   await leg.waitFor();
   if(form==='fox'&&rain){
    assert.match(await leg.locator('image').first().getAttribute('href'),
     new RegExp(`rain-${pose}-${reverseReturn?'right':'left'}-`));
    assert.equal(await leg.locator('image').first().getAttribute('width'),'1920');
   }
   const from=await leg.evaluate((el,strip)=>strip?getComputedStyle(el).transform:el.outerHTML,strip);
   await companion.waitForFunction(({previous,movement,strip})=>{
    const limb=document.querySelector(movement);
    return limb&&(strip?getComputedStyle(limb).transform:limb.outerHTML)!==previous;
   },{previous:from,movement,strip});
   await capture(companion,pose,3);
   await desktop.locator('.desktop-pet .pet-fox:not(.is-away)').waitFor();
  }
  await app.evaluate(()=>{globalThis.fixturePointer=undefined;});
 }
 const target=await fixture('target');
 const targetSnapshot=await waitForActive(target);
 if(form==='classic'){
  const box=targetSnapshot.candidate;
  const display=await app.evaluate(({screen},rect)=>screen.getDisplayMatching(rect),box);
  const route=windowTargets.windowPlan(box,display,layout.roam.standard,0,'classic');
  assert.ok(route);
  const {artX,artY}=layout.roam.standard;
  await app.evaluate(({BrowserWindow},position)=>BrowserWindow.fromId(1).setPosition(position.x,position.y),{
   x:Math.round(route.approach.x-140+artX),y:Math.round(route.approach.y-4+artY)
  });
  await waitForActive(target);
 }
 const created=companion?Promise.resolve(companion):app.waitForEvent('window',{timeout:12000});
 await app.evaluate(({Menu})=>Menu.getApplicationMenu().items[0].submenu.items
  .find(item=>item.label==='操作菜单').submenu.items.find(item=>item.label==='去窗口边上玩').click());
 const child=await created;
 await child.emulateMedia({reducedMotion:'no-preference'});
 if(proof)await child.addStyleTag({content:artOnly});
 await child.evaluate(({selector,marker})=>{
  globalThis.dressedWindowTrace=[];
  function sample(){
   const actor=document.querySelector(selector);
   const phase=actor?.dataset.windowPose;
   if(!phase)return;
   const href=(actor.querySelector('.fox-motion-frame image,.human-body-motion image')||
    actor.querySelector('.portrait-standing image,.costume-rig-body image'))?.getAttribute('href');
   const data={phase,href,outfit:actor.getAttribute(marker),hood:actor.querySelector('[data-rain-hood]')?.getAttribute('data-rain-hood')};
   const last=dressedWindowTrace.at(-1);
   if(last?.phase!==phase||last.href!==href||last.outfit!==data.outfit)dressedWindowTrace.push(data);
  }
  new MutationObserver(sample).observe(document.body,{subtree:true,childList:true,attributes:true});
  sample();
 },{selector,marker});
 const savePose=name=>capture(child,name,name==='climb'?3:1);
 const pose=name=>child.locator(`${costume}[data-window-pose="${name}"]`);
 async function check(name,asset,capture=false){
  const shape=pose(name);
  const foxAtlas=!selectStandard&&!automaticRain?`${outfit}-${asset}-`:automaticRain&&asset!=='front'?`rain-${asset}-`:null;
  const item=form==='fox'?shape.locator(foxAtlas?`.portrait-standing image[href*="${foxAtlas}"]`:'.portrait-standing image').first():
   shape.locator(`[data-rig-pose="${name}"] .costume-limb`).first();
  await item.waitFor({timeout:18000});
  if(capture)await savePose(name);
 }
 try{await check('climb','climb',true);}
 catch(error){
  console.error('Native route:',await child.evaluate(()=>({trace:dressedWindowTrace,html:document.querySelector('.roam-character')?.outerHTML.slice(0,1600)})),
   'Window:',await inspect(targetSnapshot.candidate.id),'Camp:',await desktop.locator('body').innerText());
  throw error;
 }
 const moving=form==='fox'?'.fox-motion-strip':'.costume-limb';
 const joint=pose('climb').locator(moving).first();
 const css=form==='fox';
 const previous=await joint.evaluate((el,css)=>css?getComputedStyle(el).transform:el.outerHTML,css);
 await child.waitForFunction(({css,previous,moving})=>{
  const node=document.querySelector(moving);
  return node&&(css?getComputedStyle(node).transform:node.outerHTML)!==previous;
 },{css,previous,moving});
 if(!releaseEarly){
  await check('pull','climb');
  await check('perch',form==='fox'&&!automatic&&!baseline?'perch':'front',true);
 }
 if(form!=='fox'&&!releaseEarly){
  const rendered=await pose('perch').locator(form==='human'?'.human-body-motion':'[data-rig-pose="perch"]').count();
  assert.ok(rendered,rig);
 }
 const other=await fixture('other');
 await waitForActive(other);
 const falling=pose('fall');
 await falling.waitFor();
 if(form!=='fox')assert.ok(await falling.locator('[data-rig-pose="fall"] .costume-limb').count());
 if(form==='human')assert.ok(await falling.locator(`[data-limb-view="${releaseEarly?'side':'front'}"]`).count());
 if(form==='human'&&!releaseEarly)assert.equal(await falling.locator('.human-arm').count(),0);
 if(proof){
  // Start watching for the 200 ms landing before awaiting the falling screenshot.
  const landed=pose('land').waitFor({state:'attached',timeout:3000}).then(
   ()=>capture(child,'land'),()=>undefined);
  await Promise.all([capture(child,'fall'),landed]);
 }
 if(form==='fox')await child.waitForFunction(()=>dressedWindowTrace.some(({phase})=>phase==='walk-away'));
 else await child.waitForFunction(selector=>document.querySelector(selector)?.getAttribute('data-window-pose')===null,selector);
 const trace=await child.evaluate(()=>dressedWindowTrace);
 if(proof&&trace.some(entry=>entry.phase==='land')){
  if(!(await access(proofPath('land')).then(()=>true,()=>false))){
   if(form==='fox')await child.waitForFunction(selector=>document.querySelector(selector)?.getAttribute('data-window-pose')===null,selector);
   await capture(child,'land');
  }
 }
 for(const phase of ['climb',...(releaseEarly?[]:['pull','perch']),'balance','fall','land',...(form==='fox'?['shake','walk-away']:[])]){
  assert.ok(trace.some(entry=>entry.phase===phase),phase);
 }
 if(form!=='fox')assert.deepEqual([...new Set(trace.slice(trace.findIndex(({phase})=>phase==='balance')).map(({phase})=>phase))],['balance','fall','land']);
 assert.equal(new Set(trace.filter(entry=>entry.phase==='fall').map(entry=>entry.outfit)).size,1);
 assert.ok(trace.every(entry=>entry.outfit===selected&&entry.href),JSON.stringify(trace));
 if(rain)assert.ok(trace.every(({hood})=>hood),JSON.stringify(trace));
 if(form==='classic'&&outfit==='forest-guide'){
  assert.ok(trace.some(({phase,href})=>phase==='climb'&&href.includes('back-')),JSON.stringify(trace));
  assert.ok(trace.some(({phase,href})=>phase==='land'&&href.includes('front-')),JSON.stringify(trace));
 }
 if(form==='fox'&&!selectStandard)assert.ok(trace.every(({href})=>href.includes(`/${outfit}-`)),JSON.stringify(trace));
 if(form==='human'&&outfit!=='normal'){
  assert.ok(trace.some(({phase,href})=>phase==='climb'&&href.includes(`/${outfit}-side-`)),JSON.stringify(trace));
  assert.ok(trace.every(({href})=>href.includes(`/${outfit}-`)),JSON.stringify(trace));
 }
 console.log(`PASS ${form} ${outfit}：走跑与真实 AppKit 窗口动作保持同一套衣服。`);
}finally{
 for(const window of windows)window.kill();
 await app?.close();
 await rm(profile,{recursive:true,force:true});
}
