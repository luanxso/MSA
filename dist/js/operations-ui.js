/* Páginas compartilhadas com dados, comandos e contexto definidos pelo cargo. */
(() => {
  'use strict';
  const content = document.querySelector('#page-content');
  const feedback = document.querySelector('#operation-feedback');
  const dialog = document.querySelector('#operation-dialog');
  const form = document.querySelector('#operation-form');
  const fields = document.querySelector('#operation-fields');
  const saveButton = document.querySelector('#operation-save');
  const formError = document.querySelector('#operation-error');
  const labels = { registrosProducao: 'Produção', leituras: 'Parâmetros', paradas: 'Parada', perdas: 'Qualidade', ocorrencias: 'Ocorrência' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const num = value => Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const day = value => new Date(value).toLocaleDateString('pt-BR');
  const time = value => new Date(value).toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' });
  const dateInput = value => { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const dateTimeInput = value => { const d = new Date(value); return `${dateInput(value)}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
  const badge = (text, style = '') => `<span class="ops-badge ${style}">${esc(text)}</span>`;
  const button = (text, action, collection = '', id = '', primary = false) => `<button type="button" class="${primary ? 'primary-button' : 'text-button'}" data-action="${action}" data-collection="${collection}" data-id="${esc(id)}">${esc(text)}</button>`;
  const panel = (title, body, actions = '') => `<section class="ops-panel"><div class="ops-panel-heading"><h2>${esc(title)}</h2>${actions}</div>${body}</section>`;
  const empty = text => `<div class="ops-empty"><strong>Nenhum registro encontrado</strong>${esc(text)}</div>`;
  function table(headers, rows, text = 'Os apontamentos aparecerão aqui após o registro.') {
    const numeric = headers.map(h=>/^(Meta do período|Aprovadas|Atendimento|Refugos|Material|Paradas|Quantidade|Duração)$/.test(h));
    return rows.length ? `<div class="ops-table-wrap" tabindex="0" role="region" aria-label="${esc(headers.join(', '))}"><table class="ops-table"><thead><tr>${headers.map((h,i)=>`<th scope="col" class="${numeric[i]?'numeric':''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((cell,i)=>`<td class="wrap ${numeric[i]?'numeric':''}">${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : empty(text);
  }
  let page = '';
  let sector = 'todos';
  let from = dateInput(Date.now());
  let to = from;
  let machineFilter = '';
  let state = MSA.data.state;
  let submitAction = null;
  let identity = '';
  let busy = false;
  const user = () => MSA.auth.session();
  const allowed = (permission, record) => MSA.rbac.can(permission, user(), record);
  const sectorName = id => MSA.config.sectors.find(s=>s.id===id)?.nome || id;
  const machineName = id => state.maquinas.find(m=>m.id===id)?.nome || id;
  const personName = id => state.perfis.find(p=>p.id===id)?.nome || (id===user()?.id ? user().nome : 'RE de origem no registro');
  const responsible = record => `${esc(personName(record.usuarioId))}${record.usuarioRe ? `<small>RE ${esc(record.usuarioRe)}</small>` : ''}`;
  function bounds() { const start = new Date(from+'T00:00:00').getTime(); const endDate = new Date(to+'T00:00:00'); endDate.setDate(endDate.getDate()+1); return [start,endDate.getTime()]; }
  function machines() { return state.maquinas.filter(m=>MSA.rbac.inScope(user(),m) && (sector==='todos'||m.setorId===sector) && (!machineFilter||m.id===machineFilter)); }
  function records(collection) { const [a,b] = bounds(); const ids = new Set(machines().map(m=>m.id)); return (state[collection]||[]).filter(r=>ids.has(r.maquinaId) && (collection==='paradas' ? r.inicio<b && (!r.fim||r.fim>=a) : MSA.metrics.within(r,a,b))).sort((x,y)=>(y.data||y.inicio||y.createdAt)-(x.data||x.inicio||x.createdAt)); }
  const summary = () => MSA.metrics.summarize(state,machines(),...bounds());
  function notify(message, error = false) { feedback.textContent=message; feedback.classList.toggle('is-error',error); feedback.hidden=false; }
  function toolbar(actions = '', dates = true) {
    const all = state.maquinas.filter(m=>MSA.rbac.inScope(user(),m) && (sector==='todos'||m.setorId===sector));
    return `<div class="ops-toolbar">${dates ? `<label>De<input type="date" id="ops-from" value="${from}"></label><label>Até<input type="date" id="ops-to" value="${to}"></label>` : ''}${user().cargo!=='operador' && page!=='funcionarios' && page!=='configuracoes' ? `<label>Máquina<select id="ops-machine"><option value="">Todas as máquinas</option>${all.map(m=>`<option value="${esc(m.id)}" ${m.id===machineFilter?'selected':''}>${esc(m.nome)}</option>`).join('')}</select></label>` : ''}<div class="toolbar-actions">${actions}</div></div>`;
  }
  function workContext() {
    if (user().cargo !== 'operador') return '';
    const groups=MSA.config.sectors.map(s=>{const items=state.maquinas.filter(m=>m.setorId===s.id);return items.length?`<optgroup label="${esc(s.nome)}">${items.map(m=>`<option value="${esc(m.id)}" ${m.id===user().maquinaId?'selected':''}>${esc(m.id)} / ${esc(m.nome)}</option>`).join('')}</optgroup>`:'';}).join('');
    return `<div class="ops-work-context"><label class="ops-field" for="ops-work-machine">Máquina em uso<select id="ops-work-machine" aria-describedby="ops-work-hint"><option value="" disabled ${!user().maquinaId?'selected':''}>Selecione a máquina</option>${groups}</select></label><p class="ops-note" id="ops-work-hint">Você pode trocar de máquina e setor. A troca vale para os próximos apontamentos.</p></div>`;
  }
  function stats(s = summary()) { return `<div class="ops-grid ops-summary">${[
    ['Produção aprovada', num(s.aprovadas)+' peças', s.meta ? `${num(s.atendimento)}% da meta de ${num(s.meta)}` : 'Meta ainda não configurada'],
    ['Refugos',num(s.refugos)+' peças',s.taxaRefugo===null ? 'Sem produção no período' : `${num(s.taxaRefugo)}% de refugo`],
    ['Perda de material',num(s.kg)+' kg','Perdas registradas no período'],
    ['Tempo de parada',num(s.minutos)+' min',`${s.abertas.length} ${s.abertas.length===1?'parada aberta':'paradas abertas'}`]
  ].map(([label,value,hint])=>`<article class="ops-stat"><span>${label}</span><strong>${value}</strong><small>${hint}</small></article>`).join('')}</div>`; }
  function verification(record) { return record.verificado ? `${badge('Conferido','good')}<small>${esc(personName(record.verificadoPor))}</small>` : badge('A conferir'); }
  function rowActions(collection, record) {
    let actions='';
    const perms={registrosProducao:'producao:registrar',leituras:'leituras:registrar',paradas:'paradas:registrar',perdas:'perdas:registrar',ocorrencias:'ocorrencias:registrar'};
    if (allowed(perms[collection],record) && !(collection==='ocorrencias' && record.status==='resolvida') && !(collection==='paradas' && record.fim)) actions+=button('Editar','edit',collection,record.id);
    if (!record.verificado && allowed('registros:verificar',record)) actions+=button('Conferir','review',collection,record.id);
    if (collection==='paradas' && !record.fim && (allowed('paradas:registrar',record)||allowed('paradas:gerenciar',record))) actions+=button('Encerrar','finish',collection,record.id);
    if (collection==='ocorrencias' && record.status!=='resolvida' && allowed('ocorrencias:gerenciar',record)) actions+=button('Resolver','resolve',collection,record.id);
    return actions ? `<div class="row-actions">${actions}</div>` : '—';
  }
  function productionTable(list = records('registrosProducao')) { return table(['Período / turno','Máquina / lote','Aprovadas','Responsável','Conferência','Ações'],list.map(r=>[`${time(r.inicio)}<small>até ${time(r.fim)} · ${esc(r.turno)}º turno</small>`,`${esc(machineName(r.maquinaId))}<small>${esc(r.produto)} · ${esc(r.lote)}</small>`,num(r.quantidade),responsible(r),verification(r),rowActions('registrosProducao',r)])); }
  function readingTable() { return table(['Data / lote','Máquina','Valores registrados','Responsável','Conferência','Ações'],records('leituras').map(r=>[`${time(r.data)}<small>${esc(r.lote)}</small>`,esc(machineName(r.maquinaId)),Object.entries(r.valores||{}).map(([key,value])=>{const p=state.maquinas.find(m=>m.id===r.maquinaId)?.parametros?.[key];return `${esc(p?.nome||key)}: ${num(value)} ${esc(p?.unidade||'')}`;}).join('<br>'),responsible(r),verification(r),rowActions('leituras',r)])); }
  function stopTable() { return table(['Início / fim','Máquina','Motivo / causa','Duração','Responsável','Conferência','Ações'],records('paradas').map(r=>[`${time(r.inicio)}<small>${r.fim?time(r.fim):'Em andamento'}</small>`,esc(machineName(r.maquinaId)),`${esc(r.motivo)}<small>${esc(r.causa||'')}</small>`,num(Math.max(0,(r.fim||Date.now())-r.inicio)/60000)+' min',responsible(r),verification(r),rowActions('paradas',r)])); }
  function lossTable() { return table(['Data / lote','Máquina','Tipo','Quantidade','Motivo','Responsável','Conferência','Ações'],records('perdas').map(r=>[`${time(r.data)}<small>${esc(r.produto)} · ${esc(r.lote)}</small>`,esc(machineName(r.maquinaId)),badge({refugo:'Refugo',perda:'Perda de material',suspeito:'Peças suspeitas'}[r.tipo],r.tipo==='suspeito'?'warning':''),`${num(r.quantidade)} ${esc(r.unidade)}`,esc(r.motivo),responsible(r),verification(r),rowActions('perdas',r)])); }
  function occurrenceTable() { return table(['Data','Máquina','Ocorrência / ação','Prioridade','Situação','Responsável','Ações'],records('ocorrencias').map(r=>[time(r.data),esc(machineName(r.maquinaId)),`${esc(r.descricao)}<small>${esc(r.resolucao||'')}</small>`,badge(r.prioridade,r.prioridade==='alta'?'danger':''),badge(r.status,r.status==='resolvida'?'good':'warning'),responsible(r),rowActions('ocorrencias',r)])); }
  function alerts(equipment = machines()) {
    const ids=new Set(equipment.map(m=>m.id));
    return [
      ...state.paradas.filter(r=>ids.has(r.maquinaId)&&!r.fim).map(r=>[badge('Parada aberta','danger'),esc(machineName(r.maquinaId)),esc(r.motivo),time(r.inicio),'<a class="ops-link" href="#paradas">Ver paradas</a>']),
      ...state.ocorrencias.filter(r=>ids.has(r.maquinaId)&&r.status==='aberta').map(r=>[badge('Ocorrência',r.prioridade==='alta'?'danger':'warning'),esc(machineName(r.maquinaId)),esc(r.descricao),time(r.data),'<a class="ops-link" href="#ocorrencias">Ver ocorrência</a>']),
      ...MSA.metrics.deviations(state,equipment).map(d=>[badge('Fora do limite','warning'),esc(d.machine.nome),`${esc(d.parameter.nome)}: ${num(d.value)} ${esc(d.parameter.unidade)} (limites ${num(d.parameter.min)} a ${num(d.parameter.max)})`,time(d.record.data),'<a class="ops-link" href="#producao">Ver leituras</a>'])
    ];
  }
  function byMachine() { return machines().map(m=>({machine:m,s:MSA.metrics.summarize(state,[m],...bounds())})); }
  function performanceRows() { return byMachine().map(({machine:m,s})=>[`${esc(m.nome)}<small>${esc(sectorName(m.setorId))}</small>`,num(s.meta),num(s.aprovadas),s.atendimento===null?'—':num(s.atendimento)+'%',num(s.refugos),num(s.kg)+' kg',num(s.minutos)+' min']); }
  function comparison() {
    const data=byMachine();
    return data.length ? `<div class="ops-bars">${data.map(({machine:m,s})=>`<div class="ops-bar"><span>${esc(m.nome)}</span><div class="ops-bar-track" role="meter" aria-label="Atendimento da meta ${esc(m.nome)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100,s.atendimento||0)}"><div class="ops-bar-fill" style="width:${Math.min(100,s.atendimento||0)}%"></div></div><span>${num(s.aprovadas)} / ${num(s.meta)} peças</span></div>`).join('')}</div>` : empty('Cadastre as máquinas e registre a produção.');
  }
  function machineProgress(machine, s) {
    if (s.atendimento===null) return '<span class="ops-muted">Meta não definida</span>';
    return `<div class="machine-progress"><span>${num(s.atendimento)}% <small>de ${num(s.meta)} peças</small></span><div class="ops-bar-track" role="meter" aria-label="Atendimento da meta ${esc(machine.nome)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100,s.atendimento)}" aria-valuetext="${num(s.atendimento)}% da meta"><div class="ops-bar-fill" style="width:${Math.min(100,s.atendimento)}%"></div></div></div>`;
  }
  function machineRegister() {
    const rows=byMachine();
    if(!rows.length)return empty('Cadastre uma máquina em Máquinas ou prepare o catálogo em Configurações.');
    return `<div class="machine-register"><div class="machine-register-heading" aria-hidden="true"><span>Equipamento / processo</span><span>Registro de parada</span><span>Aprovadas</span><span>Meta do período</span></div>${rows.map(({machine:m,s})=>`<article class="machine-register-row"><div class="machine-identity"><strong>${esc(m.id)}</strong><span>${esc(m.nome)}</span><small>${esc(m.processo)}${m.processo===sectorName(m.setorId)?'':' / '+esc(sectorName(m.setorId))}</small></div><div class="machine-condition">${s.abertas.length?badge('Parada aberta','danger'):badge('Sem parada aberta','good')}</div><div class="machine-output"><span class="mobile-label">Aprovadas</span><strong>${num(s.aprovadas)}</strong><small>peças</small></div>${machineProgress(m,s)}</article>`).join('')}</div>`;
  }
  function attention() {
    const list=alerts(),stopped=new Set(summary().abertas.map(r=>r.maquinaId)).size;
    const caption=list.length ? `${list.length} ${list.length===1?'pendência registrada':'pendências registradas'}` : 'Nenhuma pendência registrada';
    return `<div class="ops-attention ${list.length?'needs-attention':'is-clear'}"><div><strong>${caption}</strong><span>${stopped?`${stopped} ${stopped===1?'máquina com parada aberta':'máquinas com parada aberta'}.`:'Paradas, ocorrências e parâmetros das máquinas em acompanhamento.'}</span></div>${list.length?'<a class="ops-link" href="#notificacoes">Ver pendências</a>':''}</div>`;
  }
  function pendingList() {
    const list=alerts();
    return list.length ? `<ul class="pending-list">${list.map(([type,machine,info,since,action])=>`<li>${type}<strong>${machine}</strong><p>${info}</p><div><time>${since}</time>${action}</div></li>`).join('')}</ul>` : '<div class="ops-empty"><strong>Sem pendências abertas</strong>As ocorrências e os desvios registrados aparecerão aqui.</div>';
  }
  function overview() {
    const actions=allowed('producao:registrar')?button('Registrar produção','new','registrosProducao','',true):allowed('registros:verificar')?'<a class="secondary-button" href="#conferencia">Conferir registros</a>':'<a class="secondary-button" href="#indicadores">Ver indicadores</a>';
    return toolbar(actions)+attention()+stats()+`<div class="overview-layout"><section class="overview-machines"><div class="ops-panel-heading"><h2>Máquinas em acompanhamento</h2><a class="ops-link" href="#maquinas">Ver equipamentos</a></div>${machineRegister()}<p class="ops-note equipment-note">Estados baseados nas paradas registradas. Sem leitura automática dos equipamentos.</p></section><aside class="overview-pending"><h2>Pendências da operação</h2>${pendingList()}</aside></div>`;
  }
  function parameterRegister(machine) {
    const parameters=Object.entries(machine.parametros||{});
    const latest=state.leituras.filter(r=>r.maquinaId===machine.id).sort((a,b)=>b.data-a.data)[0];
    if(!parameters.length)return '<p class="ops-note">Parâmetros ainda não configurados.</p>';
    return `<details class="machine-parameters"><summary>Parâmetros de processo <span>${parameters.length}</span></summary><p class="ops-note">${latest?'Último apontamento: '+time(latest.data):'Sem leituras registradas.'}</p>${table(['Parâmetro','Última leitura','Limites configurados'],parameters.map(([key,p])=>{const value=latest?.valores?.[key],hasValue=value!==undefined;const deviates=hasValue&&(value<p.min||value>p.max);return[esc(p.nome),`${hasValue?num(value)+' '+esc(p.unidade):'Sem registro'}${deviates?'<small class="parameter-deviation">Fora do limite</small>':''}`,`${num(p.min)} a ${num(p.max)} ${esc(p.unidade)}`];}))}</details>`;
  }
  function machineCards() {
    return `<div class="machine-grid">${machines().map(m=>`<article class="machine-card"><header><div><span class="equipment-code">${esc(m.id)}</span><h2>${esc(m.nome)}</h2><p class="ops-muted">${esc(sectorName(m.setorId))}</p></div>${state.paradas.some(r=>r.maquinaId===m.id&&!r.fim)?badge('Parada registrada','danger'):badge('Sem parada aberta','good')}</header><dl><dt>Processo</dt><dd>${esc(m.processo)}</dd><dt>Produto</dt><dd>${esc(m.produto)}</dd><dt>Meta diária</dt><dd>${num(m.metaDiaria)} peças</dd></dl>${parameterRegister(m)}<div class="ops-actions">${allowed('maquinas:gerenciar',m)?button('Editar máquina','machine','',''+m.id):''}${allowed('metas:gerenciar',m)?button('Alterar meta','target','',m.id):''}</div></article>`).join('')}</div>`;
  }
  function reviewTable() {
    const rows=Object.keys(labels).flatMap(key=>records(key).filter(r=>!r.verificado).map(r=>[esc(labels[key]),time(r.data||r.inicio),esc(machineName(r.maquinaId)),responsible(r),esc(r.descricao||r.motivo||r.lote||''),rowActions(key,r)]));
    return table(['Registro','Data','Máquina','Responsável','Referência','Ações'],rows,'Todos os registros deste período foram conferidos ou ainda não há apontamentos.');
  }
  function staffTable() {
    const profiles=state.perfis.filter(p=>user().cargo==='chefe' ? (sector==='todos'||p.setorId===sector) : p.setorId===user().setorId);
    return table(['Funcionário / RE','Cargo','Setor atual','Máquina em uso','Ações'],profiles.map(p=>[`<strong class="staff-name">${esc(p.nome)}</strong><span class="staff-re">RE ${esc(p.re)}</span>`,esc(MSA.config.roles.find(r=>r.id===p.cargo)?.label||p.cargo),esc(sectorName(p.setorId)||(p.cargo==='chefe'?'Todos os setores':'Ainda não escolhido')),p.maquinaId?`<strong>${esc(p.maquinaId)}</strong><small>${esc(machineName(p.maquinaId))}</small>`:'<span class="ops-muted">Nenhuma selecionada</span>',p.cargo==='operador'&&allowed('funcionarios:atribuir')?button('Vincular máquina','assign','',p.id):'—']));
  }
  function reports() {
    const [a,b]=bounds();
    const list=state.consolidacoes.filter(r=>(sector==='todos'||r.setorId===sector)&&r.inicio<b&&r.fim>=a).sort((x,y)=>y.createdAt-x.createdAt);
    return table(['Período / setor','Consolidação do Supervisor','Responsável','Produção / perdas / paradas'],list.map(r=>{const s=MSA.metrics.summarize(state,state.maquinas.filter(m=>m.setorId===r.setorId),r.inicio,r.fim);return[`${time(r.inicio)}<small>até ${time(r.fim)} · ${esc(sectorName(r.setorId))}</small>`,esc(r.observacao),responsible(r),`${num(s.aprovadas)} peças aprovadas<small>${num(s.refugos)} refugos · ${num(s.kg)} kg · ${num(s.minutos)} min</small>`];}),'O Supervisor pode adicionar o resumo do setor em Conferência.');
  }
  function render() {
    const counter=document.querySelector('#notification-count');
    if(counter){
      const equipment=user()?state.maquinas.filter(m=>MSA.rbac.inScope(user(),m)&&(sector==='todos'||m.setorId===sector)):[];
      const count=state.ready?alerts(equipment).length:0;
      counter.textContent=count>99?'99+':String(count);counter.hidden=!count;
      counter.closest('a').setAttribute('aria-label',count?`Abrir notificações, ${count} pendências`:'Abrir notificações');
    }
    if (!page || !user() || !MSA.rbac.route(page,user())) { content.replaceChildren(); return; }
    if (page==='chat') return;
    if (state.error) { content.innerHTML=`<div class="operation-alert">${esc(state.error)} ${button('Tentar novamente','retry')}</div>`; return; }
    if (!state.ready) { content.innerHTML='<div class="ops-empty">Carregando os dados compartilhados…</div>'; return; }
    const s=summary();
    const context=workContext();
    const hasContext=user().cargo==='chefe'||(user().cargo==='operador'?state.maquinas.some(m=>m.id===user().maquinaId):!!user().setorId);
    if (!hasContext && page!=='configuracoes') {
      content.innerHTML=context+`<div class="ops-empty"><strong>${user().cargo==='operador'?'Escolha a máquina em uso':'Escolha o setor em acompanhamento'}</strong>${user().cargo==='operador'?(state.maquinas.length?'Selecione a máquina em que você está trabalhando. O setor será identificado automaticamente.':'O catálogo está vazio. O Supervisor ou o Chefe pode preparar as máquinas em Configurações.'):'Selecione um setor no topo para acompanhar a operação. Você pode trocar de setor durante o trabalho.'}</div>`;
      return;
    }
    let html='';
    if (page==='visao-geral') html=overview();
    if (page==='producao') html=toolbar()+stats(s)+panel('Planejado e realizado',table(['Máquina / setor','Meta do período','Aprovadas','Atendimento','Refugos','Material','Paradas'],performanceRows()))+panel('Apontamentos de produção',productionTable())+panel('Histórico de parâmetros',readingTable());
    if (page==='apontamentos') html=toolbar(button('Registrar produção','new','registrosProducao','',true)+button('Registrar parâmetros','new','leituras'))+panel('Minha máquina',`<p>${esc(machineName(user().maquinaId))} · ${esc(sectorName(user().setorId))}</p><p class="ops-note">Informe as peças aprovadas de cada período. Registre refugos e material perdido em Qualidade. Os dados ficam disponíveis para o Supervisor e o Chefe assim que o Firebase confirma o envio.</p>`)+panel('Produção registrada',productionTable())+panel('Parâmetros registrados',readingTable());
    if (page==='paradas') html=toolbar(allowed('paradas:registrar')?button('Registrar parada','new','paradas','',true):'')+stats(s)+panel('Histórico de paradas',stopTable());
    if (page==='qualidade') html=toolbar(allowed('perdas:registrar')?button('Registrar refugo / perda','new','perdas','',true):'')+stats(s)+panel('Refugos, material e peças suspeitas',`<p class="ops-note">Peças suspeitas: ${num(s.suspeitas)}. Refugos em peças e perdas em kg permanecem separados.</p>${lossTable()}`);
    if (page==='ocorrencias') html=toolbar(allowed('ocorrencias:registrar')?button('Registrar ocorrência','new','ocorrencias','',true):'')+panel('Ocorrências da operação',occurrenceTable());
    if (page==='maquinas') html=toolbar(allowed('maquinas:gerenciar')?button('Cadastrar máquina','machine','','',true):'',false)+(machines().length?machineCards():panel('Máquinas',empty('Prepare o catálogo de exemplo em Configurações ou cadastre uma máquina do setor.')))+`<p class="ops-note">A situação usa as paradas registradas pelos operadores. As metas são diárias. Os parâmetros do catálogo inicial são exemplos para demonstração e devem ser validados com a MSA.</p>`;
    if (page==='conferencia') html=toolbar(button('Consolidar setor','consolidate','','',true))+stats(s)+panel('Registros a conferir',reviewTable())+panel('Consolidações do setor',reports());
    if (page==='funcionarios') html=`<div class="staff-context"><strong>${state.perfis.filter(p=>user().cargo==='chefe'?(sector==='todos'||p.setorId===sector):p.setorId===user().setorId).length} funcionários no contexto selecionado</strong><span>A máquina indica o posto atual, sem vínculo permanente com o setor.</span></div>`+panel('Equipe e máquina em uso',staffTable())+'<p class="ops-note">O RE identifica a pessoa. Trocas de máquina ou setor preservam a origem dos apontamentos anteriores.</p>';
    if (page==='indicadores') {
      const comparisons=MSA.config.sectors.filter(sec=>sector==='todos'||sec.id===sector).map(sec=>{const x=MSA.metrics.summarize(state,machines().filter(m=>m.setorId===sec.id),...bounds());return[esc(sec.nome),num(x.aprovadas),num(x.meta),x.atendimento===null?'—':num(x.atendimento)+'%',num(x.refugos),num(x.kg)+' kg',num(x.minutos)+' min'];});
      html=toolbar()+stats(s)+panel('Desempenho por setor',table(['Setor','Aprovadas','Meta','Atendimento','Refugos','Material','Paradas'],comparisons))+panel('Atendimento das metas por máquina',comparison())+panel('Resumo dos supervisores',reports())+'<p class="ops-note">Indicadores calculados a partir dos registros do período. Metas consideram os dias selecionados; não representam OEE. Consolidações usam os dados atuais, inclusive correções posteriores.</p>';
    }
    if (page==='relatorios') html=toolbar(button('Exportar registros CSV','export','','',true))+stats(s)+panel('Consolidações dos supervisores',reports())+panel('Resumo por máquina',table(['Máquina / setor','Meta do período','Aprovadas','Atendimento','Refugos','Material','Paradas'],performanceRows()));
    if (page==='notificacoes') html=toolbar('',false)+panel('Pendências atuais',table(['Tipo','Máquina','Informação','Desde','Acesso'],alerts(),'Nenhuma pendência registrada nas máquinas do seu acesso.'));
    if (page==='configuracoes') html=panel('Meu acesso',`<dl class="profile-details"><dt>Nome</dt><dd>${esc(user().nome)}</dd><dt>RE</dt><dd>${esc(user().re)}</dd><dt>Cargo</dt><dd>${esc(MSA.auth.role(user()).label)}</dd><dt>Setor atual</dt><dd>${esc(sectorName(user().setorId)||(user().cargo==='chefe'?'Todos os setores':'Ainda não selecionado'))}</dd><dt>Máquina em uso</dt><dd>${esc(machineName(user().maquinaId)||'Nenhuma selecionada')}</dd></dl>`)+(allowed('maquinas:gerenciar')||allowed('setores:gerenciar')?panel('Preparar apresentação',hasContext?`<p>Cadastre as máquinas de exemplo ${user().cargo==='chefe'?'dos três setores':'do setor em acompanhamento'}. A preparação não cria apontamentos de produção.</p><p class="ops-note">Nomes, metas e limites iniciais são exemplos. Cadastros existentes são preservados.</p><div class="ops-actions">${button('Preparar máquinas de exemplo','seed','','',true)}</div>`:'<p>Selecione um setor no topo para preparar suas máquinas de exemplo.</p>'):'');
    content.innerHTML=context+html;
  }
  function field(name,label,value='',type='text',options='') { return `<label class="ops-field ${type==='textarea'?'full':''}">${esc(label)}${type==='textarea'?`<textarea name="${name}" maxlength="2000" ${options}>${esc(value)}</textarea>`:`<input name="${name}" type="${type}" value="${esc(value)}" ${options}>`}</label>`; }
  function select(name,label,values,value,required=true) { return `<label class="ops-field">${esc(label)}<select name="${name}" ${required?'required':''}>${values.map(([key,text])=>`<option value="${esc(key)}" ${key===value?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`; }
  function open(title,html,action) {
    if (busy) return;
    form.reset(); submitAction=action; fields.innerHTML=`<div class="ops-form-grid">${html}</div>`; formError.hidden=true;
    document.querySelector('#operation-dialog-title').textContent=title;
    dialog.showModal();
  }
  function operationForm(collection,id='') {
    const existing=id?state[collection].find(r=>r.id===id):null;
    const machine=state.maquinas.find(m=>m.id===(existing?.maquinaId||user().maquinaId));
    if (!machine) { notify('Sua máquina precisa estar cadastrada antes do apontamento.',true); return; }
    const permissions={registrosProducao:'producao:registrar',leituras:'leituras:registrar',paradas:'paradas:registrar',perdas:'perdas:registrar',ocorrencias:'ocorrencias:registrar'};
    MSA.rbac.require(permissions[collection],user(),existing||machine);
    const r=existing||{}; const now=Date.now();
    let html=`<p class="ops-form-note">${esc(machine.nome)} · ${esc(sectorName(machine.setorId))} · RE ${esc(user().re)}</p>`;
    if (collection==='registrosProducao') html+=field('quantidade','Peças aprovadas',r.quantidade??'','number','min="0" step="1" required')+select('turno','Turno',[['1','1º turno'],['2','2º turno'],['3','3º turno']],r.turno||'1')+field('inicio','Início do período',dateTimeInput(r.inicio||now-3600000),'datetime-local','required')+field('fim','Fim do período',dateTimeInput(r.fim||now),'datetime-local','required')+field('produto','Produto',r.produto||machine.produto,'text','maxlength="120" required')+field('lote','Lote / ordem de produção',r.lote||'','text','maxlength="80" required');
    if (collection==='paradas') html+=field('inicio','Início da parada',dateTimeInput(r.inicio||now),'datetime-local','required')+field('fim','Fim (deixe vazio se em andamento)',r.fim?dateTimeInput(r.fim):'','datetime-local')+field('motivo','Motivo da parada',r.motivo||'','text','maxlength="300" required');
    if (collection==='perdas') html+=select('tipo','Tipo',[['refugo','Refugo em peças'],['perda','Perda de material em kg'],['suspeito','Peças suspeitas / segregadas']],r.tipo||'refugo')+field('quantidade','Quantidade (peças ou kg conforme tipo)',r.quantidade??'','number','min="0.001" step="any" required')+field('data','Data e horário',dateTimeInput(r.data||now),'datetime-local','required')+field('motivo','Motivo',r.motivo||'','text','maxlength="300" required')+field('produto','Produto',r.produto||machine.produto,'text','maxlength="120" required')+field('lote','Lote / ordem',r.lote||'','text','maxlength="80" required');
    if (collection==='ocorrencias') html+=field('data','Data e horário',dateTimeInput(r.data||now),'datetime-local','required')+select('prioridade','Prioridade',[['normal','Normal'],['alta','Alta']],r.prioridade||'normal')+field('descricao','Descrição da ocorrência',r.descricao||'','textarea','required');
    if (collection==='leituras') {
      const parameters=Object.entries(machine.parametros||{});
      if (!parameters.length) { notify('O Supervisor precisa configurar os parâmetros e limites desta máquina em Máquinas.',true); return; }
      html+=field('data','Data e horário',dateTimeInput(r.data||now),'datetime-local','required')+field('lote','Lote / ordem',r.lote||'','text','maxlength="80" required');
      html+=parameters.map(([key,p])=>field('valor_'+key,`${p.nome} (${p.unidade}) · ${num(p.min)} a ${num(p.max)}`,r.valores?.[key]??'','number','step="any" required')).join('');
    }
    html+=field('observacao','Observações',r.observacao||'','textarea','maxlength="1000"');
    open((id?'Editar ':'Registrar ')+labels[collection].toLowerCase(),html,values=>{values.maquinaId=machine.id;if(collection==='leituras')values.valores=Object.fromEntries(Object.keys(machine.parametros).map(key=>[key,values['valor_'+key]]));return MSA.data.save(collection,values,id||undefined);});
  }
  function parameterRow(index,key='',p={}) { return `<div class="ops-parameter"><input type="hidden" name="key_${index}" value="${esc(key)}">${field('nome_'+index,'Parâmetro',p.nome||'','text','maxlength="80"')}${field('unidade_'+index,'Unidade',p.unidade||'','text','maxlength="20"')}${field('min_'+index,'Mínimo',p.min??'','number','step="any"')}${field('max_'+index,'Máximo',p.max??'','number','step="any"')}</div>`; }
  function machineForm(id) {
    MSA.rbac.require('maquinas:gerenciar',user());
    const m=state.maquinas.find(item=>item.id===id)||{};
    const params=Object.entries(m.parametros||{});
    const html=field('codigo','Código',id||'','text',id?'readonly':'maxlength="40" required')+field('nome','Nome da máquina',m.nome||'','text','maxlength="120" required')+field('processo','Processo',m.processo||'','text','maxlength="120" required')+field('produto','Produto',m.produto||'','text','maxlength="120" required')+field('metaDiaria','Meta diária (peças)',m.metaDiaria??0,'number','min="0" step="1" required')+`<p class="ops-form-note">Setor: ${esc(sectorName(user().setorId))}. Configure limites válidos para cada parâmetro. Limpe o nome para remover um parâmetro.</p><input type="hidden" name="paramCount" value="${params.length||1}"><div class="ops-parameter-list" id="ops-parameters">${params.length?params.map(([key,p],index)=>parameterRow(index,key,p)).join(''):parameterRow(0)}</div><div class="ops-actions">${button('Adicionar parâmetro','add-parameter')}</div>`;
    open(id?'Editar máquina':'Cadastrar máquina',html,values=>MSA.data.saveMachine({...values,setorId:user().setorId},id||undefined));
  }
  async function action(name,collection,id) {
    if (!user() || !MSA.rbac.route(page,user())) throw new Error('Esta tela não está disponível para seu cargo.');
    if (name==='new'||name==='edit') return operationForm(collection,name==='edit'?id:'');
    if (name==='machine') return machineForm(id);
    if (name==='review') { await MSA.data.review(collection,id); notify('Registro conferido.'); return; }
    if (name==='finish') return open('Encerrar parada',field('causa','Causa / ação realizada','','textarea','maxlength="300"'),values=>MSA.data.finishStop(id,values.causa));
    if (name==='resolve') return open('Resolver ocorrência',field('resolucao','Ação realizada','','textarea','maxlength="1000" required'),values=>MSA.data.resolveOccurrence(id,values.resolucao));
    if (name==='target') { const m=state.maquinas.find(m=>m.id===id);MSA.rbac.require('metas:gerenciar',user(),m);return open('Alterar meta diária',field('meta','Peças por dia',m.metaDiaria,'number','min="0" step="1" required'),values=>MSA.data.setTarget(id,values.meta)); }
    if (name==='assign') { const p=state.perfis.find(p=>p.id===id);MSA.rbac.require('funcionarios:atribuir',user());return open('Vincular máquina',`<p class="ops-form-note">${esc(p.nome)} · RE ${esc(p.re)}</p>`+select('maquinaId','Máquina',state.maquinas.filter(m=>m.setorId===p.setorId).map(m=>[m.id,m.nome]),p.maquinaId),values=>MSA.data.assignMachine(id,values.maquinaId)); }
    if (name==='consolidate') { MSA.rbac.require('consolidacoes:registrar',user()); const [a,b]=bounds(); return open('Consolidar informações do setor',field('inicio','Início',dateTimeInput(a),'datetime-local','required')+field('fim','Fim',dateTimeInput(Math.min(b-60000,Date.now())),'datetime-local','required')+field('observacao','Resumo, causas e pendências','','textarea','maxlength="2000" required'),values=>MSA.data.consolidate(values)); }
    if (name==='seed') { await MSA.data.initializeExamples(); notify('Catálogo preparado. Máquinas existentes foram preservadas.');return; }
    if (name==='retry') { await MSA.data.start(user());return; }
    if (name==='export') { MSA.rbac.require('relatorios:ler',user());exportCSV();return; }
  }
  function exportCSV() {
    const cell=value=>{let text=String(value??'');if(/^[=+@-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
    const rows=[['tipo','id','setor','maquina','usuario_id','RE','data','inicio','fim','produto','lote','quantidade','unidade','motivo','conferido','conferido_por','atualizado_em']];
    Object.keys(labels).forEach(key=>records(key).forEach(r=>rows.push([key,r.id,r.setorId,r.maquinaId,r.usuarioId,r.usuarioRe||'',r.data?time(r.data):'',r.inicio?time(r.inicio):'',r.fim?time(r.fim):'',r.produto||'',r.lote||'',r.quantidade??'',r.unidade||(key==='registrosProducao'?'pecas':''),r.motivo||r.descricao||JSON.stringify(r.valores||{}),r.verificado?'sim':'nao',r.verificadoPor||'',time(r.updatedAt||r.createdAt)])));
    const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(r=>r.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`MSA-registros-${from}-${to}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  content.addEventListener('change',event=>{
    if (event.target.id==='ops-work-machine') {
      const control=event.target;
      if(busy)return;
      control.disabled=true;
      void MSA.data.changeContext({maquinaId:control.value}).then(()=>notify('Máquina em uso atualizada.')).catch(error=>{notify(error.message,true);render();});
      return;
    }
    if (event.target.id==='ops-machine') machineFilter=event.target.value;
    if (event.target.id==='ops-from'||event.target.id==='ops-to') { const next=event.target.value; if(!/^\d{4}-\d{2}-\d{2}$/.test(next))return;if(event.target.id==='ops-from')from=next;else to=next;if(from>to)to=from; }
    render();
  });
  async function handleAction(event) {
    const target=event.target.closest('[data-action]');if(!target||busy)return;
    if(target.dataset.action==='add-parameter') { const input=form.elements.paramCount;const index=Number(input.value);if(index>=100)return;document.querySelector('#ops-parameters').insertAdjacentHTML('beforeend',parameterRow(index));input.value=index+1;return; }
    target.disabled=true;
    try { await action(target.dataset.action,target.dataset.collection,target.dataset.id); }
    catch(error) { notify(error.message,true); }
    finally { target.disabled=false; }
  }
  content.addEventListener('click',handleAction);fields.addEventListener('click',handleAction);
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!submitAction||busy)return;
    if(!form.reportValidity())return;
    busy=true;saveButton.disabled=true;saveButton.textContent='Salvando…';formError.hidden=true;
    try { await submitAction(Object.fromEntries(new FormData(form)));dialog.close();notify('Informações salvas no Firebase.'); }
    catch(error) { formError.textContent=error.message;formError.hidden=false; }
    finally { busy=false;saveButton.disabled=false;saveButton.textContent='Salvar'; }
  });
  const close=()=>{if(!busy)dialog.close();};document.querySelector('#operation-close').addEventListener('click',close);document.querySelector('#operation-cancel').addEventListener('click',close);dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  MSA.data.subscribe(next=>{state=next;render();});
  MSA.operations = {
    open(nextPage,nextSector) {
      const u=user();if(!u)return;
      const key=[u.id,u.cargo,u.setorId,u.maquinaId].join('|');
      if(key!==identity || MSA.data.user?.id!==u.id) { identity=key;machineFilter='';if(dialog.open)dialog.close();void MSA.data.start(u); }
      if(nextPage!==page||nextSector!==sector)machineFilter='';
      page=nextPage;sector=nextSector;render();
    }, notify
  };
})();
