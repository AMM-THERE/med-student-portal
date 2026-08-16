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
        // Only fields confirmed to exist on the Supabase `users` table are sent
        // (matches what loadFromDatabase reads back below). If you add columns
        // for academic_id / year / is_admin / role / default_anonymous to that
        // table, add them to this insert too so they sync across devices.
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
        // Requires a `lectures` table in Supabase with matching columns for this
        // to sync across devices. If that table doesn't exist yet, this insert
        // fails silently (logged below) and the lecture still works locally.
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
          // Requires an `author_name` text column on the Supabase `messages`
          // table. Without it, names get lost on reload / other devices and
          // fall back to the generic "Student" placeholder.
          author_name: msg.authorName || null,
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

  /** Delete a message: local optimistic removal + best-effort Supabase sync. */
  async function deleteMessage(msgId) {
    const idx = state.messages.findIndex(m => m.id === msgId);
    if (idx === -1) return;
    state.messages.splice(idx, 1);
    notify({ type: 'messages' });

    if (window.db) {
      try {
        await window.db.from('messages').delete().eq('id', msgId);
      } catch (err) {
        console.error('Error deleting message from Supabase:', err);
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

    // Best-effort: only persists across devices if a `reactions` column
    // exists on the Supabase `messages` table. Fails silently otherwise —
    // reactions still work locally on this device either way.
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
      return null;
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      console.error('createQuiz called with no questions.');
      return null;
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
        return null;
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
      return null;
    }
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

    // Subscribe to new messages inserted by other users
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
          authorName: m.author_name || null,
          text: m.text,
          imageBase64: m.image_base64,
          fileData: m.file_data,
          replyTo: m.reply_to,
          isPinned: m.is_pinned,
          anonymous: m.anonymous,
          reactions: m.reactions || {},
          createdAt: Number(m.created_at)
        }));
      }

      // Best-effort: only succeeds if a `lectures` table exists in Supabase.
      // Fails harmlessly otherwise — lectures still work locally either way.
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

      // Best-effort: only succeeds once the `quizzes` + `quiz_questions`
      // tables exist. Nested select pulls each quiz's questions in one call
      // via the quiz_questions.quiz_id foreign key.
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

      // Per-user data: only load once we know who's logged in.
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
    addMessage,
    togglePinMessage,
    deleteMessage,
    toggleReaction,
    createQuiz,
    submitQuizAttempt,
    toggleSavedQuestion,
    loadFromDatabase
  };

})(window);