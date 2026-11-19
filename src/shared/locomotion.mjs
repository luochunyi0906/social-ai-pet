import profiles from '../../desktop/locomotion.json' with {type:'json'};

const clamp=(value,lo=0,hi=1)=>Math.min(hi,Math.max(lo,value));
export const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};
const unit=value=>((value%1)+1)%1;
export const timingFor=(form,kind)=>(profiles[form]??profiles.classic)[kind];

// Distances are in logical desktop points. During stance, the planted foot
// travels backwards at the same speed as the desktop window travels forwards.
export function gaitFrame(form,kind,elapsed,speed){
 const timing=timingFor(form,kind);
 const phase=unit(elapsed/timing.cycle);
 const running=kind==='run';
 const support=running?.43:.62;
 const rate=speed??timing.speed;
 const stride=rate*timing.cycle*support;
 const lift=form==='human'?(running?9.4:4.1):(running?6.7:2.8);
 function foot(offset){
  const p=unit(phase+offset);
  if(p<support)return {x:stride*(.5-p/support),y:0,pitch:running?-2:0};
  const swing=(p-support)/(1-support);
  return {x:stride*(smooth(swing)-.5),y:-lift*Math.sin(Math.PI*swing)**2,
   pitch:(running?24:15)*Math.sin(swing*2*Math.PI)};
 }
 const high=running?Math.max(0,Math.sin(phase*4*Math.PI-.8))**2:0;
 const body=(running?1.7:.8)*(1-Math.cos(phase*4*Math.PI))/2;
 return {left:foot(0),right:foot(.5),body:body-high*(running?3.8:0),phase,lean:running?9:3};
}

export function climbFrame(form,elapsed,speed){
 const timing=timingFor(form,'climb');
 const phase=unit(elapsed/timing.cycle);
 const travel=(speed??timing.speed)*timing.cycle;
 function hand(offset){
  const fraction=unit(phase+offset);
  const hold=.64;
  if(fraction<hold)return {y:travel*(fraction-hold/2),reach:0,planted:true};
  const swing=(fraction-hold)/(1-hold);
  return {y:travel*(fraction-hold/2-smooth(swing)),reach:Math.sin(swing*Math.PI)*4.5,planted:false};
 }
 return {left:hand(0),right:hand(.5),phase};
}
