import type {ReactNode} from 'react';

export function Icon({name}:{name:'back'|'bell'|'shrink'|'refresh'|'external'|'chat'|'bookmark'|'mountain'|'leaf'}){
 const shapes:Record<typeof name,ReactNode>={
  back:<path d="m14.5 4.8-6 7.2 6 7.2"/>,
  bell:<><path d="M4 17h16l-2.7-3V9a5.3 5.3 0 0 0-10.6 0v5z"/><path d="M10 20q2 3 4 0M12 2v2"/></>,
  shrink:<><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7.5 9h9"/></>,
  refresh:<><path d="M21 4v6h-6M20 10a8.4 8.4 0 1 0 .3 5.5"/></>,
  external:<><path d="M13 3h8v8M21 3l-10 10"/><path d="M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/></>,
  chat:<><path d="M20.7 11c0 4.2-4.2 7.3-9 7.3H9l-4.5 3 .8-4.4C3.8 15.4 3 13.5 3 11c0-4 3.8-7.3 8.7-7.3s9 3.3 9 7.3Z"/><path d="M8 11h.2m3.4 0h.2m3.5 0h.2" strokeWidth="2.6"/></>,
  bookmark:<path d="M5 3h14v18l-7-4.8L5 21V3Z"/>,
  mountain:<><path fill="currentColor" stroke="none" d="M1.5 18 7 7a3 3 0 0 1 5.2 0L19 19H2a.8.8 0 0 1-.5-1m13-10 2-3a1.8 1.8 0 0 1 3 0l4.4 13.6h-3.4Z"/><path stroke="#f8f2db" d="m5.7 15 2-3.8m9.4-3.3 1.3 2"/></>,
  leaf:<><path fill="currentColor" stroke="none" d="M11 15C4 15 1 11 1 6c7-1 11 2 11 7C13 6 17 3 23 3c0 8-4 11-11 12Z"/><path d="M11 21c0-4 1.1-7.5 4.9-11.9M11 16l-5-5"/></>
 };
 return <svg className={'hot-icon hot-icon-'+name} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{shapes[name]}</svg>;
}
