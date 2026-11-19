const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {postUrl}=require('./search.cjs');
const {runSkill}=require('./skills.cjs');
const {validate}=require('../skills/question-recommendations/index.cjs');

function recommendations(directory,getKey){
 const file=path.join(directory,'question-recommendations-v1.json');
 const account=key=>key?createHash('sha256').update('zhihu-recommendations\n'+key).digest('hex'):null;
 let loaded,queue=Promise.resolve();
 async function read(){
  loaded??=(async()=>{
   try{
    const value=JSON.parse(await fs.readFile(file,'utf8'));
    if(value.version!==1||!Array.isArray(value.batches))throw Error();
    return value.batches.slice(0,12).flatMap(row=>{
     try{
      const conditions=validate(row.batch);
      if(!/^[a-f0-9]{64}$/.test(row.account)||!Number.isFinite(Date.parse(row.batch.retrievedAt))||!Array.isArray(row.batch.items))return [];
      const items=row.batch.items.slice(0,20).flatMap(post=>{
       const url=postUrl(post.sourceUrl??post.url);
       if(url.kind!=='question'||typeof post.id!=='string'||!post.id.startsWith('recommendation:')||typeof post.title!=='string')return [];
       return [{...url,id:post.id,title:post.title.slice(0,300),retrievedAt:row.batch.retrievedAt,provider:'zhihu',verification:'api_metadata'}];
      });
      return [{account:row.account,batch:{...conditions,retrievedAt:row.batch.retrievedAt,items}}];
     }catch{return [];}
    });
   }catch(error){if(error.code==='ENOENT')return [];throw Error('无法读取本机推荐缓存，原缓存已保留。');}
  })();
  return loaded;
 }
 async function fetch(input,signal){
  const key=getKey(), fingerprint=account(key);
  try{
   const batch=await runSkill('question-recommendations',input,{key,signal});
   signal?.throwIfAborted();
   const task=queue.then(async()=>{
    signal?.throwIfAborted();
    if(fingerprint!==account(getKey()))throw Error('知乎授权已变更，请重新推荐。');
    const old=await read();
    const next=[{account:fingerprint,batch},...old.filter(row=>row.account!==fingerprint||
     row.batch.mode!==batch.mode||row.batch.query!==batch.query||row.batch.count!==batch.count)].slice(0,12);
    await fs.mkdir(directory,{recursive:true});
    const temp=file+'.'+randomUUID()+'.tmp';
    try{await fs.writeFile(temp,JSON.stringify({version:1,batches:next}),{flag:'wx',mode:0o600});
     signal?.throwIfAborted();
     await fs.rename(temp,file);}
    finally{await fs.rm(temp,{force:true});}
    loaded=Promise.resolve(next);
    return batch;
   });
   queue=task.catch(()=>{});
   return {batch:await task};
  }catch(error){return {problem:{code:typeof error.code==='number'?error.code:0,message:error.message}};}
 }
 return {fetch,latest:async()=>{const scope=account(getKey());return (await read()).find(row=>row.account===scope)?.batch??null;},
  source:async id=>{
   const scope=account(getKey());
   return (await read()).filter(row=>row.account===scope).flatMap(row=>row.batch.items).find(item=>item.id===id);
  },flush:()=>queue};
}
module.exports={recommendations};
