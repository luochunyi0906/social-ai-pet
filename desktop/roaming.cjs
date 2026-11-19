const {fitPanel,gazeNear}=require('./window-layout.cjs');
const {chooseWindowRoute,nearbyWindowPlan,windowFocusTracker}=require('./window-target.cjs');
const SIZE={width:92,height:135};
const FOX_SIZE={width:108,height:145};
const {places:{fox:DESKTOP_ORIGIN}}=require('./pet-layout.json');
const FOX_PADDING=7;
const IDLE_MS=15000;
const SPEED={act_walk:0.22,act_run:0.48};
const AUTO_CLIMB={reach:38,movingScan:550,idleScan:1000,recheck:60,cooldown:20000};
const DEFAULT_WANDER=Object.freeze({enabled:false,scope:'desktop',interval:90,distance:75,dwell:4});

function validWander(value){
 return typeof value?.enabled==='boolean'&&
  (value.scope===undefined||value.scope==='desktop'||value.scope==='nearby')&&
  [['interval',30,900],['distance',30,200],['dwell',1,30]].every(([key,min,max])=>
   Number.isInteger(value[key])&&value[key]>=min&&value[key]<=max);
}

function wanderSettings({enabled,scope='desktop',interval,distance,dwell}){
 return {enabled,scope,interval,distance,dwell};
}

function roaming({create,anchor,cursor,area,areas,publish,delay=IDLE_MS,random=Math.random,readWindow,planWindow,notify=()=>{}}){
 let child,detached=false,held=false,drag,campMoving=false,suspended=false,blocked=false,panel=false,menu=false,position;
 let task;
 let nearby,nearbyPending=false,scanAt=0,checkAt=0,autoAfter=0;
 let wander=DEFAULT_WANDER;
 let appearance={outfitId:'default',sleeping:false,action:'observe'};
 const size=()=>appearance.appearance==='fox'?FOX_SIZE:SIZE;
 const desktopOrigin=()=>({...DESKTOP_ORIGIN,x:DESKTOP_ORIGIN.x-(appearance.appearance==='fox'?FOX_PADDING:0)});
 const home=()=>{
  const position=anchor();
  return {...position,x:position.x+(desktopOrigin().x-DESKTOP_ORIGIN.x)};
 };
 const point=()=>child?.getBounds()??position??home();
 const workArea=box=>area({x:Math.round(box.x+size().width/2),y:Math.round(box.y+size().height/2)});
 const available=()=>!held&&!drag&&!campMoving&&!blocked&&!suspended&&!panel&&!menu;
 function visual(){
  const view={...appearance,action:drag?'lift':task?.motion?'walk':appearance.action==='walk'?'observe':appearance.action};
  if(drag||held||task?.motion||task?.kind==='window'||blocked||panel||suspended)view.daydream=false;
  if(task?.motion)view.motion=task.motion;
  if(task?.walkingGif)view.walkingGif=true;
  if(task?.kind==='window')view.windowPose={phase:task.phase,side:task.plan.side,facing:task.facing};
  if(child&&!child.isDestroyed())child.webContents.send('roam-view',view);
  publish({away:detached,dragging:!!drag,walking:!!task?.motion,
   strolling:task?.kind==='outbound'||task?.kind==='dwell',windowPlaying:task?.kind==='window'});
 }
 function stopTask(){
  if(!task)return false;
  const changed=Boolean(task.motion)||task.kind==='dwell'||task.kind==='window'||task.kind==='chase';
  if(task.kind==='window'){autoAfter=Date.now()+AUTO_CLIMB.cooldown;nearby=undefined;}
  clearTimeout(task.timer);
  clearInterval(task.timer);
  task=undefined;
  return changed;
 }
 function wait(kind,ms,start){
  const next={kind,timer:setTimeout(()=>{
   if(task!==next)return;
   task=undefined;
   if(available())start();
  },ms)};
  task=next;
 }
 function move(target){
  if(!Number.isFinite(target.x)||!Number.isFinite(target.y))return;
  const x=Math.round(target.x),y=Math.round(target.y);
  position={...target,x,y};
  if(child&&!child.isDestroyed())child.setPosition(x,y);
 }
 function dock(){
  stopTask();
  detached=false;position=undefined;
  child?.hide();
  visual();
  arm();
 }
 function animate(target,kind,clip,arrive,bounds,walkingGif=kind==='outbound'){
  let {x,y}=point();
  let last=Date.now();
  const motion={clip,stage:'loop',since:last,until:null,facing:target.x<x?'left':'right'};
  const next={kind,motion,walkingGif,timer:setInterval(()=>{
   if(task!==next||!available())return;
   const dx=target.x-x,dy=target.y-y,distance=Math.hypot(dx,dy);
   const now=Date.now(),step=Math.min(48,now-last)*SPEED[clip];
   last=now;
   if(distance<=step+1){
    stopTask();
    move(target);
    arrive();
    return;
   }
   x+=dx*step/distance;
   y+=dy*step/distance;
   const sample={x:Math.round(x),y:Math.round(y),...size()};
   move(fitPanel(sample,bounds??workArea(sample)));
  },16)};
  task=next;
  visual();
 }
 function startReturn(stroll=false){
  if(!available()||!detached)return;
  if(!child||child.isDestroyed())return dock();
  const here=point(),destination=home();
  const clip=Math.hypot(destination.x-here.x,destination.y-here.y)>workArea(destination).width/2?'act_run':'act_walk';
  animate(destination,'return',clip,dock,undefined,stroll&&clip==='act_walk');
 }
 function nearbyDestination(origin,bounds){
  const distance=wander.distance*(0.7+random()*0.3);
  const angle=random()*Math.PI*2;
  const candidates=Array.from({length:8},(_,i)=>{
   const direction=angle+i*Math.PI/4;
   const target={x:origin.x+Math.cos(direction)*distance,y:origin.y+Math.sin(direction)*distance,...size()};
   return fitPanel(target,bounds);
  });
  // Skip edge-facing targets with too little room instead of nudging back and forth.
  return candidates.find(p=>Math.hypot(p.x-origin.x,p.y-origin.y)>=distance*0.65);
 }
 function desktopDestination(origin,workAreas){
  const {width,height}=size();
  const candidates=workAreas.flatMap(bounds=>{
   const spanX=Math.max(0,bounds.width-width),spanY=Math.max(0,bounds.height-height);
   const farEnough=Math.min(240,Math.hypot(spanX,spanY)*0.36);
   const randomPoints=Array.from({length:4},()=>[random(),random()]);
   return [...randomPoints,[0,0],[1,0],[0,1],[1,1]]
    .map(([x,y])=>({x:Math.round(bounds.x+x*spanX),y:Math.round(bounds.y+y*spanY)}))
    .filter(point=>Math.hypot(point.x-origin.x,point.y-origin.y)>farEnough);
  });
  return candidates[Math.floor(random()*candidates.length)];
 }
 function startStroll(){
  if(!available()||detached||!wander.enabled)return;
  const origin=home(),bounds=workArea(origin);
  const fullDesktop=wander.scope==='desktop';
  const target=fullDesktop?desktopDestination(origin,areas?.()??[bounds]):nearbyDestination(origin,bounds);
  if(!target){arm();return;}
  detachAt(origin);
  animate(target,'outbound','act_walk',()=>{
   wait('dwell',wander.dwell*1000,()=>startReturn(true));
   visual();
  },fullDesktop?undefined:bounds);
 }
 function canClimb(){
  if(appearance.appearance==='fox')return !appearance.caveOutfit||appearance.weather?.everyday===true;
  return (!appearance.appearance||appearance.appearance==='classic')&&appearance.outfitId==='default';
 }
 const startPoint=()=>detached?point():home();
 const canAutoClimb=()=>available()&&canClimb()&&!appearance.autoClimbBlocked&&
  task?.kind!=='window'&&task?.kind!=='chase'&&Date.now()>=autoAfter;
 function scanNearby(){
  if(!readWindow||!planWindow||!canAutoClimb())return;
  const now=Date.now();
  if(now>=scanAt&&!nearbyPending){
   nearbyPending=true;
   scanAt=now+(task?.motion?AUTO_CLIMB.movingScan:AUTO_CLIMB.idleScan);
   void readWindow().then(snapshot=>{
    if(canAutoClimb())nearby={snapshot,expires:Date.now()+AUTO_CLIMB.idleScan};
   }).catch(()=>{nearby=undefined;}).finally(()=>{nearbyPending=false;});
  }
  if(!nearby||now>nearby.expires||now<checkAt)return;
  checkAt=now+AUTO_CLIMB.recheck;
  const start=startPoint();
  const form=appearance.appearance;
  const route=chooseWindowRoute(nearby.snapshot,start,size(),form,planWindow,AUTO_CLIMB.reach);
  if(route)startWindow(nearby.snapshot,route,start,form,true);
 }
 async function playWindow(){
  if(!available()||!canClimb())return '请在普通桌面模式使用默认装扮的原版狐形或狐狸 Q 版。';
  if(!readWindow||!planWindow||task?.kind==='window'||task?.kind==='chase')return '当前无法进入窗口互动。';
  const snapshot=await readWindow();
  if(!available()||task?.kind==='window'||task?.kind==='chase'||!canClimb())
   return '角色当前无法开始窗口互动。';
  const form=appearance.appearance;
  const start=startPoint();
  const route=chooseWindowRoute(snapshot,start,size(),form,planWindow);
  if(!route)return snapshot.candidate||snapshot.candidates?.length
   ?'可见窗口的边缘或上方空间不足。请把一个普通窗口放到屏幕中间，上方留约一个桌宠的高度。'
   :'没找到可见的普通应用窗口。请打开一个 Finder 窗口再试。';
  startWindow(snapshot,route,start,form);
  return null;
 }
 function startWindow(snapshot,route,start,form,automatic=false){
  const {target,plan}=route;
  const focusSwitched=windowFocusTracker(snapshot,target);
  nearby=undefined;
  stopTask();
  detachAt(home());
  const sequence={kind:'window',plan,phase:'look',facing:plan.approach.x<start.x?'left':'right',
   started:Date.now(),last:Date.now(),scan:0,checking:false};
  let from={x:start.x,y:start.y};
  let approachPosition=from;
  let landing;
  const step=(next)=>{
   const here=approachPosition;
   const dx=next.x-here.x,dy=next.y-here.y;
   const distance=Math.hypot(dx,dy);
   const speed=Math.max(4,Math.min(14,(Date.now()-sequence.last)*.22));
   if(distance<=speed){move(next);return true;}
   approachPosition={x:here.x+dx*speed/distance,y:here.y+dy*speed/distance};
   const sample={...approachPosition,...size()};
   move(fitPanel(sample,workArea(sample)));
   return false;
  };
  function stage(phase){
   const here=point();
   from={x:here.x,y:here.y};
   sequence.phase=phase;
   if(phase==='approach')approachPosition=from;
   if(phase==='perch')sequence.facing=undefined;
   if(phase==='walk-away')sequence.facing=plan.side?'right':'left';
   sequence.started=Date.now();
   visual();
  }
  function lost(){
   if(sequence.phase==='approach'||sequence.phase==='look'){
    arm();
    if(!automatic)notify('目标窗口已切换或移出了可攀爬范围。保留窗口在前台后，可以再试一次。');
    return;
   }
   if(!['climb','pull','perch'].includes(sequence.phase))return;
   const here=point();
   landing=fitPanel({x:sequence.plan.approach.x+(sequence.plan.side?22:-22),
    y:Math.min(here.y+200,sequence.plan.approach.y+25),...size()},workArea(here));
   stage('balance');
  }
  function scan(){
   sequence.scan=Date.now();
   sequence.checking=true;
   void readWindow(target.id).then(value=>{
    if(task!==sequence||!['look','approach','climb','pull','perch'].includes(sequence.phase))return;
    let current=planWindow(value.target,size(),plan.side,form);
    if(automatic&&['look','approach'].includes(sequence.phase))
     current=nearbyWindowPlan(current,point(),AUTO_CLIMB.reach);
    if(!current||focusSwitched(value)){lost();return;}
    sequence.plan=current;
   }).catch(()=>{if(task===sequence)lost();}).finally(()=>{sequence.checking=false;});
  }
  function frame(){
   if(task!==sequence)return;
   const time=Date.now(),elapsed=time-sequence.started;
   const {area,approach,climb,perch}=sequence.plan;
   if(['look','approach','climb','pull','perch'].includes(sequence.phase)&&!sequence.checking&&time-sequence.scan>=350)scan();
   const interpolate=(destination,duration,arc=0)=>{
    const fraction=Math.min(1,elapsed/duration);
    move(fitPanel({x:from.x+(destination.x-from.x)*fraction,
     y:from.y+(destination.y-from.y)*fraction-arc*Math.sin(fraction*Math.PI),...size()},area));
    return fraction===1;
   };
   switch(sequence.phase){
    case 'look':if(elapsed>=550)stage('approach');break;
    case 'approach':if(step(approach))stage('climb');break;
    case 'climb':if(interpolate(climb,Math.max(1100,Math.abs(from.y-climb.y)*5)))stage('pull');break;
    case 'pull':if(interpolate(perch,650,15))stage('perch');break;
    case 'perch':move(fitPanel({...perch,...size()},area));break;
    case 'balance':if(elapsed>=320)stage('fall');break;
    case 'fall':if(interpolate(landing,720,35))stage('land');break;
    case 'land':if(elapsed>=350)stage('shake');break;
    case 'shake':if(elapsed>=700)stage('walk-away');break;
    case 'walk-away':if(interpolate(fitPanel({x:from.x+(plan.side?35:-35),y:from.y,...size()},area),650)){arm();visual();}break;
   }
   sequence.last=time;
  }
  task=sequence;
  sequence.timer=setInterval(frame,16);
  visual();
 }
 function chase(){
  if(!available()||task?.kind==='window'||task?.kind==='chase')return;
  stopTask();
  detachAt(home());
  const until=Date.now()+4000;
  const next={kind:'chase',motion:{clip:'act_walk',stage:'loop',since:Date.now(),until:null,facing:'right'}};
  next.timer=setInterval(()=>{
   if(task!==next)return;
   if(Date.now()>=until){arm();visual();return;}
   const here=point(),p=cursor(),bounds=area(p);
   const target=fitPanel({x:p.x-size().width*.55,y:p.y-size().height*.68,...size()},bounds);
   const dx=target.x-here.x,dy=target.y-here.y,distance=Math.hypot(dx,dy);
   if(distance<5)return;
   const facing=dx<0?'left':'right';
   if(facing!==next.motion.facing){next.motion={...next.motion,facing};visual();}
   move(fitPanel({x:here.x+dx*Math.min(1,8/distance),y:here.y+dy*Math.min(1,8/distance),...size()},bounds));
  },16);
  task=next;visual();
 }
 function arm(){
  if(stopTask())visual();
  if(!available())return;
  if(detached)wait('manual-wait',delay,startReturn);
  else if(wander.enabled)wait('cooldown',wander.interval*1000,startStroll);
 }
 function window(){
  if(child&&!child.isDestroyed())return child;
  const start=position??home();
  child=create({...start,...size()});
  child.webContents.on('did-finish-load',()=>{
   visual();
   if(detached&&!suspended)child.showInactive();
  });
  child.on('closed',()=>{child=undefined;finish(false);dock();});
  return child;
 }
 function detachAt(home){
  if(detached)return;
  position=home;
  detached=true;
  const overlay=window();
  move(home);
  if(!overlay.webContents.isLoadingMainFrame())overlay.showInactive();
 }
 function beginCampDrag(){
  if(drag)return false;
  campMoving=true;
  stopTask();
  detachAt(home());
  visual();
  return true;
 }
 function endCampDrag(){
  campMoving=false;
  arm();
 }
 function sample(){
  const p=cursor();
  move(fitPanel({x:p.x-drag.x,y:p.y-drag.y,...size()},area(p)));
 }
 function start(payload,fromChild){
  if(drag||campMoving||suspended||detached!==fromChild||!Number.isFinite(payload.x)||!Number.isFinite(payload.y))return false;
  const origin=fromChild?{x:0,y:0}:desktopOrigin();
  if(payload.x<origin.x||payload.x>origin.x+size().width||payload.y<origin.y||payload.y>origin.y+size().height)return false;
  stopTask();held=false;
  detachAt(home());
  const overlay=window();
  overlay.setIgnoreMouseEvents(!fromChild,{forward:true});
  if(!overlay.webContents.isLoadingMainFrame())overlay.showInactive();
  drag={x:payload.x-origin.x,y:payload.y-origin.y,timer:setInterval(sample,16),watchdog:setTimeout(()=>finish(false),45000)};
  sample();visual();
  return true;
 }
 function finish(finalSample){
  if(!drag)return false;
  if(finalSample)sample();
  clearInterval(drag.timer);clearTimeout(drag.watchdog);drag=undefined;
  if(child&&!child.isDestroyed())child.setIgnoreMouseEvents(true,{forward:true});
  visual();arm();
  return true;
 }
 function press(value){
  if(drag||held===value)return;
  held=value;
  arm();
 }
 function block(value){
  if(blocked===value)return;
  blocked=value;arm();
 }
 function suspend(value){
  if(suspended===value)return;
  suspended=value;
  if(value){held=false;finish(false);child?.hide();}
  else if(detached)child?.showInactive();
  arm();
 }
 function probe(id){
  if(!detached||!child||suspended||drag||held||menu||!child.isVisible())return;
  const p=cursor(),bounds=child.getBounds();
  const x=p.x-bounds.x,y=p.y-bounds.y;
  if(x<0||y<0||x>=bounds.width||y>=bounds.height){
   child.setIgnoreMouseEvents(true,{forward:true});
   if(gazeNear(bounds,x,y))child.webContents.send('pointer-probe',{id:0,x,y});
   return;
  }
  child.webContents.send('pointer-probe',{id,x,y});
 }
 return {
  get child(){return child;},get away(){return detached;},get dragging(){return !!drag;},
  playWindow,scanNearby,chase,stopChase(){if(task?.kind==='chase'){arm();visual();}},get special(){return task?.kind==='window'||task?.kind==='chase';},
  start,finish,beginCampDrag,endCampDrag,press,block,suspend,probe,visual,
  setPanel(value){if(panel!==value){panel=value;arm();}},
  setMenu(value){if(menu!==value){menu=value;if(task?.kind!=='window')arm();}},
  configure(value){wander=wanderSettings(value);arm();},
  update(view,stop){
   const previousSize=size();
   appearance=view;
   if(child&&!child.isDestroyed()&&previousSize!==size()){
    const here=point();
    const offset=size()===FOX_SIZE?-FOX_PADDING:FOX_PADDING;
    const bounds=fitPanel({...here,x:here.x+offset,...size()},workArea(here));
    child.setBounds(bounds);
    position=bounds;
   }
   block(stop);visual();
  },
  hit(active){if(child&&!suspended&&!held&&!drag&&!menu)child.setIgnoreMouseEvents(!active,{forward:true});},
  reconcile(){
   nearby=undefined;
   if(detached){
    finish(false);
    const here=point(),area=workArea(here);
    move(fitPanel({...here,...size()},area));
    if(task?.kind==='window'){
     task.plan={...task.plan,area};
     task.scan=0;
     return;
    }
   }
   arm();
  },
  dispose(){suspended=true;finish(false);stopTask();child?.destroy();}
 };
}
module.exports={roaming,DEFAULT_WANDER,validWander,wanderSettings};
