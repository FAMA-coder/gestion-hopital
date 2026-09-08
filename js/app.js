// Liste des scripts a charger, dans l'ordre (dependances d'abord).
// L'application ne depend pas des modules ES : elle fonctionne donc aussi
// bien via un serveur local (lancer.bat) qu'en ouvrant directement index.html.
const SCRIPT_FILES = [
    'js/core/router.js',
    'js/core/state.js',
    'js/core/events.js',
    'js/core/cache.js',
    'js/core/logger.js',
    'js/config.js',
    'js/remote_db.js',
    'js/db.js',
    'js/auth.js',
    'js/ui.js',
    'js/meta.js',
    'js/storage.js',
    'js/auto_backup.js',
    'js/excel.js',
    'js/charts.js',
    'js/print.js',
    'js/billing.js',
    'js/sample_data.js',
    'js/init.js',
    'js/install.js',
    'js/modules/dashboard.js',
    'js/modules/admissions.js',
    'js/modules/patients.js',
    'js/modules/consultations.js',
    'js/modules/urgences.js',
    'js/modules/hospitalisations.js',
    'js/modules/services.js',
    'js/modules/pharmacie.js',
    'js/modules/laboratoire.js',
    'js/modules/imagerie.js',
    'js/modules/chirurgie.js',
    'js/modules/personnel.js',
    'js/modules/tarifs.js',
    'js/modules/remunerations.js',
    'js/modules/contrats.js',
    'js/modules/depenses.js',
    'js/modules/facturation.js',
    'js/modules/paiements.js',
    'js/modules/documents.js',
    'js/modules/reporting.js',
    'js/modules/parametres.js',
    'js/modules/aide.js',
    'js/modules/sauvegarde.js'
];

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Echec de chargement : ' + src));
        document.body.appendChild(s);
    });
}

function registerServiceWorker() {
    // Un service worker (et donc l'installation PWA) n'est possible que
    // via http/https (localhost). Sur file:// on l'ignore.
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch((err) => {
                console.warn('Service worker non enregistre:', err);
            });
        });
    }
}

async function startApp() {
    try {
        for (const src of SCRIPT_FILES) {
            await loadScript(src);
        }
        await runApp();
    } catch (err) {
        console.error('Echec du chargement de l\'application:', err);
        const c = document.getElementById('content-area') || document.body;
        c.insertAdjacentHTML('afterbegin', '<div style="padding:16px;color:var(--danger)">Erreur d\'initialisation: ' + err.message + '</div>');
    }
}

async function runApp() {
    try {
        await Init.run();
        registerServiceWorker();

        if (await Auth.restoreSession()) {
            showApp();
        } else {
            showLogin();
        }

        setupLoginHandler();
        setupLogoutHandler();
        setupModalClose();
        setupDateDisplay();
        setupMobileNav();
    } catch (err) {
        console.error('Initialization error:', err);
        UI.toast('Erreur d\'initialisation: ' + err.message, 'error');
    }
}

function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    applyBranding();
}

async function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';

    const user = Auth.currentUser;
    document.getElementById('user-name').textContent = user.nomComplet;
    document.getElementById('user-role').textContent = Auth.getRoleLabel();
    document.getElementById('user-avatar').textContent = user.nomComplet.charAt(0).toUpperCase();

    applyBranding();
    setupNavPermissions();
    registerModules();
    Router.init();
    AutoBackup.init();
}

async function applyBranding() {
    const hopital = await Meta.getHopital();
    const h = hopital || {};
    const loginLogo = document.querySelector('.login-logo');
    const sidebarLogo = document.querySelector('.sidebar-logo');
    const loginTitle = document.querySelector('.login-header h1');
    if (h.logo) {
        if (loginLogo) { loginLogo.innerHTML = `<img src="${h.logo}" alt="Logo" style="max-height:64px;max-width:64px;border-radius:50%;object-fit:cover">`; loginLogo.style.fontSize = '0'; }
        if (sidebarLogo) { sidebarLogo.innerHTML = `<img src="${h.logo}" alt="Logo" style="width:32px;height:32px;border-radius:50%;object-fit:cover">`; sidebarLogo.style.fontSize = '0'; }
    } else if (h.nom) {
        if (loginLogo) { const ch = h.nom.trim().charAt(0).toUpperCase(); loginLogo.textContent = ch; loginLogo.style.fontSize = ''; }
    }
    if (h.nom && loginTitle) loginTitle.textContent = h.nom;
}

function setupLoginHandler() {
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-user').value.trim();
        const password = document.getElementById('login-pass').value;
        const errorEl = document.getElementById('login-error');
        const submitBtn = document.getElementById('login-submit');
        const original = submitBtn.innerHTML;

        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Connexion...';

        try {
            const result = await Auth.login(username, password);
            if (result.success) {
                errorEl.style.display = 'none';
                showApp();
            } else {
                errorEl.textContent = result.message;
                errorEl.style.display = 'block';
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = original;
        }
    });

}

function setupLogoutHandler() {
    document.getElementById('btn-logout').addEventListener('click', () => {
        Auth.logout();
        State.clear();
        Cache.invalidateAll();
        window.location.hash = '';
        showLogin();
    });
}

function setupModalClose() {
    document.getElementById('modal-close').addEventListener('click', () => UI.hideModal());
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) UI.hideModal();
    });
}

function setupDateDisplay() {
    const dateEl = document.getElementById('current-date');
    dateEl.textContent = new Date().toLocaleDateString('fr-FR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

function setupMobileNav() {
    window.__mobileNavRan = (window.__mobileNavRan || 0) + 1;
    const sidebar = document.getElementById('sidebar');
    const btnMenu = document.getElementById('btn-menu');
    const toggleBtn = document.getElementById('sidebar-toggle');
    const isMobile = () => window.matchMedia('(max-width: 768px)').matches;

    const closeMenu = () => {
        sidebar.classList.remove('mobile-open');
        if (btnMenu) btnMenu.classList.remove('active');
    };

    const toggleMenu = () => {
        if (isMobile()) {
            sidebar.classList.toggle('mobile-open');
        } else {
            sidebar.classList.toggle('collapsed');
        }
    };

    if (btnMenu) btnMenu.addEventListener('click', toggleMenu);
    if (toggleBtn) toggleBtn.addEventListener('click', toggleMenu);
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => { if (isMobile()) closeMenu(); });
    });
    document.querySelector('.main-content').addEventListener('click', (e) => {
        if (e.target.closest && e.target.closest('#btn-menu, #sidebar-toggle')) return;
        if (isMobile() && sidebar && !sidebar.contains(e.target)) closeMenu();
    });
    window.addEventListener('resize', () => {
        if (!isMobile()) closeMenu();
    });
}

function setupNavPermissions() {
    // Le menu se limite automatiquement aux modules accessibles,
    // selon la matrice des permissions du rôle connecté.
    document.querySelectorAll('.nav-item').forEach(item => {
        const mod = item.getAttribute('data-module');
        const allowed = Router.PUBLIC_MODULES.includes(mod) || Auth.can(mod, 1);
        item.style.display = allowed ? '' : 'none';
    });
}

function registerModules() {
    const modules = ['dashboard', 'admissions', 'patients', 'consultations', 'urgences', 'hospitalisations', 'services', 'tarifs', 'pharmacie', 'laboratoire', 'imagerie', 'chirurgie', 'personnel', 'remunerations', 'contrats', 'depenses', 'facturation', 'paiements', 'documents', 'reporting', 'parametres', 'aide', 'sauvegarde'];
    modules.forEach(name => {
        const mod = window[name + 'Module'];
        if (mod) {
            Router.register(name, mod);
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}
