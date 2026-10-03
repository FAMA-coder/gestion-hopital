// ============================================================
// js/sync.js — Synchronisation « en ligne (internet) »
// ------------------------------------------------------------
// En mode cloud, la base centrale (Firebase / Supabase) est la
// source unique partagee par tous les postes de l'etablissement :
// la synchronisation ne recopie donc PAS les donnees, elle
// signale les modifications emanant des autres postes et
// rafraichit l'ecran en cours.
//
// Principe :
//   1. toute ecriture locale (DB.put/putAll/delete/clear) appelle
//      Sync.changed() ; le push est debounce (1,5 s) et ecrit un
//      marqueur leger { v, src, poste } sous
//      /sync/{hopital}/{dossier}.
//   2. tous les intervalles, chaque poste relit ce marqueur. Si
//      « v » est plus recente et provient d'un autre poste, la
//      donnee a change : cache vid, session revalidee, module
//      courant re-rendu.
//   3. « src » identifie le poste : un poste ne se declenche pas
//      lui-meme, et le premier tirage adopte l'image existante
//      sans rafraichir (garde bootstrap).
//
// Configuration : Parametres > Synchro > En ligne (internet).
// Conservee par poste dans localStorage (cle gh_sync_online) :
// aucun marquage n'est ecrit dans la base a chaque ouverture.
// ============================================================
const Sync = {
    KEY: 'gh_sync_online',
    DEBOUNCE_MS: 1500,
    INTERVALS: [5, 10, 15, 30, 60, 120],

    CID: (window.crypto && window.crypto.randomUUID)
        ? window.crypto.randomUUID()
        : (Math.random().toString(36).slice(2) + Date.now().toString(36)),

    ready: false,
    dirty: false,
    pushTimer: null,
    pollTimer: null,
    busy: false,
    applying: false,
    lastV: 0,
    lastError: '',
    lastCheck: null,
    lastChange: null,
    state: 'off',
    _on: false,
    _sig: null,

    // ------------------------------------------------------------
    // Configuration
    // ------------------------------------------------------------
    defaults() {
        return { enabled: false, folder: 'hopital', interval: 15, poste: '' };
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
        const interval = parseInt(o.interval, 10);
        return {
            enabled: o.enabled === true,
            folder: String(o.folder || base.folder),
            interval: this.INTERVALS.indexOf(interval) >= 0 ? interval : base.interval,
            poste: String(o.poste || base.poste)
        };
    },

    // Enregistre la configuration depuis l'ecran Parametres puis
    // (re)demarre la synchronisation sans recharger l'application.
    setConfig(o) {
        const cur = this.getConfig();
        const next = {
            enabled: !!(o && o.enabled),
            folder: String((o && o.folder) || cur.folder).trim() || 'hopital',
            interval: parseInt((o && o.interval) || cur.interval, 10),
            poste: String((o && o.poste) !== undefined ? (o.poste || '') : (cur.poste || '')).trim()
        };
        if (this.INTERVALS.indexOf(next.interval) < 0) next.interval = 15;
        try {
            localStorage.setItem(this.KEY, JSON.stringify(next));
        } catch (e) { /* configuration non persistee */ }
        this.reconfigure();
        return this.getConfig();
    },

    setPosteName(name) {
        const c = this.getConfig();
        c.poste = String(name || '').trim();
        try { localStorage.setItem(this.KEY, JSON.stringify(c)); } catch (e) { /* ignore */ }
        return c.poste;
    },

    // Nom du poste : affiche dans l'indicateur et transmis aux autres
    // postes pour que l'administrateur sache qui a modifie les donnees.
    posteName() {
        const c = this.getConfig();
        return c.poste || ('Poste ' + this.CID.slice(0, 4));
    },

    // ------------------------------------------------------------
    // Disponibilite : uniquement en mode cloud (base centrale).
    // En mode local, c'est LanSync (reseau local) qui prend le relais.
    // ------------------------------------------------------------
    supported() {
        return !!(window.DB && DB.mode() === 'cloud' && window.RemoteDB && RemoteDB.ready);
    },

    // Base centrale reellement utilisee (lue dans js/config.js ; en
    // lecture seule dans l'interface : la changer necessite de
    // redeployer l'application).
    backendLabel() {
        const c = window.APP_CONFIG || {};
        if (DB.mode() !== 'cloud') return 'Mode local (IndexedDB) - aucune base centrale';
        if (String(c.BACKEND || '').toLowerCase() === 'supabase') {
            return 'Supabase - ' + (c.SUPABASE_URL || 'non configuree');
        }
        return 'Firebase - ' + (c.FIREBASE_DATABASE_URL || 'non configuree');
    },

    // Marqueur : /sync/{hopital}/{dossier}
    markerPath() {
        const c = this.getConfig();
        const tid = (window.Tenant && Tenant.get()) || 'local';
        return '/sync/' + encodeURIComponent(tid) + '/' + encodeURIComponent(c.folder) + '.json';
    },

    enabled() {
        return !!(this.getConfig().enabled && this.supported());
    },

    // ------------------------------------------------------------
    // Cycle de vie
    // ------------------------------------------------------------
    init() {
        this.stop();
        if (!this.enabled()) {
            this.state = this.supported() ? 'off' : 'na';
            this.render();
            return;
        }
        this.state = 'on';
        this.lastError = '';
        this._on = true;
        this.pull().then(() => {
            if (this._on && this.ready) {
                this.pollTimer = setInterval(() => this.pull(), this.getConfig().interval * 1000);
            }
        });
        window.addEventListener('online', this._onOnline);
        document.addEventListener('visibilitychange', this._onVisible);
        this.render();
    },

    _onOnline() { if (this._on && this.enabled()) this.pull(); },

    _onVisible() {
        if (!document.hidden && this._on && this.enabled()) this.pull();
    },

    stop() {
        if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
        if (this.pushTimer) { clearTimeout(this.pushTimer); this.pushTimer = null; }
        window.removeEventListener('online', this._onOnline);
        document.removeEventListener('visibilitychange', this._onVisible);
        this._on = false;
        this.ready = false;
        this.dirty = false;
        this.busy = false;
        this._sig = null;
    },

    reconfigure() {
        this.stop();
        this.init();
    },

    // ------------------------------------------------------------
    // Ecriture locale -> marquage « a publier »
    // ------------------------------------------------------------
    changed() {
        if (!this._on || !this.enabled() || this.applying) return;
        this.dirty = true;
        this.schedule();
    },

    schedule() {
        if (!this._on || !this.enabled() || this.applying || !this.dirty) return;
        if (this.pushTimer) clearTimeout(this.pushTimer);
        this.pushTimer = setTimeout(() => this.push(), this.DEBOUNCE_MS);
    },

    async push() {
        this.pushTimer = null;
        if (!this._on || !this.enabled() || !this.dirty || this.applying || this.busy) return;
        this.dirty = false;
        this.busy = true;
        try {
            const marker = {
                v: Date.now(),
                src: this.CID,
                poste: this.posteName(),
                action: 'modification'
            };
            await RemoteDB.rawPut(this.markerPath(), marker);
            this.lastV = marker.v;
            this.state = 'on';
            this.lastError = '';
        } catch (e) {
            this.dirty = true;
            this.state = 'error';
            this.lastError = String((e && e.message) || e);
            Logger.warn('Sync', 'Publication du marqueur impossible', this.lastError);
        } finally {
            this.busy = false;
            this.schedule();
            this.render();
        }
    },

    // ------------------------------------------------------------
    // Lecture du marqueur + detection d'une modification distante
    // ------------------------------------------------------------
    async pull() {
        if (!this._on || !this.enabled() || this.applying || this.busy) return false;
        this.busy = true;
        let remote = false;
        try {
            const marker = await RemoteDB.rawGet(this.markerPath());
            const v = (marker && marker.v) || 0;
            // Un marqueur sans « src » (ancien format) est considere
            // comme etranger a ce poste : mieux vaut rafraichir.
            const other = !(marker && marker.src === this.CID);
            const sig = v + '|' + (marker && marker.poste ? marker.poste : '');

            if (this._sig === null) {
                // Premier tirage : on adopte l'image existante.
                this._sig = sig;
                this.lastV = v;
            } else if (sig !== this._sig) {
                // Le marqueur a change et il n'est pas de ce poste :
                // une donnee a ete modifiee ailleurs. La comparaison
                // porte sur l'identite du marqueur et non sur l'horloge
                // (« v »), afin de rester fiable si les postes n'ont
                // pas exactement la meme heure.
                this._sig = sig;
                this.lastV = Math.max(this.lastV, v);
                remote = other;
            }

            this.state = 'on';
            this.lastError = '';
            this.lastCheck = new Date().toISOString();
            this.ready = true;
        } catch (e) {
            this.state = 'error';
            this.lastError = String((e && e.message) || e);
            Logger.warn('Sync', 'Lecture du marqueur impossible', this.lastError);
        } finally {
            this.busy = false;
        }

        if (remote) await this.applyRemote('distante');
        else this.render();
        return remote;
    },

    // Donnees modifiees ailleurs : cache vide puis rafraichissement
    // de l'ecran. La session est revalidee par App.afterSync()
    // (compte supprime ou desactive, role modifie).
    async applyRemote(reason) {
        if (this.applying) return;
        this.applying = true;
        try {
            this.lastChange = new Date().toISOString();
            Cache.invalidateAll();
            const hopital = await Meta.getHopital();
            if (hopital) State.set('hopital', hopital);
            if (window.App && App.afterSync) await App.afterSync();
            UI.toast(
                reason === 'manuel'
                    ? 'Donnees rechargees depuis la base centrale.'
                    : 'Donnees actualisees depuis un autre poste.',
                'info'
            );
        } catch (e) {
            Logger.warn('Sync', 'Rafraichissement interrompu', String((e && e.message) || e));
        } finally {
            this.applying = false;
            this.render();
        }
    },

    // Bouton « Synchroniser maintenant » : verification immediate,
    // suivie d'un rechargement complet meme si aucune marqueur n'a
    // change (l'utilisateur l'a demande explicitement).
    async syncNow() {
        if (!this.supported()) {
            UI.toast('Synchronisation en ligne reservee au mode cloud (base centrale).', 'warning');
            return false;
        }
        if (!this.enabled()) {
            UI.toast('Synchronisation en ligne desactivee : rien a rafraichir automatiquement.', 'warning');
        }
        const remote = await this.pull();
        if (!remote) await this.applyRemote('manuel');
        return true;
    },

    // Bouton « Tester la connexion » : verifie que la base centrale
    // repond et que le dossier de synchronisation est accessible.
    async test() {
        if (!this.supported()) {
            return { ok: false, message: 'Mode local : aucune base centrale configuree.' };
        }
        const t0 = Date.now();
        try {
            await RemoteDB.probe();
            const marker = await RemoteDB.rawGet(this.markerPath());
            const etat = (marker && marker.v)
                ? 'v' + marker.v + (marker.poste ? ' (dernier poste : ' + marker.poste + ')' : '')
                : 'jamais ecrit';
            return { ok: true, message: 'Connexion reussie en ' + (Date.now() - t0) + ' ms - marqueur : ' + etat };
        } catch (e) {
            return { ok: false, message: 'Connexion impossible : ' + String((e && e.message) || e) };
        }
    },

    // ------------------------------------------------------------
    // Indicateur de la barre superieure
    // ------------------------------------------------------------
    render() {
        const el = document.getElementById('topbar-sync');
        if (!el) return;
        // En mode local, l'indicateur reseau local (LanSync) prend
        // le relais : celui-ci reste masque.
        if (!this.supported()) { el.style.display = 'none'; return; }
        el.style.display = '';
        if (!this.enabled()) {
            el.className = 'sync-indicator sync-off';
            el.textContent = 'Synchro inactive';
            el.title = 'Synchronisation en ligne desactivee (Parametres > Synchro).';
            return;
        }
        if (this.state === 'error') {
            el.className = 'sync-indicator sync-err';
            el.textContent = 'Synchro · probleme';
            el.title = this.lastError || 'Erreur de synchronisation';
            return;
        }
        el.className = 'sync-indicator sync-ok';
        el.textContent = 'Synchro · ' + this.getConfig().interval + ' s';
        el.title = 'Synchronisation en ligne active. Derniere verification : '
            + (this.lastCheck ? new Date(this.lastCheck).toLocaleString('fr-FR') : '-');
    }
};

window.Sync = Sync;