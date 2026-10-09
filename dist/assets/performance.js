/* Cálculos comuns aos painéis e à planta. Tempos em segundos; contagem em peças. */
window.MSA = window.MSA || {};
(() => {
  const sum = (rows, key) => rows.reduce((n,r)=>n+Number(r[key]||0),0);
  function calculate(state, machines, start, end) {
    const ids = new Set(machines.map(m=>m.id));
    const now = state.scenarioAt || Date.now();
    let periodEnd=state.demo?new Date(end).setHours(7,0,0,0):end;
    const production=MSA.metrics.netProduction(state).filter(r=>ids.has(r.maquinaId)&&((r.diaProducao||MSA.shifts.id(r)==='3')?MSA.shifts.within(r,start,end):r.inicio>=start&&r.fim<=end));
    if(production.some(r=>MSA.shifts.id(r)==='3'))periodEnd=new Date(end).setHours(7,0,0,0);
    const sourceStops=(state.paradas||[]).filter(r=>ids.has(r.maquinaId)),stops=MSA.shifts.clipStops(sourceStops,start,end,state.selectedShift,now);
    const good=sum(production,'quantidade');
    const rejects=(state.perdas||[]).filter(r=>ids.has(r.maquinaId)&&r.tipo==='refugo'&&((r.diaProducao||MSA.shifts.id(r)==='3')?MSA.shifts.within(r,start,end):r.data>=start&&r.data<end));
    const rejected=sum(rejects,'quantidade'),total=good+rejected;
    // A união por máquina impede que lotes simultâneos dupliquem o tempo planejado.
    const planned=MSA.metrics.plannedIntervals(production).reduce((n,r)=>n+(r.fim-r.inicio)/1000,0);
    const downtime=MSA.metrics.minutes(stops,0,Infinity,now)*60;
    const run=Math.max(0,planned-downtime);
    const ideal=machines.reduce((n,m)=>n+(sum(production.filter(r=>r.maquinaId===m.id),'quantidade')+sum(rejects.filter(r=>r.maquinaId===m.id),'quantidade'))*(m.idealCycleSeconds||0),0);
    const supported=production.length>0&&production.every(r=>machines.find(m=>m.id===r.maquinaId)?.idealCycleSeconds>0);
    const availability=planned?run/planned*100:null,performance=run&&supported?ideal/run*100:null,quality=total?good/total*100:null;
    const efficiency=supported&&planned&&run&&performance<=100.01?{availability,performance,quality,oee:availability*performance*quality/10000}:null;
    const failures=sourceStops.filter(r=>r.failure===true&&stops.some(x=>x.id?x.id===r.id:x.inicio>=r.inicio&&x.inicio<(r.fim||now))),closed=failures.filter(r=>r.fim&&r.inicio>=start&&r.fim<=Math.min(periodEnd,now));
    const target=MSA.metrics.plannedTarget(production,machines);
    return {good,rejected,total,planned,run,downtime,efficiency,target,productivity:target?good/target*100:null,failures:failures.length,mtbf:closed.length?run/closed.length:null,mttr:closed.length?sum(closed.map(r=>({seconds:(r.fim-r.inicio)/1000})),'seconds')/closed.length:null,production,stops};
  }
  function hourly(state,machines,start,end) {
    const ids=new Set(machines.map(m=>m.id));
    return MSA.metrics.hourlyProduction(MSA.metrics.netProduction(state).filter(r=>ids.has(r.maquinaId)&&((r.diaProducao||MSA.shifts.id(r)==='3')?MSA.shifts.within(r,start,end):r.inicio>=start&&r.fim<=end)),machines);
  }
  function recipient(value){return value===null?null:value<60?'Gerência':value<80?'Supervisão':value<95?'Liderança':null;}
  function sample(machine,state) {
    const now=state.scenarioAt||Date.now(),current=MSA.shifts.context(now),start=+new Date(current.diaProducao+'T00:00:00'),end=new Date(start).setDate(new Date(start).getDate()+1);
    const shiftLabel=MSA.shifts.definitions.find(t=>t.id===current.turno).label;
    const s=calculate(state,[machine],start,end),summary=MSA.metrics.summarize(state,[machine],start,end);
    const latest=(state.leituras||[]).filter(r=>r.maquinaId===machine.id&&r.data<=now).sort((a,b)=>b.data-a.data)[0];
    const p=s.production.at(-1),open=(state.paradas||[]).find(r=>r.maquinaId===machine.id&&!r.fim&&r.inicio<=now),status=open?.kind||'operando';
    const cycle=MSA.scenarioLive?.cycleSeconds(machine,state)||machine.idealCycleSeconds,progress=cycle?(state.liveCycles?.[machine.id]||0)/cycle:0;
    const quality=state.liveQuality?.[machine.id],lastReject=quality?.lastReject;
    const recentReject=lastReject&&now-lastReject.at<=10000?lastReject:null;
    const parameterEvent=state.liveParameters?.[machine.id]?.lastEvent;
    const recentParameterEvent=parameterEvent&&now-parameterEvent.at<=10000?parameterEvent:null;
    const parameters=MSA.photoRecords?MSA.photoRecords.parameters(machine,state,now):Object.fromEntries(Object.entries(machine.parametros||{}).map(([key,definition])=>[key,{...definition,value:latest?.valores[key]??null,updatedAt:latest?.data,alarm:latest?.valores[key]<definition.min||latest?.valores[key]>definition.max}]));
    const alarms=Object.entries(parameters).filter(([,p])=>p.alarm).map(([key,p])=>({code:'PAR-'+key,description:p.nome+(p.value>p.max?' acima do máximo':' abaixo do mínimo')+': '+p.value.toLocaleString('pt-BR')+' '+p.unidade+' (limites '+p.min.toLocaleString('pt-BR')+' a '+p.max.toLocaleString('pt-BR')+')',severity:'aviso',since:state.liveParameters?.[machine.id]?.channels?.[key]?.since||latest.data,parameterId:key}));
    if(recentReject)alarms.push({code:'QUAL-REF',description:'Refugo identificado · '+recentReject.reason,severity:'aviso',since:recentReject.at});
    if(open)alarms.push({code:'PARADA',description:open.motivo,severity:'critico',since:open.inicio});
    const hours=hourly(state,[machine],start,end),last=hours.at(-1),prod=last?.target?last.goodCount/last.target*100:null,who=recipient(prod);
    if(who)alarms.push({code:'PROD',description:'Produtividade da última hora: '+prod.toFixed(1)+'% · '+who,severity:prod<60?'critico':'aviso',since:last.time});
    const timeline=[];let cursor=s.production[0]?.inicio||now;
    for(const r of [...s.stops].sort((a,b)=>a.inicio-b.inicio)){if(r.inicio>cursor)timeline.push({state:'operando',start:cursor,end:r.inicio,reason:'Produção'});timeline.push({state:r.kind||'parada',start:r.inicio,end:r.fim||null,reason:r.motivo,failure:r.failure===true});cursor=r.fim||now;}
    if(cursor<now)timeline.push({state:'operando',start:cursor,end:now,reason:'Produção'});
    return {id:machine.id,recentParameterEvent,recentReject,rejectPending:!!quality?.pending,rejectProbability:MSA.scenarioLive?.rejectRate(state)??.02,state:status,stateSince:open?.inicio||cursor,phase:open?.motivo||'Montagem / produção',totalCount:s.total,goodCount:s.good,rejectedCount:s.rejected,goal:machine.metaDiaria,plannedSeconds:s.planned,operatingSeconds:s.run,stopSeconds:s.downtime,setupSeconds:MSA.metrics.minutes(s.stops.filter(r=>r.kind==='setup'),start,end,now)*60,maintenanceSeconds:MSA.metrics.minutes(s.stops.filter(r=>r.kind==='manutencao'),start,end,now)*60,cycleSeconds:cycle,idealCycleSeconds:machine.idealCycleSeconds,cycleProgress:progress,partsPerCycle:1,speed:open?0:60/cycle,parameters,alarms,timeline,events:[...s.stops.map(r=>({id:r.id,time:r.inicio,type:'parada',description:r.motivo,state:r.kind||'parada'})),...(state.perdas||[]).filter(r=>r.maquinaId===machine.id&&r.simulacaoCiclos&&r.tipo==='refugo').slice(-20).map(r=>({id:r.id,time:r.data,type:'qualidade',description:'Refugo identificado · '+r.motivo,state:'operando'})),...(state.parameterEvents||[]).filter(e=>e.machineId===machine.id).slice(-20).map(e=>({id:e.id,time:e.at,type:'alarme',description:e.name+(e.type==='desvio'?' acima do máximo':' normalizado')+' · '+e.value+' '+e.unit,state:status}))],samples:[...hours.map(h=>({time:h.time,cycleSeconds:machine.idealCycleSeconds,temperature:null})),...(state.leituras||[]).filter(r=>r.maquinaId===machine.id&&r.simulacaoParametros&&r.id.startsWith('exemplo-amostra-')).slice(-60).map(r=>({time:r.data,cycleSeconds:cycle,temperature:r.valores.temperatura??null}))],periodStart:s.production[0]?.inicio,periodLabel:shiftLabel+' · '+MSA.shifts.definitions.find(t=>t.id===current.turno).hours,updatedAt:now,source:'demo-records',sourceLabel:'Cenário fictício · '+shiftLabel,connected:true,stale:false,efficiency:s.efficiency,reliability:{mtbf:s.mtbf,mttr:s.mttr},failureHistoryComplete:true,hourly:hours,productivity:s.productivity,order:p?.ordem,batch:p?.lote,shift:shiftLabel,variant:machine.id==='NHPL'?'Medium (exemplo)':'Padrão (exemplo)',stationStates:machine.id==='NHPL'?Object.fromEntries(['entrada','montagem-a','montagem-b','verificacao','saida'].map(id=>[id,{state:({operando:'Operando',parada:'Parada',manutencao:'Manutenção',setup:'Setup'})[status]+' · exemplo fictício',stateSince:open?.inicio||cursor,parameters:id==='montagem-b'?parameters:{}}])):{},model:p?.produto,countUnit:'peças',unit:'peças',suspectCount:summary.suspeitas,materialLoss:summary.kg,goalHistory:Object.keys(machine.historicoMetas||{}).length?Object.entries(machine.historicoMetas).sort((a,b)=>a[1].inicio-b[1].inicio).map(([id,v],i,versions)=>({id:'meta-'+machine.id+'-'+id,source:'demo-records',validFrom:new Date(v.inicio).toISOString(),validTo:versions[i+1]?new Date(versions[i+1][1].inicio).toISOString():'2100-01-01',shift:shiftLabel,order:p?.ordem,shiftTarget:v.metaDiaria,hourTarget:v.metaDiaria/8})):[{id:'meta-exemplo-'+machine.id,source:'demo-records',validFrom:'2020-01-01',validTo:'2100-01-01',shift:shiftLabel,order:p?.ordem,shiftTarget:machine.metaDiaria,hourTarget:MSA.shifts.hourTarget(machine)}]};
  }
  MSA.performance={calculate,hourly,recipient,sample};
})();
