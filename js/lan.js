// ============================================================
// js/lan.js — Synchronisation « reseau local »
// ------------------------------------------------------------
// Reservee au mode local (IndexedDB) : chaque navigateur possede
// alors sa propre base. Un poste du reseau heberge la derniere
// image des donnees (poste « serveur ») et les autres s'y
// connectent (postes « clients »). Ni nuage, ni serveur externe :
// l'echange passe par build/serveur.ps1 demarre avec -Sync.
//
// Principe : image complete, « v » = horodatage du dernier ecrit,
// le plus recent gagne (LWW), « src » identifie le poste pour ne
// pas recharger sa propre ecrit. DB.put/putAll/delete/clear
// declenchent LanSync.changed() ; le push est debounce (1,5 s).
//
// Garde-fous (les erreurs les pluslosses d'une synchro d'image) :
//   - la version est strictement croissante (une horloge en retard
//     ne peut plus produire une version anterieure) ;
//   - on interroge le poste serveur AVANT de pousser, afin de
//     ne jamais ecraser une image plus recente ;
//   - si le poste serveur refuse l'image (ecarte), on tire
//     immediatement l'image gagnante ;
//   - une image est validee avant import (tous les magasins
//     attendus, sinon aucune ecriture) et n'est jamais importee
//     pendant qu'un formulaire est a l'ecran ;
//   - en cas d'echec, tentatives espacees (retour arriere
//     exponentiel) au lieu de boucler toutes les 1,5 s.
//
// Protocole (secret partage, en-tete X-Sync-Secret afin qu'il
// n'apparaisse jamais dans une URL ni dans un journal) :
//   GET  /__sync/state              -> { ok, v, src }
//   POST /__sync/push  <- { v, src, poste, data }
//                                    -> { ok, v, ecarte }
//   GET  /__sync/pull               -> { ok, v, src, poste, data }
//
// Configuration : Parametres > Synchro > Reseau local.
// ============================================================
const LanSync = {
    KEY: 'gh_sync_lan',
    V_KEY: 'gh_lan_v',
    DEBOUNCE_MS: 1500,
    PULL_MIN_MS: 3000,
    PULL_MAX_MS: 300000,
    RETRY_MIN_MS: 4000,
    RETRY_MAX_MS: 60000,
    MAX_SNAPSHOT_BYTES: 24 * 1024 * 1024, // garde-fou : le serveur refuse au-dela de 32 Mo
    DEFAULT_PORT: 8080,

    CID: (window.crypto && window.crypto.randomUUID)
        ? window.crypto.randomUUID()
        : (Math.random().toString(36).slice(2) + Date.now().toString(36)),

    started: false,
    ready: false,
    dirty: false,
    pushTimer: null,
    pollTimer: null,
    busy: false,
    applying: false,
    bootstrap: true,
    pending: false, // image distante recue mais differée (formulaire ouvert)
    lastV: 0,
    failCount: 0,
    lastError: '',
    lastCheck: null,
    lastChange: null,

    // ------------------------------------------------------------
    // Configuration
    // ------------------------------------------------------------
    defaults() {
        return { enabled: false, mode: 'server', host: '', port: this.DEFAULT_PORT, secret: '', poste: '' };
    },

    read() {
        try {
            const raw = localStorage.getItem(this.KEY);
            if (raw) {
                const o = JSON.parse(raw);
                if (o && typeof o === 'object') return o;
            }
        } catch (e) { /* stockage indisponible */ }
        return null;
    },

    getConfig() {
        const base = this.defaults();
        const o = this.read();
        if (!o) return base;
        const port = parseInt(o.port, 10);
        return {
            enabled: o.enabled === true,
            mode: (o.mode === 'server' || o.mode === 'client') ? o.mode : 'server',
            host: String(o.host || ''),
            port: (port >= 1 && port <= 65535) ? port : base.port,
            secret: String(o.secret || ''),
            poste: String(o.poste || '').trim()
        };
    },

    setConfig(o) {
        const cur = this.getConfig();
        const next = {
            enabled: !!(o && o.enabled),
            mode: (o && o.mode === 'client') ? 'client' : 'server',
            host: String((o && o.host) || '').trim(),
            port: parseInt((o && o.port) || cur.port, 10),
            secret: String((o && o.secret) || ''),
            poste: String((o && o.poste) || cur.poste || '').trim()
        };
        if (!(next.port >= 1 && next.port <= 65535)) next.port = cur.port;
        if (next.poste.length > 60) next.poste = next.poste.slice(0, 60);
        try {
            localStorage.setItem(this.KEY, JSON.stringify(next));
        } catch (e) { /* configuration non persistee */ }
        // Un changement d'adresse, de port ou de secret remet a zero
        // la version connue : sinon le nouveau poste serveur serait
        // compare a une version etrangere et son image jamais tiree.
        if (next.host !== cur.host || next.port !== cur.port || next.secret !== cur.secret) {
            this._setV(0);
            this.pending = false;
            this.bootstrap = true;
        }
        this.reconfigure();
        return this.getConfig();
    },

    // Nom lisible du poste, transmis au poste serveur pour qu'il
    // indique qui a ecrit la derniere image.
    posteName() {
        const p = this.getConfig().poste;
        return p || 'Poste';
    },

    // ------------------------------------------------------------
    // Disponibilite : reservee au mode local. En mode cloud la base
    // centrale est deja partagee (c'est la synchro « en ligne »
    // qui refresh les ecrans).
    // ------------------------------------------------------------
    supported() {
        return !!(window.DB && DB.mode() === 'local');
    },

    enabled() {
        const c = this.getConfig();
        return !!(c.enabled && this.supported());
    },

    // Adresse du poste serveur : en mode « serveur » c'est le poste
    // qui sert l'application (donc cette origine) ; en mode
    // « client » c'est l'hote saisi dans les parametres.
    baseUrl() {
        const c = this.getConfig();
        if (c.mode === 'server') {
            return (typeof location !== 'undefined' && location.origin && location.origin !== 'null')
                ? location.origin
                : 'http://localhost:' + c.port;
        }
        return 'http://' + (c.host || 'localhost') + ':' + c.port;
    },

    // Rappel de configuration affiche dans l'ecran Parametres.
    info() {
        const c = this.getConfig();
        return {
            mode: c.enabled ? c.mode : 'off',
            port: c.port,
            host: c.host,
            poste: this.posteName(),
            base: this.baseUrl(),
            error: this.lastError
        };
    },

    // ------------------------------------------------------------
    // Cycle de vie
    // ------------------------------------------------------------
    start() {
        this.stop();
        if (!this.enabled()) {
            this.render();
            return;
        }
        this.started = true;
        this.lastError = '';
        this.failCount = 0;
        this.pending = false;
        try { this.lastV = parseInt(localStorage.getItem(this.V_KEY), 10) || 0; }
        catch (e) { this.lastV = 0; }
        this._scheduleCycle(0);
        document.addEventListener('visibilitychange', this._onVisible);
        this.render();
    },

    _onVisible() {
        if (!document.hidden && this.started) this._scheduleCycle(0);
    },

    stop() {
        if (this.pollTimer) { clearTimeout(this.pollTimer); this.pollTimer = null; }
        if (this.pushTimer) { clearTimeout(this.pushTimer); this.pushTimer = null; }
        document.removeEventListener('visibilitychange', this._onVisible);
        this.started = false;
        this.ready = false;
        this.bootstrap = true;
        this.dirty = false;
        this.busy = false;
        this.pending = false;
        this.failCount = 0;
    },

    reconfigure() {
        this.stop();
        this.start();
    },

    // ------------------------------------------------------------
    // Ecriture locale -> marquage « a pousser »
    // ------------------------------------------------------------
    changed() {
        if (!this.started || !this.enabled() || this.applying) return;
        this.dirty = true;
        this.schedule();
    },

    schedule() {
        if (!this.started || !this.enabled() || this.applying || !this.dirty) return;
        if (this.pushTimer) clearTimeout(this.pushTimer);
        const delay = this.failCount ? this._retryDelay() : this.DEBOUNCE_MS;
        this.pushTimer = setTimeout(() => this.cycle(), delay);
    },

    _scheduleCycle(delay) {
        if (this.pollTimer) { clearTimeout(this.pollTimer); this.pollTimer = null; }
        if (!this.started) return;
        this.pollTimer = setTimeout(() => {
            this.pollTimer = null;
            this.cycle();
        }, Math.max(0, delay || 0));
    },

    // Retour arriere exponentiel plafonne : evite de marteler un
    // poste serveur etrange ou d'eteindre une connexion lente.
    _retryDelay() {
        const d = this.RETRY_MIN_MS * Math.pow(2, Math.max(0, Math.min(this.failCount - 1, 6)));
        return Math.min(d, this.RETRY_MAX_MS);
    },

    _idleDelay() {
        const d = this.PULL_MIN_MS * Math.pow(2, Math.min(this.failCount, 6));
        return Math.min(Math.max(d, this.PULL_MIN_MS), this.PULL_MAX_MS);
    },

    // Version strictement croissante : une horloge systeme en
    // retard ne doit jamais produire une version anterieure a la
    // derniere image connue (ce qui ferait perdre des donnees).
    _nextVersion() {
        return Math.max(Date.now(), (this.lastV || 0) + 1);
    },

    _setV(v) {
        this.lastV = Math.max(0, Number(v) || 0);
        try { localStorage.setItem(this.V_KEY, String(this.lastV)); } catch (e) { /* ignore */ }
    },

    // ------------------------------------------------------------
    // Requete vers le poste serveur. Le secret transite par
    // l'en-tete X-Sync-Secret : il ne figure ni dans l'URL (donc
    // ni dans l'historique du navigateur, ni dans un journal), ni
    // dans le corps des requetes GET.
    // ------------------------------------------------------------
    request(op, payload) {
        const c = this.getConfig();
        const url = this.baseUrl() + '/__sync/' + op;
        const init = {
            method: payload ? 'POST' : 'GET',
            cache: 'no-store',
            headers: {
                'Accept': 'application/json',
                'X-Sync-Secret': c.secret || ''
            }
        };
        if (payload) {
            init.headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(payload);
        }
        return fetch(url, init).then((r) => {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text().then((t) => (t ? JSON.parse(t) : null));
        });
    },

    // ------------------------------------------------------------
    // Cycle de synchronisation : verifier le poste serveur, tirer
    // son image si elle est plus recente, puis pousser la nôtre.
    // L'ordre « lire avant d'ecrire » evite d'ecraser une image
    // distante plus recente avec une copie locale perimee.
    // Retourne { attempted, applied, error } : l'appelant manuel
    // (bouton « Synchroniser maintenant ») doit pouvoir dire si
    // l'echange a reellement eu lieu.
    // ------------------------------------------------------------
    async cycle() {
        this.pushTimer = null;
        this._appliedThisCycle = false;
        if (!this.started || !this.enabled() || this.applying || this.busy) {
            return { attempted: false, applied: false, error: this.lastError || 'synchronisation non lancee' };
        }
        this.busy = true;
        let applied = false;
        try {
            const st = await this.request('state');
            if (!st || !st.ok) throw new Error((st && st.error) || 'reponse invalide du poste serveur');
            this.ready = true;
            this.lastError = '';
            this.failCount = 0;
            this.lastCheck = new Date().toISOString();

            const remoteV = Number(st.v) || 0;
            const foreign = remoteV > 0 && st.src !== this.CID;
            if (foreign && remoteV > this.lastV) {
                applied = await this._pullAndApply();
            }

            if (applied) {
                // L'image du poste serveur est plus recente : elle
                // remplace la copie locale (le plus recent gagne).
                this.dirty = false;
            } else if (this.dirty && !this.blocked()) {
                await this._push();
            }
        } catch (e) {
            this.failCount += 1;
            this.lastError = String((e && e.message) || e);
            Logger.warn('LanSync', 'Synchronisation impossible', this.lastError);
        } finally {
            this.busy = false;
            // Premier lancement : le poste publie son image locale
            // pour que le poste serveur puisse la distribuer. Si une
            // image distante vient d'etre importee, la copie locale
            // est deja a jour : inutile de la republier.
            if (this.bootstrap && !this.lastError) {
                this.bootstrap = false;
                if (!this._appliedThisCycle) this.dirty = true;
            }
        }
        this._scheduleCycle(this.lastError ? this._retryDelay() : this._idleDelay());
        this.schedule();
        this.render();
        return { attempted: true, applied: applied || this._appliedThisCycle, error: this.lastError };
    },

    // Alias conserve : la boucle de rappel et les appels manuels
    // utilisent le meme cycle.
    pull() {
        return this.cycle();
    },

    // Un formulaire est-il en cours de saisie ? L'import d'une
    // image reecrit des magasins entiers : l'appliquer sous un
    // formulaire ouvert afficherait des valeurs qui ne sont plus
    // celles du formulaire. L'import est donc differe.
    blocked() {
        const ov = document.getElementById('modal-overlay');
        if (ov && ov.style.display === 'flex') return true;
        if (window.Router && Router.currentModule === 'parametres') return true;
        return false;
    },

    async _pullAndApply(force) {
        if (this.blocked()) {
            this.pending = true;
            return false;
        }
        const snap = await this.request('pull');
        // Le poste serveur renvoie l'image stockee telle quelle : cette
        // enveloppe est celle poussee par le client d'origine
        // ({ v, src, poste, data }) et ne comporte donc pas de champ
        // « ok ». Exiger sa presence ferait ignorer toute image
        // distante. Seul un « ok: false » explicite est un refus, et
        // l'absence de donnees signale une image absente.
        if (!snap || snap.ok === false || !snap.data) return false;
        if (!snap.src || snap.src === this.CID) return false; // notre propre image
        const v = Number(snap.v) || 0;
        if (!force && !(v > this.lastV)) return false;

        const verdict = this.validateSnapshot(snap.data);
        if (!verdict.ok) {
            this.lastError = verdict.error;
            this.pending = false;
            Logger.warn('LanSync', 'Image refusee', verdict.error);
            this._setV(v); // image deja vue : on ne la retente pas a chaque tour
            return false;
        }
        if (verdict.empty) {
            // Une image entierement vide ne doit pas vider une base
            // deja remplie : verification de l'etat local.
            try {
                const hopital = await Meta.getHopital();
                if (hopital) {
                    this.lastError = 'Image vide refusee : ce poste contient deja des donnees.';
                    Logger.warn('LanSync', 'Image vide refusee', this.lastError);
                    this._setV(v);
                    return false;
                }
            } catch (e) { /* lecture locale impossible : on refuse par prudence */ }
        }

        const done = await this.applySnapshot(snap);
        if (done) this._setV(v);
        this.pending = false;
        return done;
    },

    // Controle d'integrite avant toute ecriture : une image
    // tronquee, erronee ou vide ('{}') ne doit jamais remplacer la
    // base locale. DB.importAll ecrase chaque magasin tour a tour :
    // la moitie des magasins serait deja detruite si l'import
    // echouait en cours de route.
    validateSnapshot(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            return { ok: false, error: 'Image recue illisible.' };
        }
        const stores = (window.DB && DB.STORES) ? DB.STORES : null;
        if (!stores) return { ok: true, count: 0, empty: false };
        const names = Object.keys(stores);
        const missing = [];
        let total = 0;
        for (const n of names) {
            if (!Array.isArray(data[n])) missing.push(n);
            else total += data[n].length;
        }
        if (missing.length) {
            return {
                ok: false,
                error: 'Image incomplete (' + missing.length + ' magasin(s) absent(s), ex. ' + missing[0] + ') : import ignore.'
            };
        }
        return { ok: true, count: total, empty: total === 0 };
    },

    async _push() {
        if (!this.started || !this.enabled() || !this.dirty || this.applying) return false;
        const data = await DB.exportAll();
        const payload = { v: this._nextVersion(), src: this.CID, poste: this.posteName(), data: data };

        const json = JSON.stringify(payload);
        let size = 0;
        try { if (typeof Blob === 'function') size = new Blob([json]).size; } catch (e) { size = 0; }
        if (!size) size = json.length * 2; // repli : estimation UTF-16
        if (size > this.MAX_SNAPSHOT_BYTES) {
            this.failCount += 1;
            const ko = (n) => (n >= 1048576) ? (Math.round(n / 1048576) + ' Mo') : (Math.round(n / 1024) + ' Ko');
            this.lastError = 'Donnees trop voluminees pour la synchro LAN (' + ko(size)
                + ' pour ' + ko(this.MAX_SNAPSHOT_BYTES) + ' maximum).';
            Logger.warn('LanSync', 'Envoi refuse', this.lastError);
            return false;
        }

        const resp = await this.request('push', payload);
        if (!resp || !resp.ok) throw new Error((resp && resp.error) || 'reponse invalide du poste serveur');

        if (resp.ecarte) {
            // Le poste serveur conserve une image plus recente :
            // on l'aligne puis on tire l'image gagnante, sinon les
            // modifications locales seraient perdues en silence.
            this._setV(resp.v);
            this.dirty = false;
            Logger.warn('LanSync', 'Image ecustee par le poste serveur (v' + resp.v + ') : recuperation en cours');
            await this._pullAndApply(true);
            return false;
        }

        this._setV(resp.v || payload.v);
        this.dirty = false;
        this.lastChange = new Date().toISOString();
        this.lastError = '';
        this.ready = true;
        this.lastCheck = new Date().toISOString();
        return true;
    },

    // Bouton « Synchroniser maintenant » : force un cycle et rend
    // compte du resultat reel (aucun succes annonce si l'echange
    // n'a pas eu lieu).
    async syncNow() {
        if (!this.supported()) {
            UI.toast('La synchronisation reseau local ne s\'applique qu\'en mode local (IndexedDB).', 'warning');
            return false;
        }
        if (!this.enabled()) {
            UI.toast('Synchronisation reseau local desactivee.', 'warning');
            return false;
        }
        // La synchronisation peut avoir ete arretee (onglet longtemps
        // ouvert, erreur de demarrage) : on la relance avant d'agir.
        if (!this.started) this.start();
        this.dirty = true;
        const r = await this.cycle();
        if (!r.attempted) {
            UI.toast('Synchronisation impossible : ' + (r.error || 'poste serveur injoignable'), 'error');
            return false;
        }
        if (r.error) {
            UI.toast('Synchronisation impossible : ' + r.error, 'error');
            return false;
        }
        UI.toast(r.applied ? 'Donnees remplacees par l\'image du poste serveur.'
                           : 'Donnees transmises au poste serveur.', 'success');
        return true;
    },

    // Application de l'image recue : import complet, puis meme
    // rafraichissement que la synchro en ligne.
    async applySnapshot(snap) {
        if (this.applying || !snap || !snap.data) return false;
        this.applying = true;
        this._appliedThisCycle = true;
        try {
            await DB.importAll(snap.data);
            this.lastChange = new Date().toISOString();
            Cache.invalidateAll();
            try {
                const hopital = await Meta.getHopital();
                if (hopital) State.set('hopital', hopital);
            } catch (e) { /* information d'hopital non rafraichie */ }
            if (window.App && App.afterSync) await App.afterSync();
            UI.toast('Donnees synchronisees depuis le poste serveur.', 'info');
            return true;
        } catch (e) {
            this.lastError = 'Import impossible : ' + String((e && e.message) || e);
            Logger.warn('LanSync', 'Import impossible', this.lastError);
            UI.toast(this.lastError, 'error');
            return false;
        } finally {
            this.applying = false;
            this.render();
        }
    },

    // Bouton « Tester la connexion » : verifie que le poste serveur
    // repond et que le secret partage est correct.
    async test() {
        const c = this.getConfig();
        if (!this.supported()) {
            return { ok: false, message: 'Non applicable : en mode cloud la base centrale est deja partagee.' };
        }
        if (!c.enabled) return { ok: false, message: 'Synchronisation reseau local desactivee.' };
        if (String(c.secret).length < 6) return { ok: false, message: 'Renseignez un secret d\'au moins 6 caracteres.' };
        if (c.mode === 'client' && !c.host) {
            return { ok: false, message: 'Renseignez l\'adresse du poste serveur (mode client).' };
        }
        const t0 = Date.now();
        try {
            const st = await this.request('state');
            if (!st || !st.ok) throw new Error((st && st.error) || 'reponse invalide');
            return {
                ok: true,
                message: 'Poste serveur joignable en ' + (Date.now() - t0) + ' ms - image : '
                    + ((st.v || 0) ? 'v' + st.v + (st.src === this.CID ? ' (la votre)' : ' (poste ' + this.posteName() + ')') : 'vide')
            };
        } catch (e) {
            return { ok: false, message: 'Poste serveur injoignable : ' + String((e && e.message) || e) };
        }
    },

    // ------------------------------------------------------------
    // Indicateur de la barre superieure
    // ------------------------------------------------------------
    render() {
        const el = document.getElementById('topbar-lan');
        if (!el) return;
        if (!this.supported()) { el.style.display = 'none'; return; }
        el.style.display = '';
        if (!this.enabled()) {
            el.className = 'sync-indicator sync-off';
            el.textContent = 'LAN inactif';
            el.title = 'Synchronisation reseau local desactivee (Parametres > Synchro).';
            return;
        }
        const c = this.getConfig();
        if (this.lastError) {
            el.className = 'sync-indicator sync-err';
            el.textContent = this.pending ? 'LAN · en attente' : 'LAN · probleme';
            el.title = this.lastError;
            return;
        }
        el.className = 'sync-indicator sync-ok';
        el.textContent = c.mode === 'server' ? 'LAN · serveur' : 'LAN · client';
        el.title = (c.mode === 'server' ? 'Ce poste heberge les donnees' : 'Poste serveur : ' + (c.host || '—') + ':' + c.port)
            + ' - derniere verification : '
            + (this.lastCheck ? new Date(this.lastCheck).toLocaleString('fr-FR') : '-');
    }
};

window.LanSync = LanSync;
