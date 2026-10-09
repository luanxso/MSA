import test from 'node:test';
import assert from 'node:assert/strict';
import {startEmulator,api,profile} from './emulator-fixture.mjs';
test('Firebase recebe foto parcial no escopo e recusa evidencia inválida ou outro operador', {skip:!process.env.MSA_DATABASE_EMULATOR_JAR}, async t=>{
 const e=await startEmulator(process.env.MSA_DATABASE_EMULATOR_JAR);t.after(e.close);
 const machine={nome:'Selagem',setorId:'selagem',parametros:{pressao:{nome:'Pressão',unidade:'bar',min:6.5,max:7}}};
 await api(e.base,'','owner','PUT',{perfis:{op:profile('operador','selagem','SEL-01'),outside:profile('operador','injecao','INJ-01')},maquinas:{'SEL-01':machine}});
 const at=Date.now(),row={setorId:'selagem',maquinaId:'SEL-01',usuarioId:'op',usuarioRe:'1',createdAt:at,updatedAt:at,atualizadoPor:'op',verificado:false,observacao:'Foto',data:at,lote:'LT-01',valores:{pressao:6.6},origem:'foto',turno:'1',fotoProcesso:{parametro:'pressao',imagem:'data:image/jpeg;base64,YQ==',capturadaEm:at,metodo:'ponteiro-local',unidade:'bar',escala:'0 a 14 kgf/cm²',extraido:6.6}};
 assert.equal((await api(e.base,'leituras/foto1','op','PUT',row)).status,200);
 assert.equal((await api(e.base,'leituras/foto2','outside','PUT',row)).status,401);
 assert.equal((await api(e.base,'leituras/foto3','op','PUT',{...row,fotoProcesso:{...row.fotoProcesso,imagem:'javascript:bad'}})).status,401);
 assert.equal((await api(e.base,'leituras/foto4','op','PUT',{...row,fotoProcesso:{...row.fotoProcesso,unidade:'psi'}})).status,401);
 assert.equal((await api(e.base,'leituras/foto5','op','PUT',{...row,fotoProcesso:{...row.fotoProcesso,parametro:'temperatura'}})).status,401);
 assert.equal((await api(e.base,'leituras/ocr1','op','PUT',{...row,fotoProcesso:{...row.fotoProcesso,metodo:'ocr-local',confianca:92}})).status,200);
 assert.equal((await api(e.base,'leituras/ocr2','op','PUT',{...row,fotoProcesso:{...row.fotoProcesso,metodo:'ocr-local',confianca:101}})).status,401);
 assert.equal((await api(e.base,'leituras/exemplo','op','PUT',{...row,fotoProcesso:{...row.fotoProcesso,exemplo:true}})).status,401);
});
