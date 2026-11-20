import han from './assets/camp/seated/han.webp';
import tang from './assets/camp/seated/tang.webp';
import miao from './assets/camp/seated/miao.webp';
import ming from './assets/camp/seated/ming.webp';

export const seatedVisitorArt = { han, tang, miao, ming };

export function seatedCostumeArt(outfit: string | null | undefined) {
  return outfit && Object.hasOwn(seatedVisitorArt, outfit)
    ? seatedVisitorArt[outfit as keyof typeof seatedVisitorArt]
    : undefined;
}
