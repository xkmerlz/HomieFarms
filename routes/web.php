<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\GameController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
})->name('login');

// Discord OAuth
Route::get('/auth/discord', [AuthController::class, 'redirect'])->name('auth.discord');
Route::get('/auth/discord/callback', [AuthController::class, 'callback']);

// Authenticated routes
Route::middleware('auth')->group(function () {
    Route::get('/game', [GameController::class, 'index'])->name('game');
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');
});

// DEV ONLY: test game page without auth
if (app()->environment('local')) {
    Route::get('/dev/game', function () {
        // Create or find a dev user so API calls work
        $user = \App\Models\User::firstOrCreate(
            ['discord_id' => 'dev_local'],
            [
                'discord_username' => 'DevPlayer',
                'email' => 'dev@local',
                'coins' => 100,
                'instance_id' => \App\Models\Instance::where('slug', 'main')->value('id') ?? 1,
            ]
        );
        \Illuminate\Support\Facades\Auth::login($user);

        return view('game', [
            'user' => [
                'id' => $user->id,
                'username' => $user->discord_username,
                'avatar' => $user->discord_avatar,
                'coins' => $user->coins,
                'instance_id' => $user->instance_id,
            ],
        ]);
    });
}
