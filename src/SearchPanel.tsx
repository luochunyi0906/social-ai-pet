import {useActorEvents} from './ActorAnimation';
import{useEffect,useRef,useState}from'react';
import{Companion}from'./Companion';
import{unwrap,type SearchStatus,type SearchResponse,type ModelStatus}from'./types';
const bridge=window.kanshan;
export function SearchPanel({query,onClose,onResults,onActivity,actorAction,onModelStatus}:{query:string;onClose:()=>void;onResults:(result:SearchResponse)=>void;onActivity:(event:string)=>void;actorAction:string;onModelStatus:(s:ModelStatus)=>void}){
 const actor=useActorEvents();
 const[text,setText]=useState(query),[status,setStatus]=useState<SearchStatus|null>(null),[agree,setAgree]=useState(false),[busy,setBusy]=useState(false),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[last,setLast]=useState<SearchResponse|null>(null);
 const current=useRef<string|null>(null),alive=useRef(true),configVersion=useRef(0);
 function cancel(){const id=current.current;current.current=null;if(id){actor.request('search',id,false);void bridge?.cancel(id);}setBusy(false);setAgree(false);if(id){setNotice('已取消本次检索，迟到结果不会显示。');onActivity('idle');}}
 async function refresh(){if(!bridge||current.current)return;const v=++configVersion.current;setRefreshing(true);setAgree(false);setError('');try{const modelStatus=await unwrap(bridge.refreshConfig());const s=await unwrap(bridge.searchStatus());if(alive.current&&configVersion.current===v){setStatus(s);onModelStatus(modelStatus);setNotice('已重新读取本机配置，请重新确认发送。');}}catch(e){if(alive.current&&configVersion.current===v)setError((e as Error).message);}finally{if(alive.current&&configVersion.current===v)setRefreshing(false);}}
 async function configure(){if(!bridge)return;try{await unwrap(bridge.openSearchConfig());setNotice('已打开本机配置。填写 SEARCH_PROVIDER=zhihu 和 ZHIHU_ACCESS_SECRET 后保存（不是 OpenAI 密钥），再点“重新检查配置”。密钥只留在本机。');}catch(e){setError((e as Error).message);}}
 useEffect(()=>{alive.current=true;if(bridge)void unwrap(bridge.searchStatus()).then(s=>{if(alive.current)setStatus(s);}).catch(e=>{if(alive.current)setError(e.message);});return()=>{alive.current=false;configVersion.current++;const id=current.current;current.current=null;if(id){actor.request('search',id,false);void bridge?.cancel(id);}};},[]);
 async function search(){if(!bridge||!status||!agree||current.current||refreshing)return;const id=crypto.randomUUID();current.current=id;setBusy(true);setError('');setNotice('');setLast(null);actor.request('search',id,true);onActivity('searching');try{const result=await unwrap(bridge.searchPosts({id,query:text,consent:agree,configId:status.configId}));if(alive.current&&current.current===id){onResults(result);setLast(result);onActivity(result.results.length?'found':'empty');if(result.results.length)onClose();else setNotice(result.provider==='zhihu'?(result.emptyReason|| (result.diagnostics.rawCount?'知乎接口有返回，但链接或内容类型未通过校验。':'知乎接口本次没有找到内容，可调整关键词重试。')):result.diagnostics.validCount?'取得了知乎索引，但标题未同时匹配这些关键词；没有把不相关帖子当成成功结果。':'服务返回了数据，但没有符合来源要求的知乎问题、回答或文章。可换词重试，或配置 Brave Search。');}}catch(e){if(alive.current&&current.current===id){setError((e as Error).message);onActivity('oops');}}finally{actor.request('search',id,false);if(current.current===id){current.current=null;if(alive.current){setBusy(false);setAgree(false);}}}}
 return <div className="modal-backdrop"><section className="modal search-modal" role="dialog" aria-modal="true" aria-labelledby="search-title" data-hit>
 <button className="modal-close" aria-label="关闭知乎检索" onClick={()=>{cancel();onClose();}}>×</button>
 <p className="eyebrow">FIND A REAL DISCUSSION</p><h2 id="search-title">沿着线索，找一段真实讨论</h2>
 <div className="modal-companion"><Companion action={actorAction}/><p>{busy?'正在核对关键词与真实来源……':status?.provider==='zhihu'?'通过知乎接口取得内容摘要，不登录或抓取受限全文。':'只检索公开索引，不登录或抓取受限正文。'}</p></div>
 <label className="search-field"><span>本次关键词</span><input value={text} disabled={busy} maxLength={180} onChange={e=>{setText(e.target.value);setAgree(false);setLast(null);setNotice('');}} placeholder="例如：香港 城市大学"/></label>
 <p className="dialog-description">服务：{status?.destination||'读取配置中'}{status?.experimental?' · 实验性公共 Bing RSS，不保证站点约束和相关性。最多两次同关键词请求。':''}</p>
 <div className="config-actions"><button disabled={busy||refreshing} onClick={configure}>打开本机检索配置</button><button disabled={busy||refreshing} onClick={refresh}>{refreshing?'检查中…':'重新检查配置'}</button></div>
 {status?.issues.map(x=><p key={x} className="inline-error">{x}</p>)}
 <label className="consent"><input type="checkbox" checked={agree} disabled={busy||refreshing||!status?.ready} onChange={e=>setAgree(e.target.checked)}/><span>同意仅向上述服务发送这组关键词进行内容检索，不发送投喂原文。{status?.provider==='brave'?'Brave可能按服务账户计费。':''}</span></label>
 {notice&&<p role="status" className="search-notice">{notice}</p>}{last&&<p className="search-diagnostics">返回 {last.diagnostics.rawCount} 条 · 有效知乎来源 {last.diagnostics.validCount} 条。{last.provider==='zhihu'?'按接口返回排序；摘要不等于全文。':`标题全匹配 ${last.diagnostics.matchedCount} 条，部分匹配 ${last.diagnostics.partialCount} 条；标题匹配不等于正文相关性。`}</p>}
 {error&&<p role="alert" className="inline-error">{error}</p>}{busy&&<p role="status" className="processing">正在检索，最多等待25秒……可随时停止。</p>}
 <div className="dialog-actions"><button onClick={()=>{if(busy)cancel();else onClose();}}>{busy?'停止检索':'返回山洞'}</button><button className="primary" disabled={!agree||!text.trim()||busy||refreshing||!status?.ready} onClick={search}>{busy?'检索中…':last||error?'重新检索':'查找真实知乎内容'}</button></div>
 </section></div>;
}
