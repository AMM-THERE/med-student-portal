/* ============================================================
   settings.js — Settings modal, theme switcher, preferences
   ============================================================ */
(function (global) {
  'use strict';

  function getSTATE()   { return global.MP_STATE || {}; }
  function getSTORAGE() { return global.MP_STORAGE || {}; }
  function getCFG()     { return global.MP_CONFIG || {}; }
  function getUI()      { return global.MP_UI || {}; }

  function applyTheme(theme) {
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  }

  /**
   * Persist prefs under the same key state.js reads on boot
   * (CFG.KEYS.PREFS = 'medportal_prefs'). This used to write to a
   * different, ad-hoc 'mp_prefs' key that state.js never read — so the
   * saved theme never made it back into state.prefs, and refreshing the
   * page silently reset dark mode. Keeping both sides on one key is the
   * actual fix.
   */
  function savePrefs(newPrefs) {
    const STATE = getSTATE();
    const STORAGE = getSTORAGE();
    const CFG = getCFG();
    if (STATE.state) {
      STATE.state.prefs = { ...STATE.state.prefs, ...newPrefs };
    }
    const toSave = STATE.state ? STATE.state.prefs : newPrefs;
    if (CFG && CFG.KEYS && typeof STORAGE.set === 'function') {
      STORAGE.set(CFG.KEYS.PREFS, toSave);
    } else {
      localStorage.setItem('medportal_prefs', JSON.stringify(toSave));
    }
    if (newPrefs.theme) {
      applyTheme(newPrefs.theme);
    }
  }

  function openSettings() {
    const STATE = getSTATE();
    const UI = getUI();
    const prefs = (STATE.state && STATE.state.prefs) || { theme: 'system', defaultAnonymous: false };

    const modalHtml = `
      <div id="settings-modal-backdrop" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6">
          
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              ${UI.icon ? UI.icon('settings', 'w-5 h-5 text-brand-600') : ''}
              Settings & Preferences
            </h3>
            <button id="close-settings-btn" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1">✕</button>
          </div>

          <!-- Theme Switcher -->
          <div class="space-y-2">
            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300">Appearance Theme</label>
            <div class="grid grid-cols-3 gap-2">
              <button data-theme="light" class="theme-opt-btn py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${prefs.theme === 'light' ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}">
                ☀️ Light
              </button>
              <button data-theme="dark" class="theme-opt-btn py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${prefs.theme === 'dark' ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}">
                🌙 Dark
              </button>
              <button data-theme="system" class="theme-opt-btn py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${prefs.theme === 'system' ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'}">
                💻 System
              </button>
            </div>
          </div>

          <!-- Default Anonymous Switcher -->
          <div class="flex items-center justify-between py-2 border-t border-b border-slate-100 dark:border-slate-800">
            <div>
              <div class="text-sm font-semibold text-slate-800 dark:text-slate-200">Default Anonymous Chat</div>
              <div class="text-xs text-slate-500 dark:text-slate-400">Hide your name by default when posting</div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="anon-toggle" class="sr-only peer" ${prefs.defaultAnonymous ? 'checked' : ''}>
              <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:peer-focus:ring-brand-800 peer-checked:bg-brand-600"></div>
            </label>
          </div>

          <div class="pt-2 flex justify-end">
            <button id="save-settings-btn" class="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold text-sm shadow-md transition">
              Save Changes
            </button>
          </div>

        </div>
      </div>
    `;

    const existing = document.getElementById('settings-modal-backdrop');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('settings-modal-backdrop');
    const closeBtn = document.getElementById('close-settings-btn');
    const saveBtn = document.getElementById('save-settings-btn');
    const anonToggle = document.getElementById('anon-toggle');
    const themeBtns = modal.querySelectorAll('.theme-opt-btn');

    let selectedTheme = prefs.theme;

    themeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        selectedTheme = btn.dataset.theme;
        themeBtns.forEach(b => {
          b.classList.remove('border-brand-600', 'bg-brand-50', 'text-brand-700', 'dark:bg-brand-900/40', 'dark:text-brand-300');
          b.classList.add('border-slate-200', 'dark:border-slate-800', 'text-slate-600', 'dark:text-slate-400');
        });
        btn.classList.remove('border-slate-200', 'dark:border-slate-800', 'text-slate-600', 'dark:text-slate-400');
        btn.classList.add('border-brand-600', 'bg-brand-50', 'text-brand-700', 'dark:bg-brand-900/40', 'dark:text-brand-300');
        applyTheme(selectedTheme);
      });
    });

    function closeModal() { modal.remove(); }

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    saveBtn.addEventListener('click', () => {
      savePrefs({
        theme: selectedTheme,
        defaultAnonymous: anonToggle.checked
      });
      closeModal();
      if (global.MP_NAV && global.MP_NAV.renderAll) {
        global.MP_NAV.renderAll();
      }
    });
  }

  // Early paint: apply the saved theme as soon as this script parses,
  // before the DOM is fully mounted, to avoid a flash of the wrong theme.
  // Reads from the same CFG.KEYS.PREFS key that state.js and savePrefs()
  // use, instead of the old mismatched 'mp_prefs' key.
  try {
    const CFG = getCFG();
    const STORAGE = getSTORAGE();
    const key = (CFG && CFG.KEYS && CFG.KEYS.PREFS) || 'medportal_prefs';
    const saved = typeof STORAGE.get === 'function'
      ? STORAGE.get(key, null)
      : JSON.parse(localStorage.getItem(key) || 'null');
    if (saved && saved.theme) applyTheme(saved.theme);
  } catch (e) {}

  global.MP_SETTINGS = { openSettings, applyTheme, savePrefs };
})(window);