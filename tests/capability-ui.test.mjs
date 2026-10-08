import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function fixture(){
 const nodes=new Map(),downloads=[],blobs=[];
 let now=0,nextTimer=0;const timers=new Map();
 const setTimeout=(fn,delay=0)=>{const id=++nextTimer;timers.set(id,{fn,at:now+delay});return id;};
 const clearTimeout=id=>timers.delete(id);
 const advance=milliseconds=>{const end=now+milliseconds;for(;;){const next=[...timers].sort((a,b)=>a[1].at-b[1].at).find(([,timer])=>timer.at<=end);if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{id,innerHTML:'',hidden:false,textContent:'',handlers:{},classList:{toggle(){},remove(){}},contains:()=>false,matches:()=>false,addEventListener(type,fn){(this.handlers[type]||=[]).push(fn);},replaceChildren(){this.innerHTML='';},reset(){},elements:{},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(id);};
 const selectors=new Set(['#page-content','#operation-feedback','#operation-feedback-message','#operation-feedback-close','#operation-dialog','#operation-form','#operation-fields','#operation-save','#operation-error','#operation-close','#operation-cancel']);
 const document={activeElement:null,querySelector:s=>selectors.has(s)?node(s):null,createElement:tag=>tag==='a'?{click(){downloads.push({filename:this.download,url:this.href});}}:{}};
 const model=readFileSync('dist/templates/MSA-Estudo-Capacidade-Selo-VGard.xlsx');
 const c=vm.createContext({Date,console,document,Blob,TextEncoder,TextDecoder,fetch:async()=>({ok:true,arrayBuffer:async()=>model.buffer.slice(model.byteOffset,model.byteOffset+model.length)}),URL:{createObjectURL:b=>{blobs.push(b);return 'blob:test-'+blobs.length;},revokeObjectURL(){}},location:{hash:'#relatorios'},setTimeout,clearTimeout});c.window=c;
 for(const name of ['config','plant-layout','rbac','shifts','metrics','performance','capability-export','capability-excel','scenario-parameters','scenario-data'])vm.runInContext(readFileSync('dist/assets/'+name+'.js','utf8'),c);
 const a=c.MSA,state=a.createScenario();const user={id:'chief',nome:'Chefe',re:'1',cargo:'chefe',status:'ativo'};
 a.auth={session:()=>user};a.plant={close(){}};a.data={state,user,subscribe:fn=>fn(state),start:async()=>{}};
 vm.runInContext(readFileSync('dist/js/operations-ui.js','utf8'),c);a.operations.open('relatorios','todos');
 const click=async action=>{const target={dataset:{action},disabled:false};await node('#page-content').handlers.click[0]({target:{closest:()=>target}});};
 return {a,state,node,click,downloads,blobs,advance};
}

test('botão principal baixa Excel, CSV de BI e exportação geral seguem disponíveis',async()=>{
 const f=fixture();assert.match(f.node('#page-content').innerHTML,/Estudo de capacidade · Selo V-Gard/);assert.match(f.node('#page-content').innerHTML,/SEL-01/);
 assert.match(f.node('#page-content').innerHTML,/Exportar planilha Excel/);
 await f.click('export');assert.match(f.downloads[0].filename,/Estudo-Capacidade.*SEL-01.*\.xlsx$/);assert.equal(f.blobs[0].type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');assert.equal(Buffer.from(await f.blobs[0].arrayBuffer()).readUInt32LE(0),0x04034b50);
 await f.click('export-capability-csv');assert.match(f.downloads[1].filename,/coleta-Selo-VGard-BI.*\.csv$/);const text=await f.blobs[1].text();assert(text.includes('Aquecimento Z21'));assert(text.includes('SEL-01'));assert(!text.includes('INJ-01'));
 await f.click('export-general');assert.match(f.downloads[2].filename,/MSA-registros/);assert((await f.blobs[2].text()).includes('INJ-01'));
 f.a.operations.open('relatorios','injecao');await f.click('export');assert.equal(f.downloads.length,3);assert.match(f.node('#operation-feedback-message').textContent,/Não há leituras/);
});

test('confirmações e erros somem após dez segundos',()=>{
 const f=fixture(),feedback=f.node('#operation-feedback'),message=f.node('#operation-feedback-message');
 for(const error of [false,true]){
  f.a.operations.notify(error?'Falha na operação.':'Exportação concluída.',error);
  assert.equal(feedback.hidden,false);assert(message.textContent);
  f.advance(9999);assert.equal(feedback.hidden,false);
  f.advance(1);assert.equal(feedback.hidden,true);assert.equal(message.textContent,'');
 }
});

test('uma nova mensagem ganha seus próprios dez segundos',()=>{
 const f=fixture(),feedback=f.node('#operation-feedback'),message=f.node('#operation-feedback-message');
 f.a.operations.notify('Preparando a exportação…');f.advance(9000);
 f.a.operations.notify('Exportação concluída.');f.advance(1000);
 assert.equal(feedback.hidden,false);assert.equal(message.textContent,'Exportação concluída.');
 f.advance(8999);assert.equal(feedback.hidden,false);
 f.advance(1);assert.equal(feedback.hidden,true);
});

test('o botão X fecha imediatamente e permite receber outra mensagem',()=>{
 const f=fixture(),feedback=f.node('#operation-feedback');
 const html=readFileSync('dist/sistema.html','utf8');
 assert.match(html,/<button[^>]*id="operation-feedback-close"[^>]*type="button"[^>]*aria-label="Fechar notificação"[^>]*>×<\/button>/);
 f.a.operations.notify('Registro salvo.');f.advance(3000);
 f.node('#operation-feedback-close').handlers.click[0]();assert.equal(feedback.hidden,true);
 f.a.operations.notify('Próximo registro salvo.');f.advance(7000);assert.equal(feedback.hidden,false);
 f.advance(3000);assert.equal(feedback.hidden,true);
});
