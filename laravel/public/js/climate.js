// Настройка Marked.js
marked.setOptions({
    breaks: true,
    gfm: true,
    tables: true,
    sanitize: false
});

let chatHistory = [];
let lastQuestion = '';

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    checkServiceStatus();
    setupEventListeners();
    loadChatHistory();
    scrollToBottom(); // Прокручиваем к низу при загрузке
});

// Настройка обработчиков событий
function setupEventListeners() {
    const questionInput = document.getElementById('question');
    const submitBtn = document.getElementById('submitBtn');

    // Авто-высота текстового поля
    questionInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 150) + 'px';
        submitBtn.disabled = !this.value.trim();
    });

    // Отправка по клику
    submitBtn.addEventListener('click', sendMessage);

    // Отправка по Enter (Ctrl+Enter или Cmd+Enter)
    questionInput.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            sendMessage();
        }
    });

    // Фокус на поле ввода
    questionInput.focus();
}

// Прокрутка к самому нижнему сообщению
function scrollToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        // Используем requestAnimationFrame для гарантированной прокрутки после рендера
        requestAnimationFrame(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
    }
}

// Прокрутка к конкретному элементу
function scrollToElement(element) {
    if (element) {
        requestAnimationFrame(() => {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        });
    }
}

// Проверка статуса сервиса
async function checkServiceStatus() {
    const indicator = document.getElementById('statusIndicator');
    try {
        const response = await fetch('/climate/health');
        const data = await response.json();

        if (data.status === 'healthy') {
            indicator.innerHTML = '<i class="fas fa-circle me-1 text-success"></i>Сервис доступен';
        } else {
            indicator.innerHTML = '<i class="fas fa-circle me-1 text-danger"></i>Сервис недоступен';
        }
    } catch (error) {
        indicator.innerHTML = '<i class="fas fa-circle me-1 text-danger"></i>Ошибка подключения';
    }
}

// Отправка сообщения
async function sendMessage() {
    const questionInput = document.getElementById('question');
    const question = questionInput.value.trim();

    if (!question) return;

    lastQuestion = question;

    // Добавляем сообщение пользователя в чат
    const userMessageElement = addMessage(question, 'user');

    // Прокручиваем к сообщению пользователя
    scrollToElement(userMessageElement);

    // Очищаем поле ввода
    questionInput.value = '';
    questionInput.style.height = 'auto';
    document.getElementById('submitBtn').disabled = true;

    // Показываем индикатор загрузки
    showLoading();
    hideError();

    try {
        const response = await fetch('/climate/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({ question: question })
        });

        const data = await response.json();

        if (data.success) {
            // Добавляем ответ ассистента
            const assistantMessageElement = addMessage(data.answer, 'assistant');
            // Прокручиваем к ответу ассистента
            scrollToElement(assistantMessageElement);
            // Сохраняем в историю
            saveToHistory(question, data.answer);
        } else {
            showError(data.error);
            // Прокручиваем к ошибке
            scrollToElement(document.getElementById('error'));
        }
    } catch (err) {
        showError('Произошла ошибка при отправке запроса: ' + err.message);
        // Прокручиваем к ошибке
        scrollToElement(document.getElementById('error'));
    } finally {
        hideLoading();
    }
}

// Добавление сообщения в чат
function addMessage(content, type) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');

    messageDiv.className = `message ${type}-message fade-in`;

    if (type === 'assistant') {
        // Рендерим Markdown для ответов ассистента
        messageDiv.innerHTML = `
            <div class="message-content markdown-content">
                ${marked.parse(content)}
            </div>
        `;
    } else {
        // Простой текст для пользователя
        messageDiv.innerHTML = `
            <div class="message-content">
                ${content}
            </div>
        `;
    }

    chatMessages.appendChild(messageDiv);

    // Убираем welcome-сообщение если оно есть
    const welcomeMessage = chatMessages.querySelector('.welcome-message');
    if (welcomeMessage && chatMessages.children.length > 1) {
        welcomeMessage.remove();
    }

    return messageDiv;
}

// Показать индикатор загрузки
function showLoading() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.classList.remove('d-none');
        // Прокручиваем к индикатору загрузки
        scrollToElement(loadingElement);
    }
}

// Скрыть индикатор загрузки
function hideLoading() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.classList.add('d-none');
    }
}

// Показать ошибку
function showError(message) {
    const errorDiv = document.getElementById('error');
    const errorMessage = document.getElementById('errorMessage');

    if (errorDiv && errorMessage) {
        errorMessage.textContent = message;
        errorDiv.classList.remove('d-none');
    }
}

// Скрыть ошибку
function hideError() {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.classList.add('d-none');
    }
}

// Повтор последнего запроса
function retryLastRequest() {
    if (lastQuestion) {
        document.getElementById('question').value = lastQuestion;
        document.getElementById('submitBtn').disabled = false;
        sendMessage();
    }
}

// Установка примера запроса
function setExample(element) {
    document.getElementById('question').value = element.textContent.trim();
    document.getElementById('question').style.height = 'auto';
    document.getElementById('question').style.height = Math.min(document.getElementById('question').scrollHeight, 150) + 'px';
    document.getElementById('submitBtn').disabled = false;
    document.getElementById('question').focus();
}

// Сохранение в историю (упрощенная версия)
function saveToHistory(question, answer) {
    const chatItem = {
        question: question,
        answer: answer,
        timestamp: new Date().toISOString()
    };

    chatHistory.unshift(chatItem);

    // Сохраняем в localStorage (можно заменить на серверное хранение)
    try {
        localStorage.setItem('climateChatHistory', JSON.stringify(chatHistory.slice(0, 50)));
    } catch (e) {
        console.warn('Не удалось сохранить историю:', e);
    }
}

// Загрузка истории чата
function loadChatHistory() {
    try {
        const savedHistory = localStorage.getItem('climateChatHistory');
        if (savedHistory) {
            chatHistory = JSON.parse(savedHistory);

            // Восстанавливаем историю чата (опционально)
            // restoreChatHistory();
        }
    } catch (e) {
        console.warn('Не удалось загрузить историю:', e);
    }
}

// Восстановление истории чата (если нужно)
function restoreChatHistory() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages || chatHistory.length === 0) return;

    // Очищаем welcome сообщение
    const welcomeMessage = chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }

    // Добавляем сообщения из истории (в обратном порядке, так как они хранятся от новых к старым)
    for (let i = Math.min(chatHistory.length - 1, 4); i >= 0; i--) {
        const item = chatHistory[i];
        addMessage(item.question, 'user');
        addMessage(item.answer, 'assistant');
    }

    // Прокручиваем к последнему сообщению
    scrollToBottom();
}
