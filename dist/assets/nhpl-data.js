import {nhplConfig as config} from './nhpl-config.js';
const finite = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
export function applicableGoal(goals, sample, date = new Date()) {
  const day = [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  return [...goals].reverse().find(g => g.source === sample.source && day >= g.validFrom && day < g.validTo && (!g.shift || g.shift === sample.shift) && (!g.order || g.order === sample.order)) || null;
}
export function reliability(sample) {
  const failures = sample.timeline?.filter(t=>t.state==='parada' && t.failure===true) || [];
  const repaired = failures.filter(t=>finite(t.end) && t.end>=t.start);
  return {mtbf: failures.length && finite(sample.operatingSeconds) && sample.failureHistoryComplete===true ? sample.operatingSeconds/failures.length : null,
    mttr: repaired.length && sample.failureHistoryComplete===true ? repaired.reduce((n,t)=>n+(t.end-t.start)/1000,0)/repaired.length : null};
}
export function createNhplData() {
  const observed = new Map(); let previous = null;
  return {
    read(raw, mode, manualState) {
      const simulated=mode==='simulation', s={...raw};
      if(simulated)Object.assign(s,config.demo,{source:'simulated',model:s.model||'VGARD HP',variant:s.variant||'Medium'});
      else {s.order=s.order||null;s.batch=s.batch||null;s.shift=s.shift||null;s.unit=s.countUnit||'Unidade de contagem a confirmar';}
      if(s.updatedAt && simulated && !s.stale && s.connected!==false) {
        const bucket = new Date(s.updatedAt);bucket.setMinutes(0,0,0);const at=bucket.getTime();
        if(previous && previous.goodCount<=s.goodCount && previous.updatedAt<=s.updatedAt) observed.set(at,(observed.get(at)||0)+s.goodCount-previous.goodCount);
        else if(!observed.has(at))observed.set(at,0);
        previous={goodCount:s.goodCount,updatedAt:s.updatedAt};
      }
      const now=new Date(s.updatedAt||Date.now());now.setMinutes(0,0,0);const currentHour=now.getTime();
      s.hourly=simulated?[...observed].map(([time,goodCount])=>({time,goodCount,partial:true})):Array.isArray(s.hourly)?s.hourly:[];
      if(mode==='records') {
        const bins=new Map();
        const records=(manualState?.registrosProducao||[]).filter(r=>r.maquinaId===s.id && finite(r.quantidade) && finite(r.fim) && r.fim>=new Date().setHours(0,0,0,0));
        const latest=[...records].sort((a,b)=>b.fim-a.fim)[0];
        s.model=latest?.produto||null;s.batch=latest?.lote?latest.lote+' (campo lote/ordem registrado)':null;s.shift=latest?.turno?latest.turno+' (último apontamento)':null;
        records.forEach(r=>{
          const d=new Date(r.fim);d.setMinutes(0,0,0);bins.set(+d,(bins.get(+d)||0)+r.quantidade);
        });
        s.hourly=[...bins].map(([time,goodCount])=>({time,goodCount,partial:true}));
      }
      s.hourCount=s.hourly.find(h=>h.time===currentHour)?.goodCount ?? null;
      s.goalRecord=applicableGoal(simulated?config.goals:s.goalHistory||[],s);
      s.stateLabel=s.stale||s.connected===false||s.state==='desconhecido'?'Sem leitura':({operando:'Operando',parada:'Parada',setup:'Setup',manutencao:'Manutenção'})[s.state]||'Sem leitura';
      s.sourceLabel=simulated?'Simulação':mode==='records'?'Registros manuais do sistema':'Telemetria real · '+(s.sourceLabel||'API / IoT');
      s.reliability=reliability(s);
      s.efficiency=s.efficiency||null;
      s.stationStates=s.stationStates||{};
      s.alarms=[...(s.alarms||[])];
      if(s.stateLabel==='Sem leitura')s.alarms.push({code:'COM',description:'Sem leitura — movimento suspenso'});
      return s;
    }
  };
}
