import type {PetAppearance,WeatherLook,WindowPose} from './types';
import type {ActorMotion} from './ActorAnimation';
import human from './assets/cave/kanshan-human.png';
import fox from './assets/cave/kanshan-fox.png';
import foxCold from './assets/cave/weather/cold.webp';
import foxHeat from './assets/cave/weather/heat.webp';
import foxSun from './assets/cave/weather/sun.webp';
import {FoxEyelids} from './FoxEyelids';
import {ExpressionArt} from './ExpressionArt';
import type {PetGesture} from './usePetClicks';
import {WeatherArt} from './WeatherArt';
import {PortraitDetailFrame} from './PortraitDetails';
import {FoxMotionStrip,FoxPerchArt,FoxWindowSnow,useFoxMovement,type FoxMovement} from './FoxMotionArt';
const clothes=import.meta.glob<string>('./assets/cave/wardrobe/*.png',{eager:true,query:'?url&no-inline',import:'default'});

const portraits = {
 human: {src: human, label: '人版', x: 27, y: 13, width: 185, height: 277,
  hit: 'M78 84Q62 50 83 29Q115 10 146 25Q174 39 169 87L160 111 166 151 161 190 151 234 153 286H84L88 236 79 200 75 143 83 109Z'},
 fox: {src: fox, label: '狐狸版', x: 21.5, y: 23, width: 196, height: 257,
  hit: 'M157.5 45L164.5 45 171.5 52 181.5 81 191.5 80 188.5 95 201.5 106 206.5 115 206.5 121 196.5 119 201.5 129 201.5 139 194.5 137 196.5 149 189.5 153 195.5 164 192.5 179 205.5 190 209.5 201 205.5 212 205.5 228 199.5 243 192.5 245 181.5 268 170.5 271 154.5 270 148.5 265 139.5 271 117.5 271 112.5 270 103.5 259 90.5 267 68.5 267 46.5 256 38.5 249 39.5 241 31.5 231 30.5 220 35.5 206 55.5 184 75.5 182 85.5 186 80.5 177 67.5 179 64.5 169 56.5 174 52.5 168 52.5 158 45.5 162 40.5 158 44.5 138 39.5 137 34.5 128 46.5 123 40.5 119 39.5 114 49.5 109 49.5 88 56.5 68 61.5 63 68.5 63 98.5 76 113.5 71 125.5 58 132.5 66Z'}
} as const;

export function AppearanceArt({appearance,motion,motionEnabled,windowPose,daydream,caveOutfit,weather,gesture}:{
 appearance:Exclude<PetAppearance,'classic'>;motion?:ActorMotion;motionEnabled?:boolean;windowPose?:WindowPose;
 daydream?:boolean;caveOutfit?:string|null;weather?:WeatherLook;gesture?:PetGesture;
}){
 const art=portraits[appearance];
 const isFox=appearance==='fox';
 const chosen=isFox&&caveOutfit&&!weather?.everyday?(weather?.clothing==='cold'?'winter':weather?.clothing==='hot'?'sports':caveOutfit):null;
 const costume=chosen?clothes[`./assets/cave/wardrobe/${chosen}.png`]:undefined;
 const weatherPortrait=isFox?(weather?.clothing==='cold'?foxCold:weather?.clothing==='hot'?foxHeat:undefined):undefined;
 const wardrobeArt=weatherPortrait?undefined:costume;
 const context=chosen==='rain'?{clothing:'normal' as const,umbrella:true,glasses:false}:
  wardrobeArt&&weather?{...weather,clothing:'normal' as const}:weather;
 const phase=isFox?windowPose?.phase:undefined;
 const facing=windowPose?.facing??motion?.facing;
 const mirror=facing==='left'?'translate(240 0) scale(-1 1)':undefined;
 const scale=isFox?'translate(-60 -60) scale(1.5)':undefined;
 const active=!gesture&&isFox&&!wardrobeArt;
 const movement:FoxMovement|undefined=!active?undefined:
  phase==='climb'||phase==='pull'?'climb':
  motion?.clip==='act_run'?'run':
  motion?.clip==='act_walk'||phase==='approach'||phase==='walk-away'?'walk':undefined;
 const glasses=isFox&&!wardrobeArt&&Boolean(context?.glasses&&!context.umbrella);
 const frame=useFoxMovement(movement,facing,weather?.clothing,glasses);
 const perched=active&&phase==='perch';
 const portrait=weatherPortrait??art.src;
 const drifting=isFox&&daydream&&!gesture&&!movement&&!phase;
 const rear=movement==='climb'&&Boolean(frame);
 const rearMirror=rear&&windowPose?.side===0?'translate(240 0) scale(-1 1)':undefined;
 return <svg className="fox fox-costume fox-appearance" viewBox="0 0 240 310" role="img"
  data-gesture={gesture} data-pet-appearance={appearance} data-cave-outfit={chosen||undefined}
  data-daydream={drifting||undefined} data-fox-motion={frame?movement:undefined}
  data-weather-motion={frame&&weatherPortrait?weather?.clothing:undefined}
  data-window-pose={phase} data-window-side={windowPose?.side} aria-label={art.label+'刘看山'}>
  <g transform={scale}>
   {wardrobeArt?<image href={wardrobeArt} x="31" y="44" width="178" height="227" transform={mirror}/>:
    frame?<FoxMotionStrip key={movement} {...frame} animated={motionEnabled!==false}
     mirror={rearMirror}/>:
    perched?<g transform={mirror}><FoxPerchArt src={portrait}/></g>:
    <image href={portrait} x={art.x} y={art.y} width={art.width} height={art.height} transform={mirror}/>}
   <g transform={rear?rearMirror:mirror}>
    {!wardrobeArt&&!frame&&!perched&&!phase&&<PortraitDetailFrame form={appearance}
     x={art.x} y={art.y} width={art.width} height={art.height} facing={facing}
     gaze={!gesture&&!context?.glasses}
     lift={gesture==='lift'||gesture==='land'}/>}
    {isFox&&!wardrobeArt&&!frame&&!phase&&!glasses&&<FoxEyelids/>}
    {glasses&&!frame&&<image href={foxSun} x={art.x} y={art.y} width={art.width} height={art.height}/>}
    <WeatherArt look={context} form={appearance} raincoat={chosen==='rain'} rear={rear}
     clothingArt={Boolean(weatherPortrait)} glassesArt={glasses&&(!frame||Boolean(frame.glasses))}/>
    {!rear&&<ExpressionArt appearance={appearance} gesture={gesture}/>}
   </g>
   {phase==='shake'&&<FoxWindowSnow/>}
   <path className="fox-costume-hit" d={art.hit} transform={mirror} fill="transparent" aria-hidden="true"/>
  </g>
 </svg>;
}

export function AppearancePicker({value,saving,error,onSelect}:{
 value:PetAppearance;saving:boolean;error:string;onSelect:(value:PetAppearance)=>void;
}){
 return <fieldset className="appearance-picker" disabled={saving}>
  <legend>刘看山的外貌</legend>
  <div className="appearance-options">
   {(['human','fox'] as const).map(id=><label key={id}>
    <input type="radio" name="pet-appearance" checked={value===id} onChange={()=>onSelect(id)}/>
    <img src={portraits[id].src} alt=""/>
    <span>{portraits[id].label}</span>
   </label>)}
  </div>
  <button type="button" className="appearance-classic" disabled={value==='classic'} onClick={()=>onSelect('classic')}>恢复原版与衣柜装扮</button>
  {error&&<p role="alert" className="inline-error">{error}</p>}
 </fieldset>;
}
