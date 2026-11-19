import { useEffect, useRef } from 'react';

const reach = 126;
const limit = (value: number) => Math.max(-1, Math.min(1, value));

export function usePetGaze(enabled: boolean) {
 const actor = useRef<HTMLButtonElement>(null);
 useEffect(() => {
  const button = actor.current;
  if (!button || !enabled) return;
  let timeout: ReturnType<typeof setTimeout>;
  const reset = () => {
   button.style.setProperty('--pet-gaze-x', '0');
   button.style.setProperty('--pet-gaze-y', '0');
   button.removeAttribute('data-gaze-active');
  };
  const off = window.kanshan?.onProbe(({ x, y }) => {
   const art = button.querySelector('.fox');
   if (!art) return;
   const bounds = art.getBoundingClientRect();
   const dx = x - (bounds.x + bounds.width / 2);
   const dy = y - (bounds.y + bounds.height * .39);
   if (Math.hypot(dx, dy) > reach) { reset(); return; }
   button.style.setProperty('--pet-gaze-x', String(limit(dx / 82)));
   button.style.setProperty('--pet-gaze-y', String(limit(dy / 82)));
   button.setAttribute('data-gaze-active', '');
   clearTimeout(timeout);
   timeout = setTimeout(reset, 160);
  });
  return () => { off?.(); clearTimeout(timeout); reset(); };
 }, [enabled]);
 return actor;
}
