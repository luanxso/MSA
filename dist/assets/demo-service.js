/* Apresentação explícita: perfis e mensagens locais, sem acesso ao Firebase ou à API real. */
(() => {
  'use strict';
  if (!MSA.config.presentation?.enabled) return;

  const keys = {
    session: 'msa.presentation.session.v2',
    accounts: 'msa.presentation.accounts.v2',
    remembered: 'msa.presentation.remembered-re',
    registration: 'msa.presentation.registration-re',
    chat: 'msa.presentation.chat.v1',
  };
  const memory = new Map();
  const listeners = new Set();
  const copy = value => value == null ? null : JSON.parse(JSON.stringify(value));
  const findRole = id => MSA.config.roles.find(role => role.id === id);
  function read(storage, key, fallback) {
    try {
      const value = window[storage].getItem(key);
      if (value) return JSON.parse(value);
    } catch {}
    return copy(memory.get(key) ?? fallback);
  }
  function write(storage, key, value) {
    memory.set(key, copy(value));
    try {
      if (value == null) window[storage].removeItem(key);
      else window[storage].setItem(key, JSON.stringify(value));
    } catch {}
  }
  function validProfile(user) {
    return user?.isDemo === true && findRole(user.cargo) && typeof user.re === 'string' && /^\d{1,10}$/.test(user.re) && user.id === `demo:re:${user.re}` && typeof user.nome === 'string' && !!user.nome.trim();
  }
  function accounts() {
    const saved = read('localStorage', keys.accounts, []);
    return Array.isArray(saved) ? saved.filter(account => validProfile(account?.user) && typeof account.salt === 'string' && typeof account.passwordHash === 'string') : [];
  }
  function profiles() {
    return accounts().map(account => account.user);
  }
  let current = read('sessionStorage', keys.session, null);
  if (!validProfile(current)) current = null;
  function enter(user) {
    current = copy(user);
    write('sessionStorage', keys.session, current);
    listeners.forEach(listener => listener(copy(current)));
    return copy(current);
  }
  function validation(values, mode) {
    const errors = {};
    if (!/^\d{1,10}$/.test(String(values.re || '').trim())) errors.re = 'Informe seu RE com até 10 números.';
    if (!String(values.senha || '').length) errors.senha = 'Informe uma senha.';
    else if (String(values.senha).length > 64) errors.senha = 'Use uma senha de até 64 caracteres.';
    if (mode === 'cadastro') {
      if (!findRole(values.cargo)) errors.cargo = 'Selecione um cargo.';
      if (!String(values.nome || '').trim()) errors.nome = 'Informe seu nome.';
      else if (String(values.nome).trim().length > 120) errors.nome = 'Use um nome de até 120 caracteres.';
    }
    return errors;
  }
  function requireValid(values, mode) {
    const errors = validation(values, mode);
    const field = Object.keys(errors)[0];
    if (field) throw Object.assign(new Error(errors[field]), { field });
  }
  async function passwordHash(salt, password) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  MSA.auth = Object.freeze({
    mode: 'demo',
    async login(values) {
      requireValid(values, 'login');
      enter(null);
      const re = values.re.trim();
      const account = accounts().find(account => account.user.re === re);
      if (!account || await passwordHash(account.salt, values.senha) !== account.passwordHash) {
        throw Object.assign(new Error('RE ou senha incorretos.'), { field: 'senha' });
      }
      write('localStorage', keys.remembered, values.remember ? re : null);
      return enter(account.user);
    },
    async register(values) {
      requireValid(values, 'cadastro');
      const re = values.re.trim();
      const saved = accounts();
      if (saved.some(account => account.user.re === re)) throw Object.assign(new Error('Este RE já tem cadastro. Entre com ele.'), { field: 're' });
      const user = { id: `demo:re:${re}`, nome: values.nome.trim(), re, cargo: values.cargo, cargoSolicitado: values.cargo, status: 'ativo', isDemo: true };
      const salt = crypto.randomUUID();
      saved.push({ user, salt, passwordHash: await passwordHash(salt, values.senha) });
      write('localStorage', keys.accounts, saved);
      write('sessionStorage', keys.registration, re);
      return enter(user);
    },
    async ready() { return copy(current); },
    session() { return copy(current); },
    async watch(listener) { listeners.add(listener); listener(copy(current)); return () => listeners.delete(listener); },
    async logout() { enter(null); },
    async token() { throw Object.assign(new Error('Esta apresentação utiliza o chat local.'), { code: 'DEMO_ONLY' }); },
    rememberedRE() { const re = read('localStorage', keys.remembered, ''); return typeof re === 'string' ? re : ''; },
    consumeRegistrationRE() { const re = read('sessionStorage', keys.registration, ''); write('sessionStorage', keys.registration, null); return typeof re === 'string' ? re : ''; },
    role(user = current) { return validProfile(user) ? findRole(user.cargo) : null; },
    can(_permission, user = current) { return Boolean(this.role(user)); },
    home(user = current) { const role = this.role(user); return role ? `sistema.html#${role.home}` : 'index.html'; },
  });

  const rooms = [
    ['producao', 'Produção', 'Alinhamentos da produção e áreas de suporte.'],
    ['injecao', 'Injeção', 'Informações do setor de injeção.'],
    ['montagem', 'Montagem', 'Informações do setor de montagem.'],
    ['costura', 'Costura', 'Informações do setor de costura.'],
    ['manutencao', 'Manutenção', 'Alinhamentos de manutenção e suporte aos equipamentos.'],
    ['qualidade', 'Qualidade', 'Alinhamentos de qualidade e inspeção.'],
  ].map(([sector, name, description]) => ({ id: `sector:${sector}`, sector, name, note: 'Conversa do setor', description }));
  rooms.push({ id: 'shift:handover', sector: null, name: 'Passagem de turno', note: 'Ocorrências e pendências', description: 'Ocorrências e pendências para o próximo turno.' });
  const identity = user => ({ id: user.id, name: user.nome, re: user.re, isDemo: true });
  function fail(status, message) { throw Object.assign(new Error(message), { status }); }
  function chatState() {
    const saved = read('localStorage', keys.chat, null);
    return saved && Array.isArray(saved.messages) && Array.isArray(saved.threads) && Number.isSafeInteger(saved.nextId)
      ? saved : { messages: [], threads: [], nextId: 1 };
  }
  function checkConversation(state, id) {
    if (rooms.some(room => room.id === id)) return;
    if (!state.threads.some(thread => thread.id === id && thread.people.includes(current.id))) fail(404, 'Conversa não encontrada.');
  }
  async function chatRequest(path, options = {}) {
    if (options.signal?.aborted) throw new DOMException('Conversa alterada.', 'AbortError');
    if (!current) fail(401, 'Entre com seu RE e senha para acessar as conversas.');
    const url = new URL(path, 'https://presentation.local/');
    const route = url.pathname.slice(1);
    const method = options.method || 'GET';
    const state = chatState();
    if (route === 'bootstrap' && method === 'GET') {
      return { me: identity(current), rooms: copy(rooms), people: profiles().filter(user => user.id !== current.id).map(identity) };
    }
    let body = {};
    if (options.body) {
      try { body = JSON.parse(options.body); }
      catch { fail(400, 'Solicitação inválida.'); }
    }
    if (route === 'threads' && method === 'POST') {
      const person = profiles().find(user => user.id === body.person_id && user.id !== current.id);
      if (!person) fail(400, 'Selecione outro funcionário.');
      const participants = [current.id, person.id].sort();
      const id = `direct:${participants.join('|')}`;
      if (!state.threads.some(thread => thread.id === id)) {
        state.threads.push({ id, people: participants });
        write('localStorage', keys.chat, state);
      }
      return { id };
    }
    if (route === 'messages' && method === 'GET') {
      const conversation = url.searchParams.get('conversation');
      checkConversation(state, conversation);
      const after = url.searchParams.get('after');
      const before = url.searchParams.get('before');
      const found = state.messages.filter(message => message.conversation === conversation && (after === null || message.id > Number(after)) && (before === null || message.id < Number(before)));
      return { messages: copy(after === null ? found.slice(-50) : found.slice(0, 50)), has_more: found.length > 50 };
    }
    if (route === 'messages' && method === 'POST') {
      checkConversation(state, body.conversation);
      if (typeof body.body !== 'string' || !body.body.trim() || body.body.trim().length > 2000) fail(400, 'Escreva uma mensagem de até 2.000 caracteres.');
      const previous = state.messages.find(message => message.sender_id === current.id && message.client_key === body.client_key);
      if (previous) {
        if (previous.conversation !== body.conversation || previous.body !== body.body.trim()) fail(409, 'Este envio já foi utilizado.');
        return { message: copy(previous) };
      }
      const message = { id: state.nextId++, conversation: body.conversation, sender_id: current.id, sender_name: current.nome, sender_re: current.re, body: body.body.trim(), created_at: Date.now(), client_key: body.client_key };
      state.messages.push(message);
      write('localStorage', keys.chat, state);
      return { message: copy(message) };
    }
    fail(404, 'Ação não encontrada.');
  }
  MSA.presentation = { validate: validation, chatRequest };
})();
