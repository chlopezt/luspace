import {test,expect} from '@playwright/test';
test('large image is resized and encoded below 300 KB without altering PDFs',async({page})=>{
  await page.goto('/');
  const result=await page.evaluate(async()=>{
    // Vite serves the real client module; this is an isolated local QA test.
    const {compressUploadImage}=await import(/* @vite-ignore */ '/src/imageCompression.ts');
    const canvas=document.createElement('canvas');canvas.width=2400;canvas.height=1600;
    const ctx=canvas.getContext('2d')!;const data=ctx.createImageData(canvas.width,canvas.height);
    let seed=17;for(let i=0;i<data.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;data.data[i]=seed&255;data.data[i+1]=(seed>>>8)&255;data.data[i+2]=(seed>>>16)&255;data.data[i+3]=255;}ctx.putImageData(data,0,0);
    const original=await new Promise<Blob>(resolve=>canvas.toBlob(b=>resolve(b!),'image/png'));
    const compressed=await compressUploadImage(new File([original],'qa.png',{type:'image/png'}));
    const image=await createImageBitmap(compressed);const dimensions=[image.width,image.height];image.close();
    const pdf=new File(['%PDF-1.4 QA'],'qa.pdf',{type:'application/pdf'});
    return {bytes:compressed.size,mime:compressed.type,dimensions,pdfUnchanged:await compressUploadImage(pdf)===pdf};
  });
  expect(result.bytes).toBeLessThanOrEqual(300000);expect(result.mime).toBe('image/jpeg');expect(Math.max(...result.dimensions)).toBeLessThanOrEqual(1920);expect(result.pdfUnchanged).toBe(true);
});
