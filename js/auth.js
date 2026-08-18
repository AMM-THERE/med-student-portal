/* ============================================================
   auth.js — Registration modal, session, admin flag
   ============================================================ */
(function (global) {
  'use strict';

  const CFG     = global.MP_CONFIG;
  const STORAGE = global.MP_STORAGE;
  const STATE   = global.MP_STATE;
  const UTIL    = global.MP_UTIL;
  const UI      = global.MP_UI;
  const MODALS  = global.MP_MODALS;

  // قائمة إيميلات الأدمن / المالك المثبتة
  // NOTE: this list only seeds is_admin=true the FIRST time an account is
  // created (see STATE.addUser in state.js). After that, admin status
  // lives in Supabase's `users.is_admin` / `users.role` columns and can be
  // changed there directly (table editor or SQL) — it will take effect the
  // next time that user's browser loads the app, without needing to be
  // added here or re-registering.
  const OWNER_EMAILS = [
    'msdbdallh83@gmail.com',
    'amm.there@gmail.com',
    'invictus2@gmail.com',
    'invictus1@gmail.com'
  ];

  function isValidEmail(s) {
    return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
  }

  function isAdminEmail(email) {
    if (!email) return false;
    const e = email.trim().toLowerCase();
    
    // فحص الإيميلات المثبتة
    if (OWNER_EMAILS.includes(e)) {
      return true;
    }
    
    // فحص الإيميلات الموجودة في الإعدادات العامة (إن وجدت)
    if (CFG && Array.isArray(CFG.ADMIN_EMAILS)) {
      return CFG.ADMIN_EMAILS.map(x => x.trim().toLowerCase()).includes(e);
    }

    return false;
  }

  /** Show the registration modal. Resolves with the new user on success. */
  function showRegistration() {
    return new Promise((resolve) => {
      const yearOptions = CFG.ACADEMIC_YEARS
        .map(y => `<option value="${y}">${y}</option>`)
        .join('');

      const m = new MODALS.Modal({
        title: '',                       // empty title — we render our own header
        size: 'xl',
        hideHeader: true,
        content: `
          <div class="grid grid-cols-1 md:grid-cols-[5fr_6fr] min-h-[480px]">

            <!-- Brand panel -->
            <aside class="relative landing-grad text-white p-6 sm:p-8 flex flex-col gap-5 overflow-hidden justify-between">
              <div class="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
              <div class="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>

              <div class="relative flex items-center gap-2.5">
                <div class="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center font-extrabold text-lg">M</div>
                <div class="leading-tight">
                  <div class="text-base font-extrabold">MedPortal</div>
                  <div class="text-[10px] uppercase tracking-[0.18em] text-white/70">Medical College Hub</div>
                </div>
              </div>

              <div class="relative">
                <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">Your medical school,<br/>in one place.</h1>
                <p class="mt-2 text-white/80 text-xs sm:text-sm leading-relaxed max-w-sm">Sign in once. Get lecture resources, chat with your batch, and prep for exams with self-tests — all offline-friendly on this device.</p>
              </div>

              <ul class="relative space-y-2.5 my-auto">
                <li class="flex items-start gap-3">
                  <span class="w-8 h-8 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center shrink-0">${UI.icon('book','w-4 h-4 text-white')}</span>
                  <div>
                    <div class="text-xs sm:text-sm font-semibold">Curated lectures</div>
                    <div class="text-[11px] text-white/75">Google Drive slides and notes, organized by year and subject.</div>
                  </div>
                </li>
                <li class="flex items-start gap-3">
                  <span class="w-8 h-8 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center shrink-0">${UI.icon('chat','w-4 h-4 text-white')}</span>
                  <div>
                    <div class="text-xs sm:text-sm font-semibold">Batch community</div>
                    <div class="text-[11px] text-white/75">Discuss MCQs, share images, post anonymously if you prefer.</div>
                  </div>
                </li>
                <li class="flex items-start gap-3">
                  <span class="w-8 h-8 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center shrink-0">${UI.icon('check','w-4 h-4 text-white')}</span>
                  <div>
                    <div class="text-xs sm:text-sm font-semibold">Self-test quizzes</div>
                    <div class="text-[11px] text-white/75">MCQs uploaded by your seniors and admins. Timed, with explanations.</div>
                  </div>
                </li>
              </ul>

              <div class="relative text-[11px] text-white/60">Stored only on this device. No account needed beyond an academic email.</div>
            </aside>

            <!-- Form panel -->
            <div class="p-6 sm:p-7 bg-white dark:bg-slate-900 flex flex-col justify-between">
              <div>
                <h2 class="text-xl font-bold text-slate-900 dark:text-slate-100">Create your account</h2>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-4">Takes 20 seconds. Already registered? Enter the same email to sign back in.</p>
              </div>

              <form id="reg-form" class="grid grid-cols-1 sm:grid-cols-2 gap-3" novalidate>
                <label class="block sm:col-span-1">
                  <span class="text-xs font-medium text-slate-600 dark:text-slate-400">Full Name</span>
                  <input name="fullName" required type="text" autocomplete="name" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mint-500" placeholder="Aisha Khan" />
                </label>
                <label class="block sm:col-span-1">
                  <span class="text-xs font-medium text-slate-600 dark:text-slate-400">Display Username</span>
                  <input name="username" required type="text" autocomplete="username" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mint-500" placeholder="aishak" />
                </label>
                <label class="block sm:col-span-1">
                  <span class="text-xs font-medium text-slate-600 dark:text-slate-400">Academic Email</span>
                  <input name="email" required type="email" autocomplete="email" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mint-500" placeholder="you@medcollege.edu" />
                </label>
                <label class="block sm:col-span-1">
                  <span class="text-xs font-medium text-slate-600 dark:text-slate-400">Academic ID / Code</span>
                  <input name="academicId" required type="text" class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mint-500" placeholder="MED-2024-0142" />
                </label>
                <label class="block sm:col-span-2">
                  <span class="text-xs font-medium text-slate-600 dark:text-slate-400">Academic Year</span>
                  <select name="year" required class="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-mint-500">
                    <option value="" disabled selected>Select year…</option>
                    ${yearOptions}
                  </select>
                </label>
                <p id="reg-error" class="sm:col-span-2 text-xs text-rose-600 dark:text-rose-400 hidden"></p>
                
                <div class="sm:col-span-2 flex items-center justify-between gap-3 pt-3 mt-1 border-t border-slate-100 dark:border-slate-800">
                  <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">Predefined admins get extra tools automatically.</p>
                  <button type="submit" id="reg-submit" class="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-900 bg-mint-grad shadow-glow-mint hover:brightness-110 active:scale-[0.98] transition shrink-0 flex items-center gap-2">
                    <span>Create account</span>
                    ${UI.icon('arrow-right','w-4 h-4')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        `
      });

      m.open();
      const form = m.el.querySelector('#reg-form');
      const errEl = m.el.querySelector('#reg-error');

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        errEl.classList.add('hidden');
        const data = new FormData(form);
        const fullName   = String(data.get('fullName') || '').trim();
        const username   = String(data.get('username') || '').trim();
        const email      = String(data.get('email') || '').trim();
        const academicId = String(data.get('academicId') || '').trim();
        const year       = String(data.get('year') || '').trim();

        if (!isValidEmail(email)) {
          errEl.textContent = 'A valid academic email is required.';
          errEl.classList.remove('hidden');
          return;
        }

        // Returning user: this email is already registered — log them back
        // into their existing account instead of blocking with "already
        // exists". This is the app's stand-in for a real sign-in flow since
        // there's no password/Supabase Auth in play.
        const users = STATE.state.users;
        const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (existingUser) {
          STATE.loginAs(existingUser);
          UI.toast('Welcome back, ' + existingUser.fullName.split(' ')[0] + '!', { variant: 'success' });
          m.close();
          resolve(existingUser);
          return;
        }

        // New user — full validation
        const errs = [];
        if (!fullName) errs.push('Full name is required.');
        if (!username) errs.push('Display username is required.');
        if (!academicId) errs.push('Academic ID/Code is required.');
        if (!year || !CFG.ACADEMIC_YEARS.includes(year)) errs.push('Please select an academic year.');
        if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) errs.push('That display username is taken.');

        if (errs.length) {
          errEl.textContent = errs[0];
          errEl.classList.remove('hidden');
          return;
        }

        const isUserAdmin = isAdminEmail(email);

        const user = {
          id: UTIL.uid('usr'),
          fullName,
          username,
          email,
          academicId,
          year,
          isAdmin: isUserAdmin,
          role: isUserAdmin ? 'owner' : 'user',
          defaultAnonymous: STATE.state.prefs.defaultAnonymous || false,
          createdAt: Date.now()
        };
        STATE.addUser(user);
        STATE.loginAs(user);
        UI.toast('Account created. Welcome, ' + fullName.split(' ')[0] + '!', { variant: 'success' });
        m.close();
        resolve(user);
      });
    });
  }

  function logout() {
    STATE.logout();
    UI.toast('Signed out.', { variant: 'info' });
    // Force a full reload so the app re-boots into the logged-out state.
    // (The old code called global.MP_APP.boot(), which never existed —
    // that's why sign-out looked like it did nothing.)
    window.location.reload();
  }

  global.MP_AUTH = { showRegistration, logout, isAdminEmail, isValidEmail };
})(window);