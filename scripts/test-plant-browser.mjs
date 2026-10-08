// Exercita a página real com fontes de teste em memória. Não acessa o Firebase.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,relative,isAbsolute,sep} from 'node:path';
const playwrightModule=await import(process.env.MSA_PLAYWRIGHT_MODULE||'playwright');
const {chromium}=playwrightModule.default||playwrightModule;
const publicDir=resolve('dist');
const output=process.env.MSA_QA_OUTPUT||resolve('.qa-plant');
const replacements={
  '/assets/firebase-client.js':'MSA.firebase={};',
  '/assets/auth-service.js':`(() => {
    const cargo=new URL(location.href).searchParams.get('qa')||'chefe';
    const u={id:'qa-'+cargo,nome:'Luiz Oliveira',re:'1042',cargo,status:'ativo',setorId:cargo==='chefe'?'': 'injecao',maquinaId:cargo==='operador'?'INJ-01':''};
    MSA.auth={session:()=>u,role:()=>MSA.rbac.role(u),can:p=>MSA.rbac.can(p,u),ready:async()=>u,watch:async()=>()=>{},logout:async()=>{}};
  })();`,
  '/assets/operations-service.js':`(() => {
    const now=Date.now(),listeners=new Set();
    const state={ready:true,connected:true,error:'',maquinas:structuredClone(MSA.config.machines),registrosProducao:[{id:'prod1',maquinaId:'INJ-01',inicio:now-180000,fim:now,quantidade:73}],leituras:[{id:'l1',maquinaId:'INJ-01',data:now,valores:{temperatura:250}}],paradas:[{id:'s1',maquinaId:'SEL-01',inicio:now-90000,fim:null,motivo:'Parada registrada'}],perdas:[],ocorrencias:[],consolidacoes:[],perfis:[]};
    MSA.data={state,user:null,start:async u=>{MSA.data.user=u;},stop(){},subscribe(callback){listeners.add(callback);return()=>listeners.delete(callback);},changeContext:async c=>Object.assign(MSA.auth.session(),c)};
    MSA.qaNotify=()=>listeners.forEach(callback=>callback(state));
  })();`,
  '/assets/firebase-chat.js':'',
  '/js/chat.js':'window.MSAChat={show(){},hide(){},clear(){},setSector(){}};'
};
const server=http.createServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,'http://qa').pathname;
    if(Object.hasOwn(replacements,pathname)){res.setHeader('Content-Type','application/javascript');res.end(replacements[pathname]);return;}
    const file=resolve(publicDir,'.'+pathname);
    const rel=relative(publicDir,file);if(rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel))throw new Error('Caminho inválido.');
    res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png'})[extname(file)]||'application/octet-stream');
    res.end(await readFile(file));
  }catch(e){res.statusCode=404;res.end(e.message);}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
await mkdir(output,{recursive:true});
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],...(process.env.MSA_CHROME_BINARY?{executablePath:process.env.MSA_CHROME_BINARY}:{})});
  const errors=[];
  const showSource=async(page,value)=>{
    await page.locator(new URL(page.url()).hash==='#mapa-planta'?'.plant-page.is-map':'.plant-page.is-supervisory').waitFor();
    const select=page.locator('#plant-source');
    if(!await select.isVisible()){
      const details=page.locator('details').filter({has:select});
      assert.equal(await details.count(),1,'fonte deve estar no menu de filtros');
      await details.locator('summary').click();
    }
    const mapMode=new URL(page.url()).hash==='#mapa-planta';
    await select.focus();
    await select.selectOption(value);
    if(mapMode){
      assert(await page.locator('#plant-source').evaluate(el=>document.activeElement===el),'mudar fonte mantém o foco no controle do header');
      const details=page.locator('details').filter({has:page.locator('#plant-source')});
      if(await details.count())assert(await details.evaluate(el=>el.open),'mudar fonte mantém filtros abertos');
    }
  };
  const openSummary=async(page,id,{keyboard=false}={})=>{
    const machine=page.locator('[data-machine="'+id+'"]');
    await page.waitForFunction(()=>document.querySelector('#plant-world')?.hasAttribute('transform'));
    const snapshot={hash:new URL(page.url()).hash,camera:await page.locator('#plant-world').getAttribute('transform')};
    if(keyboard){await machine.focus();await page.keyboard.press('Enter');}
    else await machine.click();
    const dialog=page.locator('.plant-machine-dialog');
    await dialog.waitFor({state:'visible'});
    assert(await dialog.evaluate(el=>el instanceof HTMLDialogElement&&el.open),'resumo usa diálogo nativo');
    assert.equal(new URL(page.url()).hash,snapshot.hash,'abrir resumo mantém a rota da planta');
    assert.equal(await page.locator('#plant-world').getAttribute('transform'),snapshot.camera,'abrir resumo mantém a câmera');
    assert(await dialog.locator('#plant-machine-title').innerText(),'nome do equipamento no resumo');
    assert.match(await dialog.locator('.machine-dialog-heading .supervisor-code').innerText(),new RegExp(id));
    assert.equal(await page.locator('.supervisor-heading').count(),0,'resumo não navega ao supervisório');
    for(const field of ['goodCount','goal','operatingSeconds','rejectedCount','alarms.length'])assert.equal(await dialog.locator('[data-value="'+field+'"]').count(),1,'campo do resumo '+field);
    assert.equal(await dialog.locator('[data-machine-state]').count(),1);
    assert.equal(await dialog.locator('[data-last-stop]').count(),1);
    assert.equal(await dialog.locator('[data-line-piece]').count(),12,'prévia visual presente no resumo');
    return {dialog,machine,...snapshot};
  };
  const closeSummary=async(page,summary,escape=false)=>{
    if(escape)await page.keyboard.press('Escape');
    else await summary.dialog.locator('[data-plant-action="close-summary"]').click();
    await summary.dialog.waitFor({state:'hidden'});
    assert.equal(new URL(page.url()).hash,summary.hash,'fechar resumo mantém a rota');
    assert.equal(await page.locator('#plant-world').getAttribute('transform'),summary.camera,'fechar resumo mantém a câmera');
    assert(await summary.machine.evaluate(el=>document.activeElement===el),'fechar resumo devolve foco ao equipamento');
  };
  const openFull=async(page,id,options)=>{
    const summary=await openSummary(page,id,options);
    await summary.dialog.locator('[data-plant-action="open-supervisor"]').click();
    await page.locator('.supervisor-heading').waitFor();
    assert.equal(new URL(page.url()).hash,'#mapa-planta/'+id);
    return summary;
  };
  const open=async(cargo,hash='mapa-planta',viewport={width:1440,height:1000})=>{
    const page=await browser.newPage({viewport});
    await page.route('**/*',async route=>{
      const pathname=new URL(route.request().url()).pathname;
      if(Object.hasOwn(replacements,pathname)){await route.fulfill({contentType:'application/javascript',body:replacements[pathname]});return;}
      const file=resolve(publicDir,'.'+pathname),rel=relative(publicDir,file);
      if(rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel)){await route.abort();return;}
      try{await route.fulfill({contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf'})[extname(file)]||'application/octet-stream',body:await readFile(file)});}catch{await route.fulfill({status:404,body:'Arquivo não encontrado'});}
    });
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/sistema.html?dados=reais&qa='+cargo+'#'+hash);
    await page.locator('.plant-page').waitFor();
    return page;
  };
  const page=await open('chefe');
  assert.equal(await page.locator('[data-machine]').count(),32);
  assert.equal(await page.locator('.machine-state-line').count(),0,'barras laterais foram removidas');
  assert.equal(await page.locator('.machine-state-dot').count(),32,'cada máquina tem um indicador circular');
  assert(['M-4 0l3 3 5-6','M0-4V1M0 4v.01'].includes(await page.locator('[data-machine="INJ-01"] .machine-state-symbol').getAttribute('d')),'operando indica confirmação ou alerta');
  assert.equal(await page.locator('[data-machine="INJ-05"] .machine-state-symbol').getAttribute('d'),'M-2.5-4V4M2.5-4V4');
  assert.equal(await page.locator('[data-map-count]').innerText(),'32');
  assert.equal(await page.locator('.plant-toolbar').count(),0,'mapa usa os controles do header principal');
  assert.equal(await page.locator('.machine-state-text,.machine-progress-track,.machine-progress-fill').count(),0,'máquinas exibem apenas footprint, código e sinalização');
  assert.equal(await page.locator('[data-route].is-highlighted').count(),0,'rotas começam discretas');
  const shell=page.locator('.app-shell');
  assert.equal(await shell.getAttribute('data-plant-theme'),'light');
  const lightCanvas=await page.locator('#plant-canvas').evaluate(el=>getComputedStyle(el).backgroundColor);
  await page.locator('[data-theme-toggle]').click();
  assert.equal(await shell.getAttribute('data-plant-theme'),'dark');
  assert.notEqual(await page.locator('#plant-canvas').evaluate(el=>getComputedStyle(el).backgroundColor),lightCanvas,'tema altera o canvas');
  assert(await page.locator('[data-machine="INJ-01"] .machine-code').isVisible());
  await page.screenshot({path:resolve(output,'mapa-desktop-dark.png'),fullPage:true});
  await page.locator('[data-theme-toggle]').click();
  assert.equal(await shell.getAttribute('data-plant-theme'),'light');
  await page.locator('[data-machine="INJ-01"]').hover();
  await page.locator('#plant-tooltip').waitFor({state:'visible'});
  assert.match(await page.locator('#plant-tooltip').innerText(),/INJ-01/);
  await page.locator('.plant-summary').hover();
  await page.locator('#plant-tooltip').waitFor({state:'hidden'});
  await page.screenshot({path:resolve(output,'mapa-desktop.png'),fullPage:true});
  const worldBefore=await page.locator('#plant-world').getAttribute('transform');
  await page.locator('[data-plant-action="zoom-in"]').click();
  const afterZoom=await page.locator('#plant-world').getAttribute('transform');
  const viewport=await page.locator('#plant-canvas').boundingBox();
  await page.mouse.move(viewport.x+12,viewport.y+100);
  await page.mouse.down();await page.mouse.move(viewport.x+46,viewport.y+123,{steps:4});await page.mouse.up();
  assert.notEqual(await page.locator('#plant-world').getAttribute('transform'),afterZoom);
  assert.equal(new URL(page.url()).hash,'#mapa-planta');
  await page.waitForTimeout(400);
  const zoomed=await page.locator('#plant-world').getAttribute('transform');
  assert.notEqual(zoomed,worldBefore);
  const pointerSummary=await openSummary(page,'INJ-01');
  assert.equal(await page.locator('[data-route="capacetes"].is-highlighted').count(),1,'selecionar equipamento destaca o fluxo relacionado');
  await page.screenshot({path:resolve(output,'resumo-maquina-light.png'),fullPage:true});
  const initialUpdate=await pointerSummary.dialog.locator('[data-modal-updated]').innerText();
  const initialPieces=await pointerSummary.dialog.locator('[data-line-piece]').evaluateAll(ns=>ns.map(n=>n.getAttribute('transform')));
  await page.waitForTimeout(1500);
  assert.notEqual(await pointerSummary.dialog.locator('[data-modal-updated]').innerText(),initialUpdate,'leitura do resumo atualiza ao vivo');
  assert.notDeepEqual(await pointerSummary.dialog.locator('[data-line-piece]').evaluateAll(ns=>ns.map(n=>n.getAttribute('transform'))),initialPieces,'prévia do resumo atualiza ao vivo');
  await closeSummary(page,pointerSummary);
  assert.equal(await page.locator('[data-route].is-highlighted').count(),0,'fechar resumo remove destaque temporário da rota');
  const keyboardSummary=await openSummary(page,'INJ-01',{keyboard:true});
  await closeSummary(page,keyboardSummary,true);
  await page.locator('[data-theme-toggle]').click();
  const darkSummary=await openSummary(page,'INJ-01',{keyboard:true});
  await page.screenshot({path:resolve(output,'resumo-maquina-dark.png'),fullPage:true});
  await closeSummary(page,darkSummary);
  await page.locator('[data-theme-toggle]').click();
  await openFull(page,'INJ-01');
  assert.equal(new URL(page.url()).hash,'#mapa-planta/INJ-01');
  assert.match(await page.locator('.supervisor-code').innerText(),/INJ-01/);
  await page.locator('[data-plant-action="pause"]').click();
  const frozenPieces=await page.locator('[data-line-piece]').evaluateAll(ns=>ns.map(n=>n.getAttribute('transform')));
  const frozen=await page.locator('.supervisor-metrics [data-value="goodCount"]').innerText();
  await page.waitForTimeout(1300);
  assert.equal(await page.locator('.supervisor-metrics [data-value="goodCount"]').innerText(),frozen);
  assert.deepEqual(await page.locator('[data-line-piece]').evaluateAll(ns=>ns.map(n=>n.getAttribute('transform'))),frozenPieces);
  assert.equal(await page.locator('[data-line-piece]').count(),12);
  await page.screenshot({path:resolve(output,'supervisor-injecao.png'),fullPage:true});
  await page.locator('#reading-temperatura').click();
  assert(await page.locator('#reading-temperatura strong').isVisible());
  await page.locator('[data-plant-action="pause"]').click();
  const stoppedPieces=await page.locator('[data-line-piece]').evaluateAll(ns=>ns.map(n=>n.getAttribute('transform')));
  await page.locator('#plant-scenario').selectOption('parada');
  await page.waitForTimeout(1200);
  assert.deepEqual(await page.locator('[data-line-piece]').evaluateAll(ns=>ns.map(n=>n.getAttribute('transform'))),stoppedPieces);
  assert.equal(await page.locator('[data-machine-state]').innerText(),'Parada');
  assert.equal(await page.locator('[data-value="speed"]').innerText(),'0 peças/min');
  await page.locator('#plant-scenario').selectOption('alerta');
  assert.equal(await page.locator('[data-machine-state]').innerText(),'Operando');
  assert(await page.locator('.hmi-alarms li').count());
  await page.getByRole('tab',{name:'Paradas e eficiência',exact:true}).click();
  assert.match(await page.locator('#plant-tab-panel .hmi-efficiency').innerText(),/OEE/);
  assert(await page.locator('.ops-table tbody tr').count());
  await page.getByRole('tab',{name:'Histórico',exact:true}).click();
  assert.match(await page.locator('#plant-tab-panel').innerText(),/Parâmetro acima do limite/);
  await page.getByRole('tab',{name:'Qualidade',exact:true}).click();
  assert.match(await page.locator('#plant-tab-panel').innerText(),/Taxa de refugo/);
  await page.getByRole('button',{name:'Voltar à planta',exact:true}).click();
  await page.locator('#plant-svg').waitFor();
  await page.waitForFunction(expected=>document.querySelector('#plant-world')?.getAttribute('transform')===expected,zoomed);
  assert.equal(await page.locator('#plant-world').getAttribute('transform'),zoomed);
  await page.locator('[data-plant-product="fones"]').click();
  assert.equal(await page.locator('[data-machine="INJ-01"]').getAttribute('aria-disabled'),'true');
  await page.locator('[data-plant-product="todos"]').click();
  await page.locator('#plant-sector').selectOption('injecao');
  assert.equal(await page.locator('[data-map-count]').innerText(),'6');
  await page.locator('#plant-status').selectOption('setup');
  assert.equal(Number(await page.locator('[data-map-count]').innerText()),await page.locator('[data-machine][aria-disabled="false"]').count());
  assert.equal(await page.locator('[data-machine="INJ-01"]').getAttribute('aria-disabled'),'true');
  await page.locator('#plant-status').selectOption('todos');
  await page.locator('#plant-problems').evaluate(el=>{el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});
  assert.equal(Number(await page.locator('[data-map-count]').innerText()),await page.locator('[data-machine][aria-disabled="false"]').count());
  await page.locator('#plant-problems').evaluate(el=>{el.checked=false;el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.locator('#plant-sector').selectOption('todos');
  await openFull(page,'ABF-01',{keyboard:true});
  assert.equal(new URL(page.url()).hash,'#mapa-planta/ABF-01');
  await page.screenshot({path:resolve(output,'supervisor-montagem.png'),fullPage:true});
  await page.locator('[data-plant-action="back"]').click();
  await showSource(page,'records');
  assert.match(await page.locator('[data-machine="INJ-01"]').getAttribute('aria-label'), /INJ-01 · .+ · Sem dados/);
  const recordsSummary=await openSummary(page,'INJ-01');
  assert.equal(await recordsSummary.dialog.locator('[data-value="goodCount"]').innerText(),'73 peças');
  assert.equal(await recordsSummary.dialog.locator('[data-machine-state]').innerText(),'Sem dados');
  await recordsSummary.dialog.locator('[data-plant-action="open-supervisor"]').click();
  await page.locator('.supervisor-heading').waitFor();
  assert.equal(await page.locator('[data-machine-state]').innerText(),'Sem dados');
  assert.equal(await page.locator('.supervisor-metrics [data-value="cycleSeconds"]').innerText(),'—');
  assert.equal(await page.locator('.supervisor-metrics [data-value="goodCount"]').innerText(),'73 peças');
  await page.getByRole('tab',{name:'Paradas e eficiência',exact:true}).click();
  assert.match(await page.locator('#plant-tab-panel').innerText(),/OEE indisponível/);
  // O catálogo recebido depois da abertura também deve entrar na planta.
  await page.locator('[data-plant-action="back"]').click();
  await page.evaluate(()=>{const m=MSA.data.state.maquinas;MSA.data.state.maquinas=[];MSA.qaNotify();window.qaCatalog=m;});
  await page.locator('#plant-empty').waitFor({state:'visible'});
  await page.evaluate(()=>{MSA.data.state.maquinas=window.qaCatalog;MSA.qaNotify();});
  assert.equal(await page.locator('[data-machine]').count(),await page.evaluate(()=>MSA.config.machines.length));
  // O adaptador começa sem parâmetros e os acrescenta na primeira leitura.
  await page.evaluate(()=>MSA.telemetry.useAdapter({name:'CLP de teste',subscribe(send,fail){MSA.qaSend=send;MSA.qaFail=fail;return()=>{};}}));
  const adapterSummary=await openSummary(page,'INJ-01');
  await page.evaluate(()=>MSA.qaSend({id:'INJ-01',state:'operando',updatedAt:Date.now(),goodCount:99,totalCount:100,rejectedCount:1,cycleSeconds:26,cycleProgress:.4,speed:2.3,parameters:{temperatura:{nome:'Temperatura',value:245,unidade:'°C',min:230,max:260}},events:[],timeline:[],samples:[]}));
  assert.equal(await adapterSummary.dialog.locator('[data-value="goodCount"]').innerText(),'99 peças');
  assert.equal(await adapterSummary.dialog.locator('[data-machine-state]').innerText(),'Operando');
  await page.evaluate(()=>MSA.qaSend({id:'INJ-01',state:'parada',updatedAt:Date.now(),goodCount:101,totalCount:103,rejectedCount:2,cycleSeconds:26,cycleProgress:.4,speed:0,parameters:{temperatura:{nome:'Temperatura',value:245,unidade:'°C',min:230,max:260}},events:[],timeline:[],samples:[]}));
  assert.equal(await adapterSummary.dialog.locator('[data-value="goodCount"]').innerText(),'101 peças','contador do resumo acompanha nova leitura');
  assert.equal(await adapterSummary.dialog.locator('[data-value="rejectedCount"]').innerText(),'2 peças');
  assert.equal(await adapterSummary.dialog.locator('[data-machine-state]').innerText(),'Parada');
  await adapterSummary.dialog.locator('[data-plant-action="open-supervisor"]').click();
  await page.locator('.supervisor-heading').waitFor();
  assert.equal(await page.locator('#reading-temperatura strong').innerText(),'245 °C');
  assert.equal(await page.locator('[data-machine-state]').innerText(),'Parada');
  await page.evaluate(()=>MSA.qaFail());
  assert.match(await page.locator('.plant-data-error').innerText(),/sem comunicação/);
  await page.evaluate(()=>MSA.qaSend({id:'INJ-01',state:'operando',updatedAt:Date.now(),parameters:{}}));
  assert.equal(await page.locator('.plant-data-error').isVisible(),false);
  await page.evaluate(()=>MSA.telemetry.disconnectAdapter());
  // Rotas diretas e os diferentes cargos preservam o escopo real.
  const deep=await open('supervisor','mapa-planta/INJ-03');
  assert.match(await deep.locator('.supervisor-code').innerText(),/INJ-03/);
  await deep.screenshot({path:resolve(output,'supervisor-injecao.png'),fullPage:true});
  await showSource(deep,'records');
  await deep.locator('.plant-unavailable').waitFor();
  const operator=await open('operador');
  await showSource(operator,'records');
  assert.equal(await operator.locator('[data-machine]').count(),1);
  assert.equal(await operator.locator('[data-machine]').getAttribute('data-machine'),'INJ-01');
  // Desktop, tablet e celular: sem extravasamento e navegação funcional.
  for(const width of [1024,768,390,320]) {
    await page.setViewportSize({width,height:844});
    await page.evaluate(()=>location.hash='mapa-planta');
    await page.locator('#plant-svg').waitFor();
    await page.locator('#plant-sector').selectOption('todos');
    await page.locator('[data-plant-action="fit"]').click();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(width===390)await page.screenshot({path:resolve(output,'mapa-mobile.png')});
    const mobileSummary=await openSummary(page,'INJ-01',{keyboard:true});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'resumo cabe na largura '+width);
    if(width===390)await page.screenshot({path:resolve(output,'resumo-mobile.png')});
    await mobileSummary.dialog.locator('[data-plant-action="open-supervisor"]').click();
    await page.locator('.supervisor-heading').waitFor();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(width===390){
      await page.screenshot({path:resolve(output,'supervisor-mobile.png')});
      await page.locator('.hmi-process-heading').scrollIntoViewIfNeeded();
      await page.screenshot({path:resolve(output,'supervisor-mobile-processo.png')});
    }
  }
  const demo=await open('chefe');
  const demoRequests=[];demo.on('request',r=>demoRequests.push(r.url()));
  await demo.goto(base+'/planta-demo.html#mapa-planta');await demo.locator('#plant-svg').waitFor();
  assert.equal(await demo.locator('[data-machine]').count(),32);
  assert.equal(await demo.locator('#plant-source option').count(),1);
  assert(demoRequests.every(url=>!url.includes('firebase')),'demonstração não carrega Firebase');
  await openFull(demo,'CAP-01',{keyboard:true});await demo.locator('.process-line').waitFor();
  await demo.screenshot({path:resolve(output,'demo-capacetes.png')});await demo.close();
  assert.deepEqual(errors,[]);
  const desktop=await open('chefe','mapa-planta',{width:1920,height:1080});await desktop.evaluate(()=>document.fonts.ready);await desktop.screenshot({path:resolve(output,'mapa-1920.png')});await desktop.locator('[data-theme-toggle]').click();await desktop.screenshot({path:resolve(output,'mapa-1920-dark.png')});await desktop.locator('[data-theme-toggle]').click();await openFull(desktop,'CAP-01',{keyboard:true});await desktop.locator('.process-line').waitFor();await desktop.screenshot({path:resolve(output,'capacetes-1920.png')});await desktop.locator('[data-plant-action="back"]').click();await openFull(desktop,'ABF-01',{keyboard:true});await desktop.locator('.process-line').waitFor();await desktop.screenshot({path:resolve(output,'fones-1920.png')});await desktop.close();
  console.log('OK: temas claro/escuro, resumo nativo com leitura e prévia ao vivo, fechamento e foco, câmera/rota preservadas, clique, teclado, filtros, zoom, retorno, supervisórios, pausa, cenários, registros, RBAC, adaptador e seis tamanhos de tela. Sem erros de JavaScript.');
}finally{
  await browser?.close();await new Promise(r=>server.close(r));
}





