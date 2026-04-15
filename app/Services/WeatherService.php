<?php

namespace App\Services;

use App\Models\Instance;
use App\Models\Tile;
use App\Models\User;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

class WeatherService
{
    public const GAME_DAY_SECONDS = 3600;

    private const WEATHER = [
        'sunny' => [
            'label' => 'Sunny',
            'icon' => '☀',
            'effect' => 'Normal growth speed',
            'weight' => 50,
            'growth_multiplier' => 1.0,
            'auto_water' => false,
        ],
        'cloudy' => [
            'label' => 'Cloudy',
            'icon' => '☁',
            'effect' => 'Normal growth speed',
            'weight' => 20,
            'growth_multiplier' => 1.0,
            'auto_water' => false,
        ],
        'rainy' => [
            'label' => 'Rainy',
            'icon' => '🌧',
            'effect' => 'Crops grow 25% faster and do not need watering',
            'weight' => 20,
            'growth_multiplier' => 1.25,
            'auto_water' => true,
        ],
        'stormy' => [
            'label' => 'Stormy',
            'icon' => '⛈',
            'effect' => 'Crops grow 25% faster with a small damage risk',
            'weight' => 5,
            'growth_multiplier' => 1.25,
            'auto_water' => true,
        ],
        'drought' => [
            'label' => 'Drought',
            'icon' => '🏜',
            'effect' => 'Crops grow 25% slower',
            'weight' => 5,
            'growth_multiplier' => 0.75,
            'auto_water' => false,
        ],
    ];

    public function getWorldStateForUser(User $user, ?CarbonInterface $moment = null): array
    {
        return $this->getWorldState($this->getInstanceForUser($user), $moment);
    }

    public function getInstanceForUser(User $user): Instance
    {
        if ($user->instance_id) {
            return $user->instance()->firstOrFail();
        }

        $instance = Instance::firstOrCreate(
            ['slug' => 'main'],
            ['name' => 'Main Village', 'max_players' => 20]
        );

        $user->forceFill(['instance_id' => $instance->id])->save();

        return $instance;
    }

    public function getWorldState(Instance $instance, ?CarbonInterface $moment = null): array
    {
        $now = $this->immutableMoment($moment);
        $gameMinutes = $this->getGameMinutes($now);
        $phase = $this->getDayPhase($gameMinutes);
        $weatherKey = $this->getWeatherForMoment($instance, $now);
        $weather = $this->getWeatherDefinition($weatherKey);
        $changeAt = $this->getCurrentDayStart($now);

        $instance->forceFill([
            'weather' => $weatherKey,
            'weather_changed_at' => $changeAt,
        ]);

        if ($instance->isDirty(['weather', 'weather_changed_at'])) {
            $instance->save();
        }

        $dayIndex = $this->getDayIndex($now);
        $secondsUntilChange = $this->getNextDayStart($now)->timestamp - $now->timestamp;

        $forecast = [];
        for ($i = 1; $i <= 2; $i++) {
            $fKey = $this->getWeatherForDay($instance, $dayIndex + $i);
            $fDef = $this->getWeatherDefinition($fKey);
            $forecast[] = [
                'key' => $fKey,
                'label' => $fDef['label'],
                'icon' => $fDef['icon'],
            ];
        }

        return [
            'weather' => [
                'key' => $weatherKey,
                'label' => $weather['label'],
                'icon' => $weather['icon'],
                'effect' => $weather['effect'],
            ],
            'time' => [
                'minutes' => $gameMinutes,
                'hour' => intdiv($gameMinutes, 60),
                'minute' => $gameMinutes % 60,
                'formatted' => sprintf('%02d:%02d', intdiv($gameMinutes, 60), $gameMinutes % 60),
                'phase' => $phase['key'],
                'phase_label' => $phase['label'],
                'icon' => $phase['icon'],
            ],
            'next_weather_change_at' => $this->getNextDayStart($now)->toIso8601String(),
            'seconds_until_change' => $secondsUntilChange,
            'forecast' => $forecast,
        ];
    }

    public function getGameMinutes(?CarbonInterface $moment = null): int
    {
        $now = $this->immutableMoment($moment);
        $secondsIntoDay = $this->getSecondsIntoDay($now);

        return (int) floor(($secondsIntoDay / self::GAME_DAY_SECONDS) * 1440) % 1440;
    }

    public function getDayPhase(int $gameMinutes): array
    {
        $hour = intdiv($gameMinutes, 60);

        if ($hour >= 6 && $hour < 10) {
            return ['key' => 'dawn', 'label' => 'Dawn', 'icon' => '🌅'];
        }

        if ($hour >= 10 && $hour < 18) {
            return ['key' => 'day', 'label' => 'Day', 'icon' => '☀'];
        }

        if ($hour >= 18 && $hour < 22) {
            return ['key' => 'dusk', 'label' => 'Dusk', 'icon' => '🌇'];
        }

        return ['key' => 'night', 'label' => 'Night', 'icon' => '🌙'];
    }

    public function getWeatherForMoment(Instance $instance, ?CarbonInterface $moment = null): string
    {
        return $this->getWeatherForDay($instance, $this->getDayIndex($moment));
    }

    public function getWeatherForDay(Instance $instance, int $dayIndex): string
    {
        $roll = $this->normalizedRoll($instance->id, $dayIndex, 'weather');
        $threshold = 0.0;

        foreach (self::WEATHER as $key => $weather) {
            $threshold += $weather['weight'] / 100;
            if ($roll < $threshold) {
                return $key;
            }
        }

        return 'sunny';
    }

    public function getWeatherDefinition(string $weatherKey): array
    {
        return self::WEATHER[$weatherKey] ?? self::WEATHER['sunny'];
    }

    public function getGrowthMultiplier(string $weatherKey): float
    {
        return $this->getWeatherDefinition($weatherKey)['growth_multiplier'];
    }

    public function isAutoWatering(string $weatherKey): bool
    {
        return $this->getWeatherDefinition($weatherKey)['auto_water'];
    }

    public function isStormDamageTriggered(Tile $tile, Instance $instance, int $dayIndex): bool
    {
        $tileSeed = $tile->id ?: sprintf('%s:%s:%s', $tile->farm_id, $tile->q, $tile->r);

        return $this->normalizedRoll($instance->id, $dayIndex, 'storm:' . $tileSeed) < 0.05;
    }

    public function getDayIndex(?CarbonInterface $moment = null): int
    {
        $now = $this->immutableMoment($moment);

        return intdiv($now->timestamp, self::GAME_DAY_SECONDS);
    }

    public function getCurrentDayStart(?CarbonInterface $moment = null): CarbonImmutable
    {
        $now = $this->immutableMoment($moment);
        $timestamp = $now->timestamp - $this->getSecondsIntoDay($now);

        return CarbonImmutable::createFromTimestamp($timestamp, $now->getTimezone());
    }

    public function getNextDayStart(?CarbonInterface $moment = null): CarbonImmutable
    {
        return $this->getCurrentDayStart($moment)->addSeconds(self::GAME_DAY_SECONDS);
    }

    private function getSecondsIntoDay(CarbonImmutable $moment): int
    {
        return (($moment->timestamp % self::GAME_DAY_SECONDS) + self::GAME_DAY_SECONDS) % self::GAME_DAY_SECONDS;
    }

    private function immutableMoment(?CarbonInterface $moment = null): CarbonImmutable
    {
        if ($moment instanceof CarbonImmutable) {
            return $moment;
        }

        return $moment
            ? CarbonImmutable::instance($moment)
            : CarbonImmutable::now();
    }

    private function normalizedRoll(int $instanceId, int $dayIndex, string $salt): float
    {
        $hash = sha1(sprintf('%d:%d:%s', $instanceId, $dayIndex, $salt));
        $value = hexdec(substr($hash, 0, 8));

        return $value / 0xFFFFFFFF;
    }
}