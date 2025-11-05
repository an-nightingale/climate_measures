<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ClimateController extends Controller
{
    private $apiBaseUrl;

    public function __construct()
    {
        $this->apiBaseUrl = env('CLIMATE_API_URL', 'http://localhost:8001');
    }

    /**
     * Показать интерфейс системы
     */
    public function showInterface()
    {
        return view('climate');
    }

    /**
     * Обработать запрос пользователя
     */
    public function askQuestion(Request $request)
    {
        $request->validate([
            'question' => 'required|string|min:3|max:1000'
        ]);

        try {
            Log::info('Отправка запроса к Climate API', ['question' => $request->question]);

            $response = Http::timeout(120)
                ->retry(3, 1000)
                ->post($this->apiBaseUrl . '/ask', [
                    'question' => $request->question
                ]);

            if ($response->successful()) {
                $data = $response->json();
                Log::info('Успешный ответ от Climate API', [
                    'answer_length' => strlen($data['answer']),
                    'status' => $data['status']
                ]);

                return response()->json([
                    'success' => true,
                    'answer' => $data['answer'],
                    'status' => $data['status']
                ]);
            } else {
                Log::error('Ошибка API', [
                    'status' => $response->status(),
                    'body' => $response->body()
                ]);

                return response()->json([
                    'success' => false,
                    'error' => 'Сервис временно недоступен. Попробуйте позже.'
                ], 500);
            }

        } catch (\Exception $e) {
            Log::error('Исключение при обращении к Climate API', [
                'message' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Не удалось подключиться к сервису. Проверьте, запущен ли Python сервер.'
            ], 500);
        }
    }

    /**
     * Проверить статус сервиса
     */
    public function checkHealth()
    {
        try {
            $response = Http::timeout(10)->get($this->apiBaseUrl . '/health');

            return response()->json([
                'status' => $response->successful() ? 'healthy' : 'unhealthy',
                'api_status' => $response->status()
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'unhealthy',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
