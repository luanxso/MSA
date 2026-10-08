/* Continua a fotografia fictícia por ciclos, usando os próprios registros dos painéis. */
window.MSA=window.MSA||{};
(() => {
  function cycleSeconds(machine,state) {
    const latest=(state.leituras||[]).filter(r=>r.maquinaId===machine.id&&r.data<=state.scenarioAt).sort((a,b)=>b.data-a.data)[0];
    const key=Object.keys(machine.parametros||{}).find(k=>/ciclo/i.test(machine.parametros[k].nome||k));
    const value=Number(latest?.valores?.[key]);
    return value>0?value:Number(machine.idealCycleSeconds)||0;
  }
  const rejectRate=state=>Number.isFinite(state.demoRejectRate)?Math.min(1,Math.max(0,state.demoRejectRate)):.008;
  function rejectNext(state,id) {
    if(!state.demo||!state.maquinas.some(m=>m.id===id))throw new Error('Máquina indisponível para demonstração.');
    state.liveQuality||={};state.liveQuality[id]||={cycles:0};state.liveQuality[id].pending=true;
  }
  // Uma janela por hora e turno: registros encerrados nunca são reutilizados.
  function liveRow(state,machine,at,source) {
    const context=MSA.shifts.context(at),hour=new Date(at);hour.setMinutes(0,0,0);
    const start=Math.max(+hour,context.start),id='exemplo-ciclo-prod-'+machine.id+'-'+start;
    let row=state.registrosProducao.find(r=>r.id===id);
    if(!row){
      row={...source,id,inicio:Math.max(at,start),fim:at,quantidade:0,turno:context.turno,diaProducao:context.diaProducao,
        lote:(source.lote||'LT-'+machine.id).replace(/-T[123]$/,'')+'-T'+context.turno,createdAt:at,updatedAt:at,
        verificado:false,simulacaoCiclos:true,observacao:'Produção fictícia por ciclos no turno em andamento'};
      delete row.verificadoPor;delete row.verificadoEm;state.registrosProducao.push(row);
    }
    return row;
  }
  // Corrige sessões antigas que estendiam o último apontamento do primeiro turno.
  function upgrade(state,baseline) {
    if(state.liveShiftVersion===2)return;
    const originals=new Map((baseline.registrosProducao||[]).map(r=>[r.id,r]));
    for(const row of [...state.registrosProducao]){
      const original=originals.get(row.id);
      if(!row.simulacaoCiclos||!original||row.fim<=original.fim)continue;
      const end=Math.min(row.fim,state.scenarioAt),start=original.fim,extra=Math.max(0,row.quantidade-original.quantidade);
      row.fim=original.fim;row.quantidade=original.quantidade;row.updatedAt=original.updatedAt;delete row.simulacaoCiclos;
      let cursor=start,assigned=0;
      while(cursor<end){const hour=new Date(cursor);hour.setMinutes(60,0,0);const edge=Math.min(end,+hour,MSA.shifts.context(cursor).end);
        const next=liveRow(state,state.maquinas.find(m=>m.id===row.maquinaId),cursor,row);
        const cumulative=Math.round(extra*(edge-start)/(end-start));next.quantidade+=cumulative-assigned;assigned=cumulative;next.fim=edge;next.updatedAt=edge;cursor=edge;
      }
    }
    for(const row of state.perdas||[])if(row.simulacaoCiclos){const c=MSA.shifts.context(row.data);row.turno=c.turno;row.diaProducao=c.diaProducao;}
    state.liveShiftVersion=2;
  }
  function advance(state,seconds,random=Math.random) {
    if(!state.demo||!Number.isFinite(seconds)||seconds<=0)return 0;
    const end=state.scenarioAt+seconds*1000;
    state.liveCycles||={};state.liveQuality||={};state.live=true;state.liveShiftVersion=2;
    let completed=0;
    while(state.scenarioAt<end){
      const before=state.scenarioAt,context=MSA.shifts.context(before),hour=new Date(before);hour.setMinutes(60,0,0);
      state.scenarioAt=Math.min(end,context.end,+hour);const elapsedSeconds=(state.scenarioAt-before)/1000;
      for(const machine of state.maquinas){
        const source=state.registrosProducao.filter(r=>r.maquinaId===machine.id&&(r.simulacaoCiclos||r.id?.startsWith('exemplo-prod-'))&&r.inicio<=before).sort((a,b)=>b.fim-a.fim)[0];
        if(!source)continue;
        const row=liveRow(state,machine,before,source);
        row.fim=state.scenarioAt;row.updatedAt=state.scenarioAt;
        if(state.paradas.some(r=>r.maquinaId===machine.id&&!r.fim))continue;
        const cycle=cycleSeconds(machine,state);if(!cycle)continue;
        const elapsed=(state.liveCycles[machine.id]||0)+elapsedSeconds;
        const cycles=Math.floor((elapsed+1e-9)/cycle);
        state.liveCycles[machine.id]=Math.max(0,elapsed-cycles*cycle);
        if(cycles){
          const quality=state.liveQuality[machine.id]||={cycles:0};
          for(let i=0;i<cycles;i++){
            quality.cycles++;const reject=quality.pending||random()<rejectRate(state);quality.pending=false;
            if(!reject){row.quantidade++;continue;}
            const at=state.scenarioAt-(state.liveCycles[machine.id]+(cycles-1-i)*cycle)*1000;
            const reason=machine.productKind==='fones'?'Falha de encaixe':'Falha de acabamento';
            const id='exemplo-refugo-ciclo-'+machine.id+'-'+quality.cycles;
            state.perdas.push({id,maquinaId:machine.id,setorId:machine.setorId,usuarioId:row.usuarioId,usuarioRe:row.usuarioRe,data:at-1,
              turno:row.turno,diaProducao:row.diaProducao,lote:row.lote,ordem:row.ordem,produto:machine.produto,tipo:'refugo',unidade:'pecas',quantidade:1,motivo:reason,
              verificado:false,createdAt:at,updatedAt:at,simulacaoCiclos:true,observacao:'Refugo fictício gerado em um ciclo da apresentação'});
            quality.lastReject={id,at,machineId:machine.id,quantity:1,reason};
          }
          completed+=cycles;
        }
      }
      MSA.scenarioParameters?.advance(state);
    }
    return completed;
  }
  MSA.scenarioLive={advance,upgrade,cycleSeconds,rejectRate,rejectNext};
})();
