import {useEffect,useState} from 'react';
import {unwrap,type ListeningStatus} from './types';

const initial:ListeningStatus={output:'unknown',mode:'off',route:0,cue:0,changedAt:0};

export function useListening(){
 const [status,setStatus]=useState(initial);
 useEffect(()=>{
  const bridge=window.kanshan;
  if(!bridge)return;
  let active=true,received=false;
  const off=bridge.onListening(value=>{received=true;setStatus(value);});
  void unwrap(bridge.listeningStatus()).then(value=>{if(active&&!received)setStatus(value);}).catch(()=>{});
  return()=>{active=false;off();};
 },[]);
 const choose=async(mode:'manual'|'off')=>{if(window.kanshan)await unwrap(window.kanshan.chooseListening(mode));};
 return {status,choose};
}
