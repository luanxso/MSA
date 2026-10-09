import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,relative,sep,extname} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.MSA_PLAYWRIGHT_MODULE||'playwright');
const root=resolve('dist'),prefix='/storage/emulated/0/Download/MSA-Sistema-Insano/dist/';
const username='demo-user',password='demo-pass',authorization='Basic '+Buffer.from(username+':'+password).toString('base64');
const policy=(await readFile('worker/index.js','utf8')).match(/'Content-Security-Policy': "([^"]+)"/)[1],loaded=new Set();
const types={'.gz':'application/gzip','.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ttf':'font/ttf'};
const server=http.createServer(async(req,res)=>{
 if(req.headers.authorization!==authorization){res.writeHead(401,{'WWW-Authenticate':'Basic realm="Local OCR test"'});res.end();return;}
 try{const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith(prefix))throw Error('path');const file=resolve(root,decodeURIComponent(url.pathname.slice(prefix.length))),rel=relative(root,file);if(rel==='..'||rel.startsWith('..'+sep))throw Error('path');let bytes=await readFile(file);
// Reproduz um WebView que bloqueia o download do modelo dentro do worker.
if(rel==='assets/ocr/worker.min.js')bytes=Buffer.concat([Buffer.from("const nativeFetch=self.fetch.bind(self);self.fetch=(url,...args)=>{if(String(url).includes('.traineddata'))throw new TypeError('Simulated blocked worker model fetch');return nativeFetch(url,...args);};\n"),bytes]);
loaded.add(rel);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Content-Security-Policy':policy});res.end(bytes);}catch{res.writeHead(404);res.end();}
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port,origin=`http://127.0.0.1:${port}`;
const browser=await chromium.launch({headless:true,...(process.env.MSA_CHROME_BINARY?{executablePath:process.env.MSA_CHROME_BINARY}:{}),args:['--no-sandbox']});
try{
 const context=await browser.newContext({httpCredentials:{username,password},viewport:{width:390,height:844}}),page=await context.newPage(),errors=[],requests=[];
 await page.addInitScript(()=>{const original=window.fetch;window.fetch=(url,...args)=>String(url).includes('.traineddata')?Promise.reject(new TypeError('Blocked model fetch in page')):original(url,...args);});
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.route('**/*',route=>route.request().url().includes(`127.0.0.1:${port}`)?route.continue():route.abort());
 const entry=new URL(prefix+'sistema.html?demonstracao=1&cargo=operador#registro-foto',origin);entry.username=username;entry.password=password;
 await page.goto(entry.href);await page.locator('#photo-workspace').waitFor();
 // Confirma que estamos exercitando o endereço com credenciais, como no editor.
 assert.equal(await page.evaluate(()=>new URL(document.baseURI).username),username);
 await page.evaluate(()=>MSA.telemetry.pause());await page.locator('#photo-sector').selectOption('selagem');await page.locator('#photo-machine').selectOption('SEL-01');await page.locator('#photo-lot').fill('LT-OCR-LOCAL');
 const card=page.locator('[data-photo-key="temperatura"]');await card.locator('[data-photo-example]').click();
 try{await page.waitForFunction(()=>MSA.data.state.leituras.some(r=>r.fotoProcesso?.metodo==='ocr-local'),null,{timeout:45000});}catch(e){console.log('Local auth OCR status:',await card.locator('.photo-card-status').textContent());throw e;}
 const row=await page.evaluate(()=>MSA.data.state.leituras.find(r=>r.fotoProcesso?.metodo==='ocr-local'));assert.equal(row.valores.temperatura,255);assert.equal(row.lote,'LT-OCR-LOCAL');assert(row.fotoProcesso.confianca>=75);
 assert(loaded.has('assets/ocr/lang/eng-model.js'));assert(!loaded.has('assets/ocr/lang/eng.traineddata.gz'));assert([...loaded].some(p=>p.startsWith('assets/ocr/core/')));
 for(const url of requests.filter(u=>u.includes('/assets/ocr/'))){const u=new URL(url);assert.equal(u.username,'');assert.equal(u.password,'');assert.equal(u.origin,origin);assert(u.pathname.startsWith(prefix));}
 assert.deepEqual(errors,[]);console.log('Local auth OCR passed: credential-bearing page URL, protected nested local paths, blocked page/worker model fetch, script-packaged model bytes, actual worker/core/model, real OCR and automatic send under production CSP.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
