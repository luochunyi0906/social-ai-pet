import test from 'node:test';
import assert from 'node:assert/strict';
import {roaming} from '../desktop/roaming.cjs';
import {DEFAULT_PLACES} from '../src/shared/layout.mjs';
import layout from '../desktop/pet-layout.json' with {type:'json'};
const {artX,artY,width:roamWidth,height:roamHeight}=layout.roam.standard;

test('全桌面选点可跨逻辑显示器，巡游和归位时窗口保持可见',({mock})=>{
 mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:0});
 const displays=[{x:0,y:0,width:420,height:360},{x:420,y:0,width:500,height:360}];
 const origin={x:106,y:10};
 const visits=[];
 let bounds,view;
 const pet=roaming({
  anchor:()=>origin,cursor:()=>origin,area:point=>displays[point.x>=420?1:0],areas:()=>displays,
  publish:()=>{},random:()=>0.9999,
  create(initial){
   bounds=initial;
   return {getBounds:()=>bounds,setPosition(x,y){bounds={...bounds,x,y};visits.push(bounds);},
    isDestroyed:()=>false,setIgnoreMouseEvents(){},showInactive(){},hide(){},on(){},destroy(){},
    webContents:{send:(_,payload)=>{view=payload;},on(){},isLoadingMainFrame:()=>false}};
  }
 });
 try{
  pet.configure({enabled:true,scope:'desktop',interval:30,distance:75,dwell:1});
  mock.timers.tick(30000);
  assert.equal(view.motion.clip,'act_walk');
  for(let i=0;i<1000&&bounds.x<displays[1].x;i++)mock.timers.tick(16);
  assert.ok(bounds.x>=displays[1].x);
  for(let i=0;i<1500&&pet.away;i++)mock.timers.tick(16);
  assert.equal(pet.away,false);
  assert.deepEqual({x:bounds.x+artX,y:bounds.y+artY},origin);
  assert.ok(visits.every(rect=>displays.some(screen=>rect.x>=screen.x&&rect.y>=screen.y&&
   rect.x+rect.width<=screen.x+screen.width&&rect.y+rect.height<=screen.y+screen.height)));
 }finally{pet.dispose();}
});

test('归位距离等于半个工作区宽度仍走，超过才跑；新拖动停止跑步',({mock})=>{
 mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:0});
 const anchor={x:100,y:100};
 let cursor={x:100,y:100},box,view;
 const pet=roaming({
  anchor:()=>anchor,
  cursor:()=>cursor,
  area:()=>({x:0,y:0,width:1000,height:800}),
  publish:()=>{},
  create(bounds){
   box=bounds;
   return {
    getBounds:()=>box,setPosition:(x,y)=>{box={...box,x,y};},
    isDestroyed:()=>false,setIgnoreMouseEvents(){},showInactive(){},hide(){},on(){},destroy(){},
    webContents:{send:(_,payload)=>{view=payload;},on(){},isLoadingMainFrame:()=>false}
   };
  }
 });
 try{
  cursor={x:600,y:100};
  assert.equal(pet.start(DEFAULT_PLACES.fox,false),true);
  pet.finish(true);
  mock.timers.tick(14999);
  assert.equal(view.motion,undefined);
  mock.timers.tick(1);
  assert.equal(view.motion.clip,'act_walk');
  assert.equal(view.motion.facing,'left');
  assert.equal(view.walkingGif,undefined);

  cursor={x:601,y:100};
  assert.equal(pet.start({x:0,y:0},true),true);
  pet.finish(true);
  mock.timers.tick(15000);
  assert.equal(view.motion.clip,'act_run');

  const before={...box};
  assert.equal(pet.beginCampDrag(),true);
  assert.equal(view.motion,undefined);
  anchor.x=680;
  mock.timers.tick(30000);
  assert.deepEqual(box,before);
  pet.endCampDrag();
  mock.timers.tick(15000);
  assert.equal(view.motion.clip,'act_walk');
  assert.equal(view.motion.facing,'right');
 }finally{
  pet.dispose();
 }
});

test('散步在实际边界内转向，停留后归位、冷却；前台、菜单和模式抢占并重新等待',({mock})=>{
 mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:0});
 const anchor={x:308,y:35};
 let bounds={x:0,y:0,width:400,height:360};
 let point,view,visible;
 const positions=[];
 const pet=roaming({anchor:()=>anchor,cursor:()=>({x:260,y:90}),area:()=>bounds,random:()=>0,
  publish:()=>{},create(box){
   point=box;
   return {getBounds:()=>point,setPosition(x,y){point={...point,x,y};positions.push(point);},
    isDestroyed:()=>false,setIgnoreMouseEvents(){},showInactive(){visible=true;},hide(){visible=false;},
    on(){},destroy(){},webContents:{send:(_,payload)=>{view=payload;},on(){},isLoadingMainFrame:()=>false}};
  }
 });
 const prefs={enabled:true,scope:'nearby',interval:30,distance:75,dwell:2};
 const tick=(ms)=>{for(let i=0;i<ms/16;i++)mock.timers.tick(16);};
 try{
  pet.configure(prefs);
  mock.timers.tick(29999);
  assert.equal(pet.away,false);
  mock.timers.tick(1);
  assert.equal(view.motion.clip,'act_walk');
  assert.equal(view.walkingGif,true);
  assert.equal(visible,true);
  tick(1100);
  assert.equal(view.motion,undefined);
  assert.equal(view.walkingGif,undefined);
  assert.ok(Math.hypot(point.x-anchor.x,point.y-anchor.y)>30);
  assert.ok(positions.every(p=>p.x>=0&&p.x+roamWidth<=400&&p.y>=0&&p.y+roamHeight<=360));

  const stopped={...point};
  pet.setMenu(true);
  mock.timers.tick(18000);
  assert.deepEqual(point,stopped);
  pet.setPanel(true);
  pet.setMenu(false);
  mock.timers.tick(18000);
  assert.deepEqual(point,stopped);
  pet.update({sleeping:false,action:'rest'},true);
  pet.setPanel(false);
  mock.timers.tick(30000);
  assert.deepEqual(point,stopped);
  pet.update({sleeping:true,action:'sleep'},true);
  mock.timers.tick(30000);
  assert.deepEqual(point,stopped);
  pet.update({sleeping:false,action:'observe'},false);
  mock.timers.tick(14999);
  assert.deepEqual(point,stopped);
  mock.timers.tick(1);
  assert.equal(view.motion.clip,'act_walk');
  tick(1000);
  assert.equal(visible,false);
  mock.timers.tick(25000);
  assert.equal(pet.away,false);
  // Press near the next departure, then disable roaming while away.
  pet.press(true);
  mock.timers.tick(10000);
  assert.equal(pet.away,false);
  pet.press(false);
  mock.timers.tick(30000);
  tick(500);
  pet.configure({...prefs,enabled:false});
  mock.timers.tick(5000);
  assert.equal(view.motion,undefined);
  bounds={x:0,y:0,width:280,height:250};
  anchor.x=120;
  pet.reconcile();
  assert.ok(point.x+roamWidth<=280&&point.y+roamHeight<=250);
 }finally{pet.dispose();}
});

test('自主散步停留后用同一走路节奏归位，再恢复待机',({mock})=>{
 mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:0});
 const anchor={x:100,y:100};
 let position,view;
 const pet=roaming({anchor:()=>anchor,cursor:()=>anchor,area:()=>({x:0,y:0,width:800,height:600}),
  random:()=>0,publish(){},create(box){
   position=box;
   return {getBounds:()=>position,setPosition:(x,y)=>{position={...position,x,y};},
    isDestroyed:()=>false,showInactive(){},hide(){},on(){},destroy(){},
    webContents:{send:(_,payload)=>{view=payload;},on(){},isLoadingMainFrame:()=>false}};
  }
 });
 const advance=ms=>{for(let elapsed=0;elapsed<ms;elapsed+=16)mock.timers.tick(16);};
 try{
  pet.configure({enabled:true,scope:'nearby',interval:30,distance:75,dwell:2});
  mock.timers.tick(30000);
  assert.equal(view.walkingGif,true);
  assert.equal(view.motion.facing,'right');
  advance(850);
  assert.equal(view.walkingGif,undefined);
  advance(2000);
  assert.equal(view.walkingGif,true);
  assert.equal(view.motion.facing,'left');
  advance(850);
  assert.equal(view.motion,undefined);
  assert.equal(pet.away,false);
 }finally{pet.dispose();}
});

test('一次自主散步按散步停留时长返回，独立于手动拖离计时',({mock})=>{
 mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:0});
 let point,state;
 const pet=roaming({anchor:()=>({x:140,y:80}), cursor:()=>({x:140,y:80}),
  area:()=>({x:0,y:0,width:500,height:480}),random:()=>0,
  publish:value=>{state=value;},create(box){
   point=box;
   return {getBounds:()=>point,setPosition(x,y){point={...point,x,y};},isDestroyed:()=>false,
    setIgnoreMouseEvents(){},showInactive(){},hide(){},on(){},destroy(){},
    webContents:{send(){},on(){},isLoadingMainFrame:()=>false}};
  }
 });
 try{
  pet.configure({enabled:true,scope:'nearby',interval:30,distance:75,dwell:1});
  mock.timers.tick(30000);
  assert.equal(state.strolling,true);
  for(let i=0;i<190;i++)mock.timers.tick(16);
  assert.equal(state.away,false);
  assert.equal(state.strolling,false);
  mock.timers.tick(15000);
  assert.equal(state.away,false);
 }finally{pet.dispose();}
});
