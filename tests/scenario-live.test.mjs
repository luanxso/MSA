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
test('cenário compartilhado completa ciclos de 25 s e incrementa uma peça aprovada sem duplicar histórico',()=>{
 const{a,state}=fixture(),m=state.maquinas.find(m=>m.id==='ABF-01'),before=a.performance.sample(m,state),records=state.registrosProducao.length;
 assert.equal(before.cycleSeconds,25);a.scenarioLive.advance(state,24.5);let s=a.performance.sample(m,state);assert.equal(s.goodCount,before.goodCount);assert.equal(s.cycleProgress,.98);
 a.scenarioLive.advance(state,.5);s=a.performance.sample(m,state);assert.equal(s.goodCount,before.goodCount+1);assert.equal(s.cycleProgress,0);assert.equal(s.rejectedCount,before.rejectedCount);assert.equal(s.totalCount,s.goodCount+s.rejectedCount);
 a.scenarioLive.advance(state,50);s=a.performance.sample(m,state);assert.equal(s.goodCount,before.goodCount+3);assert.equal(state.registrosProducao.length,records);
 assert.equal(s.hourly.reduce((n,h)=>n+h.goodCount,0),s.goodCount);assert(s.efficiency&&s.efficiency.oee<=100);
 const start=new Date(state.scenarioAt).setHours(0,0,0,0);assert.equal(a.metrics.summarize(state,[m],start,start+86400000).aprovadas,s.goodCount);
 assert.equal(a.performance.calculate(a.shifts.filter(state,'1'),[m],start,start+86400000).good,s.goodCount);
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

test('probabilidade de 2% sorteia cada ciclo e mantém aprovada e refugo separados',()=>{
 const{a,state}=fixture(),m=state.maquinas.find(m=>m.id==='ABF-01');state.maquinas=[m];delete state.demoRejectRate;
 assert.equal(a.scenarioLive.rejectRate(state),.02);
 const before=a.performance.sample(m,state),sequence=[.019,.02,0];a.scenarioLive.advance(state,75,()=>sequence.shift());
 const after=a.performance.sample(m,state);assert.equal(after.goodCount,before.goodCount+1);assert.equal(after.rejectedCount,before.rejectedCount+2);assert.equal(after.totalCount,before.totalCount+3);
 const generated=state.perdas.filter(r=>r.simulacaoCiclos);assert.equal(generated.length,2);assert.equal(new Set(generated.map(r=>r.id)).size,2);assert(generated.every(r=>r.tipo==='refugo'&&r.unidade==='pecas'&&r.lote&&r.motivo&&r.turno==='1'));
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
 assert.equal(a.performance.calculate(a.shifts.filter(state,'1'),[m],start,start+86400000).rejected,current.rejectedCount);
});
