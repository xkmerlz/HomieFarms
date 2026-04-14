/**
 * HF.Pathfinding — A* pathfinding on the isometric grid.
 *
 * Uses a binary-heap–backed A* to find the shortest walkable path
 * between two tiles. Supports 4-directional movement (N/S/E/W in
 * axial coords) with optional diagonal extension later.
 */
window.HF = window.HF || {};

HF.Pathfinding = class {
    /** @type {HF.Tilemap} */
    tilemap = null;

    constructor(tilemap) {
        this.tilemap = tilemap;
    }

    /**
     * Find the shortest path from (startQ, startR) to (endQ, endR).
     * Returns an array of {q, r} nodes from start to end (inclusive),
     * or null if no path exists.
     */
    findPath(startQ, startR, endQ, endR) {
        const tm = this.tilemap;

        // Bail early if target is out of bounds or unwalkable
        if (!tm.isInBounds(endQ, endR) || !tm.isWalkable(endQ, endR)) {
            return null;
        }

        // Same tile — no movement needed
        if (startQ === endQ && startR === endR) {
            return [{ q: startQ, r: startR }];
        }

        // 8-directional neighbors (axial grid: cardinal + diagonal)
        const SQRT2 = Math.SQRT2;
        const DIRS = [
            { dq: -1, dr:  0, cost: 1 },      // NW
            { dq:  1, dr:  0, cost: 1 },      // SE
            { dq:  0, dr: -1, cost: 1 },      // NE
            { dq:  0, dr:  1, cost: 1 },      // SW
            { dq: -1, dr: -1, cost: SQRT2 },  // N
            { dq:  1, dr:  1, cost: SQRT2 },  // S
            { dq: -1, dr:  1, cost: SQRT2 },  // W
            { dq:  1, dr: -1, cost: SQRT2 },  // E
        ];

        const key = (q, r) => `${q},${r}`;
        // Chebyshev distance for 8-dir movement
        const heuristic = (q, r) => Math.max(Math.abs(q - endQ), Math.abs(r - endR));

        // Open set (min-heap by fScore)
        const open = new MinHeap();
        const gScore = new Map();
        const cameFrom = new Map();
        const closed = new Set();

        const startKey = key(startQ, startR);
        gScore.set(startKey, 0);
        open.push({ q: startQ, r: startR, f: heuristic(startQ, startR) });

        while (open.size > 0) {
            const current = open.pop();
            const ck = key(current.q, current.r);

            if (current.q === endQ && current.r === endR) {
                return this._reconstruct(cameFrom, current.q, current.r, startQ, startR);
            }

            if (closed.has(ck)) continue;
            closed.add(ck);

            const currentG = gScore.get(ck);

            for (const dir of DIRS) {
                const nq = current.q + dir.dq;
                const nr = current.r + dir.dr;
                const nk = key(nq, nr);

                if (closed.has(nk)) continue;
                if (!tm.isInBounds(nq, nr) || !tm.isWalkable(nq, nr)) continue;

                // For diagonal moves, both adjacent cardinal tiles must be walkable
                // to prevent corner-cutting through unwalkable tiles
                if (dir.dq !== 0 && dir.dr !== 0) {
                    if (!tm.isWalkable(current.q + dir.dq, current.r) ||
                        !tm.isWalkable(current.q, current.r + dir.dr)) {
                        continue;
                    }
                }

                const tentativeG = currentG + dir.cost;

                if (!gScore.has(nk) || tentativeG < gScore.get(nk)) {
                    gScore.set(nk, tentativeG);
                    cameFrom.set(nk, { q: current.q, r: current.r });
                    open.push({ q: nq, r: nr, f: tentativeG + heuristic(nq, nr) });
                }
            }
        }

        // No path found
        return null;
    }

    /**
     * Reconstruct the path by walking cameFrom links backwards.
     */
    _reconstruct(cameFrom, endQ, endR, startQ, startR) {
        const path = [];
        let q = endQ;
        let r = endR;
        const key = (q, r) => `${q},${r}`;

        while (q !== startQ || r !== startR) {
            path.push({ q, r });
            const prev = cameFrom.get(key(q, r));
            q = prev.q;
            r = prev.r;
        }

        path.push({ q: startQ, r: startR });
        path.reverse();
        return path;
    }
};

/**
 * Simple binary min-heap keyed on `f` property.
 */
class MinHeap {
    constructor() {
        this.data = [];
    }

    get size() {
        return this.data.length;
    }

    push(node) {
        this.data.push(node);
        this._bubbleUp(this.data.length - 1);
    }

    pop() {
        const top = this.data[0];
        const last = this.data.pop();
        if (this.data.length > 0) {
            this.data[0] = last;
            this._sinkDown(0);
        }
        return top;
    }

    _bubbleUp(i) {
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (this.data[i].f >= this.data[parent].f) break;
            [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
            i = parent;
        }
    }

    _sinkDown(i) {
        const n = this.data.length;
        while (true) {
            let smallest = i;
            const left = 2 * i + 1;
            const right = 2 * i + 2;
            if (left < n && this.data[left].f < this.data[smallest].f) smallest = left;
            if (right < n && this.data[right].f < this.data[smallest].f) smallest = right;
            if (smallest === i) break;
            [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
            i = smallest;
        }
    }
}
