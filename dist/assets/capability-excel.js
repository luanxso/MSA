/* Preenche o XLSX original, conservando suas partes nativas e fórmulas editáveis.
 * O modelo é um ZIP sem compressão: leitura e escrita locais, sem CDN ou upload de dados. */
window.MSA=window.MSA||{};
(() => {
 'use strict';
 const encoder=new TextEncoder(),decoder=new TextDecoder();
 const mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
 const modelUrl='templates/MSA-Estudo-Capacidade-Selo-VGard.xlsx?v=2';
 const col=n=>{let s='';for(;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
 const index=s=>[...s].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);
 const esc=s=>String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const unesc=s=>s.replace(/&(?:amp|lt|gt|quot|apos);/g,v=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[v]));
 const checksumTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
 const crc=bytes=>{let c=0xffffffff;for(const b of bytes)c=checksumTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;};
 function unzip(buffer){
  const bytes=new Uint8Array(buffer),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),parts=new Map();
  let end=bytes.length-22;for(;end>=Math.max(0,bytes.length-65557)&&view.getUint32(end,true)!==0x06054b50;end--);
  if(end<0||view.getUint32(end,true)!==0x06054b50)throw new Error('O modelo Excel está incompleto. Recarregue a página e tente novamente.');
  let pos=view.getUint32(end+16,true);const count=view.getUint16(end+10,true);
  for(let i=0;i<count;i++){
   if(view.getUint32(pos,true)!==0x02014b50||view.getUint16(pos+10,true)!==0)throw new Error('Formato do modelo Excel incompatível.');
   const size=view.getUint32(pos+20,true),nameSize=view.getUint16(pos+28,true),extra=view.getUint16(pos+30,true),comment=view.getUint16(pos+32,true),offset=view.getUint32(pos+42,true);
   const name=decoder.decode(bytes.subarray(pos+46,pos+46+nameSize)),start=offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true);
   const data=bytes.slice(start,start+size);if(data.length!==size||crc(data)!==view.getUint32(pos+16,true))throw new Error('O modelo Excel está corrompido. Recarregue a página e tente novamente.');
   parts.set(name,data);pos+=46+nameSize+extra+comment;
  }
  // The old model retained a Google Sheets roundtrip extension after its
  // auxiliary part was removed. Excel follows that dangling r:id and rejects
  // the comments part. Keep native notes; remove only obsolete Google metadata.
  for(const[name,data]of parts)if(/^xl\/comments\d+\.xml$/.test(name)){
   const xml=decoder.decode(data),clean=xml.replace(/<ext\b[^>]*\buri="GoogleSheets[^"]*"[^>]*>[\s\S]*?<\/ext>/g,'').replace(/<extLst\b[^>]*>\s*<\/extLst>/g,'');
   if(clean!==xml)parts.set(name,encoder.encode(clean));
  }
  return parts;
 }
 function zip(parts){
  const local=[],central=[];let offset=0,total=0;
  for(const[name,data]of parts){
   const filename=encoder.encode(name),sum=crc(data),header=new Uint8Array(30+filename.length),h=new DataView(header.buffer);
   h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(12,0x5d49,true);h.setUint32(14,sum,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,filename.length,true);header.set(filename,30);
   const entry=new Uint8Array(46+filename.length),e=new DataView(entry.buffer);e.setUint32(0,0x02014b50,true);e.setUint16(4,20,true);e.setUint16(6,20,true);e.setUint16(8,0x800,true);e.setUint16(14,0x5d49,true);e.setUint32(16,sum,true);e.setUint32(20,data.length,true);e.setUint32(24,data.length,true);e.setUint16(28,filename.length,true);e.setUint32(42,offset,true);entry.set(filename,46);
   local.push(header,data);central.push(entry);offset+=header.length+data.length;total+=entry.length;
  }
  const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,parts.size,true);v.setUint16(10,parts.size,true);v.setUint32(12,total,true);v.setUint32(16,offset,true);
  return new Blob([...local,...central,end],{type:mime});
 }
 function literal(v){
  if(v===null||v===undefined)return{type:'',body:''};
  if(typeof v==='number'&&Number.isFinite(v))return{type:'',body:'<v>'+v+'</v>'};
  return{type:' t="inlineStr"',body:'<is><t xml:space="preserve">'+esc(v)+'</t></is>'};
 }
 function cell(attrs,body,value){
  attrs=attrs.replace(/\s+t="[^"]*"/g,'');
  if(value&&typeof value==='object'&&Object.hasOwn(value,'cache')){
   const f=body.match(/<f\b[^>]*>[\s\S]*?<\/f>/)?.[0]||'';const v=value.cache;
   return'<c'+attrs+(typeof v==='string'?' t="str"':'')+'>'+f+'<v>'+esc(v??'')+'</v></c>';
  }
  const x=literal(value);return'<c'+attrs+x.type+'>'+x.body+'</c>';
 }
 function patchCells(xml,values){
  const byRow=new Map();for(const[address,v]of values){const r=Number(address.match(/\d+$/)[0]);if(!byRow.has(r))byRow.set(r,new Map());byRow.get(r).set(address,v);}
  return xml.replace(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g,(full,attrs,body='')=>{
   const r=Number(attrs.match(/\br="(\d+)"/)?.[1]),pending=byRow.get(r);if(!pending)return full;
   const cells=[];body.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,(whole,a,b='')=>{
    const address=a.match(/\br="([A-Z]+\d+)"/)?.[1];if(!address)return;
    const result=pending.has(address)?cell(a,b,pending.get(address)):whole;pending.delete(address);cells.push([address,result]);
   });
   for(const[address,v]of pending)cells.push([address,cell(' r="'+address+'"','',v)]);
   cells.sort((a,b)=>index(a[0].match(/[A-Z]+/)[0])-index(b[0].match(/[A-Z]+/)[0]));
   return'<row'+attrs+'>'+cells.map(c=>c[1]).join('')+'</row>';
  });
 }
 function mapFormulas(xml,fn){return xml.replace(/<f\b([^>]*)>([\s\S]*?)<\/f>/g,(_,a,f)=>'<f'+a+'>'+esc(fn(unesc(f)))+'</f>');}
 function moveRefs(text,start,delta,relative=false){return text.replace(/(\$?[A-Z]{1,3})(\$?)(\d+)\b/g,(whole,c,abs,r)=>Number(r)>=start&&(!relative||!abs)?c+abs+(Number(r)+delta):whole);}
 function shiftMain(xml,extra){
  if(!extra)return xml;
  const blank=xml.match(/<row\b[^>]*\br="67"[^>]*>[\s\S]*?<\/row>/)?.[0];if(!blank)throw new Error('O modelo não contém as linhas de coleta.');
  xml=mapFormulas(xml,f=>moveRefs(f,68,extra).replace(/(:\$?[A-Z]+\$?)67\b/g,'$1'+(67+extra)));
  xml=xml.replace(/\br="(\d+)"/g,(w,r)=>Number(r)>=68?'r="'+(Number(r)+extra)+'"':w).replace(/\br="([A-Z]+)(\d+)"/g,(w,c,r)=>Number(r)>=68?'r="'+c+(Number(r)+extra)+'"':w);
  xml=xml.replace(/\b(ref|sqref)="([^"]+)"/g,(_,key,ref)=>key+'="'+moveRefs(ref,68,extra).replace(/(:[A-Z]+)67\b/g,'$1'+(67+extra))+'"');
  const added=Array.from({length:extra},(_,i)=>blank.replace(/\br="67"/g,'r="'+(68+i)+'"').replace(/\br="([A-Z]+)67"/g,'r="$1'+(68+i)+'"')).join('');
  return xml.replace(/(<row\b[^>]*\br="67"[^>]*>[\s\S]*?<\/row>)/,(_,row)=>row+added);
 }
 function expandNormal(xml,last,capacity){
  xml=mapFormulas(xml,f=>f.replace(/ADDRESS\(67,/g,'ADDRESS('+last+',').replace(/(\$?[A-Z]+\$)1009\b/g,'$1'+(capacity+9)));
  if(capacity<=1000)return xml;
  const row=xml.match(/<row\b[^>]*\br="1009"[^>]*>[\s\S]*?<\/row>/)?.[0];if(!row)throw new Error('O modelo não contém as linhas de normalidade.');
  const added=[];for(let r=1010;r<=capacity+9;r++){
   let clone=row.replace(/\br="1009"/,'r="'+r+'"').replace(/\br="([A-Z]+)1009"/g,'r="$1'+r+'"');
   // Anchored ranges already point to the new end. Only relative row references move.
   clone=mapFormulas(clone,f=>f.replace(/(\$?[A-Z]+)(\$?)(\d+)\b/g,(w,c,a,n)=>!a&&Number(n)===1009?c+r:w));
   clone=clone.replace(/(<c\b[^>]*\br="A\d+"[^>]*>)[\s\S]*?<\/c>/,'$1<v>'+(r-9)+'</v></c>');added.push(clone);
  }
  // The source also has styled empty rows below 1009. Replace them instead of
  // appending duplicate row numbers, and keep rows in ascending order for Excel.
  xml=xml.replace(/<row\b([^>]*?)(?:\/>|>[\s\S]*?<\/row>)/g,(whole,attrs)=>{const r=Number(attrs.match(/\br="(\d+)"/)?.[1]);return r>1009&&r<=capacity+9?'':whole;});
  xml=xml.replace(/(<row\b[^>]*\br="1009"[^>]*>[\s\S]*?<\/row>)/,(_,row)=>row+added.join('')).replace(/(<dimension\b[^>]*ref="[^"]*:)[A-Z]+\d+"/,'$1AL'+(capacity+9)+'"');
  return xml;
 }
 function strings(parts){const s=decoder.decode(parts.get('xl/sharedStrings.xml')||new Uint8Array());return [...s.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m=>[...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(t=>unesc(t[1])).join(''));}
 function readCell(xml,address,shared){
  const c=xml.match(new RegExp('<c\\b[^>]*\\br="'+address+'"[^>]*(?:/>|>[\\s\\S]*?</c>)'))?.[0]||'',v=c.match(/<v>([\s\S]*?)<\/v>/)?.[1];
  if(/\bt="s"/.test(c))return shared[Number(v)];if(/\bt="inlineStr"/.test(c))return [...c.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(x=>unesc(x[1])).join('');
  return v!==undefined&&v!==''?Number(v):null;
 }
 const dateSerial=stamp=>{const d=new Date(stamp);return Date.UTC(d.getFullYear(),d.getMonth(),d.getDate(),d.getHours(),d.getMinutes(),d.getSeconds(),d.getMilliseconds())/86400000+25569;};
 const cdf=z=>{const x=Math.abs(z),t=1/(1+0.2316419*x),p=Math.exp(-x*x/2)/Math.sqrt(2*Math.PI)*t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return Math.max(1e-12,Math.min(1-1e-12,z>=0?1-p:p));};
 function normality(values){
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b),n=sorted.length,mean=n?sorted.reduce((a,b)=>a+b,0)/n:null;
  const sd=n>1?Math.sqrt(sorted.reduce((s,x)=>s+(x-mean)**2,0)/(n-1)):null,prob=sd>0?sorted.map(x=>cdf((x-mean)/sd)):[];
  const terms=prob.map((p,i)=>-(2*(i+1)-1)*(Math.log(p)+Math.log(1-prob[n-1-i]))/n),a2=terms.length?terms.reduce((a,b)=>a+b,0)-n:null,adjusted=a2===null?null:a2*(1+0.75/n+2.25/n**2);
  return{sorted,n,mean,sd,prob,terms,a2,adjusted};
 }
 function fill(parts,items){
  const result=new Map(parts),get=n=>decoder.decode(result.get(n)),put=(n,v)=>result.set(n,encoder.encode(v));
  const shared=strings(parts),extra=Math.max(0,items.length-51),last=67+extra,capacity=Math.max(1000,items.length),mainPath='xl/worksheets/sheet1.xml',normalPath='xl/worksheets/sheet2.xml';
  let main=shiftMain(get(mainPath),extra),normal=expandNormal(get(normalPath),last,capacity);const cells=new Map(),cache=(ref,v)=>cells.set(ref,{cache:v??''});
  for(let i=0;i<items.length;i++){
   const x=items[i],r=i+17;[dateSerial(x.record.data),x.material,x.thickness,x.scrap===null?null:x.scrap/100,x.record.lote||''].forEach((v,j)=>cells.set(col(j+1)+r,v));
   x.values.forEach((v,j)=>cells.set(col(6+2*j)+r,v));
  }
  const machine=items[0].machine,demo=items.some(x=>x.origin==='Simulação');cells.set('E5',dateSerial(items.at(-1).record.data));cells.set('O5',machine.produto);cells.set('I6',(demo?'Simulação':'Registros')+' · '+machine.id);
  if(demo)cells.set('F3','Informations: DADOS FICTÍCIOS · Coleta para demonstração · '+machine.id);
  for(let i=0;i<41;i++){
   const c=col(6+2*i),b=col(5+2*i),values=items.map(x=>x.values[i]).filter(Number.isFinite),n=values.length,lo=readCell(main,c+'10',shared),hi=readCell(main,c+'11',shared),valid=typeof lo==='number'&&typeof hi==='number'&&hi>lo;
   const min=n?Math.min(...values):null,max=n?Math.max(...values):null,mean=n?values.reduce((a,b)=>a+b,0)/n:null,sd=n?Math.sqrt(values.reduce((s,v)=>s+(v-mean)**2,0)/n):null,cp=n>1&&sd>0&&valid?(hi-lo)/(6*sd):'n.a.',cpk=typeof cp==='number'?Math.min((hi-mean)/(3*sd),(mean-lo)/(3*sd)):'n.a.',objective=readCell(main,'U6',shared);
   [min,max,mean,sd,cp,cpk,typeof cpk==='number'&&typeof objective==='number'?(cpk>=objective?'OK':'NOK'):'n.a.'].forEach((v,j)=>cache(c+(69+extra+j),v));
   const high=valid?hi:min===max?max+.5:max,low=valid?lo:min===max?min-.5:min,bins=[];
   for(let r=78;r<=90;r++){const threshold=n?high-(high-low)/8*(r-80):null;bins.push(threshold);cache(b+(r+extra),threshold);}
   const counts=Array.from({length:12},(_,j)=>n?values.filter(v=>v>=bins[j+1]&&v<bins[j]).length:0),peak=Math.max(...counts);
   counts.forEach((v,j)=>{cache(c+(98+extra+j),v);cache(c+(79+extra+j),peak?'█'.repeat(Math.floor(v/peak*10)):'');});cache(c+(110+extra),peak);
  }
  let chosen=MSA.capability.fields.findIndex((_,i)=>items.filter(x=>Number.isFinite(x.values[i])).length>=2);if(chosen<0)chosen=MSA.capability.fields.findIndex((_,i)=>items.some(x=>Number.isFinite(x.values[i])));if(chosen<0)chosen=0;
  const label=readCell(main,col(6+chosen*2)+'9',shared),n=normality(items.map(x=>x.values[chosen])),nc=new Map(),ncache=(ref,v)=>nc.set(ref,{cache:v??''});nc.set('B3',label);ncache('Z3',1+chosen*2);ncache('AE6',n.n);ncache('B5',n.mean);ncache('B6',n.sd);ncache('K5',n.a2);ncache('H5',n.adjusted);ncache('H7',n.adjusted===null?'':n.adjusted>.752?' There is no normality ':'There is normality');
  let running=0;for(let r=10;r<=capacity+9;r++){
   const i=r-10,ready=i<n.prob.length;running+=ready?n.terms[i]:0;
   const values={B:n.sorted[i],Z:ready?(n.sorted[i]-n.mean)/n.sd:null,AA:n.prob[i],AB:ready?Math.log(n.prob[i]):null,AC:ready?n.prob[n.n-1-i]:null,AD:ready?Math.log(1-n.prob[n.n-1-i]):null,AE:n.terms[i],AF:ready?running-n.n:null};
   for(const[c,v]of Object.entries(values))ncache(c+r,v);
  }
  cache('A'+(93+extra),'Result of Normality test: '+label);cache('G'+(93+extra),n.adjusted===null?'n.a.':n.adjusted>.752?'NOK':'OK');
  put(mainPath,patchCells(main,cells));put(normalPath,patchCells(normal,nc));
  if(extra){for(const name of ['xl/drawings/drawing1.xml','xl/drawings/vmlDrawing1.vml','xl/comments1.xml'])if(result.has(name)){
   let x=get(name);if(name.endsWith('comments1.xml'))x=x.replace(/\bref="([A-Z]+)(\d+)"/g,(w,c,r)=>Number(r)>=68?'ref="'+c+(Number(r)+extra)+'"':w);
   else x=x.replace(/(<(?:\w+:)?row>)(\d+)(<\/(?:\w+:)?row>)/g,(w,a,r,b)=>Number(r)>=67?a+(Number(r)+extra)+b:w);put(name,x);
  }}
  put('xl/workbook.xml',get('xl/workbook.xml').replace(/<calcPr\b[^>]*(?:\/>|>[\s\S]*?<\/calcPr>)/,'<calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>'));
  return zip(result);
 }
 let loaded;
 async function files(data,{from='',to=''}={}){
  if(!data.items.length)return[];
  if(!loaded)loaded=fetch(modelUrl).then(async r=>{if(!r.ok)throw new Error('Não foi possível carregar o modelo Excel. Tente novamente.');return unzip(await r.arrayBuffer());}).catch(e=>{loaded=null;throw e;});
  const parts=await loaded,groups=new Map();for(const x of data.items){if(!groups.has(x.machine.id))groups.set(x.machine.id,[]);groups.get(x.machine.id).push(x);}
  return [...groups].map(([id,items])=>({filename:`MSA-Estudo-Capacidade-Selo-VGard-${id.replace(/[^a-z0-9_-]/gi,'_')}-${from}-${to}.xlsx`,blob:fill(parts,items)}));
 }
 MSA.capabilityExcel=Object.freeze({files});
})();
