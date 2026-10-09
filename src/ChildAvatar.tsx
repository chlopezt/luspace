import {useEffect,useState} from 'react';
import {type Row} from './lib';
import {fetchAttachment} from './fileAccess';

export default function ChildAvatar({child}:{child?:Row}) {
  const [photo,setPhoto]=useState<{key:string;url:string}|null>(null);
  const key=child?.id+':'+(child?.foto_perfil_id||'');
  const initials=String(child?.primer_nombre||'').trim().slice(0,1).toLocaleUpperCase('es') || '?';
  useEffect(()=>{
    const controller=new AbortController();let url='';
    setPhoto(null);
    if(child?.foto_perfil_id)void fetchAttachment(child.foto_perfil_id,controller.signal).then(blob=>{
      if(controller.signal.aborted)return;
      url=URL.createObjectURL(blob);setPhoto({key,url});
    }).catch(()=>{});
    return()=>{controller.abort();if(url)URL.revokeObjectURL(url);};
  },[key]);
  return <span className="selected-child-avatar" aria-hidden="true">{photo?.key===key?<img src={photo.url} alt="" onError={()=>setPhoto(null)}/>:initials}</span>;
}
