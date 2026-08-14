/* ============================================================
   state.js — Reactive Application State synced with Supabase
   ============================================================ */
(function (global) {
  'use strict';

  const STORAGE = global.MP_STORAGE || {};
  const LISTENERS = new Set();

  const state = {
    currentUser: null,
    currentTab: 'lectures', // Synced with navigation.js requirement
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

  // --- Safe Session Storage Helpers ---
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

  // --- Tab & Year Navigation Helpers ---
  function setTab(tab) {
    if (!tab) return;
    state.currentTab = tab;
    state.activeTab = tab;
    notify({ type: 'tab', tab });
    
    // Trigger immediate UI re-render when switching tabs
    if (global.MP_NAV && typeof global.MP_NAV.renderAll === 'function') {
      global.MP_NAV.renderAll();
    }
  }

  function setViewingYear(year) {
    state.viewingYear = year;
    notify({ type: 'year', year });
  }

  // --- Realtime Subscription for Messages ---
  function initRealtime() {
    if (!window.db) return;

    window.db
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const newMsg = payload.new;
        if (!state.messages.some(m => m.id === newMsg.id)) {
          state.messages.push({
            id: newMsg.id,
            authorId: newMsg.author_id,
            text: newMsg.text,
            imageBase64: newMsg.image_base64,
            fileData: newMsg.file_data,
            replyTo: newMsg.reply_to,
            reactions: newMsg.reactions || {},
            anonymous: newMsg.anonymous,
            createdAt: Number(newMsg.created_at)
          });
          notify({ type: 'messages' });
        }
      })
      .subscribe();
  }

  // --- Sync Initial Data from Supabase ---
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
      // 1. Fetch Users
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

      // 2. Fetch Messages
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
      console.error('Error fetching data from Supabase:', err);
    }
  }

  // --- User Operations ---
  async function addUser(user) {
    state.users.push(user);
    notify({ type: 'users' });

    if (window.db) {
      await window.db.from('users').insert([{
        id: user.id,
        full_name: user.fullName,
        username: user.username,
        email: user.email,
        academic_id: user.academicId,
        academic_year: user.year,
        is_admin: user.isAdmin,
        role: user.role
      }]);
    }
  }

  function loginAs(user) {
    state.currentUser = user;
    state.viewingYear = user.year;
    saveUserSession(user);
    notify({ type: 'auth' });
  }

  function logout() {
    state.currentUser = null;
    clearUserSession();
    notify({ type: 'auth' });
  }

  // --- Message Operations ---
  async function addMessage(msg) {
    state.messages.push(msg);
    notify({ type: 'messages' });

    if (window.db) {
      await window.db.from('messages').insert([{
        id: msg.id,
        author_id: msg.authorId,
        text: msg.text || '',
        image_base64: msg.imageBase64 || null,
        file_data: msg.fileData || null,
        reply_to: msg.replyTo || null,
        reactions: msg.reactions || {},
        anonymous: !!msg.anonymous,
        created_at: msg.createdAt
      }]);
    }
  }

  // Auto initialize on load
  loadFromDatabase();
  initRealtime();

  global.MP_STATE = {
    state,
    subscribe,
    setTab,
    setViewingYear,
    addUser,
    loginAs,
    logout,
    addMessage,
    loadFromDatabase
  };

})(window);