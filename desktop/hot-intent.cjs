const digits = {'零':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
function number(value) {
 if (/^\d+$/.test(value)) return Number(value);
 if (value in digits) return digits[value];
 const [tens, ones, ...rest] = value.split('十');
 if (ones === undefined || rest.length || (tens && !(tens in digits)) || (ones && !(ones in digits))) return NaN;
 return (tens ? digits[tens] : 1)*10 + (ones ? digits[ones] : 0);
}
function hotIntent(text, hasBatch) {
 const ordinal = text.match(/^\s*(?:请[问说讲解释]*\s*)?第\s*([\d一二两三四五六七八九十]+)\s*条(?:热榜)?[\s，,]*(?:是|讲|说|聊|解读|解释|看|内容|[?？。]|$)/);
 if (hasBatch && ordinal) return {index:number(ordinal[1])-1};
 const hasSubject = /热榜|知乎.{0,16}热点/.test(text);
 const wantsList = /热点|刷新|更新|看看|查|给我看|给我|列|获取|有什么|有哪些|今日(?:知乎)?热榜|今天的?(?:知乎)?热榜|^知乎热榜[。！!？?\s]*$/.test(text);
 if (!hasSubject || !wantsList || /什么是(?:知乎)?热榜|如何(?:关闭|设置)|不要(?:查|刷新|看)/.test(text)) return;
 const count = text.match(/前\s*([\d零一二两三四五六七八九十百千]+)\s*条/);
 return {limit:count ? number(count[1]) : 30, force:/刷新|更新|重新获取/.test(text)};
}

module.exports = { hotIntent };
