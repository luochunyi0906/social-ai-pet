// Local macOS development packaging. Never copies .env or user data.
const fs=require('node:fs/promises');const path=require('node:path');const{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function run(file,args){return execFileSync(file,args,{stdio:['ignore','pipe','pipe']}).toString().trim();}
function plist(file,key,value){run('/usr/bin/plutil',['-replace',key,'-string',value,file]);}
async function main(){
 if(process.platform!=='darwin'||process.arch!=='arm64')throw Error('当前打包脚本只支持macOS arm64。');
 const metadata=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
 const electronRoot=path.dirname(require.resolve('electron/package.json'));
 const vendor=path.join(electronRoot,'dist/Electron.app');
 const output=path.resolve(root,process.env.KANSHAN_PACKAGE_DIR||'release','看山有伴.app');
 try{await fs.lstat(output);throw Error('应用已存在。先备份或重命名release中的旧应用，再重新打包。');}catch(e){if(e.code!=='ENOENT')throw e;}
 await fs.mkdir(path.dirname(output),{recursive:true});
 await fs.cp(vendor,output,{recursive:true,preserveTimestamps:true,verbatimSymlinks:true});
 const resources=path.join(output,'Contents/Resources');const application=path.join(resources,'app');await fs.mkdir(application);
 const runtimePackage={woodlandPreview:metadata.woodlandPreview===true,name:metadata.name,productName:metadata.productName,version:metadata.version,main:'desktop/main.cjs',private:true,type:'module'};
 await fs.writeFile(path.join(application,'package.json'),JSON.stringify(runtimePackage,null,2)+'\n');
 for(const name of ['desktop','dist','skills'])await fs.cp(path.join(root,name),path.join(application,name),{recursive:true});
 const helper=path.join(application,'desktop/native/window-info');
 run('/usr/bin/xcrun',['clang',...(process.env.KANSHAN_MAC_SDK?['-isysroot',process.env.KANSHAN_MAC_SDK]:[]),'-mmacosx-version-min=13.0','-fobjc-arc','-O2','-framework','Foundation','-framework','AppKit','-framework','CoreGraphics',path.join(application,'desktop/native/window-info.m'),'-o',helper]);
 const audioHelper=path.join(application,'desktop/native/audio-output');
 run('/usr/bin/xcrun',['clang',...(process.env.KANSHAN_MAC_SDK?['-isysroot',process.env.KANSHAN_MAC_SDK]:[]),'-mmacosx-version-min=13.0','-fobjc-arc','-O2','-framework','Foundation','-framework','CoreAudio',audioHelper+'.m','-o',audioHelper]);
 for(const name of ['zhida','hot-list']){
  const directory=path.join(application,'skills',name);
  const manifest=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'),'utf8'));
  for(const resource of [manifest.entry,manifest.documentation,...Object.keys(manifest.upstream.files)])await fs.access(path.join(directory,resource));
 }
 for(const name of ['question-recommendations','question-answers']){
  for(const file of ['SKILL.md','index.cjs'])await fs.access(path.join(application,'skills',name,file));
 }
 await fs.copyFile(path.join(root,'.env.example'),path.join(application,'.env.example'));
 for(const name of ['dotenv','pdfjs-dist','@napi-rs/canvas','@napi-rs/canvas-darwin-arm64']){
  const source=path.dirname(require.resolve(name+'/package.json'));const destination=path.join(application,'node_modules',name);await fs.mkdir(path.dirname(destination),{recursive:true});await fs.cp(source,destination,{recursive:true,verbatimSymlinks:true});
 }
 for(const [source,destination]of [['LICENSE','LICENSE.electron.txt'],['LICENSES.chromium.html','LICENSES.chromium.html']]){try{await fs.copyFile(path.join(electronRoot,'dist',source),path.join(resources,destination));}catch(e){if(e.code!=='ENOENT')throw e;}}
 // Remove the welcome app so this bundle has a single project entry point.
 await fs.rm(path.join(resources,'default_app.asar'),{force:true});
 const info=path.join(output,'Contents/Info.plist');const identifier=metadata.woodlandPreview?'com.justinaluo.kanshan.woodland-preview':'com.justinaluo.kanshan.preview';
 await fs.rename(path.join(output,'Contents/MacOS/Electron'),path.join(output,'Contents/MacOS/Kanshan'));
 for(const[key,value]of Object.entries({CFBundleExecutable:'Kanshan',CFBundleName:'Kanshan',CFBundleDisplayName:metadata.woodlandPreview?'看山有伴 · 林间预览':'看山有伴',CFBundleIdentifier:identifier,CFBundleShortVersionString:metadata.version,CFBundleVersion:metadata.version}))plist(info,key,value);

 const frameworks=path.join(output,'Contents/Frameworks');
 // Electron checks its built-in helper names before the application-name fallback.
 // Preserve official helper directory/executable names; only rebrand their IDs.
 for(const entry of await fs.readdir(frameworks)){
  if(!entry.startsWith('Electron Helper')||!entry.endsWith('.app'))continue;
  const helper=path.join(frameworks,entry),oldName=entry.slice(0,-4),helperInfo=path.join(helper,'Contents/Info.plist');
  const suffix=oldName.replace('Electron Helper','').replace(/[^a-z]/gi,'').toLowerCase();
  for(const[key,value]of Object.entries({CFBundleIdentifier:identifier+'.helper'+(suffix?'.'+suffix:''),CFBundleShortVersionString:metadata.version,CFBundleVersion:metadata.version}))plist(helperInfo,key,value);
  await fs.access(path.join(helper,'Contents/MacOS',oldName));
 }
 for(const suffix of ['', ' (Renderer)', ' (GPU)', ' (Plugin)'])await fs.access(path.join(frameworks,'Electron Helper'+suffix+'.app','Contents/MacOS','Electron Helper'+suffix));
 // All links must stay inside this app; it must not depend on the development copy.
 async function inspect(directory){for(const entry of await fs.readdir(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isSymbolicLink()){const resolved=await fs.realpath(file);if(!resolved.startsWith(output+path.sep))throw Error('打包发现外部符号链接，已停止。');}else if(entry.isDirectory())await inspect(file);else if(entry.name==='.env'||(entry.name==='garden-v1.json'||entry.name==='garden-v2.json'||entry.name==='garden-v3.json')||entry.name==='model.env'||entry.name==='chat-v1.json'||entry.name==='outfit-preference.json')throw Error('打包发现私密配置或用户数据，已停止。');}}
 await inspect(output);
 const native=path.join(application,'node_modules/@napi-rs/canvas-darwin-arm64');
 for(const entry of await fs.readdir(native)){if(entry.endsWith('.node'))run('/usr/bin/codesign',['--force','--sign','-',path.join(native,entry)]);}
 // Local ad-hoc signing only; no system settings or Gatekeeper exceptions are changed.
 run('/usr/bin/codesign',['--force','--deep','--sign','-',output]);
 run('/usr/bin/codesign',['--verify','--deep','--strict',output]);
 console.log(JSON.stringify({application:output,version:metadata.version,signature:'local ad-hoc; verified',external_links:false,private_files:false}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
