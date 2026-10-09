import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.MSA_PLAYWRIGHT_MODULE||'playwright');
const server=spawn(process.execPath,['scripts/serve-demo.mjs']);await new Promise((r,e)=>{server.stdout.once('data',r);server.once('error',e)});
const browser=await chromium.launch({headless:true,...(process.env.MSA_CHROME_BINARY?{executablePath:process.env.MSA_CHROME_BINARY}:{}),args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/sistema.html?demonstracao=1&cargo=operador#registro-foto');await page.locator('#photo-workspace').waitFor();await page.evaluate(()=>MSA.telemetry.pause());
 await page.locator('#photo-sector').selectOption('selagem');await page.locator('#photo-machine').selectOption('SEL-01');await page.locator('#photo-lot').fill('LT-EXEMPLOS');
 const card=key=>page.locator(`[data-photo-key="${key}"]`),rows=()=>page.evaluate(()=>MSA.data.state.leituras.filter(r=>r.origem==='foto'));
 async function next(key,index){const before=(await rows()).length;await card(key).locator('[data-photo-example]').click();try{await page.waitForFunction(n=>MSA.data.state.leituras.filter(r=>r.origem==='foto').length===n+1,before,{timeout:45000});}catch(e){console.log(key,index,await card(key).locator('.photo-card-status').textContent());throw e;}assert.match(await card(key).locator('[data-photo-example-status]').textContent(),new RegExp(`EXEMPLO ${index+1} de 5`));const all=await rows(),r=all.at(-1);assert.equal(r.fotoProcesso.exemplo,true);assert.equal(r.maquinaId,'SEL-01');assert.equal(r.lote,'LT-EXEMPLOS');return r;}
 const digitalFractions=[.5,.1,.9,-.15,1.15],pictures=new Set(),values=[];
 const temperature=await page.evaluate(()=>MSA.data.state.maquinas.find(m=>m.id==='SEL-01').parametros.temperatura);
 for(let i=0;i<5;i++){const r=await next('temperatura',i);assert.equal(r.fotoProcesso.metodo,'ocr-local');assert(r.fotoProcesso.confianca>=75);const expected=Number((temperature.min+(temperature.max-temperature.min)*digitalFractions[i]).toFixed(2));assert.equal(r.valores.temperatura,expected);pictures.add(r.fotoProcesso.imagem);values.push(expected);}
 assert.equal(pictures.size,5);assert.equal(new Set(values).size,5);
 const wrapped=await next('temperatura',0);assert.equal(wrapped.valores.temperatura,values[0]);assert(pictures.has(wrapped.fotoProcesso.imagem));
 for(const key of ['pressao','vacuo']){await card(key).locator('[data-reader-mode]').selectOption('digital');const parameter=await page.evaluate(k=>MSA.data.state.maquinas.find(m=>m.id==='SEL-01').parametros[k],key);for(let i=0;i<2;i++){const r=await next(key,i);assert.equal(r.fotoProcesso.metodo,'ocr-local');assert.equal(r.valores[key],Number((parameter.min+(parameter.max-parameter.min)*digitalFractions[i]).toFixed(2)));}}
 const pressure=card('pressao');await pressure.locator('[data-reader-mode]').selectOption('analog');await pressure.locator('summary').click();assert.equal(await pressure.locator('[data-scale-confirm]').isChecked(),false);
 const analogPictures=new Set(),analogValues=[];for(let i=0;i<5;i++){const r=await next('pressao',i);assert.equal(r.fotoProcesso.metodo,'ponteiro-local');const expected=14*[.5,.25,.75,.1,.9][i]*.980665;assert(Math.abs(r.valores.pressao-expected)<.4);analogPictures.add(r.fotoProcesso.imagem);analogValues.push(r.valores.pressao);}
 assert.equal(analogPictures.size,5);assert.equal(new Set(analogValues).size,5);assert.equal(await pressure.locator('[data-scale-confirm]').isChecked(),false);
 const vacuum=card('vacuo');await vacuum.locator('[data-reader-mode]').selectOption('analog');await vacuum.locator('summary').click();assert.equal(await vacuum.locator('[data-scale-confirm]').isChecked(),false);for(let i=0;i<2;i++){const r=await next('vacuo',i);assert.equal(r.fotoProcesso.metodo,'ponteiro-local');assert(Math.abs(r.valores.vacuo-(-760*[.5,.25][i]))<20);}
 await page.locator('#photo-auto').uncheck();const count=(await rows()).length;
 const chosen=Buffer.from((await rows()).at(-1).fotoProcesso.imagem.split(',')[1],'base64');
 await pressure.locator('[data-photo-file]').setInputFiles({name:'foto-real.jpg',mimeType:'image/jpeg',buffer:chosen});
 await pressure.locator('.photo-card-status').filter({hasText:'confirme a escala'}).waitFor();assert.equal(await pressure.locator('[data-photo-value]').inputValue(),'');assert.equal((await rows()).length,count);assert.equal(await pressure.locator('[data-scale-confirm]').isChecked(),false);
 await pressure.locator('[data-photo-example]').click();await pressure.locator('.photo-card-status').filter({hasText:'Leitura estimada'}).waitFor();assert.equal((await rows()).length,count);assert.equal(await pressure.locator('[data-photo-send]').isEnabled(),true);
 await page.locator('[data-theme-toggle]').click();
 const exampleButton=pressure.locator('[data-photo-example]');await exampleButton.focus();await exampleButton.hover();
 const style=await exampleButton.evaluate(b=>({background:getComputedStyle(b).backgroundColor,appearance:getComputedStyle(b).appearance,color:getComputedStyle(b).color}));assert.notEqual(style.background,'rgb(255, 255, 255)');assert.notEqual(style.background,'rgb(239, 239, 239)');assert.equal(style.appearance,'none');
 await page.screenshot({path:'.qa-output/examples-dark-mobile.png',fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 console.log('Examples passed with real readers: five distinct OCR images/values, light/dark backgrounds, five needle positions, per-parameter/type cycles, wraparound, negative vacuum, demo labels, automatic/manual send and mobile.');
}finally{await browser.close();server.kill();}
