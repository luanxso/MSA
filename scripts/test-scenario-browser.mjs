import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const server=spawn(process.execPath,['scripts/serve-demo.mjs']);
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.MSA_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.MSA_CHROME_BINARY?{executablePath:process.env.MSA_CHROME_BINARY}:{}),args:['--no-sandbox']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1536,height:1000},timezoneId:'America/Sao_Paulo'});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/demonstracao.html');await page.waitForSelector('.app-shell.is-ready');
 await page.waitForFunction(()=>MSA.data.state.ready&&document.querySelector('#page-content').innerText.includes('OEE'));
 await page.evaluate(()=>{if(!MSA.telemetry.paused)MSA.telemetry.pause();});
 const sample=await page.evaluate(()=>({machines:MSA.data.state.maquinas.length,records:MSA.data.state.registrosProducao.length,s:MSA.performance.sample(MSA.data.state.maquinas.find(m=>m.id==='NHPL'),MSA.data.state)}));
 assert.equal(sample.machines,32);assert.equal(sample.records,32*(7+6*2)*8);assert(sample.s.efficiency.oee>0);assert(sample.s.reliability.mtbf>0);assert(sample.s.reliability.mttr>0);assert.equal(sample.s.hourly.reduce((n,r)=>n+r.goodCount,0),sample.s.goodCount);
 await page.screenshot({path:'.qa-output/visao-geral.png',fullPage:false});
 for(const area of ['producao','maquinas','paradas','qualidade','ocorrencias','funcionarios','indicadores','relatorios','notificacoes','configuracoes']){
  await page.evaluate(a=>location.hash=a,area);await page.waitForFunction(a=>document.title.startsWith(MSA.config.areas[a]),area);assert((await page.locator('#page-content').innerText()).length>150,area);assert.equal(await page.locator('#page-content .ops-empty').count(),0,area+' empty');
  if(['qualidade','indicadores'].includes(area))await page.screenshot({path:'.qa-output/'+area+'.png',fullPage:false});
 }
 await page.evaluate(()=>location.hash='producao/NHPL');await page.waitForFunction(()=>document.querySelector('#ops-machine')?.value==='NHPL');
 await page.locator('[role="tab"][data-id="apontamentos"]').click();
 const totals=[];
 for(const turno of ['1','2','3']){
  await page.locator('#ops-shift').selectOption(turno);
  const shown=await page.locator('.ops-summary .ops-stat strong').first().innerText();
  const expected=await page.evaluate(t=>{const start=new Date(document.querySelector('#ops-from').value+'T00:00:00').getTime(),e=new Date(document.querySelector('#ops-to').value+'T00:00:00');e.setDate(e.getDate()+1);return MSA.performance.calculate(MSA.shifts.filter(MSA.data.state,t),[MSA.data.state.maquinas.find(m=>m.id==='NHPL')],start,+e).good;},turno);
  assert(shown.includes(expected.toLocaleString('pt-BR')),turno+' total');assert(expected>0);totals.push(expected);
  const prod=await page.locator('.ops-panel').filter({has:page.getByRole('heading',{name:'Apontamentos de produção',exact:true})}).innerText();assert(prod.includes(turno+'º turno'));assert(!prod.includes((turno==='1'?'2':'1')+'º turno'));
 }
 await page.locator('#ops-shift').selectOption('todos');const totalShown=await page.locator('.ops-summary .ops-stat strong').first().innerText();assert(totalShown.includes(totals.reduce((n,x)=>n+x,0).toLocaleString('pt-BR')));
 await page.screenshot({path:'.qa-output/producao-turnos.png',fullPage:false});
 await page.setViewportSize({width:390,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'.qa-output/producao-turnos-mobile.png',fullPage:false});await page.setViewportSize({width:1536,height:1000});
 await page.locator('#page-content a[href="#mapa-planta/@NHPL"]').first().click();await page.waitForSelector('.nhpl-dialog[open]');
 const popup=await page.locator('.nhpl-dialog').innerText();assert(popup.includes(sample.s.batch));assert(popup.includes(String(sample.s.goodCount)));assert(popup.includes('Cenário fictício'));
 await page.screenshot({path:'.qa-output/nhpl.png',fullPage:false});
 await page.locator('.nhpl-dialog a[href="#qualidade/NHPL"]').click();await page.waitForFunction(()=>document.querySelector('#ops-machine')?.value==='NHPL');assert.equal(await page.locator('dialog[open]').count(),0);
 await page.evaluate(()=>location.hash='mapa-planta/@INJ-01');await page.waitForSelector('.plant-machine-dialog[open]');assert((await page.locator('.plant-machine-dialog').innerText()).includes('MTTR'));
 await page.locator('.plant-machine-dialog a[href="#paradas/INJ-01"]').click();await page.waitForFunction(()=>document.querySelector('#ops-machine')?.value==='INJ-01');
 await page.evaluate(()=>location.hash='chat');await page.waitForSelector('#chat-messages .message');await page.locator('#chat-message').fill('Mensagem fictícia de teste');await page.locator('#chat-send').click();await page.getByText('Mensagem fictícia de teste',{exact:true}).waitFor();
 for(const width of [390,768,1536]){await page.setViewportSize({width,height:900});await page.evaluate(()=>location.hash='qualidade');await page.waitForFunction(()=>document.title.startsWith('Qualidade'));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);await page.screenshot({path:'.qa-output/qualidade-'+width+'.png',fullPage:false});}
 await page.locator('[data-theme-toggle]').click();await page.screenshot({path:'.qa-output/qualidade-escuro.png',fullPage:false});
 const sup=await browser.newPage({timezoneId:'America/Sao_Paulo'});sup.on('pageerror',e=>errors.push(e.message));await sup.goto('http://127.0.0.1:4173/sistema.html?demonstracao=1&cargo=supervisor#conferencia');await sup.waitForSelector('.app-shell.is-ready');await sup.waitForSelector('button[data-action="review"]');await sup.locator('button[data-action="review"]').first().click();await sup.getByText('Registro conferido.',{exact:true}).waitFor();
 await sup.evaluate(()=>location.hash='paradas');await sup.locator('[role="tab"][data-id="abertas"]').click();await sup.waitForSelector('button[data-action="finish"]');const before=await sup.evaluate(()=>MSA.data.state.paradas.filter(r=>!r.fim&&r.setorId==='montagem').length);await sup.locator('button[data-action="finish"]').first().click();await sup.locator('[name="causa"]').fill('Ajuste fictício concluído');await sup.locator('#operation-save').click();assert.equal(await sup.evaluate(()=>MSA.data.state.paradas.filter(r=>!r.fim&&r.setorId==='montagem').length),before-1);
 const op=await browser.newPage({timezoneId:'America/Sao_Paulo'});op.on('pageerror',e=>errors.push(e.message));await op.goto('http://127.0.0.1:4173/sistema.html?demonstracao=1&cargo=operador#apontamentos');await op.waitForSelector('.app-shell.is-ready');await op.waitForSelector('#ops-work-machine');await op.locator('#ops-work-machine').selectOption('INJ-01');await op.waitForFunction(()=>MSA.auth.session().maquinaId==='INJ-01');await op.waitForFunction(()=>document.querySelector('#ops-work-machine')?.value==='INJ-01');
 assert.deepEqual(errors,[]);console.log('OK: 32 máquinas, 7 dias, painéis preenchidos, OEE/MTBF/MTTR, hora a hora consistente, máquina ↔ mapa ↔ painel, NHPL, chat local, 3 cargos, conferência, encerramento, troca de posto e 3 larguras.');
}finally{await browser.close();server.kill();}
