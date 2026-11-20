// The adapter describes the visible tiles in morecats Minesweeper 3.0.
const digitColors=[[0,0,255],[0,128,0],[255,0,0],[0,0,128],[128,0,0],[0,128,128],[0,0,0],[128,128,128]];

const segmentDigits=['1111110','0110000','1101101','1111001','0110011',
 '1011011','1011111','1110000','1111111','1111011'];
function counter(pixel,sx,sy){
 const chars=[61,98,134].map(x=>{
  const segments=[[x,180],[x+13,189],[x+13,212],[x,224],[x-13,212],[x-13,189],[x,202]];
  const code=segments.map(([x,y])=>{
   let red=0;
   for(const dx of [-1,0,1])for(const dy of [-1,0,1]){
    const [r,g,b,a]=pixel((x+dx)/2*sx,(y+dy)/2*sy);
    if(a>=240&&r>150&&g<90&&b<90)red++;
   }
   return red>=5?1:0;
  }).join('');
  return segmentDigits.indexOf(code);
 });
 return chars.some(n=>n<0)?undefined:Number(chars.join(''));
}
function classifyMono(samples,color){
 const hit=(x,y)=>color(samples[y*20+x]);
 const count=(xs,ys)=>ys.reduce((sum,y)=>sum+xs.filter(x=>hit(x,y)).length,0);
 const span=(start,end)=>Array.from({length:end-start},(_,index)=>index+start);
 // A 7 has a broad horizontal top and a single descending stem.
 const seven=count(span(3,16),span(2,7))>=19&&count(span(1,7),span(9,17))<=5&&
  count(span(6,15),span(9,18))>=15;
 // An 8 has a gap in each bowl and a horizontal stroke between them.
 const eight=count(span(8,12),span(4,7))<7&&count(span(8,12),span(12,15))<8&&
  count(span(8,13),span(8,11))>=9&&count(span(4,8),span(5,8))>=6&&count(span(12,16),span(12,15))>=6;
 return {seven,eight};
}
function recognizeBoard({data,width,height},logicalWidth,logicalHeight,calibration){
 const sx=width/logicalWidth,sy=height/logicalHeight;
 if(!Number.isFinite(sx)||!Number.isFinite(sy)||sx<.5||sy<.5)return null;
 const pixel=(x,y)=>{
  const i=(Math.round(y)*width+Math.round(x))*4;
  return [data[i],data[i+1],data[i+2],data[i+3]];
 };
 const gray=([r,g,b,a])=>a>=240&&Math.max(r,g,b)-Math.min(r,g,b)<10;
 const surface=p=>gray(p)&&p[0]>=164&&p[0]<=216;
 const dark=p=>gray(p)&&p[0]>=70&&p[0]<=160;
 const light=p=>gray(p)&&p[0]>=227;
 function ratio(samples,accept){return samples.filter(accept).length/samples.length;}
 const nearLine=(along,fixed,at,accept)=>{
  for(const delta of [-1,0,1]){
   if(accept(along?pixel(at,fixed+delta):pixel(fixed+delta,at)))return true;
  }
  return false;
 };
 const rect=calibration?{
  x:calibration.x*width,y:calibration.y*height,w:calibration.width*width,h:calibration.height*height
 }:{x:15*sx,y:140*sy,w:width-30*sx,h:height-(140+15)*sy};
 if(rect.x<3||rect.y<3||rect.x+rect.w>width-3||rect.y+rect.h>height-3||rect.w<100||rect.h<100)return null;
 let best;
 for(let columns=6;columns<=32;columns++){
  const stepx=rect.w/columns;
  const rows=Math.round(rect.h/stepx);
  if(rows<6||rows>26)continue;
  const stepy=rect.h/rows;
  if(stepx<12||Math.abs(stepy/stepx-1)>.038)continue;
  let edges=0,total=0;
  const boundary=p=>dark(p)||light(p);
  for(let row=0;row<rows;row++){
   for(let column=0;column<columns;column++){
    const x=rect.x+column*stepx,y=rect.y+row*stepy;
    if(column>0){edges+=nearLine(false,x,y+stepy*.24,boundary)&&nearLine(false,x,y+stepy*.76,boundary);total++;}
    if(row>0){edges+=nearLine(true,y,x+stepx*.24,boundary)&&nearLine(true,y,x+stepx*.76,boundary);total++;}
   }
  }
  const score=edges/total;
  if(score>=.80&&(!best||score>best.score))best={columns,rows,stepx,stepy,score};
 }
 if(!best)return null;
 const {columns,rows,stepx,stepy}=best;
 const cells=[];
 let hasExplosion=false,revealedMines=0;
 for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
  const x=rect.x+column*stepx,y=rect.y+row*stepy;
  const p=(fx,fy)=>pixel(x+stepx*fx,y+stepy*fy);
  const bevel=ratio([p(.035,.36),p(.035,.63),p(.36,.035),p(.63,.035)],light);
  const top=Array.from({length:7},(_,i)=>p(.17+i*.11,.16));
  const danger=([r,g,b,a])=>a>=240&&r>=170&&g<105&&b<115;
  if(ratio(top,surface)<.85){
   if(ratio(top,danger)>.85){
    const darkCore=[p(.49,.48),p(.44,.42),p(.57,.49),p(.48,.61)].filter(([r,g,b])=>Math.max(r,g,b)<90).length;
    hasExplosion=hasExplosion||darkCore>=3;
   }
   cells.push('?');
   continue;
  }
  if(bevel===0){
   const ink=([r,g,b,a])=>a>=240&&Math.max(r,g,b)<100;
   const core=[p(.44,.48),p(.55,.48),p(.43,.57),p(.55,.57)];
   const spokes=[p(.5,.30),p(.5,.69),p(.31,.51),p(.69,.51)];
   if(ratio(core,ink)>=.75&&ratio(spokes,ink)>=.75){
    revealedMines++;
    cells.push('?');
    continue;
   }
  }
  const inner=[];
  for(let iy=0;iy<20;iy++)for(let ix=0;ix<20;ix++)inner.push(p(.2+ix*.03,.20+iy*.03));
  const plain=ratio(inner,surface);
  const count=rgb=>inner.filter(color=>color[3]>=240&&rgb.every((v,i)=>Math.abs(v-color[i])<24)).length;
  const colors=digitColors.map(count);
  const black=colors[6];
  const flag=inner.filter(([r,g,b])=>r>=145&&r>g*1.45&&r>b*1.4&&g>20&&g<122).length;
  if(bevel>=.75){
   cells.push(flag>=5&&black>=6?'flag':plain>=.96?'hidden':'?');
  }else if(bevel===0&&plain>=.96){
   cells.push(0);
  }else if(bevel===0&&plain>=.57){
   const color=colors.indexOf(Math.max(...colors));
   const singleColor=colors[color]>=9&&colors.filter(value=>value>=8).length===1;
   const isColor=([r,g,b,a])=>a>=240&&digitColors[color].every((v,i)=>Math.abs(v-[r,g,b][i])<24);
   const glyph=singleColor&&color>=6?classifyMono(inner,isColor):undefined;
   cells.push(singleColor&&color<6?color+1:color===6&&glyph?.seven?7:color===7&&glyph?.eight?8:'?');
  }else cells.push('?');
 }
 if(cells.filter(c=>c==='?').length>cells.length*.20)return null;
 const remaining=counter(pixel,sx,sy);
 const won=remaining===0&&cells.some(v=>v==='flag')&&!cells.some(v=>v==='?'||v==='hidden')&&
  cells.every((v,i)=>typeof v!=='number'||adjacentFlags(cells,columns,rows,i)===v);
 return {columns,rows,cells,result:hasExplosion||revealedMines>=2?'lost':won?'won':undefined,remaining,rect:{x:rect.x/sx,y:rect.y/sy,width:rect.w/sx,height:rect.h/sy}};
}
function adjacentFlags(cells,columns,rows,index){
 const {neighbors}=require('./mines-hints.cjs');
 return neighbors(index,columns,rows).filter(other=>cells[other]==='flag').length;
}
module.exports={recognizeBoard};
