<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Tile extends Model
{
    protected $fillable = [
        'farm_id', 'q', 'r', 'terrain_type',
        'structure_type', 'structure_tier',
        'crop_type', 'crop_planted_at', 'crop_watered',
    ];

    protected function casts(): array
    {
        return [
            'q' => 'integer',
            'r' => 'integer',
            'structure_tier' => 'integer',
            'crop_planted_at' => 'datetime',
            'crop_watered' => 'boolean',
        ];
    }

    public function farm()
    {
        return $this->belongsTo(Farm::class);
    }

    /**
     * Get the current crop growth stage (0-3) based on elapsed time.
     * Returns null if no crop planted.
     *
     * Stages: 0=planted, 1=sprouting, 2=growing, 3=harvestable, -1=withered
     */
    public function getCropStage(): ?int
    {
        if (!$this->crop_type || !$this->crop_planted_at) {
            return null;
        }

        $crop = self::CROPS[$this->crop_type] ?? null;
        if (!$crop) return null;

        $growSeconds = $crop['grow_minutes'] * 60;
        if ($this->crop_watered) {
            $growSeconds *= 0.9; // 10% faster when watered
        }

        $elapsed = now()->diffInSeconds($this->crop_planted_at);

        // Withered: past 2× grow time
        if ($elapsed >= $growSeconds * 2) {
            return -1;
        }

        // 4 stages evenly split across grow time
        $progress = min($elapsed / $growSeconds, 1.0);

        if ($progress >= 1.0) return 3; // harvestable
        if ($progress >= 0.66) return 2; // growing
        if ($progress >= 0.33) return 1; // sprouting
        return 0; // planted
    }

    /**
     * Crop definitions: seed_cost, grow_minutes, harvest_value
     */
    public const CROPS = [
        'herbs' => [
            'seed_cost' => 5,
            'grow_minutes' => 10,
            'harvest_value' => 15,
        ],
        'flowers' => [
            'seed_cost' => 15,
            'grow_minutes' => 45,
            'harvest_value' => 50,
        ],
        'berries' => [
            'seed_cost' => 30,
            'grow_minutes' => 120,
            'harvest_value' => 100,
        ],
    ];

    /**
     * Building definitions: cost, effect description, upgrade cost, upgrade effect.
     */
    public const BUILDINGS = [
        'well' => [
            'cost' => 50,
            'label' => 'Well',
            'effect' => 'Auto-waters adjacent crops',
            'radius' => 1,
            'upgrade_cost' => 250,
            'upgrade_effect' => 'Larger radius (2 tiles)',
            'upgrade_radius' => 2,
        ],
        'silo' => [
            'cost' => 100,
            'label' => 'Silo',
            'effect' => 'Inventory capacity +20',
            'capacity_bonus' => 20,
            'upgrade_cost' => 300,
            'upgrade_effect' => 'Inventory capacity +40',
            'upgrade_capacity_bonus' => 40,
        ],
        'market' => [
            'cost' => 200,
            'label' => 'Market Stall',
            'effect' => 'Sell crops for 10% more',
            'sell_bonus' => 0.10,
            'upgrade_cost' => 600,
            'upgrade_effect' => 'Sell crops for 20% more',
            'upgrade_sell_bonus' => 0.20,
        ],
    ];
}
