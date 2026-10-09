import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.MSA_PLAYWRIGHT_MODULE||'playwright');
const server=spawn(process.execPath,['scripts/serve-demo.mjs']);await new Promise((r,e)=>{server.stdout.once('data',r);server.once('error',e)});
const browser=await chromium.launch({headless:true,...(process.env.MSA_CHROME_BINARY?{executablePath:process.env.MSA_CHROME_BINARY}:{}),args:['--no-sandbox']});
await mkdir('.qa-output',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],external=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 const policy=(await readFile('worker/index.js','utf8')).match(/'Content-Security-Policy': "([^"]+)"/)[1];
 await page.route('**/*',async route=>{
  if(!route.request().url().startsWith('http://127.0.0.1:4173/')){external.push(route.request().url());return route.abort();}
  const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'content-security-policy':policy}});
 });
 await page.goto('http://127.0.0.1:4173/sistema.html?demonstracao=1&cargo=operador#registro-foto');await page.locator('#photo-workspace').waitFor();await page.evaluate(()=>MSA.telemetry.pause());
 await page.locator('#photo-sector').selectOption('selagem');await page.locator('#photo-machine').selectOption('SEL-01');await page.locator('#photo-lot').fill('LT-OCR');
 const temperature=page.locator('[data-photo-key="temperatura"]');
 const fixture=async(text,dark=false)=>Buffer.from(await page.evaluate(({text,dark})=>{const c=document.createElement('canvas');c.width=c.height=640;const x=c.getContext('2d');x.fillStyle=dark?'#151515':'#fff';x.fillRect(0,0,640,640);x.fillStyle=dark?'#fff':'#151515';x.font='bold 88px Arial';x.textAlign='center';x.textBaseline='middle';text.split('\n').forEach((s,i,all)=>x.fillText(s,320,320+(i-(all.length-1)/2)*100));return c.toDataURL().split(',')[1];},{text,dark}),'base64');
 async function upload(card,text,dark=false){await card.locator('input[data-photo-file]').last().setInputFiles({name:'visor.png',mimeType:'image/png',buffer:await fixture(text,dark)});}
 await upload(temperature,'180,5');
 try{await page.waitForFunction(()=>MSA.data.state.leituras.some(r=>r.fotoProcesso?.metodo==='ocr-local'),null,{timeout:45000});}catch(e){console.log('OCR status:',await temperature.locator('.photo-card-status').textContent(),errors);throw e;}
 let rows=await page.evaluate(()=>MSA.data.state.leituras.filter(r=>r.origem==='foto'));
 assert.equal(rows.length,1);assert.equal(rows[0].valores.temperatura,180.5);assert.equal(rows[0].maquinaId,'SEL-01');assert.equal(rows[0].lote,'LT-OCR');assert(rows[0].fotoProcesso.confianca>=75);assert(!rows[0].fotoProcesso.exemplo);assert.equal(await temperature.locator('[data-photo-value]').inputValue(),'180,5');
 assert(requests.some(u=>u.includes('/ocr/core/')));assert(requests.some(u=>u.includes('/ocr/lang/eng-model.js')));assert.deepEqual(external,[]);
 await upload(temperature,'245.8',true);await page.waitForFunction(()=>MSA.data.state.leituras.some(r=>r.origem==='foto'&&r.valores.temperatura===245.8),null,{timeout:30000});
 await upload(temperature,'180\n245');await temperature.locator('.photo-card-status.is-pending').waitFor({timeout:30000});assert.equal(await temperature.locator('[data-photo-value]').inputValue(),'');assert.equal(await page.evaluate(()=>MSA.data.state.leituras.filter(r=>r.origem==='foto').length),2);
 await upload(temperature,'');await temperature.locator('.photo-card-status.is-pending').waitFor({timeout:30000});assert.equal(await page.evaluate(()=>MSA.data.state.leituras.filter(r=>r.origem==='foto').length),2);
 // A foto pendente ainda aceita uma correção explícita do operador.
 await temperature.locator('[data-photo-value]').fill('246');await temperature.locator('[data-photo-send]').click();await page.waitForFunction(()=>MSA.data.state.leituras.some(r=>r.origem==='foto'&&r.valores.temperatura===246));
 assert.equal(await page.evaluate(()=>MSA.data.state.leituras.find(r=>r.origem==='foto'&&r.valores.temperatura===246).fotoProcesso.metodo),'manual');
 const pressure=page.locator('[data-photo-key="pressao"]');await pressure.locator('[data-reader-mode]').selectOption('digital');await upload(pressure,'6,7');await page.waitForFunction(()=>MSA.data.state.leituras.some(r=>r.origem==='foto'&&r.valores.pressao===6.7),null,{timeout:30000});
 await temperature.locator('[data-photo-example]').click();await page.waitForFunction(()=>MSA.data.state.leituras.some(r=>r.fotoProcesso?.exemplo===true),null,{timeout:30000});assert.match(await page.locator('#photo-history').textContent(),/EXEMPLO/);
 await page.screenshot({path:'.qa-output/ocr-local-desktop.png',fullPage:true});
 // Impede que a conclusão de um OCR antigo escreva em outra máquina selecionada.
 await page.evaluate(()=>{const read=MSA.digitalReader.read;const gate=new Promise(resolve=>window.releaseOCR=resolve);MSA.digitalReader.read=async args=>{window.ocrStarted=true;const result=await read(args);await gate;window.ocrFinished=true;MSA.digitalReader.read=read;return result;};});
 await upload(temperature,'238.2');await page.waitForFunction(()=>window.ocrStarted);await page.locator('#photo-machine').selectOption('ACB-02');
 await page.waitForFunction(()=>MSA.auth.session().maquinaId==='ACB-02');await page.evaluate(()=>window.releaseOCR());await page.waitForFunction(()=>window.ocrFinished);
 assert.equal(await page.evaluate(()=>MSA.data.state.leituras.filter(r=>r.origem==='foto'&&r.valores.temperatura===238.2).length),0);
 await page.locator('#photo-machine').selectOption('SEL-01');assert.equal(await pressure.locator('[data-reader-mode]').inputValue(),'digital');
 await page.reload();await page.locator('#photo-workspace').waitFor();await page.locator('#photo-sector').selectOption('selagem');await page.locator('#photo-machine').selectOption('SEL-01');assert.equal(await pressure.locator('[data-reader-mode]').inputValue(),'digital');
 assert.equal(await page.evaluate(()=>MSA.data.state.leituras.filter(r=>r.origem==='foto').length),5);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.qa-output/ocr-local-mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);console.log('Real local OCR passed under production CSP without external requests: decimals, dark visor, automatic send, ambiguity, manual fallback, examples, stale result, persistence and mobile.');
}finally{await browser.close();server.kill();}
