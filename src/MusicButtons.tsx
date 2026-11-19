type MusicAction='open'|'sample'|'file';

export function MusicButtons({busy,onAction,sampleLabel='播放林间夜曲'}:{
 busy?:boolean;onAction:(action:MusicAction)=>void;sampleLabel?:string;
}){
 return <div className="home-alarm-actions">
  <button className="primary" disabled={busy} type="button" onClick={()=>onAction('sample')}>{sampleLabel}</button>
  <button disabled={busy} type="button" onClick={()=>onAction('file')}>选本地歌曲</button>
  <button disabled={busy} type="button" onClick={()=>onAction('open')}>打开 QQ 音乐</button>
 </div>;
}
