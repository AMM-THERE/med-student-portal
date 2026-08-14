/* ============================================================
   utils.js — Generic helpers (ids, dates, debounce, file → base64, CSV, Drive)
   ============================================================ */
(function (global) {
  'use strict';

  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  }

  function formatDate(ts) {
    const d = new Date(ts);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return 'Today, ' + time;
    if (isYesterday) return 'Yesterday, ' + time;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + time;
  }

  function debounce(fn, ms) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /** Convert a File to a base64 data URL using FileReader. Rejects on read error. */
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error('FileReader error'));
      r.readAsDataURL(file);
    });
  }

  /** Parse CSV text (RFC-4180 aware: quoted fields, embedded commas, escaped quotes). */
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], n = text[i + 1];
      if (inQuotes) {
        if (c === '"' && n === '"') { cur += '"'; i++; }
        else if (c === '"') { inQuotes = false; }
        else { cur += c; }
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(cur); cur = ''; }
        else if (c === '\r') { /* ignore */ }
        else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
        else { cur += c; }
      }
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    // Drop empty trailing rows
    return rows.filter(r => r.some(v => String(v).trim() !== ''));
  }

  /** Extract a Google Drive file ID from common URL patterns. Returns null if not a Drive file URL. */
  function extractDriveFileId(url) {
    if (!url) return null;
    try {
      const u = new URL(url);
      if (!/drive\.google\.com$/.test(u.hostname.replace(/^www\./, ''))) return null;
      // /file/d/{ID}/view  or  /file/d/{ID}/edit  or  /file/d/{ID}/preview
      const m1 = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (m1) return m1[1];
      // ?id={ID}
      const id = u.searchParams.get('id');
      if (id) return id;
      // /open?id={ID}  /uc?id={ID}
      return null;
    } catch { return null; }
  }

  function isLikelyUrl(s) {
    return typeof s === 'string' && /^https?:\/\//i.test(s.trim());
  }

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  global.MP_UTIL = {
    uid, formatDate, debounce, escapeHtml,
    fileToBase64, parseCSV, extractDriveFileId, isLikelyUrl, clamp
  };
})(window);
