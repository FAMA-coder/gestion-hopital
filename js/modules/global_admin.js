// ============================================================
// js/modules/global_admin.js — Console ADMIN (global)
// ------------------------------------------------------------
// Compte maitre, accessible UNIQUEMENT par le bouton "COMPTE
// ADMIN (global)" de l'ecran de demarrage (identite + hash
// SHA-256 definis dans js/config.js -> GLOBAL_ADMIN).
// Permet de gerer tous les hopitaux/cliniques : creation,
// modification, suppression, supervision, blocage/deblocage.
// ============================================================
const GlobalAdmin = {
    KEY: 'gh_master',
    seq: 0,

    isCloudEnv() {
        const cfg = window.APP_CONFIG || {};
        return cfg.MODE === 'cloud' && !!(window.RemoteDB || {}).impl;
    },

    isActive() {
        try {
            const s = localStorage.getItem(this.KEY);
            return !!(s && JSON.parse(s));
        } catch (e) { return false; }
    },

    session() {
        try { return JSON.parse(localStorage.getItem(this.KEY) || 'null'); } catch (e) { return null; }
    },

    async _sha256hex(str) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    // Authentification du compte maitre (independant de tout hopital).
    async login(identifiant, motDePasse) {
        const cfg = (window.APP_CONFIG || {}).GLOBAL_ADMIN || {};
        if (!cfg.login || !cfg.passHash) return { success: false, message: 'Compte ADMIN global non configure (js/config.js).' };
        if (String(identifiant || '').trim().toLowerCase() !== String(cfg.login).trim().toLowerCase()) {
            return { success: false, message: 'Identifiant maître invalide' };
        }
        if (!(window.crypto && crypto.subtle)) return { success: false, message: 'Navigateur incompatible (crypto.subtle requis).' };
        const hash = await this._sha256hex(String(motDePasse || ''));
        if (hash !== cfg.passHash) return { success: false, message: 'Mot de passe maître incorrect' };
        try {
            localStorage.setItem(this.KEY, JSON.stringify({ login: cfg.login, nom: cfg.nom, date: new Date().toISOString() }));
        } catch (e) { /* ignore */ }
        return { success: true, session: this.session() };
    },

    logout() {
        try { localStorage.removeItem(this.KEY); } catch (e) { /* ignore */ }
        Auth.logout();
        State.clear();
        Cache.invalidateAll();
        window.location.hash = '';
    },

    // Ouvre la console dans la zone de contenu principale.
    async open() {
        if (!this.isCloudEnv()) {
            UI.toast('La gestion des etablissements requiert le mode cloud (js/config.js).', 'error');
            this.logout();
            window.showLaunch && showLaunch();
            return;
        }
        await Tenant.ensureDefault();
        document.body.classList.add('master-mode');
        document.body.classList.remove('mobile-open');
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('launch-screen').style.display = 'none';
        document.getElementById('app').style.display = 'flex';
        const title = document.getElementById('page-title');
        if (title) title.textContent = 'Administration globale';
        document.getElementById('btn-exit-supervision').hidden = true;
        await this.render();
    },

    async render() {
        const el = document.getElementById('content-area');
        const list = await Tenant.list();
        const actifs = list.filter(h => h.statut !== 'bloque').length;
        const bloques = list.length - actifs;

        el.innerHTML = `
            <div class="admin-console">
                <div class="card" style="margin-bottom:12px">
                    <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                        <h3>Hopitaux &amp; cliniques <small style="color:var(--text-secondary)">(${list.length} etablissement(s))</small></h3>
                        <div style="display:flex;gap:8px;flex-wrap:wrap">
                            <button class="btn btn-primary" id="ga-add">+ Nouvel etablissement</button>
                            <button class="btn btn-outline" id="ga-home">&#8592; Retour</button>
                            <button class="btn btn-danger" id="ga-logout">Deconnexion</button>
                        </div>
                    </div>
                </div>
                <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">
                    <div class="card ga-stat"><b>${list.length}</b><span>Etablissements</span></div>
                    <div class="card ga-stat"><b>${actifs}</b><span>Actifs</span></div>
                    <div class="card ga-stat"><b>${bloques}</b><span>Bloques/désactivés</span></div>
                </div>
                <div class="card">
                    <div class="table-container" style="overflow-x:auto">
                        <table class="ga-table">
                            <thead>
                                <tr><th>Etablissement</th><th>Ville</th><th>Statut</th><th>Utilisateurs</th><th>Patients</th><th>Dossiers</th><th>Factures</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                ${list.length === 0 ? '<tr><td colspan="8" style="text-align:center;color:var(--text-secondary)">Aucun etablissement. Cliquez sur "Nouvel etablissement".</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;

        for (const h of list) {
            const counts = await this._counts(h.id);
            const actif = h.statut !== 'bloque';
            const badge = `<span class="badge badge-${actif ? 'success' : 'danger'}">${actif ? 'Actif' : 'Bloque'}</span>`;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><b>${this._esc(h.nom || '')}</b><br><small style="color:var(--text-secondary)">${this._esc(h.id || '')}</small></td>
                <td>${this._esc(h.ville || '-')}</td>
                <td>${badge}</td>
                <td>${counts.users}</td>
                <td>${counts.patients}</td>
                <td>${counts.consultations}</td>
                <td>${counts.factures}</td>
                <td>
                    <button class="btn btn-icon" data-act="user" data-tid="${this._esc(h.id)}" title="Ajouter un utilisateur">&#128101;</button>
                    <button class="btn btn-icon" data-act="edit" data-tid="${this._esc(h.id)}" title="Modifier">&#9998;</button>
                    <button class="btn btn-icon" data-act="supervise" data-tid="${this._esc(h.id)}" title="Superviser (ouvrir)">&#128065;</button>
                    <button class="btn btn-icon" data-act="toggle" data-tid="${this._esc(h.id)}" title="${actif ? 'Bloquer' : 'Debloquer'}">${actif ? '&#128683;' : '&#9989;'}</button>
                    <button class="btn btn-icon" data-act="del" data-tid="${this._esc(h.id)}" title="Supprimer">&#128465;</button>
                </td>`;
            el.querySelector('.ga-table tbody').appendChild(tr);
        }

        el.querySelector('#ga-add').onclick = () => this._dialogNew();
        el.querySelector('#ga-home').onclick = () => this._toLaunch();
        el.querySelector('#ga-logout').onclick = async () => {
            await this.logout();
            showLaunch();
        };
        el.querySelectorAll('[data-act]').forEach(btn => {
            btn.onclick = () => this._action(btn.getAttribute('data-act'), btn.getAttribute('data-tid'));
        });
    },

    async _counts(tid) {
        const out = { users: 0, patients: 0, consultations: 0, factures: 0 };
        try {
            for (const store of ['users', 'patients', 'consultations', 'factures']) {
                const obj = await RemoteDB.rawGet('/records/' + encodeURIComponent(tid) + '/' + store + '.json?shallow=true');
                out[store] = (obj && typeof obj === 'object') ? Object.keys(obj).length : 0;
            }
        } catch (e) { /* stats non bloquantes */ }
        return out;
    },

    async _action(act, tid) {
        if (act === 'user') return this._dialogNewUser(tid);
        if (act === 'edit') return this._dialogEdit(tid);
        if (act === 'supervise') return this._supervise(tid);
        if (act === 'toggle') return this._toggle(tid);
        if (act === 'del') return this._remove(tid);
    },

    _esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    _dialogNew() {
        var self = this;
        UI.showModal('Nouvel etablissement',
            '<form id="ga-form" class="login-form">' +
            '<div class="form-group"><label>Nom de l\'hopital / clinique</label><input id="ga-nom" required placeholder="Ex: Clinique du Lac"></div>' +
            '<div class="form-group"><label>Ville</label><input id="ga-ville" placeholder="Ex: Kinshasa"></div>' +
            '</form>',
            '<button class="btn btn-primary" id="ga-save">Enregistrer</button>' +
            '<button class="btn btn-outline" id="ga-cancel">Annuler</button>');
        document.getElementById('ga-cancel').onclick = function () { UI.hideModal(); };
        document.getElementById('ga-save').onclick = async function () {
            var nom = document.getElementById('ga-nom').value.trim();
            var ville = document.getElementById('ga-ville').value.trim();
            if (!nom) { document.getElementById('ga-nom').focus(); return; }
            var t = { id: 'h' + Date.now().toString(36) + self.seq++, nom: nom, ville: ville, statut: 'actif', creeLe: new Date().toISOString(), creePar: (self.session() ? self.session().login : 'FAMA') };
            await Tenant.save(t);
            UI.hideModal();
            UI.toast('Etablissement cree : ' + nom, 'success');
            self.render();
        };
    },

    // Cree un utilisateur dans l'etablissement existant (ecriture directe
    // dans /records/{tenant}/users/, independamment du tenant courant).
    _dialogNewUser(tid) {
        var self = this;
        (async () => {
            var h = await Tenant.getOne(tid);
            if (!h) { UI.toast('Etablissement introuvable', 'error'); return; }
            var roleOpts = (await self._roleOptions(tid))
                .map(r => '<option value="' + self._esc(r.value) + '">' + self._esc(r.label) + '</option>').join('');
            var services = await self._serviceOptions(tid);
            var svcOptions = services
                .map(s => '<option value="' + self._esc(s.value) + '">' + self._esc(s.label) + '</option>').join('');
            var svcGroup = services.length
                ? '<div class="form-group"><label>Service</label><select id="ga-user-service"><option value="">-- Aucun --</option>' + svcOptions + '</select></div>'
                : '<input type="hidden" id="ga-user-service" value="">';

            UI.showModal('Nouvel utilisateur - ' + (h.nom || tid),
                '<form id="ga-user-form" class="login-form">' +
                '<div class="form-group"><label>Nom d\'utilisateur</label><input id="ga-user-login" required placeholder="Ex : dr_ngoy"></div>' +
                '<div class="form-group"><label>Nom complet</label><input id="ga-user-nom" required placeholder="Ex : Dr. Ngoy Kabongo"></div>' +
                '<div class="form-group"><label>Mot de passe</label><input id="ga-user-pass" type="password" required placeholder="********"></div>' +
                '<div class="form-group"><label>Role</label><select id="ga-user-role">' + roleOpts + '</select></div>' +
                svcGroup +
                '<div class="form-group"><label>Statut</label><select id="ga-user-actif"><option value="1">Actif</option><option value="0">Inactif</option></select></div>' +
                '</form>',
                '<button class="btn btn-primary" id="ga-user-save">Enregistrer</button>' +
                '<button class="btn btn-outline" id="ga-user-cancel">Annuler</button>');
            document.getElementById('ga-user-cancel').onclick = function () { UI.hideModal(); };
            document.getElementById('ga-user-save').onclick = async function () {
                var login = document.getElementById('ga-user-login').value.trim();
                var nom = document.getElementById('ga-user-nom').value.trim();
                var pass = document.getElementById('ga-user-pass').value;
                if (!login || !nom || !pass) { UI.toast('Nom d\'utilisateur, nom complet et mot de passe sont obligatoires', 'error'); return; }
                if (login.length < 3) { UI.toast('Nom d\'utilisateur trop court (3 caracteres minimum)', 'error'); return; }
                try {
                    var usersObj = await RemoteDB.rawGet('/records/' + encodeURIComponent(tid) + '/users.json');
                    var users = (usersObj && typeof usersObj === 'object') ? Object.keys(usersObj).map(k => usersObj[k]) : [];
                    if (users.some(u => String(u.nomUtilisateur || '').trim().toUpperCase() === login.toUpperCase())) {
                        UI.toast('Ce nom d\'utilisateur existe deja dans cet etablissement', 'error'); return;
                    }
                    if (login.toUpperCase() === (window.Auth ? Auth.MASTER_USERNAME : 'FAMA').toUpperCase()) {
                        UI.toast('Ce nom d\'utilisateur est reserve au compte maître', 'error'); return;
                    }
                    var id = RemoteDB.generateId();
                    var rec = {
                        id: id,
                        nomUtilisateur: login,
                        nomComplet: nom,
                        motDePasse: Auth.hashPassword(pass),
                        role: document.getElementById('ga-user-role').value,
                        serviceId: document.getElementById('ga-user-service').value || null,
                        actif: document.getElementById('ga-user-actif').value === '1',
                        creePar: 'ADMIN global',
                        date: new Date().toISOString()
                    };
                    await RemoteDB.rawPut('/records/' + encodeURIComponent(tid) + '/users/' + encodeURIComponent(id) + '.json', rec);
                    try {
                        await RemoteDB.rawPut('/records/' + encodeURIComponent(tid) + '/journal/' + encodeURIComponent(id) + '.json', {
                            id: id, userId: id, username: login, date: new Date().toISOString(),
                            action: 'Creation', module: 'parametres',
                            details: 'Utilisateur ' + login + ' (cree par le compte ADMIN global)'
                        });
                    } catch (e) { /* journal non bloquant */ }
                    UI.hideModal();
                    UI.toast('Utilisateur ' + login + ' cree dans ' + (h.nom || tid), 'success');
                    self.render();
                } catch (err) {
                    UI.toast('Erreur lors de la creation : ' + err.message, 'error');
                }
            };
        })();
    },

    async _roleOptions(tid) {
        var labels = window.Auth ? Auth.ROLE_LABELS : {};
        var opts = Object.keys(labels).map(k => ({ value: k, label: labels[k] }));
        try {
            var customs = await RemoteDB.rawGet('/records/' + encodeURIComponent(tid) + '/roles.json');
            if (customs && typeof customs === 'object') {
                Object.keys(customs).forEach(k => opts.push({ value: k, label: (customs[k].nom || k) }));
            }
        } catch (e) { /* roles non bloquant */ }
        return opts;
    },

    async _serviceOptions(tid) {
        try {
            var obj = await RemoteDB.rawGet('/records/' + encodeURIComponent(tid) + '/services.json');
            if (!obj || typeof obj !== 'object') return [];
            return Object.keys(obj).map(k => obj[k]).filter(s => s && s.actif !== false).map(s => ({ value: s.id, label: s.nom }));
        } catch (e) { return []; }
    },

    async _dialogEdit(tid) {
        var self = this;
        var h = await Tenant.getOne(tid);
        if (!h) return;
        var actif = h.statut !== 'bloque';
        var statutOpts = '<option value="actif"' + (actif ? ' selected' : '') + '>Actif</option>' +
                         '<option value="bloque"' + (actif ? '' : ' selected') + '>Bloque</option>';
        UI.showModal('Modifier l\'etablissement',
            '<form id="ga-form" class="login-form">' +
            '<div class="form-group"><label>Nom</label><input id="ga-nom" value="' + self._esc(h.nom || '') + '" required></div>' +
            '<div class="form-group"><label>Ville</label><input id="ga-ville" value="' + self._esc(h.ville || '') + '"></div>' +
            '<div class="form-group"><label>Statut</label><select id="ga-statut">' + statutOpts + '</select></div>' +
            '</form>',
            '<button class="btn btn-primary" id="ga-save">Enregistrer</button>' +
            '<button class="btn btn-outline" id="ga-cancel">Annuler</button>');
        document.getElementById('ga-cancel').onclick = function () { UI.hideModal(); };
        document.getElementById('ga-save').onclick = async function () {
            var nom = document.getElementById('ga-nom').value.trim();
            if (nom) h.nom = nom;
            h.ville = document.getElementById('ga-ville').value.trim();
            var st = document.getElementById('ga-statut').value;
            if (h.statut !== st) h.statut = st;
            await Tenant.save(h);
            UI.hideModal();
            UI.toast('Etablissement mis a jour.', 'success');
            self.render();
        };
    },

    async _toggle(tid) {
        const h = await Tenant.getOne(tid);
        if (!h) return;
        const actif = h.statut !== 'bloque';
        h.statut = actif ? 'bloque' : 'actif';
        await Tenant.save(h);
        UI.toast(actif ? 'Etablissement bloqué : les utilisateurs ne peuvent plus se connecter.' : 'Etablissement débloqué.', actif ? 'error' : 'success');
        this.render();
    },

    async _remove(tid) {
        const h = await Tenant.getOne(tid);
        if (!h) return;
        if (!await UI.confirm('Supprimer définitivement "' + (h.nom || tid) + '" ainsi que toutes ses donnees ?')) return;
        try {
            await RemoteDB.rawDelete('/records/' + encodeURIComponent(tid) + '.json');
        } catch (e) { /* le registre est supprime meme si les donnees sont vides */ }
        await Tenant.remove(tid);
        UI.toast('Etablissement supprimé.', 'success');
        this.render();
    },

    async _supervise(tid) {
        const h = await Tenant.getOne(tid);
        if (!h) return;
        Tenant.set(tid);
        await Auth.setSupervisionSession(tid, h.nom);
        document.body.classList.remove('master-mode');
        document.getElementById('btn-exit-supervision').hidden = false;
        await showApp();
        UI.toast('Supervision de ' + (h.nom || tid) + ' (compte ADMIN global).', 'info');
    },

    _toLaunch() {
        showLaunch();
    }
};

window.GlobalAdmin = GlobalAdmin;