import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.MSA_PLAYWRIGHT_MODULE||'playwright');
const server=spawn(process.execPath,['scripts/serve-demo.mjs']);
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.MSA_CHROME_BINARY?{executablePath:process.env.MSA_CHROME_BINARY}:{}),args:['--no-sandbox']});
 await mkdir('.qa-output',{recursive:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'America/Sao_Paulo'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/sistema.html?demonstracao=1&cargo=operador#registro-foto');await page.locator('#photo-workspace').waitFor();
 await page.evaluate(()=>MSA.telemetry.pause());await page.locator('#photo-sector').selectOption('selagem');await page.locator('#photo-machine').selectOption('SEL-01');
 const before=await page.evaluate(async()=>{
  const c=document.createElement('canvas');c.width=c.height=320;c.getContext('2d').fillRect(0,0,320,320);
  const values={maquinaId:'SEL-01',data:MSA.data.state.scenarioAt-25*3600000,lote:'LT-REGRESSAO-CORRECAO',valores:{pressao:6.6},fotoProcesso:{parametro:'pressao',imagem:c.toDataURL('image/jpeg',.7),capturadaEm:Date.now()-25*3600000,metodo:'manual'}};
  const id=await MSA.data.save('leituras',values);return MSA.data.state.leituras.find(r=>r.id===id);
 });
 await page.locator('.photo-history-row').filter({hasText:before.lote}).getByRole('button',{name:'Corrigir',exact:true}).click();
 const card=page.locator('[data-photo-key="pressao"]');await card.getByText('Corrigindo registro existente.',{exact:false}).waitFor();await card.locator('[data-photo-value]').fill('6,7');await card.locator('[data-photo-send]').click();
 await page.waitForFunction(id=>MSA.data.state.leituras.find(r=>r.id===id)?.valores.pressao===6.7,before.id);
 const after=await page.evaluate(id=>MSA.data.state.leituras.find(r=>r.id===id),before.id);
 for(const key of ['data','turno','createdAt','usuarioId'])assert.equal(after[key],before[key],key);assert.equal(after.fotoProcesso.capturadaEm,before.fotoProcesso.capturadaEm);
 await page.reload();await page.locator('#photo-workspace').waitFor();
 assert.equal(await page.evaluate(id=>MSA.data.state.leituras.find(r=>r.id===id).estudoSelo,before.id),undefined);
 await page.evaluate(()=>{MSA.telemetry.pause();MSA.demo.simulation.advance(3600);location.hash='apontamentos';});await page.getByRole('button',{name:'Registrar produção',exact:true}).click();await page.locator('#operation-dialog[open]').waitFor();
 assert.equal(await page.locator('[name="turno"]').inputValue(),'2');
 const date=(await page.locator('[name="inicio"]').inputValue()).split('T')[0];await page.locator('[name="inicio"]').fill(date+'T14:00');await page.locator('[name="inicio"]').dispatchEvent('change');assert.equal(await page.locator('[name="turno"]').inputValue(),'1');
 await page.locator('#operation-cancel').click();await page.evaluate(()=>location.hash='configuracoes');await page.locator('#demo-reject-rate').waitFor();
 const rates=await page.evaluate(()=>({reject:MSA.demo.simulation.rejectRate*100,deviation:MSA.demo.simulation.deviationRate*100}));
 assert.equal(Number(await page.locator('#demo-reject-rate').inputValue()),Number(rates.reject.toFixed(4)));assert.equal(Number(await page.locator('#demo-deviation-rate').inputValue()),Number(rates.deviation.toFixed(4)));
 await page.evaluate(()=>{MSA.demo.simulation.setRejectRate(3.3);MSA.demo.simulation.setDeviationRate(7.7);});
 assert.equal(Number(await page.locator('#demo-reject-rate').inputValue()),3.3);assert.equal(Number(await page.locator('#demo-deviation-rate').inputValue()),7.7);
 const machines=await browser.newPage({viewport:{width:390,height:1000},timezoneId:'America/Sao_Paulo'});machines.on('pageerror',e=>errors.push(e.message));await machines.addInitScript(()=>localStorage.setItem('msa-theme','dark'));await machines.goto('http://127.0.0.1:4173/sistema.html?demonstracao=1#maquinas');await machines.locator('.equipment-row').first().waitFor();
 const button=machines.locator('.equipment-row .text-button').first();await button.hover();await machines.waitForTimeout(300);
 const ratio=await button.evaluate(el=>{
  const rgb=s=>s.match(/[\d.]+/g).map(Number),composite=(fg,bg)=>fg.slice(0,3).map((v,i)=>v*(fg[3]??1)+bg[i]*(1-(fg[3]??1))),lum=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
  const chain=[];for(let p=el;p;p=p.parentElement)chain.unshift(p);let bg=[255,255,255];for(const p of chain)bg=composite(rgb(getComputedStyle(p).backgroundColor),bg);
  const f=lum(composite(rgb(getComputedStyle(el).color),bg)),b=lum(bg);return(Math.max(f,b)+.05)/(Math.min(f,b)+.05);
 });assert(ratio>=4.5,'Contraste do botão sob o ponteiro: '+ratio);await machines.screenshot({path:'.qa-output/regressao-contraste-escuro-mobile.png'});
 assert.deepEqual(errors,[]);console.log('OK: correção e restauração de fotos, turno inferido/atualizado, taxas exatas e contraste escuro no hover.');
}finally{await browser?.close();server.kill();}
