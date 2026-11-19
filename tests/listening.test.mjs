import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import host from '../desktop/listening.cjs';

test('耳机输出需要稳定有效的切换，重复事件及手动结束不会再次自动戴上',context=>{
 context.mock.timers.enable({apis:['setTimeout']});
 let updates=[];
 const activity=host.listening(value=>updates.push(value),{delay:420});
 const headphones={device:32,output:'headphones'};
 const speakers={device:14,output:'other'};
 try{
  activity.receive(speakers);
  activity.receive(headphones);
  context.mock.timers.tick(200);
  activity.receive(speakers);
  context.mock.timers.tick(420);
  assert.equal(activity.snapshot().mode,'off');
  activity.receive(headphones);
  assert.equal(activity.snapshot().output,'headphones');
  assert.equal(activity.snapshot().mode,'off');
  context.mock.timers.tick(420);
  assert.equal(activity.snapshot().mode,'auto');
  assert.equal(activity.snapshot().cue,1);
  for(let i=0;i<4;i++)activity.receive(headphones);
  context.mock.timers.tick(500);
  assert.equal(updates.filter(value=>value.mode==='auto').length,1);
  activity.choose('off');
  activity.receive(headphones);
  context.mock.timers.tick(450);
  assert.equal(activity.snapshot().mode,'off');
  activity.receive(speakers);
  context.mock.timers.tick(420);
  activity.receive(headphones);
  context.mock.timers.tick(420);
  assert.equal(activity.snapshot().cue,2);
  const lastRoute=activity.snapshot().route;
  activity.receive(speakers);
  assert.equal(activity.snapshot().route,lastRoute+1);
  context.mock.timers.tick(420);
  assert.equal(activity.snapshot().mode,'off');
 }finally{activity.stop();}
});

test('无法确定设备类型时可手动陪听，操作与默认输出字段分开',context=>{
 context.mock.timers.enable({apis:['setTimeout']});
 const activity=host.listening(()=>{});
 try{
  activity.receive({device:17,output:'unknown'});
  activity.choose('manual');
  context.mock.timers.tick(1000);
  assert.equal(activity.snapshot().output,'unknown');
  assert.equal(activity.snapshot().mode,'manual');
  assert.equal(activity.snapshot().cue,1);
  assert.throws(()=>activity.choose('auto'));
  assert.equal(activity.choose('off').mode,'off');
 }finally{activity.stop();}
});
