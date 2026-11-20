import { ModelSettingsForm } from './ModelSettingsForm';
import { FeatureGuide } from './FeatureGuide';
import {MovementSettings} from './MovementSettings';
import {WeatherControls} from './WeatherSettings';
import {MinesSettings} from './MinesCompanion';
import{useEffect,useRef,useState}from'react';
import{unwrap,type ModelStatus,type ModelSettingsResult,type ChatStatus,type ConnectionCheck,type SearchStatus,type ZhihuQuota,type CompanionPrefs}from'./types';
const bridge=window.kanshan;
export function ModelPanel({status,onStatus,onClose,onCompanionChange}:{status:ModelStatus;onStatus:(s:ModelStatus)=>void;onClose:()=>void;onCompanionChange?:()=>void}){
 const[savingConfig,setSavingConfig]=useState(false),[formRevision,setFormRevision]=useState(0);
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
 async function refresh(){if(!bridge||savingConfig||current.current||refreshPending.current)return;const version=++refreshVersion.current;refreshPending.current=true;setRefreshing(true);setQuota(null);setError('');setResult(null);setAgreed(false);
 try{const updated=await unwrap(bridge.refreshConfig());const [discovered,newChat]=await Promise.all([unwrap(bridge.searchStatus()),unwrap(bridge.chatStatus())]);if(alive.current&&version===refreshVersion.current){onStatus(updated);setSearch(discovered);setChat(newChat);setFormRevision(value=>value+1);}}
 catch(e){if(alive.current&&version===refreshVersion.current)setError((e as Error).message);}
 finally{if(version===refreshVersion.current){refreshPending.current=false;if(alive.current)setRefreshing(false);}}}
 function applySaved(saved:ModelSettingsResult){
  setResult(null);setAgreed(false);setQuota(null);setError('');
  onStatus(saved.model);setSearch(saved.search);setChat(saved.chat);
 }
 async function checkQuota(){if(!bridge||savingConfig||!search?.ready||search.provider!=='zhihu'||current.current||refreshPending.current)return;const id=crypto.randomUUID();current.current=id;setQuotaChecking(true);setError('');setQuota(null);try{const data=await unwrap(bridge.zhihuQuota({id,consent:true,configId:search.configId}));if(alive.current&&current.current===id)setQuota(data);}catch(e){if(alive.current&&current.current===id)setError((e as Error).message);}finally{if(current.current===id){current.current=null;if(alive.current)setQuotaChecking(false);}}}
 async function test(){if(!bridge||savingConfig||!agreed||current.current||refreshPending.current)return;const id=crypto.randomUUID();current.current=id;setChecking(true);setError('');setResult(null);try{const checked=await unwrap(bridge.checkModel({id,consent:agreed,configId:status.configId}));if(alive.current&&current.current===id)setResult(checked);}catch(e){if(alive.current&&current.current===id)setError((e as Error).message);}finally{if(current.current===id){current.current=null;if(alive.current){setChecking(false);setAgreed(false);}}}}
 return <div className="modal-backdrop"><section className="modal model-panel" role="dialog" aria-modal="true" aria-labelledby="model-title">
 <button className="modal-close" aria-label="关闭模型接入" onClick={()=>{cancel();onClose();}}>×</button>
 <h2 id="model-title">模型与检索设置</h2>
 <ModelSettingsForm key={formRevision} busy={checking||quotaChecking||refreshing} onSaving={setSavingConfig} onSaved={applySaved}/>
 <FeatureGuide feature="settings"/>
 <p className="dialog-description">先确认服务地址与模型，再用一小段内置材料测试。你的文件和收藏不会用于此测试。</p>
 <MovementSettings/><WeatherControls/><MinesSettings/>
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
 <div className="setup-guide"><p>文字聊天：{chat?.ready?`${chat.model} · ${chat.destination}`:chat?'尚未完成配置':'读取配置中'}</p></div>
 <div className="setup-guide"><p>内容检索：{search?.destination||'读取配置中'}{search?.experimental?'（实验性公共 RSS，可能无结果）':''}</p></div>
 <button className="refresh-config" disabled={savingConfig||checking||quotaChecking||refreshing||!bridge} onClick={refresh}>{refreshing?'检查中…':'重新检查配置'}</button>
 {search?.provider==='zhihu'&&<section className="quota-check"><p>点击下方按钮，仅向 developer.zhihu.com 查询当前账号的每日限免次数，不发送关键词、文件或收藏；这不是账户钱包余额。</p><button disabled={savingConfig||!search.ready||checking||quotaChecking||refreshing} onClick={checkQuota}>{quotaChecking?'查询知乎额度中…':'查询知乎每日额度（联网）'}</button>{quota&&<div role="status">{quota.items.length?quota.items.map(item=><p key={item.apiId}>{item.name}：当日剩余 {item.remaining} / {item.total} 次，已用 {item.used} 次</p>):<p>接口未返回可展示额度项，不能据此判断为无限额度或零余额。</p>}<small>查询时间：{new Date(quota.checkedAt).toLocaleString('zh-CN')}</small></div>}</section>}
 <label className="consent"><input type="checkbox" checked={agreed} disabled={savingConfig||!status.modelReady||checking||quotaChecking} onChange={e=>setAgreed(e.target.checked)}/><span>同意向 {status.destination} 发送内置“北极狐”测试段落，验证连接与问题格式。这会调用一次所选模型，可能计费，不会发送我的投喂内容或收藏。</span></label>
 {checking&&<p className="processing" role="status">正在等待模型返回有效问题……可随时取消。</p>}
 {error&&<p className="inline-error" role="alert">{error}</p>}
 {result&&<div className="connection-success" role="status">连接成功，收到 {result.questionCount} 个有效问题。<small>仅验证本次连接与返回格式；实际材料的相关性仍需检查。</small></div>}
 <div className="dialog-actions"><button onClick={()=>{cancel();onClose();}}>取消</button><button className="primary" disabled={savingConfig||!bridge||!status.modelReady||!agreed||checking||quotaChecking||refreshing} onClick={test}>{checking?'连接测试中…':'测试连接'}</button></div>
 </section></div>;
}
