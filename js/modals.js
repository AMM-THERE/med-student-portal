/* ============================================================
   modals.js — Generic modal manager (open/close, backdrop, Esc)
   Usage:
     const m = new MP_MODALS.Modal({ title, content, size });
     m.open();
     m.close();
   ============================================================ */
(function (global) {
  'use strict';

  const ESC = global.MP_UTIL.escapeHtml;

  class Modal {
    constructor(opts) {
      this.opts = Object.assign({ title: '', content: '', size: 'md', hideHeader: false }, opts || {});
      this.el = null;
      this._onClose = null;
    }

    setContent(html) {
      this.opts.content = html;
      if (this.el) {
        const body = this.el.querySelector('[data-modal-body]');
        if (body) body.innerHTML = html;
      }
      return this;
    }

    onClose(fn) { this._onClose = fn; return this; }

    open() {
      if (this.el) this.close();

      const sizeClass = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl'
      }[this.opts.size] || 'max-w-lg';

      const root = document.getElementById('modal-root');
      const el = document.createElement('div');
      el.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm modal-backdrop';

      const hideHeader = this.opts.hideHeader;
      const headerHTML = hideHeader ? '' : `
          <div class="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <h2 class="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">${ESC(this.opts.title || '')}</h2>
            <button type="button" data-modal-close class="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-slate-100 dark:hover:bg-slate-800" aria-label="Close">
              ${global.MP_UI.icon('x', 'w-5 h-5')}
            </button>
          </div>
      `;

      el.innerHTML = `
        <div class="relative w-full ${sizeClass} max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden modal-pop" role="dialog" aria-modal="true">
          ${headerHTML}
          <div data-modal-body class="${hideHeader ? '' : 'p-5'} flex-1 overflow-y-auto min-h-0">${this.opts.content || ''}</div>
          ${hideHeader ? `<button type="button" data-modal-close class="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-slate-100 dark:hover:bg-slate-800" aria-label="Close">${global.MP_UI.icon('x', 'w-5 h-5')}</button>` : ''}
        </div>`;
      root.appendChild(el);
      this.el = el;

      // Close handlers
      el.addEventListener('click', (e) => {
        if (e.target === el) this.close();
        if (e.target.closest('[data-modal-close]')) this.close();
      });
      this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
      document.addEventListener('keydown', this._escHandler);

      return this;
    }

    close() {
      if (!this.el) return;
      this.el.classList.add('modal-out');
      const el = this.el;
      this.el = null;
      setTimeout(() => el.remove(), 150);
      document.removeEventListener('keydown', this._escHandler);
      if (typeof this._onClose === 'function') this._onClose();
    }
  }

  function confirmDialog(opts) {
    return new Promise((resolve) => {
      const m = new Modal({
        title: opts.title || 'Confirm',
        size: 'sm',
        content: `
          <p class="text-sm text-slate-700 dark:text-slate-300 mb-5">${ESC(opts.message || '')}</p>
          <div class="flex justify-end gap-2">
            <button type="button" data-confirm-cancel class="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">${ESC(opts.cancelText || 'Cancel')}</button>
            <button type="button" data-confirm-ok class="px-4 py-2 rounded-lg text-sm font-medium text-white ${opts.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-brand-600 hover:bg-brand-700'}">${ESC(opts.okText || 'OK')}</button>
          </div>`
      });
      m.onClose(() => resolve(false));
      m.open();
      m.el.querySelector('[data-confirm-cancel]').addEventListener('click', () => { m.close(); resolve(false); });
      m.el.querySelector('[data-confirm-ok]').addEventListener('click', () => { m.close(); resolve(true); });
    });
  }

  /** Admin-only: add/delete the shared subject list used by Lectures & Quiz filters. */
  function openSubjectManager() {
    const STATE = global.MP_STATE;
    const UI = global.MP_UI;
    const user = STATE.state.currentUser;
    if (!user || !user.isAdmin) return;

    const m = new Modal({ title: 'Manage Subjects', size: 'sm' });

    function bodyHtml() {
      const subjects = STATE.state.subjects || [];
      return `
        <div class="space-y-3">
          <form id="add-subject-form" class="flex gap-2">
            <input id="new-subject-input" type="text" placeholder="e.g. Anatomy" class="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm" />
            <button type="submit" class="px-3 py-2 rounded-lg text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700">Add</button>
          </form>
          <ul class="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            ${subjects.length === 0 ? '<li class="py-2 text-sm text-slate-500">No subjects yet.</li>' : subjects.map(s => `
              <li class="flex items-center justify-between py-2 text-sm text-slate-800 dark:text-slate-200">
                <span>${ESC(s)}</span>
                <button type="button" data-del-subject="${ESC(s)}" class="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30" title="Delete subject">${UI.icon('trash', 'w-4 h-4')}</button>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    function wire() {
      const form = m.el.querySelector('#add-subject-form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = m.el.querySelector('#new-subject-input');
        const err = await addSubjectWrap(input.value);
        if (err) { alert('Could not add subject:\n\n' + err); return; }
        m.setContent(bodyHtml());
        wire();
        if (global.MP_NAV && global.MP_NAV.renderView) global.MP_NAV.renderView();
      });
      m.el.querySelectorAll('[data-del-subject]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const name = btn.dataset.delSubject;
          if (!confirm(`Delete subject "${name}"? Existing lectures/quizzes keep it as text, but it leaves the picker.`)) return;
          const err = await STATE.deleteSubject(name);
          if (err) { alert('Could not delete subject:\n\n' + err); return; }
          m.setContent(bodyHtml());
          wire();
          if (global.MP_NAV && global.MP_NAV.renderView) global.MP_NAV.renderView();
        });
      });
    }

    async function addSubjectWrap(name) {
      const clean = String(name || '').trim();
      if (!clean) return 'Enter a subject name.';
      return await STATE.addSubject(clean);
    }

    m.setContent(bodyHtml());
    m.open();
    wire();
  }

  global.MP_MODALS = { Modal, confirmDialog, openSubjectManager };
})(window);