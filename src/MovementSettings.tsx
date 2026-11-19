import {useEffect,useState} from 'react';
import {unwrap,type MovementPrefs} from './types';

const bridge=window.kanshan;
const fields=[['interval','散步间隔（秒）',30,900],['distance','最远步行距离（点）',30,200],['dwell','停留（秒）',1,30]] as const;

export function MovementSettings(){
 const [prefs,setPrefs]=useState<MovementPrefs>();
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState('');
 useEffect(()=>{if(bridge)void unwrap(bridge.movementSettings()).then(setPrefs).catch(error=>setMessage(error.message));},[]);
 async function save(next:MovementPrefs){
  if(!bridge||saving)return;
  setSaving(true);
  setMessage('');
  try{setPrefs(await unwrap(bridge.saveMovement(next)));setMessage('已保存自由活动设置。');}
  catch(error){setMessage((error as Error).message);}
  finally{setSaving(false);}
 }
 if(!prefs)return message?<p role="alert">{message}</p>:null;
 return <form className="setup-guide companion-settings" aria-label="桌面自由活动" onSubmit={event=>{
  event.preventDefault();void save(prefs);
 }}>
  <strong>桌面自由活动</strong>
  <label><input type="checkbox" checked={prefs.enabled} disabled={saving} onChange={event=>void save({...prefs,enabled:event.target.checked})}/>自由活动</label>
  <label>活动范围<select value={prefs.scope} disabled={saving}
   onChange={event=>setPrefs({...prefs,scope:event.target.value==='nearby'?'nearby':'desktop'})}>
   <option value="desktop">全桌面</option><option value="nearby">营地附近</option>
  </select></label>
  <p>普通模式空闲时出门散步，停留后走回营地。拖动刘看山也可以带它去桌面其他位置。</p>
  {fields.filter(([key])=>key!=='distance'||prefs.scope==='nearby').map(([key,label,min,max])=><label key={key}>{label}
   <input type="number" min={min} max={max} step="1" required value={Number.isNaN(prefs[key])?'':prefs[key]}
    disabled={saving} onChange={event=>setPrefs({...prefs,[key]:event.target.valueAsNumber})}/>
  </label>)}
  <button type="submit" disabled={saving}>保存散步参数</button>
  {message&&<small role="status">{message}</small>}
 </form>;
}
