import type {ActorMotion} from './ActorAnimation';
import type {WindowPose} from './types';
import {dropTime} from '../desktop/window-drop.mjs';
import {smooth} from './shared/locomotion.mjs';

export type CostumePose='stand'|'walk'|'run'|'climb'|'pull'|'perch'|'fall'|'land';
export function windowCrouch(pose:CostumePose,time:number){
 if(pose==='perch')return 1;
 if(pose==='fall')return 1-smooth((time-65)/(dropTime.fall-125));
 return 0;
}

export function costumePose(motion?:ActorMotion,windowPose?:WindowPose):CostumePose{
 switch(windowPose?.phase){
  case 'approach':return 'walk';
  case 'climb':return 'climb';
  case 'pull':return 'pull';
  case 'balance':return windowPose.release?.from??'perch';
  case 'perch':return 'perch';
  case 'fall':return 'fall';
  case 'land':return 'land';
 }
 return motion?.clip==='act_run'?'run':motion?.clip==='act_walk'?'walk':'stand';
}
