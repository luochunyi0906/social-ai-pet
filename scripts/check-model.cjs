const path=require('node:path');
require('dotenv').config({quiet:true,path:path.join(__dirname,'../.env')});
const {configuration,publicStatus,requestQuestions,CONNECTION_SAMPLE}=require('../desktop/model.cjs');
const args=process.argv.slice(2),config=configuration();
console.log(JSON.stringify({kind:'configuration_check',...publicStatus(config)},null,2));
if(!config.ready){console.error('尚未配置完成；未发送网络请求。请在本机 .env 中填写服务地址、模型名称和密钥。');process.exitCode=2;}
else if(!args.includes('--send-test'))console.log('配置格式有效，但未连接服务。添加 --send-test 只发送内置测试材料，可能产生模型调用费用。');
else (async()=>{
 const samples=args.includes('--verify-samples')?[
  {topic:'机器人与信任',text:'材料：人们可能对机器人道谢，但不一定认为机器人有人类情感。外观、语言和互动经验可能影响信任。'},
  {topic:'茶饮与城市认同',text:'材料：茶饮品牌把本地插画印在城市限定杯上，包装可能连接地方认同。购买和收藏包装并不一定带来长期品牌忠诚。'}
 ]:[{topic:'连接与格式检查',text:CONNECTION_SAMPLE}];
 for(const sample of samples){const questions=await requestQuestions(sample.text,{config});console.log(JSON.stringify({kind:'actual_service_response',simulated:false,inputTopic:sample.topic,questions,relevanceNeedsHumanReview:true},null,2));}
})().catch(e=>{console.error(JSON.stringify({code:e.code||'failed',error:e.message}));process.exitCode=1;});
