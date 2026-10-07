import {readFile,writeFile,mkdir} from 'node:fs/promises';
import vm from 'node:vm';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export function buildDemoData(config, now = Date.now()) {
  const dayText = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const today = Date.parse(dayText+'T00:00:00-03:00');
  const result = Object.fromEntries(['setores','maquinas','perfis','registrosProducao','leituras','paradas','perdas','ocorrencias','consolidacoes'].map(k=>[k,{}]));
  const prefix='demo-v1-';
  config.sectors.forEach((sector,i)=>{
    result.setores[sector.id]={nome:sector.nome};
    result.perfis[prefix+'supervisor-'+sector.id]={nome:'Supervisor Exemplo '+(i+1),re:String(990101+i),cargo:'supervisor',cargoSolicitado:'supervisor',status:'ativo',setorId:sector.id,maquinaId:'',createdAt:today-14*86400000};
  });
  config.machines.forEach((machine,i)=>{
    const {id,...definition}=machine;
    const uid=prefix+'operador-'+id, re=String(990201+i);
    result.perfis[uid]={nome:'Operador Exemplo '+(i+1),re,cargo:'operador',cargoSolicitado:'operador',status:'ativo',setorId:machine.setorId,maquinaId:id,createdAt:today-14*86400000};
    result.maquinas[id]={...definition,createdAt:today-14*86400000,updatedAt:now,atualizadoPor:uid};
    for(let d=6;d>=0;d--){
      const start=today-d*86400000;
      const end=d===0?now-60000:start+18*3600000;
      const begin=d===0?Math.min(start+6*3600000,end-2*3600000):start+6*3600000;
      const dateKey=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(start).replaceAll('-','');
      const baseKey=prefix+dateKey+'-'+id;
      const common={setorId:machine.setorId,maquinaId:id,usuarioId:uid,usuarioRe:re,createdAt:end,updatedAt:end,atualizadoPor:uid,verificado:false,observacao:'Dados de demonstração.'};
      const lote='EX-'+dateKey+'-'+(i+1);
      for(let shift=0;shift<2;shift++){
        const inicio=begin+(end-begin)*shift/2,fim=begin+(end-begin)*(shift+1)/2;
        const quantidade=Math.round(machine.metaDiaria*(.34+((i+d+shift)%5)*.025));
        result.registrosProducao[baseKey+'-'+shift]={...common,inicio,fim,quantidade,turno:String(shift+1),produto:machine.produto,lote};
      }
      const data=end-300000;
      result.perdas[baseKey+'-refugo']={...common,tipo:'refugo',quantidade:8+(i+d)%11,unidade:'pecas',motivo:['Rebarba','Falha de acabamento','Dimensão fora da especificação'][i%3],produto:machine.produto,lote,data};
      result.perdas[baseKey+'-material']={...common,tipo:'perda',quantidade:Number((1.4+(i+d)%4*.7).toFixed(1)),unidade:'kg',motivo:'Material retirado na preparação',produto:machine.produto,lote,data};
      if(d===0) result.perdas[baseKey+'-suspeito']={...common,tipo:'suspeito',quantidade:4+i,unidade:'pecas',motivo:'Aguardando avaliação da qualidade',produto:machine.produto,lote,data};
      const values=Object.fromEntries(Object.entries(machine.parametros||{}).map(([key,p])=>[key,Number(((p.min+p.max)/2).toFixed(2))]));
      if(Object.keys(values).length){
        if(d===0&&i===0)values.temperatura=machine.parametros.temperatura.max+3;
        result.leituras[baseKey]={...common,valores:values,lote,data:end-60000};
      }
      result.paradas[baseKey]={...common,inicio:begin+1800000,fim:begin+1800000+(12+i*4)*60000,motivo:'Ajuste de processo',causa:'Preparação do lote',encerradaPor:uid};
      if(d===0){
        result.ocorrencias[baseKey]={...common,descricao:['Verificar temperatura de processo','Conferir acabamento do lote','Revisar abastecimento de material','Avaliar ferramenta de montagem','Conferir embalagem'][i],prioridade:i===0?'alta':'normal',status:i%2?'resolvida':'aberta',resolucao:i%2?'Verificação concluída e processo liberado.':'',data};
        if(i===1)result.paradas[baseKey+'-aberta']={...common,inicio:now-18*60000,fim:0,motivo:'Troca de ferramenta',causa:'',encerradaPor:''};
      }
    }
  });
  config.sectors.forEach((sector,i)=>{
    result.consolidacoes[prefix+'resumo-'+sector.id]={setorId:sector.id,usuarioId:prefix+'supervisor-'+sector.id,usuarioRe:String(990101+i),inicio:today,fim:now-60000,createdAt:now-30000,observacao:'Resumo de demonstração: produção acompanhada, perdas registradas e pendências de processo em avaliação.'};
  });
  return result;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const context={window:{},MSA:{}};
  vm.runInNewContext(await readFile('dist/assets/config.js','utf8'),context);
  const payload=buildDemoData(context.MSA.config);
  await mkdir('demonstracao',{recursive:true});
  await writeFile('demonstracao/dados.json',JSON.stringify(payload,null,2));
  const counts=Object.fromEntries(Object.entries(payload).map(([k,v])=>[k,Object.keys(v).length]));
  await writeFile('demonstracao/resumo.json',JSON.stringify({generatedAt:new Date().toISOString(),timeZone:'America/Sao_Paulo',counts},null,2));
  console.log(JSON.stringify(counts));
}
