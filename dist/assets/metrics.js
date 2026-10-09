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
  // A produção original permanece auditável. Reinspeções reclassificam peças,
  // sem criar nova produção nem contar a mesma peça como aprovada e refugada.
  function netProduction(state) {
    const rows=state.registrosProducao||[],adjustments=new Map();
    if(rows.some(r=>r.quantidadeApontada!==undefined)||!(state.perdas||[]).some(r=>r.tipo==='refugo'&&r.decisaoQualidade))return rows;
    for(const loss of (state.perdas||[]).filter(r=>r.tipo==='refugo'&&r.decisaoQualidade)){
      let left=Number(loss.quantidade)||0;
      const own=rows.filter(r=>r.maquinaId===loss.maquinaId&&r.lote===loss.lote&&(!loss.producaoId||r.id===loss.producaoId)&&(!r.createdAt||!loss.createdAt||r.createdAt<=loss.createdAt)).sort((a,b)=>a.inicio-b.inicio||String(a.id).localeCompare(String(b.id)));
      for(const r of own){const available=Math.max(0,Number(r.quantidade)-(adjustments.get(r)||0)),take=Math.min(left,available);adjustments.set(r,(adjustments.get(r)||0)+take);left-=take;if(left<=0)break;}
    }
    return rows.map(r=>({...r,quantidadeApontada:r.quantidade,refugoReclassificado:adjustments.get(r)||0,quantidade:Math.max(0,Number(r.quantidade)-(adjustments.get(r)||0))}));
  }
  function plannedIntervals(rows){
    const machines=new Map();for(const r of rows){if(!(r.fim>r.inicio))continue;if(!machines.has(r.maquinaId))machines.set(r.maquinaId,[]);machines.get(r.maquinaId).push([r.inicio,r.fim]);}
    const result=[];for(const [maquinaId,intervals]of machines){let current=null;for(const [a,b]of intervals.sort((a,b)=>a[0]-b[0])){if(current&&a<=current.fim)current.fim=Math.max(current.fim,b);else{if(current)result.push(current);current={maquinaId,inicio:a,fim:b};}}if(current)result.push(current);}return result;
  }
  const plannedTarget=(rows,machines)=>plannedIntervals(rows).reduce((n,r)=>{const m=machines.find(m=>m.id===r.maquinaId);return n+(MSA.shifts?.targetBetween?MSA.shifts.targetBetween(m,r.inicio,r.fim):(r.fim-r.inicio)/3600000*(Number(m?.metaDiaria)||0)/8);},0);
  function hourlyProduction(rows,machines) {
    const bins=new Map();
    for(const r of rows){
      if(!(r.fim>r.inicio))continue;
      const hour=new Date(r.inicio);hour.setMinutes(0,0,0);
      for(let at=+hour;at<r.fim;at+=3600000){
        const inicio=Math.max(at,r.inicio),fim=Math.min(at+3600000,r.fim),row=bins.get(at)||{time:at,goodCount:0,records:[],estimated:false};
        row.goodCount+=Number(r.quantidade||0)*(fim-inicio)/(r.fim-r.inicio);
        row.records.push({...r,inicio,fim});row.estimated ||= inicio!==r.inicio||fim!==r.fim;bins.set(at,row);
      }
    }
    return [...bins.values()].map(({records,...row})=>({...row,target:plannedTarget(records,machines),partial:plannedIntervals(records).some(r=>r.inicio>row.time||r.fim<row.time+3600000),unknownTarget:records.some(r=>{const m=machines.find(m=>m.id===r.maquinaId);return !(MSA.shifts.hourTarget(m)>0)&&!Object.keys(m?.historicoMetas||{}).length;})})).sort((a,b)=>a.time-b.time);
  }
  function summarize(state, machines, start, end) {
    const ids = new Set(machines.map(machine => machine.id));
    const slice = collection => (state[collection] || []).filter(record => ids.has(record.maquinaId) && within(record, start, end));
    const producao = netProduction(state).filter(record=>ids.has(record.maquinaId)&&within(record,start,end));
    const perdas = slice('perdas');
    const aprovadas = count(producao);
    const refugos = count(perdas.filter(record => record.tipo === 'refugo'));
    const suspeitas = state.lotesQualidade ? (state.lotesQualidade||[]).filter(b=>ids.has(b.maquinaId)&&!['liberado','descartado'].includes(b.status)).reduce((n,b)=>n+(b.quantidade||0),0) : count(perdas.filter(record => record.tipo === 'suspeito')); 
    const kg = count(perdas.filter(record => record.tipo === 'perda'));
    const days = Math.max(1, Math.round((end - start) / 86400000));
    const meta = state.demo ? plannedTarget(producao,machines) : MSA.shifts?.targetBetween?Array.from({length:days},(_,i)=>{const a=new Date(start);a.setDate(a.getDate()+i);a.setHours(7+(['1','2','3'].includes(state.selectedShift)?(Number(state.selectedShift)-1)*8:0),0,0,0);return machines.reduce((n,m)=>n+MSA.shifts.targetBetween(m,+a,+a+8*3600000),0);}).reduce((n,v)=>n+v,0):machines.reduce((n,m)=>n+Number(m.metaDiaria||0),0)*days;
    const scopedStops=(state.paradas||[]).filter(r=>ids.has(r.maquinaId));
    const stops=MSA.shifts?.clipStops?MSA.shifts.clipStops(scopedStops,start,end,state.selectedShift,state.scenarioAt||Date.now()):scopedStops;
    const abertas = (state.paradas || []).filter(record => ids.has(record.maquinaId) && !record.fim);
    return { aprovadas, refugos, suspeitas, kg, meta, atendimento: meta > 0 ? aprovadas / meta * 100 : null, taxaRefugo: aprovadas + refugos > 0 ? refugos / (aprovadas + refugos) * 100 : null, minutos: minutes(stops,MSA.shifts?0:start,MSA.shifts?Infinity:end,state.scenarioAt||Date.now()), abertas, producao, perdas, leituras: slice('leituras'), ocorrencias: slice('ocorrencias') };
  }
  function deviations(state, machines) {
    return machines.flatMap(machine => {
      const latest = (state.leituras || []).filter(record => record.maquinaId === machine.id).sort((a, b) => b.data - a.data)[0];
      if (!latest) return [];
      const channels=MSA.photoRecords?.parameters(machine,state);
      return Object.entries(channels||latest.valores || {}).flatMap(([key, item]) => {
        const value=channels?item.value:item,record=channels?item.record:latest;
        const parameter = machine.parametros?.[key];
        return parameter && value!==null && (value < parameter.min || value > parameter.max) ? [{ machine, record, parameter, value }] : [];
      });
    });
  }
  MSA.metrics = Object.freeze({ within, minutes, summarize, deviations,netProduction,plannedIntervals,plannedTarget,hourlyProduction });
})();
