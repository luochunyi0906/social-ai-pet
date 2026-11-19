import { FeatureGuide } from './FeatureGuide';
import { useEffect, useRef, useState } from 'react';
import { unwrap } from './types';

function localTime(timestamp: number) {
 const date = new Date(timestamp);
 return [date.getHours(), date.getMinutes()].map(value => String(value).padStart(2, '0')).join(':');
}

export function SleepTable({ panel, onPanel }: {
 panel: 'music' | 'alarm' | null;
 onPanel: (panel: 'music' | 'alarm' | null) => void;
}) {
 const [time, setTime] = useState('07:00');
 const [createdAt, setCreatedAt] = useState<number | null>(null);
 const [musicStatus, setMusicStatus] = useState('');
 const [clockStatus, setClockStatus] = useState('');
 const [shortcutInstalled, setShortcutInstalled] = useState<boolean | null>(null);
 const [error, setError] = useState('');
 const [busy, setBusy] = useState(false);
 const pending = useRef(false);
 const musicButton = useRef<HTMLButtonElement>(null);
 const alarmButton = useRef<HTMLButtonElement>(null);
 const closeButton = useRef<HTMLButtonElement>(null);
 const previousPanel = useRef<typeof panel>(null);

 useEffect(() => {
  setError('');
  if (panel) closeButton.current?.focus();
  else if (previousPanel.current) {
   (previousPanel.current === 'music' ? musicButton : alarmButton).current?.focus();
  }
  previousPanel.current = panel;
 }, [panel]);

 useEffect(() => {
  const bridge = window.kanshan;
  if (panel !== 'alarm' || !bridge) return;
  let current = 0;
  const refresh = () => {
   const request = ++current;
   void unwrap(bridge.sleepAlarmStatus())
    .then(status => { if (current === request) setShortcutInstalled(status.installed); })
    .catch(() => { if (current === request) setShortcutInstalled(null); });
  };
  refresh();
  window.addEventListener('focus', refresh);
  return () => {
   current++;
   window.removeEventListener('focus', refresh);
  };
 }, [panel]);

 async function run(operation: (bridge: NonNullable<Window['kanshan']>) => Promise<void>) {
  if (pending.current) return;
  const bridge = window.kanshan;
  if (!bridge) {
   setError('请通过看山有伴桌面应用使用此功能。');
   return;
  }
  pending.current = true;
  setBusy(true);
  setError('');
  try { await operation(bridge); }
  catch (reason) {
   if (panel === previousPanel.current) setError((reason as Error).message);
  } finally {
   pending.current = false;
   setBusy(false);
  }
 }

 function music(mode: 'open' | 'sample' | 'file') {
  setMusicStatus('');
  void run(async bridge => {
   const result = await unwrap(bridge.sleepMusic(mode));
   if (result.state === 'handedOff') setMusicStatus('已把音频交给 QQ 音乐，可在客户端暂停或切歌。');
   if (result.state === 'opened') setMusicStatus('已打开 QQ 音乐，可在客户端选择歌单或歌曲。');
  });
 }

 function clock(action: 'open' | 'install') {
  void run(async bridge => {
   await unwrap(bridge.sleepClock(action));
   if (action === 'install') setClockStatus('在「快捷指令」中确认添加，回到小屋后再设置响铃时间。');
  });
 }

 function createAlarm() {
  setClockStatus('');
  void run(async bridge => {
   const result = await unwrap(bridge.addSystemAlarm(time));
   if (result.state === 'needsShortcut') {
    setShortcutInstalled(false);
    setClockStatus('请导入新版闹钟快捷指令，也可以直接在 Mac 时钟里设置。');
    return;
   }
   setShortcutInstalled(true);
   setCreatedAt(result.at);
   setClockStatus(`已在 Mac 时钟创建 ${localTime(result.at)} 的闹钟，名称是「看山有伴」。`);
  });
 }

 return <>
  <div className="home-nightstand" aria-label="床边桌">
   <span className="home-nightstand-wood" aria-hidden="true"><i/><i/><b/></span>
   <div className="home-table-devices">
    <button ref={musicButton} className="home-device home-radio" type="button"
     title="QQ 音乐" aria-expanded={panel === 'music'} onClick={() => onPanel('music')}>
     <span className="home-device-art" aria-hidden="true"><i/><b/><em/></span>
     <span className="home-device-label">音乐</span>
    </button>
    <button ref={alarmButton} className="home-device home-clock" type="button"
     title="Mac 时钟" aria-expanded={panel === 'alarm'} onClick={() => onPanel('alarm')}>
     <span className="home-device-art" aria-hidden="true"><i/><b/><em/></span>
     <span className="home-device-label">闹钟</span>
    </button>
   </div>
  </div>
  {panel && <section className="home-sleep-controls" aria-labelledby="home-sleep-control-title">
   <header>
    <h2 id="home-sleep-control-title">{panel === 'music' ? 'QQ 音乐' : 'Mac 时钟'}</h2>
    <button ref={closeButton} type="button" onClick={() => onPanel(null)}>关闭</button>
   </header>
   <FeatureGuide key={panel} feature={panel}/>
   {panel === 'music' ? <>
    <p>用这台 Mac 的 QQ 音乐听歌。</p>
    <div className="home-alarm-actions">
     <button className="primary" disabled={busy} type="button" onClick={() => music('sample')}>播放林间夜曲</button>
     <button disabled={busy} type="button" onClick={() => music('file')}>选本地歌曲</button>
     <button disabled={busy} type="button" onClick={() => music('open')}>打开 QQ 音乐</button>
    </div>
    {musicStatus && <p role="status">{musicStatus}</p>}
   </> : <form onSubmit={event => { event.preventDefault(); createAlarm(); }}>
    <label htmlFor="home-alarm-time">响铃时间</label>
    <div className="home-alarm-actions">
     <input id="home-alarm-time" type="time" required value={time} onChange={event => setTime(event.target.value)}/>
     <button className="primary" disabled={busy || (createdAt !== null && localTime(createdAt) === time)} type="submit">设置系统闹钟</button>
    </div>
    <p><small>{shortcutInstalled === true
     ? '快捷指令已就绪。选好时间后，点「设置系统闹钟」。'
     : shortcutInstalled === false ? '请导入适配当前 macOS 的闹钟快捷指令。' : '设置时会检查闹钟快捷指令。'}</small></p>
    {clockStatus && <p role="status">{clockStatus}</p>}
    <div className="home-alarm-actions">
     <button disabled={busy} type="button" onClick={() => clock('open')}>打开时钟</button>
     {shortcutInstalled !== true && <button disabled={busy} type="button" onClick={() => clock('install')}>导入新版闹钟快捷指令</button>}
    </div>
    <p><small>闹钟由 Mac 时钟管理和响铃。</small></p>
   </form>}
   {error && <p role="alert">{error}</p>}
  </section>}
 </>;
}
