import { useCampLayout } from './useCampLayout';
import { usePetClicks } from './usePetClicks';
import { FeatureGuide } from './FeatureGuide';
import { CampVisit, CampVisitGift, CampVisitNotes } from './CampVisit';
import { findVisitSeed, visitTopic, type VisitScene, type VisitStory } from './visit-story';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { BenchCompanion, Companion } from './Companion';
import { StickerArt } from './ChatSticker';
import { Plant } from './Plant';
import plantVarieties from '../desktop/plant-varieties.json';
import cabinArt from './assets/camp/cabin.png';
import benchArt from './assets/camp/bench-facing-cabin.webp';
import seedArt from './assets/camp/seed.png';
import mailArt from './assets/camp/mail-front-angle.png';
import openMailArt from './assets/camp/mail-with-clues.png';
import waterArt from './assets/camp/water.png';
import fertilizerArt from './assets/camp/fertilizer.png';
import gloveArt from './assets/camp/gardening-gloves.png';
import soilArt from './assets/camp/soil.png';
import stoneArt from './assets/camp/path-stone.png';
import { useWindowDrag } from './windowDrag';
import { SourceDetails, coverageLabel } from './SourceDetails';
import { unwrap, type Favorite, type Garden, type GardenAction, type PlantVariety } from './types';
import './camp.css';
import {TeachingJournal} from './TeachingPanel';

const bridge = window.kanshan;
const STAGES = { planted: '已播种', sprout: '幼苗', growing: '生长中', flower: '已开花' };
const ALBUM = [['sunflower','向日葵','为什么向阳'],['tulip','郁金香','郁见新知'],['bluebell','蓝铃花','铃听一下'],['lavender','薰衣草','薰薰然'],['strawberry','草莓','莓有标准答案'],['lettuce','生菜','卷出新知'],['carrot','胡萝卜','橘博士'],['daisy','雏菊','雏见新知'],['pumpkin','南瓜','瓜分好奇心']] as const;
const VARIETIES = Object.keys(plantVarieties) as PlantVariety[];
const SLOTS = Array.from({ length: 9 }, (_, index) => {
  const column = index % 3;
  const row = Math.floor(index / 3);
  return { index, name: 'ABC'[row] + (column + 1), x: 496 + (column - row) * 74, y: 384 + (column + row) * 39 };
});
const FARM_SCALE = 1.2 * 1.15;
const FARM_CENTER = { x: 496, y: 462 };
const FARM_OFFSET = { x: -34, y: -17 };
// Foot anchors at each end of the projected seat, in camp-map coordinates.
const BENCH_SEATS = { host: { x: 119, y: 325 }, guest: { x: 162, y: 290 } };
const BENCH_APPROACH_MS = 440;
const SOIL = 'M-8-34Q-1-38 7-34L61-10Q74-4 69 6Q65 11 58 14L9 36Q0 40-10 36L-60 14Q-72 8-70-2Q-67-8-58-11Z';
const PATH_STONES = [
  [19.6, 43, 2.85, 13], [21.9, 44.15, 3.06, 8], [25.6, 45.15, 3.12, -7], [28.5, 44.6, 3.06, -9],
  [7.7, 72.2, 4.6, -8], [11.2, 71.7, 4.2, 6], [14.7, 72.1, 3.9, -5], [18.3, 71.6, 4.1, 5],
  [20.9, 69.9, 3.4, -18], [23.5, 68.6, 3.2, -8], [26.2, 66.6, 3.45, -10],
  [28.1, 61.7, 2.8, -12], [27.1, 57.6, 2.9, 8], [25.7, 53.7, 3.3, -3],
  [24.8, 49.2, 3.4, -6], [25.2, 44.9, 3.3, 4],
] as const;

function PropArt({ src }: { src: string }) {
  return <i className="camp-prop-art" aria-hidden="true"><img src={src} alt="" draggable={false}/></i>;
}

type Tool = 'hand' | 'water' | 'fertilize' | 'harvest';
type Sheet = 'seed' | 'plot' | 'journal' | 'album' | 'visit-mail' | null;
type Props = {
  snow: boolean; snowSaving:boolean; onSnow:()=>void;
  garden: Garden; hasClues: boolean; ready: boolean; action: string; reason: string; quiet: boolean; blocked: boolean;
  onGarden: (state: Garden) => void; onActivity: (event: string) => void; onOpenSource: (favorite: Favorite) => void;
  onTeach:(id:string)=>void;onTeachingConversation:(sessionId:string,lessonId:string)=>void;onFavorite:(id:string)=>void;
  journalNavigation?:{tab:'favorites'|'teaching';id:string};
  onHome: () => void; onCave: () => void; onFeed: () => void; onChat: () => void; onSettings: () => void; onReturn: () => void;
  visitStory: VisitStory; visitVisible: boolean; wornFoxOutfit: string | null;
  onShowCamp: () => void; onOpenVisitSource: (url: string) => void;
};

const title = (favorite: Favorite) => favorite.hidden ? '主题已隐藏' : favorite.title;
function sourceLabel(favorite: Favorite) {
  if (favorite.kind === 'zhihu_post') return favorite.source?.provider === 'camp-replay' ? '离线回放 · 历史标题与来源' : coverageLabel(favorite.source?.verification);
  if (favorite.kind === 'search_entry') return '知乎搜索入口';
  return favorite.simulated ? '本地模拟问题' : 'AI 生成的探索问题';
}

export function CampSheet({ title, detail, side = 'right', onClose, busy, children, footer }: {
  title: string; detail?: string; side?: 'left' | 'right' | 'reading'; onClose: () => void;
  busy?: boolean; children: ReactNode; footer?: ReactNode;
}) {
  return <section className={`camp-sheet camp-sheet-${side}`} aria-label={title}>
    <header><div>{detail && <small>{detail}</small>}<h2>{title}</h2></div>
      <button type="button" aria-label={`关闭${title}`} disabled={busy} onClick={onClose}>×</button>
    </header>
    <div className="camp-sheet-body">{children}</div>
    {footer && <div className="camp-sheet-footer">{footer}</div>}
  </section>;
}

export function GardenPanel({ snow, snowSaving, onSnow, garden, hasClues, ready, action, reason, quiet, blocked, onGarden, onActivity,
  onOpenSource, onHome, onCave, onFeed, onChat, onSettings, onReturn,onTeach,onTeachingConversation,onFavorite,journalNavigation,
  visitStory, visitVisible, wornFoxOutfit, onShowCamp, onOpenVisitSource }: Props) {
  const petClicks = usePetClicks(() => openExternal(onChat), onActivity);
  const layout = useCampLayout();
  const windowDrag=useWindowDrag('panel', undefined, !layout.editing);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [benchSeat, setBenchSeat] = useState<{ round: number; approaching: boolean } | null>(null);
  const seat = visitVisible && !layout.editing && benchSeat?.round === visitStory.round ? benchSeat : null;
  useEffect(() => {
    if (!seat?.approaching) return;
    const timer = setTimeout(() => {
      setBenchSeat(current => current === seat ? { ...seat, approaching: false } : current);
    }, BENCH_APPROACH_MS);
    return () => clearTimeout(timer);
  }, [seat]);
  const [journalTab,setJournalTab]=useState<'favorites'|'teaching'|'visit'>('favorites');
  const [lessonId,setLessonId]=useState<string>();
  const journalBody=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!journalNavigation)return;
    setJournalTab(journalNavigation.tab);
    setLessonId(journalNavigation.tab==='teaching'?journalNavigation.id:undefined);
    setSheet('journal');
  },[journalNavigation]);
  useEffect(()=>{
    if(sheet==='journal'&&journalTab==='favorites'&&journalNavigation?.tab==='favorites'){
      journalBody.current?.querySelector('[data-favorite-id="'+CSS.escape(journalNavigation.id)+'"]')?.scrollIntoView({block:'nearest'});
    }
  },[sheet,journalTab,journalNavigation,garden]);
  const [tool, setTool] = useState<Tool>('hand');
  const [slot, setSlot] = useState<number | null>(null);
  const [seedId, setSeedId] = useState<string | null>(null);
  const [selectedVariety, setSelectedVariety] = useState<PlantVariety>('sunflower');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [celebrating,setCelebrating]=useState(false);
  const [error, setError] = useState('');
  const [effect, setEffect] = useState<{ slot: number; action: string } | null>(null);
  const pending = useRef(false);
  const alive = useRef(true);
  const current = useRef({ garden, onGarden, onActivity });
  current.current = { garden, onGarden, onActivity };
  const effectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seeds = garden.favorites.filter(favorite => favorite.slot === null);
  const nextSeed = seeds[0];
  const selectedSeed = seeds.find(favorite => favorite.id === seedId);
  const plant = garden.plants.find(item => item.slot === slot);
  const plantFavorite = plant?.favoriteId ? garden.favorites.find(favorite => favorite.id === plant.favoriteId) : undefined;
  const plots = SLOTS.map(plot => ({ ...plot, item: garden.plants.find(candidate => candidate.slot === plot.index) }));
  const firstEmptyPlot = plots.find(plot => !plot.item);
  const selectedPlot = slot === null ? undefined : SLOTS[slot];
  const visitMail = visitStory.entries.at(-1);
  const visitNotes = new Map<string, VisitScene[]>();
  for (const entry of visitStory.entries) {
    const favorite = findVisitSeed(garden.favorites, entry);
    if (favorite && !favorite.hidden) visitNotes.set(favorite.id, [...(visitNotes.get(favorite.id) ?? []), entry]);
  }
  const plantNotes = plant?.favoriteId ? visitNotes.get(plant.favoriteId) : undefined;
  const isPreview = sheet === 'plot' && tool === 'hand' && Boolean(selectedSeed) && !plant;
  const plotHeading = selectedPlot ? `${selectedPlot.name} · ${plant ? STAGES[plant.stage] : isPreview ? '播种预览' : '空田'}` : '';
  const toolsLocked = busy || blocked;

  useEffect(() => {
    alive.current = true;
    let stopped = false;
    const timer = setInterval(async () => {
      if (!bridge || stopped || pending.current || document.hidden) return;
      try {
        const value = await unwrap(bridge.load());
        if (stopped || pending.current) return;
        const { garden: previous, onGarden: accept, onActivity: activity } = current.current;
        if (value.revision < previous.revision) return;
        accept(value);
        const grown = value.plants.find(item => {
          const before = previous.plants.find(candidate => candidate.id === item.id);
          return before && before.stage !== item.stage;
        });
        if (grown) activity(grown.stage === 'flower' ? 'bloom' : 'garden-stage');
      } catch (failure) {
        if (!stopped) setError((failure as Error).message);
      }
    }, 5000);
    return () => {
      stopped = true;
      alive.current = false;
      clearInterval(timer);
      if (effectTimer.current) clearTimeout(effectTimer.current);
    };
  }, []);

  function clearFeedback() {
    setError('');
    setNotice('');
    setCelebrating(false);
  }

  function close() {
    if (pending.current) return;
    setSheet(null);
    setSeedId(null);
    clearFeedback();
  }

  function openExternal(open: () => void) {
    if (pending.current) return;
    close();
    open();
  }

  function openVisit() {
    openExternal(() => { setBenchSeat(null); onShowCamp(); visitStory.next(); });
  }

  function toggleBench() {
    openExternal(() => {
      const approaching = !quiet && !matchMedia('(prefers-reduced-motion: reduce)').matches;
      setBenchSeat(seat ? null : { round: visitStory.round, approaching });
    });
  }

  function openMailbox() {
    if (pending.current) return;
    if (!visitMail) {
      openExternal(onFeed);
      return;
    }
    onShowCamp();
    clearFeedback();
    setSheet('visit-mail');
    visitStory.read();
  }

  function openSeeds() {
    clearFeedback();
    setSeedId(null);
    setSheet('seed');
    setTool('hand');
    onActivity('seed-select');
  }

  function plantSeed(seed: Favorite, index: number) {
    void perform({ action: 'plant', favoriteId: seed.id, slot: index, variety: selectedVariety }, index);
  }

  function pickTool(next: Tool) {
    clearFeedback();
    setSeedId(null);
    setTool(next);
    if (sheet !== 'plot') setSheet(null);
  }

  async function perform(payload: Omit<GardenAction, 'id'>, target: number) {
    if (!bridge || pending.current || !ready) return;
    pending.current = true;
    setBusy(true);
    clearFeedback();
    try {
      const value = await unwrap(bridge.gardenAction({ ...payload, id: crypto.randomUUID() }));
      onGarden(value);
      if (!alive.current) return;
      setEffect({ slot: target, action: payload.action });
      if (effectTimer.current) clearTimeout(effectTimer.current);
      effectTimer.current = setTimeout(() => setEffect(null), 950);
      onActivity(payload.action === 'harvest' ? 'keep' : payload.action);
      if (payload.action === 'plant') {
        setSeedId(null);
        setSlot(target);
        setSheet('plot');
        setNotice('种子已播下。拿起水壶或肥料，再点这块田。');
        setCelebrating(value.plants.some(item=>item.slot===target&&item.favoriteId===payload.favoriteId));
      } else if (payload.action === 'harvest') {
        setSheet(null);
        setNotice('采种成功，种子已放回种子箱。');
      } else {
        setNotice(payload.action === 'water' ? '水已经浇进土里了。' : '养分已经补上了。');
      }
    } catch (failure) {
      if (alive.current) {
        setError((failure as Error).message);
        onActivity('garden-error');
      }
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function change(favorite: Favorite, operation: 'hide' | 'delete') {
    if (!bridge || pending.current) return;
    pending.current = true;
    setBusy(true);
    clearFeedback();
    try {
      onGarden(await unwrap(bridge.update({ id: favorite.id, action: operation })));
      if (alive.current && operation === 'delete') setNotice('已移除收藏和对应的种子或植物。');
    } catch (failure) {
      if (alive.current) setError((failure as Error).message);
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function keepVisitSeed(scene: VisitScene) {
    if (!bridge || pending.current || toolsLocked || !ready) return;
    const topic = visitTopic(scene);
    pending.current = true;
    setBusy(true);
    clearFeedback();
    try {
      const next = await unwrap(bridge.save({kind:'generated_question',title:topic.seed,keywords:topic.keywords,simulated:true}));
      onGarden(next);
      if (alive.current) setNotice(next.favoriteCreated ? '已留种，种子在箱子里。' : '已经留过这颗种子。');
    } catch (failure) {
      if (alive.current) setError((failure as Error).message);
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }

  function chooseVisitPlot(favorite: Favorite) {
    if (favorite.slot !== null) {
      selectPlot(favorite.slot, true);
      return;
    }
    if (garden.plants.length >= SLOTS.length) {
      setNotice('九块田都种满了，这颗种子留在种子箱。');
      return;
    }
    clearFeedback();
    setSeedId(favorite.id);
    setTool('hand');
    setSlot(null);
    setSheet(null);
    onActivity('seed-select');
  }

  function visitGift(scene: VisitScene) {
    return <CampVisitGift key={scene.id} scene={scene} seed={findVisitSeed(garden.favorites, scene)}
      disabled={toolsLocked || !ready} onOpenSource={onOpenVisitSource}
      onKeep={() => void keepVisitSeed(scene)} onChoose={chooseVisitPlot}/>;
  }

  function selectPlot(index: number, inspect = false) {
    if (toolsLocked) return;
    clearFeedback();
    setSlot(index);
    setSheet('plot');
    const item = garden.plants.find(candidate => candidate.slot === index);
    if (inspect) {
      setSeedId(null);
      setTool('hand');
      return;
    }
    if (tool !== 'hand') {
      if (!item) setError('这块田还没有种子。');
      else void perform({ action: tool, plantId: item.id }, index);
    } else if (!item && selectedSeed) onActivity('seed-select');
  }

  let instruction = '从信箱搜知乎，带回一个喜欢的发现。';
  if (tool === 'water') instruction = '已拿起水壶，点一块需要水的田。';
  else if (tool === 'fertilize') instruction = '已拿起肥料，点一块需要养分的田。';
  else if (tool === 'harvest') instruction = '已戴上手套，点一株开花的植物采种。';
  else if (isPreview) instruction = `${selectedPlot?.name} 已预览，确认后才会播种。`;
  else if (selectedSeed) instruction = '已选好种子，点一块空田预览。';
  else if (seeds.length) instruction = `种子箱里有 ${seeds.length} 颗种子，打开种子箱选择植物。`;
  else if (garden.plants.length) instruction = '点一块田查看植物，或翻开手账回顾发现。';

  function showSource(favorite: Favorite) {
    return <>
      <p className="camp-source-label">{sourceLabel(favorite)}</p>
      {!favorite.hidden && favorite.source && <SourceDetails source={favorite.source}/>}
      <div className="camp-sheet-actions">
        {!favorite.hidden && <button onClick={() => onOpenSource(favorite)}>{favorite.kind === 'zhihu_post' ? '打开知乎原文 ↗' : '打开知乎搜索 ↗'}</button>}
        {!favorite.hidden && bridge?.teachingStart&&<button disabled={busy||blocked} onClick={()=>onTeach(favorite.id)}>讲给看山听</button>}
        <button disabled={busy} onClick={() => void change(favorite, 'hide')}>{favorite.hidden ? '显示主题' : '隐藏主题'}</button>
      </div>
      <details className="camp-delete"><summary>删除选项</summary><p>删除收藏会一起移除对应种子或植物。</p>
        <button className="danger" disabled={busy} onClick={() => void change(favorite, 'delete')}>删除此收藏及关联种植</button>
      </details>
    </>;
  }

  const feedback = <>{notice && <p className="camp-notice" role="status">{notice}</p>}
   {celebrating&&!quiet&&!blocked&&<div className="camp-plant-sticker" role="img" aria-label="刘看山跳起庆祝播种成功">
    <StickerArt id="scarf_celebrate" preview autoplay/>
   </div>}{error && <p className="inline-error" role="alert">{error}</p>}</>;

  const varietyPicker = <label className="seed-variety-picker">选择要播的植物
    <select value={selectedVariety} onChange={event => setSelectedVariety(event.target.value as PlantVariety)}>
      {VARIETIES.map(variety => <option key={variety} value={variety}>{plantVarieties[variety]}</option>)}
    </select>
  </label>;

  const farm = layout.offset('farm');
  const bench = layout.offset('bench');
  const benchX = 117 + bench.x;
  // Use the lawn on whichever side leaves the pair room to stand together.
  const meetingX = Math.min(745, Math.max(155, benchX + (benchX < 225 ? 91 : -72)));
  const meetingY = Math.min(636, Math.max(264, 374 + bench.y));
  const meetingPosition = {
    '--stand-host-x': `${(meetingX - 40) / 9}%`,
    '--stand-guest-x': `${(meetingX + 40) / 9}%`,
    '--preferred-meeting-feet': `${meetingY / 7.4}%`,
    '--bench-host-x': `${(bench.x + BENCH_SEATS.host.x) / 9}%`,
    '--bench-guest-x': `${(bench.x + BENCH_SEATS.guest.x) / 9}%`,
    '--bench-host-feet': `${(bench.y + BENCH_SEATS.host.y) / 7.4}%`,
    '--bench-guest-feet': `${(bench.y + BENCH_SEATS.guest.y) / 7.4}%`,
    '--seated-guest-speech-tail': bench.x + BENCH_SEATS.guest.x > 750 ? '87%' : '21%',
    '--bench-approach-time': `${BENCH_APPROACH_MS}ms`,
  } as CSSProperties;
  const meeting = !layout.editing && visitVisible && ['offering', 'staying', 'leaving'].includes(visitStory.phase);
  const atBench = meeting || Boolean(seat);
  const seated = !!seat && !seat.approaching;
  const ownFox = <button className={`camp-prop camp-fox${atBench ? ' camp-meeting-host' : ''}`}
    {...(!atBench && layout.movable('fox'))} aria-label="和刘看山互动，可双击打开聊天"
    title="单击互动，双击打开聊天" disabled={toolsLocked}
    onClick={event => { if (!event.ctrlKey) petClicks.pick(event.detail); }}>
    {seated ? <BenchCompanion action={action} gesture={petClicks.gesture}/> : <Companion action={action} gesture={petClicks.gesture}/>}
  </button>;

  return <>
    <div className="camp-terrain" aria-hidden="true"/>
    <div className={layout.editing ? 'camp-layout-scene is-editing' : 'camp-layout-scene'}
      onPointerDownCapture={layout.start} onPointerMove={layout.move}
      onPointerUp={layout.end} onPointerCancel={layout.end} onLostPointerCapture={layout.end}
      onClickCapture={event=>{if(layout.editing){event.preventDefault();event.stopPropagation();}}}
      onKeyDownCapture={event=>{if(layout.editing&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.stopPropagation();}}}>
    <div ref={layout.map} className="camp-map" style={meetingPosition} aria-label="好奇心营地"
      data-bench-seated={seat ? true : undefined} data-bench-approach={seat?.approaching || undefined}>
      <div className="camp-rest-path" aria-hidden="true">
        {PATH_STONES.map(([left, top, width, angle]) =>
          <img key={left} data-layout-item={`stone-${left}`} src={stoneArt} alt="" draggable={false}
            style={{ ...layout.movable(`stone-${left}`).style, left: left + '%', top: top + '%', width: width + '%', transform: 'rotate(' + angle + 'deg)' }}/>)}
      </div>
      <button className="camp-prop camp-cabin" {...layout.movable('cabin')} aria-label="进入暖木小屋" disabled={toolsLocked} onClick={() => openExternal(onHome)}><PropArt src={cabinArt}/><span {...layout.movable('cabin-label')}>回家</span></button>
      <button className="camp-prop camp-seed" {...layout.movable('seed')} aria-label={`种子箱 · ${seeds.length}`} disabled={toolsLocked} onClick={openSeeds}><PropArt src={seedArt}/><span {...layout.movable('seed-label')}>种子箱 <b>{seeds.length}</b></span></button>
      <button className="camp-prop camp-water" {...layout.movable('water')} aria-label="拿起水壶" aria-pressed={tool === 'water'} disabled={toolsLocked} onClick={() => pickTool(tool === 'water' ? 'hand' : 'water')}><PropArt src={waterArt}/><span {...layout.movable('water-label')}>水壶</span></button>
      <button className="camp-prop camp-fertilizer" {...layout.movable('fertilizer')} aria-label="拿起肥料" aria-pressed={tool === 'fertilize'} disabled={toolsLocked} onClick={() => pickTool(tool === 'fertilize' ? 'hand' : 'fertilize')}><PropArt src={fertilizerArt}/><span {...layout.movable('fertilizer-label')}>肥料</span></button>
      <button className="camp-prop camp-glove" {...layout.movable('glove')} aria-label="拿起采种手套"
        aria-pressed={tool === 'harvest'} disabled={toolsLocked}
        onClick={() => pickTool(tool === 'harvest' ? 'hand' : 'harvest')}>
        <PropArt src={gloveArt}/><span {...layout.movable('glove-label')}>手套</span>
      </button>
      {ownFox}
      <button className="camp-prop camp-bench" type="button" {...layout.movable('bench')} aria-label="坐一会儿"
        aria-pressed={!!seat} title={seat ? '再点一次起身' : '坐到长椅上'} disabled={toolsLocked} onClick={toggleBench}>
        <PropArt src={benchArt}/><span {...layout.movable('bench-label')}>坐一会儿</span>
      </button>
      {!layout.editing && visitVisible && <CampVisit key={visitStory.round}
        story={visitStory} seated={seated} quiet={quiet} disabled={toolsLocked} favorites={garden.favorites} wornFoxOutfit={wornFoxOutfit}/>}
      <svg className={tool === 'harvest' && !layout.editing ? 'camp-farm is-harvesting' : 'camp-farm'} viewBox="0 0 900 740" role="group" aria-label="九块田">
        <g data-layout-item="farm" transform={`translate(${FARM_CENTER.x + FARM_OFFSET.x + farm.x} ${FARM_CENTER.y + FARM_OFFSET.y + farm.y}) scale(${FARM_SCALE}) translate(${-FARM_CENTER.x} ${-FARM_CENTER.y})`}>
          <g className="camp-soil-layer" aria-hidden="true">
            {plots.map(({ name, x, y, item }) => <image key={name} className={`camp-soil-art ${item && item.water >= 60 ? 'moist' : ''}`}
              href={soilArt} x={x - 66} y={y - 35} width="132" height="71" preserveAspectRatio="none"/>)}
          </g>
          {plots.map(({ index, name, x, y, item }) => {
            const preview = isPreview && index === slot;
            const target = selectedSeed ? !item : tool === 'water' ? Boolean(item && item.water < 80) : tool === 'fertilize' ? Boolean(item && item.nutrients < 80) : tool === 'harvest' && item?.stage === 'flower';
            const activeEffect = effect?.slot === index ? effect.action : '';
            const plotNotes = item?.favoriteId ? visitNotes.get(item.favoriteId) : undefined;
            return <g key={name} transform={`translate(${x} ${y})`} role="button" tabIndex={toolsLocked ? -1 : 0} aria-disabled={toolsLocked}
              aria-label={`${name} · ${item ? STAGES[item.stage] : '空田'}`} aria-pressed={index === slot}
              className={`camp-plot ${target ? 'target' : ''} ${slot === index ? 'active' : ''} ${preview ? 'preview' : ''} ${item && item.water >= 60 ? 'moist' : ''}`}
              onClick={() => selectPlot(index)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') {event.preventDefault();selectPlot(index);} }}>
              <path className="camp-soil" d={SOIL} transform="scale(.92)" fill="transparent"/>
              <path d={SOIL} transform="scale(.92)" className="camp-outline"/>
              {item && <Plant stage={item.stage} variety={item.variety}/>}
              {item?.stage === 'flower' && <g className="camp-harvest-cue" aria-hidden="true"><rect x="-17" y="-83" width="34" height="17" rx="8.5"/><text x="0" y="-71" textAnchor="middle">可摘</text></g>}
              {preview && <ellipse className="camp-seed-preview" cx="0" cy="-3" rx="6" ry="3.6" fill="#fbedaf" stroke="#765c38"/>}
              {item?.wateredAt && <path className="camp-water-mark" d="M23 17c7 9 4 10 0 10s-7-1 0-10" fill="#9ed9e6" stroke="#4c8792" strokeWidth=".7"/>}
              {item?.fertilizedAt && <path className="camp-fertilizer-mark" d="m-26 18 3 3-3 3-3-3zm-6 3 2 2-2 2-2-2z" fill="#f2d08a"/>}
              <rect className="camp-slot-plate" x="-15" y="17" width="30" height="15" rx="7.5"/>
              <text x="0" y="28" textAnchor="middle">{name}</text>
              {plotNotes && <g className="camp-visit-note-mark" aria-hidden="true">
                <rect x="-39" y="16" width="18" height="14" rx="4"/>
                <text x="-30" y="27" textAnchor="middle">{plotNotes.length}</text>
              </g>}
              {activeEffect && !quiet && <g className={`camp-plot-effect ${activeEffect}`} aria-hidden="true">{[-24, -12, 0, 12, 24].map((px, i) =>
                <g key={px} transform={`translate(${px} ${-17 - (i % 3) * 7})`}>
                  {activeEffect === 'water'
                    ? <path d="M0-5C3-1 4 1 3 3Q0 7-3 3C-4 1-3-1 0-5Z" style={{ animationDelay: i * 38 + 'ms' }}/>
                    : <circle r={1.5 + (i % 2)} style={{ animationDelay: i * 38 + 'ms' }}/>}
                </g>)}</g>}
            </g>;
          })}
        </g>
      </svg>
    </div>
    <button className="camp-prop camp-mail" {...layout.movable('mail')} disabled={toolsLocked}
      aria-label={visitMail ? '打开信箱，查看访客的菜' : undefined}
      aria-description={visitStory.unread ? '信箱里有访客送的菜' : hasClues ? '信箱里有线索' : undefined}
      onClick={openMailbox}>
      <PropArt src={hasClues || visitStory.unread ? openMailArt : mailArt}/>
      <span {...layout.movable('mail-label')}>投喂线索{visitStory.unread && <b className="visit-unread">新菜</b>}</span>
    </button>
    </div>
    <header className="camp-topbar"><div className={`camp-brand camp-title-board ${windowDrag.dragging?'is-dragging':''}`} title="按住标题牌拖动营地" {...windowDrag.bindings}>
        <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M2 25 13 6l5 9 4-5 8 15Z" fill="currentColor"/><path d="m9 13 4-7 4 7-4-2Z" fill="#fff1d0"/></svg>
        <div><h1>看山有伴</h1><small>刘看山的好奇心花园</small></div><span className="camp-grip" aria-hidden="true">⠿</span></div>
      <div className="camp-window-actions">
      {!layout.editing&&<button className="camp-layout-action" type="button" disabled={toolsLocked}
        onClick={()=>{close();setBenchSeat(null);layout.edit();}}>调整布局</button>}
      {layout.editing?<button className="camp-layout-action" type="button" onClick={layout.save}>固定位置</button>:<>
      <button className="camp-visit-entry" type="button" disabled={toolsLocked}
        title="看看下一次串门" onClick={openVisit}>串门</button>
      <button className="camp-album" type="button" disabled={toolsLocked} onClick={() => {clearFeedback();setSheet('album');}}>
        植物图册 · {garden.collected?.length ?? 0}/9
      </button>
      <button className="camp-journal" type="button" disabled={toolsLocked} onClick={() => {clearFeedback();setSheet('journal');}}>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 5.2c-2-1.6-4.5-2-7-1.4v10.7c2.5-.5 5-.1 7 1.5 2-1.6 4.5-2 7-1.5V3.8c-2.5-.6-5-.2-7 1.4v10.6"/>
        </svg>收藏手账
      </button><button className="camp-weather" type="button" onClick={onSnow} aria-label="营地飘雪" aria-pressed={snow} disabled={snowSaving} title={snow?'关闭飘雪':'开启飘雪'}><span aria-hidden="true">❄</span> 飘雪</button><button onClick={() => openExternal(onSettings)} aria-label="模型与检索设置" title="设置">⚙</button>
        <button onClick={onReturn} aria-label="收回桌面" title="收回桌面">↙</button></>}</div></header>
    {layout.editing?<div className="camp-bottom camp-layout-controls">
      <div className="camp-hint" role="status">{layout.saveError?'无法保存布局，请重试。':'拖动物件或标签。九块田会一起移动。'}</div>
      <div className="camp-tools"><button type="button" onClick={layout.reset}>恢复默认位置</button><button type="button" onClick={layout.cancel}>取消</button></div>
    </div>:<div className="camp-bottom"><div className="camp-hint" title={reason} aria-live="polite"><b>{error || notice || instruction}</b></div>
      <div className="camp-tools" aria-label="田间工具"><button aria-label="查看地块" aria-pressed={tool === 'hand' && !selectedSeed} disabled={toolsLocked} onClick={() => pickTool('hand')}>查看</button><button aria-label="打开种子箱" disabled={toolsLocked} onClick={openSeeds}>种子</button>
        <button aria-label="选择浇水工具" aria-pressed={tool === 'water'} disabled={toolsLocked} onClick={() => pickTool('water')}>浇水</button><button aria-label="选择施肥工具" aria-pressed={tool === 'fertilize'} disabled={toolsLocked} onClick={() => pickTool('fertilize')}>施肥</button>
        <button aria-label="选择采种手套" aria-pressed={tool === 'harvest'} disabled={toolsLocked} onClick={() => pickTool('harvest')}>采种</button></div></div>}
    {sheet === 'visit-mail' && visitMail && <CampSheet title="访客带来的菜" detail="营地信箱" side="reading" onClose={close}
      footer={<button onClick={() => openExternal(onFeed)}>继续投喂或搜索</button>}>
      {visitGift(visitMail)}{feedback}
    </CampSheet>}
    {sheet === 'seed' && <CampSheet title="怎么播种" detail="种子箱" side="left" onClose={close} busy={busy}>
      <FeatureGuide feature="seeds"/>
      {seeds.length ? <p>已获得 {seeds.length} 颗种子。选择植物后可播种到第一块空田。</p> :
        <><p>先去山洞收藏一个发现，或收下访客的菜后留种。</p><button onClick={() => openExternal(onCave)}>去山洞探索</button></>}
      {nextSeed && firstEmptyPlot && <>{varietyPicker}
        <button className="primary" disabled={toolsLocked || !ready} onClick={() => plantSeed(nextSeed, firstEmptyPlot.index)}>
          播种{plantVarieties[selectedVariety]}
        </button>
      </>}
      {!firstEmptyPlot && <p>九块田都已种满，种子继续留在这里。</p>}{feedback}
    </CampSheet>}
    {sheet === 'plot' && selectedPlot && <CampSheet title={plotHeading} detail="九田花园" side={plantNotes ? 'reading' : undefined}
      onClose={close} busy={busy}
      footer={isPreview ? <><button onClick={() => {setSeedId(null);clearFeedback();}} disabled={busy}>取消预览</button>
        <button className="primary" disabled={toolsLocked || !ready} onClick={() => selectedSeed && plantSeed(selectedSeed, selectedPlot.index)}>确认播种</button></> : undefined}>
      {plant&&<FeatureGuide feature="plot"/>}
      {isPreview && selectedSeed ? <><p>将「{title(selectedSeed)}」种在这里。确认后才会使用种子。</p>{varietyPicker}</> : plant ?
        <><strong>{plantFavorite ? title(plantFavorite) : plantVarieties[plant.variety]}</strong>
          <p className="camp-plant-variety">品种 · {plantVarieties[plant.variety]}</p>
          <div className="camp-meters">
            <label>水分 <meter min="0" max="100" value={plant.water}/><span>{Math.round(plant.water)}%</span></label>
            <label>养分 <meter min="0" max="100" value={plant.nutrients}/><span>{Math.round(plant.nutrients)}%</span></label>
            <label>成长 <progress max="100" value={plant.growth}/><span>{Math.round(plant.growth)}%</span></label>
          </div><p>{plant.wateredAt && plant.fertilizedAt ? '照料已完成，可以慢慢生长。' : '亲手浇水、施肥后开始成长。'}</p>
          <button disabled={busy} onClick={() => setSheet('journal')}>去手账看来源</button>
          {plantNotes && <CampVisitNotes entries={plantNotes} onOpenSource={onOpenVisitSource}/>}</> :
        <><p>这块田空着。打开种子箱选择要播的植物。</p><button disabled={toolsLocked} onClick={openSeeds}>打开种子箱</button></>}{feedback}
    </CampSheet>}
    {sheet === 'album' && <CampSheet title="植物图册" detail="采摘植物，逐一收集" side="reading" onClose={close} busy={busy}>
      <div className="plant-album">{ALBUM.map(([id,name,nickname])=>{const lit=garden.collected?.includes(id);return <article className={`plant-album-card ${lit?'is-lit':'is-locked'}`} key={id}><span className="plant-album-mark" aria-hidden="true">{lit?<svg viewBox="-40 -75 80 82"><Plant stage="flower" variety={id}/></svg>:'？'}</span><strong>{lit?name:'未发现'}</strong><small>{lit?nickname:'成熟后点击采摘'}</small></article>;})}</div>
    </CampSheet>}
    {sheet === 'journal' && <CampSheet title="收藏手账" side="reading" onClose={close} busy={busy}>
      <FeatureGuide feature="journal"/>
      <div className="teaching-actions" role="group" aria-label="手账分类">
        <button aria-pressed={journalTab==='favorites'} onClick={()=>setJournalTab('favorites')}>收藏</button>
        <button aria-pressed={journalTab==='teaching'} onClick={()=>{setLessonId(undefined);setJournalTab('teaching');}}>你教给我的</button>
        {visitMail && <button aria-pressed={journalTab==='visit'}
          onClick={()=>{setJournalTab('visit');visitStory.read();}}>串门收获</button>}
      </div>
      {journalTab==='teaching'?<TeachingJournal target={lessonId} favorites={garden.favorites} onFavorite={onFavorite} onConversation={onTeachingConversation}/>:
      journalTab==='visit'&&visitMail?<>{visitStory.entries.map(visitGift)}{feedback}</>:
      <div ref={journalBody}>
      {garden.favorites.length === 0 && <p>山洞里收藏的发现会收进这里。</p>}{feedback}
      {garden.favorites.map(favorite => <article className="camp-journal-entry" key={favorite.id} data-favorite-id={favorite.id}>
        <h3>{title(favorite)}</h3>{showSource(favorite)}
        {favorite.slot !== null ? <button disabled={busy} onClick={() => selectPlot(favorite.slot!,true)}>回到这块田 · {SLOTS[favorite.slot].name}</button> :
          <p>待播种 · 种子在箱子里</p>}
      </article>)}
      </div>}
    </CampSheet>}
  </>;
}
