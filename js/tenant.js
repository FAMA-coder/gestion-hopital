// ============================================================
// js/tenant.js — Contexte multitenant (etablissement courant)
// ------------------------------------------------------------
// En mode cloud, chaque hopital/clinique possede un identifiant
// (tenant) et ses donnees sont isolees sous /records/{tenant}/.
// Le registre des etablissements est gere par le compte ADMIN
// (global) sous /master/hopitaux/.
// ------------------------------------------------------------
// Tenant.get() / set() : etablissement courant (localStorage).
// Tenant.list()         : tous les etablissements (registre).
// Tenant.ensureDefault(): cree le premier etablissement et migre
//                         les anciennes donnees (pre-multitenant).
// ============================================================
const Tenant = {
    KEY: 'gh_tenant',

    get() {
        try {
            return localStorage.getItem(this.KEY) || null;
        } catch (e) { return null; }
    },

    set(tid) {
        try { localStorage.setItem(this.KEY, tid || ''); } catch (e) { /* ignore */ }
        if (window && window.Cache) Cache.invalidateAll();
        return tid;
    },

    reset() {
        try { localStorage.removeItem(this.KEY); } catch (e) { /* ignore */ }
        if (window && window.Cache) Cache.invalidateAll();
    },

    async list() {
        const obj = (window && window.RemoteDB) ? await RemoteDB.masterGet('hopitaux') : null;
        if (!obj) return [];
        return Object.keys(obj).map(k => obj[k]).sort((a, b) => String(a.nom || '').localeCompare(String(b.nom || '')));
    },

    async getOne(tid) {
        const obj = (window && window.RemoteDB) ? await RemoteDB.masterGet('hopitaux/' + encodeURIComponent(tid)) : null;
        return obj || null;
    },

    // Cree (ou met a jour) un etablissement dans le registre maître.
    async save(t) {
        t.id = t.id || t.tid || ('h' + Date.now().toString(36));
        t.updatedAt = new Date().toISOString();
        await RemoteDB.masterPut('hopitaux/' + encodeURIComponent(t.id), t);
        return t;
    },

    async remove(tid) {
        await RemoteDB.masterDelete('hopitaux/' + encodeURIComponent(tid));
    },

    // Premiere initialisation : garantit l'existence d'au moins un
    // etablissement et migre les eventuelles anciennes donnees stockees
    // directement sous /records/ (version simple-hopital).
    async ensureDefault() {
        const cfg = window.APP_CONFIG || {};
        if (cfg.MODE !== 'cloud' || !(window.RemoteDB || {}).impl) return;
        const existing = await this.list();
        if (existing.length > 0) return;

        const tid = 't1';
        let legacy = null;
        try {
            legacy = await RemoteDB.rawGet('/records.json');
        } catch (e) { legacy = null; }

        await this.save({
            id: tid,
            nom: 'Hopital Central de Kinshasa',
            ville: 'Kinshasa',
            statut: 'actif',
            creeLe: new Date().toISOString(),
            creePar: 'system',
            origine: 'migration'
        });

        if (legacy && typeof legacy === 'object' && Object.keys(legacy).length > 0) {
            await RemoteDB.rawPut('/records/' + encodeURIComponent(tid) + '.json', legacy);
            for (const storeName of Object.keys(legacy)) {
                await RemoteDB.rawDelete('/records/' + encodeURIComponent(storeName) + '.json');
            }
        }
        this.set(tid);
    }
};

window.Tenant = Tenant;