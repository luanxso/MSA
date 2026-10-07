'use strict';

(async () => {
  const user = await MSA.system.ready;
  if (!user) return;
  const shell = document.querySelector('.app-shell');
  const sidebar = document.querySelector('#sidebar');
  const workspace = document.querySelector('#workspace');
  const toggleButton = document.querySelector('.sidebar-toggle');
  const closeButton = document.querySelector('.drawer-close');
  const backdrop = document.querySelector('.drawer-backdrop');
  const navigationItems = [...document.querySelectorAll('.nav-item')];
  const pageTitle = document.querySelector('#page-title');
  const currentSection = document.querySelector('#current-section');
  const currentGroup = document.querySelector('#current-group');
  const contextDivider = document.querySelector('#context-divider');
  const main = document.querySelector('#main-content');
  const pageDescription = document.querySelector('#page-description');
  const pageContent = document.querySelector('#page-content');
  const sectorSelector = document.querySelector('#sector-selector');
  const connectionStatus = document.querySelector('.connection-status');
  const mobileViewport = window.matchMedia('(max-width: 767px)');
  const tabletViewport = window.matchMedia('(min-width: 768px) and (max-width: 1100px)');

  // O layout é independente dos módulos da aplicação.
  let collapsed = tabletViewport.matches;
  let drawerOpen = false;
  let previousViewport = getViewport();

  function getViewport() {
    if (mobileViewport.matches) return 'mobile';
    return tabletViewport.matches ? 'tablet' : 'desktop';
  }

  function updateLayout() {
    const isMobile = mobileViewport.matches;
    const expanded = isMobile ? drawerOpen : !collapsed;

    shell.classList.toggle('is-collapsed', !isMobile && collapsed);
    shell.classList.toggle('is-drawer-open', isMobile && drawerOpen);
    backdrop.hidden = !isMobile || !drawerOpen;
    sidebar.inert = isMobile && !drawerOpen;
    workspace.inert = isMobile && drawerOpen;

    toggleButton.setAttribute('aria-expanded', String(expanded));
    const toggleLabel = isMobile
      ? 'Abrir menu lateral'
      : `${collapsed ? 'Expandir' : 'Recolher'} menu lateral`;
    toggleButton.setAttribute('aria-label', toggleLabel);
    toggleButton.title = toggleLabel;

    if (isMobile && drawerOpen) {
      sidebar.setAttribute('role', 'dialog');
      sidebar.setAttribute('aria-modal', 'true');
    } else {
      sidebar.removeAttribute('role');
      sidebar.removeAttribute('aria-modal');
    }
  }

  function closeDrawer({ restoreFocus = true } = {}) {
    if (!drawerOpen) return;
    drawerOpen = false;
    updateLayout();
    if (restoreFocus) toggleButton.focus();
  }

  toggleButton.addEventListener('click', () => {
    if (mobileViewport.matches) {
      drawerOpen = true;
      updateLayout();
      closeButton.focus();
      return;
    }
    collapsed = !collapsed;
    updateLayout();
  });

  closeButton.addEventListener('click', () => closeDrawer());
  backdrop.addEventListener('click', () => closeDrawer());

  // Mantém o foco no drawer enquanto ele está aberto e permite fechar com Escape.
  document.addEventListener('keydown', (event) => {
    if (!mobileViewport.matches || !drawerOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDrawer();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = [...sidebar.querySelectorAll('a[href], button:not([disabled])')]
      .filter((element) => element.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  function handleViewportChange() {
    const viewport = getViewport();
    if (viewport !== previousViewport) {
      collapsed = viewport === 'tablet';
      const focusedElement = document.activeElement;
      const focusWasInSidebar = sidebar.contains(focusedElement);
      const closeButtonWasFocused = focusedElement === closeButton;
      drawerOpen = false;
      previousViewport = viewport;
      updateLayout();
      if ((viewport === 'mobile' && focusWasInSidebar) || closeButtonWasFocused) {
        toggleButton.focus();
      }
    }
  }

  mobileViewport.addEventListener('change', handleViewportChange);
  tabletViewport.addEventListener('change', handleViewportChange);

  // A mesma navegação adapta páginas e contexto à sessão atual.
  function updatePage({ moveFocus = false } = {}) {
    const currentUser = MSA.auth.session();
    const role = MSA.rbac.role(currentUser);
    if (!role) return;
    navigationItems.forEach(item => { item.closest('li').hidden = !MSA.rbac.route(item.dataset.page, currentUser); });
    document.querySelectorAll('.nav-group').forEach(group => { group.hidden = ![...group.querySelectorAll('li')].some(item => !item.hidden); });
    const previousSector = sectorSelector.value;
    [...sectorSelector.options].forEach(option => {
      option.hidden = currentUser.cargo === 'operador' ? option.value !== currentUser.setorId
        : currentUser.cargo === 'supervisor' ? option.value === 'todos' : option.value === '';
    });
    sectorSelector.disabled = currentUser.cargo === 'operador';
    sectorSelector.options[0].textContent = currentUser.cargo === 'operador' ? 'Selecione uma máquina na operação' : 'Selecione o setor em acompanhamento';
    document.querySelector('.context-label').textContent = currentUser.cargo === 'supervisor' ? 'Setor em acompanhamento' : 'Setor';
    sectorSelector.value = currentUser.cargo === 'chefe' ? (previousSector || 'todos') : currentUser.setorId;
    const requestedPage = window.location.hash.slice(1).split('/')[0];
    let pageId = requestedPage || role.home;
    if (!MSA.rbac.route(pageId, currentUser)) {
      MSA.operations.notify('Esta tela não está disponível para seu cargo.', true);
      pageId = role.home;
    }
    if (pageId !== requestedPage) history.replaceState(null, '', '#' + pageId);
    const selectedItem = navigationItems.find(item => item.dataset.page === pageId);
    const title = selectedItem.querySelector('.nav-text').textContent;
    const group = selectedItem.closest('.nav-group').querySelector('.nav-group-label').textContent;
    const sector = sectorSelector.selectedOptions[0]?.textContent || 'Produção';
    const context = group;
    const isChat = selectedItem.dataset.page === 'chat';

    navigationItems.forEach((item) => {
      const isSelected = item === selectedItem;
      item.classList.toggle('is-active', isSelected);
      if (isSelected) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });

    pageTitle.textContent = title;
    currentSection.textContent = title;
    currentGroup.textContent = context;
    const sameContext = context.trim() === title.trim();
    currentSection.hidden = sameContext;
    contextDivider.hidden = sameContext;
    const descriptions = {
      'visao-geral': currentUser.cargo === 'operador' ? 'Sua máquina, produção registrada e pendências.' : 'Produção registrada e condições das máquinas em acompanhamento.',
      producao: 'Metas, apontamentos e parâmetros do período.', maquinas: 'Equipamentos, processos e parâmetros registrados.',
      apontamentos: 'Registre a produção e os parâmetros da máquina em uso.', conferencia: 'Confira os registros e consolide as informações do setor.',
      paradas: 'Motivos, duração e encerramento das paradas.', qualidade: 'Refugos, perdas de material e peças segregadas.',
      ocorrencias: 'Problemas registrados e ações de resolução.', funcionarios: 'Identificação por RE e contexto atual de trabalho.',
      indicadores: 'Compare a produção dos setores e acompanhe as consolidações.', relatorios: 'Registros e resumos para acompanhamento da produção.',
      notificacoes: 'Paradas abertas, ocorrências e desvios de parâmetros.', configuracoes: 'Seu acesso e o catálogo de equipamentos.',
      chat: 'Conversas entre funcionários e passagem de turno'
    };
    pageDescription.textContent = descriptions[pageId] || '';
    pageDescription.hidden = !pageDescription.textContent;
    pageContent.hidden = isChat;
    main.classList.toggle('is-chat-page', isChat);
    main.classList.toggle('is-plant-page', pageId === 'mapa-planta');
    MSA.operations.open(pageId, sectorSelector.value);
    if (isChat) window.MSAChat.show(sectorSelector.value);
    else window.MSAChat.hide();
    document.title = `${title} | MSA do Brasil`;
    main.scrollTop = 0;
    closeDrawer({ restoreFocus: false });
    if (moveFocus) main.focus({ preventScroll: true });
  }

  window.addEventListener('hashchange', () => updatePage({ moveFocus: true }));
  window.addEventListener('msa:profile-changed', () => updatePage());
  sectorSelector.addEventListener('change', async () => {
    if (MSA.auth.session()?.cargo === 'supervisor') {
      sectorSelector.disabled = true;
      try { await MSA.data.changeContext({setorId: sectorSelector.value}); }
      catch (error) { MSA.operations.notify(error.message, true); }
      finally { updatePage(); }
      return;
    }
    window.MSAChat.setSector(sectorSelector.value);
    updatePage();
  });
  document.querySelector('.skip-link').addEventListener('click', (event) => {
    event.preventDefault();
    main.focus({ preventScroll: true });
  });
  document.querySelectorAll('.nav-item, .notifications-button').forEach((link) => {
    link.addEventListener('click', () => {
      if (window.location.hash === link.hash) updatePage({ moveFocus: true });
    });
  });

  function updateConnectionStatus() {
    const online = navigator.onLine && MSA.data.state.connected;
    connectionStatus.classList.toggle('is-offline', !online);
    connectionStatus.querySelector('.status-text').textContent = online ? 'Registros conectados' : 'Registros sem conexão';
  }

  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);

  MSA.data.subscribe(updateConnectionStatus);
  updateLayout();
  shell.classList.add('is-ready');
  updatePage();
  updateConnectionStatus();
})();
