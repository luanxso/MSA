import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const context=vm.createContext({Date,console});context.window=context;
for(const f of ['config','plant-layout','shifts','capability-export','scenario-parameters','scenario-data'])vm.runInContext(readFileSync('dist/assets/'+f+'.js','utf8'),context);
const MSA=context.MSA,api=MSA.capability;
const machine={id:'SEL-01',setorId:'selagem',produto:'Selo V-Gard HP',parametros:{temperatura:{nome:'Temperatura',unidade:'°C'},pressao:{nome:'Pressão',unidade:'bar'},vacuo:{nome:'Vácuo',unidade:'mmHg'}}};
const at=new Date('2026-10-08T14:30:00').getTime(),common={maquinaId:'SEL-01',lote:'L1',turno:'1',diaProducao:'2026-10-08',data:at};
function build(readings,production=[],losses=[],state={}){return api.build(state,[machine],readings,production,losses);}

test('colunas seguem os 41 parâmetros reais do modelo; sem confundir temperatura genérica com uma zona',()=>{
 assert.equal(api.fields.length,41);assert.equal(api.fields[21].label,'Aquecimento Z21');assert.equal(api.fields[39].key,'pressao_ar');assert.equal(api.fields[40].key,'vacuo');
 const result=build([{...common,id:'r',valores:{temperatura:255,pressao:6.6,vacuo:-550}}]);
 assert.equal(result.items[0].values[2],null);assert.equal(result.items[0].values[39],6.6);assert.equal(result.items[0].values[40],-550);assert.equal(result.items[0].scrap,null);assert.equal(result.rows[0].length,result.heads.length);
});
test('refugo usa apenas peças da mesma máquina, lote, dia e turno e mantém zero verdadeiro',()=>{
 const result=build([{...common,id:'r',valores:{}}],[{...common,quantidade:90},{...common,lote:'OUTRO',quantidade:900}],
 [{...common,tipo:'refugo',unidade:'pecas',quantidade:10},{...common,tipo:'perda',unidade:'kg',quantidade:300},{...common,tipo:'suspeito',quantidade:50},{...common,tipo:'refugo',turno:'2',quantidade:100},{...common,tipo:'refugo',maquinaId:'OUTRA',quantidade:100}]);
 assert.equal(result.items[0].scrap,10);
 assert.equal(build([{...common,id:'r'}],[{...common,quantidade:90}]).items[0].scrap,0);
});
test('CSV usa acentos, separador brasileiro e vácuo negativo numérico; protege texto e preserva aspas',()=>{
 const result=build([{...common,id:'r',valores:{vacuo:-600},estudoSelo:{material:'=SOMA(1;2) "x"',espessura:0.5,valores:{aquecimento_z2:0}}}]);
 const csv=api.csv(result);assert(csv.startsWith('\uFEFF'));assert(csv.includes('"-600"'));assert(csv.includes('"0,5"'));assert(csv.includes('"\'=SOMA(1;2) ""x"""'));assert.equal(result.items[0].values[2],0);
});
test('captura valida campos e não aceita números inválidos como leitura zero',()=>{
 const sample=api.clean({material:' ABS ',espessura:'0,5',selo_pressao_ar:'6,6',selo_vacuo:'-550',selo_tempo_destacar:''});assert.equal(sample.material,'ABS');assert.equal(sample.valores.pressao_ar,6.6);assert(!Object.hasOwn(sample.valores,'tempo_destacar'));
 assert.throws(()=>api.clean({espessura:'-1'}),/espessura/);assert.throws(()=>api.clean({selo_vacuo:'abc'}),/Vacuo/);
});
test('cenário gera snapshots completos apenas para Selo V-Gard e exporta conforme máquinas selecionadas',()=>{
 const state=MSA.createScenario(at),compatible=state.maquinas.filter(api.compatible);assert.equal(compatible.length,1);
 const reading=state.leituras.find(r=>r.maquinaId==='SEL-01');assert.equal(Object.keys(reading.estudoSelo.valores).length,41);
 assert(!state.leituras.find(r=>r.maquinaId==='INJ-01').estudoSelo);
 const all=api.build(state,[compatible[0]],state.leituras,state.registrosProducao,state.perdas);assert(all.rows.length>0);assert.equal(all.missing,0);assert(all.items.every(x=>x.machine.id===compatible[0].id));assert(all.items.every(x=>x.origin==='Simulação'));
 MSA.scenarioParameters.advance(state,()=>1);const history=state.leituras.find(r=>r.id.startsWith('exemplo-amostra-SEL-01-')),copy=history.estudoSelo.valores.pressao_ar;
 state.scenarioAt+=5000;MSA.scenarioParameters.advance(state,()=>1);assert.equal(history.estudoSelo.valores.pressao_ar,copy);
 const data=api.build(state,compatible,state.leituras,state.registrosProducao,state.perdas);assert(!data.items.some(x=>x.record.id.startsWith('exemplo-leitura-ativa-')));
});
test('leituras do terceiro turno mantêm refugo associado ao dia de início',()=>{
 const data=new Date('2026-10-09T02:30:00').getTime(),r={maquinaId:'SEL-01',lote:'NOITE',data,id:'n'};
 const result=build([r],[{maquinaId:'SEL-01',lote:'NOITE',inicio:new Date('2026-10-08T23:00:00').getTime(),quantidade:75}],[{...r,tipo:'refugo',quantidade:25}]);assert.equal(result.items[0].scrap,25);
});
test('leituras ao mudar de turno usam o lote produtivo correto e preservam as amostras anteriores',()=>{
 const state=MSA.createScenario(at),m=state.maquinas.find(m=>m.id==='SEL-01');state.maquinas=[m];state.demoDeviationRate=0;
 const today=new Date(state.scenarioAt);today.setHours(15,0,0,0);state.scenarioAt=+today;
 const first=MSA.shifts.context(state.scenarioAt);state.registrosProducao.push({id:'current-t2',maquinaId:m.id,inicio:state.scenarioAt,fim:state.scenarioAt+30000,turno:first.turno,diaProducao:first.diaProducao,lote:'LOTE-T2',quantidade:90});
 state.perdas.push({maquinaId:m.id,data:state.scenarioAt,turno:first.turno,diaProducao:first.diaProducao,lote:'LOTE-T2',tipo:'refugo',unidade:'pecas',quantidade:10});
 MSA.scenarioParameters.advance(state,()=>1);const one=state.leituras.find(r=>r.id.startsWith('exemplo-amostra-SEL-01-'));
 assert.equal(one.data,state.scenarioAt);assert.equal(one.turno,'2');assert.equal(one.lote,'LOTE-T2');
 let data=api.build(state,[m],[one],state.registrosProducao,state.perdas);assert.equal(data.items[0].scrap,10);
 today.setHours(23,0,0,0);state.scenarioAt=+today;const night=MSA.shifts.context(state.scenarioAt);
 state.registrosProducao.push({id:'current-t3',maquinaId:m.id,inicio:state.scenarioAt,fim:state.scenarioAt+30000,turno:night.turno,diaProducao:night.diaProducao,lote:'LOTE-T3',quantidade:80});
 state.perdas.push({maquinaId:m.id,data:state.scenarioAt,turno:night.turno,diaProducao:night.diaProducao,lote:'LOTE-T3',tipo:'refugo',unidade:'pecas',quantidade:20});
 MSA.scenarioParameters.advance(state,()=>1);const two=state.leituras.find(r=>r.id==='exemplo-amostra-'+m.id+'-'+Math.floor(state.scenarioAt/30000));
 assert.equal(two.turno,'3');assert.equal(two.lote,'LOTE-T3');assert.equal(two.diaProducao,night.diaProducao);assert.equal(one.lote,'LOTE-T2');assert.equal(one.turno,'2');
 data=api.build(state,[m],[two],state.registrosProducao,state.perdas);assert.equal(data.items[0].scrap,20);
 today.setDate(today.getDate()+1);today.setHours(2,0,0,0);state.scenarioAt=+today;MSA.scenarioParameters.advance(state,()=>1);
 const overnight=state.leituras.find(r=>r.id==='exemplo-amostra-'+m.id+'-'+Math.floor(state.scenarioAt/30000));assert.equal(overnight.lote,'LOTE-T3');assert.equal(overnight.diaProducao,night.diaProducao);
 data=api.build(state,[m],[overnight],state.registrosProducao,state.perdas);assert.equal(data.items[0].scrap,20);
});
