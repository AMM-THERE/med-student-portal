/* ============================================================
   quiz.js — Quiz bank, runner, timer, grading, CSV/Excel import
   ============================================================ */
(function (global) {
  'use strict';

  const CFG    = global.MP_CONFIG;
  const STATE  = global.MP_STATE;
  const UI     = global.MP_UI;
  const UTIL   = global.MP_UTIL;
  const MODALS = global.MP_MODALS;

  // Runner state
  const run = {
    quiz: null,
    index: 0,
    answers: [],      // selected optionIndex per question (null if skipped)
    feedback: [],     // { correct: bool, correctIndex } per question
    secondsLeft: 0,
    timerHandle: null,
    finished: false
  };

  function view() { return document.getElementById('view'); }

  function render() {
    const v = view();
    if (!v) return;
    if (run.quiz) renderRunner();
    else renderList();
  }

  function renderList() {
    const v = view();
    const me = STATE.state.currentUser;
    const list = STATE.state.quizzes;
    v.innerHTML = `
      <div class="flex items-end justify-between gap-3 mb-5">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">Quiz Bank</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">Test yourself with MCQs uploaded by admins.</p>
        </div>
        <div class="text-xs text-slate-500 dark:text-slate-400">${list.length} quiz${list.length === 1 ? '' : 'zes'}</div>
      </div>

      ${list.length === 0 ? `
        <div class="relative overflow-hidden rounded-3xl hero-quiz p-8 sm:p-10 border border-slate-200/60 dark:border-slate-800 animate-fade-up">
          <div class="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-success-500/10 blur-2xl pointer-events-none"></div>
          <div class="relative max-w-xl">
            <div class="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-success-500 to-success-700 text-white items-center justify-center shadow-glow mb-4">${UI.icon('check','w-6 h-6')}</div>
            <h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">No quizzes yet</h2>
            <p class="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-md">Upload an <code class="px-1 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-xs">.xlsx</code> or <code class="px-1 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-xs">.csv</code> with columns: Question, OptionA–D, CorrectAnswer, Explanation. ${me && me.isAdmin ? 'Use the <span class="font-semibold text-success-700 dark:text-success-500">+</span> button to start the bank.' : 'Admins can upload quizzes here.'}</p>
            ${me && me.isAdmin ? `
              <button id="empty-upload-quiz" class="cta-lift mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-success-grad shadow-glow">
                ${UI.icon('upload','w-4 h-4')}<span>Upload the first quiz</span>
              </button>` : ''}
          </div>
        </div>
      ` : `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${list.map(quizCard).join('')}
        </div>
      `}
    `;

    v.querySelectorAll('[data-start]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.start;
        const quiz = STATE.state.quizzes.find(q => q.id === id);
        if (quiz) startQuiz(quiz);
      });
    });

    const uploadBtn = v.querySelector('#empty-upload-quiz');
    if (uploadBtn) uploadBtn.addEventListener('click', () => openUploadQuiz());
  }

  function quizCard(q) {
    const u = STATE.state.users.find(x => x.id === q.addedBy);
    return `
      <article class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition flex flex-col">
        <div class="flex items-start justify-between mb-2">
          <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug">${UI.ESC(q.title)}</h3>
          <span class="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 ml-2">${UI.ESC(q.year)}</span>
        </div>
        <div class="text-xs text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-2">
          ${UI.icon('check','w-3.5 h-3.5')}
          <span>${q.questions.length} questions</span>
          <span class="text-slate-400">·</span>
          ${UI.icon('clock','w-3.5 h-3.5')}
          <span>${q.timePerQuestion}s per question</span>
        </div>
        <div class="text-[11px] text-slate-500 dark:text-slate-400 mb-3">Added ${UTIL.formatDate(q.createdAt)}${u ? ' · by ' + UI.ESC(u.fullName) : ''}</div>
        <div class="mt-auto flex gap-2">
          <button data-start="${q.id}" class="flex-1 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700">Start quiz</button>
        </div>
      </article>
    `;
  }

  function startQuiz(quiz) {
    run.quiz = quiz;
    run.index = 0;
    run.answers = new Array(quiz.questions.length).fill(null);
    run.feedback = new Array(quiz.questions.length).fill(null);
    run.secondsLeft = quiz.timePerQuestion;
    run.finished = false;
    renderRunner();
  }

  function exitQuiz() {
    stopTimer();
    run.quiz = null;
    renderList();
    if (global.MP_NAV) global.MP_NAV.renderFab();
  }

  function renderRunner() {
    const v = view();
    const q = run.quiz.questions[run.index];
    const total = run.quiz.questions.length;
    const progress = ((run.index) / total) * 100;
    const totalSec = run.quiz.timePerQuestion;
    const timeFrac = Math.max(0, run.secondsLeft) / totalSec;

    v.innerHTML = `
      <div class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div class="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 justify-between">
          <div class="min-w-0">
            <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">${UI.ESC(run.quiz.title)}</h2>
            <div class="text-xs text-slate-500 dark:text-slate-400">Question ${run.index + 1} of ${total} · ${UI.ESC(run.quiz.year)}</div>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
              ${UI.icon('clock','w-4 h-4')} <span id="timer">${run.secondsLeft}s</span>
            </div>
            <button id="btn-exit" class="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Exit</button>
          </div>
        </div>
        <div class="h-1.5 w-full bg-slate-100 dark:bg-slate-800">
          <div class="h-1.5 bg-brand-500 transition-all" style="width: ${progress}%"></div>
        </div>
        <div class="p-5 sm:p-6">
          <p class="text-base sm:text-lg font-medium text-slate-900 dark:text-slate-100 mb-4 leading-relaxed">${UI.ESC(q.question)}</p>
          <div class="space-y-2" id="opts">
            ${q.options.map((opt, i) => `
              <label class="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-500 cursor-pointer transition opt-row" data-i="${i}">
                <span class="w-7 h-7 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center text-sm font-semibold text-slate-700 dark:text-slate-200 opt-letter">${String.fromCharCode(65 + i)}</span>
                <span class="text-sm text-slate-800 dark:text-slate-100 flex-1">${UI.ESC(opt)}</span>
                <input type="radio" name="opt" value="${i}" class="sr-only" />
              </label>
            `).join('')}
          </div>
          <div id="feedback" class="hidden mt-4"></div>
          <div class="mt-5 flex justify-end gap-2">
            <button id="btn-submit" class="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700">Submit</button>
            <button id="btn-next" class="hidden px-4 py-2 rounded-lg text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700">${run.index === total - 1 ? 'Finish' : 'Next'}</button>
          </div>
        </div>
      </div>
    `;

    v.querySelector('#btn-exit').addEventListener('click', () => {
      stopTimer();
      if (run.answers.slice(0, run.index + 1).some(a => a !== null) || run.index > 0) {
        if (!confirm('Exit quiz? Your progress will be lost.')) return;
      }
      exitQuiz();
    });

    // Option click → select
    v.querySelectorAll('.opt-row').forEach(row => {
      row.addEventListener('click', () => {
        if (row.classList.contains('pointer-events-none')) return;
        v.querySelectorAll('.opt-row').forEach(r => r.classList.remove('border-brand-500','bg-brand-50','dark:bg-brand-900/20'));
        row.classList.add('border-brand-500','bg-brand-50','dark:bg-brand-900/20');
        row.querySelector('input').checked = true;
      });
    });

    v.querySelector('#btn-submit').addEventListener('click', () => submitCurrent());
    v.querySelector('#btn-next').addEventListener('click', () => goNext());

    startTimer();
  }

  function startTimer() {
    stopTimer();
    run.timerHandle = setInterval(() => {
      run.secondsLeft--;
      const t = document.getElementById('timer');
      if (t) t.textContent = run.secondsLeft + 's';
      if (run.secondsLeft <= 0) {
        stopTimer();
        submitCurrent(true);
      }
    }, 1000);
  }

  function stopTimer() {
    if (run.timerHandle) { clearInterval(run.timerHandle); run.timerHandle = null; }
  }

  function getSelectedIndex() {
    const checked = document.querySelector('input[name="opt"]:checked');
    return checked ? parseInt(checked.value, 10) : null;
  }

  function submitCurrent(auto) {
    if (run.finished) return;
    stopTimer();
    const q = run.quiz.questions[run.index];
    const sel = getSelectedIndex();
    run.answers[run.index] = sel;
    const correct = sel === q.correctIndex;
    run.feedback[run.index] = { correct, correctIndex: q.correctIndex };

    // Visual feedback: mark correct/incorrect, lock options
    const rows = document.querySelectorAll('.opt-row');
    rows.forEach((row, i) => {
      row.classList.add('pointer-events-none');
      if (i === q.correctIndex) {
        row.classList.add('border-emerald-500','bg-emerald-50','dark:bg-emerald-900/20');
        row.querySelector('.opt-letter').classList.add('bg-emerald-500','text-white','border-emerald-500');
      } else if (i === sel && !correct) {
        row.classList.add('border-rose-500','bg-rose-50','dark:bg-rose-900/20');
        row.querySelector('.opt-letter').classList.add('bg-rose-500','text-white','border-rose-500');
      }
    });

    const fb = document.getElementById('feedback');
    fb.classList.remove('hidden');
    fb.innerHTML = `
      <div class="rounded-xl border p-3 ${correct ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800' : 'border-rose-300 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800'}">
        <div class="text-sm font-semibold mb-1 ${correct ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}">
          ${correct ? 'Correct!' : (auto ? 'Time’s up.' : 'Incorrect.')}
        </div>
        <div class="text-sm text-slate-700 dark:text-slate-200"><span class="font-semibold">Explanation:</span> ${UI.ESC(q.explanation || '—')}</div>
      </div>
    `;

    document.getElementById('btn-submit').classList.add('hidden');
    document.getElementById('btn-next').classList.remove('hidden');
  }

  function goNext() {
    if (run.index + 1 >= run.quiz.questions.length) {
      run.finished = true;
      renderResults();
    } else {
      run.index++;
      run.secondsLeft = run.quiz.timePerQuestion;
      renderRunner();
    }
  }

  function renderResults() {
    const v = view();
    const total = run.quiz.questions.length;
    const correctCount = run.feedback.filter(f => f && f.correct).length;
    const pct = Math.round((correctCount / total) * 100);
    const pass = pct >= 60;

    v.innerHTML = `
      <div class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div class="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">${UI.ESC(run.quiz.title)} — Results</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">${UI.ESC(run.quiz.year)}</p>
          </div>
          <div class="text-right">
            <div class="text-3xl font-extrabold ${pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">${pct}%</div>
            <div class="text-xs text-slate-500 dark:text-slate-400">${correctCount} of ${total} correct</div>
          </div>
        </div>
        <div class="p-5 sm:p-6 space-y-3">
          ${run.quiz.questions.map((q, i) => {
            const f = run.feedback[i] || { correct: false, correctIndex: q.correctIndex };
            const sel = run.answers[i];
            return `
              <div class="rounded-xl border p-3 ${f.correct ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10'}">
                <div class="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">Q${i + 1}. ${UI.ESC(q.question)}</div>
                <div class="text-xs space-y-0.5">
                  <div>Your answer: <span class="${f.correct ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'} font-semibold">${sel === null ? '—' : String.fromCharCode(65 + sel) + '. ' + UI.ESC(q.options[sel])}</span></div>
                  ${!f.correct ? `<div>Correct: <span class="text-emerald-700 dark:text-emerald-300 font-semibold">${String.fromCharCode(65 + f.correctIndex)}. ${UI.ESC(q.options[f.correctIndex])}</span></div>` : ''}
                  <div class="text-slate-600 dark:text-slate-300"><span class="font-semibold">Explanation:</span> ${UI.ESC(q.explanation || '—')}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="p-5 sm:p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
          <button id="btn-back" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">Back to quizzes</button>
          <button id="btn-retry" class="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700">Retry</button>
        </div>
      </div>
    `;
    document.getElementById('btn-back').addEventListener('click', exitQuiz);
    document.getElementById('btn-retry').addEventListener('click', () => startQuiz(run.quiz));
  }

  // ---------------- Admin: Upload quiz (.xlsx / .csv) ----------------
  function openUploadQuiz() {
    const me = STATE.state.currentUser;
    if (!me || !me.isAdmin) return;

    const yearOptions = CFG.ACADEMIC_YEARS.map(y => `<option value="${y}">${y}</option>`).join('');

    const m = new MODALS.Modal({ title: 'Upload Quiz', size: 'xl' });
    m.setContent(`
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label class="block sm:col-span-1">
            <span class="text-xs font-medium text-slate-600 dark:text-slate-400">Quiz Title *</span>
            <input id="q-title" required type="text" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Anatomy Block 1" />
          </label>
          <label class="block">
            <span class="text-xs font-medium text-slate-600 dark:text-slate-400">Year *</span>
            <select id="q-year" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">${yearOptions}</select>
          </label>
          <label class="block">
            <span class="text-xs font-medium text-slate-600 dark:text-slate-400">Sec per question</span>
            <input id="q-time" type="number" min="10" max="600" value="60" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </label>
        </div>

        <div class="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-5 text-center bg-slate-50 dark:bg-slate-800/40">
          <div class="mx-auto w-10 h-10 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200 flex items-center justify-center mb-2">${UI.icon('upload','w-5 h-5')}</div>
          <p class="text-sm text-slate-700 dark:text-slate-200"><span class="font-semibold">Choose a .xlsx, .xls, or .csv file</span></p>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Columns: <code>Question, OptionA, OptionB, OptionC, OptionD, CorrectAnswer, Explanation</code> — CorrectAnswer can be A/B/C/D or 1–4.</p>
          <button id="btn-pick" type="button" class="mt-3 px-3 py-1.5 rounded-lg text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700">Select file</button>
        </div>

        <div id="preview-wrap" class="hidden">
          <div class="text-xs text-slate-500 dark:text-slate-400 mb-1">Preview (<span id="q-count">0</span> questions)</div>
          <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 max-h-72">
            <table class="w-full text-xs">
              <thead class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 sticky top-0">
                <tr>
                  <th class="px-2 py-1.5 text-left">#</th>
                  <th class="px-2 py-1.5 text-left">Question</th>
                  <th class="px-2 py-1.5 text-left">A</th>
                  <th class="px-2 py-1.5 text-left">B</th>
                  <th class="px-2 py-1.5 text-left">C</th>
                  <th class="px-2 py-1.5 text-left">D</th>
                  <th class="px-2 py-1.5 text-left">Answer</th>
                </tr>
              </thead>
              <tbody id="preview-rows" class="divide-y divide-slate-200 dark:divide-slate-800"></tbody>
            </table>
          </div>
        </div>

        <p id="up-error" class="text-sm text-rose-600 dark:text-rose-400 hidden"></p>

        <div class="flex justify-end gap-2 pt-1">
          <button type="button" data-modal-close class="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button>
          <button id="btn-import" type="button" disabled class="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed">Import quiz</button>
        </div>
      </div>
    `);
    m.open();

    let parsedQuestions = [];

    const fileInput = document.getElementById('quiz-file-input');
    document.getElementById('btn-pick').addEventListener('click', () => fileInput.click());

    fileInput.onchange = async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const errEl = m.el.querySelector('#up-error');
      errEl.classList.add('hidden');

      try {
        const lower = f.name.toLowerCase();
        let rows = [];

        if (lower.endsWith('.csv')) {
          const text = await f.text();
          const all = UTIL.parseCSV(text);
          if (!all.length) throw new Error('CSV is empty.');
          rows = toObjects(all);
        } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
          if (typeof XLSX === 'undefined') throw new Error('SheetJS not loaded.');
          const buf = await f.arrayBuffer();
          const wb = XLSX.read(buf, { type: 'array' });
          const firstSheet = wb.SheetNames[0];
          const json = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { defval: '' });
          if (!json.length) throw new Error('Worksheet is empty.');
          rows = normalizeKeys(json);
        } else {
          throw new Error('Unsupported file type. Use .csv, .xls, or .xlsx.');
        }

        const questions = parseQuestions(rows);
        if (!questions.length) throw new Error('No valid questions found. Check column headers.');
        parsedQuestions = questions;
        renderPreview(m.el, questions);
        m.el.querySelector('#btn-import').disabled = false;
      } catch (err) {
        parsedQuestions = [];
        m.el.querySelector('#preview-wrap').classList.add('hidden');
        m.el.querySelector('#btn-import').disabled = true;
        errEl.textContent = err.message || 'Could not parse file.';
        errEl.classList.remove('hidden');
      } finally {
        fileInput.value = '';
      }
    };

    m.el.querySelector('#btn-import').addEventListener('click', () => {
      const title = m.el.querySelector('#q-title').value.trim();
      const year = m.el.querySelector('#q-year').value;
      const time = Math.max(10, Math.min(600, parseInt(m.el.querySelector('#q-time').value, 10) || 60));
      if (!title) {
        const errEl = m.el.querySelector('#up-error');
        errEl.textContent = 'Please enter a quiz title.';
        errEl.classList.remove('hidden');
        return;
      }
      STATE.addQuiz({
        id: UTIL.uid('quiz'),
        title, year,
        timePerQuestion: time,
        questions: parsedQuestions,
        addedBy: me.id,
        createdAt: Date.now()
      });
      UI.toast('Quiz imported (' + parsedQuestions.length + ' questions).', { variant: 'success' });
      m.close();
      renderList();
    });
  }

  // --- helpers for CSV/Excel import ---

  function toObjects(rows) {
    if (!rows.length) return [];
    const header = rows[0].map(h => String(h).trim().toLowerCase());
    return rows.slice(1).map(r => {
      const o = {};
      header.forEach((h, i) => { o[h] = r[i] !== undefined ? r[i] : ''; });
      return o;
    });
  }

  function normalizeKeys(arr) {
    return arr.map(o => {
      const out = {};
      Object.keys(o).forEach(k => { out[String(k).trim().toLowerCase()] = o[k]; });
      return out;
    });
  }

  function parseQuestions(rows) {
    const out = [];
    rows.forEach((r, idx) => {
      const q = String(r.question || r['question text'] || '').trim();
      const a = String(r.optiona || r['option a'] || '').trim();
      const b = String(r.optionb || r['option b'] || '').trim();
      const c = String(r.optionc || r['option c'] || '').trim();
      const d = String(r.optiond || r['option d'] || '').trim();
      const ansRaw = String(r.correctanswer || r['correct answer'] || r.correct || '').trim();
      const expl = String(r.explanation || '').trim();
      if (!q || !a || !b || !c || !d || !ansRaw) return;

      let idx2 = -1;
      const u = ansRaw.toUpperCase();
      if (['A','B','C','D'].includes(u)) idx2 = u.charCodeAt(0) - 65;
      else if (/^\d+$/.test(ansRaw)) {
        const n = parseInt(ansRaw, 10);
        if (n >= 1 && n <= 4) idx2 = n - 1;
        else if (n >= 0 && n <= 3) idx2 = n;
      } else {
        // Try matching by option text
        const target = ansRaw.toLowerCase();
        [a,b,c,d].forEach((opt, i) => { if (opt.toLowerCase() === target) idx2 = i; });
      }
      if (idx2 < 0) return;

      out.push({
        id: UTIL.uid('q'),
        question: q,
        options: [a, b, c, d],
        correctIndex: idx2,
        explanation: expl
      });
    });
    return out;
  }

  function renderPreview(modalEl, questions) {
    const wrap = modalEl.querySelector('#preview-wrap');
    const rows = modalEl.querySelector('#preview-rows');
    modalEl.querySelector('#q-count').textContent = questions.length;
    rows.innerHTML = questions.slice(0, 200).map((q, i) => `
      <tr>
        <td class="px-2 py-1.5 text-slate-500 dark:text-slate-400">${i + 1}</td>
        <td class="px-2 py-1.5 text-slate-800 dark:text-slate-200">${UI.ESC(q.question)}</td>
        <td class="px-2 py-1.5 text-slate-700 dark:text-slate-300">${UI.ESC(q.options[0])}</td>
        <td class="px-2 py-1.5 text-slate-700 dark:text-slate-300">${UI.ESC(q.options[1])}</td>
        <td class="px-2 py-1.5 text-slate-700 dark:text-slate-300">${UI.ESC(q.options[2])}</td>
        <td class="px-2 py-1.5 text-slate-700 dark:text-slate-300">${UI.ESC(q.options[3])}</td>
        <td class="px-2 py-1.5 font-semibold text-emerald-700 dark:text-emerald-300">${String.fromCharCode(65 + q.correctIndex)}</td>
      </tr>
    `).join('');
    wrap.classList.remove('hidden');
  }

  global.MP_QUIZ = { render, openUploadQuiz, exitQuiz };
})(window);
