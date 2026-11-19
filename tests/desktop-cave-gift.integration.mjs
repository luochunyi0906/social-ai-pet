import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright';

const root=fileURLToPath(new URL('../',import.meta.url));
const profile=await mkdtemp(join(tmpdir(),'kanshan-cave-gift-'));
let app,page;
const button=name=>page.getByRole('button',{name,exact:true});
const video=()=>page.locator('.cave-reveal video');
const picker=()=>page.locator('.chat-sticker-picker');
const status=()=>page.evaluate(()=>window.kanshan.caveStickerStatus());

async function start(){
 app=await electron.launch({
  executablePath:resolve(root,process.env.KANSHAN_PACKAGE_DIR||'release','看山有伴.app/Contents/MacOS/Kanshan'),
  env:{...process.env,KANSHAN_DATA_DIR:profile},timeout:20000
 });
 page=await app.firstWindow();
 page.setDefaultTimeout(8000);
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.locator('.desktop-pet').waitFor();
}
async function visit(){
 await app.evaluate(({app,BrowserWindow})=>{
  app.focus({steal:true});
  BrowserWindow.fromId(1).show();
 });
 const cave=page.locator('.pet-cave .pet-caption');
 await cave.click();
 assert.equal(await video().count(),0);
 await cave.click();
 await video().waitFor();
}
async function showPicker(){
 await page.locator('.pet-fox .fox-nose').click();
 await button('和刘看山聊聊').click();
 await button('刘看山的表情').click();
 await picker().waitFor();
}

try{
 await start();
 assert.deepEqual(await status(),{ok:true,data:false});
 const guarded=await page.evaluate(async ()=>{
  const {data:state}=await window.kanshan.chatState();
  return {
   claim:await window.kanshan.claimCaveSticker(crypto.randomUUID()),
   send:await window.kanshan.sendSticker({sessionId:state.activeId,messageId:crypto.randomUUID(),stickerId:'cave_idea'})
  };
 });
 assert.equal(guarded.claim.ok,false);
 assert.equal(guarded.send.ok,false);
 assert.match(guarded.send.error,/山洞赠礼/);
 await showPicker();
 assert.equal(await picker().locator('.chat-sticker-grid button').count(),14);
 assert.equal(await button('山洞赠礼').count(),0);
 await page.keyboard.press('Escape');
 await page.locator('.desktop-pet').waitFor();

 await visit();
 await button('离开').click();
 await video().waitFor({state:'detached'});
 assert.deepEqual(await status(),{ok:true,data:false});
 await page.keyboard.press('Escape');
 await visit();
 await page.waitForFunction(()=>document.querySelector('.cave-reveal video')?.currentTime>3);
 assert.deepEqual(await status(),{ok:true,data:true});
 await button('离开').click();
 const notice=page.locator('.cave-gift-notice');
 await notice.waitFor();
 assert.match(await notice.textContent(),/刘看山送了你 9 张 Q 版动图/);
 await page.keyboard.press('Escape');

 await app.close();
 app=undefined;
 await start();
 assert.deepEqual(await status(),{ok:true,data:true});
 await showPicker();
 await button('山洞赠礼').click();
 assert.equal(await picker().locator('.chat-sticker-grid button').count(),9);
 await picker().getByRole('button',{name:'有主意了',exact:true}).click();
 await button('发送表情').click();
 const sent=page.locator('.chat-lines [data-sticker-id="cave_idea"]');
 await sent.waitFor();
 await sent.getByRole('button',{name:'重播有主意了表情'}).click();
 await sent.and(page.locator('[data-sticker-frame]')).waitFor();
 assert.deepEqual(await status(),{ok:true,data:true});
 console.log('PASS 解锁前拒发、提前退出未领取、看到人物后赠礼、重启可发送并播放新表情');
}finally{
 await app?.close();
 await rm(profile,{recursive:true,force:true});
}
