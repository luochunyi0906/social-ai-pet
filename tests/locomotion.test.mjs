import assert from 'node:assert/strict';
import test from 'node:test';
import {climbFrame,gaitFrame,timingFor} from '../src/shared/locomotion.mjs';
import {fallingPosition} from '../desktop/window-drop.mjs';

const forms=['classic','human','fox'];
test('站地的脚和桌面位移抵消，抬脚后回到下一次落脚点',()=>{
 for(const form of forms)for(const movement of ['walk','run']){
  const {cycle,speed}=timingFor(form,movement);
  const dt=cycle*.12;
  const first=gaitFrame(form,movement,0).left;
  const planted=gaitFrame(form,movement,dt).left;
  assert.equal(first.y,0);
  assert.equal(planted.y,0);
  assert.ok(Math.abs(planted.x+speed*dt-first.x)<1e-8);
  assert.ok(gaitFrame(form,movement,cycle*.81).left.y<0);
  assert.deepEqual(gaitFrame(form,movement,cycle),gaitFrame(form,movement,0));
 }
});
test('爬窗每一拍至少一只手维持抓握，抓握时世界坐标不漂移',()=>{
 for(const form of forms){
  const {cycle,speed}=timingFor(form,'climb');
  const start=climbFrame(form,0).left;
  const later=climbFrame(form,cycle*.15).left;
  assert.equal(later.planted,true);
  assert.ok(Math.abs(later.y-speed*cycle*.15-start.y)<1e-8);
  for(let sample=0;sample<100;sample++){
   const {left,right}=climbFrame(form,sample*cycle/100);
   assert.ok(left.planted||right.planted);
  }
  assert.deepEqual(climbFrame(form,cycle),climbFrame(form,0));
 }
});
test('切窗后先向外侧离开窗口，再加速下落并对齐落点',()=>{
 for(const x of [16,192]){
  const start={x:100,y:40},landing={x,y:230};
  assert.deepEqual(fallingPosition(start,landing,0),start);
  assert.deepEqual(fallingPosition(start,landing,1),landing);
  assert.deepEqual(fallingPosition(start,landing,1.2),landing);
  const early=fallingPosition(start,landing,.35);
  const middle=fallingPosition(start,landing,.65);
  assert.ok(Math.abs(early.x-start.x)>.55*Math.abs(x-start.x));
  assert.ok(early.y-start.y<.15*(landing.y-start.y));
  assert.ok(middle.y>early.y&&middle.y<landing.y);
 }
});
