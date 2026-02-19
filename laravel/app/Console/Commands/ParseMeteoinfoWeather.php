<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use App\Models\WeatherData;

class ParseMeteoinfoWeather extends Command
{
    protected $signature = 'weather:parse';
    protected $description = 'Парсит погоду с meteoinfo.ru по нескольким станциям Тюменской области';

    // Список станций: URL => Человекочитаемое название
    protected $stations = [
        'https://meteoinfo.ru/pogoda/russia/tyumen-area/tjumen' => 'Тюмень',
        'https://meteoinfo.ru/pogoda/russia/tyumen-area/abatskij' => 'Абатский район',
        'https://meteoinfo.ru/pogoda/russia/tyumen-area/vikulovo' => 'Викулово',
        'https://meteoinfo.ru/pogoda/russia/tyumen-area/golyshmanovo' => 'Голышманово',
        'https://meteoinfo.ru/pogoda/russia/tyumen-area/demjanskoe' => 'Демянское',
        'https://meteoinfo.ru/pogoda/russia/tyumen-area/isim' => 'Ишим',
        'https://meteoinfo.ru/pogoda/russia/tyumen-area/sladkovo' => 'Сладково',
        'https://meteoinfo.ru/pogoda/russia/tyumen-area/tobolsk' => 'Тобольск',
        'https://meteoinfo.ru/pogoda/russia/tyumen-area/jalturovosk' => 'Ялуторовск',
    ];

    public function handle()
    {
        $this->info("🌤️ Начало парсинга погоды по " . count($this->stations) . " станциям, время " . date("Y-m-d H:i:s"));

        foreach ($this->stations as $url => $region) {
            $this->parseStation(trim($url), $region);
        }

        $this->info("✅ Парсинг завершён");
        return 0;
    }

    private function parseStation(string $url, string $region)
    {
        $this->info("📡 Запрос для: $region ($url)");

        try {
            $response = Http::withOptions([
                'timeout' => 20,
                'follow_location' => true,
            ])->withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
            ])->get($url);

            if (!$response->successful()) {
                $this->error("❌ HTTP ошибка ($region): " . $response->status());
                return;
            }

            $html = $response->body();
        } catch (\Exception $e) {
            $this->error("❌ Ошибка сети ($region): " . $e->getMessage());
            return;
        }

        libxml_use_internal_errors(true);
        $dom = new \DOMDocument();
        @$dom->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'));
        libxml_clear_errors();
        $xpath = new \DOMXPath($dom);

        $table = $xpath->query("//table[contains(@style,'width:100%')][1]")->item(0);
        if (!$table) {
            $this->error("❌ Таблица не найдена ($region)");
            return;
        }

        $rows = $table->getElementsByTagName("tr");
        $rawData = [];

        foreach ($rows as $i => $tr) {
            $tds = $tr->getElementsByTagName("td");
            if ($tds->length < 1) continue;

            $label = trim($tds->item(0)->textContent);
            $value = $tds->length >= 2 ? trim($tds->item(1)->textContent) : '';

            if ($i == 0) {
                $rawData['datetime_raw'] = $label;
            } elseif (str_contains($label, 'Атмосферное давление')) {
                $rawData['pressure'] = $value;
            } elseif (str_contains($label, 'Температура воздуха')) {
                $rawData['temp'] = $value;
            } elseif (str_contains($label, 'Минимальная температура')) {
                $rawData['temp_min'] = $value;
            } elseif (str_contains($label, 'Максимальная температура')) {
                $rawData['temp_max'] = $value;
            } elseif (str_contains($label, 'Относительная влажность')) {
                $rawData['humidity'] = $value;
            } elseif (str_contains($label, 'Направление ветра')) {
                $rawData['wind_dir'] = $value;
            } elseif (str_contains($label, 'Средняя скорость ветра')) {
                $rawData['wind_speed'] = $value;
            } elseif (str_contains($label, 'Балл общей облачности')) {
                $rawData['clouds'] = $value;
            } elseif (str_contains($label, 'Горизонтальная видимость')) {
                $rawData['visibility'] = $value;
            } elseif (str_contains($label, 'Осадки за 12 часов')) {
                $rawData['precip_12h'] = $value;
            } elseif (str_contains($label, 'Высота снежного покрова')) {
                $rawData['snow'] = $value;
            } elseif ($tds->length == 1 && $i > 0 && !empty($label) && !is_numeric($label[0] ?? '')) {
                $rawData['weather'] = $label;
            }
        }

        $datetime = $this->parseLocalDateTime($rawData['datetime_raw'] ?? '', 2025);
        if (!$datetime) {
            $this->error("❌ Не удалось распарсить дату ($region): " . ($rawData['datetime_raw'] ?? 'пусто'));
            return;
        }

        $data = [
            'region' => $region,
            'datetime' => $datetime,
            'pressure' => $this->normalizeInt($rawData['pressure'] ?? null),
            'temp' => $this->normalizeFloat($rawData['temp'] ?? null),
            'temp_min' => $this->normalizeFloat($rawData['temp_min'] ?? null),
            'temp_max' => $this->normalizeFloat($rawData['temp_max'] ?? null),
            'humidity' => $this->normalizeInt($rawData['humidity'] ?? null),
            'weather' => $rawData['weather'] ?? 'Нет',
            'wind_dir' => $rawData['wind_dir'] ?? null,
            'wind_speed' => $this->normalizeInt($rawData['wind_speed'] ?? null),
            'clouds' => $this->normalizeInt($rawData['clouds'] ?? null),
            'visibility' => $this->normalizeInt($rawData['visibility'] ?? null),
            'precip_12h' => $this->normalizeFloat($rawData['precip_12h'] ?? null),
            'snow' => $this->normalizeFloat($rawData['snow'] ?? null),
        ];

        // Заполняем min/max и осадки
        if (is_null($data['temp_min'])) $data['temp_min'] = $data['temp'];
        if (is_null($data['temp_max'])) $data['temp_max'] = $data['temp'];
        if (is_null($data['precip_12h'])) $data['precip_12h'] = 0.0;
        if (is_null($data['snow'])) $data['snow'] = 0.0;

        // Проверка дубликата
        if (WeatherData::where('region', $region)->where('datetime', $datetime)->exists()) {
            $this->info("ℹ️  Пропущено ($region): данные за $datetime уже есть");
            return;
        }

        // Сохраняем
        WeatherData::create($data);

        $this->info("✅ Сохранено ($region): $datetime | {$data['temp']}°C | {$data['weather']}");
    }

    private function normalizeFloat($value)
    {
        if (is_null($value) || $value === '') return null;
        $value = str_replace(',', '.', trim($value));
        if (strtolower($value) === 'нет') return 0.0;
        if ($value === 'менее 0.1') return 0.1;
        if (!is_numeric($value)) return null;
        return number_format((float)$value, 1, '.', '');
    }

    private function normalizeInt($value)
    {
        if (is_null($value) || $value === '') return null;
        $value = trim($value);
        return is_numeric($value) ? (int)$value : null;
    }

    private function parseLocalDateTime($input, $referenceYear = null)
    {
        if (empty($input)) return null;

        $input = preg_replace('/\([^)]*\)/', '', $input);
        $input = preg_replace('/(&nbsp;|\xC2\xA0)/', ' ', $input);
        $input = preg_replace('/\s+/', ' ', $input);
        $input = trim($input);

        $year = $referenceYear ?? date('Y');
        $months = [
            'января' => 1, 'февраля' => 2, 'марта' => 3, 'апреля' => 4, 'мая' => 5, 'июня' => 6,
            'июля' => 7, 'августа' => 8, 'сентября' => 9, 'октября' => 10, 'ноября' => 11, 'декабря' => 12
        ];

        $parts = explode(',', $input);
        if (count($parts) < 2) return null;

        $datePart = trim($parts[0]);
        $timePart = trim($parts[1]);

        if (!preg_match('/^(\d+)\s+([а-я]+)$/ui', $datePart, $matches)) return null;

        $day = (int)$matches[1];
        $monthName = strtolower($matches[2]);

        if (!isset($months[$monthName])) return null;
        $month = $months[$monthName];

        if (!checkdate($month, $day, $year)) return null;

        return "$year-$month-$day $timePart:00";
    }
}
