import test from 'node:test';
import assert from 'node:assert/strict';
import weather from '../desktop/weather.cjs';
import {chooseWindowRoute,windowFocusTracker,windowPlan} from '../desktop/window-target.cjs';
import {shakeDetector} from '../src/shared/mouse-gesture.mjs';
const {parseWeather,climate,RULES,weatherController}=weather;
const time=Date.now();
const units={apparent_temperature:'°C',rain:'mm',showers:'mm',weather_code:'wmo code'};
test('天气识别单位、有效时间、独立阈值、不同样本和过期',()=>{
 const parsed=parseWeather({current_units:units,current:{time:time/1000,interval:900,rain:.05,showers:0,
  apparent_temperature:14,weather_code:0,is_day:1,uv_index:8}},time);
 assert.equal(parsed.liquid,.2);
 const state=climate();
 state.push(parsed,time);
 assert.deepEqual(state.target(time),{clothing:'normal',umbrella:true,glasses:false});
 const clear={...parsed,time:time+1000,liquid:0,feels:18};
 state.push(clear,clear.time);
 state.push(clear,clear.time);
 assert.deepEqual(state.target(clear.time),{clothing:'normal',umbrella:true,glasses:false});
 state.push({...clear,time:clear.time+1000},clear.time+1000);
 assert.deepEqual(state.target(clear.time+1000),{clothing:'normal',umbrella:false,glasses:true});
 state.push({time:clear.time+2000,day:false},clear.time+2000);
 assert.equal(state.target(clear.time+2000).glasses,false);
 assert.equal(state.target(time+RULES.stale+4000).clothing,'normal');
 const wet=climate();
 wet.push(parsed,time);
 assert.deepEqual(wet.target(time+RULES.stale+1),{clothing:'normal',umbrella:false,glasses:false});
 assert.equal(parseWeather({current_units:units,current:{time:time/1000,rain:.05}},time).liquid,undefined);
});
test('低温保留日常立绘，约 20 度标记温和天气，降雨和强日照独立',()=>{
 const mild={time,feels:20,liquid:0,code:1,day:true,uv:2};
 for(const [sample,expected] of [
  [mild,true],
  [{...mild,feels:-12},undefined],
  [{...mild,code:61},undefined],
  [{...mild,code:73},undefined],
  [{...mild,uv:8},undefined],
 ]){
  const state=climate();
  state.push(sample,time);
  assert.equal(state.target(time).everyday,expected);
  assert.equal(state.target(time).clothing,'normal');
 }
});
test('桌面气温独立于自动换装，保留失败前观测并拒绝过期或异城读数',async()=>{
 let now=time,offline=false;
 const controller=weatherController({
  now:()=>now,
  publish:()=>{},
  request:async city=>{
   if(offline)throw Error('offline');
   return {current_units:{...units,temperature_2m:'°C'},current:{time:now/1000,interval:900,
    temperature_2m:city==='hong-kong'?20.4:0,apparent_temperature:19,weather_code:2,is_day:1,rain:0,showers:0,uv_index:2}};
  }
 });
 try{
  controller.configure({enabled:false,city:'hong-kong'});
  await Promise.resolve();
  assert.equal(controller.state().observation.temperature,20.4);
  assert.equal(controller.state().look.everyday,undefined);
  controller.configure({enabled:true,city:'hong-kong'});
  await Promise.resolve();
  assert.equal(controller.state().look.everyday,true);
  controller.configure({enabled:false,city:'hong-kong'});
  assert.equal(controller.state().look.everyday,undefined);
  offline=true;
  await controller.refresh();
  assert.equal(controller.state().observation.temperature,20.4);
  now+=RULES.stale+1;
  assert.equal(controller.state().observation,undefined);
  offline=false;
  controller.configure({enabled:false,city:'harbin'});
  assert.equal(controller.state().observation,undefined);
  await Promise.resolve();
  assert.equal(controller.state().observation.temperature,0);
 }finally{controller.stop();}
 assert.equal(parseWeather({current_units:{temperature_2m:'°F'},current:{time:time/1000,temperature_2m:68}},time).temperature,undefined);
});
test('鼠标慢移和直线不触发，足量变向只产生一个抽样事件',()=>{
 const straight=shakeDetector();
 for(let i=0;i<22;i++)assert.equal(straight.sample(i*38,100,i*60),false);
 const slow=shakeDetector();
 for(let i=0;i<22;i++)assert.equal(slow.sample(i%2*12,100,60*i),false);
 const zigzag=shakeDetector();
 const points=[{x:10,y:20},{x:105,y:20},{x:10,y:20},{x:105,y:20},{x:10,y:20},{x:105,y:20}];
 assert.deepEqual(points.map((p,i)=>zigzag.sample(p.x,p.y,i*100)),[false,false,false,false,false,true]);
 assert.equal(zigzag.sample(0,0,900),false);
});
test('真实窗口几何支持负坐标、顶部和全屏过滤',()=>{
 const display={bounds:{x:-1440,y:0,width:1440,height:900},workArea:{x:-1440,y:24,width:1440,height:820}};
 const size={width:92,height:135};
 const window={x:-1090,y:240,width:500,height:440};
 const plan=windowPlan(window,display,size);
 assert.ok(plan.perch.y>=display.workArea.y);
 assert.equal(windowPlan({...window,y:40},display,size),undefined);
 assert.equal(windowPlan(display.bounds,display,size),undefined);
});

test('略过空间不足或被遮住的前层窗口，走向露出并较近的一侧',()=>{
 const bounds={x:0,y:0,width:1400,height:950};
 const display={bounds,workArea:{x:0,y:24,width:1400,height:900}};
 const size={width:108,height:145};
 const foreground={id:1,pid:31,x:450,y:50,width:490,height:400};
 const covered={id:2,pid:32,x:470,y:260,width:440,height:340};
 const suitable={id:3,pid:33,x:550,y:495,width:490,height:300};
 const plan=(target,pet,side,form)=>windowPlan(target,display,pet,side,form);
 const route=chooseWindowRoute({front:foreground,candidates:[foreground,covered,suitable]},
  {x:90,y:740},size,'fox',plan);
 assert.equal(route.target.id,suitable.id);
 assert.equal(route.plan.side,1);
 assert.equal(chooseWindowRoute({front:suitable,candidates:[suitable]},
  {x:90,y:740},size,'fox',plan).plan.side,0);
 assert.equal(chooseWindowRoute({front:foreground,candidates:[foreground,covered]},
  {x:90,y:740},size,'fox',plan),undefined);
});

test('候补窗口不因原前台窗口或桌宠菜单而中断，真实切窗才触发',()=>{
 const front={pid:31,id:1};
 const target={pid:32,id:2};
 const track=windowFocusTracker({selfActive:true,candidates:[front,target]},target);
 assert.equal(track({activePID:front.pid,front}),false);
 assert.equal(track({activePID:99,selfActive:true}),false);
 assert.equal(track({activePID:front.pid,front}),false);
 assert.equal(track({activePID:target.pid,front:target}),false);
 assert.equal(track({activePID:target.pid,front:{pid:target.pid,id:3}}),true);
 const fallback=windowFocusTracker({activePID:front.pid,front},target);
 assert.equal(fallback({activePID:front.pid,front}),false);
 assert.equal(fallback({activePID:44}),true);
});

test('靠近可见窗口的中段侧边，自行开始攀爬并在离开后冷却',async({mock})=>{
 const {roaming}=await import('../desktop/roaming.cjs');
 mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:0});
 const workArea={x:0,y:24,width:1400,height:900};
 const display={bounds:{x:0,y:0,width:1400,height:950},workArea};
 const target={id:2,pid:42,x:550,y:290,width:450,height:420};
 const home={x:110,y:430};
 let current,view,moves=0;
 const controller=roaming({
  anchor:()=>home,cursor:()=>home,area:()=>workArea,publish:()=>{},
  readWindow:async()=>({activePID:42,front:target,target,candidates:[target]}),
  planWindow:(window,size,side,form)=>windowPlan(window,display,size,side,form),
  create(initial){
   current=initial;
   return {getBounds:()=>current,isDestroyed:()=>false,showInactive(){},hide(){},destroy(){},on(){},
    setPosition(x,y){moves++;current={...current,x,y};},
    webContents:{on(){},isLoadingMainFrame:()=>false,send(_event,value){view=value;}}};
  }
 });
 try{
  const outfit={appearance:'fox',outfitId:'default',weather:{clothing:'normal',umbrella:true}};
  const settle=async()=>{for(let n=0;n<3;n++)await Promise.resolve();};
  controller.update(outfit,false);
  controller.scanNearby();await settle();
  controller.scanNearby();
  assert.equal(controller.away,false);
  home.x=468;
  mock.timers.tick(80);
  controller.update(outfit,true);
  controller.scanNearby();
  assert.equal(controller.away,false);
  controller.update(outfit,false);
  controller.scanNearby();
  assert.equal(view.windowPose.phase,'look');
  assert.equal(view.windowPose.side,0);
  for(let n=0;n<70;n++){mock.timers.tick(16);await settle();}
  assert.equal(view.windowPose.phase,'climb');
  assert.ok(moves>1);
  controller.press(true);
  controller.press(false);
  controller.scanNearby();
  assert.equal(view.windowPose,undefined);
 }finally{controller.dispose();}
});

test('窗口移动统一取整，显示器事件不会取消绑定序列',async({mock})=>{
 const {roaming}=await import('../desktop/roaming.cjs');
 mock.timers.enable({apis:['Date','setTimeout','setInterval'],now:0});
 let bounds,view;
 const display={x:0,y:0,width:1200,height:900};
 const targets={side:1,area:display,approach:{x:110,y:20.5},climb:{x:110,y:16.5},perch:{x:104,y:10.5}};
 const controller=roaming({
  anchor:()=>({x:105,y:20}),cursor:()=>({x:105,y:20}),area:()=>display,publish:()=>{},
  readWindow:async()=>({candidate:{id:1,pid:42},target:{id:1,pid:42},activePID:42}),
  planWindow:()=>targets,
  create(initial){
   bounds=initial;
   return {getBounds:()=>bounds,isDestroyed:()=>false,showInactive(){},hide(){},destroy(){},on(){},
    setPosition(x,y){assert.ok(Number.isInteger(x)&&Number.isInteger(y));bounds={...bounds,x,y};},
    webContents:{on(){},isLoadingMainFrame:()=>false,send(_event,value){view=value;}}};
  }
 });
 try{
  await controller.playWindow();
  assert.equal(view.windowPose.phase,'look');
  controller.reconcile();
  assert.equal(controller.special,true);
  for(let i=0;i<45;i++)mock.timers.tick(16);
  assert.equal(view.windowPose.phase,'climb');
 }finally{controller.dispose();}
});
