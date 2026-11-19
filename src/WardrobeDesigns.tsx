import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Outfit, defaultCard, outfits } from './outfits';
import { WardrobeTurntable } from './WardrobeTurntable';
import {ClassicWardrobeArt} from './ClassicWardrobeArt';
import {forestGuideViews} from './ForestGuideArt';

type Card = { id: string; name: string; description: string; outfit?: Outfit; wearable: boolean };
export const wardrobeCards: Card[] = [
 { ...defaultCard, wearable: true },
 ...outfits.map(outfit => ({ ...outfit, outfit, wearable: true })),
];

const center = (rail: HTMLElement, item: HTMLElement) =>
 item.offsetLeft - (rail.clientWidth - item.offsetWidth) / 2;
const scrollBehavior = (): ScrollBehavior => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';

export function WardrobeDesigns({ card, currentId, changing, onSelect, renderWearable }: {
 card: Card; currentId: string; changing: boolean; onSelect: (id: string) => void;
 renderWearable: (card: Card, active: boolean) => ReactNode;
}) {
 const [actualId, setActualId] = useState<string>();
 const rail = useRef<HTMLDivElement>(null);
 const showingActual = actualId === card.id;
 const available = wardrobeCards.filter(item => item.id !== defaultCard.id);
 const selectedIndex = available.indexOf(card);

 useEffect(() => {
  const list = rail.current;
  const item = list?.children[selectedIndex] as HTMLElement | undefined;
  if (list && item) list.scrollTo({ left: center(list, item), behavior: scrollBehavior() });
 }, [selectedIndex]);

 function browse(event: KeyboardEvent, index: number, max: number, go: (next: number) => void) {
  const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
  if (step) {
   event.preventDefault();
   go(Math.max(0, Math.min(index + step, max - 1)));
  }
 }

 return <div className="wardrobe-gallery">
  <div className="wardrobe-heading">
   <div>
    <h3>{card.name}</h3>
    <p>{card.description}</p>
   </div>
   <span className="wardrobe-badge" data-wearable={card.wearable}>
    {currentId === card.id ? '正在穿着' : card.wearable ? '可穿戴' : '设定预览'}
   </span>
  </div>
  <div className="wardrobe-display">
   {showingActual ? <div className="home-preview"><div className="home-preview-stage">
    {renderWearable(card, true)}
   </div></div> : card.id==='forest-guide'?<WardrobeTurntable key={card.id} name={card.name}
    sprite={forestGuideViews.turntable} front={forestGuideViews.front} side={forestGuideViews.side} back={forestGuideViews.back} dragOnly/>:
    <WardrobeTurntable key={card.id} name={card.name}
     renderView={angle=><ClassicWardrobeArt id={card.id} angle={angle} animate={false}/>}/>}
   {card.wearable && <button type="button" className="wardrobe-preview-toggle"
    onClick={() => setActualId(showingActual ? undefined : card.id)}>
    {showingActual ? '返回 360° 预览' : '查看实际效果'}
   </button>}
  </div>
  <div className="wardrobe-shelf" data-single={available.length===1}>
   {available.length>1&&<button type="button" className="wardrobe-arrow" aria-label="上一套" disabled={changing || selectedIndex <= 0}
    onClick={() => onSelect(available[selectedIndex - 1].id)}>‹</button>}
   <div ref={rail} className="wardrobe-rail" aria-label="全部套装" tabIndex={0} onKeyDown={event => {
    if (event.target === event.currentTarget) browse(event, selectedIndex, available.length, index => onSelect(available[index].id));
   }}>
    {available.map(item => <button key={item.id} type="button" className="home-outfit-card"
     disabled={changing} aria-pressed={card.id === item.id} onClick={() => onSelect(item.id)}>
     <span className="home-thumb" aria-hidden="true">
      <ClassicWardrobeArt id={item.id} angle={0} animate={false}/>
     </span>
     <strong>{item.name}</strong>
     <small>{currentId === item.id ? '正在穿着' : item.wearable ? '可穿戴' : '设定预览'}</small>
    </button>)}
   </div>
   {available.length>1&&<button type="button" className="wardrobe-arrow" aria-label="下一套" disabled={changing || selectedIndex === available.length - 1}
    onClick={() => onSelect(available[selectedIndex + 1].id)}>›</button>}
  </div>
 </div>;
}
