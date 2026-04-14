<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Clear crop data referencing old types (lettuce, carrots, tomatoes, pumpkins, starfruit)
     * and old seed inventory so players start fresh with herbs/flowers/berries.
     */
    public function up(): void
    {
        $oldCrops = ['lettuce', 'carrots', 'tomatoes', 'pumpkins', 'starfruit'];

        // Clear planted crops that reference old types
        DB::table('tiles')
            ->whereIn('crop_type', $oldCrops)
            ->update([
                'crop_type' => null,
                'crop_planted_at' => null,
                'crop_watered' => false,
            ]);

        // Remove old seed inventory
        DB::table('inventory')
            ->where('item_type', 'seed')
            ->whereIn('item_id', $oldCrops)
            ->delete();
    }

    public function down(): void
    {
        // Data migration — cannot be reversed
    }
};
