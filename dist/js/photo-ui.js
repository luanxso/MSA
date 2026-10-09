/* Tela secundária do operador, com envio direto à fonte comum de registros. */
(() => {
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const num=v=>v.toLocaleString('pt-BR',{maximumFractionDigits:2});
 const time=v=>new Date(v).toLocaleString('pt-BR');
 let root=null,photos=new Map(),captures=new Map(),generation=0,busy=false;
 const exampleSteps=new WeakMap(),exampleLocks=new WeakSet();
 const getMachine=()=>MSA.data.state.maquinas.find(m=>m.id===root?.querySelector('#photo-machine')?.value);
 const fields=machine=>Object.entries(machine?.parametros||{}).filter(([,p])=>/press|vácuo|vacuo|temperatura/i.test(p.nome));
 function message(text,error=false){const node=root?.querySelector('#photo-message');if(node){node.textContent=text;node.classList.toggle('is-error',error);}}
 const units=['bar','kgf/cm²','psi','kPa','MPa','mmHg','inHg','°C','°F'];
 const storageKey=key=>'msa-photo-instrument-v2:'+getMachine()?.id+':'+key;
 function settings(key,p){
  const vacuum=/vácuo|vacuo/i.test(p.nome),digital=/temperatura/i.test(p.nome);
  const defaults={mode:digital?'digital':'analog',start:0,end:vacuum?-760:14,startAngle:vacuum?45:135,sweep:vacuum?-270:270,unit:vacuum?'mmHg':'kgf/cm²',digitalUnit:p.unidade,confirmed:false};
  try{const saved=JSON.parse(localStorage.getItem(storageKey(key)));if(saved&&['digital','analog'].includes(saved.mode)&&[saved.start,saved.end,saved.startAngle,saved.sweep].every(Number.isFinite)&&units.includes(saved.unit)&&units.includes(saved.digitalUnit))return {...defaults,...saved};}catch{}
  return defaults;
 }
 function remember(key){
  const c=card(key),get=k=>c.querySelector(`[data-scale="${k}"]`).value;
  const config={mode:c.querySelector('[data-reader-mode]').value,start:Number(get('start')),end:Number(get('end')),startAngle:Number(get('startAngle')),sweep:Number(get('sweep')),unit:get('unit'),digitalUnit:c.querySelector('[data-digital-unit]').value,confirmed:c.querySelector('[data-scale-confirm]').checked};
  try{localStorage.setItem(storageKey(key),JSON.stringify(config));}catch{}
 }
 function profileHTML(key,p){
  const cfg=settings(key,p),digital=cfg.mode==='digital';
  const options=selected=>[...new Set([selected,...units])].map(u=>`<option ${u===selected?'selected':''}>${esc(u)}</option>`).join('');
  return `<article class="photo-instrument" data-photo-key="${esc(key)}"><header><div><span class="photo-eyebrow">LEITURA LOCAL POR FOTO</span><h3>${esc(p.nome)}</h3></div><span>${esc(p.unidade)}</span></header>
   <label class="photo-value">Tipo do instrumento<select data-reader-mode><option value="analog" ${!digital?'selected':''}>Ponteiro analógico</option><option value="digital" ${digital?'selected':''}>Visor com números (OCR)</option></select></label>
   <canvas width="320" height="320" aria-label="Foto de ${esc(p.nome)}"></canvas><p class="photo-card-status" role="status">Nenhuma foto capturada.</p>
   <div class="photo-capture"><button type="button" class="secondary-button" data-photo-camera="${esc(key)}">Tirar foto</button><label class="text-button">Escolher arquivo<input type="file" accept="image/*" data-photo-file="${esc(key)}"></label></div>
   ${MSA.demo?.active?`<button type="button" class="text-button photo-example" data-photo-example="${esc(key)}">Testar com imagem de exemplo</button><p data-photo-example-status class="ops-note" role="status" hidden></p>`:''}
   <details class="photo-config"><summary>Escala e enquadramento</summary>
    <div data-analog-config ${digital?'hidden':''}><p>Configure uma vez a escala impressa neste instrumento. A configuração fica guardada neste navegador, por máquina e parâmetro.</p>
     <div class="photo-fields"><label>Valor inicial<input data-scale="start" type="number" step="any" value="${cfg.start}"></label><label>Valor final<input data-scale="end" type="number" step="any" value="${cfg.end}"></label><label>Unidade impressa<select data-scale="unit">${options(cfg.unit)}</select></label><label>Ângulo inicial (°)<input data-scale="startAngle" type="number" value="${cfg.startAngle}"></label><label>Arco (°)<input data-scale="sweep" type="number" value="${cfg.sweep}"></label></div>
     <p>Direita 0°, baixo 90°, esquerda 180°, cima 270°. Arco positivo = horário. Limites de processo não são a escala do instrumento.</p><label class="photo-check"><input type="checkbox" data-scale-confirm ${cfg.confirmed?'checked':''}>Conferi a escala deste instrumento</label>
    </div>
    <div data-digital-config ${!digital?'hidden':''}><label class="photo-value">Unidade do visor<select data-digital-unit>${options(cfg.digitalUnit)}</select></label><p>Fotografe apenas o valor da zona ou parâmetro escolhido. O OCR compara duas leituras; vários números ou baixa confiança deixam a foto pendente.</p></div>
    <div class="photo-crop"><label>Posição horizontal<input type="range" data-crop="x" min="0" max="100" value="50"></label><label>Posição vertical<input type="range" data-crop="y" min="0" max="100" value="50"></label><label>Zoom do mostrador<input type="range" data-crop="zoom" min="1" max="8" step=".05" value="1"></label></div><button type="button" class="secondary-button" data-read="${esc(key)}">Analisar enquadramento</button>
   </details>
   <label class="photo-value">Leitura em ${esc(p.unidade)}<input type="text" inputmode="decimal" data-photo-value="${esc(key)}" placeholder="Preenchida automaticamente pela foto" autocomplete="off"></label><button type="button" class="secondary-button" data-photo-send="${esc(key)}" disabled>Confirmar e enviar</button>
   <p class="photo-hint">A foto é lida no navegador, sem API. Confira a estimativa; se necessário, reenquadre ou use a correção manual. Cada foto registra um instante da produção.</p></article>`;
 }
 function cards(){photos.clear();generation++;const m=getMachine();root.querySelector('#photo-instruments').innerHTML=fields(m).map(([k,p])=>profileHTML(k,p)).join('')||'<p class="ops-empty">Esta máquina não possui pressão, vácuo ou temperatura cadastrados.</p>';root.querySelector('#photo-product').textContent=m?.produto||'';}
 function machines(){const sector=root.querySelector('#photo-sector').value;const list=MSA.data.state.maquinas.filter(m=>m.setorId===sector),current=MSA.auth.session().maquinaId;root.querySelector('#photo-machine').innerHTML='<option value="">Selecione a máquina</option>'+list.map(m=>`<option value="${esc(m.id)}" ${m.id===current?'selected':''}>${esc(m.id)} · ${esc(m.nome)}</option>`).join('');cards();}
 function history(){
  if(!root?.isConnected)return;
  const rows=MSA.data.state.leituras.filter(r=>r.origem==='foto'&&MSA.rbac.inScope(MSA.auth.session(),r)).sort((a,b)=>(b.fotoProcesso?.capturadaEm||b.data)-(a.fotoProcesso?.capturadaEm||a.data)).slice(0,12);
  root.querySelector('#photo-history').innerHTML=rows.length?rows.map(r=>`<article class="photo-history-row"><div><strong>${esc(r.maquinaId)} · ${esc(r.lote)}${r.fotoProcesso.exemplo?' · EXEMPLO':''}</strong><span>${time(r.fotoProcesso.capturadaEm)} · ${esc(MSA.data.state.maquinas.find(m=>m.id===r.maquinaId)?.parametros?.[r.fotoProcesso.parametro]?.nome||r.fotoProcesso.parametro)}</span></div><strong>${Object.values(r.valores).map(num).join(' / ')} ${esc(r.fotoProcesso.unidade)}</strong><div class="photo-history-actions"><button class="text-button" type="button" data-photo-detail="${esc(r.id)}">Ver foto</button><button class="text-button" type="button" data-photo-correct="${esc(r.id)}">Corrigir</button></div></article>`).join(''):'<p class="ops-note">As fotos enviadas aparecerão aqui e em Produção → Parâmetros.</p>';
 }
 const card=key=>root.querySelector(`[data-photo-key="${CSS.escape(key)}"]`);
 function crop(key){
  const photo=photos.get(key),c=card(key);if(!photo||!c)return;
  const image=photo.image,canvas=c.querySelector('canvas');canvas.classList.add('has-image');
  const ctx=canvas.getContext('2d',{willReadFrequently:true}),val=k=>Number(c.querySelector(`[data-crop="${k}"]`).value);
  const side=Math.min(image.naturalWidth,image.naturalHeight)/val('zoom'),x=(image.naturalWidth-side)*val('x')/100,y=(image.naturalHeight-side)*val('y')/100;
  ctx.drawImage(image,x,y,side,side,0,0,320,320);photo.crop=canvas.toDataURL('image/jpeg',.72);photo.ocrCanvas=document.createElement('canvas');photo.ocrCanvas.width=photo.ocrCanvas.height=640;photo.ocrCanvas.getContext('2d').drawImage(image,x,y,side,side,0,0,640,640);photo.result=null;photo.revision=(photo.revision||0)+1;
  photo.extracted=null;photo.confidence=null;photo.method=null;
  c.querySelector('[data-photo-value]').value='';c.querySelector('[data-photo-send]').disabled=true;
 }
 function camera(key){
  if(busy)return;const m=getMachine(),lot=root.querySelector('#photo-lot').value.trim(),rev=generation;
  if(!m||!lot){message('Selecione setor, máquina e lote antes de tirar a foto.',true);return;}
  MSA.photoCamera.open({title:m.parametros[key].nome,onCapture:file=>{if(rev!==generation||!root?.isConnected||getMachine()?.id!==m.id||root.querySelector('#photo-lot').value.trim()!==lot){message('O posto ou lote mudou. Tire outra foto no contexto atual.',true);return;}return capture(key,file);},onError:error=>message(error.message,true)});
 }
 async function capture(key,file,example=false,demoProfile=null){
  const rev=generation,machineId=getMachine()?.id,lot=root.querySelector('#photo-lot').value.trim();
  if(!machineId||!lot){message('Selecione setor, máquina e lote antes de tirar a foto.',true);return;}
  if(busy)return;
  if(!file||!file.type.startsWith('image/')||file.size>15000000){message('Selecione uma imagem de até 15 MB.',true);return;}
  const token=(captures.get(key)||0)+1;captures.set(key,token);
  try{const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Não foi possível ler a foto.'));reader.readAsDataURL(file);}),image=new Image();
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Imagem não suportada. Use JPEG ou PNG.'));image.src=url;});if(rev!==generation||captures.get(key)!==token||!root?.isConnected)return;
   if(lot!==root.querySelector('#photo-lot').value.trim()){message('O lote mudou durante a captura. Tire outra foto para o lote atual.',true);return;}
   card(key).querySelector('[data-photo-value]').value='';card(key).querySelector('[data-photo-value]').disabled=false;
   photos.set(key,{image,capturedAt:Date.now(),machineId,lot,extracted:null,id:null,example,demoProfile});if(!example){const note=card(key).querySelector("[data-photo-example-status]");if(note)note.hidden=true;}crop(key);await analyze(key);
  }catch(e){message(e.message,true);}
 }
 async function analyze(key){
  const c=card(key),photo=photos.get(key),rev=generation;if(!photo||busy)return;
  const p=getMachine().parametros[key],status=c.querySelector('.photo-card-status');status.classList.remove('is-pending');
  crop(key);const revision=photo.revision,mode=c.querySelector('[data-reader-mode]').value;
  const current=()=>rev===generation&&photos.get(key)===photo&&revision===photo.revision&&root?.isConnected;
  status.textContent='Analisando foto…';
  try{
   let result;
   if(MSA.gaugeReader.adapter){result=await MSA.gaugeReader.adapter.read({image:photo.crop,parameter:{key,...p},machineId:photo.machineId});result={...result,method:'adaptador'};}
   else if(mode==='digital'){
    photo.profile={mode:'digital',unit:c.querySelector('[data-digital-unit]').value,targetUnit:p.unidade};
    result=await MSA.digitalReader.read({canvas:photo.ocrCanvas,...photo.profile,onProgress:text=>{if(current())status.textContent=text;}});
   }else{
    if(!photo.example||!photo.demoProfile){
     if(!c.querySelector('[data-scale-confirm]').checked)throw new Error('Abra “Escala e enquadramento” e confirme a escala antes da leitura automática.');
     const get=k=>c.querySelector(`[data-scale="${k}"]`).value;
     photo.profile={start:Number(get('start')),end:Number(get('end')),startAngle:Number(get('startAngle')),sweep:Number(get('sweep')),unit:get('unit'),targetUnit:p.unidade};
    }else photo.profile={...photo.demoProfile,targetUnit:p.unidade};
    result=MSA.gaugeReader.readPixels(c.querySelector('canvas').getContext('2d').getImageData(0,0,320,320),photo.profile);
   }
   if(!current())return;
   if(!Number.isFinite(result?.value))throw new Error('Não foi possível extrair uma leitura. Reenquadre a foto ou use a correção manual.');
   photo.extracted=result.value;photo.result=result;photo.method=result.method;photo.confidence=result.confidence??null;
   c.querySelector('[data-photo-value]').value=String(result.value).replace('.',',');c.querySelector('[data-photo-send]').disabled=false;
   if(result.angle!=null){const ctx=c.querySelector('canvas').getContext('2d');ctx.strokeStyle='#e03636';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(result.cx,result.cy);ctx.lineTo(result.cx+Math.cos(result.angle*Math.PI/180)*result.radius*.85,result.cy+Math.sin(result.angle*Math.PI/180)*result.radius*.85);ctx.stroke();}
   status.textContent=(photo.example?'EXEMPLO · ':'')+'Leitura estimada: '+num(result.value)+' '+p.unidade+(result.confidence!=null?' · confiança OCR '+Math.round(result.confidence)+'%.':' · confira o ponteiro indicado.');
   if(root.querySelector('#photo-auto').checked)await send(key,false);
  }catch(e){if(current()){status.textContent=e.message;status.classList.add('is-pending');}}
 }
 async function example(key){
  if(!MSA.demo?.active||busy)return;
  const c=card(key),m=getMachine(),p=m?.parametros[key];if(!p||exampleLocks.has(c))return;
  const mode=c.querySelector('[data-reader-mode]').value;
  const steps=exampleSteps.get(c)||{},index=steps[mode]||0,rev=generation;
  const button=c.querySelector('[data-photo-example]');exampleLocks.add(c);button.disabled=true;
  try{
   if(!root.querySelector('#photo-lot').value.trim())root.querySelector('#photo-lot').value='LT-DEMONSTRACAO';
   const lot=root.querySelector('#photo-lot').value.trim();
   const canvas=document.createElement('canvas');canvas.width=canvas.height=640;const ctx=canvas.getContext('2d');let label,demoProfile=null;
   if(mode==='digital'){
    const unit=c.querySelector('[data-digital-unit]').value,dark=index===1||index===3;
    const fractions=[.5,.1,.9,-.15,1.15],fallback=/temperatura/i.test(p.nome)?[180.5,245.8,250,175.2,260.5]:/vácuo|vacuo/i.test(p.nome)?[-380,-450,-320,-600,-250]:[6.5,6.7,7,5.8,7.5];
    const value=Number.isFinite(p.min)&&Number.isFinite(p.max)&&p.max>p.min?p.min+(p.max-p.min)*fractions[index]:fallback[index];
    const shown=Number(MSA.digitalReader.convert(value,p.unidade,unit).toFixed(2));
    ctx.fillStyle=dark?'#151515':'#fff';ctx.fillRect(0,0,640,640);ctx.fillStyle=dark?'#fff':'#151515';ctx.font='bold '+[88,96,84,92,88][index]+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(index===2?String(shown):String(shown).replace('.',','),320,320);
    label=dark?'Visor com fundo escuro':'Visor com fundo claro';
   }else{
    const vacuum=/vácuo|vacuo/i.test(p.nome),temperature=/temperatura/i.test(p.nome),get=k=>c.querySelector(`[data-scale="${k}"]`).value;
    demoProfile=c.querySelector('[data-scale-confirm]').checked?{start:Number(get('start')),end:Number(get('end')),startAngle:Number(get('startAngle')),sweep:Number(get('sweep')),unit:get('unit')}:{start:0,end:vacuum?-760:temperature?300:14,startAngle:vacuum?45:135,sweep:vacuum?-270:270,unit:vacuum?'mmHg':temperature?p.unidade:'kgf/cm²'};
    const fraction=[.5,.25,.75,.1,.9][index],a=(demoProfile.startAngle+demoProfile.sweep*fraction)*Math.PI/180;
    ctx.fillStyle='#fff';ctx.fillRect(0,0,640,640);ctx.strokeStyle='#aaa';ctx.lineWidth=4;ctx.beginPath();ctx.arc(320,320,264,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='#161616';ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(320,320);ctx.lineTo(320+Math.cos(a)*204,320+Math.sin(a)*204);ctx.stroke();ctx.fillStyle='#161616';ctx.beginPath();ctx.arc(320,320,24,0,Math.PI*2);ctx.fill();
    label='Ponteiro · escala de exemplo '+demoProfile.start+' a '+demoProfile.end+' '+demoProfile.unit;
   }
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Não foi possível criar a imagem de exemplo.');
   if(rev!==generation||!root?.isConnected||getMachine()?.id!==m.id||root.querySelector('#photo-lot').value.trim()!==lot)return;
   steps[mode]=(index+1)%5;exampleSteps.set(c,steps);
   button.textContent='Testar próximo exemplo';const note=c.querySelector('[data-photo-example-status]');note.hidden=false;note.textContent='EXEMPLO '+(index+1)+' de 5 · '+label+'. Imagem gerada para demonstração.';
   c.querySelectorAll('[data-crop]').forEach(input=>input.value=input.dataset.crop==='zoom'?'1':'50');
   await capture(key,new File([blob],'exemplo-'+mode+'-'+(index+1)+'.png',{type:'image/png'}),true,demoProfile);
  }finally{exampleLocks.delete(c);if(c.isConnected&&!busy)button.disabled=false;}
 }
 async function context(machineId){
  if(MSA.data.user?.maquinaId===machineId&&MSA.data.state.ready)return;
  await MSA.data.changeContext({maquinaId:machineId});
  const until=Date.now()+8000;
  while(Date.now()<until){if(MSA.data.user?.maquinaId===machineId&&MSA.data.state.ready)return;await new Promise(r=>setTimeout(r,50));}
  throw new Error('A máquina em uso ainda não foi confirmada. Aguarde e tente novamente.');
 }
 async function send(key,manual=true){
  if(busy){const rev=generation;await new Promise(r=>setTimeout(r,150));if(rev===generation&&root?.isConnected)return send(key,manual);return;}
  const photo=photos.get(key),c=card(key),m=getMachine();if(!photo||!m)return;
  const raw=c.querySelector('[data-photo-value]').value.trim(),value=Number(raw.replace(',','.'));
  if(!raw||!Number.isFinite(value)){message('Confira a foto e informe uma leitura numérica.',true);return;}
  const lot=root.querySelector('#photo-lot').value.trim();if(!lot||lot.length>80){message('Informe o lote ou ordem, com até 80 caracteres.',true);return;}
  if(photo.machineId!==m.id||photo.lot!==lot){message('O contexto da foto mudou. Tire outra foto para o lote atual.',true);return;}
  busy=true;root.querySelectorAll('#photo-sector,#photo-machine,#photo-lot,[data-scale],[data-scale-confirm],[data-reader-mode],[data-digital-unit],[data-crop],[data-photo-file],[data-read],[data-photo-example],[data-photo-value],[data-photo-camera]').forEach(n=>n.disabled=true);const button=c.querySelector('[data-photo-send]');button.disabled=true;message('Enviando leitura para '+m.id+'…');
  try{
   await context(m.id);
   const at=photo.measurementAt??(MSA.data.state.scenarioAt||Date.now()),metodo=manual?'manual':photo.method;
   if(!manual&&(!metodo||photo.extracted!==value))throw new Error('A interpretação mudou. Analise a foto novamente antes do envio automático.');
   const values={maquinaId:m.id,lote:lot,data:at,valores:{[key]:value},observacao:(photo.example?'DEMONSTRAÇÃO: imagem de exemplo gerada. ':'')+(manual?'Leitura conferida pelo operador na foto.':'Estimativa por foto; aguarda conferência.'),fotoProcesso:{parametro:key,imagem:photo.crop,capturadaEm:photo.capturedAt,metodo,extraido:photo.extracted,...(photo.confidence!=null?{confianca:photo.confidence}:{}),...(photo.example?{exemplo:true}:{}),escala:photo.profile?JSON.stringify(photo.profile):''}};
   photo.id=await MSA.data.save('leituras',values,photo.id||undefined);
   c.querySelector('.photo-card-status').textContent=(photo.example?'EXEMPLO · ':'')+'Enviado · '+num(value)+' '+m.parametros[key].unidade+' · '+time(photo.capturedAt);
   button.textContent='Corrigir e reenviar';message('Registro enviado para '+m.id+' · lote '+lot+'. Disponível nos painéis e no histórico.');history();
  }catch(e){message(e.message,true);}finally{busy=false;button.disabled=false;root?.querySelectorAll('#photo-sector,#photo-machine,#photo-lot,[data-scale],[data-scale-confirm],[data-reader-mode],[data-digital-unit],[data-crop],[data-photo-file],[data-read],[data-photo-example],[data-photo-value],[data-photo-camera]').forEach(n=>n.disabled=false);}
 }
 async function correct(id){
  if(busy)return;const r=MSA.data.state.leituras.find(r=>r.id===id);if(!r?.fotoProcesso)return;
  root.querySelector('#photo-sector').value=r.setorId;machines();root.querySelector('#photo-machine').value=r.maquinaId;cards();root.querySelector('#photo-lot').value=r.lote;
  const key=r.fotoProcesso.parametro,c=card(key);if(!c)return;
  c.querySelector('[data-photo-value]').disabled=true;c.querySelector('.photo-card-status').textContent='Carregando a foto para correção…';
  const image=new Image(),rev=generation;await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=r.fotoProcesso.imagem;});if(rev!==generation)return;
  const photo={image,machineId:r.maquinaId,lot:r.lote,id:r.id,measurementAt:r.data,capturedAt:r.fotoProcesso.capturadaEm,extracted:r.fotoProcesso.extraido??null,profile:null,example:r.fotoProcesso.exemplo===true,confidence:r.fotoProcesso.confianca??null};
  photos.set(key,photo);crop(key);photo.extracted=r.fotoProcesso.extraido??null;photo.confidence=r.fotoProcesso.confianca??null;try{photo.profile=JSON.parse(r.fotoProcesso.escala);if(photo.example&&photo.profile?.mode!=="digital")photo.demoProfile=photo.profile;}catch{}c.querySelector('[data-photo-send]').disabled=false;c.querySelector('[data-photo-value]').value=String(r.valores[key]).replace('.',',');c.querySelector('[data-photo-value]').disabled=false;c.querySelector('[data-photo-send]').textContent='Corrigir e reenviar';c.querySelector('.photo-card-status').textContent='Corrigindo registro existente. Confira a foto e envie o valor atualizado.';c.scrollIntoView({block:'center',behavior:MSA.motion?.reduced?'auto':'smooth'});
 }
 function detail(id){const r=MSA.data.state.leituras.find(r=>r.id===id),p=r?.fotoProcesso;if(!p)return;let d=document.querySelector('#photo-detail-dialog');if(!d){d=document.createElement('dialog');d.id='photo-detail-dialog';d.className='photo-detail-dialog';document.body.append(d);d.addEventListener('click',e=>{if(e.target.closest('[data-photo-close]'))MSA.motion?MSA.motion.closeDialog(d):d.close();});}d.innerHTML=`<header><h2>${esc(r.maquinaId)} · ${esc(r.lote)}</h2><button class="icon-button" aria-label="Fechar foto" data-photo-close>×</button></header><img src="${p.imagem}" alt="Evidência da leitura de ${esc(p.parametro)}"><p>${p.exemplo?'DEMONSTRAÇÃO — imagem de exemplo gerada. ':''}Captura: ${time(p.capturadaEm)}</p><p>Método: ${esc(p.metodo)}${p.confianca!=null?' · confiança OCR '+Math.round(p.confianca)+'%':''}</p><p>${Object.values(r.valores).map(num).join(' / ')} ${esc(p.unidade)} · ${p.metodo==='manual'?'Conferido pelo operador':'Estimativa automática, aguardando conferência'}</p><p>Responsável: RE ${esc(r.usuarioRe)}</p>`;MSA.motion?MSA.motion.openDialog(d):d.showModal();}
 MSA.photoUI={open(host,{user,state}){
  if(host.querySelector('#photo-workspace')){root=host.querySelector('#photo-workspace');history();return;}
  generation++;photos=new Map();host.innerHTML=`<div id="photo-workspace"><div class="photo-intro"><p>Selecione o posto e o lote. Depois fotografe os instrumentos.</p><a class="secondary-button" href="#apontamentos">Voltar aos apontamentos</a></div><section class="ops-panel photo-context"><div class="photo-fields"><label>Setor<select id="photo-sector">${state.setores.map(s=>`<option value="${esc(s.id)}" ${s.id===user.setorId?'selected':''}>${esc(s.nome)}</option>`).join('')}</select></label><label>Máquina<select id="photo-machine"></select></label><label>Lote / ordem<input id="photo-lot" type="text" maxlength="80" placeholder="Ex.: LT-2026-018" required></label></div><p id="photo-product" class="ops-note"></p><label class="photo-check"><input id="photo-auto" type="checkbox" checked>Enviar automaticamente quando a foto for interpretada</label><p class="ops-note">A foto preenche a leitura e envia os dados automaticamente. Se a leitura não for reconhecida, reenquadre e tente novamente; a correção manual é opcional. O envio atualiza o sistema sem exportação de arquivos.</p><p id="photo-message" role="status" aria-live="polite">Selecione a máquina e informe o lote para começar.</p></section><div class="photo-instruments" id="photo-instruments"></div><section class="ops-panel"><div class="ops-panel-heading"><h2>Últimos registros por foto</h2><a class="ops-link" href="#producao">Consultar produção</a></div><div id="photo-history"></div></section></div>`;root=host.querySelector('#photo-workspace');machines();history();
  root.addEventListener('change',e=>{if(e.target.id==='photo-sector'){if(busy)return;machines();}if(e.target.id==='photo-machine'){if(busy)return;cards();const id=getMachine()?.id;if(id)void context(id).then(()=>{history();message('Máquina em uso: '+id+'. Informe o lote e capture a foto.');}).catch(e=>message(e.message,true));}const c=e.target.closest('[data-photo-key]');if(c&&(e.target.matches('[data-reader-mode],[data-digital-unit],[data-scale],[data-scale-confirm]'))){const key=c.dataset.photoKey;if(e.target.matches('[data-scale]'))c.querySelector('[data-scale-confirm]').checked=false;c.querySelector('[data-analog-config]').hidden=c.querySelector('[data-reader-mode]').value==='digital';c.querySelector('[data-digital-config]').hidden=c.querySelector('[data-reader-mode]').value!=='digital';remember(key);crop(key);c.querySelector('.photo-card-status').textContent=photos.has(key)?'Configuração alterada. Analise o enquadramento novamente.':'Configuração guardada neste navegador.';}if(e.target.dataset.photoFile){const input=e.target,file=input.files[0];input.value='';void capture(input.dataset.photoFile,file);}});
  root.addEventListener('input',e=>{if(e.target.dataset.crop){crop(e.target.closest('[data-photo-key]').dataset.photoKey);e.target.closest('[data-photo-key]').querySelector('.photo-card-status').textContent='Enquadramento alterado. Clique em Analisar enquadramento.';}if(e.target.dataset.photoValue&&photos.has(e.target.dataset.photoValue)){photos.get(e.target.dataset.photoValue).revision++;card(e.target.dataset.photoValue).querySelector('[data-photo-send]').disabled=false;}});
  root.addEventListener('click',e=>{const read=e.target.closest('[data-read]'),sendButton=e.target.closest('[data-photo-send]'),details=e.target.closest('[data-photo-detail]'),correction=e.target.closest('[data-photo-correct]');const cameraButton=e.target.closest('[data-photo-camera]');if(cameraButton)camera(cameraButton.dataset.photoCamera);const sample=e.target.closest('[data-photo-example]');if(sample)void example(sample.dataset.photoExample).catch(e=>message(e.message,true));if(read)void analyze(read.dataset.read);if(sendButton)void send(sendButton.dataset.photoSend);if(details)detail(details.dataset.photoDetail);if(correction)void correct(correction.dataset.photoCorrect).catch(e=>message('Não foi possível abrir a foto para correção.',true));});
  MSA.motion?.enter(root);
 }};
})();
