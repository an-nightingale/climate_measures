// Настройка Marked.js
marked.setOptions({
    breaks: true,
    gfm: true,
    tables: true,
    sanitize: false
});

let currentConversationId = null;
let lastQuestion = '';
let isTrashMode = false; // Флаг режима корзины

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    checkServiceStatus();
    setupEventListeners();
    loadConversations(); // Загружаем список диалогов
    scrollToBottom(); // Прокручиваем к низу при загрузке

    // Изначально скрываем кнопки удаления
    updateDeleteButtonsVisibility();
});

// Настройка обработчиков событий
function setupEventListeners() {
    const questionInput = document.getElementById('question');
    const submitBtn = document.getElementById('submitBtn');
    const newChatBtn = document.querySelector('.new-chat-btn'); // Кнопка "Новый чат"
    const binIcon = document.querySelector('.bin-icon'); // Иконка корзины

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

    // Новый чат
    if (newChatBtn) {
        newChatBtn.addEventListener('click', startNewConversation);
    }

    // Корзина - переключение режима
    if (binIcon) {
        binIcon.addEventListener('click', toggleTrashMode);
    }

    // Фокус на поле ввода
    questionInput.focus();
}

// Переключение режима корзины
function toggleTrashMode() {
    isTrashMode = !isTrashMode;
    loadConversations();

    // Визуальная индикация режима корзины
    const binIcon = document.querySelector('.bin-icon');
    if (binIcon) {
        if (isTrashMode) {
            binIcon.style.filter = 'invert(25%) sepia(94%) saturate(5072%) hue-rotate(358deg) brightness(102%) contrast(103%)';
        } else {
            binIcon.style.filter = '';
        }
    }
}

// Загрузка списка диалогов
async function loadConversations() {
    try {
        const response = await fetch('/climate/conversations');
        const data = await response.json();

        if (data.success) {
            renderConversations(data.conversations);
        }
    } catch (error) {
        console.error('Ошибка загрузки диалогов:', error);
        showError('Ошибка загрузки истории диалогов');
    }
}

// Отображение списка диалогов
// Отображение списка диалогов
function renderConversations(conversations) {
    const scrollContainer = document.querySelector('.scroll_container');
    if (!scrollContainer) return;

    // Парсим даты правильно - конвертируем из формата "дд.мм.гггг чч:мм" в Date объект
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    // Функция для парсинга даты из формата "дд.мм.гггг чч:мм"
    function parseRussianDate(dateString) {
        if (!dateString) return null;

        // Разбиваем строку на части
        const [datePart, timePart] = dateString.split(' ');
        if (!datePart || !timePart) return null;

        const [day, month, year] = datePart.split('.');
        const [hours, minutes] = timePart.split(':');

        if (!day || !month || !year || !hours || !minutes) return null;

        // Создаем дату (месяцы в JS начинаются с 0)
        return new Date(year, month - 1, day, hours, minutes);
    }

    // Группируем диалоги по датам
    const todayConvs = [];
    const yesterdayConvs = [];
    const olderConvs = [];

    conversations.forEach(conv => {
        const interactionDate = parseRussianDate(conv.last_interaction_at);
        const now = new Date();

        if (!interactionDate) {
            olderConvs.push(conv);
            return;
        }

        // Проверяем, сегодня ли
        const isToday = interactionDate.getDate() === now.getDate() &&
            interactionDate.getMonth() === now.getMonth() &&
            interactionDate.getFullYear() === now.getFullYear();

        // Проверяем, вчера ли
        const isYesterday = interactionDate.getDate() === yesterday.getDate() &&
            interactionDate.getMonth() === yesterday.getMonth() &&
            interactionDate.getFullYear() === yesterday.getFullYear();

        if (isToday) {
            todayConvs.push(conv);
        } else if (isYesterday) {
            yesterdayConvs.push(conv);
        } else {
            olderConvs.push(conv);
        }
    });

    let html = '';

    if (isTrashMode) {
        html += '<div class="trash-mode-header d-flex justify-content-between align-items-center mb-3 p-2 bg-light rounded">';
        html += '   <h5 class="mb-0 text-danger"><i class="fas fa-trash me-2"></i>Режим удаления</h5>';
        html += '   <button style="border:none;" class="btn btn-sm btn-outline-secondary exit-trash-mode" title="Выйти из режима удаления">';
        html += '       <i class="fas fa-times"></i>x';
        html += '   </button>';
        html += '</div>';
    }

    if (todayConvs.length > 0) {
        html += '<h2 class="scroll_header mt-2 mb-0 me-0 ms-0">Сегодня</h2>';
        todayConvs.forEach(conv => {
            html += createConversationHTML(conv);
        });
    }

    if (yesterdayConvs.length > 0) {
        html += '<h2 class="scroll_header mt-3 mb-0 me-0 ms-0">Вчера</h2>';
        yesterdayConvs.forEach(conv => {
            html += createConversationHTML(conv);
        });
    }

    if (olderConvs.length > 0) {
        html += '<h2 class="scroll_header mt-3 mb-0 me-0 ms-0">Ранее</h2>';
        olderConvs.forEach(conv => {
            html += createConversationHTML(conv);
        });
    }

    scrollContainer.innerHTML = html || '<p class="text-muted text-center mt-3">Нет диалогов</p>';

    // Добавляем обработчики кликов по диалогам
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.addEventListener('click', function() {
            if (!isTrashMode) {
                const id = this.getAttribute('data-id');
                loadConversation(id);
            }
        });
    });

    // Добавляем обработчики удаления
    document.querySelectorAll('.delete-conversation').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.getAttribute('data-id');
            deleteConversation(id);
        });
    });

    // Обработчик выхода из режима корзины
    const exitBtn = document.querySelector('.exit-trash-mode');
    if (exitBtn) {
        exitBtn.addEventListener('click', function() {
            isTrashMode = false;
            loadConversations();
            const binIcon = document.querySelector('.bin-icon');
            if (binIcon) binIcon.style.filter = '';
        });
    }

    // Обновляем видимость кнопок удаления
    updateDeleteButtonsVisibility();
}

// Обновление видимости кнопок удаления
function updateDeleteButtonsVisibility() {
    const deleteButtons = document.querySelectorAll('.delete-conversation');
    deleteButtons.forEach(btn => {
        if (isTrashMode) {
            btn.parentElement.style.display = 'block';
            btn.closest('.conversation-item').classList.add('trash-mode-item');
        } else {
            btn.parentElement.style.display = 'none';
            btn.closest('.conversation-item').classList.remove('trash-mode-item');
        }
    });
}

// Создание HTML для элемента диалога
function createConversationHTML(conv) {
    return `
        <div class="conversation-item fade_text w-100 position-relative p-2 mb-1 rounded ${isTrashMode ? 'trash-mode-item' : ''}" data-id="${conv.id}">
            <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1 me-2">
                    <p class="m-0 conversation-title fw-bold">${conv.title}</p>
                    ${conv.last_question ? `<p class="m-0 text-muted small">${conv.last_question}</p>` : ''}
                    ${conv.last_answer_preview ? `<p class="m-0 text-muted small fst-italic">${conv.last_answer_preview}...</p>` : ''}
                </div>
                <div class="delete-btn-container" style="display: ${isTrashMode ? 'block' : 'none'};">
                    <button class="btn p-0 m-0 delete-conversation btn-danger rounded-circle shadow-sm"
                            data-id="${conv.id}"
                            title="Удалить"
                            style="width: 28px; height: 28px;">
                        <i class="fas fa-minus text-white"></i>
                    </button>
                </div>
            </div>
            <small class="text-muted d-block mt-1">${conv.last_interaction_at}</small>
        </div>
    `;
}

// Загрузка конкретного диалога
async function loadConversation(id) {
    try {
        showLoading();
        hideError();

        const response = await fetch(`/climate/conversation/${id}`);
        const data = await response.json();

        if (data.success) {
            currentConversationId = id;
            clearChatMessages();

            // Отображаем все пары диалога
            if (data.conversation && data.conversation.messages) {
                data.conversation.messages.forEach(pair => {
                    addQuestionAnswerPair(pair.question, pair.answer);
                });
            }

            scrollToBottom();
        } else {
            showError('Не удалось загрузить диалог');
        }
    } catch (error) {
        showError('Ошибка при загрузке диалога: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Удаление диалога
async function deleteConversation(id) {
    if (!confirm('Вы уверены, что хотите удалить этот диалог? Это действие нельзя отменить.')) return;

    try {
        const response = await fetch(`/climate/conversation/${id}`, {
            method: 'DELETE',
            headers: {
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            // Если удаляем текущий диалог, очищаем чат
            if (currentConversationId == id) {
                currentConversationId = null;
                clearChatMessages();
            }

            // Перезагружаем список диалогов
            loadConversations();
        } else {
            showError('Не удалось удалить диалог: ' + (data.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        showError('Ошибка при удалении диалога: ' + error.message);
    }
}

// Начать новый диалог
async function startNewConversation() {
    try {
        // Если в режиме корзины - выходим из него
        if (isTrashMode) {
            isTrashMode = false;
            const binIcon = document.querySelector('.bin-icon');
            if (binIcon) binIcon.style.filter = '';
        }

        const response = await fetch('/climate/conversation/new', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({})
        });

        const data = await response.json();

        if (data.success) {
            currentConversationId = data.conversation_id;
            clearChatMessages();
            scrollToBottom();

            // Обновляем список диалогов
            loadConversations();
        } else {
            showError('Не удалось создать новый диалог: ' + (data.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        showError('Ошибка при создании диалога: ' + error.message);
    }
}

// Очистить сообщения чата
function clearChatMessages() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';

    // Восстанавливаем welcome сообщение если чат пустой
    if (!currentConversationId) {
        chatMessages.innerHTML = `
            <div class="welcome-message text-center mb-4">
                <h2 class="welcome_header mb-3">Информационная система для рекомендации адаптационных мероприятий к изменениям климата</h2>
                <p class="welcome_text">Введите в поле запроса описание климатического риска, с которым вы столкнулись.<br>Примеры корректных формулировок:<br>
                    «Частые подтопления реки Тура в Тобольском районе весной»<br>
                    «Учащение засух в южных районах Ишимского района»<br>
                </p>
            </div>
        `;
    }
}

// Добавление пары вопрос-ответ в чат
function addQuestionAnswerPair(question, answer) {
    const chatMessages = document.getElementById('chatMessages');

    // Вопрос пользователя
    const questionDiv = document.createElement('div');
    questionDiv.className = 'message user-message fade-in';
    questionDiv.innerHTML = `
        <div class="message-content">
            ${question}
        </div>
    `;
    chatMessages.appendChild(questionDiv);

    // Ответ ассистента
    const answerDiv = document.createElement('div');
    answerDiv.className = 'message assistant-message fade-in mt-2';
    answerDiv.innerHTML = `
        <div class="message-content markdown-content">
            ${marked.parse(answer)}
        </div>
    `;
    chatMessages.appendChild(answerDiv);

    // Убираем welcome-сообщение если оно есть
    const welcomeMessage = chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }

    return { questionDiv, answerDiv };
}

// Отправка сообщения с сохранением в диалог
async function sendMessage() {
    const questionInput = document.getElementById('question');
    const question = questionInput.value.trim();

    if (!question) return;

    lastQuestion = question;

    // Добавляем пару вопрос-ответ (временно, пока нет ответа)
    const pairElements = addQuestionAnswerPair(question, '<i class="text-muted">Обработка...</i>');

    // Прокручиваем к сообщению пользователя
    scrollToElement(pairElements.questionDiv);

    // Очищаем поле ввода
    questionInput.value = '';
    questionInput.style.height = 'auto';
    document.getElementById('submitBtn').disabled = true;

    // Показываем индикатор загрузки
    showLoading();
    hideError();

    try {
        const payload = {
            question: question
        };

        if (currentConversationId) {
            payload.conversation_id = currentConversationId;
        }

        const response = await fetch('/climate/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
            // Обновляем ID текущего диалога
            if (data.conversation_id) {
                currentConversationId = data.conversation_id;
            }

            // Обновляем ответ в DOM
            if (pairElements.answerDiv && pairElements.answerDiv.querySelector('.message-content')) {
                pairElements.answerDiv.querySelector('.message-content').innerHTML = marked.parse(data.answer || '');
            }

            // Прокручиваем к ответу ассистента
            scrollToElement(pairElements.answerDiv);

            // Обновляем список диалогов
            loadConversations();
        } else {
            // Обновляем ответ с ошибкой
            if (pairElements.answerDiv && pairElements.answerDiv.querySelector('.message-content')) {
                pairElements.answerDiv.querySelector('.message-content').innerHTML =
                    `<span class="text-danger">${data.error || 'Неизвестная ошибка'}</span>`;
            }
            showError(data.error || 'Неизвестная ошибка при получении ответа');
        }
    } catch (err) {
        // Обновляем ответ с ошибкой
        if (pairElements.answerDiv && pairElements.answerDiv.querySelector('.message-content')) {
            pairElements.answerDiv.querySelector('.message-content').innerHTML =
                `<span class="text-danger">Ошибка: ${err.message}</span>`;
        }
        showError('Произошла ошибка при отправке запроса: ' + err.message);
    } finally {
        hideLoading();
    }
}

// Прокрутка к самому нижнему сообщению
function scrollToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
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

// Показать индикатор загрузки
function showLoading() {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.classList.remove('d-none');
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

        // Автоматически скрываем ошибку через 5 секунд
        setTimeout(() => {
            hideError();
        }, 5000);
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
        document.getElementById('question').style.height = 'auto';
        document.getElementById('question').style.height = Math.min(document.getElementById('question').scrollHeight, 150) + 'px';
        document.getElementById('submitBtn').disabled = false;
        sendMessage();
    }
}

// Проверка наличия таблиц в ответе
function checkForTables(content) {
    return fetch('/export/check-tables', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ content: content })
    })
        .then(response => response.json())
        .catch(error => {
            console.error('Ошибка проверки таблиц:', error);
            return { has_tables: false, table_count: 0 };
        });
}

// Экспорт в DOCX
function exportToDocx(answerContent, filename = null) {
    const payload = { content: answerContent };
    if (filename) payload.filename = filename;

    fetch('/export/docx', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(payload)
    })
        .then(response => {
            if (response.ok) {
                return response.blob();
            } else {
                return response.json().then(data => {
                    throw new Error(data.error || 'Ошибка при генерации файла');
                });
            }
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = payload.filename || 'tables_' + new Date().toISOString().replace(/[:.]/g, '-') + '.docx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showTemporaryMessage('Файл успешно скачан!', 'success');
        })
        .catch(error => {
            console.error('Ошибка экспорта DOCX:', error);
            showError('Ошибка при создании DOCX файла: ' + error.message);
        });
}

// Экспорт в Excel
function exportToExcel(answerContent, filename = null) {
    const payload = { content: answerContent };
    if (filename) payload.filename = filename;

    fetch('/export/excel', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(payload)
    })
        .then(response => {
            if (response.ok) {
                return response.blob();
            } else {
                return response.json().then(data => {
                    throw new Error(data.error || 'Ошибка при генерации файла');
                });
            }
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = payload.filename || 'tables_' + new Date().toISOString().replace(/[:.]/g, '-') + '.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showTemporaryMessage('Файл успешно скачан!', 'success');
        })
        .catch(error => {
            console.error('Ошибка экспорта Excel:', error);
            showError('Ошибка при создании Excel файла: ' + error.message);
        });
}

// Временное сообщение
function showTemporaryMessage(message, type = 'info') {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `alert alert-${type} temporary-message fade-in mb-3`;
    messageDiv.innerHTML = `<i class="fas fa-info-circle me-2"></i>${message}`;
    chatMessages.insertBefore(messageDiv, chatMessages.firstChild);

    setTimeout(() => {
        messageDiv.classList.add('fade-out');
        setTimeout(() => {
            messageDiv.remove();
        }, 300);
    }, 3000);
}

// Обновление функции addQuestionAnswerPair для добавления кнопок экспорта
function addQuestionAnswerPair(question, answer) {
    const chatMessages = document.getElementById('chatMessages');

    // Вопрос пользователя
    const questionDiv = document.createElement('div');
    questionDiv.className = 'message user-message fade-in';
    questionDiv.innerHTML = `
        <div class="message-content">
            ${question}
        </div>
    `;
    chatMessages.appendChild(questionDiv);

    // Ответ ассистента
    const answerDiv = document.createElement('div');
    answerDiv.className = 'message assistant-message fade-in mt-2';

    // Проверяем наличие таблиц в ответе
    checkForTables(answer).then(result => {
        let exportButtons = '';
        if (result.has_tables) {
            exportButtons = `
                <div class="export-buttons mt-2 d-flex gap-2">
                    <button class="btn btn-sm btn-outline-primary export-docx" title="Скачать DOCX">
                        <i class="fas fa-file-word me-1"></i>DOCX
                    </button>
                    <button class="btn btn-sm btn-outline-success export-excel" title="Скачать Excel">
                        <i class="fas fa-file-excel me-1"></i>Excel
                    </button>
                </div>
            `;
        }

        answerDiv.innerHTML = `
            <div class="message-content markdown-content">
                ${marked.parse(answer)}
            </div>
            ${exportButtons}
        `;

        // Добавляем обработчики для кнопок экспорта
        if (result.has_tables) {
            const exportDocxBtn = answerDiv.querySelector('.export-docx');
            const exportExcelBtn = answerDiv.querySelector('.export-excel');

            if (exportDocxBtn) {
                exportDocxBtn.addEventListener('click', () => {
                    exportToDocx(answer, `dialog_${currentConversationId}_tables.docx`);
                });
            }

            if (exportExcelBtn) {
                exportExcelBtn.addEventListener('click', () => {
                    exportToExcel(answer, `dialog_${currentConversationId}_tables.xlsx`);
                });
            }
        }
    });

    chatMessages.appendChild(answerDiv);

    // Убираем welcome-сообщение если оно есть
    const welcomeMessage = chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }

    return { questionDiv, answerDiv };
}
