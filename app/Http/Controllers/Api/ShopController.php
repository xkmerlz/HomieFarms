<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\Tile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShopController extends Controller
{
    /**
     * GET /api/shop — Get shop catalog (seeds + buildings).
     */
    public function catalog(): JsonResponse
    {
        $seeds = [];
        foreach (Tile::CROPS as $name => $def) {
            $seeds[] = [
                'id' => $name,
                'type' => 'seed',
                'label' => ucfirst($name) . ' Seeds',
                'cost' => $def['seed_cost'],
                'grow_minutes' => $def['grow_minutes'],
                'harvest_value' => $def['harvest_value'],
            ];
        }

        $buildings = [];
        foreach (Tile::BUILDINGS as $name => $def) {
            $buildings[] = [
                'id' => $name,
                'type' => 'building',
                'label' => $def['label'],
                'cost' => $def['cost'],
                'effect' => $def['effect'],
                'upgrade_cost' => $def['upgrade_cost'] ?? null,
                'upgrade_effect' => $def['upgrade_effect'] ?? null,
            ];
        }

        return response()->json([
            'items' => $seeds,
            'buildings' => $buildings,
        ]);
    }

    /**
     * POST /api/shop/buy — Buy seeds from the shop.
     */
    public function buy(Request $request): JsonResponse
    {
        $request->validate([
            'item' => 'required|string|in:' . implode(',', array_keys(Tile::CROPS)),
            'quantity' => 'required|integer|min:1|max:99',
        ]);

        $user = $request->user();
        $cropType = $request->string('item')->toString();
        $qty = $request->integer('quantity');
        $cost = Tile::CROPS[$cropType]['seed_cost'] * $qty;

        if ($user->coins < $cost) {
            return response()->json(['error' => 'Not enough coins'], 400);
        }

        $user->decrement('coins', $cost);

        InventoryItem::firstOrCreate(
            ['user_id' => $user->id, 'item_type' => 'seed', 'item_id' => $cropType],
            ['quantity' => 0]
        )->increment('quantity', $qty);

        return response()->json([
            'coins' => $user->fresh()->coins,
            'item' => $cropType,
            'quantity' => $qty,
            'cost' => $cost,
        ]);
    }

    /**
     * POST /api/shop/sell — Sell harvested crops for coins.
     */
    public function sell(Request $request): JsonResponse
    {
        $request->validate([
            'item' => 'required|string|in:' . implode(',', array_keys(Tile::CROPS)),
            'quantity' => 'required|integer|min:1|max:99',
        ]);

        $user = $request->user();
        $cropType = $request->string('item')->toString();
        $qty = $request->integer('quantity');

        $invItem = InventoryItem::where('user_id', $user->id)
            ->where('item_type', 'crop')
            ->where('item_id', $cropType)
            ->first();

        if (!$invItem || $invItem->quantity < $qty) {
            return response()->json(['error' => 'Not enough crops to sell'], 400);
        }

        $baseValue = Tile::CROPS[$cropType]['harvest_value'] * $qty;

        // Check for Market Stall sell bonus
        $sellBonus = $this->getMarketSellBonus($user);
        $totalValue = intval(round($baseValue * (1 + $sellBonus)));

        $invItem->decrement('quantity', $qty);
        $user->increment('coins', $totalValue);

        return response()->json([
            'coins' => $user->fresh()->coins,
            'item' => $cropType,
            'quantity' => $qty,
            'earned' => $totalValue,
        ]);
    }

    /**
     * POST /api/shop/forage — Forage free herb seeds (failsafe for broke players).
     * Available only when player has < 5 coins AND 0 seeds of any type.
     */
    public function forage(Request $request): JsonResponse
    {
        $user = $request->user();

        $totalSeeds = InventoryItem::where('user_id', $user->id)
            ->where('item_type', 'seed')
            ->sum('quantity');

        $minSeedCost = min(array_column(Tile::CROPS, 'seed_cost'));

        if ($user->coins >= $minSeedCost || $totalSeeds > 0) {
            return response()->json(['error' => 'You can still buy or plant seeds'], 400);
        }

        $forageAmount = 3;

        InventoryItem::firstOrCreate(
            ['user_id' => $user->id, 'item_type' => 'seed', 'item_id' => 'herbs'],
            ['quantity' => 0]
        )->increment('quantity', $forageAmount);

        return response()->json([
            'item' => 'herbs',
            'quantity' => $forageAmount,
            'message' => 'Foraged wild herb seeds!',
        ]);
    }

    /**
     * Calculate sell bonus from Market Stall buildings on the player's farm.
     */
    private function getMarketSellBonus($user): float
    {
        $farm = \App\Models\Farm::where('user_id', $user->id)
            ->where('instance_id', $user->instance_id)
            ->first();

        if (!$farm) return 0;

        $market = Tile::where('farm_id', $farm->id)
            ->where('structure_type', 'market')
            ->first();

        if (!$market) return 0;

        $def = Tile::BUILDINGS['market'];
        return $market->structure_tier >= 2
            ? ($def['upgrade_sell_bonus'] ?? 0.20)
            : ($def['sell_bonus'] ?? 0.10);
    }
}
