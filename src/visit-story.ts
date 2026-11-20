import { useCallback, useEffect, useState } from 'react';
import type { Favorite } from './types';

export type VisitPhase = 'offering' | 'staying' | 'leaving' | 'away';

const topics = {
  tofu: { label: '豆腐脑吃甜还是吃咸', seed: '为什么不同地方的豆腐脑口味差这么多？', keywords: '豆腐脑 甜咸 地方口味' },
  fox: { label: '北极狐怎么过冬', seed: '北极狐有哪些办法熬过冬天？', keywords: '北极狐 越冬 适应' },
};

const visitors = {
  lan: { name: '阿岚的看山' },
  he: { name: '小禾的看山' },
};

type VisitorId = keyof typeof visitors;
export type VisitTopicId = keyof typeof topics;
export type VisitScene = {
  id: string; visitor: VisitorId; topic: VisitTopicId; mood: '拌嘴' | '讨论';
  title: string; url: string; guestLine: string; reply: string; followUp: string; closingLine: string;
};

const scenes: readonly VisitScene[] = [
  {
    id: 'tofu-hello', visitor: 'lan', topic: 'tofu', mood: '拌嘴',
    title: '甜咸豆腐脑之争，你站哪边？',
    url: 'https://www.zhihu.com/answer/3224467451',
    guestLine: '豆腐脑淋糖水，才是我从小吃的那一碗！',
    reply: '可我就想要一勺热卤，放点榨菜才香！',
    followUp: '那你先别动勺！我拿半碗跟你换。',
    closingLine: '成交，我给你留一勺卤！',
  },
  {
    id: 'tofu-again', visitor: 'lan', topic: 'tofu', mood: '讨论',
    title: '为什么大家还在争豆腐脑的甜咸？',
    url: 'https://www.zhihu.com/answer/3623724661',
    guestLine: '上回甜咸还没争完。我又找到一篇，有人两种口味都吃。',
    reply: '那我们顺着各地的习惯再看看，说不定是不同的吃法。',
    followUp: '下次串门，我记得带上两种调料。',
    closingLine: '那我提前洗好两只碗。',
  },
  {
    id: 'fox-hello', visitor: 'he', topic: 'fox', mood: '讨论',
    title: '比北极熊娇小的北极狐，为什么能长期生活在北极？',
    url: 'https://www.zhihu.com/question/586758033/answer/2916132178',
    guestLine: '一起查查吧。北极狐那么小，冬天靠什么保暖？',
    reply: '我也好奇。先从它的毛和住处找找线索。',
    followUp: '好呀，回头把找到的线索记进手账。',
    closingLine: '我先记下「冬天的狐狸窝」。',
  },
];

export function visitTopic(scene: VisitScene) { return topics[scene.topic]; }
export function visitName(scene: VisitScene) { return visitors[scene.visitor].name; }

export function findVisitSeed(favorites: Favorite[], scene: VisitScene) {
  const topic = visitTopic(scene);
  return favorites.find(item => item.kind === 'generated_question' && item.title === topic.seed);
}

type Relation = { encounters: number; affinity: number };
type VisitMemory = { received: string[]; unread: boolean; relations: Record<VisitorId, Relation> };
type VisitState = { round: number; phase: VisitPhase; met: boolean; shared: boolean; memory: VisitMemory };

const storageKey = 'kanshan:camp-visit-story:v1';
const emptyRelation = { encounters: 0, affinity: 0 };
const emptyMemory: VisitMemory = { received: [], unread: false, relations: { lan: emptyRelation, he: emptyRelation } };

function readMemory(): VisitMemory {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Partial<VisitMemory> | null;
    if (!saved || !Array.isArray(saved.received)) return emptyMemory;
    const received = [...new Set(saved.received.filter(id => scenes.some(scene => scene.id === id)))];
    const relation = (id: VisitorId) => {
      const value = saved.relations?.[id];
      if (!value || !Number.isSafeInteger(value.affinity) || !Number.isSafeInteger(value.encounters)) return emptyRelation;
      return { affinity: Math.max(0, Math.min(100, value.affinity)), encounters: Math.max(0, value.encounters) };
    };
    return { received, unread: received.length > 0 && saved.unread === true, relations: { lan: relation('lan'), he: relation('he') } };
  } catch {
    return emptyMemory;
  }
}

const sceneFor = (round: number) => scenes[round % scenes.length];
const affinityLabel = (value: number) => value >= 3 ? '熟面孔' : value >= 1 ? '聊得来' : '刚认识';

export function useVisitStory() {
  const [state, setState] = useState<VisitState>(() => ({
    round: 0, phase: 'offering', met: false, shared: false, memory: readMemory(),
  }));
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(state.memory)); }
    catch { /* The visit remains usable in memory if local storage is unavailable. */ }
  }, [state.memory]);
  useEffect(() => {
    if (state.phase !== 'leaving') return;
    const timer = setTimeout(() => setState(current => current.phase === 'leaving' ? {...current,phase:'away'} : current), 1450);
    return () => clearTimeout(timer);
  }, [state.phase, state.round]);

  const scene = sceneFor(state.round);
  const related = state.memory.relations[scene.visitor];
  const entries = state.memory.received.flatMap(id => {
    const entry = scenes.find(value => value.id === id);
    return entry ? [entry] : [];
  });
  const meet = useCallback(() => setState(current => {
    if (current.met || current.phase !== 'offering') return current;
    const visitor = sceneFor(current.round).visitor;
    const relation = current.memory.relations[visitor];
    const next = { encounters: relation.encounters + 1, affinity: Math.min(100, relation.affinity + Number(relation.encounters > 0)) };
    return {...current, met: true, memory: {...current.memory, relations: {...current.memory.relations, [visitor]: next}}};
  }), []);

  return {
    round: state.round, phase: state.phase, scene, entries, unread: state.memory.unread,
    affinity: related.affinity, affinityLabel: affinityLabel(related.affinity),
    meet,
    share: () => setState(current => {
      if (current.shared || !['offering', 'staying'].includes(current.phase)) return current;
      const visitor = sceneFor(current.round).visitor;
      const relation = current.memory.relations[visitor];
      return {...current, shared: true, memory: {...current.memory, relations: {
        ...current.memory.relations, [visitor]: {...relation, affinity: Math.min(100, relation.affinity + 1)},
      }}};
    }),
    answer: (accept: boolean) => setState(current => {
      if (current.phase !== 'offering') return current;
      if (!accept) return {...current, phase: 'leaving'};
      const id = sceneFor(current.round).id;
      const memory = current.memory;
      return {...current, phase: 'staying', memory: memory.received.includes(id) ? memory : {
        ...memory, received: [...memory.received, id], unread: true,
      }};
    }),
    next: () => setState(current => ({...current, round: current.round + 1, phase: 'offering', met: false, shared: false})),
    read: () => setState(current => current.memory.unread ? {...current,memory:{...current.memory,unread:false}} : current),
  };
}

export type VisitStory = ReturnType<typeof useVisitStory>;
