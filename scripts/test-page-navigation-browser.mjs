import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.MSA_PLAYWRIGHT_MODULE||'playwright');
const server=spawn(process.execPath,['scripts/serve-demo.mjs']);await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
const browser=await chromium.launch({headless:true,executablePath:process.env.MSA_CHROME_BINARY,args:['--no-sandbox']});
try{
 await mkdir('.qa-output',{recursive:true});
 const page=await browser.newPage({viewport:{width:1536,height:1000},timezoneId:'America/Sao_Paulo'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/sistema.html?demonstracao=1&cargo=chefe#producao');
 await page.waitForSelector('[role="tab"]');await page.evaluate(()=>{if(!MSA.telemetry.paused)MSA.telemetry.pause();MSA.data.state.demoAutoMicro=false;});
 const tab=async key=>{await page.locator('[role="tab"][data-id="'+key+'"]').click();await page.waitForFunction(k=>document.querySelector('[role="tab"][aria-selected="true"]')?.dataset.id===k,key);};
 const route=async key=>{await page.evaluate(k=>location.hash=k,key);await page.waitForFunction(k=>document.title.startsWith(MSA.config.areas[k]),key);};
 const rows=()=>page.locator('#ops-tab-content tbody tr');
 assert.equal(await page.locator('#page-content .ops-panel').count(),1);
 assert.equal(await rows().count(),8);assert.match(await page.locator('.ops-pagination').innerText(),/1–8 de 32 registros/);
 const totals=await page.locator('#page-content>.ops-summary').innerText();
 await tab('apontamentos');await page.locator('#ops-machine').selectOption('NHPL');
 const firstIds=await page.locator('[data-action="record-detail"]').evaluateAll(b=>b.map(x=>x.dataset.id));assert.equal(firstIds.length,8);
 const expected=await page.evaluate(()=>{const s=MSA.data.state,a=+new Date(document.querySelector('#ops-from').value+'T00:00:00'),b=new Date(document.querySelector('#ops-to').value+'T00:00:00');b.setDate(b.getDate()+1);return s.registrosProducao.filter(r=>r.maquinaId==='NHPL'&&MSA.metrics.within(r,a,+b)).sort((x,y)=>y.inicio-x.inicio).map(r=>r.id);});
 assert.deepEqual(firstIds,expected.slice(0,8));
 await page.locator('.ops-pagination button').last().click();
 const secondIds=await page.locator('[data-action="record-detail"]').evaluateAll(b=>b.map(x=>x.dataset.id));assert.deepEqual(secondIds,expected.slice(8,16));assert.match(await page.locator('.ops-pagination').innerText(),/9–16/);
 await page.locator('[data-action="record-detail"]').first().click();assert(await page.locator('#operation-fields').innerText().then(t=>t.includes('Responsável')&&t.includes('Conferência')&&t.includes('Observações')));assert(await page.locator('#operation-save').isHidden());await page.locator('#operation-cancel').click();await page.waitForFunction(()=>!document.querySelector('#operation-dialog').open);
 assert.match(await page.locator('.ops-pagination').innerText(),/Página 2/);
 await page.locator('#ops-shift').selectOption('2');assert.match(await page.locator('.ops-pagination').innerText(),/Página 1/);assert.match(await rows().first().innerText(),/2º turno/);
 await page.locator('#ops-machine').selectOption('');await page.locator('#ops-shift').selectOption('todos');
 await page.locator('#ops-list-search').fill('INJ-01');assert(await rows().count()>0);assert(await page.locator('#ops-tab-content a[href^="#mapa-planta"]').evaluateAll(a=>a.every(x=>x.getAttribute('href').endsWith('INJ-01'))));
 await page.locator('#ops-list-search').fill('nada-inexistente-123');assert.equal(await rows().count(),0);assert.equal(await page.locator('.ops-pagination').count(),0);assert.match(await page.locator('.ops-empty').innerText(),/Altere a busca/);
 assert.equal(await page.locator('#page-content>.ops-summary').innerText(),totals);
 await page.locator('[data-action="list-search-reset"]').click();await tab('turnos');assert.equal(await page.locator('[data-shift-card]').count(),3);
 await page.locator('#ops-tab-turnos').press('ArrowRight');assert.equal(await page.locator('#page-content [role="tab"][aria-selected="true"]').getAttribute('data-id'),'horas');await page.locator('#ops-tab-horas').press('End');assert.equal(await page.locator('#page-content [role="tab"][aria-selected="true"]').getAttribute('data-id'),'parametros');
 await route('paradas');await tab('abertas');assert(await rows().count()>0);const stopId=await page.locator('[data-action="finish"]').first().getAttribute('data-id');await page.locator('[data-action="finish"]').first().click();await page.locator('[name="causa"]').fill('Teste de encerramento com abas');await page.locator('#operation-save').click();await page.waitForFunction(()=>!document.querySelector('#operation-dialog').open);assert.equal(await page.locator('[data-action="finish"][data-id="'+stopId+'"]').count(),0);await tab('historico');await page.locator('#ops-list-search').fill('Teste de encerramento');assert.match(await rows().first().innerText(),/Teste de encerramento/);
 await route('qualidade');await tab('lotes');assert(await rows().count()>0);await page.locator('[data-action="wf-batch-detail"]').first().click();assert.match(await page.locator('#operation-fields').innerText(),/Histórico/);await page.locator('#operation-cancel').click();await page.waitForFunction(()=>!document.querySelector('#operation-dialog').open);
 // Falta de pendências ou de histórico tem estado vazio, sem criar páginas extras.
 await tab('historico');assert.equal(await rows().count(),0);assert.match(await page.locator('.ops-empty').innerText(),/Nenhuma decisão/);
 const tabs={producao:['resumo','turnos','horas','apontamentos','parametros'],qualidade:['resumo','lotes','perdas','historico'],paradas:['resumo','abertas','micro','historico']};
 for(const theme of ['light','dark']){await page.evaluate(t=>{localStorage.setItem('msa-theme',t);document.documentElement.dataset.theme=t;},theme);for(const width of [390,768,1536]){await page.setViewportSize({width,height:1000});for(const [area,keys]of Object.entries(tabs)){await route(area);for(const key of keys){await tab(key);assert.equal(await page.locator('#page-content [role="tabpanel"]').count(),1);for(const body of await page.locator('#ops-tab-content tbody').all())assert(await body.locator('tr').count()<=8,area+' '+key+' limite');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),theme+' '+width+' '+area+' '+key);}await tab('resumo');if(width===390||width===1536){await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'.qa-output/abas-'+area+'-'+theme+'-'+width+'.png',fullPage:false});}}}}
 // Atualizações não alteram aba ou página escolhida nem desfazem uma busca em edição.
 await route('producao');await tab('apontamentos');await page.locator('.ops-pagination button').last().click();await page.evaluate(()=>MSA.demo.simulation.advance(1));assert.match(await page.locator('.ops-pagination').innerText(),/Página 2/);await page.locator('#ops-list-search').fill('NHPL');await page.evaluate(()=>MSA.demo.simulation.advance(1));assert.equal(await page.locator('#ops-list-search').inputValue(),'NHPL');
 assert.deepEqual(errors,[]);console.log('OK: 13 abas, paginação de 8 registros, ordenação, busca por código, filtros reiniciam página, totais completos, detalhes, encerramento, histórico e teclado; três larguras e dois temas; atualizações preservam navegação.');
}finally{await browser.close();server.kill();}
