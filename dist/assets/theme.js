/* Preferência visual compartilhada; não altera sessão, formulários ou dados operacionais. */
(() => {
  'use strict';
  const key = 'msa-theme';
  const root = document.documentElement;
  const valid = value => value === 'dark' || value === 'light';
  let saved;
  try { saved = localStorage.getItem(key); } catch {}
  let current = valid(saved) ? saved : 'light';
  const icons = {
    light: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.7 13.1A8.8 8.8 0 0 1 10.9 3.3 8.9 8.9 0 1 0 20.7 13.1Z"/></svg>',
    dark: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
  };
  function update() {
    root.dataset.theme = current;
    document.querySelectorAll('.app-shell').forEach(shell => shell.dataset.plantTheme = current);
    root.style.colorScheme = current;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', current === 'dark' ? '#171f1b' : '#f1f5f3');
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      const next = current === 'dark' ? 'claro' : 'escuro';
      button.setAttribute('aria-label', `Ativar modo ${next}`);
      button.setAttribute('title', `Ativar modo ${next}`);
      button.setAttribute('aria-pressed', String(current === 'dark'));
      button.innerHTML = icons[current] + `<span class="theme-toggle-label">Modo ${next}</span>`;
    });
  }
  function set(theme, persist = true) {
    if (!valid(theme)) return;
    current = theme;
    if (persist) { try { localStorage.setItem(key, theme); } catch {} }
    update();
  }
  update();
  function mount() {
    const slot = document.querySelector('.header-right') || document.querySelector('.auth-masthead') || document.querySelector('.gateway-header') || document.querySelector('.app-header');
    if (slot && !document.querySelector('[data-theme-toggle]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'theme-toggle';
      button.setAttribute('data-theme-toggle', '');
      const before = slot.matches('.header-right') ? slot.querySelector('.notifications-button') : slot.querySelector('#logout');
      slot.insertBefore(button, before || null);
      button.addEventListener('click', () => set(current === 'dark' ? 'light' : 'dark'));
    }
    update();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once:true });
  else mount();
  window.addEventListener('storage', event => { if (event.key === key) set(valid(event.newValue) ? event.newValue : 'light', false); });
})();

