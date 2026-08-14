/* ============================================================
   app.js — Bootstrap on DOMContentLoaded + global error banner
   ============================================================ */
(function (global) {
  'use strict';

  const STATE  = global.MP_STATE;
  const AUTH   = global.MP_AUTH;
  const NAV    = global.MP_NAV;
  const UI     = global.MP_UI;
  const CFG    = global.MP_CONFIG;

  /** Show an error banner at the top of the page when something throws. */
  function showGlobalError(msg) {
    const wrap = document.getElementById('global-error');
    const txt  = document.getElementById('global-error-text');
    if (!wrap || !txt) return;
    txt.textContent = msg || 'Unknown error';
    wrap.classList.remove('hidden');
    wrap.classList.add('block');
  }

  function boot() {
    // Apply persisted preferences to <html>
    const prefs = STATE.state.prefs;
    document.documentElement.classList.toggle('dark', prefs.theme === 'dark');
    document.documentElement.style.fontSize = (prefs.fontScale * 16) + 'px';

    // Wire the global reload button once
    const reload = document.getElementById('global-error-reload');
    if (reload && !reload._wired) {
      reload.addEventListener('click', () => location.reload());
      reload._wired = true;
    }

    try {
      if (!STATE.state.currentUser) {
        const view     = document.getElementById('view');
        const tabbar   = document.getElementById('tabbar'); // legacy alias
        const fab      = document.getElementById('fab-slot');
        const topbar   = document.getElementById('topbar');
        const sidebar  = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (view)    view.innerHTML = '';
        if (fab)     fab.innerHTML = '';
        if (tabbar)  tabbar.innerHTML = '';
        if (sidebar) sidebar.innerHTML = '';
        if (backdrop) backdrop.classList.add('hidden');
        // Top bar gets a minimal brand strip — nothing else
        if (topbar) topbar.innerHTML = `
          <div class="max-w-6xl mx-auto h-16 flex items-center gap-2.5 px-4">
            <div class="w-9 h-9 rounded-xl bg-brand-grad flex items-center justify-center text-white font-extrabold shadow-glow">M</div>
            <div class="leading-tight">
              <div class="text-[15px] font-extrabold tracking-tight">MedPortal</div>
              <div class="text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Medical College Hub</div>
            </div>
          </div>`;
        setTimeout(() => AUTH.showRegistration(), 50);
      } else {
        NAV.mountShell();
      }
    } catch (err) {
      console.error('[MedPortal] boot failed:', err);
      showGlobalError((err && err.message) || 'Boot failed');
    }
  }

  // Catch any uncaught error and surface it as the banner
  if (!window._mpGlobalWired) {
    window.addEventListener('error', (e) => {
      const msg = e && e.error && e.error.message || e && e.message || 'Uncaught error';
      console.error('[MedPortal] window.error:', e.error || e.message);
      showGlobalError(msg);
    });
    window.addEventListener('unhandledrejection', (e) => {
      const msg = e && e.reason && (e.reason.message || String(e.reason)) || 'Promise rejection';
      console.error('[MedPortal] unhandledrejection:', e.reason);
      showGlobalError(msg);
    });
    window._mpGlobalWired = true;
  }

  // Re-render relevant pieces when state changes.
  let lastTab = null;
  STATE.subscribe((s) => {
    if (!s.currentUser) return;
    try {
      const tab = s.currentTab;
      if (tab === CFG.TABS.CHAT && lastTab !== CFG.TABS.CHAT && global.MP_CHAT) {
        global.MP_CHAT.render();
      } else if (tab === CFG.TABS.LECTURES && global.MP_LECTURES) {
        global.MP_LECTURES.render();
      } else if (tab === CFG.TABS.QUIZ && global.MP_QUIZ) {
        global.MP_QUIZ.render();
      }
      lastTab = tab;

      if (global.MP_NAV) {
        global.MP_NAV.renderSidebar();
        global.MP_NAV.renderTopBar();
      }
    } catch (err) {
      console.error('[MedPortal] subscriber failed:', err);
      showGlobalError((err && err.message) || 'Render failed');
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.MP_APP = { boot, showGlobalError };
})(window);