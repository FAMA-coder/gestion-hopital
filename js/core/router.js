const Router = {
    currentModule: null,
    modules: {},
    // Modules accessibles a tous les utilisateurs, sans verification de permission.
    PUBLIC_MODULES: ['aide'],

    register(name, module) {
        this.modules[name] = module;
    },

    async navigate(moduleName) {
        if (!this.modules[moduleName]) {
            UI.toast('Module introuvable: ' + moduleName, 'error');
            return;
        }

        // L'onglet Aide est accessible a tous les utilisateurs connectes.
        if (!this.PUBLIC_MODULES.includes(moduleName) && !Auth.can(moduleName, 1)) {
            UI.toast('Acces refuse a ce module', 'error');
            return;
        }

        if (this.currentModule && this.modules[this.currentModule] && this.modules[this.currentModule].cleanup) {
            this.modules[this.currentModule].cleanup();
        }

        this.currentModule = moduleName;
        const module = this.modules[moduleName];

        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const navItem = document.querySelector(`.nav-item[data-module="${moduleName}"]`);
        if (navItem) navItem.classList.add('active');

        if (module.show) {
            await module.show();
        }

        window.location.hash = moduleName;
    },

    init() {
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.slice(1);
            if (hash && hash !== this.currentModule) {
                this.navigate(hash);
            }
        });

        const hash = window.location.hash.slice(1);
        if (hash && this.modules[hash]) {
            this.navigate(hash);
        } else {
            this.navigate('dashboard');
        }
    }
};

window.Router = Router;
