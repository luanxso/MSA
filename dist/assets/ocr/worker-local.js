/* Modelo recebido da página: Tesseract v6 aceita bytes no loadLanguage,
   mas initialize exige somente os códigos de idioma. Mantém o vendor intacto. */
self.addEventListener('message',event=>{
 const job=event.data;
 if(job?.action==='initialize'&&Array.isArray(job.payload?.langs)){
  job.payload.langs=job.payload.langs.map(lang=>typeof lang==='string'?lang:lang.code);
 }
});
importScripts('worker.min.js');
