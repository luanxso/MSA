/* Fluxos da liderança. Os mesmos comandos atendem o cenário e os registros reais. */
window.MSA = window.MSA || {};
(() => {
  'use strict';
  const collections = ['passagensTurno','lotesQualidade','atendimentosAlertas','alocacoes'];
  const reasons = [
    ['travamento-pallet','Travamento de pallet / peça','Fluxo'],
    ['falha-alimentacao','Falha no alimentador','Fluxo'],
    ['falta-material','Falta de material / componente','Abastecimento'],
    ['sensor','Sensor sem leitura / desalinhado','Equipamento'],
    ['ajuste','Ajuste de máquina / processo','Processo'],
    ['troca-molde','Troca de molde / ferramenta','Setup'],
    ['troca-produto','Troca de produto / setup','Setup'],
    ['manutencao','Manutenção corretiva','Manutenção'],
    ['preventiva','Manutenção preventiva','Manutenção'],
    ['pressao','Pressão / ar comprimido fora do limite','Utilidades'],
    ['energia','Falta de energia','Utilidades'],
    ['qualidade','Inspeção / bloqueio da Qualidade','Qualidade'],
    ['sem-equipe','Posto sem operador','Equipe'],
    ['pausa','Pausa programada','Planejada']
  ];
  const batchStatus = {suspeito:'Suspeito',segregado:'Segregado · área vermelha',reinspecao:'Em reinspeção',liberado:'Liberado',descartado:'Destinado ao descarte'};
  const alertStatus = {novo:'Novo',reconhecido:'Reconhecido',atendimento:'Em atendimento',resolvido:'Resolvido'};
  const now = s => s.scenarioAt || Date.now();
  const hash=value=>{let n=2166136261;for(const c of value){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return (n>>>0).toString(36);};
  const uid = prefix => prefix+'-'+crypto.randomUUID();
  const handoverId=(machineId,day,shift)=>'passagem-'+machineId+'-'+day+'-'+String(shift);
  const text = (v,label,max=1000) => MSA.recordValidation.required(v,label,max);
  const machine = (s,id) => { const m=s.maquinas.find(m=>m.id===id);if(!m)throw new Error('Selecione uma máquina disponível.');return m; };
  const item = (s,key,id) => {const r=s[key].find(r=>r.id===id);if(!r)throw new Error('Registro não encontrado.');return r;};
  function upgrade(s) {for(const key of collections)s[key] ||= [];s.workflowVersion=1;return s;}
  function reason(values) {
    const chosen=reasons.find(r=>r[0]===values.motivoCodigo);
    if(chosen)return {motivoCodigo:chosen[0],motivo:chosen[1]};
    if(values.motivoCodigo==='outro')return {motivoCodigo:'outro',motivo:text(values.motivoOutro||values.motivo,'outro motivo',300)};
    if(values.motivoCodigo)throw new Error('Selecione um motivo de parada válido.');
    return {motivoCodigo:'outro',motivo:text(values.motivo,'motivo',300)};
  }
  function period(day,shift) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!['1','2','3'].includes(String(shift)))throw new Error('Selecione data e turno válidos.');
    const d=new Date(day+'T00:00:00');if(!Number.isFinite(+d))throw new Error('Data inválida.');
    d.setHours(7+(Number(shift)-1)*8,0,0,0);return [+d,+d+8*3600000];
  }
  function shiftAt(at) {const d=new Date(at),h=d.getHours();if(h<7)d.setDate(d.getDate()-1);return {dia:d.toLocaleDateString('sv'),turno:h>=7&&h<15?'1':h>=15&&h<23?'2':'3'};}
  function handoverSummary(s,id,day,shift) {
    const m=machine(s,id),[a,b]=period(day,shift),end=Math.min(b,now(s));
    if(a>=end)throw new Error('Esse turno ainda não começou no cenário atual.');
    const start=new Date(day+'T00:00:00').getTime();
    const production=s.registrosProducao.filter(r=>r.maquinaId===id&&MSA.shifts.id(r)===String(shift)&&MSA.shifts.within(r,start,start+86400000));
    const rejected=s.perdas.filter(r=>r.maquinaId===id&&r.tipo==='refugo'&&MSA.shifts.id(r)===String(shift)&&MSA.shifts.within(r,start,start+86400000)).reduce((n,r)=>n+r.quantidade,0);
    const stopEnd=s.demo&&day===new Date(now(s)).toLocaleDateString('sv')&&String(shift)==='1'?now(s):end;
    return {inicio:a,fim:stopEnd,planejado:Math.round(production.reduce((n,r)=>n+(r.fim-r.inicio)/3600000*MSA.shifts.hourTarget(m),0)),aprovadas:production.reduce((n,r)=>n+r.quantidade,0),refugos:rejected,paradaSegundos:MSA.metrics.minutes(s.paradas.filter(r=>r.maquinaId===id),a,stopEnd,now(s))*60,
      lotes:[...new Set(production.map(r=>r.lote).filter(Boolean))],ordens:[...new Set(production.map(r=>r.ordem).filter(Boolean))],
      problemas:s.ocorrencias.filter(r=>r.maquinaId===id&&r.status!=='resolvida').map(r=>r.descricao),
      alarmes:(s.atendimentosAlertas||[]).filter(r=>r.maquinaId===id&&r.status!=='resolvido').map(r=>r.descricao)};
  }
  function lotQuantity(s,machineId,lote) {
    const approved=s.registrosProducao.filter(r=>r.maquinaId===machineId&&r.lote===lote).reduce((n,r)=>n+Number(r.quantidade||0),0);
    const losses=s.perdas.filter(r=>r.maquinaId===machineId&&r.lote===lote);
    const rejected=losses.filter(r=>r.tipo==='refugo').reduce((n,r)=>n+r.quantidade,0);
    const held=losses.filter(r=>r.tipo==='suspeito').reduce((n,r)=>n+r.quantidade,0);
    return {quantidade:Math.max(approved+losses.filter(r=>r.tipo==='refugo'&&!r.decisaoQualidade).reduce((n,r)=>n+r.quantidade,0),held),refugosIdentificados:rejected};
  }
  function syncLots(s) {
    const start=+new Date(MSA.shifts.context(now(s)).diaProducao+'T00:00:00'),groups=new Map();
    for(const r of s.perdas){if(!r.lote||!['refugo','suspeito'].includes(r.tipo))continue;
      // O histórico anterior permanece nos apontamentos; o fluxo começa com os lotes do dia.
      if(!MSA.shifts.within(r,start,start+86400000)&&!s.lotesQualidade.some(b=>b.maquinaId===r.maquinaId&&b.lote===r.lote))continue;
      const key=r.maquinaId+'|'+r.lote;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
    }
    for(const rows of groups.values()){
      const last=rows.reduce((a,b)=>(b.updatedAt||b.data)>(a.updatedAt||a.data)?b:a);
      let b=s.lotesQualidade.find(b=>b.maquinaId===last.maquinaId&&b.lote===last.lote);
      const revision=rows.filter(r=>!r.decisaoQualidade).map(r=>r.id+':'+(r.updatedAt||r.data)+':'+r.quantidade).sort().join('|');
      const totals=lotQuantity(s,last.maquinaId,last.lote);
      if(!b){b={id:'lote-'+hash(last.maquinaId+'|'+last.lote),maquinaId:last.maquinaId,setorId:last.setorId,lote:last.lote,produto:last.produto||machine(s,last.maquinaId).produto,
        status:'suspeito',motivo:last.motivo,createdAt:last.data,updatedAt:now(s),historico:[],revision};s.lotesQualidade.push(b);
        b.historico.push({status:'suspeito',at:now(s),responsavel:'Coleta automática',observacao:'Lote inteiro sinalizado a partir de refugo / suspeita.'});
      }else if(b.revision!==revision){
        if(['liberado','descartado'].includes(b.status)){b.status='suspeito';for(const key of ['inspecionadas','descartadas','liberadas','destino'])delete b[key];b.historico.push({status:'suspeito',at:now(s),responsavel:'Coleta automática',observacao:'Novo registro de defeito: lote requer nova avaliação.'});}
        b.revision=revision;b.updatedAt=now(s);
      }
      // Uma decisão concluída mantém a quantidade efetivamente reinspecionada.
      if(!['liberado','descartado'].includes(b.status))Object.assign(b,totals);
      else if(Number.isSafeInteger(b.inspecionadas)&&b.inspecionadas===b.liberadas+b.descartadas)b.quantidade=b.inspecionadas;
    }
  }
  function alertSources(s) {
    const at=now(s),a=+new Date(MSA.shifts.context(at).diaProducao+'T00:00:00'),sources=[];
    for(const m of s.maquinas){
      const hourly=MSA.performance.hourly(s,[m],a,at).at(-1),value=hourly?.target?hourly.goodCount/hourly.target*100:null;
      const recipient=MSA.performance.recipient(value);
      if(recipient)sources.push({sourceKey:'prod:'+m.id,maquinaId:m.id,setorId:m.setorId,tipo:'Produtividade',descricao:value.toLocaleString('pt-BR',{maximumFractionDigits:1})+'% na última janela horária',destinatario:recipient,route:'producao',active:true});
    }
    for(const d of MSA.metrics.deviations(s,s.maquinas))sources.push({sourceKey:'param:'+d.machine.id+':'+d.parameter.nome,maquinaId:d.machine.id,setorId:d.machine.setorId,tipo:'Parâmetro',descricao:d.parameter.nome+': '+d.value.toLocaleString('pt-BR')+' '+d.parameter.unidade+' · fora do limite',destinatario:'Liderança / manutenção',route:'producao',active:true});
    for(const r of s.paradas.filter(r=>!r.fim))sources.push({sourceKey:'stop:'+r.id,maquinaId:r.maquinaId,setorId:r.setorId,tipo:'Parada',descricao:r.motivo,destinatario:'Liderança do setor',route:'paradas',active:true});
    for(const b of s.lotesQualidade.filter(b=>!['liberado','descartado'].includes(b.status)))sources.push({sourceKey:'lot:'+b.id,maquinaId:b.maquinaId,setorId:b.setorId,tipo:'Lote suspeito',descricao:b.lote+' · '+b.quantidade+' peças em avaliação',destinatario:'Qualidade',route:'qualidade',active:true});
    for(const r of s.ocorrencias.filter(r=>r.status==='aberta'))sources.push({sourceKey:'occ:'+r.id,maquinaId:r.maquinaId,setorId:r.setorId,tipo:'Ocorrência',descricao:r.descricao,destinatario:'Liderança do setor',route:'ocorrencias',active:true});
    return sources;
  }
  function syncAlerts(s) {
    const sources=alertSources(s),active=new Set(sources.map(r=>r.sourceKey));
    for(const r of s.atendimentosAlertas){if(r.active&&!active.has(r.sourceKey)){r.active=false;r.normalizadoEm=now(s);r.updatedAt=now(s);} }
    for(const source of sources){let r=[...s.atendimentosAlertas].reverse().find(r=>r.sourceKey===source.sourceKey&&r.active&&r.status!=='resolvido');
      if(!r){r={id:'alerta-'+hash(source.sourceKey)+'-'+now(s)+'-'+s.atendimentosAlertas.filter(a=>a.sourceKey===source.sourceKey).length,...source,status:'novo',createdAt:now(s),updatedAt:now(s),historico:[],canal:'Tela do sistema'};s.atendimentosAlertas.push(r);}
      else Object.assign(r,source);
    }
  }
  function sync(s) {upgrade(s);syncLots(s);syncAlerts(s);}
  function allocation(s,p,day,shift) {return s.alocacoes.find(a=>a.funcionarioId===p.id&&a.dia===day&&a.turno===String(shift))||{funcionarioId:p.id,setorId:p.setorId,maquinaId:p.maquinaId||'',presenca:'pendente',dia:day,turno:String(shift)};}
  function command(s,action,v,id,u) {
    upgrade(s);const at=now(s),require=(p,r)=>MSA.rbac.require(p,u,r);
    const history=r=>{r.historico ||= [];r.historico.push({at,responsavel:u.nome,re:u.re,usuarioId:u.id,status:r.status,observacao:String(v.observacao||'').trim()});r.updatedAt=at;r.atualizadoPor=u.id;};
    if(action==='classify-stop'){
      const r=item(s,'paradas',id);require('paradas:gerenciar',r);Object.assign(r,reason(v),{motivoConfirmado:true,classificadoPor:u.id,classificadoRe:u.re,classificadoEm:at,updatedAt:at});return r.id;
    }
    if(action==='handover-create'){
      const m=machine(s,v.maquinaId);require('passagem:gerenciar',m);
      if(s.passagensTurno.some(r=>r.maquinaId===m.id&&r.dia===v.dia&&String(r.turno)===String(v.turno)))throw new Error('Esta máquina já possui passagem registrada nesse turno.');
      const resumo=handoverSummary(s,m.id,v.dia,v.turno);
      const pending=new Map();for(const r of s.passagensTurno.filter(r=>r.maquinaId===m.id&&r.resumo.inicio<resumo.inicio))for(const task of r.pendencias||[])if(!task.done)pending.set(task.id,{...task});
      String(v.pendencias||'').split('\n').map(t=>t.trim()).filter(Boolean).forEach(t=>{const key=uid('tarefa');pending.set(key,{id:key,texto:text(t,'pendência',300),done:false});});
      const r={id:handoverId(m.id,v.dia,v.turno),maquinaId:m.id,setorId:m.setorId,dia:v.dia,turno:String(v.turno),resumo,observacao:String(v.observacao||'').trim().slice(0,1000),acoesRealizadas:String(v.acoesRealizadas||'').trim().slice(0,1000),pendencias:[...pending.values()],status:'entregue',usuarioId:u.id,usuarioRe:u.re,entreguePor:u.nome,createdAt:at,updatedAt:at};
      s.passagensTurno.push(r);return r.id;
    }
    if(action==='handover-receive'){
      const r=item(s,'passagensTurno',id);require('passagem:gerenciar',r);
      if(r.status==='recebida')throw new Error('Passagem já recebida.');
      if(r.usuarioId===u.id)throw new Error('O recebimento deve ser confirmado por outra pessoa da liderança.');
      Object.assign(r,{status:'recebida',recebidoPor:u.nome,recebidoId:u.id,recebidoRe:u.re,recebidoEm:at,updatedAt:at});return r.id;
    }
    if(action==='handover-task'){
      const r=item(s,'passagensTurno',id);require('passagem:gerenciar',r);const task=(r.pendencias||[]).find(t=>t.id===v.taskId);
      if(!task||task.done)throw new Error('Pendência indisponível.');
      for(const h of s.passagensTurno.filter(h=>h.maquinaId===r.maquinaId))for(const t of h.pendencias||[])if(t.id===task.id){Object.assign(t,{done:true,doneAt:at,doneBy:u.nome,doneRe:u.re});h.updatedAt=at;h.atualizadoPor=u.id;}return r.id;
    }
    if(action==='batch-transition'){
      const b=item(s,'lotesQualidade',id);require('qualidade:decidir',b);
      const transitions={suspeito:['segregado'],segregado:['reinspecao'],reinspecao:['liberado','descartado']};
      if(!transitions[b.status]?.includes(v.status))throw new Error('Etapa inválida para este lote.');
      const observacao=text(v.observacao,'registro da avaliação / destino',1000);
      if(['liberado','descartado'].includes(v.status)){
        const checked=Number(v.inspecionadas),discarded=Number(v.descartadas);
        if(!Number.isSafeInteger(checked)||checked!==b.quantidade)throw new Error('Confirme a reinspeção de todas as peças do lote.');
        if(!Number.isSafeInteger(discarded)||discarded<b.refugosIdentificados||discarded>b.quantidade)throw new Error('O descarte deve incluir os refugos identificados e respeitar a quantidade do lote.');
        if(v.status==='descartado'&&discarded!==b.quantidade)throw new Error('Para descartar o lote inteiro, confirme a quantidade total.');
        if(v.status==='liberado'&&discarded===b.quantidade)throw new Error('Não há peças para liberar; selecione descarte.');
        Object.assign(b,{inspecionadas:checked,descartadas:discarded,liberadas:b.quantidade-discarded,destino:observacao});
        // Somente rejeições adicionais viram refugo. Os já apontados nunca são somados de novo.
        const extra=discarded-b.refugosIdentificados;
        if(extra>0)s.perdas.push({id:uid('descarte'),maquinaId:b.maquinaId,setorId:b.setorId,usuarioId:u.id,usuarioRe:u.re,data:at,tipo:'refugo',quantidade:extra,unidade:'pecas',lote:b.lote,produto:b.produto,motivo:'Reinspeção da Qualidade',observacao,createdAt:at,updatedAt:at,verificado:false,decisaoQualidade:true,loteQualidadeId:b.id});
      }
      b.status=v.status;history(b);
      // A decisão não deve reabrir o lote pelo próprio registro de descarte.
      b.revision=s.perdas.filter(r=>r.maquinaId===b.maquinaId&&r.lote===b.lote&&!r.decisaoQualidade&&['refugo','suspeito'].includes(r.tipo)).map(r=>r.id+':'+(r.updatedAt||r.data)+':'+r.quantidade).sort().join('|');
      return b.id;
    }
    if(action==='alert-transition'){
      const r=item(s,'atendimentosAlertas',id);require('alertas:gerenciar',r);
      const transitions={novo:['reconhecido'],reconhecido:['atendimento'],atendimento:['resolvido']};
      if(!transitions[r.status]?.includes(v.status))throw new Error('Etapa inválida para este alerta.');
      if(v.status==='resolvido'&&r.active)throw new Error('A condição ainda está ativa. Normalize a máquina ou conclua o registro de origem antes de resolver.');
      if(v.status!=='reconhecido')text(v.observacao,'ação realizada',1000);
      r.status=v.status;history(r);return r.id;
    }
    if(action==='staff-save'){
      const p=item(s,'perfis',v.funcionarioId);require('funcionarios:atribuir',{setorId:p.setorId});
      if(p.cargo!=='operador')throw new Error('Selecione um operador.');period(v.dia,v.turno);
      if(!['presente','ausente','pendente'].includes(v.presenca))throw new Error('Presença inválida.');
      const m=v.maquinaId?machine(s,v.maquinaId):null;if(m)require('funcionarios:atribuir',m);
      if(v.presenca==='ausente'&&m)throw new Error('Funcionário ausente não pode ocupar um posto.');
      let r=s.alocacoes.find(a=>a.funcionarioId===p.id&&a.dia===v.dia&&a.turno===String(v.turno));
      if(!r){r={id:uid('alocacao'),funcionarioId:p.id,funcionarioRe:p.re,setorId:p.setorId,dia:v.dia,turno:String(v.turno),createdAt:at,historico:[]};s.alocacoes.push(r);}
      Object.assign(r,{presenca:v.presenca,maquinaId:m?.id||'',setorDestino:m?.setorId||p.setorId,observacao:String(v.observacao||'').slice(0,1000),status:v.presenca});history(r);return r.id;
    }
    throw new Error('Ação indisponível.');
  }
  function beginMicro(s,id,seconds=15,code='travamento-pallet') {
    const m=machine(s,id),duration=Number(seconds);if(!Number.isInteger(duration)||duration<1||duration>59)throw new Error('A microparada deve durar de 1 a 59 segundos.');
    if(s.paradas.some(r=>r.maquinaId===id&&!r.fim))throw new Error('Esta máquina já está parada.');
    const r={id:uid('micro'),maquinaId:id,setorId:m.setorId,inicio:now(s),fim:0,motivo:'Aguardando classificação da liderança',motivoConfirmado:false,motivoSimulado:code,autoEnd:now(s)+duration*1000,automatica:true,kind:'parada',failure:false,usuarioId:'coleta-automatica',usuarioRe:'',createdAt:now(s),updatedAt:now(s),verificado:false};s.paradas.push(r);return r.id;
  }
  function advance(s,seconds) {
    const end=now(s)+seconds*1000;
    // Divide o avanço no instante em que a máquina retoma, preservando os ciclos seguintes.
    const edges=[...new Set(s.paradas.filter(r=>!r.fim&&r.autoEnd&&r.autoEnd<=end).map(r=>r.autoEnd))].sort((a,b)=>a-b);edges.push(end);
    let completed=0;
    for(const edge of edges){const delta=(edge-now(s))/1000;if(delta>0)completed+=MSA.scenarioLive.advance(s,delta);
      for(const r of s.paradas)if(!r.fim&&r.autoEnd&&r.autoEnd<=now(s)){r.fim=r.autoEnd;r.updatedAt=r.fim;r.encerradaPor='coleta-automatica';}
    }
    // Uma interrupção curta ocasional; controles permitem demonstrá-la sem esperar o acaso.
    if(s.demoAutoMicro!==false){s.nextMicroAt ||= now(s)+45000;if(now(s)>=s.nextMicroAt){s.nextMicroAt=now(s)+45000;const candidates=s.maquinas.filter(m=>!s.paradas.some(r=>r.maquinaId===m.id&&!r.fim));if(candidates.length&&Math.random()<(s.demoMicroRate??.12))beginMicro(s,candidates[Math.floor(Math.random()*candidates.length)].id,8+Math.floor(Math.random()*20));}}
    return completed;
  }
  MSA.workflows={collections,reasons,batchStatus,alertStatus,upgrade,reason,period,shiftAt,handoverId,handoverSummary,lotQuantity,sync,syncLots,syncAlerts,alertSources,allocation,command,beginMicro,advance};
})();
