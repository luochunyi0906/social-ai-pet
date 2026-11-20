import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {_electron as electron} from 'playwright';
import {skipGuide} from './skip-guide.mjs';
import layout from '../desktop/pet-layout.json' with {type:'json'};
import wardrobe from '../desktop/cave-wardrobe.json' with {type:'json'};

const executablePath=resolve(process.env.KANSHAN_PACKAGE_DIR||'release','看山有伴.app/Contents/MacOS/Kanshan');
const proof=process.env.KANSHAN_FOX_PROOF;
const {fox,foxLift}=layout.roam;
const variants=process.argv.slice(2);
const cases=variants.length?variants:['default',...Object.keys(wardrobe),'rain','heat','sun','reduced'];
const sameBounds=(actual,expected)=>assert.deepEqual(actual,expected);
const box=({width,height})=>({width,height});

for(const outfit of cases){
 const profile=await mkdtemp(join(tmpdir(),'kanshan-fox-lift-'));
 let app;
 try{
  await writeFile(join(profile,'window-preferences.json'),JSON.stringify({
   version:1,appearance:'fox',snow:false,caveStickerReward:true,
   caveOutfit:Object.hasOwn(wardrobe,outfit)?outfit:null,
   weather:{enabled:false,city:'hong-kong',chase:false},
   wander:{enabled:false,interval:90,distance:75,dwell:4}
  }));
  app=await electron.launch({executablePath,env:{...process.env,KANSHAN_DATA_DIR:profile}});
  const desktop=await app.firstWindow();
  await skipGuide(desktop);
  await desktop.evaluate(()=>window.kanshan.chooseListening('off'));
  const resting=desktop.locator('.desktop-pet [data-pet-appearance="fox"]');
  await resting.waitFor();
  if(['rain','heat','sun'].includes(outfit)){
   await app.evaluate(({net},look)=>{
    const fetch=net.fetch;
    net.fetch=(url,options)=>String(url).startsWith('https://api.open-meteo.com/')?
     Promise.resolve(new Response(JSON.stringify({
      current_units:{apparent_temperature:'°C',temperature_2m:'°C',rain:'mm',showers:'mm',weather_code:'wmo code'},
      current:{time:Math.floor(Date.now()/1000),interval:900,apparent_temperature:look==='heat'?33:20,
       temperature_2m:look==='heat'?33:20,weather_code:look==='rain'?61:0,is_day:1,uv_index:look==='sun'?9:1,rain:look==='rain'?.4:0,showers:0},
     }))):fetch(url,options);
   },outfit);
   assert.equal((await desktop.evaluate(()=>window.kanshan.saveWeather({enabled:true,city:'shanghai',chase:false}))).ok,true);
   await resting.locator(`image[href*="${outfit}-"]`).first().waitFor();
  }
  const camp=await app.evaluate(({BrowserWindow,screen})=>{
   const area=screen.getPrimaryDisplay().workArea;
   const win=BrowserWindow.fromId(1);
   win.setPosition(area.x+50,area.y+65);
   return win.getBounds();
  });
  const press={x:151,y:80};
  const useMouse=outfit==='default';
  const pointer={x:camp.x+press.x+150,y:camp.y+press.y+120};
  await app.evaluate(({screen},point)=>{
   globalThis.fixturePointer=point;
   screen.getCursorScreenPoint=()=>globalThis.fixturePointer;
  },useMouse?{x:camp.x+press.x,y:camp.y+press.y}:pointer);
  const newWindow=app.waitForEvent('window');
  if(useMouse){
   await desktop.mouse.move(press.x,press.y);
   await desktop.waitForTimeout(95);
   await desktop.mouse.down();
   await desktop.mouse.move(press.x+20,press.y);
   await app.evaluate((_,point)=>{globalThis.fixturePointer=point;},pointer);
  }else{
   assert.equal((await desktop.evaluate(point=>window.kanshan.startWindowDrag({surface:'roam',...point}),press)).data,true);
  }
  const rover=await newWindow;
  await rover.emulateMedia({reducedMotion:outfit==='reduced'?'reduce':'no-preference'});
  const actor=rover.locator('[data-pet-appearance="fox"]');
  const lifting=actor.and(rover.locator('[data-gesture="lift"]'));
  await lifting.waitFor();
  const held=await lifting.getAttribute('data-grip-pose')==='face-down';
  const expected=foxLift.scale*(held||outfit==='reduced'?1:.89);
  const poseScale=async scale=>rover.waitForFunction(target=>{
   const body=document.querySelector('.portrait-drag-body');
   return body&&Math.abs(Number(getComputedStyle(body).scale.replace('none','1'))-target)<.0001;
  },scale);
  await poseScale(expected);
  await rover.waitForFunction(x=>document.querySelector('.roam-character')?.style.left===x+'px',foxLift.artX);
  const bounds=()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()
   .find(win=>win.webContents.getURL().includes('companion=1')).getBounds());
  const initial=await bounds();
  sameBounds(box(initial),box(foxLift));
  assert.equal(initial.x+foxLift.artX, pointer.x-press.x+layout.places.fox.x);
  assert.equal(initial.y+foxLift.artY, pointer.y-press.y+layout.places.fox.y);
  if(held&&Object.hasOwn(wardrobe,outfit)){
   assert.match(await lifting.locator('.portrait-held image').getAttribute('href'),new RegExp(`/${outfit}-held-`));
  }
  if(proof){
   await rover.addStyleTag({content:'.pet-contact,.pet-cheek-hint{display:none}'});
   await rover.screenshot({path:join(proof,`${outfit}-lift.png`),omitBackground:true});
  }
  if(useMouse)await desktop.mouse.up();
  else assert.equal((await desktop.evaluate(()=>window.kanshan.endWindowDrag('roam',true))).data,true);
  await poseScale(1);
  await rover.waitForFunction(x=>document.querySelector('.roam-character')?.style.left===x+'px',fox.artX);
  const settled=await bounds();
  sameBounds(box(settled),box(fox));
  assert.equal(settled.x+fox.artX,initial.x+foxLift.artX);
  assert.equal(settled.y+fox.artY,initial.y+foxLift.artY);
  sameBounds(await app.evaluate(({BrowserWindow})=>BrowserWindow.fromId(1).getBounds()),camp);
  console.log(`PASS ${outfit} · ${expected} 变换 · 恢复原比例与窗口大小`);
 }finally{
  await app?.close();
  await rm(profile,{recursive:true,force:true});
 }
}
