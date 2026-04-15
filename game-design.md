# HomieFarms — Game Design Document

## Overview

**HomieFarms** is a multiplayer isometric browser-based farming game. Players log in via Discord, claim a farm plot in a shared village, grow crops, build structures, trade with others, and expand their homestead — all rendered in a cozy pixel-art style.

**Target platforms:** Desktop & mobile browsers (touch-first design)
**Art style:** Pixel art, isometric projection (Philtacular's Cozy Isometric Tilemap)
**Vibe:** Cozy but goal-driven — light progression pressure with quests and milestones

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend | **PHP 8.x (Laravel)** | API, auth, game logic, task scheduling |
| Database | **SQLite** | Simple start, single-file persistence |
| Real-time | **Laravel Reverb** | WebSocket server for multiplayer sync |
| Rendering | **PixiJS 8 (CDN)** | Isometric tile engine, sprites, animations |
| UI | **HTML + Tailwind CSS (CDN)** | Pixel-accented overlays on top of canvas |
| Font | **Press Start 2P (Google Fonts CDN)** | Pixel font for all UI text |
| Auth | **Discord OAuth2** | Login via Discord, Laravel Socialite |

**No npm, no bundlers, no node_modules.** All frontend dependencies load via CDN `<script>`/`<link>` tags. JavaScript is vanilla — plain `.js` files served directly by Laravel.

---

## Architecture

```
Browser (Client)                          Server (Laravel)
┌─────────────────────┐                  ┌─────────────────────┐
│  HTML + Tailwind UI  │                  │  Routes / Controllers│
│  (panels, HUD, chat) │◄── REST API ───►│  (API endpoints)     │
│                      │                  │                      │
│  PixiJS Canvas       │◄─ WebSocket ───►│  Laravel Reverb      │
│  (isometric world)   │   (Reverb)      │  (broadcast events)  │
│                      │                  │                      │
│  Game Client JS      │                  │  Game Logic          │
│  (input, rendering)  │                  │  (crops, economy,    │
│                      │                  │   world state)       │
└─────────────────────┘                  │                      │
                                         │  Task Scheduler      │
                                         │  (crop ticks, weather│
                                         │   day/night cycle)   │
                                         │                      │
                                         │  SQLite Database     │
                                         └─────────────────────┘
```

### Principle: Authoritative Server

The browser is a **dumb rendering client**. It sends player intents (move, plant, harvest, buy) to the server. The server validates, updates state, and broadcasts results. The client never decides game outcomes — it only draws what the server tells it.

This prevents cheating, keeps state consistent across players, and means the JS code stays simple.

---

## World Design

### Compass Directions (Isometric)

In the isometric view, compass directions map as follows:

| Direction | Screen Direction | Axial Axis |
|-----------|-----------------|------------|
| **North** | Top-right ↗ | −r direction |
| **South** | Bottom-left ↙ | +r direction |
| **East** | Bottom-right ↘ | +q direction |
| **West** | Top-left ↖ | −q direction |

A small compass indicator is displayed at the top-right of the screen for orientation.

### Village Layout

The world is a linear **village** along a north–south road. The village center sits in the middle, with player farms extending along the road in both directions. East and west of the road are reserved for future community expansion.

```
 North ↗                                          ↗ North
              ┌─────┐ ╔═══════════╗
              │ H-N4│ ║  Farm N4  ║
              └─────┘ ╠═══════════╣
              ┌─────┐ ║  Farm N3  ║
              │ H-N3│ ╠═══════════╣
              └─────┘ ║  Farm N2  ║
              ┌─────┐ ╠═══════════╣
              │ H-N2│ ║  Farm N1  ║
              └─────┘ ╚═════╤═════╝
              ┌─────┐       │road
              │ H-N1│       │
              └─────┘       │
  ╔════════╗  ╔═~═══════╧══════~═╗  ╔════════╗
  ║  EAST  ║  ║~ VILLAGE CENTER ~║  ║  WEST  ║
  ║(future)║──║  12×12 plaza     ║──║(farms) ║
  ╚════════╝  ╚═~═══════╤══════~═╝  ╚════════╝
                  water  │road  water
              ┌─────┐   │
              │ H-S1│   │
              └─────┘ ╔═╧══════════╗
              ┌─────┐ ║  Farm S1   ║
              │ H-S2│ ╠════════════╣
              └─────┘ ║  Farm S2   ║
              ┌─────┐ ╠════════════╣
              │ H-S3│ ║  Farm S3   ║
              └─────┘ ╠════════════╣
              ┌─────┐ ║  Farm S4   ║
              │ H-S4│ ╚════════════╝
              └─────┘
 South ↙                                         ↙ South
```

**H-xx = Farmer's House (4×3 tiles, decorative, future-enterable)**
**~ = Water channel (1-tile wide border on west & east edges of plaza)**

#### Layout Details

- **Village Center (12×12 tiles):** Shared plaza with a market stall (trading), notice board (quests), and decorative elements. Non-buildable, designed by the game. Surrounded by a 4-tile border: 1-tile dark-stone wall, 2-tile water moat, 1-tile damp grass buffer (grass tinted darker dynamically by proximity to water). Stone bridges at the road positions (q=22–23) cross the moat for access.
- **North–South Road:** The main road runs through the center (2 tiles wide, q=22–23), connecting all farm plots. Non-buildable, auto-generated.
- **Farm Zones (west of road):** Each player gets a dedicated 16×16 reserved plot WEST (↖) of the road. Only the owner can build/plant here. Other players can visit and help (water/harvest for bonus).
- **Farmer's House (4×3 tiles):** Each farm has a house plot between the farmland and the road (q=18–21). The decorative house occupies the full 4×3 footprint. A 4×2 dirt path sits directly south of the house so its long edge runs along the house and its short east edge meets the 2-tile road. Purely decorative for now, but designed to be enterable in a future milestone.
- **Farm Spacing:** 4-tile gap between each farm plot along the road.
- **Farm Naming:** Farms are named by direction and position — S1 (first south), S2 (second south), N1 (first north), etc. Up to 4 farms per direction, 8 total per instance.
- **Starting Position:** The starting 8×8 area is placed at the corner closest to the village center and road (NE corner for south farms, SE corner for north farms). Expansion grows away from the village.
- **East Expansion (future):** Reserved flat land east (↘) of the road for future community buildings, shared facilities, and town growth features (not player-owned).

### Instance System

Each "village" is an **instance**. For now, there is one `main` instance. The data model supports multiple instances for future scaling:

- `instances` table: id, name, slug, max_players, created_at
- `farms` table has an `instance_id` foreign key
- Instance selection menu is a future feature — for now, all players join `main`

### Map Coordinates

- **Tile-based grid** using axial coordinates `(q, r)` for the isometric diamond layout
- **Grid size:** 42 (q) × 172 (r)
- The village center plaza occupies a 12×12 block at q=17–28, r=80–91 with water channels along the west (q=17) and east (q=28) edges
- The north–south road runs at q=22–23 (2 tiles wide) for the full length of the map
- Farm zones are WEST (↖) of the road at q=2–17 (16 tiles wide)
- Houses sit between farms and road at q=18–21 (4 tiles wide)
- The starting 8×8 farm area is placed at the NE corner (south farms) or SE corner (north farms) — the corner closest to both the road and village center
- East side (q=24–39) is reserved for future expansion
- Farm slots: S1 (r=92), S2 (r=112), S3 (r=132), S4 (r=152), N1 (r=64), N2 (r=44), N3 (r=24), N4 (r=4)

### Terrain Elevation (Future)

Each tile has an **elevation level** from 0 to 4:

| Level | Name | Description |
|-------|------|-------------|
| 0 | Waterlogged | Lakebeds, river banks, marshes — can hold water tiles |
| 1 | Low ground | Riverside paths, shaded areas |
| 2 | Ground | Default terrain — farms, roads, village center |
| 3 | Hillside | Elevated terrain, windswept |
| 4 | Peak | Hilltops, lookout points |

**Movement rules:**
- Players can walk freely between tiles that differ by **±1 level** (natural slopes)
- A **2+ level difference** is a cliff — impassable by default
- **Ladders:** A placeable building that can be built on a cliff face to unlock passage across a 2-level gap. Requires coins and crafting materials
- Pathfinding respects elevation constraints alongside tile walkability

**Water features:**
- Water tiles can exist at **any elevation** (ponds on plateaus, highland lakes)
- **Waterfalls:** A water tile at a higher elevation adjacent to a lower water tile renders as a waterfall
- **Rivers:** Flowing water connecting different elevation levels, carving paths through terrain
- **Ponds/lakes:** Still water at any elevation — decorative, future fishing
- Water is always unwalkable (except via bridges)

**Bridges:**
- Multi-level bridges that span gaps (e.g., a bridge at level 2 crossing over a river valley at level 0)
- Bridges are walkable tiles at a specified elevation, independent of the terrain below
- Built by the player or pre-placed in the world layout

**Crop growth by elevation:**

| Level | Growth modifier | Notes |
|-------|----------------|-------|
| 0–1 | 75% speed | Waterlogged / shaded — too damp for most crops |
| 2 | 100% speed | Optimal — ideal for basic crops (lettuce, carrots, tomatoes) |
| 3–4 | 75% speed (without well) | Exposed / drought risk — needs a well for full speed |

- **Specialty crops:** Some crops prefer non-optimal elevations:
  - Certain crops thrive in low, damp areas (level 0–1)
  - Certain crops prefer high, exposed terrain (level 3–4)
  - This creates incentive to farm across multiple elevations

**Building restrictions:**
- Most buildings can be placed on any walkable elevation
- Some buildings are **height-restricted** and require specific elevations:
  - *Windmill:* Level 3+ (needs wind exposure)
  - *Well:* Any level (counteracts drought penalty at 3–4)
  - *Dock:* Must be adjacent to water
- All buildings require **flat ground** — at least the footprint tiles must be at the same elevation

**Rendering:**
- Higher tiles render with a vertical offset (stacked cube appearance)
- The isometric depth sort accounts for elevation so tiles layer correctly
- Cliffs render as tall vertical faces between elevation differences of 2+
- Water at different heights creates visible level boundaries

> **Current state:** Not yet implemented. All tiles are currently at the same elevation. The cube sides in the placeholder tiles are purely visual depth. Elevation will be added in a future milestone.

---

## Farm System

### Farm Zones

When a player first joins, they are assigned a **farm zone** — a rectangular area of tiles near the village center.

- **Starting size:** 8×8 tiles (64 tiles)
- **Expandable:** Players can purchase adjacent land expansions with coins
- **Reserved area:** Each player reserves a 16×16 plot (256 tiles), but only a portion is unlocked initially
- **Expansion tiers:**
  - **Small (Level 1):** 8×8 (64 tiles) — starting size, free
  - **Medium (Level 2):** 16×8 (128 tiles) — first expansion
  - **Large (Level 3):** 16×16 (256 tiles) — full plot unlocked
- **Plot spots:** Within the farm zone, there are **pre-defined plot spots** where the player can build farm plots, place buildings, or set decorations. The player clicks a spot to build on it.

### Terrain

Each tile has a terrain type:

| Terrain | Buildable | Walkable | Notes |
|---------|-----------|----------|-------|
| Grass | Yes | Yes | Default farm terrain |
| Dirt path | No | Yes | Roads, auto-generated |
| Stone path | No | Yes | Village center paving |
| Tilled soil | — | Yes | Created from grass, holds crops |
| Water | No | No | Decorative (future: fishing?) |

---

## Crop System

### Crops (MVP — 5 types)

| Crop | Seed Cost | Grow Time | Harvest Value | Notes |
|------|-----------|-----------|---------------|-------|
| Lettuce | 5g | 10 min | 15g | Tutorial crop, fast |
| Carrots | 10g | 30 min | 35g | Reliable early earner |
| Tomatoes | 20g | 2 hours | 70g | Medium tier |
| Pumpkins | 50g | 6 hours | 180g | Overnight crop |
| Starfruit | 100g | 24 hours | 400g | Premium, slow |

### Growth Stages

Each crop goes through 4 visual stages:
1. **Planted** — just soil with a seed marker
2. **Sprouting** — small green shoot
3. **Growing** — half-grown plant
4. **Harvestable** — full-grown, visually distinct, ready to pick

Growth is **real-time** — crops grow while the player is offline. The server calculates the current stage based on `planted_at` timestamp vs. current time, modified by weather effects.

### Crop Lifecycle

1. Player buys seeds from shop (spends coins)
2. Player tills a grass tile → becomes tilled soil
3. Player plants seeds on tilled soil → crop begins growing
4. (Optional) Player or visitor waters the crop → reduces grow time by 10%
5. Crop reaches harvestable stage → player clicks to harvest
6. Player receives the crop item in inventory
7. Player sells crop at market or trades with another player

### Withering

If a crop is harvestable but not picked within **2× its grow time**, it withers and is lost. This adds light urgency without being punishing — a 10-minute lettuce gives you 20 minutes to harvest, while a 24-hour starfruit gives 48 hours.

---

## Economy

### Currency

Single currency: **Gold coins (g)**

### Starting Balance

New players begin with **100g** — enough to buy initial seeds and a couple of structures.

### Income Sources

- Selling crops at the market (NPC buy price)
- Trading crops to other players (player-set prices)
- Helping other players (watering/harvesting bonus: 5% of crop value)
- Quest rewards

### Sinks

- Buying seeds
- Building structures
- Upgrading buildings
- Expanding farm land
- Buying decorations

---

## Buildings & Structures

### Functional Buildings

| Building | Cost | Effect | Upgrade |
|----------|------|--------|---------|
| Farm Plot | 10g | 2×2 area for planting crops | Tier 2: auto-water (500g) |
| Silo | 100g | Increases inventory capacity +20 | Tier 2: +40 (300g) |
| Market Stall | 200g | Sell crops for 10% more than base | Tier 2: 20% more (600g) |
| Well | 50g | Waters adjacent crops automatically | Tier 2: larger radius (250g) |

### Decorative Items

Fences, flower beds, paths, barrels, crates, lanterns — pulled from the tileset. Cost 5-50g each. No gameplay effect, purely aesthetic.

### Placement Rules

- Buildings snap to the tile grid
- Buildings occupy a defined footprint (e.g., 2×2, 1×1)
- Cannot overlap with other buildings or crops
- Must be within the player's farm zone

---

## Multiplayer

### Presence

- Players appear as **floating orbs** on the isometric map
- Orbs are visible to all players in the same instance
- Position updates broadcast via WebSocket (Laravel Reverb)
- Orb shows the player's Discord username on hover

### Interaction

| Feature | How it works |
|---------|-------------|
| **See each other** | Real-time position sync, orbs visible on map |
| **Chat** | Text chat overlay, global + proximity-based |
| **Visit farms** | Walk into another player's farm zone freely |
| **Help** | Water or harvest another player's crops for a small coin bonus |
| **Trade** | Marketplace board in village center — async buy/sell listings |

### Trade System (MVP)

- **Marketplace board:** Located at the village center
- Players post **sell listings**: item, quantity, price per unit
- Other players browse and buy listings
- Async — seller doesn't need to be online
- 5% transaction fee (coin sink)

---

## Day/Night & Weather

### Day/Night Cycle

- **Cycle length:** 1 real-time hour = 1 game day
- **Phases:** Dawn (10 min) → Day (20 min) → Dusk (10 min) → Night (20 min)
- **Effect:** Cosmetic lighting changes on the PixiJS canvas (tint overlay)
- Night: slightly darker, warm lantern glows on buildings
- No gameplay difference between day and night (for MVP)

### Weather System

Weather changes every game day (every hour), randomly selected with weighted probability:

| Weather | Probability | Effect |
|---------|------------|--------|
| Sunny | 50% | Normal growth speed |
| Cloudy | 20% | Normal growth speed |
| Rainy | 20% | Crops grow **25% faster**, no need to water |
| Stormy | 5% | Crops grow **25% faster**, but 5% chance of crop damage |
| Drought | 5% | Crops grow **25% slower** |

Weather is server-authoritative and synced to all clients.

---

## Player Character (Orb)

### MVP: Floating Orb

- Simple glowing circle with a soft particle trail
- Color: Discord accent color or random pastel
- Moves smoothly across the isometric grid
- Click/tap a tile → orb pathfinds and glides to it
- Shows Discord username label above
- Drop shadow ellipse beneath the orb, reacts to bob animation

### Movement & Pathfinding

- **Walk speed:** Constant velocity (1.8 px/frame at 60fps), not lerp — the orb moves at a fixed pace regardless of distance
- **Pathfinding:** A* algorithm (4-directional, axial grid neighbors) with binary min-heap for the open set
- **Walkability:** Each tile type has a walkable flag. Water tiles are unwalkable; grass, dirt, stone, farm plots are walkable
- **Path-following:** On click, the full A* path is computed. The orb walks waypoint-to-waypoint at constant speed. Clicking a new tile mid-walk recalculates the path from the current tile
- **Unwalkable click:** Clicking an unwalkable tile does nothing (no path computed)
- **Depth sorting:** The orb's render depth (zIndex) is derived from its current screen Y position, not its target tile. This ensures smooth depth transitions during movement — the orb never pops behind tiles it's walking past
- **Height levels:** All tiles are currently at the same elevation. The isometric cube depth is purely visual. Future milestones may add terrain elevation

### Future: Full Characters

The orb is a placeholder. The system is designed so the orb can later be swapped for a sprite-based character with:
- Walk animations (4 or 8 directions)
- Customizable appearance
- Emotes

The movement/pathfinding system stays the same — only the rendering changes.

---

## Controls

### Desktop

| Input | Action |
|-------|--------|
| Left-click tile | Move orb / interact |
| Right-click tile | Context menu (plant, harvest, build, info) |
| Scroll wheel | Zoom in/out |
| Middle-click drag | Pan camera |
| Keyboard `I` | Toggle inventory |
| Keyboard `M` | Toggle map |
| Keyboard `Enter` | Focus chat input |
| Keyboard `Esc` | Close any open panel |

### Mobile (Touch-First)

| Input | Action |
|-------|--------|
| Tap tile | Move orb / interact |
| Long-press tile | Context menu |
| Pinch | Zoom in/out |
| Two-finger drag | Pan camera |
| Bottom nav bar | Inventory, shop, chat, profile |

---

## UI Design

### Pixel-Accented Style

- **Font:** Press Start 2P everywhere, crisp at small sizes
- **Borders:** CSS pixel-shadow technique (stacked `box-shadow` offsets) — chunky retro frames
- **Colors:** Pulled from the tileset palette — warm browns (#5C3A1E), earthy reds (#8B3A3A), soft greens (#4A7A3A), purple accents (#7B6BA5), cream/parchment backgrounds (#F5E6C8)
- **Panels:** Semi-transparent dark backgrounds (`bg-black/80`) so the game world shows through
- **Buttons:** Flat pixel-art style, color shift on hover/tap, no gradients
- **Animations:** Snappy slide transitions, no slow fades
- **Rendering:** `image-rendering: pixelated` on canvas, `-webkit-font-smoothing: none` on pixel font

### UI Panels

| Panel | Trigger | Content |
|-------|---------|---------|
| **HUD** | Always visible | Coins, weather icon, clock (day/night), player count |
| **Inventory** | `I` key / bottom nav | Grid of owned items (crops, seeds, materials) |
| **Shop** | Click shop building | Buy seeds, buildings, decorations. Tabbed interface |
| **Marketplace** | Click market board | Player trade listings. Post sell orders, browse, buy |
| **Build Mode** | Button in HUD | Select a structure/decoration, preview placement, confirm |
| **Chat** | `Enter` / bottom nav | Semi-transparent chat overlay, scrollable |
| **Profile** | Click own orb / nav | Discord info, stats, farm overview |
| **Settings** | Gear icon | Sound, notifications, controls |

### Mobile Layout

- Canvas fills full viewport
- **Bottom navigation bar** (fixed): 5 icon buttons — Inventory, Shop, Build, Chat, Profile
- Panels slide up from bottom as **sheets** (50-80% screen height)
- HUD elements (coins, weather, clock) as a thin top bar
- All tap targets minimum 44×44px

---

## Data Model (SQLite)

### Core Tables

**instances**
- id, name, slug, max_players, weather, weather_changed_at, game_time, created_at

**users**
- id, discord_id, discord_username, discord_avatar, coins, instance_id, last_login, created_at

**farms**
- id, user_id, instance_id, zone_q, zone_r, zone_width, zone_height, created_at

**tiles**
- id, farm_id, q, r, terrain_type, structure_type, structure_tier, crop_type, crop_planted_at, crop_watered, created_at, updated_at

**inventory**
- id, user_id, item_type, item_id, quantity

**market_listings**
- id, seller_id, item_type, item_id, quantity, price_per_unit, created_at

**quests** (future)
- id, user_id, quest_type, progress, completed, created_at

---

## File Structure

```
homiefarms/
├── _resources/                    # Source art assets (not served)
│   └── isometric_cozy_v230729/
├── app/                           # Laravel application
│   ├── Http/Controllers/
│   │   ├── AuthController.php     # Discord OAuth flow
│   │   ├── GameController.php     # Main game page
│   │   ├── Api/
│   │   │   ├── FarmController.php # Farm CRUD, planting, harvesting
│   │   │   ├── PlayerController.php
│   │   │   ├── MarketController.php
│   │   │   └── WorldController.php
│   ├── Models/
│   │   ├── User.php
│   │   ├── Farm.php
│   │   ├── Tile.php
│   │   ├── Instance.php
│   │   ├── MarketListing.php
│   │   └── Inventory.php
│   ├── Events/                    # WebSocket broadcast events
│   │   ├── PlayerMoved.php
│   │   ├── CropUpdated.php
│   │   ├── TileChanged.php
│   │   └── ChatMessage.php
│   ├── Console/Commands/
│   │   └── GameTick.php           # Scheduled: weather, crop checks
│   └── Services/
│       ├── CropService.php        # Growth calculation, harvesting
│       ├── WeatherService.php     # Weather generation
│       └── FarmService.php        # Zone assignment, expansion
├── public/
│   ├── index.php                  # Laravel entry point
│   ├── js/
│   │   ├── game.js                # Main game client bootstrap
│   │   ├── engine/
│   │   │   ├── renderer.js        # PixiJS setup, camera, viewport
│   │   │   ├── tilemap.js         # Isometric tile rendering
│   │   │   ├── input.js           # Mouse, touch, keyboard handling
│   │   │   ├── pathfinding.js     # A* for orb movement
│   │   │   └── network.js         # WebSocket + REST API client
│   │   ├── entities/
│   │   │   ├── orb.js             # Player orb rendering + animation
│   │   │   ├── crop.js            # Crop sprite + growth stages
│   │   │   └── building.js        # Building sprites
│   │   └── ui/
│   │       ├── hud.js             # Coin counter, clock, weather
│   │       ├── panels.js          # Panel open/close management
│   │       └── chat.js            # Chat overlay logic
│   ├── css/
│   │   └── game.css               # Custom pixel styles, overrides
│   ├── sprites/
│   │   ├── tiles/                 # Exported individual tile PNGs
│   │   ├── crops/                 # Crop stage sprites
│   │   ├── buildings/             # Building sprites
│   │   └── ui/                    # UI icons (coin, weather, etc.)
│   └── audio/                     # (future) Sound effects, music
├── resources/views/
│   └── game.blade.php             # Main game HTML template
├── routes/
│   ├── web.php                    # Auth routes, game page
│   └── api.php                    # Game API endpoints
├── database/migrations/           # SQLite schema
├── game-design.dm                      # This document
├── .instructions.md               # Agentic coding instructions
└── .env                           # Config (Discord keys, DB path)
```

---

## MVP Milestones

### M1: Foundation
- [x] Laravel project scaffolded
- [x] SQLite database + migrations
- [ ] Discord OAuth2 login (redirect, callback, session)
- [x] game.blade.php with PixiJS canvas + Tailwind
- [x] Basic isometric tile renderer (static grass grid)

### M2: World & Movement
- [x] Tileset exported to individual sprites
- [x] Isometric tilemap rendering from server data
- [x] Camera pan and zoom (mouse + touch)
- [x] Orb character with click-to-move pathfinding
- [x] Village center + road layout defined

### M3: Farming
- [x] Farm zone assignment on first login
- [x] Tilling, planting, growing, harvesting flow
- [x] Crop growth calculation (server-side, real-time)
- [x] Inventory system (seeds, harvested crops)
- [x] Shop NPC/building to buy seeds and sell crops

### M4: Buildings & UI
- [x] Build mode — place structures on farm tiles
- [x] Building upgrades (tiered)
- [x] Full HUD (coins, weather, clock)
- [x] Inventory panel
- [x] Shop panel
- [x] Mobile-responsive layout + bottom nav

### M5: Multiplayer & Polish
- [ ] Laravel Reverb WebSocket setup
- [ ] Real-time player position sync (orbs visible)
- [ ] Chat system (global)
- [ ] Farm visiting (walk into other zones)
- [ ] Helping mechanic (water/harvest others' crops)
- [ ] Marketplace board (async trading)
- [ ] Day/night cycle (visual)
- [ ] Weather system (affects crops)
- [ ] Withering mechanic

### M6: World Feedback & Readability
- [ ] Weather polish pass — rain and storm particle effects, stronger atmospheric overlays
- [ ] Night lighting pass — warmer building glows / lantern-style highlights during night phases
- [ ] Forecast HUD — show current weather, next weather change countdown, and simple upcoming forecast info
- [ ] Crop timer UI — show per-crop remaining growth time in hours, minutes, and seconds where useful (tooltip, panel, or tile overlay)

### M7: Sprite Rework
- [x] Audit and replace procedurally-generated crop sprites with hand-drawn or tileset-sourced art (3 existing + prep for 2 new: tomatoes, pumpkins)
- [ ] Rework building sprites (well, silo, market) for visual consistency and better isometric depth
- [x] Fix water tile sizing (64×64 → 32×32) and add water animation frames
- [x] Add critter sprites from `_resources/critters/` (badger, boar, stag, wolf) as ambient wandering NPCs
- [ ] Replace player orb with proper character sprite (idle + walk animation frames)
- [ ] Create sprite atlas / spritesheet for batched rendering (consolidate individual PNGs)

### M8: Terrain Rework
- [ ] Auto-tiling / edge blending — smooth transitions between grass, tilled, stone, path, water
- [x] Frustum culling — only render tiles visible on screen (currently all 42×172 = 7,224 tiles rendered)
- [ ] Terrain elevation system — `elevation` column on tiles, stacked isometric cubes, pathfinding cost
- [ ] Seasonal terrain variants — spring/summer/fall/winter grass and tree tints
- [x] Decorative terrain objects from Cozy tileset (barrels, crates, flowers, fences, trees, stumps)
- [x] Sprite pooling — reuse PIXI.Sprite instances for off-screen tiles instead of destroying/recreating

---

## Future Ideas (Post-MVP)

- Full character sprites replacing the orb
- Seasons (spring/summer/fall/winter) with seasonal crops
- Animals (chickens, cows — from the tileset's sprites)
- Fishing at water tiles
- Crafting (combine crops into higher-value products)
- Quests / milestones / achievements
- Multiple instances with instance browser
- Leaderboards
- Sound effects and ambient music
- Notifications (Discord webhook: "Your pumpkins are ready!")
