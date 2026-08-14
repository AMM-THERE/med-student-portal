/* ============================================================
   settings.js — Settings modal (Account / Privacy / Appearance)
   ============================================================ */
(function (global) {
  'use strict';

  const CFG   = global.MP_CONFIG;
  const STATE = global.MP_STATE;
  const UI    = global.MP_UI;
  const UTIL  = global.MP_UTIL;
  const STORAGE = global.MP_STORAGE;
  const MODALS = global.MP_MODALS;

  let activeTab = 'account';
  let modal = null;

  function openSettings() {
    const me = STATE.state.currentUser;
    if (!me) return;
    modal = new MODALS.Modal({ title: 'Settings', size: 'lg' });
    modal.onClose(() => { modal = null; });
    // Open FIRST so modal.el exists, then render into it.
    modal.open();
    renderShell();
  }

  function renderShell() {
    if (!modal) return;
    modal.setContent(`
      <div class="flex flex-col sm:flex-row gap-4 min-h-[400px]">
        <nav class="sm:w-44 flex sm:flex-col gap-1 border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-slate-800 pb-2 sm:pb-0 sm:pr-3">
          ${tabBtn('account', 'Account')}
          ${tabBtn('privacy', 'Privacy')}
          ${tabBtn('appearance', 'Appearance')}
        </nav>
        <div class="flex-1 min-w-0">${renderTab(activeTab)}</div>
      </div>
    `);

    // Tab buttons
    modal.el.querySelectorAll('[data-set-tab]').forEach(b => {
      b.addEventListener('click', () => { activeTab = b.dataset.setTab; renderShell(); });
    });

    // Wire the active tab's controls
    if (activeTab === 'account') wireAccount();
    else if (activeTab === 'privacy') wirePrivacy();
    else if (activeTab === 'appearance') wireAppearance();
  }

  function tabBtn(id, label) {
    const active = activeTab === id;
    return `<button data-set-tab="${id}" class="text-left px-3 py-2 rounded-lg text-sm font-medium ${active ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}">${label}</button>`;
  }

  function renderTab(tab) {
    const me = STATE.state.currentUser;
    if (tab === 'account') {
      const yearOptions = CFG.ACADEMIC_YEARS.map(y => `<option value="${y}" ${me.year === y ? 'selected' : ''}>${y}</option>`).join('');
      return `
        <div class="space-y-3">
          <h3 class="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Account details</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label class="block">
              <span class="text-xs text-slate-500 dark:text-slate-400">Full Name</span>
              <input id="acc-name" value="${UI.ESC(me.fullName)}" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </label>
            <label class="block">
              <span class="text-xs text-slate-500 dark:text-slate-400">Display Username</span>
              <input id="acc-username" value="${UI.ESC(me.username)}" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </label>
            <label class="block">
              <span class="text-xs text-slate-500 dark:text-slate-400">Email</span>
              <input value="${UI.ESC(me.email)}" disabled class="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-sm text-slate-500" />
            </label>
            <label class="block">
              <span class="text-xs text-slate-500 dark:text-slate-400">Academic ID / Code</span>
              <input id="acc-id" value="${UI.ESC(me.academicId)}" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </label>
            <label class="block sm:col-span-2">
              <span class="text-xs text-slate-500 dark:text-slate-400">Academic Year</span>
              <select id="acc-year" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">${yearOptions}</select>
            </label>
          </div>
          <div class="flex justify-end pt-1">
            <button id="acc-save" class="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700">Save</button>
          </div>
        </div>
      `;
    }

    if (tab === 'privacy') {
      const anonOn = !!STATE.state.prefs.defaultAnonymous;
      return `
        <div class="space-y-4">
          <h3 class="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Privacy</h3>

          <div class="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div class="p-4 flex items-start gap-4 bg-white dark:bg-slate-900">
              <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white flex items-center justify-center shrink-0 shadow-glow">
                <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 0-4 4v3a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z"/><path d="M5 22h14M7 22V14a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v8"/></svg>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">Default anonymous mode</div>
                    <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">When on, every new chat message you send will be posted anonymously. This applies globally — there's no per-message toggle in the chat composer.</div>
                  </div>
                  <button id="priv-anon" type="button" role="switch" aria-checked="${anonOn}" class="shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition ${anonOn ? 'bg-brand-grad' : 'bg-slate-300 dark:bg-slate-700'}">
                    <span class="inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${anonOn ? 'translate-x-6' : 'translate-x-1'}"></span>
                  </button>
                </div>
                ${me.isAdmin ? `
                  <p class="mt-3 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-2.5 py-1.5 inline-block">
                    As an admin, you'll still see the real author of every anonymous post for moderation purposes.
                  </p>` : ''}
              </div>
            </div>
          </div>

          <div class="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30">
            <div class="text-sm font-medium text-slate-800 dark:text-slate-100 mb-1">How anonymous posts work</div>
            <ul class="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-disc pl-4">
              <li>Other students see only <span class="font-semibold">"Anonymous"</span> with a generic avatar.</li>
              <li>Your name, username, year, and academic ID stay private from the rest of your batch.</li>
              <li>Admins can reveal the real author on anonymous posts for moderation. You can't opt out of that.</li>
              <li>Changing this setting affects only new messages. Messages you've already sent keep their original state.</li>
            </ul>
          </div>
        </div>
      `;
    }

    if (tab === 'appearance') {
      const scale = STATE.state.prefs.fontScale;
      const isDark = STATE.state.prefs.theme === 'dark';
      return `
        <div class="space-y-4">
          <h3 class="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Appearance</h3>

          <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-slate-800 dark:text-slate-100">Theme</span>
              <button id="theme-toggle" class="px-3 py-1.5 rounded-lg text-xs font-semibold ${isDark ? 'bg-slate-800 text-white' : 'bg-white border border-slate-300 text-slate-700'}">${isDark ? '🌙 Dark' : '☀️ Light'}</button>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400">Switches the entire app between light and dark mode.</p>
          </div>

          <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-slate-800 dark:text-slate-100">Font scale</span>
              <span class="text-xs text-slate-500 dark:text-slate-400"><span id="font-pct">${Math.round(scale * 100)}</span>%</span>
            </div>
            <input id="font-scale" type="range" min="${CFG.FONT_MIN * 100}" max="${CFG.FONT_MAX * 100}" step="${CFG.FONT_STEP * 100}" value="${scale * 100}" class="w-full" />
            <div class="flex justify-between text-[10px] text-slate-400 mt-1"><span>A</span><span style="font-size:1.25em">A</span></div>
          </div>

          <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-700">
            <div class="text-sm font-medium text-slate-800 dark:text-slate-100 mb-1">Local storage</div>
            <p class="text-xs text-slate-500 dark:text-slate-400" id="storage-info">Calculating…</p>
            <div class="mt-2 flex gap-2">
              <button id="clear-images" class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">Clear chat images</button>
              <button id="reset-app" class="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20">Reset everything</button>
            </div>
          </div>
        </div>
      `;
    }
    return '';
  }

  function wireAccount() {
    modal.el.querySelector('#acc-save').addEventListener('click', () => {
      const me = STATE.state.currentUser;
      const fullName = modal.el.querySelector('#acc-name').value.trim();
      const username = modal.el.querySelector('#acc-username').value.trim();
      const academicId = modal.el.querySelector('#acc-id').value.trim();
      const year = modal.el.querySelector('#acc-year').value;

      if (!fullName || !username || !academicId || !year) {
        UI.toast('All fields are required.', { variant: 'error' });
        return;
      }
      const taken = STATE.state.users.find(u => u.id !== me.id && u.username.toLowerCase() === username.toLowerCase());
      if (taken) { UI.toast('That username is taken.', { variant: 'error' }); return; }

      STATE.updateUser(me.id, { fullName, username, academicId, year });
      UI.toast('Account updated.', { variant: 'success' });
      modal.close();
      global.MP_NAV.renderAll();
    });
  }

  function wirePrivacy() {
    const toggle = modal.el.querySelector('#priv-anon');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
      const next = !STATE.state.prefs.defaultAnonymous;
      STATE.setPrefs({ defaultAnonymous: next });
      UI.toast(next ? 'Anonymous mode is now ON. New messages will post anonymously.' : 'Anonymous mode is now OFF. New messages will show your name.', { variant: 'info' });
      // Re-render shell so the toggle visual + aria-checked reflects the new state.
      renderShell();
    });
  }

  function wireAppearance() {
    const info = modal.el.querySelector('#storage-info');
    if (info) info.textContent = 'Using ' + STORAGE.formatBytes(STORAGE.totalBytes()) + ' of local storage.';

    const themeBtn = modal.el.querySelector('#theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const next = STATE.state.prefs.theme === 'dark' ? 'light' : 'dark';
        STATE.setPrefs({ theme: next });
        document.documentElement.classList.toggle('dark', next === 'dark');
        UI.toast(next === 'dark' ? 'Dark mode on.' : 'Light mode on.', { variant: 'info' });
        renderShell();
      });
    }

    const slider = modal.el.querySelector('#font-scale');
    const pct = modal.el.querySelector('#font-pct');
    if (slider) {
      slider.addEventListener('input', () => {
        const v = parseInt(slider.value, 10) / 100;
        document.documentElement.style.fontSize = (v * 16) + 'px';
        if (pct) pct.textContent = Math.round(v * 100);
      });
      slider.addEventListener('change', () => {
        const v = parseInt(slider.value, 10) / 100;
        STATE.setPrefs({ fontScale: v });
        UI.toast('Font size saved.', { variant: 'info' });
      });
    }

    const clearImgs = modal.el.querySelector('#clear-images');
    if (clearImgs) {
      clearImgs.addEventListener('click', () => {
        let count = 0;
        STATE.state.messages.forEach(m => { if (m.imageBase64) { m.imageBase64 = null; count++; } });
        if (count) {
          global.MP_STORAGE.set(CFG.KEYS.MESSAGES, STATE.state.messages);
          STATE.emit();
          UI.toast(`Cleared ${count} image(s) from chat.`, { variant: 'success' });
        } else {
          UI.toast('No images to clear.', { variant: 'info' });
        }
        if (info) info.textContent = 'Using ' + STORAGE.formatBytes(STORAGE.totalBytes()) + ' of local storage.';
      });
    }

    const reset = modal.el.querySelector('#reset-app');
    if (reset) {
      reset.addEventListener('click', async () => {
        const ok = await MODALS.confirmDialog({
          title: 'Reset everything?',
          message: 'This clears all users, lectures, messages, quizzes, and preferences on this device. This cannot be undone.',
          okText: 'Reset',
          danger: true
        });
        if (!ok) return;
        global.MP_STORAGE.clearAll();
        UI.toast('All data cleared. Reloading…', { variant: 'info' });
        setTimeout(() => location.reload(), 600);
      });
    }
  }

  global.MP_SETTINGS = { openSettings };
})(window);
