import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {buildDemoData} from '../scripts/demo-data.mjs';
import {importDemo} from '../scripts/import-demo-data.mjs';

const context={window:{},MSA:{}};
vm.runInNewContext(await readFile(new URL('../dist/assets/config.js',import.meta.url),'utf8'),context);
const now=Date.parse('2026-10-07T14:30:00-03:00');
const payload=buildDemoData(context.MSA.config,now);
test('exemplos têm produção de hoje, referências consistentes, unidades separadas e nenhuma senha',()=>{
  assert.equal(Object.keys(payload.maquinas).length,context.MSA.config.machines.length);
  assert.equal(Object.keys(payload.registrosProducao).length,14*context.MSA.config.machines.length);
  for(const key of ['registrosProducao','leituras','paradas','perdas','ocorrencias'])for(const row of Object.values(payload[key])){
    assert.equal(payload.maquinas[row.maquinaId].setorId,row.setorId);
    assert(payload.perfis[row.usuarioId]);
    assert(row.createdAt<=now);
    assert(row.observacao.includes('demonstração'));
  }
  assert(Object.values(payload.registrosProducao).some(row=>row.fim>Date.parse('2026-10-07T00:00:00-03:00')));
  assert(Object.values(payload.paradas).some(row=>row.fim===0));
  for(const row of Object.values(payload.perdas))assert.equal(row.unidade,row.tipo==='perda'?'kg':'pecas');
  assert(!JSON.stringify(payload).includes('senha'));
});
test('importador preserva existentes, recusa corrida de escrita e não duplica em nova execução',async()=>{
  const stored=structuredClone(payload),calls=[];
  const existing={nome:'Máquina existente',setorId:'injecao'};
  stored.maquinas['INJ-01']=existing;
  delete stored.registrosProducao[Object.keys(payload.registrosProducao)[0]];
  const missing=Object.keys(payload.registrosProducao)[0];
  const request=async(url,options)=>{
    calls.push(options.method||'GET');
    const path=new URL(url).pathname.slice(1,-5).split('/');
    if(path.length===1)return Response.json(stored[path[0]]);
    const [collection,id]=path;
    if(options.method==='PUT'){
      assert.equal(options.headers['if-match'],'"empty"');
      stored[collection][id]=JSON.parse(options.body);
      return Response.json(stored[collection][id]);
    }
    return Response.json(stored[collection][id]||null,{headers:{etag:'"empty"'}});
  };
  let backed=false;
  const preview=await importDemo({payload,token:'fake',fetchImpl:request});
  assert.equal(preview.pending,1);assert(!calls.includes('PUT'));
  const applied=await importDemo({payload,token:'fake',apply:true,fetchImpl:request,backup:async()=>{backed=true}});
  assert(backed);assert.equal(applied.written,1);assert.deepEqual(stored.maquinas['INJ-01'],existing);
  assert(stored.registrosProducao[missing]);
  assert.equal((await importDemo({payload,token:'fake',apply:true,fetchImpl:request})).written,0);
  delete stored.registrosProducao[missing];
  const raced=async(url,options)=>options.method==='PUT'?new Response('',{status:412}):request(url,options);
  assert.equal((await importDemo({payload,token:'fake',apply:true,fetchImpl:raced})).written,0);
});
test('importador não tenta acesso sem token e interrompe antes de escrever em caso de acesso negado',async()=>{
  await assert.rejects(importDemo({payload,token:'',fetchImpl:()=>assert.fail('Não deve chamar a rede')}),/Falta acesso/);
  await assert.rejects(importDemo({payload,token:'fake',apply:true,fetchImpl:async()=>new Response('',{status:403})}),/Nenhum dado/);
});
