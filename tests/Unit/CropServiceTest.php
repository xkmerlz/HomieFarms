<?php

namespace Tests\Unit;

use App\Models\Farm;
use App\Models\Instance;
use App\Models\Tile;
use App\Models\User;
use App\Services\CropService;
use App\Services\WeatherService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CropServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_rainy_weather_auto_waters_and_accelerates_growth(): void
    {
        $weatherService = app(WeatherService::class);
        $cropService = app(CropService::class);
        [$instance, $farm] = $this->makeFarm();

        $rainyDay = $this->findDayIndex($weatherService, $instance, 'rainy');
        $sunnyDay = $this->findDayIndex($weatherService, $instance, 'sunny');

        $rainMoment = CarbonImmutable::createFromTimestamp($rainyDay * WeatherService::GAME_DAY_SECONDS + (9 * 60), 'UTC');
        $sunMoment = CarbonImmutable::createFromTimestamp($sunnyDay * WeatherService::GAME_DAY_SECONDS + (9 * 60), 'UTC');

        $rainTile = Tile::create([
            'farm_id' => $farm->id,
            'q' => 0,
            'r' => 0,
            'terrain_type' => 'tilled',
            'crop_type' => 'herbs',
            'crop_planted_at' => $rainMoment->subMinutes(9),
            'crop_watered' => false,
        ]);

        $sunTile = Tile::create([
            'farm_id' => $farm->id,
            'q' => 1,
            'r' => 0,
            'terrain_type' => 'tilled',
            'crop_type' => 'herbs',
            'crop_planted_at' => $sunMoment->subMinutes(9),
            'crop_watered' => false,
        ]);

        $rainState = $cropService->getState($rainTile, $instance, $rainMoment);
        $sunState = $cropService->getState($sunTile, $instance, $sunMoment);

        $this->assertTrue($rainState['watered']);
        $this->assertSame(3, $rainState['stage']);
        $this->assertSame(2, $sunState['stage']);
    }

    public function test_drought_slows_growth(): void
    {
        $weatherService = app(WeatherService::class);
        $cropService = app(CropService::class);
        [$instance, $farm] = $this->makeFarm();

        $droughtDay = $this->findDayIndex($weatherService, $instance, 'drought');
        $moment = CarbonImmutable::createFromTimestamp($droughtDay * WeatherService::GAME_DAY_SECONDS + (10 * 60), 'UTC');

        $tile = Tile::create([
            'farm_id' => $farm->id,
            'q' => 2,
            'r' => 0,
            'terrain_type' => 'tilled',
            'crop_type' => 'herbs',
            'crop_planted_at' => $moment->subMinutes(10),
            'crop_watered' => false,
        ]);

        $state = $cropService->getState($tile, $instance, $moment);

        $this->assertFalse($state['watered']);
        $this->assertSame(2, $state['stage']);
    }

    private function makeFarm(): array
    {
        $instance = Instance::create([
            'name' => 'Main Village',
            'slug' => 'main',
            'max_players' => 20,
        ]);

        $user = User::create([
            'discord_id' => 'crop-test-user-' . uniqid(),
            'discord_username' => 'CropTester',
            'coins' => 100,
            'instance_id' => $instance->id,
        ]);

        $farm = Farm::create([
            'user_id' => $user->id,
            'instance_id' => $instance->id,
            'q_min' => 0,
            'r_min' => 0,
            'q_max' => 7,
            'r_max' => 7,
            'level' => 1,
        ]);

        return [$instance, $farm];
    }

    private function findDayIndex(WeatherService $weatherService, Instance $instance, string $weather): int
    {
        for ($dayIndex = 0; $dayIndex < 800; $dayIndex++) {
            if ($weatherService->getWeatherForDay($instance, $dayIndex) === $weather) {
                return $dayIndex;
            }
        }

        $this->fail("Could not find a {$weather} day for test setup.");
    }
}