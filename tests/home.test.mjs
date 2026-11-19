import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { INITIAL_STATE, nextBehavior } from '../src/shared/behavior.mjs';

const require = createRequire(import.meta.url);
const { outfitPreferences } = require('../desktop/outfit-preferences.cjs');
const forest = require('../desktop/outfits/forest-guide.json');

test('树屋睡眠优先于活动、低打扰、拖动和上一次动作', () => {
 for (const [phase, event] of [['carry','found'],['sniff','showcase'],['idle','lift'],['idle','garden-stage']]) {
  assert.equal(nextBehavior({ ...INITIAL_STATE, sleeping:true }, 1, true, phase, event).action, 'sleep');
 }
 assert.equal(nextBehavior(INITIAL_STATE, 1, true).action, 'rest');
 assert.equal(nextBehavior(INITIAL_STATE, 1, false).action, 'walk');
});

test('森林引路者单套有序单次动作、固定画布及准确资源', async () => {
 assert.equal(forest.kind, 'full-character');
 assert.deepEqual(forest.anchor,{ x:160,y:315 });
 const [first]=forest.actions.idle.frames;
 const action=forest.actions.showcase;
 assert.deepEqual(action.frames, Array.from({length:32}, (_, i)=>`INFJ_${String(i+1).padStart(3,'0')}.png`));
 assert.equal(first,action.frames[0]);
 assert.deepEqual([action.fps,action.loop,action.finish],[20,'once','idle']);
 assert.equal(forest.actions.sleep,undefined);
 assert.equal(forest.actions.walk,undefined);
 for (const frame of action.frames) {
  const bytes=await readFile(new URL(`../src/assets/outfits/forest-guide/${frame}`,import.meta.url));
  assert.equal(bytes.readUInt32BE(16),forest.canvas.width);
  assert.equal(bytes.readUInt32BE(20),forest.canvas.height);
  assert.equal(bytes.readUInt8(25),6);
 }
});

test('装扮偏好串行落盘、兼容旧目录、无效套装或损坏文件不覆盖其他存档', async () => {
 const profile=await mkdtemp(join(tmpdir(),'kanshan-outfit-prefs-'));
 const filename=join(profile,'outfit-preference.json');
 const garden=join(profile,'garden-v3.json');
 try {
  const preferences=outfitPreferences(profile);
  assert.deepEqual(await preferences.read(),{ outfitId:'default' });
  await writeFile(garden,'existing garden');
  await Promise.all([preferences.save('forest-guide'),preferences.save('default'),preferences.save('forest-guide')]);
  assert.deepEqual(await outfitPreferences(profile).read(),{outfitId:'forest-guide'});
  assert.throws(()=>preferences.save('../unknown'),/不可用/);
  assert.deepEqual(JSON.parse(await readFile(filename,'utf8')),{version:1,outfitId:'forest-guide'});
  await writeFile(filename,'{ corrupt');
  assert.match((await outfitPreferences(profile).read()).warning,/无法读取/);
  assert.equal(await readFile(filename,'utf8'),'{ corrupt');
  assert.equal(await readFile(garden,'utf8'),'existing garden');
 } finally { await rm(profile,{recursive:true,force:true}); }
});

test('系统闹钟拒绝无效输入并按设备本地时间计算下一次响铃', () => {
 const { alarmDate } = require('../desktop/native-sleep.cjs');
 const now = new Date(2026, 10, 19, 13, 42, 4);
 assert.equal(alarmDate('14:15', now).getTime(), new Date(2026, 10, 19, 14, 15).getTime());
 assert.equal(alarmDate('07:15', now).getTime(), new Date(2026, 10, 20, 7, 15).getTime());
 assert.throws(() => alarmDate('25:00', now), /有效/);
 assert.throws(() => alarmDate(null, now), /有效/);
});

test('系统闹钟按唯一标识选用同名快捷指令，兼容系统自动编号的导入副本', () => {
 const { selectAlarmShortcut } = require('../desktop/native-sleep.cjs');
 const name = '看山有伴·创建系统闹钟';
 const first = '00000000-0000-4000-8000-000000000001';
 const counted = '00000000-0000-4000-8000-000000000002';
 const last = '00000000-0000-4000-8000-000000000003';
 const entries = [`${name} (${first})`, `${name} 1 (${counted})`, `${name} (${last})`];
 assert.equal(selectAlarmShortcut(entries.join('\n')), last);
 assert.equal(selectAlarmShortcut(entries[1]), counted);
 assert.equal(selectAlarmShortcut(`${name} 旧版 (${last})\n${name} (bad-id)`), undefined);
});
