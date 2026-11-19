import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

const VIEW_COLUMNS = 4;
const VIEW_ROWS = 2;
const VIEW_SIZE = 256;
const wrap = (angle: number) => (angle % 360 + 360) % 360;
const directions = [
 { angle: 0, name: '正面' }, { angle: 90, name: '侧面' },
 { angle: 180, name: '背面' }, { angle: 270, name: '另一侧' },
];

export function WardrobeTurntable({ name, sprite, front, side, back, dragOnly = false }: {
 name: string; sprite?: string; front: string; side: string; back: string; dragOnly?: boolean;
}) {
 const viewer = useRef<HTMLDivElement>(null);
 const lastX = useRef<number | undefined>(undefined);
 const [angle, setAngle] = useState(0);
 const [ready, setReady] = useState(false);
 const viewCount = ready ? VIEW_COLUMNS * VIEW_ROWS : 4;
 const step = 360 / viewCount;
 const view = Math.round(angle / step) % viewCount;
 const degrees = view * step;
 const column = view % VIEW_COLUMNS;
 const row = Math.floor(view / VIEW_COLUMNS);
 const fallback = [front, side, back, side][view];

 useEffect(() => {
  if (!sprite) return;
  let active = true;
  const image = new Image();
  image.src = sprite;
  void image.decode().then(() => {
   if (active && image.naturalWidth === VIEW_COLUMNS * VIEW_SIZE && image.naturalHeight === VIEW_ROWS * VIEW_SIZE) {
    setReady(true);
   }
  }, () => {});
  return () => { active = false; };
 }, [sprite]);

 useEffect(() => {
  const node = viewer.current;
  if (!node) return;
  function wheel(event: WheelEvent) {
   const distance = event.deltaX || (event.shiftKey ? event.deltaY : 0);
   if (!distance) return;
   event.preventDefault();
   setAngle(current => wrap(current + distance * (event.deltaMode === 1 ? 16 : 1)));
  }
  node.addEventListener('wheel', wheel, { passive: false });
  return () => node.removeEventListener('wheel', wheel);
 }, []);

 function move(event: PointerEvent<HTMLDivElement>) {
  if (dragOnly && !event.currentTarget.hasPointerCapture(event.pointerId)) return;
  const x = event.clientX;
  if (lastX.current !== undefined) {
   const change = (x - lastX.current) * 360 / (event.currentTarget.clientWidth * .9);
   setAngle(current => wrap(current + change));
  }
  lastX.current = x;
 }

 function key(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key === 'Home') {
   event.preventDefault();
   setAngle(0);
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
   event.preventDefault();
   setAngle(wrap(degrees + (event.key === 'ArrowLeft' ? -step : step)));
  }
 }

 return <div className="wardrobe-turntable-layout">
  <div className="wardrobe-turntable" ref={viewer} role="slider" tabIndex={0}
   aria-label={name + ' · 360° 全身预览'} aria-valuemin={0} aria-valuemax={360 - step}
   aria-valuenow={degrees} aria-valuetext={degrees + ' 度'}
   onKeyDown={key} onPointerEnter={event => {
    if (!dragOnly && event.pointerType === 'mouse') lastX.current = event.clientX;
   }}
   onPointerMove={move} onPointerLeave={() => { lastX.current = undefined; }}
   onPointerDown={event => {
    if (event.button !== 0) return;
    lastX.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
   }}
   onLostPointerCapture={() => { lastX.current = undefined; }}>
   <div className="wardrobe-turntable-figure" aria-hidden="true" data-view={view} data-ready={ready}>
    {ready ? <span style={{
     backgroundImage: `url("${sprite}")`,
     backgroundSize: `${VIEW_COLUMNS * 100}% ${VIEW_ROWS * 100}%`,
     backgroundPosition: `${column / (VIEW_COLUMNS - 1) * 100}% ${row / (VIEW_ROWS - 1) * 100}%`,
    }}/> : <img src={fallback} alt="" draggable={false}
     style={view === 3 ? { transform: 'scaleX(-1)' } : undefined}/>}
   </div>
   <span className="wardrobe-turntable-hint" aria-hidden="true">360° · 左右拖动</span>
   <span className="wardrobe-turntable-degrees" aria-hidden="true">{degrees}°</span>
  </div>
  <div className="wardrobe-directions" role="group" aria-label="服装视角">
   {directions.map(view => <button type="button" key={view.angle} aria-pressed={degrees === view.angle}
    onClick={() => setAngle(view.angle)}>{view.name}</button>)}
  </div>
 </div>;
}
