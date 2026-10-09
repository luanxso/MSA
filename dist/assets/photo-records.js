/* Fotos reais não recebem valores da simulação. Um registro por instrumento. */
window.MSA = window.MSA || {};
(() => {
 'use strict';
 const fail = text => { throw new Error(text); };
 function clean(values, machine) {
  const photo = values.fotoProcesso;
  if (!photo) return {};
  const key = photo.parametro;
  if (!machine.parametros?.[key] || Object.keys(values.valores || {}).length !== 1 || !Object.hasOwn(values.valores,key)) fail('Vincule a foto a um único parâmetro cadastrado.');
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(photo.imagem || '') || photo.imagem.length > 220000) fail('A foto precisa ser JPEG e ter até 160 KB.');
  if (!['ponteiro-local','manual','adaptador','ocr-local'].includes(photo.metodo)) fail('Origem da leitura inválida.');
  if (!Number.isFinite(photo.capturadaEm) || photo.capturadaEm < 0 || photo.capturadaEm > Date.now()+60000) fail('Horário da captura inválido.');
  const optional = {};
  if(photo.exemplo === true){if(!MSA.demo?.active)fail('Imagens de exemplo são permitidas apenas no cenário de demonstração.');optional.exemplo=true;}
  if(photo.confianca != null){if(!Number.isFinite(photo.confianca)||photo.confianca<0||photo.confianca>100)fail('Confiança do OCR inválida.');optional.confianca=photo.confianca;}
  if (photo.extraido != null) { if (!Number.isFinite(photo.extraido)) fail('Leitura extraída inválida.'); optional.extraido=photo.extraido; }
  return {origem:'foto',fotoProcesso:{parametro:key,imagem:photo.imagem,capturadaEm:photo.capturadaEm,metodo:photo.metodo,unidade:machine.parametros[key].unidade,escala:String(photo.escala||'').slice(0,200),...optional},turno:MSA.shifts.context(values.data).turno};
 }
 function parameters(machine,state,at=Infinity) {
  const rows=(state.leituras||[]).filter(r=>r.maquinaId===machine.id&&r.data<=at).sort((a,b)=>b.data-a.data);
  return Object.fromEntries(Object.entries(machine.parametros||{}).map(([key,p])=>{
   const photo=rows.some(r=>r.origem==='foto'&&Number.isFinite(r.valores?.[key]));
   const row=rows.find(r=>Number.isFinite(r.valores?.[key])&&(!photo||!r.simulacaoParametros));
   const value=row?.valores[key]??null;
   return [key,{...p,value,updatedAt:row?.data||null,origin:row?.origem==='foto'?(row.fotoProcesso?.exemplo?'Foto de exemplo (demonstração)':'Registro por foto'):row?.simulacaoParametros?'Simulação':'Apontamento',record:row,alarm:value!==null&&(value<p.min||value>p.max)}];
  }));
 }
 MSA.photoRecords={clean,parameters};
})();
