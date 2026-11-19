const {randomUUID}=require('node:crypto');
const ENDPOINT='https://developer.zhihu.com/api/v1/content/zhihu_search';
const VERIFICATIONS=new Set(['index_only','api_metadata','api_excerpt']);
function plain(value,max){return typeof value==='string'?value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').trim().slice(0,max):'';}
function apiError(code){return new Error(({10001:'知乎接口参数错误，请调整关键词。',20001:'知乎访问密钥未通过鉴权，请检查 ZHIHU_ACCESS_SECRET 及电脑时间。',30001:'知乎接口频率受限，请稍后手动重试。',90001:'知乎接口内部错误，请稍后重试。'})[code]||'知乎接口返回未识别的错误，未使用返回内容。');}
function normalize(payload,postUrl,decode){
 if(!payload||!Number.isInteger(payload.Code))throw Error('知乎接口返回格式无效：缺少业务状态码。');
 if(payload.Code!==0)throw apiError(payload.Code);
 const data=payload.Data;if(!data||!Array.isArray(data.Items)||typeof data.HasMore!=='boolean'||typeof data.SearchHashId!=='string')throw Error('知乎接口返回格式无效：缺少结果列表。');
 const seen=new Set(),results=[];const retrievedAt=new Date().toISOString();
 for(const item of data.Items.slice(0,10)){
  try{
   if(!item||typeof item.Title!=='string'||!item.Title.trim()||typeof item.ContentID!=='string'||!item.ContentID.trim()||typeof item.ContentText!=='string')continue;
   const kind=({question:'question',answer:'answer',article:'article'})[String(item.ContentType).toLowerCase()];if(!kind)continue;
   const link=postUrl(item.Url);if(link.kind!==kind||seen.has(link.identity))continue;
   const title=plain(decode(item.Title),300),excerpt=plain(decode(item.ContentText),4000);if(!title)continue;
   seen.add(link.identity);const result={id:randomUUID(),title,url:link.url,sourceUrl:link.sourceUrl,kind,contentId:plain(item.ContentID,200),provider:'zhihu',verification:excerpt?'api_excerpt':'api_metadata',retrievedAt,excerpt,relevance:'api_ranked'};
   if(typeof item.AuthorName==='string'&&plain(item.AuthorName,100))result.authorName=plain(item.AuthorName,100);
   for(const[from,to]of [['CommentCount','commentCount'],['VoteUpCount','voteUpCount'],['CreateTime','createdTime'],['EditTime','editedTime']])if(Number.isSafeInteger(item[from])&&item[from]>=0)result[to]=item[from];
   results.push(result);
  }catch{/* An invalid item is excluded; it cannot become a forged source. */}
 }
 return{results,rawCount:data.Items.length,emptyReason:plain(typeof data.EmptyReason==='string'?decode(data.EmptyReason):'',300),searchHashId:plain(data.SearchHashId,256)};
}
function sourceInfo(receipt,postUrl){
 if(!VERIFICATIONS.has(receipt?.verification)||typeof receipt.provider!=='string'||typeof receipt.retrievedAt!=='string'||!Number.isFinite(Date.parse(receipt.retrievedAt)))throw Error('来源信息无效。');
 const source={provider:receipt.provider,verification:receipt.verification,retrievedAt:receipt.retrievedAt};
 if(receipt.sourceUrl){const link=postUrl(receipt.sourceUrl);if(link.url!==postUrl(receipt.url).url)throw Error('来源链接不一致。');source.sourceUrl=link.sourceUrl;}
 if(receipt.provider==='zhihu'){
  for(const[k,max]of [['excerpt',4000],['authorName',100],['contentId',200]])if(typeof receipt[k]==='string')source[k]=plain(receipt[k],max);
  for(const k of ['commentCount','voteUpCount','createdTime','editedTime'])if(Number.isSafeInteger(receipt[k])&&receipt[k]>=0)source[k]=receipt[k];
 }
 return source;
}
function validateSource(source,url,postUrl){
 if(!source||!VERIFICATIONS.has(source.verification)||typeof source.provider!=='string')throw Error('知乎收藏来源损坏，已停止写入。');
 // Existing index-only records remain valid without any new optional field.
 if(source.verification!=='index_only'&&source.provider!=='zhihu')throw Error('接口来源标记无效。');
 if(source.sourceUrl&&postUrl(source.sourceUrl).url!==postUrl(url).url)throw Error('知乎收藏链接不一致。');
 for(const[k,max]of [['excerpt',4000],['authorName',100],['contentId',200]])if(source[k]!==undefined&&(typeof source[k]!=='string'||source[k].length>max))throw Error('知乎收藏元数据损坏。');
 for(const k of ['commentCount','voteUpCount','createdTime','editedTime'])if(source[k]!==undefined&&(!Number.isSafeInteger(source[k])||source[k]<0))throw Error('知乎收藏计数或时间损坏。');
 if(source.verification==='api_excerpt'&&!source.excerpt?.trim())throw Error('知乎摘要缺失。');
}
module.exports={ENDPOINT,normalize,sourceInfo,validateSource,apiError};
