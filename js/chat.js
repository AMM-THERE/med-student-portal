/* ============================================================
   chat.js — Community: WhatsApp Features (Pin, Star, Reactions, Replies, Ticks, File Attachments)
   ============================================================ */
(function (global) {
  'use strict';

  const CFG   = global.MP_CONFIG;
  const STATE = global.MP_STATE;
  const UI    = global.MP_UI;
  const UTIL  = global.MP_UTIL;

  let pollHandle = null;
  let lastMsgId = null;
  let listEl = null;
  let composer = { imageBase64: null, fileData: null, replyTo: null };

  function view() { return document.getElementById('view'); }

  function startPolling() {
    stopPolling();
    pollHandle = setInterval(() => {
      STATE.refreshMessages();
      const msgs = STATE.state.messages || [];
      const newest = msgs.length ? msgs[msgs.length - 1].id : null;
      if (newest !== lastMsgId) {
        lastMsgId = newest;
        if (listEl) renderAllMessages();
      }
    }, CFG.CHAT_POLL_MS);
  }

  function stopPolling() {
    if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
  }

  function clearComposerReply(v) {
    composer.replyTo = null;
    const replyBox = v.querySelector('#reply-preview');
    if (replyBox) replyBox.classList.add('hidden');
  }

  function render() {
    const v = view();
    if (!v) return;
    const me = STATE.state.currentUser;
    if (!me) return;

    // Ensure state properties exist
    if (!STATE.state.pinnedMsgId) STATE.state.pinnedMsgId = null;
    if (!STATE.state.starredMsgs) STATE.state.starredMsgs = [];

    composer.imageBase64 = null;
    composer.fileData = null;
    composer.replyTo = null;

    const pinnedMsg = STATE.state.messages.find(m => m.id === STATE.state.pinnedMsgId);

    v.innerHTML = `
      <div class="relative overflow-hidden rounded-3xl hero-chat p-5 sm:p-6 mb-4 border border-slate-200/60 dark:border-slate-800 animate-fade-up">
        <div class="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-accent-500/10 blur-2xl pointer-events-none"></div>
        <div class="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Community</h1>
            <p class="text-sm text-slate-600 dark:text-slate-300 mt-1">Share notes, MCQs, and discuss with peers.</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span class="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse-dot"></span>
              <span>Live · polls every 3s</span>
            </span>
            <div id="msg-count" class="text-[11px] font-medium text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">${STATE.state.messages.length} messages</div>
          </div>
        </div>
      </div>

      <div class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col" style="height: calc(100vh - 230px); min-height: 440px;">
        
        <!-- Pinned Message Banner -->
        <div id="pinned-banner" class="${pinnedMsg ? 'flex' : 'hidden'} items-center justify-between px-4 py-2 bg-amber-50 dark:bg-slate-800/90 border-b border-amber-200 dark:border-slate-700 text-xs">
          <div class="flex items-center gap-2 text-amber-800 dark:text-amber-300 min-w-0">
            <svg class="w-4 h-4 shrink-0 rotate-45 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1.323l1.954 1.954a1 1 0 01.293.707V9a1 1 0 01-.293.707L11 11.677V17a1 1 0 11-2 0v-5.323l-1.954-1.97A1 1 0 016.753 9V7a1 1 0 01.293-.707L9 4.323V3a1 1 0 011-1z"></path></svg>
            <div class="truncate">
              <span class="font-bold">Pinned Message:</span> 
              <span id="pinned-text">${pinnedMsg ? UI.ESC(pinnedMsg.text || 'Attachment') : ''}</span>
            </div>
          </div>
          <button id="unpin-btn" class="text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 ml-2 font-bold p-1">✕</button>
        </div>

        <div id="msg-list" class="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/60 dark:bg-slate-950/40"></div>

        <div class="border-t border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900">
          
          <!-- Reply Preview Banner -->
          <div id="reply-preview" class="hidden mb-2 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border-l-4 border-brand-500 flex items-center justify-between gap-2 text-xs">
            <div class="min-w-0 flex-1">
              <div class="font-bold text-brand-600 dark:text-brand-400 truncate" id="reply-preview-author">Replying to...</div>
              <div class="text-slate-700 dark:text-slate-300 truncate" id="reply-preview-text">...</div>
            </div>
            <button id="reply-clear" type="button" class="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">${UI.icon('x','w-4 h-4')}</button>
          </div>

          <!-- Image Preview -->
          <div id="img-preview" class="hidden mb-2 relative inline-block">
            <img id="img-preview-el" class="max-h-24 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm" />
            <button id="img-clear" type="button" class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs shadow-md">${UI.icon('x','w-3.5 h-3.5')}</button>
          </div>

          <!-- File Preview -->
          <div id="file-preview" class="hidden mb-2 relative inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
            <svg class="w-5 h-5 text-brand-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            <span id="file-preview-name" class="text-sm font-medium text-slate-700 dark:text-slate-200 max-w-[200px] truncate"></span>
            <button id="file-clear" type="button" class="ml-2 text-rose-500 hover:text-rose-700 flex items-center justify-center">${UI.icon('x','w-4 h-4')}</button>
          </div>

          <!-- Inputs Controls -->
          <div class="flex items-end gap-2">
            <button id="btn-attach" type="button" class="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Attach image">${UI.icon('image','w-5 h-5')}</button>
            
            <button id="btn-attach-file" type="button" class="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Attach document">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
            </button>
            <input id="chat-doc-input" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.csv,.xlsx" class="hidden" />

            <textarea id="msg-text" rows="1" placeholder="Type a message…" class="flex-1 resize-none rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 max-h-32 transition-all"></textarea>
            <button id="btn-send" type="button" class="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 active:scale-95 inline-flex items-center gap-1.5 transition-all shadow-sm">${UI.icon('send','w-4 h-4')}<span class="hidden sm:inline">Send</span></button>
          </div>
          
          <div id="anon-indicator" class="mt-2 inline-flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span id="anon-dot" class="inline-block w-2 h-2 rounded-full ${STATE.state.prefs.defaultAnonymous ? 'bg-violet-500' : 'bg-slate-400'}"></span>
            <span>Next message will post as <span id="anon-mode-label" class="font-semibold ${STATE.state.prefs.defaultAnonymous ? 'text-violet-600 dark:text-violet-300' : 'text-slate-700 dark:text-slate-200'}">${STATE.state.prefs.defaultAnonymous ? 'Anonymous' : (me.fullName.split(' ')[0])}</span>.</span>
            <button id="anon-change" type="button" class="ml-1 underline text-brand-600 dark:text-brand-300 hover:no-underline">Change in Settings</button>
          </div>
        </div>
      </div>
    `;

    listEl = v.querySelector('#msg-list');
    renderAllMessages();

    // Attach Event Listeners
    const ta = v.querySelector('#msg-text');
    const sendBtn = v.querySelector('#btn-send');
    const fileInput = document.getElementById('chat-image-input');
    const previewBox = v.querySelector('#img-preview');
    const previewEl = v.querySelector('#img-preview-el');
    const clearBtn = v.querySelector('#img-clear');
    const attachBtn = v.querySelector('#btn-attach');
    const changeAnonBtn = v.querySelector('#anon-change');

    const attachDocBtn = v.querySelector('#btn-attach-file');
    const docInput = v.querySelector('#chat-doc-input');
    const filePreviewBox = v.querySelector('#file-preview');
    const filePreviewName = v.querySelector('#file-preview-name');
    const fileClearBtn = v.querySelector('#file-clear');
    const replyClearBtn = v.querySelector('#reply-clear');
    const unpinBtn = v.querySelector('#unpin-btn');

    if (unpinBtn) {
      unpinBtn.addEventListener('click', () => {
        STATE.state.pinnedMsgId = null;
        render();
      });
    }

    if (changeAnonBtn) {
      changeAnonBtn.addEventListener('click', () => {
        if (global.MP_SETTINGS) global.MP_SETTINGS.openSettings();
      });
    }

    if (replyClearBtn) {
      replyClearBtn.addEventListener('click', () => clearComposerReply(v));
    }

    // Attachments Setup
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.onchange = async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      if (f.size > CFG.MAX_IMAGE_BYTES) {
        UI.toast('Image must be 2MB or smaller.', { variant: 'error' });
        fileInput.value = '';
        return;
      }
      try {
        const b64 = await UTIL.fileToBase64(f);
        composer.imageBase64 = b64;
        previewEl.src = b64;
        previewBox.classList.remove('hidden');
      } catch {
        UI.toast('Could not read image.', { variant: 'error' });
      }
      fileInput.value = '';
    };
    clearBtn.addEventListener('click', () => {
      composer.imageBase64 = null;
      previewBox.classList.add('hidden');
      previewEl.src = '';
    });

    attachDocBtn.addEventListener('click', () => docInput.click());
    docInput.onchange = async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      if (f.size > CFG.MAX_IMAGE_BYTES) { 
        UI.toast('File must be 2MB or smaller.', { variant: 'error' });
        docInput.value = '';
        return;
      }
      try {
        const b64 = await UTIL.fileToBase64(f);
        composer.fileData = { name: f.name, type: f.type, base64: b64 };
        filePreviewName.textContent = f.name;
        filePreviewBox.classList.remove('hidden');
      } catch {
        UI.toast('Could not read file.', { variant: 'error' });
      }
      docInput.value = '';
    };
    fileClearBtn.addEventListener('click', () => {
      composer.fileData = null;
      filePreviewBox.classList.add('hidden');
      filePreviewName.textContent = '';
    });

    // Send Message
    function send() {
      const text = ta.value.trim();
      if (!text && !composer.imageBase64 && !composer.fileData) return;
      
      const msg = {
        id: UTIL.uid('msg'),
        authorId: me.id,
        text,
        imageBase64: composer.imageBase64,
        fileData: composer.fileData,
        replyTo: composer.replyTo,
        reactions: {},
        anonymous: !!STATE.state.prefs.defaultAnonymous,
        createdAt: Date.now()
      };

      const res = STATE.addMessage(msg);
      if (res && res.ok === false) {
        UI.toast('Storage full — message not sent.', { variant: 'error' });
        return;
      }

      appendMessage(msg, true);
      lastMsgId = msg.id;
      updateCountBadge();
      
      ta.value = '';
      composer.imageBase64 = null;
      composer.fileData = null;
      clearComposerReply(v);
      previewBox.classList.add('hidden');
      previewEl.src = '';
      filePreviewBox.classList.add('hidden');
      filePreviewName.textContent = '';
      ta.focus();
    }

    sendBtn.addEventListener('click', send);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });

    startPolling();
  }

  function renderAllMessages() {
    if (!listEl) return;
    listEl.innerHTML = '';
    const msgs = STATE.state.messages || [];
    msgs.forEach(m => appendMessage(m, false));
    lastMsgId = msgs.length ? msgs[msgs.length - 1].id : null;
    scrollToBottom();
  }

  function togglePinMessage(msgId) {
    if (STATE.state.pinnedMsgId === msgId) {
      STATE.state.pinnedMsgId = null;
      UI.toast('Message unpinned', { variant: 'info' });
    } else {
      STATE.state.pinnedMsgId = msgId;
      UI.toast('Message pinned to top!', { variant: 'success' });
    }
    render();
  }

  function toggleStarMessage(msgId) {
    if (!STATE.state.starredMsgs) STATE.state.starredMsgs = [];
    const idx = STATE.state.starredMsgs.indexOf(msgId);
    if (idx > -1) {
      STATE.state.starredMsgs.splice(idx, 1);
      UI.toast('Removed from starred', { variant: 'info' });
    } else {
      STATE.state.starredMsgs.push(msgId);
      UI.toast('Starred message ⭐', { variant: 'success' });
    }
    renderAllMessages();
  }

  function toggleReaction(msg, emoji) {
    if (!msg.reactions) msg.reactions = {};
    const me = STATE.state.currentUser;
    if (!me) return;

    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
    const uIdx = msg.reactions[emoji].indexOf(me.id);
    if (uIdx > -1) {
      msg.reactions[emoji].splice(uIdx, 1);
      if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
    } else {
      msg.reactions[emoji].push(me.id);
    }

    if (global.MP_STORAGE) {
      const key = (CFG.KEYS && CFG.KEYS.MESSAGES) || 'medportal_messages';
      global.MP_STORAGE.set(key, STATE.state.messages);
    }
    renderAllMessages();
  }

  function deleteMessage(msgId) {
    if (!confirm('Are you sure you want to delete this message?')) return;
    if (STATE.state.pinnedMsgId === msgId) STATE.state.pinnedMsgId = null;
    
    if (typeof STATE.deleteMessage === 'function') {
      STATE.deleteMessage(msgId);
    } else {
      STATE.state.messages = STATE.state.messages.filter(m => m.id !== msgId);
      if (global.MP_STORAGE) {
        const key = (CFG.KEYS && CFG.KEYS.MESSAGES) || 'medportal_messages';
        global.MP_STORAGE.set(key, STATE.state.messages);
      }
    }
    renderAllMessages();
    updateCountBadge();
    UI.toast('Message deleted', { variant: 'info' });
  }

  function setupReply(msg, authorName) {
    const v = view();
    if (!v) return;

    let snippet = msg.text || '';
    if (!snippet) {
      if (msg.imageBase64) snippet = '📷 Photo';
      else if (msg.fileData) snippet = '📄 ' + msg.fileData.name;
    }

    composer.replyTo = { id: msg.id, authorName: authorName, text: snippet };

    const replyBox = v.querySelector('#reply-preview');
    const replyAuthor = v.querySelector('#reply-preview-author');
    const replyText = v.querySelector('#reply-preview-text');
    const ta = v.querySelector('#msg-text');

    if (replyBox && replyAuthor && replyText) {
      replyAuthor.textContent = 'Replying to ' + authorName;
      replyText.textContent = snippet;
      replyBox.classList.remove('hidden');
    }
    if (ta) ta.focus();
  }

  function appendMessage(m, isNew) {
    if (!listEl) return;
    const me = STATE.state.currentUser;
    const author = STATE.state.users.find(u => u.id === m.authorId);
    const isMine = me && author && author.id === me.id;
    const adminView = me && me.isAdmin;

    const isStarred = (STATE.state.starredMsgs || []).includes(m.id);
    const isPinned = STATE.state.pinnedMsgId === m.id;

    let displayName, showBadge, revealAttr = '';
    if (!m.anonymous) {
      displayName = author ? author.fullName : 'Unknown';
      showBadge = author ? author.year : null;
    } else {
      if (adminView && author) {
        displayName = author.fullName;
        showBadge = author.year;
        revealAttr = 'real';
      } else {
        displayName = 'Anonymous';
        showBadge = null;
      }
    }

    const bubble = document.createElement('div');
    bubble.className = `group relative flex gap-2.5 ${isMine ? 'flex-row-reverse' : ''}`;

    const anonAvatar = m.anonymous && !(adminView && author);
    
    // Reply preview inside bubble
    const replyQuoteHTML = m.replyTo ? `
      <div class="mb-1.5 p-2 rounded-lg text-xs ${isMine ? 'bg-black/20 text-white/90 border-l-2 border-white' : 'bg-slate-200/70 dark:bg-slate-700/60 text-slate-800 dark:text-slate-200 border-l-2 border-brand-500'}">
        <div class="font-bold opacity-90 truncate">${UI.ESC(m.replyTo.authorName)}</div>
        <div class="truncate opacity-80">${UI.ESC(m.replyTo.text)}</div>
      </div>
    ` : '';

    // Reactions Pill HTML
    let reactionsHTML = '';
    if (m.reactions && Object.keys(m.reactions).length > 0) {
      reactionsHTML = `<div class="flex flex-wrap gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}">`;
      for (const [emoji, uIds] of Object.entries(m.reactions)) {
        if (uIds.length > 0) {
          const hasMine = uIds.includes(me ? me.id : '');
          reactionsHTML += `
            <button class="btn-react-pill px-1.5 py-0.5 rounded-full text-[11px] border flex items-center gap-1 ${hasMine ? 'bg-brand-50 dark:bg-brand-950 border-brand-300 text-brand-600 dark:text-brand-300 font-bold' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}" data-emoji="${emoji}">
              <span>${emoji}</span>
              <span>${uIds.length}</span>
            </button>
          `;
        }
      }
      reactionsHTML += `</div>`;
    }

    // Double Ticks Icon for Sent Messages
    const doubleTicks = isMine ? `
      <svg class="w-3.5 h-3.5 inline-block ml-1 text-sky-300" fill="currentColor" viewBox="0 0 24 24"><path d="M0.41,13.41L6,19L7.41,17.58L1.83,12M22.24,5.58L11.66,16.17L7.5,12L6.08,13.41L11.66,19L23.66,7M18,7L16.59,5.58L10.25,11.93L11.66,13.34L18,7Z"/></svg>
    ` : '';

    bubble.innerHTML = `
      ${UI.avatar(author ? author.fullName : '?', anonAvatar)}
      <div class="max-w-[80%] sm:max-w-[75%] ${isMine ? 'items-end text-right' : 'items-start'} flex flex-col">
        
        <!-- Header Info -->
        <div class="flex items-center gap-1.5 ${isMine ? 'flex-row-reverse' : ''} mb-0.5">
          <span class="text-xs font-semibold text-slate-800 dark:text-slate-200">${UI.ESC(displayName)}${revealAttr === 'real' ? ' <span class="text-amber-600 dark:text-amber-400">(real)</span>' : ''}</span>
          ${showBadge ? UI.yearBadge(showBadge, { extraClass: 'align-middle' }) : ''}
          ${m.anonymous ? `<span class="text-[10px] px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">anon</span>` : ''}
          ${isPinned ? `<span class="text-amber-500 font-bold text-xs" title="Pinned">📌</span>` : ''}
          ${isStarred ? `<span class="text-amber-400 font-bold text-xs" title="Starred">⭐</span>` : ''}
        </div>
        
        <!-- Bubble Box & Floating Toolbar -->
        <div class="relative flex items-center gap-1 ${isMine ? 'flex-row-reverse' : ''}">
          
          <!-- FIXED LIGHT MODE COLORS HERE: Received messages get bg-slate-100 text-slate-900 -->
          <div class="rounded-2xl px-3.5 py-2 text-sm ${isMine ? 'bg-brand-600 text-white border-brand-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700'} border break-words shadow-sm">
            ${replyQuoteHTML}
            ${m.text ? `<div class="whitespace-pre-wrap leading-relaxed">${UI.ESC(m.text)}</div>` : ''}
            ${m.imageBase64 ? `<img src="${m.imageBase64}" class="mt-2 rounded-lg max-h-64 cursor-zoom-in border border-black/10" onclick="window.MP_CHAT.openLightbox('${m.imageBase64.replace(/'/g, "\\'")}')" alt="attachment" />` : ''}
            ${m.fileData ? `
              <a href="${m.fileData.base64}" download="${m.fileData.name}" class="mt-2 flex items-center gap-2 p-2.5 rounded-lg border ${isMine ? 'border-brand-500 bg-brand-700/50 hover:bg-brand-700/70 text-white' : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800'} transition-colors cursor-pointer" title="Download ${UI.ESC(m.fileData.name)}">
                <svg class="w-5 h-5 shrink-0 ${isMine ? 'text-brand-200' : 'text-brand-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                <span class="text-sm font-medium truncate max-w-[150px] sm:max-w-[200px]">${UI.ESC(m.fileData.name)}</span>
              </a>
            ` : ''}
          </div>

          <!-- WhatsApp Hover Action Bar -->
          <div class="opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
            <button class="btn-react p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-xs" data-emoji="👍">👍</button>
            <button class="btn-react p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-xs" data-emoji="❤️">❤️</button>
            <button class="btn-react p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-xs" data-emoji="😂">😂</button>
            <button class="btn-reply p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 hover:text-brand-600 dark:hover:text-brand-400" title="Reply">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
            </button>
            <button class="btn-star p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full ${isStarred ? 'text-amber-500' : 'text-slate-400'}" title="Star Message">⭐</button>
            <button class="btn-pin p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full ${isPinned ? 'text-amber-600' : 'text-slate-400'}" title="Pin Message">📌</button>
            ${(isMine || adminView) ? `
              <button class="btn-delete p-1 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-full text-slate-400 hover:text-rose-600" title="Delete">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>
            ` : ''}
          </div>

        </div>

        <!-- Render Emoji Reaction Pills -->
        ${reactionsHTML}

        <!-- Date & Delivery Ticks -->
        <div class="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 flex items-center">
          <span>${UTIL.formatDate(m.createdAt)}</span>
          ${doubleTicks}
        </div>
      </div>
    `;

    // Connect Events
    const replyBtn = bubble.querySelector('.btn-reply');
    if (replyBtn) replyBtn.addEventListener('click', () => setupReply(m, displayName));

    const starBtn = bubble.querySelector('.btn-star');
    if (starBtn) starBtn.addEventListener('click', () => toggleStarMessage(m.id));

    const pinBtn = bubble.querySelector('.btn-pin');
    if (pinBtn) pinBtn.addEventListener('click', () => togglePinMessage(m.id));

    const deleteBtn = bubble.querySelector('.btn-delete');
    if (deleteBtn) deleteBtn.addEventListener('click', () => deleteMessage(m.id));

    bubble.querySelectorAll('.btn-react, .btn-react-pill').forEach(btn => {
      btn.addEventListener('click', () => toggleReaction(m, btn.dataset.emoji));
    });

    listEl.appendChild(bubble);
  }

  function scrollToBottom() {
    if (!listEl) return;
    listEl.scrollTop = listEl.scrollHeight;
  }

  function updateCountBadge() {
    const badge = document.getElementById('msg-count');
    if (badge) badge.textContent = (STATE.state.messages || []).length + ' messages';
  }

  function updateAnonIndicator() {
    const me = STATE.state.currentUser;
    if (!me) return;
    const on = !!STATE.state.prefs.defaultAnonymous;
    const dot  = document.getElementById('anon-dot');
    const lbl  = document.getElementById('anon-mode-label');
    if (dot) {
      dot.classList.toggle('bg-violet-500', on);
      dot.classList.toggle('bg-slate-400', !on);
    }
    if (lbl) {
      lbl.textContent = on ? 'Anonymous' : me.fullName.split(' ')[0];
      lbl.classList.toggle('text-violet-600', on);
      lbl.classList.toggle('dark:text-violet-300', on);
      lbl.classList.toggle('text-slate-700', !on);
      lbl.classList.toggle('dark:text-slate-200', !on);
    }
  }

  STATE.subscribe(() => updateAnonIndicator());

  function openLightbox(src) {
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    if (!lb || !img) return;
    img.src = src;
    lb.classList.remove('hidden');
    lb.classList.add('flex');
  }

  global.MP_CHAT = { render, stopPolling, startPolling, openLightbox };
})(window);