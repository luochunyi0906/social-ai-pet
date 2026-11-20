import { useEffect, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { BenchCompanion, Companion } from './Companion';
import { Icon } from './HotIcon';
import { useWindowDrag } from './windowDrag';
import { unwrap, type HotCache, type WeatherStatus } from './types';
import {
  accessLoungeRecords, emptyLoungeRecords, loungeDate, loungeSamples, normalizeClue, readLoungeFile,
  type LoungeAnchor, type LoungeDiary, type LoungeRecords, type LoungeReference, type LoungeSource,
} from './cave-lounge-data';
import hearth from './assets/cave/lounge/hearth.webp';
import summer from './assets/cave/lounge/summer.webp';
import './cave-lounge.css';

const places = {
  chat: { name: '围炉角', label: '聊天', icon: 'chat' },
  search: { name: '寻物台', label: '查找', icon: 'search' },
  discovery: { name: '洞口信包', label: '新发现', icon: 'parcel' },
  memory: { name: '记忆墙', label: '记忆', icon: 'memory' },
  diary: { name: '日记桌', label: '日记', icon: 'diary' },
  library: { name: '资料架', label: '文档', icon: 'book' },
} as const;
type Zone = keyof typeof places;
type PlaceIcon = typeof places[Zone]['icon'] | 'news' | 'flame' | 'snow';
const zones = Object.keys(places) as Zone[];
const modeLabels = { talk: '可以来聊聊', work: '工作中', quiet: '勿扰' } as const;
type LoungeMode = keyof typeof modeLabels;
type Reader = { id: string; page: number };
type View = { zone: Zone; newspaper?: boolean; reader?: Reader; diary?: string };
type Turn = { id: string; text: string; reply: string; reference?: LoungeReference };
type SearchKind = 'library' | 'memory' | 'diary' | 'discovery';
type Match = { kind: SearchKind; id: string; title: string; why: string; page?: number; anchorId?: string };
type LoungeSeason = 'hearth' | 'summer';
const coolingTemperature = 28;
type Props = {
  action: string;
  weather?: WeatherStatus;
  visible: boolean;
  onBack: () => void;
  onCompact: () => void;
  onHot: () => void;
  onChat: () => void;
};
const prefs = {
  mode: 'kanshan-secret-base-mode',
  positions: 'kanshan-secret-base-reading',
};
function readSetting(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeSetting(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* The current visit can still continue. */ }
}
function readPositions(): Record<string, number> {
  try { return JSON.parse(readSetting(prefs.positions) ?? '{}') ?? {}; } catch { return {}; }
}
function Mark({ name }: { name: PlaceIcon }) {
  if (name === 'chat') return <Icon name="chat"/>;
  const paths: Record<Exclude<PlaceIcon, 'chat'>, ReactNode> = {
    search: <><circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4 4"/></>,
    parcel: <><rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4.5 7 7.5 5 7.5-5"/></>,
    memory: <><path d="M6 5h12v13h-6l-4 3v-3H6z"/><path d="M9 9h6m-6 4h4"/></>,
    diary: <><path d="M6 4h13v16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2 0v16m3-11h5m-5 4h5"/></>,
    book: <><path d="M12 6C9 4 6 4 3.5 5v13c3-1 5.5-1 8.5 1 3-2 5.5-2 8.5-1V5C18 4 15 4 12 6zm0 0v13"/></>,
    news: <><path d="M5 5h14v14H6a2 2 0 0 1-2-2V8m4 0h7m-3 4h4m-4 3h4"/><rect x="7.5" y="11" width="2" height="4" rx=".3"/></>,
    flame: <path d="M12 3c1 5-3 5-3 9-2-1-2-3-2-3-2 3-3 5-1 8 2.5 4 9 4 12 0 2-3 0-7-2-9 .4 3-1 4-1 4 0-4-2-7-3-9Z"/>,
    snow: <path d="M12 3v18M4 7.5l16 9M4 16.5l16-9M9 5l3 2 3-2m-6 14 3-2 3 2M5 10.5l3-1.2V6m8 12v-3.3l3-1.2M5 13.5l3 1.2V18m8-12v3.3l3 1.2"/>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function CaveLounge({ action, weather, visible, onBack, onCompact, onHot, onChat }: Props) {
  const [seasonOverride, setSeasonOverride] = useState<LoungeSeason | null>(null);
  const temperature = weather?.observation?.feels ?? weather?.observation?.temperature;
  const weatherSeason: LoungeSeason = temperature !== undefined && temperature >= coolingTemperature ? 'summer' : 'hearth';
  const season = seasonOverride ?? weatherSeason;
  const [mode, setMode] = useState<LoungeMode>(() => {
    const saved = readSetting(prefs.mode);
    return saved === 'work' || saved === 'quiet' ? saved : 'talk';
  });
  const [view, setView] = useState<View>({ zone: 'chat' });
  const [popupOpen, setPopupOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [records, setRecords] = useState<LoungeRecords>(emptyLoungeRecords);
  const [loaded, setLoaded] = useState(false);
  const [temporary, setTemporary] = useState<LoungeSource[]>([]);
  const [heldFile, setHeldFile] = useState<File>();
  const [readingFile, setReadingFile] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [chatDrafts, setChatDrafts] = useState<Record<string, string>>({});
  const [topic, setTopic] = useState<LoungeReference>();
  const [queryText, setQueryText] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | SearchKind>('all');
  const [diaryDrafts, setDiaryDrafts] = useState<Record<string, LoungeDiary>>({});
  const [headline, setHeadline] = useState<HotCache | null>();
  const [notice, setNotice] = useState('');
  const [problem, setProblem] = useState('');
  const [delivering, setDelivering] = useState(false);
  const [confirmation, setConfirmation] = useState<{ title: string; description: string; commit: () => Promise<void> }>();
  const openingFile = useRef(false);
  const committing = useRef(false);
  const delivery = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = useRef(false);
  const currentMode = useRef(mode);
  currentMode.current = mode;
  const isVisible = useRef(visible);
  isVisible.current = visible;
  const history = useRef<View[]>([]);
  const recentView = useRef<Partial<Record<Zone, View>>>({});
  const readingPositions = useRef(readPositions());
  const excerpt = useRef('');
  const panel = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const readerText = useRef<HTMLParagraphElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const lookup = useRef<HTMLInputElement>(null);
  const modal = useRef<HTMLDialogElement>(null);
  const navTrigger = useRef<HTMLElement | null>(null);
  const scrollToChat = useRef(false);
  const drag = useWindowDrag('panel');

  useEffect(() => {
    active.current = true;
    void accessLoungeRecords().then(value => {
      if (active.current) { setRecords(value); setLoaded(true); }
    }).catch(() => {
      if (active.current) setProblem('无法打开本机保存区。可以继续试读，保存操作需重试。');
    });
    return () => { active.current = false; clearTimeout(delivery.current); };
  }, []);

  useEffect(() => {
    if (!visible || !popupOpen || !view.newspaper || !window.kanshan) return;
    let cancelled = false;
    void unwrap(window.kanshan.hotOpen()).then(hot => {
      if (!cancelled) setHeadline(hot.cache);
    }).catch(() => { if (!cancelled) setHeadline(null); });
    return () => { cancelled = true; };
  }, [visible, popupOpen, view.newspaper]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 3800);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (scrollToChat.current && view.zone === 'chat') {
      body.current?.scrollTo({ top: body.current.scrollHeight });
      scrollToChat.current = false;
    } else {
      body.current?.scrollTo({ top: 0 });
    }
    excerpt.current = '';
  }, [view, turns]);
  useEffect(() => {
    const dialog = panel.current;
    if (!dialog) return;
    if (popupOpen && visible && !dialog.open) dialog.showModal();
    if ((!popupOpen || !visible) && dialog.open) dialog.close();
  }, [popupOpen, visible]);
  useEffect(() => {
    if (confirmation) modal.current?.showModal();
  }, [confirmation]);

  const sources = new Map<string, LoungeSource>([
    ...loungeSamples.map(({ source }) => [source.id, source] as const),
    ...records.sources.map(source => [source.id, source] as const),
    ...temporary.map(item => [item.id, item] as const),
  ]);
  const pending = loungeSamples.filter(({ source }, index) => (index === 0 || records.delivered)
    && !records.returned.includes(source.id) && !records.kept.some(item => item.sourceId === source.id));
  const reader = view.reader;
  const source = reader && sources.get(reader.id);
  const page = reader && source?.pages[reader.page];
  const storedDiary = records.diaries.find(item => item.id === view.diary);
  const diary = view.diary ? diaryDrafts[view.diary] ?? storedDiary : undefined;
  const diaryAnchor = records.anchors.find(anchor => anchor.id === diary?.anchorId);
  const focusedSource = topic && sources.get(topic.sourceId);
  const chatKey = topic ? JSON.stringify(topic) : 'chat';
  const chatText = chatDrafts[chatKey] ?? '';
  function setChatText(text: string) {
    setChatDrafts(previous => ({ ...previous, [chatKey]: text }));
  }
  function setDiaryDraft(entry: LoungeDiary) {
    setDiaryDrafts(previous => ({ ...previous, [entry.id]: entry }));
  }

  function activate(next: View) {
    setView(next);
    setPopupOpen(true);
    setExpanded(false);
    setProblem('');
    if (next.reader) excerpt.current = '';
  }
  function closePopup() {
    recentView.current[view.zone] = view;
    history.current = [];
    setPopupOpen(false);
    setExpanded(false);
    requestAnimationFrame(() => navTrigger.current?.focus({ preventScroll: true }));
  }
  function travel(next: View) {
    if (popupOpen) {
      history.current.push(view);
      recentView.current[view.zone] = view;
    }
    activate(next);
  }
  function goBack() {
    if (expanded) { setExpanded(false); return; }
    const earlier = history.current.pop();
    if (earlier) {
      recentView.current[view.zone] = view;
      activate(earlier);
    } else {
      closePopup();
    }
  }
  function zone(id: Zone) {
    if (!popupOpen) {
      const previous = recentView.current[id];
      activate(previous?.newspaper ? { zone: id } : previous ?? { zone: id });
    } else if (id !== view.zone || view.reader || view.diary || view.newspaper) {
      travel(id === view.zone ? { zone: id } : recentView.current[id] ?? { zone: id });
    }
  }
  function chooseNewspaper() {
    if (!popupOpen || !view.newspaper) travel({ zone: 'discovery', newspaper: true });
  }
  function rememberPosition(reference: Reader) {
    readingPositions.current[reference.id] = reference.page;
    if (records.kept.some(item => item.sourceId === reference.id)) {
      writeSetting(prefs.positions, JSON.stringify(readingPositions.current));
    }
  }
  function openReader(id: string, targetZone: Zone, position?: number) {
    const item = sources.get(id);
    if (!item) return;
    const current = records.kept.find(kept => kept.sourceId === id);
    const reference = { id, page: Math.min(item.pages.length - 1, Math.max(0, position ?? readingPositions.current[id] ?? current?.page ?? 0)) };
    rememberPosition(reference);
    travel({ zone: targetZone, reader: reference });
  }
  function movePage(position: number) {
    if (!reader || !source || position < 0 || position >= source.pages.length) return;
    const next = { ...reader, page: position };
    rememberPosition(next);
    setView({ ...view, reader: next });
  }
  function pickExcerpt() {
    const selection = window.getSelection();
    if (selection?.anchorNode && selection.focusNode && readerText.current?.contains(selection.anchorNode)
      && readerText.current.contains(selection.focusNode)) {
      excerpt.current = selection.toString().trim().slice(0, 1200);
    }
  }
  function discuss() {
    if (!reader) return;
    setTopic({ sourceId: reader.id, page: reader.page, excerpt: excerpt.current || undefined });
    travel({ zone: 'chat' });
  }
  async function changeRecords(update: (latest: LoungeRecords) => LoungeRecords, success?: string | (() => string | undefined)) {
    if (committing.current) return false;
    committing.current = true;
    setProblem('');
    try {
      const latest = await accessLoungeRecords(update);
      if (active.current) {
        setRecords(latest);
        setLoaded(true);
        const message = typeof success === 'function' ? success() : success;
        if (message) setNotice(message);
      }
      return true;
    } catch {
      if (active.current) setProblem('本机保存没有完成，当前内容还在，可以重试。');
      return false;
    } finally {
      committing.current = false;
    }
  }
  function saveSource(item: LoungeSource, position: number) {
    void changeRecords(latest => ({
      ...latest,
      sources: item.sample || latest.sources.some(record => record.id === item.id) ? latest.sources : [...latest.sources, item],
      kept: latest.kept.some(record => record.sourceId === item.id) ? latest.kept : [{ sourceId: item.id, page: position }, ...latest.kept],
    }), '已收进资料架。');
  }
  function returnSample(item: LoungeSource) {
    void changeRecords(latest => ({ ...latest, returned: Array.from(new Set([...latest.returned, item.id])) }), '已放回这份发现。');
  }
  function deliverSample() {
    if (mode !== 'talk' || delivering || records.delivered || !loaded) return;
    setDelivering(true);
    delivery.current = setTimeout(() => {
      void changeRecords(latest => ({ ...latest, delivered: true }), () =>
        currentMode.current === 'talk' && isVisible.current && !document.hidden ? '洞口多了一份待看的信包。' : undefined).finally(() => {
        if (active.current) setDelivering(false);
      });
    }, 650);
  }
  function stageFile(file?: File) {
    if (!file || openingFile.current) return;
    setHeldFile(file);
    travel({ zone: 'library' });
  }
  function receiveDrop(event: DragEvent) {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.files.length === 1) stageFile(event.dataTransfer.files[0]);
    else setProblem('请每次递入一份文件。');
  }
  async function openFile() {
    if (!heldFile || openingFile.current) return;
    openingFile.current = true;
    setReadingFile(true);
    setProblem('');
    try {
      const item = await readLoungeFile(heldFile);
      if (!active.current) return;
      setTemporary(items => [item, ...items.filter(other => other.id !== item.id)]);
      setHeldFile(undefined);
      const saved = records.kept.find(entry => entry.sourceId === item.id);
      const position = Math.min(item.pages.length - 1, readingPositions.current[item.id] ?? saved?.page ?? 0);
      travel({ zone: 'library', reader: { id: item.id, page: position } });
    } catch (error) {
      if (active.current) setProblem(error instanceof Error ? error.message : '这份文件暂时无法打开。');
    } finally {
      openingFile.current = false;
      if (active.current) setReadingFile(false);
    }
  }
  function send(event: FormEvent) {
    event.preventDefault();
    const text = chatText.trim();
    if (!text) return;
    const reply = focusedSource
      ? '我把这句话放在《' + focusedSource.title + '》的对话旁。想日后找回时，可以点「留成记忆」。'
      : '这件事可以慢慢聊。要是有一份资料想一起看，从书架或洞口打开它，再点「和看山聊聊」。';
    scrollToChat.current = true;
    setTurns(previous => [...previous, { id: crypto.randomUUID(), text, reply, reference: topic }]);
    setChatText('');
  }
  function remember(turn: Turn) {
    if (!turn.reference) return;
    const reference = turn.reference;
    const item = sources.get(reference.sourceId);
    if (!item) { setProblem('请先重新打开这份资料。'); return; }
    void changeRecords(latest => ({
      ...latest,
      sources: item.sample || latest.sources.some(record => record.id === item.id) ? latest.sources : [...latest.sources, item],
      anchors: latest.anchors.some(anchor => anchor.id === turn.id) ? latest.anchors :
        [{ id: turn.id, reference, quote: turn.text, createdAt: Date.now() }, ...latest.anchors],
    }), '已留下你的原话和当时的位置。');
  }
  function beginDiary(anchor?: LoungeAnchor) {
    const item = anchor && sources.get(anchor.reference.sourceId);
    const location = item && anchor && item.pages[anchor.reference.page]?.label;
    const id = crypto.randomUUID();
    setDiaryDraft({
      id, title: item ? '读《' + item.title + '》' : '',
      draft: anchor && item && location ? '这次读到了《' + item.title + '》的' + location + '。我想留下的是：' + anchor.quote : '',
      note: '', anchorId: anchor?.id ?? null, updatedAt: Date.now(),
    });
    travel({ zone: 'diary', diary: id });
  }
  function editDiary(item: LoungeDiary) {
    travel({ zone: 'diary', diary: item.id });
  }
  function saveDiary(event: FormEvent, item: LoungeDiary) {
    event.preventDefault();
    if (!item.title.trim() || !(item.draft.trim() || item.note.trim())) return;
    const entry = { ...item, title: item.title.trim(), updatedAt: Date.now() };
    void changeRecords(latest => ({
      ...latest, diaries: [entry, ...latest.diaries.filter(other => other.id !== item.id)],
    }), '已保存日记。');
  }
  function removeAnchor(anchor: LoungeAnchor) {
    const linked = records.diaries.filter(entry => entry.anchorId === anchor.id);
    setConfirmation({
      title: '移除这条记忆',
      description: linked.length
        ? '以下日记会失去回看这条记忆的入口，日记文字会保留。' + linked.map(entry => '《' + entry.title + '》').join('、')
        : '会移除这条原话及其位置关联。',
      commit: async () => {
        if (await changeRecords(latest => {
          const anchors = latest.anchors.filter(item => item.id !== anchor.id);
          const sourceId = anchor.reference.sourceId;
          const stillUsed = latest.kept.some(item => item.sourceId === sourceId) || anchors.some(item => item.reference.sourceId === sourceId);
          return {
            ...latest, anchors,
            sources: stillUsed ? latest.sources : latest.sources.filter(item => item.id !== sourceId),
            diaries: latest.diaries.map(item => item.anchorId === anchor.id ? { ...item, anchorId: null } : item),
          };
        }, '已移除这条记忆。')) {
          setDiaryDrafts(drafts => Object.fromEntries(Object.entries(drafts).map(([id, draft]) => [
            id, draft.anchorId === anchor.id ? { ...draft, anchorId: null } : draft,
          ])));
          setConfirmation(undefined);
        }
      },
    });
  }
  function removeSource(item: LoungeSource) {
    const linked = records.anchors.filter(anchor => anchor.reference.sourceId === item.id);
    setConfirmation({
      title: '移出资料架',
      description: linked.length ? '这份资料仍有记忆引用，相关原文可从记忆墙回看。' : '这份资料将从资料架和查找结果移除。',
      commit: async () => {
        if (await changeRecords(latest => ({
          ...latest,
          kept: latest.kept.filter(entry => entry.sourceId !== item.id),
          returned: item.sample ? Array.from(new Set([...latest.returned, item.id])) : latest.returned,
          sources: latest.anchors.some(anchor => anchor.reference.sourceId === item.id) ?
            latest.sources : latest.sources.filter(entry => entry.id !== item.id),
        }), '已移出资料架。')) {
          activate({ zone: 'library' });
          setConfirmation(undefined);
        }
      },
    });
  }
  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setQuery(queryText.trim());
  }

  const matches: Match[] = [];
  if (query) {
    const normalized = normalizeClue(query);
    const includes = (value: string) => normalizeClue(value).includes(normalized);
    const items = [
      ...records.kept.flatMap(entry => {
        const item = sources.get(entry.sourceId);
        return item ? [{ item, kind: 'library' as const }] : [];
      }),
      ...(filter === 'discovery' ? pending.map(({ source: item }) => ({ item, kind: 'discovery' as const })) : []),
    ];
    for (const { item, kind } of items) {
      const match = item.pages.findIndex(itemPage => includes(itemPage.text));
      if (match >= 0 || includes(item.title) || includes(item.credit)) {
        matches.push({ kind, id: item.id, title: item.title, why: match >= 0 ? '原文 · ' + item.pages[match].label :
          includes(item.title) ? '标题' : '来源', page: match >= 0 ? match : undefined });
      }
    }
    for (const anchor of records.anchors) {
      if (includes(anchor.quote)) {
        matches.push({ kind: 'memory', id: anchor.reference.sourceId, anchorId: anchor.id, title: anchor.quote,
          why: '你的原话 · ' + (sources.get(anchor.reference.sourceId)?.pages[anchor.reference.page]?.label ?? '原文位置'),
          page: anchor.reference.page });
      }
    }
    for (const entry of records.diaries) {
      if ([entry.title, entry.draft, entry.note].some(includes)) {
        matches.push({ kind: 'diary', id: entry.id, title: entry.title,
          why: includes(entry.title) ? '标题' : includes(entry.note) ? '你的补充' : '日记正文' });
      }
    }
  }
  const shownMatches = matches.filter(match => filter === 'all' || match.kind === filter);
  const chatPlace = season === 'summer' ? '摇椅角' : '围炉角';
  const label = view.newspaper ? '茶几报纸' : view.zone === 'chat' ? chatPlace : places[view.zone].name;
  const zoneIcon = view.newspaper ? 'news' : places[view.zone].icon;
  const keepCurrent = source && records.kept.some(item => item.sourceId === source.id);
  const canExpand = !!(source || diary);
  const sceneImage = season === 'summer' ? summer : hearth;
  const selectHotspot = (id: Zone) => (event: React.MouseEvent<HTMLButtonElement>) => {
    navTrigger.current = event.currentTarget;
    zone(id);
  };
  const seeLibrary = () => travel({ zone: 'library' });

  return <section className="lounge-screen" aria-label="秘密基地" data-season={season}
    onDragEnter={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.stopPropagation(); } }}
    onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy'; } }}
    onDragLeave={event => event.stopPropagation()} onDrop={receiveDrop}
    onKeyDown={event => {
      if (event.key === 'Escape' && popupOpen) event.stopPropagation();
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !confirmation) {
        event.preventDefault();
        zone('search');
        requestAnimationFrame(() => lookup.current?.focus());
      }
    }}>
    <div className="lounge-ambient" aria-hidden="true" style={{ backgroundImage: 'url(' + sceneImage + ')' }}/>
    <div className="lounge-map" aria-label={season === 'summer' ? '夏日空调山洞' : '围炉山洞'}>
      <img src={sceneImage} draggable={false} alt={season === 'summer' ?
        '开着空调的山洞，石地上摆着竹藤摇椅，茶几上有凉茶和报纸' : '烧着壁炉的山洞，躺椅旁摆着热茶和报纸'}/>
      <div className="lounge-map-companion" aria-hidden="true"><BenchCompanion inCave action={mode === 'talk' ? action : 'idle'}/></div>
      <button className="lounge-pin lounge-pin-memory" type="button" aria-pressed={popupOpen && view.zone === 'memory'} onClick={selectHotspot('memory')}><span>记忆墙</span></button>
      <button className="lounge-pin lounge-pin-search" type="button" aria-pressed={popupOpen && view.zone === 'search'} onClick={selectHotspot('search')}><span>寻物台</span></button>
      <button className="lounge-pin lounge-pin-chat" type="button" aria-pressed={popupOpen && view.zone === 'chat'} onClick={selectHotspot('chat')}><span>{chatPlace}</span></button>
      <button className="lounge-pin lounge-pin-news" type="button" aria-pressed={popupOpen && !!view.newspaper} onClick={event => { navTrigger.current = event.currentTarget; chooseNewspaper(); }}><span><Mark name="news"/>热点报纸</span></button>
      <button className="lounge-pin lounge-pin-library" type="button" aria-pressed={popupOpen && view.zone === 'library'} onClick={selectHotspot('library')}><span>资料架</span></button>
      <button className="lounge-pin lounge-pin-diary" type="button" aria-pressed={popupOpen && view.zone === 'diary'} onClick={selectHotspot('diary')}><span>日记桌</span></button>
      <button className="lounge-pin lounge-pin-discovery" type="button" aria-pressed={popupOpen && view.zone === 'discovery' && !view.newspaper} onClick={event => { navTrigger.current = event.currentTarget; travel({ zone: 'discovery' }); }}>
        <span>洞口信包{pending.length > 0 && <b>{pending.length}</b>}</span>
      </button>
      {records.kept.length > 0 && <button className="lounge-pin lounge-pin-kept" type="button" onClick={event => { navTrigger.current = event.currentTarget; seeLibrary(); }}><span>藏品纸角 <b>{records.kept.length}</b></span></button>}
    </div>
    <header className="lounge-top">
      <div className={'camp-title-board lounge-brand' + (drag.dragging ? ' is-dragging' : '')}
        title="拖动秘密基地窗口" {...drag.bindings}>
        <Icon name="mountain"/><div><h1>秘密基地</h1><small>看山有伴</small></div><span className="camp-grip" aria-hidden="true">⠿</span>
      </div>
      <div className="lounge-window-tools">
        <button className="lounge-outline lounge-find" type="button" onClick={event => { navTrigger.current = event.currentTarget; zone('search'); }}><Mark name="search"/>查找</button>
        <label className="lounge-mode" data-mode={mode}>
          <span aria-hidden="true"/>
          <select aria-label="陪读状态" value={mode} onChange={event => {
            const value = event.target.value as LoungeMode;
            currentMode.current = value;
            setMode(value);
            writeSetting(prefs.mode, value);
            if (value !== 'talk') setNotice('');
          }}>
            {Object.entries(modeLabels).map(([value, name]) => <option key={value} value={value}>{name}</option>)}
          </select>
        </label>
        <button className="lounge-outline" type="button" onClick={onBack}>探索桌</button>
        <button className="lounge-icon-button" type="button" aria-label="收回桌面" title="收回桌面" onClick={onCompact}><Icon name="shrink"/></button>
      </div>
    </header>
    <div className="lounge-bottom">
      <details className="lounge-directory">
        <summary>全部区域</summary>
        <nav className="lounge-places" aria-label="全部区域">
          {zones.map(id => <button key={id} type="button" onClick={event => {
            const directory = event.currentTarget.closest('details');
            navTrigger.current = directory?.querySelector('summary') ?? null;
            if (directory) directory.open = false;
            zone(id);
          }}>
            <Mark name={places[id].icon}/><span><strong>{places[id].label}</strong><small>{id === 'chat' ? chatPlace : places[id].name}</small></span>
            {id === 'discovery' && pending.length > 0 && <b>{pending.length}</b>}
          </button>)}
        </nav>
      </details>
      <div className="lounge-seasons" aria-label="场景季节">
        <button type="button" aria-pressed={seasonOverride === null} onClick={() => setSeasonOverride(null)}
          title={temperature === undefined ? '暂无气温，默认围炉' : `当前${weather?.observation?.feels !== undefined ? '体感' : '气温'} ${temperature}°C`}>随天气</button>
        <button type="button" aria-pressed={seasonOverride === 'hearth'} onClick={() => setSeasonOverride('hearth')}><Mark name="flame"/>围炉</button>
        <button type="button" aria-pressed={seasonOverride === 'summer'} onClick={() => setSeasonOverride('summer')}><Mark name="snow"/>夏日空调</button>
      </div>
    </div>

    <dialog ref={panel} className={'lounge-panel' + (expanded ? ' lounge-panel-expanded' : '')} aria-labelledby="lounge-panel-title"
      onCancel={event => { event.preventDefault(); closePopup(); }}
      onClick={event => { if (event.target === event.currentTarget) {
        const box = event.currentTarget.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closePopup();
      } }}>
      <header className="lounge-panel-head">
        <span className="lounge-panel-icon"><Mark name={zoneIcon}/></span>
        <div><h2 id="lounge-panel-title">{label}</h2><small>{view.zone === 'chat' ? '对话演示 · 本机' : view.newspaper ? '热点与来源' : places[view.zone].label}</small></div>
        <div className="lounge-panel-tools">
          {view.zone === 'chat' && <button type="button" onClick={onChat}>应用聊天</button>}
          {canExpand && <button type="button" onClick={() => setExpanded(value => !value)}>{expanded ? '收起' : '展开'}</button>}
          {history.current.length > 0 && <button type="button" onClick={goBack} aria-label="返回上一项" title="返回上一项"><Icon name="back"/></button>}
          <button type="button" onClick={closePopup} aria-label="关闭弹窗" title="关闭弹窗">×</button>
        </div>
      </header>
      {problem && <p className="lounge-alert" role="alert">{problem}</p>}
      <div className="lounge-panel-body" ref={body}>
        {view.zone === 'chat' && <>
          <div className="lounge-companion-message">
            <span className="lounge-avatar" aria-hidden="true"><Companion action="idle"/></span>
            <div><strong>刘看山</strong><p>{season === 'hearth' ? '来坐坐吧，茶刚泡好。' : '进来坐坐，凉茶已经备好。'}想说说手头的事，还是看看洞口的信包？</p></div>
          </div>
          {!turns.length && !topic && <div className="lounge-quick">
            <button type="button" onClick={() => travel({ zone: 'discovery' })}><Mark name="parcel"/>看看带回的资料</button>
            <button type="button" onClick={chooseNewspaper}><Mark name="news"/>翻一翻报纸</button>
          </div>}
          {turns.map(turn => {
            const target = turn.reference && sources.get(turn.reference.sourceId);
            const location = turn.reference && target?.pages[turn.reference.page]?.label;
            const remembered = records.anchors.some(anchor => anchor.id === turn.id);
            return <div className="lounge-turn" key={turn.id}>
              <article className="lounge-own-message">
                {target && <small>{target.title} · {location}</small>}
                <p>{turn.text}</p>
                {turn.reference && <button type="button" disabled={remembered} onClick={() => remember(turn)}>{remembered ? '已留下原话' : '留成记忆'}</button>}
              </article>
              <div className="lounge-companion-message">
                <span className="lounge-avatar" aria-hidden="true"><Companion action="idle"/></span>
                <div><strong>刘看山</strong><p>{turn.reply}</p></div>
              </div>
            </div>;
          })}
        </>}
        {view.zone === 'discovery' && !reader && <>
          <div className="lounge-tabs" aria-label="发现来源">
            <button type="button" aria-pressed={!view.newspaper} onClick={() => { if (view.newspaper) travel({ zone: 'discovery' }); }}>洞口信包</button>
            <button type="button" aria-pressed={!!view.newspaper} onClick={chooseNewspaper}>茶几报纸</button>
          </div>
          {view.newspaper ? <div className="lounge-newspaper">
            <div className="lounge-newspaper-title"><Mark name="news"/><h3>知乎热榜</h3></div>
            <p>{headline ? '知乎缓存 · ' + loungeDate(Date.parse(headline.retrievedAt)) : '打开热榜查看知乎当前可用的热点和来源。'}</p>
            {headline?.items.slice(0, 3).map(item => <article key={item.id}><span>{item.rank}</span><strong>{item.title}</strong></article>)}
            <button className="lounge-primary" type="button" onClick={onHot}>打开知乎热榜</button>
          </div> : <>
            <p className="lounge-muted">{pending.length ? pending.length + ' 份待看。打开试读后可以再决定收不收。' : '洞口暂时没有待看的信包。'}</p>
            {pending.map(({ source: item, reason }) => <article className="lounge-card" key={item.id}>
              <small>{item.credit}</small><h3>{item.title}</h3><p>{reason}</p>
              <div className="lounge-actions">
                <button className="lounge-primary" type="button" onClick={() => openReader(item.id, 'discovery')}>先看看</button>
                <button type="button" onClick={() => saveSource(item, 0)}>收下</button>
                <button type="button" onClick={() => returnSample(item)}>放回去</button>
              </div>
            </article>)}
            {!records.delivered && <button className="lounge-outline" type="button" onClick={deliverSample}
              disabled={!loaded || mode !== 'talk' || delivering}>{delivering ? '信包在路上…' : '演示带回一份'}</button>}
            {mode !== 'talk' && <p className="lounge-muted">当前只响应你主动打开的内容。</p>}
          </>}
        </>}
        {view.zone === 'search' && <>
          <form className="lounge-lookup" onSubmit={submitSearch} role="search">
            <Mark name="search"/>
            <input autoFocus type="search" ref={lookup} aria-label="查找基地资料" placeholder="找资料、原话或日记" value={queryText} maxLength={160} onChange={event => setQueryText(event.target.value)}/>
            <button type="submit" disabled={!queryText.trim()}>查找</button>
          </form>
          <div className="lounge-tabs lounge-search-tabs" aria-label="查找范围">
            {([['all', '全部'], ['library', '文档'], ['memory', '记忆'], ['diary', '日记'], ['discovery', '待看']] as const)
              .map(([id, name]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{name}</button>)}
          </div>
          <p className="lounge-muted">{query ? '「' + query + '」· ' + shownMatches.length + ' 条关键词匹配' :
            '在上方输入标题、原文或你说过的话。'}</p>
          {query && !shownMatches.length && <p className="lounge-empty">这里没有匹配。可以换一个词，或切到「待看」找洞口信包。</p>}
          {shownMatches.map(match => <article className="lounge-card" key={[match.kind, match.anchorId ?? match.id].join('/')}>
            <small>{match.kind === 'discovery' ? '待看' : places[match.kind].label} · {match.why}</small><h3>{match.title}</h3>
            <button className="lounge-outline" type="button" onClick={() => {
              if (match.kind === 'diary') {
                const item = records.diaries.find(entry => entry.id === match.id);
                if (item) editDiary(item);
              } else {
                openReader(match.id, match.kind === 'discovery' ? 'discovery' : 'library', match.page);
              }
            }}>{match.kind === 'diary' ? '打开日记' : '回到原文'}</button>
          </article>)}
        </>}
        {view.zone === 'library' && !reader && <>
          <div className="lounge-actions">
            <button className="lounge-primary" type="button" onClick={() => fileInput.current?.click()} disabled={readingFile}>打开本机文件</button>
          </div>
          <p className="lounge-muted">也可拖入 PDF、TXT 或 Markdown。点「收进资料架」后会保存在这台设备。</p>
          {heldFile && <article className="lounge-card">
            <small>本次阅读授权</small><h3>{heldFile.name}</h3><p>打开后可读文件中的文字和位置。</p>
            <div className="lounge-actions">
              <button className="lounge-primary" type="button" disabled={readingFile} onClick={() => void openFile()}>{readingFile ? '读取中…' : '同意在本机打开'}</button>
              <button type="button" disabled={readingFile} onClick={() => setHeldFile(undefined)}>取消</button>
            </div>
          </article>}
          {!records.kept.length && <p className="lounge-empty">书架留着空位。从洞口收下资料，或打开自己的文件。</p>}
          {records.kept.map(item => {
            const document = sources.get(item.sourceId);
            if (!document) return null;
            return <article className="lounge-card" key={item.sourceId}>
              <small>{document.credit}</small><h3>{document.title}</h3>
              <button className="lounge-outline" type="button" onClick={() => openReader(item.sourceId, 'library')}>继续阅读</button>
            </article>;
          })}
        </>}
        {source && reader && page && <article className="lounge-reader">
          <small>{source.credit}</small><h3>{source.title}</h3>
          <div className="lounge-page-controls">
            <button type="button" disabled={reader.page === 0} onClick={() => movePage(reader.page - 1)}>上一处</button>
            <strong>{page.label}</strong>
            <button type="button" disabled={reader.page === source.pages.length - 1} onClick={() => movePage(reader.page + 1)}>下一处</button>
          </div>
          <p className="lounge-original" ref={readerText} onMouseUp={pickExcerpt} onKeyUp={pickExcerpt}
            tabIndex={0}>{page.text || '这一页没有可提取的文字。'}</p>
          <div className="lounge-actions">
            <button className="lounge-primary" type="button" onClick={discuss}>和看山聊聊</button>
            <button type="button" disabled={keepCurrent} onClick={() => saveSource(source, reader.page)}>{keepCurrent ? '已在资料架' : '收进资料架'}</button>
            {keepCurrent && <button type="button" onClick={() => removeSource(source)}>移出</button>}
          </div>
        </article>}
        {view.zone === 'memory' && <>
          <p className="lounge-muted">从原文发起对话，留下你想找回的原话。</p>
          {!records.anchors.length && <p className="lounge-empty">记忆墙还没有纸条。</p>}
          {records.anchors.map(anchor => {
            const item = sources.get(anchor.reference.sourceId);
            return <article className="lounge-card" key={anchor.id}>
              <small>{loungeDate(anchor.createdAt)} · 你的原话</small><blockquote>{anchor.quote}</blockquote>
              <details>
                <summary>怎么记住的</summary>
                <p>{item?.title ?? '原文位置不可用'}{item && ' · ' + (item.pages[anchor.reference.page]?.label ?? '')}</p>
                <small>{item?.credit} · 由你手动保存到本机</small>
                {anchor.reference.excerpt && <blockquote>{anchor.reference.excerpt}</blockquote>}
              </details>
              <div className="lounge-actions">
                {item && <button type="button" onClick={() => openReader(item.id, 'library', anchor.reference.page)}>回到当时</button>}
                <button type="button" onClick={() => beginDiary(anchor)}>整理这次经历</button>
                <button type="button" onClick={() => removeAnchor(anchor)}>移除</button>
              </div>
            </article>;
          })}
        </>}
        {view.zone === 'diary' && (diary ? <form className="lounge-diary-form" onSubmit={event => saveDiary(event, diary)}>
          <label>日记标题<input maxLength={120} value={diary.title} onChange={event => setDiaryDraft({ ...diary, title: event.target.value })}/></label>
          {diaryAnchor && <div className="lounge-diary-source">
            <span>引用的原话</span><blockquote>{diaryAnchor.quote}</blockquote>
            <button type="button" className="lounge-outline" onClick={() => openReader(diaryAnchor.reference.sourceId, 'library', diaryAnchor.reference.page)}>回到引用位置</button>
          </div>}
          {diary.draft && !diaryAnchor && <p className="lounge-muted">这段整理没有可回看的关联记忆。</p>}
          {(diaryAnchor || diary.draft) && <label>整理稿 · 本地模板<textarea rows={4} value={diary.draft}
            onChange={event => setDiaryDraft({ ...diary, draft: event.target.value })}/></label>}
          <label>我的补充<textarea rows={4} placeholder="写下自己的笔记" value={diary.note}
            onChange={event => setDiaryDraft({ ...diary, note: event.target.value })}/></label>
          <button className="lounge-primary" type="submit" disabled={!diary.title.trim() || !(diary.draft.trim() || diary.note.trim())}>保存日记</button>
        </form> : <>
          <button className="lounge-primary" type="button" onClick={() => beginDiary()}>写一篇</button>
          <p className="lounge-muted">从记忆墙整理一段经历，或写下自己的笔记。</p>
          {!records.diaries.length && <p className="lounge-empty">今天的日记本还是空的。</p>}
          {records.diaries.map(item => <article className="lounge-card" key={item.id}>
            <small>{loungeDate(item.updatedAt)}</small><h3>{item.title}</h3>
            <button className="lounge-outline" type="button" onClick={() => editDiary(item)}>打开日记</button>
          </article>)}
        </>)}
      </div>
      {view.zone === 'chat' && <form className="lounge-compose" onSubmit={send}>
        {focusedSource && topic && <div className="lounge-topic">
          <span>正在聊 · {focusedSource.title} · {focusedSource.pages[topic.page]?.label}
            {topic.excerpt && <q className="lounge-topic-excerpt" title={topic.excerpt}>{topic.excerpt}</q>}
          </span>
          <button type="button" aria-label="清除对话资料" onClick={() => setTopic(undefined)}>×</button>
        </div>}
        <div className="lounge-compose-row">
          <textarea rows={2} value={chatText} maxLength={3000} aria-label="跟刘看山说点什么" placeholder="跟刘看山说点什么…" onChange={event => setChatText(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault(); event.currentTarget.form?.requestSubmit();
              }
            }}/>
          <button className="lounge-primary" type="submit" disabled={!chatText.trim()}>发送</button>
        </div>
      </form>}
      {popupOpen && notice && <p className="lounge-toast" role="status">{notice}</p>}
    </dialog>
    <input hidden ref={fileInput} type="file" accept=".pdf,.txt,.md,.markdown" onChange={event => {
      stageFile(event.target.files?.[0]); event.target.value = '';
    }}/>
    {!popupOpen && notice && <p className="lounge-toast lounge-scene-toast" role="status">{notice}</p>}
    {confirmation && <dialog ref={modal} className="lounge-confirm" aria-labelledby="lounge-confirm-title"
      onCancel={event => { event.preventDefault(); setConfirmation(undefined); }}>
      <h2 id="lounge-confirm-title">{confirmation.title}</h2><p>{confirmation.description}</p>
      {problem && <p className="lounge-alert" role="alert">{problem}</p>}
      <div className="lounge-actions">
        <button type="button" autoFocus onClick={() => setConfirmation(undefined)}>取消</button>
        <button className="lounge-primary" type="button" onClick={() => void confirmation.commit()}>确认移除</button>
      </div>
    </dialog>}
  </section>;
}
