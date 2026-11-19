import { skipGuide } from './skip-guide.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const core = require('../desktop/core.cjs');
const root = fileURLToPath(new URL('../',import.meta.url));

export async function run() {
  const profile = await mkdtemp(join(tmpdir(), 'kanshan-v08-desktop-'));
  const executablePath = join(root,'release/看山有伴.app/Contents/MacOS/Kanshan');
  const artifacts = join(root,'artifacts');
  await mkdir(artifacts, { recursive: true });
  const old = core.addFavorite(core.emptyStore(), {kind:'generated_question',title:'旧版收藏验收',keywords:'旧版收藏',simulated:true});
  const original = JSON.stringify(old);
  await writeFile(join(profile, 'garden-v1.json'), original);
  await writeFile(join(profile, 'model.env'), 'SEARCH_PROVIDER=bing-rss\n');
  const checks = [];
  const mark = (scene, detail) => { checks.push({ scene, detail }); console.log('PASS',scene); };
  let app, page;
  const state = async () => JSON.parse(await readFile(join(profile, 'garden-v3.json'), 'utf8'));
  const windowState = () => app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return { bounds: win.getBounds(), resizable: win.isResizable(), floating: win.isAlwaysOnTop(), background: win.getBackgroundColor() };
  });
  async function launch() {
    app = await electron.launch({executablePath, env:{...process.env,KANSHAN_DATA_DIR:profile,MODEL_API_KEY:'',ZHIHU_ACCESS_SECRET:''}, timeout:20000});
    page = await app.firstWindow();
    await skipGuide(page);
    page.setDefaultTimeout(7500);
    await page.locator('.desktop-pet').waitFor();
    await page.waitForFunction(async () => (await window.kanshan.load()).ok);
  }
  const button = (name) => page.getByRole('button', {name,exact:true});
  const fromDesktop = () => button('和刘看山互动，可双击打开营地').dblclick();
  const closeSheet = (label) => button('关闭'+label).click();
  const clickPlot = (slot) => page.locator('.camp-plot').filter({has:page.locator('text',{hasText:slot})}).locator('.camp-soil').click();
  const assertVisible = (selector, value) => page.locator(selector).filter({hasText:value}).first().waitFor();
  async function hit(selector, owner=selector) {
    const box = await page.locator(selector).boundingBox();
    assert.ok(box,selector);
    assert.equal(await page.evaluate(({box,owner}) => !!document.elementFromPoint(box.x+box.width/2,box.y+box.height/2)?.closest(owner),{box,owner}),true,selector);
  }
  try {
    await launch();
    const pet = await windowState();
    assert.equal(pet.floating,true);
    assert.equal(pet.resizable,false);
    assert.equal(await page.locator('.pet-piece').count(),4);
    assert.equal(await page.locator('.camp-shell').count(),0);
    const transparentAlpha = await app.evaluate(async ({BrowserWindow}) => {
      const bitmap = (await BrowserWindow.getAllWindows()[0].capturePage()).toBitmap();
      return bitmap[3];
    });
    assert.equal(transparentAlpha,0,'Electron native capture should have a transparent corner');
    const clear = await page.evaluate(() => !!document.elementFromPoint(5,5)?.closest('[data-hit]'));
    assert.equal(clear,false);
    await page.screenshot({path:join(artifacts,'native-desktop-pet.png'),omitBackground:true});
    mark('正式 macOS 应用默认使用透明、置顶、520 × 330 的小窗',pet);
    await fromDesktop();
    await page.locator('.camp-shell').waitFor();
    const opened = await windowState();
    assert.equal(opened.resizable,true);
    assert.equal(opened.floating,false);
    assert.equal(await page.locator('.camp-plot').count(),9);
    assert.equal(await page.evaluate(() => location.protocol),'file:');
    const art = await page.evaluate(async () => {
      const selectors = ['.camp-terrain','.camp-cave i'];
      return Promise.all(selectors.map(async selector => {
        const style = getComputedStyle(document.querySelector(selector)).backgroundImage;
        const image = new Image();
        image.src = style.slice(5,-2);
        await image.decode();
        return [image.naturalWidth,image.naturalHeight];
      }));
    });
    assert.deepEqual(art,[[1382,1138],[1536,1024]]);
    mark('点击桌宠角色打开可缩放的原生营地，加载分层背景与道具', {opened,art});
    for (const [width,height] of [[900,740],[720,620],[600,620]]) {
      await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setSize(...size),[width,height]);
      await page.waitForFunction(([width,height])=>innerWidth===width&&innerHeight===height,[width,height]);
      for (const name of ['cave','mail','seed','water','fertilizer','journal','fox']) await hit('.camp-'+name);
      for (let i=0;i<9;i++) {
        const shape=page.locator('.camp-soil').nth(i);
        const box=await shape.boundingBox();
        assert.equal(await page.evaluate(({x,y})=>Boolean(document.elementFromPoint(x,y)?.closest('.camp-plot')),
          {x:box.x+box.width/2,y:box.y+box.height/2}),true);
      }
      await page.screenshot({path:join(artifacts,`native-camp-${width}x${height}.png`)});
      mark(`${width} × ${height} 下主要道具和九块田可点击`);
    }

    await button('投喂线索').click();
    assert.equal(await button('开始本地模拟').isEnabled(),false);
    await button('机器人信任样例').click();
    await page.locator('.consent input').check();
    await button('开始本地模拟').click();
    await page.locator('.question-card').first().waitFor();
    assert.equal(await page.locator('.question-card').count(),3);
    await app.evaluate(() => {
      globalThis.fetch = async () => new Response('<rss><channel><item><title>机器人与信任（验收夹具）</title><link>https://www.zhihu.com/question/123456</link></item></channel></rss>');
    });
    await button('主动检索知乎').click();
    await page.getByRole('textbox',{name:'本次关键词'}).fill('机器人 信任');
    await page.locator('.search-modal .consent input').check();
    await page.locator('.search-modal').getByRole('button',{name:'查找真实知乎内容',exact:true}).click();
    await assertVisible('.post-card','搜索索引结果');
    await button('收藏这条来源').click();
    await page.waitForFunction(async () => (await window.kanshan.load()).data?.favorites.length===2);
    await button('收藏这条来源').click();
    await page.waitForTimeout(160);
    assert.equal((await state()).favorites.length,2);
    mark('投喂逐次授权、知乎索引校验、收藏去重与种子共用正式数据层', '网络检索响应为夹具');
    await closeSheet('山洞探索桌');

    await button('种子箱 · 1').click();
    await page.locator('.camp-sheet .seed-list button').click();
    await clickPlot('A1');
    // 旧版迁移的开花植物占用 A1，保留原槽位。
    await assertVisible('.camp-sheet','A1 · 已开花');
    await clickPlot('A2');
    await assertVisible('.camp-sheet','A2 · 播种预览');
    assert.equal((await state()).plants.length,1);
    await button('取消预览').click();
    assert.equal((await state()).plants.length,1);
    await button('种子箱 · 1').click();
    await page.locator('.camp-sheet .seed-list button').click();
    await assertVisible('.camp-sheet','A2 · 播种预览');
    await button('确认播种').click();
    await assertVisible('.camp-sheet','A2 · 已播种');
    await button('拿起水壶').click();
    await clickPlot('A2');
    await assertVisible('.camp-sheet','水已经浇进土里了');
    await clickPlot('C3');
    await assertVisible('.camp-sheet','这块田还没有种子');
    await button('拿起肥料').click();
    await clickPlot('A2');
    await assertVisible('.camp-sheet','养分已经补上了');
    assert.equal((await state()).plants.find(plant=>plant.slot===1).stage,'sprout');
    await button('收藏手账').click();
    await button('回到这块田 · A2').click();
    await assertVisible('.camp-sheet','A2 · 幼苗');
    await page.screenshot({path:join(artifacts,'native-camp-after-care.png')});
    mark('选种、取消、确认、选择工具点田、空田反馈及手账返回');
    await button('和刘看山互动，可双击打开聊天').dblclick();
    await assertVisible('.chat-modal','尚未配置');
    await page.keyboard.press('Escape');
    await page.locator('.desktop-pet').waitFor();
    await page.waitForFunction(()=>innerWidth===520&&innerHeight===330);
    const restored=await windowState();
    assert.deepEqual(restored.bounds,pet.bounds);
    assert.equal(restored.floating,true);
    assert.equal(restored.resizable,false);
    mark('收起、恢复原桌面位置及置顶',restored);
    await fromDesktop();
    await page.waitForFunction(()=>innerWidth===600&&innerHeight===620);
    await button('收回桌面').click();
    await page.locator('.desktop-pet').waitFor();
    await app.close();
    await launch();
    const reloaded=await state();
    assert.equal(reloaded.favorites.length,2);
    assert.equal(reloaded.favorites[0].id,old.favorites[0].id);
    assert.equal(reloaded.plants.find(plant=>plant.slot===0).stage,'flower');
    assert.equal(reloaded.plants.find(plant=>plant.slot===1).stage,'sprout');
    assert.ok(reloaded.plants.find(plant=>plant.slot===1).wateredAt);
    assert.ok(reloaded.plants.find(plant=>plant.slot===1).fertilizedAt);
    assert.equal(await readFile(join(profile,'garden-v1.json'),'utf8'),original);
    mark('重启保留旧收藏与新植物，原 v1 文件逐字节一致');
    await writeFile(join(artifacts,'desktop-v08-results.json'),JSON.stringify({checks, limitations:['检索为固定夹具，模型未配置','指针自动化验证窗口内命中，系统级穿透另行核查']},null,2)+'\n');
    return checks;
  } finally {
    await app?.close().catch(()=>{});
    await rm(profile,{recursive:true,force:true});
  }
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) await run();
