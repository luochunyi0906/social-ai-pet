import layout from '../../desktop/pet-layout.json' with {type:'json'};

export const {size:DESKTOP_SIZE,places:DEFAULT_PLACES,pieces:PIECES}=layout;

const overlap=(a,b)=>a.x<b.x+b.w+2&&a.x+a.w+2>b.x&&a.y<b.y+b.h+2&&a.y+a.h+2>b.y;
function boxes(key,position){
 const {shape,label}=PIECES[key];
 return (label?[shape,label]:[shape]).map(box=>({...box,x:position.x+box.x,y:position.y+box.y}));
}
export function collides(places,key,position){
 const otherBoxes=Object.keys(PIECES).filter(other=>other!==key).flatMap(other=>boxes(other,places[other]));
 return boxes(key,position).some(box=>otherBoxes.some(other=>overlap(box,other)));
}
export function placePiece(places,key,proposed){
 const piece=PIECES[key];
 if(!piece||key==='fox')return{places,blocked:true};
 const {label}=piece;
 const minX=2-Math.min(0,label.x);
 const minY=2-Math.min(0,label.y);
 const maxX=DESKTOP_SIZE.width-2-Math.max(piece.w,label.x+label.w);
 const maxY=DESKTOP_SIZE.height-2-Math.max(piece.h,label.y+label.h);
 const position={
  x:Math.max(minX,Math.min(maxX,proposed.x)),
  y:Math.max(minY,Math.min(maxY,proposed.y))
 };
 if(collides(places,key,position))return{places,blocked:true};
 return{places:{...places,[key]:position},blocked:false};
}
