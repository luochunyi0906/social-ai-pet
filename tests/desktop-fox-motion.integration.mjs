import { skipGuide } from './skip-guide.mjs';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const profile = await mkdtemp(join(tmpdir(), 'kanshan-fox-motion-'));
const executablePath = resolve(root, process.env.KANSHAN_PACKAGE_DIR || 'release',
 '看山有伴.app/Contents/MacOS/Kanshan');
const outfit = process.env.KANSHAN_FOX_OUTFIT;
let app;

try {
 await writeFile(join(profile, 'window-preferences.json'), JSON.stringify({
  version: 1, appearance: 'fox', snow: false,
  ...(outfit ? { caveStickerReward:true, caveOutfit:outfit } : {}), wander: { enabled: false, interval: 90, distance: 75, dwell: 4 },
 }));
 app = await electron.launch({ executablePath, env: { ...process.env, KANSHAN_DATA_DIR: profile } });
 const desktop = await app.firstWindow();
 await skipGuide(desktop);
 if(outfit)await desktop.locator(`.desktop-pet [data-cave-outfit="${outfit}"]`).waitFor();
 await desktop.locator('.desktop-pet [data-pet-appearance="fox"]').waitFor();

 await app.evaluate(({ BrowserWindow, screen }) => {
  const area = screen.getPrimaryDisplay().workArea;
  BrowserWindow.fromId(1).setPosition(area.x + 24, area.y + 40);
  const cursor = screen.getCursorScreenPoint.bind(screen);
  screen.getCursorScreenPoint = () => globalThis.fixturePointer || cursor();
  const delay = globalThis.setTimeout;
  globalThis.setTimeout = (callback, ms, ...args) => delay(callback, ms === 15000 ? 650 : ms, ...args);
 });

 for (const [movement, distance] of [['walk', .20], ['run', .65]]) {
  await app.evaluate(({ BrowserWindow, screen }, ratio) => {
   const camp = BrowserWindow.fromId(1).getBounds();
   const area = screen.getPrimaryDisplay().workArea;
   globalThis.fixturePointer = { x: camp.x + 152 + Math.round(area.width * ratio), y: camp.y + 75 };
  }, distance);
  const companion = app.windows().find(page => page !== desktop) || app.waitForEvent('window');
  const drag = await desktop.evaluate(async () => {
   const started = await window.kanshan.startWindowDrag({ surface: 'roam', x: 152, y: 75 });
   if (started.data) await window.kanshan.endWindowDrag('roam', true);
   return started;
  });
  assert.equal(drag.data, true);
  const child = await companion;
  await child.emulateMedia({ reducedMotion: 'no-preference' });
  await child.locator('.roam-character').waitFor();
  const sprite = child.locator(`[data-fox-motion="${movement}"] .fox-motion-strip`);
  await sprite.waitFor();
  const from = await sprite.evaluate(node => getComputedStyle(node).transform);
  await child.waitForFunction(previous => {
   const strip = document.querySelector('.fox-motion-strip');
   return strip && getComputedStyle(strip).transform !== previous;
  }, from);
  assert.match(await sprite.locator('image').first().getAttribute('href'), new RegExp((outfit ? outfit + '-' : '') + movement + '-left-'));
  assert.equal(await sprite.locator('image').first().getAttribute('width'), String(240 * (movement === 'run' ? 8 : 14)));
  if (process.env.KANSHAN_FOX_PROOF) {
   await child.screenshot({ path: join(process.env.KANSHAN_FOX_PROOF, movement + '.png'), omitBackground: true });
  }
  await desktop.locator('.desktop-pet .pet-fox:not(.is-away)').waitFor();
  if(outfit)await desktop.locator(`.desktop-pet [data-cave-outfit="${outfit}"] image:is([href*="${outfit}-front-"],[href*="${outfit}-headset-"])`).first().waitFor();
 }
 console.log('通过：狐狸 Q 版近距离走回、远距离跑回，各自播放不同节奏的实际步态帧。');
} finally {
 await app?.close();
 await rm(profile, { recursive: true, force: true });
}
