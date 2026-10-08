'use strict';

(() => {
  const view = document.querySelector('#chat-view');
  const history = document.querySelector('#chat-history');
  const messageList = document.querySelector('#chat-messages');
  const input = document.querySelector('#chat-message');
  const sendButton = document.querySelector('#chat-send');
  const tabs = [...document.querySelectorAll('[data-chat-tab]')];
  const profileDialog = document.querySelector('#chat-profile-dialog');
  const drafts = new Map();
  const retryKeys = new Map();
  let rooms = [];
  let people = [];
  let me = null;
  let active = null;
  let messages = [];
  let visible = false;
  let loading = false;
  let sending = false;
  let timer = null;
  let loadController = null;
  let requestedSector = 'producao';
  let selectedTab = 'sectors';
  let search = '';
  let bootstrapPromise = null;
  let hasEarlier = false;
  let pollCount = 0;
  let polling = false;
  let serverCursor = 0;
  let identityGeneration = 0;

  async function api(path, options = {}) {
    const generation = identityGeneration;
    const data = await MSA.firebaseChat.request(path, options);
    if (generation !== identityGeneration) throw new DOMException('Sessão alterada.', 'AbortError');
    return data;
  }

  function feedback(text = '', { retry = false, signIn = false } = {}) {
    document.querySelector('#chat-feedback').hidden = !text;
    document.querySelector('#chat-feedback-text').textContent = text;
    document.querySelector('#chat-retry').hidden = !retry;
    document.querySelector('#chat-sign-in').hidden = !signIn;
  }

  function showError(error) {
    if (error.name === 'AbortError') return;
    feedback(error.status === 401 ? 'Entre para acessar as conversas.' : error.message, {
      retry: error.status !== 401,
      signIn: error.status === 401,
    });
  }

  function setEmpty(title, description) {
    document.querySelector('#chat-empty-title').textContent = title;
    document.querySelector('#chat-empty-description').textContent = description;
    document.querySelector('#chat-empty').hidden = messages.length > 0;
  }

  function updateComposer() {
    const available = Boolean(me && active && !loading);
    input.disabled = !available;
    input.readOnly = sending;
    sendButton.disabled = !available || sending || !input.value.trim();
    sendButton.textContent = sending ? 'Enviando…' : 'Enviar';
    const demoUpdate=document.querySelector('#chat-demo-update');if(demoUpdate){demoUpdate.hidden=!MSA.firebaseChat.demo;demoUpdate.disabled=!available;}
  }

  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }

  function updateIdentity() {
    const label = me ? `${me.name}${me.re ? ` · RE ${me.re}` : ''}` : 'Identificação do funcionário';
    document.querySelector('#chat-identity').textContent = label;
    document.querySelector('#chat-profile-name').textContent = me?.name || '';
    document.querySelector('#chat-profile-button').disabled = !me;
  }

  function conversationButton(conversation, person = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'conversation-button';
    button.dataset.conversation = conversation.id;
    button.setAttribute('aria-current', String(person ? active?.personId === conversation.id : active?.id === conversation.id));
    const initial = document.createElement('span');
    initial.className = 'conversation-initial';
    initial.setAttribute('aria-hidden', 'true');
    initial.textContent = initials(conversation.name);
    const copy = document.createElement('span');
    copy.className = 'conversation-copy';
    const name = document.createElement('span');
    name.className = 'conversation-name';
    name.textContent = conversation.name;
    const note = document.createElement('span');
    note.className = 'conversation-note';
    note.textContent = person ? [conversation.re?`RE ${conversation.re}`:'Conversa individual',conversation.note].filter(Boolean).join(' · ') : conversation.note;
    copy.append(name, note);
    button.append(initial, copy);
    button.addEventListener('click', () => person ? openPerson(conversation) : openConversation(conversation, true));
    return button;
  }

  function renderConversations() {
    const sectorList = document.querySelector('#chat-sector-list');
    const peopleList = document.querySelector('#chat-people-list');
    sectorList.replaceChildren();
    peopleList.replaceChildren();
    const matches = (item) => `${item.name} ${item.re || ''} ${item.note || ''}`.toLocaleLowerCase('pt-BR').includes(search);
    rooms.filter(matches).forEach((room) => sectorList.append(conversationButton(room)));
    people.filter(matches).forEach((person) => peopleList.append(conversationButton(person, true)));
    const empty = document.querySelector('#chat-people-empty');
    empty.hidden = peopleList.children.length > 0;
    empty.textContent = search ? 'Nenhum funcionário encontrado.' : 'Nenhum outro funcionário acessou o chat ainda.';
    let sectorEmpty = document.querySelector('#chat-sectors-empty');
    if (!sectorEmpty) {
      sectorEmpty = document.createElement('p');
      sectorEmpty.id = 'chat-sectors-empty';
      sectorEmpty.className = 'list-empty';
      document.querySelector('#sectors-panel').append(sectorEmpty);
    }
    sectorEmpty.hidden = sectorList.children.length > 0;
    sectorEmpty.textContent = rooms.length ? 'Nenhuma conversa encontrada.' : 'Carregando setores…';
  }

  function selectTab(tab, focus = false) {
    selectedTab = tab;
    tabs.forEach((button) => {
      const selected = button.dataset.chatTab === tab;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected && focus) button.focus();
    });
    document.querySelector('#sectors-panel').hidden = tab !== 'sectors';
    document.querySelector('#people-panel').hidden = tab !== 'people';
  }

  tabs.forEach((button) => {
    button.addEventListener('click', () => selectTab(button.dataset.chatTab));
    button.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = tabs.indexOf(button);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + tabs.length) % tabs.length;
      selectTab(tabs[next].dataset.chatTab, true);
    });
  });

  function messageElement(message) {
    const article = document.createElement('article');
    article.className = `message${message.sender_id === me?.id ? ' is-own' : ''}`;
    const avatar = document.createElement('span');
    avatar.className = 'message-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = initials(message.sender_name);
    const content = document.createElement('div');
    content.className = 'message-content';
    const heading = document.createElement('div');
    heading.className = 'message-heading';
    const author = document.createElement('strong');
    author.textContent = message.sender_name;
    const re = document.createElement('span');
    re.className = 'message-re';
    re.textContent = message.sender_re ? `RE ${message.sender_re}` : '';
    const time = document.createElement('time');
    const date = new Date(message.created_at);
    time.dateTime = date.toISOString();
    time.textContent = date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    time.title = date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const body = document.createElement('p');
    body.className = 'message-body';
    body.textContent = message.body;
    heading.append(author, re, time);
    if(message.simulated){const label=document.createElement('span');label.className='message-re';label.textContent='Mensagem simulada';heading.append(label);}
    content.append(heading, body);
    article.append(avatar, content);
    return article;
  }

  function renderHistory({ scroll = false } = {}) {
    history.setAttribute('aria-live', 'off');
    messageList.replaceChildren(...messages.map(messageElement));
    setEmpty('Nenhuma mensagem nesta conversa', 'Envie a primeira mensagem para iniciar a conversa.');
    document.querySelector('#chat-history-more').hidden = !hasEarlier;
    if (scroll) history.scrollTop = history.scrollHeight;
    history.setAttribute('aria-live', 'polite');
  }

  async function bootstrap() {
    if (bootstrapPromise) return bootstrapPromise;
    const pending = api('bootstrap').then((data) => {
      me = data.me;
      rooms = data.rooms;
      people = data.people;
      updateIdentity();
      renderConversations();
      return data;
    }).finally(() => { if (bootstrapPromise === pending) bootstrapPromise = null; });
    bootstrapPromise = pending;
    return bootstrapPromise;
  }

  async function openConversation(conversation, focus = false) {
    if (active) drafts.set(active.id, input.value);
    loadController?.abort();
    loadController = new AbortController();
    const controller = loadController;
    active = conversation;
    messages = [];
    serverCursor = 0;
    hasEarlier = false;
    loading = true;
    input.value = drafts.get(conversation.id) || '';
    messageList.replaceChildren();
    document.querySelector('#chat-history-more').hidden = true;
    document.querySelector('#chat-thread-title').textContent = conversation.name;
    document.querySelector('#chat-thread-description').textContent = conversation.description;
    view.classList.toggle('mobile-thread-open', focus || view.classList.contains('mobile-thread-open'));
    renderConversations();
    setEmpty('Carregando conversa', 'Aguarde um momento.');
    feedback();
    updateComposer();
    try {
      const data = await api(`messages?conversation=${encodeURIComponent(conversation.id)}`, { signal: controller.signal });
      if (controller !== loadController || !visible) return;
      messages = data.messages;
      serverCursor = messages.at(-1)?.id || 0;
      hasEarlier = data.has_more;
      renderHistory({ scroll: true });
    } catch (error) {
      if (controller !== loadController || !visible) return;
      showError(error);
      setEmpty('Conversa indisponível', 'Seu texto será mantido para tentar novamente.');
    } finally {
      if (controller === loadController) {
        loading = false;
        updateComposer();
        if (focus && visible && !input.disabled) input.focus({ preventScroll: true });
      }
    }
  }

  async function openPerson(person) {
    try {
      const data = await api('threads', { method: 'POST', body: JSON.stringify({ person_id: person.id }) });
      if (!visible) return;
      await openConversation({ id: data.id, personId: person.id, name: person.name, description: person.re ? `Conversa individual · RE ${person.re}` : 'Conversa individual' }, true);
    } catch (error) { showError(error); }
  }

  async function poll() {
    if (!visible || !active || loading || polling || document.hidden || (MSA.auth.mode !== 'demo' && !navigator.onLine)) return;
    polling = true;
    const conversationId = active.id;
    const controller = loadController;
    const after = serverCursor;
    try {
      const data = await api(`messages?conversation=${encodeURIComponent(conversationId)}&after=${after}`);
      if (!visible || active?.id !== conversationId || controller !== loadController) return;
      serverCursor = data.messages.at(-1)?.id || serverCursor;
      if (data.messages.length) {
        const nearBottom = history.scrollHeight - history.scrollTop - history.clientHeight < 100;
        const known = new Set(messages.map((message) => message.id));
        const incoming = data.messages.filter((message) => !known.has(message.id));
        messages.push(...incoming);
        messages.sort((a, b) => a.id - b.id);
        document.querySelector('#chat-empty').hidden = messages.length > 0;
        renderHistory();
        if (nearBottom) history.scrollTop = history.scrollHeight;
      }
      feedback();
      pollCount += 1;
      if (pollCount % 6 === 0) await bootstrap();
    } catch (error) { if (visible && active?.id === conversationId) showError(error); }
    finally { polling = false; }
  }

  document.querySelector('#chat-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || !active || !me || sending || loading) return;
    const conversationId = active.id;
    const previous = retryKeys.get(conversationId);
    const clientKey = previous?.text === text ? previous.key : crypto.randomUUID();
    retryKeys.set(conversationId, { text, key: clientKey });
    sending = true;
    updateComposer();
    feedback();
    try {
      const data = await api('messages', { method: 'POST', body: JSON.stringify({ conversation: conversationId, body: text, client_key: clientKey }) });
      if ((drafts.get(conversationId) || '').trim() === text) drafts.delete(conversationId);
      retryKeys.delete(conversationId);
      if (active?.id === conversationId) {
        if (input.value.trim() === text) { input.value = ''; drafts.delete(conversationId); }
        if (!messages.some((message) => message.id === data.message.id)) {
          messages.push(data.message);
          messages.sort((a, b) => a.id - b.id);
          renderHistory({ scroll: true });
        }
        document.querySelector('#chat-announcement').textContent = 'Mensagem enviada.';
      }
    } catch (error) { if (active?.id === conversationId) showError(error); }
    finally { sending = false; updateComposer(); }
  });

  document.querySelector('#chat-demo-update')?.addEventListener('click',async()=>{
    if(!visible||!active||loading||!MSA.firebaseChat.demo)return;
    const id=active.id,button=document.querySelector('#chat-demo-update');button.disabled=true;
    try{const data=await MSA.firebaseChat.simulateIncoming(id);if(!visible||active?.id!==id)return;if(!messages.some(m=>m.id===data.message.id)){messages.push(data.message);messages.sort((a,b)=>a.id-b.id);serverCursor=Math.max(serverCursor,data.message.id);renderHistory({scroll:true});}document.querySelector('#chat-announcement').textContent='Nova mensagem simulada recebida.';}
    catch(error){showError(error);}finally{updateComposer();}
  });

  input.addEventListener('input', () => {
    if (active) drafts.set(active.id, input.value);
    updateComposer();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (!sendButton.disabled) document.querySelector('#chat-form').requestSubmit();
    }
  });
  document.querySelector('#chat-search').addEventListener('input', (event) => {
    search = event.target.value.trim().toLocaleLowerCase('pt-BR');
    renderConversations();
  });
  document.querySelector('#chat-back').addEventListener('click', () => {
    view.classList.remove('mobile-thread-open');
    const buttons = [...view.querySelectorAll('.conversation-button')];
    const selected = buttons.find((button) => button.getAttribute('aria-current') === 'true' && button.getClientRects().length);
    (selected || tabs.find((tab) => tab.dataset.chatTab === selectedTab)).focus();
  });

  document.querySelector('#chat-history-more').addEventListener('click', async () => {
    if (!active || !messages.length || loading) return;
    const conversationId = active.id;
    const before = messages[0].id;
    const button = document.querySelector('#chat-history-more');
    button.disabled = true;
    const previousHeight = history.scrollHeight;
    const previousScroll = history.scrollTop;
    try {
      const data = await api(`messages?conversation=${encodeURIComponent(conversationId)}&before=${before}`);
      if (!visible || active?.id !== conversationId) return;
      const known = new Set(messages.map((message) => message.id));
      messages.unshift(...data.messages.filter((message) => !known.has(message.id)));
      hasEarlier = data.has_more;
      renderHistory();
      history.scrollTop = previousScroll + history.scrollHeight - previousHeight;
    } catch (error) { showError(error); }
    finally { button.disabled = false; }
  });

  document.querySelector('#chat-profile-button').addEventListener('click', () => {
    if (!me) return;
    document.querySelector('#chat-profile-re').value = me.re || '';
    profileDialog.showModal();
  });
  ['#chat-profile-close', '#chat-profile-cancel'].forEach((selector) => document.querySelector(selector).addEventListener('click', () => profileDialog.close()));

  async function activate(sector) {
    const wasVisible = visible;
    visible = true;
    view.hidden = false;
    requestedSector = sector;
    if (wasVisible) return;
    renderConversations();
    feedback();
    try {
      await bootstrap();
      if (!visible) return;
      const room = active || rooms.find((item) => item.sector === requestedSector) || rooms[0];
      await openConversation(room);
      clearInterval(timer);
      timer = setInterval(poll, 5000);
    } catch (error) {
      showError(error);
      setEmpty('Chat indisponível', 'Tente novamente para carregar as conversas.');
    }
  }

  document.querySelector('#chat-retry').addEventListener('click', async () => {
    feedback();
    try {
      await bootstrap();
      if (!visible) return;
      await openConversation(active || rooms.find((room) => room.sector === requestedSector) || rooms[0]);
      clearInterval(timer);
      timer = setInterval(poll, 5000);
    } catch (error) { showError(error); }
  });
  window.addEventListener('online', poll);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });

  window.MSAChat = {
    show: activate,
    hide() {
      visible = false;
      view.hidden = true;
      if (active) drafts.set(active.id, input.value);
      loadController?.abort();
      clearInterval(timer);
      if (profileDialog.open) profileDialog.close();
    },
    clear() {
      identityGeneration += 1;
      this.hide();
      bootstrapPromise = null;
      drafts.clear();
      retryKeys.clear();
      me = null;
      active = null;
      messages = [];
      rooms = [];
      people = [];
      serverCursor = 0;
      loading = false;
      hasEarlier = false;
      messageList.replaceChildren();
      input.value = '';
      updateIdentity();
      renderConversations();
      updateComposer();
    },
    setSector(sector) {
      requestedSector = sector;
      const conversation = rooms.find((room) => room.sector === sector);
      if (visible && conversation) { selectTab('sectors'); openConversation(conversation, true); }
      else if (!visible) active = null;
    },
  };
})();
