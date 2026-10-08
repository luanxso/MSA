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
  const secondsTimeInput=value=>dateTimeInput(value)+':'+String(new Date(value).getSeconds()).padStart(2,'0');
  const dateTimeInput = value => { const d = new Date(value); return `${dateInput(value)}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
  const badge = (text, style = '') => `<span class="ops-badge ${style}">${esc(text)}</span>`;
  const button = (text, action, collection = '', id = '', primary = false, secondary = false) => `<button type="button" class="${primary ? 'primary-button' : secondary ? 'secondary-button' : 'text-button'}" data-action="${action}" data-collection="${collection}" data-id="${esc(id)}">${esc(text)}</button>`;
  const panel = (title, body, actions = '') => `<section class="ops-panel"><div class="ops-panel-heading"><h2>${esc(title)}</h2>${actions}</div>${body}</section>`;
  const empty = text => `<div class="ops-empty"><strong>Nenhum registro encontrado</strong>${esc(text)}</div>`;
  const tabDefinitions={
    producao:[['resumo','Resumo'],['turnos','Por turno'],['horas','Hora a hora'],['apontamentos','Apontamentos'],['parametros','Parâmetros']],
    qualidade:[['resumo','Resumo'],['lotes','Lotes em avaliação'],['perdas','Refugos e perdas'],['historico','Histórico']],
    paradas:[['resumo','Resumo'],['abertas','Em andamento'],['micro','Microparadas'],['historico','Histórico']]
  };
  const activeTabs={producao:'resumo',qualidade:'resumo',paradas:'resumo'},listPages=new Map(),listQueries={producao:'',qualidade:'',paradas:''};
  const pageSize=8;
  const resetListPages=()=>listPages.clear();
  function tabbed(body){
    const tabs=tabDefinitions[page],active=activeTabs[page];
    return `<div class="ops-tabs" role="tablist" aria-label="Seções de ${esc(MSA.config.areas[page])}">${tabs.map(([key,label])=>`<button type="button" id="ops-tab-${key}" role="tab" aria-controls="ops-tab-content" aria-selected="${active===key}" tabindex="${active===key?'0':'-1'}" data-action="ops-tab" data-id="${key}">${label}</button>`).join('')}</div><div id="ops-tab-content" role="tabpanel" aria-labelledby="ops-tab-${active}">${body}</div>`;
  }
  function listSearch(){return `<div class="ops-toolbar ops-list-search"><label>Buscar nas listas<input type="search" id="ops-list-search" value="${esc(listQueries[page])}" placeholder="Máquina, lote ou motivo" autocomplete="off" aria-controls="ops-tab-content"></label>${button('Limpar busca','list-search-reset','','',false,true)}<p class="ops-note">Indicadores seguem os filtros do topo. A busca filtra as listas da aba selecionada.</p></div>`;}
  function table(headers, rows, text = 'Os apontamentos aparecerão aqui após o registro.') {
    const keep=tabDefinitions[page]&&headers.includes('Responsável')?headers.map((h,i)=>['Responsável','Conferência'].includes(h)?-1:i).filter(i=>i>=0):null;
    if(keep)headers=keep.map(i=>headers[i]);
    const numeric = headers.map(h=>/^(Meta do período|Aprovadas|Atendimento|Refugos|Material|Paradas|Quantidade|Duração)$/.test(h));
    const paged=!!tabDefinitions[page],key=[page,activeTabs[page],...headers].join('|');
    if(paged&&listQueries[page]){const query=normalize(listQueries[page]);rows=rows.filter(row=>{if(row.search!=null)return normalize(row.search).includes(query);const template=document.createElement('template');template.innerHTML=row.join(' ');return normalize(template.content.textContent+' '+[...template.content.querySelectorAll('a[href]')].map(a=>decodeURIComponent(a.getAttribute('href'))).join(' ')).includes(query);});}
    const count=rows.length,pages=Math.max(1,Math.ceil(count/pageSize)),current=Math.min(listPages.get(key)||1,pages),start=(current-1)*pageSize;
    if(paged){listPages.set(key,current);rows=rows.slice(start,start+pageSize);}
    rows=rows.map(row=>{const cells=row.cells?row.cells():row;return keep?keep.map(i=>cells[i]):cells;});
    const navigation=paged&&count?`<nav class="equipment-pagination ops-pagination" aria-label="Páginas de ${esc(headers[0])}" data-list-key="${esc(key)}"><span role="status">${start+1}–${Math.min(start+pageSize,count)} de ${count} registros</span><div><button type="button" class="secondary-button" data-action="list-page" data-table-key="${esc(key)}" data-id="${current-1}" ${current===1?'disabled':''}>Anterior</button><span>Página ${current} de ${pages}</span><button type="button" class="secondary-button" data-action="list-page" data-table-key="${esc(key)}" data-id="${current+1}" ${current===pages?'disabled':''}>Próxima</button></div></nav>`:'';
    return (rows.length ? `<div class="ops-table-wrap ${paged?'ops-paged-table':''}" tabindex="0" role="region" aria-label="${esc(headers.join(', '))}"><table class="ops-table"><thead><tr>${headers.map((h,i)=>`<th scope="col" class="${numeric[i]?'numeric':''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((cell,i)=>`<td data-label="${esc(headers[i])}" class="wrap ${numeric[i]?'numeric':''} ${/Responsável|Conferência/.test(headers[i])?'ops-secondary-cell':''}">${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : empty(paged&&listQueries[page]?'Altere a busca ou limpe os filtros para ver outros registros.':text))+navigation;
  }
  let page = '';
  let sector = 'todos';
  let from = dateInput(Date.now());
  let to = from;
  let machineFilter = '';
  let shiftFilter='todos';
  let catalogueSearch='',catalogueStatus='todos',catalogueOrder='priority',cataloguePage=1;
  const catalogueSize=8;
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  let productionVisited=false;
  const filteredState=()=>page==='producao'?MSA.shifts.filter(state,shiftFilter):state;
  let state = MSA.data.state;
  let submitAction = null;
  let identity = '';
  let busy = false;
  const user = () => MSA.auth.session();
  const allowed = (permission, record) => MSA.rbac.can(permission, user(), record);
  const sectorName = id => MSA.config.sectors.find(s=>s.id===id)?.nome || id;
  const machineName = id => state.maquinas.find(m=>m.id===id)?.nome || id;
  const personName = id => state.perfis.find(p=>p.id===id)?.nome || (id===user()?.id ? user().nome : 'RE de origem no registro');
  const responsible = record => record.automatica?'Coleta automática<small>Classificação pela liderança</small>':`${esc(personName(record.usuarioId))}${record.usuarioRe ? `<small>RE ${esc(record.usuarioRe)}</small>` : ''}`;
  const workflowContext=()=>({state,user:user(),sector,machines,records,bounds,allowed,table,panel,badge,kpis,machineLink,machineName,sectorName,open,field,select,form,notify});
  const workflowPanel=area=>MSA.workflowUI?.render(area,workflowContext())||'';
  function bounds() { const start = new Date(from+'T00:00:00').getTime(); const endDate = new Date(to+'T00:00:00'); endDate.setDate(endDate.getDate()+1); return [start,endDate.getTime()]; }
  function machines() { return state.maquinas.filter(m=>MSA.rbac.inScope(user(),m) && (sector==='todos'||m.setorId===sector) && (!machineFilter||m.id===machineFilter)); }
  function records(collection) { const [a,b] = bounds(); const ids = new Set(machines().map(m=>m.id)); return (filteredState()[collection]||[]).filter(r=>ids.has(r.maquinaId) && (collection==='paradas' ? (r.diaProducao?MSA.shifts.within(r,a,b):r.inicio<b && (!r.fim||r.fim>=a)) : MSA.metrics.within(r,a,b))).sort((x,y)=>(y.data||y.inicio||y.createdAt)-(x.data||x.inicio||x.createdAt)); }
  const summary = () => MSA.metrics.summarize(filteredState(),machines(),...bounds());
  function notify(message, error = false) { feedback.textContent=message; feedback.classList.toggle('is-error',error); feedback.hidden=false; }
  function toolbar(actions = '', dates = true) {
    const all = state.maquinas.filter(m=>MSA.rbac.inScope(user(),m) && (sector==='todos'||m.setorId===sector));
    return `<div class="ops-toolbar">${dates ? `<label>De<input type="date" id="ops-from" value="${from}"></label><label>Até<input type="date" id="ops-to" value="${to}"></label>` : ''}${user().cargo!=='operador' && page!=='funcionarios' && page!=='configuracoes' ? `<label>Máquina<select id="ops-machine"><option value="">Todas as máquinas</option>${all.map(m=>`<option value="${esc(m.id)}" ${m.id===machineFilter?'selected':''}>${esc(m.nome)}</option>`).join('')}</select></label>` : ''}${page==='producao'?`<label>Turno<select id="ops-shift"><option value="todos" ${shiftFilter==='todos'?'selected':''}>Todos os turnos</option>${MSA.shifts.definitions.map(t=>`<option value="${t.id}" ${shiftFilter===t.id?'selected':''}>${t.label} · ${t.hours}</option>`).join('')}</select></label>`:''}<div class="toolbar-actions">${actions}</div></div>`;
  }
  function workContext() {
    if (user().cargo !== 'operador') return '';
    const groups=MSA.config.sectors.map(s=>{const items=state.maquinas.filter(m=>m.setorId===s.id);return items.length?`<optgroup label="${esc(s.nome)}">${items.map(m=>`<option value="${esc(m.id)}" ${m.id===user().maquinaId?'selected':''}>${esc(m.id)} / ${esc(m.nome)}</option>`).join('')}</optgroup>`:'';}).join('');
    return `<div class="ops-work-context"><label class="ops-field" for="ops-work-machine">Máquina em uso<select id="ops-work-machine" aria-describedby="ops-work-hint"><option value="" disabled ${!user().maquinaId?'selected':''}>Selecione a máquina</option>${groups}</select></label><p class="ops-note" id="ops-work-hint">Você pode trocar de máquina e setor. A troca vale para os próximos apontamentos.</p></div>`;
  }
  function stats(s = summary()) { return `<div class="ops-grid ops-summary">${[
    ['Produção aprovada', num(s.aprovadas), 'peças', s.meta ? `${num(s.atendimento)}% da meta de ${num(s.meta)}` : 'Meta ainda não configurada'],
    ['Refugos',num(s.refugos),'peças',s.taxaRefugo===null ? 'Sem produção no período' : `${num(s.taxaRefugo)}% de refugo`],
    ['Perda de material',num(s.kg),'kg','Perdas registradas no período'],
    ['Tempo de parada',num(s.minutos),'min',`${s.abertas.length} ${s.abertas.length===1?'parada aberta':'paradas abertas'}`]
  ].map(([label,value,unit,hint])=>`<article class="ops-stat"><span>${label}</span><strong>${value} <small class="ops-unit">${unit}</small></strong><small>${hint}</small></article>`).join('')}</div>`; }
  const perf = (equipment=machines()) => MSA.performance.calculate(filteredState(),equipment,...bounds());
  const duration = seconds => seconds==null?'—':num(seconds/60)+' min';
  const machineLink = id => `<a class="ops-link" href="#mapa-planta/@${encodeURIComponent(id)}">${esc(machineName(id))}</a>`;
  const pageLink = (area,id,label) => `<a class="ops-link" href="#${area}/${encodeURIComponent(id)}">${label}</a>`;
  function kpis(items){return `<div class="ops-grid ops-summary">${items.map(([label,value,unit,hint])=>`<article class="ops-stat"><span>${label}</span><strong>${value} <small class="ops-unit">${unit}</small></strong><small>${hint||''}</small></article>`).join('')}</div>`;}
  function performanceStats(){const x=perf();return kpis([['Produtividade',x.productivity==null?'—':num(x.productivity),'%','Aprovadas / meta acumulada do período'],['OEE',x.efficiency?num(x.efficiency.oee):'—','%','Disponibilidade × desempenho × qualidade'],['MTBF',duration(x.mtbf),'','Operação / falhas encerradas'],['MTTR',duration(x.mttr),'','Tempo de reparo / falhas encerradas']]);}
  function productionStats(){const x=perf(),s=summary();return kpis([['Peças aprovadas',num(x.good),'peças','Volume apontado nos equipamentos'],['Planejado no período',num(x.target),'peças','Metas das janelas apontadas'],['Produtividade',x.productivity==null?'—':num(x.productivity),'%','Aprovadas / planejado'],['Ordens em produção',new Set(s.producao.map(r=>r.ordem||r.lote)).size,'','Rastreabilidade por máquina e lote']]);}
  let shiftDetail=null;
  const shiftTabs=[['machines','Máquinas'],['hours','Hora a hora'],['team','Equipe'],['issues','Paradas e problemas']];
  const percent=value=>value==null?'—':num(value)+'%';
  function analyzeShift(id){return MSA.shiftAnalysis.analyze(state,machines(),...bounds(),id);}
  function shiftSituation(x){if(x.windows.length===1)return x.future?'Não iniciado':x.running?'Em andamento':'Encerrado';return `${x.closed} encerrados${x.running?' · '+x.running+' em andamento':''}${x.future?' · '+x.future+' não iniciados':''}`;}
  function shiftComparison(){
    const data=MSA.shifts.definitions.map(t=>({t,x:analyzeShift(t.id)})),valid=data.filter(({x})=>x.hasData&&x.productivity!=null),base=data[0].x;
    const cards=`<div class="shift-comparison-grid">${data.map(({t,x})=>`<article class="shift-card ${shiftFilter===t.id?'is-selected':''}" data-shift-card="${t.id}"><header><div><h3>${t.label}</h3><p>${esc(t.hours)}</p></div>${badge(x.running?'Em andamento':x.future?(x.closed?'Período misto':'Não iniciado'):'Encerrado',x.running||(x.future&&x.closed)?'warning':x.future?'':'good')}</header><p class="shift-period-status">${esc(shiftSituation(x))}</p><div class="shift-output"><span>Peças aprovadas</span><strong>${x.hasData?num(x.good):'—'}</strong></div><dl class="shift-metrics"><div><dt>Meta acumulada</dt><dd>${x.target==null?'—':num(x.target)} <small>peças</small></dd></div><div><dt>Cumprimento da meta</dt><dd>${x.hasData?percent(x.productivity):'—'}</dd></div><div><dt>OEE</dt><dd>${percent(x.oee)}</dd></div><div><dt>Tempo de parada</dt><dd>${num(x.downtime/60)} <small>min</small></dd></div><div><dt>Microparadas</dt><dd>${x.microCount} <small>· ${num(x.microSeconds)} s</small></dd></div><div><dt>Refugos</dt><dd>${num(x.rejected)} <small>peças</small></dd></div><div><dt>Taxa de refugo</dt><dd>${percent(x.rejectRate)}</dd></div><div><dt>Material perdido</dt><dd>${num(x.material)} <small>kg</small></dd></div></dl><p class="ops-note">${x.hasData?`Meta integral: ${x.fullTarget==null?'não configurada':num(x.fullTarget)+' peças'}`:'Sem apontamentos de produção neste turno.'}</p>${button('Ver detalhes','shift-detail','',t.id)}</article>`).join('')}</div>`;
    const signed=(v,unit='')=>(v>0?'+':'')+num(v)+unit;
    const comparisons=base.hasData?data.slice(1).filter(({x})=>x.hasData).map(({t,x})=>{const sameTime=Math.abs(x.planned-base.planned)<1;return [t.label+' × 1º turno',sameTime?signed(x.good-base.good)+' peças':'Tempos observados diferentes',sameTime&&base.good?signed((x.good-base.good)/base.good*100,'%'):'—',x.productivity!=null&&base.productivity!=null?signed(x.productivity-base.productivity,' p.p.'):'—',x.oee!=null&&base.oee!=null?signed(x.oee-base.oee,' p.p.'):'—',x.rejectRate!=null&&base.rejectRate!=null?signed(x.rejectRate-base.rejectRate,' p.p.'):'—'];}):[];
    let insight='Selecione um dia anterior para comparar três turnos concluídos.';
    if(valid.length>1){const top=[...valid].sort((a,b)=>b.x.productivity-a.x.productivity)[0];insight=`Maior cumprimento da meta: ${top.t.label}, ${percent(top.x.productivity)}. ${data.some(({x})=>x.running||x.future)?'O período contém turnos incompletos; a meta acumulada considera somente o tempo transcorrido.':'Os turnos do período selecionado estão encerrados.'}`;}
    return cards+`<div class="shift-comparison-insight"><p>${esc(insight)}</p>${button('Comparar dia anterior','shift-previous-day')}</div>`+(comparisons.length?`<h3 class="shift-differences-title">Diferenças em relação ao 1º turno</h3>${table(['Comparação','Diferença de aprovadas','Variação de aprovadas','Cumprimento da meta','OEE','Taxa de refugo'],comparisons)}<p class="ops-note">p.p. = pontos percentuais. Volumes absolutos só são comparados com tempos observados iguais, nas mesmas máquinas.</p>`:'')+`<p class="ops-note">Metas acumuladas usam a meta horária e o tempo transcorrido do turno. OEE é ponderado pelo tempo planejado; — indica base incompleta. Horários ilustrativos. Quantidades de várias etapas não representam produtos finais únicos.</p>`;
  }
  function shiftDetailTable(headers,rows,key){
    const pages=Math.max(1,Math.ceil(rows.length/pageSize)),pageNumber=Math.min(shiftDetail.pages[key]||1,pages);shiftDetail.pages[key]=pageNumber;const at=(pageNumber-1)*pageSize,list=rows.slice(at,at+pageSize);
    if(!list.length)return empty('Nenhum registro deste turno no período selecionado.');
    return `<div class="ops-table-wrap ops-paged-table"><table class="ops-table"><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${list.map(row=>`<tr>${row.map((cell,i)=>`<td class="wrap" data-label="${esc(headers[i])}">${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div><nav class="equipment-pagination" aria-label="Páginas de ${esc(headers[0])}"><span role="status">${at+1}–${Math.min(at+pageSize,rows.length)} de ${rows.length} registros</span><div><button type="button" class="secondary-button" data-action="shift-detail-page" data-table-key="${key}" data-id="${pageNumber-1}" ${pageNumber===1?'disabled':''}>Anterior</button><span>Página ${pageNumber} de ${pages}</span><button type="button" class="secondary-button" data-action="shift-detail-page" data-table-key="${key}" data-id="${pageNumber+1}" ${pageNumber===pages?'disabled':''}>Próxima</button></div></nav>`;
  }
  function shiftDetailBody(){
    const x=shiftDetail.analysis,t=MSA.shifts.definitions.find(t=>t.id===x.shift),mini=shiftDetailTable;
    const sections={
      machines:()=>mini(['Máquina / setor','Aprovadas / meta acumulada','Cumprimento da meta / OEE','Paradas / microparadas','Refugos / taxa'],[...x.machines].sort((a,b)=>b.downtime-a.downtime||a.machine.id.localeCompare(b.machine.id)).map(m=>[`${machineLink(m.machine.id)}<small>${esc(sectorName(m.machine.setorId))}</small>`,`${num(m.good)} / ${m.target==null?'—':num(m.target)} peças`,`${percent(m.productivity)}<small>OEE ${percent(m.oee)}</small>`,`${num(m.downtime/60)} min<small>${m.microCount} microparadas · ${num(m.microSeconds)} s</small>`,`${num(m.rejected)} peças<small>${percent(m.rejectRate)}</small>`]),'machines'),
      hours:()=>mini(['Data / janela','Aprovadas','Meta da janela','Cumprimento da meta'],x.hours.map(h=>[time(h.at),num(h.good)+' peças',h.unknownTarget?'—':num(h.target)+' peças',h.unknownTarget?'—':percent(h.target?h.good/h.target*100:null)]),'hours')+'<p class="ops-note">Mais recentes primeiro. Metas das janelas vêm dos intervalos apontados; a meta acumulada do turno considera o tempo transcorrido.</p>',
      team:()=>'<p class="ops-note">Presença só é confirmada quando há alocação registrada para aquele dia e turno. O RE dos apontamentos indica participação, sem confirmar presença ou jornada completa.</p>'+mini(['Dia de produção','Funcionário / RE','Posto registrado','Presença / origem'],x.team.map(p=>[day(new Date(p.day+'T12:00:00')),`${esc(p.name)}<small>RE ${esc(p.re||'não informado')}</small>`,p.machineId?machineLink(p.machineId):'Sem posto',`${badge({presente:'Presente',ausente:'Ausente',pendente:'A confirmar','sem-confirmacao':'Sem confirmação'}[p.presence]||'Sem confirmação',p.presence==='presente'?'good':'')}<small>${esc(p.source)}</small>`]),'team'),
      issues:()=>`<h3>Principais motivos de parada</h3>${mini(['Motivo','Tempo no turno'],x.reasons.map(([reason,seconds])=>[esc(reason),num(seconds/60)+' min']),'reasons')}<h3>Paradas e microparadas</h3>${mini(['Máquina','Início / fim','Motivo','Tempo neste turno'],x.stops.map(r=>[machineLink(r.maquinaId),time(r.inicio)+`<small>${r.fim?time(r.fim):'Em andamento'}</small>`,esc(r.motivo),num(r.seconds)+' s']),'stops')}<h3>Ocorrências e alertas registrados no período</h3>${mini(['Máquina','Registro','Situação atual'],[...x.issues.map(r=>({id:r.maquinaId,text:r.descricao,status:r.status,at:r.data})),...x.alerts.map(r=>({id:r.maquinaId,text:r.descricao,status:MSA.workflows?.alertStatus[r.status]||r.status,at:r.createdAt}))].sort((a,b)=>b.at-a.at).map(r=>[machineLink(r.id),esc(r.text),esc(r.status)]),'issues')}<p class="ops-note">Tempos são divididos na virada do turno. Motivos podem conter intervalos sobrepostos; o total de parada elimina sobreposições por máquina. A situação dos registros é a atual.</p>`
    };
    return `<section class="full shift-detail"><p class="ops-note">${esc(t.hours)} · ${esc(shiftDetail.from)} a ${esc(shiftDetail.to)} · ${esc(shiftSituation(x))}</p>${kpis([['Aprovadas',num(x.good),'peças','No turno e período selecionados'],['Meta acumulada',x.target==null?'—':num(x.target),'peças','Proporcional ao tempo transcorrido'],['OEE',x.oee==null?'—':num(x.oee),'%','Ponderado pelo tempo planejado'],['Tempo de parada',num(x.downtime/60),'min',`${x.microCount} microparadas iniciadas`]])}<div class="ops-tabs" role="tablist" aria-label="Detalhes do turno">${shiftTabs.map(([id,label])=>`<button type="button" role="tab" id="shift-detail-tab-${id}" aria-selected="${shiftDetail.tab===id}" tabindex="${shiftDetail.tab===id?'0':'-1'}" aria-controls="shift-detail-content" data-action="shift-detail-tab" data-id="${id}">${label}</button>`).join('')}</div><div id="shift-detail-content" role="tabpanel" aria-labelledby="shift-detail-tab-${shiftDetail.tab}">${sections[shiftDetail.tab]()}</div><p class="ops-note">Dados consultados às ${esc(time(shiftDetail.snapshotAt))}. ${button('Atualizar detalhes','shift-detail-refresh')}</p></section>`;
  }
  function openShiftDetail(id){if(!MSA.shifts.definitions.some(t=>t.id===id))return;shiftDetail={snapshotAt:state.scenarioAt||Date.now(),analysis:analyzeShift(id),tab:'machines',pages:{},from:day(new Date(from+'T12:00:00')),to:day(new Date(to+'T12:00:00'))};open('Detalhes · '+id+'º turno',shiftDetailBody(),null);dialog.classList.add('shift-analysis-dialog');}
  function renderShiftDetail(){if(!shiftDetail||!dialog.open)return;fields.innerHTML=`<div class="ops-form-grid">${shiftDetailBody()}</div>`;}
  function qualityStats(){const x=summary();return kpis([['Refugos',num(x.refugos),'peças','Peças rejeitadas'],['Taxa de refugo',x.taxaRefugo==null?'—':num(x.taxaRefugo),'%','Refugos / (aprovadas + refugos)'],['Peças segregadas',num(x.suspeitas),'peças','Aguardando decisão da Qualidade'],['Perda de material',num(x.kg),'kg','Material de ajuste e descarte']]);}
  function stopStats(){const x=perf();return kpis([['Tempo de parada',num(x.downtime/60),'min','Intervalos sem sobreposição'],['Paradas abertas',summary().abertas.length,'','Situação atual da operação'],['MTBF',duration(x.mtbf),'','Operação / falhas encerradas'],['MTTR',duration(x.mttr),'','Reparos concluídos no período']]);}
  function groupedReasons(collection){const groups=new Map();for(const r of records(collection)){if(collection==='perdas'&&r.tipo!=='refugo')continue;const n=collection==='paradas'?Math.max(0,(r.fim||state.scenarioAt||Date.now())-r.inicio)/60000:r.quantidade;groups.set(r.motivo,(groups.get(r.motivo)||0)+n);}const rows=[...groups].sort((a,b)=>b[1]-a[1]);return table(['Motivo',collection==='paradas'?'Duração':'Quantidade'],rows.map(([m,n])=>[esc(m),num(n)+(collection==='paradas'?' min':' peças')]));}
  function hourlyPanel(){const hours=MSA.performance.hourly(filteredState(),machines(),...bounds());return table(['Hora / período','Aprovadas','Planejado','Produtividade'],hours.sort((a,b)=>b.time-a.time).map(h=>{const value=h.target?h.goodCount/h.target*100:null;return[time(h.time)+'<small>Janela de 1 hora</small>',num(h.goodCount),num(h.target),`<div class="hour-progress"><div class="ops-bar-track"><div class="ops-bar-fill" style="width:${Math.min(100,value||0)}%"></div></div><strong>${value==null?'—':num(value)+'%'}</strong></div>`];}));}
  function efficiencyRows(){return machines().map(m=>{const x=perf([m]);return[machineLink(m.id),x.productivity==null?'—':num(x.productivity)+'%',x.efficiency?num(x.efficiency.oee)+'%':'—',x.efficiency?num(x.efficiency.availability)+'%':'—',x.efficiency?num(x.efficiency.performance)+'%':'—',x.efficiency?num(x.efficiency.quality)+'%':'—',duration(x.mtbf),duration(x.mttr)];});}
  function criticalMachine(){const m=machines().find(m=>m.id==='NHPL');if(!m)return '';const x=perf([m]),sample=state.demo?MSA.performance.sample(m,state):{order:x.production.at(-1)?.ordem,batch:x.production.at(-1)?.lote,alarms:[]};return panel('NHPL · Equipamento principal',`<div class="critical-machine"><div><strong>${machineLink(m.id)}</strong><p>Montagem de abafadores VGARD HP / MARK V</p><p>${esc(sample.order||'—')} · ${esc(sample.batch||'—')} · 1º turno</p></div><div><strong>${num(x.good)} peças</strong><p>Produtividade ${num(x.productivity)}% · OEE ${x.efficiency?num(x.efficiency.oee)+'%':'—'}</p><p>${esc(sample.alarms[0]?.description||'Sem alerta ativo')}</p></div></div>`,pageLink('producao',m.id,'Ver hora a hora'));}
  function previousDay(){const start=new Date(state.scenarioAt||Date.now());start.setDate(start.getDate()-1);start.setHours(0,0,0,0);const end=+start+86400000,x=MSA.performance.calculate(state,machines(),+start,end);return panel('Dia anterior · preparação da reunião',`<div class="previous-day"><span>${day(+start)}</span><strong>${num(x.good)} peças aprovadas</strong><span>${num(x.downtime/60)} min de parada · ${num(x.rejected)} refugos</span><p>Prioridade do dia: verificar abastecimento, conferir desvios de processo e acompanhar reincidência na NHPL.</p></div>`);}
  function verification(record) { return record.verificado ? `${badge('Conferido','good')}<small>${esc(personName(record.verificadoPor))}</small>` : badge('A conferir'); }
  function rowActions(collection, record) {
    let actions=tabDefinitions[page]?button('Detalhes','record-detail',collection,record.id):'';
    const perms={registrosProducao:'producao:registrar',leituras:'leituras:registrar',paradas:'paradas:registrar',perdas:'perdas:registrar',ocorrencias:'ocorrencias:registrar'};
    if (allowed(perms[collection],record) && !(collection==='ocorrencias' && record.status==='resolvida') && !(collection==='paradas' && record.fim)) actions+=button('Editar','edit',collection,record.id);
    if (!record.verificado && allowed('registros:verificar',record)) actions+=button('Conferir','review',collection,record.id);
    if(collection==='paradas'&&record.automatica&&allowed('paradas:gerenciar',record))actions+=button('Selecionar motivo','wf-classify','',record.id);
    if (collection==='paradas' && !record.fim && (allowed('paradas:registrar',record)||allowed('paradas:gerenciar',record))) actions+=button('Encerrar','finish',collection,record.id);
    if (collection==='ocorrencias' && record.status!=='resolvida' && allowed('ocorrencias:gerenciar',record)) actions+=button('Resolver','resolve',collection,record.id);
    return actions ? `<div class="row-actions">${actions}</div>` : '—';
  }
  function lazyRows(list,build){return list.map(r=>({search:[r.maquinaId,machineName(r.maquinaId),r.lote,r.ordem,r.produto,r.motivo,r.causa,r.observacao,MSA.shifts.definitions.find(t=>t.id===r.turno)?.label,r.valores?Object.keys(r.valores).map(k=>state.maquinas.find(m=>m.id===r.maquinaId)?.parametros?.[k]?.nome||k).join(' '):''].join(' '),cells:()=>build(r)}));}
  function productionTable(list = records('registrosProducao')) { return table(['Período / turno','Máquina / lote','Aprovadas','Responsável','Conferência','Ações'],lazyRows(list,r=>[`${time(r.inicio)}<small>até ${time(r.fim)} · ${esc(r.turno)}º turno</small>`,`${machineLink(r.maquinaId)}<small>${esc(r.produto)} · ${esc(r.lote)} · ${esc(r.ordem||"Ordem não informada")}</small>`,num(r.quantidade),(tabDefinitions[page]?'':responsible(r)),(tabDefinitions[page]?'':verification(r)),rowActions('registrosProducao',r)])); }
  function readingTable() { return table(['Data / lote','Máquina','Valores registrados','Responsável','Conferência','Ações'],lazyRows(records('leituras'),r=>[`${time(r.data)}<small>${esc(r.lote)}</small>`,machineLink(r.maquinaId),Object.entries(r.valores||{}).map(([key,value])=>{const p=state.maquinas.find(m=>m.id===r.maquinaId)?.parametros?.[key];return `${esc(p?.nome||key)}: ${num(value)} ${esc(p?.unidade||'')}`;}).join('<br>'),(tabDefinitions[page]?'':responsible(r)),(tabDefinitions[page]?'':verification(r)),rowActions('leituras',r)])); }
  function stopTable(list=records('paradas')) { return table(['Início / fim','Máquina','Motivo / causa','Duração','Responsável','Conferência','Ações'],lazyRows(list,r=>[`${new Date(r.inicio).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'medium'})}<small>${r.fim?new Date(r.fim).toLocaleTimeString('pt-BR'):'Em andamento'}</small>`,machineLink(r.maquinaId),`${esc(r.motivo)}<small>${esc(r.causa||'')}</small>`,num(Math.max(0,(r.fim||state.scenarioAt||Date.now())-r.inicio)/1000)+' s',(tabDefinitions[page]?'':responsible(r)),(tabDefinitions[page]?'':verification(r)),rowActions('paradas',r)])); }
  function lossTable(list=records('perdas')) { return table(['Data / lote','Máquina','Tipo','Quantidade','Motivo','Responsável','Conferência','Ações'],lazyRows(list,r=>[`${time(r.data)}<small>${esc(r.produto)} · ${esc(r.lote)} · ${esc(r.ordem||"Ordem não informada")}</small>`,machineLink(r.maquinaId),badge({refugo:'Refugo',perda:'Perda de material',suspeito:'Peças suspeitas'}[r.tipo],r.tipo==='suspeito'?'warning':''),`${num(r.quantidade)} ${r.unidade==='pecas'?'peças':esc(r.unidade)}`,esc(r.motivo),(tabDefinitions[page]?'':responsible(r)),(tabDefinitions[page]?'':verification(r)),rowActions('perdas',r)])); }
  function occurrenceTable() { return table(['Data','Máquina','Ocorrência / ação','Prioridade','Situação','Responsável','Ações'],records('ocorrencias').map(r=>[time(r.data),machineLink(r.maquinaId),`${esc(r.descricao)}<small>${esc(r.resolucao||'')}</small>`,badge(r.prioridade,r.prioridade==='alta'?'danger':''),badge(r.status,r.status==='resolvida'?'good':'warning'),responsible(r),rowActions('ocorrencias',r)])); }
  function alerts(equipment = machines()) {
    const ids=new Set(equipment.map(m=>m.id));
    const now=state.scenarioAt||Date.now(),start=new Date(now).setHours(0,0,0,0),end=new Date(start);end.setDate(end.getDate()+1);
    if(state.atendimentosAlertas)return state.atendimentosAlertas.filter(r=>ids.has(r.maquinaId)&&r.status!=='resolvido').map(r=>[badge(r.tipo,'warning'),machineLink(r.maquinaId),esc(r.descricao)+'<small>'+esc(MSA.workflows.alertStatus[r.status])+' · '+esc(r.destinatario)+'</small>',time(r.createdAt),pageLink('notificacoes',r.maquinaId,'Acompanhar ação')]);
    return [
      ...equipment.flatMap(m=>{const x=MSA.performance.hourly(state,[m],start,+end).at(-1);const value=x?.target?x.goodCount/x.target*100:null;const recipient=MSA.performance.recipient(value);return recipient?[[badge('Produtividade',value<60?'danger':'warning'),machineLink(m.id),`${num(value)}% · ${esc(recipient)} · ${time(x.time)}. Destinatário previsto.`,time(x.time),pageLink('producao',m.id,'Ver hora a hora')]]:[];}),
      ...state.paradas.filter(r=>ids.has(r.maquinaId)&&!r.fim).map(r=>[badge('Parada aberta','danger'),machineLink(r.maquinaId),esc(r.motivo),time(r.inicio),pageLink('paradas',r.maquinaId,'Ver paradas')]),
      ...state.ocorrencias.filter(r=>ids.has(r.maquinaId)&&r.status==='aberta').map(r=>[badge('Ocorrência',r.prioridade==='alta'?'danger':'warning'),machineLink(r.maquinaId),esc(r.descricao),time(r.data),pageLink('ocorrencias',r.maquinaId,'Ver ocorrência')]),
      ...MSA.metrics.deviations(state,equipment).map(d=>[badge('Fora do limite','warning'),esc(d.machine.nome),`${esc(d.parameter.nome)}: ${num(d.value)} ${esc(d.parameter.unidade)} (limites ${num(d.parameter.min)} a ${num(d.parameter.max)})`,time(d.record.data),pageLink('producao',d.machine.id,'Ver leituras')])
    ];
  }
  function byMachine() { return machines().map(m=>({machine:m,s:MSA.metrics.summarize(filteredState(),[m],...bounds())})); }
  function performanceRows() { return byMachine().map(({machine:m,s})=>[`${machineLink(m.id)}<small>${esc(sectorName(m.setorId))}</small>`,num(s.meta),num(s.aprovadas),s.atendimento===null?'—':num(s.atendimento)+'%',num(s.refugos),num(s.kg)+' kg',num(s.minutos)+' min']); }
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
    return `<div class="machine-register"><div class="machine-register-heading" aria-hidden="true"><span>Equipamento / processo</span><span>Registro de parada</span><span>Aprovadas</span><span>Meta do período</span></div>${rows.map(({machine:m,s})=>`<article class="machine-register-row"><div class="machine-identity"><strong>${machineLink(m.id)}</strong><span>${esc(m.nome)}</span><small>${esc(m.processo)}${m.processo===sectorName(m.setorId)?'':' / '+esc(sectorName(m.setorId))}</small></div><div class="machine-condition">${s.abertas.length?badge('Parada aberta','danger'):badge('Sem parada aberta','good')}</div><div class="machine-output"><span class="mobile-label">Aprovadas</span><strong>${num(s.aprovadas)}</strong><small>peças</small></div>${machineProgress(m,s)}</article>`).join('')}</div>`;
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
    return toolbar(actions)+attention()+performanceStats()+criticalMachine()+previousDay()+`<div class="overview-layout"><section class="overview-machines"><div class="ops-panel-heading"><h2>Máquinas em acompanhamento</h2><a class="ops-link" href="#maquinas">Ver equipamentos</a></div>${machineRegister()}<p class="ops-note equipment-note">Condições e contagens compartilham a mesma fonte do Mapa da Planta.</p></section><aside class="overview-pending"><h2>Pendências da operação</h2>${pendingList()}</aside></div>`;
  }
  function parameterRegister(machine) {
    const parameters=Object.entries(machine.parametros||{});
    const latest=state.leituras.filter(r=>r.maquinaId===machine.id).sort((a,b)=>b.data-a.data)[0];
    if(!parameters.length)return '<p class="ops-note">Parâmetros ainda não configurados.</p>';
    return `<details class="machine-parameters"><summary>Parâmetros de processo <span>${parameters.length}</span></summary><p class="ops-note">${latest?'Último apontamento: '+time(latest.data):'Sem leituras registradas.'}</p>${table(['Parâmetro','Última leitura','Limites configurados'],parameters.map(([key,p])=>{const value=latest?.valores?.[key],hasValue=value!==undefined;const deviates=hasValue&&(value<p.min||value>p.max);return[esc(p.nome),`${hasValue?num(value)+' '+esc(p.unidade):'Sem registro'}${deviates?'<small class="parameter-deviation">Fora do limite</small>':''}`,`${num(p.min)} a ${num(p.max)} ${esc(p.unidade)}`];}))}</details>`;
  }
  function catalogueInfo(m){
    const at=state.scenarioAt||Date.now(),start=new Date(at).setHours(0,0,0,0),end=new Date(start);end.setDate(end.getDate()+1);
    const sum=MSA.metrics.summarize(state,[m],start,+end),open=state.paradas.find(r=>r.maquinaId===m.id&&!r.fim);
    if(state.demo){const sample=MSA.performance.sample(m,state);return{machine:m,status:sample.state,statusLabel:MSA.telemetry.states[sample.state],alarms:sample.alarms.length,good:sample.goodCount,rejected:sample.rejectedCount,oee:sample.efficiency?.oee??null,summary:sum};}
    const alarms=MSA.metrics.deviations(state,[m]).length+state.ocorrencias.filter(r=>r.maquinaId===m.id&&r.status==='aberta').length;
    return{machine:m,status:open?(open.kind||'parada'):'normal',statusLabel:open?MSA.telemetry.states[open.kind||'parada']:'Sem parada aberta',alarms,good:sum.aprovadas,rejected:sum.refugos,oee:MSA.performance.calculate(state,[m],start,+end).efficiency?.oee??null,summary:sum};
  }
  function catalogueBadge(entry){return badge(entry.statusLabel,['parada','manutencao'].includes(entry.status)?'danger':entry.status==='setup'?'warning':'good');}
  function catalogueToolbar(){
    const available=MSA.config.sectors.filter(s=>user().cargo!=='operador'||s.id===user().setorId);
    return `<div class="ops-toolbar equipment-toolbar"><label class="equipment-search">Buscar máquina<input id="catalogue-search" type="search" value="${esc(catalogueSearch)}" placeholder="Código, nome ou produto" autocomplete="off" aria-controls="equipment-results"></label><label>Setor<select id="catalogue-sector" ${user().cargo==='operador'?'disabled':''}>${user().cargo==='chefe'?'<option value="todos">Todos os setores</option>':''}${available.map(s=>`<option value="${esc(s.id)}" ${sector===s.id?'selected':''}>${esc(s.nome)}</option>`).join('')}</select></label><label>Situação<select id="catalogue-status">${[['todos','Todas'],['normal','Em operação / sem parada'],['parada','Parada'],['setup','Setup'],['manutencao','Manutenção'],['alerta','Com alertas']].map(([v,label])=>`<option value="${v}" ${catalogueStatus===v?'selected':''}>${label}</option>`).join('')}</select></label><label>Ordenar por<select id="catalogue-order">${[['priority','Prioridade operacional'],['code','Código da máquina'],['output','Produção de hoje']].map(([v,label])=>`<option value="${v}" ${catalogueOrder===v?'selected':''}>${label}</option>`).join('')}</select></label></div>`;
  }
  function catalogueTable(entries){
    return `<div class="ops-table-wrap equipment-table" role="region" tabindex="0" aria-label="Máquinas encontradas"><table class="ops-table"><thead><tr>${['Equipamento','Setor / processo','Situação','Aprovadas hoje','Meta diária','OEE hoje','Acesso'].map((h,i)=>`<th scope="col" ${[3,4,5].includes(i)?'class="numeric"':''}>${h}</th>`).join('')}</tr></thead><tbody>${entries.map(e=>{const m=e.machine;return `<tr class="equipment-row" data-equipment-id="${esc(m.id)}"><td class="equipment-identity"><span class="equipment-code">${esc(m.id)}</span><strong>${machineLink(m.id)}</strong><small>${esc(m.produto||'Produto não informado')}</small></td><td class="equipment-process"><span class="equipment-mobile-label" aria-hidden="true">Setor / processo</span>${esc(sectorName(m.setorId))}<small>${m.processo===sectorName(m.setorId)?'':esc(m.processo)}</small></td><td class="equipment-condition"><span class="equipment-mobile-label" aria-hidden="true">Situação</span>${catalogueBadge(e)}${e.alarms?`<small class="equipment-alert-count">${e.alarms} ${e.alarms===1?'alerta':'alertas'}</small>`:''}</td><td class="numeric"><span class="equipment-mobile-label" aria-hidden="true">Aprovadas hoje</span><strong>${num(e.good)}</strong><small>peças</small></td><td class="numeric"><span class="equipment-mobile-label" aria-hidden="true">Meta diária</span>${num(m.metaDiaria)}<small>peças</small></td><td class="numeric"><span class="equipment-mobile-label" aria-hidden="true">OEE hoje</span>${e.oee===null?'—':num(e.oee)+'%'}</td><td class="equipment-actions"><div class="row-actions">${button('Detalhes','machine-detail','',m.id)}<a class="ops-link" href="#mapa-planta/@${encodeURIComponent(m.id)}">Ver no mapa</a></div></td></tr>`;}).join('')}</tbody></table></div>`;
  }
  function machinesPage(){
    const base=machines().map(catalogueInfo),query=normalize(catalogueSearch);
    const entries=base.filter(e=>(!query||normalize([e.machine.id,e.machine.nome,e.machine.produto,sectorName(e.machine.setorId)].join(' ')).includes(query))&&(catalogueStatus==='todos'||catalogueStatus==='alerta'&&e.alarms>0||catalogueStatus==='normal'&&['operando','normal'].includes(e.status)||e.status===catalogueStatus));
    const priority=e=>['parada','manutencao','setup'].includes(e.status)?3:e.alarms?2:e.machine.id==='NHPL'?1:0;
    entries.sort((a,b)=>catalogueOrder==='output'?b.good-a.good||a.machine.id.localeCompare(b.machine.id):catalogueOrder==='priority'?priority(b)-priority(a)||a.machine.id.localeCompare(b.machine.id):a.machine.id.localeCompare(b.machine.id));
    const totalPages=Math.max(1,Math.ceil(entries.length/catalogueSize));cataloguePage=Math.min(cataloguePage,totalPages);
    const start=(cataloguePage-1)*catalogueSize,list=entries.slice(start,start+catalogueSize);
    const counters=kpis([['Equipamentos encontrados',entries.length,'',`${base.length} no contexto selecionado`],['Em operação',entries.filter(e=>['operando','normal'].includes(e.status)).length,'',state.demo?'Cenário atual da planta':'Sem parada aberta registrada'],['Em intervenção',entries.filter(e=>['parada','manutencao','setup'].includes(e.status)).length,'','Parada, setup ou manutenção'],['Com alertas',entries.filter(e=>e.alarms>0).length,'','Produtividade, processo ou ocorrência']]);
    const reset=button('Limpar filtros','catalogue-reset');
    const navigation=entries.length?`<nav class="equipment-pagination" aria-label="Páginas das máquinas"><span id="equipment-results-count" role="status">${start+1}–${Math.min(start+catalogueSize,entries.length)} de ${entries.length} equipamentos</span><div><button type="button" class="secondary-button" data-action="catalogue-page" data-id="${cataloguePage-1}" ${cataloguePage===1?'disabled':''}>Anterior</button><span>Página ${cataloguePage} de ${totalPages}</span><button type="button" class="secondary-button" data-action="catalogue-page" data-id="${cataloguePage+1}" ${cataloguePage===totalPages?'disabled':''}>Próxima</button></div></nav>`:'';
    const results=list.length?catalogueTable(list):`<div class="ops-empty"><strong>Nenhuma máquina encontrada</strong>Altere a busca ou a situação selecionada.<div class="ops-actions">${reset}</div></div>`;
    return catalogueToolbar()+counters.replace('class="ops-summary"','class="ops-summary equipment-summary"')+`<section class="ops-panel equipment-catalogue" id="equipment-results"><div class="ops-panel-heading"><h2>Equipamentos ${sector==='todos'?'da planta':'· '+esc(sectorName(sector))}</h2><div class="ops-actions">${reset}${allowed('maquinas:gerenciar')?button('Cadastrar máquina','machine','','',true):''}<a class="ops-link" href="#mapa-planta">Abrir mapa da planta</a></div></div>${results}${navigation}</section><p class="ops-note">Produção e OEE mostram o dia atual. Abra Detalhes para consultar parâmetros e acessar os painéis do equipamento.</p>`;
  }
  function machineDetails(id){
    const m=state.maquinas.find(m=>m.id===id);if(!m||!MSA.rbac.inScope(user(),m))throw new Error('Máquina indisponível neste acesso.');
    const e=catalogueInfo(m);
    const details=`<section class="equipment-detail full"><div class="equipment-detail-heading"><div><span class="equipment-code">${esc(m.id)}</span><p>${esc(sectorName(m.setorId))}</p></div>${catalogueBadge(e)}</div>${kpis([['Aprovadas hoje',num(e.good),'peças','Contagem do equipamento'],['Meta diária',num(m.metaDiaria),'peças','Meta cadastrada'],['OEE hoje',e.oee===null?'—':num(e.oee),'%',e.oee===null?'Sem base completa para cálculo':'Disponibilidade × desempenho × qualidade'],['Alertas ativos',e.alarms,'','Pendências atuais']])}<dl class="profile-details"><dt>Processo</dt><dd>${esc(m.processo)}</dd><dt>Produto</dt><dd>${esc(m.produto)}</dd><dt>Refugos hoje</dt><dd>${num(e.rejected)} peças</dd><dt>Tempo de parada</dt><dd>${num(e.summary.minutos)} min</dd></dl>${parameterRegister(m).replace('class="machine-parameters"','class="machine-parameters" open')}<nav class="equipment-detail-links" aria-label="Painéis do equipamento"><a class="ops-link" href="#mapa-planta/@${encodeURIComponent(id)}">Ver no mapa</a>${pageLink('producao',id,'Produção')}${pageLink('paradas',id,'Paradas')}${pageLink('qualidade',id,'Qualidade')}</nav><div class="ops-actions">${allowed('maquinas:gerenciar',m)?button('Editar máquina','machine','',id):''}${allowed('metas:gerenciar',m)?button('Alterar meta','target','',id):''}</div></section>`;
    open(m.nome,details,null);
  }
  function reviewTable() {
    const rows=Object.keys(labels).flatMap(key=>records(key).filter(r=>!r.verificado).map(r=>[esc(labels[key]),time(r.data||r.inicio),machineLink(r.maquinaId),responsible(r),esc(r.descricao||r.motivo||r.lote||''),rowActions(key,r)]));
    return table(['Registro','Data','Máquina','Responsável','Referência','Ações'],rows,'Todos os registros deste período foram conferidos ou ainda não há apontamentos.');
  }
  function staffTable() {
    const profiles=state.perfis.filter(p=>user().cargo==='chefe' ? (sector==='todos'||p.setorId===sector) : p.setorId===user().setorId);
    return table(['Funcionário / RE','Cargo','Setor atual','Máquina em uso','Presença / escala','Ações'],profiles.map(p=>[`<strong class="staff-name">${esc(p.nome)}</strong><span class="staff-re">RE ${esc(p.re)}</span>`,esc(MSA.config.roles.find(r=>r.id===p.cargo)?.label||p.cargo),esc(sectorName(p.setorId)||(p.cargo==='chefe'?'Todos os setores':'Ainda não escolhido')),p.maquinaId?`<strong>${esc(p.maquinaId)}</strong><small>${esc(machineName(p.maquinaId))}</small>`:'<span class="ops-muted">Nenhuma selecionada</span>',`${badge(p.presente===false?'Ausente':'Presente',p.presente===false?'warning':'good')}<small>${esc(p.escala||'Turno a informar')}</small>`,p.cargo==='operador'&&allowed('funcionarios:atribuir')?button('Vincular máquina','assign','',p.id):'—']));
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
    if(state.ready&&user()&&MSA.alertSound)MSA.alertSound.update((state.atendimentosAlertas||[]).filter(r=>MSA.rbac.inScope(user(),r)&&r.status!=='resolvido'));
    if (!page || !user() || !MSA.rbac.route(page,user())) { content.replaceChildren(); return; }
    if (page==='chat') return;
    if (page==='mapa-planta') { MSA.plant.open(content,{user:user(),sector,state}); return; }
    if (state.error) { content.innerHTML=`<div class="operation-alert">${esc(state.error)} ${button('Tentar novamente','retry')}</div>`; return; }
    if (!state.ready) { content.innerHTML='<div class="ops-empty">Carregando os dados compartilhados…</div>'; return; }
    const s=summary();
    const context=workContext();
    const hasContext=['chefe','qualidade'].includes(user().cargo)||(user().cargo==='operador'?state.maquinas.some(m=>m.id===user().maquinaId):!!user().setorId);
    if (!hasContext && page!=='configuracoes') {
      const focused=content.contains(document.activeElement)?document.activeElement:null,focusData=focused?.dataset;
    content.innerHTML=context+`<div class="ops-empty"><strong>${user().cargo==='operador'?'Escolha a máquina em uso':'Escolha o setor em acompanhamento'}</strong>${user().cargo==='operador'?(state.maquinas.length?'Selecione a máquina em que você está trabalhando. O setor será identificado automaticamente.':'O catálogo está vazio. O Supervisor ou o Chefe pode preparar as máquinas em Configurações.'):'Selecione um setor no topo para acompanhar a operação. Você pode trocar de setor durante o trabalho.'}</div>`;
      return;
    }
    let html='';
    if (page==='visao-geral') html=overview();
    if (page==='producao') {
      const sections={
        resumo:()=>panel('Planejado e realizado',table(['Máquina / setor','Meta do período','Aprovadas','Atendimento','Refugos','Material','Paradas'],performanceRows())),
        turnos:()=>panel('Comparativo de produção por turno',shiftComparison()),
        horas:()=>panel('Produção hora a hora',hourlyPanel()+'<p class="ops-note">Mais recentes primeiro. Peças que passam por várias etapas podem ser contabilizadas em mais de uma máquina.</p>'),
        apontamentos:()=>panel('Apontamentos de produção',productionTable()),
        parametros:()=>panel('Histórico de parâmetros',readingTable())
      };
      html=toolbar()+productionStats()+listSearch()+tabbed(sections[activeTabs[page]]());
    }
    if (page==='apontamentos') html=toolbar(button('Registrar produção','new','registrosProducao','',true)+button('Registrar parâmetros','new','leituras'))+productionStats()+panel('Minha máquina',`<p>${esc(machineName(user().maquinaId))} · ${esc(sectorName(user().setorId))}</p><p class="ops-note">Informe as peças aprovadas de cada período. Registre refugos e material perdido em Qualidade. ${state.demo?'Os dados são atualizados nos painéis e no mapa desta apresentação.':'Os dados ficam disponíveis após confirmação do Firebase.'}</p>`)+panel('Produção registrada',productionTable())+panel('Parâmetros registrados',readingTable());
    if (page==='paradas') {
      const sections={resumo:()=>panel('Paradas por motivo',groupedReasons('paradas'),button('Ver paradas em andamento','ops-tab','','abertas')),abertas:()=>panel('Paradas em andamento',stopTable(records('paradas').filter(r=>!r.fim))),micro:()=>workflowPanel('micro'),historico:()=>panel('Histórico de paradas',stopTable(records('paradas').filter(r=>r.fim)))};
      html=toolbar(allowed('paradas:registrar')?button('Registrar parada','new','paradas','',true):'')+stopStats()+listSearch()+tabbed(sections[activeTabs[page]]());
    }
    if (page==='qualidade') {
      const sections={resumo:()=>panel('Refugos por motivo',groupedReasons('perdas'),button('Ver lotes em avaliação','ops-tab','','lotes')),lotes:()=>workflowPanel('lots'),perdas:()=>panel('Refugos, material e peças suspeitas',`<p class="ops-note">Refugos em peças e perdas em kg permanecem separados. Os mais recentes aparecem primeiro; abra Detalhes para consultar responsável e observações.</p>${lossTable()}`),historico:()=>workflowPanel('lot-history')};
      html=toolbar(allowed('perdas:registrar')?button('Registrar refugo / perda','new','perdas','',true):'')+qualityStats()+listSearch()+tabbed(sections[activeTabs[page]]());
    }
    if (page==='ocorrencias') html=toolbar(allowed('ocorrencias:registrar')?button('Registrar ocorrência','new','ocorrencias','',true):'')+kpis([['Ocorrências abertas',records('ocorrencias').filter(r=>r.status==='aberta').length,'','Aguardando ação'],['Prioridade alta',records('ocorrencias').filter(r=>r.prioridade==='alta'&&r.status==='aberta').length,'','Apoio da liderança'],['Resolvidas',records('ocorrencias').filter(r=>r.status==='resolvida').length,'','Ação registrada'],['Máquinas envolvidas',new Set(records('ocorrencias').map(r=>r.maquinaId)).size,'','Localizar pelo mapa']])+panel('Ocorrências da operação',occurrenceTable());
    if (page==='maquinas') html=machinesPage();
    if (page==='conferencia') html=toolbar(button('Consolidar setor','consolidate','','',true))+kpis([['Registros pendentes',Object.keys(labels).reduce((n,k)=>n+records(k).filter(r=>!r.verificado).length,0),'','Produção, parâmetros e perdas'],['Produção a conferir',records('registrosProducao').filter(r=>!r.verificado).length,'','Conferência por período'],['Paradas a conferir',records('paradas').filter(r=>!r.verificado).length,'','Motivo e duração'],['Consolidações',state.consolidacoes.length,'','Resumo da liderança']])+panel('Registros a conferir',reviewTable())+panel('Consolidações do setor',reports());
    if(page==='funcionarios')html=workflowPanel('staff');
    if(page==='passagem')html=workflowPanel('handover');
    if (page==='indicadores') {
      const comparisons=MSA.config.sectors.filter(sec=>sector==='todos'||sec.id===sector).map(sec=>{const x=MSA.metrics.summarize(state,machines().filter(m=>m.setorId===sec.id),...bounds());return[esc(sec.nome),num(x.aprovadas),num(x.meta),x.atendimento===null?'—':num(x.atendimento)+'%',num(x.refugos),num(x.kg)+' kg',num(x.minutos)+' min'];});
      html=toolbar()+performanceStats()+panel('Eficiência e confiabilidade por máquina',table(['Máquina','Produtividade','OEE','Disponibilidade','Desempenho','Qualidade','MTBF','MTTR'],efficiencyRows()))+panel('Desempenho por setor',table(['Setor','Aprovadas','Meta','Atendimento','Refugos','Material','Paradas'],comparisons))+panel('Atendimento das metas por máquina',comparison())+panel('Resumo dos supervisores',reports())+'<p class="ops-note">OEE usa tempo planejado, tempo em operação, ciclo ideal e peças aprovadas. MTBF e MTTR consideram falhas encerradas; setup não conta como falha. Metas, ciclos e parâmetros do cenário são ilustrativos.</p>';
    }
    if (page==='relatorios') html=toolbar(button('Exportar registros CSV','export','','',true))+previousDay()+productionStats()+panel('Consolidações dos supervisores',reports())+panel('Resumo por máquina',table(['Máquina / setor','Meta do período','Aprovadas','Atendimento','Refugos','Material','Paradas'],performanceRows()));
    if (page==='notificacoes') html=state.atendimentosAlertas?toolbar('',false)+workflowPanel('alerts'):toolbar('',false)+panel('Pendências atuais',table(['Tipo','Máquina','Informação','Desde','Acesso'],alerts(),'Nenhuma pendência registrada nas máquinas do seu acesso.'));
    if (page==='configuracoes') html=(state.demo?panel('Cenário para apresentação',`<p>Sete dias fictícios; fotografia do dia às 15h. A mesma base abastece painéis e planta. Os dados locais são reiniciados em um novo dia.</p><div class="simulation-settings"><label class="ops-field">Chance de refugo por ciclo (simulação)<select id="demo-reject-rate">${[0,2,5,10,25,100].map(v=>`<option value="${v}" ${Math.round(MSA.demo.simulation.rejectRate*100)===v?'selected':''}>${v}%</option>`).join('')}</select></label><label class="ops-field">Chance de desvio a cada 30 s (simulação)<select id="demo-deviation-rate">${[0,5,10,25,100].map(v=>`<option value="${v}" ${Math.round(MSA.demo.simulation.deviationRate*100)===v?'selected':''}>${v}%</option>`).join('')}</select></label></div><div class="ops-actions simulation-settings-actions">${button('Restaurar dados fictícios','reset-demo','','',false,true)}<a class="secondary-button" href="sistema.html?dados=reais">Consultar dados do Firebase</a></div>${MSA.demo?.preview?'<p class="ops-note">Visualizar como: <a href="sistema.html?demonstracao=1&cargo=chefe#visao-geral">Chefe</a> · <a href="sistema.html?demonstracao=1&cargo=supervisor#visao-geral">Supervisor</a> · <a href="sistema.html?demonstracao=1&cargo=operador#visao-geral">Operador</a> · <a href="sistema.html?demonstracao=1&cargo=qualidade#qualidade">Qualidade</a></p>':''}`):'')+panel('Meu acesso',`<dl class="profile-details"><dt>Nome</dt><dd>${esc(user().nome)}</dd><dt>RE</dt><dd>${esc(user().re)}</dd><dt>Cargo</dt><dd>${esc(MSA.auth.role(user()).label)}</dd><dt>Setor atual</dt><dd>${esc(sectorName(user().setorId)||(user().cargo==='chefe'?'Todos os setores':'Ainda não selecionado'))}</dd><dt>Máquina em uso</dt><dd>${esc(machineName(user().maquinaId)||'Nenhuma selecionada')}</dd></dl>`)+(allowed('maquinas:gerenciar')||allowed('setores:gerenciar')?panel('Preparar apresentação',hasContext?`<p>Cadastre as máquinas de exemplo ${user().cargo==='chefe'?'dos três setores':'do setor em acompanhamento'}. A preparação não cria apontamentos de produção.</p><p class="ops-note">Nomes, metas e limites iniciais são exemplos. Cadastros existentes são preservados.</p><div class="ops-actions">${button('Preparar máquinas de exemplo','seed','','',true)}</div>`:'<p>Selecione um setor no topo para preparar suas máquinas de exemplo.</p>'):'');
    const hasDemo=state.demo||['registrosProducao','perdas','paradas','ocorrencias'].some(key=>(state[key]||[]).some(record=>record.id?.startsWith('demo-v1-')));
    const focused=content.contains(document.activeElement)?document.activeElement:null,focusData=focused?.dataset;
    content.innerHTML=context+(hasDemo?`<p class="demo-data-label">Cenário fictício · 1º turno, ${state.live?'base às 15h + ciclos simulados':'fotografia às 15h'}</p>`:'')+html;
    if(focusData?.action){[...content.querySelectorAll('button[data-action]')].find(b=>b.dataset.action===focusData.action&&b.dataset.id===focusData.id&&b.dataset.tableKey===focusData.tableKey)?.focus({preventScroll:true});}
  }
  function field(name,label,value='',type='text',options='') { return `<label class="ops-field ${type==='textarea'?'full':''}">${esc(label)}${type==='textarea'?`<textarea name="${name}" maxlength="2000" ${options}>${esc(value)}</textarea>`:`<input name="${name}" type="${type}" value="${esc(value)}" ${options}>`}</label>`; }
  function select(name,label,values,value,required=true) { return `<label class="ops-field">${esc(label)}<select name="${name}" ${required?'required':''}>${values.map(([key,text])=>`<option value="${esc(key)}" ${key===value?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`; }
  function open(title,html,action) {
    if (busy) return;
    dialog.classList.remove('shift-analysis-dialog');form.reset(); submitAction=action; fields.innerHTML=`<div class="ops-form-grid">${html}</div>`; formError.hidden=true;
    document.querySelector('#operation-dialog-title').textContent=title;
    saveButton.hidden=!action;document.querySelector('#operation-cancel').textContent=action?'Cancelar':'Fechar';
    updateLossQuantity();
    dialog.showModal();
  }
  function recordDetails(collection,id){
    const r=state[collection]?.find(r=>r.id===id);
    if(!r||!MSA.rbac.inScope(user(),r))throw new Error('Registro indisponível neste acesso.');
    const pairs=[['Máquina',machineLink(r.maquinaId)],['Data / início',time(r.data||r.inicio)],...(r.fim?[['Fim',time(r.fim)]]:[]),...(r.turno?[['Turno',esc(r.turno)+'º turno']]:[]),...(r.produto?[['Produto',esc(r.produto)]]:[]),...(r.lote?[['Lote / ordem',esc(r.lote)+' · '+esc(r.ordem||'—')]]:[]),...(r.quantidade!=null?[['Quantidade',num(r.quantidade)+' '+esc(r.unidade==='kg'?'kg':'peças')]]:[]),...(r.valores?[['Valores',Object.entries(r.valores).map(([key,value])=>{const p=state.maquinas.find(m=>m.id===r.maquinaId)?.parametros?.[key];return esc(p?.nome||key)+': '+num(value)+' '+esc(p?.unidade||'');}).join('<br>')]]:[]),...(r.motivo?[['Motivo',esc(r.motivo)]]:[]),...(r.causa?[['Causa / ação',esc(r.causa)]]:[]),['Responsável',responsible(r)],['Conferência',verification(r)],['Observações',esc(r.observacao||'Nenhuma observação registrada.')]];
    open('Detalhes · '+labels[collection],`<section class="full"><dl class="profile-details">${pairs.map(([label,value])=>`<dt>${label}</dt><dd>${value}</dd>`).join('')}</dl></section>`,null);
  }
  function updateLossQuantity(){
    const type=form.elements.tipo,quantity=form.elements.quantidade;
    if(!type||!quantity)return;
    const material=type.value==='perda';quantity.min=material?'0.001':'1';quantity.step=material?'any':'1';
  }
  function operationForm(collection,id='') {
    const existing=id?state[collection].find(r=>r.id===id):null;
    const machine=state.maquinas.find(m=>m.id===(existing?.maquinaId||user().maquinaId||machineFilter))||(collection==='paradas'&&user().cargo!=='operador'?machines()[0]:null);
    if (!machine) { notify('Sua máquina precisa estar cadastrada antes do apontamento.',true); return; }
    const permissions={registrosProducao:'producao:registrar',leituras:'leituras:registrar',paradas:'paradas:registrar',perdas:'perdas:registrar',ocorrencias:'ocorrencias:registrar'};
    MSA.rbac.require(permissions[collection],user(),existing||machine);
    const r=existing||{}; const now=state.scenarioAt||Date.now();
    let html=`<p class="ops-form-note">${esc(machine.nome)} · ${esc(sectorName(machine.setorId))} · RE ${esc(user().re)}</p>`;
    if(collection==='paradas'&&user().cargo!=='operador'&&!id)html+=select('maquinaId','Máquina',machines().map(m=>[m.id,m.id+' · '+m.nome]),machine.id);
    if (collection==='registrosProducao') html+=field('quantidade','Peças aprovadas',r.quantidade??'','number','min="0" step="1" required')+select('turno','Turno',[['1','1º turno'],['2','2º turno'],['3','3º turno']],r.turno||'1')+field('inicio','Início do período',dateTimeInput(r.inicio||now-3600000),'datetime-local','required')+field('fim','Fim do período',dateTimeInput(r.fim||now),'datetime-local','required')+field('produto','Produto',r.produto||machine.produto,'text','maxlength="120" required')+field('lote','Lote / ordem de produção',r.lote||'','text','maxlength="80" required');
    if (collection==='paradas') html+=field('inicio','Início da parada',secondsTimeInput(r.inicio||now),'datetime-local','step="1" required')+field('fim','Fim (deixe vazio se em andamento)',r.fim?secondsTimeInput(r.fim):'','datetime-local','step="1"')+MSA.workflowUI.reasonFields(workflowContext(),r);
    if (collection==='perdas') html+=select('tipo','Tipo',[['refugo','Refugo em peças'],['perda','Perda de material em kg'],['suspeito','Peças suspeitas / segregadas']],r.tipo||'refugo')+field('quantidade','Quantidade (peças ou kg conforme tipo)',r.quantidade??'','number','min="0.001" step="any" required')+field('data','Data e horário',dateTimeInput(r.data||now),'datetime-local','required')+field('motivo','Motivo',r.motivo||'','text','maxlength="300" required')+field('produto','Produto',r.produto||machine.produto,'text','maxlength="120" required')+field('lote','Lote / ordem',r.lote||'','text','maxlength="80" required');
    if (collection==='ocorrencias') html+=field('data','Data e horário',dateTimeInput(r.data||now),'datetime-local','required')+select('prioridade','Prioridade',[['normal','Normal'],['alta','Alta']],r.prioridade||'normal')+field('descricao','Descrição da ocorrência',r.descricao||'','textarea','required');
    if (collection==='leituras') {
      const parameters=Object.entries(machine.parametros||{});
      if (!parameters.length) { notify('O Supervisor precisa configurar os parâmetros e limites desta máquina em Máquinas.',true); return; }
      html+=field('data','Data e horário',dateTimeInput(r.data||now),'datetime-local','required')+field('lote','Lote / ordem',r.lote||'','text','maxlength="80" required');
      html+=parameters.map(([key,p])=>field('valor_'+key,`${p.nome} (${p.unidade}) · ${num(p.min)} a ${num(p.max)}`,r.valores?.[key]??'','number','step="any" required')).join('');
    }
    html+=field('observacao','Observações',r.observacao||'','textarea','maxlength="1000"');
    open((id?'Editar ':'Registrar ')+labels[collection].toLowerCase(),html,async values=>{values.maquinaId=values.maquinaId||machine.id;if(collection==='paradas')Object.assign(values,MSA.workflows.reason(values));if(collection==='leituras')values.valores=Object.fromEntries(Object.keys(machine.parametros).map(key=>[key,values['valor_'+key]]));const result=await MSA.data.save(collection,values,id||undefined);if(!id){if(page==='paradas')activeTabs.paradas=values.fim?'historico':'abertas';if(page==='qualidade')activeTabs.qualidade='perdas';render();}return result;});
  }
  function parameterRow(index,key='',p={}) { return `<div class="ops-parameter"><input type="hidden" name="key_${index}" value="${esc(key)}">${field('nome_'+index,'Parâmetro',p.nome||'','text','maxlength="80"')}${field('unidade_'+index,'Unidade',p.unidade||'','text','maxlength="20"')}${field('min_'+index,'Mínimo',p.min??'','number','step="any"')}${field('max_'+index,'Máximo',p.max??'','number','step="any"')}</div>`; }
  function machineForm(id) {
    MSA.rbac.require('maquinas:gerenciar',user());
    const m=state.maquinas.find(item=>item.id===id)||{};
    const params=Object.entries(m.parametros||{});
    const html=field('codigo','Código',id||'','text',id?'readonly':'maxlength="40" required')+field('nome','Nome da máquina',m.nome||'','text','maxlength="120" required')+field('processo','Processo',m.processo||'','text','maxlength="120" required')+field('produto','Produto',m.produto||'','text','maxlength="120" required')+field('metaDiaria','Meta diária (peças)',m.metaDiaria??0,'number','min="0" step="1" required')+`<p class="ops-form-note">Setor: ${esc(sectorName(user().setorId))}. Configure limites válidos para cada parâmetro. Limpe o nome para remover um parâmetro.</p><input type="hidden" name="paramCount" value="${params.length||1}"><div class="ops-parameter-list" id="ops-parameters">${params.length?params.map(([key,p],index)=>parameterRow(index,key,p)).join(''):parameterRow(0)}</div><div class="ops-actions">${button('Adicionar parâmetro','add-parameter')}</div>`;
    open(id?'Editar máquina':'Cadastrar máquina',html,values=>MSA.data.saveMachine({...values,setorId:user().setorId},id||undefined));
  }
  async function action(name,collection,id,target) {
    if(name.startsWith('wf-'))return MSA.workflowUI.handle(name,id,workflowContext(),target);
    if (!user() || !MSA.rbac.route(page,user())) throw new Error('Esta tela não está disponível para seu cargo.');
    if(name==='shift-detail')return openShiftDetail(id);
    if(name==='shift-previous-day'){const d=new Date(state.scenarioAt||Date.now());d.setDate(d.getDate()-1);from=to=dateInput(d);resetListPages();render();return;}
    if(name==='shift-detail-tab'){if(!shiftDetail||!shiftTabs.some(([key])=>key===id))return;shiftDetail.tab=id;renderShiftDetail();document.querySelector('#shift-detail-tab-'+id)?.focus({preventScroll:true});return;}
    if(name==='shift-detail-page'){const n=Number(id);if(!shiftDetail||!Number.isInteger(n)||n<1)return;shiftDetail.pages[target.dataset.tableKey]=n;renderShiftDetail();fields.querySelector('#shift-detail-content')?.scrollIntoView({block:'start'});return;}
    if(name==='shift-detail-refresh'){if(shiftDetail){shiftDetail.analysis=analyzeShift(shiftDetail.analysis.shift);shiftDetail.snapshotAt=state.scenarioAt||Date.now();renderShiftDetail();}return;}
    if(name==='record-detail')return recordDetails(collection,id);
    if(name==='ops-tab'){if(!tabDefinitions[page]?.some(([key])=>key===id))return;activeTabs[page]=id;render();document.querySelector('#ops-tab-'+id)?.focus({preventScroll:true});return;}
    if(name==='list-search-reset'){listQueries[page]='';resetListPages();render();document.querySelector('#ops-list-search')?.focus({preventScroll:true});return;}
    if(name==='list-page'){const next=Number(id);if(!Number.isInteger(next)||next<1)return;listPages.set(target.dataset.tableKey,next);render();const nav=[...content.querySelectorAll('[data-list-key]')].find(n=>n.dataset.listKey===target.dataset.tableKey);nav?.closest('.ops-panel')?.scrollIntoView({block:'start'});nav?.querySelector('button:not(:disabled)')?.focus({preventScroll:true});return;}
    if(name==='machine-detail')return machineDetails(id);
    if(name==='catalogue-reset'){catalogueSearch='';catalogueStatus='todos';catalogueOrder='priority';cataloguePage=1;machineFilter='';render();return;}
    if(name==='catalogue-page'){cataloguePage=Number(id);render();document.querySelector('#equipment-results')?.scrollIntoView({block:'start'});return;}
    if(name==='reset-demo'){MSA.data.reset();notify('Cenário restaurado.');return;}
    if (name==='new'||name==='edit') return operationForm(collection,name==='edit'?id:'');
    if (name==='machine') return machineForm(id);
    if (name==='review') { await MSA.data.review(collection,id); notify('Registro conferido.'); return; }
    if (name==='finish') return open('Encerrar parada',field('causa','Causa / ação realizada','','textarea','maxlength="300"'),values=>MSA.data.finishStop(id,values.causa));
    if (name==='resolve') return open('Resolver ocorrência',field('resolucao','Ação realizada','','textarea','maxlength="1000" required'),values=>MSA.data.resolveOccurrence(id,values.resolucao));
    if (name==='target') { const m=state.maquinas.find(m=>m.id===id);MSA.rbac.require('metas:gerenciar',user(),m);return open('Alterar meta diária',field('meta','Peças por dia',m.metaDiaria,'number','min="0" step="1" required'),values=>MSA.data.setTarget(id,values.meta)); }
    if (name==='assign') { const p=state.perfis.find(p=>p.id===id);MSA.rbac.require('funcionarios:atribuir',user());return open('Vincular máquina',`<p class="ops-form-note">${esc(p.nome)} · RE ${esc(p.re)}</p>`+select('maquinaId','Máquina',state.maquinas.filter(m=>m.setorId===p.setorId).map(m=>[m.id,m.nome]),p.maquinaId),values=>MSA.data.assignMachine(id,values.maquinaId)); }
    if (name==='consolidate') { MSA.rbac.require('consolidacoes:registrar',user()); const [a,b]=bounds(); return open('Consolidar informações do setor',field('inicio','Início',dateTimeInput(a),'datetime-local','required')+field('fim','Fim',dateTimeInput(Math.min(b-60000,state.scenarioAt||Date.now())),'datetime-local','required')+field('observacao','Resumo, causas e pendências','','textarea','maxlength="2000" required'),values=>MSA.data.consolidate(values)); }
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
    if(event.target.id.startsWith('wf-')){resetListPages();MSA.workflowUI.change(event,workflowContext());render();return;}
    if(event.target.id==='demo-deviation-rate'){MSA.demo.simulation.setDeviationRate(event.target.value);return;}
    if(event.target.id==='demo-reject-rate'){MSA.demo.simulation.setRejectRate(event.target.value);return;}
    if(page==='mapa-planta')return;
    if (event.target.id==='ops-work-machine') {
      const control=event.target;
      if(busy)return;
      control.disabled=true;
      void MSA.data.changeContext({maquinaId:control.value}).then(()=>notify('Máquina em uso atualizada.')).catch(error=>{notify(error.message,true);render();});
      return;
    }
    if(event.target.id==='catalogue-sector'){cataloguePage=1;const select=document.querySelector('#sector-selector');select.value=event.target.value;if(user().cargo==='supervisor')event.target.disabled=true;select.dispatchEvent(new Event('change',{bubbles:true}));return;}
    if(event.target.id==='catalogue-status'){catalogueStatus=event.target.value;cataloguePage=1;}
    if(event.target.id==='catalogue-order'){catalogueOrder=event.target.value;cataloguePage=1;}
    resetListPages();
    if(event.target.id==='ops-shift')shiftFilter=event.target.value;
    if (event.target.id==='ops-machine') machineFilter=event.target.value;
    if (event.target.id==='ops-from'||event.target.id==='ops-to') { const next=event.target.value; if(!/^\d{4}-\d{2}-\d{2}$/.test(next))return;if(event.target.id==='ops-from')from=next;else to=next;if(from>to)to=from; }
    render();
  });
  async function handleAction(event) {
    const target=event.target.closest('[data-action]');if(!target||busy)return;
    if(target.dataset.action==='add-parameter') { const input=form.elements.paramCount;const index=Number(input.value);if(index>=100)return;document.querySelector('#ops-parameters').insertAdjacentHTML('beforeend',parameterRow(index));input.value=index+1;return; }
    target.disabled=true;
    try { await action(target.dataset.action,target.dataset.collection,target.dataset.id,target); }
    catch(error) { notify(error.message,true); }
    finally { target.disabled=false; }
  }
  content.addEventListener('keydown',event=>{const current=event.target.closest('[role="tab"]');if(!current||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const keys=tabDefinitions[page].map(([key])=>key),index=keys.indexOf(current.dataset.id),next=event.key==='Home'?0:event.key==='End'?keys.length-1:(index+(event.key==='ArrowRight'?1:-1)+keys.length)%keys.length;void action('ops-tab','',keys[next]);});
  content.addEventListener('click',handleAction);fields.addEventListener('click',handleAction);
  fields.addEventListener('keydown',event=>{const tab=event.target.closest('[data-action="shift-detail-tab"]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const keys=shiftTabs.map(([key])=>key),i=keys.indexOf(tab.dataset.id),next=event.key==='Home'?0:event.key==='End'?keys.length-1:(i+(event.key==='ArrowRight'?1:-1)+keys.length)%keys.length;void action('shift-detail-tab','',keys[next]);});
  dialog.addEventListener('close',()=>{dialog.classList.remove('shift-analysis-dialog');shiftDetail=null;});
  fields.addEventListener('change',event=>{if(event.target.name==='tipo')updateLossQuantity();MSA.workflowUI?.formChange(event,workflowContext());});
  fields.addEventListener('click',event=>{if(event.target.closest('.equipment-detail-links a, .shift-detail a[href]'))dialog.close();});
  content.addEventListener('input',event=>{if(event.target.id==='ops-list-search'){const input=event.target,start=input.selectionStart,end=input.selectionEnd;listQueries[page]=input.value;resetListPages();render();const next=document.querySelector('#ops-list-search');next.focus({preventScroll:true});next.setSelectionRange(start,end);return;}if(event.target.id!=='catalogue-search')return;const start=event.target.selectionStart,end=event.target.selectionEnd;catalogueSearch=event.target.value;cataloguePage=1;render();const input=document.querySelector('#catalogue-search');input.focus({preventScroll:true});input.setSelectionRange(start,end);});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!submitAction||busy)return;
    if(!form.reportValidity())return;
    busy=true;saveButton.disabled=true;saveButton.textContent='Salvando…';formError.hidden=true;
    try { await submitAction(Object.fromEntries(new FormData(form)));dialog.close();notify(state.demo?'Informações salvas no cenário de apresentação.':'Informações salvas no Firebase.'); }
    catch(error) { formError.textContent=error.message;formError.hidden=false; }
    finally { busy=false;saveButton.disabled=false;saveButton.textContent='Salvar'; }
  });
  const close=()=>{if(!busy)dialog.close();};document.querySelector('#operation-close').addEventListener('click',close);document.querySelector('#operation-cancel').addEventListener('click',close);dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  MSA.data.subscribe(next=>{state=next;if(page!=='mapa-planta'&&content.contains(document.activeElement)&&document.activeElement.matches('input,select,textarea'))return;render();});
  MSA.operations = {
    open(nextPage,nextSector) {
      const u=user();if(!u)return;
      if(nextPage!=='mapa-planta')MSA.plant.close();
      const key=[u.id,u.cargo,u.setorId,u.maquinaId].join('|');
      if(key!==identity || MSA.data.user?.id!==u.id) { identity=key;machineFilter='';if(dialog.open)dialog.close();void MSA.data.start(u); }
      if(nextPage!==page||nextSector!==sector){machineFilter='';cataloguePage=1;resetListPages();listQueries[nextPage]='';}
      if(nextPage!==page&&dialog.open)dialog.close();
      const routeId=decodeURIComponent(location.hash.split('/')[1]||'');if(nextPage!=='mapa-planta'&&state.maquinas.some(m=>m.id===routeId&&MSA.rbac.inScope(u,m)&&(nextSector==='todos'||m.setorId===nextSector))){machineFilter=routeId;if(nextPage==='paradas')activeTabs.paradas='abertas';if(nextPage==='qualidade')activeTabs.qualidade='lotes';}
      if(nextPage==='producao'&&!productionVisited){productionVisited=true;if(state.demo){const d=new Date(state.scenarioAt);d.setDate(d.getDate()-6);from=dateInput(d);to=dateInput(state.scenarioAt);}}
      page=nextPage;sector=nextSector;render();
    }, notify
  };
})();
