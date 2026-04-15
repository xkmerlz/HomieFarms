<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\WeatherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorldController extends Controller
{
    public function __construct(
        private WeatherService $weatherService
    ) {}

    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'world' => $this->weatherService->getWorldStateForUser($request->user()),
        ]);
    }
}