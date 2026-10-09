/* OCR real, local e sob demanda. Valores ambíguos nunca são completados pelo cenário. */
window.MSA=window.MSA||{};
(() => {
 'use strict';
 // Alguns visualizadores locais incluem Basic Auth no endereço da página.
 // fetch() no worker recusa user:password na URL; a sessão HTTP da mesma
 // origem continua sendo administrada pelo navegador.
 const pageURL=new URL(document.baseURI),resourceBase=new URL('assets/ocr/',pageURL);
 resourceBase.username='';resourceBase.password='';
 const base=resourceBase.href;
 let loading=null,engine=null,model=null,queue=Promise.resolve();
 async function languageData(){
  if(model)return model;
  if(!MSA.ocrModelData)await new Promise((resolve,reject)=>{
   const script=document.createElement('script'),timer=setTimeout(()=>fail('O carregamento do modelo de OCR demorou demais. Reabra a prévia e tente novamente.'),30000);
   function fail(text){clearTimeout(timer);script.remove();reject(new Error(text));}
   script.src=base+'lang/eng-model.js';
   script.onload=()=>{clearTimeout(timer);if(!MSA.ocrModelData)fail('O modelo de OCR está incompleto. Extraia novamente a pasta inteira do sistema.');else resolve();};
   script.onerror=()=>fail('Não foi possível carregar o modelo local de OCR. Extraia a pasta inteira do sistema e reabra a prévia.');
   document.head.append(script);
  });
  model=MSA.ocrModelData;return model;
 }
 function deadline(promise,ms){
  let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('O OCR demorou demais. Reenquadre e tente novamente.')),ms);})]).finally(()=>clearTimeout(timer));
 }
 function parse(text,confidence,unit){
  const cleaned=String(text||'').trim().replace(/\u2212/g,'-');
  const match=cleaned.match(/^([+-]?\d{1,6}(?:[.,]\d{1,3})?)\s*(°?\s*C|°?\s*F|bar|kgf\/cm[²2]|psi|kPa|MPa|mmHg|inHg)?$/i);
  if(!match)throw new Error('Enquadre somente um valor do visor, sem outras zonas ou números.');
  if(!Number.isFinite(confidence)||confidence<75)throw new Error('OCR com pouca confiança. Aproxime o visor e evite reflexos.');
  const aliases={'c':'°C','°c':'°C','f':'°F','°f':'°F','bar':'bar','kgf/cm2':'kgf/cm²','kgf/cm²':'kgf/cm²','psi':'psi','kpa':'kPa','mpa':'MPa','mmhg':'mmHg','inhg':'inHg'};
  const detected=match[2]?aliases[match[2].replace(/\s/g,'').toLowerCase()]:null;
  if(detected&&detected!==unit)throw new Error('A unidade da foto difere da unidade configurada para o visor.');
  return Number(match[1].replace(',','.'));
 }
 function convert(value,from,to){
  if(from===to)return value;
  if(from==='°F'&&to==='°C')return (value-32)*5/9;
  if(from==='°C'&&to==='°F')return value*9/5+32;
  return MSA.gaugeReader.convert(value,from,to);
 }
 async function worker(progress){
  if(engine)return engine;
  if(!loading)loading=(async()=>{
   progress?.('Preparando OCR local pela primeira vez…');
   if(!window.Tesseract)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=base+'tesseract.min.js';script.onload=resolve;script.onerror=()=>{script.remove();reject(new Error('Não foi possível carregar o OCR local. Verifique os arquivos do sistema.'));};document.head.append(script);});
   const data=await languageData();
   let rejectError,failed=false;
   const failure=new Promise((_,reject)=>{rejectError=reject;});
   const boot=Tesseract.createWorker([{code:'eng',data}],1,{workerPath:base+'worker-local.js',corePath:base+'core',langPath:base+'lang',workerBlobURL:false,cacheMethod:'none',errorHandler:error=>rejectError(new Error('Falha no OCR local: '+String(error)))});
   boot.then(w=>{if(failed)void w.terminate();},()=>{});
   let w;try{w=await deadline(Promise.race([boot,failure]),60000);}catch(e){failed=true;throw e;}
   await w.setParameters({tessedit_pageseg_mode:Tesseract.PSM.SINGLE_BLOCK,preserve_interword_spaces:'1'});
   engine=w;return w;
  })().catch(e=>{loading=null;throw e instanceof Error?e:new Error('Não foi possível iniciar o OCR local.');});
  return loading;
 }
 function prepare(canvas,binary){
  const c=document.createElement('canvas');c.width=c.height=640;
  const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(canvas,0,0,640,640);
  const pixels=ctx.getImageData(0,0,640,640),data=pixels.data;
  // Fundo claro ou escuro: normaliza a polaridade pelo contorno do enquadramento.
  let edge=0,count=0;
  for(let y=0;y<640;y+=8)for(let x=0;x<640;x+=8)if(x<40||x>600||y<40||y>600){const n=(y*640+x)*4;edge+=(data[n]+data[n+1]+data[n+2])/3;count++;}
  const invert=edge/count<128;
  for(let n=0;n<data.length;n+=4){let g=.299*data[n]+.587*data[n+1]+.114*data[n+2];if(invert)g=255-g;if(binary)g=g<150?0:255;data[n]=data[n+1]=data[n+2]=g;data[n+3]=255;}
  ctx.putImageData(pixels,0,0);return c.toDataURL('image/png');
 }
 function read({canvas,unit,targetUnit,onProgress}){
  // Serializa o único worker e captura os pixels antes de entrar na fila.
  const images=[prepare(canvas,false),prepare(canvas,true)];
  const run=queue.then(async()=>{
   const w=await worker(onProgress);onProgress?.('Lendo o visor e verificando o resultado…');
   const readings=[];
   for(const image of images){
    let data;try{({data}=await deadline(w.recognize(image),30000));}catch(e){await w.terminate();engine=null;loading=null;throw e;}
    readings.push({value:parse(data.text,data.confidence,unit),confidence:data.confidence,text:data.text.trim()});
   }
   if(readings[0].value!==readings[1].value)throw new Error('As duas leituras do OCR divergiram. Reenquadre o visor antes de enviar.');
   const value=Number(convert(readings[0].value,unit,targetUnit).toFixed(2));
   if(!Number.isFinite(value))throw new Error('Não foi possível interpretar o visor.');
   return {value,instrumentValue:readings[0].value,confidence:Math.min(...readings.map(r=>r.confidence)),method:'ocr-local'};
  });
  queue=run.catch(()=>{});return run;
 }
 MSA.digitalReader={read,parse,convert};
})();
