<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;
use Maatwebsite\Excel\Concerns\WithTitle;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class TableExport implements WithMultipleSheets
{
    protected $tables;

    public function __construct(array $tables)
    {
        $this->tables = $tables;
    }

    public function sheets(): array
    {
        $sheets = [];

        foreach ($this->tables as $index => $tableData) {
            $sheets[] = new TableSheet($tableData, $index + 1);
        }

        return $sheets;
    }
}

class TableSheet implements FromCollection, WithTitle, WithHeadings, WithStyles
{
    protected $tableData;
    protected $sheetNumber;

    public function __construct(array $tableData, int $sheetNumber)
    {
        $this->tableData = $tableData;
        $this->sheetNumber = $sheetNumber;
    }

    public function collection()
    {
        return collect($this->tableData['rows']);
    }

    public function headings(): array
    {
        return $this->tableData['headers'];
    }

    public function title(): string
    {
        return 'Таблица_' . $this->sheetNumber;
    }

    public function styles(Worksheet $sheet)
    {
        // Стили для заголовков
        $sheet->getStyle('A1:' . $sheet->getHighestColumn() . '1')->applyFromArray([
            'font' => [
                'bold' => true,
                'color' => ['argb' => 'FFFFFFFF'],
                'size' => 11,
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'color' => ['argb' => 'FF4F81BD'],
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
                'wrapText' => true,
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['argb' => 'FF000000'],
                ],
            ],
        ]);

        // Стили для всех ячеек
        $sheet->getStyle('A1:' . $sheet->getHighestColumn() . $sheet->getHighestRow())->applyFromArray([
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['argb' => 'FF000000'],
                ],
            ],
            'alignment' => [
                'wrapText' => true,
            ],
        ]);

        // Автоширина столбцов
        foreach (range('A', $sheet->getHighestColumn()) as $column) {
            $sheet->getColumnDimension($column)->setAutoSize(true);
        }

        return [];
    }
}
