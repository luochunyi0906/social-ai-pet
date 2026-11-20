import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';

type Offset = { x: number; y: number };
type Positions = Record<string, Offset>;
const storageKey = 'kanshan:camp-layout:v2';
const legacyStorageKey = 'kanshan:camp-layout:v1';
const zero = { x: 0, y: 0 };

function readPositions(): Positions {
  try {
    const saved = localStorage.getItem(storageKey);
    const value = JSON.parse(saved ?? localStorage.getItem(legacyStorageKey) ?? '{}');
    const positions = Object.fromEntries(Object.entries(value).filter(([key, offset]) => {
      const point = offset as Offset | null;
      return /^(farm|cave|cabin|seed|water|fertilizer|glove|fox|bench|mail)(-label)?$|^stone-\d+(?:\.\d+)?$/.test(key) &&
        point && Number.isFinite(point.x) && Number.isFinite(point.y) &&
        Math.abs(point.x) <= 1800 && Math.abs(point.y) <= 1480;
    })) as Positions;
    if (saved !== null) return positions;
    const { cave, 'cave-label': _caveLabel, bench: _bench, 'bench-label': _benchLabel, ...remaining } = positions;
    // The new bench uses the former cave's location in existing camps.
    return cave ? { ...remaining, bench: cave } : remaining;
  } catch {
    return {};
  }
}

export function useCampLayout() {
  const map = useRef<HTMLDivElement>(null);
  const [saved, setSaved] = useState(readPositions);
  const [draft, setDraft] = useState<Positions | null>(null);
  const [saveError, setSaveError] = useState(false);
  const drag = useRef<{ id: number; key: string; x: number; y: number; origin: Offset } | null>(null);
  const editing = draft !== null;
  const offset = (key: string) => (draft ?? saved)[key] ?? zero;

  function movable(key: string) {
    const { x, y } = offset(key);
    const style: CSSProperties | undefined = x || y ? {
      translate: `calc(${x} * var(--camp-layout-unit)) calc(${y} * var(--camp-layout-unit))`,
    } : undefined;
    return { 'data-layout-item': key, style };
  }

  function start(event: PointerEvent<HTMLDivElement>) {
    if (!editing || event.button !== 0 || !event.isPrimary) return;
    const key = (event.target as Element).closest('[data-layout-item]')?.getAttribute('data-layout-item');
    if (!key) return;
    event.preventDefault();
    drag.current = { id: event.pointerId, key, x: event.clientX, y: event.clientY, origin: offset(key) };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const active = drag.current;
    const scale = (map.current?.getBoundingClientRect().width ?? 0) / 900;
    if (!editing || !active || active.id !== event.pointerId || !scale) return;
    const x = Math.min(innerWidth - 18, Math.max(18, event.clientX));
    const y = Math.min(innerHeight - 18, Math.max(18, event.clientY));
    setDraft(previous => previous && ({
      ...previous,
      [active.key]: {
        x: active.origin.x + (x - active.x) / scale,
        y: active.origin.y + (y - active.y) / scale,
      },
    }));
  }

  function end(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id === event.pointerId) drag.current = null;
  }

  function cancel() {
    drag.current = null;
    setDraft(null);
    setSaveError(false);
  }

  function save() {
    if (!draft) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
      setSaved(draft);
      cancel();
    } catch {
      setSaveError(true);
    }
  }

  return {
    map, editing, offset, movable, start, move, end, cancel, save, saveError,
    edit: () => setDraft(saved),
    reset: () => setDraft({}),
  };
}
