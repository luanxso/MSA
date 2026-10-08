import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const template=readFileSync('dist/templates/MSA-Estudo-Capacidade-Selo-VGard.xlsx');
function fixture(fetcher){
 const c=vm.createContext({Date,console,Blob,TextEncoder,TextDecoder,fetch:fetcher||(async()=>({ok:true,arrayBuffer:async()=>template.buffer.slice(template.byteOffset,template.byteOffset+template.length)}))});c.window=c;
 for(const name of ['capability-export','capability-excel'])vm.runInContext(readFileSync('dist/assets/'+name+'.js','utf8'),c);
 return c.MSA.capabilityExcel;
}
const machine={id:'SEL-01',setorId:'selagem',produto:'Selo V-Gard HP'};
const at=new Date(2026,9,8,14,30,15).getTime();
const item=(i,values=[])=>({machine,record:{data:at+i*30000,lote:'LOTE-'+i},material:'ABS',thickness:.5,scrap:2.64,values:Array.from({length:41},(_,j)=>values[j]??null),origin:'Registro manual'});
const query=String.raw`import sys,json,zipfile,io,posixpath as P,xml.etree.ElementTree as E
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
relationship_ns='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as z:
 assert z.testzip() is None
 names=set(z.namelist())
 for name in z.namelist():
  if not name.endswith(('.xml','.rels')):continue
  tree=E.fromstring(z.read(name))
  if name.endswith('.rels'):
   base=P.dirname(P.dirname(name))
   for rel in tree:
    if rel.get('TargetMode')=='External':continue
    target=rel.get('Target','');target=P.normpath(P.join(base,target)).lstrip('/')
    assert target in names,(name,'missing target',target)
  else:
   refs={v for node in tree.iter() for k,v in node.attrib.items() if k.startswith('{'+relationship_ns+'}')}
   rel_path=P.join(P.dirname(name),'_rels',P.basename(name)+'.rels')
   ids={r.get('Id') for r in E.fromstring(z.read(rel_path))} if rel_path in names else set()
   assert refs<=ids,(name,'dangling relationship',refs-ids)
 ss=[''.join(n.itertext()) for n in E.fromstring(z.read('xl/sharedStrings.xml'))]
 sheets=[]
 for name in ['sheet1.xml','sheet2.xml']:
  t=E.fromstring(z.read('xl/worksheets/'+name));cells={}
  for c in t.findall('.//m:sheetData/m:row/m:c',ns):
   v=c.find('m:v',ns);f=c.find('m:f',ns);kind=c.get('t');value=None if v is None else v.text
   if kind=='s':value=ss[int(value)]
   elif kind=='inlineStr':value=''.join(c.find('m:is',ns).itertext())
   elif kind not in ['str','e'] and value is not None:value=float(value)
   cells[c.get('r')]={'v':value,'f':None if f is None else f.text,'s':c.get('s'),'t':kind}
  sheets.append({'cells':cells,'merges':[m.get('ref') for m in t.findall('m:mergeCells/m:mergeCell',ns)],'cf':[n.get('sqref') for n in t.findall('m:conditionalFormatting',ns)],'rows':[int(r.get('r')) for r in t.findall('m:sheetData/m:row',ns)]})
 book=E.fromstring(z.read('xl/workbook.xml'));styles=E.fromstring(z.read('xl/styles.xml'));fmts={n.get('numFmtId'):n.get('formatCode') for n in styles.findall('m:numFmts/m:numFmt',ns)}
 comments=E.fromstring(z.read('xl/comments1.xml'))
 print(json.dumps({'sheets':sheets,'names':[n.get('name') for n in book.findall('m:sheets/m:sheet',ns)],'calc':book.find('m:calcPr',ns).attrib,'formats':[fmts.get(n.get('numFmtId'),n.get('numFmtId')) for n in styles.find('m:cellXfs',ns)],'parts':z.namelist(),'comments':{c.get('ref'):''.join(c.find('m:text',ns).itertext()) for c in comments.findall('m:commentList/m:comment',ns)},'commentXml':z.read('xl/comments1.xml').decode()}))`;
async function inspect(file){return JSON.parse(execFileSync('python3',['-c',query],{input:Buffer.from(await file.blob.arrayBuffer()),maxBuffer:15*1024*1024}));}
test('modelo antigo com referência quebrada é exportado com comentários nativos preservados',async()=>{
 const legacy=execFileSync('python3',['-c',String.raw`import sys,io,zipfile
with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as source:
 out=io.BytesIO()
 with zipfile.ZipFile(out,'w',zipfile.ZIP_STORED) as z:
  for name in source.namelist():
   data=source.read(name)
   if name=='xl/comments1.xml':
    xml=data.decode();xml=xml.replace('</comments>','<extLst><ext uri="GoogleSheetsCustomDataVersion2"><go:sheetsCustomData xmlns:go="http://customooxmlschemas.google.com/" r:id="rId999"/></ext><ext uri="NativeTest"><extra xmlns="urn:test"/></ext></extLst></comments>');data=xml.encode()
   z.writestr(name,data)
 sys.stdout.buffer.write(out.getvalue())`],{input:template,maxBuffer:4*1024*1024});
 const [file]=await fixture(async()=>({ok:true,arrayBuffer:async()=>legacy.buffer.slice(legacy.byteOffset,legacy.byteOffset+legacy.length)})).files({items:[item(0,[20])]});
 const result=await inspect(file);assert(!result.commentXml.includes('GoogleSheets'));assert(result.commentXml.includes('NativeTest'));
 assert.match(result.comments.A93,/Test the normality/);assert.match(result.comments.A21,/Sistema de desbobinador/);
 const [expanded]=await fixture().files({items:Array.from({length:60},(_,i)=>item(i,[20+i]))});const shifted=await inspect(expanded);
 assert.equal(shifted.comments.A102,result.comments.A93);assert.equal(shifted.comments.A21,result.comments.A21);
});
test('XLSX original mantém layout, células tipadas, fórmulas e dados faltantes',async()=>{
 const values=Array(41).fill(null);values[0]=0;values[2]=258;values[39]=6.6;values[40]=-550;
 const x=item(0,values);x.material='=SOMA(1;2) "literal"';x.record.lote='123';
 const [file]=await fixture().files({items:[x]},{from:'2026-10-08',to:'2026-10-08'});assert.match(file.filename,/SEL-01.*\.xlsx$/);
 const result=await inspect(file),a=result.sheets[0].cells,b=result.sheets[1].cells;
 assert.deepEqual(result.names,['Selo ','Normality test ']);assert.equal(a.A1.v,'MSA - Capability study -  Parâmetros de Processo Selo V-Gard');assert(result.sheets[0].merges.includes('A1:X1'));
 assert.equal(a.B17.v,x.material);assert.equal(a.B17.t,'inlineStr');assert.equal(a.B17.f,null);assert.equal(a.C17.v,.5);assert.equal(a.D17.v,.0264);assert.equal(a.E17.v,'123');assert.equal(a.E17.t,'inlineStr');
 assert.equal(a.F17.v,0);assert.equal(a.H17.v,null);assert.equal(a.J17.v,258);assert.equal(a.CF17.v,6.6);assert.equal(a.CH17.v,-550);assert.equal(a.G17.v,null);assert.equal(a.F18.v,null);assert.equal(a.F33.v,null);
 assert.equal(result.formats[a.C17.s],'0.000');assert.equal(result.formats[a.D17.s],'0.00%');assert.equal(result.formats[a.A17.s],'dd/mm/yyyy');assert.equal(result.formats[a.E17.s],'@');
 assert(Math.abs(a.A17.v-(Date.UTC(2026,9,8,14,30,15)/86400000+25569))<1e-9);
 assert.match(a.F69.f,/COUNT\(F\$17:F\$67\)/);assert.equal(a.F69.v,0);assert.equal(a.H69.v,null);assert.equal(a.F74.v,'n.a.');assert.equal(a.G93.v,'n.a.');assert.match(b.K5.f,/SUM\(\$AE\$10:\$AE\$1009\)-\$AE\$6/);assert.match(b.AC10.f,/INDEX/);assert.equal(b.K5.v,null);
 assert.equal(result.calc.fullCalcOnLoad,'1');assert(result.parts.includes('xl/drawings/drawing1.xml'));assert(result.parts.includes('xl/media/image1.png'));assert(!result.sheets[0].merges.includes('D19:D20'));
});
test('mais de 51 leituras ampliam coleta, cálculos e referências sem perder registros',async()=>{
 const xs=Array.from({length:60},(_,i)=>{const vals=Array(41).fill(null);vals[0]=20+i/100;vals[2]=258+i/100;return item(i,vals);});xs[0].values[0]=null;
 const [file]=await fixture().files({items:xs}),r=await inspect(file),a=r.sheets[0].cells,b=r.sheets[1].cells;
 assert.equal(a.F17.v,null);assert.equal(a.F76.v,20.59);assert.equal(a.E76.v,'LOTE-59');assert.equal(a.F78.v,20.01);assert.match(a.F78.f,/F\$17:F\$76/);assert(Math.abs(a.F80.v-20.3)<1e-10);assert.equal(a.G102.f,"IF('Normality test '!H5=\"\",\"n.a.\",IF('Normality test '!H5>0.752,\"NOK\",\"OK\"))");
 assert.match(b.B10.f,/ADDRESS\(76,/);assert.match(a.F88.f,/F\$119/);assert.match(a.F107.f,/F\$17:F\$76/);assert(r.sheets[0].merges.includes('A102:F102'));assert.equal(b.AE6.v,59);assert.equal(b.B10.v,20.01);assert.equal(b.B68.v,20.59);assert.equal(b.B69.v,null);
 assert.equal(r.sheets[0].rows.length,new Set(r.sheets[0].rows).size);assert(r.sheets[0].cf.some(s=>s.includes('F17:F76')));
});
test('mais de 1000 leituras também ampliam o teste de normalidade',async()=>{
 const xs=Array.from({length:1002},(_,i)=>item(i,[20+Math.sin(i)]));
 const [file]=await fixture().files({items:xs}),r=await inspect(file),a=r.sheets[0].cells,b=r.sheets[1].cells;
 assert.equal(a.E1018.v,'LOTE-1001');assert.equal(b.AE6.v,1002);assert.equal(b.A1011.v,1002);assert.equal(b.B1011.v,Math.max(...xs.map(x=>x.values[0])));assert.match(b.B1011.f,/A1011/);assert.match(b.B1011.f,/ADDRESS\(1018,/);assert.match(b.AC1009.f,/\$AA\$1011/);assert.match(b.AC1009.f,/A1009/);assert.match(b.K5.f,/\$AE\$1011/);assert.equal(r.sheets[1].rows.length,new Set(r.sheets[1].rows).size);assert.deepEqual(r.sheets[1].rows,[...r.sheets[1].rows].sort((a,b)=>a-b));
});
test('normalidade recalculada usa amostra ordenada e resultado atual, sem OK fixo',async()=>{
 const xs=[20,21,23,24].map((v,i)=>item(i,[v]));const api=fixture();
 const [one]=await api.files({items:xs}),r=await inspect(one),a=r.sheets[0].cells,b=r.sheets[1].cells;
 assert.equal(b.B5.v,22);assert(Math.abs(b.B6.v-Math.sqrt(10/3))<1e-12);assert(b.H5.v>0);assert.equal(a.G93.v,b.H5.v>.752?'NOK':'OK');assert.equal(b.AC10.v,b.AA13.v);
 const before=b.H5.v;xs[3].values[0]=40;const [two]=await api.files({items:xs}),after=(await inspect(two)).sheets[1].cells;assert.notEqual(after.H5.v,before);assert.equal(after.B5.v,26);
 assert(Math.abs(b.H5.v-.2912816832709919)<1e-6);assert(Math.abs(after.H5.v-.7834058299753729)<1e-6);
});
test('máquinas diferentes geram estudos separados e erro ao carregar modelo permite tentar novamente',async()=>{
 let attempts=0;const api=fixture(async()=>{attempts++;if(attempts===1)return{ok:false};return{ok:true,arrayBuffer:async()=>template.buffer.slice(template.byteOffset,template.byteOffset+template.length)};});
 const xs=[item(0,[20]),{...item(1,[21]),machine:{...machine,id:'SEL-OUTRA'}}];await assert.rejects(api.files({items:xs}),/carregar o modelo/);
 const files=await api.files({items:xs});assert.equal(files.length,2);assert.equal(attempts,2);assert.equal((await inspect(files[1])).sheets[0].cells.F17.v,21);await api.files({items:xs});assert.equal(attempts,2);assert.equal((await api.files({items:[]})).length,0);
});
test('Excel exporta as amostras guardadas no cenário e não cria novas medições ao baixar',async()=>{
 const c=vm.createContext({Date,console,Blob,TextEncoder,TextDecoder,fetch:async()=>({ok:true,arrayBuffer:async()=>template.buffer.slice(template.byteOffset,template.byteOffset+template.length)})});c.window=c;
 for(const name of ['config','plant-layout','shifts','capability-export','capability-excel','scenario-parameters','scenario-data'])vm.runInContext(readFileSync('dist/assets/'+name+'.js','utf8'),c);
 const api=c.MSA,state=api.createScenario(at),machines=state.maquinas.filter(api.capability.compatible);
 api.scenarioParameters.advance(state,()=>1);state.scenarioAt+=30000;api.scenarioParameters.advance(state,()=>1);
 const data=api.capability.build(state,machines,state.leituras,state.registrosProducao,state.perdas),saved=JSON.stringify(state),[first]=await api.capabilityExcel.files(data),[second]=await api.capabilityExcel.files(data),result=await inspect(first),cells=result.sheets[0].cells;
 assert.equal(JSON.stringify(state),saved);assert(Buffer.from(await first.blob.arrayBuffer()).equals(Buffer.from(await second.blob.arrayBuffer())));
 const column=n=>{let s='';for(;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
 for(let i=0;i<data.items.length;i++){
  const x=data.items[i],r=i+17;assert.equal(cells['E'+r].v,x.record.lote);assert.equal(cells['B'+r].v,x.material);assert.equal(cells['C'+r].v,x.thickness);assert.equal(cells['D'+r].v,x.scrap===null?null:x.scrap/100);
  for(let j=0;j<41;j++)assert.equal(cells[column(6+2*j)+r].v,x.record.estudoSelo.valores[api.capability.fields[j].key]);
  assert.equal(x.values[39],x.record.valores.pressao);assert.equal(x.values[40],x.record.valores.vacuo);
 }
 assert(!data.items.some(x=>x.record.id.startsWith('exemplo-leitura-ativa-')));
});
