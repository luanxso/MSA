import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function fixture() {
  let now=Date.UTC(2026,9,7,12),tick;
  class Clock extends Date { static now(){return now;} }
  const context=vm.createContext({Date:Clock,setInterval(callback){tick=callback;return 1;},clearInterval(){tick=null;}});
  context.window=context;
  for(const file of ['config','plant-layout','telemetry-service'])vm.runInContext(readFileSync(new URL(`../dist/assets/${file}.js`,import.meta.url),'utf8'),context);
  return {telemetry:context.MSA.telemetry,catalog:context.MSA.telemetry.catalog,realCatalog:context.MSA.config.machines,layout:context.MSA.plantLayout,now:()=>now,advance(ms){now+=ms;tick?.();}};
}
const plain=value=>JSON.parse(JSON.stringify(value));

test('planta de demonstração separa 32 postos fictícios do cadastro operacional e conserva os totais',()=>{
  const f=fixture(),sim=f.telemetry.createSimulator(f.catalog,f.now());
  assert.equal(f.catalog.length,32);assert.equal(f.realCatalog.length,5);assert.equal(f.layout.areas.length,8);
  const before=new Map(f.catalog.map(m=>[m.id,sim.get(m.id)]));sim.advance(f.now()+60000);
  for(const m of f.catalog){
    assert(f.layout.placements[m.id]);const s=sim.get(m.id),old=before.get(m.id);
    assert.equal(s.totalCount,s.goodCount+s.rejectedCount);
    assert.equal(s.plannedSeconds,s.operatingSeconds+s.stopSeconds+s.setupSeconds+s.maintenanceSeconds);
    if(s.state==='operando')assert(s.totalCount>old.totalCount);else assert.equal(s.totalCount,old.totalCount);
    for(const p of Object.values(s.parameters))assert(Number.isFinite(p.value));
  }
});

test('produção simulada cresce por ciclos completos e conserva peças e tempos',()=>{
  const f=fixture(),sim=f.telemetry.createSimulator(f.catalog,f.now()),before=sim.get('INJ-01');
  sim.advance(f.now()+1000);
  assert.equal(sim.get('INJ-01').totalCount,before.totalCount);
  sim.advance(f.now()+before.cycleSeconds*1000*3);
  const after=sim.get('INJ-01');
  assert.equal(after.totalCount,before.totalCount+3);
  assert.equal(after.goodCount+after.rejectedCount,after.totalCount);
  assert(after.cycleProgress>=0&&after.cycleProgress<1);
  assert.equal(after.plannedSeconds,after.operatingSeconds+after.stopSeconds+after.setupSeconds+after.maintenanceSeconds);
  assert.equal(before.totalCount,520,'snapshots anteriores permanecem estáveis');
});

test('parada, setup e manutenção congelam a produção e acumulam o tempo correspondente',()=>{
  const f=fixture();
  for(const [state,key] of [['parada','stopSeconds'],['setup','setupSeconds'],['manutencao','maintenanceSeconds']]) {
    const sim=f.telemetry.createSimulator(f.catalog,f.now());
    sim.scenario('INJ-01',state,f.now());const before=sim.get('INJ-01');
    sim.advance(f.now()+90000);const after=sim.get('INJ-01');
    assert.equal(after.totalCount,before.totalCount);
    assert.equal(after.operatingSeconds,before.operatingSeconds);
    assert.equal(after[key],before[key]+90);
    assert.equal(after.speed,0);assert.equal(after.cycleProgress,0);
    assert.equal(after.plannedSeconds,after.operatingSeconds+after.stopSeconds+after.setupSeconds+after.maintenanceSeconds);
  }
});

test('alerta é independente do estado operacional e registra normalização',()=>{
  const f=fixture(),sim=f.telemetry.createSimulator(f.catalog,f.now());
  sim.scenario('ABF-01','alerta',f.now());const before=sim.get('ABF-01');
  assert.equal(before.state,'operando');assert(before.alarms.some(a=>a.parameterId));
  sim.advance(f.now()+60000);assert(sim.get('ABF-01').totalCount>before.totalCount);
  sim.scenario('ABF-01','operando',f.now()+60000);
  const after=sim.get('ABF-01');
  assert.equal(after.alarms.length,0);
  assert.equal(after.events.at(-1).description,'Parâmetro normalizado');
});

test('pausar congela contadores, parâmetros e cronologia, sem produzir ao retomar',()=>{
  const f=fixture(),t=f.telemetry;t.start();f.advance(1000);t.pause();
  const before=plain(t.get('INJ-01'));
  f.advance(600000);assert.deepEqual(plain(t.get('INJ-01')),before);
  t.scenario('INJ-01','parada');assert.equal(t.get('INJ-01').totalCount,before.totalCount);
  t.scenario('INJ-01','operando');t.pause();
  assert.equal(t.get('INJ-01').totalCount,before.totalCount);
  f.advance(26000);assert.equal(t.get('INJ-01').totalCount,before.totalCount+1);t.stop();
});

test('OEE usa disponibilidade × desempenho × qualidade e rejeita bases incompletas',()=>{
  const {telemetry:t}=fixture();
  const sample={plannedSeconds:1000,operatingSeconds:800,idealCycleSeconds:7.2,partsPerCycle:1,totalCount:100,goodCount:95};
  const e=t.efficiency(sample);
  assert.equal(e.availability,80);assert.equal(e.performance,90);assert.equal(e.quality,95);
  assert(Math.abs(e.oee-68.4)<1e-9);
  for(const bad of [{operatingSeconds:null},{idealCycleSeconds:-1},{goodCount:101},{partsPerCycle:0},{totalCount:0}])assert.equal(t.efficiency({...sample,...bad}),null);
});

test('adaptador descarta leituras antigas e sinaliza perda e recuperação de comunicação',()=>{
  const f=fixture(),t=f.telemetry;let send,fail,stopped=false;
  t.useAdapter({name:'CLP de teste',subscribe(onSample,onError){send=onSample;fail=onError;return()=>{stopped=true;};}});
  assert.equal(t.mode,'api');assert.equal(t.get('INJ-01'),null);
  send({id:'INJ-01',state:'operando',goodCount:300,updatedAt:f.now()});
  send({id:'INJ-01',state:'parada',goodCount:200,updatedAt:f.now()-1000});
  assert.equal(t.get('INJ-01').goodCount,300);assert.equal(t.get('INJ-01').state,'operando');
  f.advance(16000);assert.equal(t.get('INJ-01').stale,true);assert.equal(t.get('INJ-01').connected,false);
  fail();assert(t.error.includes('comunicação'));assert.equal(t.get('INJ-01'),null);
  send({id:'INJ-01',state:'operando',goodCount:301,updatedAt:f.now()});
  assert.equal(t.error,'');assert.equal(t.get('INJ-01').stale,false);
  t.disconnectAdapter();assert(stopped);assert.equal(t.mode,'simulation');
  send({id:'INJ-01',updatedAt:f.now()});assert.equal(t.error,'','adaptador desconectado não envia dados');
});

test('leituras inválidas não se tornam valores plausíveis nem estados operacionais',()=>{
  const f=fixture(),t=f.telemetry;
  assert.throws(()=>t.normalizeSample({id:'INJ-01',updatedAt:'agora'}),/updatedAt/);
  const s=t.normalizeSample({id:'INJ-01',updatedAt:f.now(),state:'inventado',goodCount:'100',parameters:{temp:{value:270,min:240,max:260},broken:{value:null}},timeline:[{start:f.now(),state:'inventado',end:null},{start:'ontem'}],events:[{time:'ontem'}]},f.now());
  assert.equal(s.state,'desconhecido');assert.equal(s.goodCount,null);assert.equal(s.efficiency,null);
  assert.equal(s.parameters.temp.alarm,true);assert(!s.parameters.broken);
  assert.equal(s.timeline.length,1);assert.equal(s.timeline[0].state,'desconhecido');assert.equal(s.events.length,0);
});
