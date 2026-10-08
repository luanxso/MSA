import assert from 'node:assert/strict';
import http from 'node:http';
import vm from 'node:vm';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,relative,sep,isAbsolute} from 'node:path';
const mod=await import(process.env.MSA_PLAYWRIGHT_MODULE||'playwright');const {chromium}=mod.default||mod;
const root=resolve('dist');const fixture=await readFile('scripts/test-plant-browser.mjs','utf8');const replacements=vm.runInNewContext('('+fixture.match(/const replacements=({[\s\S]*?});\r?\nconst server=/)[1]+')');
const server=http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://local').pathname;if(replacements[pathname]!==undefined){res.setHeader('Content-Type','application/javascript');res.end(replacements[pathname]);return;}const f=resolve(root,'.'+pathname),r=relative(root,f);if(r==='..'||r.startsWith('..'+sep)||isAbsolute(r))throw Error('path');res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf'})[extname(f)]||'application/octet-stream');res.end(await readFile(f));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;let browser;await mkdir('docs/qa-nhpl',{recursive:true});
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.MSA_CHROME_BINARY||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/planta-demo.html#mapa-planta');await page.waitForFunction(()=>window.MSA?.nhpl && document.querySelector('[data-machine="NHPL"]'));
 await page.locator('#plant-sector').selectOption('montagem');
 const nhpl=page.locator('[data-machine="NHPL"]');await nhpl.focus();const before=await page.locator('#plant-world').getAttribute('transform');await page.keyboard.press('Enter');
 const dialog=page.locator('.nhpl-dialog');await dialog.waitFor();assert.equal(await dialog.locator('canvas').count(),1);assert.equal(await dialog.evaluate(d=>d.open),true);
 await page.screenshot({path:'docs/qa-nhpl/desktop.png'});await dialog.locator('[data-nhpl="station"][data-station="entrada"]').click();assert.equal(await dialog.locator('[data-detail] h3').first().textContent(),'Entrada');
 await dialog.locator('[data-nhpl="rotate"]').click();await dialog.locator('[data-nhpl="zoom-in"]').click();await dialog.locator('[data-nhpl="reset"]').click();
 await dialog.locator('[data-nhpl="parada"]').click();const stopped=await page.evaluate(()=>MSA.telemetry.get('NHPL').totalCount);await page.waitForTimeout(1500);assert.equal(await page.evaluate(()=>MSA.telemetry.get('NHPL').totalCount),stopped);
 await dialog.locator('[data-nhpl="sem-leitura"]').click();const last=await page.evaluate(()=>MSA.telemetry.get('NHPL').updatedAt);await page.waitForTimeout(1600);assert.equal(await page.evaluate(()=>MSA.telemetry.get('NHPL').updatedAt),last);assert.equal(await dialog.locator('[data-kpi="2"]').textContent(),'Sem leitura');
 await dialog.locator('[data-nhpl="operando"]').click();await page.waitForFunction(()=>document.querySelector('.nhpl-dialog [data-kpi="2"]')?.textContent==='Operando');assert.equal(await dialog.locator('[data-kpi="2"]').textContent(),'Operando');
 for(let i=0;i<30;i++){await page.keyboard.press('Tab');assert(await dialog.evaluate(d=>d.contains(document.activeElement)));}
 await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await page.locator('#plant-world').getAttribute('transform'),before);assert.equal(await page.locator('#plant-sector').inputValue(),'montagem');assert(await nhpl.evaluate(n=>document.activeElement===n));
 await nhpl.click();await page.locator('[data-nhpl="close"]').click();assert(await nhpl.evaluate(n=>document.activeElement===n));
 await page.setViewportSize({width:390,height:844});await nhpl.click();await dialog.waitFor();assert.equal(await page.evaluate(()=>document.querySelector('.nhpl-dialog').scrollWidth<=innerWidth),true);await page.screenshot({path:'docs/qa-nhpl/mobile.png'});await page.keyboard.press('Escape');
 // Permissões reais, consultas manuais e API com fixtures isoladas, sem Firebase.
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/sistema.html?dados=reais&qa=chefe#mapa-planta');await page.waitForFunction(()=>MSA.nhpl && document.querySelector('[data-machine="NHPL"]'));await page.locator('[data-machine="NHPL"]').click();
 await page.evaluate(()=>MSA.telemetry.useAdapter({name:'Teste agregado',subscribe(fn,fail){window.qaRead=fn;window.qaFail=fail;fn({id:'NHPL',updatedAt:Date.now(),state:'operando',goodCount:44,totalCount:45,rejectedCount:1});return()=>{};}}));
 await page.waitForTimeout(1100);assert((await dialog.locator('[data-motion]').textContent()).includes('Exemplares estáticos'));assert.equal(await dialog.locator('.nhpl-demo').isVisible(),false);assert((await dialog.locator('[data-metrics]').textContent()).includes('OEE: Indisponível'));
 await page.evaluate(()=>window.qaFail());assert.equal(await dialog.locator('[data-kpi="2"]').textContent(),'Sem leitura');
 await page.evaluate(()=>{MSA.data.state.registrosProducao.push({id:'nhpl-manual',maquinaId:'NHPL',inicio:Date.now()-10000,fim:Date.now(),quantidade:7,turno:'A',produto:'VGARD HP',lote:'LOTE-7'});MSA.telemetry.setMode('records');});await page.waitForTimeout(1100);assert((await dialog.locator('[data-source]').textContent()).includes('Registros manuais'));assert((await dialog.locator('[data-kpi="0"]').textContent()).startsWith('7 /'));assert((await dialog.locator('[data-meta]').textContent()).includes('LOTE-7'));await page.keyboard.press('Escape');
 await page.goto(base+'/sistema.html?dados=reais&qa=operador#mapa-planta');await page.waitForSelector('.plant-page');assert.equal(await page.locator('[data-machine="NHPL"]').count(),0);
 await page.goto(base+'/sistema.html?dados=reais&qa=supervisor#mapa-planta');await page.waitForSelector('.plant-page');assert.equal(await page.locator('[data-machine="NHPL"]').count(),0);
 await page.evaluate(()=>{Object.assign(MSA.auth.session(),{setorId:'montagem'});MSA.qaNotify();});await page.locator('[data-machine="NHPL"]').waitFor();await page.locator('#plant-sector').selectOption('montagem');await page.locator('[data-machine="NHPL"]').click();await dialog.waitFor();await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);console.log('NHPL browser: WebGL, popup, foco, mapa, câmera, estações, estados, comunicação, celular, API e permissões OK');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
