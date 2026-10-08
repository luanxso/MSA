import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.MSA_PLAYWRIGHT_MODULE||'playwright');
const server=spawn(process.execPath,['scripts/serve-demo.mjs']);await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
const browser=await chromium.launch({headless:true,executablePath:process.env.MSA_CHROME_BINARY,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:900},timezoneId:'America/Sao_Paulo'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const NativeDate=Date;window.testNow=NativeDate.now();window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[window.testNow]));}static now(){return window.testNow;}};localStorage.setItem('msa-theme','dark');});
 await page.goto('http://127.0.0.1:4173/sistema.html?demonstracao=1#mapa-planta/ABF-01');await page.waitForSelector('svg[data-line-svg]');await page.evaluate(()=>{MSA.demo.simulation.setRejectRate(0);MSA.data.state.demoAutoMicro=false;MSA.demo.simulation.setDeviationRate(0);});
 const read=id=>page.evaluate(id=>MSA.performance.sample(MSA.data.state.maquinas.find(m=>m.id===id),MSA.data.state),id);
 const before=await read('ABF-01');await page.locator('[data-plant-action="reject"]').click();assert(await page.locator('[data-plant-action="reject"]').isDisabled());assert.equal((await read('ABF-01')).rejectedCount,before.rejectedCount);
 await page.evaluate(()=>window.testNow+=25000);await page.waitForFunction(b=>MSA.performance.sample(MSA.data.state.maquinas.find(m=>m.id==='ABF-01'),MSA.data.state).rejectedCount===b+1,before.rejectedCount);
 const after=await read('ABF-01');assert.equal(after.goodCount,before.goodCount);assert.equal(after.totalCount,before.totalCount+1);assert.equal(await page.locator('.quality-rejected-piece').count(),1);assert(await page.locator('[data-refugo-marker]').isVisible());
 const notice=page.locator('.hmi-process>.quality-cycle-notice');assert(await notice.isVisible());assert.match(await notice.innerText(),/Refugo identificado · ABF-01/);assert.match(await notice.innerText(),/\+1 refugo/);const eventId=await notice.getAttribute('data-event');await page.waitForTimeout(1100);assert.equal(await notice.getAttribute('data-event'),eventId);
 for(const width of [390,1536])for(const theme of ['dark','light']){
  await page.setViewportSize({width,height:1000});if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('[data-theme-toggle]').click();
  await page.locator('.hmi-process').scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const contrast=await notice.evaluate(el=>{const rgb=c=>c.match(/[\d.]+/g).slice(0,3).map(Number),lum=c=>rgb(c).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0),style=getComputedStyle(el),a=lum(style.color),b=lum(style.backgroundColor);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);});assert(contrast>=4.5);
  await page.screenshot({path:'.qa-output/refugo-'+theme+'-'+width+'.png',fullPage:false});
 }
 await notice.getByRole('link',{name:'Ver qualidade'}).click();await page.waitForSelector('#ops-machine');assert.equal(await page.locator('#ops-machine').inputValue(),'ABF-01');assert((await page.locator('.ops-summary .ops-stat strong').first().innerText()).includes(String(before.rejectedCount+1)));
 assert.equal(await page.evaluate(()=>MSA.data.state.perdas.filter(r=>r.maquinaId==='ABF-01'&&r.simulacaoCiclos).length),1);
 await page.evaluate(()=>location.hash='configuracoes');await page.waitForSelector('#demo-reject-rate');await page.locator('#demo-reject-rate').selectOption('100');assert.equal(await page.evaluate(()=>MSA.demo.simulation.rejectRate),1);await page.locator('#demo-reject-rate').selectOption('0');
 await page.evaluate(()=>location.hash='mapa-planta');await page.waitForSelector('#plant-svg');assert(await page.locator('.plant-map-view>.quality-cycle-notice').isVisible());assert(await page.locator('[data-machine="ABF-01"]').evaluate(e=>e.classList.contains('has-recent-reject')));
 await page.evaluate(()=>location.hash='mapa-planta/@ABF-01');await page.waitForSelector('.plant-machine-dialog[open]');assert(await page.locator('.machine-preview>.quality-cycle-notice').isVisible());assert.equal(await page.locator('.plant-machine-dialog .quality-rejected-piece').count(),1);assert(await page.locator('.plant-machine-dialog [data-plant-action="reject"]').isVisible());
 await page.evaluate(()=>window.testNow+=11000);await page.waitForFunction(()=>!MSA.performance.sample(MSA.data.state.maquinas.find(m=>m.id==='ABF-01'),MSA.data.state).recentReject);assert(await page.locator('.machine-preview>.quality-cycle-notice').isHidden());assert.equal(await page.locator('.quality-rejected-piece').count(),0);
 await page.evaluate(()=>location.hash='mapa-planta/@NHPL');await page.waitForSelector('.nhpl-dialog[open]');const nhplBefore=await read('NHPL');await page.locator('.nhpl-dialog [data-nhpl="reject"]').click();await page.evaluate(ms=>window.testNow+=ms,Math.round((1-nhplBefore.cycleProgress)*nhplBefore.cycleSeconds*1000));await page.waitForFunction(b=>MSA.performance.sample(MSA.data.state.maquinas.find(m=>m.id==='NHPL'),MSA.data.state).rejectedCount===b+1,nhplBefore.rejectedCount);await page.waitForFunction(()=>!document.querySelector('.nhpl-view>.quality-cycle-notice').hidden);
 assert.equal((await read('NHPL')).goodCount,nhplBefore.goodCount);assert.equal(await page.locator('.nhpl-dialog [data-kpi="4"]').innerText(),String(nhplBefore.rejectedCount+1));await page.locator('.nhpl-dialog').getByText('Histórico, paradas e motivos',{exact:true}).click();assert.match(await page.locator('.nhpl-dialog [data-history]').innerText(),/Refugo identificado/);
 await page.screenshot({path:'.qa-output/refugo-nhpl.png',fullPage:false});assert.deepEqual(errors,[]);
 console.log('OK: próximo ciclo rejeita 1 sem aprovar; peça vermelha e aviso com link; Qualidade/turno/histórico sincronizados; probabilidade configurável; mapa, popup e NHPL; aviso expira; claro/escuro em celular e desktop, contraste 4.5:1.');
}finally{await browser.close();server.kill();}
