export async function compressUploadImage(file:File):Promise<File> {
  if(!file.type.startsWith('image/')) return file;
  if(file.size>25000000) throw new Error('Selecciona una imagen de hasta 25 MB.');
  let image:ImageBitmap;
  try{image=await createImageBitmap(file);}catch{throw new Error('No se pudo procesar la imagen. Usa JPG o PNG.');}
  try{
    if(image.width*image.height>80000000) throw new Error('La imagen tiene demasiada resolución para procesarla con seguridad.');
    if(file.size<=300000 && Math.max(image.width,image.height)<=1920 && ['image/jpeg','image/png'].includes(file.type)) return file;
    const scale=Math.min(1,1920/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
    const context=canvas.getContext('2d');if(!context) throw new Error('Este navegador no permite comprimir imágenes.');
    for(let attempt=0;attempt<5;attempt++){
      context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
      for(const quality of [0.85,0.7,0.55]){
        const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
        if(blob && blob.size<=300000) return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg',lastModified:file.lastModified});
      }
      if(Math.max(canvas.width,canvas.height)<=640) break;
      canvas.width=Math.max(1,Math.round(canvas.width*0.8));canvas.height=Math.max(1,Math.round(canvas.height*0.8));
    }
    throw new Error('No se pudo comprimir la imagen a 300 KB. Selecciona una versión más pequeña y verifica que el texto sea legible.');
  }finally{image.close();}
}
