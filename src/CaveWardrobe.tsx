import { useState } from 'react';
import outfits from '../desktop/cave-wardrobe.json';
import { AppearanceArt } from './PetAppearance';
import { WardrobeTurntable } from './WardrobeTurntable';

type OutfitId = keyof typeof outfits;
const catalog = Object.keys(outfits) as OutfitId[];
const art = import.meta.glob<string>('./assets/cave/turntable/*/{front,side,back}.webp',
 { eager: true, query: '?url&no-inline', import: 'default' });
const picture = (id: OutfitId | null, angle: 'front' | 'side' | 'back') =>
 art[`./assets/cave/turntable/${id ?? 'default'}/${angle}.webp`];
const outfitId = (value: string | null): OutfitId | null =>
 value && Object.hasOwn(outfits, value) ? value as OutfitId : null;

export function CaveWardrobe({ current, onWear }: {
 current: string | null; onWear: (id: string | null) => Promise<void>;
}) {
 const [preview, select] = useState(() => outfitId(current));
 const [saving, setSaving] = useState(false);
 const [problem, setProblem] = useState('');
 const name = preview ? outfits[preview] : '默认蓝白外观';
 const front = picture(preview, 'front');
 const side = picture(preview, 'side');
 const back = picture(preview, 'back');

 async function wear(id: OutfitId | null) {
  setSaving(true);
  setProblem('');
  try {
   await onWear(id);
   select(id);
  } catch (error) {
   setProblem(error instanceof Error ? error.message : '保存装扮失败，请重试。');
  } finally {
   setSaving(false);
  }
 }

 return <section className="cave-wardrobe" aria-label="山洞解锁服装">
  <div className="cave-wardrobe-preview">
   <div className="wardrobe-heading">
    <h3>{name}</h3>
    <span className="wardrobe-badge" data-wearable={preview === current}>
     {preview === current ? '正在穿着' : '试穿中'}
    </span>
   </div>
   <div className="wardrobe-display">
    {front && side && back
     ? <WardrobeTurntable key={preview ?? 'default'} name={name} front={front} side={side} back={back} dragOnly/>
     : <div className="home-preview-stage"><AppearanceArt appearance="fox" caveOutfit={preview}/></div>}
   </div>
   <div className="cave-wardrobe-actions">
    {problem && <small role="alert">{problem}</small>}
    <div className="home-closet-actions">
     <button type="button" disabled={saving || (preview === null && current === null)}
      onClick={() => void wear(null)}>恢复默认</button>
     <button type="button" className="primary" disabled={saving || preview === current}
      onClick={() => void wear(preview)}>{saving ? '正在保存…' : '确认穿上'}</button>
    </div>
   </div>
  </div>
  <div className="cave-wardrobe-grid" aria-label="狐狸版服装">
   {catalog.map(id => <button type="button" key={id} disabled={saving}
    aria-pressed={preview === id} onClick={() => { select(id); setProblem(''); }}>
    <span className="cave-wardrobe-thumb" aria-hidden="true">
     {picture(id, 'front') ? <img src={picture(id, 'front')} alt="" draggable={false}/>
      : <AppearanceArt appearance="fox" caveOutfit={id}/>}
    </span>
    <strong>{outfits[id]}</strong>
    {current === id && <small>穿着中</small>}
   </button>)}
  </div>
 </section>;
}
