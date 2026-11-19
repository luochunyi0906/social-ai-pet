const { postUrl } = require('../../../desktop/search.cjs');
const { readJson } = require('../../../desktop/model.cjs');

const endpoint = 'https://developer.zhihu.com/api/v1/content/hot_list';
function limit(value) {
 if (!Number.isInteger(value) || value < 1 || value > 30) throw new HotError('limit','请输入 1–30 的整数，一次最多获取 30 条。');
 return value;
}
function plain(value, max) {
 return typeof value === 'string' ? value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,'')
  .replace(/&(?:nbsp|amp|quot|lt|gt|apos);/g, entity =>
   ({'&nbsp;':' ','&amp;':'&','&quot;':'"','&lt;':'<','&gt;':'>','&apos;':"'"})[entity])
  .replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max) : '';
}
function thumbnail(value) {
 if (typeof value !== 'string' || value.length > 2048) return undefined;
 try {
  const url = new URL(value);
  if (url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      (url.hostname === 'zhimg.com' || url.hostname.endsWith('.zhimg.com'))) return url.href;
 } catch {}
}
function item(raw, rank, retrievedAt) {
 try {
  const url = postUrl(raw.Url);
  const title = plain(raw.Title, 300);
  if (!title) return;
  const excerpt = plain(raw.Summary, 4000);
  return { ...url, id: 'hot:' + url.identity, title, rank, provider: 'zhihu',
   verification: excerpt ? 'api_excerpt' : 'api_metadata', excerpt, retrievedAt,
   thumbnail: thumbnail(raw.ThumbnailUrl) };
 } catch {}
}
class HotError extends Error {
 constructor(code, message) { super(message); this.code = code; }
}
const authentication = () => new HotError('auth','知乎热榜鉴权失败，请检查访问密钥、热榜权限与设备时间。');
const limited = () => new HotError('rate','知乎热榜查询受限，请稍后再试。');
const unavailable = () => new HotError('service','知乎热榜服务暂不可用，请稍后重试。');
function normalize(payload, retrievedAt) {
 if (payload?.Code === 20001) throw authentication();
 if (payload?.Code === 30001) throw limited();
 if (payload?.Code === 90001) throw unavailable();
 const data = payload?.Data;
 if (payload?.Code !== 0 || !Array.isArray(data?.Items) ||
     !Number.isSafeInteger(data.Total) || data.Total < 0) {
  throw new HotError('format','知乎热榜返回格式无效，请重试。');
 }
 const seen = new Set();
 const items = data.Items.slice(0,30).flatMap((raw, index) => {
  const result = item(raw, index + 1, retrievedAt);
  if (!result || seen.has(result.identity)) return [];
  seen.add(result.identity);
  return [result];
 });
 if (data.Items.length && !items.length) throw new HotError('format','知乎热榜未返回可安全打开的条目，请重试。');
 return { retrievedAt, total: data.Total, items };
}
async function run({ limit: requested = 30 } = {}, { key, signal: cancelled, fetchImpl = globalThis.fetch } = {}) {
 const count = limit(requested);
 if (!key || /\s/.test(key)) throw new HotError('auth','请先填写知乎访问密钥 ZHIHU_ACCESS_SECRET。');
 const timeout = AbortSignal.timeout(18000);
 const signal = cancelled ? AbortSignal.any([timeout,cancelled]) : timeout;
 try {
  const response = await fetchImpl(endpoint + '?Limit=' + count, {
   method: 'GET', redirect: 'error', signal,
   headers: { Authorization: 'Bearer ' + key,
    'X-Request-Timestamp': String(Math.floor(Date.now()/1000)), 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
   await response.body?.cancel();
   if ([401,403].includes(response.status)) throw authentication();
   if (response.status === 429) throw limited();
   throw unavailable();
  }
  const result = normalize(await readJson(response,signal), new Date().toISOString());
  return {...result,items:result.items.slice(0,count)};
 } catch (error) {
  if (error instanceof HotError) throw error;
  if (cancelled?.aborted) throw new HotError('cancelled','热榜获取已取消。');
  if (signal.aborted) throw new HotError('service','获取知乎热榜超时，请稍后重试。');
  throw new HotError('service','无法读取知乎热榜，请检查网络后重试。');
 }
}

module.exports = { run, normalize, item, limit, HotError };
