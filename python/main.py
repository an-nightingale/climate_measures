from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from llama_index.llms.openrouter import OpenRouter
from llama_index.core.llms import ChatMessage
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.core import Settings, StorageContext, load_index_from_storage
from llama_index.core.agent.workflow import FunctionAgent
from fastapi.middleware.cors import CORSMiddleware
import nest_asyncio
from dotenv import load_dotenv
import os

load_dotenv()
nest_asyncio.apply()

embed_model = HuggingFaceEmbedding(model_name='intfloat/multilingual-e5-large-instruct')
Settings.embed_model = embed_model
Settings.llm = OpenRouter(
    api_key=os.getenv("OPENROUTER_API_KEY"),
    model="deepseek/deepseek-r1-0528-qwen3-8b:free",

    max_tokens=10000,
    context_window=20000,
)

STORAGE_PATH = "./storage"

RAG_SYSTEM_PROMPT = """
Ты — эксперт по адаптации к изменениям климата.
У тебя есть база знаний с кейсами и нормативными документами.
Пользователь вводит запрос, связанный с климатическим риском в регионе или отрасли.
Твоя задача — на основе информации из базы знаний предложить 2–3 релевантных адаптационных мероприятия,
которые помогут снизить климатический риск, о котором спрашивает пользователь.
### Требования к ответу:
1. Представь результат **в виде Markdown-таблицы** с колонками:
   - Наименование мероприятий
   - Митигационный эффект
   - Адаптационный эффект
   - Актуальность для региона (указать с учётом контекста запроса). Если регион не указан, считай, что задается вопрос по Тюменской области
   - Ответственная организация (из региона)
2. Если источник данных, на которых ты основываешь ответ, известен (это URL и краткое название кейса),
   добавь их **ниже таблицы** в виде списка ссылок:
   `**Опорные источники:** [1] Наименовавание мероприятий - URL, [2] Наименовавание мероприятий - URL`
3. Пиши кратко, по существу, с акцентом на реальные, практические меры.
4. Если информация отсутствует — предложи логичные адаптационные меры на основе Приказа Минэкономразвития России от 13 мая 2021 г. № 267 «Об утверждении методических рекомендаций и показателей по вопросам адаптации к изменениям климата».
Пример формата ответа:
| Наименование мероприятий | Митигационный эффект | Адаптационный эффект | Актуальность для Тобольского района | Ответственная организация |
|---------------------------|----------------------|----------------------|------------------------------------|----------------------------|
| Развитие городского электротранспорта | снижение эмиссии | повышение устойчивости транспортной инфраструктуры | актуально | городские власти |
| Перевод транспорта на газомоторное топливо | снижение эмиссии | рациональное использование ресурсов | реализуется частично | транспортные организации |
**Опорные источники:** [1] Наименовавание мероприятий - https://example.com/case_12
Приводи только те источники, которые используешь для формирования таблицы непосредственно. URL приводи строго такое же, как указано в базе знаний. Наименование мероприятий бери из базы знаний
Ответственную организацию в таблице указывай актуальную для региона, который пользователь указал в запросе
"""

DIALOG_SYSTEM_PROMPT = """
Ты — эксперт по климатическим рискам и адаптации. Отвечай чётко, по делу и на русском языке.
Если вопрос выходит за рамки темы — кратко ответь на вопрос пользователя, а затем вежливо уточни, что специализируешься на вопросах изменения климата, адаптации и устойчивого развития,
Попроси пользователя в следующем запросе уточнить проблему, связанную с климатическим риском. Все равно обязательно кратко ответь на вопрос пользователя.
"""

CLASSIFIER_SYSTEM_PROMPT = """
Ты — классификатор запросов. Твоя задача — определить тип запроса пользователя.
Доступные типы:
- "rag" — запросы, требующие поиска в базе знаний, напрямую связанные с климатическими рисками и адаптационными мероприятиями (климатические риски в регионе, мероприятия по адаптации для конкретных регионов)
- "dialog" — общие вопросы, не требующие поиска в базе знаний

Примеры классификации:
Запрос: "Какие меры по адаптации к засухе в Ялуторовском районе?"
Тип: rag

Запрос: "Климатические риски в Тюменской области"
Тип: rag

Запрос: "Кто отвечает за адаптацию в Исетском районе?"
Тип: rag

Запрос: "Что такое парниковый эффект?"
Тип: dialog

Запрос: "Как сократить выбросы CO2 на предприятии?"
Тип: dialog

Запрос: "Расскажи про адаптацию в Норвегии"
Тип: dialog

Запрос: "Какие существуют виды возобновляемой энергии?"
Тип: dialog

Отвечай ТОЛЬКО одним словом: "rag" или "dialog". Не добавляй никаких пояснений.
"""


def classify_query_tool(user_question: str) -> str:
    try:
        messages = [
            ChatMessage(role="system", content=CLASSIFIER_SYSTEM_PROMPT),
            ChatMessage(role="user", content=user_question)
        ]

        response = Settings.llm.chat(messages)
        query_type = response.message.content.strip().lower()
        return query_type if query_type in ["rag", "dialog"] else "dialog"
    except Exception as e:
        print(f"Ошибка классификации: {e}")
        return "dialog"


def retrieve_rag_context(user_question: str) -> str:
    try:
        storage_context = StorageContext.from_defaults(persist_dir=STORAGE_PATH)
        index = load_index_from_storage(storage_context)
        retriever = index.as_retriever(similarity_top_k=4)
        nodes = retriever.retrieve(user_question)

        context = "\n\n".join([node.get_content() for node in nodes]) if nodes else "Не найдено релевантных документов."
        return context
    except Exception as e:
        return f"Ошибка при извлечении контекста: {str(e)}"


def generate_rag_response(user_question: str, context: str) -> str:
    try:
        full_system_prompt = RAG_SYSTEM_PROMPT + f"\n\nКонтекст:\n{context}"

        messages = [
            ChatMessage(role="system", content=full_system_prompt),
            ChatMessage(role="user", content="Пользовательский запрос: " + user_question)
        ]

        response = Settings.llm.chat(messages)
        return response.message.content
    except Exception as e:
        return f"Ошибка генерации RAG ответа: {str(e)}"


def generate_dialog_response(user_question: str) -> str:
    try:
        messages = [
            ChatMessage(role="system", content=DIALOG_SYSTEM_PROMPT),
            ChatMessage(role="user", content=user_question)
        ]

        response = Settings.llm.chat(messages)
        return response.message.content
    except Exception as e:
        return f"Ошибка диалогового агента: {str(e)}"


classifier_agent = FunctionAgent(
    name="ClassifierAgent",
    description="Классифицирует запросы пользователя на RAG или диалоговые",
    system_prompt="Ты - классификатор запросов. Определяешь тип запроса и передаешь соответствующему агенту.",
    llm=Settings.llm,
    tools=[classify_query_tool],
    can_handoff_to=["RAGAgent", "DialogAgent"],
)

rag_agent = FunctionAgent(
    name="RAGAgent",
    description="Обрабатывает запросы, требующие поиска в базе знаний",
    system_prompt=RAG_SYSTEM_PROMPT,
    llm=Settings.llm,
    tools=[retrieve_rag_context, generate_rag_response],
    can_handoff_to=["ClassifierAgent"],
)

dialog_agent = FunctionAgent(
    name="DialogAgent",
    description="Обрабатывает общие диалоговые запросы по климатической тематике",
    system_prompt=DIALOG_SYSTEM_PROMPT,
    llm=Settings.llm,
    tools=[generate_dialog_response],
    can_handoff_to=["ClassifierAgent"],
)


def process_query_simple(user_question: str) -> str:
    if not user_question.strip():
        return "Ошибка: пожалуйста, введите ваш запрос."

    query_type = classify_query_tool(user_question)
    print(f"Определен тип запроса: {query_type}")

    if query_type == "rag":
        context = retrieve_rag_context(user_question)
        return generate_rag_response(user_question, context)
    else:
        return generate_dialog_response(user_question)


app = FastAPI(title="Climate Adaptation API")

# CORS для Laravel
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QuestionRequest(BaseModel):
    question: str


class QuestionResponse(BaseModel):
    answer: str
    status: str


@app.get("/")
async def root():
    return {"message": "Climate Adaptation API is running"}


@app.post("/ask", response_model=QuestionResponse)
async def ask_question_simple(request: QuestionRequest):
    try:
        answer = process_query_simple(request.question)
        return QuestionResponse(answer=answer, status="success")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
