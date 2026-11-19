const legacy=require('./store-v2.cjs');const{createHash}=require('node:crypto');
const VARIETIES=Object.keys(require('./plant-varieties.json'));
// The first seven match the palette used by gardens saved before variety was stored.
const LEGACY_VARIETIES=VARIETIES.slice(0,7);
const GROW_MS=5000,WATER_PER_MS=2/3600000,NUTRIENT_PER_MS=1/3600000;
const stageFor=g=>g>=100?'flower':g>=50?'growing':g>=25?'sprout':'planted';
const round=n=>Math.round(n*1000)/1000,stamp=n=>new Date(n).toISOString();
const validTime=t=>typeof t==='string'&&Number.isFinite(Date.parse(t));
function validate(s){
 if(s?.version!==3||!Array.isArray(s.plants)||s.plants.length>9||!Number.isInteger(s.revision)||s.revision<0||!Array.isArray(s.operations)||s.operations.length>100)throw Error('花园数据格式不兼容，已停止写入。');
 legacy.validate({version:2,favorites:s.favorites});const ids=new Set(),used=new Set(),refs=new Set(),varieties=new Set();
 for(const p of s.plants){const f=s.favorites.find(f=>f.id===p?.favoriteId);
  if(!p||typeof p.id!=='string'||ids.has(p.id)||!f||refs.has(f.id)||!Number.isInteger(p.slot)||p.slot<0||p.slot>8||used.has(p.slot)||f.slot!==p.slot||!['water','nutrients','growth'].every(k=>Number.isFinite(p[k])&&p[k]>=0&&p[k]<=100)||p.stage!==stageFor(p.growth)||!validTime(p.plantedAt)||!validTime(p.updatedAt)||!(p.wateredAt===null||validTime(p.wateredAt))||!(p.fertilizedAt===null||validTime(p.fertilizedAt)))throw Error('植物关联或状态损坏，已停止写入。');
  ids.add(p.id);used.add(p.slot);refs.add(f.id);
  if(p.variety!==undefined){
   if(!VARIETIES.includes(p.variety)||varieties.has(p.variety))throw Error('植物品种数据损坏，已停止写入。');
   varieties.add(p.variety);
  }
 }
 if(s.favorites.some(f=>f.slot!==null&&!refs.has(f.id)))throw Error('收藏与土地关联损坏，已停止写入。');
 const ops=new Set();for(const x of s.operations){if(typeof x.id!=='string'||typeof x.signature!=='string'||ops.has(x.id))throw Error('花园操作记录损坏。');ops.add(x.id);}return s;
}
function seedHash(id){
 let hash=2166136261;
 for(let i=0;i<id.length;i++)hash=Math.imul(hash^id.charCodeAt(i),16777619);
 return hash>>>0;
}
function availableVariety(used,id){
 const start=seedHash(id)%VARIETIES.length;
 for(let offset=0;offset<VARIETIES.length;offset++){
  const variety=VARIETIES[(start+offset)%VARIETIES.length];
  if(!used.has(variety))return variety;
 }
 throw Error('九种植物都已经种下了。');
}
function assignSavedVarieties(state){
 if(state.plants.every(p=>p.variety!==undefined))return state;
 const used=new Set(state.plants.map(p=>p.variety).filter(Boolean));
 // Reserve every unchanged appearance first, so a duplicate never takes another plant's old variety.
 const reserved=state.plants.map(p=>{
  if(p.variety!==undefined)return p;
  const variety=LEGACY_VARIETIES[seedHash(p.favoriteId)%LEGACY_VARIETIES.length];
  if(used.has(variety))return p;
  used.add(variety);
  return{...p,variety};
 });
 const plants=reserved.map(p=>{
  if(p.variety!==undefined)return p;
  const variety=availableVariety(used,p.favoriteId);
  used.add(variety);
  return{...p,variety};
 });
 return{...state,plants,revision:state.revision+1};
}
function from(data,now=Date.now()){
 if(data?.version===3)return assignSavedVarieties(validate(data));const s=legacy.validate(data),time=stamp(now);
 return assignSavedVarieties(validate({version:3,revision:0,favorites:s.favorites,plants:s.favorites.filter(f=>f.slot!==null).map(f=>({id:'plant:'+f.id,favoriteId:f.id,slot:f.slot,stage:'flower',water:100,nutrients:100,growth:100,plantedAt:validTime(f.createdAt)?f.createdAt:time,updatedAt:time,wateredAt:time,fertilizedAt:time,legacy:true})),operations:[]}));
}
function empty(){return{version:3,revision:0,favorites:[],plants:[],operations:[]};}
function advance(data,now=Date.now()){
 const s=from(data,now);const plants=s.plants.map(p=>{
  const last=Date.parse(p.updatedAt),end=Math.max(last,now),elapsed=end-last;
  const canGrow=p.wateredAt!==null&&p.fertilizedAt!==null;const eligible=canGrow?Math.min(elapsed,p.water/WATER_PER_MS,p.nutrients/NUTRIENT_PER_MS):0;
  const growth=round(Math.min(100,p.growth+eligible/GROW_MS));
  return{...p,water:round(Math.max(0,p.water-elapsed*WATER_PER_MS)),nutrients:round(Math.max(0,p.nutrients-elapsed*NUTRIENT_PER_MS)),growth,stage:stageFor(growth),updatedAt:stamp(end)};
 });const changed=plants.some((p,i)=>JSON.stringify(p)!==JSON.stringify(s.plants[i]));return validate({...s,plants,revision:s.revision+(changed?1:0)});
}
function add(data,payload,receipt,now=Date.now()){
 const s=advance(data,now),existing=legacy.add({version:2,favorites:s.favorites},payload,receipt);
 if(existing.favorites.length===s.favorites.length)return s;
 // One favorite is one seed; new discoveries never take an empty plot automatically.
 const item={...existing.favorites.at(-1),slot:null};return validate({...s,revision:s.revision+1,favorites:[...s.favorites,item]});
}
function update(data,p,now=Date.now()){
 const s=advance(data,now);if(!p||typeof p.id!=='string'||!s.favorites.some(f=>f.id===p.id))throw Error('收藏不存在。');
 if(p.action==='hide')return validate({...s,revision:s.revision+1,favorites:s.favorites.map(f=>f.id===p.id?{...f,hidden:!f.hidden}:f)});
 if(p.action==='delete')return validate({...s,revision:s.revision+1,favorites:s.favorites.filter(f=>f.id!==p.id),plants:s.plants.filter(x=>x.favoriteId!==p.id)});
 throw Error('无效收藏操作。');
}
function act(data,p,now=Date.now()){
 const s=advance(data,now);if(!p||typeof p.id!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(p.id)||!['plant','water','fertilize','harvest'].includes(p.action))throw Error('花园操作无效。');
 const signature=createHash('sha256').update(JSON.stringify([p.action,p.favoriteId??null,p.plantId??null,p.slot??null])).digest('hex');const old=s.operations.find(x=>x.id===p.id);
 if(old){if(old.signature!==signature)throw Error('操作标识重复，请重新操作。');return s;}
 let next;
 if(p.action==='plant'){
  const f=s.favorites.find(f=>f.id===p.favoriteId);if(!f)throw Error('这颗种子已不存在。');if(s.plants.some(x=>x.favoriteId===f.id))throw Error('这颗种子已经播种。');if(!Number.isInteger(p.slot)||p.slot<0||p.slot>8||s.plants.some(x=>x.slot===p.slot))throw Error('土地已被占用，请重新选择。');
  const time=stamp(now),variety=availableVariety(new Set(s.plants.map(x=>x.variety)),f.id);
  next={...s,favorites:s.favorites.map(x=>x.id===f.id?{...x,slot:p.slot}:x),plants:[...s.plants,{id:'plant:'+f.id+':'+p.id,favoriteId:f.id,slot:p.slot,variety,stage:'planted',water:20,nutrients:10,growth:0,plantedAt:time,updatedAt:time,wateredAt:null,fertilizedAt:null,legacy:false}]};
 }else{
  const plant=s.plants.find(x=>x.id===p.plantId);if(!plant)throw Error('植物已不存在，请重新打开花园。');
  if(p.action==='harvest'){
   if(plant.stage!=='flower')throw Error('还没成熟，等它开花后再采种。');
   next={...s,
    favorites:s.favorites.map(f=>f.id===plant.favoriteId?{...f,slot:null}:f),
    plants:s.plants.filter(x=>x.id!==plant.id)};
  }else{
   const key=p.action==='water'?'water':'nutrients',timeKey=p.action==='water'?'wateredAt':'fertilizedAt';
   if(plant[key]>=80)throw Error(p.action==='water'?'水分充足，暂时不用再浇水。':'养分充足，暂时不用再施肥。');
   const changed={...plant,[key]:100,[timeKey]:stamp(now)};
   if(changed.wateredAt!==null&&changed.fertilizedAt!==null)changed.growth=Math.max(changed.growth,25);
   changed.stage=stageFor(changed.growth);next={...s,plants:s.plants.map(x=>x.id===changed.id?changed:x)};
  }
 }
 return validate({...next,revision:s.revision+1,operations:[...s.operations,{id:p.id,signature}].slice(-100)});
}
module.exports={validate,from,empty,advance,add,update,act,stageFor,GROW_MS};
