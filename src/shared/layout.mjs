import layout from '../../desktop/pet-layout.json' with {type:'json'};

export const {size:DESKTOP_SIZE,places:DEFAULT_PLACES,pieces:PIECES}=layout;

const overlap=(a,b)=>a.x<b.x+b.w+2&&a.x+a.w+2>b.x&&a.y<b.y+b.h+2&&a.y+a.h+2>b.y;
function boxes(key,position){
 const {shape,label}=PIECES[key];
 return [shape,label].map(box=>({...box,x:position.x+box.x,y:position.y+box.y}));
}
export function collides(places,key,position){
 const otherBoxes=Object.keys(PIECES).filter(other=>other!==key).flatMap(other=>boxes(other,places[other]));
 return boxes(key,position).some(box=>otherBoxes.some(other=>overlap(box,other)));
}
export function placePiece(places,key,proposed){
 const piece=PIECES[key];
 if(!piece||key==='fox')return{places,blocked:true};
 const left=Math.min(0,piece.label.x);
 const right=Math.max(piece.w,piece.label.x+piece.label.w);
 const position={
  x:Math.max(2-left,Math.min(DESKTOP_SIZE.width-2-right,proposed.x)),
  y:Math.max(2,Math.min(DESKTOP_SIZE.height-2-piece.h,proposed.y))
 };
 if(collides(places,key,position))return{places,blocked:true};
 return{places:{...places,[key]:position},blocked:false};
}
