export type FeedingPhase='idle'|'sniff'|'carry'|'enter'|'explore';
export const phaseLabels:Record<FeedingPhase,string>={idle:'',sniff:'先闻闻这个线索',carry:'把好奇心叼回山洞',enter:'带着纸条进洞了',explore:'正在洞里寻找问题'};
function delay(ms:number,signal:AbortSignal){return new Promise<void>((resolve,reject)=>{
 if(signal.aborted){reject(new DOMException('Aborted','AbortError'));return;}
 const cancel=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};
 const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},ms);
 signal.addEventListener('abort',cancel,{once:true});
});}
export async function feedingJourney(signal:AbortSignal,update:(phase:FeedingPhase)=>void,still=false){
 if(signal.aborted)throw new DOMException('Aborted','AbortError');
 if(!still){update('sniff');await delay(650,signal);update('carry');await delay(1100,signal);update('enter');await delay(550,signal);}
 if(signal.aborted)throw new DOMException('Aborted','AbortError');update('explore');
}
