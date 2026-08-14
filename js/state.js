/* ============================================================
   state.js — Reactive Application State synced with Supabase
   ============================================================ */
(function (global) {
  'use strict';

  const STORAGE = global.MP_STORAGE;
  const LISTENERS = new Set();

  const state = {
    currentUser: null,
    users: [],
    messages: [],
    lectures: [],
    quizzes: [],
    quizAttempts: [],
    bookmarks: [],
    viewingYear: null,
    prefs: { theme: 'system', defaultAnonymous: false }
  };

  function notify(changes) {
    LISTENERS.forEach(fn => {
      try { fn(state, changes); } catch (e) { console.error('Listener err:', e); }
    });
  }

  function subscribe(fn) {
    LISTENERS.add(fn);
    return () => LISTENERS.delete(fn);
  }

  // --- Realtime Subscription for Messages ---
  function initRealtime() {
    if (!window.db) return;

    // استقبال الرسائل الجديدة فوراً من Supabase بدون Refresh
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
    state.currentUser = STORAGE.loadSession();
    state.prefs = STORAGE.loadPrefs();

    if (!window.db) return;

    try {
      // 1. جلب المستخدمين
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

      // 2. جلب الرسائل
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
    STORAGE.saveSession(user);
    notify({ type: 'auth' });
  }

  function logout() {
    state.currentUser = null;
    STORAGE.clearSession();
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
    addUser,
    loginAs,
    logout,
    addMessage,
    loadFromDatabase
  };

})(window);