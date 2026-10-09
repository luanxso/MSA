/* Análise derivada dos registros existentes, sem gerar leituras ou inferir causas. */
window.MSA=window.MSA||{};
(() => {
 'use strict';
 const stamp=r=>Number(r.fim?r.fim-1:r.data||r.inicio||r.createdAt);
 const dateKey=at=>{const d=new Date(at);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
 const logicalDay=r=>r.diaProducao||MSA.shifts.context(stamp(r)).diaProducao;
 const quantity=r=>Number.isFinite(Number(r.quantidade))?Math.max(0,Number(r.quantidade)):0;
 const origin=r=>r.origem==='foto'?(r.fotoProcesso?.exemplo?'Foto de exemplo (demonstração)':'Registro por foto'):r.simulacaoParametros?'Simulação':'Apontamento';
 function select(state,machines,{from,to,shift='todos',lot=''}={}) {
  const a=new Date(from+'T00:00:00').getTime(),end=new Date(to+'T00:00:00');end.setDate(end.getDate()+1);const b=+end;
  const ids=new Set(machines.map(m=>m.id));
  const match=r=>ids.has(r.maquinaId)&&(shift==='todos'||MSA.shifts.id(r)===shift)&&(!lot||String(r.lote||'')===lot);
  const start=new Date(from+'T07:00:00').getTime(),finish=new Date(b).setHours(7,0,0,0),now=state.scenarioAt||Date.now();
  const result={machines,from,to,start,finish,now,lot,shift};
  for(const key of ['registrosProducao','perdas','leituras','paradas','ocorrencias']) {
   const source=key==='registrosProducao'?MSA.metrics.netProduction(state):key==='paradas'?MSA.shifts.clipStops(state.paradas||[],a,b,shift,now):state[key]||[];
   result[key]=source.filter(r=>(key==='paradas'?ids.has(r.maquinaId)&&(!lot||String(r.lote||'')===lot):match(r))&&(key==='paradas'?r.inicio<Math.min(finish,now)&&r.fim>start:MSA.shifts.within(r,a,b)));
  }
  return result;
 }
 function build(data) {
  const hourly=data.from===data.to,bins=[],index=new Map(),current=MSA.shifts.context(data.now);
  if(hourly)for(let n=0;n<24;n++){const hour=(n+7)%24,partial=data.from===current.diaProducao&&hour===new Date(data.now).getHours();const label=String(hour).padStart(2,'0')+'h'+(n>=17?' (+1)':'')+(partial?' · parcial':'');index.set(hour,n);bins.push({label,hour,partial,approved:0,rejected:0,records:0});}
  else {const d=new Date(data.from+'T12:00:00'),last=new Date(data.to+'T12:00:00'),current=MSA.shifts.context(data.now).diaProducao;for(;d<=last;d.setDate(d.getDate()+1)){const key=dateKey(d);index.set(key,bins.length);bins.push({label:d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+(key===current?' · parcial':''),approved:0,rejected:0,records:0});}}
  for(const [rows,key] of [[data.registrosProducao,'approved'],[data.perdas.filter(r=>r.tipo==='refugo'),'rejected']])for(const r of rows){const i=index.get(hourly?new Date(stamp(r)).getHours():logicalDay(r));if(i!==undefined){bins[i][key]+=quantity(r);bins[i].records++;}}
  for(const bin of bins)bin.rejectRate=bin.approved+bin.rejected>0?bin.rejected/(bin.approved+bin.rejected)*100:null;
  const reasons=new Map();for(const r of data.paradas){const reason=r.motivo||'Sem motivo';if(!reasons.has(reason))reasons.set(reason,[]);reasons.get(reason).push(r);}
  const stops=[...reasons].map(([label,rows])=>({label,minutes:MSA.metrics.minutes(rows,data.start,data.finish,data.now),count:rows.length})).sort((a,b)=>b.minutes-a.minutes);
  const deviations=[];
  for(const r of data.leituras)for(const [key,value] of Object.entries(r.valores||{})){const machine=data.machines.find(m=>m.id===r.maquinaId),parameter=machine?.parametros?.[key];if(parameter&&Number.isFinite(value)&&Number.isFinite(parameter.min)&&Number.isFinite(parameter.max)&&(value<parameter.min||value>parameter.max))deviations.push({record:r,key,value,machine,parameter});}
  deviations.sort((a,b)=>b.record.data-a.record.data);
  const latest=Math.max(0,...['registrosProducao','perdas','leituras','paradas','ocorrencias'].flatMap(k=>data[k].map(r=>r.data||r.fim||r.inicio||r.createdAt||0)));
  return {bins,hourly,stops,deviations,approved:data.registrosProducao.reduce((n,r)=>n+quantity(r),0),rejected:data.perdas.filter(r=>r.tipo==='refugo').reduce((n,r)=>n+quantity(r),0),minutes:MSA.metrics.minutes(data.paradas,data.start,data.finish,data.now),latest};
 }
 function compare(data,sectorNames={}) {
  const sectors=new Set(data.machines.map(m=>m.setorId));
  const kind=data.machines.length===1?'turno':sectors.size>1?'setor':'maquina';
  const groups=kind==='turno'?MSA.shifts.definitions.filter(t=>data.shift==='todos'||t.id===data.shift).map(t=>({id:t.id,label:t.label,kind})):
   kind==='setor'?[...sectors].map(id=>({id,label:sectorNames[id]||id,kind})):data.machines.map(m=>({id:m.id,label:m.id,name:m.nome,kind}));
  const byId=new Map(groups.map(g=>[g.id,Object.assign(g,{approved:0,rejected:0,records:0})]));
  for(const [rows,key] of [[data.registrosProducao,'approved'],[data.perdas.filter(r=>r.tipo==='refugo'),'rejected']])for(const r of rows){const id=kind==='turno'?MSA.shifts.id(r):kind==='setor'?data.machines.find(m=>m.id===r.maquinaId)?.setorId:r.maquinaId,g=byId.get(id);if(g){g[key]+=quantity(r);g.records++;}}
  const current=MSA.shifts.context(data.now),inProgress=data.from<=current.diaProducao&&data.to>=current.diaProducao;
  for(const g of groups){g.rejectRate=g.approved+g.rejected>0?g.rejected/(g.approved+g.rejected)*100:null;g.partial=kind==='turno'&&inProgress&&g.id===current.turno;if(g.partial)g.label+=' · parcial';}
  if(kind!=='turno')groups.sort((a,b)=>b.approved-a.approved||a.label.localeCompare(b.label,'pt-BR'));
  return {kind,groups};
 }
 function evidence(data,deviation,windowMinutes=30) {
  const at=deviation.record.data,a=at-windowMinutes*60000,b=at+windowMinutes*60000;
  const lot=deviation.record.lote;
  const sameMachine=r=>r.maquinaId===deviation.record.maquinaId;
  const overlap=r=>Number(r.inicio||r.data||r.createdAt)<=b&&Number(r.fim||r.data||data.now)>=a;
  // Batch-specific records must have the same batch; unlabelled stops and
  // occurrences are shown separately as equipment context, never batch evidence.
  const sameLot=r=>!lot||r.lote===lot;
  return {start:a,end:b,production:data.registrosProducao.filter(r=>sameMachine(r)&&sameLot(r)&&overlap(r)),losses:data.perdas.filter(r=>sameMachine(r)&&sameLot(r)&&overlap(r)),stops:data.paradas.filter(r=>sameMachine(r)&&(!r.lote||sameLot(r))&&overlap(r)),occurrences:data.ocorrencias.filter(r=>sameMachine(r)&&(!r.lote||sameLot(r))&&overlap(r))};
 }
 MSA.productionAnalysis={select,build,compare,evidence,stamp,origin};
})();
