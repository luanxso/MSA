import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function setup(){const c=vm.createContext({Date});c.window=c;for(const n of ['config','rbac','shifts','metrics','production-analysis'])vm.runInContext(readFileSync(new URL('../dist/assets/'+n+'.js',import.meta.url),'utf8'),c);return c.MSA;}
const at=s=>+new Date('2026-10-08T'+s),machine={id:'A',setorId:'selagem',parametros:{pressao:{nome:'Pressão',min:6,max:7,unidade:'bar'}}};
const base=()=>({scenarioAt:at('15:00:00'),maquinas:[machine],registrosProducao:[],perdas:[],leituras:[],paradas:[],ocorrencias:[]});
const filters={from:'2026-10-08',to:'2026-10-08'};
const plain=v=>JSON.parse(JSON.stringify(v));
test('analysis sums existing scoped records and preserves missing hours as gaps',()=>{
 const M=setup(),s=base();s.registrosProducao=[{maquinaId:'A',inicio:at('08:00:00'),fim:at('09:00:00'),quantidade:20,lote:'L'},{maquinaId:'B',inicio:at('08:00:00'),fim:at('09:00:00'),quantidade:999,lote:'L'}];s.perdas=[{maquinaId:'A',data:at('08:30:00'),tipo:'refugo',quantidade:2,lote:'L'},{maquinaId:'A',data:at('08:30:00'),tipo:'perda',quantidade:50,lote:'L'}];
 const model=M.productionAnalysis.build(M.productionAnalysis.select(s,[machine],filters));assert.equal(model.approved,20);assert.equal(model.rejected,2);assert.equal(model.bins.reduce((n,b)=>n+b.approved,0),20);assert.equal(model.bins[0].records,0);assert.equal(model.bins[1].approved,20);
});
test('third shift after midnight belongs to the preceding production day',()=>{
 const M=setup(),s=base();s.registrosProducao=[{maquinaId:'A',turno:'3',inicio:+new Date('2026-10-09T00:00:00'),fim:+new Date('2026-10-09T01:00:00'),quantidade:30}];
 const model=M.productionAnalysis.build(M.productionAnalysis.select(s,[machine],filters));assert.equal(model.approved,30);assert.equal(model.bins[17].approved,30);
 const next=M.productionAnalysis.build(M.productionAnalysis.select(s,[machine],{from:'2026-10-09',to:'2026-10-09'}));assert.equal(next.approved,0);
});
test('overlapping stops counted once; open stops capped at the scenario time',()=>{
 const M=setup(),s=base();s.paradas=[{maquinaId:'A',inicio:at('08:00:00'),fim:at('09:00:00'),motivo:'Falha'},{maquinaId:'A',inicio:at('08:30:00'),fim:at('09:30:00'),motivo:'Falha'},{maquinaId:'A',inicio:at('14:30:00'),motivo:'Setup'}];
 const model=M.productionAnalysis.build(M.productionAnalysis.select(s,[machine],filters));assert.equal(model.minutes,120);assert.equal(model.stops.find(x=>x.label==='Falha').minutes,90);assert.equal(model.stops.find(x=>x.label==='Setup').minutes,30);
});
test('batch and shift filters apply to every collection without modifying source state',()=>{
 const M=setup(),s=base();s.leituras=[{maquinaId:'A',data:at('10:00:00'),turno:'1',lote:'L',valores:{pressao:8}},{maquinaId:'A',data:at('10:00:00'),turno:'1',lote:'X',valores:{pressao:9}}];const before=plain(s);
 const model=M.productionAnalysis.build(M.productionAnalysis.select(s,[machine],{...filters,lot:'L',shift:'1'}));assert.equal(model.deviations.length,1);assert.equal(model.deviations[0].value,8);assert.equal(M.productionAnalysis.build(M.productionAnalysis.select(s,[machine],{...filters,shift:'2'})).deviations.length,0);assert.deepEqual(s,before);
});
test('evidence matches machine, known batch and time, with unlabelled stops as equipment context',()=>{
 const M=setup(),s=base();s.leituras=[{id:'d',maquinaId:'A',data:at('10:00:00'),lote:'L',origem:'foto',valores:{pressao:8}}];s.registrosProducao=[{id:'ok',maquinaId:'A',inicio:at('09:00:00'),fim:at('10:00:00'),lote:'L'},{id:'other-lot',maquinaId:'A',inicio:at('09:00:00'),fim:at('10:00:00'),lote:'X'},{id:'no-lot',maquinaId:'A',inicio:at('09:00:00'),fim:at('10:00:00')},{id:'too-far',maquinaId:'A',inicio:at('07:00:00'),fim:at('08:00:00'),lote:'L'}];s.paradas=[{maquinaId:'A',inicio:at('09:50:00'),fim:at('10:05:00')}];
 const data=M.productionAnalysis.select(s,[machine],filters),d=M.productionAnalysis.build(data).deviations[0],e=M.productionAnalysis.evidence(data,d);assert.deepEqual(plain(e.production.map(r=>r.id)),['ok']);assert.equal(e.stops.length,1);assert.equal(M.productionAnalysis.origin(d.record),'Registro por foto');
});
test('photo partial values remain partial and boundaries are not deviations',()=>{
 const M=setup(),s=base();s.leituras=[{id:'one',maquinaId:'A',data:at('10:00:00'),valores:{pressao:6}},{id:'two',maquinaId:'A',data:at('11:00:00'),valores:{pressao:7}},{id:'three',maquinaId:'A',data:at('12:00:00'),origem:'foto',valores:{pressao:5}}];const model=M.productionAnalysis.build(M.productionAnalysis.select(s,[machine],filters));assert.equal(model.deviations.length,1);assert.equal(model.deviations[0].key,'pressao');
});
test('analysis route is available to supervision, management and quality, with existing scopes',()=>{
 const M=setup();for(const cargo of ['supervisor','chefe','qualidade'])assert(M.rbac.route('analise-producao',{cargo,status:'ativo'}));assert.equal(M.rbac.route('analise-producao',{cargo:'operador',status:'ativo'}),false);assert.equal(M.rbac.inScope({cargo:'supervisor',status:'ativo',setorId:'montagem'},machine),false);
});
test('comparison changes from sectors to machines to shifts and preserves scoped totals',()=>{
 const M=setup(),s=base(),b={id:'B',setorId:'selagem'},c={id:'C',setorId:'injecao'};
 s.registrosProducao=[{maquinaId:'A',inicio:at('08:00:00'),fim:at('09:00:00'),turno:'1',quantidade:20},{maquinaId:'B',inicio:at('08:00:00'),fim:at('09:00:00'),turno:'1',quantidade:30},{maquinaId:'C',inicio:at('08:00:00'),fim:at('09:00:00'),turno:'1',quantidade:40}];
 s.perdas=[{maquinaId:'A',data:at('08:30:00'),turno:'1',tipo:'refugo',quantidade:5}];
 const all=M.productionAnalysis.compare(M.productionAnalysis.select(s,[machine,b,c],filters),{selagem:'Selagem',injecao:'Injeção'});assert.equal(all.kind,'setor');assert.equal(all.groups.find(g=>g.id==='selagem').approved,50);assert.equal(all.groups.reduce((n,g)=>n+g.approved,0),90);
 const sector=M.productionAnalysis.compare(M.productionAnalysis.select(s,[machine,b],filters));assert.equal(sector.kind,'maquina');assert.deepEqual(plain(sector.groups.map(g=>g.id)),['B','A']);assert.equal(sector.groups.reduce((n,g)=>n+g.approved,0),50);
 const one=M.productionAnalysis.compare(M.productionAnalysis.select(s,[machine],filters));assert.equal(one.kind,'turno');assert.equal(one.groups[0].approved,20);assert.equal(one.groups[0].rejected,5);assert.equal(one.groups[1].partial,true);assert.equal(one.groups[2].records,0);
});
test('reject rate uses approved plus rejected pieces; absent production stays undefined',()=>{
 const M=setup(),s=base();s.registrosProducao=[{maquinaId:'A',inicio:at('08:00:00'),fim:at('09:00:00'),quantidade:75}];s.perdas=[{maquinaId:'A',data:at('08:30:00'),tipo:'refugo',quantidade:25},{maquinaId:'A',data:at('08:30:00'),tipo:'perda',quantidade:999}];
 const model=M.productionAnalysis.build(M.productionAnalysis.select(s,[machine],filters));assert.equal(model.bins[1].rejectRate,25);assert.equal(model.bins[0].rejectRate,null);assert.equal(model.bins[8].partial,true);
});
