/* ============================================================
   quiz.js — Quiz Hub, Excel/CSV import, exam runner, results,
             "save for later" bookmarks, and admin delete
   ============================================================ */
(function (global) {
  'use strict';

  function getSTATE() { return global.MP_STATE || {}; }
  function getUI()    { return global.MP_UI || {}; }
  function getCFG()   { return global.MP_CONFIG || {}; }
  function getMODALS(){ return global.MP_MODALS || {}; }
  function getUTIL()  { return global.MP_UTIL || {}; }
  function el(id)     { return document.getElementById(id); }

  // ---- Module-local exam-run state (not persisted until finished) ----
  let currentRun = null;
  let showingResults = false;
  let parsedUpload = null;

  // ---- ephemeral hub search state ----
  const filter = { q: '' };

  const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

  /* ---------------------------------------------------------
     File parsing (Excel/CSV) — accepts English or Arabic headers
     --------------------------------------------------------- */

  const HEADER_CANDIDATES = {
    question: ['question', 'questions', 'q', 'السؤال', 'سؤال'],
    A: ['optiona', 'option a', 'a', 'اختيار1', 'اختيار 1', 'الاختيار الأول', 'اختيار أ'],
    B: ['optionb', 'option b', 'b', 'اختيار2', 'اختيار 2', 'الاختيار الثاني', 'اختيار ب'],
    C: ['optionc', 'option c', 'c', 'اختيار3', 'اختيار 3', 'الاختيار الثالث', 'اختيار ج'],
    D: ['optiond', 'option d', 'd', 'اختيار4', 'اختيار 4', 'الاختيار الرابع', 'اختيار د'],
    correct: ['correctanswer', 'correct answer', 'answer', 'correct', 'الإجابة الصحيحة', 'الاجابة الصحيحة', 'الإجابة'],
    explanation: ['explanation', 'why', 'reason', 'الشرح', 'التفسير', 'السبب']
  };

  function normalizeHeader(h) {
    return String(h == null ? '' : h).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function findColumn(headers, candidates) {
    const norm = headers.map(normalizeHeader);
    for (const cand of candidates) {
      const idx = norm.indexOf(normalizeHeader(cand));
      if (idx !== -1) return idx;
    }
    return -1;
  }

  function resolveCorrectLetter(rawAnswer, options) {
    const val = String(rawAnswer == null ? '' : rawAnswer).trim();
    if (!val) return null;
    const letterMap = { a: 'A', b: 'B', c: 'C', d: 'D', '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
    const lower = val.toLowerCase();
    if (letterMap[lower]) return letterMap[lower];

    const keys = ['A', 'B', 'C', 'D'];
    for (const k of keys) {
      if (String(options[k] == null ? '' : options[k]).trim() === val) return k;
    }
    return null;
  }

  function parseQuizFile(file) {
    return new Promise((resolve, reject) => {
      if (!global.XLSX) {
        reject(new Error('Excel/CSV parser (SheetJS) is not loaded.'));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read the file.'));
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target.result);
          const workbook = global.XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          const rows = global.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

          if (!rows || rows.length < 2) {
            resolve({ questions: [], errors: ['The file has no data rows below the header.'] });
            return;
          }

          const headers = rows[0];
          const colQ = findColumn(headers, HEADER_CANDIDATES.question);
          const colA = findColumn(headers, HEADER_CANDIDATES.A);
          const colB = findColumn(headers, HEADER_CANDIDATES.B);
          const colC = findColumn(headers, HEADER_CANDIDATES.C);
          const colD = findColumn(headers, HEADER_CANDIDATES.D);
          const colCorrect = findColumn(headers, HEADER_CANDIDATES.correct);
          const colExplanation = findColumn(headers, HEADER_CANDIDATES.explanation);

          if (colQ === -1 || colA === -1 || colB === -1 || colC === -1 || colD === -1 || colCorrect === -1) {
            resolve({
              questions: [],
              errors: [
                'Could not find the required columns. Expected a question column, 4 option columns, and a correct-answer column (English or Arabic headers are both fine).'
              ]
            });
            return;
          }

          const questions = [];
          const errors = [];

          for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.every(cell => String(cell == null ? '' : cell).trim() === '')) continue;

            const text = String(row[colQ] == null ? '' : row[colQ]).trim();
            const options = {
              A: String(row[colA] == null ? '' : row[colA]).trim(),
              B: String(row[colB] == null ? '' : row[colB]).trim(),
              C: String(row[colC] == null ? '' : row[colC]).trim(),
              D: String(row[colD] == null ? '' : row[colD]).trim()
            };
            const explanation = colExplanation !== -1 ? String(row[colExplanation] == null ? '' : row[colExplanation]).trim() : '';

            if (!text || !options.A || !options.B || !options.C || !options.D) {
              errors.push(`Row ${r + 1}: missing question text or one of the 4 options — skipped.`);
              continue;
            }

            const correct = resolveCorrectLetter(row[colCorrect], options);
            if (!correct) {
              errors.push(`Row ${r + 1}: couldn't match the correct answer ("${row[colCorrect]}") to A/B/C/D — skipped.`);
              continue;
            }

            questions.push({ text, options, correct, explanation });
          }

          resolve({ questions, errors });
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  /* ---------------------------------------------------------
     Shared helpers
     --------------------------------------------------------- */

  function isQuestionSaved(questionId) {
    const STATE = getSTATE();
    const st = STATE.state || {};
    const uid = st.currentUser ? st.currentUser.id : null;
    return (st.bookmarks || []).some(b => b.questionId === questionId && b.userId === uid);
  }

  function lastAttemptFor(quizId) {
    const STATE = getSTATE();
    const st = STATE.state || {};
    const uid = st.currentUser ? st.currentUser.id : null;
    const attempts = (st.quizAttempts || []).filter(a => a.quizId === quizId && a.userId === uid);
    if (attempts.length === 0) return null;
    return attempts.reduce((latest, a) => (!latest || new Date(a.completedAt) > new Date(latest.completedAt)) ? a : latest, null);
  }

  /** Matches the Quiz Hub search box against a quiz's title and subject —
   *  so typing "anatomy" finds every quiz tagged with that subject. */
  function applyQuizFilter(list) {
    if (!filter.q) return list;
    const q = filter.q.toLowerCase();
    return list.filter(qz =>
      (qz.title || '').toLowerCase().includes(q) ||
      (qz.subject || '').toLowerCase().includes(q)
    );
  }

  /* ---------------------------------------------------------
     Main render dispatcher
     --------------------------------------------------------- */

  function render() {
    const view = el('view');
    if (!view) return;

    if (currentRun && !showingResults) {
      renderExamQuestion(view);
    } else if (currentRun && showingResults) {
      renderResults(view);
    } else {
      renderHub(view);
    }
  }

  /* ---------------------------------------------------------
     Quiz Hub — search, list of quizzes + "Saved for Review" box
     --------------------------------------------------------- */

  function renderHub(view) {
    const STATE = getSTATE();
    const UI = getUI();
    const UTIL = getUTIL();
    const st = STATE.state || {};
    const allQuizzes = st.quizzes || [];
    const quizzes = applyQuizFilter(allQuizzes);
    const user = st.currentUser;

    const savedItems = [];
    (st.bookmarks || []).forEach(bm => {
      if (user && bm.userId !== user.id) return;
      for (const quiz of allQuizzes) {
        const q = (quiz.questions || []).find(qq => qq.id === bm.questionId);
        if (q) { savedItems.push({ quiz, question: q }); break; }
      }
    });

    view.innerHTML = `
      <div class="max-w-5xl mx-auto space-y-6 pb-12 animate-fade-in">
        <div class="bg-gradient-to-r from-success-500/10 via-brand-500/10 to-transparent p-6 rounded-2xl border border-success-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Quiz Hub</h1>
            <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">Test your medical knowledge with practice MCQs.</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            ${savedItems.length > 0 ? `
              <button id="btn-saved-questions" class="relative p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-300/50 dark:border-amber-700/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition" title="Saved for Review">
                <span class="text-lg leading-none">🔖</span>
                <span class="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">${savedItems.length}</span>
              </button>
            ` : ''}
            ${user && user.isAdmin ? `
              <button id="btn-upload-quiz-banner" class="px-4 py-2.5 bg-success-600 hover:bg-success-700 text-white rounded-xl font-bold text-sm shadow-md transition flex items-center gap-2">
                ${UI.icon ? UI.icon('plus', 'w-4 h-4') : '+'}
                <span>Create Quiz</span>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Search -->
        <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <label class="block flex-1">
            <span class="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Search</span>
            <input id="quiz-search" value="${UI.ESC ? UI.ESC(filter.q) : filter.q}" placeholder="title or subject (e.g. Anatomy)…" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-sm" />
          </label>
          <div class="text-xs text-slate-500 dark:text-slate-400 shrink-0 self-end pb-1.5">${quizzes.length} of ${allQuizzes.length}</div>
        </div>

        ${quizzes.length === 0 ? `
          <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3 shadow-sm">
            <div class="w-16 h-16 rounded-2xl bg-success-50 dark:bg-success-900/30 text-success-600 flex items-center justify-center mx-auto text-3xl">📝</div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100">${allQuizzes.length === 0 ? 'No Quizzes Available Yet' : 'No quizzes match your search'}</h3>
            <p class="text-sm text-slate-500 max-w-md mx-auto">${allQuizzes.length === 0 ? 'Upload a quiz spreadsheet to help batch mates practice for upcoming exams.' : 'Try a different title or subject.'}</p>
            ${user && user.isAdmin && allQuizzes.length === 0 ? `
              <button id="btn-upload-quiz-empty" class="mt-4 px-5 py-2.5 bg-success-600 hover:bg-success-700 text-white rounded-xl font-bold text-sm transition inline-flex items-center gap-2 shadow-md">
                ${UI.icon ? UI.icon('plus', 'w-4 h-4') : '+'}
                <span>Upload First Quiz</span>
              </button>
            ` : ''}
          </div>
        ` : `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${quizzes.map(q => {
              const last = lastAttemptFor(q.id);
              const count = (q.questions || []).length;
              return `
                <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition space-y-3">
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <h4 class="font-bold text-slate-900 dark:text-slate-100 truncate">${UI.ESC ? UI.ESC(q.title) : q.title}</h4>
                      <p class="text-xs text-slate-500 mt-0.5">${count} Question${count === 1 ? '' : 's'}${q.subject ? ' · ' + (UI.ESC ? UI.ESC(q.subject) : q.subject) : ''}</p>
                    </div>
                    <div class="flex flex-col items-end gap-1 shrink-0">
                      ${UI.yearBadge ? UI.yearBadge(q.year) : ''}
                      ${user && user.isAdmin ? `<button class="btn-delete-quiz p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition" data-id="${q.id}" title="Delete quiz">${UI.icon ? UI.icon('trash', 'w-3.5 h-3.5') : '🗑️'}</button>` : ''}
                    </div>
                  </div>
                  ${last ? `<p class="text-xs font-semibold text-brand-600 dark:text-brand-400">Last score: ${last.score}/${last.totalQuestions}</p>` : ''}
                  <button class="btn-start-quiz w-full py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 font-semibold text-sm rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed" data-quiz-id="${q.id}" ${count === 0 ? 'disabled' : ''}>Start Quiz</button>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;

    const btnBanner = el('btn-upload-quiz-banner');
    const btnEmpty = el('btn-upload-quiz-empty');
    if (btnBanner) btnBanner.addEventListener('click', openUploadQuiz);
    if (btnEmpty) btnEmpty.addEventListener('click', openUploadQuiz);

    const savedBtn = el('btn-saved-questions');
    if (savedBtn) savedBtn.addEventListener('click', openSavedQuestions);

    const searchInput = el('quiz-search');
    if (searchInput && UTIL.debounce) {
      searchInput.addEventListener('input', UTIL.debounce(e => {
        filter.q = e.target.value.trim();
        render();
      }, 150));
    }

    document.querySelectorAll('.btn-start-quiz').forEach(b => {
      b.addEventListener('click', () => startQuiz(b.dataset.quizId));
    });

    // Admin-only quiz delete
    document.querySelectorAll('.btn-delete-quiz').forEach(b => {
      b.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = b.dataset.id;
        if (confirm('Delete this quiz? This cannot be undone.')) {
          const err = await STATE.deleteQuiz(id);
          if (err) {
            alert('Could not delete the quiz:\n\n' + err);
          } else if (UI.toast) {
            UI.toast('Quiz deleted.', { variant: 'info' });
          }
          render();
        }
      });
    });
  }

  /* ---------------------------------------------------------
     Saved-for-Review modal
     --------------------------------------------------------- */

  function openSavedQuestions() {
    const STATE = getSTATE();
    const UI = getUI();
    const MODALS = getMODALS();
    if (!MODALS.Modal) return;

    function buildItems() {
      const st = STATE.state || {};
      const user = st.currentUser;
      const quizzes = st.quizzes || [];
      const items = [];
      (st.bookmarks || []).forEach(bm => {
        if (user && bm.userId !== user.id) return;
        for (const quiz of quizzes) {
          const q = (quiz.questions || []).find(qq => qq.id === bm.questionId);
          if (q) { items.push({ quiz, question: q }); break; }
        }
      });
      return items;
    }

    function listHtml() {
      const items = buildItems();
      if (items.length === 0) {
        return `<p class="text-sm text-slate-500 dark:text-slate-400 text-center py-8">No saved questions yet.</p>`;
      }
      return `
        <div class="space-y-2">
          ${items.map(({ quiz, question }) => `
            <div class="bg-white dark:bg-slate-900 rounded-xl border border-amber-200/60 dark:border-amber-800/40 p-3 flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs text-slate-500 font-semibold uppercase tracking-wide">${UI.ESC ? UI.ESC(quiz.title) : quiz.title}</p>
                <p class="text-sm text-slate-800 dark:text-slate-200 mt-0.5">${UI.ESC ? UI.ESC(question.text) : question.text}</p>
                <p class="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">Correct: ${question.correct}) ${UI.ESC ? UI.ESC(question.options[question.correct] || '') : (question.options[question.correct] || '')}</p>
                ${question.explanation ? `<p class="text-xs text-slate-500 mt-0.5">${UI.ESC ? UI.ESC(question.explanation) : question.explanation}</p>` : ''}
              </div>
              <button class="btn-unsave-modal shrink-0 text-xs px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold" data-qid="${question.id}">Remove</button>
            </div>
          `).join('')}
        </div>
      `;
    }

    const m = new MODALS.Modal({ title: '🔖 Saved for Review', size: 'lg' });
    m.setContent(listHtml());
    m.open();

    function wireRemoveButtons() {
      m.el.querySelectorAll('.btn-unsave-modal').forEach(b => {
        b.addEventListener('click', async () => {
          await STATE.toggleSavedQuestion(b.dataset.qid);
          m.setContent(listHtml());
          wireRemoveButtons();
          render();
        });
      });
    }
    wireRemoveButtons();
  }

  /* ---------------------------------------------------------
     Upload modal — file parse, live preview, create
     --------------------------------------------------------- */

  function openUploadQuiz() {
    const UI = getUI();
    const STATE = getSTATE();
    const CFG = getCFG();
    const years = (CFG.ACADEMIC_YEARS || ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Intern']);

    parsedUpload = null;

    const modalHtml = `
      <div id="quiz-modal-backdrop" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 max-h-[85vh] overflow-y-auto">

          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              📝 Upload Quiz
            </h3>
            <button id="close-quiz-modal" class="text-slate-400 hover:text-slate-600 text-xl font-bold p-1">✕</button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Quiz Title</label>
              <input type="text" id="quiz-title-input" placeholder="e.g. Anatomy Block 1 Practice Quiz" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-success-500" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Academic Year</label>
                <select id="quiz-year-select" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-success-500">
                  ${years.map(y => `<option value="${y}">${y}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Subject (optional)</label>
                <input type="text" id="quiz-subject-input" placeholder="e.g. Anatomy" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-success-500" />
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Upload Quiz File (.csv, .xlsx, .xls)</label>
              <input type="file" id="quiz-upload-file-input" accept=".csv,.xlsx,.xls" class="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-success-50 file:text-success-700 hover:file:bg-success-100" />
              <p class="text-[11px] text-slate-500 mt-1">Expected columns: Question, 4 options, Correct Answer, and an optional Explanation column. English or Arabic headers both work.</p>
            </div>

            <div id="quiz-preview-area"></div>
          </div>

          <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button id="cancel-quiz-btn" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm rounded-xl transition">
              Cancel
            </button>
            <button id="submit-quiz-btn" class="px-5 py-2 bg-success-600 hover:bg-success-700 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed" disabled>
              <span>Create Quiz</span>
              ${UI.icon ? UI.icon('check', 'w-4 h-4') : '✓'}
            </button>
          </div>

        </div>
      </div>
    `;

    const existing = el('quiz-modal-backdrop');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = el('quiz-modal-backdrop');
    const closeBtn = el('close-quiz-modal');
    const cancelBtn = el('cancel-quiz-btn');
    const submitBtn = el('submit-quiz-btn');
    const fileInput = el('quiz-upload-file-input');
    const previewArea = el('quiz-preview-area');

    function closeModal() { modal.remove(); parsedUpload = null; }
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        previewArea.innerHTML = `<p class="text-xs text-slate-500">Reading file…</p>`;
        submitBtn.disabled = true;

        try {
          const result = await parseQuizFile(file);
          parsedUpload = result;

          const rowsHtml = result.questions.slice(0, 8).map((q, i) => `
            <tr class="border-b border-slate-100 dark:border-slate-800">
              <td class="py-1.5 pr-2 text-slate-500">${i + 1}</td>
              <td class="py-1.5 pr-2 max-w-[220px] truncate">${UI.ESC ? UI.ESC(q.text) : q.text}</td>
              <td class="py-1.5 pr-2 font-semibold text-emerald-600">${q.correct}) ${UI.ESC ? UI.ESC(q.options[q.correct]) : q.options[q.correct]}</td>
              <td class="py-1.5 text-slate-500">${q.explanation ? '✓' : '—'}</td>
            </tr>
          `).join('');

          previewArea.innerHTML = `
            <div class="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div class="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>${result.questions.length} question${result.questions.length === 1 ? '' : 's'} parsed</span>
                ${result.errors.length > 0 ? `<span class="text-amber-600">${result.errors.length} row${result.errors.length === 1 ? '' : 's'} skipped</span>` : ''}
              </div>
              ${result.questions.length > 0 ? `
                <table class="w-full text-xs">
                  <thead>
                    <tr class="text-left text-slate-400 border-b border-slate-100 dark:border-slate-800">
                      <th class="py-1.5 pr-2 font-semibold">#</th>
                      <th class="py-1.5 pr-2 font-semibold">Question</th>
                      <th class="py-1.5 pr-2 font-semibold">Correct</th>
                      <th class="py-1.5 font-semibold">Explanation?</th>
                    </tr>
                  </thead>
                  <tbody>${rowsHtml}</tbody>
                </table>
                ${result.questions.length > 8 ? `<p class="text-[11px] text-slate-500 px-3 py-1.5">…and ${result.questions.length - 8} more</p>` : ''}
              ` : ''}
              ${result.errors.length > 0 ? `
                <div class="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 text-[11px] text-amber-700 dark:text-amber-300 space-y-0.5 max-h-24 overflow-y-auto">
                  ${result.errors.map(e => `<p>${UI.ESC ? UI.ESC(e) : e}</p>`).join('')}
                </div>
              ` : ''}
            </div>
          `;

          submitBtn.disabled = result.questions.length === 0;
        } catch (err) {
          previewArea.innerHTML = `<p class="text-xs text-rose-600">Could not read this file: ${err.message}</p>`;
          submitBtn.disabled = true;
        }
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        const title = el('quiz-title-input').value.trim();
        const year = el('quiz-year-select').value;
        const subject = el('quiz-subject-input').value.trim();

        if (!title) { alert('Please enter a quiz title'); return; }
        if (!parsedUpload || parsedUpload.questions.length === 0) { alert('Please upload a valid quiz file first'); return; }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating…';

        const STATE2 = getSTATE();
        const created = await STATE2.createQuiz({
          title, year, subject,
          questions: parsedUpload.questions
        });

        if (!created || created.error) {
          const reason = created && created.error ? created.error : 'Unknown error (see console for details).';
          alert('Could not create the quiz:\n\n' + reason);
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create Quiz';
          return;
        }

        closeModal();
        render();
      });
    }
  }

  /* ---------------------------------------------------------
     Exam runner — one question per "page", instant grading
     --------------------------------------------------------- */

  function startQuiz(quizId) {
    const STATE = getSTATE();
    const st = STATE.state || {};
    const quiz = (st.quizzes || []).find(q => q.id === quizId);
    if (!quiz || !quiz.questions || quiz.questions.length === 0) return;

    currentRun = {
      quiz,
      order: quiz.questions.map(q => q.id),
      index: 0,
      answers: new Map()
    };
    showingResults = false;
    render();
  }

  function currentQuestion() {
    if (!currentRun) return null;
    const qid = currentRun.order[currentRun.index];
    return currentRun.quiz.questions.find(q => q.id === qid) || null;
  }

  function renderExamQuestion(view) {
    const UI = getUI();
    const quiz = currentRun.quiz;
    const question = currentQuestion();
    if (!question) { showingResults = true; render(); return; }

    const total = currentRun.order.length;
    const num = currentRun.index + 1;
    const existingAnswer = currentRun.answers.get(question.id);
    const answered = !!existingAnswer;
    const saved = isQuestionSaved(question.id);

    view.innerHTML = `
      <div class="max-w-2xl mx-auto pb-12 animate-fade-in space-y-5">

        <div class="flex items-center justify-between">
          <button id="btn-exit-quiz" class="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1">← Exit quiz</button>
          <span class="text-xs font-bold text-slate-500">Question ${num} of ${total}</span>
        </div>

        <div class="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div class="h-full bg-brand-500 transition-all" style="width:${(num / total) * 100}%"></div>
        </div>

        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
          <div class="flex items-start justify-between gap-3">
            <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">${UI.ESC ? UI.ESC(question.text) : question.text}</h2>
            <button id="btn-toggle-save" class="shrink-0 text-xl leading-none" title="Save for later">${saved ? '🔖' : '🏷️'}</button>
          </div>

          <div class="space-y-2.5">
            ${OPTION_LETTERS.map(letter => {
              const optText = question.options[letter];
              let extraClass = 'border-slate-200 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-500';
              let icon = '';
              if (answered) {
                if (letter === question.correct) {
                  extraClass = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20';
                  icon = ' ✓';
                } else if (letter === existingAnswer.selected) {
                  extraClass = 'border-rose-500 bg-rose-50 dark:bg-rose-900/20';
                  icon = ' ✕';
                } else {
                  extraClass = 'border-slate-200 dark:border-slate-800 opacity-60';
                }
              }
              return `
                <button class="btn-option w-full text-left px-4 py-3 rounded-xl border-2 transition text-sm text-slate-800 dark:text-slate-200 flex items-center justify-between gap-2 ${extraClass}" data-letter="${letter}" ${answered ? 'disabled' : ''}>
                  <span><strong class="mr-1.5">${letter})</strong>${UI.ESC ? UI.ESC(optText) : optText}</span>
                  <span class="font-bold">${icon}</span>
                </button>
              `;
            }).join('')}
          </div>

          ${answered ? `
            <div class="rounded-xl p-4 ${existingAnswer.isCorrect ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800'}">
              <p class="text-sm font-bold ${existingAnswer.isCorrect ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}">
                ${existingAnswer.isCorrect ? '✓ Correct!' : `✕ Not quite — correct answer is ${question.correct}) ${UI.ESC ? UI.ESC(question.options[question.correct]) : question.options[question.correct]}`}
              </p>
              ${!existingAnswer.isCorrect && question.explanation ? `<p class="text-xs text-slate-600 dark:text-slate-400 mt-1.5">${UI.ESC ? UI.ESC(question.explanation) : question.explanation}</p>` : ''}
              ${!existingAnswer.isCorrect && !question.explanation ? `<p class="text-xs text-slate-500 mt-1.5 italic">No explanation was provided for this question.</p>` : ''}
            </div>
          ` : ''}
        </div>

        <div class="flex justify-end">
          <button id="btn-next-question" class="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm rounded-xl shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed" ${answered ? '' : 'disabled'}>
            ${num === total ? 'See Results' : 'Next →'}
          </button>
        </div>
      </div>
    `;

    const exitBtn = el('btn-exit-quiz');
    if (exitBtn) exitBtn.addEventListener('click', () => {
      if (confirm('Exit this quiz? Your progress on this attempt will be lost.')) {
        currentRun = null;
        showingResults = false;
        render();
      }
    });

    const saveBtn = el('btn-toggle-save');
    if (saveBtn) saveBtn.addEventListener('click', async () => {
      const STATE = getSTATE();
      await STATE.toggleSavedQuestion(question.id);
      render();
    });

    document.querySelectorAll('.btn-option').forEach(b => {
      b.addEventListener('click', () => {
        const letter = b.dataset.letter;
        const isCorrect = letter === question.correct;
        currentRun.answers.set(question.id, { selected: letter, isCorrect });
        render();
      });
    });

    const nextBtn = el('btn-next-question');
    if (nextBtn) nextBtn.addEventListener('click', () => {
      if (currentRun.index + 1 < total) {
        currentRun.index += 1;
        render();
      } else {
        showingResults = true;
        render();
      }
    });
  }

  /* ---------------------------------------------------------
     Results screen
     --------------------------------------------------------- */

  function renderResults(view) {
    const STATE = getSTATE();
    const UI = getUI();
    const quiz = currentRun.quiz;
    const total = currentRun.order.length;
    let score = 0;
    currentRun.answers.forEach(a => { if (a.isCorrect) score++; });

    if (!currentRun.saved) {
      currentRun.saved = true;
      STATE.submitQuizAttempt(quiz.id, score, total);
    }

    const pct = Math.round((score / total) * 100);

    view.innerHTML = `
      <div class="max-w-2xl mx-auto pb-12 animate-fade-in space-y-6">
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 text-center space-y-3">
          <div class="text-4xl">${pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '📚'}</div>
          <h2 class="text-2xl font-black text-slate-900 dark:text-slate-100">${score} / ${total}</h2>
          <p class="text-sm text-slate-500">${pct}% on "${UI.ESC ? UI.ESC(quiz.title) : quiz.title}"</p>
        </div>

        <div class="space-y-2.5">
          ${currentRun.order.map((qid, i) => {
            const q = quiz.questions.find(x => x.id === qid);
            const ans = currentRun.answers.get(qid);
            const saved = isQuestionSaved(qid);
            return `
              <div class="bg-white dark:bg-slate-900 rounded-xl border ${ans && ans.isCorrect ? 'border-emerald-200 dark:border-emerald-800' : 'border-rose-200 dark:border-rose-800'} p-4 flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-xs text-slate-400 font-semibold">Q${i + 1}</p>
                  <p class="text-sm text-slate-800 dark:text-slate-200 mt-0.5">${UI.ESC ? UI.ESC(q.text) : q.text}</p>
                  <p class="text-xs mt-1 font-semibold ${ans && ans.isCorrect ? 'text-emerald-600' : 'text-rose-600'}">
                    ${ans && ans.isCorrect ? '✓ Correct' : `✕ You picked ${ans ? ans.selected : '—'} · Correct: ${q.correct}) ${UI.ESC ? UI.ESC(q.options[q.correct]) : q.options[q.correct]}`}
                  </p>
                </div>
                <button class="btn-toggle-save-result shrink-0 text-xl leading-none" data-qid="${qid}" title="Save for later">${saved ? '🔖' : '🏷️'}</button>
              </div>
            `;
          }).join('')}
        </div>

        <div class="flex justify-center">
          <button id="btn-finish-quiz" class="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm rounded-xl shadow-md transition">Back to Quiz Hub</button>
        </div>
      </div>
    `;

    document.querySelectorAll('.btn-toggle-save-result').forEach(b => {
      b.addEventListener('click', async () => {
        await STATE.toggleSavedQuestion(b.dataset.qid);
        render();
      });
    });

    const finishBtn = el('btn-finish-quiz');
    if (finishBtn) finishBtn.addEventListener('click', () => {
      currentRun = null;
      showingResults = false;
      render();
    });
  }

  global.MP_QUIZ = { render, openUploadQuiz };
})(window);