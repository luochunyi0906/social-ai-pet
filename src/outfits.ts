type OutfitAction = { frames: string[]; fps: number; loop: 'once' | 'hold' | 'repeat'; finish: string };
type Point = { x: number; y: number };
export type Outfit = {
 id: string;
 name: string;
 description: string;
 kind: 'full-character';
 canvas: { width: number; height: number };
 anchor: Point;
 scale: number;
 hitPath: string;
 preview: string;
 previewEdgeTrim?: number;
 actions: Record<string, OutfitAction>;
 triggers: Record<string, string>;
 unsupported: { walk: string; sleep: string };
};

export const DEFAULT_OUTFIT = 'default';
export const defaultCard = { id: DEFAULT_OUTFIT, name: '默认装扮', description: '刘看山原本的白色外观。' };
const manifests = import.meta.glob<Outfit>('../desktop/outfits/*.json', { eager: true, import: 'default' });
const assets = import.meta.glob<string>('./assets/outfits/*/*.{png,gif}', { eager: true, query: '?url&no-inline', import: 'default' });
export const assetUrl = (outfit: Outfit, file: string) => assets[`./assets/outfits/${outfit.id}/${file}`];

function hasValidMetadata(path: string, outfit: Outfit) {
 const frameName = /^[a-zA-Z0-9_-]+\.png$/;
 if (!outfit || outfit.kind !== 'full-character' || !/^[a-z][a-z0-9-]*$/.test(outfit.id) ||
     outfit.id === DEFAULT_OUTFIT || !path.endsWith(`/${outfit.id}.json`) || !outfit.name || !outfit.description || !outfit.hitPath ||
     !Number.isInteger(outfit.canvas?.width) || outfit.canvas.width < 1 ||
     !Number.isInteger(outfit.canvas?.height) || outfit.canvas.height < 1 ||
     !Number.isFinite(outfit.anchor?.x) || outfit.anchor.x < 0 || outfit.anchor.x > outfit.canvas.width ||
     !Number.isFinite(outfit.anchor?.y) || outfit.anchor.y < 0 || outfit.anchor.y > outfit.canvas.height ||
     !Number.isFinite(outfit.scale) || outfit.scale <= 0 || outfit.scale > 4 ||
     !/^[a-zA-Z0-9_-]+\.(gif|png)$/.test(outfit.preview) ||
     (outfit.previewEdgeTrim !== undefined &&
      (!Number.isFinite(outfit.previewEdgeTrim) || outfit.previewEdgeTrim < 0 || outfit.previewEdgeTrim > 3)) ||
     !outfit.actions?.idle || !outfit.triggers || !outfit.unsupported) return false;
 return Object.values(outfit.actions).every(action => action && Array.isArray(action.frames) && action.frames.length > 0 &&
  action.frames.every(frame => frameName.test(frame)) && action.fps > 0 && action.fps <= 60 &&
  ['once','hold','repeat'].includes(action.loop) && Boolean(outfit.actions[action.finish])) &&
  Object.values(outfit.triggers).every(name => Boolean(outfit.actions[name]));
}

const entries = Object.entries(manifests);
export const outfits = entries.filter(([path, outfit]) => hasValidMetadata(path, outfit)).map(([, outfit]) => outfit);
export const invalidOutfitCount = entries.length - outfits.length;
export const findOutfit = (id: string) => outfits.find(outfit => outfit.id === id);
export const idleFrame = (outfit: Outfit) => outfit.actions.idle.frames[0];

const decoded = new Map<string, Promise<void>>();
function decode(url: string, size?: Outfit['canvas']) {
 if (!url) return Promise.reject(Error('素材文件缺失。'));
 const existing = decoded.get(url);
 if (existing) return existing;
 const image = new Image();
 image.src = url;
 const task = image.decode().then(() => {
  if (size && (image.naturalWidth !== size.width || image.naturalHeight !== size.height)) {
   throw Error(`需要 ${size.width} × ${size.height} 的统一透明画布。`);
  }
 }).catch(error => {
  decoded.delete(url);
  throw error;
 });
 decoded.set(url, task);
 return task;
}

export function loadIdle(outfit: Outfit) {
 return decode(assetUrl(outfit, idleFrame(outfit)), outfit.canvas);
}

export function loadOutfitAction(outfit: Outfit, name: string) {
 const action = outfit.actions[name];
 return Promise.all(action.frames.map(frame => decode(assetUrl(outfit, frame), outfit.canvas)));
}

export async function checkOutfit(outfit: Outfit) {
 try {
  await Promise.all([
   ...Object.keys(outfit.actions).map(name => loadOutfitAction(outfit, name)),
   decode(assetUrl(outfit, outfit.preview))
  ]);
 } catch {
  throw Error(`「${outfit.name}」有缺失或尺寸不兼容的素材。当前装扮仍然有效。`);
 }
}

export function outfitPlacement(outfit: Outfit) {
 return { x: 120 - outfit.anchor.x * outfit.scale, y: 296 - outfit.anchor.y * outfit.scale };
}
