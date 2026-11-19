import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const settings = require('../desktop/model-settings.cjs');
const model = require('../desktop/model.cjs');
const chat = require('../desktop/chat-model.cjs');
const search = require('../desktop/search.cjs');

test('设置保存使用运行时模型配置，保留其他字段，API 密钥不读回界面', async t => {
  const root = await mkdtemp(join(tmpdir(), 'kanshan-api-settings-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, 'model.env');
  await writeFile(file, [
    '# 本机设置',
    'MODEL_NAME=old',
    'export MODEL_NAME="previous"',
    'MODEL_TIMEOUT_MS=23000',
    'KEEP="a\nb"',
    '',
  ].join('\r\n'));
  const values = await settings.saveSettings(file, {
    MODEL_PROVIDER: 'openai-compatible',
    MODEL_BASE_URL: 'https://fixture.example/v1',
    MODEL_NAME: 'fixture-model',
    MODEL_API_KEY: 'fixture#token',
    CHAT_PROVIDER: 'existing',
    ZHIHU_ACCESS_SECRET: 'fixture-zhihu',
  }, {});
  const content = await readFile(file, 'utf8');
  assert.match(content, /^# 本机设置/);
  assert.equal([...content.matchAll(/MODEL_NAME=/g)].length, 1);
  assert.equal(values.KEEP, 'a\nb');
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  const config = model.configuration(values);
  assert.equal(config.endpoint, 'https://fixture.example/v1/chat/completions');
  assert.equal(config.model, 'fixture-model');
  assert.equal(config.timeoutMs, 23000);
  let request;
  const completion = await model.requestCompletion([{role:'user', content:'fixture message'}], {
    config,
    fetchImpl: async (url, options) => {
      request = {url, key:options.headers.Authorization, model:JSON.parse(options.body).model};
      return Response.json({choices:[{message:{content:'fixture reply'}}]});
    },
  });
  assert.equal(completion, 'fixture reply');
  assert.deepEqual(request, {
    url:'https://fixture.example/v1/chat/completions', key:'Bearer fixture#token', model:'fixture-model'
  });
  assert.equal(chat.configuration(values).existing.revision, config.revision);
  assert.equal(search.config(values).ready, true);
  const publicView = settings.publicSettings(values);
  assert.equal(publicView.hasCredential.MODEL_API_KEY, true);
  assert.equal(publicView.hasCredential.ZHIHU_ACCESS_SECRET, true);
  assert.doesNotMatch(JSON.stringify(publicView), /fixture#token|fixture-zhihu/);

  await assert.rejects(settings.saveSettings(file, { MODEL_BASE_URL: 'https://different.example/v1' }, values), /同时填写/);
  await assert.rejects(settings.saveSettings(file, { CHAT_BASE_URL: 'http://remote.example' }, values), /回环/);
  await assert.rejects(settings.saveSettings(file, { MODEL_NAME: 'fixture\nSEARCH_PROVIDER=brave' }, values), /无效/);
  assert.equal(await readFile(file, 'utf8'), content);
  const edited = await settings.saveSettings(file, { MODEL_NAME: 'next-model', MODEL_API_KEY: '' }, values);
  assert.equal(edited.MODEL_API_KEY, 'fixture#token');
  assert.equal(edited.MODEL_NAME, 'next-model');
});
