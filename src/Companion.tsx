import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {defaultMotion,type ActorMotion} from './ActorAnimation';
import { idleFrame, loadOutfitAction, type Outfit } from './outfits';
import classicSit from './assets/companion/act_sit/act_sit_006.png';
import foxSit from './assets/camp/seated/host.webp';
import coldFoxSit from './assets/camp/seated/host-cold.webp';
import { seatedCostumeArt } from './camp-seat-art';
import {AppearanceArt} from './PetAppearance';
import type {PetAppearance,WeatherLook,HumanWeather,WindowPose,CheekPose,ListeningStatus} from './types';
import type {PetGesture} from './usePetClicks';
import {preloadFoxMovement} from './FoxMotionArt';
import {ClassicWardrobeArt} from './ClassicWardrobeArt';

type Appearance = { appearance?: PetAppearance; outfit?: Outfit; sleeping: boolean; frame?: string; motion:ActorMotion; daydream?:boolean; weather?:WeatherLook; caveOutfit?:string|null; humanWeather?:HumanWeather|null; weatherUnlocked?:boolean; windowPose?:WindowPose; motionEnabled?:boolean };
const AppearanceContext = createContext<Appearance>({ sleeping: false,motion:defaultMotion });

export function CompanionProvider({ appearance, outfit: selectedOutfit, sleeping, action, enabled, cue, motion=defaultMotion, motionEnabled=true, stillIdle=false, daydream, weather,caveOutfit,humanWeather,weatherUnlocked,windowPose, children, onError }: {
 appearance?: PetAppearance; outfit?: Outfit; sleeping: boolean; action: string; enabled: boolean; cue: number; motion?:ActorMotion; motionEnabled?:boolean; stillIdle?:boolean; daydream?:boolean; weather?:WeatherLook;caveOutfit?:string|null;humanWeather?:HumanWeather|null;weatherUnlocked?:boolean;windowPose?:WindowPose; children: ReactNode; onError: (message: string) => void;
}) {
 const custom=appearance==='human'||appearance==='fox';
 const outfit=custom?undefined:selectedOutfit;
 const [playing, setPlaying] = useState<{ outfitId: string; name: string; cue: number; frame: string }>();
 const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
 const idleStill=stillIdle&&motion.clip==='act_idle';
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
  if (appearance === 'fox') preloadFoxMovement(clothing, glasses,caveOutfit??
   (weatherUnlocked&&weather?.umbrella?'rain':undefined));
 }, [appearance, clothing, glasses, caveOutfit, weather?.umbrella, weatherUnlocked]);

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
 return <AppearanceContext.Provider value={{ appearance, outfit, sleeping, frame, motion, daydream,weather,caveOutfit,humanWeather,weatherUnlocked,windowPose,motionEnabled:enabled&&motionEnabled&&!reduced }}>{children}</AppearanceContext.Provider>;
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

export function Companion({ paper = false,gesture,cheek,faceEnabled,listening,liftScale }: { action?: string; liftScale?:number; paper?: boolean;gesture?:PetGesture;cheek?:CheekPose;faceEnabled?:boolean;listening?:ListeningStatus }) {
 const { appearance, outfit, sleeping, frame, motion, daydream,weather,caveOutfit,humanWeather,weatherUnlocked,windowPose,motionEnabled } = useContext(AppearanceContext);
 if (sleeping && !outfit?.actions.sleep) return <RestingBlanket outfitId={outfit?.id}/>;
 if (appearance==='human'||appearance==='fox') return <AppearanceArt appearance={appearance} motion={motion} motionEnabled={motionEnabled}
  liftScale={liftScale} windowPose={windowPose} daydream={daydream} weather={weather} caveOutfit={caveOutfit} humanWeather={humanWeather} weatherUnlocked={weatherUnlocked} gesture={gesture} cheek={cheek} faceEnabled={faceEnabled} listening={listening}/>;
 return <ClassicWardrobeArt id={outfit?.id} motion={motion} windowPose={windowPose} gesture={gesture}
  animate={motionEnabled} weather={weather} raincoat={!outfit&&weatherUnlocked&&weather?.umbrella} frame={outfit?(frame??idleFrame(outfit)):undefined}
  showcase={Boolean(outfit&&frame&&frame!==idleFrame(outfit))} paper={paper}/>;
}

export function BenchCompanion({ action, gesture, inCave = false }: { action: string; gesture?: PetGesture; inCave?: boolean }) {
 const { appearance, outfit, weather, caveOutfit } = useContext(AppearanceContext);
 if (appearance === 'fox' || inCave) {
  const worn = appearance === 'fox' ? caveOutfit : undefined;
  const cold = worn === 'winter';
  const wardrobeArt = !cold && weather?.clothing !== 'hot' ? seatedCostumeArt(worn) : undefined;
  if (cold || wardrobeArt || !worn || inCave) return <img className="camp-seated-host-art" draggable={false}
   data-mirrored={Boolean(wardrobeArt) || undefined} data-pet-appearance="fox"
   data-cave-outfit={wardrobeArt ? worn : undefined} src={cold ? coldFoxSit : wardrobeArt || foxSit} alt=""/>;
 } else if (appearance !== 'human' && (!outfit || outfit.id === 'default')) {
  return <img className="camp-seated-host-art camp-seated-classic" draggable={false} src={classicSit} alt=""/>;
 }
 return <span className="camp-seated-host-art camp-seated-fallback"><Companion action={action} gesture={gesture}/></span>;
}
