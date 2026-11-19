import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {homedir,tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import dotenv from 'dotenv';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=process.env.KANSHAN_TEACHING_ARTIFACTS||join(root,'artifacts','teaching');
const provider=process.env.KANSHAN_TEACHING_LIVE;
const local=provider==='local';
const live=local||provider==='zhida';
const profile=await mkdtemp(join(tmpdir(),'kanshan-native-teaching-'));
const topic='怎么判断一个校园活动做得好不好？';
const explanation='我会先看活动目标，再选择相应指标，不能只看浏览量。比如想让同学报名，就看有效报名。';
const related='我准备做一个迎新招募，效果应该怎么衡量？';
const observed=[];
let app,page,server,key;
const menu=label=>app.evaluate(({Menu},value)=>Menu.getApplicationMenu().items[0].submenu.items.find(item=>item.label==='操作菜单')
 .submenu.items.find(item=>item.label===value).click(),label);
const button=(name,within=page)=>within.getByRole('button',{name,exact:true});
const api=(name,...args)=>page.evaluate(async ([method,parameters])=>{
 const response=await window.kanshan[method](...parameters);
 if(!response.ok)throw Error(response.error);
 return response.data;
},[name,args]);
async function launch(){
 app=await electron.launch({executablePath:resolve(root,process.env.KANSHAN_PACKAGE_DIR||'release','看山有伴.app/Contents/MacOS/Kanshan'),
  env:{...process.env,KANSHAN_DATA_DIR:profile},timeout:25000});
 page=await app.firstWindow();
 page.setDefaultTimeout(live?120000:10000);
 await page.locator('.desktop-pet').waitFor();
 await menu('和刘看山聊聊');
 await page.getByRole('combobox',{name:'切换会话'}).locator('option').first().waitFor({state:'attached'});
 if(local)assert.equal((await api('chatStatus')).managed,true,'本机 Qwen 应使用打包工程已有的托管模型。');
}
const evidence=name=>page.screenshot({path:join(output,(live?'real-':'fixture-')+name+'.png'),scale:'css'});
async function awaitState(find,description){
 const deadline=Date.now()+(live?115000:10000);
 let state;
 while(Date.now()<deadline){
  state=await api('chatState');
  const match=find(state);
  if(match)return match;
  await delay(150);
 }
 throw Error('等待'+description+'超时。最近一轮：'+JSON.stringify(state?.turns.at(-1)));
}
async function say(text){
 const before=await api('chatState');
 const oldId=before.turns.at(-1)?.user.id;
 const input=page.getByRole('textbox',{name:'对刘看山说的话'});
 await input.fill(text);
 if(!local)await page.getByRole('checkbox',{name:/同意向所选服务发送/}).check();
 await button('发送').click();
 const turn=await awaitState(state=>{
  const latest=state.turns.at(-1);
  return latest&&latest.user.id!==oldId&&latest.state!=='pending'?latest:undefined;
 },'新回复');
 assert.equal(turn.state,'complete',turn.error);
 assert.equal(turn.user.content,text);
 return turn;
}
async function config(){
 if(local){
  await writeFile(join(profile,'model.env'),'CHAT_PROVIDER=llama.cpp\nCHAT_MODEL=qwen3.5:9b\nCHAT_TIMEOUT_MS=105000\n',{mode:0o600});
  return;
 }
 if(live){
  for(const dirname of ['看山有伴-林间预览','看山有伴-v0.3-preview']){
   try{key=dotenv.parse(await readFile(join(homedir(),'Library','Application Support',dirname,'model.env'))).ZHIHU_ACCESS_SECRET?.trim();}
   catch{}
   if(key)break;
  }
  assert.ok(key,'未找到本机配置的知乎直答凭据');
  await writeFile(join(profile,'model.env'),'CHAT_PROVIDER=zhida\nZHIDA_MODEL=zhida-fast-1p5\nCHAT_TIMEOUT_MS=70000\nZHIHU_ACCESS_SECRET='+key+'\n',{mode:0o600});
  key=undefined;
  return;
 }
 server=createServer(async (req,res)=>{
  const chunks=[];
  for await(const chunk of req)chunks.push(chunk);
  const body=JSON.parse(Buffer.concat(chunks));
  const turn=body.messages.at(-1).content;
  observed.push(turn);
  const content=turn.includes('相关学习卡')?'你之前分享过，先确定活动目标，再按目标选指标。这次可以先明确想提高知晓度还是取得实际报名。[[KS1]]':
   '这是测试回复。可以先把准备事项列出来。';
  res.setHeader('content-type','application/json');
  res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content}}]}));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 await writeFile(join(profile,'model.env'), 'CHAT_PROVIDER=llama.cpp\nCHAT_BASE_URL=http://127.0.0.1:'+server.address().port+'\nCHAT_MODEL=fixture\n',{mode:0o600});
}

try{
 await mkdir(output,{recursive:true});
 await config();
 await launch();
 const original=(await api('chatState')).activeId;
 await button('教看山').click();
 await page.getByRole('heading',{name:'今天你来当老师'}).waitFor();
 await page.getByRole('textbox',{name:'本轮主题'}).fill(topic);
 await button('开始聊这个话题').click();
 await page.getByText('说到「'+topic+'」，你会先看什么？',{exact:true}).waitFor();
 if(!live){
  await app.evaluate(({BrowserWindow})=>BrowserWindow.fromId(1).setSize(600,540));
  await page.waitForFunction(()=>innerWidth===600&&innerHeight===540);
  const compose=await page.getByRole('textbox',{name:'我的解释'}).boundingBox();
  const send=await button('讲给看山听').boundingBox();
  assert.ok(compose.y>=0&&send.y+send.height<=540);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.fromId(1).setSize(900,740));
  await page.waitForFunction(()=>innerWidth===900&&innerHeight===740);
 }
 await evidence('01-教学对话');
 await page.getByRole('textbox',{name:'我的解释'}).fill(explanation);
 if(live)await page.getByRole('checkbox',{name:/同意用/}).check();
 await button('讲给看山听').click();
 await page.getByText(/我理解到的是/).waitFor();
 if(await button('先记到这里').count()&&await button('先记到这里').isEnabled())await button('先记到这里').click();
 await page.getByRole('heading',{name:'今天你教给我的'}).waitFor();
 assert.equal((await api('teachingList')).length,0);
 if(live)assert.equal(await page.getByText(/模型整理没有成功/).count(),0,'真实模型整理没有通过格式校验');
 await button('改一下').click();
 await page.getByRole('textbox',{name:'适用的时候'}).fill('判断校园活动、迎新招募或报名效果时');
 await page.getByLabel('记录性质').selectOption('experience');
 await evidence('02-可编辑学习卡');
 await button('记进手账').click();
 await page.getByText('我把你的解释记下来了。',{exact:true}).waitFor();
 const [record]=await api('teachingList');
 assert.equal(record.sessionId,original);
 assert.equal(record.messages[1].content,explanation);
 assert.equal(record.card.kind,'experience');
 assert.equal(record.status,'active');
 await button('返回聊天').click();
 await button('关闭对话').click();
 await button('收藏手账').click();
 await button('你教给我的').click();
 await page.getByRole('button',{name:/怎么判断一个校园活动/}).click();
 await page.getByRole('heading',{name:topic}).waitFor();
 await evidence('03-成长手账');
 await app.close();app=undefined;
 await launch();
 await button('新建会话').click();
 await awaitState(state=>state.activeId!==original,'切换到新会话');
 const used=await say(related);
 assert.match(used.assistant.content,/目标|目的/);
 assert.match(used.assistant.content,/指标|报名|浏览量/);
 assert.deepEqual(used.teachingRefs,[{id:record.id,revision:1}],used.assistant.content);
 await button('用到了你教过的方法').waitFor();
 await evidence('04-重启新会话调用');
 const reply=used.assistant.content;
 await button('用到了你教过的方法').click();
 await page.getByRole('heading',{name:topic}).waitFor();
 if(!live){
  await button('编辑学习卡').click();
  await page.getByRole('textbox',{name:'我理解到的'}).fill('我先确认活动目标，再观察七日内实际到场转化率。');
  await button('确认修改').click();
  await page.getByText(/第 2 版/).waitFor();
  await button('返回原对话').click();
  await awaitState(state=>state.activeId===original,'返回原始会话');
  await page.getByRole('textbox',{name:'对刘看山说的话'}).waitFor();
  await say(related);
  assert.match(observed.at(-1),/七日内实际到场转化率/);
  assert.doesNotMatch(observed.at(-1),/只看浏览量/);
  await say('豆腐炖汤怎么做？');
  assert.doesNotMatch(observed.at(-1),/相关学习卡|转化率/);
  await button('教看山').click();
  await button('接着刚才聊').click();
  await page.getByRole('combobox',{name:'选择当前会话里的话题'}).selectOption({label:'豆腐炖汤怎么做？'});
  await button('开始聊这个话题').click();
  await page.getByText(/当前会话曾聊到「豆腐炖汤怎么做？」/).waitFor();
  await button('结束').click();
  await button('用到了你教过的方法').click();
  await button('停用记忆').click();
  await page.getByText(/第 3 版/).waitFor();
  await button('返回原对话').click();
  await page.getByRole('textbox',{name:'对刘看山说的话'}).waitFor();
  await say(related);
  assert.doesNotMatch(observed.at(-1),/相关学习卡|转化率/);
  await page.getByRole('button',{name:/学习卡 · .*已停用/}).click();
  await button('删除学习记录').click();
  await button('确认删除学习记录').click();
  await page.getByText('这条学习记录已删除或找不到。').waitFor();
  const data=await api('teachingList');assert.equal(data[0].status,'deleted');
  const replay=(await api('replaySearch')).results[0];
  await api('save',{kind:'zhihu_post',title:replay.title,keywords:'北极狐',simulated:false,resultId:replay.id});
  await app.close();app=undefined;
  await launch();
  await button('关闭对话').click();
  await button('收藏手账').click();
  await button('讲给看山听').click();
  await page.getByRole('heading',{name:'今天你来当老师'}).waitFor();
  await button('开始聊这个话题').click();
  await page.getByText(/仅有标题和收藏线索/).waitFor();
  await button('回到原收藏').click();
  await page.getByRole('heading',{name:replay.title}).waitFor();
 }
 await writeFile(join(output,live?'real-result.json':'fixture-result.json'),JSON.stringify({
  mode:local?'本机 Qwen 真实推理':live?'知乎直答真实接口':'本地测试响应',related,reply,recordId:record.id,restarted:true,linked:true,
  model:local?'qwen3.5:9b':live?'zhida-fast-1p5':'fixture',timestamp:new Date().toISOString()
 },null,2)+'\n');
 console.log(local?'本机 Qwen 真实推理：重启新会话引用已确认教学记录。':
  live?'真实知乎直答：重启新会话引用已确认教学记录。':'原生夹具：保存、重启、引用、编辑、停用、删除与收藏入口通过。');
}finally{
 await app?.close();
 await new Promise(resolve=>server?server.close(resolve):resolve());
 await rm(profile,{recursive:true,force:true});
}
