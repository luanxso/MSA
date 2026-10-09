import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.MSA_PLAYWRIGHT_MODULE||'playwright');
const server=spawn(process.execPath,['scripts/serve-demo.mjs']);
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
const browser=await chromium.launch({headless:true,...(process.env.MSA_CHROME_BINARY?{executablePath:process.env.MSA_CHROME_BINARY}:{}),args:['--no-sandbox']});
const errors=[];
try{
 await mkdir('.qa-output',{recursive:true});
 const page=await browser.newPage({viewport:{width:1536,height:1000},timezoneId:'America/Sao_Paulo'});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('msa-theme','dark'));
 await page.goto('http://127.0.0.1:4173/sistema.html?demonstracao=1#maquinas');await page.waitForSelector('.equipment-row');
 const rows=page.locator('.equipment-row'),search=page.locator('#catalogue-search');
 assert.equal(await rows.count(),8);assert.match(await page.locator('#equipment-results-count').innerText(),/de 32 equipamentos/);
 await page.getByRole('button',{name:'Próxima',exact:true}).click();assert.match(await page.locator('#equipment-results-count').innerText(),/^9–16/);
 await page.locator('#catalogue-sector').selectOption('expedicao');assert.equal(await page.locator('#sector-selector').inputValue(),'expedicao');assert.equal(await rows.count(),3);
 assert.deepEqual(await rows.evaluateAll(els=>els.map(e=>e.dataset.equipmentId).sort()),['EXP-01','EXP-02','EXP-03']);
 await search.pressSequentially('expedicao');assert.equal(await search.inputValue(),'expedicao');assert.equal(await rows.count(),3);assert(await search.evaluate(e=>e===document.activeElement));
 await search.fill('EXP-02');assert.equal(await rows.count(),1);await search.fill('inexistente');assert.equal(await rows.count(),0);assert(await page.getByText('Nenhuma máquina encontrada').isVisible());
 await page.locator('[data-action="catalogue-reset"]').first().click();assert.equal(await rows.count(),3);assert.equal(await page.locator('#catalogue-sector').inputValue(),'expedicao');
 await page.screenshot({path:'.qa-output/maquinas-expedicao-desktop.png',fullPage:true});
 await page.locator('#catalogue-sector').selectOption('todos');await page.locator('#catalogue-status').selectOption('parada');assert.equal(await rows.count(),3);assert.equal(await rows.locator('.ops-badge').filter({hasText:'Parada'}).count(),3);
 await page.locator('#catalogue-status').selectOption('alerta');assert(await rows.count()>0);assert.equal(await rows.locator('.equipment-alert-count').count(),await rows.count());
 await page.locator('[data-action="catalogue-reset"]').first().click();await page.locator('#catalogue-order').selectOption('output');
 const quantities=await rows.locator('td:nth-child(4) strong').allTextContents();const numeric=quantities.map(s=>Number(s.replace(/\./g,'').replace(',','.')));assert.deepEqual(numeric,[...numeric].sort((a,b)=>b-a));
 await page.locator('[data-action="catalogue-reset"]').first().click();
 async function checkContrast(){return page.evaluate(()=>{
  const rgb=c=>c.match(/[\d.]+/g).slice(0,3).map(Number),lum=c=>{const a=rgb(c).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return a[0]*.2126+a[1]*.7152+a[2]*.0722;};
  return [...document.querySelectorAll('.equipment-row :is(.equipment-code,.ops-link,small,.text-button,.ops-badge,.equipment-mobile-label),.equipment-toolbar label,.equipment-pagination>span')].filter(el=>el.getClientRects().length&&el.textContent.trim()).map(el=>{let parent=el,bg;while(parent){bg=getComputedStyle(parent).backgroundColor;const parts=bg.match(/[\d.]+/g);if(parts.length<4||Number(parts[3])>0)break;parent=parent.parentElement;}const foreground=lum(getComputedStyle(el).color),background=lum(bg);return {text:el.innerText.trim(),ratio:(Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05)};});
 });}
 for(const width of [390,768,1536])for(const theme of ['dark','light']){
  await page.setViewportSize({width,height:1000});if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('[data-theme-toggle]').click();
  const contrasts=await checkContrast();assert(contrasts.every(c=>c.ratio>=4.5),JSON.stringify(contrasts.filter(c=>c.ratio<4.5).slice(0,3)));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>{scrollTo(0,0);document.querySelector('.main-content').scrollTop=0;});await page.screenshot({path:'.qa-output/maquinas-'+theme+'-'+width+'.png',fullPage:false});
  await rows.first().getByRole('button',{name:'Detalhes',exact:true}).click();await page.waitForSelector('#operation-dialog[open]');
  assert(await page.locator('#operation-save').isHidden());assert(await page.locator('.machine-parameters[open] .ops-table').isVisible());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'.qa-output/maquina-detalhes-'+theme+'-'+width+'.png',fullPage:false});
  await page.locator('#operation-cancel').click();await page.waitForFunction(()=>!document.querySelector('#operation-dialog').open);
 }
 await search.fill('NHPL');assert.equal(await rows.count(),1);await rows.getByRole('button',{name:'Detalhes',exact:true}).click();
 await page.locator('.equipment-detail [data-action="target"]').click();assert(await page.locator('#operation-save').isVisible());await page.locator('#operation-cancel').click();await page.waitForFunction(()=>!document.querySelector('#operation-dialog').open);
 await rows.getByRole('button',{name:'Detalhes',exact:true}).click();await page.locator('.equipment-detail-links a[href="#mapa-planta/@NHPL"]').click();await page.waitForSelector('.nhpl-dialog[open]');assert(await page.locator('#operation-dialog').evaluate(e=>!e.open));
 const operator=await browser.newPage();await operator.goto('http://127.0.0.1:4173/sistema.html?demonstracao=1&cargo=operador#maquinas');await operator.waitForSelector('.equipment-row');assert(await operator.locator('#catalogue-sector').isDisabled());assert.equal(await operator.locator('#catalogue-sector option').count(),1);assert.deepEqual(await operator.locator('.equipment-row').evaluateAll(els=>els.map(e=>e.dataset.equipmentId)),['NHPL']);
 const supervisor=await browser.newPage();await supervisor.goto('http://127.0.0.1:4173/sistema.html?demonstracao=1&cargo=supervisor#maquinas');await supervisor.waitForSelector('.equipment-row');assert.equal(await supervisor.locator('#catalogue-sector option').count(),8);await supervisor.locator('#catalogue-sector').selectOption('expedicao');await supervisor.waitForFunction(()=>MSA.auth.session().setorId==='expedicao'&&document.querySelector('#catalogue-sector')?.value==='expedicao');assert.deepEqual(await supervisor.locator('.equipment-row').evaluateAll(els=>els.map(e=>e.dataset.equipmentId).sort()),['EXP-01','EXP-02','EXP-03']);
 assert.deepEqual(errors,[]);
 console.log('OK: filtros de setor/busca/situação, ordenação, paginação, detalhes e mapa; acesso do operador; claro/escuro em celular, tablet e desktop, contraste 4.5:1 e sem overflow.');
}finally{await browser.close();server.kill();}
