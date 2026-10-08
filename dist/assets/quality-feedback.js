/* Aviso discreto junto à máquina. Só anuncia uma vez cada evento novo. */
window.MSA=window.MSA||{};
MSA.qualityFeedback={update(host,event){
  if(!host)return;
  let notice=host.querySelector(':scope > .quality-cycle-notice');
  if(!notice){notice=document.createElement('div');notice.className='quality-cycle-notice';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');notice.setAttribute('aria-atomic','true');notice.hidden=true;host.prepend(notice);}
  notice.hidden=!event;if(!event)return;
  if(notice.dataset.event===event.id)return;
  notice.dataset.event=event.id;notice.classList.toggle('is-parameter',event.kind==='parameter');notice.classList.toggle('is-recovered',event.type==='normalizado');
  notice.replaceChildren();
  const icon=document.createElement('span');icon.className='quality-cycle-symbol';icon.textContent='!';icon.setAttribute('aria-hidden','true');
  const message=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('span');
  title.textContent=event.kind==='parameter'?event.name+(event.type==='normalizado'?' normalizado':' acima do limite')+' · '+event.machineId:'Refugo identificado · '+event.machineId;
  detail.textContent=event.kind==='parameter'?event.value.toLocaleString('pt-BR')+' '+event.unit+' · limites '+event.min+' a '+event.max+' '+event.unit+' · simulação':'+'+event.quantity+' refugo · '+event.reason+' · simulação';message.append(title,detail);
  const link=document.createElement('a');link.className='ops-link';link.href=(event.kind==='parameter'?'#producao/':'#qualidade/')+encodeURIComponent(event.machineId);link.textContent=event.kind==='parameter'?'Ver leituras':'Ver qualidade';
  notice.append(icon,message,link);
}};

MSA.qualityFeedback.event=sample=>[sample?.recentReject,sample?.recentParameterEvent?{...sample.recentParameterEvent,kind:'parameter'}:null].filter(Boolean).sort((a,b)=>b.at-a.at)[0]||null;
