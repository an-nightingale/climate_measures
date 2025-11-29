<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\Style\Table as TableStyle;
use PhpOffice\PhpWord\Style\Cell as CellStyle;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\TableExport;
use Illuminate\Support\Str;
use Exception;

class FileExportController extends Controller
{
    /**
     * Извлекает таблицы из Markdown текста
     */
    private function extractTablesFromMarkdown(string $markdown): array
    {
        $tables = [];
        $lines = explode("\n", $markdown);
        $currentTable = [];
        $inTable = false;
        $headerRow = null;
        $separatorRow = null;

        foreach ($lines as $line) {
            $line = trim($line);

            if (str_starts_with($line, '|') && str_ends_with($line, '|')) {
                $cells = array_map('trim', explode('|', substr($line, 1, -1)));
                $cells = array_filter($cells, fn($cell) => $cell !== '');
                $cells = array_values($cells);

                if (count($cells) > 1) {
                    if (!$inTable) {
                        $inTable = true;
                        $headerRow = $cells;
                    } elseif (!$separatorRow && str_contains($line, '---')) {
                        $separatorRow = $line;
                    } else {
                        if ($separatorRow) {
                            $currentTable[] = $cells;
                        }
                    }
                }
            } else {
                if ($inTable && $separatorRow && !empty($currentTable)) {
                    $tables[] = [
                        'headers' => $headerRow,
                        'rows' => $currentTable
                    ];
                    $currentTable = [];
                    $headerRow = null;
                    $separatorRow = null;
                }
                $inTable = false;
            }
        }

        // Добавляем последнюю таблицу, если она есть
        if ($inTable && $separatorRow && !empty($currentTable)) {
            $tables[] = [
                'headers' => $headerRow,
                'rows' => $currentTable
            ];
        }

        return $tables;
    }

    /**
     * Генерирует DOCX файл с таблицами
     */
    public function generateDocx(Request $request)
    {
        $request->validate([
            'content' => 'required|string',
            'filename' => 'nullable|string'
        ]);

        try {
            $tables = $this->extractTablesFromMarkdown($request->content);

            if (empty($tables)) {
                return response()->json([
                    'success' => false,
                    'error' => 'В тексте не найдено таблиц для экспорта'
                ], 400);
            }

            $phpWord = new PhpWord();
            $section = $phpWord->addSection();

            // Заголовок документа
            $section->addTitle('Таблицы из диалога', 1);
            $section->addText("Создано: " . now()->format('d.m.Y H:i:s'), ['size' => 10, 'color' => '666666']);
            $section->addTextBreak(2);

            foreach ($tables as $index => $tableData) {
                $section->addTitle("Таблица #" . ($index + 1), 2);

                // Создаем таблицу
                $table = $section->addTable([
                    'borderSize' => 6,
                    'borderColor' => '000000',
                    'cellMargin' => 50,
                    'alignment' => \PhpOffice\PhpWord\SimpleType\JcTable::CENTER
                ]);

                // Заголовки
                $table->addRow();
                foreach ($tableData['headers'] as $header) {
                    $cell = $table->addCell(2000, [
                        'bgColor' => 'DDEBF7',
                        'borderSize' => 6,
                        'borderColor' => '000000',
                        'valign' => 'center'
                    ]);
                    $cell->addText(htmlspecialchars($header), [
                        'bold' => true,
                        'size' => 11,
                        'color' => '002060'
                    ], ['align' => 'center']);
                }

                // Строки данных
                foreach ($tableData['rows'] as $row) {
                    $table->addRow();
                    foreach ($row as $cellContent) {
                        $table->addCell(2000, [
                            'borderSize' => 3,
                            'borderColor' => '000000',
                            'valign' => 'top'
                        ])->addText(htmlspecialchars($cellContent), [
                            'size' => 10
                        ], ['align' => 'left']);
                    }
                }

                $section->addTextBreak(2);
            }

            // Добавляем исходный текст
            $section->addPageBreak();
            $section->addTitle('Исходный текст', 2);
            $section->addText($request->content, ['size' => 10]);

            // Генерируем файл
            $filename = $request->filename ?: 'tables_' . now()->format('Y-m-d_H-i-s') . '.docx';
            $tempFile = tempnam(sys_get_temp_dir(), 'phpword_');

            $objWriter = IOFactory::createWriter($phpWord, 'Word2007');
            $objWriter->save($tempFile);

            return response()->download($tempFile, $filename)->deleteFileAfterSend(true);

        } catch (Exception $e) {
            \Log::error('Ошибка генерации DOCX файла: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Ошибка при генерации файла: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Генерирует Excel файл с таблицами
     */
    public function generateExcel(Request $request)
    {
        $request->validate([
            'content' => 'required|string',
            'filename' => 'nullable|string'
        ]);

        try {
            $tables = $this->extractTablesFromMarkdown($request->content);

            if (empty($tables)) {
                return response()->json([
                    'success' => false,
                    'error' => 'В тексте не найдено таблиц для экспорта'
                ], 400);
            }

            $filename = $request->filename ?: 'tables_' . now()->format('Y-m-d_H-i-s') . '.xlsx';

            return Excel::download(new TableExport($tables), $filename);

        } catch (Exception $e) {
            \Log::error('Ошибка генерации Excel файла: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'error' => 'Ошибка при генерации файла: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Проверяет наличие таблиц в тексте
     */
    public function checkForTables(Request $request)
    {
        $request->validate([
            'content' => 'required|string'
        ]);

        $tables = $this->extractTablesFromMarkdown($request->content);

        return response()->json([
            'has_tables' => !empty($tables),
            'table_count' => count($tables),
            'tables' => $tables
        ]);
    }
}
