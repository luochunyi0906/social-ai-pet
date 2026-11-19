import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron } from 'playwright';

const executablePath = resolve(process.env.KANSHAN_PACKAGE_DIR || 'release', '看山有伴.app/Contents/MacOS/Kanshan');
const profile = await mkdtemp(join(tmpdir(), 'kanshan-guide-'));
let app;

async function launch() {
  app = await electron.launch({ executablePath, env: { ...process.env, KANSHAN_DATA_DIR: profile } });
  const page = await app.firstWindow();
  page.setDefaultTimeout(8000);
  return page;
}

async function checkPictures(page, selector, count) {
  const pictures = page.locator(selector);
  assert.equal(await pictures.count(), count);
  await page.waitForFunction(
    selector => [...document.querySelectorAll(selector)].every(image => image.complete && image.naturalWidth > 0),
    selector
  );
}

try {
  let page = await launch();
  const firstTitle = () => page.getByRole('heading', { name: '认识你的桌宠' });
  const pet = () => page.locator('.desktop-pet');
  const button = name => page.getByRole('button', { name, exact: true });
  await firstTitle().waitFor();
  const geometry = await page.evaluate(() => ({
    viewport: innerWidth,
    dialog: document.querySelector('.first-run-guide').getBoundingClientRect().width
  }));
  assert.ok(geometry.viewport >= 600 && geometry.dialog > 500, JSON.stringify(geometry));
  await checkPictures(page, '.desktop-guide-cards img', 3);
  assert.match(await page.locator('.desktop-guide-cards picture img').getAttribute('src'), /\.gif$/);
  await button('进入营地探索').click();

  const campGuide = page.locator('.feature-guide-floating[open]');
  await campGuide.getByText('营地怎么玩').waitFor();
  await checkPictures(page, '.feature-guide-floating li img', 4);
  await campGuide.locator('summary').click();
  await button('投喂线索').click();
  await page.locator('.feed-modal .feature-guide[open]').getByText('信箱怎么用').waitFor();
  await checkPictures(page, '.feed-modal .feature-guide li img', 2);
  await button('直接搜知乎').click();
  await page.locator('.search-modal .feature-guide[open]').getByText('怎么搜知乎').waitFor();
  await checkPictures(page, '.search-modal .feature-guide li img', 1);
  await page.getByLabel('本次关键词').fill('花园种子');
  await button('打开模型与检索设置').click();
  const editor = () => page.getByRole('form', { name: '模型与 API 配置' });
  await editor().waitFor();
  try {
    await editor().getByRole('combobox', { name: /投喂模型/ }).selectOption('openai-compatible');
  } catch (error) {
    throw new Error(await editor().ariaSnapshot(), {cause:error});
  }
  await editor().getByRole('combobox', { name: /文字聊天/ }).selectOption('existing');
  await editor().getByLabel('API 地址', { exact: true }).fill('http://fixture.example/v1');
  await editor().getByLabel('模型 ID', { exact: true }).fill('fixture-model');
  await editor().getByLabel('API 密钥', { exact: true }).fill('fixture-api-key');
  await editor().getByLabel('知乎 Access Secret').fill('fixture-zhihu-key');
  await button('保存配置').click();
  await editor().getByRole('alert').filter({hasText:/HTTPS/}).waitFor();
  await editor().getByLabel('API 地址', { exact: true }).fill('https://fixture.example/v1');
  await button('保存配置').click();
  await editor().getByText('已保存。新的请求会使用这份配置。').waitFor();
  assert.equal(await editor().getByLabel('API 密钥', { exact: true }).inputValue(), '');
  assert.equal(await editor().getByLabel('知乎 Access Secret').inputValue(), '');
  await page.getByText('文字聊天：fixture-model · fixture.example').waitFor();
  await button('关闭模型接入').click();
  assert.equal(await page.getByLabel('本次关键词').inputValue(), '花园种子');
  await page.waitForFunction(() =>
    document.querySelector('.search-modal .consent input')?.disabled === false
  );
  await button('返回山洞').click();
  const caveGuide = page.getByText('山洞怎么玩', { exact: true }).locator('..').locator('..');
  await caveGuide.waitFor();
  assert.doesNotMatch(await caveGuide.textContent(), /彩蛋|换装间/);

  await app.close();
  app = undefined;
  page = await launch();
  await pet().waitFor();
  assert.equal(await page.locator('.first-run-guide').count(), 0);
  const savedModel = await page.evaluate(() => window.kanshan.status());
  assert.equal(savedModel.data.destination, 'fixture.example');
  assert.equal(savedModel.data.model, 'fixture-model');
  assert.equal(savedModel.data.hasKey, true);
  console.log('PASS 设置可保存、即刻切换运行配置、保留检索词并在重启后继续生效');
  const desktopActor = button('和刘看山互动，可双击打开营地');
  await desktopActor.press('Enter');
  await page.waitForTimeout(1650);
  await pet().waitFor();
  await desktopActor.locator('.fox-costume-hit').click();
  await page.waitForTimeout(1650);
  await pet().waitFor();
  assert.equal(await page.locator('.camp-shell, .chat-modal, .cave-entrance').count(), 0);
  await page.locator('.pet-cave .pet-caption').click();
  await button('山洞入口').waitFor();
  assert.equal(await page.locator('.cave-reveal video').count(), 0);
  await button('山洞入口').click();
  await page.locator('.cave-reveal video').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('.cave-reveal video').waitFor({state:'detached'});
  await page.keyboard.press('Escape');
  await pet().waitFor();
  await desktopActor.locator('.fox-costume-hit').dblclick();
  const campActor = button('和刘看山互动，可双击打开聊天');
  await campActor.waitFor();
  await campActor.click();
  await page.waitForTimeout(1650);
  assert.equal(await page.locator('.chat-modal, .cave-entrance').count(), 0);
  await button('休息处，和刘看山聊聊').click();
  await page.locator('.chat-modal').getByText(/fixture-model · fixture.example/).waitFor({state:'attached'});
  await page.keyboard.press('Escape');
  await pet().waitFor();
  console.log('PASS 单击桌宠和营地角色只触发互动，山洞与彩蛋各走独立入口');
  await app.evaluate(({ Menu, BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    const appMenu = Menu.getApplicationMenu().items.find(item => item.label === '看山有伴');
    const actions = appMenu.submenu.items.find(item => item.label === '操作菜单');
    const tutorial = actions.submenu.items.find(item => item.label === '使用教程');
    tutorial.click(tutorial, window);
  });
  await firstTitle().waitFor();
  await button('跳过教程').click();
  await pet().waitFor();
  console.log('PASS 桌宠图示与 GIF、进营地、信箱直达知乎检索、子功能图示、重启与重看');
} finally {
  try { await app?.close(); }
  finally { await rm(profile, { recursive: true, force: true }); }
}
