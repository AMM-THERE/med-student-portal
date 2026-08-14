/* ============================================================
   quiz.js — Quizzes & MCQ module
   ============================================================ */
(function (global) {
  'use strict';

  function getSTATE() { return global.MP_STATE || {}; }
  function getUI()    { return global.MP_UI || {}; }
  function el(id)     { return document.getElementById(id); }

  function render() {
    const view = el('view');
    if (!view) return;

    const STATE = getSTATE();
    const UI = getUI();
    const st = STATE.state || {};
    const quizzes = st.quizzes || [];
    const user = st.currentUser;

    view.innerHTML = `
      <div class="max-w-5xl mx-auto space-y-6 pb-12 animate-fade-in">
        <div class="bg-gradient-to-r from-success-500/10 via-brand-500/10 to-transparent p-6 rounded-2xl border border-success-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Quiz Hub</h1>
            <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">Test your medical knowledge with practice MCQs.</p>
          </div>
          ${user && user.isAdmin ? `
            <button id="btn-upload-quiz-banner" class="px-4 py-2.5 bg-success-600 hover:bg-success-700 text-white rounded-xl font-bold text-sm shadow-md transition flex items-center gap-2">
              ${UI.icon ? UI.icon('plus', 'w-4 h-4') : '+'}
              <span>Create Quiz</span>
            </button>
          ` : ''}
        </div>

        ${quizzes.length === 0 ? `
          <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3 shadow-sm">
            <div class="w-16 h-16 rounded-2xl bg-success-50 dark:bg-success-900/30 text-success-600 flex items-center justify-center mx-auto text-3xl">📝</div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100">No Quizzes Available Yet</h3>
            <p class="text-sm text-slate-500 max-w-md mx-auto">Upload quiz JSON or create custom MCQs to help batch mates practice for upcoming exams.</p>
            ${user && user.isAdmin ? `
              <button id="btn-upload-quiz-empty" class="mt-4 px-5 py-2.5 bg-success-600 hover:bg-success-700 text-white rounded-xl font-bold text-sm transition inline-flex items-center gap-2 shadow-md">
                ${UI.icon ? UI.icon('plus', 'w-4 h-4') : '+'}
                <span>Upload First Quiz</span>
              </button>
            ` : ''}
          </div>
        ` : `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${quizzes.map(q => `
              <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition space-y-3">
                <div class="flex items-start justify-between">
                  <div>
                    <h4 class="font-bold text-slate-900 dark:text-slate-100">${UI.ESC ? UI.ESC(q.title) : q.title}</h4>
                    <p class="text-xs text-slate-500 mt-0.5">${q.questions ? q.questions.length : 0} Questions</p>
                  </div>
                  ${UI.yearBadge ? UI.yearBadge(q.year || 1) : ''}
                </div>
                <button class="w-full py-2 bg-brand-50 hover:bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 font-semibold text-sm rounded-xl transition">Start Quiz</button>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    const btnBanner = el('btn-upload-quiz-banner');
    const btnEmpty = el('btn-upload-quiz-empty');
    if (btnBanner) btnBanner.addEventListener('click', openUploadQuiz);
    if (btnEmpty) btnEmpty.addEventListener('click', openUploadQuiz);
  }

  function openUploadQuiz() {
    const UI = getUI();
    const STATE = getSTATE();

    const modalHtml = `
      <div id="quiz-modal-backdrop" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
        <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
          
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 class="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              📝 Create / Upload Quiz
            </h3>
            <button id="close-quiz-modal" class="text-slate-400 hover:text-slate-600 text-xl font-bold p-1">✕</button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Quiz Title</label>
              <input type="text" id="quiz-title-input" placeholder="e.g. Anatomy Block 1 Practice Quiz" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-success-500" />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Academic Year</label>
              <select id="quiz-year-select" class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-success-500">
                <option value="1">Year 1</option>
                <option value="2">Year 2</option>
                <option value="3">Year 3</option>
                <option value="4">Year 4</option>
                <option value="5">Year 5</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Upload Quiz File (JSON) or Paste JSON</label>
              <input type="file" id="quiz-file-input" accept=".json" class="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-success-50 file:text-success-700 hover:file:bg-success-100" />
              <textarea id="quiz-json-textarea" rows="4" placeholder='Or paste JSON here e.g. [{"question":"...", "options":["A","B"], "answer":0}]' class="w-full mt-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-success-500"></textarea>
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button id="cancel-quiz-btn" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm rounded-xl transition">
              Cancel
            </button>
            <button id="submit-quiz-btn" class="px-5 py-2 bg-success-600 hover:bg-success-700 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center gap-1.5">
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
    const fileInput = el('quiz-file-input');
    const jsonTextarea = el('quiz-json-textarea');

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            if (jsonTextarea) jsonTextarea.value = evt.target.result;
          };
          reader.readAsText(file);
        }
      });
    }

    function closeModal() { modal.remove(); }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        const title = el('quiz-title-input').value.trim();
        const year = parseInt(el('quiz-year-select').value) || 1;
        const jsonRaw = jsonTextarea.value.trim();

        if (!title) {
          alert('Please enter a quiz title');
          return;
        }

        let questions = [];
        if (jsonRaw) {
          try {
            questions = JSON.parse(jsonRaw);
          } catch (e) {
            alert('Invalid JSON format for questions');
            return;
          }
        }

        const newQuiz = {
          id: 'quiz_' + Date.now(),
          title,
          year,
          questions: Array.isArray(questions) ? questions : []
        };

        if (STATE.state) {
          STATE.state.quizzes = STATE.state.quizzes || [];
          STATE.state.quizzes.push(newQuiz);
        }

        closeModal();
        render();
      });
    }
  }

  global.MP_QUIZ = { render, openUploadQuiz };
})(window);