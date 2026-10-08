import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function fixture(){
 let stamp=new Date('2026-10-07T15:00:00').getTime(),tick;
 class Clock extends Date{static now(){return stamp;}}
 const context=vm.createContext({Date:Clock,console,setInterval(fn){tick=fn;return 1;},clearInterval(){tick=null;}});context.window=context;
 for(const f of ['config','plant-layout','telemetry-service','shifts','metrics','performance','scenario-data','scenario-live'])vm.runInContext(readFileSync('dist/assets/'+f+'.js','utf8'),context);
 const a=context.MSA,state=a.createScenario(stamp);state.demoRejectRate=0;a.telemetry.setMode('records');a.demo={simulation:{advance(seconds){a.scenarioLive.advance(state,seconds);}}};
 return{a,state,advance(ms){stamp+=ms;tick?.();}};
}
test('ciclos automáticos não alteram o período nem a quantidade de um apontamento manual',()=>{
 const {a,state}=fixture(),m=state.maquinas.find(m=>m.id==='ABF-01');
 state.maquinas=[m];a.scenarioLive.advance(state,300);
 const manual={id:'exemplo-local-manual',maquinaId:m.id,setorId:m.setorId,inicio:state.scenarioAt-60000,fim:state.scenarioAt+1000,quantidade:7,turno:'1'};
 state.registrosProducao.push(manual);const saved={...manual};
 a.scenarioLive.advance(state,25);assert.deepEqual(manual,saved);
});
test('cenário completa ciclos de 25 s em novas janelas sem alterar histórico',()=>{
 const{a,state}=fixture(),m=state.maquinas.find(m=>m.id==='ABF-01'),before=a.performance.sample(m,state),records=state.registrosProducao.length;
 assert.equal(before.cycleSeconds,25);a.scenarioLive.advance(state,24.5);let s=a.performance.sample(m,state);assert.equal(s.goodCount,before.goodCount);assert.equal(s.cycleProgress,.98);
 a.scenarioLive.advance(state,.5);s=a.performance.sample(m,state);assert.equal(s.goodCount,before.goodCount+1);assert.equal(s.cycleProgress,0);assert.equal(s.rejectedCount,before.rejectedCount);assert.equal(s.totalCount,s.goodCount+s.rejectedCount);
 a.scenarioLive.advance(state,50);s=a.performance.sample(m,state);assert.equal(s.goodCount,before.goodCount+3);assert.equal(state.registrosProducao.length,records+state.maquinas.length);
 assert.equal(s.hourly.reduce((n,h)=>n+h.goodCount,0),s.goodCount);assert(s.efficiency&&s.efficiency.oee<=100);
 const start=new Date(state.scenarioAt).setHours(0,0,0,0);assert.equal(a.metrics.summarize(state,[m],start,start+86400000).aprovadas,s.goodCount);
 assert.equal(a.performance.calculate(state,[m],start,start+86400000).good,s.goodCount);
});
test('parada, setup e manutenção não produzem; retomada usa o mesmo registro compartilhado',()=>{
 const{a,state}=fixture(),stopped=state.maquinas.filter(m=>state.paradas.some(r=>r.maquinaId===m.id&&!r.fim)),before=new Map(stopped.map(m=>[m.id,a.performance.sample(m,state)]));
 a.scenarioLive.advance(state,75);for(const m of stopped){const s=a.performance.sample(m,state);assert.equal(s.goodCount,before.get(m.id).goodCount);assert.equal(s.cycleProgress,0);assert(s.stopSeconds>before.get(m.id).stopSeconds);}
 const m=stopped[0],stop=state.paradas.find(r=>r.maquinaId===m.id&&!r.fim);stop.fim=state.scenarioAt;a.scenarioLive.advance(state,25);assert.equal(a.performance.sample(m,state).goodCount,before.get(m.id).goodCount+1);
});
test('relógio do mapa avança o cenário; pausa e saída preservam o ciclo sem contabilizar tempo parado',()=>{
 const f=fixture(),{a,state}=f,m=state.maquinas.find(m=>m.id==='ABF-01'),base=a.performance.sample(m,state).goodCount;
 a.telemetry.start();f.advance(10000);assert.equal(a.performance.sample(m,state).cycleProgress,.4);
 a.telemetry.pause();const at=state.scenarioAt;f.advance(60000);assert.equal(state.scenarioAt,at);assert.equal(a.performance.sample(m,state).goodCount,base);
 a.telemetry.pause();f.advance(15000);assert.equal(a.performance.sample(m,state).goodCount,base+1);
 a.telemetry.stop();const stoppedAt=state.scenarioAt;f.advance(60000);assert.equal(state.scenarioAt,stoppedAt);
 a.telemetry.start();f.advance(25000);assert.equal(a.performance.sample(m,state).goodCount,base+2);
 // A fonte real/manual não recebe contagens artificiais.
 a.demo=null;const realAt=state.scenarioAt;f.advance(60000);assert.equal(state.scenarioAt,realAt);
});

test('probabilidade de 0,8% sorteia cada ciclo e mantém aprovada e refugo separados',()=>{
 const{a,state}=fixture(),m=state.maquinas.find(m=>m.id==='ABF-01');state.maquinas=[m];delete state.demoRejectRate;
 assert.equal(a.scenarioLive.rejectRate(state),.008);
 const before=a.performance.sample(m,state),sequence=[.0079,.008,0];a.scenarioLive.advance(state,75,()=>sequence.shift());
 const after=a.performance.sample(m,state);assert.equal(after.goodCount,before.goodCount+1);assert.equal(after.rejectedCount,before.rejectedCount+2);assert.equal(after.totalCount,before.totalCount+3);
 const generated=state.perdas.filter(r=>r.simulacaoCiclos);assert.equal(generated.length,2);assert.equal(new Set(generated.map(r=>r.id)).size,2);assert(generated.every(r=>r.tipo==='refugo'&&r.unidade==='pecas'&&r.lote&&r.motivo&&r.turno==='2'));
 assert(after.recentReject);assert.equal(after.events.filter(e=>e.type==='qualidade').length,2);assert(after.alarms.some(a=>a.code==='QUAL-REF'));
 assert.equal(after.hourly.reduce((n,h)=>n+h.goodCount,0),after.goodCount);assert(after.efficiency&&after.efficiency.oee<=100);
 a.scenarioLive.advance(state,11,()=>1);assert.equal(a.performance.sample(m,state).recentReject,null);assert.equal(a.performance.sample(m,state).rejectedCount,after.rejectedCount);
});
test('simular próximo refugo espera o ciclo, respeita parada e vale uma única vez',()=>{
 const{a,state}=fixture(),m=state.maquinas.find(m=>m.id==='ABF-01');state.maquinas=[m];const before=a.performance.sample(m,state);
 a.scenarioLive.rejectNext(state,m.id);a.scenarioLive.advance(state,24);assert.equal(a.performance.sample(m,state).rejectedCount,before.rejectedCount);assert(a.performance.sample(m,state).rejectPending);
 a.scenarioLive.advance(state,1);let after=a.performance.sample(m,state);assert.equal(after.goodCount,before.goodCount);assert.equal(after.rejectedCount,before.rejectedCount+1);assert(!after.rejectPending);
 a.scenarioLive.advance(state,25);after=a.performance.sample(m,state);assert.equal(after.goodCount,before.goodCount+1);assert.equal(after.rejectedCount,before.rejectedCount+1);
 state.paradas.push({id:'test-stop',maquinaId:m.id,setorId:m.setorId,inicio:state.scenarioAt,fim:0,kind:'parada'});a.scenarioLive.rejectNext(state,m.id);a.scenarioLive.advance(state,25);assert(a.performance.sample(m,state).rejectPending);assert.equal(a.performance.sample(m,state).rejectedCount,after.rejectedCount);
 state.paradas.at(-1).fim=state.scenarioAt;a.scenarioLive.advance(state,25);assert.equal(a.performance.sample(m,state).rejectedCount,after.rejectedCount+1);
 const start=new Date(state.scenarioAt).setHours(0,0,0,0),summary=a.metrics.summarize(state,[m],start,start+86400000),current=a.performance.sample(m,state);assert.equal(summary.refugos,current.rejectedCount);assert.equal(summary.aprovadas,current.goodCount);
 assert.equal(a.performance.calculate(state,[m],start,start+86400000).rejected,current.rejectedCount);
});


test('produção, refugos e indicadores do turno encerrado permanecem fixos',()=>{
 const {a,state}=fixture(),m=state.maquinas.find(m=>m.id==='ABF-01');state.maquinas=[m];
 const start=new Date(state.scenarioAt).setHours(0,0,0,0),end=start+86400000;
 vm.runInNewContext(readFileSync('dist/assets/shift-analysis.js','utf8'),{window:{MSA:a},MSA:a,Date});
 const historical=JSON.stringify(state.registrosProducao),closed=a.shiftAnalysis.analyze(state,[m],start,end,'1');
 a.scenarioLive.advance(state,75,()=>1);state.demoRejectRate=1;a.scenarioLive.advance(state,75,()=>0);
 assert.equal(JSON.stringify(state.registrosProducao.filter(r=>!r.simulacaoCiclos)),historical);
 assert.equal(JSON.stringify(a.shiftAnalysis.analyze(state,[m],start,end,'1')),JSON.stringify(closed));
 const active=a.shiftAnalysis.analyze(state,[m],start,end,'2');assert.equal(active.good,3);assert.equal(active.rejected,3);assert.equal(active.running,1);
 assert.equal(a.shiftAnalysis.analyze(state,[m],start,end,'3').total,0);
});

test('viradas de turno dividem registros e ciclos, inclusive noite e data de produção',()=>{
 for(const [time,oldShift,nextShift,day] of [['14:59:50','1','2','2026-10-07'],['22:59:50','2','3','2026-10-07'],['06:59:50','3','1','2026-10-08']]){
  const {a,state}=fixture(),m=state.maquinas.find(m=>m.id==='ABF-01');state.maquinas=[m];state.paradas=[];
  state.scenarioAt=+new Date((oldShift==='3'?'2026-10-08':'2026-10-07')+'T'+time);state.liveCycles={[m.id]:15};
  const boundary=state.scenarioAt+10000;a.scenarioLive.advance(state,35,()=>1);
  const rows=state.registrosProducao.filter(r=>r.simulacaoCiclos);assert.equal(rows.length,2);
  assert.equal(rows[0].turno,oldShift);assert.equal(rows[0].fim,boundary);assert.equal(rows[0].quantidade,1);
  assert.equal(rows[1].turno,nextShift);assert.equal(rows[1].inicio,boundary);assert.equal(rows[1].quantidade,1);assert.equal(rows[1].diaProducao,day);
  const saved=JSON.stringify(rows[0]);a.scenarioLive.advance(state,25,()=>1);assert.equal(JSON.stringify(rows[0]),saved);
 }
});

test('meia-noite conserva terceiro turno e gera uma janela por hora',()=>{
 const {a,state}=fixture(),m=state.maquinas.find(m=>m.id==='ABF-01');state.maquinas=[m];state.paradas=[];
 state.scenarioAt=+new Date('2026-10-07T23:59:50');a.scenarioLive.advance(state,60,()=>1);
 const rows=state.registrosProducao.filter(r=>r.simulacaoCiclos);assert.equal(rows.length,2);
 assert(rows.every(r=>r.turno==='3'&&r.diaProducao==='2026-10-07'));assert.equal(rows.reduce((n,r)=>n+r.quantidade,0),2);
 const sample=a.performance.sample(m,state);assert.equal(sample.shift,'3º turno');assert(sample.goodCount>=2);
});

test('migração recupera turno encerrado e preserva totais e apontamentos manuais',()=>{
 const {a,state}=fixture(),baseline=JSON.parse(JSON.stringify(state)),m=state.maquinas.find(m=>m.id==='ABF-01');
 const row=state.registrosProducao.filter(r=>r.maquinaId===m.id&&r.turno==='1').at(-1),original={...row};
 row.fim+=60000;row.quantidade+=2;row.simulacaoCiclos=true;state.scenarioAt+=60000;
 const manual={id:'manual',maquinaId:m.id,inicio:original.inicio,fim:original.fim,quantidade:7,turno:'1'};state.registrosProducao.push(manual);
 state.perdas.push({id:'old-refugo',maquinaId:m.id,data:original.fim+25000,tipo:'refugo',quantidade:1,turno:'1',simulacaoCiclos:true});
 const total=state.registrosProducao.reduce((n,r)=>n+r.quantidade,0);a.scenarioLive.upgrade(state,baseline);
 assert.equal(row.fim,original.fim);assert.equal(row.quantidade,original.quantidade);assert.equal(state.registrosProducao.reduce((n,r)=>n+r.quantidade,0),total);assert.deepEqual(state.registrosProducao.find(r=>r.id==='manual'),manual);
 assert.equal(state.perdas.at(-1).turno,'2');const migrated=JSON.stringify(state);a.scenarioLive.upgrade(state,baseline);assert.equal(JSON.stringify(state),migrated);
 a.scenarioLive.advance(state,25,()=>1);assert.equal(row.quantidade,original.quantidade);
});
