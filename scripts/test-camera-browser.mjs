import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.MSA_PLAYWRIGHT_MODULE||'playwright');
await mkdir('.qa-output',{recursive:true});
const launch={headless:true,...(process.env.MSA_CHROME_BINARY?{executablePath:process.env.MSA_CHROME_BINARY}:{}),args:['--no-sandbox']};
// A câmera virtual entrega pixels de um visor, sem simular OCR nem o envio.
const setup=await chromium.launch(launch);let pixels;
try{const p=await setup.newPage();pixels=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=640;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,640,640);x.fillStyle='#151515';x.font='bold 88px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText('180,5',320,320);return Array.from(x.getImageData(0,0,640,640).data);});}finally{await setup.close();}
const y=Buffer.alloc(640*640);for(let i=0;i<y.length;i++)y[i]=Math.round(16+219*pixels[i*4]/255);
const fixture=resolve('.qa-output/camera.y4m');await writeFile(fixture,Buffer.concat([Buffer.from('YUV4MPEG2 W640 H640 F30:1 Ip A1:1 C420jpeg\nFRAME\n'),y,Buffer.alloc(640*640/2,128)]));
const server=spawn(process.execPath,['scripts/serve-demo.mjs']);await new Promise((r,e)=>{server.stdout.once('data',r);server.once('error',e)});
const browser=await chromium.launch({...launch,args:[...launch.args,'--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',`--use-file-for-fake-video-capture=${fixture}`]});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},permissions:['camera']}),page=await context.newPage(),errors=[];let pickers=0;
 page.on('pageerror',e=>errors.push(e.message));page.on('filechooser',()=>pickers++);
 const policy=(await readFile('worker/index.js','utf8')).match(/'Content-Security-Policy': "([^"]+)"/)[1];
 await page.route('**/*',async route=>{if(!route.request().url().startsWith('http://127.0.0.1:4173/'))return route.abort();const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'content-security-policy':policy}});});
 await page.goto('http://127.0.0.1:4173/sistema.html?demonstracao=1&cargo=operador#registro-foto');await page.locator('#photo-workspace').waitFor();await page.evaluate(()=>MSA.telemetry.pause());
 await page.locator('#photo-sector').selectOption('selagem');await page.locator('#photo-machine').selectOption('SEL-01');await page.locator('#photo-lot').fill('LT-CAMERA');
 await page.evaluate(()=>{window.originalCamera=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);window.cameraTracks=[];navigator.mediaDevices.getUserMedia=async c=>{const s=await originalCamera(c);cameraTracks.push(...s.getTracks());return s;};});
 const temperature=page.locator('[data-photo-key="temperatura"]'),open=()=>temperature.locator('[data-photo-camera]').click(),ready=()=>page.waitForFunction(()=>!document.querySelector('#photo-camera-shoot').disabled);
 await open();await ready();assert.equal(pickers,0);assert(await page.locator('#photo-camera-video').isVisible());
 assert(await page.evaluate(()=>document.querySelector('#photo-camera-dialog').scrollWidth<=document.querySelector('#photo-camera-dialog').clientWidth+1));
 await page.screenshot({path:'.qa-output/camera-mobile.png'});
 await page.locator('#photo-camera-switch').click();await ready();assert.equal(await page.evaluate(()=>cameraTracks[0].readyState),'ended');
 await page.locator('#photo-camera-shoot').click();await page.locator('#photo-camera-dialog').waitFor({state:'hidden'});
 await page.waitForFunction(()=>MSA.data.state.leituras.some(r=>r.origem==='foto'&&r.valores.temperatura===180.5),null,{timeout:45000});
 const rows=await page.evaluate(()=>MSA.data.state.leituras.filter(r=>r.origem==='foto'));assert.equal(rows.length,1);assert.equal(rows[0].lote,'LT-CAMERA');assert.equal(rows[0].fotoProcesso.metodo,'ocr-local');assert(!rows[0].fotoProcesso.exemplo);assert.equal(await page.evaluate(()=>cameraTracks.every(t=>t.readyState==='ended')),true);
 await open();await ready();await page.locator('#photo-camera-close').click();await page.locator('#photo-camera-dialog').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>cameraTracks.every(t=>t.readyState==='ended')),true);
 // Fechar enquanto a permissão está pendente também encerra o stream tardio.
 await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async c=>{const s=await originalCamera(c);cameraTracks.push(...s.getTracks());window.lateCameraReady=true;await new Promise(r=>window.releaseCamera=r);return s;};});
 await open();await page.waitForFunction(()=>window.lateCameraReady);await page.locator('#photo-camera-close').click();await page.locator('#photo-camera-dialog').waitFor({state:'hidden'});await page.evaluate(()=>releaseCamera());await page.waitForFunction(()=>cameraTracks.every(t=>t.readyState==='ended'));
 await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError');};});
 await open();await page.locator('#photo-camera-status').filter({hasText:'não foi autorizada'}).waitFor();assert(await page.locator('#photo-camera-shoot').isDisabled());assert.equal(pickers,0);
 await page.locator('#photo-camera-close').click();await page.locator('#photo-camera-dialog').waitFor({state:'hidden'});
 // O botão da galeria permanece separado.
 const chooser=page.waitForEvent('filechooser');await temperature.getByText('Escolher arquivo',{exact:true}).click();await chooser;assert.equal(pickers,1);assert.equal(await page.evaluate(()=>MSA.data.state.leituras.filter(r=>r.origem==='foto').length),1);
 assert.deepEqual(errors,[]);console.log('Camera passed: real video frames → local OCR → automatic send, switch, close, late permission, denied permission, separate gallery and mobile under production CSP.');
}finally{await browser.close();server.kill();}
