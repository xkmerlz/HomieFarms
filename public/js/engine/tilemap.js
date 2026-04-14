/**
 * HF.Tilemap — Isometric tile grid renderer.
 *
 * Loads tile textures, renders a grid of isometric tiles, handles depth sorting.
 * Supports server-driven farm data overlay with crop sprites.
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

    /** @type {Map<string, PIXI.Texture>} Building textures keyed by "type_tier" */
    buildingTextures = new Map();

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
            'water', 'highlight', 'farm_post',
        ];

        for (const name of tileNames) {
            try {
                const texture = await PIXI.Assets.load(`/sprites/tiles/${name}.png`);
                this.textures.set(name, texture);
            } catch (e) {
                console.warn(`Failed to load tile texture: ${name}`, e);
            }
        }

        // Load crop textures
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

        // Load building textures
        try {
            const houseTex = await PIXI.Assets.load('/sprites/buildings/house.png');
            this.textures.set('house', houseTex);
        } catch (e) {
            console.warn('Failed to load house texture', e);
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

        // Update farm tile data
        let existing = this.farmTiles.get(key) || { q, r };
        Object.assign(existing, data);
        this.farmTiles.set(key, existing);

        // Update terrain sprite
        if (data.terrain) {
            const terrainTex = this._getTerrainTexture(data.terrain, q, r);
            const sprite = this.tiles.get(key);
            if (sprite && terrainTex) {
                sprite.texture = terrainTex;
            }
            this.tileTypes.set(key, data.terrain);
        }

        // Update crop sprite
        this._updateCropSprite(q, r, existing);

        // Update structure sprite
        this._updateStructureSprite(q, r, existing);
    }

    /**
     * Render a grid of tiles. Overlays farm data where applicable.
     */
    renderGrid() {
        this.container.removeChildren();
        this.tiles.clear();
        this.tileTypes.clear();
        this.cropSprites.clear();
        this.structureSprites.clear();

        const T = (name) => this.textures.get(name);

        // Simple deterministic noise helper (no external lib)
        const rng = (q, r, seed = 17) => {
            let h = (q * 374761393 + r * 1073741827 + seed) | 0;
            h = ((h ^ (h >>> 13)) * 1540483477) | 0;
            return ((h ^ (h >>> 15)) >>> 0) / 0xFFFFFFFF;
        };

        if (!T('grass')) { console.error('Grass texture not loaded'); return; }

        for (let q = 0; q < this.gridSize; q++) {
            for (let r = 0; r < this.gridRSize; r++) {
                const key = `${q},${r}`;
                let texture;
                let tileType;
                let isDampGrass = false;

                // Check if this tile is a house or path from slot data
                // (must be checked before farmTile, since path tiles exist in farm zone)
                let isHouse = false;
                let isPath = false;
                for (const slot of this.slots) {
                    const hq = slot.house_q, hr = slot.house_r;
                    // House: 4 wide × 3 deep
                    if (q >= hq && q <= hq + 3 && r >= hr && r <= hr + 2) {
                        isHouse = true;
                    }
                        // Dirt path: 4 wide × 2 deep, south of house, reaching the road on its east edge
                        if (q >= hq && q <= hq + 3 && r >= hr + 3 && r <= hr + 4) {
                        isPath = true;
                    }
                }

                // Check for server-driven farm tile first
                const farmTile = this.farmTiles.get(key);

                if (farmTile && !isPath && !isHouse) {
                    tileType = farmTile.terrain;
                    texture = this._getTerrainTexture(tileType, q, r);
                } else {
                    // Layout-driven terrain generation
                    const vc = HF.Tilemap;
                    const isRoad = (q >= vc.ROAD_Q_MIN && q <= vc.ROAD_Q_MAX);

                    // Plaza border geometry (4-ring border around 12×12 inner stone)
                    // Inner stone: PLAZA_Q/R_MIN..MAX (12×12)
                    // Ring 1 (wall): offset 1 — dark stone
                    // Ring 2-3 (moat): offset 2-3 — water (2 tiles wide)
                    // Ring 4 (damp): offset 4 — grass with wet tint
                    const pqMin = vc.PLAZA_Q_MIN, pqMax = vc.PLAZA_Q_MAX;
                    const prMin = vc.PLAZA_R_MIN, prMax = vc.PLAZA_R_MAX;

                    const inInner = q >= pqMin && q <= pqMax && r >= prMin && r <= prMax;
                    const inWall  = q >= pqMin-1 && q <= pqMax+1 && r >= prMin-1 && r <= prMax+1;
                    const inMoat  = q >= pqMin-3 && q <= pqMax+3 && r >= prMin-3 && r <= prMax+3;
                    const inDamp  = q >= pqMin-4 && q <= pqMax+4 && r >= prMin-4 && r <= prMax+4;

                    const isWallTile = inWall && !inInner;
                    const isMoatTile = inMoat && !inWall;
                    const isDampTile = inDamp && !inMoat;

                    // Bridge: road tiles that cross through wall/moat/damp
                    const isBridge = isRoad && (isWallTile || isMoatTile || isDampTile);

                    // Paths and houses must not override moat/wall/damp
                    if (isMoatTile || isWallTile || isDampTile) {
                        isHouse = false;
                        isPath = false;
                    }

                    if (isBridge) {
                        const rv = rng(q, r, 7);
                        if (rv < 0.4)      { texture = T('stone');       tileType = 'stone'; }
                        else if (rv < 0.7) { texture = T('stone_light'); tileType = 'stone'; }
                        else               { texture = T('stone_dark');  tileType = 'stone'; }
                    } else if (isPath) {
                        const rv = rng(q, r, 7);
                        if (rv < 0.5)      { texture = T('path');        tileType = 'path'; }
                        else if (rv < 0.8) { texture = T('dirt');        tileType = 'path'; }
                        else               { texture = T('dirt_light');  tileType = 'path'; }
                    } else if (isMoatTile && T('water')) {
                        texture = T('water');
                        tileType = 'water';
                    } else if (isWallTile) {
                        texture = T('stone_dark') || T('stone');
                        tileType = 'stone';
                    } else if (inInner || isRoad) {
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

                    // Damp grass flag (near water) — tint applied after sprite creation
                    isDampGrass = isDampTile && !isBridge && tileType === 'grass';
                }

                texture = texture || T('grass');

                const sprite = new PIXI.Sprite(texture);
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

                    const isTrimmableOwnedGrass = !!farmTile
                        && this.isOwnedFarmTile(q, r)
                        && farmTile.terrain === 'grass'
                        && !farmTile.structure;

                    // Visual language: darker grass means "you can trim/till this"
                    if (isTrimmableOwnedGrass) {
                        sprite.tint = 0x6B9F4A;
                    } else if (isDampGrass) {
                        // Damp grass near water — darker/wetter look
                        sprite.tint = 0x7BBF6A;
                    }

                // Render crop if present
                if (farmTile && farmTile.crop) {
                    this._updateCropSprite(q, r, farmTile);
                }

                // Render structure if present
                if (farmTile && farmTile.structure) {
                    this._updateStructureSprite(q, r, farmTile);
                }
            }
        }

        // Render farm zone corner posts
        this._renderFarmPosts();

        this.container.sortChildren();
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
                const houseTex = this.textures.get('house');
                if (houseTex) {
                    // House sits at house_q, house_r (4×3 tile footprint)
                    // Anchor at the north point of the base diamond
                    const housePos = this.renderer.worldToScreen(slot.house_q, slot.house_r);
                    const house = new PIXI.Sprite(houseTex);
                    // North point of 4q×3r footprint in sprite: x=FP_R*16=48, y=ROOF+WALL=42
                    // Canvas 112×98 → anchor (48/112, 42/98) = (3/7, 3/7)
                    house.anchor.set(3/7, 3/7);
                    house.x = housePos.x;
                    house.y = housePos.y;
                    house.zIndex = slot.house_q + slot.house_r + 2;
                    this.container.addChild(house);
                    this.farmPosts.push(house);
                }
            }
        }
    }

    /**
     * Get terrain texture for a terrain type string.
     */
    _getTerrainTexture(terrain, q, r) {
        const T = (name) => this.textures.get(name);
        const rng = (q2, r2, seed) => {
            let h = (q2 * 374761393 + r2 * 1073741827 + seed) | 0;
            h = ((h ^ (h >>> 13)) * 1540483477) | 0;
            return ((h ^ (h >>> 15)) >>> 0) / 0xFFFFFFFF;
        };

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
     * Create or update a crop sprite on a tile.
     */
    _updateCropSprite(q, r, tileData) {
        const key = `${q},${r}`;
        const screenPos = this.renderer.worldToScreen(q, r);

        // Remove existing crop sprite
        const existing = this.cropSprites.get(key);
        if (existing) {
            this.container.removeChild(existing);
            this.cropSprites.delete(key);
        }

        if (!tileData.crop || tileData.stage === undefined || tileData.stage === null) {
            return;
        }

        // Pick crop texture
        let texKey;
        if (tileData.stage === -1) {
            texKey = 'withered';
        } else {
            texKey = `${tileData.crop}_${tileData.stage}`;
        }

        const tex = this.cropTextures.get(texKey);
        if (!tex) return;

        const cropSprite = new PIXI.Sprite(tex);
        cropSprite.anchor.set(0.5, 1);
        cropSprite.x = screenPos.x;
        // Position crop on tile top-face center
        cropSprite.y = screenPos.y + 16;
        cropSprite.zIndex = q + r + 0.25; // slightly above tile

        this.container.addChild(cropSprite);
        this.cropSprites.set(key, cropSprite);
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
        }

        if (farmTile && farmTile.structure) {
            info.structure = farmTile.structure;
            info.tier = farmTile.tier || 1;
        }

        return info;
    }
};
