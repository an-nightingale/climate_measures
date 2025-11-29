# Система рекомендации адаптационных мероприятий к изменениям климата

## Описание
Информационная система для оперативного подбора адаптационных мероприятий, направленных на снижение последствий климатических рисков в Тюменской области. Система использует мультиагентный подход на базе LLM-моделей и векторную базу знаний для предоставления персонализированных рекомендаций.


## Запуск

### Создать базу данных postgres на порту 5433 под названием "climate"

### Python RAG
```bash
cd python
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python createvector.py
python main.py
```

### Laravel
```bash
cd laravel
composer install
php artisan migrate
php artisan tinker
use App\Models\User;
User::create([
    'name' => 'имя',
    'email' => 'почта',
    'password' => bcrypt('пароль')
]);
exit
php artisan serve
```
