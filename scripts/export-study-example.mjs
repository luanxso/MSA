// Exemplo obtido do cenário inicial do programa, usando o exportador de Relatórios.
import vm from 'node:vm';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const args=Object.fromEntries(process.argv.slice(2).map(s=>{const i=s.indexOf('=');return[s.slice(2,i),s.slice(i+1)];}));
const stamp=args.at?Date.parse(args.at):Date.now();
if(!Number.isFinite(stamp))throw new Error('Data inválida. Use --at=2026-10-08T15:00:00-03:00.');
const model=await readFile(join(root,'dist/templates/MSA-Estudo-Capacidade-Selo-VGard.xlsx'));
const scope=vm.createContext({Date,console,Blob,TextEncoder,TextDecoder,fetch:async()=>({ok:true,arrayBuffer:async()=>model.buffer.slice(model.byteOffset,model.byteOffset+model.length)})});scope.window=scope;
for(const name of ['config','plant-layout','shifts','capability-export','capability-excel','scenario-parameters','scenario-data'])vm.runInContext(await readFile(join(root,'dist/assets/'+name+'.js'),'utf8'),scope);
const api=scope.MSA,state=api.createScenario(stamp),machine=state.maquinas.find(m=>m.id===(args.machine||'SEL-01'));
if(!api.capability.compatible(machine))throw new Error('Selecione uma máquina de Selagem com Selo V-Gard.');
const day=value=>{const d=new Date(value);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const end=new Date(state.scenarioAt);end.setHours(0,0,0,0);end.setDate(end.getDate()+1);const start=new Date(end);start.setDate(start.getDate()-7);
const selected=rows=>rows.filter(r=>(r.data||r.inicio)>=+start&&(r.data||r.inicio)<+end);
const data=api.capability.build(state,[machine],selected(state.leituras),selected(state.registrosProducao),selected(state.perdas));
const dates={from:day(start),to:day(state.scenarioAt)},[file]=await api.capabilityExcel.files(data,dates);
const output=resolve(args.output||join(root,'outputs/MSA-Estudo-Capacidade-Cenario-Inicial.xlsx'));await mkdir(dirname(output),{recursive:true});await writeFile(output,Buffer.from(await file.blob.arrayBuffer()));
const summary={descricao:'Fotografia da base fictícia inicial do programa. A sessão em andamento pode ter outras leituras.',cenarioEm:new Date(state.scenarioAt).toISOString(),maquina:machine.id,periodo:dates,leituras:data.items.length,parametros:api.capability.fields.map(f=>({chave:f.key,nome:f.label,unidade:f.unit})),registros:data.items.map(x=>({id:x.record.id,data:new Date(x.record.data).toISOString(),lote:x.record.lote,material:x.material,espessura:x.thickness,scrapPercentual:x.scrap,valores:x.values}))};
const summaryPath=output.replace(/\.xlsx$/i,'')+'-resumo.json';await writeFile(summaryPath,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({arquivo:output,resumo:summaryPath,maquina:machine.id,periodo:dates,leituras:data.items.length}));
