import './styles.css';

const API_URL = 'https://chat-a1nh.onrender.com';

let ws = null;
let currentUser = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let previousUsers = [];

const modal = document.getElementById('modal');
const nicknameInput = document.getElementById('nickname-input');
const errorMessage = document.getElementById('error-message');
const submitBtn = document.getElementById('submit-nickname');
const chatContainer = document.getElementById('chat-container');
const messagesArea = document.getElementById('messages-area');
const usersList = document.getElementById('users-list');
const messageInput = document.getElementById('message-input');

function showError(msg) {
    errorMessage.textContent = msg;
    setTimeout(function() {
        if (errorMessage.textContent === msg) {
            errorMessage.textContent = '';
        }
    }, 5000);
}

function addSystemMessage(text) {
    const div = document.createElement('div');
    div.className = 'message system-message';
    div.innerHTML = '<div class="message-content system">' + text + '</div>';
    messagesArea.appendChild(div);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function addMessage(msg, isMine) {
    const div = document.createElement('div');
    div.className = 'message ' + (isMine ? 'my-message' : 'other-message');
    
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeStr = (hours < 10 ? '0' + hours : hours) + ':' + (minutes < 10 ? '0' + minutes : minutes);
    
    const authorName = isMine ? 'You' : msg.user.name;
    
    div.innerHTML = `
        <div class="message-header">
            <span class="message-author-time">${authorName}, ${timeStr}</span>
        </div>
        <div class="message-content">${escapeHtml(msg.message)}</div>
    `;
    
    messagesArea.appendChild(div);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function updateUsersList(users) {
    if (previousUsers.length > 0) {
        for (let i = 0; i < previousUsers.length; i++) {
            const oldUser = previousUsers[i];
            const stillExists = users.some(function(u) {
                return u.id === oldUser.id;
            });
            
            if (!stillExists && oldUser.id !== currentUser.id) {
                addSystemMessage('Пользователь "' + escapeHtml(oldUser.name) + '" покинул чат');
            }
        }
        
        for (let i = 0; i < users.length; i++) {
            const newUser = users[i];
            const wasExists = previousUsers.some(function(u) {
                return u.id === newUser.id;
            });
            
            if (!wasExists && newUser.id !== currentUser.id) {
                addSystemMessage('Пользователь "' + escapeHtml(newUser.name) + '" присоединился к чату');
            }
        }
    }
    
    previousUsers = [];
    for (let i = 0; i < users.length; i++) {
        previousUsers.push({
            id: users[i].id,
            name: users[i].name
        });
    }
    
    usersList.innerHTML = '';
    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
        if (user.id === currentUser.id) {
            userDiv.classList.add('current-user');
            userDiv.textContent = user.name + ' (Вы)';
        } else {
            userDiv.textContent = user.name;
        }
        usersList.appendChild(userDiv);
    }
}

function connectWebSocket() {
    const wsUrl = API_URL.replace('https', 'wss').replace('http', 'ws');
    ws = new WebSocket(wsUrl);
    
    ws.onopen = function() {
        reconnectAttempts = 0;
        addSystemMessage('Соединение установлено');
    };
    
    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        
        if (Array.isArray(data)) {
            updateUsersList(data);
        } else if (data.type === 'send') {
            addMessage(data, data.user.id === currentUser.id);
        }
    };
    
    ws.onerror = function(error) {
        showError('Ошибка соединения');
    };
    
    ws.onclose = function(event) {
        if (currentUser && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            showError('Соединение потеряно. Попытка переподключения ' + reconnectAttempts + '/' + MAX_RECONNECT_ATTEMPTS);
            
            setTimeout(function() {
                connectWebSocket();
            }, 3000);
        } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            showError('Не удалось восстановить соединение. Перезагрузите страницу.');
        } else if (!currentUser) {
            showError('Не удалось подключиться к серверу');
        }
    };
}

submitBtn.onclick = function() {
    const nickname = nicknameInput.value.trim();
    
    if (nickname === '') {
        showError('Введите никнейм');
        return;
    }
    
    fetch(API_URL + '/new-user', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: nickname })
    })
    .then(function(response) {
        return response.json();
    })
    .then(function(data) {
        if (data.status === 'ok') {
            currentUser = data.user;
            modal.style.display = 'none';
            chatContainer.style.display = 'flex';
            connectWebSocket();
        } else {
            errorMessage.textContent = 'Это имя уже занято, выберите другое';
        }
    })
    .catch(function() {
        errorMessage.textContent = 'Ошибка подключения к серверу';
    });
};

nicknameInput.onkeypress = function(e) {
    if (e.key === 'Enter') {
        submitBtn.onclick();
    }
};

function sendMessage() {
    const text = messageInput.value.trim();
    
    if (text === '') {
        return;
    }
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        showError('Нет соединения с сервером');
        return;
    }
    
    ws.send(JSON.stringify({
        type: 'send',
        message: text,
        user: {
            id: currentUser.id,
            name: currentUser.name
        }
    }));
    
    messageInput.value = '';
}

messageInput.onkeypress = function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
};

window.onbeforeunload = function() {
    if (ws && ws.readyState === WebSocket.OPEN && currentUser) {
        ws.send(JSON.stringify({
            type: 'exit',
            user: {
                id: currentUser.id,
                name: currentUser.name
            }
        }));
    }
};