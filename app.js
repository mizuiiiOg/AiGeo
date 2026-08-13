/* ---------------- Storage helpers ---------------- */
const STORAGE_KEY = 'cai_bots';

function getBots() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveBots(bots) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bots));
}
function getBot(id) {
  return getBots().find(b => b.id === id);
}
function upsertBot(bot) {
  const bots = getBots();
  const i = bots.findIndex(b => b.id === bot.id);
  if (i >= 0) bots[i] = bot; else bots.push(bot);
  saveBots(bots);
}
function deleteBot(id) {
  saveBots(getBots().filter(b => b.id !== id));
}

/* ---------------- Toast ---------------- */
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ---------------- Navigation ---------------- */
let currentChatBotId = null;

function goTo(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
}

document.getElementById('enter-btn').addEventListener('click', () => {
  renderBotList();
  goTo('page-main');
});

document.getElementById('add-bot-btn').addEventListener('click', () => {
  resetCreateForm();
  goTo('page-create');
});

document.getElementById('create-back-btn').addEventListener('click', () => goTo('page-main'));

document.getElementById('chat-back-btn').addEventListener('click', () => {
  renderBotList();
  goTo('page-main');
});

/* ---------------- Main page: bot list ---------------- */
function renderBotList() {
  const bots = getBots();
  const scroll = document.getElementById('bots-scroll');
  const empty = document.getElementById('bots-empty');
  scroll.innerHTML = '';

  if (bots.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  bots.forEach(bot => {
    const card = document.createElement('div');
    card.className = 'bot-card';
    card.innerHTML = `
      <div class="bot-avatar ${bot.hasVoice ? 'has-voice' : ''}" style="${bot.pfp ? `background-image:url('${bot.pfp}')` : ''}">
        ${bot.pfp ? '' : initialsSvg()}
      </div>
      <div class="bot-card-info">
        <div class="bot-card-name">${escapeHtml(bot.name)}</div>
        <div class="bot-card-sub">${bot.hasVoice ? 'Voice enabled' : 'Text only'}</div>
      </div>
    `;
    card.addEventListener('click', () => openChat(bot.id));
    scroll.appendChild(card);
  });
}
function initialsSvg() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6M12 12a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" stroke-width="1.6"/></svg>`;
}
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/* ---------------- Create bot page ---------------- */
let pendingAvatarDataUrl = null;

function resetCreateForm() {
  pendingAvatarDataUrl = null;
  document.getElementById('bot-name').value = '';
  document.getElementById('bot-personality').value = '';
  document.getElementById('fish-key').value = '';
  document.getElementById('fish-voice-id').value = '';
  document.getElementById('avatar-preview').style.backgroundImage = '';
  document.getElementById('avatar-preview').innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6M12 12a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" stroke-width="1.6"/></svg>`;
}

document.getElementById('choose-image-btn').addEventListener('click', () => {
  document.getElementById('avatar-input').click();
});
document.getElementById('avatar-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    pendingAvatarDataUrl = reader.result;
    const preview = document.getElementById('avatar-preview');
    preview.style.backgroundImage = `url('${pendingAvatarDataUrl}')`;
    preview.innerHTML = '';
  };
  reader.readAsDataURL(file);
});

document.getElementById('create-btn').addEventListener('click', () => {
  const name = document.getElementById('bot-name').value.trim();
  const personality = document.getElementById('bot-personality').value.trim();
  const fishKey = document.getElementById('fish-key').value.trim();
  const fishVoiceId = document.getElementById('fish-voice-id').value.trim();

  if (!name) return toast('Give your bot a name.');
  if (!personality) return toast('Describe a personality for your bot.');

  const hasVoice = !!(fishKey && fishVoiceId);

  const bot = {
    id: 'bot_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name,
    personality,
    pfp: pendingAvatarDataUrl,
    fishKey: hasVoice ? fishKey : '',
    fishVoiceId: hasVoice ? fishVoiceId : '',
    hasVoice,
    messages: []
  };

  upsertBot(bot);
  toast('Bot created.');
  renderBotList();
  goTo('page-main');
});

/* ---------------- Chat page ---------------- */
function openChat(botId) {
  currentChatBotId = botId;
  const bot = getBot(botId);
  if (!bot) return;

  document.getElementById('chat-bot-name').textContent = bot.name;
  const avatarEl = document.getElementById('chat-bot-avatar');
  avatarEl.style.backgroundImage = bot.pfp ? `url('${bot.pfp}')` : '';

  renderMessages(bot);
  goTo('page-chat');
  document.getElementById('chat-input').focus();
}

function renderMessages(bot) {
  const container = document.getElementById('chat-messages');
  container.innerHTML = '';
  bot.messages.forEach(m => appendMessageBubble(m.role, m.text));
  container.scrollTop = container.scrollHeight;
}

function appendMessageBubble(role, text) {
  const container = document.getElementById('chat-messages');
  const bubble = document.createElement('div');
  bubble.className = `msg ${role === 'user' ? 'user' : 'bot'}`;
  bubble.textContent = text;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

function showTyping() {
  const container = document.getElementById('chat-messages');
  const bubble = document.createElement('div');
  bubble.className = 'msg bot typing';
  bubble.id = 'typing-indicator';
  bubble.innerHTML = '<span></span><span></span><span></span>';
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}
function hideTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || !currentChatBotId) return;

  const bot = getBot(currentChatBotId);
  if (!bot) return;

  input.value = '';
  appendMessageBubble('user', text);
  bot.messages.push({ role: 'user', text });
  upsertBot(bot);

  showTyping();

  try {
    const history = bot.messages.slice(-20).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text
    }));

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personality: bot.personality, messages: history })
    });
    const contentType = res.headers.get('content-type') || '';
    let data;

    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const raw = await res.text();
      throw new Error(`Server returned ${res.status}: ${raw.slice(0, 300)}`);
    }

    hideTyping();

    if (!res.ok) {
      throw new Error(data?.error || `Server returned ${res.status}`);
    }

    const reply = data?.reply || '...';
    appendMessageBubble('bot', reply);
    bot.messages.push({ role: 'bot', text: reply });
    upsertBot(bot);

    if (bot.hasVoice) speak(bot, reply);
  } catch (err) {
    hideTyping();
    console.error('CHAT ERROR:', err);
    toast(err?.message || 'Connection error. Try again.');
  }
}

async function speak(bot, text) {
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, fishApiKey: bot.fishKey, voiceId: bot.fishVoiceId })
    });
    if (!res.ok) return; // fail silently for voice, text reply already shown
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play().catch(() => {});
  } catch { /* voice is a bonus, never block chat on it */ }
}

document.getElementById('chat-send-btn').addEventListener('click', sendMessage);
document.getElementById('chat-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

/* ---------------- Settings modal ---------------- */
let pendingSettingsAvatarDataUrl = null;

document.getElementById('chat-settings-btn').addEventListener('click', () => {
  const bot = getBot(currentChatBotId);
  if (!bot) return;
  pendingSettingsAvatarDataUrl = bot.pfp;

  const preview = document.getElementById('settings-avatar-preview');
  preview.style.backgroundImage = bot.pfp ? `url('${bot.pfp}')` : '';
  preview.innerHTML = bot.pfp ? '' : initialsSvg();

  document.getElementById('settings-fish-key').value = bot.fishKey || '';
  document.getElementById('settings-fish-voice-id').value = bot.fishVoiceId || '';

  document.getElementById('settings-modal').classList.add('active');
});

document.getElementById('settings-close-btn').addEventListener('click', () => {
  document.getElementById('settings-modal').classList.remove('active');
});

document.getElementById('settings-choose-image-btn').addEventListener('click', () => {
  document.getElementById('settings-avatar-input').click();
});
document.getElementById('settings-avatar-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    pendingSettingsAvatarDataUrl = reader.result;
    const preview = document.getElementById('settings-avatar-preview');
    preview.style.backgroundImage = `url('${pendingSettingsAvatarDataUrl}')`;
    preview.innerHTML = '';
  };
  reader.readAsDataURL(file);
});

document.getElementById('settings-save-btn').addEventListener('click', () => {
  const bot = getBot(currentChatBotId);
  if (!bot) return;

  const fishKey = document.getElementById('settings-fish-key').value.trim();
  const fishVoiceId = document.getElementById('settings-fish-voice-id').value.trim();
  const hasVoice = !!(fishKey && fishVoiceId);

  bot.pfp = pendingSettingsAvatarDataUrl;
  bot.fishKey = hasVoice ? fishKey : '';
  bot.fishVoiceId = hasVoice ? fishVoiceId : '';
  bot.hasVoice = hasVoice;

  upsertBot(bot);
  document.getElementById('settings-modal').classList.remove('active');
  openChat(bot.id);
  toast('Settings saved.');
});

document.getElementById('settings-delete-btn').addEventListener('click', () => {
  if (!currentChatBotId) return;
  deleteBot(currentChatBotId);
  document.getElementById('settings-modal').classList.remove('active');
  renderBotList();
  goTo('page-main');
  toast('Bot deleted.');
});
