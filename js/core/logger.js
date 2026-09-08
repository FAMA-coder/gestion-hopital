const Logger = {
    logs: [],
    MAX_LOGS: 500,

    log(level, module, message, data = null) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            module,
            message,
            data,
            user: Auth.currentUser ? Auth.currentUser.nomUtilisateur : 'system'
        };
        this.logs.push(entry);
        if (this.logs.length > this.MAX_LOGS) this.logs.shift();
        if (level === 'error') console.error(`[${module}]`, message, data);
    },

    info(module, message, data) { this.log('info', module, message, data); },
    warn(module, message, data) { this.log('warn', module, message, data); },
    error(module, message, data) { this.log('error', module, message, data); },

    getLogs(filter = {}) {
        let result = [...this.logs];
        if (filter.level) result = result.filter(l => l.level === filter.level);
        if (filter.module) result = result.filter(l => l.module === filter.module);
        if (filter.from) result = result.filter(l => l.timestamp >= filter.from);
        if (filter.to) result = result.filter(l => l.timestamp <= filter.to);
        return result.reverse();
    },

    clear() { this.logs = []; }
};

window.Logger = Logger;
