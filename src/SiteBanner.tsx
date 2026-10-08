import {Info,TriangleAlert,Sparkles} from 'lucide-react';
import {useSiteConfig,type SiteConfig} from './useSiteConfig';
import './site-cms.css';
export function BannerView({banner}:{banner:SiteConfig['banner']}){
  const Icon=banner.type==='warning'?TriangleAlert:banner.type==='promotion'?Sparkles:Info;
  return banner.enabled&&banner.text?<div className={'site-announcement '+banner.type} role="status"><Icon size={19}/><span>{banner.text}</span></div>:null;
}
export default function SiteBanner(){const config=useSiteConfig();return <BannerView banner={config.banner}/>;}
