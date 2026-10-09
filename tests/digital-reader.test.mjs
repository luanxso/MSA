import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const c=vm.createContext({URL,document:{baseURI:'http://localhost/sistema.html'}});c.window=c;
for(const file of ['gauge-reader','digital-reader'])vm.runInContext(readFileSync('dist/assets/'+file+'.js','utf8'),c);
const reader=c.MSA.digitalReader;
test('OCR exige um único número, confiança suficiente e unidade compatível',()=>{
 assert.equal(reader.parse('180,5 °C\n',92,'°C'),180.5);assert.equal(reader.parse('−380 mmHg',85,'mmHg'),-380);assert.equal(reader.parse('6.70 bar',90,'bar'),6.7);
 for(const text of ['180 245','180\n245','Zona 1 180','180.500,2','180.5.0','garbage',''])assert.throws(()=>reader.parse(text,95,'°C'));
 assert.throws(()=>reader.parse('180',74,'°C'),/confiança/);assert.throws(()=>reader.parse('180',NaN,'°C'),/confiança/);assert.throws(()=>reader.parse('180 °F',99,'°C'),/unidade/);
});
test('OCR converte unidades sem usar limites de processo',()=>{
 assert.equal(reader.convert(212,'°F','°C'),100);assert.equal(reader.convert(100,'°C','°F'),212);assert(Math.abs(reader.convert(7,'kgf/cm²','bar')-6.864655)<1e-8);assert.throws(()=>reader.convert(200,'°C','bar'),/incompatíveis/);
});
