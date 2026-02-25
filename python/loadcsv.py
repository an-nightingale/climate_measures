import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import os
from dotenv import load_dotenv

load_dotenv()


def load_csv_to_postgres(csv_path: str, table_name: str = "climate_cases"):
    """
    Загружает данные из CSV файла в PostgreSQL таблицу

    Поля CSV:
    Проблема, Наименование мероприятий, Митигационный эффект,
    Адаптационный эффект, Наименование района, Агроклиматические условия района,
    Ответственная организация, Источник
    """

    # Параметры подключения к БД
    DB_CONFIG = {
        "dbname": os.getenv("DB_DATABASE"),
        "user": os.getenv("DB_USERNAME"),
        "password": os.getenv("DB_PASSWORD"),
        "host": os.getenv("DB_HOST"),
        "port": os.getenv("DB_PORT")
    }

    try:
        # Чтение CSV
        df = pd.read_excel(csv_path)
        print(f"Прочитано {len(df)} строк из {csv_path}")

        # Подключение к БД
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Создание таблицы если не существует
        create_table_query = f"""
        CREATE TABLE IF NOT EXISTS {table_name} (
            id SERIAL PRIMARY KEY,
            problem TEXT NOT NULL,
            measure_name TEXT NOT NULL,
            mitigation_effect TEXT,
            adaptation_effect TEXT,
            district_name TEXT,
            climate_conditions TEXT,
            responsible_org TEXT,
            source_url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        cursor.execute(create_table_query)

        # Подготовка данных для вставки
        data_tuples = []
        for _, row in df.iterrows():
            data_tuples.append((
                str(row.get('Проблема', '')),
                str(row.get('Наименование мероприятий', '')),
                str(row.get('Митигационный эффект', '')),
                str(row.get('Адаптационный эффект', '')),
                str(row.get('Наименование района', '')),
                str(row.get('Агроклиматические условия района', '')),
                str(row.get('Ответственная организация', '')),
                str(row.get('Источник', ''))
            ))

        # Вставка данных
        insert_query = f"""
        INSERT INTO {table_name} 
        (problem, measure_name, mitigation_effect, adaptation_effect, 
         district_name, climate_conditions, responsible_org, source_url)
        VALUES %s
        ON CONFLICT DO NOTHING;
        """

        execute_values(cursor, insert_query, data_tuples)
        conn.commit()

        print(f"Успешно загружено {len(data_tuples)} записей в таблицу {table_name}")

        cursor.close()
        conn.close()

    except Exception as e:
        print(f"Ошибка загрузки данных: {e}")
        raise


if __name__ == "__main__":
    # Пример использования
    csv_path = "data/Адапт меро.xlsx"
    if os.path.exists(csv_path):
        load_csv_to_postgres(csv_path)
    else:
        print("Файл не найден")