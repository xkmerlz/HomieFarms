<?php

namespace App\Http\Controllers;

use App\Models\Instance;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;

class AuthController extends Controller
{
    public function redirect()
    {
        return Socialite::driver('discord')->redirect();
    }

    public function callback()
    {
        $discordUser = Socialite::driver('discord')->user();

        $user = User::updateOrCreate(
            ['discord_id' => $discordUser->getId()],
            [
                'discord_username' => $discordUser->getNickname() ?? $discordUser->getName(),
                'discord_avatar' => $discordUser->getAvatar(),
                'email' => $discordUser->getEmail(),
                'last_login' => now(),
            ]
        );

        // Assign to main instance if not already in one
        if (!$user->instance_id) {
            $mainInstance = Instance::where('slug', 'main')->first();
            if ($mainInstance) {
                $user->update(['instance_id' => $mainInstance->id]);
            }
        }

        Auth::login($user, remember: true);

        return redirect('/game');
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
