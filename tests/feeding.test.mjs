import test from 'node:test';import assert from 'node:assert/strict';
import {feedingJourney} from '../src/feeding.ts';
test('取消嗅闻阶段立即结束；迟到定时器不进入叼纸/入洞阶段',async()=>{
 const controller=new AbortController(),phases=[];const pending=feedingJourney(controller.signal,p=>phases.push(p));assert.deepEqual(phases,['sniff']);controller.abort();await assert.rejects(pending,{name:'AbortError'});await new Promise(r=>setTimeout(r,680));assert.deepEqual(phases,['sniff']);
});
test('低打扰/减少动态跳过动作等待；预先取消不产生任何阶段',async()=>{
 let phases=[];await feedingJourney(new AbortController().signal,p=>phases.push(p),true);assert.deepEqual(phases,['explore']);phases=[];const controller=new AbortController();controller.abort();await assert.rejects(feedingJourney(controller.signal,p=>phases.push(p)));assert.deepEqual(phases,[]);
});

import {nextBehavior,INITIAL_STATE} from '../src/shared/behavior.mjs';
test('同一个行为控制器处理投喂；暂停和低打扰优先于叼纸',()=>{
 assert.equal(nextBehavior(INITIAL_STATE,0,false,'carry').action,'walk');
 assert.equal(nextBehavior(INITIAL_STATE,0,false,'sniff').action,'sniff');
 assert.equal(nextBehavior({...INITIAL_STATE,paused:true},0,false,'carry').action,'paused');
 assert.equal(nextBehavior(INITIAL_STATE,0,true,'carry').action,'rest');
});
