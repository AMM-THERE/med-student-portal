/* ============================================================
   ui.js — DOM helpers, toasts, year badges, simple icon SVGs
   ============================================================ */
(function (global) {
  'use strict';

  const CFG = global.MP_CONFIG;
  const ESC = global.MP_UTIL.escapeHtml;

  /** Color scheme per academic year — kept consistent across badges. */
  const YEAR_COLORS = {
    'Year 1':  { bg: 'bg-rose-100',    text: 'text-rose-700',    darkBg: 'dark:bg-rose-900/40',    darkText: 'dark:text-rose-300' },
    'Year 2':  { bg: 'bg-orange-100',  text: 'text-orange-700',  darkBg: 'dark:bg-orange-900/40',  darkText: 'dark:text-orange-300' },
    'Year 3':  { bg: 'bg-amber-100',   text: 'text-amber-700',   darkBg: 'dark:bg-amber-900/40',   darkText: 'dark:text-amber-300' },
    'Year 4':  { bg: 'bg-emerald-100', text: 'text-emerald-700', darkBg: 'dark:bg-emerald-900/40', darkText: 'dark:text-emerald-300' },
    'Year 5':  { bg: 'bg-sky-100',     text: 'text-sky-700',     darkBg: 'dark:bg-sky-900/40',     darkText: 'dark:text-sky-300' },
    'Intern':  { bg: 'bg-violet-100',  text: 'text-violet-700',  darkBg: 'dark:bg-violet-900/40',  darkText: 'dark:text-violet-300' }
  };

  /** Year badge — number inside a colored chip: [1], [2], ... or [I] for Intern. */
  function yearBadge(year, opts) {
    opts = opts || {};

    // Guard against undefined/null/numeric year values (e.g. a lecture or
    // quiz author with no year set, or a caller passing a bare number).
    // Without this, `year.replace(...)` below throws
    // "Cannot read properties of undefined (reading 'replace')".
    if (year === undefined || year === null) year = '';
    year = String(year);
    if (year && !year.startsWith('Year') && year !== 'Intern') {
      // Numeric-only values like "1" become "Year 1" so they still match
      // YEAR_COLORS and render a sensible label.
      year = /^\d+$/.test(year) ? `Year ${year}` : year;
    }

    const palette = YEAR_COLORS[year] || { bg: 'bg-slate-100', text: 'text-slate-700', darkBg: 'dark:bg-slate-800', darkText: 'dark:text-slate-300' };
    const label = year === 'Intern' ? 'I' : (year ? year.replace('Year ', '') : '?');
    const titleAttr = opts.title ? ` title="${ESC(opts.title)}"` : '';
    const extra = opts.extraClass ? ' ' + opts.extraClass : '';
    return `<span class="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-md text-[11px] font-bold ${palette.bg} ${palette.text} ${palette.darkBg} ${palette.darkText}${extra}"${titleAttr}>${ESC(label)}</span>`;
  }

  /** Avatar circle with initial or "?" for anonymous. */
  function avatar(name, anonymous) {
    const initial = anonymous ? '?' : (name || '?').trim().charAt(0).toUpperCase();
    const palette = anonymous
      ? 'bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
      : 'bg-brand-500 text-white';
    return `<div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${palette} shrink-0">${ESC(initial)}</div>`;
  }

  // ---- Toasts ----
  function toast(message, opts) {
    opts = opts || {};
    const variant = opts.variant || 'info'; // 'info' | 'success' | 'error'
    const palette = {
      info:    'bg-slate-800 text-white',
      success: 'bg-emerald-600 text-white',
      error:   'bg-rose-600 text-white'
    }[variant] || 'bg-slate-800 text-white';
    const slot = document.getElementById('toast-slot');
    if (!slot) return;
    const el = document.createElement('div');
    el.className = `pointer-events-auto px-4 py-2 rounded-lg shadow-lg text-sm font-medium ${palette} toast-pop`;
    el.textContent = message;
    slot.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(() => el.remove(), 200);
    }, opts.duration || 2800);
  }

  // ---- Simple inline icon SVGs (no external icon library) ----
  function icon(name, cls) {
    cls = cls || 'w-4 h-4';
    const paths = {
      settings: '<path d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.53 1.53 0 0 1-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.53 1.53 0 0 1 .947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.53 1.53 0 0 1 2.287.947c.379 1.561 2.6 1.561 2.978 0a1.53 1.53 0 0 1 2.287-.947c1.372.836 2.942-.734 2.106-2.106a1.53 1.53 0 0 1 .947-2.287c1.561-.379 1.561-2.6 0-2.978a1.53 1.53 0 0 1-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.53 1.53 0 0 1-2.287-.947M10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
      plus:     '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
      send:     '<path d="M3.4 20.4 21 12 3.4 3.6 3 10l12 2-12 2z" fill="currentColor"/>',
      image:    '<path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm4 10 3-4 2 3 3-5 4 6" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
      link:     '<path d="M9 15a4 4 0 0 1 0-6l2-2a4 4 0 1 1 6 6l-1 1M15 9a4 4 0 0 1 0 6l-2 2a4 4 0 1 1-6-6l1-1" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
      logout:   '<path d="M15 17l5-5-5-5M20 12H9M12 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
      clock:    '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
      shield:   '<path d="M12 3 4 6v6c0 4.5 3.2 8.4 8 9 4.8-.6 8-4.5 8-9V6z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
      check:    '<path d="m5 12 5 5L20 7" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
      x:        '<path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      eye:      '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12" stroke="currentColor" stroke-width="1.6" fill="none"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6" fill="none"/>',
      upload:   '<path d="M12 16V4M6 10l6-6 6 6M4 20h16" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
      trash:    '<path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
      menu:     '<path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
      book:     '<path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/><path d="M4 17a3 3 0 0 1 3-3h11" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
      chat:     '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
      home:     '<path d="m3 11 9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
      'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    };
    return `<svg viewBox="0 0 24 24" class="${cls}" aria-hidden="true">${paths[name] || ''}</svg>`;
  }

  global.MP_UI = { yearBadge, avatar, toast, icon, YEAR_COLORS, ESC };
})(window);