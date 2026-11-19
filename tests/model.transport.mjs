import test from'node:test';import assert from'node:assert/strict';import https from'node:https';import tls from'node:tls';import{mkdtemp,readFile,writeFile,chmod}from'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';import{execFileSync}from'node:child_process';
import model from'../desktop/model.cjs';
// This CA is trusted only inside this isolated Node test process; OS trust is unchanged.
test('通过本机HTTPS测试服务验证实际传输、错误、取消和超时',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'kanshan-model-tls-'));
 const configPath=join(dir,'openssl.conf');await writeFile(configPath,'[req]\ndistinguished_name=dn\nx509_extensions=v3\nprompt=no\n[dn]\nCN=127.0.0.1\n[v3]\nsubjectAltName=IP:127.0.0.1\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,digitalSignature,keyCertSign,cRLSign,keyEncipherment\n');
 execFileSync('/usr/bin/openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-keyout',join(dir,'key.pem'),'-out',join(dir,'cert.pem'),'-config',configPath],{stdio:'ignore'});await chmod(join(dir,'key.pem'),0o600);
 const cert=await readFile(join(dir,'cert.pem'),'utf8'),key=await readFile(join(dir,'key.pem'),'utf8');const original=tls.getCACertificates('default');tls.setDefaultCACertificates([...original,cert]);
 let scenario='ok',requests=[];
 const server=https.createServer({key,cert},async(req,res)=>{let raw='';for await(const c of req)raw+=c;requests.push({url:req.url,auth:req.headers.authorization,body:JSON.parse(raw)});if(scenario==='status'){res.writeHead(401);res.end('private upstream body');return;}if(scenario==='redirect'){res.writeHead(307,{Location:'/other-service'});res.end();return;}if(scenario==='slow')await new Promise(r=>setTimeout(r,150));if(res.destroyed)return;res.writeHead(200,{'Content-Type':'application/json'});const text=JSON.parse(JSON.parse(raw).messages[1].content).document;res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({questions:[{text:text.includes('茶')?'茶饮怎样形成认同？':'机器人怎样形成信任？',relation_to_input:'本机协议测试服务，不是真实模型',keywords:[text.includes('茶')?'茶饮':'机器人']},{text:'还有哪些不同观点？',relation_to_input:'协议测试固定问题',keywords:['不同观点']}]})}}]}));});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const c=model.configuration({MODEL_API_KEY:'transport-test-only',MODEL_NAME:'local-test-model',MODEL_BASE_URL:`https://127.0.0.1:${server.address().port}/v1`});
 try{
  await t.test('实际HTTPS POST、Bearer认证、路径与两个主题',async()=>{const robot=await model.requestQuestions('机器人信任',{config:c}),tea=await model.requestQuestions('茶饮品牌',{config:c});assert.notEqual(robot[0].text,tea[0].text);assert.equal(requests.length,2);assert.equal(requests[0].url,'/v1/chat/completions');assert.equal(requests[0].auth,'Bearer transport-test-only');assert.deepEqual(JSON.parse(requests[0].body.messages[1].content),{document:'机器人信任'});});
  await t.test('真实401响应',async()=>{scenario='status';await assert.rejects(model.requestQuestions('材料',{config:c}),e=>e.code==='unauthorized'&&!e.message.includes('private'));});
  await t.test('禁止跨目标自动重定向',async()=>{scenario='redirect';const before=requests.length;await assert.rejects(model.requestQuestions('材料',{config:c}),e=>e.code==='network');assert.equal(requests.length,before+1);});
  await t.test('真实网络连接超时',async()=>{scenario='slow';await assert.rejects(model.requestQuestions('材料',{config:c,timeoutMs:30}),e=>e.code==='timeout');});
  await t.test('真实在途请求取消',async()=>{scenario='slow';const controller=new AbortController();const pending=model.requestQuestions('材料',{config:c,signal:controller.signal});setTimeout(()=>controller.abort(),25);await assert.rejects(pending,e=>e.code==='cancelled');});
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));tls.setDefaultCACertificates(original);}
});
