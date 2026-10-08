/* Indicadores derivados dos apontamentos; não grava totais duplicados. */
window.MSA = window.MSA || {};
(() => {
  'use strict';
  const count = records => records.reduce((total, record) => total + Number(record.quantidade || 0), 0);
  const stamp = record => record.fim ? record.fim - 1 : (record.data || record.inicio || record.createdAt);
  const within = (record, start, end) => MSA.shifts?.within(record,start,end) ?? (stamp(record) >= start && stamp(record) < end);
  function minutes(records, start, end, now = Date.now()) {
    const byMachine = new Map();
    records.forEach(record => {
      const a = Math.max(start, record.inicio);
      const b = Math.min(end, record.fim || now, now);
      if (b <= a) return;
      if (!byMachine.has(record.maquinaId)) byMachine.set(record.maquinaId, []);
      byMachine.get(record.maquinaId).push([a, b]);
    });
    let total = 0;
    for (const intervals of byMachine.values()) {
      let current = null;
      for (const interval of intervals.sort((a, b) => a[0] - b[0])) {
        if (current && interval[0] <= current[1]) current[1] = Math.max(current[1], interval[1]);
        else { if (current) total += current[1] - current[0]; current = [...interval]; }
      }
      if (current) total += current[1] - current[0];
    }
    return total / 60000;
  }
  const third=r=>(MSA.shifts?.id(r)||String(r.turno))==='3';
  function summarize(state, machines, start, end) {
    const ids = new Set(machines.map(machine => machine.id));
    const slice = collection => (state[collection] || []).filter(record => ids.has(record.maquinaId) && within(record, start, end));
    const producao = slice('registrosProducao');
    const perdas = slice('perdas');
    const aprovadas = count(producao);
    const refugos = count(perdas.filter(record => record.tipo === 'refugo'));
    const suspeitas = state.lotesQualidade ? (state.lotesQualidade||[]).filter(b=>ids.has(b.maquinaId)&&!['liberado','descartado'].includes(b.status)).reduce((n,b)=>n+(b.quantidade||0),0) : count(perdas.filter(record => record.tipo === 'suspeito')); 
    const kg = count(perdas.filter(record => record.tipo === 'perda'));
    const days = Math.max(1, Math.round((end - start) / 86400000));
    const meta = state.demo ? producao.reduce((n,r)=>n+(r.fim-r.inicio)/3600000*MSA.shifts.hourTarget(machines.find(m=>m.id===r.maquinaId)),0) : machines.reduce((total, machine) => total + Number(machine.metaDiaria || 0), 0) * days;
    const stops=(state.paradas||[]).filter(r=>ids.has(r.maquinaId)&&(!(r.diaProducao||third(r))||within(r,start,end)));
    const stopEnd=(state.demo||producao.some(r=>third(r)))?new Date(end).setHours(7,0,0,0):end;
    const abertas = (state.paradas || []).filter(record => ids.has(record.maquinaId) && !record.fim);
    return { aprovadas, refugos, suspeitas, kg, meta, atendimento: meta > 0 ? aprovadas / meta * 100 : null, taxaRefugo: aprovadas + refugos > 0 ? refugos / (aprovadas + refugos) * 100 : null, minutos: minutes(stops,start,stopEnd,state.scenarioAt||Date.now()), abertas, producao, perdas, leituras: slice('leituras'), ocorrencias: slice('ocorrencias') };
  }
  function deviations(state, machines) {
    return machines.flatMap(machine => {
      const latest = (state.leituras || []).filter(record => record.maquinaId === machine.id).sort((a, b) => b.data - a.data)[0];
      if (!latest) return [];
      return Object.entries(latest.valores || {}).flatMap(([key, value]) => {
        const parameter = machine.parametros?.[key];
        return parameter && (value < parameter.min || value > parameter.max) ? [{ machine, record: latest, parameter, value }] : [];
      });
    });
  }
  MSA.metrics = Object.freeze({ within, minutes, summarize, deviations });
})();
