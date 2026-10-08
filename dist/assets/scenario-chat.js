/* Conversas fictícias por setor e funcionário; nunca envia mensagens ao Firebase. */
window.MSA=window.MSA||{};
MSA.createDemoChat=function(getState,getUser){
 'use strict';
 const conversations=new Map(),threads=new Map(),sent=new Map(),updates=new Map();let sequence=Date.now();
 const contact=p=>({id:p.id,name:p.nome,re:p.re});
 const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
 const topics={
  recebimento:{note:'Recebimento e abastecimento',description:'Materiais recebidos, estoque e reposição das linhas.',lines:[
   'A conferência dos componentes do recebimento está pronta. Podemos separar o abastecimento de {machine}?',
   'Separem primeiro o material da montagem de fones. Identifiquem lote e ordem em cada carrinho.',
   'O carrinho de componentes está identificado. Vou conferir a quantidade antes de entregar na linha.',
   'Combinado. Registrem a entrega para o próximo turno conseguir localizar o material.'
  ],updates:['A separação de {machine} foi conferida; o carrinho está disponível para retirada.','O recebimento terminou a identificação dos volumes. Falta confirmar a entrega na linha.']},
  injecao:{note:'Processo e troca de molde',description:'Temperatura, pressão, molde e abastecimento das injetoras.',lines:[
   'Estou conferindo temperatura e pressão de {machine}. Vou comparar as leituras com os limites cadastrados.',
   'Na Injetora 02 temos troca de molde. Depois do setup, a primeira peça precisa passar pela inspeção.',
   'O abastecimento de resina foi revisado. A identificação da ordem está junto à máquina.',
   'Mantenham o lote de teste separado e registrem a liberação da primeira peça antes de seguir.'
  ],updates:['A folha de setup de {machine} está disponível para conferência da liderança.','A amostra da troca de molde foi encaminhada para avaliação; aguardo a decisão da Qualidade.']},
  selagem:{note:'Acabamento e selagem',description:'Acabamento, inspeção visual e apoio às máquinas de selagem.',lines:[
   'Encontrei uma peça com falha de acabamento em {machine}. Já separei a amostra para avaliação.',
   'Confiram o lote de origem e sinalizem as peças suspeitas. A liberação deve ser feita pela Qualidade.',
   'A amostra está identificada. Também estou revisando a condição da selagem antes de retomar.',
   'Incluam o motivo no registro e deixem a orientação para a próxima equipe.'
  ],updates:['A amostra de {machine} está pronta para a conferência da Qualidade.','A lista de defeitos do acabamento foi revisada para alinhar a inspeção do próximo turno.']},
  qualidade:{note:'Inspeção e destino dos lotes',description:'Segregação, reinspeção e decisões exclusivas da Qualidade.',lines:[
   'Recebi a solicitação de inspeção de {machine}. Vou conferir a identificação do lote e das peças segregadas.',
   'Mantenham as peças suspeitas identificadas na área de segregação. O lote inteiro deve ser avaliado.',
   'A quantidade e o motivo foram conferidos. Vou registrar os resultados da reinspeção por lote.',
   'Informem a produção somente depois de registrar o destino: conformes liberadas e rejeitadas descartadas.'
  ],updates:['A ficha de reinspeção de {machine} está pronta para registro da avaliação.','Os lotes pendentes foram organizados por ordem de prioridade para a próxima conferência.']},
  capacetes:{note:'Montagem de capacetes',description:'Componentes, montagem e rastreabilidade dos capacetes.',lines:[
   'Estou conferindo os componentes de {machine}. A identificação da ordem está disponível no posto.',
   'Confiram a montagem da suspensão e mantenham os componentes identificados por lote.',
   'A amostra foi separada para inspeção. Vou registrar qualquer peça fora do padrão em Qualidade.',
   'Alinhem com Embalagem a sequência das ordens para evitar mistura de modelos.'
  ],updates:['A sequência de ordens de {machine} foi alinhada com Embalagem.','Os componentes para a próxima ordem de capacetes estão identificados no posto.']},
  montagem:{note:'NHPL e montagem de fones',description:'Alimentadores, montagem de abafadores e apoio à NHPL.',lines:[
   'Na NHPL tivemos dificuldade de alimentação de componentes. Separei os pontos para a liderança conferir.',
   'Priorizem a NHPL e selecionem o motivo das microparadas no painel. Vamos acompanhar a reincidência.',
   'A identificação dos componentes de {machine} está conferida. Vou verificar se há peças suspeitas.',
   'Deixem o alimentador e as pendências da NHPL descritos na passagem de turno para a próxima equipe.'
  ],updates:['A lista de verificação do alimentador da NHPL está pronta para a liderança.','O abastecimento da montagem de fones foi alinhado para a próxima ordem de {machine}.']},
  embalagem:{note:'Etiquetas e identificação',description:'Embalagem, quantidade por caixa e identificação dos produtos.',lines:[
   'Estou conferindo a etiqueta e o modelo em {machine}. Precisamos manter o lote visível nas caixas.',
   'Antes de fechar, confiram produto, quantidade por caixa e ordem de produção.',
   'Separei uma etiqueta para comparação com a ordem. Vou pedir conferência antes do fechamento.',
   'Depois da conferência, alinhem os volumes com Expedição e mantenham a identificação no pallet.'
  ],updates:['A amostra de etiqueta de {machine} está disponível para conferência.','O próximo pallet está identificado; falta conferir o total de caixas antes da movimentação.']},
  expedicao:{note:'Pallets e carregamento',description:'Separação, conferência e preparação de volumes para expedição.',lines:[
   'Os volumes de {machine} estão separados para conferência. Vou comparar as caixas com a ordem.',
   'Confiram identificação dos pallets e quantidade antes de encaminhar para carregamento.',
   'O pallet foi posicionado na área de saída. Aguardo a conferência para seguir com a movimentação.',
   'Avisem Embalagem sobre qualquer diferença e registrem a pendência para o próximo turno.'
  ],updates:['A lista de volumes de {machine} foi atualizada para a conferência de saída.','O próximo carregamento está organizado por ordem; falta confirmar a quantidade dos pallets.']}
 };
 function context(sectorId){const s=getState(),machines=s.maquinas.filter(m=>m.setorId===sectorId),team=s.perfis.filter(p=>p.setorId===sectorId);return {sector:s.setores.find(x=>x.id===sectorId),machine:machines[0],supervisor:team.find(p=>p.cargo==='supervisor'),operators:team.filter(p=>p.cargo==='operador'),topic:topics[sectorId]};}
 const format=(text,m)=>text.replaceAll('{machine}',m?.nome||'o equipamento do setor');
 function message(id,p,body,at,extra={}){return {id:++sequence,conversation:id,sender_id:p.id,sender_name:p.nome,sender_re:p.re||'',body,created_at:at,...extra};}
 function privateLines(p,u){const s=getState(),m=s.maquinas.find(m=>m.id===p.maquinaId)||s.maquinas.find(m=>m.setorId===p.setorId),sec=s.setores.find(x=>x.id===p.setorId)?.nome||'produção',tag=m?.id||sec;
  if(p.cargo==='supervisor')return [
   [p,`Separei os pontos de ${sec} para a reunião. Precisamos alinhar as prioridades antes da troca de turno.`],
   [u,`${p.nome.split(' ')[0]}, confira a equipe disponível e as máquinas que precisam de apoio em ${sec}.`],
   [p,`Vou revisar o painel de ${m?.nome||sec} e registrar as pendências que a próxima liderança precisa acompanhar.`],
   [u,'Pode deixar as ações e os responsáveis registrados na passagem de turno.']
  ];
  if(p.cargo==='qualidade')return [[p,`Estou preparando a avaliação dos lotes de ${sec}.`],[u,'Confirme a identificação das peças segregadas antes da reinspeção.'],[p,'Vou registrar quantidade inspecionada, peças conformes e destino das rejeitadas.']];
  if(p.cargo==='chefe')return [[p,'Quero revisar as prioridades da produção antes da reunião.'],[u,`Estou reunindo os apontamentos de ${sec} e as pendências de ${tag}.`],[p,'Inclua equipe disponível, paradas abertas e lotes em avaliação no alinhamento.']];
  const variants=[
   [`Tenho uma dúvida sobre a identificação do lote em ${tag}. Podemos conferir antes de seguir?`,`${p.nome.split(' ')[0]}, compare produto e ordem com a identificação do posto.`, `Separei a identificação de ${m?.nome||sec} para conferência. Vou aguardar a orientação da liderança.`],
   [`O abastecimento de ${tag} precisa ser revisado para a próxima ordem.`, `Confira a lista de componentes de ${m?.nome||sec} e sinalize o que falta.`, `A lista foi separada. Vou alinhar a reposição com o responsável por ${sec}.`],
   [`Tivemos uma interrupção curta em ${tag}. Já deixei o horário para conferência.`, `Vamos comparar com o registro automático de ${m?.nome||sec} e selecionar o motivo da microparada.`, `Deixei a referência do posto ${tag} para a liderança verificar a ocorrência.`],
   [`Separei uma amostra de ${tag} que precisa de avaliação.`, `Identifique o lote e mantenha a amostra separada para a Qualidade.`, `A amostra de ${m?.nome||sec} está identificada. Aguardo a avaliação antes de misturar com as demais peças.`]
  ];
  const n=s.perfis.filter(x=>x.cargo==='operador').findIndex(x=>x.id===p.id),v=variants[Math.max(0,n)%variants.length];
  return [[p,v[0]],[u,v[1]],[p,v[2]],[u,`Deixe essa pendência de ${tag} registrada para a próxima equipe de ${sec}.`]];
 }
 function seed(id,u){const s=getState(),base=s.scenarioAt;let entries;
  if(threads.has(id)){const p=s.perfis.find(p=>p.id===threads.get(id).personId);entries=privateLines(p,u);}
  else if(id==='geral'){const lead=s.perfis.find(p=>p.cargo==='supervisor'&&p.setorId==='montagem')||u,stock=s.perfis.find(p=>p.cargo==='supervisor'&&p.setorId==='recebimento')||lead,qa=s.perfis.find(p=>p.cargo==='supervisor'&&p.setorId==='qualidade')||lead;entries=[[lead,'Para o alinhamento da produção, vamos revisar paradas abertas, abastecimento e lotes em avaliação.'],[stock,'Vou conferir a reposição dos componentes para as linhas de capacetes e fones.'],[qa,'Os lotes suspeitos precisam ficar identificados até a decisão da Qualidade.'],[u,'Priorizem as pendências da NHPL e registrem as ações para a próxima liderança.']];}
  else if(id==='passagem'){const lead=s.perfis.find(p=>p.cargo==='supervisor'&&p.setorId==='montagem')||u,other=s.perfis.find(p=>p.cargo==='supervisor'&&p.setorId==='embalagem')||lead;entries=[[lead,'Estou preparando a entrega do 1º turno. Incluirei as paradas e o acompanhamento do alimentador da NHPL.'],[other,'Em Embalagem, deixarei a conferência das etiquetas e a sequência das ordens para a próxima equipe.'],[u,'Registrem as pendências no painel Passagem de turno, com entrega e confirmação de recebimento.'],[lead,'Combinado. O próximo responsável terá o resumo do turno e as ações pendentes por máquina.']];}
  else {const c=context(id.slice(6));entries=c.topic.lines.map((line,i)=>[i%2?c.supervisor||u:c.operators[i%Math.max(1,c.operators.length)]||c.supervisor||u,format(line,c.machine)]);}
  return entries.map(([p,text],i)=>message(id,p,text,base-(entries.length-i)*35*60000));
 }
 function authorize(id,u){const s=getState();if(id==='geral'||id==='passagem')return;
  if(id.startsWith('setor-')&&s.setores.some(sec=>id==='setor-'+sec.id)&&(u.cargo==='chefe'||id==='setor-'+u.setorId))return;
  if(threads.get(id)?.participants.includes(u.id))return;
  fail(403,'Conversa não disponível para seu acesso.');
 }
 function ensure(id,u){authorize(id,u);if(!conversations.has(id))conversations.set(id,seed(id,u));return conversations.get(id);}
 function timestamp(){return Math.max(Date.now(),getState().scenarioAt);}
 return {
  demo:true,
  async request(path,options={}){
   if(options.signal?.aborted)throw new DOMException('Conversa alterada.','AbortError');
   const u=getUser();if(!u)fail(401,'Entre para acessar as conversas.');MSA.rbac.require('chat:usar',u);
   const s=getState(),url=new URL(path.startsWith('/')?path:'/'+path,'https://msa.invalid/'),body=options.body?JSON.parse(options.body):{},method=options.method||'GET';
   if(url.pathname==='/bootstrap')return {me:contact(u),people:s.perfis.filter(p=>p.id!==u.id).map(p=>({...contact(p),note:(MSA.config.roles.find(r=>r.id===p.cargo)?.label||p.cargo)+' · '+(s.maquinas.find(m=>m.id===p.maquinaId)?.id||s.setores.find(sec=>sec.id===p.setorId)?.nome||'Produção')})),rooms:[{id:'geral',sector:'todos',name:'Produção',note:'Prioridades da fábrica',description:'Alinhamento entre liderança, setores e áreas de suporte.'},{id:'passagem',sector:null,name:'Passagem de turno',note:'Entrega e pendências',description:'Alinhamentos da troca de turno entre as equipes.'},...s.setores.filter(sec=>u.cargo==='chefe'||sec.id===u.setorId).map(sec=>({id:'setor-'+sec.id,sector:sec.id,name:sec.nome,note:topics[sec.id]?.note||'Conversa do setor',description:topics[sec.id]?.description||'Alinhamentos do setor.'}))]};
   if(url.pathname==='/threads'&&method==='POST'){const p=s.perfis.find(p=>p.id===body.person_id);if(!p||p.id===u.id)fail(400,'Selecione outro funcionário.');const participants=[u.id,p.id].sort(),id='privada-'+participants.join('_');threads.set(id,{participants,personId:p.id});return {id};}
   if(url.pathname!=='/messages')fail(404,'Ação não encontrada.');
   const id=body.conversation||url.searchParams.get('conversation');if(typeof id!=='string')fail(400,'Selecione uma conversa.');const rows=ensure(id,u);
   if(method==='POST'){const text=String(body.body||'').trim();if(!text||text.length>2000)fail(400,'Escreva uma mensagem de até 2.000 caracteres.');const key=u.id+'|'+id+'|'+body.client_key;
    if(body.client_key&&sent.has(key)){const previous=sent.get(key);if(previous.body!==text)fail(409,'Este envio já foi utilizado.');return {message:previous};}
    const msg=message(id,u,text,timestamp());rows.push(msg);if(body.client_key)sent.set(key,msg);return {message:msg};
   }
   const after=url.searchParams.get('after'),before=url.searchParams.get('before');let list=rows.filter(m=>(after===null||m.id>Number(after))&&(before===null||m.id<Number(before)));const has_more=list.length>50;list=after===null?list.slice(-50):list.slice(0,50);return {messages:list,has_more};
  },
  async simulateIncoming(id){const u=getUser();if(!u)fail(401,'Entre para acessar as conversas.');MSA.rbac.require('chat:usar',u);const rows=ensure(id,u),s=getState(),index=updates.get(id)||0;let p,text;
   if(threads.has(id)){p=s.perfis.find(p=>p.id===threads.get(id).personId);const c=context(p.setorId),m=s.maquinas.find(m=>m.id===p.maquinaId)||c.machine;const options=p.cargo==='supervisor'?[`Atualizei as pendências de ${c.sector?.nome||'produção'} para a próxima liderança.`,`A prioridade de ${m?.nome||'produção'} está incluída no resumo para a reunião.`]:[`Separei a referência de ${m?.id||c.sector?.nome||'produção'} para a conferência que combinamos.`,`A identificação de ${m?.nome||'meu posto'} foi revisada. Deixei o ponto para a próxima equipe.`];text=options[index%options.length];}
   else if(id.startsWith('setor-')){const c=context(id.slice(6));p=c.supervisor||c.operators[0]||u;text=format(c.topic.updates[index%c.topic.updates.length],c.machine);}
   else {p=s.perfis.find(p=>p.cargo==='supervisor'&&p.setorId===(index%2?'recebimento':'montagem'))||u;text=id==='passagem'?['A lista de pendências da NHPL está pronta para o recebimento do próximo turno.','A conferência do material do próximo turno foi incluída na entrega da liderança.'][index%2]:['O resumo para a reunião já reúne as prioridades de montagem e abastecimento.','O alinhamento dos setores foi atualizado com as pendências de materiais e inspeção.'][index%2];}
   updates.set(id,index+1);const msg=message(id,p,text,timestamp(),{simulated:true});rows.push(msg);return {message:msg};
  }
 };
};
