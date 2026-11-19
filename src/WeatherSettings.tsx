import {useEffect,useState} from 'react';
import cities from '../desktop/weather-cities.json';
import {unwrap,type WeatherSettings,type WeatherStatus} from './types';

export function WeatherControls(){
 const bridge=window.kanshan;
 const [status,setStatus]=useState<WeatherStatus>();
 const [notice,setNotice]=useState('');
 const [refreshing,setRefreshing]=useState(false);
 useEffect(()=>{
  if(!bridge)return;
  const unsubscribe=bridge.onWeather(setStatus);
  void unwrap(bridge.weatherStatus()).then(setStatus).catch(e=>setNotice(e.message));
  return unsubscribe;
 },[bridge]);
 async function save(next:WeatherSettings){
  if(!bridge)return;
  try{setStatus(await unwrap(bridge.saveWeather(next)));setNotice('天气设置已保存。');}
  catch(error){setNotice((error as Error).message);}
 }
 async function refresh(){
  if(!bridge||refreshing)return;
  setRefreshing(true);
  try{setStatus(await unwrap(bridge.refreshWeather()));}
  catch(error){setNotice((error as Error).message);}
  finally{setRefreshing(false);}
 }
 if(!status)return null;
 const {prefs,observation,problem}=status;
 return <section className="setup-guide companion-settings" aria-label="天气和鼠标互动">
  <strong>天气换装</strong>
  <label>城市<select value={prefs.city} onChange={event=>void save({...prefs,city:event.target.value})}>
   {Object.entries(cities).map(([id,city])=><option key={id} value={id}>{city.name}</option>)}
  </select></label>
  <label><input type="checkbox" checked={prefs.enabled} onChange={event=>void save({...prefs,enabled:event.target.checked})}/>自动天气换装</label>
  <small>桌面气温使用所选城市的 Open-Meteo 观测，约每 20 分钟更新一次。</small>
  <button type="button" disabled={refreshing} onClick={()=>void refresh()}>{refreshing?'正在更新…':'立即更新天气'}</button>
  <small role="status">
   {observation?.temperature!==undefined&&`${observation.temperature}°C 当前气温 · `}
   {observation?.feels!==undefined&&`${observation.feels}°C 体感 · `}
   {observation&&`${new Date(observation.time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} 观测。 `}
   {problem??(!observation?'正在等待天气观测。':'')}
  </small>
  <label><input type="checkbox" checked={prefs.chase} onChange={event=>void save({...prefs,chase:event.target.checked})}/>允许营地雪地内快速晃动触发追逐</label>
  {notice&&<small role="status">{notice}</small>}
 </section>;
}
