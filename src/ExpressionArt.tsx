import type {PetGesture} from './usePetClicks';
import type {PetAppearance} from './types';
export function ExpressionArt({gesture,appearance='classic'}:{gesture?:PetGesture;appearance?:PetAppearance}){
 if(gesture!=='upset'&&gesture!=='wipe')return null;
 const y=appearance==='human'?74:appearance==='fox'?135:116;
 const x=appearance==='fox'?99:82;
 return <g className="actor-tears" aria-hidden="true">
  <path d={`M${x} ${y}q-10 11 0 13q9-3 0-13Zm64-5q-9 10 0 11q7-2 0-11Z`} fill="#8dd5f2" stroke="#50a5dc" strokeWidth="1.6"/>
 </g>;
}
