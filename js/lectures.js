/* ============================================================
   lectures.js — Study Hub: list, filter, add (admin), Drive links
   ============================================================ */
(function (global) {
  'use strict';

  const CFG   = global.MP_CONFIG;
  const STATE = global.MP_STATE;
  const UI    = global.MP_UI;
  const UTIL  = global.MP_UTIL;
  const MODALS= global.MP_MODALS;

  // ---- ephemeral filter state ----
  const filter = { year: 'all', subject: 'all', q: '' };

  function view() { return document.getElementById('view'); }

  function applyFilters(list) {
    return list.filter(l => {
      if (filter.year !== 'all' && l.year !== filter.year) return false;
      if (filter.subject !== 'all' && (l.subject || '').toLowerCase() !== filter.subject.toLowerCase()) return false;
      if (filter.q) {
        const q = filter.q.toLowerCase();
        if (!l.title.toLowerCase().includes(q) && !(l.description || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  function render() {
    const v = view();
    if (!v) return;
    const list = applyFilters(STATE.state.lectures);

    const yearOptions = ['all', ...CFG.ACADEMIC_YEARS].map(y =>
      `<option value="${y}" ${filter.year === y ? 'selected' : ''}>${y === 'all' ? 'All years' : y}</option>`).join('');
    const subjects = ['all', ...CFG.DEFAULT_SUBJECTS];
    const subjectOptions = subjects.map(s =>
      `<option value="${UI.ESC(s)}" ${filter.subject === s ? 'selected' : ''}>${s === 'all' ? 'All subjects' : UI.ESC(s)}</option>`).join('');

    v.innerHTML = `
      <div class="flex items-end justify-between gap-3 mb-5">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">Study Hub</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">Lectures organized by year and subject.</p>
        </div>
        <div class="text-xs text-slate-500 dark:text-slate-400">${list.length} of ${STATE.state.lectures.length}</div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <label class="block">
          <span class="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Year</span>
          <select id="f-year" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm">${yearOptions}</select>
        </label>
        <label class="block">
          <span class="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Subject</span>
          <select id="f-subject" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm">${subjectOptions}</select>
        </label>
        <label class="block">
          <span class="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Search</span>
          <input id="f-q" value="${UI.ESC(filter.q)}" placeholder="title or description…" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm" />
        </label>
      </div>

      ${list.length === 0 ? `
        <div class="relative overflow-hidden rounded-3xl hero-soft p-8 sm:p-10 border border-slate-200/60 dark:border-slate-800 animate-fade-up">
          <div class="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-brand-500/10 blur-2xl pointer-events-none"></div>
          <div class="relative max-w-xl">
            <div class="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white items-center justify-center shadow-glow mb-4">${UI.icon('book','w-6 h-6')}</div>
            <h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Your study hub awaits</h2>
            <p class="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-md">Lectures, slides, and Google Drive notes — organized by year and subject. ${STATE.state.currentUser && STATE.state.currentUser.isAdmin ? 'Use the <span class="font-semibold text-brand-700 dark:text-brand-300">+</span> button to add the first one.' : 'Admins can post new resources here.'}</p>
            ${STATE.state.currentUser && STATE.state.currentUser.isAdmin ? `
              <button id="empty-add-lecture" class="cta-lift mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-grad shadow-glow">
                ${UI.icon('plus','w-4 h-4')}<span>Post the first lecture</span>
              </button>` : ''}
          </div>
        </div>
      ` : `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${list.map(lectureCard).join('')}
        </div>
      `}
    `;

    // Wire filters
    v.querySelector('#f-year').addEventListener('change', e => { filter.year = e.target.value; render(); });
    v.querySelector('#f-subject').addEventListener('change', e => { filter.subject = e.target.value; render(); });
    v.querySelector('#f-q').addEventListener('input', UTIL.debounce(e => { filter.q = e.target.value.trim(); render(); }, 150));

    // Hero CTA → opens the same modal as the FAB
    const emptyBtn = v.querySelector('#empty-add-lecture');
    if (emptyBtn) emptyBtn.addEventListener('click', () => openAddLecture());
  }

  function lectureCard(lec) {
    const linksHtml = (lec.driveLinks || []).map((l, i) => {
      const id = UTIL.extractDriveFileId(l.url);
      const href = id ? `https://drive.google.com/file/d/${id}/view` : (UTIL.isLikelyUrl(l.url) ? l.url : '#');
      return `
        <a href="${UI.ESC(href)}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-200 dark:hover:bg-brand-900/50">
          ${UI.icon('link','w-3.5 h-3.5')}
          <span>${UI.ESC(l.label || ('Resource ' + (i + 1)))}</span>
        </a>`;
    }).join('');

    const u = STATE.state.users.find(x => x.id === lec.addedBy);
    return `
      <article class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition">
        <div class="flex items-start justify-between gap-2 mb-2">
          <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug">${UI.ESC(lec.title)}</h3>
          <div class="flex flex-col items-end gap-1 shrink-0">
            <span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400">${UI.ESC(lec.year)}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">${UI.ESC(lec.subject || '—')}</span>
          </div>
        </div>
        ${lec.description ? `<p class="text-sm text-slate-600 dark:text-slate-300 mb-3 line-clamp-3">${UI.ESC(lec.description)}</p>` : ''}
        <div class="flex flex-wrap gap-2 mb-3">${linksHtml || '<span class="text-xs text-slate-400">No resources</span>'}</div>
        <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>Added ${UTIL.formatDate(lec.createdAt)}</span>
          ${u ? `<span>by ${UI.ESC(u.fullName)} ${UI.yearBadge(u.year, { extraClass: 'ml-1' })}</span>` : ''}
        </div>
      </article>
    `;
  }

  function openAddLecture() {
    const u = STATE.state.currentUser;
    if (!u || !u.isAdmin) return;
    const yearOptions = CFG.ACADEMIC_YEARS.map(y => `<option value="${y}">${y}</option>`).join('');
    const subjectOptions = CFG.DEFAULT_SUBJECTS.map(s => `<option value="${s}">${s}</option>`).join('');

    const m = new MODALS.Modal({ title: 'Add Lecture', size: 'lg' });
    m.setContent(`
      <form id="lec-form" class="space-y-3" novalidate>
        <label class="block">
          <span class="text-xs font-medium text-slate-600 dark:text-slate-400">Title *</span>
          <input name="title" required type="text" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Cardiac Physiology — Lecture 5" />
        </label>
        <label class="block">
          <span class="text-xs font-medium text-slate-600 dark:text-slate-400">Description</span>
          <textarea name="description" rows="3" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="What is this lecture about?"></textarea>
        </label>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="block">
            <span class="text-xs font-medium text-slate-600 dark:text-slate-400">Academic Year *</span>
            <select name="year" required class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">${yearOptions}</select>
          </label>
          <label class="block">
            <span class="text-xs font-medium text-slate-600 dark:text-slate-400">Subject *</span>
            <select name="subject" required class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">${subjectOptions}</select>
          </label>
        </div>

        <div>
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-slate-600 dark:text-slate-400">Google Drive links</span>
            <button type="button" id="add-link" class="text-xs text-brand-600 hover:underline">+ Add another</button>
          </div>
          <div id="link-rows" class="mt-2 space-y-2"></div>
        </div>

        <p id="lec-error" class="text-sm text-rose-600 dark:text-rose-400 hidden"></p>
        <div class="flex justify-end gap-2 pt-1">
          <button type="button" data-modal-close class="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
          <button type="submit" class="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700">Post lecture</button>
        </div>
      </form>
    `);
    m.open();

    const rowsEl = m.el.querySelector('#link-rows');
    function addLinkRow(url, label) {
      const idx = rowsEl.children.length;
      const row = document.createElement('div');
      row.className = 'grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-2';
      row.innerHTML = `
        <input data-role="url" type="url" value="${UI.ESC(url || '')}" placeholder="https://drive.google.com/file/d/…/view" class="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm" />
        <input data-role="label" type="text" value="${UI.ESC(label || '')}" placeholder="Label (e.g. Slides PDF)" class="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm" />
        <button type="button" data-role="remove" class="px-2 py-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30" title="Remove">${UI.icon('trash','w-4 h-4')}</button>
      `;
      row.querySelector('[data-role="remove"]').addEventListener('click', () => row.remove());
      rowsEl.appendChild(row);
    }
    addLinkRow();
    m.el.querySelector('#add-link').addEventListener('click', () => addLinkRow());

    m.el.querySelector('#lec-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const errEl = m.el.querySelector('#lec-error');
      errEl.classList.add('hidden');
      const fd = new FormData(e.target);
      const title = String(fd.get('title') || '').trim();
      const description = String(fd.get('description') || '').trim();
      const year = String(fd.get('year') || '').trim();
      const subject = String(fd.get('subject') || '').trim();

      const errs = [];
      if (!title) errs.push('Title is required.');
      if (!year) errs.push('Year is required.');
      if (!subject) errs.push('Subject is required.');

      // Collect drive links
      const driveLinks = [];
      rowsEl.querySelectorAll('[data-role="url"]').forEach((uIn) => {
        const url = uIn.value.trim();
        const label = uIn.parentElement.querySelector('[data-role="label"]').value.trim() || 'Resource';
        if (url) driveLinks.push({ url, label });
      });

      if (driveLinks.length === 0) errs.push('Add at least one Google Drive link.');
      // Validate URLs
      const bad = driveLinks.find(l => !UTIL.isLikelyUrl(l.url));
      if (bad) errs.push('One of the links is not a valid URL.');

      if (errs.length) { errEl.textContent = errs[0]; errEl.classList.remove('hidden'); return; }

      STATE.addLecture({
        id: UTIL.uid('lec'),
        title, description, year, subject,
        driveLinks,
        addedBy: u.id,
        createdAt: Date.now()
      });
      UI.toast('Lecture posted.', { variant: 'success' });
      m.close();
      global.MP_NAV.renderView();
    });
  }

  global.MP_LECTURES = { render, openAddLecture };
})(window);
