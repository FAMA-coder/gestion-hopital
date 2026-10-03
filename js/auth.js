const Auth = {
    currentUser: null,
    SESSION_KEY: 'gh_session',

    // Permissions par defaut. Elles sont ecrasees si un enregistrement
    // existe dans le store 'permissions' pour le role concerne (gestion UI).
    DEFAULT_PERMISSIONS: {
        admin: { dashboard: 3, receptions: 3, admissions: 3, patients: 3, consultations: 3, urgences: 3, hospitalisations: 3, services: 3, tarifs: 3, pharmacie: 3, laboratoire: 3, imagerie: 3, chirurgie: 3, personnel: 3, remunerations: 3, contrats: 3, depenses: 3, facturation: 3, paiements: 3, documents: 3, reporting: 3, parametres: 3 },
        directeur: { dashboard: 3, receptions: 3, admissions: 3, patients: 3, consultations: 2, urgences: 2, hospitalisations: 2, services: 3, tarifs: 3, pharmacie: 2, laboratoire: 2, imagerie: 2, chirurgie: 2, personnel: 3, remunerations: 3, contrats: 3, depenses: 3, facturation: 3, paiements: 3, documents: 2, reporting: 3, parametres: 2 },
        medecin: { dashboard: 1, receptions: 3, admissions: 2, patients: 2, consultations: 3, urgences: 2, hospitalisations: 2, services: 1, tarifs: 1, pharmacie: 1, laboratoire: 2, imagerie: 2, chirurgie: 2, personnel: 0, remunerations: 0, contrats: 1, depenses: 0, facturation: 0, paiements: 0, documents: 2, reporting: 1, parametres: 0 },
        infirmier: { dashboard: 1, receptions: 2, admissions: 1, patients: 2, consultations: 1, urgences: 2, hospitalisations: 3, services: 1, tarifs: 1, pharmacie: 2, laboratoire: 0, imagerie: 0, chirurgie: 1, personnel: 0, remunerations: 0, contrats: 1, depenses: 0, facturation: 0, paiements: 0, documents: 1, reporting: 0, parametres: 0 },
        pharmacien: { dashboard: 1, receptions: 1, admissions: 0, patients: 1, consultations: 0, urgences: 0, hospitalisations: 0, services: 0, tarifs: 1, pharmacie: 3, laboratoire: 0, imagerie: 0, chirurgie: 0, personnel: 0, remunerations: 0, contrats: 1, depenses: 0, facturation: 1, paiements: 1, documents: 1, reporting: 1, parametres: 0 },
        laborantin: { dashboard: 1, receptions: 1, admissions: 0, patients: 1, consultations: 0, urgences: 0, hospitalisations: 0, services: 0, tarifs: 1, pharmacie: 0, laboratoire: 3, imagerie: 0, chirurgie: 0, personnel: 0, remunerations: 0, contrats: 1, depenses: 0, facturation: 0, paiements: 0, documents: 1, reporting: 1, parametres: 0 },
        radiologue: { dashboard: 1, receptions: 1, admissions: 0, patients: 1, consultations: 0, urgences: 0, hospitalisations: 0, services: 0, tarifs: 1, pharmacie: 0, laboratoire: 0, imagerie: 3, chirurgie: 0, personnel: 0, remunerations: 0, contrats: 1, depenses: 0, facturation: 0, paiements: 0, documents: 1, reporting: 1, parametres: 0 },
        chirurgien: { dashboard: 1, receptions: 1, admissions: 0, patients: 1, consultations: 1, urgences: 1, hospitalisations: 1, services: 0, tarifs: 1, pharmacie: 0, laboratoire: 0, imagerie: 0, chirurgie: 3, personnel: 0, remunerations: 0, contrats: 1, depenses: 0, facturation: 0, paiements: 0, documents: 1, reporting: 1, parametres: 0 },
        secretaire: { dashboard: 1, receptions: 3, admissions: 3, patients: 3, consultations: 1, urgences: 1, hospitalisations: 1, services: 1, tarifs: 2, pharmacie: 0, laboratoire: 0, imagerie: 0, chirurgie: 0, personnel: 1, remunerations: 0, contrats: 2, depenses: 2, facturation: 2, paiements: 2, documents: 2, reporting: 1, parametres: 0 },
        caissier: { dashboard: 1, receptions: 1, admissions: 0, patients: 1, consultations: 0, urgences: 0, hospitalisations: 0, services: 0, tarifs: 1, pharmacie: 0, laboratoire: 0, imagerie: 0, chirurgie: 0, personnel: 0, remunerations: 0, contrats: 1, depenses: 1, facturation: 3, paiements: 3, documents: 1, reporting: 1, parametres: 0 }
    },

    ROLE_LABELS: {
        admin: 'Administrateur',
        directeur: 'Directeur',
        medecin: 'Medecin',
        infirmier: 'Infirmier',
        pharmacien: 'Pharmacien',
        laborantin: 'Laborantin',
        radiologue: 'Radiologue',
        chirurgien: 'Chirurgien',
        secretaire: 'Secretaire',
        caissier: 'Caissier'
    },

    // Compte maître (super administrateur) : non modifiable et
    // invisible pour tous les autres comptes.
    MASTER_USERNAME: 'FAMA',
    // Son MOT DE PASSE n'est PAS dans ce fichier : il n'existe que sous
    // forme d'empreinte SHA-256 dans js/config.js
    // (APP_CONFIG.GLOBAL_ADMIN.passHash), comparee telle quelle par la
    // console ADMIN global et reappliquee au compte « FAMA » de la base
    // par SampleData.ensureMaitre(). Afficher la source de l'application
    // ne donne donc pas le mot de passe.

    // Liste des modules et leurs libelles (pour l'interface de permissions)
    MODULES: [
        ['dashboard', 'Tableau de bord'],
        ['receptions', 'Receptions'],
        ['admissions', 'Admissions'],
        ['urgences', 'Urgences'],
        ['hospitalisations', 'Hospitalisations'],
        ['services', 'Services & Lits'],
        ['tarifs', 'Tarifs'],
        ['pharmacie', 'Pharmacie'],
        ['laboratoire', 'Laboratoire'],
        ['imagerie', 'Imagerie'],
        ['chirurgie', 'Chirurgie'],
        ['personnel', 'Personnel'],
        ['remunerations', 'Salaires & Honoraires'],
        ['contrats', 'Contrats'],
        ['depenses', 'Depenses'],
        ['facturation', 'Facturation'],
        ['paiements', 'Paiements'],
        ['documents', 'Documents'],
        ['reporting', 'Reporting'],
        ['parametres', 'Parametres']
    ],

    // Cache des permissions effectives pour l'utilisateur courant (synchrone)
    _effPerms: null,

    // Permissions configurees en base (override des defaults) par role
    async loadPermissions() {
        const rows = await DB.getAll('permissions');
        const map = {};
        (rows || []).forEach(r => {
            map[r.id] = r.permissions || {};
        });
        return map;
    },

    invalidatePermissions() {
        this._effPerms = null;
    },

    // Recalcule les permissions effectives de l'utilisateur courant.
    // A appeler apres login, session restore ou modification de permissions.
    async refreshPermissions() {
        if (!this.currentUser) {
            this._effPerms = null;
            return;
        }
        const overrides = await this.loadPermissions();
        const role = this.currentUser.role;
        const base = this.DEFAULT_PERMISSIONS[role] || {};
        if (overrides[role]) Object.assign(base, overrides[role]);
        // Override par utilisateur si defini
        const eff = { ...base };
        if (this.currentUser.permissions) {
            Object.assign(eff, this.currentUser.permissions);
        }
        this._effPerms = eff;
    },

    can(module, level = 1) {
        if (!this.currentUser) return false;
        // L'administrateur a toujours un acces total, quelle que soit
        // la configuration (evite qu'un override/session perime le prive).
        if (this.currentUser.role === 'admin') return true;
        if (!this._effPerms) return false;
        return (this._effPerms[module] || 0) >= level;
    },

    // Recalcule les permissions sans laisser remonter d'erreur : la
    // base peut etre momentanement inaccessible (mode hors ligne,
    // synchronisation en cours). Dans ce cas les droits restent
    // denies, ce qui est preferable a une porte ouverte.
    async safeRefreshPermissions() {
        try {
            await this.refreshPermissions();
            return true;
        } catch (e) {
            this._effPerms = null;
            if (window.Logger) Logger.warn('Auth', 'Permissions non rechargees', String((e && e.message) || e));
            return false;
        }
    },

    // Revalide la session apres une synchronisation : les donnees
    // viennent peut-etre d'un autre poste, ou le compte a ete
    // supprime, desactive, ou son role a change entre-temps.
    // Un compte introuvable ou desactive => deconnexion (le poste
    // ne doit pas rester connecte avec des droits perimes).
    async revalidateSession() {
        this._effPerms = null;
        const u = this.currentUser;
        if (!u) return { valid: false, reason: 'aucune session' };

        // Session de supervision : le compte reels n'est pas celui
        // de l'etablissement consulte, rien a revalider ici.
        if (u.supervision === true || u.id === 'superglobal') {
            await this.safeRefreshPermissions();
            return { valid: true };
        }

        let row = null;
        try {
            row = (await DB.getAll('users')).find(x => x.id === u.id) || null;
        } catch (e) {
            // Base momentanement inaccessible : on garde la session
            // (les permissions restent denies tant qu'elles ne sont
            // pas rechargees).
            return { valid: true, reason: 'base inaccessible' };
        }

        if (!row) {
            this.logout();
            return { valid: false, reason: 'supprime' };
        }
        if (row.actif === false) {
            this.logout();
            return { valid: false, reason: 'desactive' };
        }

        u.nomUtilisateur = row.nomUtilisateur;
        u.nomComplet = row.nomComplet;
        u.role = row.role;
        u.serviceId = row.serviceId;
        u.maitre = row.maitre === true;
        u.permissions = row.permissions || null;
        try { localStorage.setItem(this.SESSION_KEY, JSON.stringify(u)); } catch (e) { /* session non persistee */ }
        await this.safeRefreshPermissions();
        return { valid: true, role: u.role };
    },
    async login(username, password) {
        const users = await DB.getAll('users');
        const loginName = String(username || '').trim().toLowerCase();
        const user = users.find(u => String(u.nomUtilisateur || '').trim().toLowerCase() === loginName && u.actif !== false);
        if (!user) return { success: false, message: 'Utilisateur introuvable' };

        const hashed = this.hashPassword(password);
        if (user.motDePasse !== hashed) return { success: false, message: 'Mot de passe incorrect' };

        this.currentUser = {
            id: user.id,
            nomUtilisateur: user.nomUtilisateur,
            nomComplet: user.nomComplet,
            role: user.role,
            serviceId: user.serviceId,
            maitre: user.maitre === true,
            tenantId: (window && window.Tenant) ? Tenant.get() : null,
            permissions: user.permissions || null,
            supervision: false
        };

        localStorage.setItem(this.SESSION_KEY, JSON.stringify(this.currentUser));
        await this.refreshPermissions();
        await this.log('Connexion');
        return { success: true, user: this.currentUser };
    },

    logout() {
        this.log('Deconnexion');
        this.currentUser = null;
        localStorage.removeItem(this.SESSION_KEY);
    },

    // Session programmee (supervision par le compte ADMIN global).
    // Utilise les memes permissions qu'un administrateur d'etablissement.
    async setSupervisionSession(tid, nomHopital) {
        const hopital = (nomHopital || 'Etablissement');
        this.currentUser = {
            id: 'superglobal',
            nomUtilisateur: (window.APP_CONFIG || {}).GLOBAL_ADMIN.login || 'FAMA',
            nomComplet: 'ADMIN global - ' + hopital,
            role: 'admin',
            serviceId: null,
            maitre: true,
            tenantId: tid,
            permissions: null,
            supervision: true
        };
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(this.currentUser));
        await this.refreshPermissions();
        return this.currentUser;
    },

    endSupervision() {
        this.log('Fin surveillance');
        this.currentUser = null;
        localStorage.removeItem(this.SESSION_KEY);
    },

    estSupervision() {
        return !!(this.currentUser && this.currentUser.supervision === true);
    },

    async restoreSession() {
        const data = localStorage.getItem(this.SESSION_KEY);
        if (data) {
            try {
                this.currentUser = JSON.parse(data);
                if (this.currentUser && this.currentUser.id && this.currentUser.role) {
                    // Etablissement de la session : indispensable pour que
                    // toutes les lectures de donnees ciblent le bon tenant.
                    if (this.currentUser.tenantId && window.Tenant) {
                        Tenant.set(this.currentUser.tenantId);
                    }
                    if (this.currentUser.supervision === true) {
                        await this.refreshPermissions();
                        return true;
                    }
                    // Rafraichit les infos (et le drapeau maitre) depuis la base
                    // pour les sessions eventuellement enregistrees avant.
                    try {
                        const u = (await DB.getAll('users')).find(x => x.id === this.currentUser.id);
                        if (u) {
                            this.currentUser.nomUtilisateur = u.nomUtilisateur;
                            this.currentUser.nomComplet = u.nomComplet;
                            this.currentUser.role = u.role;
                            this.currentUser.serviceId = u.serviceId;
                            this.currentUser.maitre = u.maitre === true;
                            this.currentUser.permissions = u.permissions || null;
                            localStorage.setItem(this.SESSION_KEY, JSON.stringify(this.currentUser));
                        }
                    } catch (e) { /* session locale utilisee telle quelle */ }
                    await this.refreshPermissions();
                    return true;
                }
            } catch (e) {
                localStorage.removeItem(this.SESSION_KEY);
            }
        }
        this.invalidatePermissions();
        this.currentUser = null;
        return false;
    },

    hashPassword(pwd) {
        let hash = 0;
        const str = 'GH_' + pwd + '_2026';
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    },

    getRole() {
        return this.currentUser ? this.currentUser.role : null;
    },

    // Indique si l'utilisateur courant est le compte maître
    // (super administrateur, seul autorise a gerer l'hopital).
    estMaitre() {
        return !!(this.currentUser && this.currentUser.maitre === true);
    },

    getRoleLabel() {
        if (!this.currentUser) return '';
        return this.ROLE_LABELS[this.currentUser.role] || this.currentUser.role;
    },

    // Liste complete des roles (role integres + roles personnalises).
    // Chaque element : { key, nom, isCustom, permissions }
    async getAllRoles() {
        const customs = await DB.getAll('roles');
        const overrides = await this.loadPermissions();
        const out = [];
        Object.keys(this.ROLE_LABELS).forEach(key => {
            out.push({
                key,
                nom: this.ROLE_LABELS[key],
                isCustom: false,
                permissions: Object.assign({}, this.DEFAULT_PERMISSIONS[key] || {}, overrides[key] || {})
            });
        });
        (customs || []).forEach(r => {
            out.push({
                key: r.id,
                nom: r.nom || r.id,
                isCustom: true,
                permissions: Object.assign({}, overrides[r.id] || {})
            });
        });
        return out;
    },

    // Creer un role personnalise (clé-slug + libelle). Les permissions
    // sont configurees ensuite via l'ecran Permissions (store 'permissions').
    async addRole(nom) {
        nom = (nom || '').trim();
        if (!nom) return { success: false, message: 'Nom du rôle requis' };
        const base = nom.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'role';
        const keys = new Set((await DB.getAll('roles')).map(r => r.id));
        let key = base, i = 2;
        while (keys.has(key)) key = base + '_' + (i++);
        if (this.ROLE_LABELS[key]) { key = base + '_' + (i++); }
        await DB.put('roles', { id: key, nom, date: new Date().toISOString() });
        return { success: true, key };
    },

    // Supprimer un role personnalise (et ses permissions).
    async deleteRole(key) {
        if (this.ROLE_LABELS[key]) return { success: false, message: 'Impossible de supprimer un rôle système' };
        const users = await DB.getAll('users');
        const used = users.filter(u => u.role === key);
        if (used.length > 0) {
            return { success: false, message: `Ce rôle est utilisé par ${used.length} utilisateur(s)` };
        }
        await DB.delete('roles', key);
        await DB.delete('permissions', key);
        return { success: true };
    },

    async log(action, module = '', details = '') {
        try {
            await DB.put('journal', {
                id: DB.generateId(),
                userId: this.currentUser ? this.currentUser.id : 'system',
                username: this.currentUser ? this.currentUser.nomUtilisateur : 'system',
                date: new Date().toISOString(),
                action,
                module,
                details
            });
        } catch (e) { /* journal non bloquant */ }
    }
};

window.Auth = Auth;
