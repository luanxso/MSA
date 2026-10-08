/* Leituras e limites ilustrativos do cenário; nenhuma receita real da MSA. */
window.MSA=window.MSA||{};
(() => {
 const cycle={nome:'Tempo de ciclo',unidade:'s',min:10,max:40};
 function defaults(m){
  const pressure={nome:'Pressão de trabalho',unidade:'bar',min:5,max:7};
  if(m.setorId==='injecao')return{temperatura:{nome:'Temperatura do cilindro',unidade:'°C',min:230,max:260},pressao:{nome:'Pressão de injeção',unidade:'bar',min:80,max:120},ciclo:{...cycle}};
  if(m.setorId==='selagem')return{temperatura:{nome:'Temperatura de selagem',unidade:'°C',min:250,max:260},pressao:{...pressure,min:6.5,max:7},vacuo:{nome:'Vácuo',unidade:'mmHg',min:-600,max:-300},ciclo:{...cycle}};
  if(m.id==='NHPL')return{pressao:{nome:'Pressão pneumática',unidade:'bar',min:5.5,max:6.5},forca:{nome:'Força de prensagem',unidade:'N',min:350,max:450}};
  return{pressao:pressure,ciclo:{...cycle}};
 }
 function upgrade(state){
  if(!state.demo||state.parameterSchema===1)return;
  for(const m of state.maquinas){
   if(m.parametrosPersonalizados)continue;
   m.parametros={...defaults(m),...m.parametros};
   for(const row of state.leituras.filter(r=>r.maquinaId===m.id))for(const[key,p]of Object.entries(m.parametros))if(row.valores[key]===undefined)row.valores[key]=(p.min+p.max)/2;
  }
  state.parameterSchema=1;
 }
 function requestDeviation(state,id){
  const m=state.maquinas.find(m=>m.id===id),key=m&&Object.keys(m.parametros).find(k=>m.parametros[k].unidade==='°C')||m&&Object.keys(m.parametros).find(k=>m.parametros[k].unidade==='bar');
  if(!state.demo||!key)throw new Error('Este equipamento não possui temperatura ou pressão configurada.');
  state.liveParameters||={};state.liveParameters[id]||={};state.liveParameters[id].pending=key;
 }
 function advance(state,random=Math.random){
  if(!state.demo)return;
  state.liveParameters||={};state.parameterEvents||=[];
  state.maquinas.forEach((m,index)=>{
   const now=state.scenarioAt,runtime=state.liveParameters[m.id]||={};runtime.channels||={};
   let row=state.leituras.find(r=>r.id==='exemplo-leitura-ativa-'+m.id);
   if(!row){const last=state.leituras.filter(r=>r.maquinaId===m.id).sort((a,b)=>b.data-a.data)[0];row={...last,id:'exemplo-leitura-ativa-'+m.id,maquinaId:m.id,setorId:m.setorId,turno:'1',valores:{...last?.valores},simulacaoParametros:true,verificado:false};state.leituras.push(row);}
   row.valores=Object.fromEntries(Object.keys(m.parametros||{}).filter(k=>Object.hasOwn(row.valores,k)).map(k=>[k,row.valores[k]]));
   // Um sorteio por máquina a cada 30 segundos; alterações de valores não sorteiam a cada frame.
   const stopped=state.paradas.some(r=>r.maquinaId===m.id&&!r.fim),bucket=Math.floor(now/30000);
   const eligible=Object.keys(m.parametros).filter(k=>['°C','bar'].includes(m.parametros[k].unidade));
   let trigger=runtime.pending;
   if(runtime.bucket!==bucket){if(runtime.bucket!==undefined&&!stopped&&random()<(state.demoDeviationRate??.02)&&eligible.length)trigger=eligible[Math.floor(random()*eligible.length)];runtime.bucket=bucket;}
   if(trigger){runtime.channels[trigger]||={};runtime.channels[trigger].until=now+10000;runtime.pending=null;}
   for(const[key,p]of Object.entries(m.parametros)){
    if(!Number.isFinite(p.min)||!Number.isFinite(p.max)||p.max<=p.min)continue;
    const channel=runtime.channels[key]||={},isCycle=p.unidade==='s'&&/ciclo/i.test(p.nome||key),span=p.max-p.min;
    if(isCycle){row.valores[key]??=(p.min+p.max)/2;continue;}
    const out=!!channel.until&&now<channel.until,phase=now/7000+index*1.7+Object.keys(m.parametros).indexOf(key)*.9;
    const value=out?p.max+span*(.06+.025*(1+Math.sin(phase))):(p.min+p.max)/2+span*.12*Math.sin(phase);
    row.valores[key]=Number(value.toFixed(p.unidade==='°C'?1:2));
    if(out!==!!channel.active){
     const event={id:m.id+'-'+key+'-'+now,at:now,machineId:m.id,key,name:p.nome,unit:p.unidade,value:row.valores[key],min:p.min,max:p.max,type:out?'desvio':'normalizado'};
     state.parameterEvents.push(event);runtime.lastEvent=event;channel.active=out;channel.since=out?now:null;
    }
   }
   row.data=now;row.updatedAt=now;
   // Guarda uma amostra a cada 30 s e limita o histórico ao período da apresentação.
   if(runtime.sampleBucket!==bucket){runtime.sampleBucket=bucket;state.leituras.push({...row,id:'exemplo-amostra-'+m.id+'-'+bucket,valores:{...row.valores},data:now-1});}
  });
  state.parameterEvents=state.parameterEvents.slice(-200);
  const samples=state.leituras.filter(r=>r.id?.startsWith('exemplo-amostra-'));
  if(samples.length>1920){const discard=new Set(samples.slice(0,samples.length-1920).map(r=>r.id));state.leituras=state.leituras.filter(r=>!discard.has(r.id));}
 }
 MSA.scenarioParameters={defaults,upgrade,advance,requestDeviation};
})();
