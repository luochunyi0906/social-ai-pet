const classic=require('./chat-stickers.json');
const scarf=require('./scarf-stickers.json');
const cave=require('./cave-stickers.json');
const stickers={...classic,...scarf,...cave};
const prefix='[[LKS_STICKER';

const hasSticker=id=>typeof id==='string'&&Object.hasOwn(stickers,id);
const isCaveSticker=id=>typeof id==='string'&&Object.hasOwn(cave,id);
const stickerRules='先正常回复，再根据整段对话判断语气。符合下列情境时，在正文末尾另起一行加一个表情标记，例如 [[LKS_STICKER:scarf_hello]]。'+
 '围巾表情用法：'+Object.entries(scarf).filter(([,item])=>item.model)
  .map(([id,item])=>id+'（'+item.usage+'）').join('；')+'。经典备选：'+
 Object.entries(classic).map(([id,{label}])=>id+'（'+label+'）').join('、')+
 '。优先选择合适的围巾表情，每条最多一张。普通知识问答、错误或语气拿不准时只写正文。贴纸不代表应用执行了操作。';

function stickerFields(id){
 if(!hasSticker(id))return {};
 const {pack,alt,label}=stickers[id];
 return {stickerId:id,stickerPack:pack??'kanshan-classic-v1',stickerAlt:alt??label+'表情'};
}

function parseStickerReply(raw,complete=false,allowed=true){
 const start=raw.search(/\[{1,2}\s*LKS[_ -]STICKER/i);
 if(start!==-1){
  const match=complete&&allowed&&/^(?:\[\[LKS_STICKER:([a-z_]+)\]\])\s*$/.exec(raw.slice(start));
  const stickerId=match&&hasSticker(match[1])&&stickers[match[1]].model!==false?match[1]:undefined;
  return {text:raw.slice(0,start).trim(),...(stickerId?{stickerId}:{})};
 }
 for(let length=prefix.length-1;length>0;length--){
  if((!complete||length>=5)&&raw.toUpperCase().endsWith(prefix.slice(0,length))){
   return {text:raw.slice(0,-length).trim()};
  }
 }
 return {text:raw.trim()};
}
function messageText(message){
 if(!hasSticker(message.stickerId))return message.content;
 const {label,caption}=stickers[message.stickerId];
 const description='［'+(message.role==='user'?'用户':'刘看山')+'发送了'+label+'表情：'+caption+'］';
 return message.content?message.content+'\n'+description:description;
}
module.exports={hasSticker,isCaveSticker,stickerFields,stickerRules,parseStickerReply,messageText};
