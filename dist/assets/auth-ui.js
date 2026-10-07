/* Login e cadastro usam somente o serviço Firebase, sem aprovação adicional. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const page = document.body.dataset.page;
  if (page === 'acesso') {
    $('gateway-main').hidden = false;
    async function connect() {
      try {
        const user = await MSA.auth.ready();
        if (MSA.auth.role(user)) { location.replace(MSA.auth.home(user)); return; }
        $('access-banner').textContent = user?.status === 'bloqueado' ? 'Este acesso está bloqueado.' : 'Entre com seu RE e senha para continuar.';
        $('access-banner').hidden = false;
      } catch (error) { $('access-banner').textContent = error.message; $('access-banner').hidden = false; }
    }
    $('retry-access').addEventListener('click', connect);
    $('logout').addEventListener('click', async () => { await MSA.auth.logout(); location.replace('index.html'); });
    void connect();
    return;
  }
  const form = $('auth-form');
  const banner = $('form-banner');
  const button = form.querySelector('button[type=submit]');
  let busy = false;
  if (page === 'cadastro') {
    MSA.config.roles.forEach(role => $('cargo').add(new Option(role.label, role.id)));
    $('cargo').value = 'operador';
    function context() {
      const roleHint = $('role-hint');
      if (roleHint) roleHint.textContent = $('cargo').value === 'operador'
        ? 'Você registra a operação da máquina em uso.'
        : $('cargo').value === 'chefe'
          ? 'Você acompanha os indicadores de todos os setores.'
          : 'Você escolhe o setor que está acompanhando no sistema.';
    }
    $('cargo').addEventListener('change', context);
    context();
    button.dataset.label = 'Cadastrar e entrar';
    button.textContent = button.dataset.label;
  } else {
    $('re').value = MSA.auth.rememberedRE();
    $('remember').checked = !!MSA.auth.rememberedRE();
    $('open-recovery').addEventListener('click', () => $('recovery-dialog').showModal());
    $('close-recovery').addEventListener('click', () => $('recovery-dialog').close());
  }
  const fields = [...form.querySelectorAll('input:not([type=checkbox]), select')];
  function errors(values) {
    fields.forEach(input => {
      const target = $(input.id + '-error');
      input.setAttribute('aria-invalid', values[input.name] ? 'true' : 'false');
      if (target) { target.textContent = values[input.name] || ''; target.hidden = !values[input.name]; }
    });
  }
  fields.forEach(input => input.addEventListener('input', () => { errors({}); banner.hidden = true; }));
  document.querySelectorAll('[data-password]').forEach(toggle => toggle.addEventListener('click', () => {
    const input = $(toggle.dataset.password);
    const reveal = input.type === 'password';
    input.type = reveal ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(reveal));
    toggle.setAttribute('aria-label', reveal ? 'Ocultar senha' : 'Mostrar senha');
  }));

  const password = $('senha');
  for (const eventName of ['keydown','keyup']) password.addEventListener(eventName,event=>{
    const note=password.closest('.field').querySelector('.caps-note');
    if(note)note.hidden=!event.getModifierState?.('CapsLock');
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(form));
    const invalid = MSA.validation.form(values, page);
    errors(invalid);
    if (Object.keys(invalid).length) { $(Object.keys(invalid)[0]).focus(); return; }
    busy = true;
    banner.hidden = true;
    form.setAttribute('aria-busy', 'true');
    button.disabled = true;
    button.textContent = page === 'login' ? 'Entrando…' : 'Cadastrando…';
    try {
      const user = page === 'login' ? await MSA.auth.login({ ...values, remember: $('remember').checked }) : await MSA.auth.register(values);
      $('senha').value = '';
      location.assign(MSA.auth.home(user));
    } catch (error) {
      if (error.field) { errors({ [error.field]: error.message }); $(error.field)?.focus(); }
      else { banner.textContent = error.message; banner.setAttribute('role', 'alert'); banner.classList.add('error-banner'); banner.hidden = false; }
    } finally {
      busy = false;
      button.disabled = false;
      button.textContent = button.dataset.label;
      form.setAttribute('aria-busy', 'false');
    }
  });
})();
