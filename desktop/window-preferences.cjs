const {randomUUID}=require('node:crypto');
const path=require('node:path');
const fs=require('node:fs/promises');

const {validWander,wanderSettings}=require('./roaming.cjs');
const {validWeather}=require('./weather.cjs');
const caveWardrobe=require('./cave-wardrobe.json');

const defaults = {version:1,pet:null,panel:null,snow:true};
const validAppearance = value => value==='classic'||value==='human'||value==='fox';
const position = value => value && Number.isInteger(value.x) && Number.isInteger(value.y)
 && Math.abs(value.x)<100000 && Math.abs(value.y)<100000;
const dimensions = value => Number.isInteger(value.width) && Number.isInteger(value.height)
 && value.width>0 && value.height>0 && value.width<=12000 && value.height<=12000;
function normalize(value) {
 if(value?.version!==1)return {...defaults};
 const pet=position(value.pet)?{x:value.pet.x,y:value.pet.y}:null;
 const panel=position(value.panel)&&dimensions(value.panel)
  ?{x:value.panel.x,y:value.panel.y,width:value.panel.width,height:value.panel.height}:null;
 return {version:1,pet,panel,snow:typeof value.snow==='boolean'?value.snow:true,
  ...(validAppearance(value.appearance)?{appearance:value.appearance}:{}),
  ...(value.caveStickerReward===true?{caveStickerReward:true}:{}),
  ...(value.wardrobeHintSeen===true?{wardrobeHintSeen:true}:{}),
  ...(typeof value.caveOutfit==='string'&&Object.hasOwn(caveWardrobe,value.caveOutfit)?{caveOutfit:value.caveOutfit}:{}),
  ...(validWeather(value.weather)?{weather:{enabled:value.weather.enabled,city:value.weather.city,chase:value.weather.chase===true}}:{}),
  ...(validWander(value.wander)?{wander:wanderSettings(value.wander)}:{}),
  ...(typeof value.chatStickers==='boolean'?{chatStickers:value.chatStickers}:{})};
}
function preferences(directory) {
 const file=path.join(directory,'window-preferences.json');
 let data={...defaults}, timer, pending=false, tail=Promise.resolve();
 async function read() {
  try {data=normalize(JSON.parse(await fs.readFile(file,'utf8')));}
  catch(error) {
   if(error.code!=='ENOENT')console.warn('窗口偏好读取失败，使用默认位置和特效。');
  }
 }
 function flush() {
  clearTimeout(timer);
  if(!pending)return tail;
  pending=false;
  const content=JSON.stringify(data)+'\n';
  const task=tail.then(async()=>{
   await fs.mkdir(directory,{recursive:true});
   const temp=`${file}.${randomUUID()}.tmp`;
   try {
    await fs.writeFile(temp,content,{flag:'wx',mode:0o600});
    await fs.rename(temp,file);
   }finally{await fs.rm(temp,{force:true});}
  });
  tail=task.catch(error=>console.warn('窗口偏好保存失败。',error.code||'write'));
  return task;
 }
 function update(values) {
  const next=normalize({...data,...values});
  if(JSON.stringify(next)===JSON.stringify(data))return;
  data=next;
  pending=true;
  clearTimeout(timer);
  timer=setTimeout(()=>void flush().catch(()=>{}),220);
 }
 return {read,flush,update,get:()=>data};
}
module.exports={preferences,normalize,validAppearance};
