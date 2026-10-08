import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
const context=vm.createContext({});context.window=context;
for(const file of ['config','rbac','metrics'])vm.runInContext(readFileSync(new URL(`../dist/assets/${file}.js`,import.meta.url),'utf8'),context);
const user=cargo=>({id:'a',cargo,status:'ativo',setorId:'montagem',maquinaId:'ABF-01'});
test('rotas e ações exclusivas não são liberadas por outro cargo',()=>{
 const {rbac}=context.MSA;
 assert.equal(rbac.route('apontamentos',user('operador')),true);
 assert.equal(rbac.route('indicadores',user('operador')),false);
 assert.equal(rbac.route('conferencia',user('chefe')),false);
 assert.equal(rbac.route('funcionarios',user('operador')),false);
 assert.equal(rbac.route('nao-existe',user('chefe')),false);
 assert.equal(rbac.can('producao:registrar',user('chefe')),false);
 assert.equal(rbac.can('registros:verificar',user('operador')),false);
 assert.equal(rbac.can('chat:usar',{...user('operador'),status:'bloqueado'}),false);
});
test('Operador lê sua máquina e edita somente os registros próprios; Supervisor usa seu setor',()=>{
 const {rbac}=context.MSA;const record={maquinaId:'ABF-01',setorId:'montagem',usuarioId:'b'};
 assert.equal(rbac.inScope(user('operador'),record),true);
 assert.equal(rbac.can('producao:registrar',user('operador'),record),false);
 assert.equal(rbac.can('producao:registrar',user('operador'),{...record,usuarioId:'a'}),true);
 assert.equal(rbac.inScope(user('operador'),{...record,maquinaId:'ABF-02'}),false);
 assert.equal(rbac.can('registros:verificar',user('supervisor'),record),true);
 assert.equal(rbac.can('registros:verificar',user('supervisor'),{...record,setorId:'injecao'}),false);
 assert.throws(()=>rbac.require('producao:registrar',user('chefe')),e=>e.code==='ACCESS_DENIED');
});
test('indicadores não somam kg com peças nem contam paradas sobrepostas duas vezes',()=>{
 const state={registrosProducao:[{maquinaId:'ABF-01',inicio:1000,fim:120000,quantidade:100}],perdas:[{maquinaId:'ABF-01',data:120000,tipo:'refugo',quantidade:10},{maquinaId:'ABF-01',data:120000,tipo:'perda',quantidade:2.5},{maquinaId:'ABF-01',data:120000,tipo:'suspeito',quantidade:3}],paradas:[{maquinaId:'ABF-01',inicio:60000,fim:180000},{maquinaId:'ABF-01',inicio:120000,fim:240000}]};
 const s=context.MSA.metrics.summarize(state,[{id:'ABF-01',metaDiaria:200}],0,86400000);
 assert.equal(s.aprovadas,100);assert.equal(s.refugos,10);assert.equal(s.kg,2.5);assert.equal(s.suspeitas,3);assert.equal(s.minutos,3);assert.equal(s.atendimento,50);assert.equal(s.taxaRefugo,10/110*100);
 assert.equal(context.MSA.metrics.minutes([{maquinaId:'a',inicio:60000,fim:0}],120000,600000,240000),2);
});
test('entradas carregam dependências existentes e nenhum modo local substitui o Firebase',()=>{
 for(const page of ['index','login','cadastro','acesso','sistema']){
  const html=readFileSync(new URL(`../dist/${page}.html`,import.meta.url),'utf8');
  const scripts=[...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)].map(m=>m[1].split('?')[0]);
  assert(!scripts.some(s=>s.includes('demo-')));
  for(const src of scripts)assert(existsSync(new URL(`../dist/${src}`,import.meta.url)),src);
  assert(scripts.indexOf('assets/rbac.js')>scripts.indexOf('assets/config.js'));
  if(page==='sistema')assert(scripts.indexOf('assets/capability-export.js')<scripts.indexOf('assets/scenario-data.js'));
 }
});
