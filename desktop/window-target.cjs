const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const path=require('node:path');
const run=promisify(execFile);
const {roam}=require('./pet-layout.json');

async function windowInfo(id){
 if(process.platform!=='darwin')throw Error('真实窗口互动支持 macOS。');
 try{
  const {stdout}=await run(path.join(__dirname,'native/window-info'),[String(process.pid),String(id??0)],{timeout:1000,maxBuffer:8192});
  return JSON.parse(stdout);
 }catch{throw Error('暂时无法取得可见窗口的边界。');}
}
function windowPlan(target,display,size,side,form){
 if(!target||!display)return;
 const {workArea:area,bounds}=display;
 const near=(a,b)=>Math.abs(a-b)<=12;
 if(near(target.width,bounds.width)&&near(target.height,bounds.height))return;
 const portrait=form==='fox'||form==='human';
 const layout=form==='fox'?roam.fox:roam.standard;
 const artX=(size.width-92)/2;
 const artY=size.height===layout.height?layout.artY:0;
 const routeHeight=form==='fox'?145:135;
 const grip=(form==='human'?17:form==='fox'?13:14)+artX;
 const x=[target.x-size.width+grip,target.x+target.width-grip];
 const eligible=x.map(left=>left>=area.x+5&&left+size.width<=area.x+area.width-5);
 const top=target.y-routeHeight-artY+14;
 const bottom=Math.min(target.y+target.height-routeHeight/2-artY,area.y+area.height-size.height);
 if(top<area.y+4||bottom-top<100)return;
 const chosen=side??(eligible[1]?1:0);
 if(!eligible[chosen])return;
 const seat=portrait
  ? (chosen?target.x+target.width-54:target.x+Math.min(135,target.width*.5))
  : target.x+target.width*.60;
 const safeSeat=Math.max(area.x,Math.min(seat-size.width/2,area.x+area.width-size.width));
 return {side:chosen,area,
  approach:{x:x[chosen],y:bottom},
  climb:{x:x[chosen],y:top+(portrait?65:36)},
  perch:{x:safeSeat,y:top}};
}

function nearbyWindowPlan(plan,origin,reach){
 if(!plan)return;
 const y=Math.max(plan.climb.y+12,Math.min(plan.approach.y,origin.y));
 if(Math.hypot(plan.approach.x-origin.x,y-origin.y)>reach)return;
 return {...plan,approach:{...plan.approach,y}};
}

function chooseWindowRoute(snapshot,origin,size,form,planWindow,reach){
 const ordered=snapshot.candidates??[snapshot.candidate].filter(Boolean);
 const preferred=snapshot.front??snapshot.candidate;
 const prioritized=preferred?[preferred,...ordered.filter(window=>window.id!==preferred.id)]:ordered;
 const distance=plan=>Math.hypot(plan.approach.x-origin.x,plan.approach.y-origin.y);
 let closest;
 for(const target of prioritized){
  const index=ordered.findIndex(window=>window.id===target.id);
  const covering=index===-1?ordered:ordered.slice(0,index);
  const exposed=plan=>{
   const edge=plan.side?target.x+target.width-2:target.x+2;
   const gripY=target.y+Math.min(target.height/2,70);
   const seat=plan.perch.x+size.width/2;
   const covers=(window,x,y)=>window.x<=x&&x<window.x+window.width&&window.y<=y&&y<window.y+window.height;
   return !covering.some(window=>covers(window,edge,gripY)||covers(window,seat,target.y+4));
  };
  let choices=[planWindow(target,size,0,form),planWindow(target,size,1,form)];
  if(reach!==undefined)choices=choices.map(plan=>nearbyWindowPlan(plan,origin,reach));
  choices=choices
   .filter(plan=>plan&&exposed(plan)).sort((a,b)=>distance(a)-distance(b));
  if(!choices.length)continue;
  const route={target,plan:choices[0]};
  if(reach===undefined)return route;
  if(!closest||distance(route.plan)<distance(closest.plan))closest=route;
 }
 return closest;
}

function externalFocus(snapshot){
 if(!snapshot.selfActive&&snapshot.activePID>0)return {pid:snapshot.activePID,id:snapshot.front?.id};
}
function windowFocusTracker(snapshot,target){
 let previous=externalFocus(snapshot)??(snapshot.selfActive?snapshot.candidates?.[0]??snapshot.candidate:undefined);
 return update=>{
  const current=externalFocus(update);
  if(!current)return false;
  const onTarget=current.pid===target.pid&&(current.id===undefined||current.id===target.id);
  const switched=previous&&!onTarget&&(current.pid!==previous.pid||
   (current.id!==undefined&&previous.id!==undefined&&current.id!==previous.id));
  if(!switched&&(!previous||onTarget||current.id!==undefined))previous=current;
  return Boolean(switched);
 };
}
module.exports={windowInfo,windowPlan,nearbyWindowPlan,chooseWindowRoute,windowFocusTracker};
