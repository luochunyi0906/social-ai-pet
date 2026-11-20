import { skipGuide } from './skip-guide.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {DESKTOP_SIZE} from '../src/shared/layout.mjs';

const require = createRequire(import.meta.url);
const core = require('../desktop/core.cjs');
const root = fileURLToPath(new URL('../',import.meta.url));
const runFile = promisify(execFile);
async function pointer(...args) {
  const result = await runFile('/usr/bin/python3',[join(root,'tests/native/macos-pointer.py'),...args.map(String)]);
  return JSON.parse(result.stdout);
}

export async function run() {
  const profile = await mkdtemp(join(tmpdir(), 'kanshan-woodland-desktop-'));
  const executablePath = resolve(root,process.env.KANSHAN_PACKAGE_DIR||'release','看山有伴.app/Contents/MacOS/Kanshan');
  const artifacts = process.env.KANSHAN_WOODLAND_ARTIFACTS||join(root,'artifacts');
  await mkdir(artifacts, { recursive: true });
  const old = core.addFavorite(core.emptyStore(), {kind:'generated_question',title:'旧版收藏验收',keywords:'旧版收藏',simulated:true});
  const original = JSON.stringify(old);
  await writeFile(join(profile, 'garden-v1.json'), original);
  await writeFile(join(profile, 'model.env'), 'CHAT_PROVIDER=existing\nSEARCH_PROVIDER=bing-rss\nMODEL_PROVIDER=openai-compatible\nMODEL_NAME=fixture\nMODEL_API_KEY=fixture-only\n');
  const checks = [];
  const mark = (scene, detail) => { checks.push({ scene, detail }); console.log('PASS',scene); };
  let app, page;
  const originalPointer = await pointer('position');
  const eventPermission = await pointer('access');
  const state = async () => JSON.parse(await readFile(join(profile, 'garden-v3.json'), 'utf8'));
  const windowState = () => app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.fromId(1);
    return { bounds: win.getBounds(), resizable: win.isResizable(), floating: win.isAlwaysOnTop(), background: win.getBackgroundColor() };
  });
  async function launch() {
    app = await electron.launch({executablePath, env:{...process.env,KANSHAN_DATA_DIR:profile,MODEL_API_KEY:'fixture-only',MODEL_PROVIDER:'openai-compatible',MODEL_NAME:'fixture',ZHIHU_ACCESS_SECRET:''}, timeout:20000});
    page = await app.firstWindow();
    await skipGuide(page);
    page.setDefaultTimeout(7500);
    await page.locator('.desktop-pet').waitFor();
    await page.waitForFunction(async () => (await window.kanshan.load()).ok);
  }
  const button = (name) => page.getByRole('button', {name,exact:true});
  const fromDesktop = () => page.locator('.pet-fox .fox-costume-hit').dblclick();
  const area = () => app.evaluate(({screen}) => screen.getPrimaryDisplay().workArea);
  async function pointFor(selector) {
    const box = await page.locator(selector).boundingBox();
    assert.ok(box,selector);
    return {x:Math.round(box.x+box.width/2),y:Math.round(box.y+box.height/2)};
  }
  async function dragTo(selector, target) {
    const start=(await windowState()).bounds;
    const point=await pointFor(selector);
    const origin={x:start.x+point.x,y:start.y+point.y};
    await pointer('warp',origin.x,origin.y);
    await page.waitForTimeout(80);
    // CDP presses in the app, so a real cursor warp during that simulated press would cancel Chromium capture.
    // The cursor sample is controlled here; the renderer gesture and BrowserWindow moves are real.
    await app.evaluate(({screen},origin)=>{
      globalThis.campOriginalCursor=screen.getCursorScreenPoint;
      globalThis.campTestCursor=origin;
      screen.getCursorScreenPoint=()=>globalThis.campTestCursor;
    },origin);
    try {
      await page.mouse.move(point.x,point.y);
      await page.mouse.down();
      await page.mouse.move(point.x+3,point.y);
      assert.deepEqual((await windowState()).bounds,start);
      await page.mouse.move(point.x+9,point.y);
      await page.locator(selector.startsWith('.pet')?'.desktop-pet.camp-dragging':'.camp-title-board.is-dragging').waitFor();
      await app.evaluate((_,point)=>{globalThis.campTestCursor=point;},{x:target.x+point.x,y:target.y+point.y});
      await page.waitForTimeout(100);
      const during=(await windowState()).bounds;
      await page.mouse.up();
      const after=(await windowState()).bounds;
      assert.ok(Math.abs(after.x-target.x)<=1 && Math.abs(after.y-target.y)<=1,JSON.stringify({start,during,after,target}));
      assert.deepEqual(during,after);
      assert.deepEqual([after.width,after.height],[start.width,start.height]);
      return {from:start,to:after,grab:point};
    } finally {
      await app.evaluate(({screen})=>{screen.getCursorScreenPoint=globalThis.campOriginalCursor;});
    }
  }
  async function verifyPhysicalCursor(target) {
    const start=(await windowState()).bounds;
    const point=await pointFor('.pet-camp-grip');
    await pointer('warp',start.x+point.x,start.y+point.y);
    const res=await page.evaluate(point=>window.kanshan.startWindowDrag({surface:'pet',...point}),point);
    assert.ok(res.ok&&res.data);
    const actual=await pointer('warp',target.x+point.x,target.y+point.y);
    await page.waitForTimeout(100);
    const moved=(await windowState()).bounds;
    await page.evaluate(()=>window.kanshan.endWindowDrag('pet',true));
    assert.equal(actual.error,0);
    assert.ok(Math.abs(moved.x-target.x)<=1&&Math.abs(moved.y-target.y)<=1,JSON.stringify({start,target,actual,moved}));
    return {from:start,to:moved,systemCursor:actual.position};
  }
  async function verifySystemRouting() {
    const info = await app.evaluate(async ({BrowserWindow})=>{
      const front=BrowserWindow.fromId(1);
      const {x,y,width,height}=front.getBounds();
      const back=new BrowserWindow({x:x-25,y:y-4,width:width+76,height:height+31,frame:false,show:false,backgroundColor:'#dce6cf'});
      await back.loadURL('data:text/html,<body style="background:%23dce6cf">Native pointer fixture</body>');
      back.showInactive();
      globalThis.campPointerFixture=back;
      return {pid:process.pid,front:front.getBounds(),back:back.getBounds()};
    });
    try {
      await page.waitForTimeout(140);
      const native=await pointer('windows',info.pid);
      const number = bounds=>native.find(item=>item.bounds?.X===bounds.x&&item.bounds?.Y===bounds.y&&item.bounds?.Width===bounds.width&&item.bounds?.Height===bounds.height)?.number;
      const front=number(info.front),back=number(info.back);
      assert.ok(front&&back,JSON.stringify({info,native}));
      await pointer('warp',info.front.x+5,info.front.y+5);
      await page.waitForTimeout(100);
      const routedBlank=await pointer('route',info.front.x+5,info.front.y+5);
      assert.equal(routedBlank,back,JSON.stringify({info,front,back,routedBlank, below:await pointer('route',info.front.x+5,info.front.y+5,front)}));
      const nose=await pointFor('.pet-fox .fox-costume-hit');
      await pointer('warp',info.front.x+nose.x,info.front.y+nose.y);
      await page.waitForTimeout(100);
      assert.equal(await pointer('route',info.front.x+nose.x,info.front.y+nose.y),front,'System mouse-down routing should hit fox artwork');
      return {openSpace:'lower native window',paintedFox:'pet native window'};
    } finally {
      await app.evaluate(()=>globalThis.campPointerFixture.destroy());
    }
  }
  async function verifyDecorationRouting() {
    const info=await app.evaluate(async ({BrowserWindow})=>{
      const front=BrowserWindow.fromId(1);
      const r=front.getBounds();
      const back=new BrowserWindow({x:r.x-12,y:r.y-12,width:r.width+24,height:r.height+24,frame:false,show:false});
      await back.loadURL('data:text/html,<body style="background:%23e6e1d0">');
      back.showInactive();
      globalThis.woodlandRoutingFixture=back;
      return {pid:process.pid,origin:r,back:back.getBounds()};
    });
    try {
      const native=await pointer('windows',info.pid);
      const number=b=>native.find(x=>x.bounds?.X===b.x&&x.bounds?.Y===b.y&&x.bounds?.Width===b.width&&x.bounds?.Height===b.height)?.number;
      const r=info.origin, below=number(info.back), front=number(r);
      assert.ok(front&&below);
      const checks=[
        ['可拖动地台',{x:168,y:162},front],
        ['透明角落',{x:5,y:5},below],
        ['花箱',await pointFor('.pet-garden .pet-hit path'),front],
        ['石洞',await pointFor('.pet-cave .pet-hit path'),front],
        ['信箱',await pointFor('.pet-feed .pet-hit path'),front],
        ['花园标签',await pointFor('.pet-garden .pet-caption'),front],
        ['山洞标签',await pointFor('.pet-cave .pet-caption'),front],
        ['投喂标签',await pointFor('.pet-feed .pet-caption'),front]
      ];
      for(const [name,point,expected] of checks){
        await pointer('warp',r.x+point.x,r.y+point.y);
        await page.waitForTimeout(100);
        const actual=await pointer('route',r.x+point.x,r.y+point.y);
        if(actual!==expected){
          const hit=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.outerHTML.split('>')[0],point);
          assert.equal(actual,expected,JSON.stringify({name,point,front,below,hit}));
        }
      }
      return checks.map(([name,,target])=>[name,target===front?'桌宠':'后方原生窗口']);
    }finally { await app.evaluate(()=>globalThis.woodlandRoutingFixture.destroy()); }
  }
  async function captureWallpapers() {
    const frame=await app.evaluate(({BrowserWindow,screen})=>{
      const pet=BrowserWindow.fromId(1);
      const original=pet.getBounds();
      const {width,height}=original;
      const work=screen.getPrimaryDisplay().workArea;
      const x=work.x+Math.round((work.width-width)/2);
      const y=work.y+32;
      pet.setPosition(x,y);
      const rect={x:x-16,y:y-16,width:width+32,height:height+32};
      globalThis.woodlandWallpaper=new BrowserWindow({x:rect.x-12,y:rect.y-12,width:rect.width+24,height:rect.height+24,frame:false,show:false});
      return {x,y,rect,original};
    });
    const themes=[
      ['light','#eee7d8','.pet-garden'],
      ['dark','#202a2e','.pet-cave'],
      ['photo','photo','.pet-feed']
    ];
    const output=[];
    try{
      for(const [theme,style,selector] of themes){
        await app.evaluate(async ({nativeImage},style)=>{
          let background=style;
          if(style==='photo'){
            const jpeg=nativeImage.createFromPath('/System/Library/Wallpapers/.default/DefaultAerial.jpg').resize({width:620}).toJPEG(91).toString('base64');
            if(!jpeg)throw Error('Missing system QA photo');
            background=`url(data:image/jpeg;base64,${jpeg}) center 67% / cover`;
          }
          const source=`<meta charset="utf-8"><style>html,body{width:100%;height:100%;padding:0;margin:0;background:${background}}</style>`;
          const back=globalThis.woodlandWallpaper;
          await back.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(source));
          back.showInactive();
        },style);
        await pointer('warp',frame.x+5,frame.y+5);
        await page.mouse.move(5,5);
        await page.waitForTimeout(200);
        assert.equal(await page.locator('.pet-object .pet-caption:visible').count(),3);
        assert.equal(await page.locator('.pet-caption-context:visible').count(),0);
        const {rect}=frame;
        async function capture(state){
          const file=join(artifacts,`woodland-${theme}-${state}.png`);
          await runFile('/usr/sbin/screencapture',['-x',`-R${rect.x},${rect.y},${rect.width},${rect.height}`,file]);
          assert.ok((await readFile(file)).length>1000);
          output.push({theme,state,file:file.split('/').at(-1),logicalCapture:[rect.width,rect.height]});
        }
        await capture('default');
        const hit=page.locator(selector+' .pet-hit path');
        const box=await hit.boundingBox();
        await pointer('warp',Math.round(frame.x+box.x+box.width/2),Math.round(frame.y+box.y+box.height/2));
        await hit.hover();
        assert.equal(await page.locator(selector+' .pet-caption:visible').count(),1);
        await page.waitForTimeout(210);
        await capture('hover');
      }
      await pointer('warp',frame.x+5,frame.y+5);
      await page.mouse.move(5,5);
      await page.keyboard.press('Tab');
      await page.locator('.pet-fox .pet-caption-context').waitFor();
      assert.equal(await page.locator('.pet-fox:focus-visible').count(),1);
      return output;
    }finally {
      await app.evaluate(({BrowserWindow},original)=>{
        globalThis.woodlandWallpaper.destroy();
        BrowserWindow.fromId(1).setBounds(original);
      },frame.original);
    }
  }
  async function checkDesktopEntries() {
    for(const [key,marker] of [['garden','.camp-plot'],['cave','.discovery-panel'],['feed','.feed-modal']]){
      const prop=page.locator('.pet-'+key+' .pet-hit path');
      await prop.click();
      if(key==='cave'){
        const lounge=page.getByRole('region',{name:'秘密基地',exact:true});
        await lounge.waitFor();
        assert.equal(await page.getByRole('region',{name:'山洞探索桌',exact:true}).count(),0);
        assert.equal(await page.locator('.cave-reveal').count(),0);
        await lounge.getByRole('button',{name:'探索桌',exact:true}).click();
        await button('山洞入口').click();
        const secret=page.getByRole('dialog',{name:'山洞换装间'});
        await secret.getByRole('button',{name:'离开',exact:true}).click();
      }
      await page.locator(marker).first().waitFor();
      await page.keyboard.press('Escape');
      await page.locator('.desktop-pet').waitFor();
      await page.waitForFunction(({width,height})=>innerWidth===width&&innerHeight===height,DESKTOP_SIZE);
    }
    await app.evaluate(({Menu})=>{
      const nativePopup=Menu.prototype.popup;
      Menu.prototype.popup=function(options){
        globalThis.woodlandMenu={instance:this,window:options.window,labels:this.items.map(x=>x.label)};
        return nativePopup.call(this,options);
      };
    });
    assert.equal(await page.locator('.pet-menu').count(),0);
    await page.locator('.pet-fox .fox-costume-hit').click({button:'right'});
    const menu=await app.evaluate(async ()=>{
      while(!globalThis.woodlandMenu)await new Promise(resolve=>setTimeout(resolve,10));
      return globalThis.woodlandMenu.labels;
    });
    assert.ok(menu.includes('重置桌面布局'));
    assert.ok(menu.includes('模型与检索设置'));
    assert.ok(menu.includes('去窗口边上玩'));
    await app.evaluate(()=>globalThis.woodlandMenu.instance.closePopup());
    return ['花箱打开九田','桌面山洞直进秘密基地，从探索桌播放彩蛋','信箱打开投喂窗口','右键刘看山打开原生菜单'];
  }
  const closeSheet = (label) => button('关闭'+label).click();
  const clickPlot = (slot) => page.locator('.camp-plot').filter({has:page.locator('text',{hasText:slot})}).locator('.camp-soil').click();
  const assertVisible = (selector, value) => page.locator(selector).filter({hasText:value}).first().waitFor();
  async function hit(selector, owner=selector) {
    const box = await page.locator(selector).boundingBox();
    assert.ok(box,selector);
    assert.equal(await page.evaluate(({box,owner}) => !!document.elementFromPoint(box.x+box.width/2,box.y+box.height/2)?.closest(owner),{box,owner}),true,selector);
  }
  try {
    await launch();
    const pet = await windowState();
    assert.deepEqual([pet.bounds.width,pet.bounds.height],[DESKTOP_SIZE.width,DESKTOP_SIZE.height]);
    assert.equal(pet.floating,true);
    assert.equal(pet.resizable,false);
    assert.equal(await page.locator('.pet-piece').count(),4);
    assert.equal(await page.locator('.camp-shell').count(),0);
    const transparentAlpha = await app.evaluate(async ({BrowserWindow}) => {
      const bitmap = (await BrowserWindow.fromId(1).capturePage()).toBitmap();
      return bitmap[3];
    });
    assert.equal(transparentAlpha,0,'Electron native capture should have a transparent corner');
    const clear = await page.evaluate(() => !!document.elementFromPoint(5,5)?.closest('[data-hit]'));
    assert.equal(clear,false);
    await page.screenshot({path:join(artifacts,'native-desktop-pet.png'),omitBackground:true});
    mark('macOS 开发预览默认使用透明、置顶、304 × 176 的小窗',pet);
    assert.deepEqual(await page.locator('.pet-object .pet-caption:visible').allTextContents(),['好奇心花园','好奇心山洞','投喂线索']);
    assert.equal(await page.locator('.pet-snowy-ground').count(),1);
    assert.equal(await page.locator('.pet-snowy-flurries').count(),1);
    for(const [key,asset] of [['garden','garden'],['cave','cave'],['feed','mailbox']]){
      const source=await page.locator(`.pet-${key} .pet-art img`).evaluate(async image=>{
        await image.decode();
        return new URL(image.currentSrc).pathname;
      });
      assert.ok(source.includes(`/assets/${asset}-`)&&source.endsWith('.png'),source);
    }
    mark('透明小窗在三种壁纸上的默认、悬停与键盘聚焦',await captureWallpapers());
    mark('雪地台支持原生拖动，透明空白穿透，三件道具命中桌宠',await verifyDecorationRouting());
    mark('三个道具入口和角色右键菜单进入对应原生功能',await checkDesktopEntries());

    const desk=await area();
    const across=await dragTo('.pet-camp-grip',{x:desk.x+desk.width-DESKTOP_SIZE.width,y:desk.y+210});
    assert.ok(across.to.x-pet.bounds.x>desk.width/2);
    assert.equal(await page.locator('.camp-shell').count(),0);
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.camp-shell').count(),0);
    mark('跨桌面移动原生小窗，保持抓取偏移和尺寸，松手未展开',across);
    mark('原生窗口拖动会采样 macOS 当前真实指针位置',await verifyPhysicalCursor({x:desk.x+62,y:desk.y+220}));
    const edge=await verifyPhysicalCursor({x:desk.x+desk.width-DESKTOP_SIZE.width,y:desk.y+205});
    assert.equal(edge.to.x+edge.to.width,desk.x+desk.width);
    const recovered=await verifyPhysicalCursor({x:desk.x+62,y:desk.y+220});
    const storedPet=recovered.to;
    mark('贴近屏幕右缘时整座营地和拖动手柄留在工作区',edge);
    await page.locator('.pet-fox:not(.is-away)').waitFor({timeout:23000});
    mark('AppKit 原生鼠标命中规则确认透明区交给后方窗口',await verifySystemRouting());
    await fromDesktop();
    await page.locator('.camp-shell').waitFor();
    const opened = await windowState();
    assert.equal(opened.resizable,true);
    assert.equal(opened.floating,false);
    assert.equal(await page.locator('.camp-plot').count(),9);
    assert.equal(await page.evaluate(() => location.protocol),'file:');
    const art = await page.evaluate(async () => {
      const selectors = ['.camp-terrain','.camp-bench img'];
      return Promise.all(selectors.map(async selector => {
        const style = getComputedStyle(document.querySelector(selector)).backgroundImage;
        const image = new Image();
        image.src = document.querySelector(selector).currentSrc || style.slice(5,-2);
        await image.decode();
        return [image.naturalWidth,image.naturalHeight];
      }));
    });
    assert.deepEqual(art,[[1383,1137],[400,507]]);
    assert.deepEqual(await Promise.all(['far','mid','near'].map(depth=>page.locator(`.camp-snow .snowfall-${depth} i`).count())),[25,20,9]);
    assert.equal(await page.locator('.camp-snow .snowfall-crystal').count(),3);
    const flakes = () => page.locator('.camp-snow i').first().evaluate(el=>({transform:getComputedStyle(el).transform,events:getComputedStyle(el).pointerEvents}));
    const f1=await flakes();await page.waitForTimeout(135);const f2=await flakes();
    assert.notEqual(f1.transform,f2.transform);assert.equal(f2.events,'none');
    assert.equal(await button('营地飘雪').getAttribute('aria-pressed'),'true');
    const frameGap=()=>page.evaluate(()=>new Promise(resolve=>{
      const times=[];
      function sample(time){times.push(time);if(times.length<26)requestAnimationFrame(sample);
        else resolve({meanMs:(times.at(-1)-times[0])/(times.length-1),maxMs:Math.max(...times.slice(1).map((t,i)=>t-times[i]))});}
      requestAnimationFrame(sample);
    }));
    const snowOnFrames=await frameGap();
    const dragOn=await dragTo('.camp-title-board',{x:desk.x+128,y:desk.y+75});
    await button('营地飘雪').click();
    await page.locator('.camp-snow').waitFor({state:'detached'});
    const snowOffFrames=await frameGap();
    const dragOff=await dragTo('.camp-title-board',{x:desk.x+188,y:desk.y+105});
    mark('标题牌两次移动整个主窗口，开启和关闭分层飘雪均保留窗口尺寸',{dragOn,dragOff,flakes:54,snowOnFrames,snowOffFrames});
    await button('营地飘雪').click();
    await page.locator('.camp-snow').waitFor();
    await app.evaluate(({BrowserWindow})=>BrowserWindow.fromId(1).minimize());
    await page.locator('.camp-snow').waitFor({state:'detached'});
    await app.evaluate(({BrowserWindow})=>{
      const win=BrowserWindow.fromId(1);
      win.restore();win.show();win.focus();
    });
    await page.locator('.camp-snow').waitFor();
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('.camp-snow').evaluate(el=>getComputedStyle(el).display),'none');
    await page.emulateMedia({reducedMotion:'no-preference'});
    mark('最小化卸载雪花，恢复后重建，尊重减少动态设置');
    mark('点击桌宠角色打开可缩放的原生营地，加载分层背景与道具', {opened,art});
    for (const [width,height] of [[900,740],[720,620],[600,620]]) {
      await app.evaluate(({BrowserWindow},size)=>BrowserWindow.fromId(1).setSize(...size),[width,height]);
      await page.waitForFunction(([width,height])=>innerWidth===width&&innerHeight===height,[width,height]);
      for (const name of ['mail','seed','water','fertilizer','journal','fox']) await hit('.camp-'+name);
      await hit('.camp-bench > span', '.camp-bench');
      assert.equal(await page.locator('.camp-cave').count(), 0);
      await page.locator('.camp-seed span').click();
      await page.getByRole('region',{name:'怎么播种',exact:true}).waitFor();
      await closeSheet('怎么播种');
      await button('收藏手账').click();
      await page.getByRole('region',{name:'收藏手账'}).waitFor();
      await button('关闭收藏手账').click();
      await page.locator('.camp-cabin span').click();
      await page.getByRole('region',{name:'暖木小屋'}).waitFor();
      await button('返回营地').click();
      for (let i=0;i<9;i++) {
        const shape=page.locator('.camp-soil').nth(i);
        const box=await shape.boundingBox();
        assert.equal(await page.evaluate(({x,y})=>Boolean(document.elementFromPoint(x,y)?.closest('.camp-plot')),
          {x:box.x+box.width/2,y:box.y+box.height/2}),true);
      }
      await page.screenshot({path:join(artifacts,`native-camp-${width}x${height}.png`)});
      mark(`${width} × ${height} 下种子箱可打开，长椅、主要道具和九块田可点击`);
    }

    const beforeUsingControls=(await windowState()).bounds;
    await button('投喂线索').click();
    assert.equal(await button('开始本地模拟').isEnabled(),false);
    await button('机器人信任样例').click();
    await page.locator('.consent input').check();
    await button('开始本地模拟').click();
    await page.locator('.question-card').first().waitFor();
    assert.equal(await page.locator('.question-card').count(),3);
    await app.evaluate(() => {
      globalThis.fetch = async url => {
        if (String(url).includes('/chat/completions')) {
          return Response.json({choices:[{message:{content:JSON.stringify({text:'我听见了。我们可以在营地坐一会儿。',tone:'warm'})},finish_reason:'stop'}]});
        }
        return new Response('<rss><channel><item><title>机器人与信任（验收夹具）</title><link>https://www.zhihu.com/question/123456</link></item></channel></rss>');
      };
    });
    await button('主动检索知乎').click();
    await page.getByRole('textbox',{name:'本次关键词'}).pressSequentially('机器人 信任');
    assert.equal(await page.getByRole('textbox',{name:'本次关键词'}).inputValue(),'机器人 信任');
    await page.locator('.search-modal .consent input').check();
    await page.locator('.search-modal').getByRole('button',{name:'查找真实知乎内容',exact:true}).click();
    await assertVisible('.post-card','搜索索引结果');
    const heading=page.locator('.post-card h3');
    await heading.scrollIntoViewIfNeeded();
    const headingBox=await heading.boundingBox();
    await page.mouse.move(headingBox.x+4,headingBox.y+headingBox.height/2);
    await page.mouse.down();
    await page.mouse.move(headingBox.x+92,headingBox.y+headingBox.height/2,{steps:9});
    await page.mouse.up();
    assert.match(await page.evaluate(()=>getSelection()?.toString()||''),/机器人/);
    const reader=page.locator('.camp-sheet-body');
    const readBox=await reader.boundingBox();
    await page.mouse.move(readBox.x+readBox.width-38,readBox.y+readBox.height/2);
    await page.mouse.wheel(0,260);
    await page.waitForTimeout(170);
    assert.ok(await reader.evaluate(el=>el.scrollTop>0));
    assert.deepEqual((await windowState()).bounds,beforeUsingControls);
    mark('飘雪期间字框可输入、拖选正文和滚动，窗口未移动');

    await button('检索演示 · 离线回放').click();
    await assertVisible('.post-card','离线回放');
    await assertVisible('.post-card','未包含摘要或全文');
    await assertVisible('.post-card','https://www.zhihu.com/question/586758033/answer/2916132178');
    await button('收藏这条来源').click();
    await page.waitForFunction(async () => (await window.kanshan.load()).data?.favorites.length===2);
    await button('收藏这条来源').click();
    await page.waitForTimeout(160);
    assert.equal((await state()).favorites.length,2);
    mark('逐次授权、知乎索引与离线回放清楚分开，收藏去重并发种', '网络检索响应为夹具');
    await closeSheet('山洞探索桌');

    await clickPlot('A1');
    // 旧版迁移的开花植物占用 A1，保留原槽位。
    await assertVisible('.camp-sheet','A1 · 已开花');
    await button('种子箱 · 1').click();
    const picker = page.getByRole('combobox',{name:'选择要播的植物'});
    await picker.selectOption('tulip');
    assert.equal((await state()).plants.length,1);
    await button('播种郁金香').click();
    await assertVisible('.camp-sheet','A2 · 已播种');
    assert.equal((await state()).plants.find(plant=>plant.slot===1).variety,'tulip');
    await button('拿起水壶').click();
    await clickPlot('A2');
    await assertVisible('.camp-sheet','水已经浇进土里了');
    await clickPlot('C3');
    await assertVisible('.camp-sheet','这块田还没有种子');
    await button('拿起肥料').click();
    await clickPlot('A2');
    await assertVisible('.camp-sheet','养分已经补上了');
    assert.equal((await state()).plants.find(plant=>plant.slot===1).stage,'sprout');
    await clickPlot('A2');
    await assertVisible('.camp-sheet','养分充足');
    await button('拿起水壶').click();
    await clickPlot('A2');
    await assertVisible('.camp-sheet','水分充足');
    await button('收藏手账').click();
    await button('回到这块田 · A2').click();
    await assertVisible('.camp-sheet','A2 · 幼苗');
    await page.screenshot({path:join(artifacts,'native-camp-after-care.png')});
    mark('选择品种并播种到首块空田、选择工具点田、空田反馈及手账返回');
    await button('和刘看山互动，可双击打开聊天').dblclick();
    await page.locator('.chat-modal textarea').fill('你好，营地');
    await page.locator('.chat-modal .consent input').check();
    await button('发送').click();
    await assertVisible('.chat-modal','我听见了。');
    assert.deepEqual((await windowState()).bounds,beforeUsingControls);
    await button('关闭对话').click();
    await button('营地飘雪').click();
    await page.locator('.camp-snow').waitFor({state:'detached'});
    const storedPanel=(await windowState()).bounds;
    mark('飘雪期间正常播种、照料和发送消息，窗口位置稳定');

    await page.keyboard.press('Escape');
    await page.locator('.desktop-pet').waitFor();
    await page.waitForFunction(({width,height})=>innerWidth===width&&innerHeight===height,DESKTOP_SIZE);
    const restored=await windowState();
    assert.deepEqual(restored.bounds,storedPet);
    assert.equal(restored.floating,true);
    assert.equal(restored.resizable,false);
    mark('收起、恢复原桌面位置及置顶',restored);
    await fromDesktop();
    await page.waitForFunction(()=>innerWidth===600&&innerHeight===620);
    assert.deepEqual((await windowState()).bounds,storedPanel);
    await button('收回桌面').click();
    await page.locator('.desktop-pet').waitFor();
    await app.close();
    await launch();
    assert.deepEqual((await windowState()).bounds,storedPet);
    await fromDesktop();
    await page.locator('.camp-shell').waitFor();
    const reopened=(await windowState()).bounds;
    assert.deepEqual(reopened,storedPanel);
    assert.equal(await button('营地飘雪').getAttribute('aria-pressed'),'false');
    assert.equal(await page.locator('.camp-snow').count(),0);
    mark('收起、展开和进程重启分别恢复两态位置，保存飘雪偏好');
    const reloaded=await state();
    assert.equal(reloaded.favorites.length,2);
    assert.equal(reloaded.favorites[0].id,old.favorites[0].id);
    assert.equal(reloaded.plants.find(plant=>plant.slot===0).stage,'flower');
    assert.equal(reloaded.plants.find(plant=>plant.slot===1).stage,'sprout');
    assert.ok(reloaded.plants.find(plant=>plant.slot===1).wateredAt);
    assert.ok(reloaded.plants.find(plant=>plant.slot===1).fertilizedAt);
    assert.equal(await readFile(join(profile,'garden-v1.json'),'utf8'),original);
    mark('重启保留旧收藏与新植物，原 v1 文件逐字节一致');
    await app.close();
    await writeFile(join(profile,'window-preferences.json'),JSON.stringify({
      version:1,pet:{x:-7500,y:-4400},panel:{width:900,height:740,x:7800,y:3400},snow:false
    }));
    await launch();
    const clampedPet=(await windowState()).bounds;
    assert.ok(clampedPet.x+94>=desk.x-1&&clampedPet.y+12>=desk.y-1);
    await fromDesktop();
    await page.locator('.camp-shell').waitFor();
    await page.waitForFunction(()=>innerWidth===900&&innerHeight===740);
    const clampedPanel=(await windowState()).bounds;
    const currentDesk=await area();
    assert.ok(clampedPanel.x>=currentDesk.x&&clampedPanel.x+clampedPanel.width<=currentDesk.x+currentDesk.width,JSON.stringify({clampedPanel,currentDesk}));
    assert.ok(clampedPanel.y>=currentDesk.y&&clampedPanel.y+clampedPanel.height<=currentDesk.y+currentDesk.height,JSON.stringify({clampedPanel,currentDesk}));
    mark('模拟已拔除屏幕的陈旧坐标，原生应用重启后把两个窗口恢复到可用区',{clampedPet,clampedPanel});
    await writeFile(join(artifacts,'desktop-woodland-results.json'),JSON.stringify({checks, eventPermission,limitations:['检索和对话为固定夹具','应用内拖动手势搭配可控坐标样本；另启动拖动会话验证真实 macOS 指针能驱动原生窗口。透明区通过 AppKit 原生命中查询验证。','未接入第二块显示器']},null,2)+'\n');
    return checks;
  } finally {
    await app?.close().catch(()=>{});
    await pointer('warp',originalPointer.x,originalPointer.y).catch(()=>{});
    await rm(profile,{recursive:true,force:true});
  }
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) await run();
