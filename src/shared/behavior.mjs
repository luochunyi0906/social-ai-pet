export const INITIAL_STATE=Object.freeze({curiosity:72,autonomy:65,affinity:48,energy:70,paused:false,sleeping:false});
const responses={
 'seed-select':['seedlook','先选一颗，再找一块空田。'],plant:['plant','种下了，接下来亲手浇水、施肥。'],water:['water','水进土里了，慢慢来。'],fertilize:['fertilize','养分补上了，接下来等它长大。'],'garden-stage':['gardenlook','它比刚才长大了一点。'],bloom:['bloom','开花了！这次发现有了颜色。'],'garden-error':['oops','先看看提示，种子不会重复消耗。'],'layout-blocked':['look','留一点空隙，标签才看得清。'],
 showcase:['showcase','水晶灯亮了一下。'],gardenlook:['gardenlook','去花园看看。'],
 look:['look','嗯？有新线索吗。'],greet:['greet','我在，慢慢说。'],greet2:['greet','刚好，我也想听听。'],
 lift:['lift','小心一点，我跟着你。'],land:['land','站稳了。'],
 searching:['think','正在沿着关键词找知乎内容。'],found:['found','找到内容了，先看来源和取得范围。'],empty:['empty','这次没有找到内容，换个词试试。'],oops:['oops','这条路暂时没通，原因写在面板里。'],
 keep:['keep','这次发现变成种子，等你亲手播种。'],thinking:['think','我想一想，先理清前提。'],
 'speak-calm':['speak','先把眼前这件事说清楚。'],'speak-warm':['warm','我在听，也有一点自己的想法。'],'speak-curious':['look','这里有个值得多看一眼的地方。']
};
export function nextBehavior(state,tick,quiet=false,feeding='idle',interaction='idle'){
 if(state.sleeping)return{action:'sleep',reason:'休息中，随时可以叫醒。'};
 if(state.paused)return{action:'paused',reason:'已暂停，我会安静待着。'};
 if(quiet)return{action:'rest',reason:'你专心忙，我在这里安静休息。'};
 if(interaction==='lift'||interaction==='land'){const [action,reason]=responses[interaction];return{action,reason};}
 if(feeding!=='idle')return{action:feeding==='carry'?'walk':feeding==='sniff'?'sniff':feeding==='explore'?'read':'think',reason:'正在探索你主动分享的线索。'};
 if(responses[interaction]){const [action,reason]=responses[interaction];return{action,reason};}
 if(state.energy<25||tick%4===3)return{action:'rest',reason:'刚绕了一圈，想休息一小会儿。'};
 if(tick%4===1&&state.autonomy>40)return{action:'walk',reason:'想去洞口看看，你忙你的。'};
 if(tick%4===2)return{action:'look',reason:'风从洞口过来，听一会儿。'};
 return{action:'observe',reason:state.curiosity>50?'雪地里好像藏着新鲜事。':'先看看周围，不急着做什么。'};
}
