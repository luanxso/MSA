import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const database='https://msa-safety-9f978-default-rtdb.firebaseio.com';
const collections=['setores','maquinas','perfis','registrosProducao','leituras','paradas','perdas','ocorrencias','consolidacoes'];
export async function importDemo({payload,token,apply=false,fetchImpl=fetch,backup=async()=>{}}){
  if(!token)throw new Error('Falta acesso administrativo. Defina MSA_FIREBASE_ACCESS_TOKEN com um token OAuth temporário. Não use a chave pública do aplicativo.');
  const headers={Authorization:'Bearer '+token};
  const snapshots={},pending=[];
  for(const collection of collections){
    if(!payload[collection]||typeof payload[collection]!=='object')throw new Error('Coleção ausente: '+collection);
    const response=await fetchImpl(database+'/'+collection+'.json',{headers,signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error('Acesso ao Firebase recusado ou indisponível (HTTP '+response.status+'). Nenhum dado foi enviado.');
    snapshots[collection]=await response.json()||{};
    for(const [id,value] of Object.entries(payload[collection])){
      if(/[.#$\[\]/]/.test(id))throw new Error('Identificador inválido.');
      if(!['setores','maquinas'].includes(collection)&&!id.startsWith('demo-v1-'))throw new Error('Registro fora do conjunto de demonstração.');
      if(!Object.hasOwn(snapshots[collection],id))pending.push({collection,id,value});
    }
  }
  for(const [id,machine] of Object.entries(payload.maquinas)){
    if(snapshots.maquinas[id]&&snapshots.maquinas[id].setorId!==machine.setorId)throw new Error('A máquina '+id+' já pertence a outro setor. Corrija o conjunto antes de importar.');
  }
  if(!apply)return {pending:pending.length,written:0};
  await backup(snapshots);
  let written=0;
  for(const {collection,id,value} of pending){
    const url=database+'/'+collection+'/'+encodeURIComponent(id)+'.json';
    const check=await fetchImpl(url,{headers:{...headers,'X-Firebase-ETag':'true'},signal:AbortSignal.timeout(20000)});
    if(!check.ok)throw new Error('Falha ao verificar destino. '+written+' itens enviados; repita para continuar.');
    if(await check.json()!==null)continue;
    const etag=check.headers.get('etag');
    if(!etag)throw new Error('Firebase não retornou ETag; a importação parou para preservar dados existentes.');
    const saved=await fetchImpl(url,{method:'PUT',headers:{...headers,'Content-Type':'application/json','if-match':etag},body:JSON.stringify(value),signal:AbortSignal.timeout(20000)});
    if(saved.status===412)continue;
    if(!saved.ok)throw new Error('Importação interrompida (HTTP '+saved.status+'). '+written+' itens enviados; repita para continuar.');
    written++;
  }
  return {pending:pending.length,written};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    const payload=JSON.parse(await readFile('demonstracao/dados.json','utf8'));
    const result=await importDemo({payload,token:process.env.MSA_FIREBASE_ACCESS_TOKEN,apply:process.argv.includes('--apply'),backup:async snapshots=>{
      await mkdir('.firebase-backups',{recursive:true});
      await writeFile('.firebase-backups/antes-demo-'+Date.now()+'.json',JSON.stringify(snapshots,null,2),{flag:'wx',mode:0o600});
    }});
    console.log(JSON.stringify(result));
    if(!process.argv.includes('--apply'))console.log('Prévia concluída, sem escrita. Use --apply para enviar apenas os itens ausentes.');
  }catch(error){console.error(error.message);process.exitCode=1;}
}
