import registry from '../assets/companion/registry.json' with {type:'json'};

const clips=registry.clips;
function duration(clip,range){
 return (range[1]-range[0]+1)*1000/clips[clip].fps;
}

export function initialAnimation(now=Date.now()){
 return {mode:'normal',modeAt:now,waitingSince:null,requests:{},feedback:null};
}

export function animationEvent(state,event){
 const {at}=event;
 switch(event.type){
 case 'mode':
  if(state.mode===event.mode)return state;
  return {...state,mode:event.mode,modeAt:at,feedback:null};
 case 'begin':
  if(state.requests[event.scope]===event.id)return state;
  return {...state,requests:{...state.requests,[event.scope]:event.id},
   waitingSince:state.waitingSince??at,feedback:null};
 case 'end': {
  if(state.requests[event.scope]!==event.id)return state;
  const requests={...state.requests};
  delete requests[event.scope];
  return {...state,requests,waitingSince:Object.keys(requests).length?state.waitingSince:null};
 }
 case 'feedback':
  if(state.mode!=='normal'||state.waitingSince!==null)return state;
  return {...state,feedback:{clip:event.clip,at}};
 case 'clear-feedback':
  return state.feedback?{...state,feedback:null}:state;
 default:
  return state;
 }
}

export function animationPlan(state,now){
 if(state.mode==='sleep')return {clip:'act_sleep',stage:'hold',since:state.modeAt,until:null};
 if(state.mode==='focus'){
  const clip='act_sit';
  const until=state.modeAt+duration(clip,clips[clip].enter);
  if(now<until)return {clip,stage:'enter',since:state.modeAt,until};
 }
 if(state.waitingSince!==null){
  return {clip:'emo_thinking',stage:'loop',since:Math.max(state.waitingSince,state.modeAt),until:null};
 }
 if(state.mode==='focus')return {clip:'act_sit',stage:'hold',since:state.modeAt,until:null};
 if(state.feedback){
  const {clip,at}=state.feedback;
  const until=at+duration(clip,clips[clip].enter);
  if(now<until)return {clip,stage:'enter',since:at,until};
 }
 return {clip:'act_idle',stage:'loop',since:state.modeAt,until:null};
}

export function animationFrame(plan,now,still=false){
 const clip=clips[plan.clip];
 if(plan.stage==='hold'||(still&&clip.hold!==undefined))return clip.hold;
 const [first,last]=(plan.stage==='enter'?clip.enter:clip.loop);
 if(still)return first;
 const tick=Math.max(0,Math.floor((now-plan.since)*clip.fps/1000));
 if(plan.stage==='enter')return Math.min(last,first+tick);
 const span=last-first+1;
 if(plan.clip==='emo_thinking'){
  const offset=tick%(2*span-2);
  return first+Math.min(offset,2*span-2-offset);
 }
 return first+tick%span;
}
