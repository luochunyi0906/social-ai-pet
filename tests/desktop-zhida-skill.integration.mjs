import { skipGuide } from './skip-guide.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright';
import dotenv from 'dotenv';
import core from '../desktop/core.cjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const bundle = resolve(root, process.env.KANSHAN_PACKAGE_DIR || 'release', '看山有伴.app');
const resources = join(bundle, 'Contents/Resources/app');
const executablePath = join(bundle, 'Contents/MacOS/Kanshan');
const profile = await mkdtemp(join(tmpdir(), 'kanshan-native-skill-'));
const artifacts = resolve(root, process.env.KANSHAN_TEST_ARTIFACTS || 'artifacts');
const configFile = process.env.KANSHAN_TEST_ZHIHU_CONFIG ||
  join(homedir(), 'Library/Application Support/看山有伴-v0.3-preview/model.env');
const endpoint = 'https://developer.zhihu.com/v1/chat/completions';
const model = 'zhida-fast-1p5';
const facts = '我叫小林，我的项目叫雪松，演示日期是 12 月 8 日。';
const report = { mode: 'real-zhida-skill', model, bundle, checks: [], requests: [] };
let app, page, secret, lastRequestAt = 0;

function passed(name, evidence) {
  report.checks.push({ name, evidence });
  console.log('PASS', name, JSON.stringify(evidence));
}

async function launch() {
  // Launch with just the OS environment, a synthetic profile and main-process credentials.
  const env = {
    HOME: homedir(), PATH: '/usr/bin:/bin:/usr/sbin:/sbin', TMPDIR: tmpdir(),
    KANSHAN_DATA_DIR: profile, CHAT_PROVIDER: 'zhida', ZHIDA_MODEL: model, ZHIHU_ACCESS_SECRET: secret
  };
  app = await electron.launch({ executablePath, cwd: '/', env, timeout: 25000 });
  await app.evaluate(() => {
    const transport = globalThis.fetch;
    globalThis.skillTrace = [];
    globalThis.fetch = async (url, options) => {
      if (url !== 'https://developer.zhihu.com/v1/chat/completions') return transport(url, options);
      const payload = JSON.parse(options.body);
      const sentAt = Date.now();
      const timestamp = Number(options.headers['X-Request-Timestamp']);
      const trace = {
        url, method: options.method, keys: Object.keys(payload).sort(), model: payload.model,
        stream: payload.stream, messages: payload.messages, timestamp, sentAt,
        hasAuth: /^Bearer \S+$/.test(options.headers.Authorization)
      };
      globalThis.skillTrace.push(trace);
      const response = await transport(url, options);
      trace.http = response.status;
      trace.ms = Date.now() - sentAt;
      return response;
    };
  });
  page = await app.firstWindow();
  await skipGuide(page);
  await page.locator('.desktop-pet').waitFor();
  const status = await page.evaluate(() => window.kanshan.chatStatus());
  assert.equal(status.data?.skillId, 'zhida');
  assert.equal(status.data?.model, model);
  assert.equal(status.data?.ready, true);
}

async function openChat() {
  await page.locator('.pet-fox .fox-costume-hit').dblclick();
  const dialog = page.getByRole('dialog', { name: '说一点你正想着的事' });
  if (!await dialog.isVisible()) await page.getByRole('button', { name: '和刘看山互动，可双击打开聊天', exact: true }).dblclick();
  await dialog.getByText('聊天服务', { exact: false }).waitFor();
  return dialog;
}

async function send(dialog, text, previousTurns) {
  await delay(Math.max(0, lastRequestAt + 24500 - Date.now()));
  const traceCount = await app.evaluate(() => globalThis.skillTrace.length);
  await dialog.getByRole('textbox', { name: '对刘看山说的话' }).fill(text);
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: '发送', exact: true }).click();
  await dialog.getByRole('button', { name: '发送', exact: true }).waitFor({ timeout: 100000 });
  const db = JSON.parse(await readFile(join(profile, 'chat-v1.json'), 'utf8'));
  const active = db.sessions.find(session => session.id === db.activeId);
  const turn = active?.turns.at(-1);
  const traces = await app.evaluate(() => globalThis.skillTrace);
  const fresh = traces.slice(traceCount);
  report.requests.push(...fresh);
  assert.equal(fresh.length, 1);
  const [trace] = fresh;
  lastRequestAt = trace.sentAt;
  assert.equal(trace.http, 200, turn?.error);
  assert.equal(trace.url, endpoint);
  assert.equal(trace.method, 'POST');
  assert.equal(trace.model, model);
  assert.equal(trace.stream, false);
  assert.equal(trace.hasAuth, true);
  assert.ok(Math.abs(trace.timestamp - trace.sentAt / 1000) < 2);
  assert.deepEqual(trace.keys, ['messages', 'model', 'stream']);
  assert.equal(trace.messages[0].role, 'system');
  assert.deepEqual(trace.messages.slice(1,-1),previousTurns.flatMap(([user,assistant])=>[
    { role: 'user', content: user }, { role: 'assistant', content: assistant }
  ]));
  assert.equal(trace.messages.filter(message => message.content.includes(text)).length, 1);
  assert.equal(trace.messages.at(-1).role, 'user');
  assert.equal(active.turns.length, previousTurns.length + 1);
  assert.equal(turn.user.content, text);
  assert.equal(turn.state, 'complete', turn.error);
  assert.match(await dialog.locator('.user-line').last().innerText(), /^你：/);
  assert.match(await dialog.locator('.fox-line').last().innerText(), /^刘看山：/);
  return { id: active.id, reply: turn.assistant.content };
}

async function checkGarden(dialog) {
  await dialog.getByRole('button', { name: '关闭对话' }).click();
  const flower = page.locator('.camp-plot').first().locator('.plant-flower');
  await flower.waitFor();
  for (const size of [[900, 740], [720, 620], [600, 620]]) {
    await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setSize(...size),size);
    await page.waitForFunction(size=>innerWidth===size[0]&&innerHeight===size[1],size);
    const box = page.locator('.camp-seed');
    const label = box.locator('span');
    await box.hover();
    const separation = await page.evaluate(() => {
      const flowerBox = document.querySelector('.camp-plot .plant-flower').getBoundingClientRect();
      return [...document.querySelectorAll('.camp-seed i, .camp-seed span')]
        .map(node => Math.round(flowerBox.top - node.getBoundingClientRect().bottom));
    });
    assert.ok(separation.every(gap=>gap>=12),JSON.stringify({size,separation}));
    await label.click();
    await page.getByRole('region', { name: '选择一颗种子' }).waitFor();
    await page.getByRole('button', { name: '关闭选择一颗种子' }).click();
    await page.locator('.camp-plot .camp-soil').first().click();
    await page.getByRole('region', { name: 'A1 · 已开花' }).waitFor();
    await page.getByRole('button', { name: '关闭A1 · 已开花' }).click();
    await page.screenshot({ path: join(artifacts, `native-seed-clearance-${size.join('x')}.png`) });
    passed('种子箱与 A1 花朵留有独立空间，入口均可点击', {viewport:size,gapPx:Math.min(...separation)});
  }
}

try {
  await mkdir(artifacts, { recursive: true });
  const skillDir = join(resources, 'skills/zhida');
  const manifest = JSON.parse(await readFile(join(skillDir,'manifest.json'), 'utf8'));
  for (const [file, expected] of Object.entries(manifest.upstream.files)) {
    assert.equal(createHash('sha256').update(await readFile(join(skillDir,file))).digest('hex'),expected);
  }
  for (const file of [manifest.documentation,manifest.entry]) await readFile(join(skillDir,file));
  passed('发布包内官方 Skill 原件哈希一致，适配入口齐全',manifest.upstream.version);
  secret = dotenv.parse(await readFile(configFile)).ZHIHU_ACCESS_SECRET?.trim();
  assert.ok(secret, '本机缺少知乎访问密钥');
  const legacy = core.addFavorite(core.emptyStore(), {
    kind:'generated_question',title:'【布局测试】开花的 A1',keywords:'布局测试',simulated:true
  });
  await writeFile(join(profile,'garden-v1.json'),JSON.stringify(legacy));
  await launch();
  const dialog = await openChat();
  passed('独立发布包启动后主进程注册知乎直答 Skill','zhida');
  const intro = await send(dialog, facts, []);
  passed('首次真实发送', intro.reply);
  const followup = '我的项目名称和演示日期是什么？';
  const next = await send(dialog, followup, [[facts,intro.reply]]);
  assert.match(next.reply,/雪松/);
  assert.match(next.reply,/(?:12|十二)\s*月\s*(?:8|八)\s*(?:日|号)/);
  passed('真实连续追问回忆正确', next.reply);
  await checkGarden(dialog);
  await app.close();
  app = undefined;
  await delay(Math.max(0, lastRequestAt + 24500 - Date.now()));
  await launch();
  const reopened = await openChat();
  assert.equal(await reopened.locator('.user-line').count(),2);
  const restored = await send(reopened,'重开后，我叫什么、项目叫什么、演示是哪天？',[[facts,intro.reply],[followup,next.reply]]);
  assert.equal(restored.id,intro.id);
  assert.match(restored.reply,/小林/);
  assert.match(restored.reply,/雪松/);
  assert.match(restored.reply,/(?:12|十二)\s*月\s*(?:8|八)\s*(?:日|号)/);
  passed('退出并重启独立发布包后继续原会话', restored.reply);
} catch (error) {
  report.failure = error.message;
  process.exitCode = 1;
  console.error(error.message);
} finally {
  await app?.close().catch(()=>{});
  if (secret) {
    await writeFile(join(artifacts,'chat-real-zhida-skill.json'),
      JSON.stringify(report,null,2).replaceAll(secret,'[已隐藏]')+'\n');
  }
  await rm(profile,{recursive:true,force:true});
}
