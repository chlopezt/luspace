import {createContext,useContext,useEffect,useLayoutEffect,useState,type ReactNode} from 'react';

const StartupContext=createContext<(loading:boolean)=>void>(()=>{});
export function useStartupLoading(loading:boolean){
 const setLoading=useContext(StartupContext);
 useEffect(()=>{setLoading(loading);},[loading,setLoading]);
}
export function StartupProvider({children}:{children:ReactNode}){
 const initial=location.pathname!=='/presentacion';
 const [loading,setLoading]=useState(initial),[visible,setVisible]=useState(initial);
 useLayoutEffect(()=>{document.getElementById('startup-fallback')?.remove();},[]);
 useEffect(()=>{
  if(loading){setVisible(true);return;}
  const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:280;
  const timer=setTimeout(()=>setVisible(false),duration);
  return()=>clearTimeout(timer);
 },[loading]);
 return <StartupContext.Provider value={setLoading}>{children}{visible&&<div className={'startup-screen'+(!loading?' is-leaving':'')} role="status" aria-live="polite" aria-label="Cargando LuSpace"><div className="startup-content"><div className="startup-brand"><img src="/brand/luspace-logo.png" alt="" onError={e=>{e.currentTarget.style.display='none';}}/><span className="startup-wordmark">Lu<span>Space</span></span></div><div className="startup-track" aria-hidden="true"><span/></div><p className="startup-copy">Abriendo tu espacio…</p></div></div>}</StartupContext.Provider>;
}
