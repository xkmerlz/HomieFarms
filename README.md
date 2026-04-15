# HomieFarms

<div align="center">

<h3>A cozy multiplayer isometric farming prototype built with Laravel, PixiJS, and Discord auth.</h3>

<p>
	<img alt="PHP 8.3+" src="https://img.shields.io/badge/PHP-8.3%2B-5C6BC0?style=for-the-badge&logo=php&logoColor=white">
	<img alt="Laravel 13" src="https://img.shields.io/badge/Laravel-13-FF5A36?style=for-the-badge&logo=laravel&logoColor=white">
	<img alt="PixiJS 8" src="https://img.shields.io/badge/PixiJS-8-8E44AD?style=for-the-badge">
	<img alt="SQLite" src="https://img.shields.io/badge/SQLite-ready-3D9970?style=for-the-badge&logo=sqlite&logoColor=white">
	<img alt="Discord Login" src="https://img.shields.io/badge/Discord-OAuth2-5865F2?style=for-the-badge&logo=discord&logoColor=white">
</p>

<p><strong>Grow crops. Build up your plot. Drift around a shared village as a glowing orb.</strong></p>

</div>

---

## The Pitch

HomieFarms is a browser-based farming game prototype with a shared isometric world, player-owned farm zones, real-time crop growth, and a deliberately lightweight stack. The backend is authoritative Laravel, the client is plain JavaScript rendered with PixiJS, and the UI leans into chunky pixel styling.

This repository already includes a playable single-player gameplay slice:

- Discord login and session auth
- Automatic farm assignment inside a shared village layout
- Isometric tile rendering with camera pan and zoom
- Orb movement with pathfinding
- Tool-based farming loop: trim, plant, water, harvest
- Inventory and shop panels
- Placeable and upgradeable buildings
- Mobile-aware HUD and controls

Multiplayer sync, chat, weather, and marketplace systems are planned but not implemented yet.

---

## Why It Feels Different

| Focus | What HomieFarms does |
| --- | --- |
| Server authority | The browser sends intent, Laravel decides outcomes |
| Lightweight frontend | No gameplay framework build step; runtime dependencies load from CDNs |
| Cozy world structure | Shared village plaza, road spine, and reserved farm slots |
| Fast iteration | Plain JS files, Blade templates, SQLite-friendly data model |
| Mobile-conscious UI | Bottom nav, touch-friendly controls, compact HUD |

---

## Current Gameplay Slice

### Farming loop

The current version supports a compact but complete farm loop:

- Start with a farm zone and seed inventory
- Trim grass into usable soil
- Plant one of the currently implemented crops: `herbs`, `flowers`, or `berries`
- Water crops for a growth-speed bonus
- Harvest mature crops or clear withered ones
- Sell crops and buy more seeds or buildings

### Buildings

Three building types are implemented right now:

| Building | Purpose | Upgrade |
| --- | --- | --- |
| Well | Auto-waters nearby crops | Larger radius |
| Silo | Expands storage capacity | Larger capacity bonus |
| Market Stall | Improves sell prices | Bigger sell bonus |

### World layout

The village uses a fixed shared layout defined in the backend service layer:

- 42 x 172 world grid
- Central 12 x 12 plaza
- 2-tile-wide north-south road
- Eight reserved farm slots total
- Decorative house strips between farms and the road

---

## Stack

| Layer | Technology |
| --- | --- |
| Backend | Laravel 13, PHP 8.3+ |
| Auth | Laravel Socialite + Discord provider |
| Database | SQLite |
| Renderer | PixiJS 8 via CDN |
| UI | Blade templates, Tailwind via CDN, custom CSS |
| Client code | Vanilla JavaScript in `public/js` |

The game page currently loads PixiJS and Tailwind directly from CDNs. There is no active Node-based frontend pipeline for gameplay code.

---

## Project Highlights

### Frontend

- Isometric renderer and coordinate conversion helpers
- Tile hover highlighting and tooltips
- Toolbar-driven farm actions
- Right-click contextual actions for structures and tile state
- Desktop and mobile input support

### Backend

- Discord OAuth callback flow
- Session-authenticated game API routes
- Server-side crop stage calculation
- Farm slot assignment and reserved-area logic
- Inventory, shop, and sell/buy endpoints

### Design direction

- Pixel-art presentation
- Shared-village multiplayer architecture
- Authoritative server model
- Expandable milestone roadmap in [game-design.md](game-design.md)

---

## Getting Started

### Requirements

- PHP 8.3 or newer
- Composer
- SQLite
- A Discord application for OAuth credentials

### Setup

1. Install PHP dependencies.
2. Create your environment file.
3. Configure Discord OAuth values.
4. Run migrations.
5. Start Laravel.

Suggested commands:

```bash
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

### Discord configuration

Set the usual Socialite and app URL values in `.env`, including:

- `APP_URL`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`

### Local shortcut

In the local environment, the repo exposes a dev-only route at `/dev/game` that creates or reuses a development user and logs them in automatically. That is useful when Discord credentials are not set up yet.

---

## Controls

| Input | Action |
| --- | --- |
| Left click / tap | Move orb or use selected tool |
| Right click | Open contextual actions on nearby owned farm tiles |
| Mouse wheel | Zoom |
| Drag | Pan camera |
| `1` | Move tool |
| `2` | Trim tool |
| `3` | Water tool |
| `4` | Harvest tool |

The UI also includes sidebar and mobile navigation buttons for inventory, shop, and build info.

---

## API Surface

Current authenticated endpoints include:

- `GET /api/farm`
- `POST /api/farm/till`
- `POST /api/farm/plant`
- `POST /api/farm/water`
- `POST /api/farm/harvest`
- `POST /api/farm/clear-withered`
- `POST /api/farm/build`
- `POST /api/farm/demolish`
- `POST /api/farm/upgrade`
- `GET /api/inventory`
- `GET /api/shop`
- `POST /api/shop/buy`
- `POST /api/shop/sell`

---

## Project Structure

```text
app/
	Http/Controllers/
	Models/
	Services/
public/
	css/
	js/
		engine/
resources/views/
routes/
database/
_resources/
```

Notable areas:

- `app/Services/FarmService.php` defines the shared world layout and farm slot assignment.
- `app/Models/Tile.php` contains crop and building definitions.
- `public/js/game.js` is the gameplay bootstrap and client orchestration layer.
- `resources/views/game.blade.php` contains the HUD, panels, and canvas shell.

---

## Roadmap Snapshot

### Implemented

- Foundation and rendering
- Farm assignment and core farming loop
- Inventory, shop, and building placement
- Responsive game HUD and panels

### Planned next

- Reverb/WebSocket multiplayer sync
- Visible other players in-world
- Chat
- Weather and day-night presentation
- Farm visiting and helper actions
- Marketplace board

---

## Known Quirks

- `composer.json` still includes stock Laravel `setup` and `dev` scripts that reference npm, but this repo currently does not include a `package.json`.
- The game design document describes some larger future systems that are not fully implemented yet.
- README setup above reflects the current playable prototype, not the full planned milestone list.

---

## Vision

HomieFarms is aiming for a specific mix: cozy presentation, strict server authority, and a codebase simple enough to keep shipping in small increments. It is not trying to be a giant engine-heavy MMO. It is trying to feel charming, readable, and easy to evolve.
