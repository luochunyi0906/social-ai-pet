import test from'node:test';import assert from'node:assert/strict';import{createRequire}from'node:module';import{nextBehavior,INITIAL_STATE}from'../src/shared/behavior.mjs';
const require=createRequire(import.meta.url),s=require('../desktop/search.cjs'),c=s.config({SEARCH_PROVIDER:'bing-rss'});
const rss=items=>'<rss><channel>'+items.map(x=>`<item><title>${x[0]}</title><link>${x[1]}</link></item>`).join('')+'</channel></rss>';
test('RSS有效来源不等于相关命中；全匹配、部分匹配和无关分开',async()=>{
 let calls=0;const r=await s.search('机器人 信任',{configuration:c,configId:c.revision,fetchImpl:async()=>{calls++;return new Response(rss([['机器人公司名单','https://zhuanlan.zhihu.com/p/10'],['怎么训练小狗','https://www.zhihu.com/question/12'],['银行信任机制','https://example.org/13']]));}});
 assert.equal(calls,2);assert.equal(r.results.length,0);assert.equal(r.partialResults.length,1);assert.equal(r.diagnostics.validCount,2);assert.equal(r.diagnostics.rejectedCount,1);assert.equal(r.diagnostics.reason,'no_title_match');
});
test('中文locale可命中时不重复调用，缺结果才回到默认locale',async()=>{
 const seen=[];const r=await s.search('香港 城市大学',{configuration:c,configId:c.revision,fetchImpl:async u=>{const url=new URL(u);seen.push(url);return new Response(rss([['香港城市大学如何选择专业','https://www.zhihu.com/question/123']]));}});assert.equal(seen.length,1);assert.equal(seen[0].searchParams.get('mkt'),'zh-CN');assert.equal(r.results.length,1);assert.equal(r.diagnostics.matchedCount,1);
 const retry=[];const recovered=await s.search('北极狐',{configuration:c,configId:c.revision,fetchImpl:async u=>{retry.push(new URL(u));return new Response(retry.length===1?rss([]):rss([['北极狐为什么换毛','https://www.zhihu.com/question/123']]));}});assert.equal(retry.length,2);assert.equal(retry[1].searchParams.has('mkt'),false);assert.equal(recovered.results.length,1);
});
test('第二次RSS请求取消后迟到成功不能成为结果',async()=>{
 const cancel=new AbortController();let n=0;await assert.rejects(s.search('北极狐',{configuration:c,configId:c.revision,signal:cancel.signal,fetchImpl:async()=>{if(++n===2)cancel.abort();return new Response(rss([]));}}),/取消/);assert.equal(n,2);
});
test('Brave只向固定HTTPS服务发送关键词与主进程密钥',async()=>{
 const brave=s.config({SEARCH_PROVIDER:'brave',SEARCH_API_KEY:'test-only-secret'});let sent;const r=await s.search('北极狐',{configuration:brave,configId:brave.revision,fetchImpl:async(u,options)=>{sent={u:new URL(u),options};return Response.json({web:{results:[{title:'北极狐的毛色','url':'https://zhuanlan.zhihu.com/p/123'}]}});}});assert.equal(sent.u.hostname,'api.search.brave.com');assert.equal(sent.u.searchParams.get('search_lang'),'zh-hans');assert.equal(sent.options.headers['X-Subscription-Token'],'test-only-secret');assert.ok(!sent.u.href.includes('test-only-secret'));assert.equal(r.results.length,1);
});
test('交互动作由同一控制器选择；停止/低打扰覆盖所有业务与手势',()=>{
 const mapping={look:'look',greet:'greet',lift:'lift',land:'land',searching:'think',found:'found',empty:'empty',oops:'oops',keep:'keep','speak-warm':'warm','speak-curious':'look','speak-calm':'speak'};
 for(const[kind,action]of Object.entries(mapping)){assert.equal(nextBehavior(INITIAL_STATE,0,false,'idle',kind).action,action);assert.equal(nextBehavior({...INITIAL_STATE,paused:true},0,false,'carry',kind).action,'paused');assert.equal(nextBehavior(INITIAL_STATE,0,true,'carry',kind).action,'rest');}
 assert.equal(nextBehavior(INITIAL_STATE,0,false,'explore','look').action,'read');assert.equal(nextBehavior(INITIAL_STATE,0,false,'carry','lift').action,'lift');
});
test('先评估全部受限响应再截取展示；第9、10条相关索引不丢失',async()=>{
 const items=Array.from({length:10},(_,i)=>[i<8?'完全无关的标题':'香港城市大学专业讨论'+i,'https://www.zhihu.com/question/'+(100+i)]);
 const result=await s.search('香港 城市大学',{configuration:c,configId:c.revision,fetchImpl:async()=>new Response(rss(items))});assert.equal(result.diagnostics.validCount,10);assert.equal(result.results.length,2);assert.ok(result.results.every(p=>p.title.includes('香港城市大学')));
});
