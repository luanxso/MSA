import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

function storage() {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
}
function fixture({ page = 'login', enabled = true, local = storage(), session = storage() } = {}) {
  let externalCalls = 0;
  const context = vm.createContext({
    document: { body: { dataset: { page } } }, localStorage: local, sessionStorage: session,
    URL, DOMException, setTimeout, clearTimeout, TextEncoder, crypto: webcrypto,
    fetch() { externalCalls++; throw new Error('A apresentação não deve acessar a rede.'); },
  });
  context.window = context;
  const run = file => vm.runInContext(readFileSync(new URL(`../dist/${file}`, import.meta.url), 'utf8'), context);
  run('assets/config.js');
  context.MSA.config = { ...context.MSA.config, presentation: { ...context.MSA.config.presentation, enabled } };
  run('assets/validation.js');
  context.MSA.firebase = { ready() { externalCalls++; throw new Error('A apresentação não deve inicializar o Firebase.'); } };
  run('assets/auth-service.js');
  run('assets/demo-service.js');
  return { context, auth: context.MSA.auth, demo: context.MSA.presentation, local, session, run, externalCalls: () => externalCalls };
}
const send = (demo, conversation, body, key) => demo.chatRequest('messages', { method: 'POST', body: JSON.stringify({ conversation, body, client_key: key }) });
const thread = (demo, person) => demo.chatRequest('threads', { method: 'POST', body: JSON.stringify({ person_id: person }) });

const signup = (auth, re, cargo, nome = 'Pessoa') => auth.register({ nome, re, cargo, senha: '123' });
const signin = (auth, re) => auth.login({ re, senha: '123' });

test('os seis cargos usam RE e senha simples, com cadastro já liberado e sem Firebase', async () => {
  const f = fixture();
  assert.equal(await f.auth.ready(), null);
  for (const [index, role] of f.context.MSA.config.roles.entries()) {
    const re = String(index + 1);
    const registered = await signup(f.auth, re, role.id);
    assert.equal(registered.status, 'ativo');
    await f.auth.logout();
    const user = await signin(f.auth, re);
    assert.equal(user.isDemo, true);
    assert.equal(f.auth.role(user).id, role.id);
    assert.equal(f.auth.home(user), `sistema.html#${role.home}`);
    assert.equal(f.auth.can('relatorios:ler', user), true);
  }
  assert.equal(f.externalCalls(), 0);
});

test('cadastro aceita nome simples e senha curta, preserva zeros e não exige confirmação', async () => {
  const f = fixture();
  const user = await f.auth.register({ nome: 'Dani', cargo: 'operador', re: '001', senha: 'a' });
  assert.equal(user.re, '001');
  assert.equal(user.status, 'ativo');
  assert.equal(f.auth.session().nome, 'Dani');
  assert.equal(f.auth.consumeRegistrationRE(), '001');
  assert.equal(f.auth.consumeRegistrationRE(), '');
  const stored = JSON.parse(f.local.values.get('msa.presentation.accounts.v2'))[0];
  assert.equal(stored.passwordHash.length, 64);
  assert.equal('senha' in stored, false);
  assert.equal('senha' in stored.user, false);
  await f.auth.logout();
  assert.equal((await f.auth.login({ re: '001', senha: 'a' })).nome, 'Dani');
  await assert.rejects(f.auth.register({ nome: 'Outra', cargo: 'gestor', re: '001', senha: 'b' }), error => error.field === 're');
  await assert.rejects(f.auth.register({ nome: '', cargo: 'gestor', re: '2', senha: 'a' }), error => error.field === 'nome');
  assert.equal(f.externalCalls(), 0);
});

test('login exige o RE e a senha cadastrados; não entra apenas por cargo', async () => {
  const f = fixture();
  await signup(f.auth, '12', 'supervisor');
  await f.auth.logout();
  await assert.rejects(f.auth.login({ re: '12', senha: 'errada' }), error => error.field === 'senha');
  assert.equal(f.auth.session(), null);
  await assert.rejects(f.auth.login({ re: '13', senha: '123' }), error => error.field === 'senha');
  await assert.rejects(f.auth.login({ cargo: 'supervisor' }), error => error.field === 're');
  assert.equal(f.externalCalls(), 0);
});

test('abrir o sistema ou a tela de liberação sem sessão mantém o login obrigatório', async () => {
  for (const page of ['sistema', 'acesso']) {
    const f = fixture({ page });
    assert.equal(await f.auth.ready(), null);
    assert.equal(f.auth.home(), 'index.html');
    assert.equal(f.externalCalls(), 0);
  }
});

test('cadastro e sessão atravessam as páginas; Sair permite retornar com RE e senha', async () => {
  const local = storage(), session = storage();
  const login = fixture({ local, session });
  await signup(login.auth, '0123', 'gestor', 'Luan');
  const menu = fixture({ page: 'sistema', local, session });
  assert.equal((await menu.auth.ready()).nome, 'Luan');
  const changes = [];
  const stop = await menu.auth.watch(user => changes.push(user));
  await menu.auth.logout();
  assert.equal(changes.at(-1), null);
  stop();
  const next = fixture({ local, session });
  assert.equal(await next.auth.ready(), null);
  assert.equal((await next.auth.login({ re: '0123', senha: '123', remember: true })).cargo, 'gestor');
  assert.equal(next.auth.rememberedRE(), '0123');
  await assert.rejects(next.auth.token(), error => error.code === 'DEMO_ONLY');
});

test('chat local mantém autoria, envio único e conversa entre dois cadastros', async () => {
  const f = fixture();
  const supervisor = await signup(f.auth, '1', 'supervisor', 'Supervisora');
  const operador = await signup(f.auth, '2', 'operador', 'Operador');
  const qualidade = await signup(f.auth, '3', 'qualidade', 'Qualidade');
  await signin(f.auth, '1');
  const first = await f.demo.chatRequest('bootstrap');
  assert.equal(first.rooms.length, 7);
  assert.equal(first.people.length, 2);
  assert.equal('passwordHash' in first.people[0], false);
  assert.equal((await f.demo.chatRequest('messages?conversation=sector:producao')).messages.length, 0);
  const direct = await thread(f.demo, operador.id);
  const result = await send(f.demo, direct.id, 'Mensagem para a apresentação.', 'test-send');
  assert.equal(result.message.sender_id, supervisor.id);
  assert.equal((await send(f.demo, direct.id, 'Mensagem para a apresentação.', 'test-send')).message.id, result.message.id);
  await f.auth.logout();
  await assert.rejects(f.demo.chatRequest('bootstrap'), error => error.status === 401);
  await signin(f.auth, '2');
  assert.equal((await thread(f.demo, supervisor.id)).id, direct.id);
  const history = await f.demo.chatRequest(`messages?conversation=${encodeURIComponent(direct.id)}`);
  assert.equal(history.messages.length, 1);
  assert.equal(history.messages[0].sender_name, 'Supervisora');
  await send(f.demo, direct.id, 'Resposta do operador.', 'test-reply');
  await signin(f.auth, qualidade.re);
  await assert.rejects(f.demo.chatRequest(`messages?conversation=${encodeURIComponent(direct.id)}`), error => error.status === 404);
  assert.equal(f.externalCalls(), 0);
});

test('mensagens locais persistem ao recarregar e aceitam os cursores do chat', async () => {
  const local = storage(), session = storage();
  const f = fixture({ local, session });
  await signup(f.auth, '1', 'manutencao');
  for (let index = 0; index < 51; index++) await send(f.demo, 'sector:manutencao', `Mensagem ${index}`, `message-${index}`);
  const reloaded = fixture({ page: 'sistema', local, session });
  const latest = await reloaded.demo.chatRequest('messages?conversation=sector:manutencao');
  assert.equal(latest.messages.length, 50);
  assert.equal(latest.has_more, true);
  const earlier = await reloaded.demo.chatRequest(`messages?conversation=sector:manutencao&before=${latest.messages[0].id}`);
  assert.equal(earlier.messages.length, 1);
  const after = await reloaded.demo.chatRequest('messages?conversation=sector:manutencao&after=50');
  assert.equal(after.messages.length, 1);
  assert.equal(after.messages[0].id, 51);
});

test('desativar a apresentação conserva o adaptador Firebase e não aceita perfis demo', () => {
  const f = fixture({ enabled: false });
  assert.equal(f.auth.mode, 'firebase');
  assert.equal(f.demo, undefined);
  assert.equal(f.auth.session(), null);
  assert.equal(f.externalCalls(), 0);
});

test('todas as entradas carregam a apresentação antes dos controladores', () => {
  for (const page of ['index.html', 'login.html', 'cadastro.html', 'acesso.html', 'sistema.html']) {
    const html = readFileSync(new URL(`../dist/${page}`, import.meta.url), 'utf8');
    const scripts = [...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)].map(match => match[1]);
    const service = scripts.indexOf('assets/demo-service.js');
    const ui = scripts.indexOf('assets/demo-ui.js');
    const controller = scripts.indexOf(page === 'sistema.html' ? 'js/system-guard.js' : 'assets/auth-ui.js');
    assert(service > scripts.indexOf('assets/auth-service.js'));
    assert(ui > service);
    assert(controller > ui);
    for (const src of scripts) assert(existsSync(new URL(`../dist/${src}`, import.meta.url)), src);
  }
});
