const Events = {
    handlers: {},

    on(event, handler) {
        if (!this.handlers[event]) this.handlers[event] = [];
        this.handlers[event].push(handler);
        return () => this.off(event, handler);
    },

    off(event, handler) {
        if (!this.handlers[event]) return;
        this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    },

    emit(event, data) {
        if (this.handlers[event]) {
            this.handlers[event].forEach(handler => {
                try { handler(data); } catch (e) { console.error(`Event error [${event}]:`, e); }
            });
        }
    },

    once(event, handler) {
        const wrapper = (data) => {
            handler(data);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }
};

window.Events = Events;
