/* ============================================================
   storage.js — Thin localStorage wrapper with JSON + safe error handling
   ============================================================ */
(function (global) {
  'use strict';

  const STORAGE_KEYS = {
    CHAT: 'medportal_chat'
  };

  function get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[storage] get failed for', key, e);
      return fallback;
    }
  }

  function set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return { ok: true };
    } catch (e) {
      // Most common: QuotaExceededError
      console.error('[storage] set failed for', key, e);
      return { ok: false, error: e };
    }
  }

  function remove(key) {
    try { localStorage.removeItem(key); } catch (e) { console.warn('[storage] remove failed', e); }
  }

  function clearAll() {
    try { localStorage.clear(); } catch (e) { console.warn('[storage] clearAll failed', e); }
  }

  /** Approximate bytes used by a given key (rough — uses stringified length × 2 for UTF-16). */
  function approxBytes(value) {
    try { return JSON.stringify(value).length * 2; } catch { return 0; }
  }

  /** Total approximate storage usage in bytes across all medportal_* keys. */
  function totalBytes() {
    let total = 0;
    const keysObj = global.MP_CONFIG?.KEYS || STORAGE_KEYS;
    for (const k of Object.values(keysObj)) {
      const v = get(k, null);
      if (v !== null) total += approxBytes(v);
    }
    return total;
  }

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'; // Fixed divisor from 1028 to 1024
    return (n / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function loadChat() {
    const chat = get(STORAGE_KEYS.CHAT, []);
    return Array.isArray(chat) ? chat : [];
  }

  function saveMessage(msg) {
    const chat = loadChat();
    chat.push(msg);
    return set(STORAGE_KEYS.CHAT, chat);
  }

  // Expose utilities globally
  global.MP_STORAGE = { 
    get, 
    set, 
    remove, 
    clearAll, 
    totalBytes, 
    formatBytes, 
    approxBytes,
    loadChat,
    saveMessage 
  };

})(window);