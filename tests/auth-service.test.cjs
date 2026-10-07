'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const valid = { nome: 'Funcionário de Teste', re: '001234', cargo: 'chefe', senha: '123456' };
const error = code => Object.assign(new Error(code), { code });
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
}
function fixture() {
  const accounts = new Map(), profiles = new Map(), authListeners = new Set(), profileListeners = new Map();
  const state = { enabled: true, denyRead: false, denyWrite: false, calls: 0, persistence: null, nextError: null };
  const auth = { currentUser: null, authStateReady: async () => {} };
  const notify = () => authListeners.forEach(callback => queueMicrotask(() => { if (authListeners.has(callback)) callback(auth.currentUser); }));
  const check = () => { state.calls++; if (state.nextError) { const code = state.nextError; state.nextError = null; throw error(code); } if (!state.enabled) throw error('auth/operation-not-allowed'); };
  const snapshot = target => ({ exists: () => profiles.has(target), val: () => profiles.has(target) ? { ...profiles.get(target) } : null });
  const client = {
    auth, database: {},
    authSDK: {
      browserLocalPersistence: 'local', browserSessionPersistence: 'session',
      setPersistence: async (_, type) => { state.persistence = type; },
      createUserWithEmailAndPassword: async (_, email, password) => {
        check();
        if (accounts.has(email)) throw error('auth/email-already-in-use');
        const user = { uid: `user-${accounts.size + 1}`, email, getIdToken: async () => 'firebase-test-id-token' };
        accounts.set(email, { user, password }); auth.currentUser = user; notify(); return { user };
      },
      signInWithEmailAndPassword: async (_, email, password) => {
        check();
        const account = accounts.get(email);
        if (!account || account.password !== password) throw error('auth/invalid-credential');
        auth.currentUser = account.user; notify(); return { user: account.user };
      },
      signOut: async () => { auth.currentUser = null; notify(); },
      onAuthStateChanged: (_, callback) => { authListeners.add(callback); queueMicrotask(() => { if (authListeners.has(callback)) callback(auth.currentUser); }); return () => authListeners.delete(callback); }
    },
    databaseSDK: {
      ref: (_, target) => target,
      get: async target => { if (state.denyRead) throw error('PERMISSION_DENIED'); return snapshot(target); },
      set: async (target, profile) => {
        if (state.denyWrite) throw error('PERMISSION_DENIED');
        profiles.set(target, { ...profile, createdAt: 1720000000000 });
      },
      update: async (target, patch) => { if (state.denyWrite) throw error('PERMISSION_DENIED'); profiles.set(target, {...profiles.get(target),...patch}); },
      serverTimestamp: () => ({ '.sv': 'timestamp' }),
      onValue: (target, callback) => {
        const listeners = profileListeners.get(target) || new Set(); profileListeners.set(target, listeners); listeners.add(callback);
        queueMicrotask(() => { if (listeners.has(callback)) callback(snapshot(target)); });
        return () => listeners.delete(callback);
      }
    }
  };
  const context = vm.createContext({ localStorage: storage(), sessionStorage: storage(), setTimeout, clearTimeout, TypeError });
  context.window = context;
  for (const name of ['config.js', 'rbac.js', 'validation.js']) vm.runInContext(fs.readFileSync(path.join(root, 'dist/assets', name), 'utf8'), context);
  context.MSA.firebase = { ready: async () => client };
  vm.runInContext(fs.readFileSync(path.join(root, 'dist/assets/auth-service.js'), 'utf8'), context);
  return {
    context, service: context.MSA.auth, config: context.MSA.config, state, accounts, profiles, client,
    patchProfile(uid, patch) {
      const target = `perfis/${uid}`;
      profiles.set(target, { ...profiles.get(target), ...patch });
      profileListeners.get(target)?.forEach(callback => callback(snapshot(target)));
    }
  };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('cadastro por RE preserva zeros e entra imediatamente pelo cargo escolhido', async () => {
  const f=fixture(), user=await f.service.register(valid);
  assert.equal(user.re,'001234');assert.equal(user.cargo,'chefe');assert.equal(user.status,'ativo');
  assert.equal(f.service.home(user),'sistema.html#visao-geral');
  assert.equal(f.service.can('relatorios:ler',user),true);
  assert.equal(f.service.can('producao:registrar',user),false);
  assert.equal(f.client.auth.currentUser.uid,user.id);
  assert.equal(f.service.session().id,user.id);
  assert.equal(f.profiles.get(`perfis/${user.id}`).setorId,'');
});

test('campos inválidos são rejeitados antes de criar conta ou consultar credenciais', async () => {
  const cases = [
    [{ ...valid, nome: '' }, 'nome'],
    [{ ...valid, re: 'AB1234' }, 're'], [{ ...valid, re: '12345678901' }, 're'],
    [{ ...valid, cargo: 'admin' }, 'cargo'], [{ ...valid, senha: 'fraca', confirmacao: 'fraca' }, 'senha'],
    [{ ...valid, nome: 'A'.repeat(121) }, 'nome']
  ];
  for (const [values, field] of cases) {
    const f = fixture();
    await assert.rejects(f.service.register(values), e => e.field === field);
    assert.equal(f.state.calls, 0);
    assert.equal(f.accounts.size, 0);
  }
});

test('Lembrar de mim controla persistência Firebase; autenticação não usa os dados locais antigos', async () => {
  const f = fixture();
  f.context.localStorage.setItem('msa.demo.users.v1', JSON.stringify([{ re: valid.re, cargo: 'gestor' }]));
  f.context.sessionStorage.setItem('msa.demo.session.v1', JSON.stringify({ user: { cargo: 'gestor' }, expires: Date.now() + 999999 }));
  assert.equal(await f.service.ready(), null);
  await f.service.register(valid);
  await f.service.login({ ...valid, remember: true });
  assert.equal(f.state.persistence, 'local');
  assert.equal(f.service.rememberedRE(), '001234');
  await f.service.logout();
  await f.service.login({ ...valid, remember: false });
  assert.equal(f.state.persistence, 'session');
  assert.equal(f.service.rememberedRE(), '');
  assert.equal((await f.service.ready()).re, '001234');
});

test('credenciais erradas e RE duplicado têm erro de campo e não deixam sessão aberta', async () => {
  const f = fixture();
  await f.service.register(valid);
  await assert.rejects(f.service.login({ re: valid.re, senha: 'SenhaErrada9' }), e => e.field === 'senha' && e.message.includes('RE ou senha incorretos'));
  assert.equal(f.client.auth.currentUser, null);
  await assert.rejects(f.service.register(valid), e => e.field === 're' && e.code === 'DUPLICATE_RE');
  assert.equal(f.profiles.size, 1);
  assert.equal(f.client.auth.currentUser, null);
});

test('cadastro incompleto pode ser retomado sem sobrescrever um perfil existente', async () => {
  const f = fixture();
  f.state.denyWrite = true;
  await assert.rejects(f.service.register(valid), e => e.code === 'permission_denied');
  assert.equal(f.accounts.size, 1);
  assert.equal(f.profiles.size, 0);
  assert.equal(f.client.auth.currentUser, null);
  await assert.rejects(f.service.login(valid), e => e.code === 'PROFILE_MISSING');
  f.state.denyWrite = false;
  const user = await f.service.register(valid);
  assert.equal(f.accounts.size, 1);
  assert.equal(f.profiles.size, 1);
  f.patchProfile(user.id, { status: 'ativo', cargo: 'operador' });
  await assert.rejects(f.service.register({ ...valid, cargo: 'chefe' }), e => e.code === 'DUPLICATE_RE');
  assert.equal(f.profiles.get(`perfis/${user.id}`).cargo, 'operador');
});

test('três cargos se cadastram sem setor ou máquina e recebem acesso imediato', async () => {
  const f=fixture();
  for(const [index,role] of f.config.roles.entries()) {
    const values={...valid,re:String(index+1),cargo:role.id};
    const user=await f.service.register(values);
    assert.equal(user.setorId,'');
    assert.equal(user.maquinaId,'');
    assert.equal(f.service.home(user),'sistema.html#visao-geral');
    assert.equal(f.service.role(user).id,role.id);
    assert.equal(f.service.home(user),`sistema.html#${role.home}`);
    for(const permission of role.permissions)assert.equal(f.service.can(permission,user),true);
    f.patchProfile(user.id,{status:'bloqueado'});
    const blocked=await f.service.ready();assert.equal(f.service.role(blocked),null);
  }
});

test('campos de lotação enviados por um cadastro antigo não prendem o novo funcionário', async () => {
  const f=fixture();
  const user=await f.service.register({...valid,cargo:'operador',setorId:'selagem',maquinaId:'INJ-01'});
  assert.equal(user.setorId,'');assert.equal(user.maquinaId,'');
  const uid=user.id;
  f.patchProfile(uid,{setorId:'montagem',maquinaId:'ABF-01'});
  await f.service.logout();
  assert.equal((await f.service.login(valid)).id,uid);
  f.patchProfile(uid,{setorId:'selagem',maquinaId:'SEL-01'});
  await f.service.logout();
  const current=await f.service.login(valid);
  assert.equal(current.id,uid);assert.equal(current.re,valid.re);
  assert.equal(current.setorId,'selagem');assert.equal(current.maquinaId,'SEL-01');
});

test('mudanças no perfil, bloqueio e logout atualizam o acesso observado', async () => {
  const f = fixture(), registered = await f.service.register(valid);
  await f.service.login(valid);
  const changes = [], errors = [];
  const stop = await f.service.watch(user => changes.push(user), e => errors.push(e));
  await flush();
  assert.equal(changes.at(-1).status, 'ativo');
  f.patchProfile(registered.id, { status: 'ativo', cargo: 'supervisor' });
  assert.equal(changes.at(-1).cargo, 'supervisor');
  f.patchProfile(registered.id, { status: 'bloqueado' });
  assert.equal(changes.at(-1).cargo, null);
  assert.equal(f.service.can('producao:ler'), false);
  await f.service.logout(); await flush();
  assert.equal(changes.at(-1), null);
  assert.equal(errors.length, 0);
  stop();
});

test('provedor não habilitado, falhas de rede, política de senha e banco negado geram feedback', async () => {
  const f = fixture();
  f.state.enabled = false;
  await assert.rejects(f.service.register(valid), e => e.message.includes('configurado'));
  f.state.enabled = true;
  for (const [code, fragment, field] of [
    ['auth/network-request-failed', 'conexão', undefined],
    ['auth/password-does-not-meet-requirements', 'senha', 'senha'],
    ['auth/too-many-requests', 'Muitas tentativas', undefined]
  ]) {
    f.state.nextError = code;
    await assert.rejects(f.service.register(valid), e => e.message.includes(fragment) && e.field === field);
  }
  await f.service.register(valid);
  f.state.denyRead = true;
  await assert.rejects(f.service.login(valid), e => e.code === 'permission_denied');
  assert.equal(f.service.session(), null);
  assert.equal(f.client.auth.currentUser, null);
});

test('perfil inconsistente com a identidade Firebase ou cargo desconhecido não libera acesso', async () => {
  const f = fixture(), user = await f.service.register(valid);
  f.patchProfile(user.id, { re: '9999' });
  await assert.rejects(f.service.login(valid), e => e.code === 'PROFILE_MISSING');
  f.patchProfile(user.id, { re: valid.re, status: 'ativo', cargo: 'admin' });
  await assert.rejects(f.service.login(valid), e => e.code === 'ROLE_INVALID');
  assert.equal(f.service.session(), null);
});

test('chat recebe o token da sessão Firebase e perde acesso após Sair', async () => {
  const f = fixture();
  await assert.rejects(f.service.token(), e => e.code === 'SESSION_REQUIRED');
  await f.service.register(valid);
  await f.service.login(valid);
  assert.equal(await f.service.token(), 'firebase-test-id-token');
  await f.service.logout();
  await assert.rejects(f.service.token(), e => e.code === 'SESSION_REQUIRED');
});

test('perfil legado gestor/pending vira chefe ativo sem alterar a identidade',async()=>{
 const f=fixture();const u=await f.service.register(valid);const target=`perfis/${u.id}`;
 f.profiles.set(target,{nome:valid.nome,re:valid.re,cargoSolicitado:'gestor',status:'pendente',createdAt:1720000000000});
 const current=await f.service.login(valid);assert.equal(current.cargo,'chefe');assert.equal(current.setorId,'');
});
