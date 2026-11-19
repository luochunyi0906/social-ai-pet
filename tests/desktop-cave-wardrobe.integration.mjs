import { skipGuide } from './skip-guide.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const executablePath = resolve(root, process.env.KANSHAN_PACKAGE_DIR || 'release',
 '看山有伴.app/Contents/MacOS/Kanshan');
const outfits = JSON.parse(await readFile(new URL('../desktop/cave-wardrobe.json', import.meta.url)));
const profile = await mkdtemp(join(tmpdir(), 'kanshan-cave-wardrobe-'));
let app, page;
const button = name => page.getByRole('button', { name, exact: true });
const status = () => page.evaluate(async () => (await window.kanshan.wardrobeStatus()).data);

async function start() {
 app = await electron.launch({ executablePath, env: { ...process.env, KANSHAN_DATA_DIR: profile } });
 page = await app.firstWindow();
 await skipGuide(page);
 await page.emulateMedia({ reducedMotion: 'reduce' });
 await page.locator('.desktop-pet').waitFor();
}

async function openWardrobe() {
 await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].submenu.items
  .find(item => item.label === '操作菜单').submenu.items.find(item => item.label === '回家').click());
 await button('换装').click();
 await page.getByRole('heading', { name: '衣柜' }).waitFor();
}

async function verifyViews(slider) {
 const images = new Set();
 const image = slider.locator('img');
 for (const [index, name] of ['正面', '侧面', '背面', '另一侧'].entries()) {
  await button(name).click();
  assert.equal(await slider.getAttribute('aria-valuenow'), String(index * 90));
  images.add(await image.evaluate(async node => {
   await node.decode();
   return node.currentSrc;
  }));
 }
 assert.equal(images.size, 3);
 assert.equal(await image.evaluate(node => getComputedStyle(node).transform), 'matrix(-1, 0, 0, 1, 0, 0)');
}

try {
 await writeFile(join(profile, 'window-preferences.json'), JSON.stringify({
  version: 1, appearance: 'fox', snow: false, wander: { enabled: false, interval: 90, distance: 75, dwell: 4 },
 }));
 await start();
 await openWardrobe();
 assert.equal(await page.getByRole('region', { name: '山洞解锁服装' }).count(), 0);
 assert.equal((await page.evaluate(() => window.kanshan.saveCaveOutfit('han'))).ok, false);
 await button('收回桌面').click();
 const entrance = page.locator('.pet-cave .pet-caption');
 await entrance.click();
 await page.getByRole('button',{name:'山洞入口',exact:true}).click();
 await page.waitForFunction(() => document.querySelector('.cave-reveal video')?.currentTime > 3);
 await button('离开').click();
 await page.locator('.cave-gift-notice').waitFor();
 await openWardrobe();
 assert.equal(await page.getByText('衣柜里，好像多了一些新东西。', { exact: true }).count(), 0);

 const wardrobe = page.getByRole('region', { name: '山洞解锁服装' });
 const slider = wardrobe.getByRole('slider');
 const cards = wardrobe.locator('.cave-wardrobe-grid');
 assert.equal(await cards.getByRole('button').count(), Object.keys(outfits).length);
 await verifyViews(slider);
 for (const name of Object.values(outfits)) {
  await cards.getByRole('button', { name, exact: true }).click();
  assert.equal(await slider.getAttribute('aria-valuenow'), '0');
  await verifyViews(slider);
 }
 assert.equal((await status()).outfit, null);
 await button('关闭预览').click();
 await button('换装').click();
 await wardrobe.getByRole('heading', { name: '默认蓝白外观' }).waitFor();
 await cards.getByRole('button', { name: outfits.tang, exact: true }).click();

 for (const [width, height] of [[900, 740], [600, 560]]) {
  await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.fromId(1).setSize(...size), [width, height]);
  await page.waitForFunction(([w,h]) => innerWidth === w && innerHeight === h, [width, height]);
  await slider.press('Home');
  await slider.press('ArrowLeft');
  assert.equal(await slider.getAttribute('aria-valuenow'), '270');
  await slider.press('ArrowRight');
  assert.equal(await slider.getAttribute('aria-valuenow'), '0');
  const box = await slider.boundingBox();
  assert.ok(box && box.width > 160 && box.height > 125);
  const x = box.x + box.width * .12;
  const y = box.y + box.height / 2;
  await slider.hover({ position: { x: box.width * .12, y: box.height / 2 } });
  await page.mouse.down();
  await page.mouse.move(x + box.width * .45, y, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelector('.cave-wardrobe [role="slider"]')
   ?.getAttribute('aria-valuenow') === '180');
  await page.mouse.move(x, y, { steps: 4 });
  assert.equal(await slider.getAttribute('aria-valuenow'), '180');
  const confirm = await button('确认穿上').boundingBox();
  assert.ok(confirm && confirm.y + confirm.height <= height);
  if (process.env.KANSHAN_WARDROBE_PROOF) {
   await page.screenshot({ path: join(process.env.KANSHAN_WARDROBE_PROOF, `cave-wardrobe-${width}.png`), scale: 'css' });
  }
 }

 await button('确认穿上').click();
 await page.locator('.home-companion [data-cave-outfit="tang"]').waitFor();
 assert.equal((await status()).outfit, 'tang');
 await app.close();
 app = undefined;
 await start();
 await page.locator('.desktop-pet [data-cave-outfit="tang"]').waitFor();
 await openWardrobe();
 await page.getByRole('heading', { name: outfits.tang }).waitFor();
 assert.equal(await button('确认穿上').isDisabled(), true);
 await button('恢复默认').click();
 await page.getByRole('heading', { name: '默认蓝白外观' }).waitFor();
 assert.equal((await status()).outfit, null);
 console.log('通过：真实彩蛋解锁、13 组静态旋转视角、大小窗口拖动、试穿取消与重启保存。');
} finally {
 await app?.close();
 await rm(profile, { recursive: true, force: true });
}
