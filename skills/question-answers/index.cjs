const {postUrl}=require('../../desktop/search.cjs');
const {readJson}=require('../../desktop/model.cjs');
const errors={
 10001:'问题不存在，或问题链接、分页参数无效。',
 20001:'知乎鉴权或问题发现权限不足。',
 30001:'达到知乎问题发现频率、并发或当日额度限制，请稍后再试。',
 30002:'问题发现累计调用额度已耗尽。',
 30003:'本次请求被知乎风控拒绝。',
 90001:'知乎问题回答服务暂不可用。'
};

function questionUrl(value){
 if(typeof value!=='string'||value.length>2000)throw Error('请输入完整的知乎问题链接。');
 const link=postUrl(value);
 if(link.kind!=='question')throw Error('问题回答 Skill 需要知乎问题链接。');
 return link.url;
}
async function run({url,offset=0,limit=20}={}, {key,signal,fetchImpl=globalThis.fetch}={}){
 const question=questionUrl(url);
 if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>50)throw Error('回答分页参数无效。每页可获取 1–50 条。');
 if(!key||/\s/.test(key))throw Error('请先填写本机知乎访问密钥。');
 const target=new URL('https://developer.zhihu.com/api/v1/content/question_answers');
 target.search=new URLSearchParams({QuestionUrl:question,Offset:String(offset),Limit:String(limit)}).toString();
 const deadline=AbortSignal.timeout(18000);
 const abort=signal?AbortSignal.any([signal,deadline]):deadline;
 let response;
 try{response=await fetchImpl(target.href,{method:'GET',redirect:'error',signal:abort,headers:{
  Authorization:'Bearer '+key,'X-Request-Timestamp':String(Math.floor(Date.now()/1000)),'Content-Type':'application/json'
 }});}
 catch{throw Error(signal?.aborted?'已取消获取回答。':deadline.aborted?'获取知乎回答超时。':'无法连接知乎问题回答服务。');}
 if(!response.ok){
  await response.body?.cancel();
  throw Error(response.status===429?errors[30001]:[401,403].includes(response.status)?errors[20001]:errors[90001]);
 }
 const payload=await readJson(response,abort);
 if(payload?.Code!==0)throw Error(errors[payload?.Code]??'知乎问题回答返回异常。');
 const {Items,Paging}=payload.Data??{};
 if(!Array.isArray(Items)||typeof Paging?.IsEnd!=='boolean')throw Error('知乎回答或分页格式不完整。');
 const items=Items.slice(0,limit).flatMap(item=>{
  if(typeof item?.ContentType!=='string'||item.ContentType.toLowerCase()!=='answer'||typeof item.ContentToken!=='string'||typeof item.Summary!=='string')return [];
  if(typeof item.Url!=='string'||item.Url.length>2000)return [];
  try{
   const link=postUrl(item.Url);
   const summary=item.Summary.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,'').trim().slice(0,4000);
   if(link.kind!=='answer'||!summary||
    (link.url.includes('/question/')&&!link.url.startsWith(question+'/answer/')))return [];
   return [{id:item.ContentToken,url:link.sourceUrl,summary}];
  }catch{return [];}
 });
 const next=Paging.NextOffset;
 const incomplete=!Paging.IsEnd&&(!Number.isSafeInteger(next)||next<=offset);
 return {items,end:Paging.IsEnd,nextOffset:Paging.IsEnd||incomplete?undefined:next,
  pagingIncomplete:incomplete,total:Number.isSafeInteger(Paging.Totals)&&Paging.Totals>=0?Paging.Totals:undefined};
}
module.exports={run};
