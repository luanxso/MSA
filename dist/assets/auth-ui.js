/* Controlador das telas. Não conhece armazenamento nem verificação de credenciais. */
(() => {
  'use strict';
  const page = document.body.dataset.page;
  const $ = id => document.getElementById(id);
  const icon = kind => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${kind === 'check' ? '<path d="m5 12 4 4 10-10"/>' : '<circle cx="12" cy="12" r="9"/><path d="M12 8v5m0 3v.1"/>'}</svg>`;
  if (page === 'acesso') {
    let stopWatching = () => {};
    function showFailure(error) {
      $('profile-summary').hidden = true;
      $('profile-modules').hidden = true;
      $('access-state').textContent = 'ACESSO INDISPONÍVEL';
      $('welcome').textContent = 'Não foi possível consultar seu acesso.';
      $('access-description').textContent = '';
      $('access-banner').textContent = error.message || 'Verifique sua conexão e tente novamente.';
      $('access-banner').classList.add('error-banner');
      $('access-banner').setAttribute('role', 'alert');
      $('access-banner').hidden = false;
      $('retry-access').hidden = false;
    }
    function render(user) {
      if (!user) { location.replace('index.html?expired=1'); return; }
      const role = MSA.auth.role(user);
      const active = !!role;
      if (active) { location.replace(MSA.auth.home(user)); return; }
      $('retry-access').hidden = true;
      $('profile-summary').hidden = false;
      $('access-state').textContent = active ? 'ACESSO CONFIRMADO' : (user.status === 'bloqueado' ? 'ACESSO BLOQUEADO' : 'CADASTRO EM ANÁLISE');
      $('welcome').textContent = `Bem-vindo, ${user.nome.split(' ')[0]}.`;
      $('access-description').textContent = active ? 'Sua sessão foi iniciada. Este é o resumo do seu perfil de acesso.' : 'Sua identidade foi autenticada. A liberação das áreas depende da aprovação do responsável pelo sistema.';
      $('user-re').textContent = user.re;
      $('user-role').textContent = role?.label || MSA.config.roles.find(item => item.id === user.cargoSolicitado)?.label || 'A definir';
      $('user-area').textContent = active ? MSA.config.areas[role.home] : 'Aguardando liberação';
      $('access-banner').textContent = user.status === 'bloqueado' ? 'Seu acesso está bloqueado. Procure o responsável pelo sistema.' : 'Seu cadastro foi recebido. Aguarde a liberação do seu cargo para acessar as áreas operacionais.';
      $('access-banner').classList.toggle('error-banner', user.status === 'bloqueado');
      $('access-banner').setAttribute('role', user.status === 'bloqueado' ? 'alert' : 'status');
      $('access-banner').hidden = active;
      $('profile-modules').hidden = !active;
      $('user-modules').replaceChildren();
      if (active) [...new Set(role.permissions.map(permission => permission.split(':')[0]))].forEach(area => {
        const item = document.createElement('li'); item.textContent = MSA.config.areas[area]; $('user-modules').append(item);
      });
    }
    async function connect() {
      $('retry-access').hidden = true;
      stopWatching();
      try {
        const user = await MSA.auth.ready();
        render(user);
        if (user) stopWatching = await MSA.auth.watch(render, showFailure);
      } catch (error) { showFailure(error); }
    }
    $('gateway-main').hidden = false;
    $('retry-access').addEventListener('click', connect);
    $('logout').addEventListener('click', async () => {
      $('logout').disabled = true;
      try { await MSA.auth.logout(); location.replace('index.html'); }
      catch (error) { showFailure(error); $('logout').disabled = false; }
    });
    addEventListener('pagehide', () => stopWatching(), { once: true });
    addEventListener('pageshow', event => { if (event.persisted) void connect(); });
    void connect();
    return;
  }
  const form = $('auth-form'), banner = $('form-banner');
  const fields = [...form.querySelectorAll('input:not([type=checkbox]), select')];
  const touched = new Set();
  let busy = false;
  const values = () => Object.fromEntries(new FormData(form));
  function showBanner(message, error = false) {
    banner.replaceChildren();
    banner.insertAdjacentHTML('afterbegin', icon(error ? 'info' : 'check'));
    const text = document.createElement('span'); text.textContent = message; banner.append(text);
    banner.classList.toggle('error-banner', error); banner.setAttribute('role', error ? 'alert' : 'status'); banner.hidden = false;
  }
  function setError(name, message) {
    const input = $(name), error = $(name + '-error');
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    input.classList.toggle('valid', !message && touched.has(name) && !!input.value);
    error.textContent = message; error.hidden = !message;
  }
  function validate(name) { const data = values(); const message = MSA.validation.field(name, data[name] || '', data, page); setError(name, message); return !message; }
  function setBusy(value) {
    busy = value; form.setAttribute('aria-busy', String(value));
    form.querySelectorAll('input,select,button').forEach(control => control.disabled = value);
    const button = form.querySelector('button[type=submit]');
    button.innerHTML = value ? '<span class="spinner" aria-hidden="true"></span><span class="button-label">' + (page === 'login' ? 'Entrando…' : 'Cadastrando…') + '</span>' : '<span class="button-label">' + button.dataset.label + '</span>';
  }
  if (page === 'cadastro') {
    MSA.config.roles.forEach(role => { const option = document.createElement('option'); option.value = role.id; option.textContent = role.label; $('cargo').append(option); });
    $('senha').setAttribute('aria-describedby', 'password-rules senha-error');
  } else {
    const remembered = MSA.auth.rememberedRE(), query = new URLSearchParams(location.search);
    const registeredRE = MSA.auth.consumeRegistrationRE() || query.get('re');
    if (query.has('re')) { query.delete('re'); history.replaceState(null, '', location.pathname + (query.size ? '?' + query : '') + location.hash); }
    $('re').value = registeredRE && MSA.config.re.pattern.test(registeredRE) ? registeredRE : remembered;
    $('remember').checked = !!remembered;
    if (query.get('registered') === '1') showBanner('Cadastro concluído. Entre para acompanhar a liberação do seu acesso.');
    if (query.get('expired') === '1') showBanner('Entre com seu RE e senha para iniciar uma nova sessão.');
    $('open-recovery').addEventListener('click', () => $('recovery-dialog').showModal());
    $('close-recovery').addEventListener('click', () => $('recovery-dialog').close());
  }
  fields.forEach(input => {
    input.addEventListener('blur', () => { if (busy) return; touched.add(input.name); validate(input.name); });
    input.addEventListener('input', () => {
      if (touched.has(input.name)) validate(input.name);
      if (banner.classList.contains('error-banner')) banner.hidden = true;
      if (input.name === 'senha' && page === 'cadastro') {
        const rules = MSA.validation.passwordRules(input.value);
        document.querySelectorAll('[data-rule]').forEach(item => item.classList.toggle('met', rules[item.dataset.rule]));
        if (touched.has('confirmacao')) validate('confirmacao');
      }
    });
    if (input.tagName === 'SELECT') input.addEventListener('change', () => { touched.add(input.name); validate(input.name); });
    if (input.type === 'password') {
      const note = input.closest('.field').querySelector('.caps-note');
      ['keydown', 'keyup'].forEach(event => input.addEventListener(event, e => note.hidden = !e.getModifierState('CapsLock')));
      input.addEventListener('blur', () => note.hidden = true);
    }
  });
  document.querySelectorAll('[data-password]').forEach(button => button.addEventListener('click', () => {
    const input = $(button.dataset.password), reveal = input.type === 'password';
    input.type = reveal ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(reveal));
    button.setAttribute('aria-label', (reveal ? 'Ocultar ' : 'Mostrar ') + (input.name === 'confirmacao' ? 'confirmação da senha' : 'senha'));
    button.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>' + (reveal ? '<path d="m3 3 18 18"/>' : '') + '</svg>';
  }));
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    const data = values();
    fields.forEach(input => touched.add(input.name));
    const errors = MSA.validation.form(data, page);
    fields.forEach(input => setError(input.name, errors[input.name] || ''));
    if (Object.keys(errors).length) { $(Object.keys(errors)[0]).focus(); return; }
    banner.hidden = true; let focusOnError = null; setBusy(true);
    try {
      if (page === 'login') {
        const user = await MSA.auth.login({ ...data, remember: $('remember').checked });
        $('senha').value = ''; location.assign(MSA.auth.home(user));
      } else {
        const user = await MSA.auth.register(data);
        form.reset();
        $('form-section').hidden = true;
        const requestedRole = MSA.config.roles.find(role => role.id === user.cargoSolicitado);
        $('success-identity').textContent = `RE ${user.re} · ${requestedRole?.label || 'Cargo em análise'}`;
        $('success-login').href = 'index.html?registered=1';
        $('registration-success').hidden = false; $('registration-success').focus();
      }
    } catch (error) {
      if (error.field) { setError(error.field, error.message); focusOnError = error.field; }
      else showBanner(error.message || 'Não foi possível concluir. Tente novamente.', true);
    } finally { setBusy(false); if (focusOnError) $(focusOnError).focus(); }
  });
  void MSA.firebase.ready().catch(() => {});
  /* Navegação pública, sem coleta ou transmissão de credenciais a agentes. */
  if (document.modelContext?.registerTool) {
    const lifecycle = new AbortController();
    const tools = [
      { name: 'open_registration', title: 'Abrir cadastro', description: 'Abre o formulário público de cadastro. Não cria uma conta.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, execute(input) { if (!input || Object.keys(input).length) throw new Error('Entrada inválida.'); location.assign('cadastro.html'); return { destination: 'cadastro' }; } },
      { name: 'read_authentication_requirements', title: 'Consultar requisitos de acesso', description: 'Consulta o formato de RE, requisitos de senha e cargos disponíveis. Não retorna dados de funcionários.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: false }, execute(input) { if (!input || Object.keys(input).length) throw new Error('Entrada inválida.'); return { re: { min: MSA.config.re.min, max: MSA.config.re.max, numericOnly: true }, password: { min: 8, max: 64, uppercase: true, lowercase: true, number: true }, roles: MSA.config.roles.map(({ id, label }) => ({ id, label })) }; } }
    ];
    tools.forEach(tool => { try { Promise.resolve(document.modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch {} });
    addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  }
})();
