# create_vector_db.py
import pandas as pd
from llama_index.core import Document, VectorStoreIndex, StorageContext
from llama_index.vector_stores.postgres import PGVectorStore
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.core import Settings
from llama_index.core.node_parser import SentenceSplitter
import os


def read_excel_as_documents(file_path: str):
    df = pd.read_excel(file_path)
    docs = []
    for i, row in df.iterrows():
        text = "\n".join([f"{col}: {row[col]}" for col in df.columns if pd.notna(row[col])])
        docs.append(Document(
            text=text,
            metadata={
                "source": os.path.basename(file_path),
                "row_index": i,
                "file_type": "excel"
            }
        ))
    return docs


def process_excel_files(data_path: str):
    all_docs = []

    for file_name in os.listdir(data_path):
        if file_name.endswith(('.xlsx', '.xls')):
            file_path = os.path.join(data_path, file_name)
            print(f"Обработка Excel файла: {file_name}")

            try:
                excel_docs = read_excel_as_documents(file_path)
                all_docs.extend(excel_docs)
                print(f"  - Получено {len(excel_docs)} документов из строк")
            except Exception as e:
                print(f"  - Ошибка обработки {file_name}: {e}")

    return all_docs


def create_vector_index(data_path: str = "./data"):
    embed_model = HuggingFaceEmbedding(model_name='intfloat/multilingual-e5-large-instruct')
    Settings.embed_model = embed_model
    vector_store = PGVectorStore.from_params(
        database="climate",
        host="127.0.0.1",
        password="password",
        port=5433,
        user="postgres",
        table_name="climate_embeddings",
        embed_dim=1024,
        hnsw_kwargs={
            "hnsw_m": 16,
            "hnsw_ef_construction": 64,
            "hnsw_ef_search": 40,
            "hnsw_dist_method": "vector_cosine_ops",
        },
    )
    all_nodes = []
    excel_docs = process_excel_files(data_path)
    all_nodes.extend(excel_docs)
    if not all_nodes:
        print("Ошибка: не найдено документов для обработки")
        return None
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    index = VectorStoreIndex(
        nodes=all_nodes,
        storage_context=storage_context,
        show_progress=True
    )

    print("Векторный индекс успешно создан в PostgreSQL")

    # Статистика
    excel_count = len([n for n in all_nodes if n.metadata.get('file_type') == 'excel'])
    print(f"Статистика:")
    print(f"  - Строк из Excel файлов: {excel_count}")

    return index


if __name__ == "__main__":
    index = create_vector_index("./data")

    if index:
        # Тестовый запрос для проверки
        query_engine = index.as_query_engine()
        test_response = query_engine.query("Какие мероприятия по адаптации существуют?")
        print("\nТестовый запрос выполнен успешно!")
    else:
        print("Создание индекса завершилось с ошибкой")
