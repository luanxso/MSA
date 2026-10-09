import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
async function fixture(storage=new Map()){
 const c=vm.createContext({Date,console,URLSearchParams,URL,crypto:webcrypto,location:{search:'?demonstracao=1&cargo=operador'},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},addEventListener(){},dispatchEvent(){},CustomEvent:class{},setTimeout,clearTimeout});c.window=c;
 for(const file of ['config','plant-layout','telemetry-service','rbac','shifts','photo-records','gauge-reader','metrics','performance','capability-export','scenario-parameters','scenario-data','scenario-live','operations-service','scenario-service'])vm.runInContext(readFileSync('dist/assets/'+file+'.js','utf8'),c);
 const a=c.MSA;await a.data.changeContext({maquinaId:'SEL-01'});await a.data.start(a.auth.session());return {a,storage};
}
const photo=(a,key,value,extra={})=>({maquinaId:'SEL-01',data:a.data.state.scenarioAt,lote:'LT-FOTO-01',valores:{[key]:value},fotoProcesso:{parametro:key,imagem:'data:image/jpeg;base64,YQ==',capturadaEm:Date.now(),metodo:'ponteiro-local',unidade:key==='vacuo'?'mmHg':'bar',extraido:value,escala:'0 a 14 kgf/cm²',...extra}});
test('foto parcial chega ao histórico sem criar temperatura/ciclo e se mantém após simulação e recarga',async()=>{
 const {a,storage}=await fixture();const id=await a.data.save('leituras',photo(a,'pressao',6.6));const row=a.data.state.leituras.find(r=>r.id===id);assert.deepEqual(Object.keys(row.valores),['pressao']);assert.equal(row.origem,'foto');assert.equal(row.estudoSelo,undefined);
 a.demo.simulation.advance(65);assert.equal(a.data.state.leituras.filter(r=>r.origem==='foto').length,1);const m=a.data.state.maquinas.find(m=>m.id==='SEL-01'),p=a.performance.sample(m,a.data.state).parameters.pressao;assert.equal(p.value,6.6);assert.equal(p.origin,'Registro por foto');assert.equal(p.updatedAt,row.data);
 const restored=(await fixture(storage)).a;assert.equal(restored.photoRecords.parameters(m,restored.data.state).pressao.value,6.6);assert.equal(restored.data.state.leituras.find(r=>r.id===id).fotoProcesso.imagem,row.fotoProcesso.imagem);
});
test('fotos de instrumentos diferentes conservam horários e correção atualiza o mesmo registro',async()=>{
 const {a}=await fixture();const first=await a.data.save('leituras',photo(a,'pressao',6.6));a.demo.simulation.advance(10);await a.data.save('leituras',photo(a,'vacuo',-360));a.demo.simulation.advance(20);
 const m=a.data.state.maquinas.find(m=>m.id==='SEL-01'),p=a.photoRecords.parameters(m,a.data.state);assert.equal(p.pressao.value,6.6);assert.equal(p.vacuo.value,-360);assert.notEqual(p.pressao.updatedAt,p.vacuo.updatedAt);
 const count=a.data.state.leituras.length;await a.data.save('leituras',photo(a,'pressao',6.8,{metodo:'manual',extraido:6.6}),first);assert.equal(a.data.state.leituras.length,count);assert.equal(a.photoRecords.parameters(m,a.data.state).pressao.value,6.8);assert.equal(a.data.state.leituras.find(r=>r.id===first).fotoProcesso.extraido,6.6);
 assert.equal(a.metrics.deviations(a.data.state,[m]).filter(d=>d.parameter.unidade==='bar').length,0);
});
test('evidência inválida, parâmetro inexistente, vazio e outra máquina são recusados',async()=>{
 const {a}=await fixture();await assert.rejects(a.data.save('leituras',photo(a,'pressao',6,{imagem:'javascript:alert(1)'})),/JPEG/);
 await assert.rejects(a.data.save('leituras',photo(a,'nada',6)),/parâmetros|único/);
 await assert.rejects(a.data.save('leituras',photo(a,'pressao','')),/válido/);
 await assert.rejects(a.data.save('leituras',{...photo(a,'pressao',6),maquinaId:'INJ-01'}),/acesso/);
});
test('unidades do mostrador são convertidas sem usar limites do processo como escala',async()=>{
 const {a}=await fixture();assert(Math.abs(a.gaugeReader.convert(7,'kgf/cm²','bar')-6.864655)<1e-8);assert.equal(a.gaugeReader.convert(-360,'mmHg','mmHg'),-360);assert.throws(()=>a.gaugeReader.convert(3,'°C','bar'),/incompatíveis/);
 const data=new Uint8ClampedArray(320*320*4).fill(255);assert.throws(()=>a.gaugeReader.readPixels({data,width:320,height:320},{start:0,end:14,startAngle:135,sweep:270,unit:'kgf/cm²',targetUnit:'bar'}),/ambíguo/);
});
test('OCR preserva método/confiança e imagens de exemplo ficam identificadas apenas no cenário',async()=>{
 const {a}=await fixture();const id=await a.data.save('leituras',photo(a,'temperatura',180.5,{metodo:'ocr-local',confianca:92,exemplo:true}));
 const row=a.data.state.leituras.find(r=>r.id===id);assert.equal(row.fotoProcesso.metodo,'ocr-local');assert.equal(row.fotoProcesso.confianca,92);assert.equal(row.fotoProcesso.exemplo,true);assert.equal(a.photoRecords.parameters(a.data.state.maquinas.find(m=>m.id==='SEL-01'),a.data.state).temperatura.origin,'Foto de exemplo (demonstração)');
 await assert.rejects(a.data.save('leituras',photo(a,'temperatura',180,{metodo:'ocr-local',confianca:101})),/Confiança/);
 a.demo.active=false;assert.throws(()=>a.photoRecords.clean(photo(a,'temperatura',180,{metodo:'ocr-local',exemplo:true}),a.data.state.maquinas.find(m=>m.id==='SEL-01')),/demonstração/);
});
