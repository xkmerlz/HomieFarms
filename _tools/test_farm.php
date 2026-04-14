<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Http\Kernel::class)->bootstrap();

// Visit /dev/game first to create a user, or create one here
$user = App\Models\User::first();
if (!$user) {
    $instance = App\Models\Instance::firstOrCreate(['slug' => 'main'], ['name' => 'Main', 'max_players' => 50]);
    $user = App\Models\User::create([
        'username' => 'TestDev',
        'discord_id' => '12345',
        'instance_id' => $instance->id,
    ]);
    echo "Created test user\n";
}

$fs = new App\Services\FarmService;
$farm = $fs->getOrCreateFarm($user);
echo "Farm: q={$farm->q_min},{$farm->r_min} to q={$farm->q_max},{$farm->r_max} level={$farm->level}\n";
echo "Reserved: " . json_encode($fs->getReservedArea($farm)) . "\n";
echo "Tile count: " . $farm->tiles()->count() . "\n";
