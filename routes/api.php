<?php

use App\Http\Controllers\Api\FarmController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\ShopController;
use Illuminate\Support\Facades\Route;

// All game API routes use session auth (same-origin browser requests)
Route::middleware('web', 'auth')->group(function () {
    // Farm
    Route::get('/farm', [FarmController::class, 'show']);
    Route::post('/farm/till', [FarmController::class, 'till']);
    Route::post('/farm/plant', [FarmController::class, 'plant']);
    Route::post('/farm/water', [FarmController::class, 'water']);
    Route::post('/farm/harvest', [FarmController::class, 'harvest']);
    Route::post('/farm/clear-withered', [FarmController::class, 'clearWithered']);
    Route::post('/farm/build', [FarmController::class, 'build']);
    Route::post('/farm/demolish', [FarmController::class, 'demolish']);
    Route::post('/farm/upgrade', [FarmController::class, 'upgrade']);

    // Inventory
    Route::get('/inventory', [InventoryController::class, 'index']);

    // Shop
    Route::get('/shop', [ShopController::class, 'catalog']);
    Route::post('/shop/buy', [ShopController::class, 'buy']);
    Route::post('/shop/sell', [ShopController::class, 'sell']);
});
