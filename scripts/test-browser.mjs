/* Teste opcional com Chrome/Playwright e o Realtime Database Emulator reais.
   Firebase Auth é substituído apenas neste servidor local por identidades de teste. */
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {startEmulator,api,profile} from '../tests/emulator-fixture.mjs';
const playwrightModule=await import(process.env.MSA_PLAYWRIGHT_MODULE||'playwright');
const {chromium}=playwrightModule.default||playwrightModule;
const jar=process.env.MSA_DATABASE_EMULATOR_JAR;
if(!jar)throw new Error('Informe MSA_DATABASE_EMULATOR_JAR.');
const sdkPath=process.env.MSA_FIREBASE_SDK_DIR||resolve('.qa-sdk');
await mkdir(sdkPath,{recursive:true});
for(const file of ['firebase-app.js','firebase-database.js']) {
 try { await readFile(resolve(sdkPath,file)); }
 catch { const response=await fetch('https://www.gstatic.com/firebasejs/12.19.0/'+file);assert(response.ok);await writeFile(resolve(sdkPath,file),await response.text()); }
}
const e=await startEmulator(jar);
const server=http.createServer(async(req,res)=>{
 try {
  const pathname=new URL(req.url,'http://local').pathname;
  if(pathname==='/qa/firebase-app.js'||pathname==='/qa/firebase-database.js') {res.setHeader('Content-Type','application/javascript');res.end((await readFile(resolve(sdkPath,pathname.split('/').at(-1)),'utf8')).replaceAll('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js','/qa/firebase-app.js'));return;}
  if(pathname==='/assets/firebase-client.js') {res.setHeader('Content-Type','application/javascript');res.end(`(() => {
    const uid = new URL(location.href).searchParams.get('qa') || 'op';
    const ready = Promise.all([import('/qa/firebase-app.js'), import('/qa/firebase-database.js')]).then(([a,d])=>{
      const app=a.initializeApp({apiKey:'test-key',projectId:'msa-test',databaseURL:'https://msa-test.firebaseio.com'});
      const database=d.getDatabase(app);
      d.connectDatabaseEmulator(database,'127.0.0.1',${e.port},{mockUserToken:{sub:uid,user_id:uid,email:'re-1@msa-safety-9f978.invalid'}});
      return {database,databaseSDK:d};
    });
    MSA.firebase={ready:()=>ready};
    MSA.qaUID=uid;
  })();`);return;}
  if(pathname==='/assets/auth-service.js') {res.setHeader('Content-Type','application/javascript');res.end(`(() => {
    let current=null;
    MSA.auth={session:()=>current,role:(u=current)=>MSA.rbac.role(u),can:(p,u=current)=>MSA.rbac.can(p,u),
      async ready(){const c=await MSA.firebase.ready();const s=await c.databaseSDK.get(c.databaseSDK.ref(c.database,'perfis/'+MSA.qaUID));return current={...s.val(),id:MSA.qaUID};},
      async watch(callback,onError){const c=await MSA.firebase.ready();return c.databaseSDK.onValue(c.databaseSDK.ref(c.database,'perfis/'+MSA.qaUID),s=>{current=s.exists()?{...s.val(),id:MSA.qaUID}:null;callback(current);},onError);},
      async logout(){current=null;}
    };
  })();`);return;}
  const file=resolve('dist','.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(resolve('dist')+'/'))throw new Error('Caminho inválido.');
  res.setHeader('Content-Type',({'.js':'application/javascript','.html':'text/html','.css':'text/css','.png':'image/png'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch(err){res.statusCode=404;res.end(err.message);}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try {
 const seed={perfis:{op:profile('operador'),sup:profile('supervisor'),chief:profile('chefe'),qa:profile('qualidade','',''),newop:profile('operador','',''),newsup:profile('supervisor','',''),outside:profile('operador','injecao','INJ-01')}};
 assert.equal((await api(e.base,'','owner','PUT',seed)).status,200);
 browser=await chromium.launch({...(process.env.MSA_CHROME_BINARY?{executablePath:process.env.MSA_CHROME_BINARY}:{}),args:['--no-sandbox']});
 const errors=[];
 const open=async(uid,hash)=>{const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',err=>errors.push(uid+': '+err.message));await page.goto(base+'/sistema.html?dados=reais&qa='+uid+'#'+hash);await page.waitForFunction(()=>MSA.data?.state.ready&&MSA.data.state.connected,{timeout:15000});return page;};
 const sup=await open('sup','configuracoes');await sup.getByRole('button',{name:'Preparar máquinas de exemplo'}).click();await sup.getByText('Catálogo preparado.',{exact:false}).waitFor();
 assert.equal((await api(e.base,'maquinas/NHPL','owner')).data.metaDiaria,0);

 await sup.evaluate(()=>location.hash='maquinas');
 await sup.locator('.equipment-row[data-equipment-id="ABF-01"] [data-action="machine-detail"]').click();await sup.getByRole('button',{name:'Editar máquina'}).click();
 await sup.locator('[name="nome_0"]').fill('Temperatura');await sup.locator('[name="unidade_0"]').fill('°C');await sup.locator('[name="min_0"]').fill('240');await sup.locator('[name="max_0"]').fill('260');
 for(let index=1;index<4;index++){await sup.getByRole('button',{name:'Adicionar parâmetro'}).click();await sup.locator(`[name="nome_${index}"]`).fill(index===1?'Vácuo':'Zona '+index);await sup.locator(`[name="unidade_${index}"]`).fill(index===1?'mmHg':'°C');await sup.locator(`[name="min_${index}"]`).fill(index===1?'-600':'240');await sup.locator(`[name="max_${index}"]`).fill(index===1?'-300':'260');}
 await sup.getByRole('button',{name:'Salvar',exact:true}).click();await sup.waitForFunction(()=>Object.keys(MSA.data.state.maquinas.find(m=>m.id==='ABF-01').parametros).length===4);
 const op=await open('op','apontamentos'),chief=await open('chief','indicadores');
 for(const page of [op,sup,chief]) {await page.evaluate(()=>location.hash='');await page.waitForFunction(()=>location.hash==='#visao-geral');assert.equal(await page.locator('#page-title').innerText(),'Visão geral');}
 await op.evaluate(()=>location.hash='apontamentos');

 await op.getByRole('button',{name:'Registrar parâmetros',exact:true}).click();
 await op.locator('[name="valor_p0"]').fill('270');await op.locator('[name="valor_p1"]').fill('-400');await op.locator('[name="valor_p2"]').fill('250');await op.locator('[name="valor_p3"]').fill('250');await op.locator('[name="lote"]').fill('DEMO-01');await op.getByRole('button',{name:'Salvar',exact:true}).click();await chief.waitForFunction(()=>MSA.data.state.leituras.length===1);
 await chief.evaluate(()=>location.hash='notificacoes');await chief.getByText('Parâmetro ·',{exact:false}).waitFor();await chief.evaluate(()=>location.hash='indicadores');
 await sup.evaluate(()=>location.hash='maquinas');await sup.locator('.equipment-row[data-equipment-id="ABF-01"] [data-action="machine-detail"]').click();await sup.locator('.machine-parameters[open]').getByText('270 °C',{exact:false}).waitFor();
 assert.equal(await op.locator('.nav-item[data-page="indicadores"]').isVisible(),false);
 assert.equal(await chief.locator('.nav-item[data-page="apontamentos"]').isVisible(),false);
 await op.getByRole('button',{name:'Registrar produção',exact:true}).click();
 await op.locator('[name="quantidade"]').fill('240');await op.locator('[name="lote"]').fill('DEMO-01');await op.getByRole('button',{name:'Salvar',exact:true}).click();
 await op.getByText('Informações salvas no Firebase.',{exact:true}).waitFor();
 await chief.waitForFunction(()=>MSA.data.state.registrosProducao.some(r=>r.quantidade===240));
 assert.match(await chief.locator('#page-content').innerText(),/240/);
 await sup.evaluate(()=>location.hash='conferencia');await sup.locator('button[data-action="review"][data-collection="registrosProducao"]').click();await sup.getByText('Registro conferido.',{exact:true}).waitFor();
 await op.waitForFunction(()=>MSA.data.state.registrosProducao[0].verificado===true);
 await op.locator('button[data-action="edit"][data-collection="registrosProducao"]').click();await op.locator('[name="quantidade"]').fill('250');await op.getByRole('button',{name:'Salvar',exact:true}).click();await op.waitForFunction(()=>MSA.data.state.registrosProducao[0].quantidade===250&&!MSA.data.state.registrosProducao[0].verificado);
 await chief.waitForFunction(()=>MSA.data.state.registrosProducao[0].quantidade===250);
 await op.evaluate(()=>location.hash='indicadores');await op.waitForFunction(()=>location.hash==='#visao-geral');assert.equal(await op.locator('#page-title').innerText(),'Visão geral');
 const blocked=await op.evaluate(async()=>{const c=await MSA.firebase.ready();c.databaseSDK.goOffline(c.database);await new Promise(r=>setTimeout(r,100));try{await MSA.data.save('ocorrencias',{maquinaId:'ABF-01',descricao:'Offline',data:Date.now()});return false;}catch(err){return err.message.includes('conexão');}finally{c.databaseSDK.goOnline(c.database);}});assert(blocked);await op.waitForFunction(()=>MSA.data.state.connected);
 await op.evaluate(()=>location.hash='paradas');await op.getByRole('button',{name:'Registrar parada',exact:true}).click();await op.locator('[name="motivoCodigo"]').selectOption('outro');await op.locator('[name="motivoOutro"]').fill('Falha de avanço');await op.getByRole('button',{name:'Salvar',exact:true}).click();await op.waitForFunction(()=>MSA.data.state.paradas.length===1);
 await sup.evaluate(()=>location.hash='paradas');await sup.locator('[role="tab"][data-id="abertas"]').click();await sup.getByRole('button',{name:'Encerrar',exact:true}).click();await sup.locator('[name="causa"]').fill('Ajuste realizado');await sup.getByRole('button',{name:'Salvar',exact:true}).click();await op.waitForFunction(()=>MSA.data.state.paradas[0].fim>0);
 await op.evaluate(()=>location.hash='qualidade');await op.getByRole('button',{name:'Registrar refugo / perda'}).click();await op.locator('[name="quantidade"]').fill('4');await op.locator('[name="motivo"]').fill('Selo enrugado');await op.locator('[name="lote"]').fill('DEMO-01');await op.getByRole('button',{name:'Salvar',exact:true}).click();await chief.waitForFunction(()=>MSA.data.state.perdas.length===1);
 await op.evaluate(()=>location.hash='ocorrencias');await op.getByRole('button',{name:'Registrar ocorrência'}).click();await op.locator('[name="descricao"]').fill('Oscilação no processo');await op.getByRole('button',{name:'Salvar',exact:true}).click();await sup.waitForFunction(()=>MSA.data.state.ocorrencias.length===1);
 await sup.evaluate(()=>location.hash='ocorrencias');await sup.getByRole('button',{name:'Resolver',exact:true}).click();await sup.locator('[name="resolucao"]').fill('Parâmetros conferidos');await sup.getByRole('button',{name:'Salvar',exact:true}).click();await op.waitForFunction(()=>MSA.data.state.ocorrencias[0].status==='resolvida');
 await sup.evaluate(()=>location.hash='conferencia');await sup.getByRole('button',{name:'Consolidar setor'}).click();await sup.locator('[name="observacao"]').fill('Produção acompanhada; pendência resolvida.');await sup.getByRole('button',{name:'Salvar',exact:true}).click();await chief.waitForFunction(()=>MSA.data.state.consolidacoes.length===1);
 // Chat original, com mensagens compartilhadas no Realtime Database.
 await op.evaluate(()=>location.hash='chat');await op.locator('#chat-message').waitFor({state:'visible'});await op.waitForFunction(()=>!document.querySelector('#chat-message').disabled);assert(await op.locator('#chat-demo-update').isHidden());await op.locator('#chat-message').fill('Passagem de turno registrada');await op.locator('#chat-send').click();await op.getByText('Passagem de turno registrada',{exact:true}).waitFor();
 await sup.evaluate(()=>location.hash='chat');await sup.getByText('Passagem de turno registrada',{exact:true}).waitFor();
 const privateId=await op.evaluate(async()=>{const thread=await MSA.firebaseChat.request('threads',{method:'POST',body:JSON.stringify({person_id:'sup'})});await MSA.firebaseChat.request('messages',{method:'POST',body:JSON.stringify({conversation:thread.id,body:'Conversa privada',client_key:'private-qa'})});return thread.id;});
 const priv=await sup.evaluate(async id=>MSA.firebaseChat.request('messages?conversation='+id),privateId);assert.equal(priv.messages[0].body,'Conversa privada');
 assert.equal((await api(e.base,'mensagens/'+privateId,'outside')).status,401);
 // Nome/RE e origem preservados; correção altera o total, sem duplicar a produção.
 const data=(await api(e.base,'','owner')).data;assert.equal(Object.keys(data.registrosProducao).length,1);assert.equal(Object.values(data.registrosProducao)[0].usuarioId,'op');assert.equal(Object.values(data.registrosProducao)[0].quantidade,250);
 // Cadastro não exige setor; escolha de trabalho acontece na sessão já aberta.
 await chief.evaluate(()=>location.hash='configuracoes');await chief.getByRole('button',{name:'Preparar máquinas de exemplo'}).click();await chief.getByText('Catálogo preparado.',{exact:false}).waitFor();
 const newop=await open('newop','apontamentos'),newsup=await open('newsup','producao');
 assert.equal(await newop.getByRole('button',{name:'Registrar produção',exact:true}).count(),0);
 assert.equal(await newop.locator('#ops-work-machine').inputValue(),'');
 await newop.locator('#ops-work-machine').selectOption('INJ-01');await newop.waitForFunction(()=>MSA.data.user?.maquinaId==='INJ-01'&&MSA.data.state.ready&&MSA.data.state.connected);
 await newop.getByRole('button',{name:'Registrar produção',exact:true}).waitFor();
 await newsup.locator('#sector-selector').selectOption('injecao');await newsup.waitForFunction(()=>MSA.data.user?.setorId==='injecao'&&MSA.data.state.ready&&MSA.data.state.connected);
 await newop.close();await newsup.close();
 // O mesmo RE registra em outro setor; os dados anteriores mantêm sua origem.
 await op.evaluate(()=>location.hash='apontamentos');
 await op.locator('#ops-work-machine').selectOption('SEL-01');await op.waitForFunction(()=>MSA.data.user?.maquinaId==='SEL-01'&&MSA.data.state.ready&&MSA.data.state.connected);
 assert.equal(await op.locator('#sector-selector').inputValue(),'selagem');
 assert.equal((await op.evaluate(()=>MSA.data.state.registrosProducao.length)),0);
 await op.getByRole('button',{name:'Registrar produção',exact:true}).click();await op.locator('[name="quantidade"]').fill('30');await op.locator('[name="lote"]').fill('SEL-02');await op.getByRole('button',{name:'Salvar',exact:true}).click();
 await chief.waitForFunction(()=>MSA.data.state.registrosProducao.length===2);
 await sup.locator('#sector-selector').selectOption('selagem');await sup.waitForFunction(()=>MSA.data.user?.setorId==='selagem'&&MSA.data.state.ready&&MSA.data.state.registrosProducao.some(r=>r.quantidade===30));
 const moved=(await api(e.base,'','owner')).data,history=Object.values(moved.registrosProducao);
 assert.equal(moved.perfis.op.re,data.perfis.op.re);assert.equal(moved.perfis.op.cargo,'operador');
 assert.equal(history.find(r=>r.quantidade===250).maquinaId,'ABF-01');assert.equal(history.find(r=>r.quantidade===250).setorId,'montagem');
 assert.equal(history.find(r=>r.quantidade===30).maquinaId,'SEL-01');assert.equal(history.find(r=>r.quantidade===30).setorId,'selagem');
 assert.equal(history.find(r=>r.quantidade===30).usuarioRe,history.find(r=>r.quantidade===250).usuarioRe);
 await op.locator('#ops-work-machine').selectOption('ABF-01');await op.waitForFunction(()=>MSA.data.user?.maquinaId==='ABF-01'&&MSA.data.state.ready&&MSA.data.state.connected);
 await sup.locator('#sector-selector').selectOption('montagem');await sup.waitForFunction(()=>MSA.data.user?.setorId==='montagem'&&MSA.data.state.ready&&MSA.data.state.connected);
 // Alocação de turno preserva o contexto de login e a origem dos apontamentos.
 await sup.evaluate(()=>location.hash='funcionarios');await sup.locator('[data-action="wf-staff"][data-id="op"]').click();await sup.locator('[name="presenca"]').selectOption('presente');await sup.locator('[name="maquinaId"]').selectOption('ABF-02');await sup.getByRole('button',{name:'Salvar',exact:true}).click();await sup.waitForFunction(()=>MSA.data.state.alocacoes.some(a=>a.funcionarioId==='op'&&a.maquinaId==='ABF-02'));
 const allocation=(await api(e.base,'alocacoes','owner')).data;assert(Object.values(allocation).some(a=>a.funcionarioId==='op'&&a.maquinaId==='ABF-02'));assert.equal((await api(e.base,'perfis/op','owner')).data.maquinaId,'ABF-01');
 await op.evaluate(()=>location.hash='apontamentos');assert.match(await op.locator('#page-content').innerText(),/Montagem 01/);
 // Novos fluxos compartilhados também usam o SDK real e as regras do emulador.
 const realHandover=await sup.evaluate(async()=>{const d=new Date();d.setDate(d.getDate()-1);return MSA.data.workflow('handover-create',{maquinaId:'ABF-01',dia:d.toLocaleDateString('sv'),turno:'1',acoesRealizadas:'Abastecimento revisto',pendencias:'Conferir alimentação'});});
 await chief.waitForFunction(id=>MSA.data.state.passagensTurno.some(h=>h.id===id),realHandover);await chief.evaluate(id=>MSA.data.workflow('handover-receive',{},id),realHandover);
 await chief.evaluate(id=>MSA.data.workflow('handover-task',{taskId:MSA.data.state.passagensTurno.find(h=>h.id===id).pendencias[0].id},id),realHandover);
 const storedHandover=(await api(e.base,'passagensTurno/'+realHandover,'owner')).data;assert.equal(storedHandover.recebidoId,'chief');assert(storedHandover.pendencias[0].done);
 const realStop=await sup.evaluate(()=>MSA.data.state.paradas[0].id);await sup.evaluate(id=>MSA.data.workflow('classify-stop',{motivoCodigo:'sensor'},id),realStop);assert.equal((await api(e.base,'paradas/'+realStop,'owner')).data.motivoCodigo,'sensor');
 const paramAlert=await chief.evaluate(()=>MSA.data.state.atendimentosAlertas.find(a=>a.sourceKey.startsWith('param:ABF-01:')).id);
 await chief.evaluate(id=>MSA.data.workflow('alert-transition',{status:'reconhecido'},id),paramAlert);await chief.evaluate(id=>MSA.data.workflow('alert-transition',{status:'atendimento',observacao:'Conferir processo'},id),paramAlert);
 await op.evaluate(()=>MSA.data.save('leituras',{maquinaId:'ABF-01',data:Date.now(),lote:'DEMO-01',valores:{p0:255,p1:-400,p2:250,p3:250}},MSA.data.state.leituras[0].id));await chief.waitForFunction(id=>MSA.data.state.atendimentosAlertas.find(a=>a.id===id)?.active===false,paramAlert);
 await chief.evaluate(id=>MSA.data.workflow('alert-transition',{status:'resolvido',observacao:'Temperatura normalizada'},id),paramAlert);assert.equal((await api(e.base,'atendimentosAlertas/'+paramAlert,'owner')).data.status,'resolvido');
 const qa=await open('qa','qualidade');await qa.locator('[role="tab"][data-id="lotes"]').click();const realBatch=await qa.evaluate(()=>MSA.data.state.lotesQualidade.find(b=>b.lote==='DEMO-01').id);
 await qa.evaluate(id=>MSA.data.workflow('batch-transition',{status:'segregado',observacao:'Área vermelha'},id),realBatch);await qa.waitForFunction(id=>MSA.data.state.lotesQualidade.find(b=>b.id===id)?.status==='segregado',realBatch);
 await qa.evaluate(id=>MSA.data.workflow('batch-transition',{status:'reinspecao',observacao:'Reinspeção iniciada'},id),realBatch);await qa.waitForFunction(id=>MSA.data.state.lotesQualidade.find(b=>b.id===id)?.status==='reinspecao',realBatch);
 await qa.evaluate(id=>{const b=MSA.data.state.lotesQualidade.find(b=>b.id===id);return MSA.data.workflow('batch-transition',{status:'liberado',observacao:'Peças conformes liberadas',inspecionadas:b.quantidade,descartadas:b.refugosIdentificados+2},id);},realBatch);await qa.waitForFunction(id=>MSA.data.state.lotesQualidade.find(b=>b.id===id)?.status==='liberado',realBatch);
 const storedBatch=(await api(e.base,'lotesQualidade/'+realBatch,'owner')).data;assert.equal(storedBatch.quantidade,254);assert.equal(storedBatch.liberadas,248);assert.equal(storedBatch.descartadas,6);assert.equal(storedBatch.status,'liberado');await qa.close();
 await chief.evaluate(()=>location.hash='indicadores');
 const artifacts=process.env.MSA_QA_OUTPUT||resolve('.qa-output');await mkdir(artifacts,{recursive:true});
 await chief.screenshot({path:resolve(artifacts,'chefe-desktop.png'),fullPage:true});
 for(const page of [op,sup,chief]){await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('.sidebar-toggle').click();assert(await page.locator('#sidebar').evaluate(el=>!el.inert));await page.locator('.drawer-close').click();}
 await op.screenshot({path:resolve(artifacts,'operador-mobile.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('OK: cadastro sem setor; mesma conta troca de máquina entre setores; histórico preservado; quatro cargos em sessões separadas; cinco fluxos persistidos; Firebase real no emulador; RBAC, produção, conferência, qualidade, paradas, ocorrências, consolidação e chat. Desktop e mobile sem overflow.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));e.close();}
