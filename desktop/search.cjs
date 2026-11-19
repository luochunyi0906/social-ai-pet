const{createHash,randomUUID}=require('node:crypto');const zhihu=require('./zhihu.cjs');
function postUrl(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('原文链接无效。');let kind;if(['www.zhihu.com','zhihu.com'].includes(u.hostname)){if(/^\/(?:question\/\d+(?:\/answer\/\d+)?|answer\/\d+)\/?$/.test(u.pathname))kind=u.pathname.includes('/answer/')||u.pathname.startsWith('/answer/')?'answer':'question';else throw Error('仅允许知乎问题、回答或专栏原文。');u.hostname='www.zhihu.com';}else if(u.hostname==='zhuanlan.zhihu.com'&&/^\/p\/\d+\/?$/.test(u.pathname))kind='article';else throw Error('仅允许知乎问题、回答或专栏原文。');u.hash='';u.pathname=u.pathname.replace(/\/$/,'');const trace=new URLSearchParams();for(const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']){const v=u.searchParams.get(k);if(v&&v.length<=300&&!/[\u0000-\u001f]/.test(v))trace.set(k,v);}u.search=trace.toString();const sourceUrl=u.href;u.search='';return{url:u.href,kind,sourceUrl,identity:kind+':'+u.pathname.match(/\d+/g).at(-1)};}
function config(env=process.env){const provider=(env.SEARCH_PROVIDER||'zhihu').trim(),apiKey=(provider==='zhihu'?env.ZHIHU_ACCESS_SECRET||'':env.SEARCH_API_KEY||'').trim();const issues=[];if(!['zhihu','bing-rss','brave'].includes(provider))issues.push('检索服务配置无效。');if(provider==='zhihu'&&!apiKey)issues.push('尚未填写知乎访问密钥 ZHIHU_ACCESS_SECRET；它与 OpenAI 密钥不同。');if(provider==='brave'&&!apiKey)issues.push('尚未填写Brave Search密钥。');if(apiKey&&/\s/.test(apiKey))issues.push('检索密钥不能包含空格或换行。');return{provider,apiKey,ready:!issues.length,issues,destination:provider==='zhihu'?'developer.zhihu.com':provider==='brave'?'api.search.brave.com':'www.bing.com',revision:createHash('sha256').update(provider+'\n'+apiKey).digest('hex')};}
function status(c=config()){return{provider:c.provider,ready:c.ready,issues:c.issues,destination:c.destination,configId:c.revision,experimental:c.provider==='bing-rss'};}
function queryText(value){if(typeof value!=='string'||!value.trim()||value.length>180)throw Error('请输入180字以内的检索关键词。');return value.trim();}
function decode(value){return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>{const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return code<=0x10ffff?String.fromCodePoint(code):'';}).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');}
function results(items,provider,limit=8){const seen=new Set(),out=[];for(const item of items){try{const p=postUrl(item.url);if(seen.has(p.url)||typeof item.title!=='string'||!item.title.trim())continue;seen.add(p.url);out.push({id:randomUUID(),title:decode(item.title).replace(/<[^>]*>/g,'').slice(0,300),url:p.url,kind:p.kind,provider,verification:'index_only',retrievedAt:new Date().toISOString()});}catch{}}return out.slice(0,limit);}
function parseRss(xml){if(!/<rss\b/i.test(xml))throw Error('检索服务没有返回可用RSS；可能暂时不可用。');return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map(([,item])=>({title:decode(item.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||''),url:decode(item.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]||'')}));}
// Relevance is a title keyword check, not a claim that the unseen article agrees.
function termsFor(query){
 const stop=new Set(['为什么','怎么','如何','什么','哪些','一下','关于','可以','是否','知乎','帖子','内容','相关','问题','讨论','一下子']);
 const chunks=query.toLowerCase().split(/[\s,，、；;]+/).map(x=>x.replace(/[?!？！。:："“”()（）]/g,'')).filter(Boolean);
 const segments=chunks.flatMap(x=>x.length<=12?[x]:[...new Intl.Segmenter('zh',{granularity:'word'}).segment(x)].filter(v=>v.isWordLike).map(v=>v.segment));
 return [...new Set(segments.filter(x=>x.length>1&&!stop.has(x)))].slice(0,12);
}
function relevance(post,terms){const title=post.title.toLowerCase();const matched=terms.filter(t=>title.includes(t));return{...post,titleMatches:matched.length,titleTerms:terms.length,relevance:terms.length&&matched.length===terms.length?'title_match':matched.length?'partial_title_match':'no_title_match'};}
async function search(value,{configuration=config(),configId,signal,fetchImpl=globalThis.fetch}={}){
 const query=queryText(value);if(!configuration.ready)throw Error(configuration.issues.join(' '));if(configId!==configuration.revision)throw Error('检索配置已变化，请重新确认授权。');
 const abort=new AbortController(),cancel=()=>abort.abort();if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});const timer=setTimeout(cancel,25000);
 const attempts=[],all=[];const terms=termsFor(query);
 try{
  // The RSS endpoint sometimes ignores site/locale constraints. Limit to two requests,
  // retain diagnostics, and never substitute off-domain or unrelated pages.
  for(const locale of configuration.provider==='zhihu'?['zhihu-api']:configuration.provider==='brave'?['brave']:['zh-CN','default']){
   if(abort.signal.aborted)throw Error('检索已取消。');let endpoint,headers={Accept:'application/rss+xml, application/json'};const keyword='site:zhihu.com '+query;
   if(configuration.provider==='zhihu'){
    endpoint=new URL(zhihu.ENDPOINT);endpoint.searchParams.set('Query',query);endpoint.searchParams.set('Count','10');headers={'Authorization':'Bearer '+configuration.apiKey,'X-Request-Timestamp':String(Math.floor(Date.now()/1000)),'Content-Type':'application/json','Accept':'application/json'};
   }else if(configuration.provider==='brave'){
    endpoint=new URL('https://api.search.brave.com/res/v1/web/search');endpoint.searchParams.set('q',keyword);endpoint.searchParams.set('count','20');endpoint.searchParams.set('search_lang','zh-hans');headers['X-Subscription-Token']=configuration.apiKey;
   }else{
    endpoint=new URL('https://www.bing.com/search');endpoint.searchParams.set('q',keyword);endpoint.searchParams.set('format','rss');if(locale==='zh-CN'){endpoint.searchParams.set('mkt','zh-CN');endpoint.searchParams.set('setlang','zh-hans');}
   }
   const response=await fetchImpl(endpoint,{method:'GET',headers,redirect:'error',signal:abort.signal});if(abort.signal.aborted)throw Error('检索已取消。');
   if(!response.ok){await response.body?.cancel();throw Error(response.status===401||response.status===403?'检索服务认证或访问被拒绝。':response.status===429?'检索服务频率或额度受限。':'检索服务暂时不可用。');}
   const reader=response.body?.getReader();if(!reader)throw Error('检索返回为空。');let bytes=0,chunks=[];
   try{while(true){const{done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>1024*1024)throw Error('检索响应过大。');chunks.push(Buffer.from(value));if(abort.signal.aborted)throw Error('检索已取消。');}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   if(abort.signal.aborted)throw Error('检索已取消。');const body=Buffer.concat(chunks).toString('utf8');let items;
   if(configuration.provider==='zhihu'){
    const data=zhihu.normalize(JSON.parse(body),postUrl,decode);if(abort.signal.aborted)throw Error('检索已取消。');
    const matching=data.results.filter(p=>relevance(p,terms).relevance==='title_match').length;
    return{query,provider:'zhihu',results:data.results,partialResults:[],emptyReason:data.emptyReason,searchHashId:data.searchHashId,diagnostics:{attempts:[{locale,http:response.status,rawCount:data.rawCount,validCount:data.results.length,matchedCount:matching}],rawCount:data.rawCount,validCount:data.results.length,matchedCount:matching,partialCount:0,rejectedCount:data.rawCount-data.results.length,terms,reason:data.results.length?'api_results':data.rawCount?'invalid_sources':'empty'},verification:'api_response'};
   }
   if(configuration.provider==='brave'){const raw=JSON.parse(body).web?.results||[];if(!Array.isArray(raw))throw Error('检索服务返回格式无效。');items=raw.map(r=>({title:r.title,url:r.url}));}else items=parseRss(body);
   const valid=results(items,configuration.provider,100).map(p=>relevance(p,terms));all.push(...valid);attempts.push({locale,http:response.status,rawCount:items.length,validCount:valid.length,matchedCount:valid.filter(p=>p.relevance==='title_match').length});
   if(valid.some(p=>p.relevance==='title_match'))break;
  }
  if(abort.signal.aborted)throw Error('检索已取消。');
  const seen=new Set(),dedup=all.filter(p=>{if(seen.has(p.url))return false;seen.add(p.url);return true;}),matched=dedup.filter(p=>p.relevance==='title_match').slice(0,8),partial=dedup.filter(p=>p.relevance==='partial_title_match').slice(0,8);
  const diagnostics={attempts,rawCount:attempts.reduce((s,a)=>s+a.rawCount,0),validCount:dedup.length,matchedCount:matched.length,partialCount:partial.length,rejectedCount:dedup.filter(p=>p.relevance==='no_title_match').length,terms,reason:matched.length?'matched':!dedup.length?'no_zhihu':'no_title_match'};
  return{query,provider:configuration.provider,results:matched,partialResults:partial,diagnostics,verification:'index_only'};
 }catch(e){if(abort.signal.aborted)throw Error(signal?.aborted?'检索已取消。':'检索超时。');if(e.name==='TypeError'||e.name==='SyntaxError')throw Error('无法连接或解析检索服务，请检查网络或更换服务。');throw e;}finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
module.exports={quota,postUrl,config,status,queryText,parseRss,results,termsFor,relevance,search};

async function quota({configuration=config(),configId,signal,fetchImpl=globalThis.fetch,scope}={}){
 const supported=scope==='question_discovery'?['question_discovery']:['zhihu_search','zhida_openai'];
 if(configuration.provider!=='zhihu'||!configuration.ready)throw Error('请先配置知乎 ZHIHU_ACCESS_SECRET。');if(configId!==configuration.revision)throw Error('知乎配置已变化，请重新检查。');
 const abort=new AbortController(),cancel=()=>abort.abort();if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});const timer=setTimeout(cancel,25000);
 try{if(abort.signal.aborted)throw Error('查询已取消。');const url=new URL('https://developer.zhihu.com/api/v1/quota');url.searchParams.set('APIIDs',supported.join(','));
 const response=await fetchImpl(url,{method:'GET',redirect:'error',signal:abort.signal,headers:{Authorization:'Bearer '+configuration.apiKey,'X-Request-Timestamp':String(Math.floor(Date.now()/1000)),'Content-Type':'application/json'}});if(abort.signal.aborted)throw Error('查询已取消。');
 if(!response.ok){await response.body?.cancel();throw Error(response.status===401||response.status===403?'知乎访问鉴权失败，请检查Access Secret。':response.status===429?'知乎额度查询频率受限。':'知乎额度服务暂时不可用。');}
 const reader=response.body?.getReader();if(!reader)throw Error('知乎额度响应为空。');const chunks=[];let size=0;
 try{while(true){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>128*1024)throw Error('知乎额度响应过大。');chunks.push(Buffer.from(value));if(abort.signal.aborted)throw Error('查询已取消。');}}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 if(abort.signal.aborted)throw Error('查询已取消。');const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!Number.isInteger(data?.Code))throw Error('知乎额度格式无效。');if(data.Code!==0)throw zhihu.apiError(data.Code);if(!Array.isArray(data.Data)||data.Data.length>20)throw Error('知乎额度列表格式无效。');
 const seen=new Set(),items=[];for(const x of data.Data){if(!supported.includes(x?.APIID)||seen.has(x.APIID)||!['TotalQuota','TotalUsed','RemainingQuota'].every(k=>Number.isSafeInteger(x[k])&&x[k]>=0))throw Error('知乎额度字段无效。');seen.add(x.APIID);items.push({apiId:x.APIID,name:({zhihu_search:'知乎搜索',zhida_openai:'知乎直答',question_discovery:'问题发现'})[x.APIID],total:x.TotalQuota,used:x.TotalUsed,remaining:x.RemainingQuota});}return{items,checkedAt:new Date().toISOString()};
 }catch(e){if(abort.signal.aborted)throw Error(signal?.aborted?'额度查询已取消。':'知乎额度查询超时。');if(e.name==='TypeError'||e.name==='SyntaxError')throw Error('无法连接或解析知乎额度服务。');throw e;}finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
}
