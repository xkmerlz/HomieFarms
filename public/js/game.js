/**
 * HF Game Bootstrap — Main entry point.
 *
 * Creates the renderer, tilemap, input handler, and player orb.
 * Wires up tile click → orb movement, right-click → tile actions.
 */
window.HF = window.HF || {};

(async function () {
    'use strict';

    // --- Initialize engine ---
    const renderer = new HF.Renderer();
    await renderer.ready();

    const tilemap = new HF.Tilemap(renderer);
    await tilemap.loadTextures();
    tilemap.renderGrid();

    const input = new HF.Input(renderer, tilemap);
    const pathfinder = new HF.Pathfinding(tilemap);

    // Center camera on plaza center
    const mid = Math.floor((HF.Tilemap.PLAZA_Q_MIN + HF.Tilemap.PLAZA_Q_MAX) / 2);
    const midR = Math.floor((HF.Tilemap.PLAZA_R_MIN + HF.Tilemap.PLAZA_R_MAX) / 2);
    renderer.centerOn(mid, midR);

    // --- Load farm data from server ---
    let farmData = null;
    let inventory = [];
    let worldState = window.HF_WORLD || null;
    const weatherEl = document.getElementById('hud-weather');
    const timeEl = document.getElementById('hud-time');
    const lightingOverlay = document.getElementById('world-lighting');
    const weatherOverlay = document.getElementById('world-weather');

    function applyWorldState(nextWorld) {
        if (!nextWorld) {
            return { weatherChanged: false };
        }

        const previousWeather = worldState?.weather?.key || null;
        worldState = nextWorld;

        if (weatherEl) {
            weatherEl.textContent = `${nextWorld.weather.icon} ${nextWorld.weather.label.toLowerCase()}`;
            weatherEl.title = nextWorld.weather.effect;
        }

        if (timeEl) {
            timeEl.textContent = `${nextWorld.time.icon} ${nextWorld.time.formatted} ${nextWorld.time.phase_label.toLowerCase()}`;
        }

        if (lightingOverlay) {
            lightingOverlay.dataset.phase = nextWorld.time.phase;
        }

        if (weatherOverlay) {
            weatherOverlay.dataset.weather = nextWorld.weather.key;
        }

        return { weatherChanged: previousWeather !== null && previousWeather !== nextWorld.weather.key };
    }

    async function loadFarmData() {
        try {
            farmData = await HF.Api.getFarm();
            tilemap.applyFarmData(farmData);
            applyWorldState(farmData.world);
            console.log('[HomieFarms] Farm data loaded:', farmData.farm);
        } catch (e) {
            console.warn('[HomieFarms] Could not load farm data (API may not be available):', e.message);
        }
    }

    async function refreshWorldState() {
        try {
            const data = await HF.Api.getWorld();
            const { weatherChanged } = applyWorldState(data.world);

            if (weatherChanged) {
                await loadFarmData();
            }
        } catch (e) { /* silent */ }
    }

    async function loadInventory() {
        try {
            const data = await HF.Api.getInventory();
            inventory = data.items || [];
            updateInventoryPanel();
        } catch (e) {
            console.warn('[HomieFarms] Could not load inventory:', e.message);
        }
    }

    await loadFarmData();
    await loadInventory();
    applyWorldState(worldState);

    // --- Tool System ---
    let activeTool = 'cursor'; // 'cursor' | 'trim' | 'water' | 'harvest'

    function setActiveTool(tool) {
        activeTool = tool;
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
        // Update canvas cursor
        const canvas = document.getElementById('game-canvas');
        if (tool === 'cursor') {
            canvas.style.cursor = 'default';
        } else {
            canvas.style.cursor = 'crosshair';
        }
    }

    // Wire up toolbar buttons
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
            setActiveTool(btn.dataset.tool);
        });
    });

    // Keyboard shortcuts for tools: 1=cursor, 2=trim, 3=water, 4=harvest
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        const toolKeys = { '1': 'cursor', '2': 'trim', '3': 'water', '4': 'harvest' };
        if (toolKeys[e.key]) {
            setActiveTool(toolKeys[e.key]);
        }
    });

    // Periodically refresh crop stages (every 30s)
    setInterval(async () => {
        try {
            const data = await HF.Api.getFarm();
            applyWorldState(data.world);
            // Update only crop stages without full re-render
            for (const tile of data.tiles) {
                if (tile.crop) {
                    tilemap.updateTile(tile.q, tile.r, tile);
                }
            }
        } catch (e) { /* silent */ }
    }, 30000);

    setInterval(refreshWorldState, 15000);

    // --- Player Orb ---
    const orb = new PIXI.Container();
    orb.zIndex = 9999;

    // Drop shadow — y=0 means shadow sits on the tile top-face center
    const shadow = new PIXI.Graphics();
    shadow.ellipse(0, 0, 8, 4);
    shadow.fill({ color: 0x000000, alpha: 0.45 });
    shadow.y = 0;
    orb.addChild(shadow);

    // Hover offset — raise the orb above the tile surface
    const ORB_HOVER = -10;

    // Glow effect (outer circle)
    const glow = new PIXI.Graphics();
    glow.circle(0, 0, 12);
    glow.fill({ color: 0x7B6BA5, alpha: 0.3 });
    glow.y = ORB_HOVER;
    orb.addChild(glow);

    // Core orb (inner circle)
    const core = new PIXI.Graphics();
    core.circle(0, 0, 7);
    core.fill({ color: 0xF5E6C8, alpha: 0.95 });
    core.y = ORB_HOVER;
    orb.addChild(core);

    // Inner bright spot
    const spot = new PIXI.Graphics();
    spot.circle(-2, -2, 3);
    spot.fill({ color: 0xFFFFFF, alpha: 0.6 });
    spot.y = ORB_HOVER;
    orb.addChild(spot);

    // Position orb at center of plaza
    const startPos = renderer.worldToScreen(mid, midR);
    orb.x = startPos.x;
    orb.y = startPos.y + HF.Renderer.TILE_HALF_H;
    orb.currentQ = mid;
    orb.currentR = midR;

    // Username label
    const username = window.HF_USER ? window.HF_USER.username : 'Player';
    const label = new PIXI.Text({
        text: username,
        style: {
            fontFamily: 'Press Start 2P',
            fontSize: 6,
            fill: 0xF5E6C8,
            align: 'center',
            stroke: { color: 0x1a1a2e, width: 2 },
        },
    });
    label.anchor.set(0.5, 1);
    label.y = ORB_HOVER - 12;
    orb.addChild(label);

    tilemap.container.addChild(orb);

    // --- Orb Movement ---
    const WALK_SPEED = 0.9;
    const INTERACTION_RANGE = 2;
    let path = [];
    let pathIndex = 0;
    let targetX = orb.x;
    let targetY = orb.y;
    let moving = false;
    let pendingToolAction = null;

    function isWithinInteractionRange(fromQ, fromR, targetQ, targetR) {
        return Math.abs(fromQ - targetQ) <= INTERACTION_RANGE
            && Math.abs(fromR - targetR) <= INTERACTION_RANGE;
    }

    function beginMovement(foundPath, nextPendingToolAction = null) {
        if (!foundPath || foundPath.length < 2) {
            return false;
        }

        pendingToolAction = nextPendingToolAction;
        path = foundPath.slice(1);
        pathIndex = 0;

        const first = path[0];
        const pos = renderer.worldToScreen(first.q, first.r);
        targetX = pos.x;
        targetY = pos.y + HF.Renderer.TILE_HALF_H;
        moving = true;
        return true;
    }

    function findReachableInteractionPath(targetQ, targetR) {
        let bestPath = null;
        let bestRangeDistance = Number.POSITIVE_INFINITY;

        for (let q = targetQ - INTERACTION_RANGE; q <= targetQ + INTERACTION_RANGE; q++) {
            for (let r = targetR - INTERACTION_RANGE; r <= targetR + INTERACTION_RANGE; r++) {
                if (!tilemap.isInBounds(q, r) || !tilemap.isWalkable(q, r)) {
                    continue;
                }

                if (!isWithinInteractionRange(q, r, targetQ, targetR)) {
                    continue;
                }

                const candidatePath = pathfinder.findPath(orb.currentQ, orb.currentR, q, r);
                if (!candidatePath) {
                    continue;
                }

                const rangeDistance = Math.max(Math.abs(q - targetQ), Math.abs(r - targetR));
                if (!bestPath
                    || candidatePath.length < bestPath.length
                    || (candidatePath.length === bestPath.length && rangeDistance < bestRangeDistance)) {
                    bestPath = candidatePath;
                    bestRangeDistance = rangeDistance;
                }
            }
        }

        return bestPath;
    }

    function resolveToolAction(tool, q, r) {
        if (!tilemap.isInBounds(q, r)) {
            return { ok: false };
        }

        if (!tilemap.isOwnedFarmTile(q, r)) {
            return { ok: false, message: 'Not your farm tile' };
        }

        const farmTile = tilemap.getFarmTile(q, r);
        const terrain = farmTile ? farmTile.terrain : tilemap.tileTypes.get(`${q},${r}`);

        if (tool === 'trim') {
            if (terrain === 'grass') {
                return { ok: true, execute: () => doTillTracked(q, r) };
            }

            return { ok: false, message: 'Can only trim grass tiles' };
        }

        if (tool === 'water') {
            if (farmTile?.crop && farmTile.stage >= 0 && farmTile.stage < 3 && !farmTile.watered) {
                return { ok: true, execute: () => doWaterTracked(q, r) };
            }

            if (!farmTile?.crop) {
                return { ok: false, message: 'No crop to water here' };
            }

            if (farmTile.watered) {
                return { ok: false, message: 'Already watered' };
            }

            return { ok: false, message: 'Can\'t water this crop' };
        }

        if (tool === 'harvest') {
            if (farmTile?.crop && farmTile.stage === 3) {
                return { ok: true, execute: () => doHarvestTracked(q, r) };
            }

            if (farmTile?.crop && farmTile.stage === -1) {
                return { ok: true, execute: () => doClearWithered(q, r) };
            }

            if (farmTile?.crop) {
                return { ok: false, message: 'Not ready to harvest yet' };
            }

            return { ok: false, message: 'Nothing to harvest here' };
        }

        return { ok: false };
    }

    function executeToolAction(tool, q, r) {
        const action = resolveToolAction(tool, q, r);
        if (!action.ok) {
            if (action.message) {
                showToast(action.message, true);
            }
            return;
        }

        action.execute();
    }

    // Highlight tile under cursor
    let highlightSprite = null;
    const highlightTex = tilemap.textures.get('highlight');

    if (highlightTex) {
        highlightSprite = new PIXI.Sprite(highlightTex);
        highlightSprite.anchor.set(0.5, 0);
        highlightSprite.visible = false;
        renderer.world.addChild(highlightSprite);
    }

    input.onTileClick = (q, r) => {
        // Tool actions (non-cursor tools)
        if (activeTool !== 'cursor') {
            handleToolAction(q, r);
            return;
        }

        pendingToolAction = null;

        if (!tilemap.isWalkable(q, r)) return;

        const foundPath = pathfinder.findPath(orb.currentQ, orb.currentR, q, r);
        beginMovement(foundPath);
    };

    function handleToolAction(q, r) {
        const action = resolveToolAction(activeTool, q, r);
        if (!action.ok) {
            if (action.message) {
                showToast(action.message, true);
            }
            return;
        }

        if (isWithinInteractionRange(orb.currentQ, orb.currentR, q, r)) {
            action.execute();
            return;
        }

        const approachPath = findReachableInteractionPath(q, r);
        if (!beginMovement(approachPath, { tool: activeTool, q, r })) {
            pendingToolAction = null;
            showToast('Out of reach', true);
        }
    }

    input.onTileHover = (q, r) => {
        if (highlightSprite) {
            const pos = renderer.worldToScreen(q, r);
            highlightSprite.x = pos.x;
            highlightSprite.y = pos.y;
            highlightSprite.visible = true;
        }
        updateTooltip(q, r);
    };

    // --- Right-Click Context Menu ---
    const ctxMenu = document.getElementById('ctx-menu');
    const ctxItems = document.getElementById('ctx-items');
    let ctxTileQ = 0, ctxTileR = 0;

    function hideContextMenu() {
        if (ctxMenu) ctxMenu.classList.add('hidden');
    }

    function showContextMenu(screenX, screenY, actions) {
        if (!ctxMenu || !ctxItems) return;
        ctxItems.innerHTML = '';

        for (const action of actions) {
            const btn = document.createElement('button');
            btn.className = 'ctx-btn';
            btn.textContent = action.label;
            btn.addEventListener('click', () => {
                hideContextMenu();
                action.handler();
            });
            ctxItems.appendChild(btn);
        }

        ctxMenu.style.left = screenX + 'px';
        ctxMenu.style.top = screenY + 'px';
        ctxMenu.classList.remove('hidden');
    }

    // Listen for right-click on canvas
    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();

        if (activeTool !== 'cursor') {
            setActiveTool('cursor');
            hideContextMenu();
            return;
        }

        const tile = renderer.screenToWorld(e.clientX, e.clientY);
        const q = tile.q;
        const r = tile.r;

        if (!tilemap.isInBounds(q, r)) return;

        // Check if orb is close enough to interact
        if (!isWithinInteractionRange(orb.currentQ, orb.currentR, q, r)) return;

        // Check if this is a farm tile
        if (!tilemap.isOwnedFarmTile(q, r)) return;

        ctxTileQ = q;
        ctxTileR = r;

        const farmTile = tilemap.getFarmTile(q, r);
        const actions = buildTileActions(q, r, farmTile);

        if (actions.length > 0) {
            showContextMenu(e.clientX, e.clientY, actions);
        }
    });

    document.addEventListener('click', hideContextMenu);
    document.addEventListener('pointerdown', (e) => {
        if (ctxMenu && !ctxMenu.contains(e.target)) {
            hideContextMenu();
        }
    });

    function buildTileActions(q, r, farmTile) {
        const actions = [];
        const terrain = farmTile ? farmTile.terrain : tilemap.tileTypes.get(`${q},${r}`);

        // Structure actions take priority
        if (farmTile?.structure) {
            const structName = farmTile.structure;
            const tier = farmTile.tier || 1;
            const labels = { well: 'Well', silo: 'Silo', market: 'Market Stall' };
            const label = labels[structName] || structName;

            if (tier < 2) {
                actions.push({
                    label: `⬆ Upgrade ${label}`,
                    handler: () => doUpgrade(q, r),
                });
            }

            actions.push({
                label: `🗑️ Demolish ${label}`,
                handler: () => doDemolish(q, r),
            });

            return actions;
        }

        if (terrain === 'grass') {
            // Build options on grass tiles (no crop, no structure)
            if (!farmTile?.crop) {
                const buildingTypes = [
                    { id: 'well', label: 'Well', cost: 50 },
                    { id: 'silo', label: 'Silo', cost: 100 },
                    { id: 'market', label: 'Market Stall', cost: 200 },
                ];
                for (const b of buildingTypes) {
                    actions.push({
                        label: `🏗️ Build ${b.label} (${b.cost}g)`,
                        handler: () => doBuild(q, r, b.id),
                    });
                }
            }
        }

        if (terrain === 'tilled' && !farmTile?.crop) {
            // Show planting options for seeds in inventory
            const seeds = inventory.filter(i => i.type === 'seed' && i.quantity > 0);
            for (const seed of seeds) {
                const cropName = seed.id.charAt(0).toUpperCase() + seed.id.slice(1);
                actions.push({
                    label: `🌱 Plant ${cropName} (${seed.quantity})`,
                    handler: () => doPlantTracked(q, r, seed.id),
                });
            }
        }

        if (farmTile?.crop) {
            const stage = farmTile.stage;

            if (stage === -1) {
                actions.push({
                    label: '🗑️ Clear Withered',
                    handler: () => doClearWithered(q, r),
                });
            }
        }

        return actions;
    }

    // --- Farming Actions ---
    async function doTill(q, r) {
        try {
            const result = await HF.Api.till(q, r);
            tilemap.updateTile(q, r, result);
            showToast('Soil tilled!');
        } catch (e) {
            showToast(e.message, true);
        }
    }

    async function doPlant(q, r, crop) {
        try {
            const result = await HF.Api.plant(q, r, crop);
            tilemap.updateTile(q, r, result);
            await loadInventory(); // refresh seed count
            showToast(`Planted ${crop}!`);
        } catch (e) {
            showToast(e.message, true);
        }
    }

    async function doHarvest(q, r) {
        try {
            const result = await HF.Api.harvest(q, r);
            tilemap.updateTile(q, r, result);
            if (result.withered) {
                showToast('Crop withered...', true);
            } else {
                showToast(`Harvested ${result.harvested}!`);
            }
            await loadInventory();
        } catch (e) {
            showToast(e.message, true);
        }
    }

    async function doWater(q, r) {
        try {
            await HF.Api.water(q, r);
            const ft = tilemap.getFarmTile(q, r);
            if (ft) ft.watered = true;
            showToast('Watered!');
        } catch (e) {
            showToast(e.message, true);
        }
    }

    async function doClearWithered(q, r) {
        try {
            const result = await HF.Api.clearWithered(q, r);
            tilemap.updateTile(q, r, { ...result, crop: null, stage: null });
            showToast('Cleared withered crop');
        } catch (e) {
            showToast(e.message, true);
        }
    }

    async function doBuild(q, r, building) {
        try {
            const result = await HF.Api.build(q, r, building);
            tilemap.updateTile(q, r, result);
            updateCoins(result.coins);
            const labels = { well: 'Well', silo: 'Silo', market: 'Market Stall' };
            showToast(`Built ${labels[building] || building}!`);
        } catch (e) {
            showToast(e.message, true);
        }
    }

    async function doDemolish(q, r) {
        try {
            const result = await HF.Api.demolish(q, r);
            tilemap.updateTile(q, r, { ...result, structure: null, tier: null });
            updateCoins(result.coins);
            showToast(`Demolished! Refund: ${result.refund}g`);
        } catch (e) {
            showToast(e.message, true);
        }
    }

    async function doUpgrade(q, r) {
        try {
            const result = await HF.Api.upgrade(q, r);
            tilemap.updateTile(q, r, result);
            updateCoins(result.coins);
            const labels = { well: 'Well', silo: 'Silo', market: 'Market Stall' };
            showToast(`Upgraded ${labels[result.structure] || result.structure} to Tier 2!`);
        } catch (e) {
            showToast(e.message, true);
        }
    }

    // --- Toast Notification ---
    function showToast(msg, isError = false) {
        const el = document.getElementById('toast');
        if (!el) return;
        el.textContent = msg;
        el.className = 'toast ' + (isError ? 'toast-error' : 'toast-success');
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 2000);
    }

    // --- Inventory Panel ---
    function updateInventoryPanel() {
        const list = document.getElementById('inv-list');
        if (!list) return;
        list.innerHTML = '';

        if (inventory.length === 0) {
            list.innerHTML = '<div class="inv-empty">Empty</div>';
            return;
        }

        for (const item of inventory) {
            const div = document.createElement('div');
            div.className = 'inv-item';
            const icon = item.type === 'seed' ? '🌱' : '🌾';
            const name = item.id.charAt(0).toUpperCase() + item.id.slice(1);
            div.textContent = `${icon} ${name} x${item.quantity}`;

            // If it's a crop (not seed), add sell button
            if (item.type === 'crop' && item.quantity > 0) {
                const sellBtn = document.createElement('button');
                sellBtn.className = 'inv-sell-btn';
                sellBtn.textContent = 'Sell';
                sellBtn.addEventListener('click', async () => {
                    try {
                        const result = await HF.Api.sell(item.id, 1);
                        updateCoins(result.coins);
                        await loadInventory();
                        showToast(`Sold 1 ${name} for ${result.earned}g`);
                    } catch (e) {
                        showToast(e.message, true);
                    }
                });
                div.appendChild(sellBtn);
            }

            list.appendChild(div);
        }
    }

    // --- Shop Panel (tabbed: seeds + buildings) ---
    let shopData = null;
    let shopTab = 'seeds';

    async function loadShop() {
        const list = document.getElementById('shop-list');
        if (!list) return;
        try {
            shopData = await HF.Api.getShopCatalog();
            renderShopTab();
        } catch (e) {
            list.innerHTML = '<div class="inv-empty">Shop unavailable</div>';
        }
    }

    function renderShopTab() {
        const list = document.getElementById('shop-list');
        if (!list || !shopData) return;
        list.innerHTML = '';

        if (shopTab === 'seeds') {
            for (const item of shopData.items) {
                const div = document.createElement('div');
                div.className = 'shop-item';
                div.innerHTML = `<span>🌱 ${item.label}</span><span>${item.cost}g</span>`;

                const buyBtn = document.createElement('button');
                buyBtn.className = 'shop-buy-btn';
                buyBtn.textContent = 'Buy';
                buyBtn.addEventListener('click', async () => {
                    try {
                        const result = await HF.Api.buy(item.id, 1);
                        updateCoins(result.coins);
                        await loadInventory();
                        showToast(`Bought 1 ${item.label}`);
                    } catch (e) {
                        showToast(e.message, true);
                    }
                });
                div.appendChild(buyBtn);
                list.appendChild(div);
            }
        } else if (shopTab === 'buildings') {
            const buildings = shopData.buildings || [];
            if (buildings.length === 0) {
                list.innerHTML = '<div class="inv-empty">No buildings available</div>';
                return;
            }
            for (const b of buildings) {
                const div = document.createElement('div');
                div.className = 'shop-building';
                div.innerHTML = `
                    <div class="shop-building-name">🏗️ ${b.label}</div>
                    <div class="shop-building-effect">${b.effect}</div>
                    <div class="shop-building-row">
                        <span>${b.cost}g</span>
                        <span style="color:var(--hf-purple);font-size:6px">Right-click grass to place</span>
                    </div>
                `;
                if (b.upgrade_cost) {
                    const upDiv = document.createElement('div');
                    upDiv.style.cssText = 'font-size:6px;color:var(--hf-purple);margin-top:4px;';
                    upDiv.textContent = `⬆ Tier 2: ${b.upgrade_effect} (${b.upgrade_cost}g)`;
                    div.appendChild(upDiv);
                }
                list.appendChild(div);
            }
        }
    }

    // Shop tab switching
    document.querySelectorAll('.panel-tab[data-tab]').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            shopTab = tab.dataset.tab;
            renderShopTab();
        });
    });

    function updateCoins(amount) {
        const el = document.getElementById('hud-coins');
        if (el) el.textContent = amount + 'g';
    }

    // --- Panel Toggle ---
    document.querySelectorAll('[data-panel]').forEach(btn => {
        btn.addEventListener('click', () => {
            const panelId = 'panel-' + btn.dataset.panel;
            const panel = document.getElementById(panelId);
            if (!panel) return;

            const isOpen = !panel.classList.contains('hidden');
            // Close all panels
            document.querySelectorAll('.game-panel').forEach(p => p.classList.add('hidden'));

            if (!isOpen) {
                panel.classList.remove('hidden');
                if (btn.dataset.panel === 'shop') loadShop();
                if (btn.dataset.panel === 'inventory') loadInventory();
            }
        });
    });

    // --- Tile Tooltip ---
    const tooltipEl = document.getElementById('tile-tooltip');
    let tooltipQ = -1, tooltipR = -1;

    canvas.addEventListener('mousemove', (e) => {
        if (tooltipEl && !tooltipEl.classList.contains('hidden')) {
            tooltipEl.style.left = (e.clientX + 14) + 'px';
            tooltipEl.style.top = (e.clientY - 8) + 'px';
        }
    });

    canvas.addEventListener('mouseleave', () => {
        if (tooltipEl) tooltipEl.classList.add('hidden');
    });

    function updateTooltip(q, r) {
        if (!tooltipEl) return;
        if (q === tooltipQ && r === tooltipR) return;
        tooltipQ = q;
        tooltipR = r;

        const info = tilemap.getTileInfo(q, r);
        if (!info) {
            tooltipEl.classList.add('hidden');
            return;
        }

        let text = '';
        if (info.isFarm) {
            if (info.structure) {
                const labels = { well: 'Well', silo: 'Silo', market: 'Market Stall' };
                const name = labels[info.structure] || info.structure;
                text = `${name} (Tier ${info.tier || 1})`;
            } else if (info.crop) {
                const name = info.crop.charAt(0).toUpperCase() + info.crop.slice(1);
                text = `${name} — ${info.stageLabel}`;
                if (info.watered && info.stage >= 0 && info.stage < 3) text += ' 💧';
            } else if (info.terrain === 'tilled') {
                text = 'Tilled soil (right-click to plant)';
            } else {
                text = 'Farm plot (use ✂️ to trim)';
            }
        }

        if (text) {
            tooltipEl.textContent = text;
            tooltipEl.classList.remove('hidden');
        } else {
            tooltipEl.classList.add('hidden');
        }
    }

    // --- Onboarding + Task Checklist ---
    const TASKS = [
        { id: 'till',    label: 'Till a grass tile', check: () => Array.from(tilemap.farmTiles.values()).some(t => t.terrain === 'tilled') },
        { id: 'plant',   label: 'Plant a seed',     check: () => Array.from(tilemap.farmTiles.values()).some(t => t.crop) },
        { id: 'water',   label: 'Water a crop',     check: () => Array.from(tilemap.farmTiles.values()).some(t => t.crop && t.watered) },
        { id: 'harvest', label: 'Harvest a crop',   check: () => inventory.some(i => i.type === 'crop' && i.quantity > 0) },
    ];

    const taskDone = {};

    function updateChecklist() {
        const listEl = document.getElementById('task-list');
        const checklistEl = document.getElementById('task-checklist');
        if (!listEl || !checklistEl) return;

        listEl.innerHTML = '';
        let allDone = true;

        for (const task of TASKS) {
            const done = taskDone[task.id] || task.check();
            if (done) taskDone[task.id] = true;
            else allDone = false;

            const div = document.createElement('div');
            div.className = 'task-item' + (done ? ' done' : '');
            div.textContent = (done ? '✓ ' : '○ ') + task.label;
            listEl.appendChild(div);
        }

        if (allDone) {
            // All tasks complete — hide after a moment
            setTimeout(() => {
                checklistEl.classList.add('hidden');
                showToast('Tutorial complete! Have fun farming!');
            }, 1500);
        }
    }

    // Show onboarding if first time (check localStorage)
    const onboardingKey = 'hf_onboarded';
    if (!localStorage.getItem(onboardingKey)) {
        const overlay = document.getElementById('onboarding');
        const closeBtn = document.getElementById('onboarding-close');
        if (overlay) overlay.classList.remove('hidden');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                overlay.classList.add('hidden');
                localStorage.setItem(onboardingKey, '1');
                // Show checklist after onboarding
                const checklistEl = document.getElementById('task-checklist');
                if (checklistEl) checklistEl.classList.remove('hidden');
                updateChecklist();
            });
        }
    } else {
        // Returning player — show checklist if not all done
        const checklistEl = document.getElementById('task-checklist');
        if (checklistEl) {
            checklistEl.classList.remove('hidden');
            updateChecklist();
        }
    }

    // Update checklist after farming actions
    const _origDoTill = doTill;
    const _origDoPlant = doPlant;
    const _origDoHarvest = doHarvest;
    const _origDoWater = doWater;

    // Wrap farming actions to update checklist
    async function doTillTracked(q, r) {
        await _origDoTill(q, r);
        updateChecklist();
    }
    async function doPlantTracked(q, r, crop) {
        await _origDoPlant(q, r, crop);
        updateChecklist();
    }
    async function doHarvestTracked(q, r) {
        await _origDoHarvest(q, r);
        updateChecklist();
    }
    async function doWaterTracked(q, r) {
        await _origDoWater(q, r);
        updateChecklist();
    }

    // --- Animation Loop ---
    let bobTime = 0;

    renderer.app.ticker.add((ticker) => {
        const dt = ticker.deltaTime;

        // Orb movement (constant speed along path)
        if (moving) {
            const dx = targetX - orb.x;
            const dy = targetY - orb.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const step = WALK_SPEED * dt;

            if (dist <= step) {
                orb.x = targetX;
                orb.y = targetY;

                const wp = path[pathIndex];
                orb.currentQ = wp.q;
                orb.currentR = wp.r;
                pathIndex++;

                if (pathIndex < path.length) {
                    const next = path[pathIndex];
                    const pos = renderer.worldToScreen(next.q, next.r);
                    targetX = pos.x;
                    targetY = pos.y + HF.Renderer.TILE_HALF_H;
                } else {
                    moving = false;
                    path = [];

                    if (pendingToolAction) {
                        const nextAction = pendingToolAction;
                        pendingToolAction = null;
                        executeToolAction(nextAction.tool, nextAction.q, nextAction.r);
                    }
                }
            } else {
                orb.x += (dx / dist) * step;
                orb.y += (dy / dist) * step;
            }
        }

        // Floating bob animation
        bobTime += dt * 0.05;
        const bob = Math.sin(bobTime) * 2;
        core.y = ORB_HOVER + bob;
        spot.y = ORB_HOVER + bob;
        glow.y = ORB_HOVER + bob;
        label.y = ORB_HOVER + bob - 12;

        const shadowScale = 1 - bob * 0.02;
        shadow.scale.set(shadowScale);
        shadow.alpha = 0.45 - bob * 0.015;

        glow.alpha = 0.2 + Math.sin(bobTime * 1.5) * 0.1;
        glow.scale.set(1 + Math.sin(bobTime * 0.7) * 0.05);

        const newZ = ((orb.y - HF.Renderer.TILE_HALF_H) / HF.Renderer.TILE_HALF_H) + 0.5;
        if (newZ !== orb.zIndex) {
            orb.zIndex = newZ;
            tilemap.container.sortChildren();
        }
    });

    // --- Debug info ---
    console.log('[HomieFarms] Game initialized');
    console.log(`[HomieFarms] Grid: ${tilemap.gridSize}x${tilemap.gridRSize}`);
    console.log(`[HomieFarms] User: ${username}`);
    console.log('[HomieFarms] Controls: Click=move | Scroll=zoom | MidDrag=pan | Tools=1-4 | RightClick=build/plant');

})();
