import type {CompanionChoice,CompanionOffer} from './types';

export function CompanionInvitation({offer,choices,onChoose,onSource}:{
 offer:CompanionOffer;choices:boolean;onChoose:(choice:CompanionChoice)=>void;onSource:(url:string)=>void;
}){
 const source=offer.source;
 return <aside className="pet-invitation" aria-label="刘看山想聊两句" aria-live="polite">
  <button type="button" className="pet-invitation-message" data-hit onClick={()=>onChoose('talk')} title={offer.line}>
   <span>{offer.line}</span>
  </button>
  <div className="pet-invitation-actions">
   {source&&<button type="button" onClick={()=>onSource(source.sourceUrl||source.url)}
    title="打开知乎热榜原文">知乎热榜 · {new Date(source.retrievedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false})} ↗</button>}
   <button type="button" disabled={choices} onClick={()=>onChoose('talk')}>聊聊</button>
   <button type="button" disabled={choices} onClick={()=>onChoose('later')}>{offer.kind==='teaching'?'下次再说':'稍后'}</button>
   <button type="button" disabled={choices} onClick={()=>onChoose('quiet')}>今天安静一点</button>
  </div>
 </aside>;
}
