<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Farm extends Model
{
    protected $fillable = [
        'user_id', 'instance_id', 'q_min', 'r_min', 'q_max', 'r_max', 'level',
    ];

    protected function casts(): array
    {
        return [
            'q_min' => 'integer',
            'r_min' => 'integer',
            'q_max' => 'integer',
            'r_max' => 'integer',
            'level' => 'integer',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function instance()
    {
        return $this->belongsTo(Instance::class);
    }

    public function tiles()
    {
        return $this->hasMany(Tile::class);
    }

    /**
     * Check if a grid position is within this farm's zone.
     */
    public function contains(int $q, int $r): bool
    {
        return $q >= $this->q_min && $q <= $this->q_max
            && $r >= $this->r_min && $r <= $this->r_max;
    }
}
