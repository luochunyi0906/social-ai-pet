const fs = require('node:fs/promises');
const path = require('node:path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const root = process.argv[2];
if (!root) throw Error('Pass the extracted liukanshan_assets_refined directory.');
const destination = path.resolve(__dirname, '../src/assets/companion');
const active = new Set(['act_idle','act_walk','act_run','act_sit','emo_thinking','emo_happy','emo_curious']);
// Restore the horizontal registration of the supplied sprite cuts without resizing.
const offsets = {act_sit:{5:21},act_sleep:{2:37,3:43,4:31}};
const profiles = {
 act_idle:{loop:[0,7]},
 act_walk:{loop:[0,7]},
 act_run:{loop:[0,7]},
 act_sit:{enter:[0,5],hold:5},
 act_sleep:{enter:[0,5],hold:5},
 emo_thinking:{loop:[0,2]},
 emo_happy:{enter:[0,5]},
 emo_curious:{enter:[0,5]}
};

async function run(){
 const manifest = JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));
 const clips = {};
 for (const clip of [...manifest.actions,...manifest.emotions]) {
  const folder = path.join(root,clip.folder);
  const frames = (await fs.readdir(folder)).filter(name=>name.endsWith('.png')).sort();
  if (clip.canvas.join()!=='256,256' || clip.foot_baseline_y!==232 || frames.length!==clip.frame_count ||
      !Number.isInteger(clip.fps) || clip.fps<1 || clip.fps>24) throw Error('Invalid clip: '+clip.id);
  await fs.mkdir(path.join(destination,clip.id),{recursive:true});
  for (const [index,name] of frames.entries()) {
   const n=index+1;
   if(name!==clip.id+'_'+String(n).padStart(3,'0')+'.png')throw Error('Frames out of sequence: '+clip.id);
   const bytes=await fs.readFile(path.join(folder,name));
   const pixels=await loadImage(bytes);
   if(pixels.width!==256||pixels.height!==256||bytes[25]!==6)throw Error('Expected a 256×256 RGBA PNG: '+name);
   const cleanup=clip.id==='act_sleep'&&(n===2||n===3);
   const x=offsets[clip.id]?.[n]??0;
   let result=bytes;
   if(cleanup||x!==0){
    const canvas=createCanvas(256,256);
    const ctx=canvas.getContext('2d');
    ctx.drawImage(pixels,x,0);
    if(cleanup)ctx.clearRect(200+x,180,256-(200+x),54);
    result=canvas.toBuffer('image/png');
   }
   await fs.writeFile(path.join(destination,clip.id,name),result);
  }
  clips[clip.id]={name:clip.name_zh,fps:clip.fps,frames,sourceLoop:clip.loop,active:active.has(clip.id),
   ...(profiles[clip.id]??{})};
 }
 if(Object.keys(clips).length!==14)throw Error('Expected fourteen clips.');
 await fs.writeFile(path.join(destination,'registry.json'),JSON.stringify({canvas:[256,256],footBaseline:232,clips},null,2)+'\n');
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
