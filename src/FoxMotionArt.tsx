import { useEffect, useId, useState } from 'react';
import type { CSSProperties } from 'react';
import type { WeatherLook } from './types';
import walkRight from './assets/cave/motion/walk-right.webp';
import walkLeft from './assets/cave/motion/walk-left.webp';
import runRight from './assets/cave/motion/run-right.webp';
import runLeft from './assets/cave/motion/run-left.webp';
import climb from './assets/cave/motion/climb.webp';

export type FoxMovement = 'walk' | 'run' | 'climb';
type Facing = 'left' | 'right';
const strips = {
 walk: { left: walkLeft, right: walkRight, frames: 14, period: 560 },
 run: { left: runLeft, right: runRight, frames: 14, period: 405 },
 climb: { left: climb, right: climb, frames: 18, period: 1440 },
};
const weatherStrips = import.meta.glob<string>('./assets/cave/weather/motion/*.webp',
 { eager: true, query: '?url&no-inline', import: 'default' });
const ready = new Set<string>();
const pending = new Map<string, Promise<void>>();

function motionArt(movement: FoxMovement, facing: Facing, clothing?: WeatherLook['clothing'], glasses = false) {
 const strip = strips[movement];
 const pose = movement === 'climb' ? movement : `${movement}-${facing}`;
 const outfit = clothing === 'cold' ? 'cold' : clothing === 'hot' ? 'heat' : undefined;
 const dressed = outfit && weatherStrips[`./assets/cave/weather/motion/${outfit}-${pose}.webp`];
 const lenses = glasses && movement !== 'climb' ? weatherStrips[`./assets/cave/weather/motion/sun-${pose}.webp`] : undefined;
 return { url: dressed || strip[facing], glasses: lenses, frames: strip.frames, period: strip.period };
}

function load(url: string) {
 const active = pending.get(url);
 if (active) return active;
 const image = new Image();
 image.src = url;
 const promise = image.decode().then(() => { ready.add(url); }, () => { pending.delete(url); });
 pending.set(url, promise);
 return promise;
}

export function preloadFoxMovement(clothing?: WeatherLook['clothing'], glasses?: boolean) {
 for (const movement of ['walk', 'run', 'climb'] as const) {
  for (const facing of ['left', 'right'] as const) {
   const art = motionArt(movement, facing, clothing, glasses);
   void load(art.url);
   if (art.glasses) void load(art.glasses);
  }
 }
}

export function useFoxMovement(movement?: FoxMovement, facing: Facing = 'right',
 clothing?: WeatherLook['clothing'], glasses?: boolean) {
 const strip = movement ? motionArt(movement, facing, clothing, glasses) : undefined;
 const url = strip?.url;
 const lenses = strip?.glasses;
 const [, refresh] = useState(0);
 useEffect(() => {
  if (!url) return;
  const images = [url, lenses].filter((image): image is string => image !== undefined && !ready.has(image));
  if (!images.length) return;
  let active = true;
  void Promise.all(images.map(load)).then(() => { if (active) refresh(value => value + 1); });
  return () => { active = false; };
 }, [url, lenses]);
 if (!strip || !ready.has(strip.url)) return undefined;
 return { ...strip, glasses: lenses && ready.has(lenses) ? lenses : undefined };
}

export function FoxMotionStrip({ url, glasses, frames, period, animated, mirror }: {
 url: string; glasses?: string; frames: number; period: number; animated: boolean; mirror?: string;
}) {
 const style = { '--fox-frames': frames, '--fox-period': `${period}ms` } as CSSProperties;
 return <g transform={mirror} pointerEvents="none">
  <svg className="fox-motion-frame" width="240" height="310" viewBox="0 0 240 310" aria-hidden="true">
   <g className={animated ? 'fox-motion-strip' : undefined} style={style}>
    <image href={url} width={240 * frames} height={310}/>
    {glasses && <image href={glasses} width={240 * frames} height={310}/>}
   </g>
  </svg>
 </g>;
}

const leftLeg = 'M509 1245H658L652 1389H435V1316L454 1292Z';
const rightLeg = 'M658 1245H882L848 1328L828 1389H652Z';

export function FoxPerchArt({ src }: { src: string }) {
 const id = useId();
 return <svg x={21.5} y={23} width={196} height={257} viewBox="0 0 1096 1435" aria-hidden="true">
  <defs>
   <clipPath id={id + '-left'}><path d={leftLeg}/></clipPath>
   <clipPath id={id + '-right'}><path d={rightLeg}/></clipPath>
   <mask id={id + '-body'} x="0" y="0" width="1096" height="1435" maskUnits="userSpaceOnUse">
    <rect width="1096" height="1435" fill="white"/>
    <path d={leftLeg + rightLeg} fill="black"/>
   </mask>
  </defs>
  <g className="fox-perch-leg fox-perch-left">
   <image href={src} width={1096} height={1435} clipPath={`url(#${id}-left)`}/>
  </g>
  <g className="fox-perch-leg fox-perch-right">
   <image href={src} width={1096} height={1435} clipPath={`url(#${id}-right)`}/>
  </g>
  <image href={src} width={1096} height={1435} mask={`url(#${id}-body)`}/>
 </svg>;
}

export function FoxWindowSnow() {
 return <g className="window-snow" fill="#ecf5ff" stroke="#b9c8e0" strokeWidth=".7" aria-hidden="true">
  <circle cx="78" cy="191" r="3.3"/><circle cx="98" cy="213" r="3.1"/>
  <circle cx="165" cy="212" r="3.6"/><circle cx="191" cy="201" r="2.6"/>
 </g>;
}
