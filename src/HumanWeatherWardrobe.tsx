import {useState} from 'react';
import labels from '../desktop/human-weather.json';
import {AppearanceArt} from './PetAppearance';
import type {HumanWeather} from './types';
import {WardrobeTurntable} from './WardrobeTurntable';
import {humanAngle} from './HumanAngles';

const outfits=Object.entries(labels) as [HumanWeather,string][];
export function HumanWeatherWardrobe({current,onWear}:{
 current:HumanWeather|null;onWear:(id:HumanWeather|null)=>Promise<void>;
}){
 const [preview,setPreview]=useState(current);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 async function wear(value:HumanWeather|null){
  setSaving(true);setError('');
  try{await onWear(value);setPreview(value);}
  catch(problem){setError((problem as Error).message);}
  finally{setSaving(false);}
 }
 return <section className="cave-wardrobe" aria-label="人版天气服装">
  <div className="cave-wardrobe-preview">
   <div className="wardrobe-heading">
    <h3>{preview?labels[preview]:'随天气切换'}</h3>
    <span className="wardrobe-badge" data-wearable={preview===current}>{preview===current?'已应用':'试穿中'}</span>
   </div>
   <div className="wardrobe-display"><WardrobeTurntable key={preview??'auto'}
    name={preview?labels[preview]:'蓝白日常装'} dragOnly renderView={angle=>angle===0?
     <AppearanceArt appearance="human" humanWeather={preview} weatherUnlocked motionEnabled={false}/>:
     <img src={humanAngle(preview??'normal',angle===180?'back':'side')} alt="" draggable={false}
      style={angle===270?{transform:'scaleX(-1)'}:undefined}/>}/></div>
   {error&&<small role="alert">{error}</small>}
   <div className="home-closet-actions">
    <button type="button" disabled={saving||(!current&&!preview)} onClick={()=>void wear(null)}>恢复自动换装</button>
    <button type="button" className="primary" disabled={saving||!preview||preview===current} onClick={()=>void wear(preview)}>确认穿上</button>
   </div>
  </div>
  <div className="cave-wardrobe-grid" aria-label="全部人版天气服装">
   {outfits.map(([id,label])=><button type="button" key={id} disabled={saving} aria-pressed={preview===id} onClick={()=>{setPreview(id);setError('');}}>
    <span className="cave-wardrobe-thumb" aria-hidden="true"><AppearanceArt appearance="human" humanWeather={id} weatherUnlocked/></span>
    <strong>{label}</strong>{current===id&&<small>穿着中</small>}
   </button>)}
  </div>
 </section>;
}
