import {useId} from 'react';
import type {PetAppearance, WeatherLook} from './types';

function ClassicPuffer(){
 const id=useId();
 const shape='M72 175Q83 158 103 159L140 159Q161 159 172 172Q183 190 183 224Q182 242 168 248Q130 259 79 248Q62 244 56 230Q53 215 57 201Q59 185 72 175Z';
 return <g className="weather-parka" data-weather-design="quilted">
  <defs>
   <linearGradient id={id+'-ivory'} x2=".32" y2="1"><stop stopColor="#fff5dc"/><stop offset="1" stopColor="#dfd3b9"/></linearGradient>
   <linearGradient id={id+'-blue'} x2=".23" y2="1"><stop stopColor="#9faecc"/><stop offset="1" stopColor="#52688b"/></linearGradient>
   <clipPath id={id+'-coat'}><path d={shape}/></clipPath>
  </defs>
  <path d={shape} fill={`url(#${id}-ivory)`} stroke="#38495d" strokeWidth="3"/>
  <g clipPath={`url(#${id}-coat)`}>
   <path d="M48 211Q100 225 122 217Q157 221 189 207L188 259H48Z" fill={`url(#${id}-blue)`}/>
   <path d="M60 190Q119 211 180 187M56 214Q119 232 182 211M56 233Q119 255 184 230"
    fill="none" stroke="#586a8b" strokeWidth="1.6" opacity=".64"/>
   <path d="M122 176v78" fill="none" stroke="#35405a" strokeWidth="6"/>
   <path d="M122 176v78" fill="none" stroke="#fff5dc" strokeWidth="2.4"/>
   <path d="M94 218l-10 12m68-13 11 11" fill="none" stroke="#344b6b" strokeWidth="3" strokeLinecap="round"/>
  </g>
  <g className="classic-coat-collar">
   <path d="M66 155Q122 164 175 153L174 169Q126 187 68 172Z" fill="#698cc6" stroke="#354e7d" strokeWidth="2"/>
   <path d="M120 166Q132 163 141 166L148 194L134 201L124 189Z" fill="#7f9ed2" stroke="#354e7d" strokeWidth="2"/>
   <path d="M78 162Q111 169 158 162M133 187l12-3" fill="none" stroke="#aac0e6" strokeWidth="1.8" strokeLinecap="round"/>
  </g>
 </g>;
}

export function WeatherArt({look,form='classic',raincoat=false,rear=false,clothingArt=false,glassesArt=false}:{
 look?:WeatherLook;form?:PetAppearance;raincoat?:boolean;rear?:boolean;clothingArt?:boolean;glassesArt?:boolean;
}){
 if(!look)return null;
 const isHuman=form==='human', isQ=form==='fox';
 const center=isQ?125:120;
 const shoulders=isHuman?117:isQ?(rear?190:182):190;
 const chin=isHuman?95:isQ?168:153;
 const waist=isHuman?189:isQ?241:240;
 const left=isHuman?82:isQ?(rear?92:83):55,right=isHuman?158:isQ?(rear?166:186):184;
 const eyes=isHuman?68:isQ?124:103;
 const classicCold=form==='classic'&&look.clothing==='cold';
 return <g className="weather-art" aria-hidden="true" data-weather-outfit={look.clothing}
  data-umbrella={look.umbrella?(rear?'stowed':true):undefined} data-sunglasses={!rear&&look.glasses||undefined}>
  {classicCold&&<ClassicPuffer/>}
  {!classicCold&&!clothingArt&&(raincoat||look.clothing!=='normal')&&<g className={look.clothing==='cold'?'weather-parka':'weather-light'}>
   <path d={`M${left} ${shoulders} Q${center} ${shoulders-24} ${right} ${shoulders} L${right+2} ${waist-5} Q${center} ${waist+9} ${left} ${waist-3}Z`}
    fill={raincoat?'#5379bb':look.clothing==='cold'?'#8baabd':'#c7e5eb'} stroke="#536b83" strokeWidth="2"/>
   {!rear&&<path d={`M${center} ${shoulders-4}v${waist-shoulders+1}`} stroke="#f6f4e0" strokeWidth="3"/>}
   {look.clothing==='cold'?<>
    <path d={`M${left+3} ${chin} Q${center} ${chin+14} ${right-4} ${chin-1}l1 15Q${center} ${chin+34} ${left+3} ${chin+15}z`} fill="#3c67a2"/>
    {!rear&&<path d={`M${center+13} ${chin+13}l5 28 14-3-5-29Z`} fill="#426eac"/>}
   </>:<path d={`M${left+3} ${shoulders}l-11 22 14 5m${right-left-10} -27 12 22-15 5`} fill="#d7eef0" stroke="#536b83" strokeWidth="2"/>}
  </g>}
  {look.umbrella&&rear&&<g transform="rotate(-23 165 200)">
   <path d="M165 174v54q0 7-5 5" fill="none" stroke="#403949" strokeWidth="4" strokeLinecap="round"/>
   <path d="M165 178q-7 3-5 31l4 5 5-4q2-26-4-32Z" fill="#4e85a6" stroke="#324c71" strokeWidth="2"/>
  </g>}
  {look.umbrella&&!rear&&<g className="weather-umbrella" transform={isQ?'translate(-28 35)':undefined}>
   <path d="M180 59v114q0 16-12 13" stroke="#403949" strokeWidth="5" fill="none" strokeLinecap="round"/>
   <path d="M122 72Q174 6 231 72q-13-9-25 3-13-9-25 3-15-13-30-4-13-8-29-2Z" fill="#4e85a6" stroke="#324c71" strokeWidth="3"/>
   <path d="M149 72q14-29 31-30 21 4 26 32" fill="none" stroke="#b8dce9" strokeWidth="2"/>
  </g>}
  {look.glasses&&!look.umbrella&&!rear&&!glassesArt&&<g className="weather-glasses" transform={`translate(${isHuman?22:isQ?8:0} ${eyes-105}) scale(${isHuman?0.8:1} 1)`}>
   <path d="M63 98q20-7 45 1l8 8 10-1 8-7q24-8 47 0l-3 9q-6 19-23 18-13-1-20-17l-8-1-10 1q-5 16-22 17-17 0-23-15z" fill="#253148" stroke="#192233" strokeWidth="2"/>
   <path d="M79 105l18 10m49-13 15 10" stroke="#7298b6" strokeWidth="3" opacity=".7"/>
  </g>}
 </g>;
}
