/**
 * HF.Api — REST API client for server communication.
 *
 * All game state changes go through these endpoints.
 */
window.HF = window.HF || {};

HF.Api = {
    _csrf: document.querySelector('meta[name="csrf-token"]')?.content || '',

    async _fetch(url, options = {}) {
        const headers = {
            'Accept': 'application/json',
            'X-CSRF-TOKEN': this._csrf,
            ...options.headers,
        };

        if (options.body && typeof options.body === 'object') {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body);
        }

        const res = await fetch(url, { ...options, headers });
        const data = await res.json();

        if (!res.ok) {
            console.warn(`[API] ${res.status} ${url}:`, data.error || data.message);
            throw new Error(data.error || data.message || 'API error');
        }

        return data;
    },

    // --- Farm ---
    getWorld() {
        return this._fetch('/api/world');
    },
    getFarm() {
        return this._fetch('/api/farm');
    },
    till(q, r) {
        return this._fetch('/api/farm/till', { method: 'POST', body: { q, r } });
    },
    plant(q, r, crop) {
        return this._fetch('/api/farm/plant', { method: 'POST', body: { q, r, crop } });
    },
    water(q, r) {
        return this._fetch('/api/farm/water', { method: 'POST', body: { q, r } });
    },
    harvest(q, r) {
        return this._fetch('/api/farm/harvest', { method: 'POST', body: { q, r } });
    },
    clearWithered(q, r) {
        return this._fetch('/api/farm/clear-withered', { method: 'POST', body: { q, r } });
    },
    build(q, r, building) {
        return this._fetch('/api/farm/build', { method: 'POST', body: { q, r, building } });
    },
    demolish(q, r) {
        return this._fetch('/api/farm/demolish', { method: 'POST', body: { q, r } });
    },
    upgrade(q, r) {
        return this._fetch('/api/farm/upgrade', { method: 'POST', body: { q, r } });
    },

    // --- Inventory ---
    getInventory() {
        return this._fetch('/api/inventory');
    },

    // --- Shop ---
    getShopCatalog() {
        return this._fetch('/api/shop');
    },
    buy(item, quantity) {
        return this._fetch('/api/shop/buy', { method: 'POST', body: { item, quantity } });
    },
    sell(item, quantity) {
        return this._fetch('/api/shop/sell', { method: 'POST', body: { item, quantity } });
    },
    forage() {
        return this._fetch('/api/shop/forage', { method: 'POST' });
    },
};
