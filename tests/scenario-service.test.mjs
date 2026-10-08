import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';

async function fixture(cargo='supervisor',storage=new Map()){
 const scope=vm.createContext({Date,console,URLSearchParams,URL,crypto:webcrypto,
  location:{search:'?demonstracao=1&cargo='+cargo},
  sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
  addEventListener(){},dispatchEvent(){},CustomEvent:class{},setTimeout,clearTimeout});
 scope.window=scope;
 for(const name of ['config','plant-layout','rbac','shifts','metrics','performance','scenario-parameters','scenario-data','scenario-live','operations-service'])vm.runInContext(readFileSync('dist/assets/'+name+'.js','utf8'),scope);
 scope.MSA.telemetry={setMode(){}};
 vm.runInContext(readFileSync('dist/assets/scenario-service.js','utf8'),scope);
 await scope.MSA.data.start(scope.MSA.auth.session());
 return {a:scope.MSA,storage};
}
const machine=(extra={})=>({codigo:'TEST-01',nome:'Equipamento de teste',setorId:'montagem',processo:'Montagem',produto:'Abafador',metaDiaria:'800',paramCount:'1',nome_0:'Pressão',unidade_0:'bar',min_0:'5',max_0:'7',...extra});
const local=at=>{const d=new Date(at);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;};

test('cadastro de máquina persiste após recarregar e não aceita código duplicado ou limites invertidos',async()=>{
 const {a,storage}=await fixture();
 assert.equal(await a.data.saveMachine(machine({codigo:' test-01 '})),'TEST-01');
 await assert.rejects(a.data.saveMachine(machine()),/código.*cadastrado/);
 await assert.rejects(a.data.saveMachine(machine({codigo:'TEST-02',min_0:'8',max_0:'7'})),/máximo.*mínimo/);
 assert([...storage.values()].every(value=>value.length<100000),'O armazenamento deve conter apenas alterações, evitando a cota do navegador.');
 const restored=(await fixture('supervisor',storage)).a.data.state;
 assert.equal(restored.maquinas.length,33);assert.equal(restored.maquinas.find(m=>m.id==='TEST-01').nome,'Equipamento de teste');
});
test('restauração compacta preserva ciclos, refugos e leituras sem duplicar a base',async()=>{
 const {a,storage}=await fixture('chefe');a.demo.simulation.setRejectRate(0);a.demo.simulation.setDeviationRate(0);
 a.demo.simulation.rejectNext('NHPL');a.demo.simulation.advance(60);
 const before=a.data.state,sample=a.performance.sample(before.maquinas.find(m=>m.id==='NHPL'),before);
 const restored=(await fixture('chefe',storage)).a;
 const after=restored.data.state,current=restored.performance.sample(after.maquinas.find(m=>m.id==='NHPL'),after);
 assert.equal(after.scenarioAt,before.scenarioAt);assert.equal(after.registrosProducao.length,before.registrosProducao.length);
 assert.equal(after.perdas.length,before.perdas.length);assert.equal(after.leituras.length,before.leituras.length);
 assert.equal(current.goodCount,sample.goodCount);assert.equal(current.rejectedCount,sample.rejectedCount);
 assert.equal(current.parameters.pressao.value,sample.parameters.pressao.value);
});
test('editar meta pelo cadastro atualiza os indicadores; remover parâmetro não o recria na simulação',async()=>{
 const {a}=await fixture(),before=a.data.state.maquinas.find(m=>m.id==='ABF-01');
 await a.data.saveMachine(machine({nome:before.nome,metaDiaria:'1600',paramCount:'0'}),'ABF-01');
 const m=a.data.state.maquinas.find(m=>m.id==='ABF-01');assert.equal(m.hourTarget,200);
 a.demo.simulation.advance(1);
 const active=a.data.state.leituras.find(r=>r.id==='exemplo-leitura-ativa-ABF-01');assert.equal(Object.keys(active.valores).length,0);
 assert.equal(Object.keys(m.parametros).length,0);
});
test('apontamentos rejeitam peças fracionadas, leitura vazia, datas inválidas e parada com fim anterior',async()=>{
 const {a}=await fixture('operador'),now=a.data.state.scenarioAt;
 const common={maquinaId:'NHPL',data:local(now),produto:'Abafador',lote:'LT-TEST',motivo:'Teste'};
 await assert.rejects(a.data.save('perdas',{...common,tipo:'refugo',quantidade:'1.5'}),/inteira/);
 await assert.rejects(a.data.save('perdas',{...common,tipo:'invalido',quantidade:'1'}),/tipo/);
 await assert.rejects(a.data.save('leituras',{...common,valores:{pressao:'',forca:'400'}}),/válido/);
 await assert.rejects(a.data.save('ocorrencias',{...common,data:'invalida',descricao:'Teste'}),/válido/);
 await assert.rejects(a.data.save('paradas',{...common,inicio:local(now),fim:local(now-60000)}),/posterior/);
 await assert.rejects(a.data.save('registrosProducao',{...common,turno:'1',inicio:local(now),fim:local(now+3600000),quantidade:'10'}),/válido/);
 await a.data.save('perdas',{...common,tipo:'perda',quantidade:'1.5'});
 assert.equal(a.data.state.perdas.at(-1).unidade,'kg');
});
test('edição conserva a máquina de origem e obriga nova conferência',async()=>{
 const {a}=await fixture('operador'),now=a.data.state.scenarioAt;
 const values={maquinaId:'NHPL',data:local(now),tipo:'refugo',quantidade:'2',produto:'Abafador',lote:'LT-TEST',motivo:'Teste'};
 const id=await a.data.save('perdas',values);
 await assert.rejects(a.data.save('perdas',{...values,maquinaId:'INJ-01'},id),/origem/);
 assert.equal(a.data.state.perdas.find(r=>r.id===id).maquinaId,'NHPL');
 const saved=a.data.state.perdas.find(r=>r.id===id);saved.verificado=true;saved.verificadoPor='supervisor';saved.verificadoEm=now;
 await a.data.save('perdas',{...values,quantidade:'3'},id);
 assert.equal(saved.verificado,false);assert.equal(saved.verificadoPor,undefined);assert.equal(saved.verificadoEm,undefined);
 await assert.rejects(a.data.setTarget('NHPL',-1),/acesso/);
});
test('resolução e consolidação exigem conteúdo e período válido antes de mudar o estado',async()=>{
 const {a}=await fixture(),now=a.data.state.scenarioAt;
 await assert.rejects(a.data.resolveOccurrence('exemplo-occ-0',' '),/ação realizada/);
 assert.equal(a.data.state.ocorrencias.find(r=>r.id==='exemplo-occ-0').status,'aberta');
 await assert.rejects(a.data.consolidate({inicio:local(now),fim:local(now-60000),observacao:'Teste'}),/posterior/);
 const reports=a.data.state.consolidacoes.length;
 await a.data.consolidate({inicio:local(now-3600000),fim:local(now),observacao:'Teste'});
 assert.equal(a.data.state.consolidacoes.length,reports+1);
});

test('demonstração recusa produção duplicada e segunda parada aberta sem alterar os totais',async()=>{
 const {a}=await fixture('operador'),now=a.data.state.scenarioAt;
 const production={maquinaId:'NHPL',inicio:local(now-3600000),fim:local(now),turno:'1',quantidade:'5',produto:'Abafador',lote:'LT-REGRESSION'};
 const id=await a.data.save('registrosProducao',production),count=a.data.state.registrosProducao.length;
 await assert.rejects(a.data.save('registrosProducao',production),/já.*registrado/);assert.equal(a.data.state.registrosProducao.length,count);
 await a.data.save('registrosProducao',{...production,quantidade:'6'},id);
 const values={maquinaId:'NHPL',inicio:local(now),motivoCodigo:'ajuste',motivo:'Ajuste'};
 const stop=await a.data.save('paradas',values),stops=a.data.state.paradas.length;
 await assert.rejects(a.data.save('paradas',values),/parada.*andamento/);assert.equal(a.data.state.paradas.length,stops);
 await a.data.finishStop(stop,'Retomada');await a.data.save('paradas',values);assert.equal(a.data.state.paradas.length,stops+1);
});
