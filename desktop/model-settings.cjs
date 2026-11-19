const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { parse } = require('dotenv');
const model = require('./model.cjs');
const chat = require('./chat-model.cjs');

const choices = {
 MODEL_PROVIDER: ['zhida', 'openai-compatible'],
 CHAT_PROVIDER: ['zhida', 'existing', 'ollama', 'llama.cpp'],
 ZHIDA_MODEL: ['zhida-fast-1p5', 'zhida-thinking-1p5'],
 SEARCH_PROVIDER: ['zhihu', 'brave', 'bing-rss'],
};

const textFields = {
 MODEL_BASE_URL: 512,
 MODEL_NAME: 200,
 CHAT_BASE_URL: 512,
 CHAT_MODEL: 150,
};

const credentials = ['MODEL_API_KEY', 'ZHIHU_ACCESS_SECRET', 'SEARCH_API_KEY'];
const modelDefaultUrl = 'https://api.openai.com/v1';

function publicSettings(env, zhihuSecret = env.ZHIHU_ACCESS_SECRET) {
 return {
  values: {
   MODEL_PROVIDER: model.configuration(env).provider,
   CHAT_PROVIDER: chat.configuration(env).provider,
   ZHIDA_MODEL: env.ZHIDA_MODEL?.trim() || 'zhida-fast-1p5',
   SEARCH_PROVIDER: env.SEARCH_PROVIDER?.trim() || 'zhihu',
   MODEL_BASE_URL: env.MODEL_BASE_URL?.trim() || modelDefaultUrl,
   MODEL_NAME: env.MODEL_NAME?.trim() || '',
   CHAT_BASE_URL: env.CHAT_BASE_URL?.trim() || '',
   CHAT_MODEL: env.CHAT_MODEL?.trim() || '',
  },
  hasCredential: {
   MODEL_API_KEY: !!env.MODEL_API_KEY?.trim(),
   ZHIHU_ACCESS_SECRET: !!zhihuSecret?.trim(),
   SEARCH_API_KEY: !!env.SEARCH_API_KEY?.trim(),
  },
 };
}

function modelOrigin(value) {
 try {
  const url = new URL(value || modelDefaultUrl);
  if (url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash) {
   return url.origin;
  }
 } catch {}
}

function validatePatch(patch, env) {
 if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw Error('配置格式无效。');
 const edited = {};
 for (const [key, input] of Object.entries(patch)) {
  const secret = credentials.includes(key);
  const option = Object.hasOwn(choices, key) ? choices[key] : undefined;
  const limit = Object.hasOwn(textFields, key) ? textFields[key] : secret ? 4096 : option ? 40 : 0;
  if (!limit || typeof input !== 'string' || input.length > limit || /[\x00-\x1f\x7f]/.test(input)) {
   throw Error('配置包含无效字段或字符。');
  }
  const value = input.trim();
  if (option && !option.includes(value)) throw Error('请选择支持的服务或模型档位。');
  if (secret) {
   if (!value) continue;
   if (/\s/.test(value)) throw Error('访问密钥不能包含空格或换行。');
  }
  if (key === 'MODEL_BASE_URL' && !modelOrigin(value)) {
   throw Error('兼容 API 地址须为不含账号、密码或查询参数的 HTTPS 地址。');
  }
  if (key === 'CHAT_BASE_URL' && value &&
      !chat.configuration({ CHAT_PROVIDER: 'ollama', CHAT_BASE_URL: value }).endpoint) {
   throw Error('本机聊天服务地址请使用回环地址，例如 http://127.0.0.1:11434。');
  }
  if (key === 'CHAT_MODEL' && value && !/^[a-z0-9][a-z0-9._:/-]{0,149}$/i.test(value)) {
   throw Error('本机模型名称格式无效。');
  }
  edited[key] = value;
 }
 if (Object.hasOwn(edited, 'MODEL_BASE_URL') && env.MODEL_API_KEY?.trim() &&
     modelOrigin(edited.MODEL_BASE_URL) !== modelOrigin(env.MODEL_BASE_URL) && !edited.MODEL_API_KEY) {
  throw Error('更换 API 服务域名时，请同时填写该服务的 API 密钥。');
 }
 return edited;
}

// Match the same assignment syntax dotenv uses, including multiline quoted values.
const assignment = /(^\s*)(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?$/gm;

function assignmentFor(key, value) {
 for (const quote of ['', "'", '`', '"']) {
  const line = key + '=' + quote + value + quote;
  if (parse(line)[key] === value) return line;
 }
 throw Error('配置值格式无法保存。');
}

function updateText(text, edited) {
 const ending = text.includes('\r\n') ? '\r\n' : '\n';
 const remaining = text.replace(/\r\n?/g, '\n')
  .replace(assignment, (match, whitespace, key) => Object.hasOwn(edited, key) ? whitespace : match)
  .trimEnd();
 const newLines = Object.entries(edited).map(([key, value]) => assignmentFor(key, value));
 const next = [remaining, ...newLines].filter(Boolean).join('\n') + '\n';
 const expected = {...parse(text), ...edited};
 const actual = parse(next);
 if (Object.keys(expected).length !== Object.keys(actual).length ||
     Object.keys(expected).some(key => expected[key] !== actual[key])) {
  throw Error('原配置包含无法安全合并的内容，请检查本机配置文件。');
 }
 return next.replace(/\n/g, ending);
}

async function readText(file) {
 try {
  return await fs.readFile(file, 'utf8');
 } catch (error) {
  if (error.code === 'ENOENT') return '';
  throw Error('无法读取本机模型配置。');
 }
}

async function saveSettings(file, patch, currentEnvironment) {
 const original = await readText(file);
 const edited = validatePatch(patch, {...currentEnvironment, ...parse(original)});
 if (!Object.keys(edited).length) return parse(original);
 const output = updateText(original, edited);
 const temporary = file + '.' + randomUUID() + '.tmp';
 try {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const fileInfo = await fs.lstat(file).catch(error => {
   if (error.code === 'ENOENT') return null;
   throw error;
  });
  if (fileInfo && !fileInfo.isFile()) throw Error('配置目标不是普通文件。');
  await fs.writeFile(temporary, output, { flag: 'wx', mode: 0o600 });
  if (await readText(file) !== original) throw Error('本机模型配置刚刚被修改，请重试。');
  await fs.rename(temporary, file);
 } catch (error) {
  if (error.code) throw Error('无法保存本机模型配置。');
  throw error;
 } finally {
  await fs.rm(temporary, {force: true}).catch(() => {});
 }
 return parse(output);
}

module.exports = { publicSettings, saveSettings };
