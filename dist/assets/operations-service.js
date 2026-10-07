/* Única fonte dos dados compartilhados: Firebase Realtime Database. */
window.MSA = window.MSA || {};
(() => {
  'use strict';
  const collections = ['maquinas', 'registrosProducao', 'leituras', 'paradas', 'perdas', 'ocorrencias', 'consolidacoes', 'perfis', 'setores'];
  const permissions = { registrosProducao: 'producao:registrar', leituras: 'leituras:registrar', paradas: 'paradas:registrar', perdas: 'perdas:registrar', ocorrencias: 'ocorrencias:registrar' };
  const observers = new Set();
  let state = Object.fromEntries(collections.map(key => [key, []]));
  let user = null;
  let client = null;
  let stops = [];
  let generation = 0;
  let ready = false;
  let error = '';
  let connected = false;
  const fail = message => { throw new Error(message); };
  const number = (value, label, minimum = 0) => {
    const n = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
    if (value === '' || value == null || !Number.isFinite(n) || n < minimum) fail('Informe ' + label + ' válido.');
    return n;
  };
  const date = (value, label) => { const n = typeof value === 'number' ? value : Date.parse(value); if (!Number.isFinite(n) || n > Date.now() + 60000) fail('Informe ' + label + ' válido.'); return n; };
  const required = (value, label, max = 500) => { const text = String(value || '').trim(); if (!text || text.length > max) fail('Informe ' + label + ' (até ' + max + ' caracteres).'); return text; };
  function emit() { observers.forEach(observer => observer({ ...state, ready, error, connected })); }
  function scopedQuery(key) {
    const sdk = client.databaseSDK;
    const target = sdk.ref(client.database, key);
    if (key === 'setores' || key === 'maquinas' || user.cargo === 'chefe') return target;
    if (key === 'perfis') return user.cargo === 'operador' ? sdk.ref(client.database, key + '/' + user.id) : sdk.query(target, sdk.orderByChild('setorId'), sdk.equalTo(user.setorId));
    if (key === 'consolidacoes') return sdk.query(target, sdk.orderByChild('setorId'), sdk.equalTo(user.setorId));
    const field = user.cargo === 'operador' ? 'maquinaId' : 'setorId';
    return sdk.query(target, sdk.orderByChild(field), sdk.equalTo(user[field]));
  }
  const recordById = (collection, id) => state[collection]?.find(item => item.id === id);
  const machineById = id => state.maquinas.find(item => item.id === id);
  const metadata = (machine, existing) => ({ setorId: machine.setorId, maquinaId: machine.id, usuarioId: existing?.usuarioId || user.id, usuarioRe: existing?.usuarioRe || user.re, createdAt: existing?.createdAt || client.databaseSDK.serverTimestamp(), updatedAt: client.databaseSDK.serverTimestamp(), atualizadoPor: user.id });
  function cleanRecord(collection, values, existing) {
    if (!permissions[collection]) fail('Tipo de registro inválido.');
    const machine = machineById(values.maquinaId || existing?.maquinaId);
    if (!machine) fail('Selecione uma máquina disponível.');
    MSA.rbac.require(permissions[collection], user, existing || machine);
    const common = { ...metadata(machine, existing), verificado: false, observacao: String(values.observacao || '').trim().slice(0, 1000) };
    if (collection === 'registrosProducao') {
      const inicio = date(values.inicio, 'início do período');
      const fim = date(values.fim, 'fim do período');
      if (fim <= inicio) fail('O fim deve ser posterior ao início.');
      const quantidade = number(values.quantidade, 'quantidade');
      if (!Number.isSafeInteger(quantidade)) fail('Informe uma quantidade inteira.');
      return { ...common, quantidade, inicio, fim, turno: required(values.turno, 'turno', 20), produto: required(values.produto, 'produto', 120), lote: required(values.lote, 'lote ou ordem', 80) };
    }
    if (collection === 'paradas') {
      const inicio = date(values.inicio, 'início da parada');
      const fim = values.fim ? date(values.fim, 'fim da parada') : 0;
      if (fim && fim < inicio) fail('O fim deve ser posterior ao início.');
      return { ...common, inicio, fim, motivo: required(values.motivo, 'motivo', 300), causa: existing?.causa || '', encerradaPor: fim ? user.id : '' };
    }
    if (collection === 'perdas') {
      const tipo = values.tipo;
      if (!['refugo', 'perda', 'suspeito'].includes(tipo)) fail('Selecione o tipo do registro.');
      const quantidade = number(values.quantidade, 'quantidade', 0.001);
      if (tipo !== 'perda' && !Number.isSafeInteger(quantidade)) fail('Informe uma quantidade inteira de peças.');
      return { ...common, tipo, quantidade, unidade: tipo === 'perda' ? 'kg' : 'pecas', motivo: required(values.motivo, 'motivo', 300), produto: required(values.produto, 'produto', 120), lote: required(values.lote, 'lote ou ordem', 80), data: date(values.data, 'data') };
    }
    if (collection === 'ocorrencias') return { ...common, descricao: required(values.descricao, 'descrição', 1000), prioridade: ['normal', 'alta'].includes(values.prioridade) ? values.prioridade : 'normal', status: existing?.status || 'aberta', resolucao: existing?.resolucao || '', data: date(values.data, 'data') };
    if (collection === 'leituras') {
      const parametros = {};
      for (const [id, definition] of Object.entries(machine.parametros || {})) parametros[id] = number(values.valores?.[id] ?? values['param_' + id], definition.nome, -100000);
      if (!Object.keys(parametros).length) fail('Esta máquina ainda não possui parâmetros cadastrados.');
      return { ...common, valores: parametros, lote: required(values.lote, 'lote ou ordem', 80), data: date(values.data, 'data') };
    }
  }
  async function write(action) {
    if (!connected) fail('Aguarde a conexão com o Firebase antes de salvar.');
    let timeout;
    try { await Promise.race([action(), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('O Firebase ainda não confirmou este envio. Consulte o histórico antes de reenviar.')), 15000); })]); }
    catch (e) { if (/permission/i.test(e.code || e.message)) fail('O Firebase recusou esta ação. Confira seu acesso e as regras publicadas do projeto.'); throw e; }
    finally { clearTimeout(timeout); }
  }
  MSA.data = {
    get state() { return { ...state, ready, error, connected }; },
    get user() { return user; },
    subscribe(observer) { observers.add(observer); observer(this.state); return () => observers.delete(observer); },
    async start(nextUser) {
      this.stop();
      const version = generation;
      user = nextUser;
      MSA.rbac.require('visao-geral:ler', user);
      try {
        client = await MSA.firebase.ready();
        if (version !== generation) return;
        const hasContext = user.cargo === 'chefe' || (user.cargo === 'operador' ? !!user.maquinaId : !!user.setorId);
        const waiting = new Set(collections.filter(key => {
          if (key === 'consolidacoes' && user.cargo === 'operador') return false;
          return hasContext || ['maquinas', 'setores'].includes(key) || (key === 'perfis' && user.cargo === 'operador');
        }));
        for (const key of waiting) {
          const single = user.cargo === 'operador' && key === 'perfis';
          const target = scopedQuery(key);
          stops.push(client.databaseSDK.onValue(target, snapshot => {
            if (version !== generation) return;
            const value = snapshot.val();
            state[key] = single ? (value ? [{ ...value, id: user.id }] : []) : Object.entries(value || {}).map(([id, item]) => ({ ...item, id }));
            waiting.delete(key); ready = waiting.size === 0; emit();
          }, e => { if (version === generation) { waiting.delete(key); error = /permission/i.test(e.code || e.message) ? 'Publique database.rules.json no Realtime Database para permitir este acesso.' : 'Não foi possível consultar os dados. Verifique a conexão.'; emit(); } }));
        }
        stops.push(client.databaseSDK.onValue(client.databaseSDK.ref(client.database, '.info/connected'), snapshot => { if (version === generation) { connected = snapshot.val() === true; emit(); } }));
        // Índice mínimo de contatos para preservar o chat sem expor perfis completos.
        void client.databaseSDK.set(client.databaseSDK.ref(client.database, 'diretorio/' + user.id), { nome: user.nome, re: user.re, cargo: user.cargo, setorId: user.setorId }).catch(() => {});
      } catch (e) { if (version === generation) { error = e.message; emit(); } }
    },
    stop() { generation++; stops.forEach(stop => stop()); stops = []; state = Object.fromEntries(collections.map(key => [key, []])); ready = false; connected = false; error = ''; user = null; emit(); },
    async changeContext(values) {
      if (!MSA.rbac.role(user)) fail('Entre novamente para escolher o contexto de trabalho.');
      let patch;
      if (user.cargo === 'operador') {
        const machine = machineById(values.maquinaId);
        if (!machine) fail('Selecione uma máquina cadastrada.');
        patch = { maquinaId: machine.id, setorId: machine.setorId };
      } else if (user.cargo === 'supervisor') {
        if (!MSA.config.sectors.some(sector => sector.id === values.setorId)) fail('Selecione o setor que está acompanhando.');
        patch = { setorId: values.setorId, maquinaId: '' };
      } else fail('Use o filtro de setores para acompanhar a produção.');
      // Altera apenas o contexto atual; a origem dos registros anteriores é preservada.
      await write(() => client.databaseSDK.update(client.databaseSDK.ref(client.database, 'perfis/' + user.id), patch));
    },
    async save(collection, values, id) {
      const existing = id ? recordById(collection, id) : null;
      if (id && !existing) fail('Registro não encontrado no seu acesso.');
      if (existing && values.maquinaId && values.maquinaId !== existing.maquinaId) fail('A máquina de origem não pode ser alterada.');
      const payload = cleanRecord(collection, values, existing);
      const target = id ? client.databaseSDK.ref(client.database, collection + '/' + id) : client.databaseSDK.push(client.databaseSDK.ref(client.database, collection));
      if (!connected) fail('Aguarde a conexão com o Firebase antes de salvar.');
      await write(() => client.databaseSDK.set(target, payload));
      return target.key;
    },
    async review(collection, id) {
      if (!['registrosProducao', 'paradas', 'perdas', 'ocorrencias', 'leituras'].includes(collection)) fail('Registro inválido.');
      const record = recordById(collection, id);
      if (!record) fail('Registro não encontrado.');
      MSA.rbac.require('registros:verificar', user, record);
      await write(() => client.databaseSDK.update(client.databaseSDK.ref(client.database, collection + '/' + id), { verificado: true, verificadoPor: user.id, verificadoEm: client.databaseSDK.serverTimestamp(), updatedAt: client.databaseSDK.serverTimestamp(), atualizadoPor: user.id }));
    },
    async finishStop(id, cause = '') {
      const record = recordById('paradas', id);
      if (!record || record.fim) fail('Esta parada já foi encerrada ou não está disponível.');
      MSA.rbac.require(user.cargo === 'supervisor' ? 'paradas:gerenciar' : 'paradas:registrar', user, record);
      await write(() => client.databaseSDK.update(client.databaseSDK.ref(client.database, 'paradas/' + id), { verificado: false, verificadoPor: null, verificadoEm: null, fim: Date.now(), causa: String(cause).slice(0, 300), encerradaPor: user.id, updatedAt: client.databaseSDK.serverTimestamp(), atualizadoPor: user.id }));
    },
    async resolveOccurrence(id, resolution) {
      const record = recordById('ocorrencias', id);
      if (!record) fail('Ocorrência não encontrada.');
      MSA.rbac.require('ocorrencias:gerenciar', user, record);
      await write(() => client.databaseSDK.update(client.databaseSDK.ref(client.database, 'ocorrencias/' + id), { verificado: false, verificadoPor: null, verificadoEm: null, status: 'resolvida', resolucao: required(resolution, 'ação realizada', 1000), updatedAt: client.databaseSDK.serverTimestamp(), atualizadoPor: user.id }));
    },
    async saveMachine(values, id) {
      if (!connected) fail('Aguarde a conexão com o Firebase antes de salvar.');
      const existing = id ? machineById(id) : null;
      MSA.rbac.require('maquinas:gerenciar', user, { setorId: values.setorId, id: id || '' });
      if (id && (!existing || existing.setorId !== values.setorId)) fail('A máquina de origem não pode ser alterada.');
      const machineId = id || required(values.codigo, 'código da máquina', 40).toUpperCase();
      if (!/^[A-Z0-9_-]+$/.test(machineId)) fail('Use letras, números, hífen ou sublinhado no código.');
      if (!id) {
        const found = await client.databaseSDK.get(client.databaseSDK.ref(client.database, 'maquinas/' + machineId));
        if (found.exists()) fail('Este código já está cadastrado.');
      }
      const parametros = {};
      const parameterCount = Math.min(100, Number(values.paramCount) || 3);
      for (let index = 0; index < parameterCount; index++) {
        if (!values['nome_' + index]) continue;
        const key = values['key_' + index] || 'p' + index;
        if (!/^[A-Za-z0-9_-]{1,80}$/.test(key) || parametros[key]) fail('Identificador de parâmetro inválido ou repetido.');
        const min = number(values['min_' + index], 'limite mínimo', -100000);
        const max = number(values['max_' + index], 'limite máximo', -100000);
        if (max <= min) fail('O limite máximo deve ser maior que o mínimo.');
        parametros[key] = { nome: required(values['nome_' + index], 'nome do parâmetro', 80), unidade: required(values['unidade_' + index], 'unidade', 20), min, max };
      }
      const metaDiaria = number(values.metaDiaria, 'meta diária');
      if (!Number.isSafeInteger(metaDiaria)) fail('Informe uma meta inteira em peças.');
      const payload = { nome: required(values.nome, 'nome da máquina', 120), setorId: values.setorId, processo: required(values.processo, 'processo', 120), produto: required(values.produto, 'produto', 120), metaDiaria, parametros, createdAt: existing?.createdAt || client.databaseSDK.serverTimestamp(), updatedAt: client.databaseSDK.serverTimestamp(), atualizadoPor: user.id };
      if (!connected) fail('Aguarde a conexão com o Firebase antes de salvar.');
      await write(() => client.databaseSDK.set(client.databaseSDK.ref(client.database, 'maquinas/' + machineId), payload));
      return machineId;
    },
    async setTarget(id, target) {
      const machine = machineById(id);
      if (!machine) fail('Máquina não encontrada.');
      MSA.rbac.require('metas:gerenciar', user, machine);
      const metaDiaria = number(target, 'meta diária');
      if (!Number.isSafeInteger(metaDiaria)) fail('Informe uma meta inteira em peças.');
      await write(() => client.databaseSDK.update(client.databaseSDK.ref(client.database, 'maquinas/' + id), { metaDiaria, updatedAt: client.databaseSDK.serverTimestamp(), atualizadoPor: user.id }));
    },
    async assignMachine(uid, machineId) {
      MSA.rbac.require('funcionarios:atribuir', user);
      const profile = recordById('perfis', uid);
      const machine = machineById(machineId);
      if (!profile || profile.cargo !== 'operador' || profile.setorId !== user.setorId || !machine || machine.setorId !== user.setorId) fail('Selecione um operador e uma máquina do seu setor.');
      await write(() => client.databaseSDK.update(client.databaseSDK.ref(client.database, 'perfis/' + uid), { maquinaId: machineId }));
    },
    async consolidate(values) {
      MSA.rbac.require('consolidacoes:registrar', user);
      const inicio = date(values.inicio, 'início');
      const fim = date(values.fim, 'fim');
      if (fim <= inicio) fail('Confira o período da consolidação.');
      const target = client.databaseSDK.push(client.databaseSDK.ref(client.database, 'consolidacoes'));
      await write(() => client.databaseSDK.set(target, { setorId: user.setorId, usuarioId: user.id, inicio, fim, observacao: required(values.observacao, 'resumo do setor', 2000), usuarioRe: user.re, createdAt: client.databaseSDK.serverTimestamp() }));
    },
    async initializeExamples() {
      if (!connected) fail('Aguarde a conexão com o Firebase antes de salvar.');
      MSA.rbac.require(user.cargo === 'chefe' ? 'setores:gerenciar' : 'maquinas:gerenciar', user);
      const updates = {};
      const allowed = MSA.config.sectors.filter(sector => user.cargo === 'chefe' || sector.id === user.setorId);
      for (const sector of allowed) {
        if (!state.setores.some(item => item.id === sector.id)) updates['setores/' + sector.id] = { nome: sector.nome };
        for (const machine of MSA.config.machines.filter(item => item.setorId === sector.id)) {
          // Lê o item antes de preparar exemplos; nunca substitui um cadastro existente.
          const target = client.databaseSDK.ref(client.database, 'maquinas/' + machine.id);
          if (!(await client.databaseSDK.get(target)).exists()) {
            const { id, ...data } = machine;
            updates['maquinas/' + id] = { ...data, createdAt: client.databaseSDK.serverTimestamp(), updatedAt: client.databaseSDK.serverTimestamp(), atualizadoPor: user.id };
          }
        }
      }
      if (!Object.keys(updates).length) return;
      await write(() => client.databaseSDK.update(client.databaseSDK.ref(client.database), updates));
    }
  };
})();
