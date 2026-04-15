<?php

namespace App\Http\Controllers;

use App\Models\InventoryItem;
use App\Services\WeatherService;
use Illuminate\Http\Request;

class GameController extends Controller
{
    private const DAILY_BONUS_COINS = 25;
    private const DAILY_BONUS_SEEDS = 3;
    private const DAILY_BONUS_SEED_TYPE = 'herbs';

    public function __construct(
        private WeatherService $weatherService
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();

        $dailyBonus = $this->checkDailyBonus($user);

        return view('game', [
            'user' => [
                'id' => $user->id,
                'username' => $user->discord_username,
                'avatar' => $user->discord_avatar,
                'coins' => $user->coins,
                'instance_id' => $user->instance_id,
            ],
            'world' => $this->weatherService->getWorldStateForUser($user),
            'dailyBonus' => $dailyBonus,
        ]);
    }

    private function checkDailyBonus($user): ?array
    {
        $lastBonus = $user->last_daily_bonus;

        if ($lastBonus && $lastBonus->isToday()) {
            return null;
        }

        $user->increment('coins', self::DAILY_BONUS_COINS);

        InventoryItem::firstOrCreate(
            ['user_id' => $user->id, 'item_type' => 'seed', 'item_id' => self::DAILY_BONUS_SEED_TYPE],
            ['quantity' => 0]
        )->increment('quantity', self::DAILY_BONUS_SEEDS);

        $user->update(['last_daily_bonus' => now()]);
        $user->refresh();

        return [
            'coins' => self::DAILY_BONUS_COINS,
            'seeds' => self::DAILY_BONUS_SEEDS,
            'seed_type' => self::DAILY_BONUS_SEED_TYPE,
        ];
    }
}
