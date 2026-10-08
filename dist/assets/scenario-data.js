/* Dados exclusivamente fictícios, gerados para sete dias e uma fotografia às 15h. */
window.MSA=window.MSA||{};
MSA.createScenario=function(now=Date.now()){
 const anchor=new Date(now);anchor.setHours(15,0,0,0);
 const state={demo:true,scenarioAt:+anchor,ready:true,connected:true,error:'',setores:MSA.plantLayout.areas.map(a=>({id:a.id,nome:a.name})),maquinas:[],perfis:[],registrosProducao:[],leituras:[],paradas:[],perdas:[],ocorrencias:[],consolidacoes:[]};
 const names=['Ana Lima','Carlos Souza','Marina Alves','João Santos','Beatriz Costa','Rafael Silva','Camila Rocha','Pedro Nunes'];
 MSA.plantLayout.machines.forEach((m,i)=>{
  const hourTarget=m.id==='NHPL'?150:120+(i%4)*20;
  const params={...(MSA.scenarioParameters?.defaults(m)||{pressao:{nome:'Pressão de trabalho',unidade:'bar',min:5,max:7},ciclo:{nome:'Tempo de ciclo',unidade:'s',min:10,max:40}}),...(m.parametros||{})};
  const machine={...m,nome:m.id==='NHPL'?'NHPL · Montagem de abafadores':m.nome,produto:m.id==='NHPL'?'VGARD HP':m.produto,metaDiaria:hourTarget*8,hourTarget,idealCycleSeconds:3600/hourTarget,parametros:params};state.maquinas.push(machine);
  const operator={id:'exemplo-op-'+i,nome:names[i%names.length],re:String(990201+i),cargo:'operador',setorId:m.setorId,maquinaId:m.id,presente:i%11!==0,escala:'1º turno · 07h–15h'};state.perfis.push(operator);
  for(let offset=6;offset>=0;offset--){
   const date=new Date(anchor);date.setDate(date.getDate()-offset);date.setHours(7,0,0,0);const base=+date,tag=date.toISOString().slice(0,10).replaceAll('-','');
   const lote='LT-'+tag+'-'+String(i+1).padStart(2,'0'),ordem='OP-'+(4100+i);
   const rate=m.id==='NHPL'?.76:m.id==='SEL-01'?.58:i%5===0?.87:.98;
   const failureId='exemplo-stop-'+i+'-'+offset;
   state.paradas.push({id:failureId,maquinaId:m.id,setorId:m.setorId,usuarioId:operator.id,usuarioRe:operator.re,inicio:base+2*3600000,fim:base+2*3600000+(m.id==='NHPL'?40:15+i%3*5)*60000,motivo:m.id==='NHPL'?'Falha de alimentação de componentes':'Sensor de presença desalinhado',causa:'Ajuste e liberação pela manutenção',kind:'parada',failure:true,verificado:offset>0,createdAt:base,updatedAt:base});
   if(offset===0&&['SEL-01','INJ-05','ABF-04','ABF-02','INJ-02'].includes(m.id))state.paradas.push({id:'exemplo-open-'+i,maquinaId:m.id,setorId:m.setorId,usuarioId:operator.id,usuarioRe:operator.re,inicio:base+7.5*3600000,fim:0,motivo:m.id==='INJ-02'?'Troca de molde':m.id==='ABF-02'?'Manutenção do atuador':'Falta de componente no alimentador',kind:m.id==='INJ-02'?'setup':m.id==='ABF-02'?'manutencao':'parada',failure:m.id!=='INJ-02',verificado:false,createdAt:base,updatedAt:base});
   for(let h=0;h<8;h++){
    const start=base+h*3600000,end=start+3600000;
    const open=offset===0&&h===7&&['SEL-01','INJ-05','ABF-04','ABF-02','INJ-02'].includes(m.id);
    const rejected=1+(i+h+offset)%3,quantity=Math.round(hourTarget*(h===2?rate*.52:open?rate*.45:rate)*(1+Math.sin(h+i+offset)*.015))-rejected;
    const common={maquinaId:m.id,setorId:m.setorId,usuarioId:operator.id,usuarioRe:operator.re,lote,ordem,produto:machine.produto,verificado:offset>0||h<5,verificadoPor:'exemplo-sup-'+m.setorId,createdAt:end,updatedAt:end,observacao:'Exemplo fictício para apresentação'};
    state.registrosProducao.push({...common,id:'exemplo-prod-'+i+'-'+offset+'-'+h,inicio:start,fim:end,quantidade:quantity,turno:'1'});
    state.perdas.push({...common,id:'exemplo-ref-'+i+'-'+offset+'-'+h,data:end-60000,tipo:'refugo',unidade:'pecas',quantidade:rejected,motivo:m.id==='NHPL'?'Falha de encaixe':h%2?'Falha de acabamento':'Rebarba'});
   }
   const vals=Object.fromEntries(Object.entries(params).map(([k,p])=>[k,(p.min+p.max)/2+(offset===0&&m.id==='INJ-01'&&k==='temperatura'?(p.max-p.min)*.7:0)]));
   state.leituras.push({id:'exemplo-read-'+i+'-'+offset,maquinaId:m.id,setorId:m.setorId,usuarioId:operator.id,usuarioRe:operator.re,data:base+7.8*3600000,lote,valores:vals,verificado:offset>0,createdAt:base,updatedAt:base});
   state.perdas.push({id:'exemplo-loss-'+i+'-'+offset,maquinaId:m.id,setorId:m.setorId,usuarioId:operator.id,usuarioRe:operator.re,data:base+7.8*3600000,lote,produto:machine.produto,tipo:i%3===0?'suspeito':'perda',unidade:i%3===0?'pecas':'kg',quantidade:i%3===0?12+i:Math.round((.8+i%4*.3)*100)/100,motivo:i%3===0?'Lote aguardando inspeção':'Material de ajuste',verificado:offset>0,createdAt:base,updatedAt:base});
  }
 });
 state.setores.forEach((sec,i)=>{state.perfis.push({id:'exemplo-sup-'+sec.id,nome:['Fernanda Ribeiro','Lucas Martins','Renata Gomes','Paulo Oliveira'][i%4],re:String(990101+i),cargo:'supervisor',setorId:sec.id,maquinaId:'',presente:true,escala:'1º turno · 07h–15h'});const start=new Date(anchor);start.setDate(start.getDate()-1);start.setHours(7,0,0,0);state.consolidacoes.push({id:'exemplo-report-'+sec.id,setorId:sec.id,usuarioId:'exemplo-sup-'+sec.id,usuarioRe:String(990101+i),inicio:+start,fim:+start+8*3600000,createdAt:+anchor,observacao:sec.id==='montagem'?'NHPL abaixo da meta por falha de alimentação. Manutenção ajustou o alimentador; verificar reincidência no próximo turno.':'Produção conferida. Ajuste de sensor registrado; acompanhar refugos e abastecimento no próximo turno.'});});
 ['NHPL','SEL-01','INJ-01','ABF-02'].forEach((id,i)=>{const m=state.maquinas.find(m=>m.id===id);state.ocorrencias.push({id:'exemplo-occ-'+i,maquinaId:id,setorId:m.setorId,usuarioId:'exemplo-sup-'+m.setorId,usuarioRe:'990103',data:+anchor-(i+1)*3600000,descricao:['NHPL: queda de produtividade após falha de alimentação.','Parada por falta de componentes; apoio do abastecimento acionado.','Temperatura acima da faixa ilustrativa; ajustar processo.','Manutenção do atuador de montagem.'][i],prioridade:i===0?'alta':'normal',status:i===2?'resolvida':'aberta',resolucao:i===2?'Ajuste solicitado; validar nova leitura.':'',verificado:false,createdAt:+anchor,updatedAt:+anchor});});
 state.consolidacoes.push(...state.consolidacoes.map(r=>({...r,id:r.id+'-hoje',inicio:r.inicio+86400000,fim:r.fim+86400000,createdAt:+anchor})));
 // O cenário atual permanece às 15h; segundo e terceiro turnos são dias concluídos.
 const isoDay=at=>{const d=new Date(at);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
 const today=isoDay(+anchor);
 for(const key of ['registrosProducao','leituras','paradas','perdas','ocorrencias']){
  const originals=[...state[key]];
  for(const r of originals){r.turno='1';r.diaProducao=isoDay(r.inicio||r.data);}
  for(const turno of ['2','3'])for(const r of originals){
   if(r.diaProducao===today||key==='ocorrencias')continue;
   const shift=Number(turno)-1,delta=shift*8*3600000,copy={...r,id:r.id+'-turno-'+turno,turno};
   for(const field of ['inicio','fim','data','createdAt','updatedAt'])if(copy[field])copy[field]+=delta;
   if(copy.lote)copy.lote+='-T'+turno;
   if(key==='registrosProducao')copy.quantidade=Math.round(r.quantidade*(turno==='2'?.93:.89));
   if(key==='leituras')copy.valores={...r.valores};
   state[key].push(copy);
  }
 }
 return state;
};
