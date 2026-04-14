<?php

namespace App\Services;

use App\Models\Farm;
use App\Models\Tile;
use App\Models\User;

class FarmService
{
    /*
    |--------------------------------------------------------------------------
    | World Layout Constants
    |--------------------------------------------------------------------------
    | Grid: 42 wide (q) × 172 deep (r)
    | Road runs N-S at q=22,23. Farms are WEST of road (q=2..17).
    | East side (q=24..39) reserved for future expansion.
    | Plaza: 12×12 at q=17..28, r=80..91 with water channels on W/E edges.
    */

    public const GRID_Q_SIZE = 42;
    public const GRID_R_SIZE = 172;

    // Plaza (12×12 stone area centered on road)
    public const PLAZA_Q_MIN = 17;
    public const PLAZA_Q_MAX = 28;
    public const PLAZA_R_MIN = 80;
    public const PLAZA_R_MAX = 91;

    // Road (2-tile wide, full length of map)
    public const ROAD_Q_MIN = 22;
    public const ROAD_Q_MAX = 23;

    // Reserved plot size per player
    public const RESERVED_SIZE = 16;

    // Farm zone size by level [q_size, r_size]
    public const ZONE_SIZES = [
        1 => [8, 8],    // Small: 8×8
        2 => [16, 8],   // Medium: 16×8
        3 => [16, 16],  // Large: 16×16 (full plot)
    ];

    // House plot: 4 wide (q) × 3 deep (r)
    public const HOUSE_WIDTH = 4;
    public const HOUSE_DEPTH = 3;

    /**
     * Farm zone slots along the N-S road.
     * Farms sit at q=2..17 (west of road). Houses at q=18..21 (between farm and road).
     * 'dir' = 'south' (+r from plaza) or 'north' (-r from plaza).
     *
     * Plaza border (wall+moat+damp) extends 4 tiles out from inner plaza.
     * Inner plaza: r=80..91. Border clears at r=76 (north) and r=95 (south).
     * All farms/houses/paths must be outside r=76..95.
     *
     * Starting 8×8 = corner closest to village + road:
     *   South farms: NE corner (q+8..q+15, r..r+7)
     *   North farms: SE corner (q+8..q+15, r+8..r+15)
     *
     * House: 4×3 (4 wide in q, 3 deep in r). q=18..21, adjacent to road.
    * Path: 4 wide × 2 deep, south of house. Long edge touches the house; east edge meets the 2-tile road.
     */
    private const ZONE_SLOTS = [
        // South farms (S1 = closest to plaza, starts at r=96 = border+1)
        ['q' => 2, 'r' => 96,  'name' => 'S1', 'dir' => 'south', 'house_q' => 18, 'house_r' => 96],
        ['q' => 2, 'r' => 116, 'name' => 'S2', 'dir' => 'south', 'house_q' => 18, 'house_r' => 116],
        ['q' => 2, 'r' => 136, 'name' => 'S3', 'dir' => 'south', 'house_q' => 18, 'house_r' => 136],
        ['q' => 2, 'r' => 156, 'name' => 'S4', 'dir' => 'south', 'house_q' => 18, 'house_r' => 156],
        // North farms (N1 = closest to plaza, ends at r=74 = border-1)
        ['q' => 2, 'r' => 59, 'name' => 'N1', 'dir' => 'north', 'house_q' => 18, 'house_r' => 71],
        ['q' => 2, 'r' => 39, 'name' => 'N2', 'dir' => 'north', 'house_q' => 18, 'house_r' => 51],
        ['q' => 2, 'r' => 19, 'name' => 'N3', 'dir' => 'north', 'house_q' => 18, 'house_r' => 31],
        ['q' => 2, 'r' => 0,  'name' => 'N4', 'dir' => 'north', 'house_q' => 18, 'house_r' => 12],
    ];

    public function getOrCreateFarm(User $user): Farm
    {
        $farm = Farm::where('user_id', $user->id)
            ->where('instance_id', $user->instance_id)
            ->first();

        if ($farm) {
            return $farm;
        }

        return $this->assignFarmZone($user);
    }

    private function assignFarmZone(User $user): Farm
    {
        $instanceId = $user->instance_id;

        $existingFarms = Farm::where('instance_id', $instanceId)->get();
        $takenSlots = [];

        foreach ($existingFarms as $existing) {
            foreach (self::ZONE_SLOTS as $index => $slot) {
                $inQ = $existing->q_min >= $slot['q'] && $existing->q_min <= $slot['q'] + 15;
                $inR = $existing->r_min >= $slot['r'] && $existing->r_min <= $slot['r'] + 15;
                if ($inQ && $inR) {
                    $takenSlots[] = $index;
                }
            }
        }

        $slotIndex = null;
        foreach (self::ZONE_SLOTS as $index => $slot) {
            if (!in_array($index, $takenSlots)) {
                $slotIndex = $index;
                break;
            }
        }

        if ($slotIndex === null) {
            $slotIndex = 0;
        }

        $slot = self::ZONE_SLOTS[$slotIndex];
        [$qSize, $rSize] = self::ZONE_SIZES[1]; // 8×8

        // Place starting area at closest corner to village+road
        if ($slot['dir'] === 'south') {
            // NE corner of reserved area
            $qMin = $slot['q'] + self::RESERVED_SIZE - $qSize;
            $rMin = $slot['r'];
        } else {
            // SE corner of reserved area
            $qMin = $slot['q'] + self::RESERVED_SIZE - $qSize;
            $rMin = $slot['r'] + self::RESERVED_SIZE - $rSize;
        }

        $farm = Farm::create([
            'user_id' => $user->id,
            'instance_id' => $instanceId,
            'q_min' => $qMin,
            'r_min' => $rMin,
            'q_max' => $qMin + $qSize - 1,
            'r_max' => $rMin + $rSize - 1,
            'level' => 1,
        ]);

        $tiles = [];
        $now = now();
        for ($q = $farm->q_min; $q <= $farm->q_max; $q++) {
            for ($r = $farm->r_min; $r <= $farm->r_max; $r++) {
                $tiles[] = [
                    'farm_id' => $farm->id,
                    'q' => $q,
                    'r' => $r,
                    'terrain_type' => 'grass',
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }
        Tile::insert($tiles);

        $user->inventory()->firstOrCreate(
            ['item_type' => 'seed', 'item_id' => 'herbs'],
            ['quantity' => 0]
        )->increment('quantity', 5);

        $user->inventory()->firstOrCreate(
            ['item_type' => 'seed', 'item_id' => 'flowers'],
            ['quantity' => 0]
        )->increment('quantity', 3);

        return $farm;
    }

    public function getReservedArea(Farm $farm): array
    {
        foreach (self::ZONE_SLOTS as $slot) {
            $inQ = $farm->q_min >= $slot['q'] && $farm->q_min <= $slot['q'] + 15;
            $inR = $farm->r_min >= $slot['r'] && $farm->r_min <= $slot['r'] + 15;
            if ($inQ && $inR) {
                return [
                    'q_min' => $slot['q'],
                    'r_min' => $slot['r'],
                    'q_max' => $slot['q'] + self::RESERVED_SIZE - 1,
                    'r_max' => $slot['r'] + self::RESERVED_SIZE - 1,
                ];
            }
        }

        return [
            'q_min' => $farm->q_min,
            'r_min' => $farm->r_min,
            'q_max' => $farm->q_min + self::RESERVED_SIZE - 1,
            'r_max' => $farm->r_min + self::RESERVED_SIZE - 1,
        ];
    }

    public function getAllSlots(): array
    {
        return array_map(function ($slot) {
            return [
                'q' => $slot['q'],
                'r' => $slot['r'],
                'name' => $slot['name'],
                'dir' => $slot['dir'],
                'house_q' => $slot['house_q'],
                'house_r' => $slot['house_r'],
                'reserved_q_max' => $slot['q'] + self::RESERVED_SIZE - 1,
                'reserved_r_max' => $slot['r'] + self::RESERVED_SIZE - 1,
            ];
        }, self::ZONE_SLOTS);
    }
}
