import { createContext, useContext, useEffect, useId, useState, type ReactNode } from 'react';
import { Fox } from './Fox';
import {defaultMotion,useCompanionFrame,type ActorMotion} from './ActorAnimation';
import { assetUrl, idleFrame, loadOutfitAction, outfitPlacement, type Outfit } from './outfits';
import walkCycle from './assets/companion/act_walk/act_walk.gif?url&no-inline';
import {AppearanceArt} from './PetAppearance';
import type {PetAppearance,WeatherLook,WindowPose} from './types';
import type {PetGesture} from './usePetClicks';
import {WeatherArt} from './WeatherArt';
import {preloadFoxMovement} from './FoxMotionArt';

type Appearance = { appearance?: PetAppearance; outfit?: Outfit; sleeping: boolean; frame?: string; motion:ActorMotion; sprite?:ReturnType<typeof useCompanionFrame>; idleStill?:boolean; walkingGif?:boolean; daydream?:boolean; weather?:WeatherLook; caveOutfit?:string|null; windowPose?:WindowPose; motionEnabled?:boolean };
const AppearanceContext = createContext<Appearance>({ sleeping: false,motion:defaultMotion });

export function CompanionProvider({ appearance, outfit: selectedOutfit, sleeping, action, enabled, cue, motion=defaultMotion, motionEnabled=true, stillIdle=false, walkingGif=false, preloadBase=false, daydream, weather,caveOutfit,windowPose, children, onError }: {
 appearance?: PetAppearance; outfit?: Outfit; sleeping: boolean; action: string; enabled: boolean; cue: number; motion?:ActorMotion; motionEnabled?:boolean; stillIdle?:boolean; walkingGif?:boolean; preloadBase?:boolean; daydream?:boolean; weather?:WeatherLook;caveOutfit?:string|null;windowPose?:WindowPose; children: ReactNode; onError: (message: string) => void;
}) {
 const custom=appearance==='human'||appearance==='fox';
 const outfit=custom?undefined:selectedOutfit;
 const [playing, setPlaying] = useState<{ outfitId: string; name: string; cue: number; frame: string }>();
 const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
 const idleStill=stillIdle&&motion.clip==='act_idle';
 const playGif=walkingGif&&motion.clip==='act_walk'&&motionEnabled&&enabled&&!sleeping&&!outfit&&!custom&&!reduced;
 const sprite=useCompanionFrame(sleeping||motion.clip==='act_sleep'?defaultMotion:motion,motionEnabled&&!outfit&&!custom&&!sleeping&&!idleStill&&!playGif,reduced,preloadBase&&!custom);
 const name = outfit && (sleeping ? (outfit.actions.sleep ? 'sleep' : undefined) :
  enabled && !reduced && !idleStill ? outfit.triggers[action] : undefined);

 useEffect(() => {
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const listener = () => setReduced(preference.matches);
  preference.addEventListener('change', listener);
  return () => preference.removeEventListener('change', listener);
 }, []);
 const clothing = weather?.clothing;
 const glasses = weather?.glasses && !weather.umbrella;
 useEffect(() => {
  if (appearance === 'fox') preloadFoxMovement(clothing, glasses);
 }, [appearance, clothing, glasses]);

 useEffect(() => {
  if (!outfit || !name || reduced || !enabled) return;
  const sequence = outfit.actions[name];
  let timer = 0;
  let live = true;

  void loadOutfitAction(outfit, name).then(() => {
   if (!live) return;
   const started = performance.now();
   let previous = -1;
   function draw() {
    const index = Math.floor((performance.now() - started) * sequence.fps / 1000);
    if (sequence.loop === 'once' && index >= sequence.frames.length) {
     const finish = outfit!.actions[sequence.finish];
     setPlaying({ outfitId: outfit!.id, name: name!, cue, frame: finish.frames[0] });
     return;
    }
    const current = sequence.loop === 'repeat' ? index % sequence.frames.length : Math.min(index, sequence.frames.length - 1);
    if (previous !== current) {
     previous = current;
     setPlaying({ outfitId: outfit!.id, name: name!, cue, frame: sequence.frames[current] });
    }
    if (sequence.loop !== 'hold' || current < sequence.frames.length - 1) timer = requestAnimationFrame(draw);
   }
   draw();
  }).catch(() => {
   if (live) onError(`「${outfit.name}」的动作素材暂不可用，保留当前装扮。`);
  });
  return () => { live = false; cancelAnimationFrame(timer); };
 }, [outfit, name, cue, onError, reduced, enabled]);

 let frame: string | undefined;
 if (outfit && name && enabled && !reduced && playing?.outfitId === outfit.id && playing?.name === name && playing.cue === cue) frame = playing.frame;
 if (outfit && sleeping && outfit.actions.sleep && !frame) frame = outfit.actions.sleep.frames[0];
 return <AppearanceContext.Provider value={{ appearance, outfit, sleeping, frame, motion, sprite, idleStill, walkingGif:playGif, daydream,weather,caveOutfit,windowPose,motionEnabled:enabled&&motionEnabled&&!reduced }}>{children}</AppearanceContext.Provider>;
}

export function CostumeArt({ outfit, frame = idleFrame(outfit), preview, cleanPreview, onError,weather }: {
 outfit: Outfit; frame?: string; preview?: string; cleanPreview?: boolean; onError?: () => void;weather?:WeatherLook;
}) {
 const matteId = useId();
 const trim = cleanPreview ? (outfit.previewEdgeTrim ?? 0) * outfit.scale : 0;
 const { x, y } = outfitPlacement(outfit);
 const transform = `translate(${x},${y}) scale(${outfit.scale})`;
 return <svg className="fox fox-costume" viewBox="0 0 240 310" role="img" aria-label={`刘看山 · ${outfit.name}`}
  data-outfit-id={outfit.id} data-outfit-frame={frame}>
  {trim > 0 && <defs>
   <filter id={matteId} x="0%" y="0%" width="100%" height="100%">
    <feComponentTransfer in="SourceAlpha">
     <feFuncA type="linear" slope="1.8" intercept="-.8"/>
    </feComponentTransfer>
    <feMorphology operator="erode" radius={trim}/>
    <feGaussianBlur stdDeviation={trim / 3} result="cleanMatte"/>
    <feComposite in="SourceGraphic" in2="cleanMatte" operator="in"/>
   </filter>
  </defs>}
  <ellipse cx="120" cy="293" rx="67" ry="8" fill="#2b352a" opacity=".19"/>
  <image href={preview ?? assetUrl(outfit, frame)} onError={onError} x={x} y={y}
   width={outfit.canvas.width*outfit.scale} height={outfit.canvas.height*outfit.scale}
   filter={trim > 0 ? `url(#${matteId})` : undefined}/>
  <path className="fox-costume-hit" d={outfit.hitPath} transform={transform} fill="transparent" aria-hidden="true"/>
  <WeatherArt look={weather}/>
 </svg>;
}

export function RestingBlanket({ outfitId = 'default' }: { outfitId?: string }) {
 return <svg className="fox fox-sleep" viewBox="0 0 240 310" role="img" aria-label="刘看山正在被窝里休息" data-outfit-id={outfitId}
  data-animation="act_sleep" data-animation-stage="hold" data-animation-pose="sleep_hold" data-rendering="legacy-blanket">
  <ellipse cx="120" cy="286" rx="94" ry="13" fill="#27302a" opacity=".22"/>
  <path d="M38 250q3-27 35-29l94 1q32 1 37 28l-5 35H38z" fill="#966c49" stroke="#604530" strokeWidth="3"/>
  <path d="M46 248q0-36 31-38 22 0 28 23l-7 24H48z" fill="#faf0dc" stroke="#c1a987" strokeWidth="2"/>
  <path d="M64 250q14-28 45-31 31-13 62 2l22 18q18 19 5 41H49q-6-14 15-30z" fill="#83936d" stroke="#4c5d46" strokeWidth="3"/>
  <path d="M82 243q-13 16-16 32m52-50q-12 19-11 50m44-55q-6 19-2 55m31-43q4 16 6 42M65 255q50 11 130 0" fill="none" stroke="#c7ce9e" strokeWidth="2.2" opacity=".82"/>
  <path d="M110 194q13 6 22-3m11-12q10 4 16-3" stroke="#d9be86" strokeWidth="4" fill="none" strokeLinecap="round"/>
  <path d="M167 165h14l-14 14h14m8-40h10l-10 11h10" stroke="#faf0c7" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
 </svg>;
}

function SpriteArt({motion,sprite,paper,walkingGif,weather}:{
 motion:ActorMotion;sprite?:Appearance['sprite'];paper:boolean;walkingGif?:boolean;weather?:WeatherLook;
}) {
 const sitting=motion.clip==='emo_thinking'||(motion.clip==='act_sit'&&(sprite?.index??0)>=3);
 const hit=sitting?'M44 289L53 134 70 76Q118 57 158 83L202 125 211 289Z':
  'M44 281L52 156 55 88 76 39 148 43 186 73 206 131 195 232 178 292 64 292Z';
 const facing=motion.facing==='left'?'translate(240 0) scale(-1 1)':undefined;
 return <svg className="fox fox-animation" viewBox="0 0 240 310" role="img"
  aria-label="刘看山" data-outfit-id="default" data-animation={motion.clip}
  data-animation-stage={motion.stage} data-animation-frame={!walkingGif&&sprite ? sprite.index+1 : undefined} data-animation-facing={motion.facing}
  data-animation-format={walkingGif?'gif':undefined}
  data-animation-pose={motion.stage==='hold'?'sit_hold':undefined}>
  <image href={walkingGif?walkCycle:sprite?.url} x={-37.44} y={3.64} width={314.88} height={314.88} transform={facing} pointerEvents="none"/>
  {paper&&<rect x="135" y="160" width="44" height="33" rx="4" fill="#e7d6ac" stroke="#8a785a" strokeWidth="3"/>}
  <g transform={facing}><WeatherArt look={weather}/></g>
  <path className="fox-nose fox-animation-hit" d={hit} transform={facing} fill="transparent" aria-hidden="true"/>
 </svg>;
}

export function Companion({ action = 'observe', paper = false,gesture }: { action?: string; paper?: boolean;gesture?:PetGesture }) {
 const { appearance, outfit, sleeping, frame, motion, sprite, idleStill, walkingGif, daydream,weather,caveOutfit,windowPose,motionEnabled } = useContext(AppearanceContext);
 if (sleeping && !outfit?.actions.sleep) return <RestingBlanket outfitId={outfit?.id}/>;
 if (appearance==='human'||appearance==='fox') return <AppearanceArt appearance={appearance} motion={motion} motionEnabled={motionEnabled}
  windowPose={windowPose} daydream={daydream} weather={weather} caveOutfit={caveOutfit} gesture={gesture}/>;
 if(windowPose) return <Fox action="window" windowPose={windowPose} weather={weather}/>;
 if(gesture&&!outfit) return <Fox action="gesture" gesture={gesture} weather={weather}/>;
 if (!outfit&&(sprite||walkingGif)&&motion.clip!=='act_sleep') return <SpriteArt motion={motion} sprite={sprite} paper={paper} walkingGif={walkingGif} weather={weather}/>;
 return outfit ? <CostumeArt outfit={outfit} frame={frame} weather={weather}/> : <Fox action={idleStill?'still':action} paper={paper} weather={weather}/>;
}
