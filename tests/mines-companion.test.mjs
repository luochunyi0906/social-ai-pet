import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {hints,describe,neighbors}=require('../desktop/mines-hints.cjs');
const {recognizeBoard}=require('../desktop/mines-board.cjs');
const {outside}=require('../desktop/mines-window-placement.cjs');
const {normalize}=require('../desktop/window-preferences.cjs');

test('visible constraints prove a safe tile even when a different tile carries a mistaken flag',()=>{
 const board={columns:3,rows:2,cells:[0,1,'hidden','flag','hidden','hidden']};
 const proof=hints(board);
 assert.equal(proof.kind,'check');
 assert.deepEqual(proof.clues,[0]);
 assert.match(describe(board,proof,3).text,/检查/);
 assert.equal(describe(board,proof,3).cell,undefined);
});
test('the three hint levels progressively expose the same local conclusion',()=>{
 const board={columns:3,rows:2,cells:[0,1,'hidden',0,1,'hidden']};
 assert.equal(hints(board),null);
 const next={columns:3,rows:2,cells:[0,1,'hidden',0,1,1]};
 const proof=hints(next);
 assert.equal(proof.kind,'mine');
 assert.deepEqual(describe(next,proof,1).area,[]);
 assert.ok(describe(next,proof,2).area.length>0);
 assert.equal(describe(next,proof,2).cell,undefined);
 assert.equal(describe(next,proof,3).cell,2);
});
test('every definite hint is true across all mine layouts consistent with visible clues',()=>{
 const columns=3,rows=3,tileCount=9;
 for(let seed=0;seed<512;seed+=3){
  const neighborCounts=Array.from({length:tileCount},(_,index)=>
   neighbors(index,columns,rows).filter(other=>seed&(1<<other)).length);
  for(let reveal=0;reveal<512;reveal+=13){
   if(seed&reveal)continue;
   const cells=neighborCounts.map((n,index)=>reveal&(1<<index)?n:index%3===1?'flag':'hidden');
   const board={columns,rows,cells};
   const result=hints(board);
   if(!result||result.kind==='check')continue;
   for(let bombs=0;bombs<512;bombs++){
    if(bombs&reveal||!cells.every((n,index)=>!Number.isInteger(n)||
      neighbors(index,columns,rows).filter(other=>bombs&(1<<other)).length===n))continue;
    assert.equal(Boolean(bombs&(1<<result.cell)),result.kind==='mine',JSON.stringify({cells,result,bombs}));
   }
  }
 }
});
test('unknown tiles do not act as empty cells',()=>{
 const board={columns:3,rows:2,cells:[0,'?','hidden','hidden','hidden','hidden']};
 assert.equal(hints(board),null);
});
test('window-side placement never overlaps game and handles negative work-area coordinates',()=>{
 const area={x:-1200,y:22,width:1200,height:780};
 const target={x:-300,y:140,width:295,height:425};
 const fit=outside(target,area,252,238);
 assert.equal(fit.x,-562);
 assert.ok(fit.x+fit.width < target.x);
 assert.equal(outside({x:-1200,y:22,width:1200,height:780},area,252,238),undefined);
});
test('saved automatic-play toggle and bounded calibration survive normalization',()=>{
 assert.deepEqual(normalize({version:1,mines:{enabled:false}}).mines,{enabled:false});
 assert.deepEqual(normalize({version:1,mines:{enabled:true,calibration:{x:0,y:0,width:2,height:.5}}}).mines,{enabled:true});
});
test('non-board content is rejected by lattice validation',()=>{
 const data=new Uint8Array(600*850*4).fill(189);
 assert.equal(recognizeBoard({data,width:600,height:850},300,425),null);
});
