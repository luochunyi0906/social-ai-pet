const {accessSync,constants}=require('node:fs');
const {spawn}=require('node:child_process');
const path=require('node:path');
const {setTimeout:delay}=require('node:timers/promises');
const chatModel=require('./chat-model.cjs');
const {readJson}=require('./model.cjs');

const base='http://127.0.0.1:17890';
const modelId='qwen3.5:9b';

function createLocalChat(directory){
 const runner=directory&&path.join(directory,'kanshan-llama','llama-server');
 const modelFile=directory&&path.join(directory,'kanshan-models','qwen3.5-9b-q4.gguf');
 let child,boot,closed=false;

 function configuration(env=process.env){
  const configured=chatModel.configuration(env);
  if(configured.provider!=='llama.cpp'||env.CHAT_BASE_URL?.trim()||
    (env.CHAT_MODEL?.trim()&&env.CHAT_MODEL.trim()!==modelId)||!runner)return configured;
  try{
   accessSync(runner,constants.X_OK);
   accessSync(modelFile,constants.R_OK);
  }catch{return configured;}
  return {...chatModel.configuration({...env,CHAT_PROVIDER:'llama.cpp',
   CHAT_BASE_URL:base,CHAT_MODEL:modelId}),managed:true};
 }

 async function running(config){
  const signal=AbortSignal.timeout(600);
  let response;
  try{response=await fetch(base+'/v1/models',{redirect:'error',signal});}catch{return false;}
  if(!response.ok){
   await response.body?.cancel();
   if(response.status===503)return false;
   throw Error('本机聊天端口已被其他服务占用。');
  }
  let result;
  try{result=await readJson(response,signal);}catch{throw Error('本机聊天端口无法返回模型信息。');}
  if(!Array.isArray(result.data)||!result.data.some(item=>item?.id===modelId&&item?.meta?.n_ctx===config.context)){
   throw Error('本机聊天端口上的模型或上下文设置与应用不匹配。');
  }
  return true;
 }

 async function start(config){
  if(closed)throw Error('应用正在退出。');
  if(await running(config))return;
  if(closed)throw Error('应用正在退出。');
  if(!child){
   const launched=spawn(runner,['--model',modelFile,'--alias',modelId,'--host','127.0.0.1',
    '--port','17890','--ctx-size',String(config.context),'--parallel','1','--cache-ram','0',
    '--reasoning','off','--no-context-shift','--no-webui','--offline',
    '--cors-origins','localhost','--no-cors-credentials'],{stdio:'ignore'});
   child=launched;
   const forget=()=>{if(child===launched)child=undefined;};
   launched.once('error',forget);
   launched.once('exit',forget);
  }
  const launched=child;
  try{
   const deadline=Date.now()+45000;
   while(!closed&&child===launched&&Date.now()<deadline){
    if(await running(config))return;
    await delay(250);
   }
   throw Error('本机 Qwen 启动失败或超时。可稍后重试上一条。');
  }catch(error){
   if(child===launched)launched.kill();
   throw error;
  }
 }

 async function complete(messages,options){
  if(options.config.managed){
   options.signal?.throwIfAborted();
   if(!boot)boot=start(options.config).finally(()=>{boot=undefined;});
   await boot;
   options.signal?.throwIfAborted();
  }
  return chatModel.request(messages,options);
 }

 function stop(){
  closed=true;
  child?.kill();
 }

 return {configuration,complete,stop};
}

module.exports={createLocalChat};
