// ========================================
// FreshScan GPT — Chat Engine
// Handles messages, mock CV/NLP responses
// ========================================

class ChatEngine {
  constructor() {
    this.chatArea = null;
    this.isProcessing = false;
  }

  init(chatAreaEl) {
    this.chatArea = chatAreaEl;
  }

  renderMessage(role, content, options = {}) {
    if (!this.chatArea) return;
    const welcome = document.getElementById('welcomeScreen');
    if (welcome) welcome.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    if (role === 'user') {
      const userData = JSON.parse(localStorage.getItem('freshscan_user') || '{}');
      avatar.innerHTML = userData.photoURL
        ? `<img src="${userData.photoURL}" alt="You" referrerpolicy="no-referrer">`
        : `<span>${(userData.name || 'U')[0].toUpperCase()}</span>`;
    } else {
      avatar.innerHTML = `<img src="assets/logo.svg" alt="FreshScan">`;
    }

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (content) {
      const textEl = document.createElement('div');
      textEl.className = 'message-text';
      textEl.innerHTML = this.formatText(content);
      bubble.appendChild(textEl);
    }
    if (options.imageUrl) {
      const imgC = document.createElement('div');
      imgC.className = 'message-image';
      imgC.innerHTML = `<img src="${options.imageUrl}" alt="Uploaded image" loading="lazy">`;
      bubble.appendChild(imgC);
    }
    if (options.freshnessResult) {
      bubble.appendChild(this.createFreshnessCard(options.freshnessResult));
    }

    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    wrapper.appendChild(time);
    wrapper.style.opacity = '0';
    wrapper.style.transform = 'translateY(10px)';
    this.chatArea.appendChild(wrapper);
    requestAnimationFrame(() => {
      wrapper.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      wrapper.style.opacity = '1';
      wrapper.style.transform = 'translateY(0)';
    });
    this.scrollToBottom();
    return wrapper;
  }

  showTyping() {
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper assistant typing-indicator-wrapper';
    wrapper.id = 'typingIndicator';
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = `<img src="assets/logo.svg" alt="FreshScan">`;
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
    wrapper.appendChild(avatar);
    wrapper.appendChild(bubble);
    this.chatArea.appendChild(wrapper);
    this.scrollToBottom();
  }

  hideTyping() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
  }

  createFreshnessCard(r) {
    const card = document.createElement('div');
    card.className = `freshness-card status-${r.status.toLowerCase()}`;
    const colors = { fresh:'var(--status-fresh)', moderate:'var(--status-moderate)', spoiled:'var(--status-spoiled)' };
    const emojis = { fresh:'🟢', moderate:'🟡', spoiled:'🔴' };
    const labels = { fresh:'Fresh', moderate:'Moderate', spoiled:'Spoiled' };
    const c = colors[r.status] || colors.moderate;
    card.innerHTML = `
      <div class="freshness-header">
        <div class="freshness-item-info">
          <span class="freshness-item-name">${r.itemName}</span>
          <span class="freshness-badge" style="background:${c}20;color:${c};border:1px solid ${c}40;">${emojis[r.status]||'🟡'} ${labels[r.status]||'Unknown'}</span>
        </div>
        <div class="freshness-score" style="--score-color:${c}">
          <svg viewBox="0 0 36 36" class="circular-chart">
            <path class="circle-bg" d="M18 2.0845a15.9155 15.9155 0 010 31.831 15.9155 15.9155 0 010-31.831"/>
            <path class="circle" stroke="${c}" stroke-dasharray="${r.score},100" d="M18 2.0845a15.9155 15.9155 0 010 31.831 15.9155 15.9155 0 010-31.831"/>
          </svg>
          <span class="score-text">${r.score}%</span>
        </div>
      </div>
      <div class="freshness-details">${r.details.map(d=>`<div class="detail-row"><span class="detail-label">${d.label}</span><span class="detail-value">${d.value}</span></div>`).join('')}</div>
      <div class="freshness-recommendation"><div class="rec-icon">💡</div><div class="rec-text">${r.recommendation}</div></div>`;
    return card;
  }

  async sendText(text) {
    if (this.isProcessing || !text.trim()) return;
    this.isProcessing = true;
    this.renderMessage('user', text);
    this.showTyping();
    const response = await this.getMockTextResponse(text);
    this.hideTyping();
    this.renderMessage('assistant', response);
    this.isProcessing = false;
    this.saveChatHistory();
  }

  async sendImage(file, caption = '') {
    if (this.isProcessing) return;
    this.isProcessing = true;
    const dataUrl = await imageUploader.readAsDataURL(file);
    this.renderMessage('user', caption || 'Please analyze this image for freshness.', { imageUrl: dataUrl });
    this.showTyping();
    await this.delay(2000 + Math.random() * 1500);
    const result = this.getMockFreshnessResult(file.name);
    this.hideTyping();
    this.renderMessage('assistant', result.summary, { freshnessResult: result });
    this.isProcessing = false;
    this.saveChatHistory();
  }

  async getMockTextResponse(text) {
    await this.delay(1000 + Math.random() * 1500);
    const l = text.toLowerCase();
    if (l.match(/^(hi|hello|hey|good morning|good afternoon)/))
      return "Hello! 👋 I'm FreshScan GPT, your AI assistant for fruit and vegetable freshness analysis.\n\n• **Upload a photo** of any fruit or vegetable\n• **Ask questions** about food storage or shelf life\n• **Get recommendations** on extending produce freshness\n\nHow can I help you today?";
    if (l.includes('store') || l.includes('storage') || l.includes('keep fresh'))
      return "Here are some **produce storage tips** 🧊:\n\n• **Refrigerator (0-4°C):** Berries, leafy greens, carrots, bell peppers\n• **Room temperature:** Bananas, tomatoes, avocados (until ripe), onions\n• **Separate ethylene producers:** Keep apples and bananas away from lettuce\n• **Moisture control:** Store greens with a paper towel\n\nUpload a photo for freshness analysis!";
    if (l.includes('shelf life') || l.includes('how long') || l.includes('last'))
      return "Quick **shelf life guide** 📋:\n\n• 🍎 Apples — 5-7 days (room) / 4-6 weeks (fridge)\n• 🍌 Bananas — 2-5 days (room)\n• 🥕 Carrots — 3-5 days (room) / 3-4 weeks (fridge)\n• 🍅 Tomatoes — 5-7 days (room) / 1-2 weeks (fridge)\n• 🥬 Lettuce — 1-2 days (room) / 7-10 days (fridge)\n\nWant me to check your produce? Upload a photo!";
    if (l.includes('check') || l.includes('fresh') || l.includes('analyze') || l.includes('scan'))
      return "I'd love to analyze your produce! 🔍\n\nPlease **upload a photo** using the 📎 button below. I'll analyze:\n\n• **Visual appearance** (color, texture, spots)\n• **Freshness score** (0-100%)\n• **Status** (Fresh, Moderate, Spoiled)\n• **Storage recommendations**";
    return "I specialize in **fruit and vegetable freshness analysis** 🌿:\n\n• **📸 Photo Analysis** — Upload a photo for a freshness score\n• **📚 Storage Tips** — Ask about storing specific produce\n• **⏰ Shelf Life** — Learn how long produce lasts\n• **🍎 Ripeness Guide** — Know when fruit is ready\n\nTry uploading a photo or ask me anything!";
  }

  getMockFreshnessResult(filename) {
    const results = [
      { itemName:'Red Apple', status:'fresh', score:92, summary:"Great news! This **Red Apple** looks very fresh! 🍎", details:[{label:'Color Quality',value:'Vibrant red, uniform'},{label:'Surface',value:'Smooth, no bruising'},{label:'Firmness',value:'Firm and intact'},{label:'Shelf Life',value:'7-10 days (fridge)'}], recommendation:'Excellent condition. Store in crisper drawer.' },
      { itemName:'Banana', status:'moderate', score:61, summary:"This **Banana** is at peak ripeness 🍌", details:[{label:'Color',value:'Yellow with brown spots'},{label:'Surface',value:'Soft spots developing'},{label:'Ripeness',value:'Peak to overripe'},{label:'Shelf Life',value:'1-2 days'}], recommendation:'Consume today/tomorrow or freeze for smoothies.' },
      { itemName:'Tomato', status:'fresh', score:85, summary:"This **Tomato** is fresh and ready! 🍅", details:[{label:'Color',value:'Deep red, even'},{label:'Surface',value:'Smooth, no cracks'},{label:'Firmness',value:'Slightly firm'},{label:'Shelf Life',value:'5-7 days (room temp)'}], recommendation:'Store at room temperature for best flavor.' },
      { itemName:'Lettuce', status:'spoiled', score:23, summary:"⚠️ This **Lettuce** shows spoilage signs.", details:[{label:'Color',value:'Yellowing, brown edges'},{label:'Surface',value:'Wilted, slimy spots'},{label:'Structure',value:'Limp'},{label:'Shelf Life',value:'Past recommended use'}], recommendation:'Not recommended for consumption. Compost it.' },
      { itemName:'Carrot', status:'fresh', score:88, summary:"These **Carrots** look great! 🥕", details:[{label:'Color',value:'Bright orange'},{label:'Surface',value:'Smooth, no soft spots'},{label:'Firmness',value:'Firm and crisp'},{label:'Shelf Life',value:'3-4 weeks (fridge)'}], recommendation:'Store in sealed bag in refrigerator.' },
      { itemName:'Strawberry', status:'moderate', score:55, summary:"These **Strawberries** are nearing end of freshness 🍓", details:[{label:'Color',value:'Slightly dull'},{label:'Surface',value:'Minor soft spots'},{label:'Mold',value:'None detected'},{label:'Shelf Life',value:'1-2 days (fridge)'}], recommendation:'Consume within 1-2 days. Great for smoothies.' }
    ];
    return results[Math.floor(Math.random() * results.length)];
  }

  formatText(text) {
    return text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\*(.*?)\*/g,'<em>$1</em>').replace(/\n\n/g,'</p><p>').replace(/\n• /g,'<br>• ').replace(/\n/g,'<br>').replace(/^/,'<p>').replace(/$/,'</p>');
  }

  scrollToBottom() {
    if (this.chatArea) setTimeout(() => { this.chatArea.scrollTop = this.chatArea.scrollHeight; }, 50);
  }

  saveChatHistory() {
    if (!this.chatArea) return;
    const id = window.currentChatId || 'default';
    const chats = JSON.parse(localStorage.getItem('freshscan_chats') || '{}');
    chats[id] = { html: this.chatArea.innerHTML, updatedAt: Date.now() };
    localStorage.setItem('freshscan_chats', JSON.stringify(chats));
  }

  loadChatHistory(chatId) {
    const chats = JSON.parse(localStorage.getItem('freshscan_chats') || '{}');
    if (chats[chatId]) {
      this.chatArea.innerHTML = chats[chatId].html;
      this.scrollToBottom();
      const welcome = document.getElementById('welcomeScreen');
      if (welcome && this.chatArea.children.length > 0) welcome.style.display = 'none';
    }
  }

  delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

const chatEngine = new ChatEngine();
