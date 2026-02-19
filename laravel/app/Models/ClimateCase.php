<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ClimateCase extends Model
{
    //use SoftDeletes;

    protected $table = 'climate_cases';

    protected $fillable = [
        'problem',
        'measure_name',
        'mitigation_effect',
        'adaptation_effect',
        'district_name',
        'climate_conditions',
        'responsible_org',
        'source_url'
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime'
    ];
}
