import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function app(){const scope={window:null,Date,console};scope.window=scope;vm.createContext(scope);for(const f of ['config','plant-layout','shifts','metrics','performance','scenario-data'])vm.runInContext(readFileSync('dist/assets/'+f+'.js','utf8'),scope);return scope.MSA;}
test('cenário mantém máquinas, hora a hora, perdas, OEE e rastreabilidade iguais aos pop-ups',()=>{
 const a=app(),state=a.createScenario(new Date('2026-10-07T15:00:00').getTime());
 assert.equal(state.maquinas.length,32);assert.equal(state.registrosProducao.length,4864);
 assert.equal(new Set(state.maquinas.map(m=>m.id)).size,32);
 for(const m of state.maquinas){
  assert(state.setores.some(s=>s.id===m.setorId));const s=a.performance.sample(m,state),start=new Date(state.scenarioAt).setHours(0,0,0,0),summary=a.metrics.summarize(state,[m],start,start+86400000);
  assert.equal(s.goodCount,summary.aprovadas);assert.equal(s.rejectedCount,summary.refugos);assert.equal(s.totalCount,s.goodCount+s.rejectedCount);assert.equal(s.hourly.reduce((n,h)=>n+h.goodCount,0),s.goodCount);
  assert.equal(s.stopSeconds,summary.minutos*60);assert(s.efficiency&&s.efficiency.oee>=0&&s.efficiency.oee<=100,m.id);assert(Math.abs(s.efficiency.oee-s.efficiency.availability*s.efficiency.performance*s.efficiency.quality/10000)<1e-8);
  assert(s.reliability.mtbf>0&&s.reliability.mttr>0);assert(s.order&&s.batch);assert.equal(s.hourly.length,8);
 }
});
test('faixas de alerta são exclusivas nos limites informados pelo supervisor',()=>{const p=app().performance;assert.equal(p.recipient(null),null);assert.equal(p.recipient(59.9),'Gerência');assert.equal(p.recipient(60),'Supervisão');assert.equal(p.recipient(79.9),'Supervisão');assert.equal(p.recipient(80),'Liderança');assert.equal(p.recipient(94.9),'Liderança');assert.equal(p.recipient(95),null);});
test('encerramento de parada muda o mesmo estado usado pelo mapa e parâmetros sem dados não geram OEE',()=>{
 const a=app(),state=a.createScenario(),m=state.maquinas.find(m=>m.id==='SEL-01'),stop=state.paradas.find(r=>r.maquinaId===m.id&&!r.fim);assert.equal(a.performance.sample(m,state).state,'parada');stop.fim=state.scenarioAt;assert.equal(a.performance.sample(m,state).state,'operando');
 const x=a.performance.calculate({registrosProducao:[],perdas:[],paradas:[]},[m],0,Date.now());assert.equal(x.efficiency,null);assert.equal(x.mtbf,null);assert.equal(x.mttr,null);
});

test('filtro por turno conserva os totais e não divide o turno noturno entre datas',()=>{
 const a=app(),state=a.createScenario(new Date('2026-10-07T15:00:00').getTime()),machines=[state.maquinas.find(m=>m.id==='NHPL')];
 const start=new Date('2026-10-06T00:00:00').getTime(),end=new Date('2026-10-07T00:00:00').getTime();
 const all=a.performance.calculate(state,machines,start,end),slices=['1','2','3'].map(t=>a.performance.calculate(a.shifts.filter(state,t),machines,start,end));
 assert.equal(slices.reduce((n,s)=>n+s.good,0),all.good);assert.equal(slices.reduce((n,s)=>n+s.target,0),all.target);assert.equal(slices.reduce((n,s)=>n+s.rejected,0),all.rejected);
 for(const t of ['1','2','3']){const scoped=a.shifts.filter(state,t),x=a.performance.calculate(scoped,machines,start,end),hours=a.performance.hourly(scoped,machines,start,end),summary=a.metrics.summarize(scoped,machines,start,end);assert.equal(hours.length,8);assert.equal(hours.reduce((n,h)=>n+h.goodCount,0),x.good);assert.equal(x.good,summary.aprovadas);assert.equal(x.downtime,summary.minutos*60);assert(x.efficiency);}
 const night=a.performance.hourly(a.shifts.filter(state,'3'),machines,start,end);assert.equal(new Date(night[0].time).getHours(),23);assert.equal(new Date(night[7].time).getHours(),6);
 const today=a.performance.calculate(a.shifts.filter(state,'3'),machines,end,end+86400000);assert.equal(today.good,0);assert.equal(today.target,0);
 const real={registrosProducao:[{maquinaId:'NHPL',turno:'3',inicio:new Date('2026-10-06T23:00:00').getTime(),fim:new Date('2026-10-07T07:00:00').getTime(),quantidade:160}],perdas:[],paradas:[]};assert.equal(a.performance.calculate(real,machines,start,end).good,160);assert.equal(a.performance.calculate(real,machines,end,end+86400000).good,0);
});
