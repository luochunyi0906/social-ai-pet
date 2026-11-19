import { skipGuide } from './skip-guide.mjs';
import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEFAULT_PLACES} from '../src/shared/layout.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const profile=await mkdtemp(join(tmpdir(),'kanshan-stroll-native-'));
let app;
try{
 await writeFile(join(profile,'window-preferences.json'),JSON.stringify({
  version:1,snow:false,wander:{enabled:true,scope:'desktop',interval:30,distance:75,dwell:3}
 }));
 app=await electron.launch({executablePath:resolve(root,process.env.KANSHAN_PACKAGE_DIR||'release','看山有伴.app/Contents/MacOS/Kanshan'),
  env:{...process.env,KANSHAN_DATA_DIR:profile},timeout:20000});
 const page=await app.firstWindow();
 await skipGuide(page);
 const menu=label=>app.evaluate(({Menu},label)=>{
  Menu.getApplicationMenu().items[0].submenu.items.find(item=>item.label==='操作菜单')
   .submenu.items.find(item=>item.label===label).click();
 },label);
 const work=await app.evaluate(({BrowserWindow,screen})=>{
  const area=screen.getPrimaryDisplay().workArea;
  const window=BrowserWindow.fromId(1);
  window.setPosition(area.x+area.width-window.getBounds().width,area.y+55);
  return area;
 });
 const overlay=app.waitForEvent('window',{timeout:35000});
 const button=name=>page.getByRole('button',{name,exact:true});
 const child=await overlay;
 await child.emulateMedia({reducedMotion:'no-preference'});
 const bounds=()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('companion=1')).getBounds());
 const campBounds=()=>app.evaluate(({BrowserWindow})=>BrowserWindow.fromId(1).getBounds());
 const camp=await campBounds();
 const home={x:camp.x+DEFAULT_PLACES.fox.x,y:camp.y+DEFAULT_PLACES.fox.y};
 const movement=await page.evaluate(()=>window.kanshan.movementSettings());
 assert.equal(movement.data.scope,'desktop');
 const initial=await bounds();
 const walking=child.locator('[data-animation="act_walk"]');
 const leg=walking.locator('[data-rig-pose="walk"] .classic-connected').first();
 await leg.waitFor();
 const firstPhase=await leg.evaluate(node=>node.innerHTML);
 await child.waitForFunction(before=>{
  const current=document.querySelector('[data-rig-pose="walk"] .classic-connected');
  return current&&current.innerHTML!==before;
 },firstPhase);
 const moving=await bounds();
 assert.notDeepEqual(initial,moving);
 assert.ok(moving.x>=work.x&&moving.y>=work.y&&moving.x+moving.width<=work.x+work.width&&moving.y+moving.height<=work.y+work.height);
 const deadline=Date.now()+7500;
 let location=await bounds();
 while(Math.hypot(location.x-home.x,location.y-home.y)<=200&&Date.now()<deadline){
  await child.waitForTimeout(75);
  location=await bounds();
 }
 assert.ok(Math.hypot(location.x-home.x,location.y-home.y)>200,JSON.stringify({home,initial,location}));
 assert.deepEqual(await campBounds(),camp);
 await menu('和刘看山聊聊');
 const draft=page.getByRole('textbox',{name:'对刘看山说的话'});
 await draft.fill('先在输入框写一句，再停下来读。');
 const reading=await bounds();
 await page.waitForTimeout(15700);
 assert.deepEqual(await bounds(),reading);
 await button('关闭对话').click();
 await menu('低打扰开关');
 await child.locator('[data-animation-pose="sit_hold"]').waitFor();
 await button('收回桌面').click();
 const focused=await bounds();
 await page.waitForTimeout(15500);
 assert.deepEqual(await bounds(),focused);
 await menu('回家');
 await button('休息／睡眠').click();
 await button('收回桌面').click();
 await child.locator('[data-rendering="legacy-blanket"]').waitFor();
 const asleep=await bounds();
 await page.waitForTimeout(15500);
 assert.deepEqual(await bounds(),asleep);
 console.log('通过：角色独立透明窗口散步超过 200 点，营地未移动。原始走路 GIF 正常播放，聊天、专注和睡眠时位置稳定。');
}finally{
 await app?.close();await rm(profile,{recursive:true,force:true});
}
