<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>HomieFarms</title>

    <!-- Tailwind CSS (CDN, no build) -->
    <script src="https://cdn.tailwindcss.com"></script>

    <!-- Press Start 2P pixel font -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">

    <!-- Game styles -->
    <link rel="stylesheet" href="/css/game.css">

    <!-- CSRF token for API calls -->
    <meta name="csrf-token" content="{{ csrf_token() }}">
</head>
<body class="bg-[#1a1a2e] overflow-hidden m-0 p-0 select-none">

    <!-- PixiJS Canvas Container -->
    <div id="game-container" class="fixed inset-0 z-0">
        <canvas id="game-canvas"></canvas>
        <div id="world-lighting" class="world-overlay-layer" data-phase="{{ $world['time']['phase'] }}"></div>
        <div id="world-weather" class="world-overlay-layer" data-weather="{{ $world['weather']['key'] }}"></div>
    </div>

    <!-- HUD Overlay (top bar) -->
    <div id="hud" class="fixed top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-2 pointer-events-none"
         style="background: linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%);">

        <!-- Left: Coins -->
        <div class="pointer-events-auto flex items-center gap-2">
            <span class="text-[#FFD700] text-[10px]">&#9733;</span>
            <span id="hud-coins" class="text-[#F5E6C8] text-[8px]">{{ $user['coins'] }}g</span>
        </div>

        <!-- Center: Weather + Time -->
        <div class="flex items-center gap-3">
            <span id="hud-weather" class="text-[#F5E6C8] text-[8px]">{{ $world['weather']['icon'] }} {{ strtolower($world['weather']['label']) }}</span>
            <span id="hud-time" class="text-[#7B6BA5] text-[8px]">{{ $world['time']['icon'] }} {{ $world['time']['formatted'] }} {{ strtolower($world['time']['phase_label']) }}</span>
        </div>

        <!-- Right: Username + Logout -->
        <div class="pointer-events-auto flex items-center gap-3">
            <span class="text-[#F5E6C8] text-[8px]">{{ $user['username'] }}</span>
            <form method="POST" action="{{ route('logout') }}" class="inline">
                @csrf
                <button type="submit" class="text-[#8B3A3A] text-[8px] hover:text-[#F5E6C8] transition-colors">
                    [x]
                </button>
            </form>
        </div>
    </div>

    <!-- Compass (top-right) -->
    <div class="fixed top-12 right-3 z-10 pointer-events-none select-none"
         style="font-family: 'Press Start 2P', monospace; line-height: 1.4;">
        <div class="text-[7px] text-[#F5E6C8]/70 text-center" style="text-shadow: 1px 1px 0 rgba(0,0,0,0.8);">
            <div>&nbsp;&nbsp;N↗</div>
            <div>W↖ ◆ E↘</div>
            <div>&nbsp;&nbsp;S↙</div>
        </div>
    </div>

    <!-- Mobile Bottom Nav (visible on small screens only) -->
    <div id="mobile-nav" class="fixed bottom-0 left-0 right-0 z-10 flex items-center justify-around
                                 bg-black/80 py-3 md:hidden pixel-border-top">
        <button class="mobile-nav-btn text-[#F5E6C8] text-[10px] p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                data-panel="inventory" title="Inventory">
            &#9776;
        </button>
        <button class="mobile-nav-btn text-[#F5E6C8] text-[10px] p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                data-panel="shop" title="Shop">
            &#9733;
        </button>
        <button class="mobile-nav-btn text-[#F5E6C8] text-[10px] p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                data-panel="build" title="Build">
            &#9878;
        </button>
        <button class="mobile-nav-btn text-[#F5E6C8] text-[10px] p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                data-panel="chat" title="Chat">
            &#9993;
        </button>
        <button class="mobile-nav-btn text-[#F5E6C8] text-[10px] p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                data-panel="profile" title="Profile">
            &#9679;
        </button>
    </div>

    <!-- Desktop Sidebar Buttons -->
    <div class="fixed left-2 top-1/2 -translate-y-1/2 z-10 hidden md:flex flex-col gap-2">
        <button class="sidebar-btn" data-panel="inventory" title="Inventory">&#9776;</button>
        <button class="sidebar-btn" data-panel="shop" title="Shop">&#9733;</button>
        <button class="sidebar-btn" data-panel="build" title="Build">&#9878;</button>
    </div>

    <!-- Tool Selector (bottom-center on desktop, above mobile nav on mobile) -->
    <div id="toolbar" class="toolbar">
        <button class="tool-btn active" data-tool="cursor" title="Move (cursor)">
            <span class="tool-icon">🖱️</span>
            <span class="tool-label">Move</span>
        </button>
        <button class="tool-btn" data-tool="trim" title="Trim grass (scissors)">
            <span class="tool-icon">✂️</span>
            <span class="tool-label">Trim</span>
        </button>
        <button class="tool-btn" data-tool="water" title="Water crops (watering can)">
            <span class="tool-icon">🚿</span>
            <span class="tool-label">Water</span>
        </button>
        <button class="tool-btn" data-tool="harvest" title="Harvest crops">
            <span class="tool-icon">🌾</span>
            <span class="tool-label">Harvest</span>
        </button>
    </div>

    <!-- Right-Click Context Menu -->
    <div id="ctx-menu" class="hidden fixed z-50">
        <div id="ctx-items" class="ctx-menu-inner"></div>
    </div>

    <!-- Toast Notification -->
    <div id="toast" class="toast hidden"></div>

    <!-- Tile Tooltip (follows cursor) -->
    <div id="tile-tooltip" class="tile-tooltip hidden"></div>

    <!-- Onboarding Overlay (first-time player) -->
    <div id="onboarding" class="onboarding-overlay hidden">
        <div class="onboarding-box">
            <div class="onboarding-title">Welcome to HomieFarms!</div>
            <div class="onboarding-text">
                Your farm plot is marked with <span style="color:#6B9F4A">darker grass tiles</span> and wooden posts.<br><br>
                <b>How to play:</b><br>
                1. <b>Click</b> to move your orb<br>
                2. Select a <b>tool</b> from the bottom bar (or press 1-4)<br>
                3. ✂️ Trim grass → 🌱 Plant seeds → 🚿 Water → 🌾 Harvest!<br><br>
                Check your <b>Inventory</b> (left sidebar) for starter seeds.
            </div>
            <button id="onboarding-close" class="hf-btn" style="margin-top:12px;width:100%">Got it!</button>
        </div>
    </div>

    <!-- Task Checklist HUD -->
    <div id="task-checklist" class="task-checklist hidden">
        <div class="task-title">Getting Started</div>
        <div id="task-list"></div>
    </div>

    <!-- Inventory Panel -->
    <div id="panel-inventory" class="game-panel hidden">
        <div class="panel-header">
            <span>Inventory</span>
            <button class="panel-close" onclick="this.closest('.game-panel').classList.add('hidden')">&times;</button>
        </div>
        <div id="inv-list" class="panel-body">
            <div class="inv-empty">Empty</div>
        </div>
    </div>

    <!-- Shop Panel -->
    <div id="panel-shop" class="game-panel hidden">
        <div class="panel-header">
            <span>Shop</span>
            <button class="panel-close" onclick="this.closest('.game-panel').classList.add('hidden')">&times;</button>
        </div>
        <div class="panel-tabs">
            <button class="panel-tab active" data-tab="seeds">Seeds</button>
            <button class="panel-tab" data-tab="buildings">Buildings</button>
        </div>
        <div id="shop-list" class="panel-body">
            <div class="inv-empty">Loading...</div>
        </div>
    </div>

    <!-- Build Panel -->
    <div id="panel-build" class="game-panel hidden">
        <div class="panel-header">
            <span>Build</span>
            <button class="panel-close" onclick="this.closest('.game-panel').classList.add('hidden')">&times;</button>
        </div>
        <div class="panel-body panel-build-info">
            <p style="color:var(--hf-purple);text-align:center;padding:12px 0;">
                Right-click a farm tile to place buildings.<br>
                Buy buildings from the Shop first!<br>
                Use tools (bottom bar) to trim, water, and harvest.
            </p>
        </div>
    </div>

    <!-- Inject server data for JS -->
    <script>
        window.HF_USER = @json($user);
        window.HF_WORLD = @json($world);
    </script>

    <!-- PixiJS 8 (CDN) -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pixi.js/8.6.6/pixi.min.js"></script>

    <!-- Game engine scripts (order matters) -->
    <script src="/js/engine/api.js"></script>
    <script src="/js/engine/renderer.js"></script>
    <script src="/js/engine/tilemap.js"></script>
    <script src="/js/engine/input.js"></script>
    <script src="/js/engine/pathfinding.js"></script>
    <script src="/js/game.js"></script>
</body>
</html>
