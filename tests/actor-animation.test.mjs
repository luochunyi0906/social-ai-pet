import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {animationEvent,animationFrame,animationPlan,initialAnimation} from '../src/shared/animation.mjs';
import registry from '../src/assets/companion/registry.json' with {type:'json'};

const send=(state,type,at,changes={})=>animationEvent(state,{type,at,...changes});
const check=(state,at,clip,stage)=>assert.deepEqual(
 [animationPlan(state,at).clip,animationPlan(state,at).stage],[clip,stage]);

test('等待从请求开始持续到正文、终止或取消；旧请求无法结束新请求',()=>{
 let state=send(initialAnimation(0),'begin',10,{scope:'chat',id:'old'});
 assert.strictEqual(send(state,'begin',500,{scope:'chat',id:'old'}),state);
 state=send(state,'end',500,{scope:'chat',id:'old'});
 state=send(state,'begin',600,{scope:'chat',id:'fresh'});
 assert.strictEqual(send(state,'end',800,{scope:'chat',id:'old'}),state);
 check(state,850,'emo_thinking','loop');
 state=send(state,'end',900,{scope:'chat',id:'fresh'});
 check(state,900,'act_idle','loop');
});

test('独立请求作用域互不覆盖，等待画面不因另一入口开启或结束而重播',()=>{
 let state=send(initialAnimation(0),'begin',25,{scope:'chat',id:'1'});
 state=send(state,'begin',100,{scope:'search',id:'2'});
 state=send(state,'end',500,{scope:'chat',id:'1'});
 assert.equal(animationPlan(state,500).since,25);
 check(state,500,'emo_thinking','loop');
 state=send(state,'end',600,{scope:'search',id:'2'});
 check(state,600,'act_idle','loop');
});

test('一次性反馈到期不重播，专注切换一次坐下，等待结束仍保持坐姿',()=>{
 let state=send(initialAnimation(0),'feedback',50,{clip:'emo_curious'});
 check(state,300,'emo_curious','enter');
 check(state,1050,'act_idle','loop');
 state=send(state,'feedback',1100,{clip:'emo_happy'});
 check(state,1500,'emo_happy','enter');
 state=send(state,'mode',1700,{mode:'focus'});
 check(state,1800,'act_sit','enter');
 state=send(state,'begin',2200,{scope:'search',id:'query'});
 check(state,2550,'emo_thinking','loop');
 state=send(state,'end',2600,{scope:'search',id:'query'});
 check(state,2600,'act_sit','hold');
 assert.equal(animationFrame(animationPlan(state,2700),2700),5);
 assert.strictEqual(send(state,'feedback',2700,{clip:'emo_happy'}),state);
});

test('睡眠独占姿态，晚到的结束和收藏不打断，唤醒恢复当前模式',()=>{
 let state=send(initialAnimation(0),'begin',100,{scope:'chat',id:'pending'});
 state=send(state,'mode',120,{mode:'sleep'});
 check(state,400,'act_sleep','hold');
 state=send(state,'end',700,{scope:'chat',id:'pending'});
 assert.strictEqual(send(state,'feedback',750,{clip:'emo_happy'}),state);
 check(state,1200,'act_sleep','hold');
 assert.equal(animationFrame(animationPlan(state,1800),1800),5);
 state=send(state,'mode',1800,{mode:'normal'});
 check(state,1880,'act_idle','loop');
});

test('14 组素材登记，实际业务 7 组，睡眠沿用被窝，按顺序使用统一 256 RGBA 帧',async()=>{
 const entries=Object.entries(registry.clips);
 assert.equal(entries.length,14);
 assert.equal(entries.filter(([,value])=>value.active).length,7);
 for(const [clip,fps] of [['act_walk',10],['act_run',12]]){
  const plan={clip,stage:'loop',since:0,until:null};
  assert.equal(registry.clips[clip].fps,fps);
  assert.deepEqual([0,1000/fps+1,7000/fps+1,8000/fps+1].map(t=>animationFrame(plan,t)),[0,1,7,0]);
 }
 assert.equal(registry.footBaseline,232);
 let frames=0;
 for(const [key,entry] of entries){
  for(const [i,name] of entry.frames.entries()){
   assert.equal(name,key+'_'+String(i+1).padStart(3,'0')+'.png');
   const png=await readFile(new URL('../src/assets/companion/'+key+'/'+name,import.meta.url));
   assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20),png[25]],[256,256,6]);
   frames++;
  }
 }
 assert.equal(frames,89);
 const think=animationPlan(send(initialAnimation(0),'begin',0,{scope:'chat',id:'a'}),0);
 assert.deepEqual([0,167,334,500,667].map(t=>animationFrame(think,t)),[0,1,2,1,0]);
});
