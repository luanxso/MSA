/* Comparação por janela de turno; intervalos físicos dividem paradas na virada. */
window.MSA=window.MSA||{};
(() => {
 'use strict';
 const sum=(rows,key)=>rows.reduce((n,r)=>n+Number(r[key]||0),0);
 const rate=m=>MSA.shifts.hourTarget(m);
 const dateKey=at=>{const d=new Date(at);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
 function analyze(state,machines,start,end,shift){
  const ids=new Set(machines.map(m=>m.id)),now=state.scenarioAt||Date.now(),rows=key=>(state[key]||[]).filter(r=>ids.has(r.maquinaId));
  const inPeriod=r=>MSA.shifts.id(r)===String(shift)&&MSA.shifts.within({...r,turno:MSA.shifts.id(r)},start,end);
  const production=rows('registrosProducao').filter(inPeriod),losses=rows('perdas').filter(inPeriod),allStops=rows('paradas'),allReadings=rows('leituras').filter(inPeriod);
  const windows=[];for(let d=new Date(start);+d<end;d.setDate(d.getDate()+1)){
   const day=dateKey(+d),a=new Date(day+'T00:00:00');a.setHours(7+(Number(shift)-1)*8,0,0,0);const b=new Date(a);b.setHours(b.getHours()+8);
   const observed=Math.max(+a,Math.min(+b,now));
   windows.push({day,start:+a,end:+b,observed,elapsed:Math.max(0,(observed-a)/1000),status:now<+a?'future':now<+b?'running':'closed',extension:false});
  }
  const observedRows=production.filter(r=>r.inicio<now),observedLosses=losses.filter(r=>(r.data||r.createdAt)<=now),machineRows=[],hours=new Map(),stopRows=[],reasons=new Map();
  for(const m of machines){const own=observedRows.filter(r=>r.maquinaId===m.id),rejected=sum(observedLosses.filter(r=>r.maquinaId===m.id&&r.tipo==='refugo'),'quantidade'),good=sum(own,'quantidade'),total=good+rejected;
   let planned=0,downtime=0,microSeconds=0,microCount=0;
   for(const w of windows){planned+=w.elapsed;const stops=allStops.filter(r=>r.maquinaId===m.id&&r.inicio<w.observed&&(r.fim||now)>w.start);downtime+=MSA.metrics.minutes(stops,w.start,w.observed,now)*60;
    const micros=stops.filter(r=>r.fim&&r.fim-r.inicio>0&&r.fim-r.inicio<60000);microSeconds+=MSA.metrics.minutes(micros,w.start,w.observed,now)*60;microCount+=micros.filter(r=>r.inicio>=w.start&&r.inicio<w.observed).length;
    for(const r of stops){const seconds=Math.max(0,(Math.min(r.fim||now,w.observed)-Math.max(r.inicio,w.start))/1000);stopRows.push({...r,day:w.day,seconds});reasons.set(r.motivo||'Sem classificação',(reasons.get(r.motivo||'Sem classificação')||0)+seconds);}
   }
   const run=Math.max(0,planned-downtime),target=rate(m)>0?planned/3600*rate(m):null,fullTarget=rate(m)>0?windows.length*8*rate(m):null,quality=total?good/total*100:null,ideal=Number(m.idealCycleSeconds||0),performance=run&&ideal?total*ideal/run*100:null;
   const oee=own.length&&planned&&run&&ideal>0&&performance<=100.01?good*ideal/planned*100:null;
   machineRows.push({machine:m,good,rejected,total,planned,downtime,run,target,fullTarget,productivity:target?good/target*100:null,quality,rejectRate:total?rejected/total*100:null,oee,microCount,microSeconds,production:own});
  }
  for(const r of observedRows){const m=machines.find(m=>m.id===r.maquinaId),at=r.inicio,h=hours.get(at)||{at,good:0,target:0,unknownTarget:false};h.good+=Number(r.quantidade||0);if(rate(m)>0)h.target+=Math.max(0,(Math.min(r.fim,now)-r.inicio))/3600000*rate(m);else h.unknownTarget=true;hours.set(at,h);}
  const good=sum(machineRows,'good'),rejected=sum(machineRows,'rejected'),total=good+rejected,planned=sum(machineRows,'planned'),target=machineRows.length&&machineRows.every(m=>m.target!=null)?sum(machineRows,'target'):null;
  const oee=machineRows.length&&planned&&machineRows.every(m=>m.oee!=null)?machineRows.reduce((n,m)=>n+m.oee*m.planned,0)/planned:null;
  const issues=rows('ocorrencias').filter(inPeriod),alerts=(state.atendimentosAlertas||[]).filter(r=>ids.has(r.maquinaId)&&windows.some(w=>r.createdAt>=w.start&&r.createdAt<w.observed));
  const team=[];for(const w of windows){
   const allocations=(state.alocacoes||[]).filter(a=>a.dia===w.day&&String(a.turno)===String(shift)&&(ids.has(a.maquinaId)||(!a.maquinaId&&ids.has((state.perfis||[]).find(p=>p.id===a.funcionarioId)?.maquinaId))));
   for(const a of allocations)team.push({day:w.day,id:a.funcionarioId,re:a.funcionarioRe,name:(state.perfis||[]).find(p=>p.id===a.funcionarioId)?.nome||'Funcionário',machineId:a.maquinaId,presence:a.presenca,source:'Confirmado pela liderança'});
   const known=new Set(allocations.map(a=>a.funcionarioId));for(const r of observedRows.filter(r=>MSA.shifts.within({...r,turno:MSA.shifts.id(r)},+new Date(w.day+'T00:00:00'),+new Date(w.day+'T00:00:00')+86400000))){if(!r.usuarioId||known.has(r.usuarioId))continue;known.add(r.usuarioId);team.push({day:w.day,id:r.usuarioId,re:r.usuarioRe,name:(state.perfis||[]).find(p=>p.id===r.usuarioId)?.nome||'RE do apontamento',machineId:r.maquinaId,presence:'sem-confirmacao',source:'RE nos apontamentos; presença não confirmada'});}
  }
  const closed=windows.filter(w=>w.status==='closed').length,running=windows.filter(w=>w.status==='running').length,future=windows.filter(w=>w.status==='future').length;
  return {shift:String(shift),windows,closed,running,future,extension:windows.some(w=>w.extension),good,rejected,total,target,fullTarget:machineRows.length&&machineRows.every(m=>m.fullTarget!=null)?sum(machineRows,'fullTarget'):null,planned,downtime:sum(machineRows,'downtime'),microCount:sum(machineRows,'microCount'),microSeconds:sum(machineRows,'microSeconds'),material:sum(observedLosses.filter(r=>r.tipo==='perda'),'quantidade'),productivity:target?good/target*100:null,rejectRate:total?rejected/total*100:null,oee,hasData:observedRows.length>0,machines:machineRows,hours:[...hours.values()].sort((a,b)=>b.at-a.at),stops:stopRows.sort((a,b)=>b.inicio-a.inicio),reasons:[...reasons].sort((a,b)=>b[1]-a[1]),team,issues,alerts,readings:allReadings.filter(r=>r.data<=now),production:observedRows};
 }
 MSA.shiftAnalysis={analyze};
})();
