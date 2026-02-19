<?php
$url = "https://meteoinfo.ru/pogoda/russia/tyumen-area/tjumen";
$outputFile = __DIR__ . "/tyumen_weather.csv";
$logFile = __DIR__ . "/parser.log";

function fetchHtml($url, $logFile) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36"
    ]);

    $html = curl_exec($ch);
    if ($html === false) {
        $err = curl_error($ch);
        file_put_contents($logFile, "[" . date("Y-m-d H:i:s") . "] cURL error: $err\n", FILE_APPEND);
    }
    curl_close($ch);

    return $html;
}
function parseLocalDateTime($input, $referenceYear = null) {
    // Удаляем всё в скобках и нормализуем пробелы
    $input = preg_replace('/\([^)]*\)/', '', $input); // удаляем (время местное) и подобное
    $input = preg_replace('/(&nbsp;|\xC2\xA0)/', ' ', $input); // заменяем неразрывные пробелы
    $input = preg_replace('/\s+/', ' ', $input);
    $input = trim($input);

    // Если строка пуста, возвращаем null
    if (empty($input)) {
        return null;
    }

    // Устанавливаем год: если передан $referenceYear — используем его, иначе текущий год
    $year = $referenceYear ?? date('Y');

    // Массив для сопоставления русских названий месяцев с номерами
    $months = [
        'января'  => 1,  'февраля' => 2,  'марта'   => 3,
        'апреля'  => 4,  'мая'     => 5,  'июня'    => 6,
        'июля'   => 7,  'августа'  => 8,  'сентября'=> 9,
        'октября' => 10, 'ноября'   => 11, 'декабря'  => 12
    ];

    // Разбиваем строку на части: дата и время
    $parts = explode(',', $input);
    if (count($parts) < 2) {
        return null; // Некорректный формат
    }

    $datePart = trim($parts[0]); // "1 декабря"
    $timePart = trim($parts[1]); // "08:00"

    // Извлекаем день и название месяца
    if (!preg_match('/^(\d+)\s+([а-я]+)$/ui', $datePart, $matches)) {
        return null; // Не удалось разобрать дату
    }

    $day   = (int)$matches[1];
    $monthName = strtolower($matches[2]);

    // Находим номер месяца
    if (!isset($months[$monthName])) {
        return null; // Неизвестный месяц
    }
    $month = $months[$monthName];

    // Проверяем корректность даты (день в пределах месяца)
    if (!checkdate($month, $day, $year)) {
        return null; // Некорректная дата
    }

    // Формируем итоговую дату в формате ГГГГ.ММ.ДД ЧЧ:ММ
    $formattedDate = sprintf(
        '%04d.%02d.%02d %s',
        $year,
        $month,
        $day,
        $timePart
    );

    return $formattedDate;
}


function normalizeFloat($value) {
    $value = str_replace(",", ".", trim($value)); // меняем , на .
    if ($value === "" || strtolower($value) === "нет") {
        return 0.0;
    }
    if ($value === "менее 0.1") {
        return 0.1;
    }
    return number_format((float)$value, 1, ".", "");
}

function normalizeInt($value) {
    $value = trim($value);
    return (int)$value;
}
function fetchWeather($url, $logFile) {
    $html = fetchHtml($url, $logFile);
    if (!$html) {
        return null;
    }

    // сохраним для отладки
    file_put_contents(__DIR__ . "/debug.html", $html);

    libxml_use_internal_errors(true);
    $dom = new DOMDocument();
    @$dom->loadHTML(mb_convert_encoding($html, 'HTML-ENTITIES', 'UTF-8'));
    libxml_clear_errors();
    $xpath = new DOMXPath($dom);

    // Найдём таблицу
    $table = $xpath->query("//table[contains(@style,'width:100%')][1]")->item(0);
    if (!$table) {
        file_put_contents($logFile, "[" . date("Y-m-d H:i:s") . "] Таблица не найдена\n", FILE_APPEND);
        return null;
    }

    $rows = $table->getElementsByTagName("tr");

    $data = [
        "Дата/время (местное)" => "",
        "Атм. давление, мм рт. ст." => "",
        "Температура, °C" => "",
        "Мин. температура, °C" => "",
        "Макс. температура, °C" => "",
        "Влажность, %" => "",
        "Явление погоды" => "",
        "Направление ветра" => "",
        "Скорость ветра, м/с" => "",
        "Облачность (баллы)" => "",
        "Видимость, км" => "",
        "Осадки за 12ч, мм" => "",
        "Снег, см" => ""
    ];

    foreach ($rows as $i => $tr) {
        $tds = $tr->getElementsByTagName("td");
        if ($tds->length == 1 || $tds->length == 2) {
            $label = trim($tds->item(0)->textContent);
            $value = $tds->length == 2 ? trim($tds->item(1)->textContent) : trim($tds->item(0)->textContent);

            if ($i == 0) {
                $data["Дата/время (местное)"] = $label;
            }
            elseif (strpos($label, "Атмосферное давление") !== false) $data["Атм. давление, мм рт. ст."] = normalizeInt($value);
            elseif (strpos($label, "Температура воздуха") !== false) $data["Температура, °C"] = normalizeFloat($value);
            elseif (strpos($label, "Минимальная температура") !== false) $data["Мин. температура, °C"] = normalizeFloat($value);
            elseif (strpos($label, "Максимальная температура") !== false) $data["Макс. температура, °C"] = normalizeFloat($value);
            elseif (strpos($label, "Относительная влажность") !== false) $data["Влажность, %"] = normalizeInt($value);
            elseif (strpos($label, "Направление ветра") !== false) $data["Направление ветра"] = $value;
            elseif (strpos($label, "Средняя скорость ветра") !== false) $data["Скорость ветра, м/с"] = normalizeInt($value);
            elseif (strpos($label, "Балл общей облачности") !== false) $data["Облачность (баллы)"] = normalizeInt($value);
            elseif (strpos($label, "Горизонтальная видимость") !== false) $data["Видимость, км"] = normalizeInt($value);
            elseif (strpos($label, "Осадки за 12 часов") !== false) $data["Осадки за 12ч, мм"] = normalizeFloat($value);
            elseif (strpos($label, "Высота снежного покрова") !== false) $data["Снег, см"] = normalizeFloat($value);

            elseif ($label !== "" && $tds->length == 1) {
                $data["Явление погоды"] = $label;
            }
        }
    }

    if (empty($data["Мин. температура, °C"])) {
        $data["Мин. температура, °C"] = $data["Температура, °C"];
    }
    if (empty($data["Макс. температура, °C"])) {
        $data["Макс. температура, °C"] = $data["Температура, °C"];
    }
    if (empty($data["Явление погоды"])) {
        $data["Явление погоды"] = "Нет";
    }
    if (empty($data["Осадки за 12ч, мм"])) {
        $data["Осадки за 12ч, мм"] = 0;
    }
    if (empty($data["Снег, см"])) {
        $data["Снег, см"] = 0;
    }

    // Обработка значений осадков
    if ($data["Осадки за 12ч, мм"] === "менее 0.1") {
        $data["Осадки за 12ч, мм"] = 0.1;
    }
    if (!empty($data["Осадки за 12ч, мм"]) && empty($data["Осадки за 24ч, мм"])) {
        $data["Осадки за 24ч, мм"] = $data["Осадки за 12ч, мм"];
    }
    $rawDateTime = $data["Дата/время (местное)"];
    $normalizedDateTime = parseLocalDateTime($rawDateTime, 2025); // <-- явно указываем год

    if ($normalizedDateTime) {
        $data["Дата/время (местное)"] = $normalizedDateTime;
    } else {
        // fallback: оставить как есть или установить null
        file_put_contents($logFile, "[" . date("Y-m-d H:i:s") . "] Не удалось распарсить дату: $rawDateTime\n", FILE_APPEND);
    }
    return $data;
}

$data = fetchWeather($url, $logFile);

if ($data) {
    $isNew = !file_exists($outputFile);

    $f = fopen($outputFile, "w");
    fputcsv($f, array_keys($data), ";");
    fputcsv($f, array_values($data), ";");
    fclose($f);

    file_put_contents($logFile, "[" . date("Y-m-d H:i:s") . "] Данные обновлены\n", FILE_APPEND);
    echo "OK\n";
} else {
    file_put_contents($logFile, "[" . date("Y-m-d H:i:s") . "] Ошибка: данные не получены\n", FILE_APPEND);
    echo "FAIL\n";
}
