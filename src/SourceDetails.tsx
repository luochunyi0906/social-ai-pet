import type{SourceMetadata}from'./types';
export function coverageLabel(verification?:string){return verification==='api_excerpt'?'已取得知乎接口摘要，未取得或核验全文':verification==='api_metadata'?'仅取得知乎接口元数据，接口未提供可用摘要':'仅取得搜索索引，正文尚未核验';}
export function SourceDetails({source}:{source:SourceMetadata}){
 const when=(seconds?:number)=>seconds?new Date(seconds*1000).toLocaleString('zh-CN'):'';
 return <div className="source-details">
 <p className="source-coverage">{source.provider==='camp-replay'?'历史回放 · 仅保留已记录的标题与来源；未包含摘要或全文。':coverageLabel(source.verification)}</p>
 {(source.authorName||source.commentCount!==undefined||source.voteUpCount!==undefined)&&<p className="source-metadata">{source.authorName&&<span>作者：{source.authorName}</span>}{source.voteUpCount!==undefined&&<span>赞同 {source.voteUpCount}</span>}{source.commentCount!==undefined&&<span>评论 {source.commentCount}</span>}</p>}
 {(!!source.createdTime||!!source.editedTime)&&<p className="source-metadata">{!!source.createdTime&&<span>创建：{when(source.createdTime)}</span>}{!!source.editedTime&&<span>更新：{when(source.editedTime)}</span>}</p>}
 {source.excerpt&&<details className="source-excerpt" open><summary>接口内容摘要 · 不等于全文</summary><p>{source.excerpt}</p></details>}
 <p className="source-metadata">来源：{source.provider==='camp-replay'?'知乎检索验收记录':source.provider==='zhihu'?'知乎搜索 API':source.provider}{source.retrievedAt&&<span>{source.provider==='camp-replay'?'记录日期 '+source.retrievedAt:'取得于 '+new Date(source.retrievedAt).toLocaleString('zh-CN')}</span>}</p>
 </div>;
}
