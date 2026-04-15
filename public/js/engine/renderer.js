/**
 * HF.Renderer — PixiJS application setup, camera, coordinate conversion.
 *
 * Manages the PixiJS Application, a world container (camera), and provides
 * isometric ↔ screen coordinate conversion.
 */
window.HF = window.HF || {};

HF.Renderer = class {
    /** @type {PIXI.Application} */
    app = null;

    /** @type {PIXI.Container} World container (camera) */
    world = null;

    // Isometric tile dimensions — real tiles from cozy_iso tileset are 32px wide.
    // The top face diamond is 32×16px → half-steps of 16 and 8.
    static TILE_W = 32;
    static TILE_H = 16;
    static TILE_HALF_W = 16;
    static TILE_HALF_H = 8;

    // Camera state
    camera = { x: 0, y: 0, zoom: 2 };

    /** @type {Function|null} Callback when viewport changes (camera move/zoom) */
    onViewportChange = null;

    constructor() {
        this._initPromise = this._init();
    }

    async _init() {
        const canvas = document.getElementById('game-canvas');

        this.app = new PIXI.Application();
        await this.app.init({
            canvas: canvas,
            resizeTo: window,
            background: 0x1a1a2e,
            antialias: false,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });

        // Pixel-art: disable linear filtering on all textures
        PIXI.TextureStyle.defaultOptions.scaleMode = 'nearest';

        // World container acts as the camera
        this.world = new PIXI.Container();
        this.app.stage.addChild(this.world);

        // Center camera on the map
        this._updateCamera();

        // Handle resize
        window.addEventListener('resize', () => this._updateCamera());
    }

    async ready() {
        return this._initPromise;
    }

    /**
     * Convert isometric grid coords (q, r) to screen pixel position.
     */
    worldToScreen(q, r) {
        const x = (q - r) * HF.Renderer.TILE_HALF_W;
        const y = (q + r) * HF.Renderer.TILE_HALF_H;
        return { x, y };
    }

    /**
     * Convert screen pixel position to isometric grid coords (q, r).
     * Accounts for camera offset and zoom.
     *
     * worldToScreen returns the TOP APEX of each tile's diamond.
     * A user click naturally lands on the visual diamond CENTER, which is
     * TILE_HALF_H pixels below the apex. We compensate by shifting isoY
     * down by TILE_HALF_H so the center of the diamond maps to exact (q,r).
     */
    screenToWorld(screenX, screenY) {
        // Remove camera transform
        const worldX = (screenX - this.world.x) / this.world.scale.x;
        const worldY = (screenY - this.world.y) / this.world.scale.y;

        // Shift reference from diamond apex to diamond center
        const isoY = worldY - HF.Renderer.TILE_HALF_H;

        // Inverse isometric projection
        const q = (worldX / HF.Renderer.TILE_HALF_W + isoY / HF.Renderer.TILE_HALF_H) / 2;
        const r = (isoY / HF.Renderer.TILE_HALF_H - worldX / HF.Renderer.TILE_HALF_W) / 2;

        return { q: Math.round(q), r: Math.round(r) };
    }

    /**
     * Pan the camera by a delta.
     */
    pan(dx, dy) {
        this.camera.x += dx;
        this.camera.y += dy;
        this._updateCamera();
    }

    /**
     * Zoom the camera. Factor > 1 zooms in, < 1 zooms out.
     */
    zoom(factor, centerX, centerY) {
        const oldZoom = this.camera.zoom;
        this.camera.zoom = Math.max(0.5, Math.min(6, this.camera.zoom * factor));

        // Adjust camera position to zoom toward the pointer
        if (centerX !== undefined && centerY !== undefined) {
            const zoomRatio = this.camera.zoom / oldZoom;
            this.camera.x = centerX - (centerX - this.camera.x) * zoomRatio;
            this.camera.y = centerY - (centerY - this.camera.y) * zoomRatio;
        }

        this._updateCamera();
    }

    /**
     * Center the camera on a specific grid position.
     */
    centerOn(q, r) {
        const { x, y } = this.worldToScreen(q, r);
        const w = this.app.screen.width;
        const h = this.app.screen.height;
        this.camera.x = w / 2 - x * this.camera.zoom;
        this.camera.y = h / 2 - y * this.camera.zoom;
        this._updateCamera();
    }

    _updateCamera() {
        if (!this.world) return;
        this.world.x = this.camera.x;
        this.world.y = this.camera.y;
        this.world.scale.set(this.camera.zoom);
        if (this.onViewportChange) this.onViewportChange();
    }
};
