import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const executablePath=resolve(root,process.env.KANSHAN_PACKAGE_DIR||'release',
 '看山有伴.app/Contents/MacOS/Kanshan');
const profile=await mkdtemp(join(tmpdir(),'kanshan-direct-chat-'));
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('CHAT_')&&!key.startsWith('MODEL_')));
env.CHAT_PROVIDER='llama.cpp';
const ready=async()=>{
 try{
  const response=await fetch('http://127.0.0.1:17890/health',{signal:AbortSignal.timeout(1000)});
  await response.body?.cancel();
  return response.ok;
 }catch{return false;}
};

let app;
try{
 const alreadyRunning=await ready();
 app=await electron.launch({executablePath,env:{...env,KANSHAN_DATA_DIR:profile},timeout:25000});
 const page=await app.firstWindow();
 await page.locator('.pet-fox .fox-nose').click();
 const dialog=page.getByRole('dialog',{name:'说一点你正想着的事'});
 if(!await dialog.isVisible())await page.getByRole('button',{name:'和刘看山聊聊',exact:true}).click();
 await dialog.getByText('聊天服务 qwen3.5:9b', {exact:false}).waitFor();
 assert.equal(await dialog.getByRole('checkbox').count(),0);
 assert.equal(await ready(),alreadyRunning,'首次发送前不应额外启动模型');
 await dialog.getByRole('textbox',{name:'对刘看山说的话'}).fill('两加二等于多少？请用一句话回答。');
 const send=dialog.getByRole('button',{name:'发送',exact:true});
 assert.equal(await send.isEnabled(),true);
 await send.click();
 await dialog.locator('.fox-line').waitFor({timeout:65000});
 const state=JSON.parse(await readFile(join(profile,'chat-v1.json'),'utf8'));
 const turn=state.sessions.find(session=>session.id===state.activeId).turns.at(-1);
 assert.equal(turn.state,'complete');
 assert.match(turn.assistant.content,/4|四/);
 assert.equal(await ready(),true);
 await app.close();
 app=undefined;
 if(!alreadyRunning)for(let attempt=0;attempt<15&&await ready();attempt++)await delay(250);
 assert.equal(await ready(),alreadyRunning,'退出应用只应释放其自行启动的模型');
 console.log('PASS 直接启动应用，输入后点击发送，真实 Qwen 回复并保存对话，'+
  (alreadyRunning?'使用已启动的服务并在退出时保持该服务。':'退出后模型停止。'));
}finally{
 await app?.close().catch(()=>{});
 await rm(profile,{recursive:true,force:true});
}
