/* Continua a fotografia fictícia por ciclos, usando os próprios registros dos painéis. */
window.MSA=window.MSA||{};
(() => {
  function cycleSeconds(machine,state) {
    const latest=(state.leituras||[]).filter(r=>r.maquinaId===machine.id&&r.data<=state.scenarioAt).sort((a,b)=>b.data-a.data)[0];
    const key=Object.keys(machine.parametros||{}).find(k=>/ciclo/i.test(machine.parametros[k].nome||k));
    const value=Number(latest?.valores?.[key]);
    return value>0?value:Number(machine.idealCycleSeconds)||0;
  }
  const rejectRate=state=>Number.isFinite(state.demoRejectRate)?Math.min(1,Math.max(0,state.demoRejectRate)):.02;
  function rejectNext(state,id) {
    if(!state.demo||!state.maquinas.some(m=>m.id===id))throw new Error('Máquina indisponível para demonstração.');
    state.liveQuality||={};state.liveQuality[id]||={cycles:0};state.liveQuality[id].pending=true;
  }
  function advance(state,seconds,random=Math.random) {
    if(!state.demo||!Number.isFinite(seconds)||seconds<=0)return 0;
    const before=state.scenarioAt,day=new Date(before).toLocaleDateString('sv');
    state.liveCycles||={};state.liveQuality||={};state.scenarioAt+=seconds*1000;state.live=true;
    let completed=0;
    for(const machine of state.maquinas){
      const rows=state.registrosProducao.filter(r=>r.maquinaId===machine.id&&(r.simulacaoCiclos||r.id?.startsWith('exemplo-prod-'))&&new Date(r.inicio).toLocaleDateString('sv')===day);
      const row=rows.sort((a,b)=>b.fim-a.fim)[0];
      if(!row)continue;
      // A última janela fica parcial durante a apresentação, sem duplicar a base histórica.
      row.fim=state.scenarioAt;row.updatedAt=state.scenarioAt;row.simulacaoCiclos=true;
      if(state.paradas.some(r=>r.maquinaId===machine.id&&!r.fim))continue;
      const cycle=cycleSeconds(machine,state);if(!cycle)continue;
      const elapsed=(state.liveCycles[machine.id]||0)+seconds;
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
            turno:row.turno||'1',lote:row.lote,ordem:row.ordem,produto:machine.produto,tipo:'refugo',unidade:'pecas',quantidade:1,motivo:reason,
            verificado:false,createdAt:at,updatedAt:at,simulacaoCiclos:true,observacao:'Refugo fictício gerado em um ciclo da apresentação'});
          quality.lastReject={id,at,machineId:machine.id,quantity:1,reason};
        }
        completed+=cycles;
      }
    }
    MSA.scenarioParameters?.advance(state);
    return completed;
  }
  MSA.scenarioLive={advance,cycleSeconds,rejectRate,rejectNext};
})();
