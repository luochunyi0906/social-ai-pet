import { useId, type CSSProperties } from 'react';
import type { WeatherLook } from './types';

type Form = 'fox' | 'human';
const eyes = {
 fox: [
  { x: 538, y: 665, rx: 52, ry: 62, angle: -12, lid: 'M439 667Q486 603 552 607Q575 607 586 624Q605 695 569 720Q536 737 489 717Q448 706 439 667Z' },
  { x: 792, y: 588, rx: 49, ry: 66, angle: -12, lid: 'M744 572Q774 521 822 529Q855 533 868 556Q886 591 857 626Q831 662 795 657Q753 649 744 572Z' },
 ],
 human: [
  { x: 465, y: 301, rx: 24, ry: 27, angle: -9, lid: 'M428 294Q463 276 491 282L493 307Q485 328 465 329Q441 329 428 294Z' },
  { x: 582, y: 281, rx: 21, ry: 27, angle: -6, lid: 'M549 279Q575 264 610 267L612 289Q600 310 579 311Q554 309 549 279Z' },
 ],
};
const collar = {
 fox: {
  raised: 'M612 877Q645 861 674 858Q693 846 706 823Q711 815 720 824Q726 831 724 844Q729 861 751 875L744 902Q712 891 680 914L648 925Z',
  crease: 'M648 901Q680 893 712 840M697 894Q722 878 736 886',
  fabric: '#164de7', seam: '#648aff', outline: '#17264e', base: 28,
 },
 human: {
  raised: 'M569 507Q580 480 583 455L617 413Q634 428 630 455L664 468Q649 484 630 500L611 534Z',
  crease: 'M592 509Q600 466 618 439M611 481Q627 478 639 472',
  fabric: '#ebeaf6', seam: '#8292b5', outline: '#273757', base: 33,
 },
};
const canvas = { fox: '0 0 1096 1435', human: '0 0 1024 1536' };

export function PortraitGaze({ form, facing }: { form: Form; facing?: 'left' | 'right' }) {
 const id = useId();
 const style = { '--pet-gaze-facing': facing === 'left' ? -1 : 1 } as CSSProperties;
 return <g className="portrait-gaze" aria-hidden="true" style={style}>
  <defs>
   <linearGradient id={id + '-iris'} x2="0" y2="1">
    <stop stopColor="#263464"/><stop offset=".7" stopColor="#3d56a9"/><stop offset="1" stopColor="#568af1"/>
   </linearGradient>
   {eyes[form].map((eye, index) => <clipPath id={id + index} key={index}><path d={eye.lid}/></clipPath>)}
  </defs>
  {eyes[form].map((eye, index) => <g clipPath={`url(#${id}${index})`} key={index}>
   <ellipse cx={eye.x} cy={eye.y} rx={eye.rx + 3} ry={eye.ry + 2} fill="#fffaf7"
    transform={`rotate(${eye.angle} ${eye.x} ${eye.y})`}/>
   <g className="portrait-iris">
    <g transform={`rotate(${eye.angle} ${eye.x} ${eye.y})`}>
     <ellipse cx={eye.x} cy={eye.y} rx={eye.rx} ry={eye.ry} fill={`url(#${id}-iris)`}/>
     <ellipse cx={eye.x + eye.rx * .12} cy={eye.y + eye.ry * .54} rx={eye.rx * .72} ry={eye.ry * .35} fill="#467cf0"/>
     <circle cx={eye.x + eye.rx * .24} cy={eye.y - eye.ry * .6} r={eye.rx * .23} fill="#fff"/>
    </g>
   </g>
  </g>)}
 </g>;
}

export function PortraitCollar({ form, clothing }: { form: Form; clothing?: WeatherLook['clothing'] }) {
 const item = collar[form];
 const id=useId();
 const palette=form==='fox'&&clothing==='hot'?{seam:'#c6dfff',fabric:'#73a5ee'}:item;
 const style = { '--collar-rest': `${item.base}px` } as CSSProperties;
 return <g className="portrait-collar" style={style} data-collar-form={form} aria-hidden="true">
  <defs><linearGradient id={id} x2=".30" y2="1">
   <stop stopColor={palette.seam}/><stop offset=".55" stopColor={palette.fabric}/><stop offset="1" stopColor={palette.fabric}/>
  </linearGradient></defs>
  <path d={item.raised} fill={`url(#${id})`} stroke={item.outline} strokeWidth="7" strokeLinejoin="round"/>
  <path d={item.crease} fill="none" stroke={palette.seam} strokeOpacity=".8" strokeWidth="5" strokeLinecap="round"/>
 </g>;
}

export function PortraitDetailFrame({ form, x, y, width, height, facing, gaze, clothing }:{
 form: Form; x: number; y: number; width: number; height: number;
 facing?: 'left' | 'right'; gaze: boolean; clothing?: WeatherLook['clothing'];
}) {
 return <svg x={x} y={y} width={width} height={height} viewBox={canvas[form]} aria-hidden="true" pointerEvents="none">
  {gaze && <PortraitGaze form={form} facing={facing}/>}
  <PortraitCollar form={form} clothing={clothing}/>
 </svg>;
}
