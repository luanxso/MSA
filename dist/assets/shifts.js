/* Horários ilustrativos. O terceiro turno pertence à data em que começa. */
window.MSA=window.MSA||{};
(() => {
 const definitions=[{id:'1',label:'1º turno',hours:'07h–15h'},{id:'2',label:'2º turno',hours:'15h–23h'},{id:'3',label:'3º turno',hours:'23h–07h (+1 dia)'}];
 const stamp=r=>r.inicio||r.data||r.createdAt||0;
 function id(record){if(['1','2','3'].includes(String(record.turno)))return String(record.turno);const hour=new Date(stamp(record)).getHours();return hour>=7&&hour<15?'1':hour>=15&&hour<23?'2':'3';}
 function within(record,start,end){if(record.diaProducao){const day=new Date(record.diaProducao+'T00:00:00').getTime();return day>=start&&day<end;}if(String(record.turno)==='3'){const date=new Date(stamp(record));if(date.getHours()<7)date.setDate(date.getDate()-1);date.setHours(0,0,0,0);return +date>=start&&+date<end;}const at=record.fim?record.fim-1:(record.data||record.inicio||record.createdAt);return at>=start&&at<end;}
 function filter(state,turno='todos') {if(turno==='todos')return state;const next={...state};for(const key of ['registrosProducao','leituras','paradas','perdas','ocorrencias'])next[key]=(state[key]||[]).filter(r=>id(r)===turno);return next;}
 MSA.shifts=Object.freeze({definitions,id,within,filter});
})();
