<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class GameController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        return view('game', [
            'user' => [
                'id' => $user->id,
                'username' => $user->discord_username,
                'avatar' => $user->discord_avatar,
                'coins' => $user->coins,
                'instance_id' => $user->instance_id,
            ],
        ]);
    }
}
