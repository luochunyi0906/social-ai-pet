const {execFile}=require('node:child_process');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {promisify}=require('node:util');

const exec=promisify(execFile);
const QQ_MUSIC='com.tencent.QQMusicMac';
const NETEASE_MUSIC='com.netease.163music';
const CLOCK='com.apple.clock';
const SHORTCUTS='com.apple.shortcuts';
const ALARM_SHORTCUT='看山有伴·创建系统闹钟';
const ALARM_RECEIPT=/^Alarm:[ \t]+(\S[^\r\n]*)$/;
const SHORTCUT_TIME=new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',hour12:true});
const AUDIO_EXTENSIONS=['mp3','wav','flac','m4a','aac','ogg','ape','dsf','dff','wma'];

function macOnly(){
 if(process.platform!=='darwin')throw Error('此功能需要 macOS。');
}

async function openApp(id,file){
 macOnly();
 await exec('/usr/bin/open',['-b',id,...(file?[file]:[])],{timeout:8000});
}

async function music(action,choose){
 if(!['open','sample','file'].includes(action))throw Error('无效的音乐操作。');
 macOnly();
 let file;
 if(action==='file'){
  file=await choose();
  if(!file)return {state:'cancelled'};
  if(!AUDIO_EXTENSIONS.includes(path.extname(file).slice(1).toLowerCase()))throw Error('请选择 QQ 音乐支持的音频文件。');
 }else if(action==='sample'){
  file=path.join(__dirname,'../dist/room/night-music.wav');
  await fs.access(file).catch(()=>{throw Error('小屋音乐文件缺失。');});
 }
 try{await openApp(QQ_MUSIC,file);}
 catch{throw Error('无法打开 QQ 音乐，请确认 Mac 已安装 QQ 音乐。');}
 return {state:file?'handedOff':'opened'};
}
async function openNetEaseMusic(){
 try{await openApp(NETEASE_MUSIC);}
 catch{throw Error('无法打开网易云音乐，请先安装网易云音乐 Mac 客户端。');}
 return {state:'opened'};
}

async function clock(action){
 if(!['open','install'].includes(action))throw Error('无效的时钟操作。');
 try{
  if(action==='open')await openApp(CLOCK);
  else await openApp(SHORTCUTS,path.join(__dirname,'shortcuts',ALARM_SHORTCUT+'.shortcut'));
 }catch{
  throw Error(action==='open'?'无法打开 Mac 时钟。':'无法打开闹钟快捷指令，可在 Mac 时钟里直接设置。');
 }
 return true;
}

function alarmDate(time,now=new Date()){
 if(typeof time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('请选择有效的响铃时间。');
 const [hour,minute]=time.split(':').map(Number);
 const next=new Date(now);
 next.setHours(hour,minute,0,0);
 if(next<=now){
  next.setDate(next.getDate()+1);
  next.setHours(hour,minute,0,0);
 }
 if(next.getHours()!==hour||next.getMinutes()!==minute)throw Error('所选时间遇到夏令时切换，请换一个时间。');
 return next;
}

function selectAlarmShortcut(list){
 let exact;
 let importedCopy;
 for(const line of list.split(/\r?\n/)){
  const record=line.trim().match(/^(.+) \(([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\)$/i);
  if(!record)continue;
  const [,name,id]=record;
  if(name===ALARM_SHORTCUT)exact=id;
  else if(name.startsWith(ALARM_SHORTCUT+' ')&&/^\d+$/.test(name.slice(ALARM_SHORTCUT.length+1)))importedCopy=id;
 }
 return exact??importedCopy;
}

async function installedAlarmShortcut(){
 const result=await exec('/usr/bin/shortcuts',['list','--show-identifiers'],{timeout:8000})
  .catch(()=>{throw Error('暂时无法读取 Mac 快捷指令，请打开「快捷指令」后重试。');});
 return selectAlarmShortcut(result.stdout);
}

async function alarmStatus(){
 macOnly();
 return {installed:Boolean(await installedAlarmShortcut())};
}

let alarmPending=false;
async function addAlarm(time){
 macOnly();
 const next=alarmDate(time);
 if(alarmPending)throw Error('系统闹钟正在设置，请稍等。');
 alarmPending=true;
 let directory;
 try{
  const id=await installedAlarmShortcut();
  if(!id)return {state:'needsShortcut'};
  directory=await fs.mkdtemp(path.join(os.tmpdir(),'kanshan-clock-'));
  const input=path.join(directory,'time.txt');
  const output=path.join(directory,'result.txt');
  await fs.writeFile(input,SHORTCUT_TIME.format(next),{mode:0o600});
  try{
   await exec('/usr/bin/shortcuts',['run',id,'--input-path',input,
    '--output-path',output,'--output-type','public.utf8-plain-text'],{timeout:30000});
   if(!ALARM_RECEIPT.test((await fs.readFile(output,'utf8')).trim()))throw Error();
  }catch(error){
   if(error.killed)throw Error('等待系统时钟超时。请检查 Mac 是否弹出了权限提示，再到时钟确认结果。');
   throw Error('系统时钟没有返回创建确认。请先检查该时间是否已在 Mac 时钟里，再决定是否重试。');
  }
  return {state:'created',at:next.getTime()};
 }finally{
  alarmPending=false;
  if(directory)await fs.rm(directory,{recursive:true,force:true}).catch(()=>{});
 }
}

module.exports={music,openNetEaseMusic,clock,addAlarm,alarmDate,alarmStatus,selectAlarmShortcut,AUDIO_EXTENSIONS};
