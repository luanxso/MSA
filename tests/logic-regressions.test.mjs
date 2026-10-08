import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const source=n=>readFileSync(new URL('../dist/assets/'+n+'.js',import.meta.url),'utf8');
const rules=JSON.parse(readFileSync(new URL('../database.rules.json',import.meta.url),'utf8')).rules;
const plain=v=>v==null?null:JSON.parse(JSON.stringify(v));
const stamp=v=>+new Date(v);
const machine={id:'ABF-01',setorId:'montagem',nome:'Montagem',processo:'Montagem',produto:'Abafador',metaDiaria:800,parametros:{}};
const user=(cargo='operador',id='op')=>({id,re:'1',nome:id,cargo,status:'ativo',setorId:'montagem',maquinaId:cargo==='operador'?machine.id:''});
function scope(){const c=vm.createContext({Date,crypto:webcrypto,setTimeout,clearTimeout,console});c.window=c;for(const n of ['config','rbac','shifts','metrics','performance','shift-analysis','operations-service','production-workflows'])vm.runInContext(source(n),c);return c;}
function base(){return {maquinas:[plain(machine)],registrosProducao:[],perdas:[],paradas:[],leituras:[],ocorrencias:[],lotesQualidade:[],atendimentosAlertas:[],perfis:[],alocacoes:[],passagensTurno:[]};}
const production={maquinaId:machine.id,quantidade:'50',inicio:'2026-10-06T07:00:00',fim:'2026-10-06T08:00:00',turno:'1',produto:'Abafador',lote:'L'};
class Snapshot {
 constructor(root,path=[]){this.root=root;this.path=path;}
 val(){return this.path.reduce((v,k)=>v?.[k],this.root)??null;}
 exists(){return this.val()!=null;}
 child(k){return new Snapshot(this.root,[...this.path,...String(k).split('/')]);}
 parent(){return new Snapshot(this.root,this.path.slice(0,-1));}
 hasChild(k){return this.child(k).exists();}
 hasChildren(keys){return keys.every(k=>this.hasChild(k));}
 isString(){return typeof this.val()==='string';}
 isNumber(){return typeof this.val()==='number'&&Number.isFinite(this.val());}
 isBoolean(){return typeof this.val()==='boolean';}
}
function evaluate(expression,root,next,path,uid){
 const keys=path.split('/'),value=new Snapshot(root,keys),newValue=new Snapshot(next,keys);
 return vm.runInNewContext(expression.replaceAll('.matches(','.match('),{auth:uid?{uid,token:{email:'re-1@msa-safety-9f978.invalid'}}:null,root:new Snapshot(root),data:value,newData:newValue,$id:keys.at(-1),$machine:keys.at(-1),now:Date.now()});
}
// Usa as expressões do projeto para validar as transações simuladas. O emulador continua sendo uma verificação separada.
function backend(seed={}){
 const db={maquinas:{[machine.id]:plain(machine)},perfis:Object.fromEntries([user(),user('operador','op2'),user('supervisor','sup'),user('supervisor','sup2')].map(u=>[u.id,u])),...plain(seed)};
 let tail=Promise.resolve(),sequence=0;const listeners=new Set();
 const read=ref=>{let value=ref.path.split('/').filter(Boolean).reduce((v,k)=>v?.[k],db)??null;if(ref.field)value=Object.fromEntries(Object.entries(value||{}).filter(([,row])=>row[ref.field]===ref.equal));return plain(value);};
 const snapshot=ref=>({val:()=>read(ref),exists:()=>read(ref)!=null});
 const notify=()=>listeners.forEach(({ref,fn})=>{if(ref.path!=='.info/connected')fn(snapshot(ref));});
 const resolved=v=>Array.isArray(v)?v.map(resolved):v&&typeof v==='object'?v['.sv']==='timestamp'?Date.now():Object.fromEntries(Object.entries(v).map(([k,x])=>[k,resolved(x)])):v;
 function nextTree(path,value){const next=plain(db),keys=path.split('/').filter(Boolean);let host=next;for(const k of keys.slice(0,-1))host=host[k]||= {};host[keys.at(-1)]=resolved(plain(value));return next;}
 function check(path,next,uid){
  const [collection]=path.split('/'),row=rules[collection]?.$id||rules[collection]?.$machine;
  if(!row)return;
  assert(evaluate(row['.write'],db,next,path,uid),'regra de escrita: '+path);
  assert(evaluate(row['.validate'],db,next,path,uid),'validação: '+path);
  const values=new Snapshot(next,path.split('/')).val();
  for(const [key,value]of Object.entries(values||{})){
   if(value==null)continue;const validation=row[key]?.['.validate']??row.$other?.['.validate'];
   if(validation!==undefined)assert(validation!==false&&evaluate(validation,db,next,path+'/'+key,uid),'campo inválido: '+key);
  }
 }
 function commit(path,value,uid){const next=nextTree(path,value);check(path,next,uid);Object.keys(db).forEach(k=>delete db[k]);Object.assign(db,next);notify();}
 function sdk(uid){return {
  ref:(_,path='')=>({path,key:path.split('/').at(-1)}),query:(ref,field,equal)=>({...ref,field,equal}),orderByChild:x=>x,equalTo:x=>x,serverTimestamp:()=>({'.sv':'timestamp'}),
  get:async ref=>snapshot(ref),onValue:(ref,fn)=>{const listener={ref,fn};listeners.add(listener);fn(ref.path==='.info/connected'?{val:()=>true}:snapshot(ref));return()=>listeners.delete(listener);},
  push:ref=>{const key='pushed-'+(++sequence);return {path:ref.path+'/'+key,key};},
  set:async(ref,value)=>commit(ref.path,value,uid),
  update:async(ref,patch)=>{if(!ref.path){for(const [path,value]of Object.entries(patch))commit(path,value,uid);}else commit(ref.path,{...read(ref),...patch},uid);},
  runTransaction:(ref,updater)=>{
   const operation=tail.then(()=>{
    const [collection]=ref.path.split('/'),row=rules[collection]?.$id||rules[collection]?.$machine;
    if(row)assert(evaluate(row['.read'],db,db,ref.path,uid),'regra de leitura da transação: '+ref.path);
    const current=read(ref);if(current!=null&&updater(null)===undefined)return {committed:false,snapshot:snapshot(ref)};
    const value=updater(current);if(value===undefined)return {committed:false,snapshot:snapshot(ref)};
    commit(ref.path,value,uid);return {committed:true,snapshot:snapshot(ref)};
   });tail=operation.catch(()=>{});return operation;
  }
 };}
 return {db,sdk,async client(employee=user()){
  const c=scope();c.MSA.firebase={ready:async()=>({database:{},databaseSDK:sdk(employee.id)})};await c.MSA.data.start(employee);return c.MSA;
 }};
}
test('meta real de 800 peças fornece 100/h e gera alerta com produtividade de 50%',()=>{
 const a=scope().MSA,s=base(),start=stamp('2026-10-06T00:00:00'),end=stamp('2026-10-07T00:00:00');
 s.scenarioAt=stamp('2026-10-06T09:00:00');s.registrosProducao.push({...production,inicio:stamp(production.inicio),fim:stamp(production.fim),quantidade:50});
 const x=a.performance.calculate(s,[machine],start,end),h=a.performance.hourly(s,[machine],start,end);
 assert.equal(x.target,100);assert.equal(x.productivity,50);assert.equal(h[0].target,100);
 assert.equal(a.workflows.alertSources(s).find(r=>r.tipo==='Produtividade').destinatario,'Gerência');
 assert.equal(a.shifts.hourTarget({...machine,hourTarget:125}),125);
 assert.equal(a.shifts.hourTarget({...machine,hourTarget:'inválido'}),100);
});
test('produção, refugo, leitura e ocorrência após meia-noite pertencem ao mesmo dia de produção',()=>{
 const a=scope().MSA,s=base(),start=stamp('2026-10-06T00:00:00'),end=stamp('2026-10-07T00:00:00'),at=stamp('2026-10-07T00:30:00');
 s.scenarioAt=stamp('2026-10-07T06:30:00');s.registrosProducao.push({...production,inicio:at-1800000,fim:at+1800000,turno:'3',quantidade:10});
 s.perdas.push({id:'r',maquinaId:machine.id,setorId:'montagem',data:at,tipo:'refugo',quantidade:2,lote:'L',motivo:'Defeito'});
 s.leituras.push({maquinaId:machine.id,data:at,valores:{}});s.ocorrencias.push({maquinaId:machine.id,data:at,status:'aberta',descricao:'Conferir'});
 const summary=a.metrics.summarize(s,[machine],start,end),shift=a.shiftAnalysis.analyze(s,[machine],start,end,'3'),perf=a.performance.calculate(s,[machine],start,end);
 assert.equal(summary.aprovadas,10);assert.equal(summary.refugos,2);assert.equal(summary.leituras.length,1);assert.equal(summary.ocorrencias.length,1);assert.equal(shift.rejected,2);assert.equal(perf.rejected,2);
 assert.equal(a.metrics.summarize(s,[machine],end,end+86400000).refugos,0);
 a.workflows.syncLots(s);assert.equal(s.lotesQualidade[0].quantidade,12);
});
test('07h inicia o novo dia e 23h inicia o turno noturno sem deslocar seu início',()=>{
 const a=scope().MSA,start=stamp('2026-10-07T00:00:00'),end=stamp('2026-10-08T00:00:00');
 for(const time of ['2026-10-07T07:00:00','2026-10-07T23:00:00','2026-10-08T06:59:59'])assert(a.shifts.within({data:stamp(time)},start,end),time);
 assert(!a.shifts.within({data:stamp('2026-10-08T07:00:00')},start,end));
});
test('lote concluído preserva quantidade e decisão; novo defeito reabre com nova avaliação',()=>{
 const a=scope().MSA,s=base(),now=stamp('2026-10-06T12:00:00');s.scenarioAt=now;
 s.registrosProducao.push({...production,inicio:stamp(production.inicio),fim:stamp(production.fim),quantidade:90});
 s.perdas.push({id:'r',maquinaId:machine.id,setorId:'montagem',tipo:'refugo',quantidade:10,lote:'L',motivo:'Defeito',data:now,updatedAt:now});
 a.workflows.syncLots(s);const batch=s.lotesQualidade[0],qa={...user('qualidade'),setorId:''};
 for(const status of ['segregado','reinspecao','liberado'])a.workflows.command(s,'batch-transition',{status,observacao:'Avaliado',inspecionadas:100,descartadas:10},batch.id,qa);
 s.registrosProducao.push({...s.registrosProducao[0],id:'p2',quantidade:20});a.workflows.syncLots(s);
 assert.equal(batch.quantidade,100);assert.equal(batch.inspecionadas,100);assert.equal(batch.liberadas+batch.descartadas,100);assert.equal(batch.status,'liberado');
 batch.quantidade=140;a.workflows.syncLots(s);assert.equal(batch.quantidade,100,'Restaura quantidade de uma decisão salva pela versão antiga.');
 s.perdas.push({...s.perdas[0],id:'new',quantidade:1,data:now+1,updatedAt:now+1});a.workflows.syncLots(s);
 assert.equal(batch.status,'suspeito');assert.equal(batch.quantidade,121);assert.equal(batch.inspecionadas,undefined);assert(batch.historico.some(h=>h.status==='liberado'));
});
test('dois operadores com a mesma produção criam um único apontamento',async()=>{
 const b=backend(),a=await b.client(),other=await b.client(user('operador','op2'));
 const results=await Promise.allSettled([a.data.save('registrosProducao',production),other.data.save('registrosProducao',production)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(Object.keys(b.db.registrosProducao).length,1);
 assert.equal(Object.values(b.db.registrosProducao).reduce((n,r)=>n+r.quantidade,0),50);
 await assert.rejects(a.data.save('registrosProducao',production),/já.*registrado|já.*recebido/);
});
test('edição de produção é preservada e não pode duplicar outro registro',async()=>{
 const b=backend(),a=await b.client(),id=await a.data.save('registrosProducao',production);
 await a.data.save('registrosProducao',{...production,quantidade:'60'},id);assert.equal(b.db.registrosProducao[id].quantidade,60);
 const second=await a.data.save('registrosProducao',{...production,lote:'OUTRO'});
 await assert.rejects(a.data.save('registrosProducao',{...production,lote:'L',quantidade:'60'},second),/já.*registrado/);
});
test('apontamento legado com ID aleatório também impede reenvio idêntico',async()=>{
 const legacy={...production,id:'legacy',inicio:stamp(production.inicio),fim:stamp(production.fim),quantidade:50,usuarioId:'op',usuarioRe:'1',setorId:'montagem'};
 const b=backend({registrosProducao:{legacy}}),a=await b.client();await assert.rejects(a.data.save('registrosProducao',production),/já.*registrado/);
 assert.equal(Object.keys(b.db.registrosProducao).length,1);
});
test('duas paradas concorrentes para a mesma máquina abrem somente uma',async()=>{
 const b=backend(),a=await b.client(),other=await b.client(user('operador','op2'));
 const values={maquinaId:machine.id,inicio:'2026-10-06T08:00:00',motivoCodigo:'ajuste'};
 const results=await Promise.allSettled([a.data.save('paradas',values),other.data.save('paradas',{...values,inicio:'2026-10-06T08:01:00'})]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(Object.values(b.db.paradas).filter(r=>!r.fim).length,1);
 const id=Object.keys(b.db.paradas)[0],owner=b.db.paradas[id].usuarioId,client=owner==='op'?a:other;
 await client.data.finishStop(id,'Retomada');
 await client.data.save('paradas',{...values,inicio:'2026-10-06T09:00:00'});
 assert.equal(Object.keys(b.db.paradas).length,2);assert.equal(Object.values(b.db.paradas).filter(r=>!r.fim).length,1);
});
test('parada legada aberta impede nova parada; parada já encerrada pode ser registrada',async()=>{
 const b=backend({paradas:{old:{maquinaId:machine.id,setorId:'montagem',inicio:stamp('2026-10-06T08:00:00'),fim:0}}}),a=await b.client();
 const values={maquinaId:machine.id,inicio:'2026-10-06T09:00:00',motivoCodigo:'ajuste'};
 await assert.rejects(a.data.save('paradas',values),/parada.*andamento/);
 await a.data.save('paradas',{...values,fim:'2026-10-06T10:00:00'});
 assert.equal(Object.keys(b.db.paradas).length,2);
});
test('reserva interrompida expira e não bloqueia permanentemente uma máquina',async()=>{
 const b=backend({paradasAbertas:{[machine.id]:{paradaId:'interrupted',usuarioId:'op2',claimedAt:Date.now()-31000}}}),a=await b.client();
 await a.data.save('paradas',{maquinaId:machine.id,inicio:'2026-10-06T09:00:00',motivoCodigo:'ajuste'});
 assert.equal(Object.values(b.db.paradas).filter(r=>!r.fim).length,1);
});
test('duas lideranças entregando o mesmo turno registram uma única passagem',async()=>{
 const b=backend(),a=await b.client(user('supervisor','sup')),other=await b.client(user('supervisor','sup2'));
 const values={maquinaId:machine.id,dia:'2026-10-06',turno:'1',pendencias:'Conferir material'};
 const results=await Promise.allSettled([a.data.workflow('handover-create',values),other.data.workflow('handover-create',values)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(Object.keys(b.db.passagensTurno).length,1);
 await a.data.workflow('handover-create',{...values,turno:'2'});assert.equal(Object.keys(b.db.passagensTurno).length,2);
});

test('reserva recente de outro envio impede parada nova, mas a mesma tentativa pode ser retomada',async()=>{
 const c=scope(),values={maquinaId:machine.id,inicio:'2026-10-06T09:00:00',motivoCodigo:'ajuste'};
 const id=await c.MSA.recordValidation.recordKey('parada',JSON.stringify([machine.id,stamp(values.inicio)]));
 const b=backend({paradasAbertas:{[machine.id]:{paradaId:id,usuarioId:'op',claimedAt:Date.now()}}}),a=await b.client();
 await assert.rejects(a.data.save('paradas',{...values,inicio:'2026-10-06T09:01:00'}),/sendo registrada|confirmação/);
 await a.data.save('paradas',values);assert.equal(Object.keys(b.db.paradas).length,1);
});
test('regras impedem reserva fora do escopo e criação tardia após substituição de reserva expirada',()=>{
 const now=Date.now(),root={maquinas:{[machine.id]:machine},perfis:{op:user(),outside:{...user('supervisor','outside'),setorId:'injecao'}},paradasAbertas:{[machine.id]:{paradaId:'current',usuarioId:'op',claimedAt:now}}};
 const path='paradasAbertas/'+machine.id,entry=rules.paradasAbertas.$machine;
 assert(!evaluate(entry['.read'],root,root,path,'outside'));assert(!evaluate(entry['.write'],root,root,path,'outside'));
 const next=plain(root);next.paradas={expired:{maquinaId:machine.id,setorId:'montagem',usuarioId:'op',usuarioRe:'1',createdAt:now,updatedAt:now,atualizadoPor:'op',verificado:false,observacao:'',inicio:now-60000,fim:0,motivo:'Ajuste',causa:'',encerradaPor:''}};
 assert(!evaluate(rules.paradas.$id['.validate'],root,next,'paradas/expired','op'));
});
