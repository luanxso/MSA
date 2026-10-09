/* Shared motion layer. Motion 12.23.24 is bundled locally (MIT). */
(() => {
  'use strict';
  const MSA = window.MSA = window.MSA || {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Map(), keys = new WeakMap(), dialogs = new WeakMap();
  const ease = [.22, 1, .36, 1];
  const enabled = () => !reduced.matches && document.documentElement.dataset.a11yMotion !== 'true' && !document.hidden;
  function stop(element, finish = false) {
    const job = active.get(element);
    if (!job) return;
    active.delete(element); job.control?.cancel(); job.cleanup(); job.resolve(finish);
  }
  function play(element, values, duration = .22, cleanup = () => {}) {
    stop(element);
    if (!enabled() || !window.Motion?.animateMini || !element?.isConnected || !element.getClientRects().length) { cleanup(); return Promise.resolve(true); }
    return new Promise(resolve => {
      const job = { cleanup, resolve, control: null };
      active.set(element, job);
      try {
        job.control = Motion.animateMini(element, values, { duration, ease });
        job.control.then(() => {
          if (active.get(element) !== job) return;
          active.delete(element); job.control.cancel(); cleanup(); resolve(true);
        });
      } catch { active.delete(element); cleanup(); resolve(true); }
    });
  }
  function enter(element, { dialog = false } = {}) {
    if (!element) return Promise.resolve();
    stop(element);
    const oldTransform = element.style.transform, oldOpacity = element.style.opacity;
    return play(element, {
      opacity: [0, 1],
      transform: dialog ? ['translateY(12px) scale(.975)', 'translateY(0px) scale(1)'] : ['translateY(8px)', 'translateY(0px)']
    }, dialog ? .24 : .20, () => { element.style.transform = oldTransform; element.style.opacity = oldOpacity; });
  }
  function show(element) { stop(element); element.hidden = false; return enter(element); }
  function hide(element) {
    stop(element);
    const transform = element.style.transform, opacity = element.style.opacity;
    return play(element, { opacity: 0, transform: 'translateY(-5px)' }, .16,
      () => { element.style.transform = transform; element.style.opacity = opacity; }).then(done => { if (done) element.hidden = true; });
  }
  // Content changes synchronously, so navigation and form focus stay responsive.
  // A stable key prevents live data refreshes from replaying navigation effects.
  function replace(element, html, key) {
    const changed = keys.get(element) !== key;
    keys.set(element, key);
    element.innerHTML = html;
    if (!changed) return;
    // Keep the SVG map outside the transition: transforming its ancestor can
    // temporarily prevent native SVG keyboard focus in Chromium.
    const target = element.querySelector('#ops-tab-content, #analysis-content, #plant-tab-panel, .plant-summary') || element;
    enter(target);
  }
  function prepareDialog(dialog) {
    if (dialogs.has(dialog)) return dialogs.get(dialog);
    const info = { pending: null, generation: 0 };
    dialogs.set(dialog, info);
    dialog.addEventListener('cancel', event => {
      if (event.defaultPrevented) return;
      event.preventDefault(); closeDialog(dialog);
    });
    dialog.addEventListener('close', () => { stop(dialog); dialog.classList.remove('msa-dialog-closing'); });
    return info;
  }
  function openDialog(dialog) {
    const info = prepareDialog(dialog);
    info.generation++; info.pending = null;
    stop(dialog); dialog.classList.remove('msa-dialog-closing');
    if (!dialog.open) dialog.showModal();
    return enter(dialog, { dialog: true });
  }
  function closeDialog(dialog, { immediate = false, returnValue } = {}) {
    if (!dialog?.open) return Promise.resolve();
    const info = prepareDialog(dialog);
    if (immediate || !enabled() || !dialog.isConnected) {
      info.generation++; info.pending = null; stop(dialog);
      dialog.classList.remove('msa-dialog-closing'); dialog.close(returnValue); return Promise.resolve();
    }
    if (info.pending) return info.pending;
    stop(dialog);
    const generation = ++info.generation, transform = dialog.style.transform, opacity = dialog.style.opacity;
    dialog.classList.add('msa-dialog-closing');
    info.pending = play(dialog, { opacity: 0, transform: 'translateY(8px) scale(.98)' }, .16,
      () => { dialog.style.transform = transform; dialog.style.opacity = opacity; }).then(done => {
        if (generation !== info.generation) return;
        info.pending = null; dialog.classList.remove('msa-dialog-closing');
        if (done && dialog.open) dialog.close(returnValue);
      });
    return info.pending;
  }
  function sidebarLayout(sidebar, workspace, backdrop, before, mobile, expanded) {
    if (!before || !enabled()) return;
    if (mobile) {
      const width = sidebar.getBoundingClientRect().width;
      const oldVisibility = sidebar.style.visibility;
      sidebar.style.visibility = 'visible';
      play(sidebar, { transform: [before.transform, expanded ? 'translateX(0px)' : `translateX(-${width}px)`] }, .23,
        () => { sidebar.style.transform = ''; sidebar.style.visibility = oldVisibility; });
      if (expanded || before.drawer) {
        backdrop.hidden = false;
        play(backdrop, { opacity: [expanded ? 0 : 1, expanded ? 1 : 0] }, .20,
          () => { backdrop.style.opacity = ''; }).then(done => { if (done && !expanded) backdrop.hidden = true; });
      }
    } else {
      const width = sidebar.getBoundingClientRect().width, margin = getComputedStyle(workspace).marginLeft;
      play(sidebar, { width: [before.width + 'px', width + 'px'] }, .23, () => { sidebar.style.width = ''; });
      play(workspace, { marginLeft: [before.margin, margin] }, .23, () => { workspace.style.marginLeft = ''; });
      if (expanded) enter(sidebar.querySelector('.sidebar-nav'));
    }
  }
  const stopAll = () => { [...active.keys()].forEach(element => stop(element, true)); };
  reduced.addEventListener('change', () => { stopAll(); document.dispatchEvent(new CustomEvent('msa:motion-preference')); });
  document.addEventListener('msa:accessibility-change', () => { stopAll(); document.dispatchEvent(new CustomEvent('msa:motion-preference')); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopAll(); document.dispatchEvent(new CustomEvent('msa:motion-preference')); });
  // Release animations whose elements disappear during a live data refresh.
  new MutationObserver(() => { for (const element of active.keys()) if (!element.isConnected) stop(element); }).observe(document.documentElement, { childList: true, subtree: true });
  MSA.motion = { enter, show, hide, replace, openDialog, closeDialog, sidebarLayout, stop, get reduced() { return reduced.matches || document.documentElement.dataset.a11yMotion === 'true'; }, enabled };
})();
