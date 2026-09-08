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

        async getAll(storeName) {
            return this._backend.getAll(storeName);
        },
        async get(storeName, key) {
            return this._backend.get(storeName, key);
        },
        async put(storeName, data) {
            return this._backend.put(storeName, data);
        },
        async putAll(storeName, items) {
            return this._backend.putAll(storeName, items);
        },
        async delete(storeName, key) {
            return this._backend.delete(storeName, key);
        },
        async clear(storeName) {
            return this._backend.clear(storeName);
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