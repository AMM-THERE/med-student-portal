/* ============================================================
    chat.js — Full Community Chat with Attachments, Reply & Pin
    ============================================================ */
(function (global) {
  'use strict';

  function getSTATE() { return global.MP_STATE || {}; }
  function getUI()    { return global.MP_UI || {}; }
  function el(id)     { return document.getElementById(id); }

  let currentReplyTo = null;
  let attachedFile = null;

  function render() {
    const view = el('view');
    if (!view) return;

    const STATE = getSTATE();
    const UI = getUI();
    const st = STATE.state || {};
    const user = st.currentUser;
    const messages = st.messages || [];
    const isAnon = st.prefs ? !!st.prefs.defaultAnonymous : false;

    const pinnedMessages = messages.filter(m => m.isPinned);

    view.innerHTML = `
      <div class="max-w-5xl mx-auto space-y-3 pb-8 animate-fade-in">
        
        <!-- Header -->
        <div class="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 class="text-2xl font-black text-slate-100 tracking-tight">Community</h1>
            <p class="text-sm text-slate-400 mt-0.5">Share notes, MCQs, and discuss with your batch peers in real-time.</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live discussion
            </span>
            <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-900/40 text-brand-300 border border-brand-800/50">${messages.length} messages</span>
          </div>
        </div>

        <!-- Pinned Messages Banner -->
        ${pinnedMessages.length > 0 ? `
          <div class="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-2.5 px-3 flex items-center justify-between text-xs text-amber-200 gap-3">
            <div class="flex items-center gap-2 overflow-hidden">
              <span class="text-base shrink-0">📌</span>
              <span class="font-bold shrink-0">Pinned:</span>
              <span class="truncate">${UI.ESC ? UI.ESC(pinnedMessages[pinnedMessages.length - 1].text) : pinnedMessages[pinnedMessages.length - 1].text}</span>
            </div>
            <span class="text-[10px] text-amber-400/80 shrink-0">(${pinnedMessages.length})</span>
          </div>
        ` : ''}

        <!-- Chat Container -->
        <div class="bg-slate-900/80 rounded-2xl border border-slate-800 shadow-xl flex flex-col h-[560px]">
          
          <!-- Message List -->
          <div id="chat-messages-list" class="flex-1 overflow-y-auto p-3 space-y-2">
            ${messages.length === 0 ? `
              <div class="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500">
                <div class="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-2xl mb-2">💬</div>
                <p class="font-bold text-slate-300">No messages yet</p>
                <p class="text-xs text-slate-500 mt-1">Be the first to start the conversation!</p>
              </div>
            ` : messages.map(msg => {
              const author = (st.users || []).find(u => u.id === msg.authorId) || { fullName: user ? user.fullName : 'Student' };
              const isMe = user && msg.authorId === user.id;
              const displayName = msg.anonymous ? 'Anonymous Student' : (isMe ? (user ? user.fullName : 'You') : author.fullName);

              const parentMsg = msg.replyTo ? messages.find(m => m.id === msg.replyTo) : null;

              return `
                <div class="flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} items-start group">
                  <div class="w-7 h-7 rounded-full ${isMe ? 'bg-brand-600' : 'bg-slate-700'} text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm mt-0.5">
                    ${msg.anonymous ? '👤' : (displayName[0] || 'U')}
                  </div>

                  <div class="max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col">
                    <div class="flex items-center gap-2 mb-0.5 px-1">
                      <span class="text-xs font-bold text-slate-300">${UI.ESC ? UI.ESC(displayName) : displayName}</span>
                      <span class="text-[10px] text-slate-500">${msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                      ${msg.isPinned ? `<span class="text-[10px] text-amber-400">📌 Pinned</span>` : ''}
                    </div>

                    <div class="relative p-2.5 rounded-2xl text-sm w-fit max-w-full ${isMe ? 'bg-brand-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700/60'} shadow-sm leading-relaxed whitespace-pre-wrap break-words">
                      
                      <!-- Replying Context -->
                      ${parentMsg ? `
                        <div class="mb-1.5 p-1.5 rounded-lg bg-black/20 border-l-2 border-brand-400 text-xs opacity-85">
                          <span class="font-bold block text-[10px] text-brand-200">Replying to message:</span>
                          <span class="line-clamp-1">${UI.ESC ? UI.ESC(parentMsg.text) : parentMsg.text}</span>
                        </div>
                      ` : ''}

                      ${UI.ESC ? UI.ESC(msg.text || '') : (msg.text || '')}

                      <!-- Attached Image -->
                      ${msg.imageBase64 && typeof msg.imageBase64 === 'string' && msg.imageBase64.startsWith('data:image') ? `
                        <img src="${msg.imageBase64}" class="mt-2 rounded-xl max-h-64 w-auto object-contain border border-black/20 block" />
                      ` : ''}

                      <!-- Attached File -->
                      ${msg.fileData && msg.fileData.url ? `
                        <a href="${msg.fileData.url}" download="${msg.fileData.name}" class="mt-2 flex items-center gap-2 p-1.5 rounded-xl bg-black/20 hover:bg-black/30 text-xs transition border border-white/10">
                          <span class="text-base">📄</span>
                          <span class="truncate max-w-[180px] font-medium">${msg.fileData.name}</span>
                          <span class="text-[10px] opacity-70 shrink-0">⬇️ Download</span>
                        </a>
                      ` : ''}

                      <!-- Action Buttons (Hover) -->
                      <div class="absolute ${isMe ? '-left-16' : '-right-16'} top-1 hidden group-hover:flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1 shadow-lg z-10">
                        <button class="btn-reply text-xs p-1 hover:bg-slate-700 rounded text-slate-300 cursor-pointer" data-id="${msg.id}" title="Reply">↩️</button>
                        <button class="btn-pin text-xs p-1 hover:bg-slate-700 rounded text-slate-300 cursor-pointer" data-id="${msg.id}" title="Pin/Unpin">📌</button>
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Active Reply Bar -->
          <div id="reply-preview-bar" class="${currentReplyTo ? 'flex' : 'hidden'} items-center justify-between px-3 py-1.5 bg-slate-800/90 border-t border-slate-700 text-xs text-slate-300">
            <div class="flex items-center gap-2 truncate">
              <span class="text-brand-400 font-bold">↩️ Replying to:</span>
              <span id="reply-preview-text" class="truncate text-slate-400"></span>
            </div>
            <button id="cancel-reply-btn" class="text-slate-400 hover:text-white font-bold p-1 cursor-pointer">✕</button>
          </div>

          <!-- Active Attachment Preview -->
          <div id="file-preview-bar" class="${attachedFile ? 'flex' : 'hidden'} items-center justify-between px-3 py-1.5 bg-slate-800/90 border-t border-slate-700 text-xs text-slate-300">
            <div class="flex items-center gap-2 truncate">
              <span>📎 Attached:</span>
              <span id="file-preview-name" class="font-bold text-brand-400 truncate"></span>
            </div>
            <button id="cancel-file-btn" class="text-slate-400 hover:text-white font-bold p-1 cursor-pointer">✕</button>
          </div>

          <!-- Input Footer -->
          <div class="p-2.5 border-t border-slate-800 bg-slate-900/50 rounded-b-2xl">
            <div class="flex items-center gap-2">
              
              <!-- Attachment Button -->
              <label class="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer transition border border-slate-700" title="Attach Image or File">
                <span class="text-sm">📎</span>
                <input type="file" id="chat-file-input" class="hidden" accept="image/*,.pdf,.doc,.docx,.txt" />
              </label>

              <input type="text" id="chat-input" placeholder="Type a message..." class="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-brand-500 transition placeholder:text-slate-500" />
              
              <button id="chat-send-btn" class="px-4 py-2 bg-brand-600 hover:bg-brand-500 active:scale-95 text-white font-bold text-sm rounded-xl transition flex items-center gap-1.5 shadow-md shrink-0 cursor-pointer">
                <span>Send</span>
                <span class="text-xs">🚀</span>
              </button>
            </div>
            
            <div class="mt-2 flex items-center justify-between px-1 text-xs text-slate-400">
              <label class="flex items-center gap-1.5 cursor-pointer select-none">
                <input type="checkbox" id="chat-anon-check" ${isAnon ? 'checked' : ''} class="rounded border-slate-700 bg-slate-800 text-brand-600 focus:ring-brand-500" />
                <span>Post anonymously</span>
              </label>
              <span>Next message as: <strong class="text-slate-200">${isAnon ? 'Anonymous' : (user ? user.fullName : 'Guest')}</strong></span>
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
    const fileInput = el('chat-file-input');

    // Handle File Pick
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
          attachedFile = {
            name: file.name,
            type: file.type,
            data: evt.target.result
          };
          el('file-preview-name').innerText = file.name;
          el('file-preview-bar').classList.remove('hidden');
          el('file-preview-bar').classList.add('flex');
        };
        reader.readAsDataURL(file);
      });
    }

    // Cancel Reply & Cancel File
    const cancelReplyBtn = el('cancel-reply-btn');
    if (cancelReplyBtn) {
      cancelReplyBtn.addEventListener('click', () => {
        currentReplyTo = null;
        render();
      });
    }

    const cancelFileBtn = el('cancel-file-btn');
    if (cancelFileBtn) {
      cancelFileBtn.addEventListener('click', () => {
        attachedFile = null;
        if (fileInput) fileInput.value = '';
        render();
      });
    }

    // Bind Reply & Pin Buttons
    document.querySelectorAll('.btn-reply').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.dataset.id;
        const target = messages.find(m => m.id === id);
        if (target) {
          currentReplyTo = id;
          el('reply-preview-text').innerText = target.text;
          el('reply-preview-bar').classList.remove('hidden');
          el('reply-preview-bar').classList.add('flex');
          if (input) input.focus();
        }
      });
    });

    document.querySelectorAll('.btn-pin').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.dataset.id;
        if (STATE.togglePinMessage) {
          await STATE.togglePinMessage(id);
          render();
        }
      });
    });

    async function handleSend() {
      const text = (input ? input.value : '').trim();
      if (!text && !attachedFile) return;

      const isAnonMsg = anonCheck ? anonCheck.checked : false;

      let imageBase64 = null;
      let fileData = null;

      if (attachedFile) {
        if (attachedFile.type.startsWith('image/')) {
          imageBase64 = attachedFile.data;
        } else {
          fileData = { name: attachedFile.name, url: attachedFile.data };
        }
      }

      const msg = {
        id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        authorId: user ? user.id : 'guest',
        text: text,
        imageBase64: imageBase64,
        fileData: fileData,
        replyTo: currentReplyTo,
        anonymous: isAnonMsg,
        createdAt: Date.now()
      };

      currentReplyTo = null;
      attachedFile = null;

      if (typeof STATE.addMessage === 'function') {
        await STATE.addMessage(msg);
      }

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
  }

  global.MP_CHAT = { render };
})(window);
