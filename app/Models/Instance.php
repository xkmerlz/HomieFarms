<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Instance extends Model
{
    protected $fillable = ['name', 'slug', 'max_players', 'weather', 'weather_changed_at', 'game_time'];

    protected function casts(): array
    {
        return [
            'weather_changed_at' => 'datetime',
            'max_players' => 'integer',
            'game_time' => 'integer',
        ];
    }

    public function users()
    {
        return $this->hasMany(User::class);
    }
}
