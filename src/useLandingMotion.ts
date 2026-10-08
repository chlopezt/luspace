import {useEffect,useRef} from 'react';

export function useLandingMotion() {
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const el=root.current;
    if(!el||!('IntersectionObserver' in window)) return;
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    const cards=Array.from(el.querySelectorAll<HTMLElement>('.lp-features article,.lp-audience-card,.testimonial-card,.lp-price,.lp-final'));
    let observer:IntersectionObserver|undefined;
    const show=(card:HTMLElement)=>{
      card.classList.remove('lp-motion-pending');
      observer?.unobserve(card);
    };
    const stop=()=>{
      observer?.disconnect();
      cards.forEach(show);
    };
    const start=()=>{
      if(preference.matches){stop();return;}
      observer=new IntersectionObserver(entries=>{
        entries.forEach(entry=>{if(entry.isIntersecting)show(entry.target as HTMLElement);});
      },{threshold:.08});
      cards.forEach(card=>{
        // Content is visible by default, including without JS or observer support.
        if(card.getBoundingClientRect().top>window.innerHeight){
          card.classList.add('lp-motion-card','lp-motion-pending');
          observer!.observe(card);
        }
      });
    };
    const onPreference=()=>{if(preference.matches)stop();};
    const onFocus=(event:FocusEvent)=>{
      const target=(event.target as HTMLElement)?.closest<HTMLElement>('.lp-motion-card');
      if(target)show(target);
    };
    start();
    preference.addEventListener('change',onPreference);
    el.addEventListener('focusin',onFocus);
    return()=>{stop();preference.removeEventListener('change',onPreference);el.removeEventListener('focusin',onFocus);};
  },[]);
  return root;
}
