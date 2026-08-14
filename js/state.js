/* ============================================================
   state.js — Reactive Application State synced with Supabase
   ============================================================ */
(function (global) {
  'use strict';

  const STORAGE = global.MP_STORAGE || {};
  const LISTENERS = new Set();

  const state = {
    currentUser: null,
    currentTab: 'lectures',
    activeTab: 'lectures',
    users: [],
    messages: [],
    lectures: [],
    quizzes: [],
    quizAttempts: [],
    bookmarks: [],
    viewingYear: null,
    prefs: { theme: 'system', defaultAnonymous: false }
  };

  function getSavedUser() {
    try {
      if (typeof STORAGE.loadSession === 'function') return STORAGE.loadSession();
      if (typeof STORAGE.getUser === 'function') return STORAGE.getUser();
      const raw = localStorage.getItem('mp_user') || localStorage.getItem('medportal_user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveUserSession(user) {
    try {
      if (typeof STORAGE.saveSession === 'function') return STORAGE.saveSession(user);
      if (typeof STORAGE.saveUser === 'function') return STORAGE.saveUser(user);
      localStorage.setItem('mp_user', JSON.stringify(user));
    } catch (e) {}
  }

  function clearUserSession() {
    try {
      if (typeof STORAGE.clearSession === 'function') return STORAGE.clearSession();
      if (typeof STORAGE.clearUser === 'function') return STORAGE.clearUser();
      localStorage.removeItem('mp_user');
      localStorage.removeItem('medportal_user');
    } catch (e) {}
  }

  function notify(changes) {
    LISTENERS.forEach(fn => {
      try { fn(state, changes); } catch (e) { console.error('Listener err:', e); }
    });
  }

  function subscribe(fn) {
    LISTENERS.add(fn);
    return () => LISTENERS.delete(fn);
  }

  function setTab(tab) {
    if (!tab) return;
    let normalizedTab = tab.toLowerCase();
    if (normalizedTab === 'community') normalizedTab = 'chat';
    if (normalizedTab === 'quizzes') normalizedTab = 'quiz';

    state.currentTab = normalizedTab;
    state.activeTab = normalizedTab;
    notify({ type: 'tab', tab: normalizedTab });

    // Force UI re-render on tab switch
    if (global.MP_NAV && typeof global.MP_NAV.renderAll === 'function') {
      global.MP_NAV.renderAll();
    }
  }

  function setViewingYear(year) {
    state.viewingYear = year;
    notify({ type: 'year', year });
  }

  async function loadFromDatabase() {
    state.currentUser = getSavedUser();
    if (state.currentUser && state.currentUser.year) {
      state.viewingYear = state.currentUser.year;
    }

    if (typeof STORAGE.loadPrefs === 'function') {
      state.prefs = STORAGE.loadPrefs();
    }

    if (!window.db) return;

    try {
      const { data: usersData } = await window.db.from('users').select('*');
      if (usersData) {
        state.users = usersData.map(u => ({
          id: u.id,
          fullName: u.full_name,
          username: u.username,
          email: u.email,
          academicId: u.academic_id,
          year: u.academic_year,
          isAdmin: u.is_admin,
          role: u.role,
          createdAt: new Date(u.created_at).getTime()
        }));
      }

      const { data: msgData } = await window.db.from('messages').select('*').order('created_at', { ascending: true });
      if (msgData) {
        state.messages = msgData.map(m => ({
          id: m.id,
          authorId: m.author_id,
          text: m.text,
          imageBase64: m.image_base64,
          fileData: m.file_data,
          replyTo: m.reply_to,
          reactions: m.reactions || {},
          anonymous: m.anonymous,
          createdAt: Number(m.created_at)
        }));
      }

      notify({ type: 'init' });
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  }

  loadFromDatabase();

  global.MP_STATE = {
    state,
    subscribe,
    setTab,
    setViewingYear,
    loadFromDatabase
  };

})(window);