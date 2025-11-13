// Menghubungkan elemen HTML ke JavaScript
const chatWindow = document.getElementById('chat-window');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

const btnChat = document.getElementById('btn-chat');
const btnImage = document.getElementById('btn-image');
const btnVideo = document.getElementById('btn-video');

// Sidebar / conversations elements
const newChatBtn = document.getElementById('new-chat-btn');
const conversationsContainer = document.getElementById('conversations');

// Conversation state
let conversations = [];
let currentConversationId = null;
let isLoadingConversation = false; // avoid saving while rendering

let currentMode = 'chat'; // default mode

// Fungsi untuk mengirim pesan
async function sendMessage() {
    const prompt = chatInput.value.trim();
    if (prompt === "") return;

    addMessageToChat(prompt, 'user');
    chatInput.value = "";
    sendBtn.disabled = true;

    if (currentMode === 'image') {
        await generateImage(prompt);
    } else if (currentMode === 'video') {
        await generateVideo(prompt);
    } else {
        await generateText(prompt);
    }

    sendBtn.disabled = false;
    chatInput.focus();
}

// Fungsi bantuan untuk menambahkan pesan ke UI dengan animasi
function addMessageToChat(text, sender) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender);

    if (sender === 'bot') {
        const messageContent = document.createElement('div');
        messageContent.classList.add('message-content');

        // Render markdown -> sanitize HTML
        try {
            // marked and DOMPurify are loaded from CDN in index.html
            const rawHtml = typeof marked !== 'undefined' ? marked.parse(text) : text;
            const safeHtml = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(rawHtml) : rawHtml;

            // Use a wrapper so we can measure height and collapse long content
            const rendered = document.createElement('div');
            rendered.classList.add('rendered-markdown');
            rendered.innerHTML = safeHtml;

            // If content is very long, collapse it and add a "show more" button
            messageContent.appendChild(rendered);
            messageElement.appendChild(messageContent);
            chatWindow.appendChild(messageElement);
            chatWindow.scrollTop = chatWindow.scrollHeight;

            // Wait a tick to measure
            requestAnimationFrame(() => {
                const threshold = 220; // px
                if (rendered.scrollHeight > threshold) {
                    const collapsed = document.createElement('div');
                    collapsed.classList.add('collapsed-content');
                    // move rendered into collapsed container
                    collapsed.appendChild(rendered);

                    // fade overlay
                    const fade = document.createElement('div');
                    fade.classList.add('collapsed-fade');
                    collapsed.appendChild(fade);

                    // replace content
                    messageContent.innerHTML = '';
                    messageContent.appendChild(collapsed);

                    const btn = document.createElement('button');
                    btn.classList.add('show-more-btn');
                    btn.textContent = 'Tampilkan lebih';
                    btn.addEventListener('click', () => {
                        const expanded = collapsed.classList.toggle('expanded');
                        if (expanded) {
                            collapsed.style.maxHeight = 'none';
                            fade.remove();
                            btn.textContent = 'Sembunyikan';
                        } else {
                            collapsed.style.maxHeight = '';
                            collapsed.appendChild(fade);
                            btn.textContent = 'Tampilkan lebih';
                        }
                        // scroll to bottom after expand/collapse
                        chatWindow.scrollTop = chatWindow.scrollHeight;
                    });

                    messageContent.appendChild(btn);
                }
            });

            // save to conversation if not currently loading
            if (!isLoadingConversation && currentConversationId) {
                const conv = conversations.find(c => c.id === currentConversationId);
                if (conv) conv.messages.push({sender: sender, text: text, ts: Date.now()});
                saveConversations();
                renderConversations();
            }

            return messageElement;
        } catch (e) {
            // fallback: plain text
            messageContent.textContent = text;
            messageElement.appendChild(messageContent);
            if (!isLoadingConversation && currentConversationId) {
                const conv = conversations.find(c => c.id === currentConversationId);
                if (conv) conv.messages.push({sender: sender, text: text, ts: Date.now()});
                saveConversations();
                renderConversations();
            }
        }
    } else {
        messageElement.textContent = text;
    }

    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    if (!isLoadingConversation && currentConversationId) {
        const conv = conversations.find(c => c.id === currentConversationId);
        if (conv) conv.messages.push({sender: sender, text: text, ts: Date.now()});
        saveConversations();
        renderConversations();
    }

    return messageElement;
}

// Fungsi untuk menambahkan loading indicator
function addLoadingMessage() {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'bot', 'loading');
    messageElement.innerHTML = '<span class="loading-dot">●</span><span class="loading-dot">●</span><span class="loading-dot">●</span>';
    messageElement.id = 'loading-message';
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return messageElement;
}

// Fungsi untuk menghapus loading indicator
function removeLoadingMessage() {
    const loadingMsg = document.getElementById('loading-message');
    if (loadingMsg) {
        loadingMsg.remove();
    }
}

// Fungsi untuk mengubah mode
function setMode(mode) {
    currentMode = mode;

    btnChat.classList.remove('active');
    btnImage.classList.remove('active');
    btnVideo.classList.remove('active');

    if (mode === 'chat') {
        btnChat.classList.add('active');
        chatInput.placeholder = "Tanyakan apa saja kepada saya...";
    } else if (mode === 'image') {
        btnImage.classList.add('active');
        chatInput.placeholder = "Deskripsikan gambar yang Anda inginkan...";
    } else if (mode === 'video') {
        btnVideo.classList.add('active');
        chatInput.placeholder = "Deskripsikan video yang Anda inginkan...";
    }
    chatInput.focus();
}

// Event listener untuk tombol mode
btnChat.addEventListener('click', () => setMode('chat'));
btnImage.addEventListener('click', () => setMode('image'));
btnVideo.addEventListener('click', () => setMode('video'));

// Set mode awal
setMode('chat');

// Event listener untuk tombol Kirim dan Enter
sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// --- FUNGSI UNTUK GENERATE TEKS (CHAT) ---
async function generateText(prompt) {
    try {
        addLoadingMessage();
        
        const response = await fetch('http://127.0.0.1:5000/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: prompt })
        });

        const data = await response.json();
        removeLoadingMessage();
        
        if (data.reply) {
            addMessageToChat(data.reply, 'bot');
        } else {
            addMessageToChat('Maaf, terjadi kesalahan saat memproses pesan. 😔', 'bot');
        }
    } catch (error) {
        console.error('Error:', error);
        removeLoadingMessage();
        addMessageToChat('⚠️ Gagal menghubungi server. Pastikan backend Flask sudah berjalan di http://127.0.0.1:5000', 'bot');
    }
}

// --- FUNGSI UNTUK GENERATE GAMBAR ---
async function generateImage(prompt) {
    try {
        addLoadingMessage();
        
        const response = await fetch('http://127.0.0.1:5000/api/generate-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: prompt })
        });

        const data = await response.json();
        removeLoadingMessage();
        
        if (data.image_url) {
            const img = document.createElement('img');
            img.src = data.image_url;
            img.style.maxWidth = '100%';
            img.style.maxHeight = '400px';
            img.style.borderRadius = '12px';
            img.style.marginTop = '8px';
            img.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';

            const messageElement = document.createElement('div');
            messageElement.classList.add('message', 'bot');
            const content = document.createElement('div');
            content.classList.add('message-content');
            content.appendChild(img);
            messageElement.appendChild(content);
            chatWindow.appendChild(messageElement);
            chatWindow.scrollTop = chatWindow.scrollHeight;
        } else {
            addMessageToChat('❌ Gagal membuat gambar. ' + (data.error || 'Coba lagi dengan deskripsi yang berbeda.'), 'bot');
        }
    } catch (error) {
        console.error('Error:', error);
        removeLoadingMessage();
        addMessageToChat('⚠️ Gagal membuat gambar. Pastikan backend Flask sudah berjalan.', 'bot');
    }
}

// --- FUNGSI UNTUK GENERATE VIDEO ---
async function generateVideo(prompt) {
    try {
        addLoadingMessage();
        
        const response = await fetch('http://127.0.0.1:5000/api/generate-video', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: prompt })
        });

        const data = await response.json();
        removeLoadingMessage();
        
        if (data.video_url) {
            const video = document.createElement('video');
            video.src = data.video_url;
            video.controls = true;
            video.style.maxWidth = '100%';
            video.style.maxHeight = '400px';
            video.style.borderRadius = '12px';
            video.style.marginTop = '8px';
            video.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';

            const messageElement = document.createElement('div');
            messageElement.classList.add('message', 'bot');
            const content = document.createElement('div');
            content.classList.add('message-content');
            content.appendChild(video);
            messageElement.appendChild(content);
            chatWindow.appendChild(messageElement);
            chatWindow.scrollTop = chatWindow.scrollHeight;
        } else {
            addMessageToChat('❌ Gagal membuat video. ' + (data.error || 'Coba lagi dengan deskripsi yang berbeda.'), 'bot');
        }
    } catch (error) {
        console.error('Error:', error);
        removeLoadingMessage();
        addMessageToChat('⚠️ Gagal membuat video. Pastikan backend Flask sudah berjalan.', 'bot');
    }
}

// --- Conversation / History management ---
function saveConversations() {
    try {
        localStorage.setItem('nplai_conversations', JSON.stringify(conversations));
    } catch (e) {
        console.error('Gagal menyimpan percakapan:', e);
    }
}

function loadConversations() {
    try {
        const raw = localStorage.getItem('nplai_conversations');
        conversations = raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error('Gagal memuat percakapan:', e);
        conversations = [];
    }
    if (!conversations.length) {
        // create a default conversation
        const id = 'conv-' + Date.now();
        conversations = [{id: id, title: 'Percakapan 1', messages: []}];
        currentConversationId = id;
        saveConversations();
    }
}

function renderConversations() {
    if (!conversationsContainer) return;
    conversationsContainer.innerHTML = '';
    conversations.forEach(conv => {
        const item = document.createElement('div');
        item.classList.add('conversation-item');
        if (conv.id === currentConversationId) item.classList.add('active');
        const preview = conv.messages.length ? conv.messages[conv.messages.length-1].text.replace(/<[^>]+>/g, '').slice(0,60) : 'Percakapan baru';
        item.textContent = conv.title + ' — ' + preview;
        item.addEventListener('click', () => loadConversation(conv.id));
        conversationsContainer.appendChild(item);
    });
}

function createNewConversation() {
    const id = 'conv-' + Date.now();
    const title = 'Percakapan ' + (conversations.length + 1);
    const conv = {id: id, title: title, messages: []};
    conversations.unshift(conv);
    currentConversationId = id;
    saveConversations();
    renderConversations();
    // clear UI
    chatWindow.innerHTML = '';
    // add welcome message in UI only
    isLoadingConversation = true;
    addMessageToChat('<strong>Halo! 👋</strong><p>Saya NPL AI, asisten digital Anda yang siap membantu.</p>', 'bot');
    isLoadingConversation = false;
}

function loadConversation(id) {
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;
    currentConversationId = id;
    renderConversations();
    chatWindow.innerHTML = '';
    // render messages
    isLoadingConversation = true;
    conv.messages.forEach(m => {
        addMessageToChat(m.text, m.sender);
    });
    isLoadingConversation = false;
}

function initConversations() {
    loadConversations();
    currentConversationId = conversations[0].id;
    renderConversations();
    loadConversation(currentConversationId);
}

if (newChatBtn) newChatBtn.addEventListener('click', createNewConversation);
initConversations();