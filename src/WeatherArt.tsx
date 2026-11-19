import type {PetAppearance, WeatherLook} from './types';

export function WeatherArt({look,form='classic',rear=false,clothingArt=false,glassesArt=false}:{
 look?:WeatherLook;form?:PetAppearance;rear?:boolean;clothingArt?:boolean;glassesArt?:boolean;
}){
 if(!look)return null;
 const isHuman=form==='human', isQ=form==='fox';
 const center=isQ?125:120;
 const shoulders=isHuman?117:isQ?(rear?190:182):190;
 const waist=isHuman?189:isQ?241:240;
 const left=isHuman?82:isQ?(rear?92:83):55,right=isHuman?158:isQ?(rear?166:186):184;
 const eyes=isHuman?68:isQ?124:103;
 const clothing=form==='classic'?'normal':look.clothing;
 return <g className="weather-art" aria-hidden="true" data-weather-outfit={clothing}
  data-sunglasses={!rear&&look.glasses&&!look.umbrella||undefined}>
  {!clothingArt&&clothing==='hot'&&<g className="weather-light">
   <path d={`M${left} ${shoulders} Q${center} ${shoulders-24} ${right} ${shoulders} L${right+2} ${waist-5} Q${center} ${waist+9} ${left} ${waist-3}Z`}
    fill="#c7e5eb" stroke="#536b83" strokeWidth="2"/>
   {!rear&&<path d={`M${center} ${shoulders-4}v${waist-shoulders+1}`} stroke="#f6f4e0" strokeWidth="3"/>}
   <path d={`M${left+3} ${shoulders}l-11 22 14 5m${right-left-10} -27 12 22-15 5`} fill="#d7eef0" stroke="#536b83" strokeWidth="2"/>
  </g>}
  {look.glasses&&!look.umbrella&&!rear&&!glassesArt&&<g className="weather-glasses" transform={isHuman?'translate(77 15) scale(.37 .48)':`translate(${isQ?8:0} ${eyes-105})`}>
   <path d="M63 98q20-7 45 1l8 8 10-1 8-7q24-8 47 0l-3 9q-6 19-23 18-13-1-20-17l-8-1-10 1q-5 16-22 17-17 0-23-15z" fill="#253148" stroke="#192233" strokeWidth="2"/>
   <path d="M79 105l18 10m49-13 15 10" stroke="#7298b6" strokeWidth="3" opacity=".7"/>
  </g>}
 </g>;
}
