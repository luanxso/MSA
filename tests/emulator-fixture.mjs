import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import net from 'node:net';
export async function startEmulator(jar) {
 const reserve=net.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));
 const process=spawn('java',['-jar',jar,'--host','127.0.0.1','--port',String(port)],{stdio:'ignore'});
 const base=`http://127.0.0.1:${port}/`;let last;
 for(let i=0;i<60;i++) {try{const response=await fetch(base+'.settings/rules.json?ns=msa-test',{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:readFileSync(new URL('../database.rules.json',import.meta.url),'utf8')});assert.equal(response.status,200,await response.text());return {port,base,close:()=>process.kill()};}catch(e){last=e;await new Promise(r=>setTimeout(r,100));}}
 process.kill();throw last;
}
export function mockToken(uid,re='1') {
 const now=Math.floor(Date.now()/1000),enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
 return enc({alg:'none',typ:'JWT'})+'.'+enc({sub:uid,user_id:uid,iat:now,exp:now+3600,aud:'msa-test',iss:'https://securetoken.google.com/msa-test',email:`re-${re}@msa-safety-9f978.invalid`,firebase:{sign_in_provider:'password'}})+'.';
}
export async function api(base,path,uid,method='GET',body,query={}) {
 const url=new URL(path+'.json',base);url.searchParams.set('ns','msa-test');if(uid&&uid!=='owner')url.searchParams.set('auth',mockToken(uid));
 Object.entries(query).forEach(([k,v])=>url.searchParams.set(k,JSON.stringify(v)));
 const response=await fetch(url,{method,headers:{...(uid==='owner'?{Authorization:'Bearer owner'}:{}),'Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 return {status:response.status,data:await response.json()};
}
export const profile=(cargo,setorId='montagem',maquinaId='ABF-01',re='1')=>({nome:cargo,re,cargoSolicitado:cargo,cargo,status:'ativo',setorId:cargo==='chefe'?'':setorId,maquinaId:cargo==='operador'?maquinaId:'',createdAt:Date.now()});
