import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import layout from '../desktop/window-layout.cjs';
import {normalize,preferences} from '../desktop/window-preferences.cjs';

const main = {x:0,y:31,width:1500,height:947};
const left = {x:-1280,y:62,width:1280,height:840};

test('桌宠范围使用原生逻辑坐标，营地和拖动手柄都留在屏幕内',()=>{
 const {fitPet,petCenter}=layout;
 assert.deepEqual(fitPet({x:-1000,y:-1000},main),{width:304,height:176,x:0,y:31});
 const right=fitPet({x:2000,y:2000},main);
 assert.equal(right.x+right.width,main.x+main.width);
 assert.equal(right.y+right.height,main.y+main.height);
 const negative=fitPet({x:-1100,y:444},left);
 assert.deepEqual(petCenter(negative),{x:-948,y:532});
 assert.deepEqual(fitPet(negative,main),{x:0,y:444,width:304,height:176});
});
test('营地尺寸超出工作区时取可见边界，对负坐标副屏保持独立位置',()=>{
 assert.deepEqual(layout.fitPanel({x:-700,y:150,width:900,height:740},left),{x:-900,y:150,width:900,height:740});
 assert.deepEqual(layout.fitPanel({x:-700,y:0,width:900,height:740},{x:20,y:22,width:600,height:500}),
  {x:20,y:22,width:600,height:500});
});
test('独立偏好可并发更新、回读，腐损数据按字段回退',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'kanshan-window-pref-'));
 try{
  const config=preferences(dir);await config.read();
  assert.equal(config.get().snow,true);
  config.update({pet:{x:-600,y:31},snow:false});
  const first=config.flush();
  config.update({panel:{x:40,y:85,width:900,height:740}});
  await Promise.all([first,config.flush()]);
  const json=JSON.parse(await readFile(join(dir,'window-preferences.json'),'utf8'));
  assert.deepEqual(json,{version:1,pet:{x:-600,y:31},panel:{x:40,y:85,width:900,height:740},snow:false});
  const reopened=preferences(dir);await reopened.read();
  assert.deepEqual(reopened.get(),json);
  assert.deepEqual(normalize({version:1,pet:{x:'20',y:4},panel:{x:5,y:10,width:0,height:30},snow:false}),{version:1,pet:null,panel:null,snow:false});
  const oldWander={enabled:false,interval:90,distance:75,dwell:4};
  assert.deepEqual(normalize({version:1,wander:oldWander}).wander,{...oldWander,scope:'desktop'});
 }finally{await rm(dir,{recursive:true,force:true});}
});
