import assert from 'node:assert/strict';import test from 'node:test';import vm from 'node:vm';import{readFileSync}from'node:fs';
function fixture(id='INJ-03'){
 const c=vm.createContext({Date,console});c.window=c;for(const f of ['config','plant-layout','shifts','metrics','performance','scenario-parameters','scenario-data','scenario-live'])vm.runInContext(readFileSync('dist/assets/'+f+'.js','utf8'),c);
 const a=c.MSA,state=a.createScenario(new Date('2026-10-07T15:00:00').getTime());state.demoDeviationRate=0;const m=state.maquinas.find(m=>m.id===id);return{a,state,m};
}
test('injetoras e selagem têm temperatura e pressão; montagem usa pressão; atualização preserva limites existentes',()=>{
 const{a,state}=fixture();assert.equal(state.maquinas.filter(m=>Object.values(m.parametros).some(p=>p.unidade==='°C')).length,10);
 for(const m of state.maquinas.filter(m=>['injecao','selagem'].includes(m.setorId))){assert(m.parametros.temperatura);assert(m.parametros.pressao);}
 const m=state.maquinas.find(m=>m.id==='INJ-03');delete m.parametros.temperatura;m.parametros.pressao.max=130;const count=state.registrosProducao.length;a.scenarioParameters.upgrade(state);assert(m.parametros.temperatura);assert.equal(m.parametros.pressao.max,130);assert.equal(state.registrosProducao.length,count);
 assert(state.leituras.filter(r=>r.maquinaId===m.id).every(r=>Number.isFinite(r.valores.temperatura)));
});
test('leituras variam, atualizam horário e são compartilhadas com desvios e painéis; tempo de ciclo fica estável',()=>{
 const{a,state,m}=fixture();state.maquinas=[m];a.scenarioParameters.advance(state,()=>1);const before=a.performance.sample(m,state);state.scenarioAt+=2000;a.scenarioParameters.advance(state,()=>1);const after=a.performance.sample(m,state);
 assert.notEqual(after.parameters.temperatura.value,before.parameters.temperatura.value);assert.notEqual(after.parameters.pressao.value,before.parameters.pressao.value);assert.equal(after.cycleSeconds,before.cycleSeconds);assert.equal(after.parameters.pressao.updatedAt,state.scenarioAt);
 assert(after.parameters.pressao.value>=m.parametros.pressao.min&&after.parameters.pressao.value<=m.parametros.pressao.max);assert.equal(a.metrics.deviations(state,[m]).length,0);
});
test('desvio manual ultrapassa máximo, alerta uma vez e retorna à faixa com evento de normalização',()=>{
 const{a,state,m}=fixture('NHPL');state.maquinas=[m];a.scenarioParameters.advance(state,()=>1);a.scenarioParameters.requestDeviation(state,m.id);a.scenarioParameters.advance(state,()=>1);
 let s=a.performance.sample(m,state);assert(s.parameters.pressao.value>m.parametros.pressao.max);assert(s.alarms.some(a=>a.parameterId==='pressao'));assert.equal(s.recentParameterEvent.type,'desvio');assert.equal(a.metrics.deviations(state,[m]).length,1);
 const events=state.parameterEvents.length;state.scenarioAt+=1000;a.scenarioParameters.advance(state,()=>1);assert.equal(state.parameterEvents.length,events);
 state.scenarioAt+=9000;a.scenarioParameters.advance(state,()=>1);s=a.performance.sample(m,state);assert(!s.parameters.pressao.alarm);assert.equal(s.recentParameterEvent.type,'normalizado');assert.equal(a.metrics.deviations(state,[m]).length,0);assert.equal(s.events.filter(e=>e.type==='alarme').length,2);
});
test('sorteio de desvio é por intervalo de 30 s, respeita chance e não atua na fonte real',()=>{
 const{a,state,m}=fixture();state.maquinas=[m];delete state.demoDeviationRate;a.scenarioParameters.advance(state,()=>1);state.scenarioAt+=30000;a.scenarioParameters.advance(state,()=>0);assert(a.performance.sample(m,state).parameters.temperatura.alarm);
 const events=state.parameterEvents.length;state.scenarioAt+=1000;a.scenarioParameters.advance(state,()=>0);assert.equal(state.parameterEvents.length,events);
 state.demo=false;const stamp=state.leituras.at(-1).data;state.scenarioAt+=60000;a.scenarioParameters.advance(state,()=>0);assert.equal(state.leituras.at(-1).data,stamp);
});
