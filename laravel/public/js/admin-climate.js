// Управление кейсами
class ClimateCasesAdmin {
    constructor() {
        this.currentPage = 1;
        this.searchQuery = '';
        this.currentEditId = null;
        this.currentGeneratedData = null;
        this.aiChatHistory = [];

        this.csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

        this.init();
    }

    init() {
        this.loadCases();
        this.setupEventListeners();
        this.setupAiChat();
    }

    setupEventListeners() {
        // Кнопка обновления
        document.getElementById('refreshCases')?.addEventListener('click', () => this.loadCases());

        // Сохранение нового кейса
        document.getElementById('saveCaseBtn')?.addEventListener('click', () => this.saveCase());

        // AI-генерация
        document.getElementById('sendAiPrompt')?.addEventListener('click', () => this.sendAiPrompt());
        document.getElementById('saveDataBtn')?.addEventListener('click', () => this.saveGeneratedData());
        document.getElementById('regenerateBtn')?.addEventListener('click', () => this.regenerateData());

        // Переключение режима предпросмотра
        document.getElementById('showSqlPreview')?.addEventListener('change', (e) => {
            this.togglePreviewMode(e.target.checked);
        });
        document.getElementById('updateCaseBtn')?.addEventListener('click', () => this.updateCase());
    }

    async loadCases(page = 1) {
        try {
            showLoading();
            const response = await fetch(`/admin/climate/cases?page=${page}&query=${this.searchQuery}`, {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                this.renderCases(data.cases.data || data.cases);
                this.updateStats(data.stats);
                this.updatePagination(data.cases);
            } else {
                this.showError('Не удалось загрузить кейсы');
            }
        } catch (error) {
            console.error('Ошибка загрузки кейсов:', error);
            this.showError('Не удалось загрузить кейсы: ' + error.message);
        } finally {
            hideLoading();
        }
    }

    renderCases(cases) {
        const tbody = document.getElementById('casesTableBody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (!cases || cases.length === 0) {
            tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4 text-muted">
                    <i class="fas fa-database me-2"></i>Нет данных
                </td>
            </tr>
        `;
            return;
        }

        cases.forEach(caseItem => {
            const row = document.createElement('tr');
            row.innerHTML = `
            <td>${caseItem.id}</td>
            <td>${caseItem.problem}</td>
            <td>${caseItem.measure_name}</td>
            <td>${caseItem.district_name || '-'}</td>
            <td>${caseItem.responsible_org || '-'}</td>
            <td>${new Date(caseItem.created_at).toLocaleDateString('ru-RU')}</td>
            <td>${caseItem.updated_at ? new Date(caseItem.updated_at).toLocaleDateString('ru-RU') : '-'}</td>
            <td>
                <button class="btn btn-sm btn-info me-1" onclick="admin.editCase(${caseItem.id})">
                    <i class="fas fa-edit me-1"></i>Изменить
                </button>
                <button class="btn btn-sm btn-danger" onclick="admin.deleteCase(${caseItem.id})">
                    <i class="fas fa-trash me-1"></i>Удалить
                </button>
            </td>
        `;
            tbody.appendChild(row);
        });
    }

    async editCase(id) {
        try {
            showLoading();
            const response = await fetch(`/admin/climate/cases/${id}`, {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            const data = await response.json();

            if (data.success) {
                this.currentEditId = id;
                this.showEditModal(data.case);
            } else {
                this.showError('Не удалось загрузить кейс');
            }
        } catch (error) {
            console.error('Ошибка загрузки кейса:', error);
            this.showError('Не удалось загрузить данные кейса');
        } finally {
            hideLoading();
        }
    }

    async deleteCase(id) {
        if (!confirm('Вы уверены, что хотите удалить этот кейс?')) return;

        try {
            const response = await fetch(`/admin/climate/cases/${id}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': this.csrfToken,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                this.showSuccess('Кейс успешно удален');
                this.loadCases();
            } else {
                this.showError(data.error || 'Ошибка удаления');
            }
        } catch (error) {
            console.error('Ошибка удаления:', error);
            this.showError('Не удалось удалить кейс');
        }
    }

    async saveCase() {
        const form = document.getElementById('addCaseForm');
        if (!form) return;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        const url = this.currentEditId
            ? `/admin/climate/cases/${this.currentEditId}`
            : '/admin/climate/cases';

        const method = this.currentEditId ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'X-CSRF-TOKEN': this.csrfToken,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess(this.currentEditId ? 'Кейс обновлен' : 'Кейс добавлен');
                this.loadCases();

                // Закрываем модальное окно
                const modalId = this.currentEditId ? 'editCaseModal' : 'addCaseModal';
                const modalElement = document.getElementById(modalId);
                if (modalElement) {
                    const modal = bootstrap.Modal.getInstance(modalElement);
                    if (modal) modal.hide();
                }

                // Очищаем форму
                form.reset();
                this.currentEditId = null;
            } else {
                this.showError(result.errors ? Object.values(result.errors).join(', ') : result.error || 'Ошибка сохранения');
            }
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            this.showError('Не удалось сохранить кейс');
        }
    }

    // AI-чат функционал
    setupAiChat() {
        this.aiChatHistory = [];
    }

    async sendAiPrompt() {
        const promptInput = document.getElementById('aiPrompt');
        if (!promptInput) return;

        const prompt = promptInput.value.trim();
        if (!prompt) {
            this.showError('Введите описание кейса');
            return;
        }

        this.addAiMessage('user', prompt);
        promptInput.value = '';

        try {
            showLoading();
            const response = await fetch('/admin/climate/generate-data', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': this.csrfToken,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ prompt: prompt })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                if (data.legacy_format && data.sql) {
                    // Обработка старого формата с SQL
                    this.addAiMessage('assistant', 'SQL запрос сгенерирован');
                    this.currentGeneratedData = this.parseSqlToData(data.sql);
                    this.showDataPreview(this.currentGeneratedData);
                    this.showSqlPreview(data.sql);
                } else if (data.data) {
                    // Обработка нового формата с данными
                    this.addAiMessage('assistant', 'Данные успешно сгенерированы');
                    this.currentGeneratedData = data.data;
                    this.showDataPreview(data.data);

                    // Если есть SQL для предпросмотра
                    if (data.sql) {
                        this.showSqlPreview(data.sql);
                    }
                } else {
                    this.addAiMessage('assistant', 'Некорректный формат ответа');
                }

                // Активируем кнопки
                document.getElementById('saveDataBtn').disabled = false;
                document.getElementById('regenerateBtn').disabled = false;

            } else {
                this.addAiMessage('assistant', `Ошибка: ${data.error || 'неизвестная ошибка'}`);
            }
        } catch (error) {
            console.error('Ошибка генерации:', error);

        } finally {
            hideLoading();
        }
    }

    // Парсинг SQL в данные (для обратной совместимости)
    parseSqlToData(sql) {
        try {
            // Извлекаем значения из INSERT запроса
            const valuesMatch = sql.match(/VALUES\s*\((.*)\)/s);
            if (!valuesMatch) return null;

            const values = valuesMatch[1]
                .replace(/'/g, '') // Удаляем кавычки
                .split(',')
                .map(v => v.trim());

            // Базовые поля таблицы
            return {
                problem: values[0] || '',
                measure_name: values[1] || '',
                mitigation_effect: values[2] || '',
                adaptation_effect: values[3] || '',
                district_name: values[4] || '',
                climate_conditions: values[5] || '',
                responsible_org: values[6] || '',
                source_url: values[7] || ''
            };
        } catch (e) {
            console.error('Ошибка парсинга SQL:', e);
            return null;
        }
    }

    addAiMessage(role, content) {
        const chatDiv = document.getElementById('aiChatMessages');
        if (!chatDiv) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}-message mb-2 p-2 rounded`;
        if (role === 'user') {
            msgDiv.classList.add('bg-primary', 'text-white');
        } else {
            msgDiv.classList.add('bg-light');
        }
        msgDiv.innerHTML = `<strong>${role === 'user' ? 'Вы' : 'AI'}:</strong> ${this.escapeHtml(content)}`;
        chatDiv.appendChild(msgDiv);
        chatDiv.scrollTop = chatDiv.scrollHeight;
    }

    showDataPreview(data) {
        const previewTable = document.getElementById('previewTable');
        if (!previewTable) return;

        // Очищаем таблицу (кроме заголовка)
        const tbody = previewTable.querySelector('tbody');
        if (!tbody) return;

        // Удаляем старые строки (кроме первой)
        while (tbody.rows.length > 1) {
            tbody.deleteRow(1);
        }

        // Определяем соответствие полей и русских названий
        const fieldLabels = {
            'problem': 'Проблема',
            'measure_name': 'Наименование мероприятий',
            'mitigation_effect': 'Митигационный эффект',
            'adaptation_effect': 'Адаптационный эффект',
            'district_name': 'Наименование района',
            'climate_conditions': 'Агроклиматические условия',
            'responsible_org': 'Ответственная организация',
            'source_url': 'Источник (URL)'
        };

        // Добавляем строки с данными
        Object.keys(fieldLabels).forEach(field => {
            const value = data[field] || '';
            if (value || field === 'measure_name') { // measure_name всегда показываем
                const row = tbody.insertRow();
                const cell1 = row.insertCell(0);
                const cell2 = row.insertCell(1);

                cell1.innerHTML = `<strong>${fieldLabels[field]}</strong>`;
                cell2.innerHTML = this.escapeHtml(value) || '<span class="text-muted">не указано</span>';

                // Добавляем классы для стилизации
                cell1.classList.add('bg-light');
                cell2.classList.add('bg-white');
            }
        });
    }

    showSqlPreview(sql) {
        const sqlCode = document.getElementById('sqlCode');
        if (sqlCode) {
            sqlCode.textContent = sql;
        }
    }

    togglePreviewMode(showSql) {
        const dataPreview = document.getElementById('dataPreview');
        const sqlPreview = document.getElementById('sqlPreview');

        if (dataPreview && sqlPreview) {
            if (showSql) {
                dataPreview.style.display = 'none';
                sqlPreview.style.display = 'block';
            } else {
                dataPreview.style.display = 'block';
                sqlPreview.style.display = 'none';
            }
        }
    }

    async saveGeneratedData() {
        if (!this.currentGeneratedData) {
            this.showError('Нет данных для сохранения');
            return;
        }

        try {
            showLoading();
            const response = await fetch('/admin/climate/save-generated-data', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': this.csrfToken,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ data: this.currentGeneratedData })
            });

            const data = await response.json();

            if (data.success) {
                const resultMessage = document.getElementById('resultMessage');
                const sqlResult = document.getElementById('sqlResult');

                if (resultMessage) {
                    resultMessage.textContent = data.message;
                }
                if (sqlResult) {
                    sqlResult.classList.remove('d-none');
                }

                this.showSuccess('Кейс успешно сохранен в базу данных');

                // Обновляем список кейсов
                setTimeout(() => this.loadCases(), 1000);

                // Отключаем кнопки после сохранения
                document.getElementById('saveDataBtn').disabled = true;

            } else {
                this.showError(data.errors ? Object.values(data.errors).join(', ') : data.error || 'Ошибка сохранения');
            }
        } catch (error) {
            console.error('Ошибка сохранения данных:', error);
            this.showError('Не удалось сохранить данные: ' + error.message);
        } finally {
            hideLoading();
        }
    }

    regenerateData() {
        const promptInput = document.getElementById('aiPrompt');
        const lastUserMessage = this.aiChatHistory
            .filter(msg => msg.role === 'user')
            .pop();

        if (lastUserMessage) {
            this.addAiMessage('user', 'Пожалуйста, перегенерируй данные: ' + lastUserMessage.content);
            this.sendAiPrompt();
        } else {
            this.showError('Нет предыдущего запроса для перегенерации');
        }
    }

    updateStats(stats) {
        const totalCases = document.getElementById('totalCases');
        if (totalCases && stats.total !== undefined) {
            totalCases.textContent = stats.total;
        }
    }

    updatePagination(pagination) {
        const container = document.getElementById('paginationContainer');
        if (!container || !pagination.links) return;

        let html = '<ul class="pagination justify-content-center">';

        // Предыдущая страница
        if (pagination.current_page > 1) {
            html += `
                <li class="page-item">
                    <a class="page-link" href="#" onclick="admin.loadCases(${pagination.current_page - 1}); return false;">
                        &laquo;
                    </a>
                </li>
            `;
        }

        // Номера страниц
        for (let i = 1; i <= pagination.last_page; i++) {
            if (i === pagination.current_page) {
                html += `<li class="page-item active"><span class="page-link">${i}</span></li>`;
            } else {
                html += `
                    <li class="page-item">
                        <a class="page-link" href="#" onclick="admin.loadCases(${i}); return false;">
                            ${i}
                        </a>
                    </li>
                `;
            }
        }

        // Следующая страница
        if (pagination.current_page < pagination.last_page) {
            html += `
                <li class="page-item">
                    <a class="page-link" href="#" onclick="admin.loadCases(${pagination.current_page + 1}); return false;">
                        &raquo;
                    </a>
                </li>
            `;
        }

        html += '</ul>';
        container.innerHTML = html;
    }

    showEditModal(caseData) {
        document.getElementById('editCaseId').value = caseData.id;
        document.getElementById('editProblem').value = caseData.problem || '';
        document.getElementById('editMeasureName').value = caseData.measure_name || '';
        document.getElementById('editDistrictName').value = caseData.district_name || '';
        document.getElementById('editMitigationEffect').value = caseData.mitigation_effect || '';
        document.getElementById('editAdaptationEffect').value = caseData.adaptation_effect || '';
        document.getElementById('editClimateConditions').value = caseData.climate_conditions || '';
        document.getElementById('editResponsibleOrg').value = caseData.responsible_org || '';
        document.getElementById('editSourceUrl').value = caseData.source_url || '';

        // Открываем модальное окно
        const modalEl = document.getElementById('editCaseModal');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }

// Новый метод updateCase():
    async updateCase() {
        const form = document.getElementById('editCaseForm');
        if (!form) return;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const id = data.id;

        try {
            showLoading();
            const response = await fetch(`/admin/climate/cases/${id}`, {
                method: 'PUT',
                headers: {
                    'X-CSRF-TOKEN': this.csrfToken,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess('Кейс успешно обновлён');
                this.loadCases();

                // Закрываем модальное окно
                const modalEl = document.getElementById('editCaseModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            } else {
                this.showError(result.errors ? Object.values(result.errors).join(', ') : result.error || 'Ошибка обновления');
            }
        } catch (error) {
            console.error('Ошибка обновления:', error);
            this.showError('Не удалось обновить кейс');
        } finally {
            hideLoading();
        }
    }

    // Вспомогательные методы
    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showSuccess(message) {
        // Используем Toast или alert
        if (typeof toastr !== 'undefined') {
            toastr.success(message);
        } else {
            alert('Успех: ' + message);
        }
    }

    showError(message) {
        // Используем Toast или alert
        if (typeof toastr !== 'undefined') {
            toastr.error(message);
        } else {
            alert('Ошибка: ' + message);
        }
    }
}

// Вспомогательные функции
function showLoading() {
    const btn = document.getElementById('sendAiPrompt');
    const chatDiv = document.getElementById('aiChatMessages');

    if (btn) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Генерация...';
        btn.disabled = true;
    }

    // Добавляем сообщение о генерации в чат
    if (chatDiv) {
        const generatingMsg = document.createElement('div');
        generatingMsg.id = 'aiGeneratingMessage';
        generatingMsg.className = 'message assistant-message mb-2 p-2 rounded bg-light';
        generatingMsg.innerHTML = '<strong>AI:</strong> <i class="fas fa-spinner fa-spin me-2"></i>Анализирую запрос и генерирую структурированные данные...';
        chatDiv.appendChild(generatingMsg);
        chatDiv.scrollTop = chatDiv.scrollHeight;
    }
}

function hideLoading() {
    const btn = document.getElementById('sendAiPrompt');
    const generatingMsg = document.getElementById('aiGeneratingMessage');

    if (btn) {
        btn.innerHTML = '<i class="fas fa-paper-plane me-1"></i>';
        btn.disabled = false;
    }

    // Удаляем сообщение о генерации
    if (generatingMsg) {
        generatingMsg.remove();
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.admin = new ClimateCasesAdmin();

    // Инициализация Bootstrap модальных окон
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('hidden.bs.modal', () => {
            // Сброс состояния при закрытии модального окна
            if (modal.id === 'aiGenerateModal') {
                document.getElementById('aiPrompt').value = '';
                document.getElementById('saveDataBtn').disabled = true;
                document.getElementById('regenerateBtn').disabled = true;
                document.getElementById('showSqlPreview').checked = false;
                admin.togglePreviewMode(false);

                // Очищаем таблицу предпросмотра
                const tbody = document.querySelector('#previewTable tbody');
                if (tbody) {
                    while (tbody.rows.length > 1) {
                        tbody.deleteRow(1);
                    }
                }

                // Очищаем чат (оставляем только системное сообщение)
                const chat = document.getElementById('aiChatMessages');
                if (chat) {
                    const systemMessage = chat.querySelector('.system-message');
                    chat.innerHTML = '';
                    if (systemMessage) {
                        chat.appendChild(systemMessage);
                    }
                }

                admin.currentGeneratedData = null;
                admin.aiChatHistory = [];
            }
        });
    });
});
