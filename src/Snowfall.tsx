import type { CSSProperties } from 'react';
import './snowfall.css';

type Setting = { count: number; size: [number, number]; speed: [number, number]; opacity: [number, number]; wind: number };
type Depth = 'far' | 'mid' | 'near';

const layers: Record<'camp' | 'pet', Record<Depth, Setting>> = {
 camp: {
  far: { count: 25, size: [1.2, 2.5], speed: [23, 34], opacity: [.4, .63], wind: 22 },
  mid: { count: 20, size: [2.5, 4.6], speed: [15, 25], opacity: [.47, .76], wind: 39 },
  near: { count: 9, size: [4, 7.8], speed: [13, 20], opacity: [.48, .76], wind: 56 }
 },
 pet: {
  far: { count: 9, size: [1, 1.8], speed: [14, 24], opacity: [.34, .57], wind: 11 },
  mid: { count: 7, size: [1.7, 2.7], speed: [11, 19], opacity: [.44, .66], wind: 17 },
  near: { count: 3, size: [2.6, 4.2], speed: [9, 14], opacity: [.54, .72], wind: 22 }
 }
};
const depths = ['far', 'mid', 'near'] as const;

function range([start, end]: [number, number], index: number, salt: number) {
 return start + (end - start) * ((index * (salt + 17) + salt) % 101) / 100;
}

function flakeStyles({count, size, speed, opacity, wind}: Setting, group: number) {
 return Array.from({length:count}, (_, i) => {
  const index = i + group * 11;
  const seconds = range(speed, index, 31);
  const startingHeight = ((i * 11 + group * 3) % count + range([.04, .96], index, 27)) / count;
  return {
   '--snow-x': `${(i + range([.05, .95], index, 9)) / count * 100}%`,
   '--snow-size': `${range(size, index, 13)}px`,
   '--snow-opacity': range(opacity, index, 19),
   '--snow-time': `${seconds}s`,
   '--snow-start': `-${startingHeight * seconds}s`,
   '--snow-wind': `${range([-.42 * wind, wind], index, 41)}px`,
   '--snow-sway': `${range([.14 * wind, .36 * wind], index, 15)}px`
  } as CSSProperties;
 });
}

const particles = {
 camp: depths.map((depth, group) => flakeStyles(layers.camp[depth], group)),
 pet: depths.map((depth, group) => flakeStyles(layers.pet[depth], group))
};

export function Snowfall({ surface }: { surface: 'camp' | 'pet' }) {
 return <div className={`snowfall ${surface === 'camp' ? 'camp-snow' : 'pet-snowy-flurries'}`} aria-hidden="true">
  {depths.map((depth, group) =>
   <div key={depth} className={`snowfall-layer snowfall-${depth}`}>
    {particles[surface][group].map((style, index) =>
     <i key={index} className={depth === 'near' && index % 3 === 0 ? 'snowfall-crystal' : undefined} style={style}/>)}
   </div>)}
 </div>;
}
