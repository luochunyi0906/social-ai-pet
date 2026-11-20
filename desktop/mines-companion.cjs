const {execFile,spawn}=require('node:child_process');
const {promisify}=require('node:util');
const {createInterface}=require('node:readline');
const path=require('node:path');
const {recognizeBoard}=require('./mines-board.cjs');
const {hints,describe}=require('./mines-hints.cjs');
const target=require('./minesweeper-target.json');
const run=promisify(execFile);

function minesCompanion({settings,save,permitted,publish,show,hide,permission,explain,selfPID=process.pid,clock=Date.now}){
 const helper=path.join(__dirname,'native','mines-window');
 let watcher,refresh,timer,running=false,enabled=false,locked=false,session,deniedRun,mutedRun,welcomedRun;
 let view={status:'idle',enabled:true},calibration,request,generation=0,active=false,missingPermission=false;
 const update=(status,fields={})=>{
  const next={...fields,status,enabled:settings().enabled,needsPermission:missingPermission||undefined};
  if(JSON.stringify(next)===JSON.stringify(view))return;
  view=next;
  publish(next);
 };
 const abort=()=>{generation++;request?.abort();request=undefined;};
 function drop(status,keep=false){
  abort();
  if(active||['ready','locating','calibration'].includes(view.status))hide();
  active=false;
  if(session){
   session.candidate=null;
   session.board=null;
   session.lastImage=null;
  }
  if(!keep)session=undefined;
  update(status);
 }
 function queue(){
  if(!enabled||refresh||!settings().enabled)return;
  if(running){refresh=setTimeout(()=>{refresh=null;queue();},35);return;}
  refresh=setTimeout(()=>{refresh=null;void tick();},0);
 }
 function start(){
  if(enabled||process.platform!=='darwin')return;
  enabled=true;
  watcher=spawn(helper,['watch'],{stdio:['ignore','pipe','ignore']});
  const lines=createInterface({input:watcher.stdout});
  lines.on('line',queue);
  watcher.on('error',()=>{});
  watcher.on('close',()=>lines.close());
  timer=setInterval(queue,630);
  if(!settings().enabled)update('disabled');
  queue();
 }
 function stop(){
  enabled=false;
  clearInterval(timer);
  clearTimeout(refresh);
  refresh=null;
  watcher?.kill();
  drop('idle');
 }
 function suspend(value){
  locked=value;
  if(value)drop('paused',true);
  else queue();
 }
 function reconcile(){
  if(locked||!permitted())drop('paused',true);
  else queue();
 }
 async function snapshot(capture,expected=0){
  const {stdout}=await run(helper,capture?['capture',String(expected)]:['inspect'],
   {timeout:2400,maxBuffer:8*1024*1024});
  return JSON.parse(stdout);
 }
 function newSession(runId,window){
  return {runId,window,board:null,candidate:null,previous:null,attempts:0,
   asked:false,feedbackAt:0,lastAction:clock(),turn:0,calibrated:false,lastImage:null};
 }
 async function readBoard(data,win){
  const {createCanvas,loadImage}=require('@napi-rs/canvas');
  const pic=await loadImage(Buffer.from(data,'base64'));
  if(pic.width>2050||pic.height>2050)return null;
  const canvas=createCanvas(pic.width,pic.height),ctx=canvas.getContext('2d');
  ctx.drawImage(pic,0,0);
  const image=ctx.getImageData(0,0,pic.width,pic.height);
  return recognizeBoard(image,win.width,win.height,calibration??settings().calibration);
 }
 async function tick(){
  if(running||!enabled||!settings().enabled)return;
  if(locked||!permitted()){drop('paused',true);return;}
  running=true;
  const version=generation;
  try{
   let meta=await snapshot(false);
   if(version!==generation||!enabled||locked||!permitted())return;
   if(!meta.pid){drop('idle');return;}
   const runId=`${meta.pid}:${meta.started}`;
   if(mutedRun===runId){drop('muted');return;}
   if(meta.front!==meta.pid||meta.hidden){
    if(session&&!meta.windows?.some(w=>w.id===session.window.id))drop('idle');
    else if(meta.front!==selfPID||!active)drop('paused',true);
    return;
   }
   const win=meta.windows?.find(w=>w.visible);
   if(!win){drop('paused',Boolean(session&&meta.windows?.some(w=>w.id===session.window.id)));return;}
   if(!meta.permission){
    missingPermission=true;
    drop('permission',true);
    if(deniedRun!==runId){deniedRun=runId;permission();}
    return;
   }
   missingPermission=false;
   if(!session||session.runId!==runId||session.window.id!==win.id){
    drop('idle');
    session=newSession(runId,win);
   }
   session.window=win;
   const current=session,epoch=generation;
   meta=await snapshot(true,win.id);
   if(epoch!==generation||current!==session||!enabled||locked||!permitted()||!settings().enabled)return;
   if(meta.front!==meta.pid||meta.hidden){drop('paused',true);return;}
   const latest=meta.windows?.find(w=>w.visible&&w.id===win.id);
   if(!latest||!meta.image||meta.captured!==win.id){
    drop('paused',true);
    return;
   }
   session.window=latest;
   const board=await readBoard(meta.image,latest);
   if(epoch!==generation||current!==session)return;
   if(!board){
    session.candidate=null;
    session.board=null;
    session.attempts++;
    abort();
    active=false;
    if(session.attempts>=5){
     // Only the target window, kept in memory while fallback is available.
     session.lastImage=meta.image;
     if(!session.calibrated){
      session.calibrated=true;
      show(latest,{status:'calibration',text:'这次棋盘的位置我没认准，可以帮我框一下吗？'});
     }
     update('calibration',{notice:'这次棋盘的位置我没认准，可以帮我框一下吗？'});
    }else{hide();update('locating');}
    return;
   }
   session.attempts=0;
   session.lastImage=null;
   const key=JSON.stringify([board.rows,board.columns,board.cells,board.result]);
   if(session.candidate!==key){
    session.candidate=key;
    session.board=null;
    abort();
    if(active)show(latest);
    update('locating',view.status==='calibration'?{notice:'正在核对框选范围。'}:{});

    return;
   }
   if(session.board?.key===key){
    show(latest);
    if(!session.board.result&&!session.asked&&clock()-session.lastAction>=35000){
     session.asked=true;
     update('ready',{...view,notice:'需要一点线索吗？'});
    }
    return;
   }
   const previous=session.previous;
   const changed=previous?.key!==key;
   board.key=key;
   session.board=board;
   session.previous=board;
   session.turn++;
   active=true;
   if(changed)session.lastAction=clock();
   const opened=board.cells.filter(Number.isInteger).length;
   const past=previous?.cells.filter(Number.isInteger).length??opened;
   const flags=board.cells.filter(v=>v==='flag').length;
   const oldFlags=previous?.cells.filter(v=>v==='flag').length??flags;
   const sameSize=previous&&previous.columns===board.columns&&previous.rows===board.rows;
   const reset=Boolean(sameSize&&opened<past&&board.cells.every(v=>v==='hidden'));
   let notice,pose;
   const first=welcomedRun!==runId;
   if(first)welcomedRun=runId;
   if(reset){session.turn=1;session.asked=false;session.review=null;}
   else if(board.result==='lost'&&previous?.result!=='lost'){
    session.review=previous&&!previous.result?previous:null;
    notice=session.review?'踩中了。要不要一起看看刚才的线索？':'这局踩中了，下一局我还在。';pose='surprised';
   }else if(board.result==='won'&&previous?.result!=='won'){
    notice='这片雪地，我们走通啦。';pose='happy';
   }else if(first){
    notice='你开始扫雷啦，我在旁边陪你。';
   }else if(sameSize&&opened-past>=7&&clock()-session.feedbackAt>6500){
    notice='一下子找到了好大一片空地。';pose='happy';session.feedbackAt=clock();
   }else if(sameSize&&flags!==oldFlags)pose='curious';
   show(latest,{pose});
   update('ready',{rows:board.rows,columns:board.columns,opened,flags,notice,result:board.result,review:Boolean(board.result==='lost'&&session.review)});
  }catch{
   if(enabled&&settings().enabled)drop('paused',true);
  }finally{running=false;}
 }
 function advise(level){
  if(![1,2,3].includes(level)||!active||!session?.board||view.status!=='ready')throw Error('等棋盘稳定后再问我。');
  abort();
  const board=session.board.result==='lost'?session.review:session.board;
  if(!board||board.result)throw Error('这局已经结束。');
  const hint=describe(board,hints(board),level);
  show(session.window,{pose:'thinking'});
  update('ready',{...view,notice:undefined,level,hint,board:board.cells,turn:session.turn});
  return view;
 }
 async function ask(payload){
  if(!active||!session?.board||session.board.result||!view.hint||!view.level||payload?.consent!==true)throw Error('请先对当前棋盘请求一条提示。');
  const question=typeof payload.question==='string'?payload.question.trim().slice(0,180):'';
  if(!question)throw Error('请输入问题。');
  const board=session.board,epoch=generation;
  request?.abort();
  const signal=(request=new AbortController()).signal;
  const detail=describe(board,hints(board),Math.max(view.level,2));
  const tone=await explain(detail.text,question,signal);
  if(signal.aborted||epoch!==generation||session?.board!==board)throw Error('棋盘变化了，请重新提问。');
  // Only a choice of presentation comes back from the model. All facts are generated locally.
  const explanation=tone==='比喻'?`把数字看成一张相邻格的总账。${detail.text}`:detail.text;
  update('ready',{...view,explanation});
  return explanation;
 }
 function setEnabled(value){
  if(typeof value!=='boolean')throw Error('陪玩设置无效。');
  save({...settings(),enabled:value});
  if(value){mutedRun=undefined;update('idle');queue();}
  else drop('disabled');
  return settings();
 }
 function mute(){
  if(session)mutedRun=session.runId;
  drop('muted');
  return true;
 }
 function camera(){
  if(!session?.lastImage||view.status!=='calibration')throw Error('暂时没有可以框选的目标窗口。');
  return {image:session.lastImage};
 }
 function calibrate(rect){
  if(!session?.lastImage||!rect||!['x','y','width','height'].every(k=>Number.isFinite(rect[k]))||
   rect.x<0||rect.y<0||rect.width<.2||rect.height<.2||rect.x+rect.width>1||rect.y+rect.height>1)throw Error('请框住完整的棋盘。');
  calibration={x:rect.x,y:rect.y,width:rect.width,height:rect.height};
  save({...settings(),calibration});
  session.attempts=0;session.candidate=null;
  queue();
  return true;
 }
 return {start,stop,suspend,reconcile,advise,ask,setEnabled,mute,camera,calibrate,status:()=>view,target};
}
module.exports={minesCompanion};
