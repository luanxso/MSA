// Planta e supervisório consultam a mesma fonte; a geometria não depende da telemetria.
(() => {
  'use strict';
  const layout=MSA.plantLayout,telemetry=MSA.telemetry;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=(value,digits=0)=>value===null||value===undefined||!Number.isFinite(Number(value))?'—':Number(value).toLocaleString('pt-BR',{maximumFractionDigits:digits});
  const clock=value=>value?new Date(value).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';
  const duration=seconds=>seconds===null||seconds===undefined?'—':`${Math.floor(Math.max(0,seconds)/3600)}h ${String(Math.floor(Math.max(0,seconds)%3600/60)).padStart(2,'0')}min`;
  const icon=name=>`<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
  const stateLabel=value=>telemetry.states[value]||telemetry.states.desconhecido;
  let root=null,context=null,active=false,selected='',tab='operacao',lastMode='',sector='todos',status='todos',problems=false,product='todos',flowFrame=0;
  let stopSubscription=null,resizeObserver=null,lastContextSector='',tableSignature='',catalogSignature='',hovered='',dragUntil=0;
  let summaryId='',summaryTrigger=null,restoreSummaryFocus=true,theme='light',headerControls=null;
  const camera={scale:null,x:0,y:0,width:0,height:0,autoFit:true};
  const pointers=new Map();
  let drag=null,pinch=null;
  function catalog() {
    if(telemetry.mode==='simulation')return telemetry.catalog;
    const actual=context.state.maquinas||[];
    if(telemetry.mode==='records')return actual.filter(m=>MSA.rbac.inScope(context.user,m));
    const merged=new Map(MSA.config.machines.filter(m=>MSA.rbac.inScope(context.user,m)).map(m=>[m.id,m]));
    actual.filter(m=>MSA.rbac.inScope(context.user,m)).forEach(m=>merged.set(m.id,m));
    return [...merged.values()];
  }
  const sectorName=id=>layout.areas.find(s=>s.id===id)?.name||MSA.config.sectors.find(s=>s.id===id)?.nome||id;
  function manualSample(machine) {
    const now=Date.now(),start=new Date(now).setHours(0,0,0,0),end=start+86400000;
    const s=MSA.metrics.summarize(context.state,[machine],start,end);
    const readings=(context.state.leituras||[]).filter(r=>r.maquinaId===machine.id).sort((a,b)=>b.data-a.data);
    const latest=readings[0],open=s.abertas[0];
    const parameters=Object.fromEntries(Object.entries(machine.parametros||{}).map(([key,p])=>[key,{...p,value:latest?.valores?.[key]??null,updatedAt:latest?.data||null,quality:'manual',alarm:latest?.valores?.[key]!==undefined&&(latest.valores[key]<p.min||latest.valores[key]>p.max)}]));
    const alarms=Object.entries(parameters).filter(([,p])=>p.alarm).map(([id,p])=>({code:'LEI-'+id,description:p.nome+' fora do limite registrado',severity:'aviso',since:p.updatedAt,parameterId:id,active:true}));
    const stops=(context.state.paradas||[]).filter(r=>r.maquinaId===machine.id&&r.inicio<end&&(!r.fim||r.fim>=start));
    const occurrences=(context.state.ocorrencias||[]).filter(r=>r.maquinaId===machine.id&&r.status==='aberta');
    occurrences.forEach(r=>alarms.push({code:'OCO-'+r.id,description:r.descricao,severity:r.prioridade==='alta'?'critico':'aviso',since:r.data,active:true}));
    const events=[
      ...stops.map(r=>({id:r.id,time:r.inicio,type:'parada',description:r.motivo,state:'parada'})),
      ...occurrences.map(r=>({id:r.id,time:r.data,type:'ocorrencia',description:r.descricao,state:'desconhecido'})),
      ...readings.slice(0,30).map(r=>({id:r.id,time:r.data,type:'leitura',description:'Parâmetros registrados',state:'desconhecido'}))
    ].sort((a,b)=>a.time-b.time);
    return {id:machine.id,state:open?'parada':'desconhecido',stateSince:open?.inicio||null,phase:open?'Parada registrada':'Sem leitura automática',
      totalCount:s.aprovadas+s.refugos,goodCount:s.aprovadas,rejectedCount:s.refugos,goal:s.meta,
      cycleSeconds:null,idealCycleSeconds:null,cycleProgress:null,speed:null,partsPerCycle:null,plannedSeconds:null,operatingSeconds:null,
      stopSeconds:s.minutos*60,setupSeconds:null,maintenanceSeconds:null,parameters,alarms,timeline:stops.map(r=>({state:'parada',start:r.inicio,end:r.fim||null,reason:r.motivo})),
      events,samples:[],periodStart:start,periodLabel:'Hoje · apontamentos',updatedAt:latest?.data||s.producao.at(-1)?.fim||open?.inicio||null,
      source:'manual',sourceLabel:'Registros',connected:context.state.connected,stale:false,efficiency:null,suspectCount:s.suspeitas,materialLoss:s.kg};
  }
  function sample(machine) {
    if(telemetry.mode==='records')return manualSample(machine);
    return telemetry.get(machine.id)||{id:machine.id,state:'desconhecido',phase:'Aguardando leitura',parameters:{},alarms:[],events:[],timeline:[],samples:[],updatedAt:null,source:'api',sourceLabel:telemetry.adapterName||'API / IoT',connected:false,stale:true};
  }
  function matches(machine,s=sample(machine)) {
    return (product==='todos'||machine.productKind===product)&&(sector==='todos'||machine.setorId===sector||(sector==='selagem'&&machine.id==='SEL-01'))&&(status==='todos'||(status==='alerta'?s.alarms.length>0:(s.stale?'desconhecido':s.state)===status))&&(!problems||s.alarms.length>0||['parada','manutencao'].includes(s.state)||s.stale);
  }
  function routeMachine() { try{return decodeURIComponent(location.hash.split('/')[1]||'');}catch{return '';} }
  function button(text,action,extra='') { return `<button class="plant-button${action==='theme'?' plant-theme-toggle':''}${action==='open-supervisor'?' is-primary':''}" type="button" data-plant-action="${action}" ${extra}>${text}</button>`; }
  function sourceControls() {
    const records=context?.demo?'':`<option value="records" ${telemetry.mode==='records'?'selected':''}>Registros do sistema</option>`;
    return `<div class="plant-source"><label for="plant-source">Fonte<select id="plant-source"><option value="simulation" ${telemetry.mode==='simulation'?'selected':''}>Demonstração</option>${records}${telemetry.adapterName?`<option value="api" ${telemetry.mode==='api'?'selected':''}>${esc(telemetry.adapterName)}</option>`:''}</select></label>${telemetry.mode==='simulation'?button(telemetry.paused?'Retomar':'Pausar','pause','aria-pressed="'+telemetry.paused+'"'):''}</div>`;
  }
  function applyTheme() {
    theme=document.documentElement.dataset.theme || 'light';
    root?.closest('.app-shell')?.setAttribute('data-plant-theme',theme);
    headerControls?.querySelectorAll('[data-plant-action="theme"]').forEach(node=>{
      node.textContent=theme==='light'?'◐':'☼';
      node.setAttribute('aria-label','Alternar para tema '+(theme==='light'?'escuro':'claro'));
      node.title=theme==='light'?'Tema escuro':'Tema claro';
      node.setAttribute('aria-pressed',theme==='dark');
    });
  }
  function renderHeader() {
    const header=root.closest('.app-shell')?.querySelector('.app-header');if(!header)return;
    const moreOpen=headerControls?.querySelector('.plant-more')?.open;
    headerControls?.remove();
    headerControls=document.createElement('div');headerControls.className='plant-header-controls';
    const sectors=telemetry.mode==='simulation'?layout.areas.map(a=>({id:a.id,nome:a.short||a.name})):MSA.config.sectors;
    headerControls.innerHTML=`${selected?'':`<label for="plant-sector"><span>Setor</span><select id="plant-sector"><option value="todos">Todos os setores</option>${sectors.map(s=>`<option value="${esc(s.id)}" ${sector===s.id?'selected':''}>${esc(s.nome)}</option>`).join('')}</select></label><label for="plant-status"><span>Estado</span><select id="plant-status"><option value="todos">Todos os estados</option>${Object.entries(telemetry.states).map(([key,value])=>`<option value="${key}" ${status===key?'selected':''}>${value}</option>`).join('')}<option value="alerta" ${status==='alerta'?'selected':''}>Com alerta</option></select></label><details class="plant-more"><summary>Filtros</summary><div class="plant-more-panel">${sourceControls()}<label class="plant-problem-filter"><input id="plant-problems" type="checkbox" ${problems?'checked':''}>Só problemas</label></div></details>`}`;
    header.insertBefore(headerControls,header.querySelector('.header-right')||header.querySelector(':scope > .simulation-label'));
    headerControls.addEventListener('click',handleClick);headerControls.addEventListener('change',handleChange);
    if(moreOpen&&headerControls.querySelector('.plant-more'))headerControls.querySelector('.plant-more').open=true;
    applyTheme();
  }
  function footprint(type) {
    if(type==='injection')return `<rect class="equipment-base" x="-92" y="-44" width="184" height="88"/><rect class="equipment-panel" x="-82" y="-34" width="62" height="68"/><rect class="equipment-metal" x="-15" y="-29" width="24" height="58"/><path class="equipment-line" d="M-8-34v68M4-34v68M14-12h64M14 12h64"/><rect class="equipment-panel" x="54" y="-34" width="28" height="68"/><circle class="equipment-metal" cx="37" cy="-35" r="16"/><rect class="equipment-cabinet" x="-74" y="-23" width="24" height="16"/><path class="equipment-line" d="M-70 18h37M-70 25h37"/>`;
    if(type==='sealing')return `<rect class="equipment-base" x="-78" y="-50" width="156" height="100"/><rect class="equipment-panel" x="-62" y="-33" width="90" height="66"/><rect class="equipment-metal" x="-41" y="-24" width="47" height="48"/><path class="equipment-line" d="M-55-27v54M21-27v54M-41 0H6"/><rect class="equipment-cabinet" x="40" y="-27" width="25" height="22"/><path class="equipment-line" d="M42 12h21m-21 9h21"/>`;
    return `<path class="equipment-base" d="M-93-43H93v31H-58V43H-93Z"/><rect class="equipment-metal" x="-48" y="-33" width="50" height="23"/><rect class="equipment-cabinet" x="37" y="-36" width="28" height="19"/><path class="equipment-line" d="M-30 0v16M45 0v16M-70 9v24"/><circle class="equipment-panel" cx="-30" cy="28" r="12"/><circle class="equipment-panel" cx="45" cy="28" r="12"/>`;
  }
  function areaContents(area) {
    if(area.kind==='storage')return Array.from({length:5},(_,i)=>`<g transform="translate(${area.x+28} ${area.y+92+i*108})"><rect class="floor-rack" width="133" height="64"/><path class="floor-detail" d="M44 0v64M88 0v64M0 32h133"/></g>`).join('');
    if(area.kind==='quality')return `<rect class="floor-bench" x="${area.x+42}" y="${area.y+104}" width="188" height="42"/><rect class="floor-bench" x="${area.x+42}" y="${area.y+196}" width="188" height="42"/><text class="floor-note" x="${area.x+42}" y="${area.y+275}">Bancadas de ensaio</text>`;
    if(area.kind==='packing')return `<rect class="floor-bench" x="${area.x+40}" y="${area.y+99}" width="156" height="38"/><rect class="floor-bench" x="${area.x+40}" y="${area.y+177}" width="156" height="38"/>`;
    if(area.kind==='shipping')return `<g class="floor-pallets">${[0,1,2].map(i=>`<rect class="floor-rack" x="${area.x+38+(i%2)*107}" y="${area.y+94+Math.floor(i/2)*106}" width="76" height="72"/>`).join('')}</g><path class="floor-door" d="M${area.x+34} ${area.y+area.height}v24h84v-24m27 0v24h84v-24"/>`;
    return '';
  }
  function mapRouteVisuals() {
    return `<g class="map-routes">${layout.routes.map(route=>`<g data-route="${route.id}"><path id="route-${route.id}" class="route-line" d="${route.path}"/>${Array.from({length:3},(_,i)=>`<g class="route-product" data-flow-kind="${route.id}" data-flow-index="${i}">${MSA.processVisuals?.product(route.id,3,0,0,.18)||'<circle r="5"/>'}</g>`).join('')}</g>`).join('')}</g>`;
  }
  function floor() {
    const b=layout.building;
    return `<svg id="plant-svg" class="plant-svg" role="group" aria-label="Planta fictícia da MSA. Use Tab para selecionar máquinas e Enter para abrir o resumo sobre o mapa." tabindex="0"><defs><pattern id="plant-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path class="floor-grid" d="M40 0H0V40" fill="none" stroke-width="1"/></pattern></defs><g id="plant-world">
      <rect class="floor-building" x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}"/>
      <rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="url(#plant-grid)"/>
      ${layout.corridors.map(c=>`<rect class="floor-corridor" x="${c.x}" y="${c.y}" width="${c.width}" height="${c.height}"/>`).join('')}
      ${layout.areas.map((a,index)=>`<g data-area="${a.id}" class="floor-area ${a.kind||''}${index%2?' tone-alt':''}" style="--sector-color:${a.color}"><rect class="floor-sector" x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}"/><text class="floor-sector-name" data-number="${String(index+1).padStart(2,'0')}" data-short="${esc(a.id==='montagem'?'FONES':a.prefix)}" data-full="${esc((a.short||a.name).toUpperCase())}" x="${a.x+14}" y="${a.y+25}">${String(index+1).padStart(2,'0')} · ${esc((a.short||a.name).toUpperCase())}</text></g>`).join('')}
      ${mapRouteVisuals()}
      ${catalog().filter(m=>layout.placements[m.id]).map(m=>{
        const p=layout.placements[m.id],s=sample(m),a=layout.areas.find(a=>a.id===m.setorId);
        const extra=p.type==='storage'||p.type==='shipping'?'<rect class="equipment-base" x="-78" y="-44" width="156" height="88"/><path class="equipment-line" d="M-26-44v88M26-44v88M-78 0H78"/>':p.type==='quality'?'<rect class="equipment-base" x="-82" y="-38" width="164" height="76"/><rect class="equipment-cabinet" x="-20" y="-30" width="40" height="38"/><path class="equipment-line" d="M-68 26H68"/>':footprint(p.type);
        return `<g class="floor-machine state-${s.state}" data-machine="${esc(m.id)}" transform="translate(${p.x} ${p.y})" role="button" tabindex="0" aria-label="${esc(m.id+' · '+m.nome+' · '+stateLabel(s.state))}" aria-describedby="plant-tooltip" style="--sector-color:${a?.color||'#8da99c'}">
          <rect class="machine-hit" x="-68" y="-43" width="136" height="106" rx="2"/><g transform="scale(.65)">${extra}</g>
          <g class="machine-state-dot" transform="translate(60 -36)" aria-hidden="true"><circle class="machine-status" r="8.5"/><path class="machine-state-symbol" d="${stateGlyph(s.stale?'desconhecido':s.state,s.alarms.length>0)}"/></g>
          <text class="machine-code" y="51" text-anchor="middle">${esc(m.id)}</text>
        </g>`;
      }).join('')}
    </g></svg>`;
  }
  function stateGlyph(state, alarm = false) {
    if (alarm && state === 'operando') return 'M0-4V1M0 4v.01';
    if (state === 'operando') return 'M-4 0l3 3 5-6';
    if (state === 'parada') return 'M-2.5-4V4M2.5-4V4';
    if (state === 'setup' || state === 'manutencao') return 'M-4 4l4-4M0 0a3 3 0 0 1 3-4L2-2l2 1a3 3 0 0 1-4 1';
    return 'M-3-2a3 3 0 0 1 6 0c0 2-3 2-3 4M0 4.5v.01';
  }
  function startMapFlow() {
    cancelAnimationFrame(flowFrame);let last=performance.now();const offsets={capacetes:0,fones:.055};
    function frame(now) {
      if(!active||selected)return;
      const seconds=Math.min(.1,(now-last)/1000);last=now;
      layout.routes.forEach(route=>{
        const nodes=root.querySelectorAll(`[data-flow-kind="${route.id}"]`),path=root.querySelector('#route-'+route.id);
        if(!path)return;
        const routeMachine=catalog().find(m=>m.id===(route.id==='fones'?'ABF-01':'INJ-01'))||catalog()[0];
        const routeSample=routeMachine?sample(routeMachine):{state:'desconhecido',stale:true};
        const moving=telemetry.mode==='simulation'&&!telemetry.paused&&routeSample.state==='operando'&&!routeSample.stale;
        if(moving)offsets[route.id]=(offsets[route.id]+seconds/100)%1;
        path.closest('[data-route]').classList.toggle('is-moving',moving);
        const length=path.getTotalLength();nodes.forEach((node,i)=>{const point=path.getPointAtLength(((offsets[route.id]+i/nodes.length)%1)*length);node.setAttribute('transform',`translate(${point.x} ${point.y})`);});
      });
      flowFrame=requestAnimationFrame(frame);
    }
    flowFrame=requestAnimationFrame(frame);
  }

  function renderMap() {
    const unplaced=catalog().filter(m=>!layout.placements[m.id]);
    return `<div class="plant-map-view">
      <div class="plant-summary"><span><strong data-map-count>32</strong> equipamentos</span><span><i class="plant-state-marker state-operando"></i><strong data-map-running>0</strong> operando</span><span><i class="plant-state-marker state-parada"></i><strong data-map-stopped>0</strong> paradas</span><span><strong data-map-alarms>0</strong> com alerta</span><span class="plant-production-total"><strong data-map-output>—</strong> aprovadas</span><div class="product-filters" aria-label="Rotas de produção">${[['todos','Todas as rotas'],['capacetes','Capacetes'],['fones','Fones']].map(([id,label])=>`<button type="button" data-plant-product="${id}" aria-pressed="${product===id}" class="product-filter product-${id}">${label}</button>`).join('')}</div></div>
      <div class="plant-canvas" id="plant-canvas">${floor()}<div class="plant-map-controls">${button('+','zoom-in','aria-label="Ampliar planta"')}${button('−','zoom-out','aria-label="Reduzir planta"')}${button('Ajustar','fit','aria-label="Ajustar planta à tela"')}${button('⛶','fullscreen','aria-label="Expandir mapa para tela cheia" title="Tela cheia"')}<output id="plant-zoom" aria-label="Nível de ampliação">100%</output></div><div class="plant-map-hint">Arraste para explorar · clique para consultar</div><div class="plant-tooltip" id="plant-tooltip" role="tooltip" hidden></div><div class="plant-empty" id="plant-empty" hidden><strong>Nenhum equipamento no contexto</strong><span>Altere os filtros para explorar a planta.</span></div></div>
      <div class="plant-map-footer"><div class="plant-legend">${['operando','parada','setup','manutencao','desconhecido'].map(s=>`<span><i class="plant-state-marker state-${s}"></i>${stateLabel(s)}</span>`).join('')}</div><span data-source-detail></span><span data-last-update></span></div>
      ${unplaced.length?`<section class="plant-unplaced"><h2>Equipamentos sem posição na planta</h2>${unplaced.map(m=>`<div data-unplaced-machine="${esc(m.id)}">${esc(m.id)} · ${esc(m.nome)} <button class="plant-button" data-open-machine="${esc(m.id)}">Consultar equipamento</button></div>`).join('')}</section>`:''}</div>`;
  }

  function metric(label,key,suffix='') { return `<div class="hmi-metric"><span>${label}</span><strong data-value="${key}" data-suffix="${esc(suffix)}">—</strong></div>`; }
  function supervisory(machine) {
    const s=sample(machine);
    return `<div class="supervisor-heading"><div class="supervisor-machine">${button(icon('back')+'Voltar à planta','back')}<div><p class="supervisor-code">${esc(machine.id)} · ${esc(sectorName(machine.setorId))}</p><h2>${esc(machine.nome)}</h2><p class="supervisor-product">${esc(machine.produto||'Produto não informado')}${telemetry.mode==='simulation'?' · '+esc(machine.order||'OP-4101')+' · '+esc(machine.operator||'Ana Souza'):''}</p></div></div><div class="supervisor-state state-${s.state}"><span class="plant-status" data-machine-state>${stateLabel(s.state)}</span><span data-state-since></span></div></div>
      <div class="supervisor-tools">${sourceControls()}${telemetry.mode==='simulation'?`<label for="plant-scenario">Cenário<select id="plant-scenario"><option value="operando">Operando</option><option value="parada">Parada</option><option value="setup">Setup</option><option value="manutencao">Manutenção</option><option value="alerta">Operando com alerta</option></select></label>`:''}<span class="supervisor-period" data-period></span></div>
      <div class="supervisor-overview"><div class="supervisor-metrics">${metric('Produção aprovada','goodCount',' peças')}${metric('Meta diária','goal',' peças')}${metric('Último ciclo','cycleSeconds',' s')}${metric('Ritmo atual','speed',' peças/min')}${metric('Tempo operando','operatingSeconds')}${metric('Refugos','rejectedCount',' peças')}</div><div class="hmi-efficiency hmi-efficiency-top">${metric('Disponibilidade','efficiency.availability','%')}${metric('Desempenho','efficiency.performance','%')}${metric('Qualidade','efficiency.quality','%')}${metric('OEE','efficiency.oee','%')}</div></div>
      <div class="supervisor-tabs" role="tablist" aria-label="Detalhes do equipamento">${[['operacao','Operação'],['paradas','Paradas e eficiência'],['qualidade','Qualidade'],['historico','Histórico']].map(([id,text])=>`<button id="plant-tab-${id}" role="tab" type="button" data-plant-tab="${id}" aria-selected="${tab===id}" aria-controls="plant-tab-panel" tabindex="${tab===id?0:-1}">${text}</button>`).join('')}</div>
      <section class="supervisor-panel" id="plant-tab-panel" role="tabpanel" aria-labelledby="plant-tab-${tab}"></section>
      <div class="plant-source-line"><span data-source-detail></span><span data-last-update></span></div>`;
  }
  function tag(s,id,fallback) { const p=s.parameters[id];return p?`${number(p.value,2)} ${esc(p.unidade)}`:fallback||'—'; }
  function sensor(s,id,x,y,label) {
    if(!s.parameters[id])return '';
    return `<g class="hmi-sensor" data-parameter="${esc(id)}" role="button" tabindex="0" aria-label="${esc(label)}: ${tag(s,id)}. Localizar parâmetro."><path class="hmi-sensor-line" d="M${x} ${y+12}v31"/><circle class="hmi-sensor-dot" cx="${x}" cy="${y+43}" r="5"/><text x="${x}" y="${y-16}" text-anchor="middle">${esc(label)}</text><text class="hmi-sensor-reading" data-value="param:${esc(id)}" x="${x}" y="${y+4}" text-anchor="middle">${tag(s,id)}</text></g>`;
  }
  function processDiagram(machine,s) {
    return MSA.processVisuals.line(machine,s);
  }

  function timeline(s) {
    if(!s.timeline.length)return '<p class="plant-muted">Nenhum estado registrado neste período.</p>';
    const now=s.source==='simulated'?s.updatedAt:Date.now(),start=s.periodStart||s.timeline[0].start,span=Math.max(1,now-start);
    return `<div class="hmi-timeline" role="img" aria-label="Sequência dos estados no período">${s.timeline.map(t=>{const end=t.end||now,width=Math.max(0,(Math.min(end,now)-Math.max(t.start,start))/span*100);return `<span class="state-${t.state}" style="width:${width}%" title="${esc(stateLabel(t.state)+' · '+clock(t.start)+' · '+t.reason)}"></span>`;}).join('')}</div><div class="hmi-timeline-axis"><span>${clock(start)}</span><span>Agora</span></div>`;
  }
  function chart(s) {
    const points=(s.samples||[]).filter(p=>Number.isFinite(p.cycleSeconds)&&Number.isFinite(p.time)).sort((a,b)=>a.time-b.time);
    if(points.length<2)return '<p class="plant-muted">Histórico de ciclo indisponível para esta fonte.</p>';
    const values=points.map(p=>p.cycleSeconds);if(Number.isFinite(s.idealCycleSeconds))values.push(s.idealCycleSeconds);
    const min=Math.min(...values)-.5,max=Math.max(...values)+.5;
    const x=p=>52+(p.time-points[0].time)/Math.max(1,points.at(-1).time-points[0].time)*560,y=v=>112-(v-min)/Math.max(.1,max-min)*84;
    return `<svg class="hmi-trend" viewBox="0 0 660 156" role="img" aria-label="Histórico do tempo de ciclo, em segundos"><path class="hmi-chart-axis" d="M52 22v90h560"/><text x="44" y="29" text-anchor="end">${number(max,1)}</text><text x="44" y="115" text-anchor="end">${number(min,1)}</text>${s.idealCycleSeconds?`<path class="hmi-chart-reference" d="M52 ${y(s.idealCycleSeconds)}H612"/><text x="614" y="${y(s.idealCycleSeconds)-5}" text-anchor="end">Referência ${number(s.idealCycleSeconds,1)} s</text>`:''}<polyline class="hmi-chart-line" points="${points.map(p=>x(p)+','+y(p.cycleSeconds)).join(' ')}"/><text x="52" y="141">${clock(points[0].time)}</text><text x="612" y="141" text-anchor="end">${clock(points.at(-1).time)}</text></svg>`;
  }
  function parameterList(s) {
    const entries=Object.entries(s.parameters);
    return entries.length?entries.map(([id,p])=>`<div class="hmi-reading ${p.alarm?'has-alarm':''}" id="reading-${esc(id)}" data-parameter="${esc(id)}" role="button" tabindex="0"><div><span>${esc(p.nome||id)}</span><strong data-value="param:${esc(id)}">${tag(s,id)}</strong></div><span class="hmi-reading-limits">${Number.isFinite(p.min)&&Number.isFinite(p.max)?`Limites ${number(p.min,2)} a ${number(p.max,2)} ${esc(p.unidade)}`:'Limites não configurados'}</span><span class="hmi-reading-origin" data-parameter-time="${esc(id)}">${s.source==='manual'?'Apontamento':'Leitura da fonte'} · ${clock(p.updatedAt)}</span></div>`).join(''):'<p class="plant-muted">Nenhum parâmetro disponível para este equipamento.</p>';
  }
  function alarms(s) {
    return s.alarms.length?`<ul class="hmi-alarms">${s.alarms.map(a=>`<li class="${a.severity==='critico'?'is-critical':''}"><strong>${esc(a.code)}</strong><span>${esc(a.description)}</span><small>${clock(a.since)}</small></li>`).join('')}</ul>`:'<p class="plant-clear">Nenhum alarme ativo na fonte selecionada.</p>';
  }
  function eventTable(s) {
    const rows=[...s.events].sort((a,b)=>b.time-a.time);
    return rows.length?`<div class="ops-table-wrap" tabindex="0" role="region" aria-label="Histórico de eventos"><table class="ops-table"><thead><tr><th>Horário</th><th>Tipo</th><th>Evento</th><th>Estado</th></tr></thead><tbody>${rows.map(e=>`<tr><td>${clock(e.time)}</td><td>${esc({estado:'Estado',alarme:'Alarme',parada:'Parada',leitura:'Leitura',ocorrencia:'Ocorrência'}[e.type]||e.type)}</td><td>${esc(e.description)}</td><td>${stateLabel(e.state)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="plant-muted">Nenhum evento disponível.</p>';
  }
  function stopTable(s) {
    const rows=s.timeline.filter(t=>['parada','setup','manutencao'].includes(t.state)).sort((a,b)=>b.start-a.start);
    return rows.length?`<div class="ops-table-wrap" tabindex="0" role="region" aria-label="Histórico de paradas e intervenções"><table class="ops-table"><thead><tr><th>Estado</th><th>Início</th><th>Fim</th><th>Duração</th><th>Motivo</th></tr></thead><tbody>${rows.map(t=>`<tr><td>${stateLabel(t.state)}</td><td>${clock(t.start)}</td><td>${t.end?clock(t.end):'Em andamento'}</td><td data-duration-start="${t.start}" data-duration-end="${t.end||''}">${duration(((t.end||Date.now())-t.start)/1000)}</td><td>${esc(t.reason)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="plant-muted">Nenhuma parada disponível no período.</p>';
  }
  function detailSignature(s) {
    return [tab,selected,telemetry.mode,s.events.length,s.events.at(-1)?.id,s.timeline.length,Object.keys(s.parameters).join(','),!!s.efficiency].join('|');
  }
  function renderTab(machine,s) {
    const panel=root.querySelector('#plant-tab-panel');if(!panel)return;
    const existingDiagram=panel.querySelector('.process-line');
    tableSignature=detailSignature(s);
    if(tab==='operacao')panel.innerHTML=`<div class="supervisor-operation"><div class="hmi-process"><div class="hmi-process-heading"><div><span class="plant-eyebrow">FLUXO DE PRODUÇÃO · ${machine.productKind==='fones'?'FONES':'CAPACETES'}</span><h3>Linha de ${machine.productKind==='fones'?'protetores auditivos':'capacetes'}</h3></div><span class="hmi-phase-label" data-phase>${esc(s.phase)}</span></div>${processDiagram(machine,s)}<div class="process-stages">${['Injeção','Acabamento','Montagem','Inspeção','Embalagem'].map((name,i)=>`<span><b>${String(i+1).padStart(2,'0')}</b>${name}</span>`).join('')}</div><div class="hmi-cycle"><span>Avanço do ciclo <strong data-value="cycleProgress" data-suffix="%">—</strong></span><div class="hmi-cycle-track"><span data-cycle-fill></span></div><span>Referência <strong data-value="idealCycleSeconds" data-suffix=" s">—</strong></span></div></div><aside class="hmi-readings"><h3>Parâmetros do processo</h3>${parameterList(s)}<h3 class="hmi-alarm-title">Alarmes ativos</h3><div data-alarms>${alarms(s)}</div></aside></div><div class="hmi-bottom"><section><h3>Estados do período</h3><div data-timeline>${timeline(s)}</div></section><section><h3>Tempo de ciclo <span>(s)</span></h3><div data-cycle-chart>${chart(s)}</div></section></div>`;
    if(tab==='paradas')panel.innerHTML=`<div class="hmi-efficiency">${metric('Disponibilidade','efficiency.availability','%')}${metric('Desempenho','efficiency.performance','%')}${metric('Qualidade','efficiency.quality','%')}${metric('OEE','efficiency.oee','%')}</div>${!s.efficiency?'<p class="plant-muted">OEE indisponível: esta fonte não contém todos os tempos e contadores necessários.</p>':''}<div class="hmi-times">${metric('Paradas','stopSeconds')}${metric('Setup','setupSeconds')}${metric('Manutenção','maintenanceSeconds')}</div><h3>Estados do período</h3><div data-timeline>${timeline(s)}</div><h3 class="hmi-section-heading">Paradas e intervenções</h3>${stopTable(s)}`;
    if(tab==='qualidade')panel.innerHTML=`<div class="hmi-quality-totals">${metric('Total produzido','totalCount',' peças')}${metric('Peças aprovadas','goodCount',' peças')}${metric('Refugos','rejectedCount',' peças')}${metric('Taxa de refugo','rejectRate','%')}</div><div class="hmi-quality-bar" role="img" aria-label="Distribuição entre aprovadas e refugos"><span data-good-bar></span><span data-reject-bar></span></div><div class="plant-legend"><span><i class="plant-state-marker state-operando" aria-hidden="true"></i>Aprovadas</span><span><i class="plant-state-marker state-parada" aria-hidden="true"></i>Refugos</span></div>${s.source==='manual'?`<p class="plant-muted">Peças suspeitas: ${number(s.suspectCount)} · perda de material: ${number(s.materialLoss,2)} kg. Material e peças são contabilizados separadamente.</p>`:`<p class="plant-muted">${s.source==='simulated'?'Contagem demonstrativa':'Contagem recebida da fonte'} de aprovação e rejeição no processo.</p>`}`;
    if(tab==='historico')panel.innerHTML=`<h3>Eventos do equipamento</h3>${eventTable(s)}<h3 class="hmi-section-heading">Evolução do tempo de ciclo <span>(s)</span></h3><div data-cycle-chart>${chart(s)}</div>`;
    if(tab==='operacao'&&existingDiagram)panel.querySelector('.process-line')?.replaceWith(existingDiagram);
    updateDetail(machine,s);
  }
  function render() {
    if(!active)return;
    const reopenSummary=selected?'':summaryId;closeSummary(false);
    resizeObserver?.disconnect();cancelAnimationFrame(flowFrame);pointers.clear();hovered='';tableSignature='';
    const focusId=root.contains(document.activeElement)||headerControls?.contains(document.activeElement)?document.activeElement.id:'';
    const machine=catalog().find(m=>m.id===selected);
    root.innerHTML=`<div class="plant-page ${selected?'is-supervisory':'is-map'}" data-mode="${telemetry.mode}">${selected?(machine?supervisory(machine):`<div class="plant-unavailable">${button('Voltar à planta','back')}<h2>Equipamento indisponível nesta fonte</h2><p>Selecione outro equipamento ou altere a fonte de dados.</p>${sourceControls()}</div>`):renderMap()}<p class="plant-feedback" role="status" aria-live="polite" hidden></p><p class="plant-data-error" role="status" hidden></p></div>`;
    renderHeader();
    lastMode=telemetry.mode+'|'+telemetry.adapterName;catalogSignature=JSON.stringify(catalog());
    if(machine)renderTab(machine,sample(machine));
    else if(!selected) {
      const viewport=root.querySelector('#plant-canvas');
      resizeObserver=new ResizeObserver(()=>{
        const rect=viewport.getBoundingClientRect();
        if(!camera.scale||camera.autoFit)fit();
        else {camera.x+=(rect.width-camera.width)/2;camera.y+=(rect.height-camera.height)/2;camera.width=rect.width;camera.height=rect.height;applyCamera();}
      });
      resizeObserver.observe(viewport);startMapFlow();requestAnimationFrame(()=>{if(!active||selected)return;if(!camera.scale)fit();else applyCamera();updateMap();});
    }
    if(focusId)(root.querySelector('#'+CSS.escape(focusId))||headerControls?.querySelector('#'+CSS.escape(focusId)))?.focus({preventScroll:true});
    update();
    if(reopenSummary&&catalog().some(m=>m.id===reopenSummary))openMachine(reopenSummary);
  }
  function fit() {
    const viewport=root.querySelector('#plant-canvas');if(!viewport)return;
    const rect=viewport.getBoundingClientRect(),area=sector==='todos'?null:layout.areas.find(a=>a.id===sector);
    const bounds=area?{x:area.x-50,y:area.y-65,width:area.width+100,height:area.height+130}:{x:layout.building.x,y:layout.building.y,width:layout.building.width,height:layout.building.height};
    camera.autoFit=true;camera.width=rect.width;camera.height=rect.height;camera.scale=Math.min((rect.width-12)/bounds.width,(rect.height-12)/bounds.height);
    camera.x=(rect.width-bounds.width*camera.scale)/2-bounds.x*camera.scale;
    camera.y=(rect.height-bounds.height*camera.scale)/2-bounds.y*camera.scale;applyCamera();
  }
  function applyCamera() {
    const svg=root?.querySelector('#plant-svg');if(!svg)return;
    const rect=root.querySelector('#plant-canvas').getBoundingClientRect();
    camera.width=rect.width;camera.height=rect.height;
    svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
    svg.querySelector('#plant-world').setAttribute('transform',`translate(${camera.x} ${camera.y}) scale(${camera.scale||1})`);
    const textSize=Math.min(22,Math.max(16,10/(camera.scale||1)));svg.style.setProperty('--map-text-size',textSize+'px');
    svg.querySelectorAll('.floor-sector-name').forEach(node=>{
      const area=layout.areas.find(a=>a.id===node.parentElement.dataset.area),full=node.dataset.number+' · '+node.dataset.full;
      node.textContent=full.length*textSize*.56>area.width-28?node.dataset.number+' · '+node.dataset.short:full;
    });
    svg.querySelectorAll('.machine-state-dot').forEach(node=>node.setAttribute('transform',`translate(60 -36) scale(${1/(camera.scale||1)})`));
    svg.classList.toggle('is-overview',camera.scale<.36);
    root.querySelector('#plant-zoom').textContent=Math.round((camera.scale||1)*100)+'%';
  }
  function zoom(factor,cx=camera.width/2,cy=camera.height/2) {
    const scale=Math.max(.14,Math.min(3.6,(camera.scale||1)*factor)),ratio=scale/(camera.scale||1);
    camera.autoFit=false;camera.x=cx-(cx-camera.x)*ratio;camera.y=cy-(cy-camera.y)*ratio;camera.scale=scale;applyCamera();hideTooltip();
  }
  function updateSource(samples) {
    const source=root.querySelector('[data-source-detail]'),last=root.querySelector('[data-last-update]');
    if(source)source.textContent=telemetry.mode==='simulation'?'Dados de demonstração'+(telemetry.paused?' · pausado':''):telemetry.mode==='records'?(['registrosProducao','paradas','perdas'].some(key=>(context.state[key]||[]).some(record=>record.id?.startsWith('demo-v1-')))?'Dados de demonstração · Registros':'Registros do sistema'):(telemetry.adapterName||'API / IoT')+(samples.some(s=>s.stale)?' · dados desatualizados':'');
    const stamp=Math.max(0,...samples.map(s=>s.updatedAt||0));
    if(last)last.textContent=stamp?'Última atualização '+clock(stamp):'Sem leitura recebida';
    const error=root.querySelector('.plant-data-error'),message=telemetry.error||(telemetry.mode==='records'?context.state.error||'':'');error.hidden=!message;error.textContent=message;
    [root,headerControls].filter(Boolean).forEach(host=>host.querySelectorAll('[data-plant-action="pause"]').forEach(pause=>{pause.textContent=telemetry.paused?'Retomar':'Pausar';pause.setAttribute('aria-pressed',telemetry.paused);}));
  }
  function updateMap() {
    const entries=catalog().map(machine=>({machine,s:sample(machine)})),visible=entries.filter(({machine,s})=>matches(machine,s));
    const totals={'data-map-count':visible.length,'data-map-running':visible.filter(v=>v.s.state==='operando'&&!v.s.stale).length,'data-map-stopped':visible.filter(v=>v.s.state==='parada').length,'data-map-alarms':visible.filter(v=>v.s.alarms.length).length,'data-map-output':visible.length&&visible.every(v=>v.s.goodCount!=null)?visible.reduce((sum,v)=>sum+v.s.goodCount,0):null};
    Object.entries(totals).forEach(([key,value])=>{const node=root.querySelector('['+key+']');if(node)node.textContent=number(value);});
    root.querySelectorAll('[data-machine]').forEach(node=>{
      const item=entries.find(v=>v.machine.id===node.dataset.machine);if(!item)return;
      const match=matches(item.machine,item.s),displayState=item.s.stale?'desconhecido':item.s.state;
      node.setAttribute('class',`floor-machine state-${displayState}${match?'':' is-dimmed'}${item.s.alarms.length?' has-alarm':''}${summaryId===item.machine.id?' is-selected':''}`);
      node.setAttribute('aria-label',`${item.machine.id} · ${item.machine.nome} · ${stateLabel(displayState)}${item.s.alarms.length?' · com alerta':''} · Consultar equipamento`);
      node.setAttribute('tabindex',match?'0':'-1');node.setAttribute('aria-disabled',!match);
      const glyph=node.querySelector('.machine-state-symbol'),glyphKey=displayState+':'+(item.s.alarms.length>0);
      if(glyph&&glyph.dataset.state!==glyphKey){glyph.setAttribute('d',stateGlyph(displayState,item.s.alarms.length>0));glyph.dataset.state=glyphKey;}
      const stateText=node.querySelector('.machine-state-text');if(stateText)stateText.textContent=stateLabel(displayState);
      const progressFill=node.querySelector('.machine-progress-fill');if(progressFill)progressFill.setAttribute('width',96*(item.s.cycleProgress||0));
      const alarm=node.querySelector('.machine-alarm');if(alarm)alarm.style.display=item.s.alarms.length?'':'none';
    });
    root.querySelectorAll('[data-area]').forEach(node=>node.classList.toggle('is-dimmed',sector!=='todos'&&node.dataset.area!==sector));
    const empty=root.querySelector('#plant-empty');if(empty){empty.hidden=visible.length>0;empty.querySelector('strong').textContent=entries.length?'Nenhum equipamento atende aos filtros':'Nenhum equipamento no contexto';empty.querySelector('span').textContent=entries.length?'Altere os filtros para destacar outros equipamentos.':'Use Simulação para explorar a planta ou prepare o catálogo em Configurações.';}
    root.querySelectorAll('[data-unplaced-machine]').forEach(node=>{node.hidden=!visible.some(v=>v.machine.id===node.dataset.unplacedMachine);});
    const unplaced=root.querySelector('.plant-unplaced');if(unplaced)unplaced.hidden=!visible.some(v=>!layout.placements[v.machine.id]);
    const chosen=catalog().find(m=>m.id===summaryId),chosenKind=chosen?.productKind||layout.machines.find(m=>m.id===summaryId)?.productKind;
    root.querySelectorAll('[data-route]').forEach(node=>{const related=chosen?chosenKind===node.dataset.route:product!=='todos'?product===node.dataset.route:sector!=='todos'&&(sector==='capacetes'?node.dataset.route==='capacetes':sector==='montagem'?node.dataset.route==='fones':true);node.classList.toggle('is-highlighted',!!related);});
    if(hovered)showTooltip(hovered);
    updateSource(entries.map(v=>v.s));
  }
  function setValue(node,s) {
    const key=node.dataset.value;let value;
    if(key.startsWith('param:')) {
      const p=s.parameters[key.slice(6)];node.textContent=p?.value!=null?number(p.value,2)+' '+(p.unidade||''):'—';return;
    }
    if(key==='cycleProgress')value=s.cycleProgress==null?null:s.cycleProgress*100;
    else if(key==='rejectRate')value=s.totalCount>0?s.rejectedCount/s.totalCount*100:null;
    else value=key.split('.').reduce((result,part)=>result?.[part],s);
    const timeKeys=['operatingSeconds','stopSeconds','setupSeconds','maintenanceSeconds'];
    node.textContent=timeKeys.includes(key)?duration(value):number(value,['cycleSeconds','idealCycleSeconds','speed','rejectRate'].includes(key)||key.startsWith('efficiency.')?1:0)+(value==null?'':node.dataset.suffix||'');
  }
  function updateDetail(machine,s) {
    root.querySelectorAll('[data-value]').forEach(node=>setValue(node,s));
    const state=root.querySelector('[data-machine-state]'),since=root.querySelector('[data-state-since]'),period=root.querySelector('[data-period]');
    if(state){state.textContent=s.stale?'Dados desatualizados':stateLabel(s.state);state.parentElement.className='supervisor-state state-'+(s.stale?'desconhecido':s.state);}
    if(since)since.textContent=s.stateSince?'Desde '+clock(s.stateSince):'';
    if(period)period.textContent=s.periodLabel||'Período da fonte';
    const scenario=root.querySelector('#plant-scenario');if(scenario&&document.activeElement!==scenario)scenario.value=s.alarms.some(a=>a.parameterId)?'alerta':s.state;
    const phaseNode=root.querySelector('[data-phase]');if(phaseNode)phaseNode.textContent=s.stale?'Aguardando comunicação':s.phase||stateLabel(s.state);
    const fill=root.querySelector('[data-cycle-fill]');if(fill)fill.style.width=Math.min(100,Math.max(0,(s.cycleProgress||0)*100))+'%';
    const diagram=root.querySelector('.hmi-diagram');if(diagram)diagram.classList.toggle('is-running',s.state==='operando'&&!telemetry.paused&&!s.stale);
    const mould=root.querySelector('#hmi-moving-mould'),part=root.querySelector('#hmi-moving-part');
    const progress=s.state==='operando'&&!s.stale?s.cycleProgress||0:0;
    if(mould)mould.style.transform=machine.setorId==='injecao'?`translateX(${Math.sin(progress*Math.PI)*14}px)`:`translateY(${Math.sin(progress*Math.PI)*28}px)`;
    if(part)part.style.transform=`translateX(${progress*(machine.setorId==='selagem'?650:machine.setorId==='injecao'?170:375)}px)`;
    MSA.processVisuals.update(root,machine,s,telemetry.paused);
    const beacon=root.querySelector('[data-hmi-beacon]');if(beacon)beacon.setAttribute('class','hmi-beacon state-'+(s.stale?'desconhecido':s.state));
    Object.entries(s.parameters).forEach(([id,p])=>{
      const entry=root.querySelector('#reading-'+CSS.escape(id));entry?.classList.toggle('has-alarm',!!p.alarm);
      const origin=entry?.querySelector('[data-parameter-time]');if(origin)origin.textContent=(s.source==='manual'?'Apontamento':'Leitura da fonte')+' · '+clock(p.updatedAt);
      const sensorNode=[...root.querySelectorAll('[data-parameter]')].find(n=>n.dataset.parameter===id);
      if(sensorNode){sensorNode.classList.toggle('has-alarm',!!p.alarm);sensorNode.setAttribute('aria-label',`${p.nome}: ${number(p.value,2)} ${p.unidade||''}. Localizar parâmetro.`);}
    });
    const alarmsNode=root.querySelector('[data-alarms]');if(alarmsNode){const html=alarms(s);if(alarmsNode.innerHTML!==html)alarmsNode.innerHTML=html;}
    const tl=root.querySelector('[data-timeline]');if(tl)tl.innerHTML=timeline(s);
    root.querySelectorAll('[data-duration-start]').forEach(node=>{node.textContent=duration(((Number(node.dataset.durationEnd)||(s.source==='simulated'?s.updatedAt:Date.now()))-Number(node.dataset.durationStart))/1000);});
    const good=root.querySelector('[data-good-bar]'),rejected=root.querySelector('[data-reject-bar]');
    if(good)good.style.width=s.totalCount>0?s.goodCount/s.totalCount*100+'%':'0%';
    if(rejected)rejected.style.width=s.totalCount>0?s.rejectedCount/s.totalCount*100+'%':'0%';
    const signature=detailSignature(s);
    if(signature!==tableSignature){renderTab(machine,s);return;}
    const trend=root.querySelector('[data-cycle-chart]');if(trend&&trend.dataset.last!==String(s.samples.at(-1)?.time)){trend.innerHTML=chart(s);trend.dataset.last=String(s.samples.at(-1)?.time);}
    updateSource([s]);
  }
  function update() {
    if(!active)return;
    if(lastMode!==telemetry.mode+'|'+telemetry.adapterName||catalogSignature!==JSON.stringify(catalog())){render();return;}
    if(selected){const machine=catalog().find(m=>m.id===selected);if(machine)updateDetail(machine,sample(machine));else updateSource([]);}
    else {updateMap();updateSummary();}
  }
  function hideTooltip() {hovered='';const tooltip=root?.querySelector('#plant-tooltip');if(tooltip)tooltip.hidden=true;}
  function showTooltip(id,event) {
    const machine=catalog().find(m=>m.id===id),tooltip=root.querySelector('#plant-tooltip'),canvas=root.querySelector('#plant-canvas');
    if(!machine||!tooltip||!matches(machine)){hideTooltip();return;}
    hovered=id;const s=sample(machine);
    tooltip.innerHTML=`<strong>${esc(machine.id)}</strong><span>Clique para consultar o equipamento</span>`;
    tooltip.hidden=false;
    if(event) {
      const rect=canvas.getBoundingClientRect(),node=root.querySelector('[data-machine="'+CSS.escape(id)+'"]')?.getBoundingClientRect();
      const x=event.clientX??(node?node.left+node.width/2:rect.left),y=event.clientY??node?.bottom??rect.top;
      const width=tooltip.offsetWidth,height=tooltip.offsetHeight;
      tooltip.style.left=Math.max(8,Math.min(rect.width-width-8,x-rect.left+14))+'px';
      tooltip.style.top=Math.max(8,Math.min(rect.height-height-8,y-rect.top+18))+'px';
    }
  }
  function feedback(message) {const node=root.querySelector('.plant-feedback');node.textContent=message;node.hidden=false;}
  function closeSummary(restore=true) {
    restoreSummaryFocus=restore;
    const dialog=root?.querySelector('.plant-machine-dialog');
    summaryId='';if(dialog?.open)dialog.close();
  }
  function updateSummary() {
    const dialog=root?.querySelector('.plant-machine-dialog');if(!dialog?.open)return;
    const machine=catalog().find(m=>m.id===summaryId);if(!machine){closeSummary();return;}
    const s=sample(machine);
    dialog.querySelectorAll('[data-value]').forEach(node=>setValue(node,s));
    const state=dialog.querySelector('[data-machine-state]');
    state.textContent=s.stale?'Sem leitura atual':stateLabel(s.state);
    state.parentElement.className='supervisor-state state-'+(s.stale?'desconhecido':s.state);
    const last=[...s.timeline].filter(t=>t.state==='parada').sort((a,b)=>b.start-a.start)[0];
    dialog.querySelector('[data-last-stop]').textContent=last?`${clock(last.start)} · ${last.reason||'Parada'}${last.end?'':' · em andamento'}`:(s.source==='api'?'—':'Nenhuma no período');
    dialog.querySelector('[data-modal-source]').textContent=s.sourceLabel||'Fonte sem identificação';
    dialog.querySelector('[data-modal-updated]').textContent=s.updatedAt?'Atualizado às '+clock(s.updatedAt):'Sem leitura recebida';
    dialog.querySelector('[data-preview-phase]').textContent=s.stale?'Aguardando comunicação':s.phase||stateLabel(s.state);
    const alarmNode=dialog.querySelector('[data-alarms]'),html=alarms(s);if(alarmNode.innerHTML!==html)alarmNode.innerHTML=html;
    MSA.processVisuals.update(dialog,machine,s,telemetry.paused);
    const pause=dialog.querySelector('[data-plant-action="pause"]');if(pause){pause.textContent=telemetry.paused?'Retomar animação':'Pausar animação';pause.setAttribute('aria-pressed',telemetry.paused);}
  }
  function openMachine(id) {
    if(selected||summaryId===id&&root.querySelector('.plant-machine-dialog')?.open)return;
    const machine=catalog().find(m=>m.id===id);if(!machine)return;
    closeSummary(false);root.querySelector('.plant-machine-dialog')?.remove();hideTooltip();
    summaryId=id;restoreSummaryFocus=true;
    summaryTrigger=root.querySelector('[data-machine="'+CSS.escape(id)+'"]')||document.activeElement;
    const svg=root.querySelector('#plant-svg');pointers.forEach((_,pointerId)=>{if(svg?.hasPointerCapture(pointerId))svg.releasePointerCapture(pointerId);});pointers.clear();drag=null;pinch=null;
    const s=sample(machine),dialog=document.createElement('dialog');dialog.className='plant-machine-dialog';dialog.setAttribute('aria-labelledby','plant-machine-title');
    dialog.innerHTML=`<header class="machine-dialog-heading"><div><p class="supervisor-code">${esc(machine.id)} · ${esc(sectorName(machine.setorId))}</p><h2 id="plant-machine-title">${esc(machine.nome)}</h2></div>${button('×','close-summary','aria-label="Fechar resumo da máquina" autofocus')}</header><div class="machine-dialog-body"><div class="machine-dialog-meta"><p>${esc(machine.produto||'Produto não informado')}${machine.order?' · '+esc(machine.order):''}</p><div class="supervisor-state state-${s.state}"><span data-machine-state>${stateLabel(s.state)}</span></div></div><div class="machine-summary-grid">${metric('Produção atual / aprovada','goodCount',' peças')}${metric('Meta','goal',' peças')}${metric('Tempo de operação','operatingSeconds')}${metric('Refugos','rejectedCount',' peças')}${metric('Alertas ativos','alarms.length')}<div class="hmi-metric" data-summary="last-stop"><span>Última parada</span><strong data-last-stop>—</strong></div></div><section class="machine-preview"><div class="hmi-process-heading"><div><span class="plant-eyebrow">PRÉVIA DO SUPERVISÓRIO</span><h3>Linha de ${machine.productKind==='fones'?'protetores auditivos':'capacetes'}</h3></div><span data-preview-phase></span></div>${processDiagram(machine,s)}</section><div data-alarms>${alarms(s)}</div><p class="machine-dialog-source"><span data-modal-source></span> · <span data-modal-updated></span></p></div><footer class="machine-dialog-footer">${telemetry.mode==='simulation'?button('Pausar animação','pause'):''}${button('Abrir supervisório completo','open-supervisor')}</footer>`;
    dialog.addEventListener('close',()=>{
      if(root?.querySelector('.plant-machine-dialog')!==dialog)return;
      summaryId='';updateMap();
      if(restoreSummaryFocus&&active&&!selected)(summaryTrigger?.isConnected?summaryTrigger:root.querySelector('#plant-svg'))?.focus({preventScroll:true});
      restoreSummaryFocus=true;
    });
    dialog.addEventListener('click',event=>{
      if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();
      if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeSummary();
    });
    root.querySelector('.plant-page').append(dialog);dialog.showModal();updateSummary();updateMap();
  }

  function handleClick(event) {
    const equipment=event.target.closest('[data-machine],[data-open-machine]');
    if(equipment){if(Date.now()<dragUntil)return;if(equipment.getAttribute('aria-disabled')!=='true')openMachine(equipment.dataset.machine||equipment.dataset.openMachine);return;}
    const productControl=event.target.closest('[data-plant-product]');
    if(productControl){product=productControl.dataset.plantProduct;root.querySelectorAll('[data-plant-product]').forEach(n=>n.setAttribute('aria-pressed',n===productControl));updateMap();return;}
    const control=event.target.closest('[data-plant-action]');
    if(control) {
      const action=control.dataset.plantAction;
      if(action==='theme'){document.querySelector('[data-theme-toggle]')?.click();}
      if(action==='close-summary')closeSummary();
      if(action==='open-supervisor'){const id=summaryId;closeSummary(false);if(id)location.hash='mapa-planta/'+encodeURIComponent(id);}
      if(action==='back')location.hash='mapa-planta';
      if(action==='fullscreen'){const page=root.querySelector('.plant-page');if(document.fullscreenElement)document.exitFullscreen?.();else if(page.requestFullscreen)page.requestFullscreen().catch(()=>page.classList.toggle('is-expanded'));else page.classList.toggle('is-expanded');}
      if(action==='pause')telemetry.pause();
      if(action==='zoom-in')zoom(1.25);
      if(action==='zoom-out')zoom(.8);
      if(action==='fit')fit();
    }
    const tabControl=event.target.closest('[data-plant-tab]');
    if(tabControl) {
      tab=tabControl.dataset.plantTab;
      root.querySelectorAll('[data-plant-tab]').forEach(n=>{const chosen=n===tabControl;n.setAttribute('aria-selected',chosen);n.tabIndex=chosen?0:-1;});
      const panel=root.querySelector('#plant-tab-panel');panel.setAttribute('aria-labelledby',tabControl.id);
      const machine=catalog().find(m=>m.id===selected);if(machine)renderTab(machine,sample(machine));
    }
    const parameter=event.target.closest('[data-parameter]');
    if(parameter) {
      root.querySelectorAll('.hmi-reading').forEach(n=>n.classList.remove('is-highlighted'));
      const reading=root.querySelector('#reading-'+CSS.escape(parameter.dataset.parameter));
      reading?.classList.add('is-highlighted');reading?.scrollIntoView({block:'nearest',behavior:'smooth'});
    }
  }
  function handleChange(event) {
    if(event.target.id==='plant-source') {product='todos';sector='todos';status='todos';problems=false;selected=routeMachine();telemetry.setMode(event.target.value);return;}
    if(event.target.id==='plant-sector'){sector=event.target.value;updateMap();fit();}
    if(event.target.id==='plant-status'){status=event.target.value;updateMap();}
    if(event.target.id==='plant-problems'){problems=event.target.checked;updateMap();}
    if(event.target.id==='plant-scenario') {
      telemetry.scenario(selected,event.target.value);feedback('Cenário da simulação atualizado.');update();
    }
  }
  function handleKey(event) {
    const machine=event.target.closest('[data-machine]'),sensorNode=event.target.closest('[data-parameter]');
    if((machine||sensorNode)&&['Enter',' '].includes(event.key)){event.preventDefault();event.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));return;}
    const tabControl=event.target.closest('[data-plant-tab]');
    if(tabControl&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
      event.preventDefault();const tabs=[...root.querySelectorAll('[data-plant-tab]')],current=tabs.indexOf(tabControl);
      const index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(current+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
      tabs[index].focus();tabs[index].click();return;
    }
    if(event.target.id==='plant-svg') {
      const delta={ArrowLeft:[48,0],ArrowRight:[-48,0],ArrowUp:[0,48],ArrowDown:[0,-48]}[event.key];
      if(delta){event.preventDefault();camera.autoFit=false;camera.x+=delta[0];camera.y+=delta[1];applyCamera();}
      if(event.key==='+'||event.key==='='){event.preventDefault();zoom(1.25);}
      if(event.key==='-'){event.preventDefault();zoom(.8);}
      if(event.key==='0'){event.preventDefault();fit();}
    }
    if(event.key==='Escape')hideTooltip();
  }
  function pointerDown(event) {
    const svg=event.target.closest('#plant-svg');if(!svg||event.button>0)return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});svg.setPointerCapture(event.pointerId);
    if(pointers.size===1)drag={x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false,machine:event.target.closest('[data-machine]')?.dataset.machine||''};
    else if(pointers.size===2){const [a,b]=[...pointers.values()];pinch={distance:Math.hypot(a.x-b.x,a.y-b.y)};drag=null;hideTooltip();}
  }
  function pointerMove(event) {
    if(pointers.has(event.pointerId)) {
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(pointers.size===2) {
        const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y),rect=root.querySelector('#plant-svg').getBoundingClientRect();
        if(pinch?.distance>0)zoom(distance/pinch.distance,(a.x+b.x)/2-rect.left,(a.y+b.y)/2-rect.top);
        pinch={distance};dragUntil=Date.now()+350;
      }else if(drag) {
        if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>5)drag.moved=true;
        if(drag.moved){root.querySelector('#plant-svg')?.classList.add('is-dragging');camera.autoFit=false;camera.x+=event.clientX-drag.x;camera.y+=event.clientY-drag.y;applyCamera();hideTooltip();dragUntil=Date.now()+350;}
        drag.x=event.clientX;drag.y=event.clientY;
      }
      return;
    }
    const machine=event.target.closest('[data-machine]');if(machine)showTooltip(machine.dataset.machine,event);else hideTooltip();
  }
  function pointerUp(event) {
    const id=event.type==='pointerup'&&pointers.size===1&&drag&&!drag.moved&&drag.machine&&Date.now()>=dragUntil?drag.machine:'';
    const svg=root.querySelector('#plant-svg');if(svg?.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);
    if(pointers.size===1)svg?.classList.remove('is-dragging');
    pointers.delete(event.pointerId);pinch=null;
    if(pointers.size===1){const [p]=pointers.values();drag={...p,startX:p.x,startY:p.y,moved:false};}else drag=null;
    const machine=id&&catalog().find(m=>m.id===id);if(machine&&matches(machine)){openMachine(id);dragUntil=Date.now()+200;}
  }
  function handleWheel(event) {
    if(!event.target.closest('#plant-svg'))return;event.preventDefault();
    const rect=root.querySelector('#plant-svg').getBoundingClientRect();
    zoom(Math.exp(-event.deltaY*.0015),event.clientX-rect.left,event.clientY-rect.top);
  }
  function focusIn(event) {const machine=event.target.closest('[data-machine]');if(machine)showTooltip(machine.dataset.machine,{});}
  function bind() {
    root.addEventListener('click',handleClick);root.addEventListener('change',handleChange);root.addEventListener('keydown',handleKey);
    root.addEventListener('pointerdown',pointerDown);root.addEventListener('pointermove',pointerMove);root.addEventListener('pointerup',pointerUp);root.addEventListener('pointercancel',pointerUp);
    root.addEventListener('pointerleave',hideTooltip);
    root.addEventListener('wheel',handleWheel,{passive:false});
    root.addEventListener('focusin',focusIn);root.addEventListener('focusout',hideTooltip);
  }
  function unbind() {
    if(!root)return;
    root.removeEventListener('click',handleClick);root.removeEventListener('change',handleChange);root.removeEventListener('keydown',handleKey);
    root.removeEventListener('pointerdown',pointerDown);root.removeEventListener('pointermove',pointerMove);root.removeEventListener('pointerup',pointerUp);root.removeEventListener('pointercancel',pointerUp);
    root.removeEventListener('pointerleave',hideTooltip);
    root.removeEventListener('wheel',handleWheel);root.removeEventListener('focusin',focusIn);root.removeEventListener('focusout',hideTooltip);
  }
  MSA.plant={
    open(element,nextContext) {
      const nextSelected=routeMachine(),previousSelected=selected;
      context=nextContext;
      if(lastContextSector!==context.sector) {
        lastContextSector=context.sector;
        if(context.sector&&context.sector!=='todos')sector=context.sector;
        else if(telemetry.mode!=='simulation')sector='todos';
      }
      selected=nextSelected;
      if(selected!==previousSelected)tab='operacao';
      if(!active||root!==element) {
        unbind();root=element;active=true;bind();
        stopSubscription=telemetry.subscribe(update);telemetry.start();render();
      }else if(selected!==previousSelected)render();
      else update();
    },
    close() {
      if(!active)return;closeSummary(false);headerControls?.remove();headerControls=null;active=false;cancelAnimationFrame(flowFrame);unbind();resizeObserver?.disconnect();resizeObserver=null;
      stopSubscription?.();stopSubscription=null;telemetry.stop();pointers.clear();hovered='';
    }
  };
})();


