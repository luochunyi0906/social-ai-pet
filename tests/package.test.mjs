import test from'node:test';import assert from'node:assert/strict';import{readFile,readdir,realpath,access}from'node:fs/promises';import{existsSync}from'node:fs';import{execFileSync}from'node:child_process';import{resolve,join,sep}from'node:path';
const app=resolve('release/看山有伴.app'),available=process.platform==='darwin'&&existsSync(app);
const plist=p=>JSON.parse(execFileSync('/usr/bin/plutil',['-convert','json','-o','-',p],{encoding:'utf8'}));
test('实际Mac应用可执行文件、四类helper齐全，签名完整', {skip:!available},async()=>{
 const info=plist(join(app,'Contents/Info.plist'));assert.equal(info.CFBundleIdentifier,'com.justinaluo.kanshan.woodland-preview');await access(join(app,'Contents/MacOS',info.CFBundleExecutable));
 for(const suffix of ['', ' (Renderer)', ' (GPU)', ' (Plugin)']){const dir=join(app,'Contents/Frameworks','Electron Helper'+suffix+'.app');const helper=plist(join(dir,'Contents/Info.plist'));assert.equal(helper.CFBundlePackageType,'APPL');await access(join(dir,'Contents/MacOS','Electron Helper'+suffix));}
 execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',app]);const runtime=JSON.parse(await readFile(join(app,'Contents/Resources/app/package.json'),'utf8'));assert.equal(runtime.main,'desktop/main.cjs');assert.equal(runtime.version,JSON.parse(await readFile('package.json','utf8')).version);assert.equal(existsSync(join(app,'Contents/Resources/default_app.asar')),false);
});
test('独立包无外部依赖链接、凭据、收藏或诊断环境', {skip:!available},async()=>{
 async function check(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=join(dir,e.name);assert.ok(!['.env','model.env','garden-v1.json','garden-v2.json','garden-v3.json'].includes(e.name));if(e.isSymbolicLink())assert.ok((await realpath(path)).startsWith(app+sep));else if(e.isDirectory())await check(path);}}
 await check(app);const info=plist(join(app,'Contents/Info.plist'));assert.equal(info.LSEnvironment.ELECTRON_LOG_FILE,undefined);assert.equal(info.LSEnvironment.ELECTRON_ENABLE_LOGGING,undefined);
});
