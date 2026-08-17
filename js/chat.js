/* ============================================================
    chat.js — Full Community Chat with Attachments, Reply, Pin,
    Reactions, Soft/Hard Delete & Admin Moderation
    ============================================================ */
(function (global) {
  'use strict';

  function getSTATE() { return global.MP_STATE || {}; }
  function getUI()    { return global.MP_UI || {}; }
  function el(id)     { return document.getElementById(id); }

  let currentReplyTo = null;
  let attachedFile = null;
  let openMenuId = null; // id of the message whose action menu is open

  const GROUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  let globalCloserAttached = false;
  function ensureGlobalCloser() {
    if (globalCloserAttached) return;
    globalCloserAttached = true;
    document.addEventListener('click', (e) => {
      if (!openMenuId) return;
      if (e.target.closest('.msg-actions')) return;
      openMenuId = null;
      document.querySelectorAll('.msg-menu').forEach(m => m.classList.add('hidden'));
    });
  }

  function resolveAuthorName(msg, st, isMe, user, isAdminViewer) {
    if (msg.anonymous) {
      if (!isAdminViewer) return 'Anonymous Student';
      // Admins get to see who is really posting behind an anonymous message.
      const realName = isMe
        ? (user ? user.fullName : 'You')
        : (msg.authorName || (((st.users || []).find(u => u.id === msg.authorId)) || {}).fullName || 'Unknown');
      return `Anonymous Student (real: ${realName})`;
    }
    if (isMe) return user ? user.fullName : 'You';
    if (msg.authorName) return msg.authorName;
    const found = (st.users || []).find(u => u.id === msg.authorId);
    if (found && found.fullName) return found.fullName;
    return 'Student';
  }

  function render() {
    const view = el('view');
    if (!view) return;

    const prevList = el('chat-messages-list');
    const prevScrollTop = prevList ? prevList.scrollTop : null;
    const wasNearBottom = prevList
      ? (prevList.scrollHeight - prevList.scrollTop - prevList.clientHeight) < 80
      : true;

    const STATE = getSTATE();
    const UI = getUI();
    const st = STATE.state || {};
    const user = st.currentUser;
    const isAdminViewer = !!(user && user.isAdmin);
    const messages = st.messages || [];
    const isAnon = st.prefs ? !!st.prefs.defaultAnonymous : false;

    // A pinned+deleted message shouldn't linger in the pinned banner (this
    // is also enforced when deleting, but guarded here too for old data).
    const pinnedMessages = messages.filter(m => m.isPinned && !m.isDeleted);

    view.innerHTML = `
      <div class="max-w-5xl mx-auto flex flex-col gap-3 h-[calc(100vh-15rem)] min-h-[420px] animate-fade-in">

        <!-- Header -->
        <div class="shrink-0 bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
          <div class="shrink-0 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-2.5 px-3 flex items-center justify-between text-xs text-amber-200 gap-3">
            <div class="flex items-center gap-2 overflow-hidden">
              <span class="text-base shrink-0">📌</span>
              <span class="font-bold shrink-0">Pinned:</span>
              <span class="truncate">${UI.ESC ? UI.ESC(pinnedMessages[pinnedMessages.length - 1].text) : pinnedMessages[pinnedMessages.length - 1].text}</span>
            </div>
            <span class="text-[10px] text-amber-400/80 shrink-0">(${pinnedMessages.length})</span>
          </div>
        ` : ''}

        <!-- Chat Container -->
        <div class="flex-1 min-h-0 bg-slate-900/80 rounded-2xl border border-slate-800 shadow-xl flex flex-col">

          <!-- Message List -->
          <div id="chat-messages-list" class="p-3 flex-1 min-h-0 overflow-y-auto">
            ${messages.length === 0 ? `
              <div class="flex flex-col items-center justify-center text-center p-8 text-slate-500">
                <div class="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-2xl mb-2">💬</div>
                <p class="font-bold text-slate-300">No messages yet</p>
                <p class="text-xs text-slate-500 mt-1">Be the first to start the conversation!</p>
              </div>
            ` : messages.map((msg, idx) => {
              const isMe = user && msg.authorId === user.id;
              const displayName = resolveAuthorName(msg, st, isMe, user, isAdminViewer);
              const isDeleted = !!msg.isDeleted;

              const parentMsg = msg.replyTo ? messages.find(m => m.id === msg.replyTo) : null;

              const prev = messages[idx - 1];
              const sameSenderAsPrev = !!prev
                && !msg.replyTo
                && prev.anonymous === msg.anonymous
                && (msg.anonymous || prev.authorId === msg.authorId)
                && Math.abs((msg.createdAt || 0) - (prev.createdAt || 0)) < GROUP_WINDOW_MS;

              const showHeader = !sameSenderAsPrev;
              const rowSpacing = showHeader ? (idx === 0 ? '' : 'mt-3') : 'mt-0.5';

              // Soft-delete: the owner can delete their own message, and
              // admins can delete anyone's. Hard-delete (permanent removal)
              // is admin-only and only offered once a message is already
              // soft-deleted.
              const canSoftDelete = !isDeleted && !!(isMe || isAdminViewer);
              const canHardDelete = isDeleted && isAdminViewer;

              // Reactions are hidden once a message is deleted — they stop
              // being meaningful once the content itself is gone/hidden.
              const reactions = msg.reactions || {};
              const reactionEntries = Object.keys(reactions).filter(e => (reactions[e] || []).length > 0);
              const reactionsHtml = (!isDeleted && reactionEntries.length) ? `
                <div class="flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}">
                  ${reactionEntries.map(e => {
                    const list = reactions[e] || [];
                    const mine = !!(user && list.indexOf(user.id) !== -1);
                    return `<button class="reaction-pill inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] border ${mine ? 'bg-brand-900/40 border-brand-600 text-brand-200' : 'bg-slate-800 border-slate-700 text-slate-300'}" data-id="${msg.id}" data-emoji="${e}">
                      <span>${e}</span><span>${list.length}</span>
                    </button>`;
                  }).join('')}
                </div>
              ` : '';

              let menuHtml = '';
              if (!isDeleted) {
                menuHtml = `
                  <div class="msg-actions relative shrink-0 self-start mt-1">
                    <button class="btn-more w-6 h-6 flex items-center justify-center rounded-full text-slate-500 hover:text-white hover:bg-slate-700/70 transition" data-id="${msg.id}" title="More">⋮</button>
                    <div class="msg-menu ${openMenuId === msg.id ? '' : 'hidden'} absolute z-20 ${isMe ? 'right-0' : 'left-0'} top-7 w-48 max-w-[75vw] bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-1.5 text-xs">
                      <div class="flex items-center justify-between gap-1 px-1 pb-1.5 mb-1.5 border-b border-slate-700">
                        ${QUICK_REACTIONS.map(e => `<button class="reaction-pick text-base hover:scale-125 transition" data-id="${msg.id}" data-emoji="${e}">${e}</button>`).join('')}
                      </div>
                      <button class="menu-reply w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-700 text-slate-200" data-id="${msg.id}">↩️ Reply</button>
                      <button class="menu-pin w-full text-left px-2 py-1.5 rounded-lg hover:bg-slate-700 text-slate-200" data-id="${msg.id}">📌 ${msg.isPinned ? 'Unpin' : 'Pin'}</button>
                      ${canSoftDelete ? `<button class="menu-delete-soft w-full text-left px-2 py-1.5 rounded-lg hover:bg-rose-900/40 text-rose-300" data-id="${msg.id}">🗑️ Delete</button>` : ''}
                    </div>
                  </div>
                `;
              } else if (canHardDelete) {
                menuHtml = `
                  <div class="msg-actions relative shrink-0 self-start mt-1">
                    <button class="btn-more w-6 h-6 flex items-center justify-center rounded-full text-slate-500 hover:text-white hover:bg-slate-700/70 transition" data-id="${msg.id}" title="More">⋮</button>
                    <div class="msg-menu ${openMenuId === msg.id ? '' : 'hidden'} absolute z-20 ${isMe ? 'right-0' : 'left-0'} top-7 w-48 max-w-[75vw] bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-1.5 text-xs">
                      <button class="menu-delete-hard w-full text-left px-2 py-1.5 rounded-lg hover:bg-rose-900/40 text-rose-300" data-id="${msg.id}">🗑️ Delete permanently</button>
                    </div>
                  </div>
                `;
              }

              // Bubble body: non-admins viewing a deleted message see only a
              // placeholder — the original text/image/file never renders for
              // them. Admins keep seeing the real content plus a "Deleted"
              // tag, so they can moderate with full context.
              let bubbleInner;
              if (isDeleted && !isAdminViewer) {
                bubbleInner = `<span class="italic text-slate-400">This message was deleted.</span>`;
              } else {
                const replyBlock = parentMsg ? `<div class="mb-1.5 p-1.5 rounded-lg bg-black/20 border-l-2 border-brand-400 text-xs opacity-85"><span class="font-bold block text-[10px] text-brand-200">Replying to message:</span><span class="line-clamp-1">${UI.ESC ? UI.ESC(parentMsg.text) : parentMsg.text}</span></div>` : '';
                const textSpan = msg.text ? `<span class="block whitespace-pre-wrap break-words">${UI.ESC ? UI.ESC(msg.text) : msg.text}</span>` : '';
                const imageBlock = (msg.imageBase64 && typeof msg.imageBase64 === 'string' && msg.imageBase64.startsWith('data:image')) ? `<img src="${msg.imageBase64}" class="chat-zoomable-img mt-2 rounded-xl max-h-64 w-auto object-contain border border-black/20 block cursor-zoom-in" />` : '';
                const fileBlock = (msg.fileData && msg.fileData.url) ? `<a href="${msg.fileData.url}" download="${msg.fileData.name}" class="mt-2 flex items-center gap-2 p-1.5 rounded-xl bg-black/20 hover:bg-black/30 text-xs transition border border-white/10"><span class="text-base">📄</span><span class="truncate max-w-[180px] font-medium">${msg.fileData.name}</span><span class="text-[10px] opacity-70 shrink-0">⬇️ Download</span></a>` : '';
                bubbleInner = `${replyBlock}${textSpan}${imageBlock}${fileBlock}`;
              }

              return `
                <div class="flex gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'} items-start group ${rowSpacing}">
                  ${showHeader ? `
                    <div class="w-7 h-7 rounded-full ${isMe ? 'bg-brand-600' : 'bg-slate-700'} text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm mt-0.5">
                      ${msg.anonymous ? '👤' : (displayName[0] || 'U')}
                    </div>
                  ` : `<div class="w-7 shrink-0"></div>`}

                  <div class="max-w-[85%] sm:max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col min-w-0">
                    ${showHeader ? `
                      <div class="flex items-center gap-2 mb-0.5 px-1">
                        <span class="text-xs font-bold text-slate-300">${UI.ESC ? UI.ESC(displayName) : displayName}</span>
                        <span class="text-[10px] text-slate-500">${msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                        ${msg.isPinned ? `<span class="text-[10px] text-amber-400">📌 Pinned</span>` : ''}
                        ${isDeleted && isAdminViewer ? `<span class="text-[10px] text-rose-400 font-bold">🗑️ Deleted</span>` : ''}
                      </div>
                    ` : (msg.isPinned || (isDeleted && isAdminViewer) ? `<div class="px-1 mb-0.5 flex items-center gap-2">${msg.isPinned ? '<span class="text-[10px] text-amber-400">📌 Pinned</span>' : ''}${isDeleted && isAdminViewer ? '<span class="text-[10px] text-rose-400 font-bold">🗑️ Deleted</span>' : ''}</div>` : '')}

                    <div class="relative p-2.5 rounded-2xl text-sm w-fit max-w-full ${isMe ? 'bg-brand-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700/60'} shadow-sm leading-relaxed">${bubbleInner}</div>
                    ${reactionsHtml}
                  </div>

                  ${menuHtml}
                </div>
              `;
            }).join('')}
          </div>

          <!-- Active Reply Bar -->
          <div id="reply-preview-bar" class="shrink-0 ${currentReplyTo ? 'flex' : 'hidden'} items-center justify-between px-3 py-1.5 bg-slate-800/90 border-t border-slate-700 text-xs text-slate-300">
            <div class="flex items-center gap-2 truncate">
              <span class="text-brand-400 font-bold">↩️ Replying to:</span>
              <span id="reply-preview-text" class="truncate text-slate-400"></span>
            </div>
            <button id="cancel-reply-btn" class="text-slate-400 hover:text-white font-bold p-1 cursor-pointer">✕</button>
          </div>

          <!-- Active Attachment Preview -->
          <div id="file-preview-bar" class="shrink-0 ${attachedFile ? 'flex' : 'hidden'} items-center justify-between px-3 py-1.5 bg-slate-800/90 border-t border-slate-700 text-xs text-slate-300">
            <div class="flex items-center gap-2 truncate">
              <span>📎 Attached:</span>
              <span id="file-preview-name" class="font-bold text-brand-400 truncate"></span>
            </div>
            <button id="cancel-file-btn" class="text-slate-400 hover:text-white font-bold p-1 cursor-pointer">✕</button>
          </div>

          <!-- Input Footer -->
          <div class="p-2.5 border-t border-slate-800 bg-slate-900/50 rounded-b-2xl shrink-0">
            <div class="flex items-center gap-2">

              <!-- Attachment Button -->
              <label class="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer transition border border-slate-700" title="Attach Image or File">
                <span class="text-sm">📎</span>
                <input type="file" id="chat-file-input" class="hidden" accept="image/*,.pdf,.doc,.docx,.txt" />
              </label>

              <input type="text" id="chat-input" placeholder="Type a message..." class="flex-1 min-w-0 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-brand-500 transition placeholder:text-slate-500" />

              <button id="chat-send-btn" class="px-3 sm:px-4 py-2 bg-brand-600 hover:bg-brand-500 active:scale-95 text-white font-bold text-sm rounded-xl transition flex items-center gap-1.5 shadow-md shrink-0 cursor-pointer">
                <span class="hidden sm:inline">Send</span>
                <span class="text-xs">🚀</span>
              </button>
            </div>

            <div class="mt-2 flex items-center justify-between px-1 text-xs text-slate-400">
              <label class="flex items-center gap-1.5 cursor-pointer select-none">
                <input type="checkbox" id="chat-anon-check" ${isAnon ? 'checked' : ''} class="rounded border-slate-700 bg-slate-800 text-brand-600 focus:ring-brand-500" />
                <span>Post anonymously</span>
              </label>
              <span class="truncate">Next message as: <strong class="text-slate-200">${isAnon ? 'Anonymous' : (user ? user.fullName : 'Guest')}</strong></span>
            </div>
          </div>

        </div>
      </div>
    `;

    ensureGlobalCloser();

    document.querySelectorAll('.chat-zoomable-img').forEach(img => {
      img.addEventListener('click', (e) => {
        e.stopPropagation();
        const lightbox = document.getElementById('lightbox');
        const lightboxImg = document.getElementById('lightbox-img');
        if (!lightbox || !lightboxImg) return;
        lightboxImg.src = img.src;
        lightbox.classList.remove('hidden');
        lightbox.classList.add('flex');
      });
    });

    const msgList = el('chat-messages-list');
    if (msgList) {
      if (wasNearBottom) {
        msgList.scrollTop = msgList.scrollHeight;
      } else if (prevScrollTop !== null) {
        msgList.scrollTop = prevScrollTop;
      }
    }

    const sendBtn = el('chat-send-btn');
    const input = el('chat-input');
    const anonCheck = el('chat-anon-check');
    const fileInput = el('chat-file-input');

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

    document.querySelectorAll('.btn-more').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = b.dataset.id;
        openMenuId = (openMenuId === id) ? null : id;
        render();
      });
    });

    document.querySelectorAll('.menu-reply').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = b.dataset.id;
        const target = messages.find(m => m.id === id);
        openMenuId = null;
        if (target) {
          currentReplyTo = id;
          render();
          const bar = el('reply-preview-bar');
          const txt = el('reply-preview-text');
          if (txt) txt.innerText = target.text || '';
          if (bar) { bar.classList.remove('hidden'); bar.classList.add('flex'); }
          const freshInput = el('chat-input');
          if (freshInput) freshInput.focus();
        } else {
          render();
        }
      });
    });

    document.querySelectorAll('.menu-pin').forEach(b => {
      b.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = b.dataset.id;
        openMenuId = null;
        if (STATE.togglePinMessage) {
          await STATE.togglePinMessage(id);
        }
        render();
      });
    });

    // Soft delete — available to the message owner, or to any admin.
    document.querySelectorAll('.menu-delete-soft').forEach(b => {
      b.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = b.dataset.id;
        openMenuId = null;
        if (confirm('Delete this message?')) {
          if (STATE.deleteMessage) await STATE.deleteMessage(id);
        }
        render();
      });
    });

    // Hard delete — admin-only, only shown on messages already soft-deleted.
    document.querySelectorAll('.menu-delete-hard').forEach(b => {
      b.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = b.dataset.id;
        openMenuId = null;
        if (confirm('Permanently delete this message? This cannot be undone.')) {
          if (STATE.hardDeleteMessage) await STATE.hardDeleteMessage(id);
        }
        render();
      });
    });

    document.querySelectorAll('.reaction-pick').forEach(b => {
      b.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = b.dataset.id;
        const emoji = b.dataset.emoji;
        openMenuId = null;
        if (STATE.toggleReaction) await STATE.toggleReaction(id, emoji);
        render();
      });
    });

    document.querySelectorAll('.reaction-pill').forEach(b => {
      b.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = b.dataset.id;
        const emoji = b.dataset.emoji;
        if (STATE.toggleReaction) await STATE.toggleReaction(id, emoji);
        render();
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
        authorName: user ? user.fullName : 'Guest',
        text: text,
        imageBase64: imageBase64,
        fileData: fileData,
        replyTo: currentReplyTo,
        anonymous: isAnonMsg,
        reactions: {},
        isDeleted: false,
        deletedAt: null,
        createdAt: Date.now()
      };

      currentReplyTo = null;
      attachedFile = null;

      if (typeof STATE.addMessage === 'function') {
        await STATE.addMessage(msg);
      }

      render();
      const list = el('chat-messages-list');
      if (list) list.scrollTop = list.scrollHeight;
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