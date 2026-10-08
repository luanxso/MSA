import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.MSA_PLAYWRIGHT_MODULE||'playwright');
const server=spawn(process.execPath,['scripts/serve-demo.mjs']);await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
const browser=await chromium.launch({headless:true,executablePath:process.env.MSA_CHROME_BINARY,args:['--no-sandbox']});
const errors=[],base='http://127.0.0.1:4173/sistema.html?demonstracao=1';
try{
 await mkdir('.qa-output',{recursive:true});
 const page=await browser.newPage({viewport:{width:1536,height:1000},timezoneId:'America/Sao_Paulo'});
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1:4173/')&&r.status()>=400)errors.push(r.status()+' '+r.url());});
 const goto=async(role,route)=>{await page.goto(base+'&cargo='+role+'#'+route);await page.waitForFunction(()=>MSA.data.state.ready&&document.querySelector('#page-content .ops-panel'));await page.evaluate(()=>{if(!MSA.telemetry.paused)MSA.telemetry.pause();MSA.data.state.demoAutoMicro=false;});};
 const route=async area=>{await page.evaluate(a=>location.hash=a,area);await page.waitForFunction(a=>document.title.startsWith(MSA.config.areas[a.split('/')[0]]),area);};
 const fill=async values=>{for(const[k,v]of Object.entries(values))await page.locator('#operation-fields [name="'+k+'"]').fill(v);};
 const save=async()=>{await page.locator('#operation-save').click();await page.waitForFunction(()=>!document.querySelector('#operation-dialog').open);};
 const workflow=async(name,id)=>page.locator('[data-action="wf-'+name+'"]'+(id?'[data-id="'+id+'"]':'')).first().click();
 await goto('chefe','paradas');await page.locator('[role="tab"][data-id="micro"]').click();await page.locator('#ops-list-search').fill('NHPL');await workflow('micro');await page.locator('[name="maquinaId"]').selectOption('NHPL');await save();
 const stopId=await page.evaluate(()=>MSA.data.state.paradas.at(-1).id);assert.equal(await page.evaluate(()=>MSA.performance.sample(MSA.data.state.maquinas.find(m=>m.id==='NHPL'),MSA.data.state).state),'parada');
 await page.evaluate(()=>MSA.demo.simulation.advance(15));assert.equal(await page.evaluate(id=>{const r=MSA.data.state.paradas.find(r=>r.id===id);return r.fim-r.inicio;},stopId),15000);
 await workflow('classify',stopId);await page.locator('[name="motivoCodigo"]').selectOption('travamento-pallet');assert.equal(await page.locator('[name="motivoOutro"]').isVisible(),false);await save();
 assert.equal(await page.evaluate(id=>MSA.data.state.paradas.find(r=>r.id===id).motivo,stopId),'Travamento de pallet / peça');
 await page.locator('[data-action="new"][data-collection="paradas"]').click();await page.locator('[name="maquinaId"]').selectOption('NHPL');await page.locator('[name="motivoCodigo"]').selectOption('sensor');assert.equal(await page.locator('[name="inicio"]').getAttribute('step'),'1');await save();
 const manualId=await page.evaluate(()=>MSA.data.state.paradas.at(-1).id);await page.locator('[data-action="finish"][data-id="'+manualId+'"]').click();await save();
 await page.locator('[data-action="new"][data-collection="paradas"]').click();await page.locator('[name="motivoCodigo"]').selectOption('outro');assert(await page.locator('[name="motivoOutro"]').isVisible());assert(await page.locator('[name="motivoOutro"]').evaluate(e=>e.required));await page.locator('#operation-cancel').click();
 await route('passagem');await workflow('handover');await page.locator('[name="maquinaId"]').selectOption('NHPL');await fill({acoesRealizadas:'Abastecimento revisado',pendencias:'Conferir alimentador no próximo turno'});await save();const handoverId=await page.evaluate(()=>MSA.data.state.passagensTurno.at(-1).id);
 assert.equal(await page.locator('[data-action="wf-receive"][data-id="'+handoverId+'"]').count(),0);
 await goto('supervisor','passagem');await workflow('receive',handoverId);await save();assert.equal(await page.evaluate(id=>MSA.data.state.passagensTurno.find(r=>r.id===id).status,handoverId),'recebida');
 const taskButton=page.locator('[data-action="wf-task"][data-id="'+handoverId+'"]').filter({hasText:'Concluir pendência'}).first();await taskButton.click();assert(await page.evaluate(id=>MSA.data.state.passagensTurno.find(r=>r.id===id).pendencias.find(t=>t.texto==='Conferir alimentador no próximo turno').done,handoverId));
 await route('qualidade');assert.equal(await page.locator('[data-action="wf-batch"]').count(),0);
 await goto('qualidade','qualidade');await page.locator('[role="tab"][data-id="lotes"]').click();await page.locator('#ops-list-search').fill('NHPL');const batchId=await page.evaluate(()=>MSA.data.state.lotesQualidade.find(b=>b.maquinaId==='NHPL').id);
 await workflow('batch',batchId);await fill({observacao:'Área vermelha, posição A2'});await save();await workflow('batch',batchId);await fill({observacao:'Reinspeção iniciada por lote'});await save();await workflow('batch',batchId);await fill({observacao:'Conformes liberadas; rejeitadas destinadas ao descarte'});await save();
 assert.equal(await page.evaluate(id=>MSA.data.state.lotesQualidade.find(b=>b.id===id).status,batchId),'liberado');await page.locator('[role="tab"][data-id="historico"]').click();await page.screenshot({path:'.qa-output/fluxos-qualidade-light.png'});
 await goto('supervisor','notificacoes');const alertId=await page.evaluate(id=>MSA.data.state.atendimentosAlertas.find(a=>a.sourceKey==='stop:'+id).id,stopId);
 await workflow('alert',alertId);await save();await workflow('alert',alertId);await fill({observacao:'Fluxo verificado'});await save();await workflow('alert',alertId);await fill({observacao:'Retomada confirmada'});await save();assert.equal(await page.evaluate(id=>MSA.data.state.atendimentosAlertas.find(r=>r.id===id).status,alertId),'resolvido');
 await route('funcionarios');const employee=await page.evaluate(()=>MSA.data.state.perfis.find(p=>p.cargo==='operador'&&p.setorId==='montagem').id);
 await workflow('staff',employee);await page.locator('[name="presenca"]').selectOption('ausente');assert.equal(await page.locator('[name="maquinaId"]').inputValue(),'');await save();
 await workflow('staff',employee);await page.locator('[name="presenca"]').selectOption('presente');await page.locator('[name="maquinaId"]').selectOption('NHPL');await save();
 await page.reload();await page.waitForSelector('[data-action="wf-staff"]');await page.evaluate(()=>MSA.telemetry.pause());assert.equal(await page.evaluate(id=>MSA.data.state.alocacoes.find(a=>a.funcionarioId===id&&a.turno==='1'&&a.dia===new Date(MSA.data.state.scenarioAt).toLocaleDateString('sv')).maquinaId,employee),'NHPL');
 for(const theme of ['light','dark']){await page.evaluate(t=>{localStorage.setItem('msa-theme',t);document.documentElement.dataset.theme=t;},theme);for(const width of [390,768,1536]){await page.setViewportSize({width,height:1000});for(const area of ['paradas','passagem','qualidade','notificacoes','funcionarios']){await route(area);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),theme+' '+width+' '+area);}if(width===390)await page.screenshot({path:'.qa-output/fluxos-equipe-'+theme+'-mobile.png'});}}
 // O relógio funciona fora do mapa; sair da tela da planta não desliga a coleta.
 await goto('chefe','producao');const before=await page.evaluate(()=>{const s=MSA.data.state;s.liveCycles.NHPL=MSA.scenarioLive.cycleSeconds(s.maquinas.find(m=>m.id==='NHPL'),s)-.5;MSA.demo.simulation.setRejectRate(0);MSA.demo.simulation.setDeviationRate(0);return s.registrosProducao.filter(r=>r.maquinaId==='NHPL').reduce((n,r)=>n+r.quantidade,0);});await page.evaluate(()=>MSA.telemetry.pause());
 await page.waitForFunction(n=>MSA.data.state.registrosProducao.filter(r=>r.maquinaId==='NHPL').reduce((n,r)=>n+r.quantidade,0)>n,before,{timeout:6000});
 assert.deepEqual(errors,[]);console.log('OK: cinco fluxos completos, motivos selecionáveis, permissões da Qualidade, recebimento por outra liderança, histórico e restauração; temas e três tamanhos de tela; produção continua sem abrir o mapa.');
}finally{await browser.close();server.kill();}
