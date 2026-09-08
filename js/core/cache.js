const Cache = {
    store: {},
    TTL: {},

    set(key, value, ttlMs = 300000) {
        this.store[key] = value;
        this.TTL[key] = Date.now() + ttlMs;
    },

    get(key) {
        if (this.TTL[key] && Date.now() > this.TTL[key]) {
            delete this.store[key];
            delete this.TTL[key];
            return null;
        }
        return this.store[key] || null;
    },

    invalidate(key) {
        delete this.store[key];
        delete this.TTL[key];
    },

    invalidateAll() {
        this.store = {};
        this.TTL = {};
    },

    async getOrSet(key, fetchFn, ttlMs = 300000) {
        let value = this.get(key);
        if (value !== null) return value;
        value = await fetchFn();
        this.set(key, value, ttlMs);
        return value;
    }
};

window.Cache = Cache;
