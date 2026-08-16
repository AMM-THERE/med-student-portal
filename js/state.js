/* ============================================================
   state.js — Reactive Application State synced with Supabase Realtime
   ============================================================ */
(function (global) {
  'use strict';

  const STORAGE = global.MP_STORAGE || {};
  const LISTENERS = new Set();

  function getSavedUser() {
    try {
      const CFG = global.MP_CONFIG;
      if (CFG && CFG.KEYS && typeof STORAGE.get === 'function') {
        const saved = STORAGE.get(CFG.KEYS.SESSION, null);
        if (saved) return saved;
      }
      if (typeof STORAGE.loadSession === 'function') return STORAGE.loadSession();
      if (typeof STORAGE.getUser === 'function') return STORAGE.getUser();
      const raw = localStorage.getItem('mp_user') || localStorage.getItem('medportal_user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Load saved preferences (theme, font scale, default-anonymous) from
   * localStorage. This used to be missing entirely, which meant `state.prefs`
   * always started at a hardcoded default — so navigation.js's mountShell()
   * would stomp the user's saved dark-mode choice back to light/system on
   * every page refresh. Reading it here, synchronously, before mountShell
   * ever runs, fixes that at the source.
   */
  function getSavedPrefs() {
    try {
      const CFG = global.MP_CONFIG;
      const defaults = (CFG && CFG.DEFAULT_PREFS)
        ? CFG.DEFAULT_PREFS
        : { theme: 'light', fontScale: 1.0, defaultAnonymous: false };
      if (CFG && CFG.KEYS && typeof STORAGE.get === 'function') {
        const saved = STORAGE.get(CFG.KEYS.PREFS, null);
        if (saved) return Object.assign({}, defaults, saved);
      }
      return Object.assign({}, defaults);
    } catch (e) {
      return { theme: 'light', fontScale: 1.0, defaultAnonymous: false };
    }
  }

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
    prefs: getSavedPrefs()
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

  /** Persist the logged-in user to state + localStorage session key. */
  function loginAs(user) {
    if (!user) return;
    state.currentUser = user;
    const CFG = global.MP_CONFIG;
    if (CFG && CFG.KEYS && typeof STORAGE.set === 'function') {
      STORAGE.set(CFG.KEYS.SESSION, user);
    }
    notify({ type: 'auth', user });
  }

  /** Clear the session. */
  function logout() {
    state.currentUser = null;
    const CFG = global.MP_CONFIG;
    if (CFG && CFG.KEYS && typeof STORAGE.remove === 'function') {
      STORAGE.remove(CFG.KEYS.SESSION);
    }
    notify({ type: 'auth', user: null });
  }

  /** Register a new user: local optimistic update + best-effort Supabase sync. */
  async function addUser(user) {
    if (!user) return;
    const exists = state.users.some(u => u.id === user.id);
    if (!exists) {
      state.users.push(user);
      notify({ type: 'users' });
    }

    if (window.db) {
      try {
        await window.db.from('users').insert([{
          id: user.id,
          full_name: user.fullName,
          username: user.username,
          email: user.email
        }]);
      } catch (err) {
        console.error('Error inserting user into Supabase:', err);
      }
    }
  }

  /** Post a new lecture: local optimistic update + best-effort Supabase sync. */
  async function addLecture(lecture) {
    if (!lecture) return;
    const exists = state.lectures.some(l => l.id === lecture.id);
    if (!exists) {
      state.lectures.push(lecture);
      notify({ type: 'lectures' });
    }

    if (window.db) {
      try {
        await window.db.from('lectures').insert([{
          id: lecture.id,
          title: lecture.title,
          description: lecture.description,
          year: lecture.year,
          subject: lecture.subject,
          drive_links: lecture.driveLinks,
          added_by: lecture.addedBy,
          created_at: lecture.createdAt
        }]);
      } catch (err) {
        console.error('Error inserting lecture into Supabase (does the `lectures` table exist?):', err);
      }
    }
  }

  /** Delete a lecture (admin-only, enforced by the caller in lectures.js): local optimistic removal + best-effort Supabase sync. */
  async function deleteLecture(lecId) {
    const idx = state.lectures.findIndex(l => l.id === lecId);
    if (idx === -1) return null;
    state.lectures.splice(idx, 1);
    notify({ type: 'lectures' });

    if (window.db) {
      try {
        const { error } = await window.db.from('lectures').delete().eq('id', lecId);
        if (error) {
          console.error('Error deleting lecture from Supabase:', error);
          return error.message || error.hint || error.details || 'Unknown error deleting from `lectures`.';
        }
      } catch (err) {
        console.error('Error deleting lecture from Supabase:', err);
        return (err && err.message) || String(err);
      }
    }
    return null;
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
          author_name: msg.authorName || null,
          text: msg.text || '',
          image_base64: msg.imageBase64 || null,
          file_data: msg.fileData || null,
          reply_to: msg.replyTo || null,
          is_pinned: !!msg.isPinned,
          anonymous: !!msg.anonymous,
          // Requires an `is_deleted` boolean column (default false) on the
          // Supabase `messages` table — see deleteMessage()/hardDeleteMessage()
          // below. If that column doesn't exist yet, add it or this insert
          // will fail with an "unknown column" error.
          is_deleted: false,
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

  /**
   * Soft-delete a message. Content is kept in place (so admins can still
   * audit what was said and who deleted it) but flagged `isDeleted` so
   * chat.js can hide the real content from non-admins and show a
   * "This message was deleted" placeholder instead. A deleted message is
   * also automatically unpinned — a pinned "deleted" bubble would be
   * confusing in the pinned banner.
   *
   * Permission (own message vs admin) is enforced by the caller in chat.js.
   */
  async function deleteMessage(msgId) {
    const msg = state.messages.find(m => m.id === msgId);
    if (!msg) return;
    msg.isDeleted = true;
    msg.deletedAt = Date.now();
    if (msg.isPinned) msg.isPinned = false;
    notify({ type: 'messages' });

    if (window.db) {
      try {
        // Requires `is_deleted` (bool) + `deleted_at` (int8) columns on the
        // Supabase `messages` table. Falls back to a local-only soft delete
        // on this device if those columns don't exist yet.
        await window.db.from('messages')
          .update({ is_deleted: true, deleted_at: msg.deletedAt, is_pinned: false })
          .eq('id', msgId);
      } catch (err) {
        console.error('Error soft-deleting message in Supabase (does `is_deleted` column exist?):', err);
      }
    }
  }

  /**
   * Permanently remove a message that has already been soft-deleted.
   * Admin-only, enforced by the caller in chat.js — this is the "I don't
   * want to see this deleted message anymore" action.
   */
  async function hardDeleteMessage(msgId) {
    const idx = state.messages.findIndex(m => m.id === msgId);
    if (idx === -1) return;
    state.messages.splice(idx, 1);
    notify({ type: 'messages' });

    if (window.db) {
      try {
        const { error } = await window.db.from('messages').delete().eq('id', msgId);
        if (error) console.error('Error permanently deleting message from Supabase:', error);
      } catch (err) {
        console.error('Error permanently deleting message from Supabase:', err);
      }
    }
  }

  /** Toggle an emoji reaction from the current user on a message. */
  async function toggleReaction(msgId, emoji) {
    const msg = state.messages.find(m => m.id === msgId);
    if (!msg) return;
    const uid = state.currentUser ? state.currentUser.id : 'guest';
    msg.reactions = msg.reactions || {};
    const arr = msg.reactions[emoji] || (msg.reactions[emoji] = []);
    const at = arr.indexOf(uid);
    if (at === -1) arr.push(uid); else arr.splice(at, 1);
    if (arr.length === 0) delete msg.reactions[emoji];
    notify({ type: 'messages' });

    if (window.db) {
      try {
        await window.db.from('messages').update({ reactions: msg.reactions }).eq('id', msgId);
      } catch (err) {
        console.warn('Could not sync reaction to Supabase (does the `reactions` column exist?):', err);
      }
    }
  }

  /**
   * Create a quiz + its questions in Supabase (requires the `quizzes` and
   * `quiz_questions` tables). questions is an array of:
   *   { text, options: { A, B, C, D }, correct: 'A'|'B'|'C'|'D', explanation }
   * Returns the created quiz object (with questions attached) or null on
   * failure.
   */
  async function createQuiz({ title, description, subject, year, questions }) {
    if (!window.db) {
      console.error('Supabase not available — cannot create quiz.');
      return { error: 'Supabase client is not available (window.db is missing).' };
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      console.error('createQuiz called with no questions.');
      return { error: 'No questions to save.' };
    }

    if (state.currentUser) {
      const syncErr = await ensureUserSynced(state.currentUser);
      if (syncErr) {
        return { error: 'Could not verify your account in the database (' + syncErr + '). This likely means Row-Level Security on the `users` table is blocking inserts/updates — check its policies in Supabase.' };
      }
    }

    try {
      const { data: quizRow, error: quizErr } = await window.db
        .from('quizzes')
        .insert([{
          title,
          description: description || null,
          subject: subject || null,
          year: year || null,
          created_by: state.currentUser ? state.currentUser.id : null
        }])
        .select()
        .single();

      if (quizErr || !quizRow) {
        console.error('Error creating quiz (does the `quizzes` table exist?):', quizErr);
        return { error: (quizErr && (quizErr.message || quizErr.hint || quizErr.details)) || 'Unknown error inserting into `quizzes`.' };
      }

      const rows = questions.map((q, i) => ({
        quiz_id: quizRow.id,
        question_text: q.text,
        option_a: q.options.A,
        option_b: q.options.B,
        option_c: q.options.C,
        option_d: q.options.D,
        correct_option: q.correct,
        explanation: q.explanation || null,
        order_index: i
      }));

      const { data: qData, error: qErr } = await window.db
        .from('quiz_questions')
        .insert(rows)
        .select();

      if (qErr) {
        console.error('Error inserting quiz questions (does the `quiz_questions` table exist?):', qErr);
        return { error: (qErr.message || qErr.hint || qErr.details) || 'Unknown error inserting into `quiz_questions`.' };
      }

      const savedRows = qData && qData.length === rows.length ? qData : rows;

      const newQuiz = {
        id: quizRow.id,
        title: quizRow.title,
        description: quizRow.description,
        subject: quizRow.subject,
        year: quizRow.year,
        createdBy: quizRow.created_by,
        createdAt: quizRow.created_at,
        questions: savedRows.map((qq, i) => ({
          id: qq.id || ('local_' + quizRow.id + '_' + i),
          quizId: quizRow.id,
          text: qq.question_text,
          options: { A: qq.option_a, B: qq.option_b, C: qq.option_c, D: qq.option_d },
          correct: qq.correct_option,
          explanation: qq.explanation,
          orderIndex: i
        }))
      };

      state.quizzes.unshift(newQuiz);
      notify({ type: 'quizzes' });
      return newQuiz;
    } catch (err) {
      console.error('Error creating quiz:', err);
      return { error: (err && err.message) || String(err) };
    }
  }

  /**
   * Delete a quiz (admin-only, enforced by the caller in quiz.js): local
   * optimistic removal + best-effort Supabase sync. Child questions are
   * deleted explicitly first in case the `quiz_questions.quiz_id` foreign
   * key doesn't have ON DELETE CASCADE set up.
   */
  async function deleteQuiz(quizId) {
    const idx = state.quizzes.findIndex(q => q.id === quizId);
    if (idx === -1) return null;
    state.quizzes.splice(idx, 1);
    notify({ type: 'quizzes' });

    if (window.db) {
      try {
        await window.db.from('quiz_questions').delete().eq('quiz_id', quizId);
        const { error } = await window.db.from('quizzes').delete().eq('id', quizId);
        if (error) {
          console.error('Error deleting quiz from Supabase:', error);
          return error.message || error.hint || error.details || 'Unknown error deleting from `quizzes`.';
        }
      } catch (err) {
        console.error('Error deleting quiz from Supabase:', err);
        return (err && err.message) || String(err);
      }
    }
    return null;
  }

  /** Record a completed quiz attempt (score out of totalQuestions). */
  async function submitQuizAttempt(quizId, score, totalQuestions) {
    const uid = state.currentUser ? state.currentUser.id : null;
    const local = {
      id: 'attempt_' + Date.now(),
      quizId,
      userId: uid,
      score,
      totalQuestions,
      completedAt: new Date().toISOString()
    };
    state.quizAttempts.push(local);
    notify({ type: 'quizAttempts' });

    if (window.db && uid) {
      try {
        await window.db.from('quiz_attempts').insert([{
          quiz_id: quizId,
          user_id: uid,
          score,
          total_questions: totalQuestions
        }]);
      } catch (err) {
        console.error('Error saving quiz attempt (does the `quiz_attempts` table exist?):', err);
      }
    }
  }

  /** Toggle a "save for later" bookmark on a quiz question for the current user. */
  async function toggleSavedQuestion(questionId) {
    const uid = state.currentUser ? state.currentUser.id : null;
    if (!uid) return;

    const existingIdx = state.bookmarks.findIndex(b => b.questionId === questionId && b.userId === uid);

    if (existingIdx !== -1) {
      state.bookmarks.splice(existingIdx, 1);
      notify({ type: 'bookmarks' });
      if (window.db) {
        try {
          await window.db.from('saved_questions').delete().eq('user_id', uid).eq('question_id', questionId);
        } catch (err) {
          console.error('Error removing saved question:', err);
        }
      }
    } else {
      const local = { id: 'bm_' + Date.now(), userId: uid, questionId };
      state.bookmarks.push(local);
      notify({ type: 'bookmarks' });
      if (window.db) {
        try {
          await window.db.from('saved_questions').insert([{ user_id: uid, question_id: questionId }]);
        } catch (err) {
          console.error('Error saving question (does the `saved_questions` table exist?):', err);
        }
      }
    }
  }

  function setupRealtime() {
    if (!window.db) return;

    window.db
      .channel('public:messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new;
          const formatted = {
            id: newMsg.id,
            authorId: newMsg.author_id,
            authorName: newMsg.author_name || null,
            text: newMsg.text,
            imageBase64: newMsg.image_base64,
            fileData: newMsg.file_data,
            replyTo: newMsg.reply_to,
            isPinned: newMsg.is_pinned,
            anonymous: newMsg.anonymous,
            isDeleted: newMsg.is_deleted || false,
            deletedAt: newMsg.deleted_at ? Number(newMsg.deleted_at) : null,
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
            if (updated.reactions) state.messages[index].reactions = updated.reactions;
            if (typeof updated.is_deleted === 'boolean') state.messages[index].isDeleted = updated.is_deleted;
            if (updated.deleted_at) state.messages[index].deletedAt = Number(updated.deleted_at);
            notify({ type: 'messages' });
            if (global.MP_CHAT && state.currentTab === 'chat') {
              global.MP_CHAT.render();
            }
          }
        } else if (payload.eventType === 'DELETE') {
          const oldMsg = payload.old;
          const index = state.messages.findIndex(m => m.id === oldMsg.id);
          if (index !== -1) {
            state.messages.splice(index, 1);
            notify({ type: 'messages' });
            if (global.MP_CHAT && state.currentTab === 'chat') {
              global.MP_CHAT.render();
            }
          }
        }
      })
      .subscribe();
  }

  /**
   * Ensure the given user's row exists in Supabase's `users` table.
   * Several tables (quizzes.created_by, quiz_attempts.user_id,
   * saved_questions.user_id) have a foreign key on users(id). If a user's
   * row never made it into Supabase (e.g. they registered before this sync
   * existed, or the original insert failed), every one of those features
   * fails with a foreign-key violation. Upserting here on every app load
   * heals that automatically — a no-op if the row is already there.
   */
  async function ensureUserSynced(user) {
    if (!user) return 'No logged-in user.';
    if (!window.db) return 'Supabase client is not available.';
    try {
      const { error } = await window.db.from('users').upsert([{
        id: user.id,
        full_name: user.fullName,
        username: user.username,
        email: user.email
      }], { onConflict: 'id' });
      if (error) {
        console.warn('Could not sync current user to Supabase (quizzes/attempts/bookmarks may fail until this succeeds):', error);
        return error.message || error.hint || error.details || 'Unknown error syncing user to Supabase.';
      }
      return null;
    } catch (err) {
      console.warn('Could not sync current user to Supabase (quizzes/attempts/bookmarks may fail until this succeeds):', err);
      return (err && err.message) || String(err);
    }
  }

  async function loadFromDatabase() {
    state.currentUser = getSavedUser();

    if (!window.db) return;

    await ensureUserSynced(state.currentUser);

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
          authorName: m.author_name || null,
          text: m.text,
          imageBase64: m.image_base64,
          fileData: m.file_data,
          replyTo: m.reply_to,
          isPinned: m.is_pinned,
          anonymous: m.anonymous,
          reactions: m.reactions || {},
          isDeleted: m.is_deleted || false,
          deletedAt: m.deleted_at ? Number(m.deleted_at) : null,
          createdAt: Number(m.created_at)
        }));
      }

      try {
        const { data: lecData } = await window.db.from('lectures').select('*');
        if (lecData && lecData.length > 0) {
          state.lectures = lecData.map(l => ({
            id: l.id,
            title: l.title,
            description: l.description,
            year: l.year,
            subject: l.subject,
            driveLinks: l.drive_links,
            addedBy: l.added_by,
            createdAt: Number(l.created_at)
          }));
        }
      } catch (err) {
        console.warn('No `lectures` table found in Supabase yet — lectures will stay local-only until it is created.');
      }

      try {
        const { data: quizData } = await window.db
          .from('quizzes')
          .select('*, quiz_questions(*)')
          .order('created_at', { ascending: false });

        if (quizData) {
          state.quizzes = quizData.map(q => ({
            id: q.id,
            title: q.title,
            description: q.description,
            subject: q.subject,
            year: q.year,
            createdBy: q.created_by,
            createdAt: q.created_at,
            questions: (q.quiz_questions || [])
              .slice()
              .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
              .map(qq => ({
                id: qq.id,
                quizId: qq.quiz_id,
                text: qq.question_text,
                options: { A: qq.option_a, B: qq.option_b, C: qq.option_c, D: qq.option_d },
                correct: qq.correct_option,
                explanation: qq.explanation,
                orderIndex: qq.order_index
              }))
          }));
        }
      } catch (err) {
        console.warn('No `quizzes` table found in Supabase yet — run the quiz schema SQL to enable quizzes.');
      }

      if (state.currentUser) {
        try {
          const { data: attemptsData } = await window.db
            .from('quiz_attempts')
            .select('*')
            .eq('user_id', state.currentUser.id);
          if (attemptsData) {
            state.quizAttempts = attemptsData.map(a => ({
              id: a.id,
              quizId: a.quiz_id,
              userId: a.user_id,
              score: a.score,
              totalQuestions: a.total_questions,
              completedAt: a.completed_at
            }));
          }
        } catch (err) {
          console.warn('No `quiz_attempts` table found in Supabase yet.');
        }

        try {
          const { data: savedData } = await window.db
            .from('saved_questions')
            .select('*')
            .eq('user_id', state.currentUser.id);
          if (savedData) {
            state.bookmarks = savedData.map(s => ({
              id: s.id,
              userId: s.user_id,
              questionId: s.question_id
            }));
          }
        } catch (err) {
          console.warn('No `saved_questions` table found in Supabase yet.');
        }
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
    addUser,
    loginAs,
    logout,
    addLecture,
    deleteLecture,
    addMessage,
    togglePinMessage,
    deleteMessage,
    hardDeleteMessage,
    toggleReaction,
    createQuiz,
    deleteQuiz,
    submitQuizAttempt,
    toggleSavedQuestion,
    loadFromDatabase
  };

})(window);