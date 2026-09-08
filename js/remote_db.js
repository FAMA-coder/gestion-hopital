// ============================================================
// js/remote_db.js — Backends distants partagés
// ------------------------------------------------------------
// Fournit la même API que DB (voir js/db.js) sur une base
// centrale unique  (store, id) -> data, choisie via
// APP_CONFIG.BACKEND :
//   'supabase' : table Postgres "records" (voir cloud/supabase-setup.sql)
//   'firebase' : Realtime Database  (tree /records/{store}/{id})
//
// La façade DB (js/db.js) utilise ce module quand
// APP_CONFIG.MODE === 'cloud'. Pour les tests, setTransport(fn)
// remplace fetch par un simulacre.
// ============================================================
const RemoteDB = (function () {

    // Cle primaire d'un magasin (definie dans DB.STORES : 'id' ou 'cle').
    function keyPathOf(store) {
        const cfg = (window && window.DB && DB.STORES) ? DB.STORES[store] : null;
        return (cfg && cfg.keyPath) || 'id';
    }

    // ------------------------------------------------------------
    // Backend Supabase (PostgREST)
    // ------------------------------------------------------------
    const Supabase = {
        baseUrl: null,
        apiKey: null,
        secret: null,
        _transport: null,

        setTransport(fn) { this._transport = fn; },

        configure(c) {
            this.baseUrl = (c.SUPABASE_URL || '').replace(/\/+$/, '');
            this.apiKey = c.SUPABASE_ANON_KEY || '';
            this.secret = c.APP_SECRET || '';
            return !!(this.baseUrl && this.apiKey);
        },

        _headers(extra) {
            const h = {
                'apikey': this.apiKey,
                'Authorization': 'Bearer ' + this.apiKey,
                'Content-Type': 'application/json'
            };
            if (this.secret) h['x-app-secret'] = this.secret;
            if (extra) Object.assign(h, extra);
            return h;
        },

        async _perform(url, opts) {
            const doFetch = this._transport || fetch;
            const resp = await doFetch(url, opts);
            if (resp.status >= 400) {
                let detail = '';
                try { const j = await resp.json(); detail = (j && j.message) || (j && j.details) || ''; } catch (e) { /* ignore */ }
                throw new Error('Stockage distant (HTTP ' + resp.status + ') ' + detail + ' - verifiez cloud/supabase-setup.sql');
            }
            return resp;
        },

        _qs(obj) {
            return Object.keys(obj).map(k => k + '=' + encodeURIComponent(obj[k])).join('&');
        },

        _where(store, filter) {
            const parts = ['store=eq.' + encodeURIComponent(store)];
            if (filter && filter.id != null) parts.push('id=eq.' + encodeURIComponent(String(filter.id)));
            return parts.join('&');
        },

        async getAll(store) {
            const q = this._qs({ select: 'data', order: 'updated_at.asc' });
            const url = this.baseUrl + '/rest/v1/records?' + this._where(store, null) + '&' + q;
            const resp = await this._perform(url, { method: 'GET', headers: this._headers() });
            const rows = await resp.json();
            return rows.map(r => r.data);
        },

        async get(store, key) {
            const url = this.baseUrl + '/rest/v1/records?' + this._where(store, { id: key }) + '&select=data&limit=1';
            const resp = await this._perform(url, { method: 'GET', headers: this._headers() });
            const rows = await resp.json();
            return (rows && rows[0]) ? rows[0].data : null;
        },

        async put(store, data) {
            const body = JSON.stringify({ store: store, id: String(data[keyPathOf(store)]), data: data });
            const url = this.baseUrl + '/rest/v1/records';
            await this._perform(url, {
                method: 'POST',
                headers: this._headers({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
                body: body
            });
        },

        async putAll(store, items) {
            const CHUNK = 400;
            for (let i = 0; i < items.length; i += CHUNK) {
                const slice = items.slice(i, i + CHUNK).map(item => ({ store: store, id: String(item[keyPathOf(store)]), data: item }));
                const url = this.baseUrl + '/rest/v1/records';
                await this._perform(url, {
                    method: 'POST',
                    headers: this._headers({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
                    body: JSON.stringify(slice)
                });
            }
        },

        async delete(store, key) {
            const url = this.baseUrl + '/rest/v1/records?' + this._where(store, { id: key });
            await this._perform(url, { method: 'DELETE', headers: this._headers({ 'Prefer': 'return=minimal' }) });
        },

        async clear(store) {
            const url = this.baseUrl + '/rest/v1/records?store=eq.' + encodeURIComponent(store) + '&id=neq.__clear__';
            await this._perform(url, { method: 'DELETE', headers: this._headers({ 'Prefer': 'return=minimal' }) });
        },

        async count(store) {
            const headers = this._headers({ 'Prefer': 'count=exact' });
            const url = this.baseUrl + '/rest/v1/records?' + this._where(store, null) + '&select=id&limit=1';
            const resp = await this._perform(url, { method: 'GET', headers: headers });
            const cr = resp.headers && resp.headers.get ? resp.headers.get('content-range') : null;
            if (cr) {
                const m = cr.match(/\/(\d+)$/);
                if (m) return parseInt(m[1], 10);
            }
            const rows = await resp.json();
            return rows.length;
        },

        async getByIndex(store, indexName, value) {
            const all = await this.getAll(store);
            return all.filter(item => item[indexName] === value);
        }
    };

    // ------------------------------------------------------------
    // Backend Firebase Realtime Database
    // ------------------------------------------------------------
    const FirebaseRTDB = {
        baseUrl: null,
        apiKey: null,
        _token: null,
        _promise: null,
        _transport: null,

        setTransport(fn) { this._transport = fn; },

        configure(c) {
            this.baseUrl = (c.FIREBASE_DATABASE_URL || '').replace(/\/+$/, '');
            this.apiKey = c.FIREBASE_API_KEY || '';
            return !!(this.baseUrl && this.apiKey);
        },

        // Identification anonyme Firebase (un jeton par navigateur).
        async _auth() {
            if (this._token) return this._token;
            if (!this._promise) {
                this._promise = (async () => {
                    if (typeof localStorage !== 'undefined') {
                        try {
                            const cached = localStorage.getItem('gh_fb_auth');
                            if (cached) {
                                const j = JSON.parse(cached);
                                if (j.token && j.exp && Date.now() < j.exp) { this._token = j.token; return j.token; }
                            }
                        } catch (e) { /* ignore */ }
                    }
                    const url = 'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + encodeURIComponent(this.apiKey);
                    const resp = await (this._transport || fetch)(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: '{"returnSecureToken":true}'
                    });
                    let j = null;
                    try { j = await resp.json(); } catch (e) { /* ignore */ }
                    if (!j || !j.idToken) {
                        const msg = j && j.error && j.error.message ? j.error.message : ('HTTP ' + resp.status);
                        throw new Error('Connexion Firebase impossible (' + msg + '). Verifiez FIREBASE_API_KEY et l\'activation de la connexion anonyme.');
                    }
                    this._token = j.idToken;
                    try {
                        localStorage.setItem('gh_fb_auth', JSON.stringify({
                            token: j.idToken,
                            exp: Date.now() + (parseInt(j.expiresIn, 10) || 3600) * 1000 - 60000
                        }));
                    } catch (e) { /* ignore */ }
                    return j.idToken;
                })().catch((err) => { this._promise = null; throw err; });
            }
            return this._promise;
        },

        async _perform(suffix, opts) {
            const token = await this._auth();
            const sep = suffix.indexOf('?') >= 0 ? '&' : '?';
            const url = this.baseUrl + suffix + sep + 'auth=' + encodeURIComponent(token);
            const resp = await (this._transport || fetch)(url, opts);
            if (resp.status >= 400) {
                let detail = '';
                try { const j = await resp.json(); detail = (j && j.error) || ''; } catch (e) { /* ignore */ }
                throw new Error('Stockage distant (HTTP ' + resp.status + ') ' + detail + ' - verifiez FIREBASE_DATABASE_URL et les regles de la base.');
            }
            return resp;
        },

        async _obj(store, key) {
            const url = '/' + encodeURIComponent(store) + (key != null ? '/' + encodeURIComponent(key) : '') + '.json';
            const resp = await this._perform(url, { method: 'GET' });
            const text = await resp.text();
            if (!text) return null;
            return JSON.parse(text);
        },

        async getAll(store) {
            const obj = await this._obj(store);
            return obj ? Object.keys(obj).map(k => obj[k]) : [];
        },

        async get(store, key) {
            const v = await this._obj(store, key);
            return (v === null || v === undefined) ? null : v;
        },

        async put(store, data) {
            const url = '/' + encodeURIComponent(store) + '/' + encodeURIComponent(String(data[keyPathOf(store)])) + '.json';
            await this._perform(url, { method: 'PUT', body: JSON.stringify(data) });
        },

        async putAll(store, items) {
            const payload = {};
            items.forEach(item => { payload[item[keyPathOf(store)]] = item; });
            const url = '/' + encodeURIComponent(store) + '.json';
            await this._perform(url, { method: 'PATCH', body: JSON.stringify(payload) });
        },

        async delete(store, key) {
            const url = '/' + encodeURIComponent(store) + '/' + encodeURIComponent(String(key)) + '.json';
            await this._perform(url, { method: 'DELETE' });
        },

        async clear(store) {
            const url = '/' + encodeURIComponent(store) + '.json';
            await this._perform(url, { method: 'DELETE' });
        },

        async count(store) {
            const url = '/' + encodeURIComponent(store) + '.json?shallow=true';
            const resp = await this._perform(url, { method: 'GET' });
            const text = await resp.text();
            if (!text) return 0;
            const obj = JSON.parse(text);
            return obj ? Object.keys(obj).length : 0;
        },

        async getByIndex(store, indexName, value) {
            const all = await this.getAll(store);
            return all.filter(item => item[indexName] === value);
        }
    };

    // ------------------------------------------------------------
    // Façade de sélection du backend
    // ------------------------------------------------------------
    const facade = {
        impl: null,
        ready: false,
        _transport: null,

        setTransport(fn) {
            this._transport = fn;
            if (this.impl) this.impl.setTransport(fn);
        },

        init() {
            this.impl = null;
            this.ready = false;
            const c = (window && window.APP_CONFIG) ? APP_CONFIG : null;
            if (!c || c.MODE !== 'cloud') return true;

            const backend = String(c.BACKEND || 'supabase').toLowerCase();
            if (backend === 'firebase' && c.FIREBASE_DATABASE_URL && c.FIREBASE_API_KEY) {
                this.impl = FirebaseRTDB;
                FirebaseRTDB.configure(c);
                FirebaseRTDB.setTransport(this._transport);
                this.ready = true;
                return true;
            }
            if (c.SUPABASE_URL && c.SUPABASE_ANON_KEY) {
                this.impl = Supabase;
                Supabase.configure(c);
                Supabase.setTransport(this._transport);
                this.ready = true;
                return true;
            }
            return true;
        },

        generateId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
        },

        _need() {
            if (!this.impl) throw new Error('Backend distant non configure (voir cloud/DEPLOIEMENT.md).');
            return this.impl;
        },

        async getAll(store) { return this._need().getAll(store); },
        async get(store, key) { return this._need().get(store, key); },
        async put(store, data) { return this._need().put(store, data); },
        async putAll(store, items) { return this._need().putAll(store, items); },
        async delete(store, key) { return this._need().delete(store, key); },
        async clear(store) { return this._need().clear(store); },
        async count(store) { return this._need().count(store); },
        async getByIndex(store, indexName, value) { return this._need().getByIndex(store, indexName, value); },

        async exportAll() {
            const data = {};
            for (const storeName of Object.keys(window.DB.STORES)) {
                data[storeName] = await this._need().getAll(storeName);
            }
            return data;
        },

        async importAll(data) {
            for (const [storeName, items] of Object.entries(data)) {
                if (window.DB.STORES[storeName] && Array.isArray(items)) {
                    await this._need().clear(storeName);
                    await this._need().putAll(storeName, items);
                }
            }
        }
    };

    return facade;
})();

window.RemoteDB = RemoteDB;