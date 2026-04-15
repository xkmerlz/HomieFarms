/**
 * HF.Tilemap — Isometric tile grid renderer.
 *
 * Loads tile textures, renders a grid of isometric tiles, handles depth sorting.
 * Supports server-driven farm data overlay with crop sprites.
 * Features frustum culling, sprite pooling, tileset crop art, decorations, and flow-aware water animation.
 */
window.HF = window.HF || {};

HF.Tilemap = class {
    /** @type {HF.Renderer} */
    renderer = null;

    /** @type {PIXI.Container} */
    container = null;

    /** @type {boolean} Set true when dynamic elements move — triggers sort next frame */
    _sortDirty = false;

    /** @type {Map<string, PIXI.Texture>} */
    textures = new Map();

    /** @type {Map<string, PIXI.Texture>} Crop stage textures */
    cropTextures = new Map();

    /** @type {Map<string, PIXI.Sprite>} Keyed by "q,r" */
    tiles = new Map();

    /** @type {Map<string, string>} Tile type keyed by "q,r" */
    tileTypes = new Map();

    /** @type {Map<string, PIXI.Sprite>} Crop sprites keyed by "q,r" */
    cropSprites = new Map();

    /** @type {Map<string, PIXI.Sprite>} Structure sprites keyed by "q,r" */
    structureSprites = new Map();

    /** @type {Map<string, PIXI.Sprite>} Building glow sprites keyed by "q,r" */
    glowSprites = new Map();

    /** @type {Map<string, PIXI.Texture>} Building textures keyed by "type_tier" */
    buildingTextures = new Map();

    /** @type {PIXI.Texture|null} Warm glow texture for night lighting */
    glowTexture = null;

    /** @type {string} Current day phase */
    _dayPhase = 'day';

    /** @type {number} Target glow alpha for current phase */
    _glowTarget = 0;

    /** @type {Map<string, object>} Farm tile data from server keyed by "q,r" */
    farmTiles = new Map();

    /** @type {Set<string>} Types that block movement */
    unwalkableTypes = new Set(['water']);

    /** @type {number} Grid size (q-axis width) */
    gridSize = 42;
    /** @type {number} Grid depth (r-axis) */
    gridRSize = 172;

    /** Layout defaults (overwritten by server data) */
    static PLAZA_Q_MIN = 17;
    static PLAZA_Q_MAX = 28;
    static PLAZA_R_MIN = 80;
    static PLAZA_R_MAX = 91;
    static ROAD_Q_MIN = 22;
    static ROAD_Q_MAX = 23;

    /** @type {object|null} Server-provided layout info */
    layout = null;

    /** @type {Array} All farm slot definitions from server */
    slots = [];

    /** @type {object|null} Farm zone bounds from server */
    farmZone = null;

    /** @type {object|null} Reserved 16×16 area bounds */
    reservedZone = null;

    /** @type {Array<PIXI.Sprite>} Farm zone corner post sprites */
    farmPosts = [];

    // --- Frustum culling ---
    /** @type {object|null} Currently rendered tile range {qMin, qMax, rMin, rMax} */
    _renderedRange = null;
    /** @type {number} Buffer tiles beyond viewport edge */
    static CULL_PAD = 6;

    // --- Sprite pool ---
    /** @type {Array<PIXI.Sprite>} Pool of reusable tile sprites */
    _spritePool = [];

    // --- Decoration sprites ---
    /** @type {Map<string, PIXI.Sprite>} Decoration sprites keyed by "q,r" */
    decorSprites = new Map();

    // --- Water animation ---
    /** @type {Map<string, PIXI.Sprite>} Animated water surface sprites keyed by "q,r" */
    waterSprites = new Map();

    /** @type {Map<string, object>} Water visual descriptors keyed by "q,r" */
    waterDescriptors = new Map();

    /** @type {Map<string, {frame:number}>} Water animation state keyed by "q,r" */
    waterAnimState = new Map();

    /** @type {Map<string, PIXI.Texture[]>} Cached procedural water frame sets */
    waterFrameSets = new Map();

    static WATER_FRAME_COUNT = 12;
    static WATER_FRAME_SPEED = 0.18;
    static WATER_DIRECTIONS = [
        { name: 'N', dq: 0, dr: -1, bit: 1 },
        { name: 'E', dq: 1, dr: 0, bit: 2 },
        { name: 'S', dq: 0, dr: 1, bit: 4 },
        { name: 'W', dq: -1, dr: 0, bit: 8 },
    ];

    // --- Tileset crop textures ---
    /** @type {Map<string, PIXI.Texture>} Growth stage textures from tileset */
    growthTextures = new Map();

    // --- Decoration textures ---
    /** @type {Map<string, PIXI.Texture>} Decoration textures */
    decorTextures = new Map();

    constructor(renderer) {
        this.renderer = renderer;
        this.container = new PIXI.Container();
        this.container.sortableChildren = true;
        renderer.world.addChild(this.container);
    }

    /**
     * Load tile textures from sprite files.
     */
    async loadTextures() {
        const tileNames = [
            'grass', 'grass_light', 'grass_dark',
            'stone', 'stone_light', 'stone_dark',
            'path', 'dirt', 'dirt_light', 'farm_plot', 'tilled',
            'water', 'water_b', 'highlight', 'farm_post',
        ];

        for (const name of tileNames) {
            try {
                const texture = await PIXI.Assets.load(`/sprites/tiles/${name}.png`);
                this.textures.set(name, texture);
            } catch (e) {
                console.warn(`Failed to load tile texture: ${name}`, e);
            }
        }

        // Load crop textures (old per-crop sprites kept as fallback)
        const cropNames = ['herbs', 'flowers', 'berries'];
        for (const crop of cropNames) {
            for (let stage = 0; stage <= 3; stage++) {
                try {
                    const tex = await PIXI.Assets.load(`/sprites/crops/${crop}_${stage}.png`);
                    this.cropTextures.set(`${crop}_${stage}`, tex);
                } catch (e) {
                    console.warn(`Failed to load crop texture: ${crop}_${stage}`, e);
                }
            }
        }
        try {
            const wTex = await PIXI.Assets.load('/sprites/crops/withered.png');
            this.cropTextures.set('withered', wTex);
        } catch (e) {
            console.warn('Failed to load withered texture', e);
        }

        // Load tileset growth stage textures (tile-swap approach)
        for (let stage = 0; stage <= 3; stage++) {
            try {
                const tex = await PIXI.Assets.load(`/sprites/crops/growth_${stage}.png`);
                this.growthTextures.set(`growth_${stage}`, tex);
            } catch (e) {
                console.warn(`Failed to load growth texture: growth_${stage}`, e);
            }
        }
        try {
            const wTex = await PIXI.Assets.load('/sprites/crops/growth_withered.png');
            this.growthTextures.set('growth_withered', wTex);
        } catch (e) {
            console.warn('Failed to load growth_withered texture', e);
        }

        // Load decoration textures (small ground decor + trees + lamps)
        const decorNames = [
            'mushroom', 'flower_white', 'flower_red', 'flower_blue',
            'flower_yellow', 'tulip', 'bush', 'bush_small', 'bush_big',
            'stone', 'stone_flat', 'stump', 'log', 'barrel', 'bench',
            'lamp', 'lamp_2', 'garden_bed',
        ];
        const treeNames = [
            'tree_1', 'tree_2', 'tree_3', 'tree_4', 'tree_5', 'tree_6',
            'tree_dry_1', 'tree_dry_2', 'tree_dry_3',
        ];
        for (const name of [...decorNames, ...treeNames]) {
            try {
                const tex = await PIXI.Assets.load(`/sprites/decor/${name}.png`);
                this.decorTextures.set(name, tex);
            } catch (e) {
                console.warn(`Failed to load decor texture: ${name}`, e);
            }
        }

        // Load building textures (per-slot houses)
        const houseSlots = ['S1', 'S2', 'S3', 'S4', 'N1', 'N2', 'N3', 'N4'];
        for (const slot of houseSlots) {
            try {
                const tex = await PIXI.Assets.load(`/sprites/buildings/house_${slot}.png`);
                this.textures.set(`house_${slot}`, tex);
            } catch (e) {
                console.warn(`Failed to load house_${slot} texture`, e);
            }
        }

        // Load placeable building textures (type_tier)
        const buildingTypes = ['well', 'silo', 'market'];
        for (const btype of buildingTypes) {
            for (let tier = 1; tier <= 2; tier++) {
                try {
                    const tex = await PIXI.Assets.load(`/sprites/buildings/${btype}_${tier}.png`);
                    this.buildingTextures.set(`${btype}_${tier}`, tex);
                } catch (e) {
                    console.warn(`Failed to load building texture: ${btype}_${tier}`, e);
                }
            }
        }

        // Load glow texture for night building lighting
        try {
            this.glowTexture = await PIXI.Assets.load('/sprites/effects/glow_warm.png');
        } catch (e) {
            console.warn('Failed to load glow texture', e);
        }
    }

    /**
     * Apply farm data from server and update tile rendering.
     */
    applyFarmData(farmResponse) {
        this.farmZone = farmResponse.farm;
        this.reservedZone = farmResponse.reserved || null;
        this.slots = farmResponse.slots || [];
        this.layout = farmResponse.layout || null;

        if (this.layout) {
            this.gridSize = this.layout.grid_q;
            this.gridRSize = this.layout.grid_r;
            HF.Tilemap.PLAZA_Q_MIN = this.layout.plaza.q_min;
            HF.Tilemap.PLAZA_Q_MAX = this.layout.plaza.q_max;
            HF.Tilemap.PLAZA_R_MIN = this.layout.plaza.r_min;
            HF.Tilemap.PLAZA_R_MAX = this.layout.plaza.r_max;
            HF.Tilemap.ROAD_Q_MIN = this.layout.road.q_min;
            HF.Tilemap.ROAD_Q_MAX = this.layout.road.q_max;
        }

        this.farmTiles.clear();
        for (const tile of farmResponse.tiles) {
            const key = `${tile.q},${tile.r}`;
            this.farmTiles.set(key, tile);
        }

        // Re-render the grid with farm data applied
        this.renderGrid();
    }

    /**
     * Update a single tile after a server action (till, plant, harvest, etc.).
     */
    updateTile(q, r, data) {
        const key = `${q},${r}`;

        let existing = this.farmTiles.get(key) || { q, r };
        Object.assign(existing, data);
        this.farmTiles.set(key, existing);

        const dirtyKeys = new Set([key]);
        for (const dir of HF.Tilemap.WATER_DIRECTIONS) {
            dirtyKeys.add(`${q + dir.dq},${r + dir.dr}`);
        }

        let didRerender = false;
        for (const dirtyKey of dirtyKeys) {
            const [tileQ, tileR] = dirtyKey.split(',').map(Number);
            didRerender = this._rerenderVisibleTile(tileQ, tileR) || didRerender;
        }

        if (didRerender) {
            this.container.sortChildren();
        }
    }

    // --- Sprite Pool ---
    _getFromPool(texture) {
        const sprite = this._spritePool.pop() || new PIXI.Sprite();
        sprite.texture = texture;
        sprite.tint = 0xFFFFFF;
        sprite.alpha = 1;
        sprite.visible = true;
        sprite.scale.set(1);
        sprite.blendMode = 'normal';
        return sprite;
    }

    _returnToPool(sprite) {
        this.container.removeChild(sprite);
        sprite.visible = false;
        this._spritePool.push(sprite);
    }

    // --- Frustum Culling ---

    /**
     * Calculate the visible tile range based on camera position and zoom.
     */
    _getVisibleRange() {
        const cam = this.renderer.camera;
        const screen = this.renderer.app.screen;
        const pad = HF.Tilemap.CULL_PAD;

        // Convert screen corners to world coords
        const tl = this.renderer.screenToWorld(0, 0);
        const tr = this.renderer.screenToWorld(screen.width, 0);
        const bl = this.renderer.screenToWorld(0, screen.height);
        const br = this.renderer.screenToWorld(screen.width, screen.height);

        // In isometric view, the extremes are:
        // - min q: top-left corner
        // - max q: bottom-right corner
        // - min r: top-right corner
        // - max r: bottom-left corner
        const qMin = Math.max(0, Math.min(tl.q, bl.q, tr.q, br.q) - pad);
        const qMax = Math.min(this.gridSize - 1, Math.max(tl.q, bl.q, tr.q, br.q) + pad);
        const rMin = Math.max(0, Math.min(tl.r, tr.r, bl.r, br.r) - pad);
        const rMax = Math.min(this.gridRSize - 1, Math.max(tl.r, tr.r, bl.r, br.r) + pad);

        return { qMin, qMax, rMin, rMax };
    }

    /**
     * Called on camera changes — incrementally adds/removes tiles for smooth scrolling.
     */
    updateViewport() {
        const newRange = this._getVisibleRange();
        const old = this._renderedRange;

        if (!old) {
            this.renderGrid();
            return;
        }

        if (newRange.qMin === old.qMin && newRange.qMax === old.qMax
            && newRange.rMin === old.rMin && newRange.rMax === old.rMax) {
            return; // No change
        }

        // Remove tiles that left the viewport
        const keysToRemove = [];
        for (const [key] of this.tiles) {
            const [q, r] = key.split(',').map(Number);
            if (q < newRange.qMin || q > newRange.qMax
                || r < newRange.rMin || r > newRange.rMax) {
                keysToRemove.push(key);
            }
        }
        for (const key of keysToRemove) {
            this._clearTileArtifacts(key);
        }

        // Add tiles that entered the viewport
        let added = false;
        for (let q = newRange.qMin; q <= newRange.qMax; q++) {
            for (let r = newRange.rMin; r <= newRange.rMax; r++) {
                const key = `${q},${r}`;
                if (!this.tiles.has(key)) {
                    this._renderSingleTile(q, r);
                    added = true;
                }
            }
        }

        this._renderedRange = newRange;
        if (added) this.container.sortChildren();
    }

    /**
     * Get growth stage texture for tile-swap crop rendering.
     */
    _getGrowthTexture(stage) {
        if (stage === -1) return this.growthTextures.get('growth_withered');
        return this.growthTextures.get(`growth_${stage}`);
    }

    /**
     * Get a subtle tint per crop type for the tileset growth tile.
     */
    _getCropTint(cropType) {
        const tints = {
            herbs: 0xC8F5C8,     // light green
            flowers: 0xF5C8E8,   // light pink
            berries: 0xC8D8F5,   // light blue
        };
        return tints[cropType] || 0xFFFFFF;
    }

    /**
     * Remove decoration sprite at a key.
     */
    _removeDecorAt(key) {
        const decor = this.decorSprites.get(key);
        if (decor) {
            this.container.removeChild(decor);
            this.decorSprites.delete(key);
        }
    }

    _isTileVisible(q, r) {
        const range = this._renderedRange;
        if (!range) return false;
        return q >= range.qMin && q <= range.qMax && r >= range.rMin && r <= range.rMax;
    }

    _clearTileArtifacts(key) {
        const sprite = this.tiles.get(key);
        if (sprite) {
            this._returnToPool(sprite);
            this.tiles.delete(key);
        }

        const cropSprite = this.cropSprites.get(key);
        if (cropSprite) {
            this._returnToPool(cropSprite);
            this.cropSprites.delete(key);
        }

        const structSprite = this.structureSprites.get(key);
        if (structSprite) {
            this._returnToPool(structSprite);
            this.structureSprites.delete(key);
        }

        const waterSprite = this.waterSprites.get(key);
        if (waterSprite) {
            this._returnToPool(waterSprite);
            this.waterSprites.delete(key);
        }

        const glowSprite = this.glowSprites.get(key);
        if (glowSprite) {
            this.container.removeChild(glowSprite);
            this.glowSprites.delete(key);
        }

        this.tileTypes.delete(key);
        this.waterDescriptors.delete(key);
        this.waterAnimState.delete(key);
        this._removeDecorAt(key);
    }

    _rerenderVisibleTile(q, r) {
        if (!this.isInBounds(q, r) || !this._isTileVisible(q, r)) {
            return false;
        }

        const key = `${q},${r}`;
        this._clearTileArtifacts(key);
        this._renderSingleTile(q, r);
        return true;
    }

    _getLayoutState(q, r) {
        let isHouse = false;
        let isPath = false;
        for (const slot of this.slots) {
            const hq = slot.house_q;
            const hr = slot.house_r;
            if (q >= hq && q <= hq + 3 && r >= hr && r <= hr + 2) {
                isHouse = true;
            }
            if (q >= hq && q <= hq + 3 && r >= hr + 3 && r <= hr + 4) {
                isPath = true;
            }
        }

        const vc = HF.Tilemap;
        const isRoad = q >= vc.ROAD_Q_MIN && q <= vc.ROAD_Q_MAX;
        const pqMin = vc.PLAZA_Q_MIN;
        const pqMax = vc.PLAZA_Q_MAX;
        const prMin = vc.PLAZA_R_MIN;
        const prMax = vc.PLAZA_R_MAX;

        const inInner = q >= pqMin && q <= pqMax && r >= prMin && r <= prMax;
        const inWall = q >= pqMin - 1 && q <= pqMax + 1 && r >= prMin - 1 && r <= prMax + 1;
        const inMoat = q >= pqMin - 3 && q <= pqMax + 3 && r >= prMin - 3 && r <= prMax + 3;
        const inDamp = q >= pqMin - 4 && q <= pqMax + 4 && r >= prMin - 4 && r <= prMax + 4;

        const isWallTile = inWall && !inInner;
        const isMoatTile = inMoat && !inWall;
        const isDampTile = inDamp && !inMoat;
        const isBridge = isRoad && (isWallTile || isMoatTile || isDampTile);

        if (isMoatTile || isWallTile || isDampTile) {
            isHouse = false;
            isPath = false;
        }

        return {
            isHouse,
            isPath,
            isRoad,
            inInner,
            isWallTile,
            isMoatTile,
            isDampTile,
            isBridge,
            pqMin,
            pqMax,
            prMin,
            prMax,
        };
    }

    _getDefaultWaterFlowDirection(q, r, layoutState) {
        if (!layoutState?.isMoatTile) return null;

        if (q <= layoutState.pqMin - 2) {
            if (r <= layoutState.prMin - 1) return 'SE';
            if (r >= layoutState.prMax + 1) return 'SW';
            return 'S';
        }

        if (q >= layoutState.pqMax + 2) {
            if (r <= layoutState.prMin - 1) return 'NE';
            if (r >= layoutState.prMax + 1) return 'NW';
            return 'N';
        }

        if (r <= layoutState.prMin - 2) {
            return 'E';
        }

        if (r >= layoutState.prMax + 2) {
            return 'W';
        }

        return null;
    }

    _normalizeFlowDirection(direction) {
        if (!direction) return null;
        const value = String(direction).toUpperCase();
        return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].includes(value) ? value : null;
    }

    _getWaterStateAt(q, r) {
        if (!this.isInBounds(q, r)) {
            return { isWater: false, elevation: 2, flowDirection: null };
        }

        const key = `${q},${r}`;
        const farmTile = this.farmTiles.get(key);
        const layoutState = this._getLayoutState(q, r);

        if (farmTile && !layoutState.isPath && !layoutState.isHouse) {
            return {
                isWater: farmTile.terrain === 'water',
                elevation: farmTile.elevation ?? 2,
                flowDirection: this._normalizeFlowDirection(farmTile.flow_direction),
            };
        }

        if (layoutState.isMoatTile && !layoutState.isBridge) {
            return {
                isWater: true,
                elevation: 1,
                flowDirection: this._getDefaultWaterFlowDirection(q, r, layoutState),
            };
        }

        return {
            isWater: false,
            elevation: 2,
            flowDirection: null,
        };
    }

    _getWaterNeighborMask(q, r) {
        let mask = 0;
        for (const dir of HF.Tilemap.WATER_DIRECTIONS) {
            if (this._getWaterStateAt(q + dir.dq, r + dir.dr).isWater) {
                mask |= dir.bit;
            }
        }
        return mask;
    }

    static _countBits(mask) {
        let count = 0;
        let value = mask;
        while (value > 0) {
            count += value & 1;
            value >>= 1;
        }
        return count;
    }

    _deriveFlowDirectionFromMask(mask, q, r) {
        const rng = HF.Tilemap._rng(q, r, 211);
        switch (mask) {
            case 0: return null;
            case 1: return 'N';
            case 2: return 'E';
            case 4: return 'S';
            case 8: return 'W';
            case 3: return 'NE';
            case 6: return 'SE';
            case 12: return 'SW';
            case 9: return 'NW';
            case 5: return rng < 0.5 ? 'N' : 'S';
            case 10: return rng < 0.5 ? 'E' : 'W';
            default: {
                const connected = HF.Tilemap.WATER_DIRECTIONS.filter((dir) => (mask & dir.bit) !== 0);
                return connected[Math.floor(rng * connected.length)]?.name || null;
            }
        }
    }

    _directionToEdges(direction) {
        switch (direction) {
            case 'NE': return ['N', 'E'];
            case 'SE': return ['S', 'E'];
            case 'SW': return ['S', 'W'];
            case 'NW': return ['N', 'W'];
            case 'N':
            case 'E':
            case 'S':
            case 'W':
                return [direction];
            default:
                return [];
        }
    }

    _getWaterfallEdge(q, r, elevation, direction) {
        const preferred = this._directionToEdges(direction);
        const orderedDirs = [...preferred];
        for (const dir of HF.Tilemap.WATER_DIRECTIONS) {
            if (!orderedDirs.includes(dir.name)) {
                orderedDirs.push(dir.name);
            }
        }

        for (const dirName of orderedDirs) {
            const dir = HF.Tilemap.WATER_DIRECTIONS.find((entry) => entry.name === dirName);
            if (!dir) continue;
            const neighbor = this._getWaterStateAt(q + dir.dq, r + dir.dr);
            if (neighbor.isWater && neighbor.elevation < elevation) {
                return dir.name;
            }
        }

        return null;
    }

    _getWaterDescriptor(q, r, waterState = null) {
        const state = waterState || this._getWaterStateAt(q, r);
        if (!state.isWater) return null;

        const mask = this._getWaterNeighborMask(q, r);
        const connectedCount = HF.Tilemap._countBits(mask);
        const flowDirection = state.flowDirection || this._deriveFlowDirectionFromMask(mask, q, r);
        const waterfallEdge = this._getWaterfallEdge(q, r, state.elevation, flowDirection);
        const shoreMask = (~mask) & 0xF;

        let surfaceKind = 'calm';
        if (waterfallEdge) {
            surfaceKind = 'waterfall';
        } else if (connectedCount >= 4) {
            surfaceKind = 'junction';
        } else if (connectedCount === 3) {
            surfaceKind = 'junction';
        } else if (connectedCount === 2 && (mask === 5 || mask === 10)) {
            surfaceKind = 'channel';
        } else if (connectedCount === 2) {
            surfaceKind = 'bend';
        } else if (connectedCount === 1) {
            surfaceKind = 'inlet';
        }

        const speed = waterfallEdge ? 'fast' : surfaceKind === 'calm'
            ? 'slow'
            : surfaceKind === 'junction'
                ? 'medium'
                : 'fast';

        const signature = [surfaceKind, flowDirection || 'CALM', shoreMask, waterfallEdge || 'none', speed].join('|');

        return {
            q,
            r,
            mask,
            shoreMask,
            connectedCount,
            flowDirection,
            waterfallEdge,
            surfaceKind,
            speed,
            elevation: state.elevation,
            phaseSeed: HF.Tilemap._rng(q, r, 313),
            signature,
        };
    }

    _getWaterEdgePoints(edge) {
        const edges = {
            N: [{ x: 16, y: 1 }, { x: 30, y: 8 }],
            E: [{ x: 30, y: 8 }, { x: 16, y: 16 }],
            S: [{ x: 16, y: 16 }, { x: 2, y: 8 }],
            W: [{ x: 2, y: 8 }, { x: 16, y: 1 }],
        };
        return edges[edge] || null;
    }

    _getFlowAngle(direction) {
        switch (direction) {
            case 'N':
            case 'S':
                return Math.PI / 2;
            case 'E':
            case 'W':
                return 0;
            case 'NE':
            case 'SW':
                return -Math.PI / 4;
            case 'NW':
            case 'SE':
                return Math.PI / 4;
            default:
                return 0;
        }
    }

    _drawFlowBands(ctx, angle, time, speedScale, accent = false) {
        ctx.save();
        ctx.translate(16, 8);
        ctx.rotate(angle);

        const phase = time * 24 * speedScale;
        for (let i = -4; i <= 4; i++) {
            const offset = ((i * 7) + phase) % 42 - 21;
            ctx.fillStyle = accent ? 'rgba(214, 251, 255, 0.24)' : 'rgba(176, 242, 255, 0.18)';
            ctx.fillRect(-28, offset - 1.6, 56, 2.5);
            ctx.fillStyle = accent ? 'rgba(255, 255, 255, 0.22)' : 'rgba(232, 255, 255, 0.14)';
            ctx.fillRect(-28, offset - 0.5, 56, 1.1);
        }

        ctx.restore();
    }

    _drawCalmRipples(ctx, time) {
        const ripples = [
            { x: 10, y: 6, radius: 5, phase: 0 },
            { x: 20, y: 10, radius: 4, phase: 0.33 },
            { x: 15, y: 12, radius: 3, phase: 0.66 },
        ];

        for (const ripple of ripples) {
            const wave = (Math.sin((time + ripple.phase) * Math.PI * 2) + 1) * 0.5;
            ctx.beginPath();
            ctx.ellipse(ripple.x, ripple.y, ripple.radius + wave, 1.4 + wave * 0.5, 0, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(220, 251, 255, ${0.12 + wave * 0.16})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    _drawFoamEdges(ctx, descriptor, time) {
        for (const dir of HF.Tilemap.WATER_DIRECTIONS) {
            if ((descriptor.shoreMask & dir.bit) === 0) continue;

            const points = this._getWaterEdgePoints(dir.name);
            if (!points) continue;
            const shimmer = 0.4 + Math.sin((time + dir.bit * 0.1) * Math.PI * 2) * 0.15;

            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            ctx.lineTo(points[1].x, points[1].y);
            ctx.strokeStyle = `rgba(232, 251, 255, ${0.34 + shimmer * 0.2})`;
            ctx.lineWidth = descriptor.surfaceKind === 'waterfall' ? 2.5 : 2;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y + 0.3);
            ctx.lineTo(points[1].x, points[1].y + 0.3);
            ctx.strokeStyle = `rgba(132, 234, 255, ${0.2 + shimmer * 0.15})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    _drawWaterfall(ctx, descriptor, time) {
        const points = this._getWaterEdgePoints(descriptor.waterfallEdge);
        if (!points) return;

        const midX = (points[0].x + points[1].x) * 0.5;
        const midY = (points[0].y + points[1].y) * 0.5;
        const drift = Math.sin(time * Math.PI * 2) * 0.8;

        for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.moveTo(midX + i * 2, midY - 0.5);
            ctx.lineTo(midX + i * 1.2 + drift, midY + 6 + Math.abs(i));
            ctx.strokeStyle = i === 0 ? 'rgba(229, 252, 255, 0.55)' : 'rgba(145, 229, 255, 0.34)';
            ctx.lineWidth = i === 0 ? 1.6 : 1;
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.ellipse(midX, midY + 7, 5, 1.6, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(210, 249, 255, 0.22)';
        ctx.fill();
    }

    _createWaterFrameTexture(descriptor, frameIndex) {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 24;
        const ctx = canvas.getContext('2d');
        const time = frameIndex / HF.Tilemap.WATER_FRAME_COUNT;

        const diamond = new Path2D();
        diamond.moveTo(16, 0);
        diamond.lineTo(31, 8);
        diamond.lineTo(16, 16);
        diamond.lineTo(1, 8);
        diamond.closePath();

        ctx.save();
        ctx.clip(diamond);

        const baseGradient = ctx.createLinearGradient(0, 0, 0, 16);
        baseGradient.addColorStop(0, '#1a6d87');
        baseGradient.addColorStop(0.5, '#1f87a4');
        baseGradient.addColorStop(1, '#12566c');
        ctx.fillStyle = baseGradient;
        ctx.fillRect(0, 0, 32, 16);

        const glowGradient = ctx.createRadialGradient(16, 7, 1, 16, 8, 16);
        glowGradient.addColorStop(0, 'rgba(162, 242, 255, 0.34)');
        glowGradient.addColorStop(0.7, 'rgba(96, 206, 230, 0.12)');
        glowGradient.addColorStop(1, 'rgba(20, 72, 90, 0)');
        ctx.fillStyle = glowGradient;
        ctx.fillRect(0, 0, 32, 16);

        if (descriptor.surfaceKind === 'calm') {
            this._drawCalmRipples(ctx, time + descriptor.phaseSeed);
        } else {
            const speedScale = descriptor.speed === 'fast' ? 1.2 : descriptor.speed === 'medium' ? 0.85 : 0.5;
            this._drawFlowBands(ctx, this._getFlowAngle(descriptor.flowDirection), time + descriptor.phaseSeed, speedScale, descriptor.surfaceKind === 'junction');
            if (descriptor.surfaceKind === 'bend' || descriptor.surfaceKind === 'junction') {
                this._drawFlowBands(ctx, this._getFlowAngle(descriptor.flowDirection) + Math.PI / 2, time + descriptor.phaseSeed * 0.5, speedScale * 0.6, true);
            }
        }

        ctx.restore();

        this._drawFoamEdges(ctx, descriptor, time + descriptor.phaseSeed);
        if (descriptor.waterfallEdge) {
            this._drawWaterfall(ctx, descriptor, time + descriptor.phaseSeed);
        }

        return PIXI.Texture.from(canvas);
    }

    _ensureWaterFrameSet(descriptor) {
        let frames = this.waterFrameSets.get(descriptor.signature);
        if (frames) return frames;

        frames = [];
        for (let frameIndex = 0; frameIndex < HF.Tilemap.WATER_FRAME_COUNT; frameIndex++) {
            frames.push(this._createWaterFrameTexture(descriptor, frameIndex));
        }

        this.waterFrameSets.set(descriptor.signature, frames);
        return frames;
    }

    _attachWaterSprite(key, q, r, screenPos, descriptor) {
        const frames = this._ensureWaterFrameSet(descriptor);
        const state = { frame: descriptor.phaseSeed * frames.length };
        const sprite = this._getFromPool(frames[Math.floor(state.frame) % frames.length]);
        sprite.anchor.set(0.5, 0);
        sprite.x = screenPos.x;
        sprite.y = screenPos.y;
        sprite.zIndex = q + r + 0.08;
        sprite.alpha = descriptor.surfaceKind === 'waterfall' ? 0.98 : 0.95;

        this.container.addChild(sprite);
        this.waterSprites.set(key, sprite);
        this.waterDescriptors.set(key, descriptor);
        this.waterAnimState.set(key, state);
    }

    /**
     * Render a single tile at grid position (q, r).
     * Extracted from renderGrid for incremental viewport updates.
     */
    _renderSingleTile(q, r) {
        const key = `${q},${r}`;
        const T = (name) => this.textures.get(name);
        const rng = HF.Tilemap._rng;
        const layoutState = this._getLayoutState(q, r);

        let texture;
        let tileType;
        let isDampGrass = false;

        const farmTile = this.farmTiles.get(key);

        if (farmTile && !layoutState.isPath && !layoutState.isHouse) {
            // If there's a crop, use growth stage texture (tile-swap)
            if (farmTile.crop && farmTile.stage !== undefined && farmTile.stage !== null) {
                const growthTex = this._getGrowthTexture(farmTile.stage);
                if (growthTex) {
                    texture = growthTex;
                    tileType = farmTile.terrain;
                } else {
                    tileType = farmTile.terrain;
                    texture = this._getTerrainTexture(tileType, q, r);
                }
            } else {
                tileType = farmTile.terrain;
                texture = tileType === 'water'
                    ? (T('stone_dark') || T('stone') || T('water'))
                    : this._getTerrainTexture(tileType, q, r);
            }
        } else {
            if (layoutState.isBridge) {
                const rv = rng(q, r, 7);
                if (rv < 0.4)      { texture = T('stone');       tileType = 'stone'; }
                else if (rv < 0.7) { texture = T('stone_light'); tileType = 'stone'; }
                else               { texture = T('stone_dark');  tileType = 'stone'; }
            } else if (layoutState.isPath) {
                const rv = rng(q, r, 7);
                if (rv < 0.5)      { texture = T('path');        tileType = 'path'; }
                else if (rv < 0.8) { texture = T('dirt');        tileType = 'path'; }
                else               { texture = T('dirt_light');  tileType = 'path'; }
            } else if (layoutState.isMoatTile) {
                texture = T('stone_dark') || T('stone') || T('water');
                tileType = 'water';
            } else if (layoutState.isWallTile) {
                texture = T('stone_dark') || T('stone');
                tileType = 'stone';
            } else if (layoutState.inInner || layoutState.isRoad) {
                const rv = rng(q, r, 7);
                if (rv < 0.4)      { texture = T('stone');       tileType = 'stone'; }
                else if (rv < 0.7) { texture = T('stone_light'); tileType = 'stone'; }
                else               { texture = T('stone_dark');  tileType = 'stone'; }
            } else {
                const rv = rng(q, r, 3);
                if (rv < 0.65)      { texture = T('grass');       tileType = 'grass'; }
                else if (rv < 0.85) { texture = T('grass_light'); tileType = 'grass'; }
                else                { texture = T('grass_dark');  tileType = 'grass'; }
            }

            isDampGrass = layoutState.isDampTile && !layoutState.isBridge && tileType === 'grass';
        }

        texture = texture || T('grass');

        const sprite = this._getFromPool(texture);
        const screenPos = this.renderer.worldToScreen(q, r);

        sprite.anchor.set(0.5, 0);
        sprite.x = screenPos.x;
        sprite.y = screenPos.y;
        sprite.zIndex = q + r;
        sprite.tileQ = q;
        sprite.tileR = r;

        this.container.addChild(sprite);
        this.tiles.set(key, sprite);
        this.tileTypes.set(key, tileType);

        // Tinting
        if (farmTile && farmTile.crop && farmTile.stage !== undefined && farmTile.stage !== null) {
            // Crop tile-swap tint
            sprite.tint = this._getCropTint(farmTile.crop);
        } else if (tileType === 'water') {
            sprite.tint = 0x6E8184;
        } else {
            const isTrimmableOwnedGrass = !!farmTile
                && this.isOwnedFarmTile(q, r)
                && farmTile.terrain === 'grass'
                && !farmTile.structure;
            if (isTrimmableOwnedGrass) {
                sprite.tint = 0x6B9F4A;
            } else if (isDampGrass) {
                sprite.tint = 0x7BBF6A;
            }
        }

        if (tileType === 'water') {
            const descriptor = this._getWaterDescriptor(q, r, this._getWaterStateAt(q, r));
            if (descriptor) {
                this._attachWaterSprite(key, q, r, screenPos, descriptor);
            }
        }

        // Decoration on grass tiles (not farm-owned, no crop, no structure)
        if (tileType === 'grass' && !isDampGrass && !farmTile) {
            this._tryPlaceDecor(q, r, screenPos);
        }

        // Render structure if present
        if (farmTile && farmTile.structure) {
            this._updateStructureSprite(q, r, farmTile);
        }
    }

    /**
     * Try to place a decorative object on a grass tile based on deterministic hash.
     */
    _tryPlaceDecor(q, r, screenPos) {
        const rng = HF.Tilemap._rng;
        const key = `${q},${r}`;

        // Trees: ~1.5% of grass tiles (placed first so small decor doesn't overlap)
        const treeRv = rng(q, r, 55);
        if (treeRv < 0.015) {
            const treeTypes = [
                'tree_1', 'tree_2', 'tree_3', 'tree_4', 'tree_5', 'tree_6',
                'tree_dry_1', 'tree_dry_2', 'tree_dry_3',
            ];
            const pick = Math.floor(rng(q, r, 77) * treeTypes.length);
            const tex = this.decorTextures.get(treeTypes[pick]);
            if (tex) {
                const tree = new PIXI.Sprite(tex);
                tree.anchor.set(0.5, 1);
                tree.x = screenPos.x;
                tree.y = screenPos.y + HF.Renderer.TILE_HALF_H + 2;
                tree.zIndex = q + r + 0.4;
                this.container.addChild(tree);
                this.decorSprites.set(key, tree);
                return;
            }
        }

        // Small ground decor: ~4% of grass tiles
        const rv = rng(q, r, 42);
        if (rv > 0.04) return;

        const decorTypes = [
            'mushroom', 'flower_white', 'flower_red', 'flower_blue',
            'flower_yellow', 'tulip', 'bush', 'bush_small',
            'stone', 'stone_flat', 'stump', 'log',
        ];
        const pick = Math.floor(rng(q, r, 99) * decorTypes.length);
        const tex = this.decorTextures.get(decorTypes[pick]);
        if (!tex) return;

        const decor = new PIXI.Sprite(tex);
        decor.anchor.set(0.5, 1);
        decor.x = screenPos.x;
        decor.y = screenPos.y + HF.Renderer.TILE_HALF_H + 2;
        decor.zIndex = q + r + 0.2;
        this.container.addChild(decor);
        this.decorSprites.set(key, decor);
    }

    /**
     * Render a grid of tiles with frustum culling. Overlays farm data where applicable.
     */
    renderGrid() {
        // Clean up all existing sprites
        this.container.removeChildren();
        this.tiles.clear();
        this.tileTypes.clear();
        this.cropSprites.clear();
        this.structureSprites.clear();
        this.glowSprites.clear();
        this.decorSprites.clear();
        this.waterSprites.clear();
        this.waterDescriptors.clear();
        this.waterAnimState.clear();
        this._spritePool = [];

        const T = (name) => this.textures.get(name);
        if (!T('grass')) { console.error('Grass texture not loaded'); return; }

        // Calculate visible range (frustum culling)
        const range = this._getVisibleRange();

        for (let q = range.qMin; q <= range.qMax; q++) {
            for (let r = range.rMin; r <= range.rMax; r++) {
                this._renderSingleTile(q, r);
            }
        }

        this._renderedRange = range;

        // Render farm zone corner posts
        this._renderFarmPosts();

        // Apply current glow phase
        this._applyGlowAlpha();

        this.container.sortChildren();
    }

    /**
     * Animate water tiles — call from game ticker.
     */
    tickWaterAnimation(dt) {
        const clampedDt = Math.min(dt, 3);

        for (const [key, sprite] of this.waterSprites) {
            const descriptor = this.waterDescriptors.get(key);
            if (!descriptor) continue;

            const frames = this._ensureWaterFrameSet(descriptor);
            const state = this.waterAnimState.get(key) || { frame: descriptor.phaseSeed * frames.length };
            const speedScale = descriptor.speed === 'fast' ? 1.3 : descriptor.speed === 'medium' ? 0.95 : 0.55;
            state.frame = (state.frame + HF.Tilemap.WATER_FRAME_SPEED * clampedDt * speedScale) % frames.length;
            sprite.texture = frames[Math.floor(state.frame) % frames.length];
            this.waterAnimState.set(key, state);
        }
    }

    /**
     * Static deterministic noise helper.
     */
    static _rng(q, r, seed = 17) {
        let h = (q * 374761393 + r * 1073741827 + seed) | 0;
        h = ((h ^ (h >>> 13)) * 1540483477) | 0;
        return ((h ^ (h >>> 15)) >>> 0) / 0xFFFFFFFF;
    }

    /**
     * Render fence post markers at farm zone corners and signposts at all slots.
     */
    _renderFarmPosts() {
        // Remove old posts
        for (const p of this.farmPosts) {
            this.container.removeChild(p);
        }
        this.farmPosts = [];

        const postTex = this.textures.get('farm_post');
        if (!postTex) return;

        // Posts mark the reserved area (full expansion boundary) for owned farm
        if (this.farmZone && this.reservedZone) {
            const fz = this.reservedZone;
            const corners = [
                { q: fz.q_min, r: fz.r_min },
                { q: fz.q_max, r: fz.r_min },
                { q: fz.q_min, r: fz.r_max },
                { q: fz.q_max, r: fz.r_max },
            ];
            for (const c of corners) {
                const pos = this.renderer.worldToScreen(c.q, c.r);
                const post = new PIXI.Sprite(postTex);
                post.anchor.set(0.5, 1);
                post.x = pos.x;
                post.y = pos.y + HF.Renderer.TILE_HALF_H + 2;
                post.zIndex = c.q + c.r + 0.5;
                this.container.addChild(post);
                this.farmPosts.push(post);
            }
        }

        // Signposts at all farm slots (roadside corner closest to village)
        for (const slot of this.slots) {
            // Signpost at east edge (q_max) of the reserved plot, at the r closest to plaza
            const signQ = slot.reserved_q_max;
            const signR = slot.dir === 'south' ? slot.r : slot.r + 15;

            const pos = this.renderer.worldToScreen(signQ, signR);
            const post = new PIXI.Sprite(postTex);
            post.anchor.set(0.5, 1);
            post.x = pos.x;
            post.y = pos.y + HF.Renderer.TILE_HALF_H + 2;
            post.zIndex = signQ + signR + 0.5;

            // Check if this slot is claimed (overlaps with our reserved zone)
            const isMine = this.reservedZone
                && slot.q === this.reservedZone.q_min
                && slot.r === this.reservedZone.r_min;

            // Tint: owned = dark farm marker, unclaimed = grey
            post.tint = isMine ? 0x6B9F4A : 0x999999;

            this.container.addChild(post);
            this.farmPosts.push(post);

            // Add slot name label
            const label = new PIXI.Text({
                text: slot.name,
                style: {
                    fontFamily: 'Press Start 2P',
                    fontSize: 5,
                    fill: isMine ? 0x4A7C2E : 0x777777,
                    align: 'center',
                    stroke: { color: 0xFAF0E6, width: 2 },
                },
            });
            label.anchor.set(0.5, 1);
            label.x = pos.x;
            label.y = pos.y + HF.Renderer.TILE_HALF_H - 8;
            label.zIndex = signQ + signR + 0.6;
            this.container.addChild(label);
            this.farmPosts.push(label);

            // Render house at house plot position (if slot is claimed)
            if (isMine) {
                const houseTex = this.textures.get(`house_${slot.name}`);
                if (houseTex) {
                    // House sits at house_q, house_r (4×3 tile footprint)
                    // X: footprint center for horizontal alignment
                    // Y: south vertex of footprint — sprite base sits at ground there
                    const centerQ = slot.house_q + 1.5;
                    const centerR = slot.house_r + 1;
                    const housePos = this.renderer.worldToScreen(centerQ, centerR);
                    const baseY = this.renderer.worldToScreen(
                        slot.house_q + 3, slot.house_r + 2
                    ).y;
                    const house = new PIXI.Sprite(houseTex);
                    house.anchor.set(0.5, 1);
                    house.x = housePos.x;
                    house.y = baseY + HF.Renderer.TILE_HALF_H + 2;
                    house.zIndex = slot.house_q + slot.house_r + 2;
                    this.container.addChild(house);
                    this.farmPosts.push(house);

                    // House glow (centered on house footprint)
                    const hcQ = slot.house_q + 2;
                    const hcR = slot.house_r + 1;
                    const hcPos = this.renderer.worldToScreen(hcQ, hcR);
                    this._addGlowSprite(hcQ, hcR, hcPos, 2.5);
                }
            }
        }
    }

    /**
     * Get terrain texture for a terrain type string.
     */
    _getTerrainTexture(terrain, q, r) {
        const T = (name) => this.textures.get(name);
        const rng = HF.Tilemap._rng;

        switch (terrain) {
            case 'tilled': return T('tilled') || T('farm_plot');
            case 'stone': {
                const rv = rng(q, r, 7);
                if (rv < 0.4) return T('stone');
                if (rv < 0.7) return T('stone_light');
                return T('stone_dark');
            }
            case 'grass':
            default: {
                const rv = rng(q, r, 3);
                if (rv < 0.65) return T('grass');
                if (rv < 0.85) return T('grass_light');
                return T('grass_dark');
            }
        }
    }

    /**
     * Create or update a crop sprite on a tile (legacy overlay — kept for fallback).
     */
    _updateCropSprite(q, r, tileData) {
        // Tile-swap approach: update the base tile texture instead of using overlay
        const key = `${q},${r}`;
        const sprite = this.tiles.get(key);

        // Remove old overlay if any
        const existing = this.cropSprites.get(key);
        if (existing) {
            this.container.removeChild(existing);
            this.cropSprites.delete(key);
        }

        if (!sprite) return;

        if (!tileData.crop || tileData.stage === undefined || tileData.stage === null) {
            // Restore terrain texture
            const terrainTex = this._getTerrainTexture(tileData.terrain || 'tilled', q, r);
            if (terrainTex) sprite.texture = terrainTex;
            sprite.tint = 0xFFFFFF;
            return;
        }

        // Tile-swap: use growth stage texture
        const growthTex = this._getGrowthTexture(tileData.stage);
        if (growthTex) {
            sprite.texture = growthTex;
            sprite.tint = this._getCropTint(tileData.crop);
        }
    }

    /**
     * Create or update a structure sprite on a tile.
     */
    _updateStructureSprite(q, r, tileData) {
        const key = `${q},${r}`;
        const screenPos = this.renderer.worldToScreen(q, r);

        // Remove existing structure sprite
        const existing = this.structureSprites.get(key);
        if (existing) {
            this.container.removeChild(existing);
            this.structureSprites.delete(key);
        }

        if (!tileData.structure) {
            return;
        }

        const tier = tileData.tier || 1;
        const texKey = `${tileData.structure}_${tier}`;
        const tex = this.buildingTextures.get(texKey);
        if (!tex) return;

        const sprite = new PIXI.Sprite(tex);
        sprite.anchor.set(0.5, 1);
        sprite.x = screenPos.x;
        sprite.y = screenPos.y + HF.Renderer.TILE_HALF_H + 2;
        sprite.zIndex = q + r + 0.3;

        this.container.addChild(sprite);
        this.structureSprites.set(key, sprite);

        // Add glow sprite for night lighting
        this._addGlowSprite(q, r, screenPos);
    }

    /**
     * Check if a tile is within the player's farm zone.
     */
    isOwnedFarmTile(q, r) {
        if (!this.farmZone) return false;
        return q >= this.farmZone.q_min && q <= this.farmZone.q_max
            && r >= this.farmZone.r_min && r <= this.farmZone.r_max;
    }

    /**
     * Check if a tile is within the reserved (future expansion) area but NOT the active farm.
     */
    isReservedTile(q, r) {
        if (!this.reservedZone) return false;
        if (this.isOwnedFarmTile(q, r)) return false;
        return q >= this.reservedZone.q_min && q <= this.reservedZone.q_max
            && r >= this.reservedZone.r_min && r <= this.reservedZone.r_max;
    }

    /**
     * Get farm tile data for a position.
     */
    getFarmTile(q, r) {
        return this.farmTiles.get(`${q},${r}`) || null;
    }

    /**
     * Get the tile sprite at grid position (q, r).
     */
    getTile(q, r) {
        return this.tiles.get(`${q},${r}`) || null;
    }

    /**
     * Check if a grid position is within the map bounds.
     */
    isInBounds(q, r) {
        return q >= 0 && q < this.gridSize && r >= 0 && r < this.gridRSize;
    }

    /**
     * Check if a tile is walkable.
     */
    isWalkable(q, r) {
        if (!this.isInBounds(q, r)) return false;
        const type = this.tileTypes.get(`${q},${r}`);
        return type != null && !this.unwalkableTypes.has(type);
    }

    /**
     * Get human-readable info about a tile for tooltip display.
     */
    getTileInfo(q, r) {
        if (!this.isInBounds(q, r)) return null;
        const farmTile = this.getFarmTile(q, r);
        const terrain = farmTile ? farmTile.terrain : (this.tileTypes.get(`${q},${r}`) || 'unknown');
        const isFarm = this.isOwnedFarmTile(q, r);

        const info = { terrain, isFarm };

        if (farmTile && farmTile.crop) {
            info.crop = farmTile.crop;
            info.stage = farmTile.stage;
            info.watered = !!farmTile.watered;
            const stageNames = { 0: 'Seed', 1: 'Sprout', 2: 'Growing', 3: 'Ready!', '-1': 'Withered' };
            info.stageLabel = stageNames[String(info.stage)] || '?';
            if (farmTile.remaining != null) info.remaining = farmTile.remaining;
            if (farmTile.grow_total != null) info.growTotal = farmTile.grow_total;
        }

        if (farmTile && farmTile.structure) {
            info.structure = farmTile.structure;
            info.tier = farmTile.tier || 1;
        }

        return info;
    }

    /**
     * Add a glow sprite at a tile position for night lighting.
     * @param {number} q
     * @param {number} r
     * @param {{x:number, y:number}} screenPos
     * @param {number} scale - Scale multiplier (default 1.5)
     */
    _addGlowSprite(q, r, screenPos, scale = 1.5) {
        if (!this.glowTexture) return;
        const key = `${q},${r}`;
        const existing = this.glowSprites.get(key);
        if (existing) {
            this.container.removeChild(existing);
        }

        const glow = new PIXI.Sprite(this.glowTexture);
        glow.anchor.set(0.5, 0.5);
        glow.x = screenPos.x;
        glow.y = screenPos.y + HF.Renderer.TILE_HALF_H;
        glow.zIndex = q + r + 0.15;
        glow.alpha = this._glowTarget;
        glow.scale.set(scale);
        glow.blendMode = 'add';

        this.container.addChild(glow);
        this.glowSprites.set(key, glow);
    }

    /**
     * Set the day phase and animate glow sprites accordingly.
     * @param {string} phase - 'dawn' | 'day' | 'dusk' | 'night'
     */
    setDayPhase(phase) {
        if (phase === this._dayPhase) return;
        this._dayPhase = phase;

        const targets = { dawn: 0.15, day: 0, dusk: 0.45, night: 0.75 };
        this._glowTarget = targets[phase] ?? 0;
        this._applyGlowAlpha();
    }

    /**
     * Apply current glow target alpha to all glow sprites.
     */
    _applyGlowAlpha() {
        for (const [, glow] of this.glowSprites) {
            glow.alpha = this._glowTarget;
        }
    }
};
