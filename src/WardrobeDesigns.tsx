import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import designs from '../desktop/wardrobe-designs.json';
import { Outfit, defaultCard, outfits } from './outfits';
import { WardrobeTurntable } from './WardrobeTurntable';

type Card = { id: string; name: string; description: string; outfit?: Outfit; wearable: boolean };
const art = import.meta.glob<string>('./assets/wardrobe-designs/*/{front,side,back}-cutout.png', { eager: true, query: '?url&no-inline', import: 'default' });
const spins = import.meta.glob<string>('./assets/wardrobe-designs/*/turntable.webp', { eager: true, query: '?url&no-inline', import: 'default' });
const orderedDesigns = [...designs.filter(item => item.featured), ...designs.filter(item => !item.featured)];
export const wardrobeCards: Card[] = [
 { ...defaultCard, wearable: true },
 ...outfits.map(outfit => ({ ...outfit, outfit, wearable: true })),
 ...orderedDesigns.map(({ id, name, description }) => ({ id, name, description, wearable: false })),
];

const picture = (id: string, angle: 'front' | 'side' | 'back') => art[`./assets/wardrobe-designs/${id}/${angle}-cutout.png`];
const center = (rail: HTMLElement, item: HTMLElement) =>
 item.offsetLeft - (rail.clientWidth - item.offsetWidth) / 2;
const scrollBehavior = (): ScrollBehavior => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';

export function WardrobeDesigns({ card, currentId, changing, onSelect, renderWearable }: {
 card: Card; currentId: string; changing: boolean; onSelect: (id: string) => void;
 renderWearable: (card: Card, active: boolean) => ReactNode;
}) {
 const [actualId, setActualId] = useState<string>();
 const rail = useRef<HTMLDivElement>(null);
 const hasAngles = Boolean(picture(card.id, 'side') && picture(card.id, 'back'));
 const showingActual = card.wearable && (actualId === card.id || !hasAngles);
 const selectedIndex = wardrobeCards.indexOf(card);

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
   </div></div> : <WardrobeTurntable key={card.id} name={card.name}
    sprite={spins[`./assets/wardrobe-designs/${card.id}/turntable.webp`]}
    front={picture(card.id, 'front')} side={picture(card.id, 'side')} back={picture(card.id, 'back')}/>}
   {card.wearable && hasAngles && <button type="button" className="wardrobe-preview-toggle"
    onClick={() => setActualId(showingActual ? undefined : card.id)}>
    {showingActual ? '返回 360° 预览' : '查看实际效果'}
   </button>}
  </div>
  <div className="wardrobe-shelf">
   <button type="button" className="wardrobe-arrow" aria-label="上一套" disabled={changing || selectedIndex === 0}
    onClick={() => onSelect(wardrobeCards[selectedIndex - 1].id)}>‹</button>
   <div ref={rail} className="wardrobe-rail" aria-label="全部套装" tabIndex={0} onKeyDown={event => {
    if (event.target === event.currentTarget) browse(event, selectedIndex, wardrobeCards.length, index => onSelect(wardrobeCards[index].id));
   }}>
    {wardrobeCards.map(item => <button key={item.id} type="button" className="home-outfit-card"
     disabled={changing} aria-pressed={card.id === item.id} onClick={() => onSelect(item.id)}>
     <span className="home-thumb" aria-hidden="true">
      {picture(item.id, 'front') ? <img src={picture(item.id, 'front')} alt="" draggable={false}/>
       : renderWearable(item, false)}
     </span>
     <strong>{item.name}</strong>
     <small>{currentId === item.id ? '正在穿着' : item.wearable ? '可穿戴' : '设定预览'}</small>
    </button>)}
   </div>
   <button type="button" className="wardrobe-arrow" aria-label="下一套" disabled={changing || selectedIndex === wardrobeCards.length - 1}
    onClick={() => onSelect(wardrobeCards[selectedIndex + 1].id)}>›</button>
  </div>
 </div>;
}
