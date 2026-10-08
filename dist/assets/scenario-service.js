/* Cenário local para apresentação. A fonte Firebase é preservada em ?dados=reais. */
(() => {
 'use strict';
 const query=new URLSearchParams(location.search);
 if(query.get('dados')==='reais')return;
 const preview=query.get('demonstracao')==='1';
 MSA.demo={active:true,preview};
 MSA.config={...MSA.config,sectors:MSA.plantLayout.areas.map(a=>({id:a.id,nome:a.name}))};
 const baseline=MSA.createScenario();MSA.scenarioParameters.upgrade(baseline);MSA.workflows?.upgrade(baseline);
 if(MSA.workflows){for(const [i,sec]of baseline.setores.entries()){const m=baseline.maquinas.find(m=>m.setorId===sec.id),d=new Date(baseline.scenarioAt);d.setHours(9,17+i,12,0);for(let j=0;j<2;j++){const inicio=+d+j*3600000,seconds=8+i+j*3;baseline.paradas.push({id:'micro-exemplo-'+sec.id+'-'+j,maquinaId:m.id,setorId:m.setorId,inicio,fim:inicio+seconds*1000,motivo:j?'Aguardando classificação da liderança':'Travamento de pallet / peça',motivoCodigo:j?'':'travamento-pallet',motivoConfirmado:!j,automatica:true,kind:'parada',failure:false,usuarioId:'coleta-automatica',usuarioRe:'',createdAt:inicio,updatedAt:inicio+seconds*1000,verificado:!j});}}}
 if(MSA.workflows){MSA.workflows.sync(baseline);const context=MSA.workflows.shiftAt(baseline.scenarioAt-1);for(const p of baseline.perfis.filter(p=>p.cargo==='operador'))baseline.alocacoes.push({id:'equipe-'+p.id+'-'+context.dia,funcionarioId:p.id,funcionarioRe:p.re,setorId:p.setorId,setorDestino:p.setorId,maquinaId:p.presente===false?'':p.maquinaId,presenca:p.presente===false?'ausente':'presente',dia:context.dia,turno:context.turno,createdAt:baseline.scenarioAt,updatedAt:baseline.scenarioAt,historico:[{at:baseline.scenarioAt,responsavel:'Liderança · exemplo',status:p.presente===false?'ausente':'presente',observacao:'Conferência ilustrativa do início do turno.'}]});}
 if(MSA.workflows){
  const d=new Date(baseline.scenarioAt);d.setDate(d.getDate()-1);const day=d.toLocaleDateString('sv');
  for(const sec of baseline.setores){const m=baseline.maquinas.find(m=>m.setorId===sec.id),p=baseline.perfis.find(p=>p.cargo==='supervisor'&&p.setorId===sec.id);if(!m||!p)continue;
   const id=MSA.workflows.command(baseline,'handover-create',{maquinaId:m.id,dia:day,turno:'1',acoesRealizadas:'Abastecimento conferido e ajustes do turno registrados.',pendencias:'Verificar reincidência de travamento no alimentador.',observacao:'Confirmar pendências na troca de liderança.'},'',{...p,status:'ativo'});
   const h=baseline.passagensTurno.find(h=>h.id===id);h.id='passagem-exemplo-'+sec.id;h.pendencias.forEach((t,i)=>t.id='pendencia-exemplo-'+sec.id+'-'+i);
   const currentMachine=baseline.maquinas.filter(m=>m.setorId===sec.id).at(-1),today=new Date(baseline.scenarioAt).toLocaleDateString('sv');
   const currentId=MSA.workflows.command(baseline,'handover-create',{maquinaId:currentMachine.id,dia:today,turno:'1',acoesRealizadas:'Conferência de abastecimento e produção concluída.',pendencias:'Confirmar material disponível para o próximo turno.',observacao:'Entrega preparada pela liderança do setor.'},'',{...p,status:'ativo'});
   const current=baseline.passagensTurno.find(h=>h.id===currentId);current.id='passagem-exemplo-atual-'+sec.id;current.pendencias.forEach((t,i)=>t.id='pendencia-exemplo-atual-'+sec.id+'-'+i);

  }
 }
 const collections=Object.keys(baseline).filter(k=>Array.isArray(baseline[k]));
 const originals=Object.fromEntries(collections.map(k=>[k,new Map(baseline[k].map(r=>[r.id,JSON.stringify(r)]))]));
 let state=JSON.parse(JSON.stringify(baseline)),user=null;
 const key='msa-cenario-v3-turnos-'+new Date(state.scenarioAt).toLocaleDateString('sv');
 try{
  let saved=JSON.parse(sessionStorage.getItem(key));
  if(saved?.format==='msa-scenario-delta-v1'){
   const restored={...JSON.parse(JSON.stringify(baseline)),...saved.values};
   for(const k of collections){const delta=saved.collections?.[k],rows=new Map(restored[k].map(r=>[r.id,r]));for(const id of delta?.removed||[])rows.delete(id);for(const row of delta?.changed||[])rows.set(row.id,row);restored[k]=[...rows.values()];}
   saved=restored;
  }
  if(saved?.demo&&Number.isFinite(saved.scenarioAt)&&collections.filter(k=>!MSA.workflows?.collections.includes(k)).every(k=>Array.isArray(saved[k]))&&saved.maquinas.every(m=>m.id&&m.setorId)&&new Set(saved.maquinas.map(m=>m.id)).size===saved.maquinas.length)state=saved;
 }catch{}
 MSA.scenarioParameters.upgrade(state);MSA.workflows?.upgrade(state);
 const watchers=new Set();
 function emit(){watchers.forEach(fn=>fn({...state}));}
 function snapshot(){
  const changes={};
  for(const k of collections){const ids=new Set(state[k].map(r=>r.id));changes[k]={changed:state[k].filter(r=>originals[k].get(r.id)!==JSON.stringify(r)),removed:[...originals[k].keys()].filter(id=>!ids.has(id))};}
  return JSON.stringify({format:'msa-scenario-delta-v1',values:Object.fromEntries(Object.entries(state).filter(([k])=>!collections.includes(k))),collections:changes});
 }
 function storeSnapshot(){try{sessionStorage.setItem(key,snapshot());}catch{console.warn('Não foi possível guardar as alterações deste cenário no navegador.');}}
 function persist(){MSA.workflows?.sync(state);storeSnapshot();emit();}
 if(preview){
  const cargo=['chefe','supervisor','operador','qualidade'].includes(query.get('cargo'))?query.get('cargo'):'chefe';
  let current={id:'cenario-visitante-'+cargo,nome:cargo==='qualidade'?'Ana Lima':cargo==='supervisor'?'Lucas Martins':'Luan Miguel',re:'123456',status:'ativo',cargo,setorId:['chefe','qualidade'].includes(cargo)?'':'montagem',maquinaId:cargo==='operador'?'NHPL':''};
  const authWatchers=new Set();
  MSA.auth={mode:'demo',session:()=>current,role:(u=current)=>MSA.rbac.role(u),can:(p,u=current)=>MSA.rbac.can(p,u),ready:async()=>current,watch:async(fn)=>{authWatchers.add(fn);fn(current);return()=>authWatchers.delete(fn);},logout:async()=>{current=null;}};
  MSA.demo.updateProfile=patch=>{current={...current,...patch};authWatchers.forEach(fn=>fn(current));window.dispatchEvent(new CustomEvent('msa:profile-changed',{detail:current}));};
 }
 if(!preview){
  const original=MSA.auth,session=original.session.bind(original),ready=original.ready.bind(original),watch=original.watch.bind(original);let patch={};
  const overlay=u=>u?{...u,...patch}:null;
  MSA.auth={...original,session:()=>overlay(session()),ready:async()=>overlay(await ready()),watch:async(fn,onError)=>watch(u=>fn(overlay(u)),onError)};
  MSA.demo.updateProfile=next=>{patch={...patch,...next};window.dispatchEvent(new CustomEvent('msa:profile-changed',{detail:MSA.auth.session()}));};
 }
 const requirePermission=(permission,record)=>MSA.rbac.require(permission,user,record);
 const item=(collection,id)=>{const r=state[collection].find(r=>r.id===id);if(!r)throw new Error('Registro não encontrado.');return r;};
 const now=()=>state.scenarioAt;
 const {number,required}=MSA.recordValidation;
 const date=(value,label)=>MSA.recordValidation.date(value,label,now());
 const integer=(value,label)=>{const n=number(value,label);if(!Number.isSafeInteger(n))throw new Error('Informe uma quantidade inteira em peças.');return n;};
 function cleanRecord(collection,v,existing,machine){
  const base={observacao:String(v.observacao||'').trim().slice(0,1000)};
  if(collection==='registrosProducao'){
   const inicio=date(v.inicio,'início do período'),fim=date(v.fim,'fim do período');
   if(fim<=inicio)throw new Error('O fim deve ser posterior ao início.');
   if(!['1','2','3'].includes(String(v.turno)))throw new Error('Selecione um turno válido.');
   return {...base,inicio,fim,quantidade:integer(v.quantidade,'quantidade'),turno:String(v.turno),produto:required(v.produto,'produto',120),lote:required(v.lote,'lote ou ordem',80)};
  }
  if(collection==='paradas'){
   const inicio=date(v.inicio,'início da parada'),fim=v.fim?date(v.fim,'fim da parada'):0;
   if(fim&&fim<inicio)throw new Error('O fim deve ser posterior ao início.');
   return {...base,inicio,fim,...(MSA.workflows?.reason(v)||{motivo:required(v.motivo,'motivo',300)}),motivoConfirmado:true,causa:existing?.causa||'',encerradaPor:fim?user.id:''};
  }
  if(collection==='perdas'){
   if(!['refugo','perda','suspeito'].includes(v.tipo))throw new Error('Selecione o tipo do registro.');
   const quantidade=number(v.quantidade,'quantidade',.001);
   if(v.tipo!=='perda'&&!Number.isSafeInteger(quantidade))throw new Error('Informe uma quantidade inteira de peças.');
   return {...base,tipo:v.tipo,quantidade,unidade:v.tipo==='perda'?'kg':'pecas',data:date(v.data,'data'),motivo:required(v.motivo,'motivo',300),produto:required(v.produto,'produto',120),lote:required(v.lote,'lote ou ordem',80)};
  }
  if(collection==='leituras'){
   const valores=Object.fromEntries(Object.entries(machine.parametros||{}).map(([k,p])=>[k,number(v.valores?.[k]??v['param_'+k],p.nome,-100000)]));
   if(!Object.keys(valores).length)throw new Error('Esta máquina ainda não possui parâmetros cadastrados.');
   return {...base,valores,data:date(v.data,'data'),lote:required(v.lote,'lote ou ordem',80)};
  }
  return {...base,data:date(v.data,'data'),descricao:required(v.descricao,'descrição',1000),prioridade:['normal','alta'].includes(v.prioridade)?v.prioridade:'normal',status:existing?.status||'aberta',resolucao:existing?.resolucao||''};
 }
 MSA.data={
  get state(){return {...state};},get user(){return user;},
  subscribe(fn){watchers.add(fn);fn({...state});return()=>watchers.delete(fn);},
  async start(next){user=next;state.ready=true;emit();},stop(){user=null;},
  async changeContext(v){const m=v.maquinaId?item('maquinas',v.maquinaId):null;const patch=m?{setorId:m.setorId,maquinaId:m.id}:{setorId:v.setorId,maquinaId:''};MSA.demo.updateProfile(patch);},
  async save(collection,values,id){
   const permissions={registrosProducao:'producao:registrar',leituras:'leituras:registrar',paradas:'paradas:registrar',perdas:'perdas:registrar',ocorrencias:'ocorrencias:registrar'};
   if(!permissions[collection])throw new Error('Tipo de registro inválido.');
   const existing=id?item(collection,id):null;
   if(existing&&values.maquinaId&&values.maquinaId!==existing.maquinaId)throw new Error('A máquina de origem não pode ser alterada.');
   const machine=item('maquinas',values.maquinaId||existing?.maquinaId);requirePermission(permissions[collection],existing||machine);
   const record={...existing,...cleanRecord(collection,values,existing,machine),id:id||'exemplo-local-'+crypto.randomUUID(),maquinaId:machine.id,setorId:machine.setorId,usuarioId:existing?.usuarioId||user.id,usuarioRe:existing?.usuarioRe||user.re,createdAt:existing?.createdAt||now(),updatedAt:now(),verificado:false};
   delete record.verificadoPor;delete record.verificadoEm;delete record.diaProducao;
   if(id){delete existing.verificadoPor;delete existing.verificadoEm;delete existing.diaProducao;Object.assign(existing,record);}else state[collection].push(record);persist();return record.id;
  },
  async review(collection,id){if(!['registrosProducao','leituras','paradas','perdas','ocorrencias'].includes(collection))throw new Error('Registro inválido.');const r=item(collection,id);requirePermission('registros:verificar',r);Object.assign(r,{verificado:true,verificadoPor:user.id,verificadoEm:now()});persist();},
  async finishStop(id,cause){const r=item('paradas',id);requirePermission(user.cargo==='supervisor'?'paradas:gerenciar':'paradas:registrar',r);if(r.fim)throw new Error('Parada já encerrada.');if(now()<r.inicio)throw new Error('O fim deve ser posterior ao início.');Object.assign(r,{fim:now(),causa:String(cause||'').slice(0,300),encerradaPor:user.id,updatedAt:now(),verificado:false});delete r.verificadoPor;delete r.verificadoEm;persist();},
  async resolveOccurrence(id,resolution){const r=item('ocorrencias',id);requirePermission('ocorrencias:gerenciar',r);const resolucao=required(resolution,'ação realizada',1000);Object.assign(r,{status:'resolvida',resolucao,verificado:false,updatedAt:now()});delete r.verificadoPor;delete r.verificadoEm;persist();},
  async saveMachine(v,id){
   requirePermission('maquinas:gerenciar',{setorId:v.setorId,id});
   const existing=id?item('maquinas',id):null;
   if(existing&&existing.setorId!==v.setorId)throw new Error('A máquina de origem não pode ser alterada.');
   const machineId=id||required(v.codigo,'código da máquina',40).toUpperCase();
   if(!/^[A-Z0-9_-]+$/.test(machineId))throw new Error('Use letras, números, hífen ou sublinhado no código.');
   if(!id&&state.maquinas.some(m=>m.id===machineId))throw new Error('Este código já está cadastrado.');
   const parametros={},count=Number(v.paramCount||0);
   if(!Number.isInteger(count)||count<0||count>100)throw new Error('Quantidade de parâmetros inválida.');
   for(let i=0;i<count;i++)if(String(v['nome_'+i]||'').trim()){
    const k=v['key_'+i]||'p'+i;
    if(!/^[A-Za-z0-9_-]{1,80}$/.test(k)||Object.hasOwn(parametros,k)||['__proto__','constructor','prototype'].includes(k))throw new Error('Identificador de parâmetro inválido ou repetido.');
    const min=number(v['min_'+i],'limite mínimo',-100000),max=number(v['max_'+i],'limite máximo',-100000);
    if(max<=min)throw new Error('O limite máximo deve ser maior que o mínimo.');
    parametros[k]={nome:required(v['nome_'+i],'nome do parâmetro',80),unidade:required(v['unidade_'+i],'unidade',20),min,max};
   }
   const metaDiaria=integer(v.metaDiaria,'meta diária');
   const patch={id:machineId,nome:required(v.nome,'nome da máquina',120),setorId:v.setorId,processo:required(v.processo,'processo',120),produto:required(v.produto,'produto',120),metaDiaria,hourTarget:metaDiaria/8,parametros,parametrosPersonalizados:true};
   if(existing)Object.assign(existing,patch);else state.maquinas.push(patch);
   delete state.liveParameters?.[machineId];persist();return machineId;
  },
  async setTarget(id,target){const m=item('maquinas',id);requirePermission('metas:gerenciar',m);m.metaDiaria=integer(target,'meta diária');m.hourTarget=m.metaDiaria/8;persist();},
  async workflow(action,values={},id){const result=MSA.workflows.command(state,action,values,id,user);persist();return result;},
  async assignMachine(id,machineId){requirePermission('funcionarios:atribuir');const p=item('perfis',id),m=item('maquinas',machineId);if(p.cargo!=='operador'||(user.cargo!=='chefe'&&p.setorId!==user.setorId)||m.setorId!==p.setorId)throw new Error('Selecione um operador e uma máquina do setor.');p.maquinaId=machineId;persist();},
  async consolidate(v){requirePermission('consolidacoes:registrar');const inicio=date(v.inicio,'início'),fim=date(v.fim,'fim');if(fim<=inicio)throw new Error('O fim deve ser posterior ao início.');const observacao=required(v.observacao,'resumo',2000);state.consolidacoes.push({id:'exemplo-local-'+crypto.randomUUID(),inicio,fim,observacao,setorId:user.setorId,usuarioId:user.id,usuarioRe:user.re,createdAt:now()});persist();},
  async initializeExamples(){persist();},
  reset(){state=JSON.parse(JSON.stringify(baseline));persist();}
 };
 MSA.telemetry.setMode('records');
 MSA.demo.simulation={
 globalClock:true,
 microStop(id,seconds=15,code='travamento-pallet'){if(!user||!MSA.rbac.can('paradas:gerenciar',user,state.maquinas.find(m=>m.id===id)))throw new Error('A demonstração de microparada está disponível à liderança.');const result=MSA.workflows.beginMicro(state,id,seconds,code);persist();return result;},
 get deviationRate(){return state.demoDeviationRate??.05;},
 setDeviationRate(percent){const n=Number(percent);if(!Number.isFinite(n)||n<0||n>100)throw new Error('Escolha uma porcentagem entre 0 e 100.');state.demoDeviationRate=n/100;persist();},
 get rejectRate(){return MSA.scenarioLive.rejectRate(state);},
 setRejectRate(percent){const n=Number(percent);if(!Number.isFinite(n)||n<0||n>100)throw new Error('Escolha uma porcentagem entre 0 e 100.');state.demoRejectRate=n/100;persist();},
 rejectNext(id){MSA.scenarioLive.rejectNext(state,id);persist();},
 simulateDeviation(id){MSA.scenarioParameters.requestDeviation(state,id);MSA.scenarioParameters.advance(state);persist();},
 advance(seconds){
  if(!seconds)return;
  if(!Number.isFinite(seconds)||seconds<=0)return;
  const completed=MSA.workflows?MSA.workflows.advance(state,seconds):MSA.scenarioLive.advance(state,seconds);
  state.lastWorkflowSync||=0;
  if(state.scenarioAt-state.lastWorkflowSync>=5000){MSA.workflows?.sync(state);state.lastWorkflowSync=state.scenarioAt;}
  if(completed)storeSnapshot();emit();
 }};
 // A coleta simulada pertence ao sistema, não à tela do mapa. Sem produção fictícia com a página fechada.
 let lastClock=Date.now();
 if(typeof setInterval==='function')setInterval(()=>{const at=Date.now(),elapsed=(at-lastClock)/1000;lastClock=at;if(user&&!MSA.telemetry.paused&&elapsed>0)MSA.demo.simulation.advance(Math.min(elapsed,60));},1000);
 window.addEventListener('pagehide',storeSnapshot);
 // As conversas de exemplo são locais e têm conteúdo próprio por contexto.
 if(MSA.createDemoChat)MSA.firebaseChat=MSA.createDemoChat(()=>state,()=>MSA.auth.session());
})();
