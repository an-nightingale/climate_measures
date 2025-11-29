<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Support\Str;

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
        // Получаем последние диалоги пользователя
        $conversations = auth()->user()->conversations()
            ->orderBy('last_interaction_at', 'desc')
            ->take(10)
            ->get();

        return view('climate', compact('conversations'));
    }

    /**
     * Начать новый диалог
     */
    public function newConversation()
    {
        $conversation = Conversation::create([
            'user_id' => auth()->id(),
            'title' => 'Новый диалог',
            'last_interaction_at' => now()
        ]);

        return response()->json([
            'success' => true,
            'conversation_id' => $conversation->id
        ]);
    }

    /**
     * Получить историю диалога
     */
    public function getConversation($id)
    {
        $conversation = Conversation::where('user_id', auth()->id())
            ->with('messages')
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'conversation' => $conversation
        ]);
    }

    /**
     * Обработать запрос пользователя с сохранением пары
     */
    /**
     * Обработать запрос пользователя с сохранением в БД и контекстом
     */
    public function askQuestion(Request $request)
    {
        $request->validate([
            'question' => 'required|string|min:3|max:1000',
            'conversation_id' => 'nullable|exists:conversations,id,user_id,' . auth()->id()
        ]);

        try {
            // Создаем новый диалог, если не указан
            if (!$request->conversation_id) {
                $conversation = Conversation::create([
                    'user_id' => auth()->id(),
                    'title' => Str::limit($request->question, 50),
                    'last_interaction_at' => now()
                ]);
                $conversation_id = $conversation->id;
            } else {
                $conversation = Conversation::findOrFail($request->conversation_id);
                $conversation_id = $conversation->id;

                if (!$conversation->title || $conversation->title === 'Новый диалог') {
                    $conversation->title = Str::limit($request->question, 50);
                    $conversation->save();
                }
            }

            // Получаем последние 3 пары для контекста
            $context_pairs = Message::where('conversation_id', $conversation_id)
                ->orderBy('interaction_time', 'desc')
                ->take(3)
                ->get()
                ->reverse(); // Хронологический порядок

            $context = '';
            foreach ($context_pairs as $pair) {
                $context .= "Пользователь: {$pair->question}\n";
                $context .= "Ассистент: {$pair->answer}\n\n";
            }

            Log::info('Отправка запроса к Climate API', [
                'question' => $request->question,
                'conversation_id' => $conversation_id,
                'context_length' => strlen($context)
            ]);

            $response = Http::timeout(120)
                ->retry(3, 1000)
                ->post($this->apiBaseUrl . '/ask', [
                    'question' => $request->question,
                    'conversation_id' => $conversation_id,
                    'context' => $context // Передаем контекст
                ]);

            if ($response->successful()) {
                $data = $response->json();
                Log::info('Успешный ответ от Climate API', [
                    'answer_length' => strlen($data['answer'] ?? ''),
                    'status' => $data['status'] ?? 'unknown'
                ]);

                // Сохраняем пару вопрос-ответ
                Message::create([
                    'conversation_id' => $conversation_id,
                    'question' => $request->question,
                    'answer' => $data['answer'] ?? 'Ошибка генерации ответа',
                    'interaction_time' => now()
                ]);

                // Обновляем время последнего взаимодействия
                $conversation->updateLastInteractionTime();

                return response()->json([
                    'success' => true,
                    'answer' => $data['answer'] ?? 'Ошибка генерации ответа',
                    'status' => $data['status'] ?? 'success',
                    'conversation_id' => $conversation_id
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
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
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

    /**
     * Получить список диалогов пользователя
     */
    public function getConversations()
    {
        $conversations = auth()->user()->conversations()
            ->orderBy('last_interaction_at', 'desc')
            ->get()
            ->map(function ($conversation) {
                // Берем последнюю пару для отображения в списке
                $lastPair = $conversation->messages()->orderBy('interaction_time', 'desc')->first();

                return [
                    'id' => $conversation->id,
                    'title' => $conversation->title ?? ($lastPair ? Str::limit($lastPair->question, 50) : 'Без названия'),
                    'last_interaction_at' => $conversation->last_interaction_at->format('d.m.Y H:i'),
                    'pair_count' => $conversation->messages()->count(),
                    'last_question' => $lastPair ? Str::limit($lastPair->question, 70) : null,
                    'last_answer_preview' => $lastPair ? Str::limit(strip_tags($lastPair->answer), 100) : null
                ];
            });

        return response()->json([
            'success' => true,
            'conversations' => $conversations
        ]);
    }

    /**
     * Удалить диалог
     */
    public function deleteConversation($id)
    {
        $conversation = Conversation::where('user_id', auth()->id())->findOrFail($id);
        $conversation->delete();

        return response()->json(['success' => true]);
    }
}
