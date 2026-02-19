<?php

namespace App\Http\Controllers;

use App\Models\ClimateCase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Validator;

class AdminClimateController extends Controller
{
    // Главная страница админки
    public function index()
    {
        $cases = ClimateCase::orderBy('created_at', 'desc')->paginate(20);
        return view('admin.climate', compact('cases'));
    }

    // Получить кейсы для AJAX
    public function getCases()
    {
        $cases = ClimateCase::orderBy('created_at', 'desc')->get();

        $stats = [
            'total' => ClimateCase::count(),
            'today' => ClimateCase::whereDate('created_at', today())->count(),
        ];

        return response()->json([
            'success' => true,
            'cases' => $cases,
            'stats' => $stats
        ]);
    }

    // Получить конкретный кейс
    public function getCase($id)
    {
        $case = ClimateCase::findOrFail($id);
        return response()->json(['success' => true, 'case' => $case]);
    }

    // Создать новый кейс
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'problem' => 'nullable|string|max:2000',
            'measure_name' => 'required|string|max:1000',
            'mitigation_effect' => 'nullable|string|max:1000',
            'adaptation_effect' => 'nullable|string|max:1000',
            'district_name' => 'nullable|string|max:255',
            'climate_conditions' => 'nullable|string|max:2000',
            'responsible_org' => 'nullable|string|max:500',
            'source_url' => 'nullable|url|max:500'
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        try {
            $case = ClimateCase::create($request->all());
            return response()->json(['success' => true, 'case' => $case]);
        } catch (\Exception $e) {
            Log::error('Ошибка создания кейса: ' . $e->getMessage());
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // Обновить кейс
    public function update(Request $request, $id)
    {
        $case = ClimateCase::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'problem' => 'nullable|string|max:2000',
            'measure_name' => 'sometimes|required|string|max:1000',
            'mitigation_effect' => 'nullable|string|max:1000',
            'adaptation_effect' => 'nullable|string|max:1000',
            'district_name' => 'nullable|string|max:255',
            'climate_conditions' => 'nullable|string|max:2000',
            'responsible_org' => 'nullable|string|max:500',
            'source_url' => 'nullable|url|max:500'
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        try {
            $case->update($request->all());
            return response()->json(['success' => true, 'case' => $case]);
        } catch (\Exception $e) {
            Log::error('Ошибка обновления кейса: ' . $e->getMessage());
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // Удалить кейс
    public function destroy($id)
    {
        try {
            $case = ClimateCase::findOrFail($id);
            $case->delete();
            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            Log::error('Ошибка удаления кейса: ' . $e->getMessage());
            return response()->json(['success' => false, 'error' => $e->getMessage()], 500);
        }
    }

    // Поиск кейсов
    public function search(Request $request)
    {
        $query = $request->get('query', '');

        $cases = ClimateCase::where('problem', 'like', "%{$query}%")
            ->orWhere('measure_name', 'like', "%{$query}%")
            ->orWhere('district_name', 'like', "%{$query}%")
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['success' => true, 'cases' => $cases]);
    }

    // AI-генерация структурированных данных (прокси к FastAPI)
    public function generateData(Request $request)
    {
        try {
            $response = Http::timeout(60)
                ->post('http://localhost:8001/generate-structured-data', [
                    'prompt' => $request->prompt
                ]);

            if ($response->successful()) {
                $data = $response->json();

                // Если AI вернул JSON с данными
                if (isset($data['success']) && $data['success'] && isset($data['data'])) {
                    return response()->json([
                        'success' => true,
                        'data' => $data['data'],
                        'message' => 'Данные успешно сгенерированы'
                    ]);
                }

                // Если AI вернул SQL (для обратной совместимости)
                if (isset($data['sql'])) {
                    return response()->json([
                        'success' => true,
                        'sql' => $data['sql'],
                        'message' => 'SQL запрос успешно сгенерирован',
                        'legacy_format' => true
                    ]);
                }

                return response()->json([
                    'success' => false,
                    'error' => 'Некорректный формат ответа от AI'
                ], 500);

            } else {
                Log::error('Ошибка FastAPI при генерации данных', [
                    'status' => $response->status(),
                    'body' => $response->body()
                ]);
                return response()->json([
                    'success' => false,
                    'error' => 'Ошибка сервера AI'
                ], 500);
            }
        } catch (\Exception $e) {
            Log::error('Исключение при генерации данных', [
                'message' => $e->getMessage()
            ]);
            return response()->json([
                'success' => false,
                'error' => 'Не удалось подключиться к AI сервису: ' . $e->getMessage()
            ], 500);
        }
    }

    // Сохранение сгенерированных данных через Eloquent (безопасно)
    public function saveGeneratedData(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'data' => 'required|array',
            'data.problem' => 'nullable|string|max:2000',
            'data.measure_name' => 'required|string|max:2000',
            'data.mitigation_effect' => 'nullable|string|max:1000',
            'data.adaptation_effect' => 'nullable|string|max:1000',
            'data.district_name' => 'nullable|string|max:255',
            'data.climate_conditions' => 'nullable|string|max:3000',
            'data.responsible_org' => 'nullable|string|max:500',
            'data.source_url' => 'nullable|url|max:500'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $caseData = $request->input('data');
            $case = ClimateCase::create($caseData);

            Log::info('Создан новый кейс через AI генерацию', [
                'id' => $case->id,
                'measure_name' => $case->measure_name,
                'district_name' => $case->district_name
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Кейс успешно сохранен в базу данных',
                'case_id' => $case->id,
                'case' => $case
            ]);

        } catch (\Exception $e) {
            Log::error('Ошибка сохранения сгенерированных данных', [
                'message' => $e->getMessage(),
                'data' => $request->input('data')
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Ошибка сохранения данных: ' . $e->getMessage()
            ], 500);
        }
    }

}
