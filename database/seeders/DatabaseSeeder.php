<?php

namespace Database\Seeders;

use App\Models\Instance;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        Instance::firstOrCreate(
            ['slug' => 'main'],
            ['name' => 'Main Village', 'max_players' => 20]
        );
    }
}
