(() => {
  'use strict';
  if (MSA.auth.mode !== 'demo') return;
  const $ = id => document.getElementById(id);
  if ($('chat-profile-hint')) $('chat-profile-hint').textContent = 'Identificação vinculada ao seu cadastro.';

  MSA.presentation.bindAuth = () => {
    const page = document.body.dataset.page;
    if (page === 'acesso') {
      void MSA.auth.ready().then(user => location.replace(MSA.auth.home(user)));
      return;
    }
    const form = $('auth-form');
    const banner = $('form-banner');
    let cargo = $('cargo');
    if (page === 'login') {
      $('re').value = MSA.auth.consumeRegistrationRE() || MSA.auth.rememberedRE();
      $('remember').checked = !!MSA.auth.rememberedRE();
      $('open-recovery').hidden = true;
    } else {
      document.querySelector('label[for=nome]').textContent = 'Nome';
      $('nome').placeholder = 'Informe seu nome';
      $('re-hint').textContent = 'Registro do funcionário';
      $('password-rules').hidden = true;
      $('confirmacao').disabled = true;
      $('confirmacao').required = false;
      $('confirmacao').closest('.field').hidden = true;
      $('senha').placeholder = 'Crie uma senha';
    }
    if (cargo) {
      MSA.config.roles.forEach(role => {
        const option = document.createElement('option');
        option.value = role.id;
        option.textContent = role.label;
        cargo.append(option);
      });
      cargo.value = MSA.config.presentation.defaultRole || '';
    }
    document.querySelectorAll('[data-password]').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const input = $(toggle.dataset.password);
        const reveal = input.type === 'password';
        input.type = reveal ? 'text' : 'password';
        toggle.setAttribute('aria-pressed', String(reveal));
        toggle.setAttribute('aria-label', reveal ? 'Ocultar senha' : 'Mostrar senha');
      });
    });
    const button = form.querySelector('button[type=submit]');
    const label = page === 'login' ? 'Entrar' : 'Cadastrar e entrar';
    button.dataset.label = label;
    button.textContent = label;
    const fields = [...form.querySelectorAll('input:not([type=checkbox]), select')].filter(input => !input.disabled);
    let busy = false;
    const values = () => Object.fromEntries(new FormData(form));
    function renderErrors(errors) {
      fields.forEach(input => {
        const error = $(input.id + '-error');
        input.setAttribute('aria-invalid', errors[input.name] ? 'true' : 'false');
        error.textContent = errors[input.name] || '';
        error.hidden = !errors[input.name];
      });
    }
    fields.forEach(input => input.addEventListener('input', () => {
      input.setAttribute('aria-invalid', 'false');
      $(input.id + '-error').hidden = true;
      banner.hidden = true;
    }));
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy) return;
      const data = values();
      const errors = MSA.presentation.validate(data, page);
      renderErrors(errors);
      if (Object.keys(errors).length) { $(Object.keys(errors)[0]).focus(); return; }
      busy = true;
      banner.hidden = true;
      form.setAttribute('aria-busy', 'true');
      fields.forEach(input => input.disabled = true);
      button.disabled = true;
      button.textContent = 'Entrando…';
      let focusOnError = null;
      try {
        const user = page === 'login' ? await MSA.auth.login({ ...data, remember: $('remember').checked }) : await MSA.auth.register(data);
        $('senha').value = '';
        location.assign(MSA.auth.home(user));
      } catch (error) {
        if (error.field) { renderErrors({ [error.field]: error.message }); focusOnError = error.field; }
        else { banner.textContent = error.message; banner.classList.add('error-banner'); banner.setAttribute('role', 'alert'); banner.hidden = false; }
      } finally {
        busy = false;
        fields.forEach(input => input.disabled = false);
        button.disabled = false;
        button.textContent = label;
        form.setAttribute('aria-busy', 'false');
        if (focusOnError) $(focusOnError).focus();
      }
    });
  };
})();
