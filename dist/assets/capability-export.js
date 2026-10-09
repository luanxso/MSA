/* Modelo de coleta Selo V-Gard da planilha fornecida por Fabiana.
 * Cada linha é uma leitura, nunca uma receita preenchida com limites ou médias. */
window.MSA=window.MSA||{};
(() => {
 'use strict';
 const fields=[
  ['temp_ambiente','Temp Ambiente','°C'],
  ...Array.from({length:21},(_,i)=>['aquecimento_z'+(i+1),'Aquecimento Z'+(i+1),'°C']),
  ['medida_passo','Medida do Passo','mm'],['velocidade_passo','Velocidade do Passo','%'],
  ['tempo_vacuo','Tempo de Vacuo','seg'],['tempo_resfriamento','Tempo de Resfriamento','seg'],
  ['tempo_destacar','Tempo destacar','seg'],['tempo_contra_molde','Tempo Contra molde','seg'],
  ['tempo_prensa_corte','Tempo prensa corte','seg'],['tempo_esteira_saida','Tempo de esteira saida','seg'],
  ['retardo_passo','Retardo de Passo','seg'],['retardo_mesa','Retardo de Mesa','seg'],
  ['retardo_vacuo','Retardo de Vacuo','seg'],['retardo_resfriamento','Retardo de resfriamento','seg'],
  ['retardo_destacar','Retardo destacar','seg'],['retardo_contra_molde','Retardo Contra Molde','seg'],
  ['retardo_prensa_corte','Retardo Prensa Corte','seg'],['retardo_disco_corte','Retardo disco corte','seg'],
  ['retardo_esteira_saida','Retardo esteria saida','seg'],['pressao_ar','Pressão Ar','bar'],['vacuo','Vacuo','mm/Hg']
 ].map(([key,label,unit])=>({key,label,unit}));
 const normalize=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const numeric=v=>v!==null&&v!==undefined&&String(v).trim()!==''&&Number.isFinite(Number(String(v).replace(',','.')))?Number(String(v).replace(',','.')):null;
 const compatible=m=>m?.setorId==='selagem'&&/selo|v[ -]?gard/i.test(m.produto||'');
 function clean(input={}){
  const material=String(input.material||'').trim().slice(0,80),espessura=numeric(input.espessura),valores={};
  if(input.espessura!==undefined&&input.espessura!==null&&String(input.espessura).trim()!==''&&(espessura===null||espessura<=0))throw new Error('Informe uma espessura válida, maior que zero.');
  for(const f of fields){const raw=input.valores?.[f.key]??input['selo_'+f.key];if(raw===undefined||raw===null||String(raw).trim()==='')continue;const value=numeric(raw);if(value===null)throw new Error('Informe um valor válido para '+f.label+'.');valores[f.key]=value;}
  return {...(material?{material}:{}),...(espessura!==null?{espessura}:{}),...(Object.keys(valores).length?{valores}:{})};
 }
 function read(row,m,f){
  const captured=numeric(row.estudoSelo?.valores?.[f.key]);if(captured!==null)return captured;
  for(const[key,p]of Object.entries(m.parametros||{})){
   const exact=key===f.key||normalize(p.nome)===normalize(f.label),alias=f.key==='pressao_ar'&&key==='pressao';
   if(!(exact||alias))continue;
   if(normalize(p.unidade)!==normalize(f.unit)&&!(f.unit==='seg'&&p.unidade==='s'))continue;
   const value=numeric(row.valores?.[key]);if(value!==null)return value;
  }
  return null;
 }
 // Grupo de refugo: mesma máquina, lote, dia produtivo e turno. Kg e suspeitas não são peças refugadas.
 function group(r){const context=MSA.shifts.context(r.inicio||r.data||r.createdAt);return JSON.stringify([r.maquinaId,r.lote,r.diaProducao||context.diaProducao,String(r.turno||context.turno)]);}
 function build(state,machines,readings,production,losses){
  const equipment=new Map(machines.filter(compatible).map(m=>[m.id,m])),totals=new Map();
  const add=(r,key)=>{if(!equipment.has(r.maquinaId)||!r.lote||numeric(r.quantidade)===null)return;const k=group(r),t=totals.get(k)||{good:0,rejected:0,hasGood:false};t[key]+=Number(r.quantidade);if(key==='good')t.hasGood=true;totals.set(k,t);};
  const approved=MSA.metrics?.netProduction?MSA.metrics.netProduction(state):production;
  production.forEach(r=>add(approved.find(x=>r.id&&x.id===r.id)||r,'good'));losses.filter(r=>r.tipo==='refugo'&&r.unidade!=='kg').forEach(r=>add(r,'rejected'));
  const heads=['Data','Material','Espessura (mm)','% Scrap','Lote',...fields.map(f=>f.label+' ('+f.unit+')'),'Hora','Máquina','Produto','Turno','RE','ID da leitura','Origem'];
  const rows=[],items=[];let missing=0;
  for(const r of [...readings].sort((a,b)=>a.data-b.data||String(a.id).localeCompare(String(b.id)))){
   const m=equipment.get(r.maquinaId);if(!m||!Number.isFinite(r.data))continue;
   // A leitura ativa é apenas o mostrador; as amostras de 30 s já guardam seu histórico.
   if(r.id?.startsWith('exemplo-leitura-ativa-')&&readings.some(x=>x.maquinaId===r.maquinaId&&x.id?.startsWith('exemplo-amostra-')))continue;
   const values=fields.map(f=>read(r,m,f)),material=r.estudoSelo?.material||'',thickness=numeric(r.estudoSelo?.espessura),t=totals.get(group(r));
   const scrap=t?.hasGood&&t.good+t.rejected>0?t.rejected/(t.good+t.rejected)*100:null;
   const context=MSA.shifts.context(r.data),date=new Date(r.data),origin=state.demo?'Simulação':r.automatica?'Coleta automática':'Registro manual';
   missing+=values.filter(v=>v===null).length;
   const row=[date.toLocaleDateString('pt-BR'),material,thickness,scrap,r.lote||'',...values,date.toLocaleTimeString('pt-BR',{hour12:false}),m.id,m.produto,String(r.turno||context.turno),r.usuarioRe||'',r.id||'',origin];
   rows.push(row);items.push({record:r,machine:m,values,material,thickness,scrap,origin});
  }
  return {heads,rows,items,missing};
 }
 function csv(data){
  const cell=v=>{let s=typeof v==='number'?String(Number(v.toFixed(6))).replace('.',','):String(v??'');if(typeof v!=='number'&&/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
  return '\uFEFF'+[data.heads,...data.rows].map(row=>row.map(cell).join(';')).join('\r\n');
 }
 // Valores ilustrativos, separados dos dados reais e sem copiar as medições históricas da Fabiana.
 function demoSample(machine,at,index=0,base={}){
  const phase=at/7000+index,vals={temp_ambiente:23+Math.sin(phase)*1.8};
  const zones=[45,260,260,257,257,257,270,270,90,96,255,265,265,260,275,275,275,76,290,305,315];
  zones.forEach((v,i)=>vals['aquecimento_z'+(i+1)]=v+Math.sin(phase+i*.7)*1.2);
  const rest=[413,19.5,80,35.5,.85,80,12,29,1.5,.5,4.5,4.5,3,2,12,8,.75,6.6,-550];
  fields.slice(22).forEach((f,i)=>vals[f.key]=rest[i]*(1+Math.sin(phase+i)*.012));
  if(Number.isFinite(base.pressao))vals.pressao_ar=base.pressao;if(Number.isFinite(base.vacuo))vals.vacuo=base.vacuo;
  return {material:'Material demonstrativo',espessura:.5,valores:Object.fromEntries(Object.entries(vals).map(([k,v])=>[k,Number(v.toFixed(3))]))};
 }
 function seedDemo(state){if(!state.demo)return;for(const r of state.leituras){
  // Remove também campos inventados em fotos restauradas de versões anteriores.
  if(r.origem==='foto'||r.fotoProcesso){delete r.estudoSelo;continue;}
  const m=state.maquinas.find(m=>m.id===r.maquinaId),simulated=r.simulacaoParametros===true||r.id?.startsWith('exemplo-read-');
  if(compatible(m)&&simulated&&!r.estudoSelo)r.estudoSelo=demoSample(m,r.data,0,r.valores);
 }}
 MSA.capability=Object.freeze({fields,compatible,clean,build,csv,demoSample,seedDemo});
})();
