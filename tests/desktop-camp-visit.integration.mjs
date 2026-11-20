import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron } from 'playwright';
import { skipGuide } from './skip-guide.mjs';

const profile = await mkdtemp(join(tmpdir(), 'kanshan-camp-visit-'));
const executablePath = resolve(process.env.KANSHAN_PACKAGE_DIR || 'release', '看山有伴.app/Contents/MacOS/Kanshan');
const previews = process.env.KANSHAN_VISIT_PREVIEWS;
const legacyLayout = {
  cave: { x: 160, y: -107 }, bench: { x: 300, y: 210 }, 'bench-label': { x: 51, y: 14 },
  farm: { x: -54, y: 25 }, cabin: { x: -8, y: 2 }, 'stone-19.6': { x: 81, y: -35 },
};
const seedTitle = '为什么不同地方的豆腐脑口味差这么多？';
const unrelatedSeed = '另一颗已经收藏的园艺种子';
let app;

async function launch() {
  app = await electron.launch({ executablePath, env: { ...process.env, KANSHAN_DATA_DIR: profile } });
  const page = await app.firstWindow();
  page.setDefaultTimeout(8000);
  await skipGuide(page);
  await page.evaluate(layout => localStorage.setItem('kanshan:camp-layout:v1', JSON.stringify(layout)), legacyLayout);
  await page.locator('.pet-garden .pet-hit path').click();
  return page;
}

try {
  await writeFile(join(profile, 'window-preferences.json'), JSON.stringify({
    version: 1, appearance: 'fox', caveStickerReward: true, caveOutfit: 'miao', wardrobeHintSeen: true, snow: false,
    weather: { enabled: false, city: '香港', chase: false },
    wander: { enabled: false, interval: 90, distance: 75, dwell: 4 },
  }));
  let page = await launch();
  const saved = await page.evaluate(title => window.kanshan.save({
    kind: 'generated_question', title, keywords: '园艺种子', simulated: true,
  }), unrelatedSeed);
  assert.equal(saved.ok, true);
  const button = name => page.getByRole('button', { name, exact: true });
  const speech = speaker => page.locator(`.visit-speech[data-speaker="${speaker}"]`);
  const relation = text => page.locator('.visit-response').getByText(text, { exact: true });
  const offer = () => page.locator('#camp-visit-offer');
  const mailbox = () => button('打开信箱，查看访客的菜');
  const mail = () => page.getByRole('region', { name: '访客带来的菜' });
  const notes = () => page.getByRole('region', { name: '这株的串门纸条' });
  const gardenData = () => page.evaluate(async () => (await window.kanshan.load()).data);
  const snapshot = async file => {
    if (!previews) return;
    await mkdir(previews, { recursive: true });
    await page.screenshot({ path: join(previews, file), animations: 'disabled' });
  };

  await page.getByText('阿岚的看山来啦', { exact: true }).waitFor();
  await relation('拌嘴 · 好感 0').waitFor();
  await page.locator('.camp-fox [data-pet-appearance="fox"][data-cave-outfit="miao"]').waitFor();
  await page.locator('.visit-friend-art [data-pet-appearance="fox"][data-cave-outfit="tang"]').waitFor();
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await offer().count(), 0);
  assert.equal(await page.locator('.camp-cave').count(), 0);
  const bench = () => button('坐一会儿');
  const seatedMap = () => page.locator('.camp-map[data-bench-seated="true"]');
  const seating = await bench().evaluate(element => {
    const art = element.querySelector('img');
    return { asset: art.currentSrc, transform: getComputedStyle(art).transform, offset: getComputedStyle(element).translate };
  });
  assert.match(seating.asset, /bench-facing-cabin/);
  assert.equal(seating.transform, 'none');
  assert.equal(seating.offset, '160px -107px');
  assert.equal(await page.locator('.camp-farm > g').getAttribute('transform'), 'translate(408 470) scale(1.38) translate(-496 -462)');
  assert.equal(await page.locator('.camp-cabin').evaluate(el => getComputedStyle(el).translate), '-8px 2px');
  assert.equal(await page.locator('[data-layout-item="stone-19.6"]').evaluate(el => getComputedStyle(el).translate), '81px -35px');
  const [host, guest] = await Promise.all([page.locator('.camp-meeting-host').boundingBox(), page.locator('.camp-visit-guest').boundingBox()]);
  assert.ok(host.x < guest.x && guest.x - host.x < host.width + 10);
  assert.ok(Math.abs(host.y + host.height - guest.y - guest.height) < 1);
  await speech('guest').filter({ hasText: '豆腐脑淋糖水' }).waitFor();
  assert.equal(await speech('host').count(), 0);
  await speech('host').filter({ hasText: '我就想要一勺热卤' }).waitFor();
  assert.equal(await speech('guest').count(), 0);
  const [bubble, guide] = await Promise.all([speech('host').boundingBox(), page.locator('.feature-guide-floating').boundingBox()]);
  assert.ok(bubble.y >= guide.y + guide.height || bubble.x >= guide.x + guide.width);
  await page.mouse.move(430, 100);
  await snapshot('tofu-debate.png');

  await bench().getByText('坐一会儿').click();
  await seatedMap().waitFor();
  assert.equal(await bench().getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.chat-modal').count(), 0);
  const seatedHost = seatedMap().locator('.camp-meeting-host img.camp-seated-host-art');
  const seatedGuest = seatedMap().locator('.camp-visit-guest img.camp-seated-guest-art');
  await seatedHost.waitFor();
  await seatedGuest.waitFor();
  assert.equal(await seatedHost.getAttribute('data-cave-outfit'), 'miao');
  assert.equal(await seatedGuest.getAttribute('data-cave-outfit'), 'tang');
  await Promise.all([seatedHost, seatedGuest].map(sprite => sprite.evaluate(image => image.decode())));
  await speech('guest').filter({ hasText: '我拿半碗跟你换' }).waitFor();
  const seatedReply = speech('host').filter({ hasText: '我给你留一勺卤' });
  await seatedReply.waitFor();
  const [hostOnBench, guestOnBench, benchArt, seatedBubble] = await Promise.all([
    seatedHost.boundingBox(), seatedGuest.boundingBox(), bench().locator('img').boundingBox(), seatedReply.boundingBox(),
  ]);
  for (const actor of [hostOnBench, guestOnBench]) {
    const center = actor.x + actor.width / 2;
    const bottom = actor.y + actor.height;
    assert.ok(center >= benchArt.x && center <= benchArt.x + benchArt.width);
    assert.ok(bottom >= benchArt.y && bottom <= benchArt.y + benchArt.height);
  }
  assert.notEqual(hostOnBench.x, guestOnBench.x);
  assert.ok(seatedBubble.x + seatedBubble.width < guestOnBench.x + guestOnBench.width / 2);
  assert.equal(await page.locator('.chat-modal').count(), 0);
  await snapshot('tofu-debate-seated.png');
  await bench().getByText('坐一会儿').click({ trial: true });
  await bench().press('Space');
  await seatedMap().waitFor({ state: 'detached' });
  assert.equal(await bench().getAttribute('aria-pressed'), 'false');
  console.log('PASS 长椅让两只看山一起落座并继续轮流冒泡，键盘可起身，不打开聊天');

  await relation('拌嘴 · 好感 0').click();
  await button('各尝一点').click();
  await speech('host').filter({ hasText: '两种各来半碗' }).waitFor();
  await relation('拌嘴 · 好感 0').waitFor();
  await relation('拌嘴 · 好感 0').click();

  const initialGarden = await gardenData();
  const item = await button('生菜 · 散步小吃').boundingBox();
  const target = await button('戳戳阿岚的看山').boundingBox();
  await page.mouse.move(item.x + item.width / 2, item.y + item.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await page.mouse.move(target.x + target.width / 2 + 2, target.y + target.height / 2);
  await page.locator('.camp-visit-guest.is-over').waitFor();
  await page.mouse.up();
  await relation('拌嘴 · 好感 1').waitFor();
  await button('南瓜 · 街头音乐').press('Enter');
  await button('把菜送给阿岚的看山').press('Enter');
  await relation('拌嘴 · 好感 1').waitFor();

  await button('看看访客带来的菜').click();
  await offer().getByText('知乎主题 · 豆腐脑吃甜还是吃咸', { exact: true }).waitFor();
  await button('收下').click();
  await mailbox().getByText('新菜').waitFor();
  assert.match(await mailbox().locator('img').getAttribute('src'), /mail-with-clues/);
  assert.deepEqual(await gardenData(), initialGarden);
  await mailbox().click();
  await mail().getByText(seedTitle, { exact: false }).waitFor();
  await button('留种').click();
  await button('选择一块田').waitFor();
  const kept = await gardenData();
  assert.equal(kept.favorites.filter(item => item.title === seedTitle).length, 1);
  assert.equal(kept.favorites.find(item => item.title === seedTitle).slot, null);
  assert.equal(kept.plants.length, 0);
  await snapshot('keep-seed.png');

  await button('选择一块田').click();
  await button('A1 · 空田').press('Enter');
  await page.getByRole('heading', { name: 'A1 · 播种预览' }).waitFor();
  await page.getByText(`将「${seedTitle}」种在这里。确认后才会使用种子。`, { exact: true }).waitFor();
  await page.getByRole('combobox', { name: '选择要播的植物' }).selectOption('carrot');
  assert.equal((await gardenData()).plants.length, 0);
  await button('确认播种').click();
  await notes().getByText('拌嘴 · 阿岚的看山', { exact: true }).waitFor();
  const planted = await gardenData();
  assert.equal(planted.plants[0].favoriteId, kept.favorites.find(item => item.title === seedTitle).id);
  assert.equal(planted.plants[0].variety, 'carrot');
  assert.equal(planted.favorites.find(item => item.title === unrelatedSeed).slot, null);
  await button('关闭A1 · 已播种').click();

  await button('串门').click();
  await relation('讨论 · 好感 2').waitFor();
  await speech('guest').filter({ hasText: '上回甜咸还没争完' }).waitFor();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.fromId(1).setSize(600, 540));
  await page.waitForFunction(() => innerWidth === 600 && innerHeight === 540);
  await button('看看访客带来的菜').click();
  const bounds = await offer().boundingBox();
  assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 600);
  await button('收下').click();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.fromId(1).setSize(900, 740));
  await page.waitForFunction(() => innerWidth === 900 && innerHeight === 740);
  await mailbox().click();
  assert.equal(await button('留种').count(), 0);
  await button('查看这株').click();
  await notes().getByText('讨论 · 阿岚的看山', { exact: true }).waitFor();
  assert.equal(await notes().locator('article').count(), 2);
  assert.equal(await page.locator('.camp-plot[aria-label="A1 · 已播种"] .camp-visit-note-mark text').textContent(), '2');
  const afterReturn = await gardenData();
  assert.equal(afterReturn.favorites.length, 2);
  assert.equal(afterReturn.plants.length, 1);
  await snapshot('follow-up-notes.png');
  await app.evaluate(({ shell }) => { shell.openExternal = async url => { globalThis.visitSource = url; }; });
  await notes().getByRole('button', { name: '甜咸豆腐脑之争，你站哪边？ ↗', exact: true }).click();
  assert.equal(await app.evaluate(() => globalThis.visitSource), 'https://www.zhihu.com/answer/3224467451');
  await button('关闭A1 · 已播种').click();

  await button('串门').click();
  await page.getByText('小禾的看山来啦', { exact: true }).waitFor();
  await relation('讨论 · 好感 0').waitFor();
  // 小禾 normally wears miao; the host already wears it in this fixture.
  await page.locator('.visit-friend-art [data-pet-appearance="fox"][data-cave-outfit="ming"]').waitFor();
  await speech('guest').filter({ hasText: '北极狐那么小' }).waitFor();
  await button('看看访客带来的菜').click();
  await button('这次不用').click();
  await page.locator('.camp-visit-guest.is-leaving .visit-tear').waitFor({ state: 'attached' });
  await page.locator('.camp-visit-guest').waitFor({ state: 'detached' });
  await mailbox().click();
  await button('继续投喂或搜索').click();
  await page.locator('.feed-modal').waitFor();
  await app.close();
  app = undefined;

  page = await launch();
  await relation('拌嘴 · 好感 3').waitFor();
  await button('A1 · 已播种').press('Enter');
  await notes().getByText('讨论 · 阿岚的看山', { exact: true }).waitFor();
  assert.equal(await notes().locator('article').count(), 2);
  assert.equal((await gardenData()).plants.length, 1);
  await button('关闭A1 · 已播种').click();
  await button('调整布局').click();
  const art = await bench().locator('img').boundingBox();
  await page.mouse.move(art.x + art.width / 2, art.y + art.height / 2);
  await page.mouse.down();
  await page.mouse.move(art.x + art.width / 2 + 15, art.y + art.height / 2 + 8, { steps: 6 });
  await page.mouse.up();
  await button('固定位置').click();
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('kanshan:camp-layout:v2'))), {
    farm: legacyLayout.farm, cabin: legacyLayout.cabin, 'stone-19.6': legacyLayout['stone-19.6'], bench: { x: 175, y: -99 },
  });
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('kanshan:camp-layout:v1'))), legacyLayout);
  console.log('PASS 狐狸版访客服装避让、拌嘴及接话、分别记录好感、收菜与留种分步骤、确认播种、同题回访纸条和重启恢复');
} finally {
  try { await app?.close(); }
  finally { await rm(profile, { recursive: true, force: true }); }
}
