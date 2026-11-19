import {MovementSettings} from './MovementSettings';
import {WeatherControls} from './WeatherSettings';
import{useEffect,useRef,useState}from'react';
import{unwrap,type ModelStatus,type ChatStatus,type ConnectionCheck,type SearchStatus,type ZhihuQuota,type CompanionPrefs}from'./types';
const bridge=window.kanshan;
export function ModelPanel({status,onStatus,onClose,onCompanionChange}:{status:ModelStatus;onStatus:(s:ModelStatus)=>void;onClose:()=>void;onCompanionChange?:()=>void}){
 const[companion,setCompanion]=useState<CompanionPrefs>();
 const[companionSaving,setCompanionSaving]=useState(false);
 const[search,setSearch]=useState<SearchStatus|null>(null),[quota,setQuota]=useState<ZhihuQuota|null>(null),[quotaChecking,setQuotaChecking]=useState(false);
 const[chat,setChat]=useState<ChatStatus|null>(null);
 const[agreed,setAgreed]=useState(false),[checking,setChecking]=useState(false),[refreshing,setRefreshing]=useState(false);
 const[result,setResult]=useState<ConnectionCheck|null>(null),[error,setError]=useState('');
 const current=useRef<string|null>(null),alive=useRef(true),refreshVersion=useRef(0),refreshPending=useRef(false);
 useEffect(()=>{if(bridge?.companionSettings)void unwrap(bridge.companionSettings()).then(setCompanion).catch(e=>setError(e.message));},[]);
 async function saveCompanion(prefs:CompanionPrefs){
  if(!bridge||companionSaving)return;
  setCompanionSaving(true);
  try{setCompanion(await unwrap(bridge.companionSave(prefs)));onCompanionChange?.();}
  catch(error){setError((error as Error).message);}
  finally{setCompanionSaving(false);}
 }
 function cancel(){refreshVersion.current++;refreshPending.current=false;setRefreshing(false);setQuotaChecking(false);const id=current.current;current.current=null;setAgreed(false);setChecking(false);if(id&&bridge)void bridge.cancel(id);}
 useEffect(()=>{alive.current=true;if(bridge)void unwrap(bridge.searchStatus()).then(s=>{if(alive.current)setSearch(s);}).catch(()=>{});const off=bridge?.onSuspend(()=>{cancel();onClose();});return()=>{alive.current=false;refreshVersion.current++;refreshPending.current=false;off?.();const id=current.current;current.current=null;if(id&&bridge)void bridge.cancel(id);};},[]);
 useEffect(()=>{setAgreed(false);setResult(null);setError('');},[status.configId]);
 useEffect(()=>{
  let active=true;
  if(bridge)void unwrap(bridge.chatStatus()).then(value=>{if(active)setChat(value);}).catch(()=>{});
  return()=>{active=false;};
 },[]);
 async function refresh(){if(!bridge||current.current||refreshPending.current)return;const version=++refreshVersion.current;refreshPending.current=true;setRefreshing(true);setQuota(null);setError('');setResult(null);setAgreed(false);
 try{const updated=await unwrap(bridge.refreshConfig());const [discovered,newChat]=await Promise.all([unwrap(bridge.searchStatus()),unwrap(bridge.chatStatus())]);if(alive.current&&version===refreshVersion.current){onStatus(updated);setSearch(discovered);setChat(newChat);}}
 catch(e){if(alive.current&&version===refreshVersion.current)setError((e as Error).message);}
 finally{if(version===refreshVersion.current){refreshPending.current=false;if(alive.current)setRefreshing(false);}}}
 async function checkQuota(){if(!bridge||!search?.ready||search.provider!=='zhihu'||current.current||refreshPending.current)return;const id=crypto.randomUUID();current.current=id;setQuotaChecking(true);setError('');setQuota(null);try{const data=await unwrap(bridge.zhihuQuota({id,consent:true,configId:search.configId}));if(alive.current&&current.current===id)setQuota(data);}catch(e){if(alive.current&&current.current===id)setError((e as Error).message);}finally{if(current.current===id){current.current=null;if(alive.current)setQuotaChecking(false);}}}
 async function test(){if(!bridge||!agreed||current.current||refreshPending.current)return;const id=crypto.randomUUID();current.current=id;setChecking(true);setError('');setResult(null);try{const checked=await unwrap(bridge.checkModel({id,consent:agreed,configId:status.configId}));if(alive.current&&current.current===id)setResult(checked);}catch(e){if(alive.current&&current.current===id)setError((e as Error).message);}finally{if(current.current===id){current.current=null;if(alive.current){setChecking(false);setAgreed(false);}}}}
 return <div className="modal-backdrop"><section className="modal model-panel" role="dialog" aria-modal="true" aria-labelledby="model-title">
 <button className="modal-close" aria-label="关闭模型接入" onClick={()=>{cancel();onClose();}}>×</button>
 <p className="eyebrow">A CONNECTION FOR CURIOSITY</p><h2 id="model-title">接上真正的好奇心</h2>
 <p className="dialog-description">先确认服务地址与模型，再用一小段内置材料测试。你的文件和收藏不会用于此测试。</p>
 <MovementSettings/><WeatherControls/>
 {companion&&<section className="setup-guide companion-settings" aria-label="主动聊天设置">
  <label><input type="checkbox" checked={companion.enabled} disabled={companionSaving}
   onChange={event=>void saveCompanion({...companion,enabled:event.target.checked})}/> 刘看山可以主动找我聊天</label>
  <label>开口频率 <select value={companion.frequency} disabled={companionSaving}
   onChange={event=>void saveCompanion({...companion,frequency:event.target.value as CompanionPrefs['frequency']})}>
   <option value="low">少一点</option><option value="regular">偶尔聊聊</option></select></label>
  <p>从今日热榜或小日常挑一个话题。热榜开场沿用每日提醒设置。想让刘看山下次问起某件事，可以在聊天里说「下次问我……」。</p>
 </section>}
 <div className={`connection-state ${status.modelReady?'configured':''}`}><span/>{result?'本次连接与格式验证通过':status.modelReady?'配置格式有效 · 尚需测试服务':'模型尚未配置完成'}</div>
 <dl className="model-facts"><div><dt>发送目的地</dt><dd>{status.destination}</dd></div><div><dt>模型名称</dt><dd>{status.model||'未填写'}</dd></div><div><dt>访问密钥</dt><dd>{status.hasKey?'已填写 · 不在界面显示':'未填写'}</dd></div><div><dt>等待时限</dt><dd>{status.timeoutMs>=1000?`${status.timeoutMs/1000} 秒`:'配置无效'}</dd></div></dl>
 {status.issues.length>0&&<ul className="config-issues">{status.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul>}
 <details className="setup-guide" open={!status.modelReady}><summary>如何填写本机配置</summary><p>双击配套的 Configure-Model.command。知乎直答填写 MODEL_PROVIDER=zhida、ZHIDA_MODEL=zhida-fast-1p5 和 ZHIHU_ACCESS_SECRET；OpenAI兼容配置可保留，切回时使用 MODEL_PROVIDER=openai-compatible。独立应用读取用户数据目录中的 model.env，开发模式读取源码 .env。请在本机编辑密钥，不用发到聊天里。</p><p>填好后点击“重新检查配置”。选择支持 Chat Completions 的服务；接口或模型不兼容时会显示原因。</p></details>
 <div className="setup-guide"><p>文字聊天：{chat?.ready?`${chat.model} · ${chat.destination}`:chat?'尚未完成配置':'读取配置中'}</p><p>聊天默认使用知乎直答。可在 model.env 填写 ZHIHU_ACCESS_SECRET，ZHIDA_MODEL 可选快速档 zhida-fast-1p5 或思考档 zhida-thinking-1p5。本机模型可显式设置 CHAT_PROVIDER=ollama 或 llama.cpp。聊天请在营地对话面板中测试。</p></div>
 <div className="setup-guide"><p>知乎检索：{search?.destination||'读取配置中'}{search?.experimental?'（实验性公共RSS，可能无结果）':''}</p><p>知乎搜索接口使用 SEARCH_PROVIDER=zhihu 和 ZHIHU_ACCESS_SECRET；它与 OpenAI 模型密钥不同。仅发送检索关键词，不外发文件正文。</p></div>
 <button className="refresh-config" disabled={checking||quotaChecking||refreshing||!bridge} onClick={refresh}>{refreshing?'检查中…':'重新检查配置'}</button>
 {search?.provider==='zhihu'&&<section className="quota-check"><p>点击下方按钮，仅向 developer.zhihu.com 查询当前账号的每日限免次数，不发送关键词、文件或收藏；这不是账户钱包余额。</p><button disabled={!search.ready||checking||quotaChecking||refreshing} onClick={checkQuota}>{quotaChecking?'查询知乎额度中…':'查询知乎每日额度（联网）'}</button>{quota&&<div role="status">{quota.items.length?quota.items.map(item=><p key={item.apiId}>{item.name}：当日剩余 {item.remaining} / {item.total} 次，已用 {item.used} 次</p>):<p>接口未返回可展示额度项，不能据此判断为无限额度或零余额。</p>}<small>查询时间：{new Date(quota.checkedAt).toLocaleString('zh-CN')}</small></div>}</section>}
 <label className="consent"><input type="checkbox" checked={agreed} disabled={!status.modelReady||checking||quotaChecking} onChange={e=>setAgreed(e.target.checked)}/><span>同意向 {status.destination} 发送内置“北极狐”测试段落，验证连接与问题格式。这会调用一次所选模型，可能计费，不会发送我的投喂内容或收藏。</span></label>
 {checking&&<p className="processing" role="status">正在等待模型返回有效问题……可随时取消。</p>}
 {error&&<p className="inline-error" role="alert">{error}</p>}
 {result&&<div className="connection-success" role="status">连接成功，收到 {result.questionCount} 个有效问题。<small>仅验证本次连接与返回格式；实际材料的相关性仍需检查。</small></div>}
 <div className="dialog-actions"><button onClick={()=>{cancel();onClose();}}>取消</button><button className="primary" disabled={!bridge||!status.modelReady||!agreed||checking||quotaChecking||refreshing} onClick={test}>{checking?'连接测试中…':'测试连接'}</button></div>
 </section></div>;
}
