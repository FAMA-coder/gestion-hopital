const State = {
    data: {},
    listeners: {},

    set(key, value) {
        this.data[key] = value;
        this.notify(key, value);
    },

    get(key) {
        return this.data[key];
    },

    on(key, callback) {
        if (!this.listeners[key]) this.listeners[key] = [];
        this.listeners[key].push(callback);
    },

    off(key, callback) {
        if (!this.listeners[key]) return;
        this.listeners[key] = this.listeners[key].filter(cb => cb !== callback);
    },

    notify(key, value) {
        if (this.listeners[key]) {
            this.listeners[key].forEach(cb => cb(value));
        }
    },

    clear() {
        this.data = {};
        this.listeners = {};
    }
};

window.State = State;
