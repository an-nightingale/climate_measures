@extends('layouts.app2')

@section('title', 'Админ-панель: Управление кейсами')

@section('content')
    <div class="container-fluid">
        <div class="row">
            <!-- Боковая панель -->
            <div class="col-md-3 col-lg-2 sidebar-admin px-3 py-4">
                <h4 class="mb-4">Управление кейсами</h4>

                <div class="mb-3">
                    <button class="btn btn-primary w-100 mb-2" data-bs-toggle="modal" data-bs-target="#addCaseModal">
                        <i class="fas fa-plus me-2"></i>Добавить кейс
                    </button>
                    <button class="btn btn-outline-secondary w-100" data-bs-toggle="modal" data-bs-target="#aiGenerateModal">
                        <i class="fas fa-robot me-2"></i>AI генерация
                    </button>
                </div>

                <div class="stats-container">
                    <h6>Статистика:</h6>
                    <div class="d-flex justify-content-between mb-2">
                        <span>Всего кейсов:</span>
                        <span id="totalCases" class="badge bg-primary">0</span>
                    </div>
                </div>
            </div>

            <!-- Основной контент -->
            <div class="col-md-9 col-lg-10 main-content p-4">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2>База знаний климатических кейсов</h2>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-info" id="refreshCases">
                            Обновить<i class="fas fa-sync-alt ms-1"></i>
                        </button>
                        <div class="dropdown">
                            <a style="color: black;" href="#" class="d-flex align-items-center dropdown-toggle"
                               id="userProfileDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                                <img class="header_img" src="{{ asset('icons/account.png') }}" alt="Личный кабинет" />
                            </a>
                            <ul class="dropdown-menu dropdown-menu-end shadow-sm" aria-labelledby="userProfileDropdown">
                                <li class="px-3 py-2">
                                    <span class="text-muted small">Здравствуйте,</span>
                                    <div class="fw-bold text-dark">{{ auth()->user()->name ?? 'Пользователь' }}</div>
                                </li>
                                <li><hr class="dropdown-divider m-0"></li>
                                <li>
                                    <form id="logout-form" action="{{ route('logout') }}" method="POST" class="d-none">
                                        @csrf
                                    </form>
                                    <a href="#"
                                       onclick="event.preventDefault(); document.getElementById('logout-form').submit();"
                                       class="dropdown-item text-danger fw-medium">
                                        <i class="fas fa-sign-out-alt me-2"></i>Выйти
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- Таблица кейсов -->
                <div class="table-responsive" style="max-height: 600px; overflow-y: auto;">
                    <table class="table table-hover table-striped">
                        <thead style="position: sticky; top: 0; background: white; z-index: 1;">
                        <tr>
                            <th>ID</th>
                            <th>Проблема</th>
                            <th>Мероприятия</th>
                            <th>Район</th>
                            <th>Организация</th>
                            <th>Создан</th>
                            <th>Действия</th>
                        </tr>
                        </thead>
                        <tbody id="casesTableBody">
                        <!-- Данные будут загружены через AJAX -->
                        </tbody>
                    </table>
                </div>

                <!-- Пагинация -->
                <nav id="paginationContainer" class="mt-3">
                    <!-- Пагинация будет загружена через AJAX -->
                </nav>
            </div>
        </div>
    </div>

    <!-- Модальное окно добавления кейса -->
    <div class="modal fade" id="addCaseModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Добавить новый кейс</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <form id="addCaseForm">
                        <div class="mb-3">
                            <label class="form-label">Проблема *</label>
                            <textarea name="problem" class="form-control" rows="2" required></textarea>
                        </div>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Наименование мероприятий *</label>
                                <input type="text" name="measure_name" class="form-control" required>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Наименование района</label>
                                <input type="text" name="district_name" class="form-control">
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Митигационный эффект</label>
                                <textarea name="mitigation_effect" class="form-control" rows="2"></textarea>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Адаптационный эффект</label>
                                <textarea name="adaptation_effect" class="form-control" rows="2"></textarea>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Агроклиматические условия района</label>
                            <textarea name="climate_conditions" class="form-control" rows="3"></textarea>
                        </div>
                        <div class="row">
                            <div class="col-md-8 mb-3">
                                <label class="form-label">Ответственная организация</label>
                                <input type="text" name="responsible_org" class="form-control">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label">Источник (URL)</label>
                                <input type="url" name="source_url" class="form-control">
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Отмена</button>
                    <button type="button" class="btn btn-primary" id="saveCaseBtn">Сохранить</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Модальное окно AI-генерации -->
    <div class="modal fade" id="aiGenerateModal" tabindex="-1">
        <div class="modal-dialog modal-xl">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Генерация кейса</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="row">
                        <!-- Левая часть: Чат с LLM -->
                        <div class="col-md-6">
                            <div class="card h-100">
                                <div class="card-header bg-light">
                                    <h6 class="mb-0">Генерация кейса для базы знаний</h6>
                                </div>
                                <div class="card-body">
                                    <div id="aiChatMessages" class="chat-messages-sm mb-3" style="max-height: 300px; overflow-y: auto;">
                                        <div class="message system-message p-2 mb-2 bg-light rounded">
                                            <strong>Система:</strong> Опишите климатический кейс в свободной форме.
                                            Система структурирует его по формату базы данных.
                                        </div>
                                    </div>
                                    <div class="input-group">
                                        <textarea id="aiPrompt" class="form-control"
                                                  placeholder="Пример: городской остров тепла, нехватка воды и высокое энергопотребление в Брно..."
                                                  rows="3"></textarea>
                                        <button class="btn btn-primary" id="sendAiPrompt">>
                                            >
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Правая часть: Предпросмотр данных -->
                        <div class="col-md-6">
                            <div class="card h-100">
                                <div class="card-header bg-light d-flex justify-content-between align-items-center">
                                    <h6 class="mb-0">Предпросмотр данных</h6>

                                </div>
                                <div class="card-body">
                                    <!-- Таблица предпросмотра (по умолчанию) -->
                                    <div id="dataPreview">
                                        <table class="table table-sm table-bordered" id="previewTable">
                                            <tbody>
                                            <tr>
                                                <th style="width: 40%;">Поле</th>
                                                <th>Значение</th>
                                            </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <!-- SQL предпросмотр (скрыт по умолчанию) -->
                                    <div id="sqlPreview" style="display: none;">
                                        <pre class="bg-dark text-light p-3 rounded" id="sqlCode" style="max-height: 300px; overflow-y: auto;">
-- SQL запрос появится здесь после генерации
                                        </pre>
                                    </div>

                                    <div id="sqlResult" class="d-none">
                                        <div class="alert alert-success">
                                            <i class="fas fa-check-circle me-2"></i>
                                            <span id="resultMessage"></span>
                                        </div>
                                    </div>

                                    <div class="d-grid gap-2 mt-3">
                                        <button class="btn btn-success" id="saveDataBtn" disabled>
                                            <i class="fas fa-save me-2"></i>Сохранить в базу
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- JavaScript для админки -->
    <script src="{{ asset('js/admin-climate.js') }}"></script>
@endsection
