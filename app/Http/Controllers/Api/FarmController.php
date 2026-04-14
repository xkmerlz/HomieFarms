<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\Tile;
use App\Services\FarmService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FarmController extends Controller
{
    public function __construct(
        private FarmService $farmService
    ) {}

    /**
     * GET /api/farm — Get the player's farm data including all tiles.
     */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        $farm = $this->farmService->getOrCreateFarm($user);
        $farm->load('tiles');

        $tiles = $farm->tiles->map(function (Tile $tile) {
            $data = [
                'q' => $tile->q,
                'r' => $tile->r,
                'terrain' => $tile->terrain_type,
            ];

            if ($tile->crop_type) {
                $data['crop'] = $tile->crop_type;
                $data['stage'] = $tile->getCropStage();
                $data['watered'] = $tile->crop_watered;
            }

            if ($tile->structure_type) {
                $data['structure'] = $tile->structure_type;
                $data['tier'] = $tile->structure_tier;
            }

            return $data;
        });

        return response()->json([
            'farm' => [
                'q_min' => $farm->q_min,
                'r_min' => $farm->r_min,
                'q_max' => $farm->q_max,
                'r_max' => $farm->r_max,
                'level' => $farm->level,
            ],
            'reserved' => $this->farmService->getReservedArea($farm),
            'slots' => $this->farmService->getAllSlots(),
            'layout' => [
                'grid_q' => FarmService::GRID_Q_SIZE,
                'grid_r' => FarmService::GRID_R_SIZE,
                'plaza' => [
                    'q_min' => FarmService::PLAZA_Q_MIN,
                    'q_max' => FarmService::PLAZA_Q_MAX,
                    'r_min' => FarmService::PLAZA_R_MIN,
                    'r_max' => FarmService::PLAZA_R_MAX,
                ],
                'road' => [
                    'q_min' => FarmService::ROAD_Q_MIN,
                    'q_max' => FarmService::ROAD_Q_MAX,
                ],
            ],
            'tiles' => $tiles,
        ]);
    }

    /**
     * POST /api/farm/till — Till a grass tile to prepare it for planting.
     */
    public function till(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'required|integer',
            'r' => 'required|integer',
        ]);

        $user = $request->user();
        $farm = $this->farmService->getOrCreateFarm($user);

        $q = $request->integer('q');
        $r = $request->integer('r');

        if (!$farm->contains($q, $r)) {
            return response()->json(['error' => 'Tile is not in your farm zone'], 403);
        }

        $tile = Tile::where('farm_id', $farm->id)
            ->where('q', $q)
            ->where('r', $r)
            ->first();

        if (!$tile) {
            return response()->json(['error' => 'Tile not found'], 404);
        }

        if ($tile->terrain_type !== 'grass') {
            return response()->json(['error' => 'Can only till grass tiles'], 400);
        }

        $tile->update(['terrain_type' => 'tilled']);

        return response()->json([
            'q' => $q,
            'r' => $r,
            'terrain' => 'tilled',
        ]);
    }

    /**
     * POST /api/farm/plant — Plant a crop on tilled soil.
     */
    public function plant(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'required|integer',
            'r' => 'required|integer',
            'crop' => 'required|string|in:' . implode(',', array_keys(Tile::CROPS)),
        ]);

        $user = $request->user();
        $farm = $this->farmService->getOrCreateFarm($user);

        $q = $request->integer('q');
        $r = $request->integer('r');
        $cropType = $request->string('crop')->toString();

        if (!$farm->contains($q, $r)) {
            return response()->json(['error' => 'Tile is not in your farm zone'], 403);
        }

        $tile = Tile::where('farm_id', $farm->id)
            ->where('q', $q)
            ->where('r', $r)
            ->first();

        if (!$tile) {
            return response()->json(['error' => 'Tile not found'], 404);
        }

        if ($tile->terrain_type !== 'tilled') {
            return response()->json(['error' => 'Must till soil before planting'], 400);
        }

        if ($tile->crop_type) {
            return response()->json(['error' => 'Tile already has a crop'], 400);
        }

        // Check inventory for seeds
        $seedItem = InventoryItem::where('user_id', $user->id)
            ->where('item_type', 'seed')
            ->where('item_id', $cropType)
            ->first();

        if (!$seedItem || $seedItem->quantity < 1) {
            return response()->json(['error' => 'No seeds available'], 400);
        }

        // Deduct seed
        $seedItem->decrement('quantity');

        // Check if a nearby well should auto-water this crop
        $autoWatered = $this->isNearWell($farm, $q, $r);

        // Plant crop
        $tile->update([
            'crop_type' => $cropType,
            'crop_planted_at' => now(),
            'crop_watered' => $autoWatered,
        ]);

        return response()->json([
            'q' => $q,
            'r' => $r,
            'terrain' => 'tilled',
            'crop' => $cropType,
            'stage' => 0,
            'watered' => $autoWatered,
        ]);
    }

    /**
     * POST /api/farm/water — Water a planted crop.
     */
    public function water(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'required|integer',
            'r' => 'required|integer',
        ]);

        $user = $request->user();
        $farm = $this->farmService->getOrCreateFarm($user);

        $q = $request->integer('q');
        $r = $request->integer('r');

        if (!$farm->contains($q, $r)) {
            return response()->json(['error' => 'Tile is not in your farm zone'], 403);
        }

        $tile = Tile::where('farm_id', $farm->id)
            ->where('q', $q)
            ->where('r', $r)
            ->first();

        if (!$tile || !$tile->crop_type) {
            return response()->json(['error' => 'No crop to water'], 400);
        }

        if ($tile->crop_watered) {
            return response()->json(['error' => 'Already watered'], 400);
        }

        $tile->update(['crop_watered' => true]);

        return response()->json([
            'q' => $q,
            'r' => $r,
            'watered' => true,
        ]);
    }

    /**
     * POST /api/farm/harvest — Harvest a fully grown crop.
     */
    public function harvest(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'required|integer',
            'r' => 'required|integer',
        ]);

        $user = $request->user();
        $farm = $this->farmService->getOrCreateFarm($user);

        $q = $request->integer('q');
        $r = $request->integer('r');

        if (!$farm->contains($q, $r)) {
            return response()->json(['error' => 'Tile is not in your farm zone'], 403);
        }

        $tile = Tile::where('farm_id', $farm->id)
            ->where('q', $q)
            ->where('r', $r)
            ->first();

        if (!$tile || !$tile->crop_type) {
            return response()->json(['error' => 'No crop to harvest'], 400);
        }

        $stage = $tile->getCropStage();

        if ($stage === -1) {
            // Withered — clear the crop, no reward
            $tile->update([
                'crop_type' => null,
                'crop_planted_at' => null,
                'crop_watered' => false,
                'terrain_type' => 'tilled', // stays tilled
            ]);
            return response()->json([
                'q' => $q,
                'r' => $r,
                'withered' => true,
                'terrain' => 'tilled',
            ]);
        }

        if ($stage < 3) {
            return response()->json(['error' => 'Crop is not ready for harvest'], 400);
        }

        $cropDef = Tile::CROPS[$tile->crop_type];

        // Add harvested crop to inventory
        InventoryItem::firstOrCreate(
            ['user_id' => $user->id, 'item_type' => 'crop', 'item_id' => $tile->crop_type],
            ['quantity' => 0]
        )->increment('quantity');

        // Clear tile
        $cropName = $tile->crop_type;
        $tile->update([
            'crop_type' => null,
            'crop_planted_at' => null,
            'crop_watered' => false,
            'terrain_type' => 'tilled',
        ]);

        return response()->json([
            'q' => $q,
            'r' => $r,
            'terrain' => 'tilled',
            'harvested' => $cropName,
            'value' => $cropDef['harvest_value'],
        ]);
    }

    /**
     * POST /api/farm/clear-withered — Remove a withered crop from a tile.
     */
    public function clearWithered(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'required|integer',
            'r' => 'required|integer',
        ]);

        $user = $request->user();
        $farm = $this->farmService->getOrCreateFarm($user);

        $q = $request->integer('q');
        $r = $request->integer('r');

        if (!$farm->contains($q, $r)) {
            return response()->json(['error' => 'Tile is not in your farm zone'], 403);
        }

        $tile = Tile::where('farm_id', $farm->id)
            ->where('q', $q)
            ->where('r', $r)
            ->first();

        if (!$tile || !$tile->crop_type || $tile->getCropStage() !== -1) {
            return response()->json(['error' => 'No withered crop here'], 400);
        }

        $tile->update([
            'crop_type' => null,
            'crop_planted_at' => null,
            'crop_watered' => false,
        ]);

        return response()->json([
            'q' => $q,
            'r' => $r,
            'terrain' => 'tilled',
        ]);
    }

    /**
     * POST /api/farm/build — Place a structure on a farm tile.
     */
    public function build(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'required|integer',
            'r' => 'required|integer',
            'building' => 'required|string|in:' . implode(',', array_keys(Tile::BUILDINGS)),
        ]);

        $user = $request->user();
        $farm = $this->farmService->getOrCreateFarm($user);

        $q = $request->integer('q');
        $r = $request->integer('r');
        $buildingType = $request->string('building')->toString();

        if (!$farm->contains($q, $r)) {
            return response()->json(['error' => 'Tile is not in your farm zone'], 403);
        }

        $tile = Tile::where('farm_id', $farm->id)
            ->where('q', $q)
            ->where('r', $r)
            ->first();

        if (!$tile) {
            return response()->json(['error' => 'Tile not found'], 404);
        }

        if ($tile->structure_type) {
            return response()->json(['error' => 'Tile already has a structure'], 400);
        }

        if ($tile->crop_type) {
            return response()->json(['error' => 'Cannot build on a tile with crops'], 400);
        }

        $def = Tile::BUILDINGS[$buildingType];
        $cost = $def['cost'];

        if ($user->coins < $cost) {
            return response()->json(['error' => 'Not enough coins'], 400);
        }

        $user->decrement('coins', $cost);
        $tile->update([
            'structure_type' => $buildingType,
            'structure_tier' => 1,
            'terrain_type' => 'grass', // keep as grass under building
        ]);

        // If it's a well, auto-water adjacent crops
        if ($buildingType === 'well') {
            $this->applyWellWatering($farm, $q, $r, $def['radius']);
        }

        return response()->json([
            'q' => $q,
            'r' => $r,
            'structure' => $buildingType,
            'tier' => 1,
            'terrain' => $tile->terrain_type,
            'coins' => $user->fresh()->coins,
        ]);
    }

    /**
     * POST /api/farm/demolish — Remove a structure from a farm tile.
     */
    public function demolish(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'required|integer',
            'r' => 'required|integer',
        ]);

        $user = $request->user();
        $farm = $this->farmService->getOrCreateFarm($user);

        $q = $request->integer('q');
        $r = $request->integer('r');

        if (!$farm->contains($q, $r)) {
            return response()->json(['error' => 'Tile is not in your farm zone'], 403);
        }

        $tile = Tile::where('farm_id', $farm->id)
            ->where('q', $q)
            ->where('r', $r)
            ->first();

        if (!$tile || !$tile->structure_type) {
            return response()->json(['error' => 'No structure to demolish'], 400);
        }

        // Refund 50% of base cost
        $def = Tile::BUILDINGS[$tile->structure_type] ?? null;
        $refund = $def ? intval($def['cost'] * 0.5) : 0;

        $tile->update([
            'structure_type' => null,
            'structure_tier' => 0,
        ]);

        if ($refund > 0) {
            $user->increment('coins', $refund);
        }

        return response()->json([
            'q' => $q,
            'r' => $r,
            'terrain' => $tile->terrain_type,
            'coins' => $user->fresh()->coins,
            'refund' => $refund,
        ]);
    }

    /**
     * POST /api/farm/upgrade — Upgrade a structure to the next tier.
     */
    public function upgrade(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'required|integer',
            'r' => 'required|integer',
        ]);

        $user = $request->user();
        $farm = $this->farmService->getOrCreateFarm($user);

        $q = $request->integer('q');
        $r = $request->integer('r');

        if (!$farm->contains($q, $r)) {
            return response()->json(['error' => 'Tile is not in your farm zone'], 403);
        }

        $tile = Tile::where('farm_id', $farm->id)
            ->where('q', $q)
            ->where('r', $r)
            ->first();

        if (!$tile || !$tile->structure_type) {
            return response()->json(['error' => 'No structure to upgrade'], 400);
        }

        if ($tile->structure_tier >= 2) {
            return response()->json(['error' => 'Already at max tier'], 400);
        }

        $def = Tile::BUILDINGS[$tile->structure_type] ?? null;
        if (!$def || !isset($def['upgrade_cost'])) {
            return response()->json(['error' => 'This structure cannot be upgraded'], 400);
        }

        $cost = $def['upgrade_cost'];
        if ($user->coins < $cost) {
            return response()->json(['error' => 'Not enough coins'], 400);
        }

        $user->decrement('coins', $cost);
        $tile->update(['structure_tier' => 2]);

        // If upgrading a well, re-apply with larger radius
        if ($tile->structure_type === 'well') {
            $this->applyWellWatering($farm, $q, $r, $def['upgrade_radius']);
        }

        return response()->json([
            'q' => $q,
            'r' => $r,
            'structure' => $tile->structure_type,
            'tier' => 2,
            'coins' => $user->fresh()->coins,
        ]);
    }

    /**
     * Apply well auto-watering to adjacent crop tiles.
     */
    private function applyWellWatering($farm, int $q, int $r, int $radius): void
    {
        Tile::where('farm_id', $farm->id)
            ->whereBetween('q', [$q - $radius, $q + $radius])
            ->whereBetween('r', [$r - $radius, $r + $radius])
            ->whereNotNull('crop_type')
            ->where('crop_watered', false)
            ->update(['crop_watered' => true]);
    }

    /**
     * Check if a tile is within range of a well.
     */
    private function isNearWell($farm, int $q, int $r): bool
    {
        $wells = Tile::where('farm_id', $farm->id)
            ->where('structure_type', 'well')
            ->get();

        foreach ($wells as $well) {
            $radius = $well->structure_tier >= 2
                ? (Tile::BUILDINGS['well']['upgrade_radius'] ?? 2)
                : (Tile::BUILDINGS['well']['radius'] ?? 1);

            if (abs($well->q - $q) <= $radius && abs($well->r - $r) <= $radius) {
                return true;
            }
        }

        return false;
    }
}
