function outside(window,area,width,height,gap=10){
 const clamp=(n,start,end)=>Math.max(start,Math.min(n,end));
 const lowX=area.x,highX=area.x+area.width-width,lowY=area.y,highY=area.y+area.height-height;
 const x=clamp(window.x,lowX,highX),y=clamp(window.y,lowY,highY);
 return [[window.x+window.width+gap,y],[window.x-width-gap,y],
  [x,window.y+window.height+gap],[x,window.y-height-gap]]
  .map(([x,y])=>({x:Math.round(x),y:Math.round(y),width,height}))
  .find(p=>p.x>=lowX&&p.x<=highX&&p.y>=lowY&&p.y<=highY);
}
module.exports={outside};
