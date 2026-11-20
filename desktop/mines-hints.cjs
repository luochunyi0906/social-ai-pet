function neighbors(index,columns,rows){
 const x=index%columns,y=Math.floor(index/columns),cells=[];
 for(let j=Math.max(0,y-1);j<=Math.min(rows-1,y+1);j++){
  for(let i=Math.max(0,x-1);i<=Math.min(columns-1,x+1);i++){
   if(j*columns+i!==index)cells.push(j*columns+i);
  }
 }
 return cells;
}
function hints({cells,columns,rows}){
 const rules=[];
 for(const [clue,value] of cells.entries()){
  if(!Number.isInteger(value))continue;
  const adjacent=neighbors(clue,columns,rows);
  if(adjacent.some(id=>cells[id]==='?'))continue;
  const unknown=adjacent.filter(id=>!Number.isInteger(cells[id]));
  if(unknown.length<value)return null;
  if(unknown.length)rules.push({clue,value,unknown});
 }
 const possible=[];
 for(const rule of rules){
  const {unknown,clue,value}=rule;
  if(unknown.filter(id=>cells[id]==='flag').length>value){
   return {kind:'check',clues:[clue],area:unknown,need:value};
  }
  if(value===0||value===unknown.length)possible.push({
   kind:value===0?'safe':'mine',clues:[clue],area:unknown,need:value
  });
 }
 for(const [left,a] of rules.entries()){
  for(let right=left+1;right<rules.length;right++){
   const b=rules[right];
   if(a.unknown.length===b.unknown.length&&a.unknown.every(id=>b.unknown.includes(id))&&a.value!==b.value)return null;
   const [small,large]=a.unknown.length<b.unknown.length?[a,b]:[b,a];
   if(small.unknown.length>=large.unknown.length||!small.unknown.every(id=>large.unknown.includes(id)))continue;
   const area=large.unknown.filter(id=>!small.unknown.includes(id)),need=large.value-small.value;
   if(need<0||need>area.length)return null;
   if(need===0||need===area.length)possible.push({
    kind:need===0?'safe':'mine',clues:[small.clue,large.clue],area,need
   });
  }
 }
 const proof=possible.find(item=>item.kind==='safe'&&item.area.some(id=>cells[id]==='flag'))??
  possible.find(item=>item.kind==='safe')??possible.find(item=>item.area.some(id=>cells[id]==='hidden'));
 return proof?{...proof,cell:proof.area.find(id=>cells[id]==='flag'&&proof.kind==='safe')??proof.area.find(id=>cells[id]==='hidden')}:null;
}
const location=(cell,columns)=>`第 ${Math.floor(cell/columns)+1} 行第 ${cell%columns+1} 列`;
function describe(board,proof,level){
 if(!proof)return {text:'我暂时还没找到确定的一步。',area:[],clues:[]};
 const {columns,cells}=board,{clues,area,need,kind,cell}=proof;
 const names=clues.map(id=>`${location(id,columns)}的「${cells[id]}」`).join('和');
 const target=cell===undefined?'':location(cell,columns);
 if(level===1)return {text:`看看${names}。它们旁边还有哪些格子没打开？`,clues,area:[]};
 const basis=clues.length===1?`${names}周围有 ${area.length} 个还未翻开的格子，共有 ${need} 颗雷。`:
  `${names}的未知格有包含关系。减掉重叠部分，剩下 ${area.length} 格，共有 ${need} 颗雷。`;
 if(kind==='check')return {text:`${basis} 这里已有更多的旗帜，值得检查一下。`,clues,area};
 const action=kind==='safe'?(cells[cell]==='flag'?'可以先核对这面旗，这格能证明安全。':'可以翻开，这格能证明安全。'):'可以插旗，这格能证明有雷。';
 return {text:level===2?basis:`${target}${action}${basis}`,clues,area,...(level===3?{cell,kind}:{})};
}
module.exports={neighbors,hints,describe,location};
