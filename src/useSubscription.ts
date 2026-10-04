import { useEffect, useState } from 'react';
import { api, type Row } from './lib';
export function useSubscription(initial?:Row|null,guest=false) {
  const [value,setValue]=useState<Row|null>(initial||null),[now,setNow]=useState(Date.now());
  useEffect(()=>{setValue(initial||null);setNow(Date.now());},[initial]);
  useEffect(()=>{
    if(!initial || guest) return;
    const refresh=()=>{setNow(Date.now());void api('subscription').then(setValue).catch(()=>{});};
    const timer=setInterval(refresh,60000);
    const focus=()=>refresh();window.addEventListener('focus',focus);
    return ()=>{clearInterval(timer);window.removeEventListener('focus',focus);};
  },[initial,guest]);
  const trial=value?.subscription_status==='trial' && !value?.commercial_exempt;
  const remaining=Math.max(0,Date.parse(value?.trial_ends_at||'')-now);
  const daysLeft=Number.isFinite(remaining)?Math.ceil(remaining/86400000):0;
  const canWrite=!value || !!value.commercial_exempt || (value.can_write && (!trial || remaining>0));
  return {value,trial,daysLeft,canWrite};
}
