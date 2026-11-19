import { FeatureGuide } from './FeatureGuide';
import { useEffect, useRef, useState } from 'react';
import { Companion, CostumeArt, RestingBlanket } from './Companion';
import { Fox } from './Fox';
import { assetUrl, DEFAULT_OUTFIT, defaultCard, findOutfit, invalidOutfitCount } from './outfits';
import { useWindowDrag } from './windowDrag';
import { SleepTable } from './SleepTable';
import { WardrobeDesigns, wardrobeCards } from './WardrobeDesigns';
import {CaveWardrobe} from './CaveWardrobe';
import './home.css';

const art = import.meta.glob<string>('./assets/home/*.png', { eager: true, query: '?url&no-inline', import: 'default' });
const furniture = (name: string) => art[`./assets/home/${name}.png`];

function FurnitureArt({ name }: { name: 'bed' | 'wardrobe' }) {
 const image = furniture(name);
 if (!image) return <span className={`home-furniture-art home-art-${name} home-furniture-fallback`} aria-hidden="true"/>;
 return <span className={`home-furniture-art home-art-${name}`} aria-hidden="true">
  {name === 'wardrobe' ? <span className="home-wardrobe-drawing">
   <img src={image} alt="" draggable={false}/>
   <span className="home-cabinet-interior"/>
   <img className="home-cabinet-door" src={image} alt="" draggable={false}/>
  </span> : <img src={image} alt="" draggable={false}/>}
 </span>;
}

export function HomeRoom({ sleeping, action, outfitId, changing, error, onClearError, canShowcase, onSleep, onWear, onShowcase, onCamp, onCompact, caveAvailable,caveOutfit,onCaveWear,wardrobeGlint,onWardrobeOpen }: {
 sleeping: boolean; action: string; outfitId: string; changing: boolean; error: string; onClearError: () => void; canShowcase: boolean;
 onSleep: (value: boolean) => void; onWear: (id: string) => Promise<boolean>; onShowcase: () => void;
 onCamp: () => void; onCompact: () => void;
 caveAvailable:boolean;caveOutfit:string|null;onCaveWear:(id:string|null)=>Promise<void>;wardrobeGlint:boolean;
 onWardrobeOpen: () => void;
}) {
 const [sleepPanel, setSleepPanel] = useState<'music' | 'alarm' | null>(null);
 const [closet, setCloset] = useState<'closed' | 'opening' | 'open'>('closed');
 const [previewId, setPreviewId] = useState(outfitId);
 const [previewError, setPreviewError] = useState(false);
 const [feedback, setFeedback] = useState('');
 const wardrobeButton = useRef<HTMLButtonElement>(null);
 const closeButton = useRef<HTMLButtonElement>(null);
 const windowDrag = useWindowDrag('panel');
 const current = findOutfit(outfitId);
 const previewCard = wardrobeCards.find(card => card.id === previewId) ?? wardrobeCards[0];
 const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
 const sleepingSprite = current?.actions.sleep;

 useEffect(() => {
  if (closet !== 'opening') return;
  const wait = setTimeout(() => setCloset('open'), reducedMotion ? 0 : 220);
  return () => clearTimeout(wait);
 }, [closet, reducedMotion]);
 useEffect(() => { if (closet === 'open') closeButton.current?.focus(); }, [closet]);
 useEffect(() => { if (!sleeping) setSleepPanel(null); }, [sleeping]);

 function openCloset() {
  if (closet !== 'closed') return;
  setSleepPanel(null);
  setPreviewId(outfitId);
  setPreviewError(false);
  setFeedback('');
  onClearError();
  onWardrobeOpen();
  setCloset('opening');
 }
 function closeCloset() {
  setCloset('closed');
  setFeedback('');
  onClearError();
  wardrobeButton.current?.focus();
 }

 async function wear(id: string) {
  if (!await onWear(id)) return;
  setPreviewId(id);
  setPreviewError(false);
  setFeedback(id === DEFAULT_OUTFIT ? '已恢复默认装扮。' : `已穿上「${findOutfit(id)?.name}」。`);
 }

 return <section className={`home-scene ${sleeping ? 'home-night' : ''}`} data-behavior={action}
  aria-label="暖木小屋" onKeyDown={event => {
   if (event.key !== 'Escape') return;
   event.stopPropagation();
   if (closet !== 'closed') closeCloset();
   else if (sleepPanel) setSleepPanel(null);
   else onCamp();
  }}>
  <div className="home-walls" aria-hidden="true">
   <div className="home-wall-grain"/>
   <div className="home-floor"/>
   <div className="home-beam"/>
   <div className="home-window"><div className="home-window-sky"><i/><i/><i/></div></div>
   <div className="home-lamp"><i/></div>
   <div className="home-rug"/>
  </div>
  <header className="home-bar">
   <div className={`home-title camp-title-board ${windowDrag.dragging ? 'is-dragging' : ''}`} title="拖动小屋窗口" {...windowDrag.bindings}>
    <span aria-hidden="true" className="home-house-icon">⌂</span><h1>暖木小屋</h1><span aria-hidden="true" className="camp-grip">⠿</span>
   </div>
   <div className="home-bar-actions"><button type="button" onClick={onCamp}>返回营地</button><button type="button" onClick={onCompact}>收回桌面</button></div>
  </header>
  {closet==="closed"&&!sleepPanel&&<FeatureGuide feature="home" floating/>}
  <div className="home-furniture">
   <button className="home-furniture-button home-bed" type="button" title={sleeping ? '起床' : '休息／睡眠'}
    aria-label={sleeping ? '起床' : '休息／睡眠'} onClick={() => onSleep(!sleeping)}>
    <FurnitureArt name="bed"/>
    {sleeping && <span className="home-bed-sleeper" aria-hidden="true">
     {sleepingSprite ? <Companion action="sleep"/> : <RestingBlanket outfitId={outfitId}/>}
    </span>}
    <span className="home-furniture-label">{sleeping ? '起床' : '休息／睡眠'}</span>
   </button>
   {sleeping && <SleepTable panel={sleepPanel} onPanel={setSleepPanel}/>}
   {!sleeping && <div className="home-companion"><Companion action={action}/></div>}
   <button ref={wardrobeButton} className={`home-furniture-button home-wardrobe ${closet !== 'closed' ? 'is-opening' : ''} ${wardrobeGlint?'home-wardrobe-glint':''}`}
    type="button" title="换装" aria-expanded={closet !== 'closed'} onClick={openCloset}>
    <FurnitureArt name="wardrobe"/><span className="home-furniture-label">换装</span>
   </button>
  </div>
  <div className="home-state" role="status">
   <span className="home-state-dot" aria-hidden="true"/><strong>{sleeping ? '休息中' : (current?.name ?? defaultCard.name)}</strong>
   {sleeping && <small>轻点床铺就能叫醒</small>}
  </div>
  {closet === 'open' && <section className="home-closet" aria-labelledby="wardrobe-title">
   <header><h2 id="wardrobe-title">衣柜</h2><button ref={closeButton} type="button" onClick={closeCloset}>关闭预览</button></header>
   <FeatureGuide feature="wardrobe" openFirst={false}/>
   {caveAvailable?<CaveWardrobe current={caveOutfit} onWear={onCaveWear}/>:<>
   <WardrobeDesigns card={previewCard} currentId={outfitId} changing={changing}
    onSelect={id => { setPreviewId(id); setPreviewError(false); setFeedback(''); onClearError(); }}
    renderWearable={(card, active) => {
     const costume = card.outfit;
     if (!costume) return <Fox/>;
     const animated = active && !reducedMotion && !previewError && assetUrl(costume, costume.preview);
     return animated ? <CostumeArt key={card.id} outfit={costume} preview={animated} cleanPreview onError={() => setPreviewError(true)}/>
      : <CostumeArt outfit={costume} cleanPreview/>;
    }}/>
   <footer>
    <div className="wardrobe-status" aria-live="polite">
     {error ? <small className="home-outfit-error" role="alert">{error}</small> :
      feedback ? <small>{feedback}</small> :
      <small>{previewError ? '动图暂不可用，已显示待机图。' : previewCard.wearable ?
       (previewCard.outfit && !previewCard.outfit.actions.sleep ? '休息时使用共用被窝。' : '') : '仅供查看，暂不可穿戴。'}</small>}
     {invalidOutfitCount > 0 && <small>{invalidOutfitCount} 套装扮的登记资料不兼容。</small>}
    </div>
    <div className="home-closet-actions">
     <button type="button" onClick={closeCloset}>返回房间</button>
     {previewCard.wearable && <>
      {current?.actions.showcase && !sleeping && canShowcase && <button type="button" onClick={onShowcase}>展示水晶动作</button>}
      <button type="button" disabled={changing || outfitId === DEFAULT_OUTFIT} onClick={() => void wear(DEFAULT_OUTFIT)}>恢复默认装扮</button>
      <button type="button" className="primary" disabled={changing || outfitId === previewId} onClick={() => void wear(previewId)}>{changing ? '正在保存…' : '穿上'}</button>
     </>}
    </div>
   </footer>
   </>}
  </section>}
 </section>;
}
