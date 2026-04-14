<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    /**
     * GET /api/inventory — Get the player's full inventory.
     */
    public function index(Request $request): JsonResponse
    {
        $items = InventoryItem::where('user_id', $request->user()->id)
            ->where('quantity', '>', 0)
            ->get()
            ->map(fn ($item) => [
                'type' => $item->item_type,
                'id' => $item->item_id,
                'quantity' => $item->quantity,
            ]);

        return response()->json(['items' => $items]);
    }
}
