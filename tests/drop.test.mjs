import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,mkdtemp,writeFile,stat,mkdir} from 'node:fs/promises';
import * as fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';

// Run the actual host/preload code; Electron's process and native File lookup are mocked.
// This verifies IPC/privacy logic, not native OS drag delivery or GUI layout.
async function host({packaged=false,directory=null}={}){
 const dir=directory||await mkdtemp(join(tmpdir(),'kanshan-drop-'));
 const text=join(dir,'线索.txt');await writeFile(text,'机器人信任：互动经验会改变人们对机器人的看法。');
 const calls=new Map(),reads=[],readPaths=[];let window,hold=null;
 class Window extends EventEmitter{constructor(){super();window=this;this.webContents=new EventEmitter();Object.assign(this.webContents,{mainFrame:{},setWindowOpenHandler(){},session:{setPermissionRequestHandler(){}},send(){}});}loadFile(){}show(){}hide(){}setSize(){}}
 const electron={app:Object.assign(new EventEmitter(),{isPackaged:packaged,setPath(){},getPath(){return dir;},requestSingleInstanceLock(){return true;},quit(){},whenReady:()=>Promise.resolve()}),BrowserWindow:Window,Menu:{buildFromTemplate:()=>new EventEmitter(),setApplicationMenu(){}},dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[text]})},shell:{openExternal:async()=>{}},ipcMain:{handle:(name,fn)=>calls.set(name,fn)}};
 const require=createRequire(resolve('desktop/main.cjs'));
 const instrumented={...fs,async readFile(path,...args){readPaths.push(String(path));if(String(path)===text){reads.push(String(path));if(hold)await hold;}return fs.readFile(path,...args);}};
 vm.runInNewContext(await readFile('desktop/main.cjs','utf8'),{require:name=>name==='electron'?electron:name==='node:fs/promises'?instrumented:require(name),__dirname:resolve('desktop'),process:{env:{...process.env,KANSHAN_DATA_DIR:dir},platform:process.platform},setTimeout,clearTimeout,TextDecoder,Uint8Array,AbortController,DOMException,console},{filename:'desktop/main.cjs'});
 await new Promise(resolve=>setImmediate(resolve));
 const invoke=(name,...args)=>calls.get(name)({sender:window.webContents,senderFrame:window.webContents.mainFrame},...args);
 return{dir,text,reads,readPaths,invoke,calls,window,hold(p){hold=p;},electron};
}
test('拖入只登记名字和token；未授权不读正文；授权后原文件哈希不变',async()=>{
 const h=await host(),before=createHash('sha256').update(await readFile(h.text)).digest('hex');
 const selected=await h.invoke('select-drop',h.text);assert.equal(selected.ok,true);assert.deepEqual(Object.keys(selected.data).sort(),['name','token']);assert.equal(h.reads.length,0);
 let result=await h.invoke('process',{id:'no',mode:'sample',fileToken:selected.data.token,consent:false});assert.equal(result.ok,false);assert.equal(h.reads.length,0);
 result=await h.invoke('process',{id:'yes',mode:'sample',fileToken:selected.data.token,consent:true});assert.equal(result.ok,true);assert.equal(result.data.questions.length,3);assert.equal(h.reads.length,1);assert.equal(createHash('sha256').update(await readFile(h.text)).digest('hex'),before);
 result=await h.invoke('process',{id:'reuse',mode:'sample',fileToken:selected.data.token,consent:true});assert.equal(result.ok,false);
});
test('取消或移除文件撤销token；错误格式、目录、超大文件、伪造token被拒绝',async()=>{
 const h=await host();
 for(const revoke of ['cancel','forget-file']){const chosen=await h.invoke('select-drop',h.text);await h.invoke(revoke,'unused');const result=await h.invoke('process',{id:revoke,consent:true,mode:'sample',fileToken:chosen.data.token});assert.equal(result.ok,false);}
 const wrong=join(h.dir,'wrong.exe');await writeFile(wrong,'x');const folder=join(h.dir,'folder.txt');await mkdir(folder);const huge=join(h.dir,'huge.txt');const fh=await fs.open(huge,'w');await fh.truncate(10*1024*1024+1);await fh.close();
 for(const path of [wrong,folder,huge,'https://example.com/a.txt','relative.txt'])assert.equal((await h.invoke('select-drop',path)).ok,false);
 assert.equal((await h.invoke('process',{id:'forged',consent:true,mode:'sample',fileToken:'forged'})).ok,false);assert.equal(h.reads.length,0);
});
test('处理中拒绝替换文件；中途取消即使读取迟到也不产出问题或收藏',async()=>{
 const h=await host();const chosen=await h.invoke('select-drop',h.text);let release;h.hold(new Promise(r=>{release=r;}));const pending=h.invoke('process',{id:'inflight',mode:'sample',consent:true,fileToken:chosen.data.token});
 while(!h.reads.length)await new Promise(r=>setImmediate(r));
 assert.equal((await h.invoke('select-drop',h.text)).ok,false);await h.invoke('cancel','inflight');release();const result=await pending;assert.equal(result.ok,false);assert.equal((await h.invoke('load')).data.favorites.length,0);
});
test('白名单IPC拒绝子frame；preload只传文件路径给宿主、不回传渲染层',async()=>{
 const h=await host();await assert.rejects(h.calls.get('select-drop')({sender:h.window.webContents,senderFrame:{}},h.text),/无效调用来源/);
 let api,lookupCount=0;const realFile={native:true};
 const preloadElectron={
  contextBridge:{exposeInMainWorld:(_name,value)=>{api=value;}},
  webUtils:{getPathForFile:file=>{lookupCount++;if(file!==realFile)throw Error('not a native file');return h.text;}},
  ipcRenderer:{invoke:h.invoke,on(){},removeListener(){}}
 };
 vm.runInNewContext(await readFile('desktop/preload.cjs','utf8'),{require:()=>preloadElectron});
 const result=await api.dropFile(realFile);assert.equal(result.ok,true);assert.equal(lookupCount,1);assert.equal(JSON.stringify(result).includes(h.dir),false);assert.equal((await api.dropFile({})).ok,false);assert.equal(h.reads.length,0);
});

test('文件选择器晚于Escape返回，不能恢复已经撤销的选择',async()=>{
 const h=await host();let finish;h.electron.dialog.showOpenDialog=()=>new Promise(r=>{finish=r;});
 const choosing=h.invoke('choose-file');await h.invoke('forget-file');finish({canceled:false,filePaths:[h.text]});
 const result=await choosing;assert.equal(result.ok,false,'迟到的选择器应返回取消');assert.equal(h.reads.length,0);
});
test('旧选择器取消不能清除随后拖入的新文件',async()=>{
 const h=await host();let finish;h.electron.dialog.showOpenDialog=()=>new Promise(r=>{finish=r;});
 const choosing=h.invoke('choose-file');const latest=await h.invoke('select-drop',h.text);finish({canceled:true,filePaths:[]});await choosing;
 const result=await h.invoke('process',{id:'new-drop',mode:'sample',consent:true,fileToken:latest.data.token});assert.equal(result.ok,true,'旧选择器不能撤销新token');
});
test('选择器打开时不能悄悄提交此前文本；隐藏后也不能恢复选择',async()=>{
 const h=await host();let finish;h.electron.dialog.showOpenDialog=()=>new Promise(r=>{finish=r;});
 const choosing=h.invoke('choose-file');const result=await h.invoke('process',{id:'during-selection',mode:'sample',consent:true,text:'之前的输入文本'});assert.equal(result.ok,false);
 await h.invoke('control','hide');finish({canceled:false,filePaths:[h.text]});assert.equal((await choosing).ok,false);assert.equal(h.reads.length,0);
});

test('独立应用只从用户数据目录刷新模型配置，不从应用包读取凭据',async()=>{
 const h=await host({packaged:true});const result=await h.invoke('refresh-config');assert.equal(result.ok,true);assert.ok(h.readPaths.includes(join(h.dir,'model.env')));assert.equal(h.readPaths.some(p=>p.endsWith('/.env')),false);
});

test('实际宿主迁移与真实来源收藏写v3，保留v1字节并拒绝伪造来源',async()=>{
 const h=await host();const requireModule=createRequire(import.meta.url),core=requireModule('../desktop/core.cjs'),searchModule=requireModule('../desktop/search.cjs');let old=core.emptyStore();old=core.addFavorite(old,{kind:'generated_question',title:'旧版问题',keywords:'旧版关键词',simulated:true});const original=JSON.stringify(old);await writeFile(join(h.dir,'garden-v1.json'),original);
 assert.equal((await h.invoke('load')).data.version,3);assert.equal((await h.invoke('save',{kind:'zhihu_post',resultId:'made-up'})).ok,false);
 const realSearch=searchModule.search;searchModule.search=async()=>({query:'验收关键词',provider:'test-double',results:[{id:'receipt-test',title:'测试索引标题',url:'https://www.zhihu.com/question/123456',kind:'question',provider:'test-double',verification:'index_only',retrievedAt:new Date().toISOString()}]});
 try{const status=(await h.invoke('search-status')).data;assert.equal((await h.invoke('search-posts',{id:'discover-test',query:'验收关键词',consent:true,configId:status.configId})).ok,true);const saved=await h.invoke('save',{kind:'zhihu_post',resultId:'receipt-test',title:'渲染层伪造标题',url:'https://evil.test/'});assert.equal(saved.ok,true);assert.equal(saved.data.favorites[1].title,'测试索引标题');assert.equal(saved.data.favorites[0].id,old.favorites[0].id);assert.equal((await h.invoke('save',{kind:'zhihu_post',resultId:'receipt-test'})).data.favorites.length,2);assert.equal(await readFile(join(h.dir,'garden-v1.json'),'utf8'),original);assert.equal(JSON.parse(await readFile(join(h.dir,'garden-v3.json'),'utf8')).favorites[1].source.verification,'index_only');}finally{searchModule.search=realSearch;}
});
test('实际宿主串行播种/照料：并发不重复，v2不覆盖，重启v3状态保留',async()=>{
 const h=await host();const core=createRequire(import.meta.url)('../desktop/core.cjs');const old=core.addFavorite(core.emptyStore(),{kind:'generated_question',title:'旧收藏与植物',keywords:'旧收藏',simulated:true});const v2=JSON.stringify({version:2,favorites:old.favorites});await writeFile(join(h.dir,'garden-v2.json'),v2);
 let result=await h.invoke('load');assert.equal(result.ok,true);assert.equal(result.data.plants[0].stage,'flower');
 result=await h.invoke('save',{kind:'generated_question',title:'新的手动种子',keywords:'新种子',simulated:true});assert.equal(result.ok,true);const seed=result.data.favorites[1];assert.equal(seed.slot,null);assert.equal(result.data.plants.length,1);
 const requests=await Promise.all(['host-plant-first','host-plant-second'].map(id=>h.invoke('garden-action',{id,action:'plant',favoriteId:seed.id,slot:1})));assert.equal(requests.filter(r=>r.ok).length,1);const planted=requests.find(r=>r.ok).data.plants.find(p=>p.favoriteId===seed.id);assert.equal(planted.stage,'planted');
 const water=await Promise.all(['host-water-first','host-water-second'].map(id=>h.invoke('garden-action',{id,action:'water',plantId:planted.id})));assert.equal(water.filter(r=>r.ok).length,1);const fert=await h.invoke('garden-action',{id:'host-fertilize-first',action:'fertilize',plantId:planted.id});assert.equal(fert.ok,true);assert.equal(fert.data.plants.find(p=>p.id===planted.id).stage,'sprout');
 assert.equal(await readFile(join(h.dir,'garden-v2.json'),'utf8'),v2);const restarted=await host({directory:h.dir});const loaded=await restarted.invoke('load');assert.equal(loaded.ok,true);assert.equal(loaded.data.plants.length,2);assert.equal(loaded.data.favorites[0].id,old.favorites[0].id);assert.ok(loaded.data.plants.find(p=>p.id===planted.id).growth>=25);const replay=await restarted.invoke('garden-action',{id:'host-plant-first',action:'plant',favoriteId:seed.id,slot:1});assert.equal(replay.ok,true);assert.equal(replay.data.plants.length,2);
});
test('知乎额度白名单IPC校验主动确认与请求ID；preload不返回Access Secret',async()=>{
 const h=await host({packaged:true});for(const p of [{id:'quota-no-consent',consent:false},{id:'',consent:true}])assert.equal((await h.invoke('zhihu-quota',p)).ok,false);const mod=createRequire(import.meta.url)('../desktop/search.cjs'),real=mod.quota;let observed;mod.quota=async opts=>{observed=opts;return{items:[{apiId:'zhihu_search',name:'知乎搜索',total:10,used:1,remaining:9}],checkedAt:new Date().toISOString()};};try{const reply=await h.invoke('zhihu-quota',{id:'quota-explicit',consent:true,configId:'expected-revision'});assert.equal(reply.ok,true);assert.equal(reply.data.items[0].remaining,9);assert.equal(observed.configId,'expected-revision');assert.equal(Object.hasOwn(reply.data,'apiKey'),false);}finally{mod.quota=real;}
});
