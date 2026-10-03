// ============================================================
// js/db.js — Façade de stockage
// ------------------------------------------------------------
// L'application utilise exclusivement l'objet global DB. Selon
// APP_CONFIG.MODE ('local' ou 'cloud'), DB délègue ses opérations
// soit a la base locale (IndexedDB) soit a la base centrale
// distante (RemoteDB, voir js/remote_db.js). Les modules n'ont
// aucun changement : ils continuent d'appeler DB.get/getAll/put/...
// ============================================================
const DB = (function () {
    // ------------------------------------------------------------
    // Backend local : IndexedDB
    // ------------------------------------------------------------
    const STORES = {
        hopital: { keyPath: 'id' },
        services: { keyPath: 'id' },
        salles: { keyPath: 'id' },
        lits: { keyPath: 'id' },
        typesExamen: { keyPath: 'id' },
        medicaments: { keyPath: 'id' },
        tarifs: { keyPath: 'id' },
        remunerations: { keyPath: 'id' },
        contrats: { keyPath: 'id' },
        depenses: { keyPath: 'id' },
        users: { keyPath: 'id' },
        permissions: { keyPath: 'id' },
        roles: { keyPath: 'id' },
        personnel: { keyPath: 'id' },
        medecins: { keyPath: 'id' },
        infirmiers: { keyPath: 'id' },
        planningPersonnel: { keyPath: 'id' },
        conges: { keyPath: 'id' },
        salaires: { keyPath: 'id' },
        patients: { keyPath: 'id' },
        admissions: { keyPath: 'id' },
        consultations: { keyPath: 'id' },
        hospitalisations: { keyPath: 'id' },
        suiviHospitalisation: { keyPath: 'id' },
        transferts: { keyPath: 'id' },
        dossierMedical: { keyPath: 'id' },
        urgences: { keyPath: 'id' },
        triage: { keyPath: 'id' },
        ordonnances: { keyPath: 'id' },
        dispensations: { keyPath: 'id' },
        stockPharmacie: { keyPath: 'id' },
        commandesPharmacie: { keyPath: 'id' },
        demandesExamen: { keyPath: 'id' },
        resultatsExamen: { keyPath: 'id' },
        prelevements: { keyPath: 'id' },
        examensImagerie: { keyPath: 'id' },
        resultatsImagerie: { keyPath: 'id' },
        operations: { keyPath: 'id' },
        blocChirurgical: { keyPath: 'id' },
        comptesRendusOp: { keyPath: 'id' },
        factures: { keyPath: 'id' },
        paiements: { keyPath: 'id' },
        caisses: { keyPath: 'id' },
        assurances: { keyPath: 'id' },
        adhesionsAssurance: { keyPath: 'id' },
        journal: { keyPath: 'id' },
        parametres: { keyPath: 'cle' },
        documents: { keyPath: 'id' },
        documentsFichiers: { keyPath: 'id' }
    };

    const Local = {
        db: null,
        async init() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open('GestionHopital', 6);

                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    for (const [storeName, config] of Object.entries(STORES)) {
                        if (!db.objectStoreNames.contains(storeName)) {
                            const store = db.createObjectStore(storeName, { keyPath: config.keyPath });
                            if (config.indexes) {
                                config.indexes.forEach(idx => {
                                    store.createIndex(idx, idx, { unique: false });
                                });
                            }
                        }
                    }
                };

                request.onsuccess = (e) => {
                    this.db = e.target.result;
                    resolve(this.db);
                };

                request.onerror = (e) => reject(e.target.error);
            });
        },

        async getAll(storeName) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        },

        async get(storeName, key) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        },

        async put(storeName, data) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const request = store.put(data);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        },

        async putAll(storeName, items) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                items.forEach(item => store.put(item));
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        },

        async delete(storeName, key) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const request = store.delete(key);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        },

        async clear(storeName) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        },

        async count(storeName) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const request = store.count();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        },

        async getByIndex(storeName, indexName, value) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const index = store.index(indexName);
                const request = index.getAll(value);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        },

        async exportAll() {
            const data = {};
            for (const storeName of Object.keys(STORES)) {
                data[storeName] = await this.getAll(storeName);
            }
            return data;
        },

        async importAll(data) {
            for (const [storeName, items] of Object.entries(data)) {
                if (STORES[storeName] && Array.isArray(items)) {
                    await this.clear(storeName);
                    await this.putAll(storeName, items);
                }
            }
        }
    };

    // ------------------------------------------------------------
    // Façade publique : choisit le backend selon la configuration
    // ------------------------------------------------------------
    const facade = {
        DB_NAME: 'GestionHopital',
        DB_VERSION: 6,
        STORES: STORES,

        _backend: Local,
        _mode: 'local',

        get db() {
            return this._backend ? this._backend.db : null;
        },

        mode() {
            return this._mode;
        },

        generateId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
        },

        async init(mode) {
            if (!mode) {
                const c = (window && window.APP_CONFIG) ? APP_CONFIG : null;
                mode = (c && c.MODE) || 'local';
            }
            this._mode = mode;

            if (mode === 'cloud' && window.RemoteDB) {
                this._backend = window.RemoteDB;
                await this._backend.init();

                // Ouverture directe d'un fichier (file://) : une base
                // centrale distante n'est pas garantie (et typiquement
                // hors ligne) -> bascule automatique en mode local.
                if (typeof location !== 'undefined' && location.protocol === 'file:') {
                    this._useLocal('Mode local: acces fichier (file://). Donnees stockees sur ce poste.');
                } else {
                    // Premier contact reseau (authentification anonyme).
                    // En cas d'absence de connexion -> repli local.
                    const ok = await this._probeCloud(6000);
                    if (ok) {
                        this._mode = 'cloud';
                    } else {
                        this._useLocal('Mode local: sans connexion a la base centrale. Utilisez l\'application en ligne pour la base partagee.');
                    }
                }
            } else {
                if (mode === 'cloud' && typeof Logger !== 'undefined') {
                    Logger.warn('DB', 'Mode cloud demande mais js/remote_db.js absent; bascule local');
                }
                this._backend = Local;
                this._mode = 'local';
            }
            await this._backend.init();
            return true;
        },

        // Sonde rapide du backend distant : reussit si le premier appel
        // reseau aboutit dans le delai imparti, echoue sinon/timeout.
        async _probeCloud(ms) {
            try {
                const p = (window.RemoteDB && window.RemoteDB.probe) ? window.RemoteDB.probe() : true;
                await Promise.race([
                    Promise.resolve(p),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
                ]);
                return true;
            } catch (e) {
                if (typeof Logger !== 'undefined') Logger.warn('DB', 'Backend distant indisponible: ' + e.message);
                return false;
            }
        },

        _useLocal(msg) {
            if (typeof Logger !== 'undefined') Logger.warn('DB', 'Bascule en mode local.');
            if (window.UI && UI.toast) UI.toast(msg, 'warning');
            this._backend = Local;
            this._mode = 'local';
        },

        // Prevenir les couches de synchronisation (en ligne et reseau
        // local) qu'une ecriture locale vient d'avoir lieu. Elles
        // ignorent les imports recus d'un autre poste (garde interne).
        _notify() {
            try {
                if (window.Sync && Sync.changed) Sync.changed();
            } catch (e) { /* synchronisation indisponible */ }
            try {
                if (window.LanSync && LanSync.changed) LanSync.changed();
            } catch (e) { /* synchronisation indisponible */ }
        },

        async getAll(storeName) {
            return this._backend.getAll(storeName);
        },
        async get(storeName, key) {
            return this._backend.get(storeName, key);
        },
        async put(storeName, data) {
            const r = await this._backend.put(storeName, data);
            this._notify();
            return r;
        },
        async putAll(storeName, items) {
            const r = await this._backend.putAll(storeName, items);
            this._notify();
            return r;
        },
        async delete(storeName, key) {
            const r = await this._backend.delete(storeName, key);
            this._notify();
            return r;
        },
        async clear(storeName) {
            const r = await this._backend.clear(storeName);
            this._notify();
            return r;
        },
        async count(storeName) {
            return this._backend.count(storeName);
        },
        async getByIndex(storeName, indexName, value) {
            return this._backend.getByIndex(storeName, indexName, value);
        },
        async exportAll() {
            return this._backend.exportAll();
        },
        async importAll(data) {
            return this._backend.importAll(data);
        }
    };

    return facade;
})();

window.DB = DB;