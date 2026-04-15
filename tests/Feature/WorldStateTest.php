<?php

namespace Tests\Feature;

use App\Models\Instance;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorldStateTest extends TestCase
{
    use RefreshDatabase;

    public function test_world_endpoint_returns_server_authoritative_weather_and_time(): void
    {
        CarbonImmutable::setTestNow(CarbonImmutable::create(2025, 1, 1, 12, 15, 0, 'UTC'));

        try {
            $instance = Instance::create([
                'name' => 'Main Village',
                'slug' => 'main',
                'max_players' => 20,
            ]);

            $user = User::create([
                'discord_id' => 'world-test-user',
                'discord_username' => 'WorldTester',
                'coins' => 100,
                'instance_id' => $instance->id,
            ]);

            $response = $this->actingAs($user)->getJson('/api/world');

            $response->assertOk()->assertJsonStructure([
                'world' => [
                    'weather' => ['key', 'label', 'icon', 'effect'],
                    'time' => ['minutes', 'hour', 'minute', 'formatted', 'phase', 'phase_label', 'icon'],
                    'next_weather_change_at',
                    'seconds_until_change',
                    'forecast',
                ],
            ]);

            $response->assertJsonPath('world.time.formatted', '06:00');
            $response->assertJsonPath('world.time.phase', 'dawn');

            // Verify forecast contains 2 entries with expected structure
            $forecast = $response->json('world.forecast');
            $this->assertCount(2, $forecast);
            $this->assertArrayHasKey('key', $forecast[0]);
            $this->assertArrayHasKey('label', $forecast[0]);
            $this->assertArrayHasKey('icon', $forecast[0]);

            // Verify seconds_until_change is positive
            $this->assertGreaterThan(0, $response->json('world.seconds_until_change'));

            $instance->refresh();
            $this->assertSame($response->json('world.weather.key'), $instance->weather);
            $this->assertNotNull($instance->weather_changed_at);
        } finally {
            CarbonImmutable::setTestNow();
        }
    }
}