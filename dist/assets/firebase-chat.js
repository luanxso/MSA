/* Adaptador do chat existente para Realtime Database; preserva sua interface. */
window.MSA = window.MSA || {};
(() => {
  'use strict';
  const error = (status, message) => { throw Object.assign(new Error(message), { status }); };
  const contact = (id, item) => ({ id, name: item.nome, re: item.re });
  async function context() {
    const user = MSA.auth.session();
    if (!user) error(401, 'Entre para acessar as conversas.');
    MSA.rbac.require('chat:usar', user);
    return { user, client: await MSA.firebase.ready() };
  }
  async function conversation(client, user, id) {
    if (id === 'geral' || id === 'passagem' || id === 'setor-' + user.setorId || (user.cargo === 'chefe' && MSA.config.sectors.some(item => id === 'setor-' + item.id))) return;
    const value = (await client.databaseSDK.get(client.databaseSDK.ref(client.database, 'conversas/' + id))).val();
    if (!value?.participantes?.[user.id]) error(403, 'Conversa não disponível para seu acesso.');
  }
  MSA.firebaseChat = {
    async execute(path, options = {}) {
      if (options.signal?.aborted) throw new DOMException('Conversa alterada.', 'AbortError');
      const { user, client } = await context();
      const sdk = client.databaseSDK;
      const ref = path => sdk.ref(client.database, path);
      const url = new URL(path.startsWith('/') ? path : '/' + path, 'https://msa.invalid/');
      const method = options.method || 'GET';
      const body = options.body ? JSON.parse(options.body) : {};
      if (url.pathname === '/bootstrap') {
        await sdk.set(ref('diretorio/' + user.id), { nome: user.nome, re: user.re, cargo: user.cargo, setorId: user.setorId });
        const directory = (await sdk.get(ref('diretorio'))).val() || {};
        const rooms = [{ id: 'geral', sector: 'todos', name: 'Produção', note: 'Alinhamentos gerais', description: 'Alinhamentos da produção.' }, { id: 'passagem', sector: null, name: 'Passagem de turno', note: 'Pendências e ocorrências', description: 'Informações para o próximo turno.' }];
        MSA.config.sectors.filter(item => user.cargo === 'chefe' || item.id === user.setorId).forEach(item => rooms.push({ id: 'setor-' + item.id, sector: item.id, name: item.nome, note: 'Conversa do setor', description: 'Alinhamentos do setor.' }));
        return { me: contact(user.id, user), rooms, people: Object.entries(directory).filter(([id]) => id !== user.id).map(([id, item]) => contact(id, item)) };
      }
      if (url.pathname === '/threads' && method === 'POST') {
        const person = (await sdk.get(ref('diretorio/' + body.person_id))).val();
        if (!person || body.person_id === user.id) error(400, 'Selecione outro funcionário.');
        const pair = [user.id, body.person_id].sort();
        const id = 'privada-' + pair.join('_');
        const existing = await sdk.get(ref('conversas/' + id));
        if (!existing.exists()) await sdk.set(ref('conversas/' + id), { participantes: Object.fromEntries(pair.map(uid => [uid, true])) });
        return { id };
      }
      const id = method === 'POST' ? body.conversation : url.searchParams.get('conversation');
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(id)) error(400, 'Selecione uma conversa.');
      await conversation(client, user, id);
      if (url.pathname === '/messages' && method === 'GET') {
        const before = url.searchParams.get('before');
        const after = url.searchParams.get('after');
        const query = [sdk.orderByChild('id')];
        if (before !== null) query.push(sdk.endBefore(Number(before)));
        if (after !== null) query.push(sdk.startAfter(Number(after)));
        query.push(after !== null ? sdk.limitToFirst(51) : sdk.limitToLast(51));
        const values = (await sdk.get(sdk.query(ref('mensagens/' + id), ...query))).val() || {};
        const messages = Object.values(values).sort((a, b) => a.id - b.id);
        return { messages: after !== null ? messages.slice(0,50) : messages.slice(-50), has_more: messages.length > 50 };
      }
      if (url.pathname === '/messages' && method === 'POST') {
        const text = String(body.body || '').trim();
        if (!text || text.length > 2000 || !/^[A-Za-z0-9_-]{1,100}$/.test(body.client_key || '')) error(400, 'Escreva uma mensagem de até 2.000 caracteres.');
        const key = user.id + '_' + body.client_key;
        const target = ref('mensagens/' + id + '/' + key);
        const existing = (await sdk.get(target)).val();
        if (existing) {
          if (existing.body !== text) error(409, 'Este envio já foi utilizado.');
          return { message: existing };
        }
        const timestamp = Date.now();
        const message = { id: timestamp * 1024 + crypto.getRandomValues(new Uint32Array(1))[0] % 1024, conversation: id, sender_id: user.id, sender_name: user.nome, sender_re: user.re, body: text, created_at: timestamp, client_key: body.client_key };
        const result = await sdk.runTransaction(target, current => current || message, { applyLocally: false });
        return { message: result.snapshot.val() };
      }
      error(404, 'Ação não encontrada.');
    },
    async request(path, options = {}) {
      let timer;
      try { return await Promise.race([this.execute(path, options), new Promise((_,reject) => { timer=setTimeout(() => reject(new Error('O Firebase não confirmou a solicitação. Verifique a conexão e tente novamente.')),15000); })]); }
      finally { clearTimeout(timer); }
    }
  };
})();
