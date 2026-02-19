<?php

use App\Http\Controllers\AdminClimateController;
use App\Http\Controllers\ClimateController;
use App\Http\Controllers\FileExportController;
use Illuminate\Support\Facades\Route;

// Главная — перенаправляет в зависимости от роли
Route::get('/', function () {
    if (auth()->check()) {
        if (auth()->user()->role === 'admin') {
            return redirect()->route('admin.climate');
        }
        return redirect()->route('climate.index');
    }
    return redirect('/login');
})->name('home');

// Маршруты для админ-панели (только для администраторов)
Route::middleware(['auth', 'admin'])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/climate', [AdminClimateController::class, 'index'])->name('climate');

    // CRUD для кейсов
    Route::get('/climate/cases', [AdminClimateController::class, 'getCases'])->name('cases.index');
    Route::get('/climate/cases/{id}', [AdminClimateController::class, 'getCase'])->name('cases.show');
    Route::post('/climate/cases', [AdminClimateController::class, 'store'])->name('cases.store');
    Route::put('/climate/cases/{id}', [AdminClimateController::class, 'update'])->name('cases.update');
    Route::delete('/climate/cases/{id}', [AdminClimateController::class, 'destroy'])->name('cases.destroy');
    Route::get('/climate/cases/search', [AdminClimateController::class, 'search'])->name('cases.search');

    // AI-генерация
    Route::post('/climate/generate-data', [AdminClimateController::class, 'generateData'])->name('generate.data');
    Route::post('/climate/save-generated-data', [AdminClimateController::class, 'saveGeneratedData'])->name('save.generated.data');

    // Для обратной совместимости
    Route::post('/climate/generate-sql', [AdminClimateController::class, 'generateData'])->name('generate.sql');
    Route::post('/climate/execute-sql', [AdminClimateController::class, 'executeSql'])->name('execute.sql');
});

// Маршруты для пользователей
Route::middleware(['auth', 'admin.redirect'])->group(function () {
    Route::get('/climate', [ClimateController::class, 'showInterface'])->name('climate.index');
    Route::post('/climate/ask', [ClimateController::class, 'askQuestion'])->name('climate.ask');
    Route::get('/climate/health', [ClimateController::class, 'checkHealth'])->name('climate.health');

    // Маршруты для работы с диалогами
    Route::post('/climate/conversation/new', [ClimateController::class, 'newConversation'])->name('conversation.new');
    Route::get('/climate/conversation/{id}', [ClimateController::class, 'getConversation'])->name('conversation.get');
    Route::get('/climate/conversations', [ClimateController::class, 'getConversations'])->name('conversations.get');
    Route::delete('/climate/conversation/{id}', [ClimateController::class, 'deleteConversation'])->name('conversation.delete');
    Route::post('/climate/approve-measure', [ClimateController::class, 'approveMeasure']);

    // Экспорт файлов
    Route::post('/export/docx', [FileExportController::class, 'generateDocx'])->name('export.docx');
    Route::post('/export/excel', [FileExportController::class, 'generateExcel'])->name('export.excel');
    Route::post('/export/check-tables', [FileExportController::class, 'checkForTables'])->name('export.check-tables');
});
// Экспорт файлов (прокси через Python)
Route::post('/climate/export/docx', [ClimateController::class, 'exportDocx'])->name('climate.export.docx');
Route::post('/climate/export/excel', [ClimateController::class, 'exportExcel'])->name('climate.export.excel');
// Маршруты аутентификации
require __DIR__.'/auth.php';
