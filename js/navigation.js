/* ============================================================
   navigation.js — Sidebar nav, glass top bar, mobile drawer, FAB
   Public API kept stable for app.js subscribers:
     renderAll, renderTopBar, renderFab, renderView,
     renderSidebar, openDrawer, closeDrawer, mountShell
   ============================================================ */
(function (global) {
  'use strict';

  const CFG   = global.MP_CONFIG;
  const STATE = global.MP_STATE;
  const UI    = global.MP_UI;
  const AUTH  = global.MP_AUTH;
  const SET   = global.MP_SETTINGS;
  const LEC   = global.MP_LECTURES;
  const CHAT  = global.MP_CHAT;
  const QUIZ  = global.MP_QUIZ;

  function el(id) { return document.getElementById(id); }

  // --- Tabs descriptor (single source of truth) ---
  const TAB_DEFS = [
    {
      id: CFG.TABS.LECTURES,
      label: 'Lectures',
      desc:  'Resources & Drive links',
      icon:  'book',
      gradient: 'from-brand-500 to-brand-700',
      ringColor: 'brand'
    },
    {
      id: CFG.TABS.CHAT,
      label: 'Community',
      desc:  'Chat with your batch',
      icon:  'chat',
      gradient: 'from-accent-500 to-accent-700',
      ringColor: 'accent'
    },
    {
      id: CFG.TABS.QUIZ,
      label: 'Quiz',
      desc:  'Test yourself with MCQs',
      icon:  'check',
      gradient: 'from-success-500 to-success-700',
      ringColor: 'success'
    }
  ];

  function counts() {
    return {
      [CFG.TABS.LECTURES]: STATE.state.lectures.length,
      [CFG.TABS.CHAT]:     STATE.state.messages.length,
      [CFG.TABS.QUIZ]:     STATE.state.quizzes.length
    };
  }

  function currentTitle() {
    const t = TAB_DEFS.find(t => t.id === STATE.state.currentTab);
    return t ? t.label : 'MedPortal';
  }

  // ---------- Sidebar ----------
  function renderSidebar() {
    const u = STATE.state.currentUser;
    const root = el('sidebar');
    if (!root) return;
    if (!u) { root.innerHTML = ''; return; }

    const cur = STATE.state.currentTab;
    const c = counts();

    root.innerHTML = `
      <!-- Brand -->
      <div class="px-5 h-16 flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div class="w-9 h-9 rounded-xl bg-brand-grad flex items-center justify-center text-white font-extrabold shadow-glow">M</div>
        <div class="leading-tight">
          <div class="text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-slate-100">MedPortal</div>
          <div class="text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Medical College Hub</div>
        </div>
      </div>

      <!-- Nav -->
      <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        ${TAB_DEFS.map(t => {
          const active = cur === t.id;
          return `
            <button data-nav="${t.id}" class="nav-item group relative w-full flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-xl text-left text-sm font-medium transition
              ${active
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'}">
              ${active ? `<span class="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-gradient-to-b ${t.gradient}"></span>` : ''}
              <span class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition
                ${active
                  ? `bg-gradient-to-br ${t.gradient} text-white shadow-glow`
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'}">
                ${UI.icon(t.icon, 'w-4.5 h-4.5')}
              </span>
              <span class="flex-1 min-w-0">
                <span class="block truncate">${t.label}</span>
                <span class="block text-[11px] font-normal truncate ${active ? 'text-brand-600/80 dark:text-brand-300/80' : 'text-slate-500 dark:text-slate-400'}">${t.desc}</span>
              </span>
              <span class="nav-count text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-full
                ${active ? 'bg-white/70 text-brand-700 dark:bg-brand-900/60 dark:text-brand-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}">${c[t.id] || 0}</span>
            </button>`;
        }).join('')}

        ${u.isAdmin ? `
          <div class="mt-5 px-3">
            <div class="text-[10px] uppercase tracking-[0.18em] font-bold text-slate-400 dark:text-slate-500 mb-2">Admin tools</div>
            <button data-nav-action="settings" class="w-full flex items-center gap-2.5 pl-4 pr-3 py-2 rounded-lg text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition">
              ${UI.icon('shield','w-4 h-4')}
              <span>Settings &amp; privacy</span>
            </button>
          </div>
        ` : ''}
      </nav>

      <!-- Footer / identity -->
      <div class="border-t border-slate-200 dark:border-slate-800 p-3 flex items-center gap-2.5 shrink-0">
        <div class="relative">
          ${UI.avatar(u.fullName, false)}
          <span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success-500 border-2 border-white dark:border-slate-900" title="Online"></span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold truncate text-slate-900 dark:text-slate-100">${UI.ESC(u.fullName)}</div>
          <div class="flex items-center gap-1.5 mt-0.5">
            ${UI.yearBadge(u.year)}
            ${u.isAdmin ? `<span class="text-[10px] px-1.5 py-0.5 rounded-md font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">ADMIN</span>` : `<span class="text-[10px] text-slate-500 dark:text-slate-400">@${UI.ESC(u.username)}</span>`}
          </div>
        </div>
        <button id="btn-settings" class="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400" title="Settings" aria-label="Settings">${UI.icon('settings','w-4.5 h-4.5')}</button>
        <button id="btn-logout" class="p-2 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-300" title="Sign out" aria-label="Sign out">${UI.icon('logout','w-4.5 h-4.5')}</button>
      </div>
    `;

    // Wire nav items
    root.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.setTab(btn.dataset.nav);
        closeDrawer(); // mobile: close on selection
      });
    });
    const settingsBtn = root.querySelector('[data-nav-action="settings"]');
    if (settingsBtn) settingsBtn.addEventListener('click', () => SET.openSettings());

    const sBtn = el('btn-settings');
    const lBtn = el('btn-logout');
    if (sBtn) sBtn.addEventListener('click', () => SET.openSettings());
    if (lBtn) lBtn.addEventListener('click', () => {
      if (confirm('Sign out of MedPortal?')) AUTH.logout();
    });
  }

  // ---------- Top bar (glass + breadcrumb + mobile hamburger) ----------
  function renderTopBar() {
    const u = STATE.state.currentUser;
    const root = el('topbar');
    if (!root) return;
    if (!u) { root.innerHTML = ''; return; }

    const title = currentTitle();
    const tab   = TAB_DEFS.find(t => t.id === STATE.state.currentTab);
    const grad  = tab ? tab.gradient : 'from-brand-500 to-brand-700';

    root.innerHTML = `
      <div class="max-w-6xl mx-auto h-16 flex items-center gap-3 px-3 sm:px-6">
        <button id="btn-drawer" class="md:hidden p-2 -ml-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" title="Open menu" aria-label="Open menu">
          ${UI.icon('menu', 'w-5 h-5')}
        </button>
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="w-7 h-7 rounded-md bg-gradient-to-br ${grad} text-white flex items-center justify-center shadow-glow">${UI.icon(tab ? tab.icon : 'home', 'w-4 h-4')}</span>
          <div class="leading-tight min-w-0">
            <div class="text-[10px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">MedPortal</div>
            <div class="text-base font-bold text-slate-900 dark:text-slate-100 truncate">${UI.ESC(title)}</div>
          </div>
        </div>
        <div class="flex-1"></div>
        <div class="flex items-center gap-2">
          <span class="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <span class="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse-dot"></span>
            <span>Live</span>
          </span>
          <button data-topbar-action="settings" class="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" title="Settings" aria-label="Settings">${UI.icon('settings','w-5 h-5')}</button>
        </div>
      </div>
    `;

    const drawerBtn = el('btn-drawer');
    if (drawerBtn) drawerBtn.addEventListener('click', openDrawer);
    const settingsBtn = root.querySelector('[data-topbar-action="settings"]');
    if (settingsBtn) settingsBtn.addEventListener('click', () => SET.openSettings());
  }

  function openDrawer() {
    const sb = el('sidebar');
    const bd = el('sidebar-backdrop');
    if (!sb) return;
    sb.classList.remove('-translate-x-full');
    sb.classList.add('translate-x-0');
    if (bd) { bd.classList.remove('hidden'); bd.classList.add('block'); }
  }

  function closeDrawer() {
    const sb = el('sidebar');
    const bd = el('sidebar-backdrop');
    if (!sb) return;
    sb.classList.add('-translate-x-full');
    sb.classList.remove('translate-x-0');
    if (bd) { bd.classList.add('hidden'); bd.classList.remove('block'); }
  }

  // ---------- FAB ----------
  function renderFab() {
    const slot = el('fab-slot');
    if (!slot) return;
    const u = STATE.state.currentUser;
    if (!u || !u.isAdmin) { slot.innerHTML = ''; return; }
    const tab = STATE.state.currentTab;
    if (tab === CFG.TABS.LECTURES) {
      slot.innerHTML = `
        <button id="fab" class="w-14 h-14 rounded-full bg-brand-grad hover:brightness-110 text-white shadow-glow-l flex items-center justify-center transition active:scale-95 animate-fade-up" title="Add lecture (admin)" aria-label="Add lecture">
          ${UI.icon('plus','w-6 h-6')}
        </button>`;
      el('fab').addEventListener('click', () => LEC.openAddLecture());
    } else if (tab === CFG.TABS.QUIZ) {
      slot.innerHTML = `
        <button id="fab" class="w-14 h-14 rounded-full bg-success-grad hover:brightness-110 text-white shadow-glow-l flex items-center justify-center transition active:scale-95 animate-fade-up" title="Upload quiz (admin)" aria-label="Upload quiz">
          ${UI.icon('plus','w-6 h-6')}
        </button>`;
      el('fab').addEventListener('click', () => QUIZ.openUploadQuiz());
    } else {
      slot.innerHTML = '';
    }
  }

  function renderView() {
    const view = el('view');
    if (!view) return;
    const tab = STATE.state.currentTab;
    if (tab === CFG.TABS.LECTURES) LEC.render();
    else if (tab === CFG.TABS.CHAT) CHAT.render();
    else if (tab === CFG.TABS.QUIZ) QUIZ.render();
  }

  function renderAll() {
    renderSidebar();
    renderTopBar();
    renderFab();
    renderView();
  }

  function mountShell() {
    const prefs = STATE.state.prefs;
    document.documentElement.classList.toggle('dark', prefs.theme === 'dark');
    document.documentElement.style.fontSize = (prefs.fontScale * 16) + 'px';
    renderAll();
  }

  global.MP_NAV = {
    renderAll, renderTopBar, renderSidebar, renderFab, renderView,
    openDrawer, closeDrawer, mountShell
  };
})(window);
