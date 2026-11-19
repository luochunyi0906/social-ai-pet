const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { postUrl } = require('./search.cjs');
const { runSkill } = require('./skills.cjs');
const { item, limit, HotError } = require('../skills/hot-list/kanshan/hot-list.cjs');

const defaults = { enabled: false, time: '09:00', count: 5 };
const days = /^\d{4}-\d{2}-\d{2}$/;
const formatTime = value => String(value).padStart(2, '0');
const day = date => [date.getFullYear(), formatTime(date.getMonth() + 1), formatTime(date.getDate())].join('-');
const time = date => [formatTime(date.getHours()), formatTime(date.getMinutes())].join(':');
const verifiedDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
function fresh(cache, current) {
 if (!cache) return false;
 const fetched = new Date(cache.retrievedAt);
 const age = current.getTime() - fetched.getTime();
 return age >= 0 && age < 30*60000 && day(fetched) === day(current);
}
function preferences(value) {
 if (typeof value?.enabled !== 'boolean' || typeof value.time !== 'string' ||
     !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.time) || ![3,5,10].includes(value.count)) {
  throw Error('请选择有效的提醒时间和速览条数。');
 }
 return { enabled: value.enabled, time: value.time, count: value.count };
}
function hotList(directory, getKey, now = () => new Date(), fetchList = (key,signal) => runSkill('hot-list',{limit:30},{key,signal})) {
 const file = path.join(directory,'hot-list-v1.json');
 const blank = { version:1, prefs:defaults, cache:null, readUrls:[], attemptedDay:null, unseenDay:null };
 const sources = new Map();
 let loaded, refreshInFlight, dailyInFlight, controller, retryAt = 0, problem, stopping = false;
 let tail = Promise.resolve();
 function remember(items) {
  for (const post of items) { sources.delete(post.id); sources.set(post.id,post); }
  while (sources.size > 120) sources.delete(sources.keys().next().value);
 }
 async function read() {
  loaded ??= (async () => {
   try {
    const record = JSON.parse(await fs.readFile(file,'utf8'));
    if (record.version !== 1 || !Array.isArray(record.readUrls)) throw Error();
    const cache = record.cache;
    let safeCache = null;
    if (verifiedDate(cache?.retrievedAt) && Number.isSafeInteger(cache.total) && cache.total >= 0 && Array.isArray(cache.items)) {
     const items = cache.items.slice(0,30).flatMap(value => {
      if (!Number.isInteger(value?.rank) || value.rank < 1 || value.rank > 30) return [];
      const safe = item({Title:value.title, Url:value.sourceUrl, Summary:value.excerpt, ThumbnailUrl:value.thumbnail},
       value.rank, cache.retrievedAt);
      return safe ? [safe] : [];
     });
     safeCache = { retrievedAt:cache.retrievedAt, total:cache.total, items };
     remember(items);
    }
    return { version:1, prefs:preferences(record.prefs), cache:safeCache,
     readUrls:record.readUrls.slice(-300).flatMap(value=>{try{return [postUrl(value).url];}catch{return [];}}),
     attemptedDay:days.test(record.attemptedDay) ? record.attemptedDay : null,
     unseenDay:days.test(record.unseenDay) ? record.unseenDay : null };
   } catch (error) {
    if (error.code !== 'ENOENT') problem = { code:'storage', message:'无法读取热榜记录，原文件已保留。' };
    return blank;
   }
  })();
  return loaded;
 }
 function update(transform) {
  const task = tail.then(async () => {
   const current = await read();
   const next = transform(current);
   if (next === current) return;
   if (problem?.code === 'storage') throw Error(problem.message);
   await fs.mkdir(directory,{recursive:true});
   const temporary = file + '.' + randomUUID() + '.tmp';
   try {
    await fs.writeFile(temporary,JSON.stringify(next)+'\n',{flag:'wx',mode:0o600});
    await fs.rename(temporary,file);
   } finally { await fs.rm(temporary,{force:true}); }
   loaded = Promise.resolve(next);
  });
  tail = task.catch(()=>{});
  return task;
 }
 async function state() {
  await tail;
  const saved = await read();
  const current = now();
  const next = new Date(current);
  const [hour, minute] = saved.prefs.time.split(':').map(Number);
  if (saved.attemptedDay === day(current) || time(current) > saved.prefs.time) next.setDate(next.getDate()+1);
  next.setHours(hour,minute,0,0);
  return { prefs:saved.prefs, cache:saved.cache, readUrls:saved.readUrls, problem,
   badge:saved.prefs.enabled && saved.unseenDay === day(current),
   nextAt:saved.prefs.enabled ? next.toISOString() : null,
   timezone:Intl.DateTimeFormat().resolvedOptions().timeZone };
 }
 function refresh() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
   await read();
   if (stopping || problem?.code === 'storage' || now().getTime() < retryAt) return state();
   controller = new AbortController();
   try {
    const cache = await fetchList(getKey(),controller.signal);
    controller.signal.throwIfAborted();
    await update(old=>({...old, cache}));
    remember(cache.items);
    problem = undefined;
   } catch (error) {
    problem = { code:error.code || 'service', message:error instanceof HotError ? error.message : '读取或保存热榜失败，请重试。' };
    if (error.code === 'rate') retryAt = now().getTime() + 60000;
   }
   return state();
  })().finally(()=>{refreshInFlight=undefined;controller=undefined;});
  return refreshInFlight;
 }
 async function opened() {
  await update(old=>old.unseenDay ? {...old,unseenDay:null} : old);
  return state();
 }
 async function markRead(url) {
  const key = postUrl(url).url;
  await update(old=>old.readUrls.includes(key) || !old.cache?.items.some(post=>post.url===key)
   ? old : {...old,readUrls:[...old.readUrls,key].slice(-300)});
 }
 async function settings(prefs) {
  const value = preferences(prefs);
  await update(old=>({...old,prefs:value,unseenDay:value.enabled ? old.unseenDay : null}));
  return state();
 }
 async function tick(mode) {
  if (!['normal','focus','sleep'].includes(mode)) throw Error('提醒模式无效。');
  const current = now();
  const today = day(current);
  if (dailyInFlight) return {badge:(await state()).badge, notify:false};
  dailyInFlight = (async () => {
   let due = false;
   await update(old=>{
    if (!old.prefs.enabled || old.attemptedDay === today || time(current) < old.prefs.time) return old;
    due = true;
    return {...old,attemptedDay:today};
   });
   if (!due) return {badge:(await state()).badge, notify:false};
   let view = await state();
   if (!fresh(view.cache,current)) view = await refresh();
   if (mode === 'sleep' || !view.cache?.items.length || day(new Date(view.cache.retrievedAt)) !== today ||
       day(now()) !== today || !view.prefs.enabled) return {badge:view.badge, notify:false};
   await update(old=>old.prefs.enabled ? {...old,unseenDay:today} : old);
   return {badge:(await state()).badge, notify:mode==='normal'};
  })().finally(()=>{dailyInFlight=undefined;});
  return dailyInFlight;
 }
 async function forChat(requested, force, signal) {
  const count = limit(requested);
  const saved = await state();
  const cached = !force && fresh(saved.cache,now());
  const result = cached ? saved : await refresh();
  signal?.throwIfAborted();
  if (!cached && result.problem) throw new HotError(result.problem.code,result.problem.message);
  if (!result.cache) throw new HotError('service','暂时无法取得知乎热榜。');
  return {retrievedAt:result.cache.retrievedAt,items:result.cache.items.slice(0,count),cached};
 }
 return {state,refresh,opened,markRead,settings,tick,forChat,stop:()=>{stopping=true;controller?.abort();},source:async id=>{await read();return sources.get(id);},
  flush:()=>tail};
}

module.exports = { hotList };
