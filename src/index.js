import './styles.css';

const API_URL = 'https://chat-a1nh.onrender.com';

let ws = null;
let currentUser = null;

const modal = document.getElementById('modal');
const nicknameInput = document.getElementById('nickname-input');
const errorMessage = document.getElementById('error-message');
const submitBtn = document.getElementById('submit-nickname');
const chatContainer = document.getElementById('chat-container');
const messagesArea = document.getElementById('messages-area');
const usersList = document.getElementById('users-list');
const messageInput = document.getElementById('message-input');

submitBtn.onclick = function() {
    const nickname = nicknameInput.value.trim();
    
    if (nickname === '') {
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
            
            const wsUrl = API_URL.replace('http', 'ws');
            ws = new WebSocket(wsUrl);
            
            ws.onmessage = function(event) {
                const data = JSON.parse(event.data);
                
                if (Array.isArray(data)) {
                    usersList.innerHTML = '';
                    
                    for (let i = 0; i < data.length; i++) {
                        const user = data[i];
                        const userDiv = document.createElement('div');
                        userDiv.className = 'user-item';
                        
                        if (user.id === currentUser.id) {
                            userDiv.classList.add('current-user');
                        }
                        
                        userDiv.innerHTML = `
                            <div class="user-avatar"></div>
                            <span class="user-name">${user.name}${user.id === currentUser.id ? ' (Вы)' : ''}</span>
                        `;
                        
                        usersList.appendChild(userDiv);
                    }
                } else if (data.type === 'send') {
                    addMessage(data, data.user.id === currentUser.id);
                }
            };
        } else {
            errorMessage.textContent = 'Это имя уже занято';
        }
    })
    .catch(function() {
        errorMessage.textContent = 'Ошибка подключения';
    });
};

nicknameInput.onkeypress = function(e) {
    if (e.key === 'Enter') {
        submitBtn.onclick();
    }
};

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
        <div class="message-content">${msg.message}</div>
    `;
    
    messagesArea.appendChild(div);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

function sendMessage() {
    const text = messageInput.value.trim();
    
    if (text === '') {
        return;
    }
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
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