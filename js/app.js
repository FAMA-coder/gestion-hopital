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
    'js/tenant.js',
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
    'js/modules/sauvegarde.js',
    'js/modules/global_admin.js'
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
            if (Auth.estSupervision()) {
                showApp();
            } else {
                await Init.ensureSeed();
                showApp();
            }
        } else if (window.GlobalAdmin && GlobalAdmin.isActive()) {
            GlobalAdmin.open();
        } else {
            showLaunch();
        }

        setupLaunchHandler();
        setupLoginHandler();
        setupGlobalLoginHandler();
        setupLogoutHandler();
        setupExitSupervisionHandler();
        setupModalClose();
        setupDateDisplay();
        setupMobileNav();
    } catch (err) {
        console.error('Initialization error:', err);
        UI.toast('Erreur d\'initialisation: ' + err.message, 'error');
    }
}

// --- Ecran de demarrage : 3 entrees ---
function showLaunch() {
    document.body.classList.remove('master-mode');
    document.getElementById('app').style.display = 'none';
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('launch-screen').style.display = 'flex';
}

function showUserLogin() {
    document.body.classList.remove('master-mode');
    document.getElementById('app').style.display = 'none';
    document.getElementById('launch-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('panel-user-login').style.display = '';
    document.getElementById('panel-global-login').style.display = 'none';
    loadHospitalSelect();
    applyBranding();
}

function showGlobalLogin() {
    document.body.classList.remove('master-mode');
    document.getElementById('app').style.display = 'none';
    document.getElementById('launch-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('panel-user-login').style.display = 'none';
    document.getElementById('panel-global-login').style.display = '';
    document.getElementById('global-login-user').focus();
}

function quitApp() {
    try { window.close(); } catch (e) { /* certains navigateurs l'ignorent */ }
    setTimeout(() => {
        UI.toast('Fermez cet onglet / cette fenetre pour quitter l\'application.', 'info');
    }, 250);
}

function setupLaunchHandler() {
    document.getElementById('launch-user').addEventListener('click', showUserLogin);
    document.getElementById('launch-admin').addEventListener('click', () => {
        if (window.GlobalAdmin && GlobalAdmin.isActive()) {
            GlobalAdmin.open();
        } else {
            showGlobalLogin();
        }
    });
    document.getElementById('launch-quit').addEventListener('click', quitApp);
    document.getElementById('btn-user-back').addEventListener('click', showLaunch);
    document.getElementById('btn-global-back').addEventListener('click', showLaunch);
}

// Liste des etablissements dans le formulaire de connexion utilisateur.
async function loadHospitalSelect() {
    const select = document.getElementById('login-hopital');
    const isCloud = !!(window.APP_CONFIG && APP_CONFIG.MODE === 'cloud');
    const group = document.getElementById('login-hopital-group');
    if (!isCloud) {
        // Mode local (IndexedDB) : pas de registre central, pas de choix d'etablissement.
        if (select) { select.required = false; select.style.display = 'none'; }
        if (group) { const lbl = group.querySelector('label'); if (lbl) lbl.style.display = 'none'; }
        return;
    }
    if (select) { select.required = true; select.style.display = ''; }
    if (group) { const lbl = group.querySelector('label'); if (lbl) lbl.style.display = ''; }
    const current = (window.Tenant) ? Tenant.get() : null;
    let list = [];
    try {
        list = await Tenant.list();
    } catch (e) { /* registre indisponible */ }
    select.innerHTML = '<option value="">— Selectionner l\'etablissement —</option>';
    list.forEach(h => {
        const blocked = h.statut === 'bloque';
        const opt = document.createElement('option');
        opt.value = h.id;
        opt.textContent = (h.nom || h.id) + (h.ville ? ' — ' + h.ville : '') + (blocked ? ' (bloque)' : '');
        opt.disabled = blocked;
        select.appendChild(opt);
    });
    if (current && list.some(h => h.id === current)) select.value = current;
}

async function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('launch-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.body.classList.remove('master-mode');
    document.getElementById('sidebar').classList.remove('mobile-open');

    const user = Auth.currentUser;
    document.getElementById('user-name').textContent = user.nomComplet;
    document.getElementById('user-role').textContent = Auth.getRoleLabel();
    document.getElementById('user-avatar').textContent = user.nomComplet.charAt(0).toUpperCase();
    document.getElementById('btn-exit-supervision').hidden = !Auth.estSupervision();

    const hopital = await Meta.getHopital();
    const hid = document.getElementById('user-hospital');
    if (hid) hid.textContent = (hopital && hopital.nom) ? hopital.nom : '';

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

        const isCloud = !!(window.APP_CONFIG && APP_CONFIG.MODE === 'cloud');
        const tid = document.getElementById('login-hopital').value;
        if (isCloud && !tid) {
            errorEl.textContent = 'Selectionnez l\'etablissement auquel vous etes rattache(e).';
            errorEl.style.display = 'block';
            return;
        }

        try {
            // Un etablissement bloque par le compte ADMIN global ne permet
            // plus la connexion de ses utilisateurs.
            if (isCloud) {
                const h = await Tenant.getOne(tid);
                if (h && h.statut === 'bloque') {
                    errorEl.textContent = 'Cet etablissement est bloque par l\'administration. Contactez l\'administration pour son deblocage.';
                    errorEl.style.display = 'block';
                    return;
                }
                Tenant.set(tid);
                Cache.invalidateAll();
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Connexion...';

            const result = await Auth.login(username, password);
            if (result.success) {
                errorEl.style.display = 'none';
                await Init.ensureSeed();
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

// Connexion au compte ADMIN (global) : identite maître + hash SHA-256.
function setupGlobalLoginHandler() {
    document.getElementById('global-login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('global-login-user').value.trim();
        const password = document.getElementById('global-login-pass').value;
        const errorEl = document.getElementById('global-login-error');
        const submitBtn = document.getElementById('global-login-submit');
        const original = submitBtn.innerHTML;

        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Verification...';
        try {
            const result = await GlobalAdmin.login(username, password);
            if (result.success) {
                errorEl.style.display = 'none';
                document.getElementById('login-screen').style.display = 'none';
                await GlobalAdmin.open();
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
        showLaunch();
    });
}

function setupExitSupervisionHandler() {
    document.getElementById('btn-exit-supervision').addEventListener('click', async () => {
        Auth.endSupervision();
        State.clear();
        Cache.invalidateAll();
        window.location.hash = '';
        document.getElementById('btn-exit-supervision').hidden = true;
        await GlobalAdmin.open();
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
