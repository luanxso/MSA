/* Horários ilustrativos. O terceiro turno pertence à data em que começa. */
window.MSA=window.MSA||{};
(() => {
 const definitions=[{id:'1',label:'1º turno',hours:'07h–15h'},{id:'2',label:'2º turno',hours:'15h–23h'},{id:'3',label:'3º turno',hours:'23h–07h (+1 dia)'}];
 const stamp=r=>r.inicio||r.data||r.createdAt||0;
 function context(at){const d=new Date(at),hour=d.getHours(),turno=hour>=7&&hour<15?'1':hour>=15&&hour<23?'2':'3';if(hour<7)d.setDate(d.getDate()-1);const day=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;d.setHours(7+(Number(turno)-1)*8,0,0,0);const start=+d;d.setHours(d.getHours()+8);return {turno,diaProducao:day,start,end:+d};}
 function id(record){if(['1','2','3'].includes(String(record.turno)))return String(record.turno);const hour=new Date(stamp(record)).getHours();return hour>=7&&hour<15?'1':hour>=15&&hour<23?'2':'3';}
 function within(record,start,end){if(record.diaProducao){const day=new Date(record.diaProducao+'T00:00:00').getTime();return day>=start&&day<end;}if(id(record)==='3'){const date=new Date(stamp(record));if(date.getHours()<7)date.setDate(date.getDate()-1);date.setHours(0,0,0,0);return +date>=start&&+date<end;}const at=record.fim?record.fim-1:(record.data||record.inicio||record.createdAt);return at>=start&&at<end;}
 function filter(state,turno='todos') {if(turno==='todos')return state;const next={...state,selectedShift:String(turno)};for(const key of ['registrosProducao','leituras','perdas','ocorrencias'])next[key]=(key==='registrosProducao'&&MSA.metrics?.netProduction?MSA.metrics.netProduction(state):state[key]||[]).filter(r=>id(r)===String(turno));return next;}
 function hourTarget(machine,at=Infinity){
  const versions=Object.values(machine?.historicoMetas||{}).filter(v=>Number.isFinite(v.inicio)&&v.inicio<=at&&Number.isFinite(v.metaDiaria)&&v.metaDiaria>=0).sort((a,b)=>a.inicio-b.inicio);
  if(versions.length)return versions.at(-1).metaDiaria/8;
  const explicit=Number(machine?.hourTarget);return Number.isFinite(explicit)&&explicit>0?explicit:Math.max(0,Number(machine?.metaDiaria)||0)/8;
 }
 function targetBetween(machine,start,end){
  if(!(end>start))return 0;
  const edges=[start,...Object.values(machine?.historicoMetas||{}).map(v=>v.inicio).filter(at=>at>start&&at<end),end].sort((a,b)=>a-b);
  return edges.slice(1).reduce((n,b,i)=>n+(b-edges[i])/3600000*hourTarget(machine,edges[i]),0);
 }
 function targetHistory(machine,metaDiaria,at){
  const history={...(machine?.historicoMetas||{})};
  if(!Object.keys(history).length)history.base={inicio:0,metaDiaria:hourTarget(machine)*8};
  let key='v'+at,index=0;while(Object.hasOwn(history,key))key='v'+at+'_'+(++index);
  history[key]={inicio:at,metaDiaria};return history;
 }
 function validateProduction(inicio,fim,turno){
  const c=context(inicio);
  if(String(turno)!==c.turno)throw new Error('O turno deve corresponder ao horário de início do período.');
  if(fim>c.end)throw new Error('O período atravessa a troca de turno. Registre cada turno separadamente.');
 }
 function physicalBounds(start,end){
  const a=new Date(start),b=new Date(end);
  if(a.getHours()===0&&a.getMinutes()===0&&b.getHours()===0&&b.getMinutes()===0){a.setHours(7,0,0,0);b.setHours(7,0,0,0);return [+a,+b];}
  return [start,end];
 }
 function clipStops(records,start,end,turno,now=Date.now()){
  const [a,b]=physicalBounds(start,end),finish=Math.min(b,now);
  if(!['1','2','3'].includes(String(turno)))return records.map(r=>({...r,inicio:Math.max(a,r.inicio),fim:Math.min(finish,r.fim||now)})).filter(r=>r.fim>r.inicio);
  const result=[];
  for(const r of records){const first=new Date(Math.max(a,r.inicio)),last=Math.min(finish,r.fim||now);first.setHours(0,0,0,0);if(Number(turno)===3)first.setDate(first.getDate()-1);
   for(const d=new Date(first);+d<last;d.setDate(d.getDate()+1)){const x=new Date(d);x.setHours(7+(Number(turno)-1)*8,0,0,0);const y=new Date(x);y.setHours(y.getHours()+8);const inicio=Math.max(a,r.inicio,+x),fim=Math.min(last,+y);if(fim>inicio)result.push({...r,inicio,fim});}
  }
  return result;
 }
 MSA.shifts=Object.freeze({definitions,id,within,filter,context,hourTarget,targetBetween,targetHistory,validateProduction,physicalBounds,clipStops});
})();
