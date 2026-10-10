import {useEffect,useRef} from 'react';

export function useLandingMotion() {
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const el=root.current;
    if(!el||!('IntersectionObserver' in window)) return;
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    const cards=Array.from(el.querySelectorAll<HTMLElement>('.lp-hero>div:first-child>*,.lp-features article,.lp-audience-card,.testimonial-card,.lp-price,.lp-final,.lp-security-grid>div,.lp-security li'));
    const chart=el.querySelector<HTMLElement>('.lp-mini-chart');
    let observer:IntersectionObserver|undefined;
    const show=(card:HTMLElement)=>{
      card.classList.remove('lp-motion-pending');
      observer?.unobserve(card);
    };
    const stop=()=>{
      observer?.disconnect();
      cards.forEach(show);
      chart?.classList.remove('lp-chart-pending');
    };
    const start=()=>{
      if(preference.matches){stop();return;}
      observer=new IntersectionObserver(entries=>{
        entries.forEach(entry=>{
          if(!entry.isIntersecting)return;
          if(entry.target===chart){
            chart.classList.remove('lp-chart-pending');
            chart.classList.add('lp-chart-drawn');
            observer?.unobserve(chart);
          }else show(entry.target as HTMLElement);
        });
      },{threshold:.08});
      cards.forEach((card,index)=>{
        card.classList.add('lp-motion-card');
        card.style.setProperty('--lp-reveal-delay',`${Math.min(index%4,3)*75}ms`);
        // Content is visible by default, including without JS or observer support.
        if(card.closest('.lp-hero')||card.getBoundingClientRect().top>window.innerHeight){
          card.classList.add('lp-motion-card','lp-motion-pending');
          observer!.observe(card);
        }
      });
      if(chart){chart.classList.add('lp-chart-pending');observer.observe(chart);}
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
  useEffect(()=>{
    const el=root.current;
    if(!el)return;
    const links=Array.from(el.querySelectorAll<HTMLAnchorElement>('.lp-nav nav a[href^="#"]'));
    let frame=0,previous:string|undefined;
    const update=()=>{
      frame=0;
      const readingLine=(el.querySelector('.lp-header')?.getBoundingClientRect().height||0)+34;
      let active='',nearest=-Infinity;
      for(const link of links){
        const section=el.querySelector<HTMLElement>(link.getAttribute('href')!);
        const top=section?.getBoundingClientRect().top;
        if(section&&top!==undefined&&top<=readingLine&&top>nearest){active=section.id;nearest=top;}
      }
      if(active===previous)return;
      previous=active;
      links.forEach(link=>{
        if(link.hash==='#'+active)link.setAttribute('aria-current','location');
        else link.removeAttribute('aria-current');
      });
    };
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
    const contentObserver=new MutationObserver(schedule);
    contentObserver.observe(el,{childList:true,subtree:true});
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule);
    update();
    return()=>{
      window.removeEventListener('scroll',schedule);
      window.removeEventListener('resize',schedule);
      contentObserver.disconnect();
      cancelAnimationFrame(frame);
      links.forEach(link=>link.removeAttribute('aria-current'));
    };
  },[]);
  return root;
}
