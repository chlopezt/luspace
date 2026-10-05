import {useEffect,useState} from 'react';
import {Sun,Moon,Monitor} from 'lucide-react';

export default function ThemeControl(){
 const [value,setValue]=useState(()=>{
  try{const saved=localStorage.getItem('luspace-theme');return ['light','dark','system'].includes(saved||'')?saved!:'system';}catch{return 'system';}
 });
 useEffect(()=>{
  document.documentElement.dataset.theme=value;
  try{localStorage.setItem('luspace-theme',value);}catch{}
 },[value]);
 return <div className="theme-control" role="group" aria-label="Tema visual">
  {[{key:'light',Icon:Sun,label:'Claro'},{key:'dark',Icon:Moon,label:'Oscuro'},{key:'system',Icon:Monitor,label:'Sistema'}].map(({key,Icon,label})=><button key={key} type="button" onClick={()=>setValue(key)} className={value===key?'active':''} aria-label={label} title={label} aria-pressed={value===key}><Icon size={16}/></button>)}
 </div>;
}
