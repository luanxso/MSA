import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const active = { id: 'firebase-user', nome: 'Ana Silva', re: '001234', status: 'ativo', cargo: 'supervisor' };
const source = readFileSync(new URL('../dist/js/system-guard.js', import.meta.url), 'utf8');
const flush = () => new Promise((resolve) => setImmediate(resolve));

function fixture(initialUser = active) {
  const elements = new Map();
  for (const selector of ['#system-shell', '#session-screen', '#session-actions', '#system-logout', '#session-title', '#session-description', '.user-name', '#header-user-role', '#header-user-re', '.user-avatar', '.user-profile', '#session-retry']) {
    elements.set(selector, { hidden: selector !== '#session-screen', inert: false, disabled: false, textContent: '', attributes: {}, listeners: new Map(), setAttribute(name, value) { this.attributes[name] = value; }, addEventListener(name, listener) { this.listeners.set(name, listener); } });
  }
  const state = { user: initialUser, error: null, redirects: [], logoutCalls: 0, hideCalls: 0, clearCalls: 0, watcher: null, stopped: 0 };
  const events = new Map();
  const context = vm.createContext({
    document: { querySelector: (selector) => { assert(elements.has(selector), selector); return elements.get(selector); } },
    location: { replace: (path) => state.redirects.push(path) },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    addEventListener(type, listener) { events.set(type, listener); },
    dispatchEvent(event) { events.get(event.type)?.(event); },
    MSAChat: { hide: () => state.hideCalls++, clear: () => state.clearCalls++ },
    MSA: { auth: {
      ready: async () => { if (state.error) throw state.error; return state.user; },
      role: (user) => user?.status === 'ativo' && user.cargo === 'supervisor' ? { label: 'Supervisor' } : null,
      watch: async (listener) => { state.watcher = listener; return () => { state.stopped++; }; },
      logout: async () => { state.logoutCalls++; state.user = null; },
    } },
  });
  context.window = context;
  vm.runInContext(source, context);
  return { state, context, elements, events };
}

test('abrir o menu sem sessão mantém a tela protegida oculta e volta ao login', async () => {
  const f = fixture(null);
  assert.equal(await f.context.MSA.system.ready, null);
  assert.equal(f.elements.get('#system-shell').hidden, true);
  assert.deepEqual(f.state.redirects, ['index.html?expired=1']);
});

test('login aprovado abre o menu com nome, cargo, RE e avatar da conta', async () => {
  const f = fixture();
  assert.equal(await f.context.MSA.system.ready, active);
  assert.equal(f.elements.get('#system-shell').hidden, false);
  assert.equal(f.elements.get('#session-screen').hidden, true);
  assert.equal(f.elements.get('.user-name').textContent, 'Ana Silva');
  assert.equal(f.elements.get('#header-user-role').textContent, 'Supervisor');
  assert.equal(f.elements.get('#header-user-re').textContent, 'RE 001234');
  assert.equal(f.elements.get('.user-avatar').textContent, 'AS');
  assert.equal(f.state.redirects.length, 0);
});

test('contas pendentes e bloqueadas seguem para a tela de liberação', async () => {
  for (const status of ['pendente', 'bloqueado']) {
    const f = fixture({ ...active, status });
    assert.equal(await f.context.MSA.system.ready, null);
    assert.equal(f.elements.get('#system-shell').hidden, true);
    assert.deepEqual(f.state.redirects, ['acesso.html']);
  }
});

test('bloquear uma conta já conectada fecha o menu e limpa o chat', async () => {
  const f = fixture();
  await flush();
  const clears = f.state.clearCalls;
  f.state.watcher({ ...active, status: 'bloqueado' });
  assert.equal(f.elements.get('#system-shell').hidden, true);
  assert.equal(f.state.clearCalls, clears + 1);
  assert.deepEqual(f.state.redirects, ['acesso.html']);
});

test('Sair encerra a sessão, interrompe a observação e volta ao login', async () => {
  const f = fixture();
  await flush();
  await f.elements.get('#system-logout').listeners.get('click')();
  assert.equal(f.state.logoutCalls, 1);
  assert.equal(f.state.stopped, 1);
  assert.deepEqual(f.state.redirects, ['index.html']);
  assert.equal(f.elements.get('#system-logout').disabled, false);
});

test('erro de conexão mantém o menu oculto; Tentar novamente recupera a sessão', async () => {
  const f = fixture();
  f.state.error = new Error('Conexão indisponível.');
  // O primeiro resultado já foi solicitado; reabrir pelo bfcache inicia nova verificação.
  await flush();
  f.events.get('pageshow')({ persisted: true });
  await flush();
  assert.equal(f.elements.get('#system-shell').hidden, true);
  assert.equal(f.elements.get('#session-actions').hidden, false);
  assert.equal(f.elements.get('#session-description').textContent, 'Conexão indisponível.');
  f.state.error = null;
  await f.elements.get('#session-retry').listeners.get('click')();
  assert.equal(f.elements.get('#system-shell').hidden, false);
  assert.equal(f.elements.get('#session-screen').hidden, true);
});
