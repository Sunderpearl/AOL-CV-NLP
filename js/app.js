// ========================================
// FreshScan GPT — App Orchestration
// Auth guard, sidebar, chat management
// ========================================

let currentChatId = null;
let sidebarOpen = true;

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupUI();
  setupChat();
  setupSidebar();
  setupInputBar();
});

// ── Auth Guard ──
function checkAuth() {
  const user = JSON.parse(localStorage.getItem('freshscan_user'));
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  // Display user info
  const nameEl = document.getElementById('userName');
  const avatarEl = document.getElementById('userAvatar');
  const welcomeName = document.getElementById('welcomeUserName');

  if (nameEl) nameEl.textContent = user.name || 'User';
  if (welcomeName) welcomeName.textContent = user.name || 'User';
  if (avatarEl) {
    if (user.photoURL) {
      avatarEl.innerHTML = `<img src="${user.photoURL}" alt="${user.name}" referrerpolicy="no-referrer">`;
    } else {
      avatarEl.innerHTML = `<span>${(user.name || 'U')[0].toUpperCase()}</span>`;
    }
  }
}

// ── Setup UI ──
function setupUI() {
  // Sign out button
  const signOutBtn = document.getElementById('signOutBtn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', () => {
      localStorage.removeItem('freshscan_user');
      localStorage.removeItem('freshscan_chats');
      window.location.href = 'index.html';
    });
  }

  // Menu toggle
  const menuBtn = document.getElementById('menuToggleBtn');
  if (menuBtn) {
    menuBtn.addEventListener('click', toggleSidebar);
  }
}

// ── Setup Chat ──
function setupChat() {
  const chatArea = document.getElementById('chatMessages');
  if (chatArea) {
    chatEngine.init(chatArea);
  }

  // Try to load last chat
  const chats = JSON.parse(localStorage.getItem('freshscan_chats') || '{}');
  const chatIds = Object.keys(chats);
  if (chatIds.length > 0) {
    const lastId = chatIds.sort((a, b) => (chats[b].updatedAt || 0) - (chats[a].updatedAt || 0))[0];
    loadChat(lastId);
  } else {
    startNewChat();
  }
}

// ── Setup Sidebar ──
function setupSidebar() {
  const newChatBtn = document.getElementById('newChatBtn');
  if (newChatBtn) {
    newChatBtn.addEventListener('click', startNewChat);
  }
  renderChatList();
}

// ── Setup Input Bar ──
function setupInputBar() {
  const input = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const attachBtn = document.getElementById('attachBtn');
  const fileInput = document.getElementById('fileInput');

  // Send on enter
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    // Auto resize
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
  }

  // Send button
  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }

  // Attach button
  if (attachBtn) {
    attachBtn.addEventListener('click', () => fileInput?.click());
  }

  // File input
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleFileUpload(file);
      fileInput.value = '';
    });
  }

  // Drag and drop on chat area
  const chatArea = document.getElementById('chatMessages');
  if (chatArea) {
    imageUploader.setupDragDrop(chatArea, handleFileUpload);
  }
}

// ── Send Message ──
function sendMessage() {
  const input = document.getElementById('messageInput');
  const text = input?.value.trim();
  if (!text) return;
  input.value = '';
  input.style.height = 'auto';
  chatEngine.sendText(text);
}

// ── Handle File Upload ──
function handleFileUpload(file) {
  const validation = imageUploader.validate(file);
  if (!validation.valid) {
    showAppToast(validation.error, 'error');
    return;
  }
  // Show image preview
  showImagePreview(file);
}

// ── Image Preview Modal ──
function showImagePreview(file) {
  const previewUrl = imageUploader.createPreview(file);
  const overlay = document.getElementById('imagePreviewOverlay');
  const img = document.getElementById('previewImage');
  const name = document.getElementById('previewFileName');

  if (overlay && img) {
    img.src = previewUrl;
    if (name) name.textContent = file.name;
    overlay.classList.add('active');
  }
}

function closeImagePreview() {
  const overlay = document.getElementById('imagePreviewOverlay');
  if (overlay) overlay.classList.remove('active');
  imageUploader.clear();
}

function sendPreviewImage() {
  const file = imageUploader.currentFile;
  const captionInput = document.getElementById('previewCaption');
  const caption = captionInput?.value.trim() || '';

  if (file) {
    chatEngine.sendImage(file, caption);
  }

  closeImagePreview();
  if (captionInput) captionInput.value = '';
}

// ── Chat Management ──
function startNewChat() {
  currentChatId = 'chat_' + Date.now();
  window.currentChatId = currentChatId;

  const chatArea = document.getElementById('chatMessages');
  if (chatArea) chatArea.innerHTML = '';

  const welcome = document.getElementById('welcomeScreen');
  if (welcome) welcome.style.display = 'flex';

  renderChatList();
  
  // Close sidebar on mobile
  if (window.innerWidth <= 768) toggleSidebar();
}

function loadChat(chatId) {
  currentChatId = chatId;
  window.currentChatId = chatId;
  chatEngine.loadChatHistory(chatId);
  renderChatList();
  
  if (window.innerWidth <= 768) toggleSidebar();
}

function deleteChat(chatId, e) {
  e.stopPropagation();
  const chats = JSON.parse(localStorage.getItem('freshscan_chats') || '{}');
  delete chats[chatId];
  localStorage.setItem('freshscan_chats', JSON.stringify(chats));
  
  if (chatId === currentChatId) startNewChat();
  renderChatList();
}

function renderChatList() {
  const list = document.getElementById('chatList');
  if (!list) return;

  const chats = JSON.parse(localStorage.getItem('freshscan_chats') || '{}');
  const chatIds = Object.keys(chats).sort((a, b) => (chats[b].updatedAt || 0) - (chats[a].updatedAt || 0));

  list.innerHTML = chatIds.map(id => {
    const isActive = id === currentChatId ? 'active' : '';
    const date = new Date(chats[id].updatedAt || 0);
    const timeStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `
      <div class="chat-list-item ${isActive}" onclick="loadChat('${id}')">
        <div class="chat-list-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <div class="chat-list-info">
          <span class="chat-list-title">Chat</span>
          <span class="chat-list-date">${timeStr}</span>
        </div>
        <button class="chat-delete-btn" onclick="deleteChat('${id}', event)" title="Delete chat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>`;
  }).join('');
}

// ── Sidebar Toggle ──
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('mainContent');
  if (sidebar) sidebar.classList.toggle('collapsed', !sidebarOpen);
  if (main) main.classList.toggle('sidebar-collapsed', !sidebarOpen);
}

// ── Toast ──
function showAppToast(msg, type='info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}
