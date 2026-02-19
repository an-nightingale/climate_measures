<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('weather_data', function (Blueprint $table) {
            $table->id();
            $table->string('region');                     // Например: "Тюмень"
            $table->dateTime('datetime');                 // Время наблюдения (местное)
            $table->integer('pressure')->nullable();      // мм рт.ст.
            $table->float('temp', 8, 1)->nullable();      // текущая температура, °C
            $table->float('temp_min', 8, 1)->nullable();  // мин. температура
            $table->float('temp_max', 8, 1)->nullable();  // макс. температура
            $table->integer('humidity')->nullable();      // влажность, %
            $table->string('weather')->nullable();        // явление погоды
            $table->string('wind_dir')->nullable();       // направление ветра
            $table->integer('wind_speed')->nullable();    // скорость ветра, м/с
            $table->integer('clouds')->nullable();        // облачность, баллы
            $table->integer('visibility')->nullable();    // видимость, км
            $table->float('precip_12h', 8, 1)->nullable(); // осадки за 12ч, мм
            $table->float('snow', 8, 1)->nullable();      // снег, см
            $table->timestamps();
        });

        // Уникальность: нельзя вставить две записи с одинаковыми регионом и временем
        Schema::table('weather_data', function (Blueprint $table) {
            $table->unique(['region', 'datetime']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('weather_data');
    }
};
