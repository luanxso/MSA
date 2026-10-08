import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function app(){const s={Date,console};s.window=s;vm.createContext(s);for(const f of ['config','plant-layout','shifts','metrics','performance','scenario-data','shift-analysis'])vm.runInContext(readFileSync('dist/assets/'+f+'.js','utf8'),s);return s.MSA;}
const at=s=>+new Date('2026-10-06T'+s),start=at('00:00:00'),end=+new Date('2026-10-07T00:00:00');
const machine={id:'A',hourTarget:100,idealCycleSeconds:36};
function state(extra={}){return {scenarioAt:+new Date('2026-10-07T15:00:00'),registrosProducao:[],perdas:[],paradas:[],perfis:[],...extra};}
test('três turnos têm alvos iguais, volumes independentes e taxas calculadas',()=>{
 const a=app(),s=state({registrosProducao:[1,2,3].map((turno,i)=>({maquinaId:'A',turno:String(turno),diaProducao:'2026-10-06',inicio:at(`${String(7+8*i).padStart(2,'0')}:00:00`),fim:at(`${String(7+8*i).padStart(2,'0')}:00:00`)+8*3600000,quantidade:600-i*100})),perdas:[{maquinaId:'A',turno:'1',data:at('12:00:00'),tipo:'refugo',quantidade:20}]});
 const x=[1,2,3].map(t=>a.shiftAnalysis.analyze(s,[machine],start,end,t));
 assert.deepEqual(x.map(r=>r.good),[600,500,400]);for(const r of x){assert.equal(r.target,800);assert.equal(r.closed,1);assert.equal(r.planned,28800);}
 assert.equal(x[0].oee,75);assert.equal(x[0].productivity,75);assert.equal(x[0].rejectRate,20/620*100);
});
test('turno em andamento usa tempo transcorrido e futuro não inventa indicadores',()=>{
 const a=app(),s=state({scenarioAt:at('11:00:00'),registrosProducao:[{maquinaId:'A',inicio:at('07:00:00'),fim:at('11:00:00'),quantidade:300}]});
 const x=a.shiftAnalysis.analyze(s,[machine],start,end,1);assert.equal(x.target,400);assert.equal(x.running,1);assert.equal(x.oee,75);
 const y=a.shiftAnalysis.analyze(s,[machine],start,end,2);assert.equal(y.future,1);assert.equal(y.target,0);assert.equal(y.oee,null);assert.equal(y.rejectRate,null);assert.equal(y.hasData,false);
});
test('terceiro turno inferido após meia-noite pertence à data em que começou',()=>{
 const a=app(),s=state({registrosProducao:[{maquinaId:'A',inicio:end+3600000,fim:end+7200000,quantidade:80,usuarioId:'u',usuarioRe:'42'}],perdas:[{maquinaId:'A',data:end+5400000,tipo:'refugo',quantidade:2}]});
 const x=a.shiftAnalysis.analyze(s,[machine],start,end,3);assert.equal(x.good,80);assert.equal(x.rejected,2);assert.equal(x.team[0].day,'2026-10-06');
 assert.equal(a.shiftAnalysis.analyze(s,[machine],end,end+86400000,3).good,0);
});
test('parada atravessando a virada é repartida e sobreposições não duplicam o total',()=>{
 const a=app(),s=state({paradas:[{maquinaId:'A',inicio:at('14:50:00'),fim:at('15:10:00'),motivo:'Falha'},{maquinaId:'A',inicio:at('14:55:00'),fim:at('15:05:00'),motivo:'Outra'},{maquinaId:'A',inicio:at('10:00:00'),fim:at('10:00:20'),motivo:'Micro'}]});
 const x=a.shiftAnalysis.analyze(s,[machine],start,end,1),y=a.shiftAnalysis.analyze(s,[machine],start,end,2);
 assert.equal(x.downtime,620);assert.equal(y.downtime,600);assert.equal(x.microCount,1);assert.equal(x.microSeconds,20);assert.equal(y.microCount,0);assert.equal(x.stops.find(r=>r.motivo==='Falha').seconds,600);
});
test('filtros de máquina e data e base incompleta preservam a ausência de dados',()=>{
 const a=app(),s=state({registrosProducao:[{maquinaId:'B',inicio:at('07:00:00'),fim:at('15:00:00'),quantidade:400}]});
 assert.equal(a.shiftAnalysis.analyze(s,[machine],start,end,1).good,0);
 const x=a.shiftAnalysis.analyze(s,[{id:'B'}],start,end,1);assert.equal(x.target,null);assert.equal(x.oee,null);
 assert.equal(a.shiftAnalysis.analyze(s,[{id:'B'}],end,end+86400000,1).good,0);
});
test('alocação confirma presença; RE histórico não vira presença confirmada',()=>{
 const a=app(),s=state({registrosProducao:[{maquinaId:'A',turno:'1',inicio:at('07:00:00'),fim:at('15:00:00'),quantidade:400,usuarioId:'u',usuarioRe:'42'}],perfis:[{id:'u',nome:'Ana',maquinaId:'A'}]});
 let x=a.shiftAnalysis.analyze(s,[machine],start,end,1);assert.equal(x.team[0].presence,'sem-confirmacao');
 s.alocacoes=[{dia:'2026-10-06',turno:'1',maquinaId:'A',funcionarioId:'u',funcionarioRe:'42',presenca:'presente'}];x=a.shiftAnalysis.analyze(s,[machine],start,end,1);assert.equal(x.team.length,1);assert.equal(x.team[0].presence,'presente');
});
test('cenário conserva volumes históricos e encerra primeiro turno no horário previsto',()=>{
 const a=app(),s=a.createScenario(+new Date('2026-10-07T15:00:00'));
 for(const t of ['1','2','3']){const x=a.shiftAnalysis.analyze(s,s.maquinas,start,end,t),rows=s.registrosProducao.filter(r=>r.turno===t&&r.diaProducao==='2026-10-06');assert.equal(x.good,rows.reduce((n,r)=>n+r.quantidade,0));assert(x.oee>0&&x.oee<=100);assert.equal(x.machines.length,32);assert(x.team.every(r=>r.presence==='sem-confirmacao'));}
 s.scenarioAt+=60000;s.registrosProducao.push({maquinaId:s.maquinas[0].id,turno:'1',diaProducao:'2026-10-07',inicio:s.scenarioAt-30000,fim:s.scenarioAt,quantidade:1});const x=a.shiftAnalysis.analyze(s,[s.maquinas[0]],end,end+86400000,1);assert.equal(x.extension,false);assert.equal(x.planned,28800);
});
