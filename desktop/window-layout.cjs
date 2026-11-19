const {size:PET_SIZE} = require('./pet-layout.json');
const PANEL_SIZE = {width: 900, height: 740};
const bound = (value, min, max) => Math.round(Math.max(min, Math.min(value, max)));

function fitPet(position, area) {
 return fitPanel({...position,...PET_SIZE},area);
}
function fitPanel(rect, area) {
 const width=Math.min(rect.width, area.width);
 const height=Math.min(rect.height, area.height);
 return {width,height,
  x:bound(rect.x,area.x,area.x+area.width-width),
  y:bound(rect.y,area.y,area.y+area.height-height)
 };
}
function defaultPet(area) {
 return {x:area.x+area.width-PET_SIZE.width-20, y:area.y+area.height-PET_SIZE.height-20};
}
function petCenter({x,y}) {
 return {x:x+PET_SIZE.width/2,y:y+PET_SIZE.height/2};
}
const GAZE_MARGIN=126;
function gazeNear(bounds,x,y){
 return x>=-GAZE_MARGIN&&y>=-GAZE_MARGIN&&x<bounds.width+GAZE_MARGIN&&y<bounds.height+GAZE_MARGIN;
}
module.exports = {PET_SIZE,PANEL_SIZE,fitPet,fitPanel,defaultPet,petCenter,gazeNear};
