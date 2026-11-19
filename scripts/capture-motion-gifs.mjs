// Render the current desktop motion art at deterministic times.
import {mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {build} from 'vite';
import {chromium} from 'playwright';

const destination=resolve(process.argv[2]||'artifacts/motion-reference');
const outfit=process.argv[3]||'default';
const fixture=join(destination,'page-'+outfit);
await mkdir(destination,{recursive:true});
await build({configFile:false,base:'./',logLevel:'error',build:{outDir:fixture,emptyOutDir:true,
 rollupOptions:{input:resolve('scripts/motion-preview/index.html')}}});
const browser=await chromium.launch({executablePath:process.env.KANSHAN_CHROMIUM_PATH,headless:true,args:['--allow-file-access-from-files']});
const run=promisify(execFile);
const fps=20;
try{
 const page=await browser.newPage({viewport:{width:864,height:322},deviceScaleFactor:1});
 await page.goto(pathToFileURL(join(fixture,'scripts/motion-preview/index.html')).href);
 await page.waitForFunction(()=>typeof window.setPreviewFrame==='function');
 const cases=[['walk','走路',1.65],['run','跑步',1.16],['climb','攀爬',3.5],['drop','切窗掉落',3.2]];
 const suffix=outfit==='rain'?'戴帽雨衣':outfit==='dressed'?'换装':'参考';
 if(outfit==='rain'){
  await page.evaluate(()=>window.setPreviewFrame('rain',0,'rain'));
  await page.waitForFunction(()=>document.querySelectorAll('[data-rain-hood]').length>=3);
  await page.evaluate(async()=>{
   await Promise.all([...document.querySelectorAll('image')].map(element=>{
    const image=new Image();image.src=element.getAttribute('href');return image.decode();
   }));
  });
  await page.screenshot({path:join(destination,'三种外观-戴帽雨衣.png')});
 }
 for(const [mode,label,duration] of cases){
  if(process.argv[4]&&process.argv[4]!==mode)continue;
  const base=`${label}-${suffix}`;
  const frames=join(destination,base);
  await mkdir(frames,{recursive:true});
  const count=Math.round(duration*fps);
  await page.evaluate(({mode,outfit})=>window.setPreviewFrame(mode,0,outfit),{mode,outfit});
  if(mode!=='drop')await page.waitForFunction(()=>document.querySelector('.human-body-motion[data-limb-view="side"],.human-walk-art')&&document.querySelector('.fox-motion-strip'));
  for(let index=0;index<count;index++){
   await page.evaluate(({mode,index,count,outfit,duration})=>{
    window.setPreviewFrame(mode,index/count,outfit);
    for(const animation of document.getAnimations()){
     animation.pause();
     const target=animation.effect?.target;
     const phase=target?.closest('.model')?.getAttribute('data-animation-ms');
     animation.currentTime=phase===null||phase===undefined?1000*duration*index/count:Number(phase);
    }
   },{mode,index,count,outfit,duration});
   await page.screenshot({path:join(frames,`${String(index).padStart(3,'0')}.png`)});
  }
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate',String(fps),'-i',join(frames,'%03d.png'),
   '-filter_complex','split[a][b];[a]palettegen[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',join(destination,base+'.gif')]);
  console.log(base,count);
 }
}finally{await browser.close();}
