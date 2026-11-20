import { useEffect, useRef, useState, type DragEvent } from 'react';
import type { Favorite } from './types';
import han from './assets/camp/visitors/han.webp';
import tang from './assets/camp/visitors/tang.webp';
import miao from './assets/camp/visitors/miao.webp';
import ming from './assets/camp/visitors/ming.webp';
import carrot from './assets/camp/carrot.png';
import lettuce from './assets/camp/lettuce.png';
import pumpkin from './assets/camp/pumpkin.png';
import { visitName, visitTopic, type VisitScene, type VisitStory } from './visit-story';
import './camp-visit.css';
import { seatedVisitorArt } from './camp-seat-art';

type Vegetable = { id: string; image: string; name: string; topic: string; url?: string };
const demoVegetables: Vegetable[] = [
  { id: 'demo-snack', image: lettuce, name: '生菜', topic: '散步小吃' },
  { id: 'demo-music', image: pumpkin, name: '南瓜', topic: '街头音乐' },
];
const dragType = 'application/x-kanshan-topic-vegetable';
const visitorArt = { han, tang, miao, ming };
const speechDurations = [2800, 2900, 2900, 2600, 950];
const replyOptions = {
  sweet: ['尝尝甜的', '那就先尝一口甜的，咸的留给下一碗。'],
  salty: ['来勺卤', '好嘞，咸的加卤。下次也给甜的留个位置。'],
  both: ['各尝一点', '两种各来半碗，吃完再继续争！'],
} as const;
const replyChoices = Object.keys(replyOptions) as (keyof typeof replyOptions)[];

export function CampVisit({ story, seated, quiet, disabled, favorites, wornFoxOutfit }: {
  story: VisitStory; seated: boolean; quiet: boolean; disabled: boolean; favorites: Favorite[];
  wornFoxOutfit?: string | null;
}) {
  const { phase, scene, meet } = story;
  const visitor = visitName(scene);
  const [preferred, alternative] = scene.visitor === 'lan' ? ['tang', 'han'] as const : ['miao', 'ming'] as const;
  const visitorOutfit = preferred === wornFoxOutfit ? alternative : preferred;
  const topic = visitTopic(scene);
  const [choice, setChoice] = useState<keyof typeof replyOptions>();
  const [turn, setTurn] = useState(0);
  const [offerOpen, setOfferOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState(false);
  const [shared, setShared] = useState<{ item: Vegetable; times: number }>();
  const [pokes, setPokes] = useState(0);
  const [offerSide, setOfferSide] = useState<'left' | 'right'>('right');
  const [offerBelow, setOfferBelow] = useState(false);
  const drag = useRef<string | null>(null);
  const guest = useRef<HTMLDivElement>(null);
  const prompt = useRef<HTMLButtonElement>(null);
  const offeredVegetables = favorites.filter(item => item.kind === 'zhihu_post' && !item.hidden).slice(-2);
  const vegetables = offeredVegetables.length ? offeredVegetables.map((item, index) => ({
    ...demoVegetables[index], id: item.id, topic: item.title, url: item.source?.sourceUrl || item.url,
  })) : demoVegetables;
  const present = phase === 'offering' || phase === 'staying';
  const leaving = phase === 'leaving';
  const sitting = seated && present;
  const lines = [scene.guestLine, choice ? replyOptions[choice][1] : scene.reply, scene.followUp, scene.closingLine, ''];
  const hostSpeaking = turn % 2 === 1;
  const affinity = `${scene.mood} · 好感 ${story.affinity}`;

  useEffect(() => {
    if (!disabled && present) meet();
  }, [disabled, present, meet]);

  useEffect(() => {
    if (disabled || !present || offerOpen) return;
    const timer = setTimeout(() => setTurn((turn + 1) % speechDurations.length), speechDurations[turn]);
    return () => clearTimeout(timer);
  }, [disabled, present, offerOpen, turn]);

  useEffect(() => {
    if (!shared) return;
    const timer = setTimeout(() => setShared(undefined), 1600);
    return () => clearTimeout(timer);
  }, [shared]);

  function endDrag() {
    drag.current = null;
    setDragging(false);
    setOver(false);
  }

  function beginDrag(event: DragEvent<HTMLButtonElement>, id: string) {
    if (disabled || !present) { event.preventDefault(); return; }
    drag.current = id;
    event.dataTransfer.setData(dragType, id);
    event.dataTransfer.effectAllowed = 'copy';
    setSelected(null);
    setDragging(true);
  }

  function share(id: string) {
    const item = vegetables.find(value => value.id === id);
    if (disabled || !present || !item) return;
    setShared(previous => ({ item, times: (previous?.times ?? 0) + 1 }));
    setPokes(count => count + 1);
    setSelected(null);
    story.share();
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    if (!drag.current || !event.dataTransfer.types.includes(dragType)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.getData(dragType) === drag.current) share(drag.current);
    endDrag();
  }

  function toggleOffer() {
    const bounds = guest.current?.getBoundingClientRect();
    if (bounds) {
      setOfferSide(bounds.right + 244 < innerWidth ? 'right' : 'left');
      setOfferBelow(bounds.top < 160);
    }
    setOfferOpen(value => !value);
  }

  function answer(accept: boolean) {
    if (phase !== 'offering') return;
    setOfferOpen(false);
    prompt.current?.focus();
    if (!accept) {
      setSelected(null);
      endDrag();
    }
    story.answer(accept);
  }

  return <>
    {phase === 'offering' && <div className="camp-visit-arrival" role="status">
      <strong>{visitor}来啦</strong><small>本机演示</small>
    </div>}
    {present && !disabled && !offerOpen && lines[turn] && <p key={turn}
      className={`visit-speech${quiet ? ' visit-still' : ''}`} data-speaker={hostSpeaking ? 'host' : 'guest'}
      aria-label={`${hostSpeaking ? '刘看山' : visitor}：${lines[turn]}`}>{lines[turn]}</p>}
    {(present || leaving) && <div ref={guest}
      className={`camp-visit-guest ${leaving ? 'is-leaving' : ''} ${quiet ? 'visit-still' : ''} ${over ? 'is-over' : ''} ${dragging || selected ? 'can-share' : ''}`}
      onDragOver={event => {
        if (disabled || !present || !drag.current || !event.dataTransfer.types.includes(dragType)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        setOver(true);
      }}
      onDragLeave={event => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setOver(false);
      }}
      onDrop={drop}>
      <div className="visit-guest-body">
        <button className="visit-guest-pet" type="button" disabled={disabled || leaving}
          aria-label={selected ? `把菜送给${visitor}` : `戳戳${visitor}`}
          onClick={() => selected ? share(selected) : setPokes(count => count + 1)}>
          <span key={pokes} className={`visit-friend-art ${pokes ? 'was-poked' : ''}`} aria-hidden="true">
            <img className={sitting ? 'camp-seated-guest-art' : undefined}
              src={(sitting ? seatedVisitorArt : visitorArt)[visitorOutfit]} alt="" draggable={false}
              data-pet-appearance="fox" data-cave-outfit={visitorOutfit}/>
            {leaving && <span className="visit-tear" aria-hidden="true"/>}
          </span>
          <span className="visit-pet-name">{visitor}</span>
        </button>
        {phase === 'offering' && <button ref={prompt} type="button" className="visit-ellipsis" disabled={disabled}
          aria-label="看看访客带来的菜" aria-expanded={offerOpen} aria-controls="camp-visit-offer" onClick={toggleOffer}>
          <span aria-hidden="true">•••</span>
        </button>}
        {phase === 'staying' && <span className="visit-spark" aria-label="已收下访客的菜">✓</span>}
        {present && shared && <span key={shared.times} className="visit-share-reaction" aria-hidden="true">
          <img src={shared.item.image} alt=""/><span>✦</span>
        </span>}
      </div>
      {phase === 'offering' && offerOpen && !disabled && <section id="camp-visit-offer" className="visit-offer"
        data-side={offerSide} data-below={offerBelow} aria-label="访客带来的菜">
        <img src={carrot} alt=""/>
        <div><p>{visitor}给你带来了一颗胡萝卜！</p><small>知乎主题 · {topic.label}</small></div>
        <div className="visit-offer-actions">
          <button className="visit-accept" type="button" onClick={() => answer(true)}>收下</button>
          <button type="button" onClick={() => answer(false)}>这次不用</button>
        </div>
      </section>}
    </div>}
    {present && !disabled && <section className="visit-basket" aria-label="可以分享给访客的菜">
      <header><strong>分享菜篮</strong><small>拖一颗菜给访客</small></header>
      <div className="visit-vegetables">
        {vegetables.map(item => <button key={item.id} type="button" draggable
          aria-label={`${item.name} · ${item.topic}`} aria-pressed={selected === item.id}
          title={`${item.name} · ${item.topic}`}
          onClick={() => setSelected(value => value === item.id ? null : item.id)}
          onDragStart={event => beginDrag(event, item.id)} onDragEnd={endDrag}>
          <img src={item.image} alt="" draggable={false}/><span>{item.topic}</span>
        </button>)}
      </div>
      {scene.topic === 'tofu' ? <details className="visit-response">
        <summary title={`${topic.label} · ${story.affinityLabel}`}>{affinity}</summary>
        <div className="visit-stance" role="group" aria-label="给看山一个接话建议">
          {replyChoices.map(value => <button key={value} type="button" aria-pressed={choice === value}
            onClick={() => { setChoice(value); setTurn(1); }}>{replyOptions[value][0]}</button>)}
        </div>
      </details> : <small className="visit-response" title={`${topic.label} · ${story.affinityLabel}`}>{affinity}</small>}
    </section>}
    <span className="visit-announcement" role="status">
      {shared ? `已把${shared.item.name}分享给${visitor} · ${shared.item.topic}` : ''}
    </span>
  </>;
}

export function CampVisitGift({ scene, seed, disabled, onOpenSource, onKeep, onChoose }: {
  scene: VisitScene; seed?: Favorite; disabled: boolean; onOpenSource: (url: string) => void;
  onKeep: () => void; onChoose: (seed: Favorite) => void;
}) {
  const topic = visitTopic(scene);
  return <article className="visit-gift">
    <img src={carrot} alt=""/>
    <div>
      <h3>胡萝卜 · {topic.label}</h3>
      <p>{visitName(scene)}带来的分享</p>
      <p>{scene.title}</p>
      <p className="visit-seed-question">「{topic.seed}」</p>
      <div className="camp-sheet-actions">
        <button type="button" onClick={() => onOpenSource(scene.url)}>打开知乎回答 ↗</button>
        {seed ? <button type="button" disabled={disabled} onClick={() => onChoose(seed)}>{seed.slot === null ? '选择一块田' : '查看这株'}</button> :
          <button type="button" className="primary" disabled={disabled} onClick={onKeep}>留种</button>}
      </div>
    </div>
  </article>;
}

export function CampVisitNotes({ entries, onOpenSource }: { entries: VisitScene[]; onOpenSource: (url: string) => void }) {
  return <section className="visit-plot-notes" aria-label="这株的串门纸条">
    <h3>串门纸条</h3>
    {entries.map(entry => <article key={entry.id}>
      <strong>{entry.mood} · {visitName(entry)}</strong>
      <p>{entry.guestLine}</p>
      <button type="button" onClick={() => onOpenSource(entry.url)}>{entry.title} ↗</button>
    </article>)}
  </section>;
}
