<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->onDelete('cascade');
            $table->text('question'); // Запрос пользователя
            $table->text('answer');   // Ответ системы
            $table->timestamp('interaction_time'); // Время взаимодействия
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('conversation_pairs');
    }
};
