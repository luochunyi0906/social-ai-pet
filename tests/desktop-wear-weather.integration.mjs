import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {_electron as electron} from 'playwright';
import {skipGuide} from './skip-guide.mjs';

const json=async file=>JSON.parse(await readFile(new URL(`../desktop/${file}.json`,import.meta.url)));
const cave=await json('cave-wardrobe');
const classic=[await json('outfits/forest-guide')];
const human=await json('human-weather');
const profile=await mkdtemp(join(tmpdir(),'kanshan-wear-weather-'));
const executablePath=resolve(process.env.KANSHAN_PACKAGE_DIR||'release','看山有伴.app/Contents/MacOS/Kanshan');
const proof=process.env.KANSHAN_WARDROBE_PROOF;
let app,page;

const button=name=>page.getByRole('button',{name,exact:true});
const actor=()=>page.locator('.desktop-pet .pet-fox>.fox');
const menu=label=>app.evaluate(({Menu},text)=>Menu.getApplicationMenu().items[0].submenu.items.find(item=>item.label==='操作菜单')
 .submenu.items.find(item=>item.label===text).click(),label);
async function openWardrobe(){
 await menu('回家');
 await button('换装').click();
 await page.getByRole('heading',{name:'衣柜',exact:true}).waitFor();
}
async function checkPortrait(attribute,id,image){
 await actor().waitFor({state:'attached'});
 await page.waitForFunction(([key,value])=>
  document.querySelector('.desktop-pet .pet-fox>.fox')?.getAttribute(key)===value,[attribute,id]);
 const href=await actor().locator('image').first().getAttribute('href');
 assert.match(href,image);
 assert.equal(await page.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();return image.naturalWidth>0;},href),true);
}
async function checkRain(name){
 await actor().locator('[data-rain-hood="front"]').waitFor();
 assert.equal(await actor().getAttribute('data-raincoat'),'true');
 assert.equal(await actor().locator('[data-umbrella], .weather-umbrella').count(),0);
 if(proof)await page.screenshot({path:join(proof,`${name}-戴帽雨衣.png`),omitBackground:true});
}
async function start(appearance,unlocked,savedOptions={}){
 await app?.close();
 const file=join(profile,'window-preferences.json');
 const saved=await readFile(file,'utf8').then(JSON.parse,()=>({version:1,snow:false}));
 await writeFile(file,JSON.stringify({...saved,...savedOptions,appearance,caveStickerReward:unlocked,
  weather:{enabled:false,city:'hong-kong',chase:false},wander:{enabled:false,interval:90,distance:75,dwell:4}}));
 app=await electron.launch({executablePath,env:{...process.env,KANSHAN_DATA_DIR:profile}});
 page=await app.firstWindow();
 await skipGuide(page);
 page.setDefaultTimeout(7000);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.locator('.desktop-pet').waitFor();
}
async function weather(city,feels,code,uv,liquid=0){
 await app.evaluate(({net},sample)=>{
  if(!globalThis.originalWeatherFetch)globalThis.originalWeatherFetch=net.fetch;
  net.fetch=(url,options)=>String(url).startsWith('https://api.open-meteo.com/')?
    Promise.resolve(new Response(JSON.stringify({
     current_units:{apparent_temperature:'°C',temperature_2m:'°C',rain:'mm',showers:'mm',weather_code:'wmo code'},
     current:{time:Math.floor(Date.now()/1000),interval:900,apparent_temperature:sample.feels,
      temperature_2m:sample.feels,weather_code:sample.code,is_day:1,uv_index:sample.uv,rain:sample.liquid,showers:0},
    }))):globalThis.originalWeatherFetch(url,options);
 },{feels,code,uv,liquid});
 assert.equal((await page.evaluate(city=>window.kanshan.saveWeather({enabled:true,city,chase:false}),city)).ok,true);
}

try{
 await start('classic',false);
 const save=(id)=>page.evaluate(id=>window.kanshan.wearOutfit(id),id);
 for(const id of ['not-a-garment','camp-scarf','lilac-cardigan','warm-apron'])assert.equal((await save(id)).ok,false);
 for(const {id,name} of classic){
  await openWardrobe();
  assert.deepEqual(await page.locator('.home-outfit-card strong').allTextContents(),[name]);
  await page.locator('.home-outfit-card').filter({hasText:name}).click();
  const slider=page.getByRole('slider');
  await slider.locator('[data-ready="true"]').waitFor();
  for(const view of [0,45,90,135,180,225,270,315]){
   assert.equal(await slider.getAttribute('aria-valuenow'),String(view));
   await slider.press('ArrowRight');
  }
  if(proof)await page.screenshot({path:join(proof,'森林引路者-衣柜.png')});
  await button('穿上').click();
  await page.waitForFunction(async id=>(await window.kanshan.outfitSettings()).data.outfitId===id,id);
  await button('收回桌面').click();
  await checkPortrait('data-outfit-id',id,/front-[\w-]+\.webp/);
  assert.equal(await actor().getAttribute('data-classic-garment'),id);
 }
 await start('classic',false);
 await checkPortrait('data-outfit-id',classic.at(-1).id,/front-[\w-]+\.webp/);
 await weather('shanghai',22,61,1,.4);
 assert.equal(await actor().locator('[data-rain-hood]').count(),0,'山洞解锁前不开放雨衣');
 await start('classic',true);
 await weather('shanghai',22,61,1,.4);
 await checkPortrait('data-outfit-id','forest-guide',/front-[\w-]+\.webp/);
 await openWardrobe();
 await button('恢复默认装扮').click();
 await button('收回桌面').click();
 await checkRain('原版');

 for(const [city,temperature,clothing] of [['beijing',8,'normal'],['hong-kong',33,'hot']]){
  await weather(city,temperature,2,1);
  await page.waitForFunction(async expected=>{
   const {data}=await window.kanshan.weatherStatus();
   return data?.look.clothing===expected;
  },clothing);
  await page.locator('.pet-weather').getByText(`${temperature}°C`,{exact:true}).waitFor();
  await checkPortrait('data-outfit-id','default',/front-cutout-/);
  assert.equal(await actor().locator('.weather-light').count(),0);
  await menu('回家');
  const portrait=page.locator('.home-companion .fox-classic-model[data-outfit-id="default"]');
  await portrait.waitFor();
  assert.match(await portrait.locator('image').first().getAttribute('href'),/front-cutout-/);
  assert.equal(await portrait.locator('.weather-light').count(),0);
  if(proof)await page.screenshot({path:join(proof,`原版-${clothing}-白色原貌.png`)});
  await button('收回桌面').click();
 }

 await start('fox',true);
 await weather('harbin',8,2,1);
 await page.locator('.pet-weather').getByText('8°C',{exact:true}).waitFor();
 await checkPortrait('data-pet-appearance','fox',/kanshan-fox-/);
 await menu('陪听');
 const listening=page.getByRole('dialog',{name:'一起听一会儿'});
 await listening.waitFor();
 assert.equal((await page.evaluate(()=>window.kanshan.chooseListening('manual'))).ok,true);
 await listening.locator('.listen-portrait image[href*="/listening-"]').first().waitFor();
 await button('结束陪听').click();
 await page.locator('.desktop-pet').waitFor();
 await weather('beijing',11,61,1,.4);
 await checkRain('狐狸Q版');
 for(const [id,name] of Object.entries(cave)){
  await openWardrobe();
  await page.locator('.cave-wardrobe-grid').getByRole('button',{name,exact:true}).click();
  await button('确认穿上').click();
  await page.waitForFunction(async id=>(await window.kanshan.wardrobeStatus()).data.outfit===id,id);
  await button('收回桌面').click();
  await checkPortrait('data-cave-outfit',id,new RegExp('/'+id+'-'));
 }
 await start('fox',true);
 const latest=Object.keys(cave).at(-1);
 await checkPortrait('data-cave-outfit',latest,new RegExp('/'+latest+'-'));
 await weather('beijing',11,61,1,.4);
 await checkPortrait('data-cave-outfit',latest,new RegExp('/'+latest+'-'));
 await openWardrobe();
 await button('恢复默认').click();
 await page.waitForFunction(async ()=>(await window.kanshan.wardrobeStatus()).data.outfit===null);
 await button('收回桌面').click();
 await checkRain('狐狸Q版恢复天气雨衣');

 await start('human',false);
 assert.equal((await page.evaluate(()=>window.kanshan.saveHumanWeather('rain'))).ok,false);
 await start('human',true,{humanWeather:'cold'});
 assert.equal(await page.evaluate(async()=>(await window.kanshan.wardrobeStatus()).data.humanWeather),null);
 assert.equal((await page.evaluate(()=>window.kanshan.saveHumanWeather('cold'))).ok,false);
 await checkPortrait('data-human-weather','normal',/kanshan-human-|listening-human-/);
 for(const [id,name] of Object.entries(human)){
  await openWardrobe();
  assert.deepEqual(await page.locator('.cave-wardrobe-grid strong').allTextContents(),Object.values(human));
  await page.locator('.cave-wardrobe-grid').getByRole('button',{name,exact:true}).click();
  for(const [direction,view] of [['侧面','side'],['背面','back']]){
   await button(direction).click();
   const src=await page.locator('.wardrobe-turntable-figure img').evaluate(async image=>{
    await image.decode();return image.getAttribute('src');
   });
   assert.match(src,new RegExp('/'+id+'-'+view+'-'));
  }
  await button('确认穿上').click();
  await page.waitForFunction(async id=>(await window.kanshan.wardrobeStatus()).data.humanWeather===id,id);
  await button('收回桌面').click();
  await checkPortrait('data-human-weather',id,id==='normal'?/kanshan-human-|listening-human-/:new RegExp('/'+id+'-'));
  if(proof)await page.screenshot({path:join(proof,`人版-${id}.png`),omitBackground:true});
 }
 await start('human',true);
 await checkPortrait('data-human-weather','sun',/sun-/);
 await openWardrobe();
 await button('恢复自动换装').click();
 await page.waitForFunction(async ()=>(await window.kanshan.wardrobeStatus()).data.humanWeather===null);
 await button('收回桌面').click();
 for(const [city,feels,code,uv,id] of [
  ['beijing',7,1,1,'normal'],['shenzhen',31,1,1,'hot'],
  ['shanghai',11,61,1,'rain'],['hong-kong',23,0,9,'sun'],['beijing',20,1,1,'normal']
 ]){
  await weather(city,feels,code,uv,id==='rain'?.4:0);
  await page.locator('.pet-weather').getByText(`${feels}°C`,{exact:true}).waitFor();
  await checkPortrait('data-human-weather',id,id==='normal'?/kanshan-human-|listening-human-/:new RegExp('/'+id+'-'));
  if(id==='rain')await checkRain('人版');
 }
 console.log('PASS 原版仅森林引路者、Q 版 6 套、人版 4 套，低温默认与陪听、冷雨、衣柜锁和旧厚衣存档兼容。');
}finally{
 await app?.close();
 await rm(profile,{recursive:true,force:true});
}
