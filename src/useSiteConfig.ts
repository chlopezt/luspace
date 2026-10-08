import {useEffect,useState} from 'react';
import {defaultSiteConfig} from '../shared/site-config.js';
import {api} from './lib';
export type SiteConfig = typeof defaultSiteConfig;
export function useSiteConfig(){
  const [config,setConfig]=useState<SiteConfig>(defaultSiteConfig);
  useEffect(()=>{
    let alive=true;
    const refresh=()=>{if(!document.hidden)void api('site-config').then(result=>{if(alive)setConfig(result.config);}).catch(()=>{});};
    refresh();const interval=setInterval(refresh,60000);
    const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('luspace-site-config'):null;
    if(channel)channel.onmessage=refresh;
    document.addEventListener('visibilitychange',refresh);window.addEventListener('focus',refresh);window.addEventListener('luspace-site-config',refresh);
    return()=>{alive=false;clearInterval(interval);channel?.close();document.removeEventListener('visibilitychange',refresh);window.removeEventListener('focus',refresh);window.removeEventListener('luspace-site-config',refresh);};
  },[]);
  return config;
}
export function notifySiteConfig(){
  window.dispatchEvent(new Event('luspace-site-config'));
  if(typeof BroadcastChannel!=='undefined'){const channel=new BroadcastChannel('luspace-site-config');channel.postMessage('updated');channel.close();}
}
