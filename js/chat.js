/* ============================================================
   chat.js — Community chat module
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
    const user = st.currentUser;
    const messages = st.messages || [];

    const isAnon = st.prefs ? !!st.prefs.defaultAnonymous : false;

    view.innerHTML = `
      <div class="max-w-5xl mx-auto space-y-4 pb-12 animate-fade-in">
        <div class="bg-gradient-to-r from-accent-500/10 via-brand-500/10 to-transparent p-6 rounded-2xl border border-accent-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Community</h1>
            <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">Share notes, MCQs, and discuss with your batch peers in real-time.</p>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <span class="w-2 h-2 rounded-full bg-success-500 animate-pulse"></span>
              Live discussion
            </span>
            <span class="px-3 py-1 rounded-full text-xs font-semibold bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300">${messages.length} messages</span>
          </div>
        </div>

        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-[520px]">
          
          <div id="chat-messages-list" class="flex-1 overflow-y-auto p-4 space-y-4">
            ${messages.length === 0 ? `
              <div class="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl mb-3">💬</div>
                <p class="font-bold text-slate-700 dark:text-slate-300">No messages yet</p>
                <p class="text-xs text-slate-500 mt-1">Be the first to start the conversation!</p>
              </div>
            ` : messages.map(msg => {
              const author = (st.users || []).find(u => u.id === msg.authorId) || { fullName: user ? user.fullName : 'Student', username: 'student' };
              const isMe = user && msg.authorId === user.id;
              const isAnonymous = msg.anonymous;
              const displayName = isAnonymous ? 'Anonymous Student' : (isMe ? (user ? user.fullName : 'You') : author.fullName);

              return `
                <div class="flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'} items-start group">
                  <div class="w-8 h-8 rounded-full bg-brand-500 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm">
                    ${isAnonymous ? '👤' : (displayName[0] || 'U')}
                  </div>
                  <div class="max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col">
                    <div class="flex items-center gap-2 mb-1 px-1">
                      <span class="text-xs font-bold text-slate-700 dark:text-slate-300">${UI.ESC ? UI.ESC(displayName) : displayName}</span>
                      <span class="text-[10px] text-slate-400">${msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                    </div>
                    <div class="p-3.5 rounded-2xl text-sm ${isMe ? 'bg-brand-600 text-white rounded-tr-none' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'} shadow-sm leading-relaxed whitespace-pre-wrap break-words">
                      ${UI.ESC ? UI.ESC(msg.text || '') : (msg.text || '')}
                      ${msg.imageBase64 ? `<img src="${msg.imageBase64}" class="mt-2 rounded-lg max-h-60 object-cover" />` : ''}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div class="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-2xl">
            <div class="flex items-center gap-2">
              <input type="text" id="chat-input" placeholder="Type a message..." class="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 transition placeholder:text-slate-400" />
              
              <button id="chat-send-btn" class="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white font-bold text-sm rounded-xl transition flex items-center gap-1.5 shadow-md shrink-0 cursor-pointer">
                <span>Send</span>
                ${UI.icon ? UI.icon('send', 'w-4 h-4') : '🚀'}
              </button>
            </div>
            
            <div class="mt-2 flex items-center justify-between px-1 text-xs text-slate-500 dark:text-slate-400">
              <div class="flex items-center gap-2">
                <label class="flex items-center gap-1.5 cursor-pointer select-none">
                  <input type="checkbox" id="chat-anon-check" ${isAnon ? 'checked' : ''} class="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                  <span>Post anonymously</span>
                </label>
              </div>
              <span>Next message will post as <strong class="text-slate-700 dark:text-slate-300">${isAnon ? 'Anonymous' : (user ? user.fullName : 'Guest')}</strong></span>
            </div>
          </div>

        </div>
      </div>
    `;

    const list = el('chat-messages-list');
    if (list) list.scrollTop = list.scrollHeight;

    const sendBtn = el('chat-send-btn');
    const input = el('chat-input');
    const anonCheck = el('chat-anon-check');

    async function handleSend() {
      const text = (input ? input.value : '').trim();
      if (!text) return;

      const isAnonMsg = anonCheck ? anonCheck.checked : false;

      const msg = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        authorId: user ? user.id : 'guest',
        text: text,
        anonymous: isAnonMsg,
        createdAt: Date.now()
      };

      if (typeof STATE.addMessage === 'function') {
        await STATE.addMessage(msg);
      } else {
        st.messages = st.messages || [];
        st.messages.push(msg);
      }

      if (input) input.value = '';
      render();
    }

    if (sendBtn) sendBtn.addEventListener('click', handleSend);
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });
    }
    if (anonCheck) {
      anonCheck.addEventListener('change', () => {
        if (STATE.state && STATE.state.prefs) {
          STATE.state.prefs.defaultAnonymous = anonCheck.checked;
        }
      });
    }
  }

  global.MP_CHAT = { render };
})(window);