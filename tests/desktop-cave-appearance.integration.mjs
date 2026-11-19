import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const profile=await mkdtemp(join(tmpdir(),'kanshan-cave-'));
const preferences=join(profile,'window-preferences.json');
await writeFile(preferences,JSON.stringify({version:1,snow:false,pet:null,panel:null,chatStickers:false}));

let app,page;
const button=name=>page.getByRole('button',{name,exact:true});
const companion=()=>page.locator('.desktop-pet .fox');
const player=()=>page.locator('.cave-reveal video');
const picker=()=>page.getByRole('group',{name:'刘看山的外貌'});
const cave=()=>page.locator('.pet-cave .pet-caption');
const portraitScale=svg=>svg.evaluate(node=>Math.abs(node.querySelector('image').getScreenCTM().a/node.getScreenCTM().a));
const foxFits=svg=>svg.evaluate(node=>{
 const matrix=node.querySelector('image').getScreenCTM();
 const corners=[new DOMPoint(30,44),new DOMPoint(210,272)];
 return corners.map(corner=>corner.matrixTransform(matrix)).every(point=>
  point.x>=0&&point.y>=0&&point.x<=innerWidth&&point.y<=innerHeight);
});

async function start(){
 app=await electron.launch({
  executablePath:resolve(root,process.env.KANSHAN_PACKAGE_DIR||'release','看山有伴.app/Contents/MacOS/Kanshan'),
  env:{...process.env,KANSHAN_DATA_DIR:profile},timeout:20000
 });
 page=await app.firstWindow();
 page.setDefaultTimeout(8000);
 await companion().waitFor();
}

async function playing(){
 await player().waitFor();
 await page.waitForFunction(()=>document.querySelector('.cave-reveal video')?.currentTime>.2);
 const info=await player().evaluate(video=>({duration:video.duration,width:video.videoWidth,height:video.videoHeight,muted:video.muted}));
 assert.ok(info.duration>14&&info.duration<14.2);
 assert.equal(info.width/info.height,16/9);
 assert.equal(info.muted,false);
}

async function select(name,id){
 await picker().locator('label').filter({hasText:name}).click();
 await page.locator('.camp-fox .fox[data-pet-appearance="'+id+'"]').waitFor();
 assert.equal(await picker().getByRole('radio',{name,exact:true}).isChecked(),true);
}

try{
 await start();
 assert.equal(await companion().getAttribute('data-pet-appearance'),null);
 await cave().click();
 assert.equal(await cave().isVisible(),true);
 assert.equal(await player().count(),0);
 await cave().click();
 await playing();
 await page.keyboard.press('Escape');
 await player().waitFor({state:'detached'});
 await picker().waitFor();
 await select('人版','human');
 await page.keyboard.press('Escape');
 await companion().and(page.locator('[data-pet-appearance="human"]')).waitFor();
 assert.ok(Math.abs(await portraitScale(companion())-1)<1e-6);
 await app.close();
 app=undefined;

 await start();
 await companion().and(page.locator('[data-pet-appearance="human"]')).waitFor();
 await page.locator('.pet-fox .fox-costume-hit').click();
 await button('好奇心山洞').click();
 await picker().waitFor();
 assert.equal(await player().count(),0);
 await select('狐狸版','fox');
 await button('山洞入口').click();
 await playing();
 await player().evaluate(video=>{video.currentTime=video.duration-.2;});
 await player().waitFor({state:'detached'});
 await button('山洞入口').click();
 assert.equal(await player().count(),0);
 await page.keyboard.press('Escape');
 await companion().and(page.locator('[data-pet-appearance="fox"]')).waitFor();
 await app.close();
 app=undefined;

 await start();
 await companion().and(page.locator('[data-pet-appearance="fox"]')).waitFor();
 assert.ok(Math.abs(await portraitScale(companion())-1.5)<1e-6);
 assert.equal(await foxFits(companion()),true);
 const labelLayout=await page.evaluate(()=>{
  const box=selector=>document.querySelector(selector).getBoundingClientRect();
  const actor=box('.pet-fox .fox-costume-hit');
  const cave=box('.pet-cave .pet-caption');
  const garden=box('.pet-garden .pet-caption');
  const feed=box('.pet-feed .pet-caption');
  const centerX=rect=>rect.left+rect.width/2;
  return {
   caveClear:actor.left-cave.right>=12&&centerX(cave)<centerX(box('.pet-cave .pet-art')),
   gardenClear:garden.left-actor.right>=12&&centerX(garden)>centerX(box('.pet-garden .pet-art')),
   feedClear:feed.left-actor.right>=10&&feed.top-box('.pet-feed .pet-art').bottom>=8,
   labelsClickable:[cave,garden,feed].every(rect=>
    document.elementFromPoint(centerX(rect),rect.top+rect.height/2)?.classList.contains('pet-caption'))
  };
 });
 assert.deepEqual(labelLayout,{caveClear:true,gardenClear:true,feedClear:true,labelsClickable:true});
 if(process.env.KANSHAN_COMPACT_SCREENSHOT)await page.screenshot({path:process.env.KANSHAN_COMPACT_SCREENSHOT,omitBackground:true});
 await cave().click({trial:true});
 await page.locator('.pet-garden .pet-caption').click({trial:true});
 const dragPoint=await page.locator('.pet-fox .fox-costume-hit').evaluate(path=>{
  const point=new DOMPoint(118,220).matrixTransform(path.getScreenCTM());
  return {x:point.x,y:point.y};
 });
 await page.mouse.move(dragPoint.x,dragPoint.y);
 await page.mouse.down();
 await page.mouse.move(dragPoint.x+24,dragPoint.y,{steps:3});
 const rover=app.windows().find(window=>window!==page)??await app.waitForEvent('window',{timeout:5000});
 await page.mouse.up();
 assert.ok(rover);
 const roamingFox=rover.locator('.roam-character [data-pet-appearance="fox"]');
 await roamingFox.waitFor();
 assert.ok(Math.abs(await portraitScale(roamingFox)-1.5)<1e-6);
 assert.equal(await foxFits(roamingFox),true);
 assert.deepEqual(await rover.evaluate(()=>[innerWidth,innerHeight]),[108,145]);
 const saved=JSON.parse(await readFile(preferences,'utf8'));
 assert.equal(saved.appearance,'fox');
 assert.equal(saved.snow,false);
 assert.equal(saved.chatStickers,false);
 console.log('PASS 两次点击播放、外貌重启恢复、人版 1 倍、狐狸版 1.5 倍及拖动显示');
}finally{
 await app?.close();
 await rm(profile,{recursive:true,force:true});
}
