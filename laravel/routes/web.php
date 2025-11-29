<?php

use App\Http\Controllers\ClimateController;
use App\Http\Controllers\FileExportController;
use Illuminate\Support\Facades\Route;

// Защита всех маршрутов климатической системы middleware auth
Route::middleware(['auth'])->group(function () {
    Route::get('/climate', [ClimateController::class, 'showInterface'])->name('climate.index');
    Route::post('/climate/ask', [ClimateController::class, 'askQuestion'])->name('climate.ask');
    Route::get('/climate/health', [ClimateController::class, 'checkHealth'])->name('climate.health');

    // Маршруты для работы с диалогами
    Route::post('/climate/conversation/new', [ClimateController::class, 'newConversation'])->name('conversation.new');
    Route::get('/climate/conversation/{id}', [ClimateController::class, 'getConversation'])->name('conversation.get');
    Route::get('/climate/conversations', [ClimateController::class, 'getConversations'])->name('conversations.get');
    Route::delete('/climate/conversation/{id}', [ClimateController::class, 'deleteConversation'])->name('conversation.delete');

// Экспорт файлов
    Route::post('/export/docx', [FileExportController::class, 'generateDocx'])->name('export.docx');
    Route::post('/export/excel', [FileExportController::class, 'generateExcel'])->name('export.excel');
    Route::post('/export/check-tables', [FileExportController::class, 'checkForTables'])->name('export.check-tables');
});

// Главная — перенаправляет на /climate, но только если авторизован
Route::get('/', function () {
    return redirect('/climate');
});

// Маршруты аутентификации от Breeze (они уже включают /login, /logout и т.д.)
require __DIR__.'/auth.php';
