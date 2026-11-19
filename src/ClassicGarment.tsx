import {useId} from 'react';
export type ClassicView='front'|'side'|'back';

const styles={
 'forest-guide':{top:'#63794b',shadow:'#2b4432',trim:'#d5bc75'},
 'camp-scarf':{top:'#ad825e',shadow:'#77533d',trim:'#e4b16f'},
 'garden-cardigan':{top:'#9aab73',shadow:'#687c4f',trim:'#f2ddb1'},
 'blue-hoodie':{top:'#5575c1',shadow:'#2b427d',trim:'#c0d5fb'},
 'white-explorer':{top:'#f4eee4',shadow:'#cfdfd8',trim:'#367e75'},
 'tartan-coat':{top:'#526280',shadow:'#263346',trim:'#d08e64'},
 'warm-apron':{top:'#e9caa0',shadow:'#b69c81',trim:'#f1959c'},
} as const;
type ClassicId=keyof typeof styles;

const torso={
 front:'M84 115Q99 112 112 109Q128 117 146 110Q162 112 174 117L183 156Q184 177 173 185Q156 197 128 194Q99 196 86 186Q76 178 77 164Z',
 back:'M84 115Q105 110 128 112Q157 111 174 117L183 157Q184 178 172 186Q156 197 128 194Q101 194 86 185Q77 178 77 165Z',
 side:'M90 115Q107 112 125 112L166 111Q174 119 177 145Q181 173 164 187Q143 197 121 193Q96 186 85 166Q79 148 90 115Z',
};

export function ClassicGarment({outfit,view}:{outfit:string;view:ClassicView}){
 const id=useId();
 if(!Object.hasOwn(styles,outfit))return null;
 const style=styles[outfit as ClassicId];
 const center=view==='side'?126:128;
 const front=view==='front';
 const back=view==='back';
 const cape=outfit==='forest-guide';
 const plaid=outfit==='tartan-coat';
 const cardigan=outfit==='garden-cardigan';
 const white=outfit==='white-explorer';
 const scarf=outfit==='camp-scarf';
 const hoodie=outfit==='blue-hoodie';
 const apron=outfit==='warm-apron';
 return <g aria-hidden="true" data-classic-garment={outfit}>
  <defs>
   <linearGradient id={id+'-fabric'} x1="0" y1="0" x2=".82" y2="1" gradientUnits="objectBoundingBox">
    <stop stopColor={style.top}/><stop offset="1" stopColor={style.shadow}/>
   </linearGradient>
   <clipPath id={id+'-cloth'}><path d={torso[view]}/></clipPath>
   <pattern id={id+'-plaid'} width="18" height="20" patternUnits="userSpaceOnUse">
    <path d="M2 0v20M0 3h18" stroke="#f0b178" strokeWidth="3" opacity=".65"/>
    <path d="M7 0v20M0 8h18" stroke="#b17762" strokeWidth="1.3"/>
   </pattern>
  </defs>
  <path d={torso[view]} fill={`url(#${id}-fabric)`} stroke={style.shadow} strokeWidth="1.5"/>
  <g clipPath={`url(#${id}-cloth)`}>
   {plaid&&<path d={torso[view]} fill={`url(#${id}-plaid)`}/>}
   <path d="M74 165q24 21 55 19t57-17" fill="none" stroke={style.shadow} strokeWidth="5" opacity=".32"/>
   {cape&&<>
    <path d="M76 138Q93 115 126 107Q164 110 186 142L177 170Q151 149 129 151Q106 151 81 169Z" fill="#617953" stroke={style.trim} strokeWidth="2"/>
    {front&&<path d="M124 146l5-5 6 5-6 6Z" fill="#ded09f"/>}
    {back&&<path d="M103 153q25 14 51-3" fill="none" stroke="#c8b37a" strokeWidth="1.5"/>}
   </>}
   {scarf&&<g fill="#c56e4b" stroke="#8d4e3b" strokeWidth="1.3">
    <path d="M80 115Q108 127 131 124Q159 122 174 112L176 129Q149 143 126 142Q100 142 80 131Z"/>
    {front&&<path d="M133 134q3 12-1 32l12 2 4-35Z"/>}
    <path d="M84 124q49 20 87-4" fill="none" stroke="#e6a577" opacity=".75"/>
   </g>}
   {cardigan&&<path d="M88 113Q108 123 127 127Q148 124 171 113" stroke={style.trim} strokeWidth="8" fill="none"/>}
   {white&&<path d="M91 114q34 25 75 2M129 127l-2 61" stroke={style.trim} strokeWidth="4" fill="none"/>}
   {hoodie&&<g fill="none" stroke={style.trim} strokeWidth="1.9" strokeLinecap="round">
    <path d="M91 113q37 37 75 0"/>
    {front&&<><path d="M120 133l-3 16m18-16 2 15"/><path d="M111 165q-5 7-6 14h46q-1-7-7-14Z" fill="#485f9d"/></>}
   </g>}
   {apron&&<g fill="#e6a8a5" stroke="#ae6977" strokeWidth="1.3">
    {front?<><path d="M103 119l4 36m44-36-5 36" fill="none" stroke="#d98792" strokeWidth="5"/><path d="M108 138h38l5 20 25 6-8 27H86l-4-25 22-9Z"/><path d="M119 162h18l-1 13h-16Z" fill="#f7c6bd"/></>:
     <path d="M79 157q37 15 102-2v11q-52 16-102 2Z"/>}
   </g>}
   {front&&!cape&&!scarf&&!apron&&!hoodie&&<>
    <path d={`M${center} 130v57`} stroke={style.trim} strokeWidth="2" opacity=".85"/>
    {(cardigan||plaid)&&[142,156,171].map(y=><circle key={y} cx={center+3} cy={y} r="1.8" fill={style.trim}/>)}
    {cardigan&&<path d="M151 143l2-4 2 4 4 1-4 2-2 4-2-4-4-2Z" fill="#eadabb"/>}
    {white&&<path d="M143 151l12-4 4 15-13 3Z" fill="#70a598"/>}
   </>}
   {front&&scarf&&<path d="M88 156h22v15H88Zm62 0h20v15h-20Z" fill="#997257" stroke="#6d4937"/>}
  </g>
 </g>;
}
