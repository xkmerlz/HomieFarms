<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['discord_id', 'discord_username', 'discord_avatar', 'email', 'coins', 'instance_id', 'last_login', 'last_daily_bonus'])]
#[Hidden(['remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'last_login' => 'datetime',
            'last_daily_bonus' => 'datetime',
            'coins' => 'integer',
        ];
    }

    public function instance()
    {
        return $this->belongsTo(Instance::class);
    }

    public function farm()
    {
        return $this->hasOne(Farm::class);
    }

    public function inventory()
    {
        return $this->hasMany(InventoryItem::class);
    }
}
