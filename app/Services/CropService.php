<?php

namespace App\Services;

use App\Models\Farm;
use App\Models\Instance;
use App\Models\Tile;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

class CropService
{
    private const WATERED_GROWTH_MULTIPLIER = 1 / 0.9;

    public function __construct(
        private WeatherService $weatherService
    ) {}

    public function getState(Tile $tile, ?Instance $instance = null, ?CarbonInterface $moment = null): ?array
    {
        if (!$tile->crop_type || !$tile->crop_planted_at) {
            return null;
        }

        $crop = Tile::CROPS[$tile->crop_type] ?? null;
        if (!$crop) {
            return null;
        }

        $instance = $instance ?: $this->resolveInstance($tile);
        $now = $moment instanceof CarbonImmutable
            ? $moment
            : ($moment ? CarbonImmutable::instance($moment) : CarbonImmutable::now());
        $plantedAt = CarbonImmutable::instance($tile->crop_planted_at);
        $baseGrowSeconds = $crop['grow_minutes'] * 60;
        $growthUnits = 0.0;
        $stormDamaged = false;

        if ($now->lessThanOrEqualTo($plantedAt)) {
            return [
                'stage' => 0,
                'watered' => $tile->crop_watered,
                'growth_units' => 0.0,
            ];
        }

        $startDay = intdiv($plantedAt->timestamp, WeatherService::GAME_DAY_SECONDS);
        $endDay = intdiv(max($now->timestamp - 1, $plantedAt->timestamp), WeatherService::GAME_DAY_SECONDS);

        for ($dayIndex = $startDay; $dayIndex <= $endDay; $dayIndex++) {
            $segmentStart = max($plantedAt->timestamp, $dayIndex * WeatherService::GAME_DAY_SECONDS);
            $segmentEnd = min($now->timestamp, ($dayIndex + 1) * WeatherService::GAME_DAY_SECONDS);

            if ($segmentEnd <= $segmentStart) {
                continue;
            }

            $weatherKey = $instance
                ? $this->weatherService->getWeatherForDay($instance, $dayIndex)
                : 'sunny';

            if ($instance && $weatherKey === 'stormy' && $this->weatherService->isStormDamageTriggered($tile, $instance, $dayIndex)) {
                $stormDamaged = true;
                break;
            }

            $multiplier = $this->weatherService->getGrowthMultiplier($weatherKey);
            if ($tile->crop_watered || $this->weatherService->isAutoWatering($weatherKey)) {
                $multiplier *= self::WATERED_GROWTH_MULTIPLIER;
            }

            $growthUnits += (($segmentEnd - $segmentStart) / $baseGrowSeconds) * $multiplier;
            if ($growthUnits >= 2.0) {
                break;
            }
        }

        $currentWeather = $instance
            ? $this->weatherService->getWeatherForMoment($instance, $now)
            : 'sunny';
        $effectiveWatered = $tile->crop_watered || $this->weatherService->isAutoWatering($currentWeather);
        $stage = $stormDamaged || $growthUnits >= 2.0
            ? -1
            : $this->resolveStage($growthUnits);

        return [
            'stage' => $stage,
            'watered' => $effectiveWatered,
            'growth_units' => $growthUnits,
        ];
    }

    private function resolveInstance(Tile $tile): ?Instance
    {
        $farm = $tile->relationLoaded('farm')
            ? $tile->farm
            : $tile->farm()->with('instance')->first();

        if (!$farm instanceof Farm) {
            return null;
        }

        return $farm->relationLoaded('instance')
            ? $farm->instance
            : $farm->instance()->first();
    }

    private function resolveStage(float $growthUnits): int
    {
        if ($growthUnits >= 1.0) {
            return 3;
        }

        if ($growthUnits >= 0.66) {
            return 2;
        }

        if ($growthUnits >= 0.33) {
            return 1;
        }

        return 0;
    }
}