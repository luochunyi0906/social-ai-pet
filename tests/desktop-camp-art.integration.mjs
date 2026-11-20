import { skipGuide } from './skip-guide.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import farm from '../desktop/garden.cjs';
import { DESKTOP_SIZE } from '../src/shared/layout.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const profile = await mkdtemp(join(tmpdir(), 'kanshan-camp-art-test-'));
const output = process.env.KANSHAN_CAMP_ARTIFACTS || tmpdir();
const time = new Date().toISOString();
const stage = farm.stageFor;
let seedGarden = farm.empty();
const assets = ['sunflower', 'tulip', 'bluebell', 'lavender', 'strawberry', 'lettuce', 'carrot', 'daisy', 'pumpkin'];
let next = 0;
function fixtureId(index) {
  while (true) {
    const id = 'camp-preview-' + next++;
    let hash = 2166136261;
    for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    if ((hash >>> 0) % 7 === index) return id;
  }
}

for (let slot = 0; slot < 9; slot++) {
  const title = slot === 8 ? '营地验收待播种种子' : '营地验收收藏 ' + (slot + 1);
  seedGarden = farm.add(seedGarden, { kind: 'generated_question', title, keywords: title, simulated: true });
  const favorite = seedGarden.favorites.at(-1);
  if (slot === 8) continue;
  favorite.id = fixtureId(0);
  favorite.slot = slot;
  const growth = slot === 7 ? 25 : 100;
  const watered = [0, 1, 7].includes(slot);
  seedGarden.plants.push({ id: 'plant:' + favorite.id, favoriteId: favorite.id, slot, stage: stage(growth), growth,
    water: watered ? 78 : 33, nutrients: 52, plantedAt: time, updatedAt: time,
    wateredAt: watered ? time : null, fertilizedAt: null, legacy: false });
}

let app;
try {
  await mkdir(output, { recursive: true });
  const savePath = join(profile, 'garden-v3.json');
  const oldSave = { ...seedGarden, plants: seedGarden.plants.map(({ variety, ...plant }) => plant) };
  await writeFile(savePath, JSON.stringify(farm.validate(oldSave)), { mode: 0o600 });
  app = await electron.launch({
    executablePath: resolve(root, process.env.KANSHAN_PACKAGE_DIR || 'release', '看山有伴.app/Contents/MacOS/Kanshan'),
    env: { ...process.env, KANSHAN_DATA_DIR: profile },
    timeout: 20000,
  });
  const page = await app.firstWindow();
  await skipGuide(page);
  page.setDefaultTimeout(8000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const button = name => page.getByRole('button', { name, exact: true });
  const take = (name, clip) => page.screenshot({ path: join(output, name + '.png'), scale: 'css', ...(clip && { clip }) });
  const plot = name => page.locator('.camp-plot').filter({ has: page.locator('text', { hasText: name }) });
  const resize = async (width, height) => {
    await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.fromId(1).setSize(...size), [width, height]);
    await page.waitForFunction(([w, h]) => innerWidth === w && innerHeight === h, [width, height]);
  };
  const save = async () => JSON.parse(await readFile(savePath, 'utf8'));

  await page.locator('.pet-fox .fox-costume-hit').dblclick();
  await button('种子箱 · 1').waitFor();
  await resize(900, 740);
  if ((await button('营地飘雪').getAttribute('aria-pressed')) === 'true') await button('营地飘雪').click();
  await page.locator('.camp-snow').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.camp-plot.active').count(), 0);

  for (const [width, height] of [[900, 740], [900, 659], [600, 540]]) {
    await resize(width, height);
    const report = await page.evaluate(async () => {
      const items = Array.from(document.querySelectorAll('.camp-prop-art img, .camp-fox, .camp-topbar button, .camp-tools button, .camp-soil'));
      await Promise.all(items.filter(element => element instanceof HTMLImageElement).map(element => element.decode()));
      return items.map(element => {
        const { x, y, width, height } = element.getBoundingClientRect();
        const hit = document.elementFromPoint(x + width / 2, y + height / 2);
        const owner = element.closest('button,[role=button]');
        return { owner: owner?.getAttribute('aria-label') || owner?.textContent,
          view: x >= 0 && y >= 0 && x + width <= innerWidth && y + height <= innerHeight && width > 0 && height > 0,
          hit: hit?.closest('button,[role=button]') === owner };
      });
    });
    assert.ok(report.every(item => item.view && item.hit), JSON.stringify({ width, height, misses: report.filter(item => !item.view || !item.hit) }));
    if (width===900) await take('kanshan-camp-' + width + 'x' + height);
    console.log('PASS', width + '×' + height, '场景内控件和九块田全部可见、命中正确');
  }
  await resize(900, 740);
  const assetNames = await page.locator('.camp-plot .farm-plant image').evaluateAll(images =>
    images.map(image => image.getAttribute('href').split('/').at(-1).split('-')[0]));
  assert.equal(new Set(assetNames).size, 8);
  assert.equal(assetNames[0], 'sunflower');
  assert.equal(assetNames.at(-1), 'sprout');
  assert.deepEqual((await save()).favorites, seedGarden.favorites);
  const varieties = page.locator('.camp-plot [data-plant-variety]');
  const originalVarieties = await varieties.evaluateAll(elements => elements.map(element => element.dataset.plantVariety));
  assert.equal(new Set(originalVarieties).size, 8);

  const bench = button('坐一会儿');
  const fox = button('和刘看山互动，可双击打开聊天');
  const [a, b] = await Promise.all([bench.boundingBox(), fox.boundingBox()]);
  assert.ok(a && b);
  await take('kanshan-camp-bench', { x: Math.max(0, a.x - 14), y: Math.min(a.y, b.y) - 18,
    width: Math.max(a.x + a.width, b.x + b.width) + 8 - Math.max(0, a.x - 14),
    height: Math.max(a.y + a.height, b.y + b.height) - Math.min(a.y, b.y) + 34 });
  await bench.getByText('坐一会儿').click();
  const seatedMap = page.locator('.camp-map[data-bench-seated="true"]');
  await seatedMap.waitFor();
  assert.equal(await page.locator('.chat-modal').count(), 0);
  await bench.press('Space');
  await seatedMap.waitFor({ state: 'detached' });
  await fox.dblclick();
  await page.locator('.chat-modal').waitFor();
  await button('关闭对话').click();

  await button('拿起水壶').click();
  const soil = page.locator('.camp-soil-art').nth(4);
  const dry = await soil.evaluate(element => getComputedStyle(element).filter);
  assert.doesNotMatch(dry, /brightness/);
  await plot('B2').locator('.camp-soil').click();
  await plot('B2').locator('.camp-plot-effect.water').waitFor();
  assert.equal(await plot('B2').getAttribute('aria-pressed'), 'true');
  assert.match(await plot('B2').getAttribute('class'), /moist/);
  assert.match(await soil.evaluate(element => getComputedStyle(element).filter), /brightness\(0\.78\)/);
  assert.ok((await save()).plants.find(item => item.slot === 4).water >= 99);
  await page.waitForTimeout(235);
  await take('kanshan-camp-watered');
  await button('关闭B2 · 已开花').click();

  await button('种子箱 · 1').click();
  const picker = page.getByRole('combobox', { name: '选择要播的植物' });
  assert.deepEqual(await picker.locator('option').evaluateAll(options => options.map(option => option.value)), assets);
  await picker.selectOption('lavender');
  assert.equal((await save()).plants.length, 8);
  assert.equal(await page.locator('.camp-plant-sticker').count(),0);
  await button('播种薰衣草').click();
  await plot('C3').locator('.plant-planted').waitFor();
  assert.equal(await page.locator('.camp-plant-sticker [data-sticker-id="scarf_celebrate"]').count(),1);
  assert.equal(await page.locator('.chat-modal').count(),0);
  assert.equal((await save()).plants.length, 9);
  assert.equal((await save()).plants.find(plant => plant.slot === 8).variety, 'lavender');
  assert.deepEqual(new Set(await varieties.evaluateAll(elements => elements.map(element => element.dataset.plantVariety))),new Set(assets));
  const finalSave = await save();
  assert.deepEqual(finalSave.plants.slice(0,8).map(plant => plant.variety),originalVarieties);
  assert.deepEqual(farm.from(finalSave).plants.map(plant => plant.variety),finalSave.plants.map(plant => plant.variety));
  await button('种子箱 · 0').waitFor();
  await take('kanshan-camp-planted');

  await button('收藏手账').click();
  await button('回到这块田 · C3').click();
  await page.getByRole('region', { name: 'C3 · 已播种', exact: true }).waitFor();
  await button('拿起水壶').click();
  await plot('C3').locator('.camp-soil').click();
  await plot('C3').locator('.camp-plot-effect.water').waitFor();
  assert.equal(await page.locator('.camp-plant-sticker').count(),0);
  await button('拿起肥料').click();
  await plot('C3').locator('.camp-soil').click();
  const seedling = plot('C3').locator('.plant-sprout image');
  assert.notEqual(await seedling.getAttribute('href'),await plot('C2').locator('.plant-sprout image').getAttribute('href'));
  await plot('C2').locator('.camp-soil').click();
  await plot('C2').locator('.camp-plot-effect.fertilize').waitFor();
  await app.evaluate(() => {
    const later = Date.now() + 8 * 60 * 1000;
    Date.now = () => later;
  });
  await page.waitForFunction(() => document.querySelectorAll('.camp-plot .plant-flower image').length === 9);
  const matureAssets = await page.locator('.camp-plot .plant-flower image').evaluateAll(async elements => {
    const sources = elements.map(element => element.getAttribute('href'));
    await Promise.all(sources.map(source => {
      const image = new Image();
      image.src = source;
      return image.decode();
    }));
    return sources.map(source => source.split('/').at(-1).split('-')[0]);
  });
  assert.deepEqual(new Set(matureAssets),new Set(assets));
  await button('关闭C2 · 已开花').click();
  await take('kanshan-camp-nine-crops');
  await button('拿起采种手套').click();
  await plot('C3').locator('.camp-soil').click();
  await button('植物图册 · 1/9').click();
  const album = page.getByRole('region', { name: '植物图册' });
  await album.locator('.plant-album-card.is-lit').getByText('薰衣草', { exact: true }).waitFor();
  assert.equal((await save()).favorites.find(favorite => favorite.title === '营地验收待播种种子').slot, null);
  await button('收回桌面').click();
  await page.locator('.desktop-pet').waitFor();
  await page.waitForFunction(({width,height}) => innerWidth === width && innerHeight === height, DESKTOP_SIZE);
  console.log('PASS 长椅与角色入口、稳定植物外观、实际浇水和播种反馈、存档关联与收起');
} finally {
  await app?.close();
  await rm(profile, { recursive: true, force: true });
}
