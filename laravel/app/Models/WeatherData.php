<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WeatherData extends Model
{
    use HasFactory;

    protected $fillable = [
        'region',
        'datetime',
        'pressure',
        'temp',
        'temp_min',
        'temp_max',
        'humidity',
        'weather',
        'wind_dir',
        'wind_speed',
        'clouds',
        'visibility',
        'precip_12h',
        'snow',
    ];

    protected $casts = [
        'datetime' => 'datetime',
    ];

    public $timestamps = true;
}
