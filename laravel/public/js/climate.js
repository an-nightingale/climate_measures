// Настройка Marked.js
marked.setOptions({
    breaks: true,
    gfm: true,
    tables: true,
    sanitize: false
});

let currentConversationId = null;
let lastQuestion = '';
let isTrashMode = false;

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    checkServiceStatus();
    setupEventListeners();
    loadConversations();
    scrollToBottom();
    updateDeleteButtonsVisibility();
});

// Настройка обработчиков событий
function setupEventListeners() {
    const questionInput = document.getElementById('question');
    const submitBtn = document.getElementById('submitBtn');
    const newChatBtn = document.querySelector('.new-chat-btn');
    const binIcon = document.querySelector('.bin-icon');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const sidebarToggle = document.getElementById('sidebarToggle');

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function () {

            const isHidden = sidebar.classList.contains('sidebar-hidden');

            if (isHidden) {
                sidebar.classList.remove('sidebar-hidden');
                sidebarToggle.style.transform = 'rotate(0deg)';
            } else {
                sidebar.classList.add('sidebar-hidden');
                sidebarToggle.style.transform = 'rotate(180deg)';
            }

        });
    }


    // Авто-высота текстового поля
    questionInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 150) + 'px';
        submitBtn.disabled = !this.value.trim();
    });

    // Отправка по клику
    submitBtn.addEventListener('click', sendMessage);

    // Отправка по Ctrl+Enter или Cmd+Enter
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

    const binIcon = document.querySelector('.bin-icon');
    if (binIcon) {
        binIcon.style.filter = isTrashMode
            ? 'invert(25%) sepia(94%) saturate(5072%) hue-rotate(358deg) brightness(102%) contrast(103%)'
            : '';
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
function renderConversations(conversations) {
    const scrollContainer = document.querySelector('.scroll_container');
    if (!scrollContainer) return;

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    function parseRussianDate(dateString) {
        if (!dateString) return null;
        const [datePart, timePart] = dateString.split(' ');
        if (!datePart || !timePart) return null;
        const [day, month, year] = datePart.split('.');
        const [hours, minutes] = timePart.split(':');
        if (!day || !month || !year || !hours || !minutes) return null;
        return new Date(year, month - 1, day, hours, minutes);
    }

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

        const isToday = interactionDate.getDate() === now.getDate() &&
            interactionDate.getMonth() === now.getMonth() &&
            interactionDate.getFullYear() === now.getFullYear();

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

    // Обработчики кликов по диалогам
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.addEventListener('click', function() {
            if (!isTrashMode) {
                const id = this.getAttribute('data-id');
                loadConversation(id);
            }
        });
    });

    // Обработчики удаления
    document.querySelectorAll('.delete-conversation').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.getAttribute('data-id');
            deleteConversation(id);
        });
    });

    // Выход из режима корзины
    const exitBtn = document.querySelector('.exit-trash-mode');
    if (exitBtn) {
        exitBtn.addEventListener('click', function() {
            isTrashMode = false;
            loadConversations();
            const binIcon = document.querySelector('.bin-icon');
            if (binIcon) binIcon.style.filter = '';
        });
    }

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
                <p class="m-0 conversation-title fw-bold">${escapeHtml(conv.title)}</p>
                ${conv.last_question ? `<p class="m-0 text-muted small">${escapeHtml(conv.last_question)}</p>` : ''}
                ${conv.last_answer_preview ? `<p class="m-0 text-muted small fst-italic">${escapeHtml(conv.last_answer_preview)}...</p>` : ''}
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
            if (currentConversationId == id) {
                currentConversationId = null;
                clearChatMessages();
            }
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

    if (isTrashMode) {
        isTrashMode = false;
        const binIcon = document.querySelector('.bin-icon');
        if (binIcon) binIcon.style.filter = '';
    }

    // Просто сбрасываем текущий диалог
    currentConversationId = null;

    clearChatMessages();
    scrollToBottom();

    // НЕ вызываем loadConversations()
}


// Очистить сообщения чата
function clearChatMessages() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';

    if (!currentConversationId) {
        chatMessages.innerHTML = `
        <div class="welcome-message text-center mb-4">
            <h2 class="welcome_header mb-3">Информационная система для рекомендации адаптационных мероприятий к изменениям климата</h2>
            <p class="welcome_text">
                Введите в поле запроса описание климатического риска, с которым вы столкнулись.<br>
                Примеры корректных формулировок:<br>
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
    questionDiv.innerHTML = `<div class="message-content">${escapeHtml(question)}</div>`;
    chatMessages.appendChild(questionDiv);

    // Ответ ассистента
    const answerDiv = document.createElement('div');
    answerDiv.className = 'message assistant-message fade-in mt-2';
    chatMessages.appendChild(answerDiv);

    // Убираем welcome-сообщение
    const welcomeMessage = chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }

    // Рендерим Markdown в HTML
    const markdownHTML = marked.parse(answer);
    const safeHTML = addTargetBlankToLinks(markdownHTML);
    answerDiv.innerHTML = `<div class="message-content markdown-content">${safeHTML}</div>`;

    // === ПРОВЕРЯЕМ НАЛИЧИЕ ТАБЛИЦ И ДОБАВЛЯЕМ КНОПКИ ЭКСПОРТА ===
    const tables = answerDiv.querySelectorAll('.markdown-content table');

    if (tables.length > 0) {
        // Создаём контейнер для кнопок экспорта
        const exportButtonsDiv = document.createElement('div');
        exportButtonsDiv.className = 'export-buttons mt-2 d-flex gap-2';
        exportButtonsDiv.innerHTML = `
            <button class="btn btn-sm btn-outline-primary export-docx" title="Скачать DOCX">
                <i class="fas fa-file-word me-1"></i>DOCX
            </button>
            <button class="btn btn-sm btn-outline-success export-excel" title="Скачать Excel">
                <i class="fas fa-file-excel me-1"></i>Excel
            </button>
        `;
        answerDiv.appendChild(exportButtonsDiv);

        // === ДОБАВЛЯЕМ ГАЛОЧКИ В ТАБЛИЦЫ ===
        tables.forEach((table, tableIdx) => {
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach((row, rowIdx) => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 5) {
                    // Проверяем, нет ли уже кнопки
                    const existingApprove = row.querySelector('.approve-measure');
                    if (existingApprove) return;

                    const approveCell = document.createElement('td');
                    approveCell.innerHTML = `
                        <button class="btn btn-sm btn-success approve-measure"
                                title="Добавить в базу знаний"
                                data-table="${tableIdx}"
                                data-row="${rowIdx}">
                            <i class="fas fa-check"></i>
                             &#x2713;
                        </button>
                    `;
                    row.appendChild(approveCell);

                    // Обработчик нажатия на галочку
                    approveCell.querySelector('.approve-measure').addEventListener('click', () => {
                        const rowData = Array.from(cells).slice(0, 5).map(c => c.innerText.trim());
                        sendApprovedMeasure({
                            conversation_id: currentConversationId,
                            measure: {
                                name: rowData[0],
                                mitigation: rowData[1],
                                adaptation: rowData[2],
                                relevance: rowData[3],
                                responsible: rowData[4]
                            },
                            source_question: lastQuestion
                        });
                    });
                }
            });
        });

        // === ОБРАБОТЧИКИ КНОПОК ЭКСПОРТА ===
        const exportDocxBtn = answerDiv.querySelector('.export-docx');
        const exportExcelBtn = answerDiv.querySelector('.export-excel');

        if (exportDocxBtn) {
            exportDocxBtn.addEventListener('click', () => {
                // Берём весь ответ, включая ссылки после таблицы
                const answerContent = answerDiv.querySelector('.message-content');
                const tableHtml = answerDiv.querySelector('.markdown-content').innerHTML;
                exportToDocx(tableHtml, `dialog_${currentConversationId}_tables.docx`);
            });
        }

        if (exportExcelBtn) {
            exportExcelBtn.addEventListener('click', () => {
                const tableHtml = answerDiv.querySelector('.markdown-content').innerHTML;
                exportToExcel(tableHtml, `dialog_${currentConversationId}_tables.xlsx`);
            });
        }
    }

    scrollToBottom();

    return { questionDiv, answerDiv };
}

// Экспорт в DOCX
function exportToDocx(content, filename) {
    const btn = document.querySelector('.export-docx');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Загрузка...';
    }

    // === ИСПРАВЛЕНИЕ: берём полный HTML ответа ===
    const answerDiv = btn.closest('.assistant-message');
    const contentDiv = answerDiv ? answerDiv.querySelector('.message-content') : null;
    const fullHtml = contentDiv ? contentDiv.innerHTML : content;

    fetch('/climate/export/docx', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
            content: fullHtml,  // Отправляем ВЕСЬ HTML, не только таблицы
            filename: filename
        })
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
            a.download = filename || 'export_' + new Date().toISOString().replace(/[:.]/g, '-') + '.docx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showTemporaryMessage('Файл DOCX успешно скачан!', 'success');
        })
        .catch(error => {
            console.error('Ошибка экспорта DOCX:', error);
            showError('Ошибка при создании DOCX файла: ' + error.message);
        })
        .finally(() => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-file-word me-1"></i>DOCX';
            }
        });
}

// Экспорт в Excel
function exportToExcel(content, filename) {
    const btn = document.querySelector('.export-excel');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Загрузка...';
    }

    // === ИСПРАВЛЕНИЕ: берём полный HTML ответа ===
    const answerDiv = btn.closest('.assistant-message');
    const contentDiv = answerDiv ? answerDiv.querySelector('.message-content') : null;
    const fullHtml = contentDiv ? contentDiv.innerHTML : content;

    fetch('/climate/export/excel', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
            content: fullHtml,  // Отправляем ВЕСЬ HTML
            filename: filename
        })
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
            a.download = filename || 'export_' + new Date().toISOString().replace(/[:.]/g, '-') + '.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showTemporaryMessage('Файл Excel успешно скачан!', 'success');
        })
        .catch(error => {
            console.error('Ошибка экспорта Excel:', error);
            showError('Ошибка при создании Excel файла: ' + error.message);
        })
        .finally(() => {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-file-excel me-1"></i>Excel';
            }
        });
}

// Отправка одобренного мероприятия
async function sendApprovedMeasure(data) {
    try {
        const response = await fetch('/climate/approve-measure', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify(data)
        });
        const result = await response.json();

        if (result.success) {
            showTemporaryMessage('Мероприятие добавлено в базу знаний!', 'success');
        } else {
            showError('Ошибка добавления: ' + (result.error || 'неизвестно'));
        }
    } catch (err) {
        showError('Ошибка отправки: ' + err.message);
    }
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
        const payload = { question: question };
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
            if (data.conversation_id) {
                currentConversationId = data.conversation_id;
            }

            // Обновляем ответ в DOM
            if (pairElements.answerDiv && pairElements.answerDiv.querySelector('.message-content')) {
                pairElements.answerDiv.querySelector('.message-content').innerHTML = marked.parse(data.answer || '');

                // === ПОВТОРНО ПРОВЕРЯЕМ ТАБЛИЦЫ ПОСЛЕ ПОЛУЧЕНИЯ ОТВЕТА ===
                const tables = pairElements.answerDiv.querySelectorAll('.markdown-content table');
                if (tables.length > 0 && !pairElements.answerDiv.querySelector('.export-buttons')) {
                    // Удаляем временный текст загрузки
                    pairElements.answerDiv.querySelector('.message-content').innerHTML = marked.parse(data.answer || '');

                    // Добавляем кнопки экспорта
                    const exportButtonsDiv = document.createElement('div');
                    exportButtonsDiv.className = 'export-buttons mt-2 d-flex gap-2';
                    exportButtonsDiv.innerHTML = `
                        <button class="btn btn-sm btn-outline-primary export-docx" title="Скачать DOCX">
                            <i class="fas fa-file-word me-1"></i>DOCX
                        </button>
                        <button class="btn btn-sm btn-outline-success export-excel" title="Скачать Excel">
                            <i class="fas fa-file-excel me-1"></i>Excel
                        </button>
                    `;
                    pairElements.answerDiv.appendChild(exportButtonsDiv);

                    // Добавляем галочки в таблицы
                    addApproveButtonsToTables(pairElements.answerDiv);

                    // Навешиваем обработчики на кнопки экспорта
                    const exportDocxBtn = pairElements.answerDiv.querySelector('.export-docx');
                    const exportExcelBtn = pairElements.answerDiv.querySelector('.export-excel');

                    if (exportDocxBtn) {
                        exportDocxBtn.addEventListener('click', () => {
                            const tableHtml = pairElements.answerDiv.querySelector('.markdown-content').innerHTML;
                            exportToDocx(tableHtml, `dialog_${currentConversationId}_tables.docx`);
                        });
                    }

                    if (exportExcelBtn) {
                        exportExcelBtn.addEventListener('click', () => {
                            const tableHtml = pairElements.answerDiv.querySelector('.markdown-content').innerHTML;
                            exportToExcel(tableHtml, `dialog_${currentConversationId}_tables.xlsx`);
                        });
                    }
                }
            }

            scrollToElement(pairElements.answerDiv);
            loadConversations();
        } else {
            if (pairElements.answerDiv && pairElements.answerDiv.querySelector('.message-content')) {
                pairElements.answerDiv.querySelector('.message-content').innerHTML =
                    `<span class="text-danger">${data.error || 'Неизвестная ошибка'}</span>`;
            }
            showError(data.error || 'Неизвестная ошибка при получении ответа');
        }
    } catch (err) {
        if (pairElements.answerDiv && pairElements.answerDiv.querySelector('.message-content')) {
            pairElements.answerDiv.querySelector('.message-content').innerHTML =
                `<span class="text-danger">Ошибка: ${err.message}</span>`;
        }
        showError('Произошла ошибка при отправке запроса: ' + err.message);
    } finally {
        hideLoading();
    }
}

// Добавление кнопок одобрения в таблицы
function addApproveButtonsToTables(answerDiv) {
    const tables = answerDiv.querySelectorAll('.markdown-content table');
    tables.forEach((table, tableIdx) => {
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach((row, rowIdx) => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 5) {
                const existingApprove = row.querySelector('.approve-measure');
                if (existingApprove) return;

                const approveCell = document.createElement('td');
                approveCell.innerHTML = `
                    <button class="btn btn-sm btn-success approve-measure"
                            title="Добавить в базу знаний"
                            data-table="${tableIdx}"
                            data-row="${rowIdx}">
                        <i class="fas fa-check"></i>
                        &#x2713;
                    </button>
                `;
                row.appendChild(approveCell);

                approveCell.querySelector('.approve-measure').addEventListener('click', () => {
                    const rowData = Array.from(cells).slice(0, 5).map(c => c.innerText.trim());
                    sendApprovedMeasure({
                        conversation_id: currentConversationId,
                        measure: {
                            name: rowData[0],
                            mitigation: rowData[1],
                            adaptation: rowData[2],
                            relevance: rowData[3],
                            responsible: rowData[4]
                        },
                        source_question: lastQuestion
                    });
                });
            }
        });
    });
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

// Временное сообщение
function showTemporaryMessage(message, type = 'info') {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `alert alert-${type} temporary-message fade-in mb-3`;
    messageDiv.innerHTML = `<i class="fas fa-info-circle me-2"></i>${escapeHtml(message)}`;
    chatMessages.insertBefore(messageDiv, chatMessages.firstChild);

    setTimeout(() => {
        messageDiv.classList.add('fade-out');
        setTimeout(() => {
            messageDiv.remove();
        }, 300);
    }, 3000);
}

// Экранирование HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
function addTargetBlankToLinks(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    doc.querySelectorAll('a[href]').forEach(link => {
        // Добавляем target и rel только если их нет
        if (!link.target) link.target = '_blank';
        if (!link.rel || !link.rel.includes('noopener')) {
            link.rel = 'noopener noreferrer';
        }
    });

    return doc.body.innerHTML;
}
