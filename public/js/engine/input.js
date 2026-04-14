/**
 * HF.Input — Mouse, touch, and keyboard input handling.
 *
 * Handles camera pan/zoom (mouse wheel, pinch, drag) and tile click/tap detection.
 * Emits callbacks for tile interactions.
 */
window.HF = window.HF || {};

HF.Input = class {
    /** @type {HF.Renderer} */
    renderer = null;

    /** @type {HF.Tilemap} */
    tilemap = null;

    // Callbacks
    onTileClick = null;  // (q, r) => void
    onTileHover = null;  // (q, r) => void

    // Drag state
    _dragging = false;
    _dragButton = -1;
    _lastPointer = { x: 0, y: 0 };
    _mouseDownPos = null;   // start position for dead-zone check
    _dragThreshold = 4;     // px before left-click becomes a drag

    // Pinch state
    _pinching = false;
    _pinchStartDist = 0;
    _pinchStartZoom = 1;

    constructor(renderer, tilemap) {
        this.renderer = renderer;
        this.tilemap = tilemap;
        this._setupMouseEvents();
        this._setupTouchEvents();
        this._setupKeyboardEvents();
    }

    _setupMouseEvents() {
        const canvas = this.renderer.app.canvas;

        // Wheel zoom
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.15 : 0.87;
            this.renderer.zoom(factor, e.clientX, e.clientY);
        }, { passive: false });

        // Mouse down
        canvas.addEventListener('mousedown', (e) => {
            this._dragButton = e.button;
            this._lastPointer = { x: e.clientX, y: e.clientY };

            if (e.button === 0 || e.button === 1) {
                // Left-click or middle-click: record start for drag detection
                this._mouseDownPos = { x: e.clientX, y: e.clientY };
                if (e.button === 1) {
                    // Middle-click starts drag immediately
                    this._dragging = true;
                    canvas.style.cursor = 'grabbing';
                }
            }
        });

        // Mouse move
        canvas.addEventListener('mousemove', (e) => {
            // Left-click: promote to drag once past threshold
            if (!this._dragging && this._dragButton === 0 && this._mouseDownPos) {
                const dx = e.clientX - this._mouseDownPos.x;
                const dy = e.clientY - this._mouseDownPos.y;
                if (Math.abs(dx) > this._dragThreshold || Math.abs(dy) > this._dragThreshold) {
                    this._dragging = true;
                    canvas.style.cursor = 'grabbing';
                }
            }

            if (this._dragging) {
                const dx = e.clientX - this._lastPointer.x;
                const dy = e.clientY - this._lastPointer.y;
                this.renderer.pan(dx, dy);
                this._lastPointer = { x: e.clientX, y: e.clientY };
            } else {
                // Hover detection
                const pos = this.renderer.screenToWorld(e.clientX, e.clientY);
                if (this.tilemap.isInBounds(pos.q, pos.r) && this.onTileHover) {
                    this.onTileHover(pos.q, pos.r);
                }
            }
        });

        // Mouse up
        canvas.addEventListener('mouseup', (e) => {
            if (this._dragging) {
                this._dragging = false;
                canvas.style.cursor = 'default';
            } else if (e.button === 0) {
                // Left-click on tile (no drag occurred)
                const pos = this.renderer.screenToWorld(e.clientX, e.clientY);
                if (this.tilemap.isInBounds(pos.q, pos.r) && this.onTileClick) {
                    this.onTileClick(pos.q, pos.r);
                }
            }
            this._dragButton = -1;
            this._mouseDownPos = null;
        });

        // Prevent default browser context menu (game.js shows custom one)
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    _setupTouchEvents() {
        const canvas = this.renderer.app.canvas;
        let touchStartPos = null;
        let touchMoved = false;

        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touches = e.touches;

            if (touches.length === 1) {
                // Single touch — potential tap or drag
                touchStartPos = { x: touches[0].clientX, y: touches[0].clientY };
                this._lastPointer = { ...touchStartPos };
                touchMoved = false;
            } else if (touches.length === 2) {
                // Two fingers — pinch/pan start
                this._pinching = true;
                this._pinchStartDist = this._touchDist(touches[0], touches[1]);
                this._pinchStartZoom = this.renderer.camera.zoom;
                this._lastPointer = this._touchCenter(touches[0], touches[1]);
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touches = e.touches;

            if (touches.length === 1 && !this._pinching) {
                // Single finger drag = pan
                const dx = touches[0].clientX - this._lastPointer.x;
                const dy = touches[0].clientY - this._lastPointer.y;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                    touchMoved = true;
                    this.renderer.pan(dx, dy);
                }
                this._lastPointer = { x: touches[0].clientX, y: touches[0].clientY };
            } else if (touches.length === 2) {
                // Pinch zoom
                const dist = this._touchDist(touches[0], touches[1]);
                const center = this._touchCenter(touches[0], touches[1]);

                // Zoom
                const newZoom = this._pinchStartZoom * (dist / this._pinchStartDist);
                const factor = newZoom / this.renderer.camera.zoom;
                this.renderer.zoom(factor, center.x, center.y);

                // Pan
                const dx = center.x - this._lastPointer.x;
                const dy = center.y - this._lastPointer.y;
                this.renderer.pan(dx, dy);
                this._lastPointer = center;
            }
        }, { passive: false });

        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();

            if (e.touches.length === 0) {
                if (!touchMoved && !this._pinching && touchStartPos) {
                    // Tap — treat as tile click
                    const pos = this.renderer.screenToWorld(touchStartPos.x, touchStartPos.y);
                    if (this.tilemap.isInBounds(pos.q, pos.r) && this.onTileClick) {
                        this.onTileClick(pos.q, pos.r);
                    }
                }
                this._pinching = false;
                touchStartPos = null;
                touchMoved = false;
            }
        }, { passive: false });
    }

    _setupKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Close all panels and context menus
                document.querySelectorAll('.game-panel').forEach(p => p.classList.add('hidden'));
                const ctx = document.getElementById('ctx-menu');
                if (ctx) ctx.classList.add('hidden');
            }
        });
    }

    _touchDist(t1, t2) {
        const dx = t1.clientX - t2.clientX;
        const dy = t1.clientY - t2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    _touchCenter(t1, t2) {
        return {
            x: (t1.clientX + t2.clientX) / 2,
            y: (t1.clientY + t2.clientY) / 2,
        };
    }
};
