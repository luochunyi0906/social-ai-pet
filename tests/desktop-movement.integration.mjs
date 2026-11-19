import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {DEFAULT_PLACES} from '../src/shared/layout.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const profile=await mkdtemp(join(tmpdir(),'kanshan-movement-native-'));
const executablePath=resolve(root,process.env.KANSHAN_PACKAGE_DIR||'release','看山有伴.app/Contents/MacOS/Kanshan');
let app;
try {
 app=await electron.launch({executablePath,env:{...process.env,KANSHAN_DATA_DIR:profile},timeout:20000});
 const page=await app.firstWindow();
 await page.emulateMedia({reducedMotion:'no-preference'});
 const actor=page.locator('.pet-fox');
 const work=await app.evaluate(({BrowserWindow,screen})=>{
  const work=screen.getPrimaryDisplay().workArea;
  BrowserWindow.fromId(1).setPosition(work.x+42,work.y+100);
  return work;
 });
 const bounds=()=>app.evaluate(({BrowserWindow})=>{
  const camp=BrowserWindow.fromId(1).getBounds();
  const pet=BrowserWindow.getAllWindows().find(win=>win.webContents.getURL().includes('companion=1'));
  return {camp,pet:pet?.getBounds(),visible:pet?.isVisible()};
 });
 const origin=DEFAULT_PLACES.fox;
 const home=({x,y})=>({x:x+origin.x,y:y+origin.y,width:92,height:135});
 const begin=await bounds();
 await actor.locator('.fox-animation-hit').waitFor();
 assert.deepEqual(await page.evaluate(()=>{
  const label=document.querySelector('.pet-garden .pet-caption').getBoundingClientRect();
  const points=[[5,5],[168,162],[label.x+label.width/2,label.y+label.height/2]];
  return points.map(([x,y])=>document.elementFromPoint(x,y)?.closest('[data-hit]')?.classList.contains('pet-ground-drag')??null);
 }),[null,true,false]);

 await app.evaluate(({screen})=>{
  globalThis.movementCursor=screen.getCursorScreenPoint();
  screen.getCursorScreenPoint=()=>globalThis.movementCursor;
 });
 const cursor=position=>app.evaluate((_,point)=>{globalThis.movementCursor=point;},position);
 async function drag(view,from,point,target) {
  await cursor({x:from.x+point.x,y:from.y+point.y});
  await view.mouse.move(point.x,point.y);
  await view.waitForTimeout(90);
  await view.mouse.down();
  await view.mouse.move(point.x+20,point.y);
  await cursor({x:target.x+point.x,y:target.y+point.y});
  await view.waitForTimeout(160);
  await view.mouse.up();
  const released=Date.now();
  await view.waitForTimeout(90);
  return released;
 }
 async function playing(child,clip,facing) {
  const sprite=child.locator(`[data-animation="${clip}"][data-animation-facing="${facing}"]`);
  await sprite.waitFor({timeout:18500});
  const previous=await sprite.getAttribute('data-animation-frame');
  await child.waitForFunction(({clip,previous})=>{
   const image=document.querySelector(`[data-animation="${clip}"]`);
   return image&&image.dataset.animationFrame!==previous;
  },{clip,previous},{timeout:2500});
 }

 const detached=app.waitForEvent('window',{timeout:7000});
 const nextCamp={x:begin.camp.x+130,y:begin.camp.y+40};
 const released=await drag(page,begin.camp,{x:171,y:153},nextCamp);
 const child=await detached;
 await child.emulateMedia({reducedMotion:'no-preference'});
 await actor.locator('..').locator('.pet-fox.is-away').waitFor({state:'attached'});
 const shifted=await bounds();
 assert.deepEqual(shifted.camp,{...begin.camp,...nextCamp});
 assert.deepEqual(shifted.pet,home(begin.camp));
 assert.equal(shifted.visible,true);
 console.log('PASS 雪地拖动只移动营地，成年刘看山保留原桌面坐标');

 await page.waitForTimeout(13000);
 assert.deepEqual(await bounds(),shifted);
 await playing(child,'act_walk','right');
 assert.ok(Date.now()-released<18500,'须在松手约 15 秒时开始归位');
 await actor.locator('.fox-animation-hit').waitFor({timeout:5000});
 assert.equal((await bounds()).visible,false);
 console.log('PASS 无互动时等待约 15 秒，近距离面向营地逐帧走回');

 const hit=await actor.locator('.fox-animation-hit').boundingBox();
 assert.ok(hit);
 const far={x:work.x+work.width-115,y:work.y+work.height-150};
 const campPoint={x:Math.round(hit.x+hit.width/2),y:Math.round(hit.y+hit.height/2)};
 await drag(page,shifted.camp,campPoint,{x:far.x-origin.x,y:far.y-origin.y});
 const away=await bounds();
 assert.deepEqual(away.camp,shifted.camp);
 assert.deepEqual(away.pet,{...far,width:92,height:135});
 assert.ok(Math.hypot(away.pet.x-home(away.camp).x,away.pet.y-home(away.camp).y)>work.width/2);
 assert.equal(await page.locator('.camp-shell').count(),0);
 const grip=await page.locator('.pet-camp-grip').boundingBox();
 assert.ok(grip);
 const secondCamp={x:shifted.camp.x+45,y:shifted.camp.y+20};
 await drag(page,shifted.camp,{x:Math.round(grip.x+grip.width/2),y:Math.round(grip.y+grip.height/2)},secondCamp);
 const reanchored=await bounds();
 assert.deepEqual(reanchored.camp,{...shifted.camp,...secondCamp});
 assert.deepEqual(reanchored.pet,away.pet);
 console.log('PASS 角色与营地手柄可分别拖动，松手未误展开');

 await playing(child,'act_run','left');
 await actor.locator('.fox-animation-hit').waitFor({timeout:7000});
 const returned=await bounds();
 assert.deepEqual(returned.camp,reanchored.camp);
 assert.equal(returned.visible,false);
 const cave=page.locator('.pet-cave .pet-caption');
 await cave.click();
 assert.equal(await page.locator('.camp-shell').count(),0);
 await cave.click();
 await page.locator('.camp-shell').waitFor();
 await page.getByRole('dialog',{name:'山洞换装间'}).waitFor();
 console.log('PASS 远距离面向营地逐帧跑回，归位采用新营地坐标，山洞仍可点击');
} finally {
 await app?.close();
 await rm(profile,{recursive:true,force:true});
}
