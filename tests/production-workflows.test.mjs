import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
async function fixture(cargo='supervisor',storage=new Map()){
 const scope=vm.createContext({Date,console,URLSearchParams,URL,crypto:webcrypto,location:{search:'?demonstracao=1&cargo='+cargo},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},addEventListener(){},dispatchEvent(){},CustomEvent:class{},setTimeout,clearTimeout});scope.window=scope;
 for(const name of ['config','plant-layout','rbac','shifts','metrics','performance','scenario-parameters','scenario-data','scenario-live','operations-service','production-workflows'])vm.runInContext(readFileSync('dist/assets/'+name+'.js','utf8'),scope);
 scope.MSA.telemetry={setMode(){}};vm.runInContext(readFileSync('dist/assets/scenario-service.js','utf8'),scope);await scope.MSA.data.start(scope.MSA.auth.session());
 return {a:scope.MSA,storage};
}
test('microparada captura segundos, retoma a produção e não acumula ciclos durante a interrupção',async()=>{
 const {a}=await fixture();a.demo.simulation.setRejectRate(0);a.demo.simulation.setDeviationRate(0);a.data.state.demoAutoMicro=false;
 const before=a.data.state,cycle=a.scenarioLive.cycleSeconds(before.maquinas.find(m=>m.id==='NHPL'),before),good=a.performance.sample(before.maquinas.find(m=>m.id==='NHPL'),before).goodCount;
 const id=a.demo.simulation.microStop('NHPL',15);await assert.rejects(Promise.resolve().then(()=>a.demo.simulation.microStop('NHPL',15)),/já está parada/);
 a.demo.simulation.advance(60);const s=a.data.state,stop=s.paradas.find(r=>r.id===id);
 assert.equal(stop.fim-stop.inicio,15000);assert.equal(s.scenarioAt-before.scenarioAt,60000);
 assert.equal(a.performance.sample(s.maquinas.find(m=>m.id==='NHPL'),s).goodCount-good,Math.floor(45/cycle));
 await a.data.workflow('classify-stop',{motivoCodigo:'travamento-pallet'},id);assert.equal(stop.motivo,'Travamento de pallet / peça');assert.equal(stop.motivoConfirmado,true);
 await assert.rejects(a.data.workflow('classify-stop',{motivoCodigo:'invalido'},id),/válido/);
});
test('passagem congela o resumo, exige outra pessoa no recebimento e carrega pendências entre turnos',async()=>{
 const {a}=await fixture(),s=a.data.state,d=new Date(s.scenarioAt);d.setDate(d.getDate()-1);const dia=d.toLocaleDateString('sv');
 const id=await a.data.workflow('handover-create',{maquinaId:'NHPL',dia,turno:'2',pendencias:'Conferir alimentador',acoesRealizadas:'Ajuste realizado'}),r=s.passagensTurno.find(r=>r.id===id),saved=JSON.stringify(r.resumo);
 await assert.rejects(a.data.workflow('handover-receive',{},id),/outra pessoa/);
 await assert.rejects(a.data.workflow('handover-create',{maquinaId:'NHPL',dia,turno:'2'}),/já possui/);
 const chief={...a.auth.session(),id:'outra-lideranca',cargo:'chefe',nome:'Luan Miguel'};await a.data.start(chief);await a.data.workflow('handover-receive',{},id);assert.equal(r.recebidoId,chief.id);
 const next=await a.data.workflow('handover-create',{maquinaId:'NHPL',dia,turno:'3'});const nextRow=s.passagensTurno.find(r=>r.id===next);assert(nextRow.pendencias.some(t=>t.texto==='Conferir alimentador'));
 const task=r.pendencias.find(t=>t.texto==='Conferir alimentador');await a.data.workflow('handover-task',{taskId:task.id},next);assert(task.done);assert(nextRow.pendencias.find(t=>t.id===task.id).done);
 a.demo.simulation.advance(30);assert.equal(JSON.stringify(r.resumo),saved);
});
test('lote inteiro exige Qualidade e reinspeção total; descarte adicional não duplica refugo nem quantidade do lote',async()=>{
 const {a}=await fixture(),s=a.data.state,b=s.lotesQualidade.find(b=>b.maquinaId==='NHPL'),count=b.quantidade,ref=s.perdas.filter(r=>r.maquinaId==='NHPL'&&r.tipo==='refugo').reduce((n,r)=>n+r.quantidade,0);
 await assert.rejects(a.data.workflow('batch-transition',{status:'segregado',observacao:'Área vermelha'},b.id),/acesso/);
 await a.data.start({...a.auth.session(),cargo:'qualidade',setorId:'',id:'qa'});
 await assert.rejects(a.data.workflow('batch-transition',{status:'liberado',observacao:'Liberação'},b.id),/Etapa/);
 await a.data.workflow('batch-transition',{status:'segregado',observacao:'Área vermelha'},b.id);await a.data.workflow('batch-transition',{status:'reinspecao',observacao:'Inspeção iniciada'},b.id);
 await assert.rejects(a.data.workflow('batch-transition',{status:'liberado',observacao:'Avaliação',inspecionadas:count-1,descartadas:b.refugosIdentificados},b.id),/todas as peças/);
 const discard=b.refugosIdentificados+3;await a.data.workflow('batch-transition',{status:'liberado',observacao:'Conformes liberadas; defeituosas segregadas para descarte',inspecionadas:count,descartadas:discard},b.id);
 assert.equal(b.status,'liberado');assert.equal(b.quantidade,count);assert.equal(b.liberadas,count-discard);
 assert.equal(s.perdas.filter(r=>r.maquinaId==='NHPL'&&r.tipo==='refugo').reduce((n,r)=>n+r.quantidade,0),ref+3);
 a.workflows.sync(s);assert.equal(b.status,'liberado');assert.equal(a.metrics.summarize(s,[s.maquinas.find(m=>m.id==='NHPL')],0,s.scenarioAt+1).suspeitas,0);
});
test('alerta preserva atendimento na normalização, impede resolução ativa e não repete episódios',async()=>{
 const {a}=await fixture(),s=a.data.state,id=a.demo.simulation.microStop('NHPL',8),alert=s.atendimentosAlertas.find(r=>r.sourceKey==='stop:'+id);
 const quantity=s.atendimentosAlertas.length;a.workflows.sync(s);assert.equal(s.atendimentosAlertas.length,quantity);
 await a.data.workflow('alert-transition',{status:'reconhecido'},alert.id);await a.data.workflow('alert-transition',{status:'atendimento',observacao:'Verificar travamento'},alert.id);
 await assert.rejects(a.data.workflow('alert-transition',{status:'resolvido',observacao:'Concluído'},alert.id),/ainda está ativa/);
 a.demo.simulation.advance(10);a.workflows.sync(s);assert.equal(alert.active,false);assert.equal(alert.status,'atendimento');
 await a.data.workflow('alert-transition',{status:'resolvido',observacao:'Fluxo restabelecido'},alert.id);assert.equal(alert.historico.length,3);a.workflows.sync(s);assert.equal(s.atendimentosAlertas.filter(r=>r.sourceKey==='stop:'+id).length,1);
});
test('presença por turno libera posto ausente, mantém RE e limita redistribuição ao setor do supervisor',async()=>{
 const {a}=await fixture(),s=a.data.state,p=s.perfis.find(p=>p.cargo==='operador'&&p.setorId==='montagem'),{dia,turno}=a.workflows.shiftAt(s.scenarioAt-1),previous=p.maquinaId;
 await assert.rejects(a.data.workflow('staff-save',{funcionarioId:p.id,dia,turno,presenca:'ausente',maquinaId:'NHPL'}),/ausente/);
 const id=await a.data.workflow('staff-save',{funcionarioId:p.id,dia,turno,presenca:'ausente',maquinaId:''}),record=s.alocacoes.find(a=>a.id===id);assert.equal(record.maquinaId,'');assert.equal(record.funcionarioRe,p.re);assert.equal(p.maquinaId,previous);
 await assert.rejects(a.data.workflow('staff-save',{funcionarioId:p.id,dia,turno,presenca:'presente',maquinaId:'INJ-01'}),/acesso/);
 await a.data.start({...a.auth.session(),cargo:'chefe'});await a.data.workflow('staff-save',{funcionarioId:p.id,dia,turno,presenca:'presente',maquinaId:'INJ-01',observacao:'Prioridade na entrega'});assert.equal(record.setorDestino,'injecao');assert(record.historico.length>=3);
});
test('recarregar preserva classificações, decisões e alocações sem duplicar lotes ou alertas',async()=>{
 const {a,storage}=await fixture();const id=a.demo.simulation.microStop('NHPL',8);a.demo.simulation.advance(10);await a.data.workflow('classify-stop',{motivoCodigo:'sensor'},id);
 const before=a.data.state,restored=(await fixture('supervisor',storage)).a.data.state;
 for(const key of a.workflows.collections)assert.equal(restored[key].length,before[key].length,key);
 assert.equal(restored.paradas.find(r=>r.id===id).motivo,'Sensor sem leitura / desalinhado');assert.equal(restored.scenarioAt,before.scenarioAt);
 assert([...storage.values()].every(v=>v.length<1000000));
});
