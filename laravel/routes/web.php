<?php

use App\Http\Controllers\ClimateController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return redirect('/climate');
});

// Основные маршруты для климатической системы
Route::get('/climate', [ClimateController::class, 'showInterface'])->name('climate.index');
Route::post('/climate/ask', [ClimateController::class, 'askQuestion'])->name('climate.ask');
Route::get('/climate/health', [ClimateController::class, 'checkHealth'])->name('climate.health');
