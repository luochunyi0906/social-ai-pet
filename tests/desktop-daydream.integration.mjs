import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const profile=await mkdtemp(join(tmpdir(),'kanshan-daydream-'));
await writeFile(join(profile,'window-preferences.json'),JSON.stringify({version:1,appearance:'fox',snow:false}));
await writeFile(join(profile,'companion-chat-v1.json'),JSON.stringify({version:1,prefs:{enabled:false,frequency:'low'}}));
let app;
try{
 app=await electron.launch({
  executablePath:resolve(root,process.env.KANSHAN_PACKAGE_DIR||'release','看山有伴.app/Contents/MacOS/Kanshan'),
  env:{...process.env,KANSHAN_DATA_DIR:profile},timeout:20000
 });
 const page=await app.firstWindow();
 await page.emulateMedia({reducedMotion:'no-preference'});
 const fox=page.locator('.desktop-pet [data-pet-appearance="fox"]');
 const daydream=fox.and(page.locator('[data-daydream]'));
 const lowerLid=fox.locator('.fox-lid-left .fox-lid-line');
 const shape=()=>lowerLid.evaluate(lid=>getComputedStyle(lid).d);
 const artwork=()=>fox.locator('image').getAttribute('href');
 const tap=()=>page.dispatchEvent('.desktop-pet','pointerdown',{pointerType:'mouse',isPrimary:true});
 const screenshot=process.env.KANSHAN_DAYDREAM_ARTIFACTS;
 await fox.waitFor();
 await page.clock.install();
 await tap();
 await page.clock.runFor(25);
 const before=await shape();
 const image=await artwork();
 if(screenshot)await page.screenshot({path:join(screenshot,'eyes-open.png'),omitBackground:true});
 await page.clock.fastForward(115000);
 assert.equal(await daydream.count(),0);
 await page.clock.runFor(5200);
 await daydream.waitFor();
 await page.waitForTimeout(350);
 const halfway=await shape();
 if(screenshot)await page.screenshot({path:join(screenshot,'eyes-transition.png'),omitBackground:true});
 await page.waitForTimeout(1100);
 const after=await shape();
 assert.notEqual(before,halfway);
 assert.notEqual(halfway,after);
 assert.equal(await artwork(),image);
 if(screenshot)await page.screenshot({path:join(screenshot,'eyes-daydream.png'),omitBackground:true});

 await fox.locator('.fox-costume-hit').hover();
 await page.mouse.move(5,5);
 await daydream.waitFor({state:'detached'});
 await page.waitForTimeout(650);
 assert.equal(await shape(),before);
 await page.clock.fastForward(105000);
 await tap();
 await page.clock.runFor(20000);
 assert.equal(await daydream.count(),0);
 console.log('PASS 久未互动触发、眼皮逐帧过渡、二次互动睁眼并重置计时');
}finally{
 await app?.close();
 await rm(profile,{recursive:true,force:true});
}
