import measurements from './costume-registration.json';

// Entries map source art coordinates into the matching default form's coordinate space.
// Strip entries fit the median silhouette and floor for the whole cycle, preserving
// the pose changes and foot motion within each clip.
export const registration = measurements;

export function costumeTransform(fit: readonly number[] | undefined) {
 if(!fit)return undefined;
 const [x,y,scale]=fit;
 return x===0&&y===0&&scale===1?undefined:`translate(${x} ${y}) scale(${scale})`;
}

export const defaultFoxTransform='translate(-60 -60) scale(1.5)';

export function foxStandTransform(outfit:string|undefined) {
 return costumeTransform(registration.foxStanding[outfit as keyof typeof registration.foxStanding])??defaultFoxTransform;
}

export function foxStripTransform(key:string|undefined) {
 return costumeTransform(registration.foxStrips[key as keyof typeof registration.foxStrips])??defaultFoxTransform;
}
