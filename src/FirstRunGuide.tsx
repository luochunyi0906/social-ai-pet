import { useEffect, useRef } from 'react';
import walk from './assets/companion/act_walk/act_walk.gif';
import walkStill from './assets/companion/act_walk/act_walk_001.png';
import garden from './assets/snowy/garden.png';
import mailbox from './assets/snowy/mailbox.png';
import './first-run-guide.css';

export function FirstRunGuide({ onClose, error, closing }: {
  onClose: (enterCamp: boolean) => void;
  error: string;
  closing: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    heading.current?.focus();
    return () => element.close();
  }, []);

  return (
    <dialog ref={dialog} className="first-run-guide" data-hit aria-labelledby="guide-title"
      onCancel={event => {
        event.preventDefault();
        onClose(false);
      }}>
      <header className="guide-header">
        <h2 id="guide-title" ref={heading} tabIndex={-1}>认识你的桌宠</h2>
        <button type="button" onClick={() => onClose(false)} disabled={closing}>跳过教程</button>
      </header>
      <ul className="desktop-guide-cards">
        <li>
          <picture>
            <source media="(prefers-reduced-motion: reduce)" srcSet={walkStill}/>
            <img src={walk} alt="刘看山走路的动画"/>
          </picture>
          <h3>他会自己到处跑</h3>
          <p>刘看山会离开雪地散步，玩一会儿就回来。</p>
        </li>
        <li>
          <img src={garden} alt="桌面花箱"/>
          <h3>他也会到花园溜达</h3>
          <p>单击刘看山打招呼，双击进营地。点花箱可以直接进花园。</p>
        </li>
        <li>
          <img src={mailbox} alt="桌面信箱"/>
          <h3>信箱可以搜知乎</h3>
          <p>点信箱，再选「直接搜知乎」。也可以投喂文字或文件找灵感。</p>
        </li>
      </ul>
      {error && <p className="guide-error" role="alert">{error}</p>}
      <footer className="guide-footer">
        <button type="button" className="guide-next" disabled={closing} onClick={() => onClose(true)}>进入营地探索</button>
      </footer>
    </dialog>
  );
}
