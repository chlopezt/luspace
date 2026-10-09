import {createHmac} from 'node:crypto';
const secret=process.env.LUSPACE_BILLING_JOB_KEY;
if(!secret||secret.length<32)throw new Error('Falta configurar la clave privada de conciliación.');
const ts=String(Math.floor(Date.now()/1000));
const signature=createHmac('sha256',secret).update('billing-reconcile:'+ts).digest('hex');
const response=await fetch('https://luspace.cl/api/billing/reconcile-job',{
  method:'POST',redirect:'error',signal:AbortSignal.timeout(180000),
  headers:{'x-luspace-job-ts':ts,'x-luspace-job-signature':signature}
});
if(!response.ok)throw new Error('Conciliación pendiente de revisión (HTTP '+response.status+'). No se ejecutaron cobros.');
const result=await response.json();
console.log('Conciliación verificada. Registros procesados: '+Number(result.processed||0));

