'use strict';

(() => {
  const shell = document.querySelector('#system-shell');
  const screen = document.querySelector('#session-screen');
  const actions = document.querySelector('#session-actions');
  const logout = document.querySelector('#system-logout');
  let stopWatching = () => {};
  let revision = 0;
  let activeUserId = null;
  let resolveReady;
  MSA.system = {
    ready: new Promise((resolve) => { resolveReady = resolve; }),
  };

  function hideSystem() {
    MSA.plant?.close();
    MSA.data?.stop();
    document.querySelector('#operation-dialog')?.close?.();
    shell.hidden = true;
    screen.hidden = false;
    window.MSAChat?.hide();
  }

  function failure(error) {
    hideSystem();
    document.querySelector('#session-title').textContent = 'Não foi possível verificar seu acesso';
    document.querySelector('#session-description').textContent = error.message || 'Verifique sua conexão e tente novamente.';
    actions.hidden = false;
  }

  function render(user) {
    if (!user) {
      window.MSAChat?.clear();
      activeUserId = null;
      hideSystem();
      resolveReady(null);
      location.replace('index.html?expired=1');
      return false;
    }
    const role = MSA.auth.role(user);
    if (!role) {
      window.MSAChat?.clear();
      activeUserId = null;
      hideSystem();
      resolveReady(null);
      location.replace('acesso.html');
      return false;
    }
    if (activeUserId !== user.id) window.MSAChat?.clear();
    activeUserId = user.id;
    const names = user.nome.trim().split(/\s+/);
    const secondName = names.slice(1).find(name => !/^(de|da|do|das|dos|e)$/i.test(name));
    document.querySelector('.user-name').textContent = secondName ? `${names[0]} ${Array.from(secondName)[0]}.` : names[0];
    document.querySelector('.user-name').setAttribute('title', user.nome);
    document.querySelector('#header-user-role').textContent = role.label;
    document.querySelector('#header-user-re').textContent = `RE ${user.re}`;
    document.querySelector('.user-avatar').textContent = user.nome.split(/\s+/).slice(0, 2).map((name) => name[0]).join('').toUpperCase();
    document.querySelector('.user-profile').setAttribute('aria-label', `${user.nome}, ${role.label}, RE ${user.re}`);
    screen.hidden = true;
    shell.hidden = false;
    shell.inert = false;
    resolveReady(user);
    window.dispatchEvent(new CustomEvent('msa:profile-changed', { detail: user }));
    return true;
  }

  async function connect() {
    const currentRevision = ++revision;
    stopWatching();
    hideSystem();
    actions.hidden = true;
    document.querySelector('#session-title').textContent = 'Verificando seu acesso';
    document.querySelector('#session-description').textContent = 'Aguarde um momento.';
    try {
      const user = await MSA.auth.ready();
      if (currentRevision !== revision || !render(user)) return;
      const unsubscribe = await MSA.auth.watch((nextUser) => {
        if (currentRevision === revision) render(nextUser);
      }, (error) => {
        if (currentRevision === revision) failure(error);
      });
      if (currentRevision === revision) stopWatching = unsubscribe;
      else unsubscribe();
    } catch (error) { if (currentRevision === revision) failure(error); }
  }

  logout.addEventListener('click', async () => {
    revision += 1;
    stopWatching();
    logout.disabled = true;
    shell.inert = true;
    window.MSAChat?.hide();
    MSA.data?.stop();
    try {
      MSA.plant?.close();
      await MSA.auth.logout();
      window.MSAChat?.clear();
      location.replace('index.html');
    } catch (error) { failure(error); }
    finally { logout.disabled = false; shell.inert = false; }
  });
  document.querySelector('#session-retry').addEventListener('click', connect);
  window.addEventListener('pagehide', () => { revision += 1; stopWatching(); MSA.data?.stop(); MSA.plant?.close(); });
  window.addEventListener('pageshow', (event) => { if (event.persisted) void connect(); });
  void connect();
})();
