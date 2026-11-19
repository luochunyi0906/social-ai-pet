import {useId,type CSSProperties} from 'react';
import type {CheekPose,ListeningStatus} from './types';
import leftBlink from './assets/cave/interactions/eye-left.webp';
import rightBlink from './assets/cave/interactions/eye-right.webp';

type Form='fox'|'human';
const cheekArt={
 fox:{
  left:{x:575,y:747,stretch:.54,hit:'M466 724Q506 716 551 715L579 773Q555 810 478 803Q456 778 466 724Z',
   patch:'M448 722Q506 706 570 715Q592 748 571 798Q534 829 469 806Q452 788 448 722Z'},
  right:{x:811,y:708,stretch:.54,hit:'M811 672Q863 654 907 656Q916 686 884 724Q858 749 817 756Z',
   patch:'M799 676Q864 651 918 646Q942 674 908 719Q875 758 818 777Q801 751 799 676Z'},
  mouth:{x:708,y:719,rx:17,ry:14,scale:1},
 },
 human:{
  left:{x:493,y:343,stretch:.50,hit:'M430 324Q461 312 488 320L493 359Q459 375 435 351Z',
   patch:'M421 326Q453 310 496 316L500 366Q463 381 427 353Z'},
  right:{x:566,y:337,stretch:.52,hit:'M570 317Q598 305 628 308Q632 335 602 355L574 362Z',
   patch:'M562 319Q604 297 635 304Q642 334 604 360L574 369Z'},
  mouth:{x:543,y:353,rx:7,ry:6,scale:.48},
 }
};
const sizes={fox:[1096,1435],human:[1024,1536]} as const;

export function CheekRegions({form,mirrored}:{form:Form;mirrored:boolean}){
 const {left,right}=cheekArt[form];
 return <g className="cheek-regions" aria-hidden="true">
  <path className="cheek-target" data-cheek-side="left" data-cheek-direction={mirrored?'right':'left'} d={left.hit}/>
  <path className="cheek-target" data-cheek-side="right" data-cheek-direction={mirrored?'left':'right'} d={right.hit}/>
 </g>;
}

export function CheekArt({form,pose,source}:{form:Form;pose:CheekPose;source:string}){
 const art=cheekArt[form];
 const part=art[pose.side];
 const id=useId();
 const [w,h]=sizes[form];
 const isLeft=pose.side==='left';
 const style={'--cheek-origin':`${part.x}px ${part.y}px`,'--cheek-expansion':1+part.stretch*pose.strength} as CSSProperties;
 const mouthX=art.mouth.x+(isLeft?-1:1)*10*art.mouth.scale*pose.strength;
 return <g className="cheek-feedback" data-cheek-stage={pose.stage} pointerEvents="none" aria-hidden="true">
  {pose.stage==='ready'?<path className="cheek-ready-mark" d={part.hit}/>:<>
   <defs>
    <clipPath id={id+'-shape'}><path d={part.patch}/></clipPath>
    <linearGradient id={id+'-fade'} x1={isLeft?'0%':'100%'} x2={isLeft?'100%':'0%'}>
     <stop offset=".40" stopColor="white"/><stop offset="1" stopColor="black"/>
    </linearGradient>
    <mask id={id+'-edge'}><path d={part.patch} fill={`url(#${id}-fade)`}/></mask>
   </defs>
   <g className="cheek-texture" style={style}>
    <image href={source} width={w} height={h} clipPath={`url(#${id}-shape)`} mask={`url(#${id}-edge)`}/>
   </g>
   <g className="cheek-mouth" style={{opacity:Math.min(1,pose.strength*2)}}>
    <ellipse cx={art.mouth.x} cy={art.mouth.y} rx={art.mouth.rx} ry={art.mouth.ry} fill="#ffe5dc"/>
    <path transform={`translate(${mouthX} ${art.mouth.y}) scale(${art.mouth.scale})`}
     d={isLeft?'M-13 1Q-7 -9 0 -2Q8 5 15 -2':'M-15 0Q-7 5 0 -2Q7 -8 13 1'}
     stroke="#b56870" strokeWidth="4" strokeLinecap="round" fill="none"/>
   </g>
  </>}
 </g>;
}

const humanEyes=[
 {cover:'M427 287Q463 269 492 280L495 306Q482 333 452 325Q435 318 427 287Z',closed:'M435 300Q463 318 489 293'},
 {cover:'M550 274Q582 260 609 268L612 291Q595 318 566 311Z',closed:'M557 290Q581 302 605 280'},
];

export function RestingEyes({form,kind}:{form:Form;kind:'listen'|'knock'|'pinch'}){
 const id=useId();
 return <g className={`pet-resting-eyes pet-eyes-${kind}`} pointerEvents="none" aria-hidden="true">
  {form==='fox'?<>
   <image className="pet-closed-eye-0" href={leftBlink} x="405" y="569" width="211" height="182"/>
   <image className="pet-closed-eye-1" href={rightBlink} x="719" y="504" width="183" height="178"/>
  </>:<>
   <defs><linearGradient id={id} x2="0" y2="1">
    <stop stopColor="#fbe4dc"/><stop offset="1" stopColor="#fff0e9"/>
   </linearGradient></defs>
   {humanEyes.map((eye,index)=><g className={`pet-closed-eye-${index}`} key={eye.closed}>
    <path d={eye.cover} fill={`url(#${id})`}/>
    <path d={eye.closed} stroke="#262748" strokeWidth="4" fill="none" strokeLinecap="round"/>
   </g>)}
  </>}
 </g>;
}

export function Headset({form,status}:{form:Form;status:ListeningStatus}){
 const id=useId();
 const active=status.mode!=='off';
 const finished=Date.now()-status.changedAt>1100;
 return <g className="pet-headset-stage" data-worn={active||undefined} data-listening={status.mode}
  data-ear-animation={finished?'ready':active?'put-on':'take-off'} aria-hidden="true" pointerEvents="none">
  <g className="pet-headset" transform={form==='human'?'translate(198 -1) scale(.52)':'translate(0 0)'}>
   <defs><linearGradient id={id} x2=".5" y2="1">
    <stop stopColor="#eaf5ff"/><stop offset=".38" stopColor="#b1cbff"/><stop offset="1" stopColor="#6485d2"/>
   </linearGradient></defs>
   <g className="pet-headset-parts" fill={`url(#${id})`} stroke="#28385c" strokeWidth="11">
    <path d="M193 571C169 388 255 280 423 248C626 209 818 271 917 426L936 526L903 535L881 445C806 324 629 252 431 286C281 312 218 409 227 575Z"/>
    <path d="M199 496C236 492 278 525 287 589C295 657 268 699 225 702C184 702 150 654 144 594C139 541 158 507 199 496Z"/>
    <path d="M921 469C950 456 976 490 984 537C994 595 976 631 947 630C921 630 900 592 893 546C885 508 895 482 921 469Z"/>
   </g>
   <ellipse cx="209" cy="606" rx="39" ry="58" fill="#506fb7" transform="rotate(-9 209 606)"/>
   <path d="M190 602L190 582L202 592Q211 588 217 592L227 579L232 598Q242 622 212 629Q191 629 190 602Z" fill="#f3f5fe"/>
   <circle cx="204" cy="609" r="3.6" fill="#35486d"/><circle cx="220" cy="607" r="3.6" fill="#35486d"/>
   <path className="pet-headset-adjust" d="M151 629Q145 603 153 588Q160 583 166 592L174 615Q180 595 188 600Q191 605 187 623L180 646Q165 660 151 646Z"
    fill="#ffe5dc" stroke="#434466" strokeWidth="6"/>
  </g>
 </g>;
}

export function KnockEar({source}:{source:string}){
 const id=useId();
 return <g className="knock-ear" pointerEvents="none">
  <defs><clipPath id={id}><path d="M172 446Q137 333 176 266Q200 203 254 226Q340 244 444 309L390 361L337 397L271 449Z"/></clipPath></defs>
  <image href={source} width="1096" height="1435" clipPath={`url(#${id})`}/>
 </g>;
}
