const {randomUUID}=require('node:crypto');
const {postUrl}=require('../../desktop/search.cjs');
const {readJson}=require('../../desktop/model.cjs');
const errors={
 10001:'推荐参数无效，请检查主题和数量。',
 20001:'知乎鉴权或问题发现权限不足。',
 30001:'问题发现请求受限，可能涉及频率、并发或当日额度。',
 30002:'问题发现累计成功次数额度已耗尽。',
 30003:'本次推荐请求被知乎风控拒绝。',
 90001:'知乎问题推荐服务暂不可用，请稍后重试。'
};
function fail(code,message){
 throw Object.assign(Error(message??errors[code]??'知乎问题推荐返回异常。'),{code});
}
function validate(input={}){
 const {mode,count=5}=input;
 if(!['account','topic'].includes(mode)||!Number.isSafeInteger(count)||count<1||count>20)fail(10001);
 if(mode==='account')return {mode,count};
 const query=typeof input.query==='string'?input.query.trim():'';
 if(!query)fail(10001,'请输入一个主题。');
 if(query.length>180)fail(10001,'主题请控制在 180 字以内。');
 return {mode,count,query};
}
async function run(input,{key,signal,fetchImpl=globalThis.fetch}={}){
 const conditions=validate(input);
 if(!key||/\s/.test(key))fail(20001,'请先填写本机知乎访问密钥。');
 const url=new URL('https://developer.zhihu.com/api/v1/user/question_recommendations');
 if(conditions.mode==='topic')url.searchParams.set('Query',conditions.query);
 url.searchParams.set('Count',String(conditions.count));
 const deadline=AbortSignal.timeout(18000);
 const abort=signal?AbortSignal.any([signal,deadline]):deadline;
 let response;
 try{response=await fetchImpl(url.href,{method:'GET',redirect:'error',signal:abort,headers:{
  Authorization:'Bearer '+key,'X-Request-Timestamp':String(Math.floor(Date.now()/1000)),'Content-Type':'application/json'
 }});}
 catch{fail(90001,signal?.aborted?'推荐请求已取消。':deadline.aborted?'获取推荐超时。':'无法连接知乎问题推荐服务。');}
 if(!response.ok){
  await response.body?.cancel();
  fail(response.status===429?30001:[401,403].includes(response.status)?20001:90001);
 }
 const payload=await readJson(response,abort);
 if(payload?.Code!==0)fail(payload?.Code);
 if(!Array.isArray(payload.Data?.Items))fail(90001,'知乎推荐返回的结果格式不完整。');
 const retrievedAt=new Date().toISOString();
 const seen=new Set();
 const items=payload.Data.Items.slice(0,conditions.count).flatMap(item=>{
  if(typeof item?.Title!=='string'||typeof item.Url!=='string'||item.Url.length>2000)return [];
  try{
   const url=postUrl(item.Url);
   const title=item.Title.trim().slice(0,300);
   if(!title||url.kind!=='question'||seen.has(url.url))return [];
   seen.add(url.url);
   return [{...url,id:'recommendation:'+randomUUID(),title,retrievedAt,verification:'api_metadata',provider:'zhihu'}];
  }catch{return [];}
 });
 if(payload.Data.Items.length&&!items.length)fail(90001,'接口没有返回可安全打开的知乎问题。');
 return {...conditions,items,retrievedAt};
}
module.exports={run,validate};
