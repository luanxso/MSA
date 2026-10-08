/* Preferências locais; somente alertas novos, ativos e autorizados emitem som. */
window.MSA = window.MSA || {};
(() => {
  'use strict';
  const storageKey = 'msa-alert-sound-v1';
  const types = ['Parada', 'Parâmetro', 'Produtividade', 'Lote suspeito', 'Ocorrência'];
  const labels = ['Paradas de máquinas', 'Parâmetros fora do limite', 'Produtividade abaixo da meta', 'Lotes suspeitos / qualidade', 'Ocorrências'];
  const defaults = { enabled: false, types: [...types], sector: 'todos' };
  let saved;
  try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch { /* Usa padrão se indisponível. */ }
  let settings = normalize(saved), audio = null, initialized = false, identity = '', error = '';
  let telemetrySeen = new Map(), seen = new Set(), host = null, sectorOptionsKey = '';
  function normalize(value) {
    return {
      enabled: value?.enabled === true,
      types: Array.isArray(value?.types) ? types.filter(t => value.types.includes(t)) : [...defaults.types],
      sector: typeof value?.sector === 'string' && value.sector ? value.sector : 'todos'
    };
  }
  const enabled = () => settings.enabled && audio?.state === 'running';
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch { /* Mantém a preferência nesta sessão. */ }
  }
  function configure(patch) {
    settings = normalize({ ...settings, ...patch });
    persist(); refresh();
  }
  async function setEnabled(value) {
    error = '';
    configure({ enabled: !!value });
    if (!value) return false;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('unsupported');
      if (!audio || audio.state === 'closed') {
        audio = new AC();
        audio.addEventListener?.('statechange', refresh);
      }
      await audio.resume();
      if (audio.state !== 'running') error = 'O navegador pausou o áudio. Clique em Retomar som.';
    } catch {
      configure({ enabled: false });
      error = 'Não foi possível ativar o áudio neste navegador. Tente novamente.';
    }
    refresh();
    return enabled();
  }
  function beep() {
    if (!enabled()) return false;
    try {
      const oscillator = audio.createOscillator(), gain = audio.createGain(), at = audio.currentTime;
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.frequency.value = 720;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(.04, at + .015);
      gain.gain.linearRampToValueAtTime(0, at + .18);
      oscillator.start(at); oscillator.stop(at + .2);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      return true;
    } catch {
      error = 'O áudio foi interrompido. Desative e ative o som novamente.';
      refresh(); return false;
    }
  }
  function syncIdentity() {
    const user=MSA.auth?.session?.(),nextIdentity=user?.id||user?.re||'';
    if(identity!==nextIdentity){identity=nextIdentity;seen=new Set();telemetrySeen=new Map();initialized=false;}
    return user;
  }
  function updateTelemetry(samples) {
    const user=syncIdentity();let notify=false;
    for(const sample of samples){
      if(!sample||['manual','demo-records'].includes(sample.source))continue;
      const key=sample.source+':'+sample.id,previous=telemetrySeen.get(key),current=new Set();
      const allowed=!user||!MSA.rbac||MSA.rbac.inScope(user,sample);
      for(const alarm of sample.alarms||[]){
        if(alarm.active===false)continue;
        const code=alarm.code||alarm.parameterId||alarm.description;
        current.add(code);
        const tipo=alarm.tipo||(alarm.parameterId?'Parâmetro':/^QUAL/.test(code)?'Lote suspeito':/^PROD/.test(code)?'Produtividade':/^OCO/.test(code)?'Ocorrência':'Parada');
        if(previous&&!previous.has(code)&&allowed&&!sample.stale&&sample.connected!==false&&settings.types.includes(tipo)&&(settings.sector==='todos'||settings.sector===sample.setorId))notify=true;
      }
      // Detecta novos episódios por código, inclusive quando a quantidade de alarmes permanece igual.
      telemetrySeen.set(key,current);
    }
    return notify?beep():false;
  }
  function update(rows) {
    const user = syncIdentity();
    const allowed = rows.filter(r => !user || !MSA.rbac || MSA.rbac.inScope(user, r));
    const fresh = allowed.filter(r => !seen.has(r.id));
    // Registra todos os IDs, mesmo silenciado ou fora dos filtros: não toca históricos ao mudar a seleção.
    for (const r of allowed) seen.add(r.id);
    const notify = initialized && fresh.some(r => r.active !== false && r.status === 'novo' &&
      settings.types.includes(r.tipo) && (settings.sector === 'todos' || settings.sector === r.setorId));
    initialized = true;
    refresh();
    return notify ? beep() : false;
  }
  function status() {
    if (!settings.enabled) return { label: 'Som desligado', state: 'off' };
    if (!enabled()) return { label: 'Som pausado', state: 'paused' };
    if (!settings.types.length) return { label: 'Sem alertas sonoros', state: 'off' };
    return { label: 'Som ativo', state: 'on' };
  }
  function close(restore = false) {
    if (!host) return;
    host.querySelector('#sound-settings').hidden = true;
    host.querySelector('#sound-settings-button').setAttribute('aria-expanded', 'false');
    if (restore) host.querySelector('#sound-settings-button').focus();
  }
  function place() {
    if (host) host.style.setProperty('--sound-panel-top', document.querySelector('.app-header').getBoundingClientRect().bottom + 8 + 'px');
  }
  function refresh() {
    if (!host) return;
    const current = status(), button = host.querySelector('#sound-settings-button');
    host.dataset.soundState = current.state;
    host.querySelector('[data-sound-label]').textContent = current.label;
    button.title = current.label + ' · Configurar alertas sonoros';
    button.setAttribute('aria-label', button.title);
    const toggle = host.querySelector('#sound-enabled');
    toggle.checked = settings.enabled;
    host.querySelector('[data-sound-switch-label]').textContent = 'Ativar alertas sonoros';
    host.querySelector('#sound-resume').hidden = !settings.enabled || enabled();
    host.querySelector('#sound-test').disabled = !enabled();
    host.querySelectorAll('[data-sound-type]').forEach(input => { input.checked = settings.types.includes(input.value); });
    const user = MSA.auth?.session?.();
    const machines = (MSA.data?.state?.maquinas || []).filter(m => user && MSA.rbac.inScope(user, m));
    const sectors = (MSA.config?.sectors || []).filter(s => machines.some(m => m.setorId === s.id) || s.id === user?.setorId);
    const select = host.querySelector('#sound-sector'), key = sectors.map(s => s.id + ':' + s.nome).join('|');
    if (key !== sectorOptionsKey || !select.options.length) {
      select.replaceChildren(new Option('Todos os setores do meu acesso', 'todos'));
      for (const s of sectors) select.add(new Option(s.nome, s.id));
      sectorOptionsKey = key;
    }
    select.value = settings.sector;
    // Um filtro salvo fora do acesso atual fica inativo até o usuário escolher outro setor.
    if (select.value !== settings.sector) {
      select.add(new Option('Setor salvo indisponível neste acesso', settings.sector));
      select.value = settings.sector;
    }
    const message = host.querySelector('#sound-status');
    message.textContent = error || (settings.enabled && !enabled() ? 'Clique em Retomar som para liberar o áudio neste navegador.' :
      !settings.types.length ? 'Selecione pelo menos um tipo para receber avisos com som.' : 'Somente novos alertas dos filtros escolhidos emitem som.');
  }
  function mount() {
    const anchor = document.querySelector('.header-right .notifications-button');
    if (!anchor) return;
    host = document.createElement('div'); host.className = 'header-sound-control';
    host.innerHTML = `<button id="sound-settings-button" class="header-sound-button" type="button" aria-expanded="false" aria-controls="sound-settings">
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path class="sound-waves" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/><path class="sound-muted" d="m16 9 5 6m0-6-5 6"/></svg>
      <span data-sound-label>Som desligado</span><span class="sound-state-dot" aria-hidden="true"></span></button>
      <section id="sound-settings" class="sound-settings-panel" aria-labelledby="sound-settings-title" hidden>
        <div class="sound-settings-heading"><h2 id="sound-settings-title">Alertas sonoros</h2><button type="button" id="sound-close" aria-label="Fechar ajustes de som">×</button></div>
        <label class="sound-switch"><span data-sound-switch-label>Ativar alertas sonoros</span><input type="checkbox" role="switch" id="sound-enabled"></label>
        <fieldset><legend>Avisar com som sobre</legend>${types.map((type, i) => `<label class="sound-type"><input type="checkbox" data-sound-type value="${type}"><span>${labels[i]}</span></label>`).join('')}</fieldset>
        <label class="sound-sector-label" for="sound-sector">Setores acompanhados<select id="sound-sector"></select></label>
        <p id="sound-status" class="sound-settings-note" role="status" aria-live="polite"></p>
        <div class="sound-settings-actions"><button type="button" class="secondary-button" id="sound-resume" hidden>Retomar som</button><button type="button" class="secondary-button" id="sound-test">Testar som</button></div>
      </section>`;
    anchor.before(host);
    host.querySelector('#sound-settings-button').addEventListener('click', () => {
      const panel = host.querySelector('#sound-settings'), open = panel.hidden;
      panel.hidden = !open; host.querySelector('#sound-settings-button').setAttribute('aria-expanded', String(open));
      if (open) { place(); refresh(); host.querySelector('#sound-enabled').focus(); }
    });
    host.querySelector('#sound-close').addEventListener('click', () => close(true));
    host.querySelector('#sound-enabled').addEventListener('change', e => { void setEnabled(e.target.checked); });
    host.querySelectorAll('[data-sound-type]').forEach(input => input.addEventListener('change', () => {
      configure({ types: [...host.querySelectorAll('[data-sound-type]:checked')].map(input => input.value) });
    }));
    host.querySelector('#sound-sector').addEventListener('change', e => configure({ sector: e.target.value }));
    host.querySelector('#sound-resume').addEventListener('click', () => { void setEnabled(true); });
    host.querySelector('#sound-test').addEventListener('click', () => {
      if (beep()) { host.querySelector('#sound-status').textContent = 'Som de teste reproduzido.'; }
    });
    document.addEventListener('click', e => { if (!host.contains(e.target)) close(); });
    host.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); close(true); } });
    host.addEventListener('focusout', e => { if (e.relatedTarget && !host.contains(e.relatedTarget)) close(); });
    window.addEventListener('resize', place);
    refresh();
  }
  MSA.alertSound = {
    setEnabled, configure, update, updateTelemetry, beep,
    toggle: () => setEnabled(!settings.enabled),
    get enabled() { return enabled(); },
    get settings() { return { ...settings, types: [...settings.types] }; },
    get status() { return status(); }
  };
  mount();
})();
