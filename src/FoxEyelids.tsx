import {useId} from 'react';
import './fox-eyelids.css';

export function FoxEyelids(){
 const colors=useId();
 const skin=`url(#${colors})`;
 return <g className="fox-eyelids" transform="translate(21.5 23) scale(.17883)" aria-hidden="true">
  <defs>
   <linearGradient id={colors} x2="0" y2="1">
    <stop stopColor="#fbe9e3"/>
    <stop offset="1" stopColor="#fff0ea"/>
   </linearGradient>
  </defs>
  <g className="fox-lid-left">
   <path className="fox-lid-skin" fill={skin} stroke={skin} strokeWidth="4" strokeLinejoin="round"/>
   <path className="fox-lid-line"/>
  </g>
  <g className="fox-lid-right">
   <path className="fox-lid-skin" fill={skin} stroke={skin} strokeWidth="4" strokeLinejoin="round"/>
   <path className="fox-lid-line"/>
  </g>
 </g>;
}
