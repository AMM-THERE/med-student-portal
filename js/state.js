/* ============================================================
   state.js — Reactive Application State synced with Supabase Realtime
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

    if (global.MP_NAV && typeof global.MP_NAV.renderAll === 'function') {
      global.MP_NAV.renderAll();
    }
  }

  async function addMessage(msg) {
    // Local optimistic update
    const exists = state.messages.some(m => m.id === msg.id);
    if (!exists) {
      state.messages.push(msg);
      notify({ type: 'messages' });
    }

    if (window.db) {
      try {
        await window.db.from('messages').insert([{
          id: msg.id,
          author_id: msg.authorId,
          text: msg.text || '',
          image_base64: msg.imageBase64 || null,
          file_data: msg.fileData || null,
          reply_to: msg.replyTo || null,
          is_pinned: !!msg.isPinned,
          anonymous: !!msg.anonymous,
          created_at: msg.createdAt
        }]);
      } catch (err) {
        console.error('Error inserting message into Supabase:', err);
      }
    }
  }

  async function togglePinMessage(msgId) {
    const msg = state.messages.find(m => m.id === msgId);
    if (!msg) return;
    msg.isPinned = !msg.isPinned;
    notify({ type: 'messages' });

    if (window.db) {
      try {
        await window.db.from('messages').update({ is_pinned: msg.isPinned }).eq('id', msgId);
      } catch (err) {
        console.error('Error updating pin status:', err);
      }
    }
  }

  function setupRealtime() {
    if (!window.db) return;
    
    // Subscribe to new messages inserted by other users
    window.db
      .channel('public:messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new;
          const formatted = {
            id: newMsg.id,
            authorId: newMsg.author_id,
            text: newMsg.text,
            imageBase64: newMsg.image_base64,
            fileData: newMsg.file_data,
            replyTo: newMsg.reply_to,
            isPinned: newMsg.is_pinned,
            anonymous: newMsg.anonymous,
            createdAt: Number(newMsg.created_at)
          };
          if (!state.messages.some(m => m.id === formatted.id)) {
            state.messages.push(formatted);
            notify({ type: 'messages' });
            if (global.MP_CHAT && state.currentTab === 'chat') {
              global.MP_CHAT.render();
            }
          }
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new;
          const index = state.messages.findIndex(m => m.id === updated.id);
          if (index !== -1) {
            state.messages[index].isPinned = updated.is_pinned;
            notify({ type: 'messages' });
            if (global.MP_CHAT && state.currentTab === 'chat') {
              global.MP_CHAT.render();
            }
          }
        }
      })
      .subscribe();
  }

  async function loadFromDatabase() {
    state.currentUser = getSavedUser();

    if (!window.db) return;

    try {
      const { data: usersData } = await window.db.from('users').select('*');
      if (usersData) {
        state.users = usersData.map(u => ({
          id: u.id,
          fullName: u.full_name,
          username: u.username,
          email: u.email
        }));
      }

      const { data: msgData } = await window.db.from('messages').select('*').order('created_at', { ascending: true });
      if (msgData && msgData.length > 0) {
        state.messages = msgData.map(m => ({
          id: m.id,
          authorId: m.author_id,
          text: m.text,
          imageBase64: m.image_base64,
          fileData: m.file_data,
          replyTo: m.reply_to,
          isPinned: m.is_pinned,
          anonymous: m.anonymous,
          createdAt: Number(m.created_at)
        }));
      }

      notify({ type: 'init' });
      setupRealtime();
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  }

  loadFromDatabase();

  global.MP_STATE = {
    state,
    subscribe,
    setTab,
    addMessage,
    togglePinMessage,
    loadFromDatabase
  };

})(window);