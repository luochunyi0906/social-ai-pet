import {useActorEvents} from './ActorAnimation';
import {useEffect,useRef,useState} from 'react';
import {unwrap,type Bridge,type Result} from './types';

type Data=Awaited<ReturnType<Bridge['questionAnswers']>> extends Result<infer Page>?Page:never;
const bridge=window.kanshan;
export function questionOrigin(url?:string){
 if(!url)return;
 try{
  const link=new URL(url);
  const question=link.pathname.match(/^\/question\/(\d+)(?:\/answer\/\d+)?\/?$/);
  if(link.protocol==='https:'&&['www.zhihu.com','zhihu.com'].includes(link.hostname)&&question)
   return 'https://www.zhihu.com/question/'+question[1];
 }catch{}
}
export function QuestionAnswers({url}:{url:string}){
 const actor=useActorEvents();
 const [visible,setVisible]=useState(false);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [page,setPage]=useState<Data>();
 const [items,setItems]=useState<Data['items']>([]);
 const request=useRef<string|undefined>(undefined);
 const retry=useRef(0);
 useEffect(()=>()=>{const id=request.current;request.current=undefined;if(id){actor.request('answers',id,false);void bridge?.cancel(id);}},[]);
 async function load(offset:number){
  if(!bridge?.questionAnswers||request.current)return;
  const id=crypto.randomUUID();
  request.current=id;actor.request('answers',id,true);retry.current=offset;setLoading(true);setError('');
  try{
   const result=await unwrap(bridge.questionAnswers({id,url,offset,limit:20}));
   if(request.current!==id)return;
   setPage(result);
   setItems(old=>[...new Map([...(offset?old:[]),...result.items].map(item=>[item.id,item])).values()]);
  }catch(error){if(request.current===id)setError((error as Error).message);}
  finally{actor.request('answers',id,false);if(request.current===id){request.current=undefined;setLoading(false);}}
 }
 return <section className="question-answers">
  <button type="button" aria-expanded={visible} onClick={()=>{
   if(visible){
    const id=request.current;request.current=undefined;setLoading(false);if(id){actor.request('answers',id,false);void bridge?.cancel(id);}
   }else if(!page)void load(0);
   setVisible(!visible);
  }}>{visible?'收起知乎回答':'查看知乎回答摘要'}</button>
  {visible&&<div className="question-answer-content">
   <p>来源为知乎问题回答接口。以下是服务返回的摘要或截取文本，全文请打开原文。</p>
   {loading&&<p role="status">正在获取知乎回答…</p>}
   {error&&<p role="alert">{error} <button onClick={()=>void load(retry.current)}>重试</button></p>}
   {items.map(item=><article key={item.id}><p>{item.summary}</p>
    <button onClick={()=>{if(bridge)void unwrap(bridge.openPost(item.url)).catch(error=>setError(error.message));}}>查看回答原文 ↗</button>
   </article>)}
   {!loading&&!error&&page&&!items.length&&<p>本次没有可展示的回答摘要。</p>}
   {page?.pagingIncomplete&&<p role="status">知乎未返回有效的下一页偏移，已停止翻页。</p>}
   {page?.nextOffset!==undefined&&<button disabled={loading} onClick={()=>void load(page.nextOffset!)}>下一页回答</button>}
  </div>}
 </section>;
}
