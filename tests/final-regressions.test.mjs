import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {applicableGoal} from '../dist/assets/nhpl-data.js';

function fixture(storage=new Map(),demo=true){
 const c=vm.createContext({Date,console,URLSearchParams,URL,crypto:webcrypto,location:{search:'?demonstracao=1&cargo=operador'},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},addEventListener(){},dispatchEvent(){},CustomEvent:class{},setTimeout,clearTimeout});c.window=c;
 for(const file of ['config','plant-layout','telemetry-service','rbac','shifts','photo-records','metrics','performance','capability-export','scenario-parameters','scenario-data','scenario-live','operations-service','production-workflows','shift-analysis','production-analysis',...(demo?['scenario-service']:[])])vm.runInContext(readFileSync('dist/assets/'+file+'.js','utf8'),c);
 return {a:c.MSA,storage};
}
const at=v=>+new Date('2026-10-08T'+v),start=at('00:00:00'),end=start+86400000;
const machine={id:'A',setorId:'selagem',produto:'Selo V-Gard',metaDiaria:800,hourTarget:100,idealCycleSeconds:36,parametros:{pressao:{nome:'Pressão',unidade:'bar',min:5,max:7}}};
const base=()=>({demo:true,scenarioAt:at('17:00:00'),maquinas:[{...machine}],registrosProducao:[],paradas:[],perdas:[],leituras:[],ocorrencias:[],perfis:[],lotesQualidade:[],atendimentosAlertas:[],passagensTurno:[],alocacoes:[]});
const production=(extra={})=>({id:'p',maquinaId:'A',setorId:'selagem',inicio:at('07:00:00'),fim:at('08:00:00'),lote:'L',produto:machine.produto,quantidade:90,turno:'1',...extra});
const photo=(m,time)=>({maquinaId:m,data:time,lote:'LT-FOTO-REGRESSAO',valores:{pressao:6.6},fotoProcesso:{parametro:'pressao',imagem:'data:image/jpeg;base64,YQ==',capturadaEm:Date.now()-86400000,metodo:'manual'}});

test('foto parcial restaurada/exportada conserva apenas a medição e remove estudo fictício legado',async()=>{
 const {a,storage}=fixture();await a.data.changeContext({maquinaId:'SEL-01'});await a.data.start(a.auth.session());
 const id=await a.data.save('leituras',photo('SEL-01',a.data.state.scenarioAt));
 const restored=fixture(storage).a,r=restored.data.state.leituras.find(r=>r.id===id);
 assert.equal(r.estudoSelo,undefined);assert.equal(Object.keys(r.valores).length,1);
 r.estudoSelo=a.capability.demoSample(machine,r.data);restored.capability.seedDemo(restored.data.state);assert.equal(r.estudoSelo,undefined);
 const item=restored.capability.build(restored.data.state,restored.data.state.maquinas,[r],[],[]).items[0];
 assert.equal(item.values.filter(v=>v!==null).length,1);assert.equal(item.values[39],6.6);assert.equal(item.material,'');assert.equal(item.thickness,null);
});

test('correção de foto na demonstração preserva data, turno, captura e autoria após recarregar',async()=>{
 const {a,storage}=fixture();await a.data.changeContext({maquinaId:'SEL-01'});await a.data.start(a.auth.session());
 const values=photo('SEL-01',a.data.state.scenarioAt-25*3600000),id=await a.data.save('leituras',values),before={...a.data.state.leituras.find(r=>r.id===id)};
 await a.data.save('leituras',{...values,data:a.data.state.scenarioAt,valores:{pressao:6.7},fotoProcesso:{...values.fotoProcesso,capturadaEm:Date.now()}},id);
 const after=fixture(storage).a.data.state.leituras.find(r=>r.id===id);
 for(const key of ['data','turno','createdAt','usuarioId','usuarioRe'])assert.equal(after[key],before[key],key);
 assert.equal(after.fotoProcesso.capturadaEm,before.fotoProcesso.capturadaEm);assert.equal(after.valores.pressao,6.7);
});

test('reinspeção conserva 100 peças: 90 aprovadas + 10 refugos passam a 80 + 20, em todos os painéis',()=>{
 const {a}=fixture(),s=base();s.registrosProducao=[production()];s.perdas=[{id:'r',maquinaId:'A',setorId:'selagem',data:at('07:30:00'),lote:'L',quantidade:10,tipo:'refugo',produto:machine.produto,motivo:'Defeito'}];
 a.workflows.syncLots(s);const batch=s.lotesQualidade[0],qa={id:'qa',re:'3',nome:'QA',status:'ativo',cargo:'qualidade'};
 for(const status of ['segregado','reinspecao','liberado'])a.workflows.command(s,'batch-transition',{status,observacao:'Reinspeção',inspecionadas:100,descartadas:20},batch.id,qa);
 const summary=a.metrics.summarize(s,[machine],start,end),perf=a.performance.calculate(s,[machine],start,end),shift=a.shiftAnalysis.analyze(s,[machine],start,end,'1'),analysis=a.productionAnalysis.build(a.productionAnalysis.select(s,[machine],{from:'2026-10-08',to:'2026-10-08',shift:'1'}));
 assert.equal(s.registrosProducao[0].quantidade,90);assert.equal(summary.aprovadas,80);assert.equal(summary.refugos,20);assert.equal(summary.taxaRefugo,20);
 assert.equal(perf.total,100);assert.equal(perf.good,80);assert.equal(perf.rejected,20);assert.equal(perf.efficiency.oee,80);
 assert.equal(shift.good,80);assert.equal(shift.rejected,20);assert.equal(analysis.approved,80);assert.equal(analysis.rejected,20);
 assert.equal(a.workflows.lotQuantity(s,'A','L').quantidade,100);assert.equal(batch.liberadas,80);
 const loss=s.perdas.find(r=>r.decisaoQualidade);assert.equal(loss.producaoId,'p');assert.equal(loss.data,s.registrosProducao[0].fim-1);assert.equal(loss.createdAt,s.scenarioAt);
 assert.equal(a.capability.build(s,[machine],[{id:'read',maquinaId:'A',data:at('07:30:00'),lote:'L',valores:{pressao:6.6}}],s.registrosProducao,s.perdas).items[0].scrap,20);
 assert.equal(a.metrics.summarize(a.shifts.filter(s,'1'),[machine],start,end).aprovadas,80);
 assert.throws(()=>a.workflows.command(s,'batch-transition',{status:'liberado',observacao:'Repetir',inspecionadas:100,descartadas:20},batch.id,qa),/Etapa inválida/);
 assert.equal(s.perdas.length,2);
});

test('refugo legado aloca FIFO sem descontar novamente ao filtrar e sem afetar outro lote',()=>{
 const {a}=fixture(),s=base();s.registrosProducao=[production({quantidade:5}),production({id:'p2',inicio:at('15:00:00'),fim:at('16:00:00'),quantidade:20,turno:'2'}),production({id:'p3',lote:'OUTRO',quantidade:40})];
 s.perdas=[{maquinaId:'A',lote:'L',tipo:'refugo',quantidade:10,decisaoQualidade:true,data:at('16:30:00')}];
 assert.deepEqual(Array.from(a.metrics.netProduction(s),r=>r.quantidade),[0,15,40]);
 const selected=a.shifts.filter(s,'1');assert.deepEqual(Array.from(a.metrics.netProduction(selected),r=>r.quantidade),[0,40]);
 assert.equal(s.registrosProducao[0].quantidade,5);
});

test('lotes simultâneos e parcialmente sobrepostos não duplicam tempo ou meta; soma horária conserva peças',()=>{
 const {a}=fixture(),s=base();s.registrosProducao=[production({quantidade:50}),production({id:'p2',lote:'B',quantidade:50})];
 let p=a.performance.calculate(s,[machine],start,end);assert.equal(p.planned,3600);assert.equal(p.target,100);assert.equal(p.productivity,100);assert.equal(p.efficiency.oee,100);
 assert.equal(a.performance.hourly(s,[machine],start,end)[0].target,100);
 s.registrosProducao[1]={...s.registrosProducao[1],inicio:at('07:30:00'),fim:at('08:30:00')};p=a.performance.calculate(s,[machine],start,end);
 const hours=a.performance.hourly(s,[machine],start,end);assert.equal(p.planned,5400);assert.equal(p.target,150);assert.equal(hours.reduce((n,r)=>n+r.target,0),150);assert.equal(hours.reduce((n,r)=>n+r.goodCount,0),100);assert.equal(hours[0].estimated,true);
 const shift=a.shiftAnalysis.analyze(s,[machine],start,end,'1');assert.equal(shift.hours.reduce((n,r)=>n+r.target,0),150);
});

test('produção duplicada com quantidade diferente é recusada; edição do mesmo registro permanece válida',()=>{
 const {a}=fixture(),s=base(),r=production();s.registrosProducao=[r];
 assert.throws(()=>a.recordValidation.uniqueRecord(s,'registrosProducao',{...r,quantidade:100}),/já está registrado/);
 assert.doesNotThrow(()=>a.recordValidation.uniqueRecord(s,'registrosProducao',{...r,quantidade:100},r.id));
 assert.doesNotThrow(()=>a.recordValidation.uniqueRecord(s,'registrosProducao',{...r,lote:'OUTRO'}));
});

test('validação recusa turno incompatível ou janela atravessando a troca, e aceita terceiro turno entre dias',()=>{
 const {a}=fixture();assert.throws(()=>a.shifts.validateProduction(at('15:00:00'),at('16:00:00'),'1'),/turno deve corresponder/);
 assert.throws(()=>a.shifts.validateProduction(at('14:00:00'),at('16:00:00'),'1'),/atravessa/);
 assert.doesNotThrow(()=>a.shifts.validateProduction(at('07:00:00'),at('15:00:00'),'1'));
 assert.doesNotThrow(()=>a.shifts.validateProduction(at('23:00:00'),end+7*3600000,'3'));
});

test('alteração de meta conserva turnos encerrados e integra mudanças durante o turno',()=>{
 const {a}=fixture(),s=base(),m={...machine,metaDiaria:1600,hourTarget:200,historicoMetas:a.shifts.targetHistory(machine,1600,at('16:00:00'))};s.registrosProducao=[production({fim:at('15:00:00'),quantidade:600})];
 assert.equal(a.shiftAnalysis.analyze(s,[m],start,end,'1').productivity,75);assert.equal(a.performance.calculate(s,[m],start,end).target,800);
 assert.equal(a.shifts.targetBetween(m,at('15:00:00'),at('17:00:00')),300);
 const mid={...m,historicoMetas:a.shifts.targetHistory(machine,1600,at('11:00:00'))};assert.equal(a.shifts.targetBetween(mid,at('07:00:00'),at('15:00:00')),1200);
 const zero={...mid,historicoMetas:a.shifts.targetHistory(mid,0,at('15:00:00'))};assert.equal(a.shifts.targetBetween(zero,at('15:00:00'),at('17:00:00')),0);
 s.demo=false;assert.equal(a.metrics.summarize(a.shifts.filter(s,'2'),[m],start,end).meta,1500);
});

test('meta editada no serviço persiste com histórico após recarregar e não altera o passado',async()=>{
 const {a,storage}=fixture();await a.data.start({...a.auth.session(),cargo:'chefe'});const m=a.data.state.maquinas.find(m=>m.id==='NHPL'),before=m.metaDiaria,now=a.data.state.scenarioAt;
 await a.data.setTarget('NHPL',before+800);const restored=fixture(storage).a.data.state.maquinas.find(m=>m.id==='NHPL');
 assert.equal(a.shifts.hourTarget(restored,now-1),before/8);assert.equal(a.shifts.hourTarget(restored,now),(before+800)/8);assert.equal(Object.keys(restored.historicoMetas).length,2);
 await a.data.setTarget('NHPL',before+800);assert.equal(Object.keys(m.historicoMetas).length,2);
});

test('supervisório resolve metas alteradas dentro do mesmo dia pelo instante exato',()=>{
 const sample={source:'demo-records',shift:'1º turno',order:'OP'},goals=[{id:'before',source:sample.source,validFrom:'2020-01-01',validTo:new Date(at('11:00:00')).toISOString()},{id:'after',source:sample.source,validFrom:new Date(at('11:00:00')).toISOString(),validTo:'2100-01-01'}];
 assert.equal(applicableGoal(goals,sample,new Date(at('10:00:00'))).id,'before');assert.equal(applicableGoal(goals,sample,new Date(at('11:00:00'))).id,'after');
});

test('parada na virada recebe dez minutos em cada turno em todos os cálculos, e mantém registro aberto',()=>{
 const {a}=fixture(),s=base();s.paradas=[{id:'cross',maquinaId:'A',inicio:at('14:50:00'),fim:at('15:10:00'),motivo:'Ajuste'}];
 for(const shift of ['1','2']){const scoped=a.shifts.filter(s,shift);assert.equal(a.performance.calculate(scoped,[machine],start,end).downtime,600);assert.equal(a.metrics.summarize(scoped,[machine],start,end).minutos,10);assert.equal(a.shiftAnalysis.analyze(s,[machine],start,end,shift).downtime,600);assert.equal(a.productionAnalysis.build(a.productionAnalysis.select(s,[machine],{from:'2026-10-08',to:'2026-10-08',shift})).minutes,10);}
 s.paradas[0].fim=0;assert.equal(a.shifts.filter(s,'2').paradas[0].fim,0);assert.equal(a.metrics.summarize(a.shifts.filter(s,'1'),[machine],start,end).minutos,10);
});

test('dia produtivo termina às 07h; parada noturna é dividida entre as datas sem duplicação',()=>{
 const {a}=fixture(),s=base();s.scenarioAt=end+9*3600000;s.paradas=[{maquinaId:'A',inicio:end+6*3600000+50*60000,fim:end+7*3600000+10*60000}];
 assert.equal(a.metrics.summarize(s,[machine],start,end).minutos,10);assert.equal(a.metrics.summarize(s,[machine],end,end+86400000).minutos,10);
});

test('passagem do primeiro turno encerra às 15h e ignora paradas posteriores',()=>{
 const {a}=fixture(),s=base();s.scenarioAt=at('16:00:00');s.registrosProducao=[production({fim:at('15:00:00'),quantidade:500})];s.paradas=[{maquinaId:'A',inicio:at('15:10:00'),fim:at('15:20:00')}];
 const h=a.workflows.handoverSummary(s,'A','2026-10-08','1');assert.equal(h.fim,at('15:00:00'));assert.equal(h.paradaSegundos,0);assert.equal(h.aprovadas,500);assert.equal(h.planejado,800);
});

// Adaptador em memória para verificar o serviço Firebase, separado da simulação.
async function realFixture(cargo='operador'){
 const {a}=fixture(new Map(),false),user={id:'u',re:'123',nome:'Teste',cargo,status:'ativo',setorId:'selagem',maquinaId:'A'},db={maquinas:{A:{...machine,createdAt:1}},perfis:{u:user}},listeners=[];
 const read=path=>path.split('/').filter(Boolean).reduce((r,k)=>r?.[k],db)??null,snapshot=path=>({val:()=>read(path),exists:()=>read(path)!==null});
 const write=(path,values)=>{let p=db;const keys=path.split('/');for(const k of keys.slice(0,-1))p=p[k]||={};p[keys.at(-1)]=values;for(const [r,fn]of listeners)fn(snapshot(r.path));};
 const sdk={ref:(_,path)=>({path,key:path.split('/').at(-1)}),query:r=>r,orderByChild:v=>v,equalTo:v=>v,serverTimestamp:()=>Date.now(),get:async r=>snapshot(r.path),onValue:(r,fn)=>{if(r.path==='.info/connected')fn({val:()=>true});else{listeners.push([r,fn]);fn(snapshot(r.path));}return()=>{};},set:async(r,v)=>write(r.path,v),update:async(r,v)=>write(r.path,{...read(r.path),...v}),runTransaction:async(r,fn)=>{const v=fn(read(r.path));if(v===undefined)return {committed:false};write(r.path,v);return {committed:true};}};
 a.firebase={ready:async()=>({database:{},databaseSDK:sdk})};await a.data.start(user);return {a,db};
}

test('serviço Firebase também conserva horário da foto e grava histórico da meta',async()=>{
 const {a}=await realFixture(),values=photo('A',Date.now()-25*3600000),id=await a.data.save('leituras',values),before=a.data.state.leituras.find(r=>r.id===id);
 await a.data.save('leituras',{...values,data:Date.now(),valores:{pressao:6.7}},id);const after=a.data.state.leituras.find(r=>r.id===id);
 assert.equal(after.data,before.data);assert.equal(after.turno,before.turno);assert.equal(after.createdAt,before.createdAt);assert.equal(after.valores.pressao,6.7);
 const chief=await realFixture('chefe');await chief.a.data.setTarget('A',1600);const m=chief.a.data.state.maquinas[0];assert.equal(m.metaDiaria,1600);assert.equal(chief.a.shifts.hourTarget(m,1),100);assert.equal(Object.keys(m.historicoMetas).length,2);
 const op=await realFixture();await assert.rejects(op.a.data.save('registrosProducao',{...production(),inicio:at('15:00:00'),fim:at('16:00:00')}),/turno deve corresponder/);
});

class Snapshot{
 constructor(tree,path=[]){this.tree=tree;this.path=path;}
 val(){return this.path.reduce((r,k)=>r?.[k],this.tree)??null;}
 child(key){return new Snapshot(this.tree,[...this.path,...key.split('/')]);}
 parent(){return new Snapshot(this.tree,this.path.slice(0,-1));}
 exists(){return this.val()!==null;}
 hasChildren(keys){return keys.every(k=>this.child(k).exists());}
 isNumber(){return typeof this.val()==='number'&&Number.isFinite(this.val());}
 isString(){return typeof this.val()==='string';}
}
const rules=JSON.parse(readFileSync('database.rules.json','utf8')).rules;
const evaluate=(expression,tree,next,path,uid)=>vm.runInNewContext(expression,{auth:{uid},root:new Snapshot(tree),data:new Snapshot(tree,path.split('/')),newData:new Snapshot(next,path.split('/')),now:Date.now()});

test('expressões das regras permitem histórico ao chefe/supervisor do setor e recusam mudança de versão existente',()=>{
 const tree={maquinas:{A:{setorId:'selagem',historicoMetas:{base:{inicio:0,metaDiaria:800}}}},perfis:{chief:{status:'ativo',cargo:'chefe'},sup:{status:'ativo',cargo:'supervisor',setorId:'selagem'},other:{status:'ativo',cargo:'supervisor',setorId:'montagem'},op:{status:'ativo',cargo:'operador',setorId:'selagem'}}},path='maquinas/A/historicoMetas',r=rules.maquinas.$id.historicoMetas;
 for(const uid of ['chief','sup'])assert.equal(evaluate(r['.write'],tree,tree,path,uid),true);
 for(const uid of ['op','other'])assert.equal(evaluate(r['.write'],tree,tree,path,uid),false);
 assert.equal(evaluate(r.$version['.validate'],tree,tree,path+'/base','chief'),true);
 const next=structuredClone(tree);next.maquinas.A.historicoMetas.base.metaDiaria=1600;assert.equal(evaluate(r.$version['.validate'],tree,next,path+'/base','chief'),false);
 next.maquinas.A.historicoMetas.v1={inicio:Date.now(),metaDiaria:1600};assert.equal(evaluate(r.$version['.validate'],tree,next,path+'/v1','chief'),true);
});

test('regra do vínculo de refugo recusa produção de outro lote ou máquina',()=>{
 const tree={registrosProducao:{p:{maquinaId:'A',lote:'L'}},perdas:{r:{maquinaId:'A',lote:'L',decisaoQualidade:true,producaoId:'p'}}},path='perdas/r/producaoId',expr=rules.perdas.$id.producaoId['.validate'];
 assert.equal(evaluate(expr,tree,tree,path,'qa'),true);
 for(const patch of [{lote:'OUTRO'},{maquinaId:'B'},{decisaoQualidade:false},{producaoId:'inexistente'}]){const next=structuredClone(tree);Object.assign(next.perdas.r,patch);assert.equal(evaluate(expr,tree,next,path,'qa'),false);}
});
