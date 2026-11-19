export const dropTime={balance:260,fall:720,land:200};

export function fallingPosition(start,landing,progress){
 const t=Math.min(1,Math.max(0,progress));
 const pushOff=.25;
 const away=1-(1-t)**3.1;
 const fall=Math.max(0,(t-pushOff)/(1-pushOff))**2;
 return {
  x:start.x+(landing.x-start.x)*away,
  y:start.y+(landing.y-start.y)*fall-15*Math.sin(Math.PI*t)*(1-t)**2,
 };
}
