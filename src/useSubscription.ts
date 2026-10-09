import { useEffect, useState } from 'react';
import { api, type Row } from './lib';
export function useSubscription(initial?:Row|null,guest=false) {
  const [value,setValue]=useState<Row|null>(initial||null),[now,setNow]=useState(Date.now());
  useEffect(()=>{setValue(initial||null);setNow(Date.now());},[initial]);
  useEffect(()=>{
    if(!initial) return;
    if(guest){const timer=setInterval(()=>setNow(Date.now()),60000);return ()=>clearInterval(timer);}
    const refresh=()=>{setNow(Date.now());void api('subscription').then(setValue).catch(()=>{});};
    const timer=setInterval(refresh,60000);
    const focus=()=>refresh();window.addEventListener('focus',focus);
    window.addEventListener('luspace-subscription-refresh',refresh);
    return ()=>{clearInterval(timer);window.removeEventListener('focus',focus);window.removeEventListener('luspace-subscription-refresh',refresh);};
  },[initial,guest]);
  const trial=value?.subscription_status==='trial' && !value?.commercial_exempt;
  const remaining=Math.max(0,Date.parse(value?.trial_ends_at||'')-now);
  const daysLeft=Number.isFinite(remaining)?Math.ceil(remaining/86400000):0;
  const canWrite=!value || !!value.commercial_exempt || (value.can_write && (!trial || remaining>0));
  const canRead=!value || !!value.commercial_exempt || (value.can_read!==false && (!value.read_access_ends_at || Date.parse(value.read_access_ends_at)>now || canWrite));
  return {value,trial,daysLeft,canWrite,canRead};
}

