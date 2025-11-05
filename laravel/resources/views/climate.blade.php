@extends('layouts.app')

@section('title', 'Система адаптации к климатическим рискам')

@section('content')
    <div class="container-fluid h-100">
        <div class="row h-100">
            <!-- Боковая панель -->
            <aside class="sidebar col-md-3 col-lg-2 px-4 py-5">
                <div class="d-flex flex-column justify-content-between h-100">
                    <div>
                        <div class="d-flex flex-row justify-content-between align-items-center mb-4">
                            <img class="aside_img" src="{{ asset('icons/arrow.png') }}" alt="Скрыть" />

                            <div>
                                <img class="aside_img" src="{{ asset('icons/bin.png') }}" alt="Корзина" />
                                <img class="aside_img ms-2" src="{{ asset('icons/chat.png') }}" alt="Новый чат" />
                            </div>
                        </div>

                        <div class="position-relative d-flex align-items-center mb-3">
                            <input type="search" class="search w-100 py-0 px-2" placeholder="Поиск в истории..." />
                            <img
                                src="{{ asset('icons/search.png') }}"
                                class="search_icon position-absolute"
                                alt="Поиск" />
                        </div>

                        <div class="scroll_container">
                            <h2 class="scroll_header mt-2 mb-0 me-0 ms-0">Сегодня</h2>
                            <div class="fade_text w-100 position-relative">
                                <p class="m-0">Меры адаптации к наводнениям</p>
                            </div>

                            <h2 class="scroll_header mt-3 mb-0 me-0 ms-0">Вчера</h2>
                            <div class="fade_text w-100 position-relative">
                                <p class="m-0">Климатические риски для сельского хозяйства</p>
                            </div>

                            <h2 class="scroll_header mt-3 mb-0 me-0 ms-0">17 сентября</h2>
                            <div class="fade_text w-100 position-relative">
                                <p class="m-0">План мероприятий для предотвращения пожаров</p>
                            </div>
                        </div>
                    </div>

                    <!-- Индикатор статуса сервиса -->
                    <div class="mb-3">
                        <div class="status-indicator text-center p-2 rounded">
                            <small id="statusIndicator" class="text-muted">
                                <i class="fas fa-circle me-1"></i>Проверка статуса...
                            </small>
                        </div>
                    </div>

                    <div class="input_button px-5 py-2 d-flex justify-content-center align-items-center gap-4">
                        <img class="input_img" src="{{ asset('icons/question.png') }}">
                        <input class="p-0 m-0" type="button" name="help" value="Помощь" />
                    </div>
                </div>
            </aside>

            <!-- Основной контент -->
            <main class="main col-md-9 col-lg-10 p-4 position-relative">
                <header class="d-flex justify-content-between align-items-center mb-4">
                    <a href="#">
                        <img class="logo" src="{{ asset('icons/logo.png') }}" alt="Лого" />
                    </a>
                    <div class="d-flex justify-content-center align-items-center gap-3">
                        <img class="header_img" src="{{ asset('icons/menu.png') }}" alt="Меню" />
                        <img class="header_img" src="{{ asset('icons/account.png') }}" alt="Личный кабинет" />
                    </div>
                </header>

                <!-- Область чата -->
                <div class="chat-container h-100">
                    <div id="chatMessages" class="chat-messages mb-4">
                        <!-- Сообщения будут добавляться здесь динамически -->
                        <div class="welcome-message text-center mb-4">
                            <h2 class="welcome_header mb-3">Информационная система для рекомендации адаптационных мероприятий к изменениям климата</h2>
                            <p class="welcome_text">Введите в поле запроса описание климатического риска, с которым вы столкнулись.<br>Примеры корректных формулировок:<br>
                                «Частые подтопления реки Тура в Тобольском районе весной»<br>
                                «Учащение засух в южных районах Ишимского района»<br>
                            </p>
                        </div>
                    </div>

                    <!-- Индикатор загрузки -->
                    <div id="loading" class="text-center py-4 d-none">
                        <div class="d-flex flex-column align-items-center">
                            <div class="spinner-border text-primary mb-2" role="status">
                                <span class="visually-hidden">Загрузка...</span>
                            </div>
                            <p class="text-muted mb-1">Обрабатываем запрос...</p>
                            <small class="text-muted">Это может занять время</small>
                        </div>
                    </div>

                    <!-- Область ввода -->
                    <div class="chat-input-container position-relative">
                        <div class="position-relative">
                        <textarea
                            id="question"
                            name="question"
                            class="form-control prompt-field"
                            placeholder="Введите ваш запрос о климатических рисках..."
                            rows="3"
                        ></textarea>

                            <div class="prompt_buttons position-absolute">
                                <button
                                    id="submitBtn"
                                    type="button"
                                    class="btn p-0 m-0"
                                    title="Отправить"
                                    disabled
                                >
                                    <img src="{{ asset('icons/submit.png') }}" alt="Отправить" />
                                </button>
                            </div>
                        </div>

                    </div>

                    <!-- Ошибка -->
                    <div id="error" class="alert alert-danger mt-3 d-none">
                        <div class="d-flex align-items-start">
                            <i class="fas fa-exclamation-triangle me-3 mt-1"></i>
                            <div class="flex-grow-1">
                                <h6 class="alert-heading mb-2">Произошла ошибка</h6>
                                <p id="errorMessage" class="mb-2"></p>
                                <button onclick="retryLastRequest()" class="btn btn-sm btn-outline-danger">
                                    <i class="fas fa-redo me-1"></i>Попробовать снова
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    </div>

    <!-- Подключаем библиотеки -->
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <script src="{{ asset('js/climate.js') }}"></script>
@endsection
