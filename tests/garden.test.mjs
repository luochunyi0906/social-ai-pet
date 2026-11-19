import test from'node:test';import assert from'node:assert/strict';import{createRequire}from'node:module';import{DEFAULT_PLACES,placePiece,collides}from'../src/shared/layout.mjs';import{nextBehavior,INITIAL_STATE}from'../src/shared/behavior.mjs';
const require=createRequire(import.meta.url),farm=require('../desktop/garden.cjs'),old=require('../desktop/core.cjs'),v2=require('../desktop/store-v2.cjs');const t=Date.UTC(2026,10,17,16);
const add=(s,n)=>farm.add(s,{kind:'generated_question',title:'种子 '+n,keywords:'种子 '+n,simulated:true},undefined,t);
const action=(s,kind,n,extras={})=>farm.act(s,{id:'operation-'+kind+'-'+n,action:kind,...extras},t+n*100);
test('v1/v2迁移保留原收藏ID、来源、田位和旧植物，旧对象不变',()=>{
 let before=old.addFavorite(old.emptyStore(),{kind:'generated_question',title:'旧植物',keywords:'旧植物',simulated:true});const snapshot=JSON.stringify(before);const migrated=farm.from(before,t);assert.equal(migrated.version,3);assert.deepEqual(migrated.favorites,before.favorites);assert.equal(migrated.plants[0].slot,0);assert.equal(migrated.plants[0].stage,'flower');assert.equal(migrated.plants[0].legacy,true);assert.equal(JSON.stringify(before),snapshot);
 const newer=v2.add({version:2,favorites:before.favorites},{kind:'zhihu_post'},{title:'原来源',url:'https://www.zhihu.com/question/123456',provider:'test',verification:'index_only',retrievedAt:new Date(t).toISOString()});const m=farm.from(newer,t);assert.equal(m.plants.length,2);assert.deepEqual(m.favorites[1].source,newer.favorites[1].source);
});
test('收藏只得到一颗种子；去重不重复发种，满田也不覆盖',()=>{
 let s=add(farm.empty(),1);const id=s.favorites[0].id;assert.equal(s.favorites[0].slot,null);assert.equal(s.plants.length,0);s=add(s,1);assert.equal(s.favorites.length,1);assert.equal(s.favorites[0].id,id);
 for(let i=0;i<10;i++)s=add(s,i+2);for(let i=0;i<9;i++)s=action(s,'plant',i+1,{favoriteId:s.favorites[i].id,slot:i});assert.equal(s.plants.length,9);assert.equal(s.favorites.filter(f=>f.slot===null).length,2);assert.throws(()=>action(s,'plant',40,{favoriteId:s.favorites[9].id,slot:0}),/土地/);
});
test('九块田各一个品种，照料、重读和补种不会让已种田格换品种',()=>{
 const catalog=Object.keys(require('../desktop/plant-varieties.json'));
 let garden=farm.empty();
 for(let slot=0;slot<9;slot++){
  garden=add(garden,slot);
  garden=action(garden,'plant',slot+1,{favoriteId:garden.favorites.at(-1).id,slot});
 }
 const planted=garden.plants.map(p=>p.variety);
 assert.deepEqual(new Set(planted),new Set(catalog));
 garden=action(garden,'water',15,{plantId:garden.plants[0].id});
 garden=action(garden,'fertilize',16,{plantId:garden.plants[0].id});
 garden=farm.from(JSON.parse(JSON.stringify(farm.advance(garden,t+500000))));
 assert.deepEqual(garden.plants.map(p=>p.variety),planted);
 garden=farm.update(garden,{id:garden.plants[2].favoriteId,action:'delete'},t+500000);
 garden=add(garden,11);
 garden=action(garden,'plant',22,{favoriteId:garden.favorites.at(-1).id,slot:2});
 assert.equal(garden.plants.find(p=>p.slot===2).variety,planted[2]);
 assert.deepEqual(garden.plants.filter(p=>p.slot!==2).map(p=>p.variety),planted.filter((_,slot)=>slot!==2));
});
test('旧存档遇到重复外观时补齐不同品种，并保留其它旧植物外观和田位',()=>{
 const catalog=Object.keys(require('../desktop/plant-varieties.json'));
 const saved=farm.empty();
 let candidate=0;
 const makeId=(index)=>{
  while(true){
   const id='previous-plant-'+candidate++;
   let hash=2166136261;
   for(let c=0;c<id.length;c++)hash=Math.imul(hash^id.charCodeAt(c),16777619);
   if((hash>>>0)%7===index)return id;
  }
 };
 const original=[0,0,1,2,3,4,5,6,0];
 const filled=original.reduce((state,index,slot)=>{
  const next=add(state,slot);
  const favorite=next.favorites.at(-1);
  favorite.id=makeId(index);
  return action(next,'plant',slot+1,{favoriteId:favorite.id,slot});
 },saved);
 const withoutVariety=({variety,...plant})=>plant;
 const oldSave={...filled,plants:filled.plants.map(withoutVariety)};
 const migrated=farm.from(oldSave);
 assert.deepEqual(migrated.favorites,oldSave.favorites);
 assert.deepEqual(migrated.plants.map(withoutVariety),oldSave.plants);
 assert.deepEqual(new Set(migrated.plants.map(p=>p.variety)),new Set(catalog));
 for(const slot of [0,2,3,4,5,6,7])assert.equal(migrated.plants[slot].variety,catalog[original[slot]]);
 assert.ok(oldSave.plants.every(p=>p.variety===undefined));
 assert.deepEqual(farm.from(JSON.parse(JSON.stringify(migrated))),migrated);
});
test('确认播种一次提交；同ID重放幂等，冲突、重复和孤立关联被拒绝',()=>{
 let s=add(farm.empty(),1),id=s.favorites[0].id;const request={id:'operation-plant-fixed',action:'plant',favoriteId:id,slot:2};s=farm.act(s,request,t);const once=JSON.stringify(s);const repeated=farm.act(s,request,t);assert.equal(JSON.stringify(repeated),once);assert.equal(repeated.plants.length,1);assert.throws(()=>farm.act(s,{...request,slot:3},t),/标识重复/);assert.throws(()=>action(s,'plant',4,{favoriteId:id,slot:3}),/已经播种/);assert.throws(()=>farm.validate({...s,plants:[{...s.plants[0],favoriteId:'missing'}]}));
});
test('亲自浇水施肥后才萌芽；饱和操作不加成，双击与重放不重复消耗',()=>{
 let s=add(farm.empty(),1);s=action(s,'plant',1,{favoriteId:s.favorites[0].id,slot:0});const id=s.plants[0].id;
 assert.equal(farm.advance(s,t+86400000).plants[0].growth,0);
 s=action(s,'water',2,{plantId:id});assert.equal(s.plants[0].water,100);assert.equal(s.plants[0].stage,'planted');assert.throws(()=>action(s,'water',3,{plantId:id}),/水分充足/);
 s=action(s,'fertilize',4,{plantId:id});assert.equal(s.plants[0].nutrients,100);assert.equal(s.plants[0].growth,25);assert.equal(s.plants[0].stage,'sprout');const replay=action(s,'fertilize',4,{plantId:id});assert.equal(replay.plants.length,1);assert.equal(replay.plants[0].growth,25);assert.throws(()=>action(s,'fertilize',5,{plantId:id}),/养分充足/);
});
test('真实时间模型推进幼苗/生长/开花，离线继续；时间回退不倒长或补充资源',()=>{
 let s=add(farm.empty(),1);s=action(s,'plant',1,{favoriteId:s.favorites[0].id,slot:0});const id=s.plants[0].id;s=action(s,'water',2,{plantId:id});s=action(s,'fertilize',3,{plantId:id});const start=Date.parse(s.plants[0].updatedAt);
 const growing=farm.advance(s,start+125000);assert.equal(growing.plants[0].stage,'growing');const flower=farm.advance(s,start+375000);assert.equal(flower.plants[0].stage,'flower');assert.equal(flower.plants[0].growth,100);const backward=farm.advance(growing,start);assert.equal(backward.plants[0].growth,growing.plants[0].growth);assert.equal(backward.plants[0].water,growing.plants[0].water);const muchLater=farm.advance(flower,start+100*86400000);assert.equal(muchLater.plants[0].stage,'flower');assert.equal(muchLater.plants[0].water,0);
});
test('删除收藏同时清除关联，其他种子和植物不受影响；损坏数据拒写',()=>{
 let s=add(add(farm.empty(),1),2);s=action(s,'plant',1,{favoriteId:s.favorites[0].id,slot:0});const other=s.favorites[1].id;const next=farm.update(s,{id:s.favorites[0].id,action:'delete'},t+1000);assert.equal(next.plants.length,0);assert.equal(next.favorites[0].id,other);assert.equal(next.favorites[0].slot,null);assert.throws(()=>farm.validate({...s,plants:[{...s.plants[0],water:NaN}]}));
});
test('透明小窗道具避免碰撞，刘看山锚点留给系统窗口拖动',()=>{
 for(const key of Object.keys(DEFAULT_PLACES))assert.equal(collides(DEFAULT_PLACES,key,DEFAULT_PLACES[key]),false,key);
 const hit=placePiece(DEFAULT_PLACES,'feed',{x:20,y:40});
 assert.equal(hit.blocked,true);assert.deepEqual(hit.places,DEFAULT_PLACES);
 assert.equal(placePiece(DEFAULT_PLACES,'fox',{x:200,y:80}).blocked,true);
 const actorOverlap=placePiece(DEFAULT_PLACES,'feed',{x:203,y:99});
 assert.equal(actorOverlap.blocked,true);
 const moved=placePiece(DEFAULT_PLACES,'feed',{x:234,y:104});
 assert.equal(moved.blocked,false);assert.equal(moved.places.feed.x,234);
});
test('播种照料与成长事件进入唯一控制器，暂停和低打扰始终优先',()=>{
 const mapping={'seed-select':'seedlook',plant:'plant',water:'water',fertilize:'fertilize','garden-stage':'gardenlook',bloom:'bloom'};
 for(const[kind,expected]of Object.entries(mapping)){assert.equal(nextBehavior(INITIAL_STATE,0,false,'idle',kind).action,expected);assert.equal(nextBehavior({...INITIAL_STATE,paused:true},0,false,'idle',kind).action,'paused');assert.equal(nextBehavior(INITIAL_STATE,0,true,'idle',kind).action,'rest');}assert.equal(nextBehavior(INITIAL_STATE,0,false,'idle','keep').reason.includes('种子'),true);
});
