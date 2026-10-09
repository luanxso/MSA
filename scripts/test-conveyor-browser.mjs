// Exercises a GitHub Pages-style subdirectory, including a missing Motion bundle.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {resolve,relative,extname,sep} from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.MSA_PLAYWRIGHT_MODULE||'playwright');
const server=spawn(process.execPath,['scripts/serve-demo.mjs']);
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
let browser;
try {
  browser=await chromium.launch({headless:true,executablePath:process.env.MSA_CHROME_BINARY,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'America/Sao_Paulo'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const publicDir=resolve(process.env.MSA_CONVEYOR_STATIC_DIR||'dist');
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname!=='127.0.0.1'||url.pathname.includes('/vendor/motion-'))return route.abort();
    const file=resolve(publicDir,'.'+url.pathname.replace(/^\/MSA\//,'/'));
    if(relative(publicDir,file).startsWith('..'+sep))return route.abort();
    try {await route.fulfill({contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf'})[extname(file)]||'application/octet-stream',body:await readFile(file)});}
    catch {await route.fulfill({status:404,body:'Not found'});}
  });
  await page.goto('http://127.0.0.1:4173/MSA/sistema.html?demonstracao=1&cargo=chefe#mapa-planta');
  await page.locator('[data-machine="INJ-01"]').waitFor();
  assert(await page.evaluate(()=>!window.Motion),'optional animation bundle is unavailable');
  const routePiece=page.locator('[data-flow-kind="capacetes"]').first();
  await page.waitForFunction(()=>document.querySelector('[data-flow-kind="capacetes"]')?.hasAttribute('transform'));
  const routeBefore=await routePiece.getAttribute('transform');
  await page.waitForTimeout(250);
  assert.notEqual(await routePiece.getAttribute('transform'),routeBefore,'map route moves without Motion');
  const sampleOffsets=async()=>page.evaluate(async()=>{
    const result=[];for(let i=0;i<24;i++){result.push(document.querySelector('[data-line-svg]')?.dataset.lineVisualOffset);await new Promise(r=>setTimeout(r,100));}return result;
  });
  const expectMovement=async()=>assert(new Set((await sampleOffsets()).filter(Boolean)).size>3,'pieces advance smoothly from real scenario progress without Motion');
  const positions=()=>page.locator('[data-line-piece]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('transform')));
  await page.locator('[data-machine="INJ-01"]').click();
  const dialog=page.locator('.plant-machine-dialog');await dialog.waitFor({state:'visible'});
  await expectMovement();
  await dialog.locator('[data-plant-action="open-supervisor"]').click();
  await page.locator('.supervisor-heading').waitFor();
  await expectMovement();
  const pause=page.locator('[data-plant-action="pause"]').first();
  await pause.click();
  const paused=await positions();await page.waitForTimeout(1200);
  assert.deepEqual(await positions(),paused,'manual pause freezes the exact positions');
  await pause.click();await expectMovement();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForTimeout(100);
  const reduced=await positions();await page.waitForTimeout(1200);
  assert.deepEqual(await positions(),reduced,'device reduced-motion preference remains respected');
  await page.emulateMedia({reducedMotion:'no-preference'});await expectMovement();
  // Simulate visibility events without depending on headless tab visibility behavior.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  const hidden=await positions();await page.waitForTimeout(1200);
  assert.deepEqual(await positions(),hidden,'hidden document stops the conveyor');
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await expectMovement();
  // State changes stop movement even while the source clock continues updating.
  await page.evaluate(()=>MSA.demo.simulation.microStop('INJ-01',15));
  const stopped=await positions();await page.waitForTimeout(1200);
  assert.deepEqual(await positions(),stopped,'a registered stop freezes movement');
  await page.evaluate(()=>MSA.demo.simulation.advance(16));await expectMovement();
  assert.deepEqual(errors,[]);
  console.log('OK: GitHub-style path, missing Motion, map, preview, full supervisor, pause/resume, reduced motion, hidden/visible and stop/resume.');
}finally{await browser?.close();server.kill();}
