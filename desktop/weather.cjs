const cities=require('./weather-cities.json');
const RULES=Object.freeze({
 refresh:20*60000, stale:60*60000, change:60000,
 rainOn:.1,rainOff:.05,coldOn:15,coldOff:17,hotOn:28,hotOff:26,sunOn:7,sunOff:6
});
const neutral=()=>({clothing:'normal',umbrella:false,glasses:false});
const defaults={enabled:false,city:'hong-kong'};
const validWeather=value=>typeof value?.enabled==='boolean'&&Object.hasOwn(cities,value.city);
const rainCodes=new Set([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99]);
const finite=(value,low,high)=>Number.isFinite(value)&&value>=low&&value<=high?value:undefined;
function parseWeather(response,now=Date.now()){
 const {current:row,current_units:units}=response??{};
 const time=finite(row?.time,1,1e12)*1000;
 if(!Number.isFinite(time)||time>now+5*60000||now-time>RULES.stale)throw Error('天气观测时间无效或已过期。');
 const amount=key=>units?.[key]==='mm'?finite(row[key],0,200):undefined;
 const interval=finite(row.interval,60,3600);
 const rain=amount('rain'),showers=amount('showers');
 return {time,
  liquid:rain===undefined||showers===undefined||!interval?undefined:(rain+showers)*3600/interval,
  code:units?.weather_code==='wmo code'?finite(row.weather_code,0,99):undefined,
  temperature:units?.temperature_2m==='°C'?finite(row.temperature_2m,-100,80):undefined,
  feels:units?.apparent_temperature==='°C'?finite(row.apparent_temperature,-100,80):undefined,
  day:row.is_day===0?false:row.is_day===1?true:undefined,
  uv:finite(row.uv_index,0,30)};
}
function climate(){
 const signals={clothing:{},umbrella:{},glasses:{},everyday:{}};
 const fallback=neutral();
 function expire(now){
  for(const signal of Object.values(signals)){
   if(signal.validAt!==undefined&&now-signal.validAt>RULES.stale){
    delete signal.validAt;delete signal.value;delete signal.pending;delete signal.observed;
   }
  }
 }
 const valueFor=key=>signals[key].value??fallback[key];
 function observe(key,next,time,immediate=false){
  const signal=signals[key];
  if(next===undefined||time<=(signal.observed??0))return;
  signal.observed=time;
  signal.validAt=time;
  if(signal.value===undefined||immediate||next===signal.pending){
   signal.value=next;delete signal.pending;
  }else if(next===signal.value)delete signal.pending;
  else signal.pending=next;
 }
 function push(sample,now){
  expire(now);
  const {time,feels,liquid,code,day,uv}=sample;
  const clothing=valueFor('clothing');
  if(feels!==undefined)observe('clothing',
   (clothing==='cold'?feels<RULES.coldOff:feels<RULES.coldOn)?'cold':
   (clothing==='hot'?feels>RULES.hotOff:feels>RULES.hotOn)?'hot':'normal',time);
  const rain=code===undefined?undefined:rainCodes.has(code);
  if(rain===true||liquid>=RULES.rainOn)observe('umbrella',true,time);
  else if(rain===false&&liquid!==undefined)observe('umbrella',valueFor('umbrella')&&liquid>=RULES.rainOff,time);
  const clear=code===undefined?undefined:code<=1;
  if(day===false||clear===false||uv<RULES.sunOff)observe('glasses',false,time,day===false);
  else if(day===true&&clear===true&&uv!==undefined)observe('glasses',valueFor('glasses')||uv>=RULES.sunOn,time);
  if(feels!==undefined&&code!==undefined&&liquid!==undefined)observe('everyday',
   feels>=RULES.coldOff&&feels<=RULES.hotOff&&code<=3&&liquid<RULES.rainOff,time);
 }
 function target(now){
  expire(now);
  const umbrella=valueFor('umbrella');
  const look={clothing:valueFor('clothing'),umbrella,glasses:!umbrella&&valueFor('glasses')};
  return look.clothing==='normal'&&!look.umbrella&&!look.glasses&&valueFor('everyday')?{...look,everyday:true}:look;
 }
 return {push,target};
}
async function fetchWeather(city,signal,transport=fetch){
 const {latitude,longitude}=cities[city];
 const query=new URLSearchParams({latitude,longitude,timeformat:'unixtime',forecast_days:'1',temperature_unit:'celsius',precipitation_unit:'mm',
  current:'temperature_2m,apparent_temperature,weather_code,is_day,rain,showers,uv_index'});
 const result=await transport('https://api.open-meteo.com/v1/forecast?'+query,{signal,redirect:'error',cache:'no-store'});
 if(!result.ok)throw Error('天气服务暂不可用。');
 return result.json();
}
function weatherController({publish,request=fetchWeather,now=Date.now}){
 let prefs=defaults,latches=climate(),look=neutral(),blocked=false,appliedAt,observation,problem,pending,timer,lastRequest=0;
 const state=()=>({prefs,look,observation:observation&&now()-observation.time<=RULES.stale?observation:undefined,problem});
 function apply(immediate=false){
  const target=prefs.enabled?latches.target(now()):neutral();
  if((blocked||appliedAt!==undefined&&now()-appliedAt<RULES.change)&&!immediate)return;
  if(JSON.stringify(target)===JSON.stringify(look))return;
  look=target;
  appliedAt=now();
  publish(state());
 }
 async function refresh(){
  pending?.abort();
  lastRequest=now();
  const controller=new AbortController();
  pending=controller;
  const timeout=setTimeout(()=>controller.abort(),10000);
  timeout.unref?.();
  try{
   const sample=parseWeather(await request(prefs.city,controller.signal),now());
   if(pending!==controller)return;
   if(prefs.enabled)latches.push(sample,now());
   if(!observation||sample.time>=observation.time)observation={
    time:sample.time,feels:sample.feels,temperature:sample.temperature
   };
   problem=undefined;
  }catch{
   if(pending===controller)problem='暂未取得新的天气观测。';
  }finally{
   clearTimeout(timeout);
   if(pending===controller){pending=undefined;apply();publish(state());}
  }
 }
 function configure(next){
  const cityChanged=prefs.city!==next.city;
  const enabledChanged=prefs.enabled!==next.enabled;
  prefs=next;
  if(cityChanged){observation=undefined;problem=undefined;}
  if(cityChanged||enabledChanged){latches=climate();appliedAt=undefined;}
  if(!next.enabled)apply(true);
  const starting=!timer;
  if(starting){
   timer=setInterval(()=>{
    if(observation&&now()-observation.time>RULES.stale){observation=undefined;publish(state());}
    apply();
    if(now()-lastRequest>=RULES.refresh&&!pending)void refresh();
   },1000);
   timer.unref?.();
  }
  if(starting||cityChanged||(enabledChanged&&next.enabled))void refresh();
  publish(state());
 }
 return {state,configure,refresh,setBlocked(value){if(value===blocked)return;blocked=value;apply();},
  stop(){clearInterval(timer);timer=undefined;pending?.abort();pending=undefined;}};
}
module.exports={RULES,defaults,validWeather,parseWeather,climate,fetchWeather,weatherController};
